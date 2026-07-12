import type { BatchContext, GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack, UsageInfo } from '../types';
import { buildSystemInstruction, buildUserInstruction } from '../core/promptComposer';
import { callGenerateProxy } from './proxyFetch';

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
  const model = settings.model || 'gpt-4.1-mini';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.keyStorageMode === 'local' && settings.apiKey) headers['X-User-Api-Key'] = settings.apiKey;

  const data = await callGenerateProxy(settings.proxyEndpoint || '/api/generate', headers, {
    provider: 'openai',
    model,
    temperature: settings.temperature,
    batchSize: opts.songCount,
    system: buildSystemInstruction(opts, batch),
    user: buildUserInstruction(opts, genres, moods, season, batch)
  });

  return {
    blueprint: (data.blueprint || data) as PlaylistBlueprint,
    usage: (data.usage as UsageInfo) || null
  };
}
