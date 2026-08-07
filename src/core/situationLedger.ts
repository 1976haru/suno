import type { LyricLanguage, PlaylistBlueprint, WorkspaceId } from '../types';
import { currentWorkspaceId, DEFAULT_WORKSPACE_ID, scopeFilter } from './workspaceScope';

/**
 * v5.22 (AXIS 1, TASK B §1-6) — same real bug hookLedger.ts's own doc
 * comment describes for hooks, one level up: `SongIdea.listenerSituation`
 * (the concrete scene a lyric is actually built around) had NO cross-pack
 * memory at all. Two sets generated from genuinely different concepts still
 * drew from the same fixed 40-archetype `lyricThemesForArchetype` pool (see
 * data/lyricThemes.ts), so nothing outside this ledger could ever tell a
 * later generation "this scene was already used" — a real audit measured
 * 17/18 scenes colliding across two concept-distinct sets. This ledger is
 * the memory; core/multiSetImportInspection.ts's cross-set check and the
 * bridge instruction's own recent-scene avoid-list are the two real
 * consumers (see their own doc comments).
 *
 * Deliberately its own store, not folded into hookLedger.ts's existing one —
 * a scene is a different lifecycle question ("was this concrete situation
 * already written, in the last 10 SETS") than a hook ("was this exact
 * phrase already used, ever") and mixing the two would make hookLedger's own
 * hook-pool-exhaustion math (poolSize-based) harder to reason about.
 */
const DB_NAME = 'suno-weaver-situations';
const DB_VERSION = 1;
const STORE = 'usage';

