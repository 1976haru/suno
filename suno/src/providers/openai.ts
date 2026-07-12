import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack } from '../types';
import { buildSystemInstruction, buildUserInstruction } from '../core/promptComposer';

export async function generateWithOpenAI(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings
): Promise<PlaylistBlueprint> {
  if (!settings.apiKey) throw new Error('OpenAI API key is required.');
  const model = settings.model || 'gpt-4.1-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: settings.temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildSystemInstruction(opts) },
        { role: 'user', content: JSON.stringify(buildUserInstruction(opts, genres, moods, season), null, 2) }
      ]
    })
  });

  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as PlaylistBlueprint;
}
