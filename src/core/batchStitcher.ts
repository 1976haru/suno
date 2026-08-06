import type { GenerationOptions, PlaylistBlueprint, PreassignedSongSlot, SongIdea, UsageInfo } from '../types';
import { claimSlotsByTrackNo, reconcileWithPreassignedSlot } from './batchPreallocation';
import { dedupeTitlesAcrossPack } from './lyricEngine';
import { stripSetTitlePrefix } from '../utils/generation';
import { validateProviderTrackSet } from './importValidation';

/**
 * TASK E2 (v3.5) — reconstructs one PlaylistBlueprint from the (possibly
 * out-of-order, possibly partially-failed) per-batch results a Batch API job
 * returns. Pure and synchronous so it's testable without a real batch job;
 * the actual submit/poll/fetch network calls live in providers/batchAnthropic.ts.
 */
export interface BatchRequestResult {
  customId: string;
  blueprint: PlaylistBlueprint | null;
  usage: UsageInfo | null;
  error: string | null;
}

export interface StitchResult {
  blueprint: PlaylistBlueprint | null;
  failedBatchIndexes: number[];
  totalUsage: { inputTokens: number; outputTokens: number; cacheReadInputTokens: number };
}

/** custom_id convention: `b${index}`, e.g. "b0", "b1" — see providers/batchAnthropic.ts's buildBatchRequestSpecs. */
export function batchIndexFromCustomId(customId: string): number {
  const match = /^b(\d+)$/.exec(customId);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

/**
 * TASK B3 (v3.6) — the point where TASK B2's preassigned identity is
 * defensively re-applied via core/batchPreallocation.ts's
 * reconcileWithPreassignedSlot: even if the model didn't follow the "copy
 * this verbatim" instruction, the trackNo/hookPhrase/emotionArc/songRole the
 * pack actually ships with is always the one decided locally before
 * submission — title only follows that same rule in 'local' titleMode (TASK
 * v3.27); by default ('ai-creative') each sub-batch's own title is trusted
 * instead.
 *
 * TASK (duplicate-trackNo fix) — two DIFFERENT kinds of "trackNo collision"
 * need two different remedies here, and this function now tells them apart:
 *
 * 1. CROSS-result: a later-processed result's own song for a trackNo an
 *    earlier result already produced. This is the retried-sub-batch-overwrite
 *    path (see useBatchGenerationFlow.ts's retryFailed and
 *    tests/batchStability.test.ts's "[B3] stitchBatchResults — trackNo-keyed
 *    merge") — a later result's trackNo entry is trusted to *replace* the
 *    earlier one wholesale, same as always; not treated as an anomaly, no
 *    duplicateTrackNos warning.
 *
 * 2. INTRA-result: two songs inside the SAME result's own `blueprint.songs`
 *    array both claiming the same trackNo — a single response can never
 *    legitimately do this (a retry is a separate result/customId, never a
 *    second entry inside one blueprint's own songs array), so this is always
 *    a malformed/adversarial response. This used to be silently collapsed by
 *    a flat `Map<trackNo, SongIdea>` — both songs independently looked up and
 *    reconciled against the identical slot, then whichever was processed LAST
 *    silently overwrote the other in the map, so the pack ended up down one
 *    real slot's worth of content, invisibly, and validateStitched's
 *    duplicateTrackNos check (present since TASK B3) never actually got a
 *    chance to see the collision — effectively dead code on this call path.
 *    Now: claimSlotsByTrackNo (core/batchPreallocation.ts) resolves slot
 *    ownership WITHIN each result's own songs first — the first song (array
 *    order) to claim a trackNo gets that slot's real plan; a second song in
 *    the same result claiming an already-consumed trackNo gets reconciled via
 *    reconcileWithPreassignedSlot's own no-slot branch instead (the same
 *    remedy an out-of-range trackNo already gets), never sharing the first
 *    song's plan — and BOTH songs are kept, so they both survive into the
 *    final blueprint and validateStitched's duplicateTrackNos can actually
 *    observe and report the collision instead of it having already vanished.
 */
export function stitchBatchResults(
  opts: GenerationOptions,
  results: BatchRequestResult[],
  preassignedSlots?: PreassignedSongSlot[],
  /** TASK v3.27 (Part A3) — the channel's cross-pack title history, so an AI-creative title from one sub-batch that happens to match an older pack's title still gets caught by dedupeTitlesAcrossPack below. */
  avoidTitles: string[] = []
): StitchResult {
  const sorted = [...results].sort((a, b) => batchIndexFromCustomId(a.customId) - batchIndexFromCustomId(b.customId));
  const failedBatchIndexes: number[] = [];
  let base: Omit<PlaylistBlueprint, 'songs'> | null = null;
  // Value is an array (not a single SongIdea): a later result's own trackNo
  // entry fully REPLACES whatever an earlier result contributed for that
  // trackNo (the retry-overwrite contract, unchanged), while an intra-result
  // duplicate replaces it with all of THAT result's own songs for the
  // trackNo — i.e. more than one, surfacing the anomaly instead of hiding it.
  const songsByTrackNo = new Map<number, SongIdea[]>();
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadInputTokens = 0;

  const titleMode = opts.titleMode ?? 'ai-creative';
  const hookMode = opts.hookMode ?? 'ai-creative';

  for (const result of sorted) {
    if (result.usage) {
      inputTokens += result.usage.inputTokens || 0;
      outputTokens += result.usage.outputTokens || 0;
      cacheReadInputTokens += result.usage.cacheReadInputTokens || 0;
    }
    if (!result.blueprint || result.error) {
      failedBatchIndexes.push(batchIndexFromCustomId(result.customId));
      continue;
    }
    if (!base) {
      base = {
        projectTitle: result.blueprint.projectTitle || opts.projectTitle,
        channelName: result.blueprint.channelName || opts.channel.name,
        oneLineConcept: result.blueprint.oneLineConcept,
        sonicSignature: result.blueprint.sonicSignature,
        vocalSignature: result.blueprint.vocalSignature,
        lyricRules: result.blueprint.lyricRules,
        harmonyRules: result.blueprint.harmonyRules,
        visualRules: result.blueprint.visualRules
      };
    }

    const resultSongs = result.blueprint.songs || [];
    // TASK (structural trackNo rejection) — a harder gate than
    // claimSlotsByTrackNo's own intra-result no-slot fallback below: an
    // intra-result trackNo collision or an out-of-pack-range trackNo can
    // never legitimately happen in one sub-batch's own response (see this
    // function's doc comment above on intra- vs cross-result duplicates), so
    // a response this broken is refused outright — treated the same as any
    // other failed sub-batch (the `!result.blueprint || result.error` branch
    // above): its customId lands in failedBatchIndexes and contributes NO
    // songs to the stitched blueprint, rather than reconciling an untrustworthy
    // response via the softer no-slot fallback. Scoped to opts.songCount (the
    // whole pack's range), not this result's own narrower trackNo slice, so
    // a legitimate cross-chunk range mismatch still falls through to
    // claimSlotsByTrackNo's existing softer remedy untouched.
    const trackSetValidation = validateProviderTrackSet(resultSongs, opts.songCount);
    if (!trackSetValidation.valid) {
      failedBatchIndexes.push(batchIndexFromCustomId(result.customId));
      continue;
    }
    // Slot ownership resolved WITHIN this one result only — see this
    // function's own doc comment for why cross-result collisions are handled
    // separately, below.
    const slotClaims = claimSlotsByTrackNo(resultSongs, preassignedSlots ?? []);
    const reconciledByTrackNo = new Map<number, SongIdea[]>();
    for (const song of resultSongs) {
      const reconciled = reconcileWithPreassignedSlot(song, slotClaims.get(song), titleMode, { archetype: opts.channel.archetype, lyricLanguage: opts.lyricLanguage }, hookMode);
      const bucket = reconciledByTrackNo.get(song.trackNo);
      if (bucket) bucket.push(reconciled);
      else reconciledByTrackNo.set(song.trackNo, [reconciled]);
    }
    // This result's own trackNo entries replace (never append to) whatever
    // an earlier-processed result already set for the same trackNo.
    for (const [trackNo, bucket] of reconciledByTrackNo) {
      songsByTrackNo.set(trackNo, bucket);
    }
  }

  const allSongs = Array.from(songsByTrackNo.values()).flat().sort((a, b) => a.trackNo - b.trackNo);
  // TASK v3.27 (Part A3) — parallel sub-batches can't see each other's real
  // title pick any more than parallel realtime chunks can; catch and
  // auto-uniquify any collision here, the same pass every generation path
  // now runs (see core/lyricEngine.ts's dedupeTitlesAcrossPack).
  const { songs: dedupedSongs } = dedupeTitlesAcrossPack(allSongs, avoidTitles);

  return {
    blueprint: base ? { ...base, songs: dedupedSongs } : null,
    failedBatchIndexes,
    totalUsage: { inputTokens, outputTokens, cacheReadInputTokens }
  };
}

export interface StitchValidation {
  ok: boolean;
  missingTrackNos: number[];
  duplicateTrackNos: number[];
  outOfRangeTrackNos: number[];
  incompleteTrackNos: number[];
  duplicateTitleOrHookTrackNos: number[];
  issues: string[];
}

const REQUIRED_SONG_FIELDS: (keyof SongIdea)[] = ['lyrics', 'stylePrompt', 'hookPhrase'];

/**
 * TASK B3 (v3.6) — stitchBatchResults never throws on a malformed merge
 * (batch mode has no synchronous caller to throw to), so this is the
 * explicit check callers run afterward to decide whether to surface a
 * "these tracks are missing/broken, regenerate them" affordance instead of
 * silently shipping a pack with holes in it.
 */
export function validateStitched(songs: SongIdea[], expectedCount: number): StitchValidation {
  const issues: string[] = [];
  const seenTrackNos = new Map<number, number>();
  const outOfRangeTrackNos: number[] = [];
  for (const song of songs) {
    seenTrackNos.set(song.trackNo, (seenTrackNos.get(song.trackNo) || 0) + 1);
    if (song.trackNo < 1 || song.trackNo > expectedCount) outOfRangeTrackNos.push(song.trackNo);
  }
  const duplicateTrackNos = Array.from(seenTrackNos.entries()).filter(([, count]) => count > 1).map(([trackNo]) => trackNo);
  const presentTrackNos = new Set(songs.map(song => song.trackNo));
  const missingTrackNos = Array.from({ length: expectedCount }, (_, i) => i + 1).filter(trackNo => !presentTrackNos.has(trackNo));

  const incompleteTrackNos = songs
    .filter(song => REQUIRED_SONG_FIELDS.some(field => !song[field]) || !song.youtube?.title)
    .map(song => song.trackNo);

  const titleSeen = new Map<string, number[]>();
  const hookSeen = new Map<string, number[]>();
  for (const song of songs) {
    const titleKey = stripSetTitlePrefix(song.title).trim().toLowerCase();
    const hookKey = song.hookPhrase.trim().toLowerCase();
    titleSeen.set(titleKey, [...(titleSeen.get(titleKey) || []), song.trackNo]);
    hookSeen.set(hookKey, [...(hookSeen.get(hookKey) || []), song.trackNo]);
  }
  const duplicateTitleOrHookTrackNos = Array.from(
    new Set([
      ...Array.from(titleSeen.values()).filter(trackNos => trackNos.length > 1).flat(),
      ...Array.from(hookSeen.values()).filter(trackNos => trackNos.length > 1).flat()
    ])
  ).sort((a, b) => a - b);

  if (missingTrackNos.length) issues.push(`Missing tracks: ${missingTrackNos.join(', ')}`);
  if (duplicateTrackNos.length) issues.push(`Duplicate trackNo: ${duplicateTrackNos.join(', ')}`);
  if (outOfRangeTrackNos.length) issues.push(`trackNo out of expected 1-${expectedCount} range: ${outOfRangeTrackNos.join(', ')}`);
  if (incompleteTrackNos.length) issues.push(`Missing required fields: track ${incompleteTrackNos.join(', ')}`);
  if (duplicateTitleOrHookTrackNos.length) issues.push(`Duplicate title/hook across tracks: ${duplicateTitleOrHookTrackNos.join(', ')}`);

  return {
    ok: issues.length === 0,
    missingTrackNos,
    duplicateTrackNos,
    outOfRangeTrackNos,
    incompleteTrackNos,
    duplicateTitleOrHookTrackNos,
    issues
  };
}
