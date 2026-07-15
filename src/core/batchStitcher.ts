import type { GenerationOptions, PlaylistBlueprint, PreassignedSongSlot, SongIdea, UsageInfo } from '../types';

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
 * TASK B3 (v3.6) — keyed by trackNo instead of a naive push, so a retried
 * sub-batch's songs (see useBatchGenerationFlow.ts's retryFailed) overwrite
 * the original trackNo instead of appending a duplicate. Also the point
 * where TASK B2's preassigned identity is defensively re-applied: even if
 * the model didn't follow the "copy this verbatim" instruction, the
 * trackNo/title/hookPhrase/emotionArc the pack actually ships with is always
 * the one decided locally before submission, not whatever a sub-batch wrote.
 */
export function stitchBatchResults(
  opts: GenerationOptions,
  results: BatchRequestResult[],
  preassignedSlots?: PreassignedSongSlot[]
): StitchResult {
  const sorted = [...results].sort((a, b) => batchIndexFromCustomId(a.customId) - batchIndexFromCustomId(b.customId));
  const failedBatchIndexes: number[] = [];
  let base: Omit<PlaylistBlueprint, 'songs'> | null = null;
  const songMap = new Map<number, SongIdea>();
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadInputTokens = 0;

  const slotByTrackNo = new Map((preassignedSlots ?? []).map(slot => [slot.trackNo, slot]));

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
    for (const song of result.blueprint.songs || []) {
      const slot = slotByTrackNo.get(song.trackNo);
      // TASK I1 (v3.11) — songRole (cold-open/flagship/curve role) is
      // decided locally in preallocateSongSlots same as title/hookPhrase/
      // emotionArc, and re-applied here for the same reason: a batch
      // sub-request's own JSON output has no reason to be trusted over the
      // locally-decided assignment.
      const reconciled = slot ? { ...song, title: slot.title, hookPhrase: slot.hookPhrase, emotionArc: slot.emotionArc, songRole: slot.songRole } : song;
      songMap.set(song.trackNo, reconciled);
    }
  }

  const allSongs = Array.from(songMap.values()).sort((a, b) => a.trackNo - b.trackNo);

  return {
    blueprint: base ? { ...base, songs: allSongs } : null,
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
    const titleKey = song.title.trim().toLowerCase();
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
