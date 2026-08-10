import type { AudienceProfile, SongIdea, WorkspaceId } from '../types';
import type { SongAudioMetrics, TempoEstimate, VocalMetrics } from './audioAnalysis';
import type { AudioMeasurements } from './audioMeasurements';
import { currentWorkspaceId, DEFAULT_WORKSPACE_ID, scopeFilter } from './workspaceScope';
import { openAudioDb, TAKES_STORE, withAudioStore } from './audioDb';
import { estimateSongLengthSec } from './bpmLengthControl';

/**
 * TASK v3.74 (TASK A) — "테이크(take)": one rendered mp3 for one track's
 * prompt. A track can have 1..N takes (Suno's own "generate 2 versions"
 * habit); at most one is ever `adopted`. This is the record a real listen
 * (or a plain adoption choice — see core/audioAdoption.ts) attaches to.
 *
 * Mirrors core/ratingLedger.ts's IndexedDB pattern exactly (openDb/withStore
 * shape), in its own database (`suno-weaver-audio`) rather than a new store
 * inside suno-weaver-ratings — a take isn't a rating (most takes are never
 * explicitly rated at all; adoption alone is signal, see TASK G), so giving
 * it its own shape/lifecycle (deletable independently of any rating) is
 * clearer than overloading RatingRecord.
 *
 * Never stores the audio file itself — only measurements (this task's own
 * "음원 파일 자체는 저장하지 마십시오": 18 tracks x 2 takes x ~5MB would be
 * ~180MB, well past what IndexedDB should hold for this app).
 */

export interface AudioTakeDirectives {
  genreId: string;
  killingPointId?: string;
  arcPhase?: string;
  introMode?: string;
  vocalType: string;
  /**
   * Best-effort only: SongIdea persists the resolved gender (`vocalType`)
   * but not the full per-song register/delivery/timbre/proximity text
   * (v3.72's axis combo) — that's only ever materialized transiently into
   * `stylePrompt` at generation time, not kept as its own field. Falls back
   * to `vocalType` when nothing richer is available.
   */
  vocalDescriptor: string;
  targetBpm: number;
  targetDurationSec: [number, number];
  /**
   * 지시문 28 (TASK C-2/C-6) — targetDurationSec(위)는 오디언스 프로필의
   * 워크스페이스 전체 대역(예: 190~215초)이라 "이 곡 하나"의 기대치로는
   * 너무 넓다. estimateSongLengthSec(bpm, structureTemplate)는 이 트랙
   * 하나의 설계 시점 개별 추정값이라 "설계 3:20 / 실제 2:44"처럼 더 날카로운
   * 대조가 가능하다. 단, 실측(20260810 60년대 세트) 결과 이 추정값 자체가
   * 실제 길이보다 최대 120초까지 벗어나는 것으로 확인됐다(오차 원인:
   * BPM_LENGTH_TIERS 자체가 아니라 Suno가 설계 BPM대로 렌더하지 않는다는
   * 것 — 배음 보정 후에도 함의 계수가 0.70~1.49로 곡마다 들쭉날쭉해 단일
   * 계수로 고칠 수 없다는 것까지 확인됨). 그래서 이 필드는 checkCoreAudioCompliance의
   * blocking pass/warn/fail 체계에는 넣지 않는다 — 표시만 한다(§하지 말 것
   * "음원 측정으로 세트를 차단하지 말 것"). song.bpm이 없으면 undefined —
   * 추정할 근거가 없는 곡에 억지로 값을 채우지 않는다.
   */
  targetEstimatedLengthSec?: number;
  instrumentAtoms: string[];
}

export interface AudioTake {
  takeId: string;
  songId: string;
  trackNo: number;
  packId: string;
  /** TASK v3.74 (TASK H) — not in the spec's own AudioTake sketch, added so TASK H's feedback loop can query "this channel's takes" without an extra pack lookup (AudioTake otherwise only carries packId, and a saved pack's channelId isn't guaranteed to still exist by the time a take is queried). */
  channelId?: string;
  /** v4.0 (TASK A1) — wired up: recordTake() stamps it, getTakes() filters by it (core/workspaceScope.ts's scopeFilter). Optional only so takes recorded before this task keep loading (treated as 'senior-oldpop'). */
  workspaceId?: WorkspaceId;

