import { describe, expect, it } from 'vitest';
import { buildSectionStylePlan, LYRIC_SECTION_STYLE_IDS } from '../src/core/lyricDiversityPlan';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, makeOptions, moodPacks, seasonPacks } from './fixtures';

/**
 * TASK v3.58 (TASK 5-4) — buildSectionStylePlan's chorusStyleText used to
 * be built from the same lookup table as verseStyleText, whose wording is
 * hardcoded to say "verse lines..." regardless of which section it's
 * actually describing. Any song whose chorus style resolved to 'narrative'
 * or 'image' (chorusPool allows both, not just 'hookRepeat') got a
 * mixNotes atom literally reading "chorus style: verse lines unfold as...".
 * Real measurement found this in 11/18 songs of a real pack.
 */
describe('[v3.58 TASK 5-4] chorusStyleText never says "verse lines"', () => {
  it('every possible chorusStyle id produces chorus-context wording, never "verse"', () => {
    for (let seed = 0; seed < 40; seed++) {
      const plan = buildSectionStylePlan(18, seed);
      for (const entry of plan) {
        expect(LYRIC_SECTION_STYLE_IDS).toContain(entry.chorusStyle);
        expect(entry.chorusStyleText.toLowerCase(), `seed=${seed} chorusStyle=${entry.chorusStyle}`).not.toContain('verse');
        expect(entry.chorusStyleText.toLowerCase(), `seed=${seed} chorusStyle=${entry.chorusStyle}`).toContain('chorus');
      }
    }
  });

  it('a real generated 18-song pack never has "verse" inside a "chorus style:" clause', () => {
    const channel = channelPresets.find(c => c.id === 'morning-showa-cafe')!;
    const season = seasonPacks[0];
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel, songCount: 18, genreIds: channel.preferredGenres, moodIds: moods.map(m => m.id), seasonId: season.id });
    const blueprint = generateLocalBlueprint(opts, genres, moods, season);
    for (const song of blueprint.songs) {
      const match = song.stylePrompt.match(/chorus style: ([^;,]+)/i);
      if (match) expect(match[1].toLowerCase(), song.stylePrompt).not.toContain('verse');
    }
  });
});
