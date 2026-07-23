import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack } from '../types';
import { generateBlueprint } from '../providers/index';
import { resolveHookCollisions } from './hookDedup';

/**
 * TASK v3.33 — multi-set generation: N independent sets (e.g. 5 x 18 songs)
 * produced in one run, each saved as its own SavedPack (see
 * types.ts SavedPack.setGroupId/setIndex/setTotal), not one merged
 * blueprint — the operating model is "1 set = 1 video".
 *
 * Deliberately built as N calls to the existing, unmodified single-pack
 * pipeline (generateBlueprint for local/realtime; useBatchGenerationFlow's
 * submit() for Batch API, orchestrated separately in
 * hooks/useMultiSetGenerationFlow.ts since that lifecycle is React-hook-
 * based) rather than restructuring the batch/realtime internals to natively
 * understand "sets". Every layer below generateBlueprint (preallocateSongSlots,
 * resolveSongRole's cold-open/flagship trackNo<=3 rule, dedupeTitlesAcrossPack)
 * is hard-wired to one identity/one flat slot array/one output blueprint per
 * run — calling it once per set gets a correct, independent cold-open +
 * flagship pair for free on every set, with zero changes to any of that.
 *
 * Cross-set dedup: each set's own output titles/hooks feed into the next
 * set's avoid-list, on top of whatever cross-pack history the caller already
 * fetched from hookLedger — so set 2 can never repeat set 1's titles/hooks
 * within the same run, same mechanism as cross-pack dedup between separate
 * generation sessions.
 */

export interface MultiSetProgress {
  /** 1-based */
  currentSet: number;
  totalSets: number;
  setDone: number;
  setTotal: number;
}

export interface SetResult {
  /** 0-based */
  index: number;
  opts: GenerationOptions;
  blueprint: PlaylistBlueprint;
  /** Hook-collision warnings from resolveHookCollisions (hookMode='ai-creative' only) that survived HOOK_DEDUP_MAX_ROUNDS retries — non-blocking. */
  warnings: string[];
}

function padSetIndex(oneBasedIndex: number): string {
  return String(oneBasedIndex).padStart(2, '0');
}

/** Every set's own GenerationOptions: same base options, its own songCount and a "{projectTitle} Set 0N" name. */
export function buildSetOptions(baseOpts: GenerationOptions, setIndex: number, totalSets: number, songsPerSet: number): GenerationOptions {
  return {
    ...baseOpts,
    songCount: songsPerSet,
    projectTitle: `${baseOpts.projectTitle} Set ${padSetIndex(setIndex + 1)}`
  };
}

/**
 * hookMode='ai-creative' on a remote provider is the only case where two
 * songs can genuinely land on the same hook (parallel chunks/sub-batches
 * can't see each other's real pick) — pool mode force-locks hookPhrase from
 * a slot (structurally collision-free), and the local provider draws every
 * song's hook from one seeded, avoid-aware pool within a single call (also
 * structurally collision-free against its own avoid list). Exported so the
 * Batch-mode orchestrator (hooks/useMultiSetGenerationFlow.ts) can reuse the
 * exact same gate instead of duplicating the condition.
 */
export function needsHookDedupPass(opts: GenerationOptions, settings: ProviderSettings): boolean {
  return settings.provider !== 'local' && (opts.hookMode ?? 'ai-creative') === 'ai-creative';
}

/** Local/realtime multi-set path — Batch API multi-set is orchestrated separately (see hooks/useMultiSetGenerationFlow.ts), since submit()/poll() is a React-hook-managed async lifecycle this pure function can't drive. */
export async function runMultiSetGeneration(
  baseOpts: GenerationOptions,
  setCount: number,
  songsPerSet: number,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings,
  initialAvoid: { usedTitles?: string[]; usedHooks?: string[] } | undefined,
  onProgress?: (progress: MultiSetProgress) => void,
  /** Called after each set finishes (generation + hook-dedup pass), before moving to the next — the caller uses this to save the set as its own SavedPack and to record its hooks in the ledger, so a later set in the same run sees the earlier set's real persisted history too, not just the in-memory accumulator below. */
  onSetComplete?: (result: SetResult) => Promise<void> | void
): Promise<SetResult[]> {
  const results: SetResult[] = [];
  let usedTitles = [...(initialAvoid?.usedTitles ?? [])];
  let usedHooks = [...(initialAvoid?.usedHooks ?? [])];

  for (let index = 0; index < setCount; index++) {
    const setOpts = buildSetOptions(baseOpts, index, setCount, songsPerSet);
    const avoid = { usedTitles, usedHooks };

    const blueprint = await generateBlueprint(
      setOpts,
      genres,
      moods,
      season,
      settings,
      progress => onProgress?.({ currentSet: index + 1, totalSets: setCount, setDone: progress.done, setTotal: progress.total }),
      avoid
    );

    let finalBlueprint = blueprint;
    let warnings: string[] = [];
    if (needsHookDedupPass(setOpts, settings)) {
      const resolved = await resolveHookCollisions(blueprint, setOpts, genres, moods, season, settings, avoid);
      finalBlueprint = resolved.blueprint;
      warnings = resolved.warnings;
    }

    const result: SetResult = { index, opts: setOpts, blueprint: finalBlueprint, warnings };
    results.push(result);
    usedTitles = [...usedTitles, ...finalBlueprint.songs.map(song => song.title)];
    usedHooks = [...usedHooks, ...finalBlueprint.songs.map(song => song.hookPhrase)];

    await onSetComplete?.(result);
  }

  return results;
}
