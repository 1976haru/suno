import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack, WorkspaceId } from '../types';
import { generateBlueprint } from '../providers/index';
import { resolveHookCollisions } from './hookDedup';
import { applySetTitlePrefixesToBlueprint, stripSetTitlePrefix } from '../utils/generation';
import { directSetLocal } from './setDirector';
import { userChoicesFromOptions } from './userChoices';
import { normalizeDiversityAllocations } from './diversityAllocation';
import { channelSoundFloorForArchetype } from '../data/channelSoundFloor';
import { readRecentGenreIds } from './recentGenreStore';
import { evaluateGenerationRequest, stableHash, type PreflightReason, type PreflightResult } from './generationPreflight';
import { withGenerationSnapshot } from './generationSnapshot';
import { preallocateSongSlots } from './batchPreallocation';

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

/**
 * Every set's own GenerationOptions: same base options, its own songCount and
 * a "{projectTitle} Set 0N" name.
 *
 * TASK v4.14 (TASK C) — real cause of "30 sets, same concept, feels
 * repetitive across sets even though each set is internally fine": before
 * this task, every field besides songCount/projectTitle was copied from
 * baseOpts UNCHANGED across all N sets — including genreIds/
 * diversityAllocations, which Step2Plan.tsx resolves ONCE (via directSetLocal)
 * before a multi-set run even starts. A 30-set run for an archetype whose
 * concept has no strong palette-family keyword hint (data/paletteFamilies.ts's
 * PALETTE_FAMILY_HINT_PATTERNS) would otherwise lock onto whichever single
 * family set 1 happened to resolve to and repeat it 30 times over. For
 * sets after the first, when the user hasn't pinned an explicit
 * paletteFamilyOverride (a manual pin still always wins, matching this
 * codebase's established rule), this re-runs directSetLocal with the genre
 * ids actually used by the last few sets THIS RUN folded into
 * recentGenreIds — resolveMainFamilyId's own existing least-recently-used
 * rotation (never a hard block; a family already used by every recent set
 * can still be picked again once it's no longer least-used) then naturally
 * spreads family choice across the run instead of pinning it. A no-op for
 * archetypes channelSoundFloorForArchetype doesn't cover (palette families
 * only ever applied to a subset of archetypes to begin with) and for set
 * index 0 (nothing to avoid yet — set 1 keeps Step2Plan's own reviewed
 * allocation exactly as before this task).
 */
