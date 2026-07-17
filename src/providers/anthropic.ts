import type { BatchContext, GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack, UsageInfo } from '../types';
import { buildAnthropicUserPayload, buildBatchSystemNote, buildChannelSystemBlock, buildSystemInstruction } from '../core/promptComposer';
import { buildProxyHeaders, callGenerateProxy } from './proxyFetch';
import { defaultModelFor } from '../data/modelRegistry';
import type { ProviderCallResult } from './openai';

/**
 * TASK E1 (v3.5) — split into two cacheable system blocks (stable rules,
 * stable channel/genre/mood/season profile) plus one small uncached batch
 * note, instead of one string that changes every batch call. See
 * api/generate.js's callAnthropic for how these map onto Anthropic's
 * `cache_control: { type: 'ephemeral' }` blocks, and core/promptComposer.ts
 * for why alreadyUsedTitles/alreadyUsedHooks stay in the (uncached) user
 * payload instead of a cached block.
 */
export async function generateWithAnthropic(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings,
  batch?: BatchContext
): Promise<ProviderCallResult> {
  const model = settings.model || defaultModelFor('anthropic');

  const data = await callGenerateProxy(settings.proxyEndpoint || '/api/generate', buildProxyHeaders(settings), {
    provider: 'anthropic',
    model,
    temperature: settings.temperature,
    batchSize: opts.songCount,
    // TASK v3.21 — see BatchContext.maxTokensBudgetSongs: only ever set by
    // generateChunkWithSplitRetry's single-song truncation retry.
    maxTokensBudgetSongs: batch?.maxTokensBudgetSongs,
    // TASK v3.21 — pass the pack's real total (not opts.songCount, which is
    // this specific chunk's size) so the cacheable "Generate N songs" line
    // stays byte-identical across differently-sized chunks of the same
    // pack; see buildSystemInstruction's totalSongCountOverride comment.
    cacheableSystemBlocks: [buildSystemInstruction(opts, undefined, batch?.totalSongCount ?? opts.songCount), buildChannelSystemBlock(opts, genres, moods, season)],
    volatileSystemText: batch ? buildBatchSystemNote(opts, batch) : '',
    user: buildAnthropicUserPayload(opts, batch)
  });

  return {
    blueprint: (data.blueprint || data) as PlaylistBlueprint,
    usage: (data.usage as UsageInfo) || null
  };
}
