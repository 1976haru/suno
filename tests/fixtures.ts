import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import type { GenerationOptions, LyricLanguage } from '../src/types';

const baseChannel = channelPresets[0];

export function makeOptions(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  const channel = overrides.channel || baseChannel;
  return {
    channel,
    projectTitle: 'Test Pack',
    songCount: 12,
    lyricLanguage: 'english' as LyricLanguage,
    market: channel.market,
    audience: channel.audience,
    genreIds: channel.preferredGenres,
    moodIds: channel.preferredMoods,
    seasonId: 'christmas',
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: '',
    avoidWords: '',
    ...overrides
  };
}

export const testGenres = genrePacks.filter(genre => baseChannel.preferredGenres.includes(genre.id));
export const testMoods = moodPacks.filter(mood => baseChannel.preferredMoods.includes(mood.id));
export const testSeason = seasonPacks.find(season => season.id === 'christmas')!;
export { channelPresets, genrePacks, moodPacks, seasonPacks };