export function buildSetOptions(
  baseOpts: GenerationOptions,
  setIndex: number,
  totalSets: number,
  songsPerSet: number,
  /** Genre ids actually assigned by prior sets in THIS run (caller's own rolling window — see runMultiSetGeneration's recentGenreIdsWindow). */
  recentGenreIdsThisRun: string[] = []
): GenerationOptions {
  const setOpts: GenerationOptions = {
    ...baseOpts,
    songCount: songsPerSet,
    projectTitle: `${baseOpts.projectTitle} Set ${padSetIndex(setIndex + 1)}`
  };

  // v5.7 (TASK C) — was mere floor presence; now matches setDirector.ts's
  // own `usesPaletteFamily` gate. Without this, kr-2030/jp-2030/kr-idol-*
  // (real floors now, but no palette-family data) would recompute set 2+'s
  // genre allocation here for no benefit — mainFamilyId resolves to
  // undefined for them either way after the setDirector.ts fix, so this was
  // wasted work, not a correctness bug, but keeping the check consistent
  // with what "covered by the palette-family system" actually means now.
  const shouldRotateFamily = setIndex > 0
    && !baseOpts.paletteFamilyOverride
    && Boolean(channelSoundFloorForArchetype(baseOpts.channel.archetype)?.usesPaletteFamily);
  if (!shouldRotateFamily) return setOpts;

  const freeText = baseOpts.customConcept?.trim() || baseOpts.projectTitle;
  const familyIds = baseOpts.selectedGenreFamilyIds ?? [];
  const recentGenreIds = [...recentGenreIdsThisRun, ...readRecentGenreIds(baseOpts.channel.id)];
  const plan = directSetLocal(
    freeText,
    baseOpts.channel,
    songsPerSet,
    { recentGenreIds, recentHooks: [] },
    familyIds,
    baseOpts.vocalTone,
    baseOpts.breadthOverride,
    undefined,
    // v5.7 (TASK v5.7, TASK A) — keeps set 2+'s own re-run of directSetLocal
    // (genre-family rotation only, see this function's own doc comment)
    // consistent with baseOpts' real moneyChordMode instead of silently
    // reverting the plan's own preview to 'default'.
    userChoicesFromOptions(baseOpts)
  );
  const genreAllocation = plan.allocations.find(allocation => allocation.axis === 'genre');
  const genreIds = genreAllocation ? Object.keys(genreAllocation.counts) : undefined;
  if (!genreIds?.length) return setOpts;

  setOpts.genreIds = genreIds;
  setOpts.diversityAllocations = normalizeDiversityAllocations(plan.allocations);
  return setOpts;
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

/**
 * TASK v3.35 — the per-set finishing step shared by both multi-set
 * orchestrators (this file's local/realtime loop and
 * hooks/useMultiSetGenerationFlow.ts's Batch-API loop, which can't share the
 * loop itself since submit()/poll() is React-hook-managed): resolve any
 * hook collisions first (needsHookDedupPass), *then* apply the set-number
 * title prefix — in that order, so dedup/collision-retry logic never has to
 * deal with the prefix at all (regenerateTrack etc. only ever see/produce
 * bare creative titles).
 */
export async function finalizeSetBlueprint(
  blueprint: PlaylistBlueprint,
  setOpts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings,
  avoid: { usedTitles?: string[]; usedHooks?: string[] }
): Promise<{ blueprint: PlaylistBlueprint; warnings: string[] }> {
  let finalBlueprint = blueprint;
  let warnings: string[] = [];
  if (needsHookDedupPass(setOpts, settings)) {
    const resolved = await resolveHookCollisions(blueprint, setOpts, genres, moods, season, settings, avoid);
    finalBlueprint = resolved.blueprint;
    warnings = resolved.warnings;
  }
  if (setOpts.setNumberPrefix ?? true) {
    finalBlueprint = applySetTitlePrefixesToBlueprint(finalBlueprint, true);
  }
  // TASK (post-generation operation snapshot) — this set's own real
  // GenerationSnapshot, same "attach once, no-op if already present" guard
  // as App.tsx's finalizeSinglePackBlueprint (see that function's own doc
  // comment) — this is the single choke point both the local/realtime
  // (runMultiSetGeneration below) and Batch API (useMultiSetGenerationFlow.ts's
  // runBatchMode) multi-set loops share, so a later per-set retry/refine
  // always has this set's own settings to fall back to, not whichever set
  // (or live channel) happens to be on screen by then. Reuses this set's own
  // already-resolved `genres`/`avoid` for the slot plan rather than
  // re-deriving genres from setOpts alone.
  finalBlueprint = withGenerationSnapshot(finalBlueprint, {
    options: setOpts,
    provider: settings,
    season,
    slots: preallocateSongSlots(setOpts, genres, avoid)
  });
  return { blueprint: finalBlueprint, warnings };
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
  // TASK v4.14 (TASK C) — each entry is one prior set's own genreIds; only
  // the last 3 sets feed buildSetOptions's palette-family rotation (matches
  // this task's own "팔레트 계열 그룹 최근 3세트에서 안 쓴 것 우선").
  const recentGenreIdsWindow: string[][] = [];

  for (let index = 0; index < setCount; index++) {
    const setOpts = buildSetOptions(baseOpts, index, setCount, songsPerSet, recentGenreIdsWindow.slice(-3).flat());
    recentGenreIdsWindow.push(setOpts.genreIds);
    const avoid = { usedTitles, usedHooks };

    const blueprint = await generateBlueprint(
      setOpts,
      genres,
      moods,
      season,
      settings,
      progress => onProgress?.({ currentSet: index + 1, totalSets: setCount, setDone: progress.done, setTotal: progress.total }),
      avoid,
      // TASK v3.62 (TASK 3) — always on for this real generation entry
      // point; a no-op when provider is 'local'.
      true
    );

    const { blueprint: finalBlueprint, warnings } = await finalizeSetBlueprint(blueprint, setOpts, genres, moods, season, settings, avoid);

    const result: SetResult = { index, opts: setOpts, blueprint: finalBlueprint, warnings };
    results.push(result);
    // stripSetTitlePrefix: the accumulator must carry bare creative titles — see finalizeSetBlueprint's doc comment.
    usedTitles = [...usedTitles, ...finalBlueprint.songs.map(song => stripSetTitlePrefix(song.title))];
    usedHooks = [...usedHooks, ...finalBlueprint.songs.map(song => song.hookPhrase)];

    await onSetComplete?.(result);
  }

  return results;
}

export interface MultiSetPreflightInput {
  workspaceId: WorkspaceId;
  baseOptions: GenerationOptions;
  setCount: number;
  songsPerSet: number;
  genres: GenrePack[];
  avoid?: { usedTitles?: string[]; usedHooks?: string[] };
}

/**
 * TASK (multi-set preflight) — real, verified gap: App.tsx's shared
 * requestGeneration() (core/generationPreflight.ts's evaluateGenerationRequest)
 * used to run exactly ONCE, against the screen's CURRENT single-set-shaped
 * opts, even when multi-set mode was active — so a real generation-contract
 * mismatch or 관문 1 (design-gate) failure only reachable at the REAL per-set
 * configuration (songsPerSet overriding the base songCount; set 2+'s
 * palette-family/genre rotation, see buildSetOptions's own doc comment) had
 * no chance of being caught before generation started. This is the fix: N
 * real per-set preflight checks, one per set index, built the exact same way
 * runMultiSetGeneration above builds each set's real options — same
 * buildSetOptions call, same recentGenreIdsWindow accumulation (last 3 sets'
 * genreIds only, mirrored here byte-for-byte from the loop above rather than
 * approximated) — so what this function evaluates against is the SAME real
 * per-set options a real run of THIS module would actually produce, not a
 * guess. Each set's own check goes through evaluateGenerationRequest
 * unmodified — this function adds no new hard/soft-block logic of its own,
 * only orchestrates N real single-set checks (the existing constraint that
 * multi-set preflight must never be a parallel, potentially-looser check).
 */
export async function evaluateMultiSetGenerationRequest(input: MultiSetPreflightInput): Promise<PreflightResult[]> {
  const { workspaceId, baseOptions, setCount, songsPerSet, genres, avoid } = input;
  const results: PreflightResult[] = [];
  // Mirrors this file's own runMultiSetGeneration recentGenreIdsWindow above exactly.
  const recentGenreIdsWindow: string[][] = [];

  for (let index = 0; index < setCount; index++) {
    const setOpts = buildSetOptions(baseOptions, index, setCount, songsPerSet, recentGenreIdsWindow.slice(-3).flat());
    recentGenreIdsWindow.push(setOpts.genreIds);
    const result = await evaluateGenerationRequest({ workspaceId, options: setOpts, genres, avoid });
    results.push(result);
  }

  return results;
}

export interface MultiSetPreflightReason extends PreflightReason {
  /** 0-based set index (buildSetOptions's own setIndex) this reason came from. */
  setIndex: number;
}

export interface MultiSetPreflightSummary {
  allowed: boolean;
  requiresAcknowledgement: boolean;
  /**
   * Content-based hash pooling every set's own already-content-based
   * PreflightResult.mismatchSignature — never a re-derivation of what "the
   * same content" means, just reuses resolveGenerationPreflight's own per-set
   * hash one level up. Undefined whenever there is nothing to acknowledge
   * (every set clean, or ANY set hard-blocked — same "hard blocks never
   * expose anything to sign" rule as the single-set contract).
   */
  mismatchSignature?: string;
  reasons: MultiSetPreflightReason[];
  /** 0-based indexes of sets with at least one 'block' reason. */
  blockedSetIndexes: number[];
  /** 0-based indexes of sets with at least one 'warn' reason and no 'block' reason. */
  warnSetIndexes: number[];
}

/**
 * Combines evaluateMultiSetGenerationRequest's per-set PreflightResult[] into
 * the ONE gating decision a multi-set trigger point actually needs, mirroring
 * core/generationPreflight.ts's resolveGenerationPreflight block/warn/
 * acknowledge contract one level up: ANY set's hard block makes the WHOLE run
 * unblockable (same "no acknowledgment path" rule as a single-set hard
 * block); with no hard block anywhere, every set's warn reasons are pooled
 * into ONE signature that the caller acknowledges ONCE (the multi-set results
 * screen's single "전체 진행" action) to unblock every set at once, instead of
 * requiring a separate acknowledgment per set.
 */
export function combineMultiSetPreflight(perSet: PreflightResult[], acknowledgedSignature?: string): MultiSetPreflightSummary {
  const reasons: MultiSetPreflightReason[] = perSet.flatMap((result, setIndex) =>
    result.reasons.map(reason => ({ ...reason, setIndex }))
  );
  const blockedSetIndexes = perSet.reduce<number[]>((acc, result, setIndex) => {
    if (result.reasons.some(reason => reason.severity === 'block')) acc.push(setIndex);
    return acc;
  }, []);
  const warnSetIndexes = perSet.reduce<number[]>((acc, result, setIndex) => {
    if (!blockedSetIndexes.includes(setIndex) && result.reasons.some(reason => reason.severity === 'warn')) acc.push(setIndex);
    return acc;
  }, []);

  if (blockedSetIndexes.length) {
    return { allowed: false, requiresAcknowledgement: false, reasons, blockedSetIndexes, warnSetIndexes };
  }
  if (!warnSetIndexes.length) {
    return { allowed: true, requiresAcknowledgement: false, reasons: [], blockedSetIndexes: [], warnSetIndexes: [] };
  }

  const mismatchSignature = stableHash(perSet.map(result => result.mismatchSignature ?? null));
  const acknowledged = acknowledgedSignature !== undefined && acknowledgedSignature === mismatchSignature;
  return { allowed: acknowledged, requiresAcknowledgement: !acknowledged, mismatchSignature, reasons, blockedSetIndexes, warnSetIndexes };
}
