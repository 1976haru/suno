import type { GenerationOptions, PlaylistBlueprint, UsageInfo } from '../types';

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

export function stitchBatchResults(opts: GenerationOptions, results: BatchRequestResult[]): StitchResult {
  const sorted = [...results].sort((a, b) => batchIndexFromCustomId(a.customId) - batchIndexFromCustomId(b.customId));
  const failedBatchIndexes: number[] = [];
  let base: Omit<PlaylistBlueprint, 'songs'> | null = null;
  const allSongs: PlaylistBlueprint['songs'] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadInputTokens = 0;

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
    allSongs.push(...(result.blueprint.songs || []));
  }

  return {
    blueprint: base ? { ...base, songs: allSongs } : null,
    failedBatchIndexes,
    totalUsage: { inputTokens, outputTokens, cacheReadInputTokens }
  };
}
