/**
 * codex 지시문 01 (TASK H) — real, confirmed gap this closes: every REAL
 * generation/import path already fetches usedTitles/usedHooks/recentSituations/
 * recentLyricLines call-time-fresh (hookLedger.ts's recentUsedTitlesAndHooks,
 * situationLedger.ts's recentSituations, lyricLineLedger.ts's recentLyricLines
 * are all queried live, not cached across renders — confirmed by direct
 * investigation), so a real in-app generation never sees stale avoid-list
 * data. The one real staleness gap found: Step3Generate.tsx's own
 * `bridgeAvoid`/`bridgeConceptSceneContext` state (the copy-paste Claude Code
 * bridge instruction text) is fetched once per channel/language change via a
 * plain `useEffect([opts.channel.id, opts.lyricLanguage])` — if a set is
 * generated/saved for a channel and the user stays on Step3 (same channel,
 * same language, no navigation) and copies a NEW bridge instruction for a
 * second set, that instruction's avoid-list can still reflect whatever was in
 * IndexedDB when the effect last ran, not what the first set just wrote.
 *
 * This module is the fix: a plain in-memory revision counter, bumped at every
 * real "history-changing" event (pack save, imported-pack confirm, multi-set
 * save, pack delete, history delete, backup restore, rewrite-completed pack
 * save — see each call site's own comment for why it bumps), that any
 * consumer can either read once (`generationHistoryRevision()`) or subscribe
 * to (`subscribeGenerationHistoryRevision`) to know "the ledger changed since
 * I last read it, refetch." core/hooks/useGenerationHistorySnapshot.ts is the
 * one real consumer today, wired into Step3Generate.tsx's own bridgeAvoid/
 * bridgeConceptSceneContext effects.
 *
 * Deliberately a plain module-level counter, not IndexedDB-backed — this is
 * a same-session, same-tab liveness signal only (mirrors
 * core/workspaceScope.ts's own currentWorkspaceId() "module state, not
 * storage" pattern), not a cross-tab/cross-reload durable record; the
 * underlying ledgers themselves are already the durable, cross-session
 * source of truth this counter just signals a change in.
 */

export type HistoryKind = 'title' | 'hook' | 'situation' | 'lyricLine' | 'all';

let revision = 0;
const listeners = new Set<(revision: number) => void>();

export function generationHistoryRevision(): number {
  return revision;
}

/** `kind` is accepted for future finer-grained subscriptions but every real bump today is 'all' (a pack save touches every one of the 4 ledgers at once) — no current caller needs to distinguish. */
export function bumpGenerationHistoryRevision(_kind: HistoryKind = 'all'): void {
  revision += 1;
  for (const listener of listeners) listener(revision);
}

/** Returns an unsubscribe function, same convention as this codebase's other subscribe-style APIs. */
export function subscribeGenerationHistoryRevision(listener: (revision: number) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Test-only reset — mirrors other module-level-state modules' own test-reset escape hatches (e.g. workspaceScope.ts). Production code never calls this. */
export function resetGenerationHistoryRevisionForTests(): void {
  revision = 0;
  listeners.clear();
}
