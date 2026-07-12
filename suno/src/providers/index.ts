import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack } from '../types';
import { generateLocalBlueprint } from '../core/localGenerator';
import { scoreSongs } from '../core/quality';
import { generateWithOpenAI } from './openai';
import { generateWithAnthropic } from './anthropic';

export async function generateBlueprint(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings
): Promise<PlaylistBlueprint> {
  let blueprint: PlaylistBlueprint;
  if (settings.provider === 'openai') blueprint = await generateWithOpenAI(opts, genres, moods, season, settings);
  else if (settings.provider === 'anthropic') blueprint = await generateWithAnthropic(opts, genres, moods, season, settings);
  else blueprint = generateLocalBlueprint(opts, genres, moods, season);

  return { ...blueprint, songs: scoreSongs(blueprint.songs || []) };
}