  fileName: string;
  versionLabel: string;
  /** `adopted` IS this spec's own "selected" concept (지시문 06 TASK A's `selected: boolean`) — kept under its real, already-wired name rather than adding a redundant duplicate field; setAdopted() below already enforces "at most one per song". */
  adopted: boolean;

  metrics: SongAudioMetrics;
  vocalMetrics: VocalMetrics;
  tempoEstimate: TempoEstimate;

  directives: AudioTakeDirectives;

  analyzedAt: string;

  /**
   * codex 지시문 06 (TASK A) — real, genuinely new fields this task adds.
   * All optional so every take recorded before this task keeps loading
   * unchanged (same additive convention as `workspaceId` above).
   */
  /** Sequence number among this song's own takes (1, 2, 3...) — distinct from `versionLabel` (free-text, e.g. "v2 brighter mix"), a real ordinal a comparison UI can sort/label by without parsing that string. */
  takeNo?: number;
  source?: 'upload' | 'suno-api' | 'other';
  rating?: 'good' | 'ok' | 'bad';
  rejectionReasons?: string[];
  /** The genuinely new clipping/silence/LUFS-approx/stereo-width/sampleRate/channels measurements (core/audioMeasurements.ts) — additive alongside the existing metrics/vocalMetrics/tempoEstimate, not a replacement for them. */
  measurements?: AudioMeasurements;
}

/**
 * Pure — builds a take's directive snapshot from the saved song + this
 * channel's audience profile, so recording a take never needs the original
 * (long-gone) generation-time slot data.
 *
 * `instrumentAtoms`/`introMode` are always empty/undefined unless supplied:
 * both `instrumentSet` and `introMode` are PreassignedSongSlot-only fields
 * (the per-song instrument rotation and intro-vocal-timing plan used while
 * composing the prompt) — neither is persisted onto the saved SongIdea, so
 * a take recorded after the fact (from an uploaded mp3, long after the
 * original slot is gone) has no reliable source for them. Left as explicit
 * optional overrides so a caller that still has the original slot (e.g.
 * right after local generation, before the pack is even saved) can supply
 * real values instead.
 */
export function buildTakeDirectives(
  song: Pick<SongIdea, 'genreId' | 'killingPointId' | 'arcPhase' | 'vocalType' | 'bpm' | 'structureTemplate'>,
  audienceProfile: AudienceProfile,
  options: { instrumentAtoms?: string[]; introMode?: string } = {}
): AudioTakeDirectives {
  return {
    genreId: song.genreId ?? 'unknown',
    killingPointId: song.killingPointId,
    arcPhase: song.arcPhase,
    introMode: options.introMode,
    vocalType: song.vocalType ?? 'unknown',
    vocalDescriptor: song.vocalType ?? 'unknown',
    targetBpm: song.bpm ?? 0,
    targetDurationSec: audienceProfile.songLengthSecondsRange,
    targetEstimatedLengthSec: song.bpm ? Math.round(estimateSongLengthSec(song.bpm, song.structureTemplate)) : undefined,
    instrumentAtoms: options.instrumentAtoms ?? []
  };
}

/**
 * codex 지시문 06 (TASK A) — real, pure helper: the next takeNo for a song
 * that already has N takes recorded (1 when it has none yet). Pure so a
 * caller can compute this before ever touching IndexedDB — same
 * "1..N takes, at most one adopted" real shape this file's own top doc
 * comment already establishes, this just gives that ordinal a real number
 * instead of leaving every take's own position among its siblings implicit
 * in `versionLabel` free text.
 */
