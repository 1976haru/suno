import type { BatchContext, GenerationOptions, GenrePack, MoodPack, PlaylistIdentity, PreassignedSongSlot, ProviderSettings, SeasonPack } from '../types';
import { buildAnthropicUserPayload, buildBatchSystemNote, buildChannelSystemBlock, buildSystemInstruction } from '../core/promptComposer';
import { slotsForRange } from '../core/batchPreallocation';
import { chunkRange, DEFAULT_BATCH_SIZE, extractIdentity } from './index';
import { buildProxyHeaders, callGenerateProxy } from './proxyFetch';
import { generateWithAnthropic } from './anthropic';
import { defaultModelFor } from '../data/modelRegistry';
import type { BatchRequestResult } from '../core/batchStitcher';

/**
 * TASK B2 (v3.6) — one small, single-song Anthropic call to establish the
 * pack's sonicSignature/vocalSignature/lyricRules/harmonyRules/visualRules
 * before any parallel sub-batch is submitted, so every sub-batch can lock to
 * the same identity instead of each independently inventing one. A 1-song
 * request is the smallest call that still produces a real identity (the
 * output schema has no songs-less shape), so it stays cheap without needing
 * a bespoke response contract on the server side.
 */
export async function fetchLockedIdentityForBatch(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings
): Promise<PlaylistIdentity> {
  const { blueprint } = await generateWithAnthropic({ ...opts, songCount: 1 }, genres, moods, season, settings);
  return extractIdentity(blueprint);
}

export interface BatchRequestSpec {
  customId: string;
  trackNoOffset: number;
  totalSongCount: number;
  batchSongCount: number;
  model: string;
  temperature: number;
  cacheableSystemBlocks: string[];
  volatileSystemText: string;
  user: unknown;
}

/**
 * TASK E2 (v3.5) — builds one request per sub-batch, all submitted together
 * as a single Anthropic Message Batch job. Known limitation, by design: a
 * synchronous multi-batch generation feeds each batch the titles/hooks the
 * *previous* batches actually produced (see providers/index.ts's
 * generateBlueprint); a Batch API job runs every request in parallel with
 * no such visibility between them, so within-job duplicate hooks/titles are
 * possible (only the caller-supplied cross-pack `avoid` list, identical for
 * every request, is available). scoreSongs/assertLyricDiversity and the
 * evaluation step remain the safety net for this, same as they already are
 * for late-batch collisions in the synchronous path.
 */
export interface PreallocatedBatchIdentity {
  slots: PreassignedSongSlot[];
  lockedIdentity: PlaylistIdentity | null;
}

export function buildBatchRequestSpecs(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings,
  avoid?: { usedTitles?: string[]; usedHooks?: string[] },
  batchSize = DEFAULT_BATCH_SIZE,
  /** TASK B2 (v3.6) — when supplied, every sub-batch is pinned to its slice of these pre-decided titles/hooks/identity instead of inventing its own. Optional so existing (pre-B2) callers and tests keep working unchanged. */
  preallocated?: PreallocatedBatchIdentity
): BatchRequestSpec[] {
  const size = Math.min(12, Math.max(1, Math.round(batchSize || DEFAULT_BATCH_SIZE)));
  const batches = chunkRange(opts.songCount, size);
  const stableSystem = buildSystemInstruction(opts);
  const channelBlock = buildChannelSystemBlock(opts, genres, moods, season);
  const model = settings.model || defaultModelFor('anthropic');

  return batches.map((trackNumbers, index) => {
    const batchContext: BatchContext = {
      trackNoOffset: trackNumbers[0] - 1,
      totalSongCount: opts.songCount,
      usedTitles: avoid?.usedTitles ?? [],
      usedHooks: avoid?.usedHooks ?? [],
      lockedIdentity: preallocated?.lockedIdentity ?? null,
      preassignedSongs: preallocated ? slotsForRange(preallocated.slots, trackNumbers) : undefined
    };
    const batchOpts: GenerationOptions = { ...opts, songCount: trackNumbers.length };
    return {
      customId: `b${index}`,
      trackNoOffset: batchContext.trackNoOffset,
      totalSongCount: opts.songCount,
      batchSongCount: trackNumbers.length,
      model,
      temperature: settings.temperature,
      cacheableSystemBlocks: [stableSystem, channelBlock],
      volatileSystemText: buildBatchSystemNote(batchOpts, batchContext),
      user: buildAnthropicUserPayload(batchOpts, batchContext)
    };
  });
}

const BATCH_ENDPOINT = '/api/batch';

export async function submitBatchJob(specs: BatchRequestSpec[], settings: ProviderSettings): Promise<{ anthropicBatchId: string }> {
  const data = await callGenerateProxy(BATCH_ENDPOINT, buildProxyHeaders(settings), {
    action: 'create',
    requests: specs.map(spec => ({
      customId: spec.customId,
      model: spec.model,
      temperature: spec.temperature,
      batchSize: spec.batchSongCount,
      cacheableSystemBlocks: spec.cacheableSystemBlocks,
      volatileSystemText: spec.volatileSystemText,
      user: spec.user
    }))
  });
  return { anthropicBatchId: data.batchId as string };
}

export async function pollBatchJobStatus(anthropicBatchId: string, settings: ProviderSettings): Promise<{ status: string; requestCounts: unknown }> {
  const data = await callGenerateProxy(BATCH_ENDPOINT, buildProxyHeaders(settings), { action: 'status', batchId: anthropicBatchId });
  return { status: data.status as string, requestCounts: data.requestCounts };
}

export async function fetchBatchJobResults(anthropicBatchId: string, settings: ProviderSettings): Promise<{ done: boolean; status: string; results: BatchRequestResult[] }> {
  const data = await callGenerateProxy(BATCH_ENDPOINT, buildProxyHeaders(settings), { action: 'results', batchId: anthropicBatchId });
  return { done: data.done as boolean, status: data.status as string, results: (data.results as BatchRequestResult[]) || [] };
}

export async function cancelBatchJob(anthropicBatchId: string, settings: ProviderSettings): Promise<void> {
  await callGenerateProxy(BATCH_ENDPOINT, buildProxyHeaders(settings), { action: 'cancel', batchId: anthropicBatchId });
}
