import type { LyricLanguage, PlaylistBlueprint, SongIdea, WorkspaceId } from '../types';
import { currentWorkspaceId, DEFAULT_WORKSPACE_ID, matchesLedgerScope, scopeFilter, type LedgerScope } from './workspaceScope';
import { openingSixWords as computeOpeningSixWords, parseLyricsSections } from './lyricsAst';
import { resolveWorkspaceIdForChannel } from './channelWorkspaceResolution';

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
  /**
   * 지시문 14 (TASK C-3) — `'unknown'` is a real, intentional third value
   * (not just "unset"): migrateSituationLedgerWorkspaceTags writes it onto a
   * pre-workspace record whose channelId couldn't be resolved to any
   * archetype/workspace (channelWorkspaceResolution.ts's own
   * resolveWorkspaceIdForChannel returned undefined — e.g. Node has no
   * localStorage to check custom channels against). Deliberately never
   * silently folded into DEFAULT_WORKSPACE_ID: matchesLedgerScope's
   * `(record.workspaceId ?? DEFAULT_WORKSPACE_ID) === scope.workspaceId`
   * check only defaults a genuinely ABSENT workspaceId that way — a record
   * explicitly tagged 'unknown' never equals any real WorkspaceId, so it's
   * excluded from every workspace-scoped read instead of silently leaking
   * into whichever workspace happens to ask first.
   */
  workspaceId?: WorkspaceId | 'unknown';
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
  /**
   * 지시문 10 (TASK B-4-2) — the theme ID itself (data/lyricThemes.ts's
   * LyricTheme.id), not just its axis labels (motionKo/castKo/eraSettingKo
   * above, which describe the theme's SHAPE but not its identity — two
   * different themes can share the same motionKo). core/slotPlanOverlap.ts's
   * computeSlotPlanOverlap needs the real id to detect "this trackNo got the
   * literal same theme as last set", the real, measured bug this task closes
   * (18/18 same-trackNo theme duplication across two concept-distinct real
   * packs). Optional: absent for any scene recorded before this task.
   */
  lyricTheme?: string;
  /**
   * 지시문 10 (TASK B-4-3) — first 6 words of this song's own opening line
   * (core/lyricsAst.ts's openingSixWords), lowercased. Cross-SET opening
   * memory: "세트 내부 도입부는 이미 18/18 고유하다. 세트 간 회피만 추가한다" —
   * this field/recentOpenings below are that cross-set addition; no
   * within-set uniqueness check is added anywhere (that already passes).
   */
  openingSixWords?: string;
  /** 지시문 10 (TASK B-4-4) — see resolveSceneSignatureSource's own doc comment below. */
  signatureSource?: SceneSignatureSource;
}

/**
 * 지시문 10 (TASK B-4-4) — "챗지피티 안(TASK 7) 통합": no real generation
 * path in this codebase produces a distinct "provider signature" field
 * separate from listenerSituation — investigation confirmed listenerSituation
 * itself already IS the provider's own written scene summary (bridgeInstruction.ts's
 * own CRITICAL instruction: "각 곡의 listenerSituation 필드에 그 곡의 장면을
 * 한 문장으로 요약해 쓰십시오"). 'provider' means exactly that: the field the
 * provider was asked to write is actually present. When it's missing (an
 * agent that skipped the field, or a pre-this-task saved pack), this derives
 * a local fallback in the directive's own stated priority order — never
 * silently drops the song's ledger entry the way the old
 * `if (!listenerSituation) continue` guard did.
 */
export type SceneSignatureSource = 'provider' | 'local-parser' | 'legacy-missing';

