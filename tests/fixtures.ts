import { expect } from 'vitest';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { scoreSongs } from '../src/core/quality';
import { SUNO_STYLE_LIMIT } from '../src/core/promptComposer';
import type { ChannelProfile, GenerationOptions, LyricLanguage } from '../src/types';

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
    personaMode: false,
    ...overrides
  };
}

export const testGenres = genrePacks.filter(genre => baseChannel.preferredGenres.includes(genre.id));
export const testMoods = moodPacks.filter(mood => baseChannel.preferredMoods.includes(mood.id));
export const testSeason = seasonPacks.find(season => season.id === 'christmas')!;
export { channelPresets, genrePacks, moodPacks, seasonPacks };

/**
 * TASK (CI test-tier split) — extracted from tests/promptLength.test.ts's
 * '[P0-1]' describe block so the same "30 songs x 3 languages x every
 * season" check can be split across tests/promptLength-*.test.ts (one file
 * per workspace family), each running in its own vitest worker instead of
 * all serially inside a single file/test. Behavior is byte-identical to the
 * original single-test loop — same makeOptions/generateLocalBlueprint/
 * scoreSongs calls, same two expect()s per song — only the channel set
 * passed in differs per caller, and the assertion messages still include
 * the channel/language/season/track so a failure is just as diagnosable.
 */
export const PROMPT_LENGTH_LANGUAGES: LyricLanguage[] = ['english', 'korean', 'japanese'];

export function checkPromptLengthForChannels(channels: ChannelProfile[]): number {
  let checked = 0;
  for (const channel of channels) {
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
    for (const language of PROMPT_LENGTH_LANGUAGES) {
      for (const season of seasonPacks) {
        const opts = makeOptions({ channel, lyricLanguage: language, seasonId: season.id, songCount: 30 });
        const blueprint = generateLocalBlueprint(opts, genres, moods, season);
        const scored = scoreSongs(blueprint.songs, channel, language);
        for (const song of scored) {
          checked += 1;
          expect(song.stylePrompt.length, `${channel.id}/${language}/${season.id} track ${song.trackNo}`).toBeLessThanOrEqual(SUNO_STYLE_LIMIT);
          expect(song.promptWithinLimit).toBe(true);
        }
      }
    }
  }
  return checked;
}
