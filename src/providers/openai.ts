import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack } from '../types';
import { buildSystemInstruction, buildUserInstruction } from '../core/promptComposer';

export async function generateWithOpenAI(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings
): Promise<PlaylistBlueprint> {
  const model = settings.model || 'gpt-4.1-mini';
  const response = await fetch(settings.proxyEndpoint || '/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'openai',
      model,
      temperature: settings.temperature,
      system: buildSystemInstruction(opts),
      user: buildUserInstruction(opts, genres, moods, season)
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI proxy request failed: ${response.status} ${detail}`);
  }

  const data = await response.json();
  return (data.blueprint || data) as PlaylistBlueprint;
}
