import { describe, expect, it } from 'vitest';
import { lintInPackStyleSimilarity } from '../src/core/diversityLinter';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, makeOptions, moodPacks, seasonPacks, testGenres, testMoods, testSeason } from './fixtures';

/**
 * TASK v3.58 (TASK 7-6) — sharedAtomRatio makes the pack-wide boilerplate
 * exclusion diversityLinter.ts's commonClauses logic already performed into
 * an inspectable, threshold-checked number (before this task, more
 * boilerplate only ever made the reported similarity score look *better*).
 * A real measurement against this repo's pre-TASK-1 state found 37-53%
 * shared; after TASK 1 (genre rotation) and TASK 4 (audience-profile
 * separation) it's down near 10%.
 */
describe('[v3.58 TASK 7-6] sharedAtomRatio stays under the warn threshold on a real pack', () => {
  it('an 18-song default fixture pack has sharedAtomRatio <= 0.30', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 18 }), testGenres, testMoods, testSeason);
    const report = lintInPackStyleSimilarity(bp.songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
    expect(report.sharedAtomRatio, JSON.stringify({ ratio: report.sharedAtomRatio, common: report.commonClauses })).toBeLessThanOrEqual(0.30);
    expect(report.errors).toEqual([]);
  });

  it('an 18-song senior-channel pack has sharedAtomRatio <= 0.30', () => {
    const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
    const season = seasonPacks[0];
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel, songCount: 18, genreIds: channel.preferredGenres, moodIds: moods.map(m => m.id), seasonId: season.id });
    const bp = generateLocalBlueprint(opts, genres, moods, season);
    const report = lintInPackStyleSimilarity(bp.songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
    expect(report.sharedAtomRatio, JSON.stringify({ ratio: report.sharedAtomRatio, common: report.commonClauses })).toBeLessThanOrEqual(0.30);
    expect(report.errors).toEqual([]);
  });

  it('reports sharedAtomCount/sharedAtomChars consistent with commonClauses', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 18 }), testGenres, testMoods, testSeason);
    const report = lintInPackStyleSimilarity(bp.songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
    expect(report.sharedAtomCount).toBe(report.commonClauses.length);
    expect(report.sharedAtomChars).toBe(report.commonClauses.join(', ').length);
  });
});