export function nextTakeNo(existingTakesForSong: readonly Pick<AudioTake, 'songId' | 'takeNo'>[], songId: string): number {
  const sameSong = existingTakesForSong.filter(take => take.songId === songId);
  const maxTakeNo = sameSong.reduce((max, take) => Math.max(max, take.takeNo ?? 0), 0);
  return maxTakeNo + 1;
}

/** v4.15 (TASK B) — DB open/upgrade now lives in core/audioDb.ts, shared with core/audioArchive.ts's new 'archives' store in this same database (see that module's own doc comment on why one shared opener is required, not two independent indexedDB.open calls). STORE kept as a local alias so the rest of this file reads unchanged. */
const STORE = TAKES_STORE;

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return withAudioStore<T>(STORE, mode, fn);
}

export async function recordTake(take: AudioTake): Promise<void> {
  await withStore('readwrite', store => store.put({ ...take, workspaceId: take.workspaceId ?? currentWorkspaceId() }));
}

export async function getTakes(filter?: { packId?: string; songId?: string; channelId?: string }): Promise<AudioTake[]> {
  const all = await withStore<AudioTake[]>('readonly', store => store.getAll());
  return scopeFilter(all).filter(take =>
    (!filter?.packId || take.packId === filter.packId)
    && (!filter?.songId || take.songId === filter.songId)
    && (!filter?.channelId || take.channelId === filter.channelId)
  );
}

export async function deleteTake(takeId: string): Promise<void> {
  await withStore('readwrite', store => store.delete(takeId));
}

/** v4.0 (TASK A1, migration) — additive-only, idempotent; see core/library.ts's migrateLibraryWorkspaceTags for the shared contract. */
export async function migrateAudioTakesWorkspaceTags(): Promise<{ totalRecords: number; taggedSeniorOldpop: number }> {
  const all = await withStore<AudioTake[]>('readonly', store => store.getAll());
  for (const take of all) {
    if (!take.workspaceId) await withStore('readwrite', store => store.put({ ...take, workspaceId: DEFAULT_WORKSPACE_ID }));
  }
  return { totalRecords: all.length, taggedSeniorOldpop: all.filter(t => (t.workspaceId ?? DEFAULT_WORKSPACE_ID) === DEFAULT_WORKSPACE_ID).length };
}

/** v4.1 (TASK A2) — export-oriented read for one explicit workspace, across every pack/song/channel (unlike getTakes(), which requires a filter). */
export async function listAllTakesForWorkspace(workspaceId: WorkspaceId): Promise<AudioTake[]> {
  const all = await withStore<AudioTake[]>('readonly', store => store.getAll());
  return scopeFilter(all, workspaceId);
}

/** v4.1 (TASK A2) — the import path's primitive: `takeId`-keyed, newest `analyzedAt` wins (spec §3-2). workspaceId is always stamped from the current workspace. */
export async function putTakeIfNewer(take: AudioTake): Promise<'written' | 'skipped'> {
  const workspaceId = currentWorkspaceId();
  const existing = (await listAllTakesForWorkspace(workspaceId)).find(t => t.takeId === take.takeId);
  if (existing && existing.analyzedAt >= take.analyzedAt) return 'skipped';
  await withStore('readwrite', store => store.put({ ...take, workspaceId }));
  return 'written';
}

/** Marks `takeId` adopted and un-adopts every other take of the same song (a trackNo/song only ever has one adopted take at a time — see this task's own AudioTake.adopted doc comment). */
export async function setAdopted(takeId: string): Promise<void> {
  const all = await withStore<AudioTake[]>('readonly', store => store.getAll());
  const target = all.find(take => take.takeId === takeId);
  if (!target) return;
  const db = await openAudioDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const take of all) {
      if (take.songId !== target.songId) continue;
      const shouldBeAdopted = take.takeId === takeId;
      if (take.adopted !== shouldBeAdopted) store.put({ ...take, adopted: shouldBeAdopted });
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error('IndexedDB request failed.')); };
  });
}
