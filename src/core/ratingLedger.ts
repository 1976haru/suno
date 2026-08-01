import type { SongIdea, WorkspaceId } from '../types';
import { currentWorkspaceId, DEFAULT_WORKSPACE_ID, scopeFilter } from './workspaceScope';

/**
 * TASK v3.68 (TASK B) — "청취 평가 루프": six prior tasks measured text
 * metrics that improved while a real listen still scored 60-70/100 (see
 * docs/v368-report.md §0). This is the first place the app records what a
 * human actually heard, keyed by songId (core/library.ts's migratePackSongIds
 * backfills it for packs saved before this task) rather than trackNo, which
 * resets to 1 in every new pack.
 *
 * Mirrors core/videoLedger.ts's own IndexedDB pattern exactly (same
 * openDb/withStore shape, same "pure analysis function separate from the
 * IndexedDB read" split) — a deliberately separate database from
 * suno-weaver-library, so deleting a saved pack (core/library.ts's
 * deletePack) can never delete the ratings recorded against its songs.
 */

const DB_NAME = 'suno-weaver-ratings';
const DB_VERSION = 1;
const STORE = 'ratings';

export type SongRating = 'good' | 'ok' | 'bad';

export interface RatingAttributes {
  genreId: string;
  eraTag?: string;
  /** v3.67 killing point id (data/killingPoints.ts), when this track's arc gave it one. */
  killingPointId?: string;
  /** v3.67 arc phase (core/arcPlan.ts). */
  arcPhase?: string;
  /** v3.67 arc intensity, 1-5. */
  intensity?: number;
  bpm: number;
  vocalType: string;
  structureTemplate?: string;
  /** v3.64-B rotating earworm melodic-design phrase text (no discrete id exists — see core/promptComposer.ts's EARWORM_STYLE_VARIANTS, a plain string pool). */
  earwormVariantId?: string;
  /**
   * v3.63 SetDirector segment label (e.g. "카펜터스풍"). Always undefined
   * today: segment identity doesn't survive past setDirector.ts into the
   * slot/song pipeline (the same limitation docs/v367-report.md §8-2
   * already disclosed for killing-point assignment) — never fabricated
   * here. Kept as a real field so it starts working the moment that gap is
   * closed, without a RatingRecord shape change.
   */
  segmentLabel?: string;
  /** v3.64 lyric scene frame id (data/lyricThemes.ts's LyricTheme.frameId). */
  lyricFrameId?: string;
  moneyChordId?: string;
  channelId: string;
  /**
   * v3.73 (TASK E) — measured from a real rendered mp3 (core/audioAnalysis.ts),
   * not predicted from text. Undefined for the vast majority of ratings (only
   * present when the user rated a song from the 음원 분석 panel, which already
   * has the file decoded) — core/ratingAnalysis.ts's extractors treat an
   * absent value as "excluded from that axis", same as every other optional
   * attribute here.
   */
  audioMetrics?: {
    durationSec: number;
    peakPosition: number;
    dynamicRange: number;
    spectralCentroid: number;
    lowBandRatio: number;
    overallLevel: number;
  };
}

export interface RatingRecord {
  songId: string;
  packId: string;
  rating: SongRating;
  ratedAt: string;
  attributes: RatingAttributes;
  noteKo?: string;
  /** v4.0 (TASK A1) — optional only so records rated before this task keep loading (treated as 'senior-oldpop', see core/workspaceScope.ts's scopeFilter). Learning must never mix workspaces. */
  workspaceId?: WorkspaceId;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'songId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
    tx.oncomplete = () => db.close();
  });
}

/**
 * Builds the attribute snapshot from a generated song + its channel — pure,
 * so it's testable without IndexedDB, and so the caller (the rating UI)
 * never has to know which SongIdea fields map to which attribute.
 */
export function attributesFromSong(song: SongIdea, channelId: string, audioMetrics?: RatingAttributes['audioMetrics']): RatingAttributes {
  return {
    genreId: song.genreId || 'unknown',
    eraTag: song.eraTag,
    killingPointId: song.killingPointId,
    arcPhase: song.arcPhase,
    intensity: song.intensity,
    bpm: song.bpm ?? 0,
    vocalType: song.vocalType || 'unknown',
    structureTemplate: song.structureTemplate,
    earwormVariantId: song.earwormText,
    segmentLabel: undefined,
    lyricFrameId: song.lyricFrameId,
    moneyChordId: song.moneyChordId,
    channelId,
    audioMetrics
  };
}

/** Rates a song, or overwrites its previous rating (re-rating is always allowed — see TASK C's "이미 평가한 곡을 다시 누르면 수정됩니다"). */
export async function recordRating(record: RatingRecord): Promise<void> {
  await withStore('readwrite', store => store.put({ ...record, workspaceId: record.workspaceId ?? currentWorkspaceId() }));
}

export async function getRatings(filter?: { channelId?: string; since?: string }): Promise<RatingRecord[]> {
  const all = await withStore<RatingRecord[]>('readonly', store => store.getAll());
  return scopeFilter(all).filter(record =>
    (!filter?.channelId || record.attributes.channelId === filter.channelId)
    && (!filter?.since || record.ratedAt >= filter.since)
  );
}

export async function getRatingForSong(songId: string): Promise<RatingRecord | null> {
  const record = await withStore<RatingRecord | undefined>('readonly', store => store.get(songId));
  return record ?? null;
}

export async function deleteRating(songId: string): Promise<void> {
  await withStore('readwrite', store => store.delete(songId));
}

/** TASK F (v3.68) — "평가 데이터를 서버로 보내지 말 것. 로컬 저장만." export is a manual, user-triggered file download, never an automatic upload. */
export function exportRatingsToJson(records: RatingRecord[]): string {
  return JSON.stringify(records, null, 2);
}

/** v4.1 (TASK A2) — export-oriented read for one explicit workspace regardless of the current one. */
export async function listAllRatingsForWorkspace(workspaceId: WorkspaceId): Promise<RatingRecord[]> {
  const all = await withStore<RatingRecord[]>('readonly', store => store.getAll());
  return scopeFilter(all, workspaceId);
}

/** v4.0 (TASK A1, migration) — additive-only, idempotent; see core/library.ts's migrateLibraryWorkspaceTags for the shared contract. */
export async function migrateRatingLedgerWorkspaceTags(): Promise<{ totalRecords: number; taggedSeniorOldpop: number }> {
  const all = await withStore<RatingRecord[]>('readonly', store => store.getAll());
  for (const record of all) {
    if (!record.workspaceId) await withStore('readwrite', store => store.put({ ...record, workspaceId: DEFAULT_WORKSPACE_ID }));
  }
  return { totalRecords: all.length, taggedSeniorOldpop: all.filter(r => (r.workspaceId ?? DEFAULT_WORKSPACE_ID) === DEFAULT_WORKSPACE_ID).length };
}
