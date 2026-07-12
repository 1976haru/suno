import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack } from '../types';
import { buildSystemInstruction, buildUserInstruction } from '../core/promptComposer';

export async function generateWithAnthropic(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings
): Promise<PlaylistBlueprint> {
  if (!settings.apiKey) throw new Error('Claude API key is required.');
  const model = settings.model || 'claude-3-5-sonnet-latest';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      temperature: settings.temperature,
      system: buildSystemInstruction(opts),
      messages: [
        { role: 'user', content: `Return JSON only.\n${JSON.stringify(buildUserInstruction(opts, genres, moods, season), null, 2)}` }
      ]
    })
  });

  if (!response.ok) throw new Error(`Anthropic request failed: ${response.status}`);
  const data = await response.json();
  const text = data.content?.map((part: { type: string; text?: string }) => part.text ?? '').join('\n') ?? '{}';
  const jsonText = text.replace(/^```json/i, '').replace(/```$/i, '').trim();
  return JSON.parse(jsonText) as PlaylistBlueprint;
}
