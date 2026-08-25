import type { BatchContext, GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack, UsageInfo } from '../types';
import { buildSystemInstruction, buildUserInstruction } from '../core/promptComposer';
import { buildProxyHeaders, callGenerateProxy } from './proxyFetch';
import { defaultModelFor } from '../data/modelRegistry';

export interface ProviderCallResult {
  blueprint: PlaylistBlueprint;
  usage: UsageInfo | null;
}

export async function generateWithOpenAI(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings,
  batch?: BatchContext
): Promise<ProviderCallResult> {
  const model = settings.model || defaultModelFor('openai');

  const data = await callGenerateProxy(settings.proxyEndpoint || '/api/generate', buildProxyHeaders(settings), {
    provider: 'openai',
    model,
    temperature: settings.temperature,
    batchSize: opts.songCount,
    system: buildSystemInstruction(opts, batch, undefined, settings.generateThumbnailText ?? false),
    user: buildUserInstruction(opts, genres, moods, season, batch, settings.generateThumbnailText ?? false)
  });

  return {
    blueprint: (data.blueprint || data) as PlaylistBlueprint,
    usage: (data.usage as UsageInfo) || null
  };
}
