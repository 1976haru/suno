import type { ProviderSettings } from '../types';

export interface TokenRange {
  low: number;
  high: number;
}

export interface CostEstimate {
  apiCalls: number;
  inputTokens: TokenRange;
  outputTokens: TokenRange;
  costKrw: TokenRange | null;
}

// Deliberately wide, rough bounds — output length in particular varies a lot by
// model verbosity and lyric language. This is a pre-generation ballpark, not a
// quote: real cost is only known after the call via usageLedger (see TASK B5).
const PER_CALL_BASE_INPUT: TokenRange = { low: 1200, high: 2600 };
const PER_PRIOR_SONG_INPUT_GROWTH: TokenRange = { low: 40, high: 90 };
const PER_SONG_OUTPUT: TokenRange = { low: 280, high: 650 };

export function estimateApiCalls(songCount: number, batchSize: number): number {
  const size = Math.min(12, Math.max(1, Math.round(batchSize || 6)));
  return Math.ceil(Math.max(1, songCount) / size);
}

export function estimateTokenUsage(songCount: number, batchSize: number): {
  apiCalls: number;
  inputTokens: TokenRange;
  outputTokens: TokenRange;
} {
  const size = Math.min(12, Math.max(1, Math.round(batchSize || 6)));
  const apiCalls = estimateApiCalls(songCount, size);

  let inputLow = 0;
  let inputHigh = 0;
  for (let call = 0; call < apiCalls; call++) {
    const priorSongs = call * size;
    inputLow += PER_CALL_BASE_INPUT.low + priorSongs * PER_PRIOR_SONG_INPUT_GROWTH.low;
    inputHigh += PER_CALL_BASE_INPUT.high + priorSongs * PER_PRIOR_SONG_INPUT_GROWTH.high;
  }

  return {
    apiCalls,
    inputTokens: { low: inputLow, high: inputHigh },
    outputTokens: { low: songCount * PER_SONG_OUTPUT.low, high: songCount * PER_SONG_OUTPUT.high }
  };
}

// Mirrors providers/index.ts's refineTracks batching thresholds exactly —
// below 4 selected tracks each gets its own call (failure isolation), at or
// above it they're grouped into batches of 6.
const REFINE_BATCH_THRESHOLD = 4;
const REFINE_BATCH_SIZE = 6;

export function estimateRefineCalls(selectedCount: number): number {
  if (selectedCount <= 0) return 0;
  if (selectedCount < REFINE_BATCH_THRESHOLD) return selectedCount;
  return Math.ceil(selectedCount / REFINE_BATCH_SIZE);
}

/** TASK C2 (v3.3): live estimate shown in HybridRefinePanel as the user checks tracks. */
export function estimateRefineTokens(selectedCount: number): { apiCalls: number; inputTokens: TokenRange; outputTokens: TokenRange } {
  const apiCalls = estimateRefineCalls(selectedCount);
  const outputTokens: TokenRange = { low: selectedCount * PER_SONG_OUTPUT.low, high: selectedCount * PER_SONG_OUTPUT.high };
  if (selectedCount < REFINE_BATCH_THRESHOLD) {
    return {
      apiCalls,
      inputTokens: { low: apiCalls * PER_CALL_BASE_INPUT.low, high: apiCalls * PER_CALL_BASE_INPUT.high },
      outputTokens
    };
  }
  // Batched calls also carry the rest-of-pack usedTitles/usedHooks context, roughly proportional to pack size.
  const perBatchGrowth: TokenRange = { low: 20 * PER_PRIOR_SONG_INPUT_GROWTH.low, high: 20 * PER_PRIOR_SONG_INPUT_GROWTH.high };
  return {
    apiCalls,
    inputTokens: {
      low: apiCalls * (PER_CALL_BASE_INPUT.low + perBatchGrowth.low),
      high: apiCalls * (PER_CALL_BASE_INPUT.high + perBatchGrowth.high)
    },
    outputTokens
  };
}

/**
 * inputPricePerM/outputPricePerM are 원(KRW) per 1M tokens, entered by the
 * user in Settings — never hardcoded here, since provider pricing changes
 * and can't be guaranteed current.
 */
export function estimateCost(
  songCount: number,
  provider: Pick<ProviderSettings, 'provider' | 'batchSize'>,
  inputPricePerM: number | null,
  outputPricePerM: number | null
): CostEstimate {
  if (provider.provider === 'local') {
    return { apiCalls: 0, inputTokens: { low: 0, high: 0 }, outputTokens: { low: 0, high: 0 }, costKrw: { low: 0, high: 0 } };
  }

  const { apiCalls, inputTokens, outputTokens } = estimateTokenUsage(songCount, provider.batchSize || 6);

  let costKrw: TokenRange | null = null;
  if (inputPricePerM != null && outputPricePerM != null && !Number.isNaN(inputPricePerM) && !Number.isNaN(outputPricePerM)) {
    costKrw = {
      low: (inputTokens.low / 1_000_000) * inputPricePerM + (outputTokens.low / 1_000_000) * outputPricePerM,
      high: (inputTokens.high / 1_000_000) * inputPricePerM + (outputTokens.high / 1_000_000) * outputPricePerM
    };
  }

  return { apiCalls, inputTokens, outputTokens, costKrw };
}