export interface SituationUsage {
  /** `${workspaceId}::${packId}:${trackNo}` — same id shape as hookLedger.ts's HookUsage, same reason (forgetPack needs to find every record for a pack without a secondary index). */
  id: string;
  situation: string;
  channelId: string;
  language: LyricLanguage;
  usedAt: string;
  packId: string;
  trackNo: number;
  workspaceId?: WorkspaceId;
  /**
   * codex 지시문 02 (TASK B) — SongIdea.lyricFrameId/lyricThemeMotionKo/
   * lyricThemeCastKo/lyricThemeEraSettingKo, when this song has them (see
   * batchPreallocation.ts's reconcileWithPreassignedSlot for where these are
   * actually populated now — a real gap this task closed, they used to be
   * declared on SongIdea but never copied from the slot). Optional: a song
   * generated before this task, or with no matching slot, has none of these.
   */
  frameId?: string;
  motionKo?: string;
  castKo?: string;
  eraSettingKo?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
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

async function allRecords(): Promise<SituationUsage[]> {
  const all = await withStore<SituationUsage[]>('readonly', store => store.getAll());
  return scopeFilter(all);
}

/**
 * Idempotent, same convention as hookLedger.ts's recordPackHooks: clears
 * this pack's own prior entries first, so re-saving an updated/renamed pack
 * replaces rather than duplicates. Only records songs with a non-empty
 * `listenerSituation` — a song from before this field existed, or a
 * display-only synthetic blueprint, silently contributes nothing rather
 * than a misleading empty-string entry.
 */
export async function recordPackSituations(packId: string, channelId: string, blueprint: PlaylistBlueprint, language: LyricLanguage): Promise<void> {
  await forgetPack(packId);
  const now = new Date().toISOString();
  for (const song of blueprint.songs) {
    if (!song.listenerSituation?.trim()) continue;
    const record: SituationUsage = {
      id: `${currentWorkspaceId()}::${packId}:${song.trackNo}`,
      situation: song.listenerSituation.trim(),
      channelId,
      language,
      usedAt: now,
      packId,
      trackNo: song.trackNo,
      workspaceId: currentWorkspaceId(),
      ...(song.lyricFrameId ? { frameId: song.lyricFrameId } : {}),
      ...(song.lyricThemeMotionKo ? { motionKo: song.lyricThemeMotionKo } : {}),
      ...(song.lyricThemeCastKo ? { castKo: song.lyricThemeCastKo } : {}),
      ...(song.lyricThemeEraSettingKo ? { eraSettingKo: song.lyricThemeEraSettingKo } : {})
    };
    await withStore('readwrite', store => store.put(record));
  }
}

export async function forgetPack(packId: string): Promise<void> {
  const all = await allRecords();
  const ids = all.filter(u => u.packId === packId).map(u => u.id);
  for (const id of ids) {
    await withStore('readwrite', store => store.delete(id));
  }
}

/** v5.22 (AXIS 1) — same scoped-delete rationale as hookLedger.ts's clearAllHookHistory: "전체 삭제" only ever means the CURRENT workspace's own packs. */
export async function clearAllSituationHistory(): Promise<void> {
  const all = await allRecords();
  for (const record of all) {
    await withStore('readwrite', store => store.delete(record.id));
  }
}

/**
 * v5.22 (AXIS 1 §1-6) — "최근 10세트": grouped by SET (packId), not by flat
 * record count — an 18-song set is worth exactly one slot in the "last 10"
 * window, not 18. Sets are ordered by their own recording time
 * (every song in one recordPackSituations() call shares the same `usedAt`),
 * most-recent first.
 */
export async function recentSituations(channelId: string, language: LyricLanguage, setLimit = 10): Promise<string[]> {
  const all = await allRecords();
  const scoped = all.filter(u => u.channelId === channelId && u.language === language);
  const packOrder = Array.from(new Set(scoped.slice().sort((a, b) => (a.usedAt < b.usedAt ? 1 : -1)).map(u => u.packId)));
  const recentPackIds = new Set(packOrder.slice(0, setLimit));
  return scoped.filter(u => recentPackIds.has(u.packId)).map(u => u.situation);
}

/**
 * codex 지시문 01 (TASK H) — core/generationHistoryRevision.ts's own
 * GenerationHistorySnapshot.recentSceneSignatures: the same real
 * cross-pack window recentSituations above already computes, just
 * returned with enough identity (packId/trackNo, not only the bare
 * situation string) to trace which pack/track a scene actually came from.
 * Same filtering/ordering as recentSituations — this is not a second,
 * possibly-diverging window, just a richer projection of the identical set.
 */
export interface SceneSignature {
  situation: string;
  packId: string;
  trackNo: number;
  /**
   * codex 지시문 02 (TASK B) — widened from the 3-field minimal shape this
   * type shipped with under codex 지시문 01 (see SituationUsage's own
   * matching doc comment for why these are real now, not fabricated).
   * Optional: absent for any scene recorded before this task, or for a
   * song reconciled with no matching slot.
   */
  frameId?: string;
  motionKo?: string;
  castKo?: string;
  eraSettingKo?: string;
}

export async function recentSceneSignatures(channelId: string, language: LyricLanguage, setLimit = 10): Promise<SceneSignature[]> {
  const all = await allRecords();
  const scoped = all.filter(u => u.channelId === channelId && u.language === language);
  const packOrder = Array.from(new Set(scoped.slice().sort((a, b) => (a.usedAt < b.usedAt ? 1 : -1)).map(u => u.packId)));
  const recentPackIds = new Set(packOrder.slice(0, setLimit));
  return scoped.filter(u => recentPackIds.has(u.packId)).map(u => ({
    situation: u.situation,
    packId: u.packId,
    trackNo: u.trackNo,
    ...(u.frameId ? { frameId: u.frameId } : {}),
    ...(u.motionKo ? { motionKo: u.motionKo } : {}),
    ...(u.castKo ? { castKo: u.castKo } : {}),
    ...(u.eraSettingKo ? { eraSettingKo: u.eraSettingKo } : {})
  }));
}

export async function listAllSituationsForWorkspace(workspaceId: WorkspaceId): Promise<SituationUsage[]> {
  const all = await withStore<SituationUsage[]>('readonly', store => store.getAll());
  return scopeFilter(all, workspaceId);
}

/** v5.22 (AXIS 1, A2 import primitive) — same union-merge/id-reconstruction contract as hookLedger.ts's putHookRecord. */
export async function putSituationRecord(record: SituationUsage): Promise<void> {
  const workspaceId = currentWorkspaceId();
  const stamped: SituationUsage = { ...record, workspaceId, id: `${workspaceId}::${record.packId}:${record.trackNo}` };
  await withStore('readwrite', store => store.put(stamped));
}

/** v5.22 (AXIS 1, migration) — same shape/contract as core/library.ts's migrateLibraryWorkspaceTags: additive-only, idempotent. */
export async function migrateSituationLedgerWorkspaceTags(): Promise<{ totalRecords: number; taggedSeniorOldpop: number }> {
  const all = await withStore<SituationUsage[]>('readonly', store => store.getAll());
  for (const record of all) {
    if (!record.workspaceId) await withStore('readwrite', store => store.put({ ...record, workspaceId: DEFAULT_WORKSPACE_ID }));
  }
  return { totalRecords: all.length, taggedSeniorOldpop: all.filter(r => (r.workspaceId ?? DEFAULT_WORKSPACE_ID) === DEFAULT_WORKSPACE_ID).length };
}
