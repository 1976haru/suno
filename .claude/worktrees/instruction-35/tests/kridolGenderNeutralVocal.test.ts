import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import type { GenerationOptions } from '../src/types';

/**
 * v5.7 (TASK H) — real audit finding: the 7 kridol-* genre packs are shared
 * by kr-idol-male AND kr-idol-female (data/genreLibrary/index.ts's own
 * `archetypes: ['kr-idol-male', 'kr-idol-female']`), but their `vocal` field
 * used to say "male" explicitly — since core/sectionGenrePlan.ts reads that
 * straight into the real style prompt, a real 18-song kr-idol-female
 * generation measured "male" leaking into 5/18 songs. Fixed by making the
 * genre-level vocal wording gender-neutral (delivery style, not gender);
 * gender itself is handled correctly by this workspace's own per-song
 * vocalType/vocalPlan assignment, which legitimately still says "male and
 * female duet" for a real duet-type song — that's correct, not a leak, and
 * this test only flags a solo "male" mention outside that context.
 */
function buildOpts(channelId: string, songCount: number): GenerationOptions {
  const channel = channelPresets.find(c => c.id === channelId)!;
  const season = seasonPacks[0];
  return {
    channel,
    projectTitle: `Verify ${channelId}`,
    songCount,
    lyricLanguage: channel.primaryLanguage,
    market: channel.market,
    audience: channel.audience,
    genreIds: channel.preferredGenres,
    moodIds: channel.preferredMoods,
    seasonId: season.id,
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: '',
    avoidWords: ''
  };
}

describe('kr-idol-female never inherits kridol-* genre packs\' own "male" vocal wording', () => {
  it('a real 18-song kr-idol-female generation never says "male" outside a legitimate duet mention', () => {
    const opts = buildOpts('daylight-city-kpop', 18);
    const genres = genrePacks.filter(g => opts.channel.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => opts.channel.preferredMoods.includes(m.id));
    const season = seasonPacks.find(s => s.id === opts.seasonId)!;
    const bp = generateLocalBlueprint(opts, genres, moods, season);

    for (const song of bp.songs) {
      const hasMale = /\bmale\b/i.test(song.stylePrompt);
      const isLegitimateDuetMention = /male and female duet|female lead with male|male lead with female/i.test(song.stylePrompt);
      expect(hasMale && !isLegitimateDuetMention, `T${song.trackNo}: ${song.stylePrompt}`).toBe(false);
    }
  });
});
