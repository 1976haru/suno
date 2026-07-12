import type { BatchContext, GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack } from '../types';
import { buildSystemInstruction, buildUserInstruction } from '../core/promptComposer';

export async function generateWithOpenAI(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings,
  batch?: BatchContext
): Promise<PlaylistBlueprint> {
  const model = settings.model || 'gpt-4.1-mini';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.apiKey) headers['X-User-Api-Key'] = settings.apiKey;

  const response = await fetch(settings.proxyEndpoint || '/api/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      provider: 'openai',
      model,
      temperature: settings.temperature,
      batchSize: opts.songCount,
      system: buildSystemInstruction(opts, batch),
      user: buildUserInstruction(opts, genres, moods, season, batch)
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI proxy request failed: ${response.status} ${detail}`);
  }

  const data = await response.json();
  return (data.blueprint || data) as PlaylistBlueprint;
}