export function resolveSceneSignatureSource(song: Pick<SongIdea, 'listenerSituation' | 'lyricThemeText' | 'lyrics'>): { situation: string; source: SceneSignatureSource } {
  if (song.listenerSituation?.trim()) {
    return { situation: song.listenerSituation.trim(), source: 'provider' };
  }
  if (song.lyricThemeText?.trim()) {
    return { situation: song.lyricThemeText.trim(), source: 'local-parser' };
  }
  const firstVerseLine = parseLyricsSections(song.lyrics ?? '')
    .find(section => section.type === 'verse')
    ?.lines.find(line => line.trim());
  if (firstVerseLine?.trim()) {
    return { situation: firstVerseLine.trim(), source: 'local-parser' };
  }
  return { situation: '', source: 'legacy-missing' };
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
 * replaces rather than duplicates.
 *
 * 지시문 10 (TASK B-4-4) — now goes through resolveSceneSignatureSource
 * (falls back to lyricThemeText, then the first verse line, before giving
 * up) instead of only ever reading listenerSituation directly — a song an
 * agent left listenerSituation empty on used to silently contribute nothing
 * at all. A genuinely 'legacy-missing' song (nothing to derive from any of
 * the 3 sources) still isn't recorded here — an empty situation string would
 * just false-match every other empty one in a later comparison — but the
 * measurement side (core/fullAudit.ts's scene_signature_source item) counts
 * these directly off the pack's own songs and reports 'not-measured' rather
 * than a silent pass, which is the real gap this task closes: "legacy-missing를
 * pass 처리하지 말 것".
 */
export async function recordPackSituations(packId: string, channelId: string, blueprint: PlaylistBlueprint, language: LyricLanguage): Promise<void> {
  await forgetPack(packId);
  const now = new Date().toISOString();
  for (const song of blueprint.songs) {
    const { situation, source } = resolveSceneSignatureSource(song);
    if (!situation && source === 'legacy-missing') continue; // nothing at all to record — not even a placeholder string
    const record: SituationUsage = {
      id: `${currentWorkspaceId()}::${packId}:${song.trackNo}`,
      situation,
      channelId,
      language,
      usedAt: now,
      packId,
      trackNo: song.trackNo,
      workspaceId: currentWorkspaceId(),
      signatureSource: source,
      ...(song.lyricFrameId ? { frameId: song.lyricFrameId } : {}),
      ...(song.lyricThemeMotionKo ? { motionKo: song.lyricThemeMotionKo } : {}),
      ...(song.lyricThemeCastKo ? { castKo: song.lyricThemeCastKo } : {}),
      ...(song.lyricThemeEraSettingKo ? { eraSettingKo: song.lyricThemeEraSettingKo } : {}),
      ...(song.lyricTheme ? { lyricTheme: song.lyricTheme } : {}),
      ...(() => {
        const opening = computeOpeningSixWords(song.lyrics ?? '');
        return opening ? { openingSixWords: opening } : {};
      })()
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
export async function recentSituations(scope: LedgerScope, language: LyricLanguage, setLimit = 10): Promise<string[]> {
  const all = await allRecords();
  const scoped = all.filter(u => matchesLedgerScope(u, scope) && u.language === language);
  const packOrder = Array.from(new Set(scoped.slice().sort((a, b) => (a.usedAt < b.usedAt ? 1 : -1)).map(u => u.packId)));
  const recentPackIds = new Set(packOrder.slice(0, setLimit));
  return scoped.filter(u => recentPackIds.has(u.packId)).map(u => u.situation);
}

/**
 * 지시문 10 (TASK B-4-3) — cross-SET opening-line avoid list, default window
 * 5 sets (deliberately narrower than recentSituations'/recentLyricLines'
 * default 10 — an opening line is a much shorter, more collision-prone
 * signal, and this directive's own spec names 5 explicitly). Same
 * pack-grouped/most-recent-first shape as recentSituations above. Empty
 * strings (no qualifying opening line recorded for that song) are dropped —
 * never a meaningless "" entry in the avoid list.
 */
export async function recentOpenings(scope: LedgerScope, language: LyricLanguage, setLimit = 5): Promise<string[]> {
  const all = await allRecords();
  const scoped = all.filter(u => matchesLedgerScope(u, scope) && u.language === language);
  const packOrder = Array.from(new Set(scoped.slice().sort((a, b) => (a.usedAt < b.usedAt ? 1 : -1)).map(u => u.packId)));
  const recentPackIds = new Set(packOrder.slice(0, setLimit));
  return scoped.filter(u => recentPackIds.has(u.packId) && u.openingSixWords).map(u => u.openingSixWords!);
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
  /** 지시문 10 (TASK B-4-2) — see SituationUsage.lyricTheme's own doc comment. */
  lyricTheme?: string;
}

export async function recentSceneSignatures(scope: LedgerScope, language: LyricLanguage, setLimit = 10): Promise<SceneSignature[]> {
  const all = await allRecords();
  const scoped = all.filter(u => matchesLedgerScope(u, scope) && u.language === language);
  const packOrder = Array.from(new Set(scoped.slice().sort((a, b) => (a.usedAt < b.usedAt ? 1 : -1)).map(u => u.packId)));
  const recentPackIds = new Set(packOrder.slice(0, setLimit));
  return scoped.filter(u => recentPackIds.has(u.packId)).map(u => ({
    situation: u.situation,
    packId: u.packId,
    trackNo: u.trackNo,
    ...(u.frameId ? { frameId: u.frameId } : {}),
    ...(u.motionKo ? { motionKo: u.motionKo } : {}),
    ...(u.castKo ? { castKo: u.castKo } : {}),
    ...(u.eraSettingKo ? { eraSettingKo: u.eraSettingKo } : {}),
    ...(u.lyricTheme ? { lyricTheme: u.lyricTheme } : {})
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

/**
 * v5.22 (AXIS 1, migration) — same shape/contract as core/library.ts's
 * migrateLibraryWorkspaceTags: additive-only, idempotent.
 *
 * 지시문 14 (TASK C-3) — was a blind `DEFAULT_WORKSPACE_ID` stamp for every
 * untagged record regardless of which channel it actually came from (wrong
 * for any pre-workspace record from a non-senior channel — none existed
 * when this migration first shipped, but the same function is what TASK D's
 * historyBackfill-registered older packs would also run through). Now
 * resolves each record's own channelId -> archetype -> workspace first
 * (channelWorkspaceResolution.ts) and only falls back to
 * DEFAULT_WORKSPACE_ID for a channelId that resolution can't place either —
 * matching this whole ledger's own DEFAULT_WORKSPACE_ID convention for a
 * senior-era record with literally no channel context to resolve from. A
 * channelId that resolves to neither is tagged 'unknown' instead (see
 * SituationUsage.workspaceId's own doc comment) — never silently folded
 * into any real workspace's history.
 */
export async function migrateSituationLedgerWorkspaceTags(): Promise<{ totalRecords: number; taggedSeniorOldpop: number; taggedUnknown: number }> {
  const all = await withStore<SituationUsage[]>('readonly', store => store.getAll());
  let taggedSeniorOldpop = 0;
  let taggedUnknown = 0;
  for (const record of all) {
    const finalWorkspaceId = record.workspaceId ?? resolveWorkspaceIdForChannel(record.channelId) ?? 'unknown';
    if (finalWorkspaceId === DEFAULT_WORKSPACE_ID) taggedSeniorOldpop += 1;
    if (finalWorkspaceId === 'unknown') taggedUnknown += 1;
    if (!record.workspaceId) await withStore('readwrite', store => store.put({ ...record, workspaceId: finalWorkspaceId }));
  }
  return { totalRecords: all.length, taggedSeniorOldpop, taggedUnknown };
}
