import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { lintInPackStyleSimilarity } from '../src/core/diversityLinter';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

describe('v3.53 vocal and genre diversity completion', () => {
  it('produces at least 12 distinct style openings in an 18-song local pack', () => {
    const blueprint = generateLocalBlueprint(makeOptions({ songCount: 18 }), testGenres, testMoods, testSeason);
    const starts = new Set(blueprint.songs.map(song => song.stylePrompt.split(',').slice(0, 2).join(',').trim().toLowerCase()));
    const report = lintInPackStyleSimilarity(blueprint.songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
    expect(starts.size).toBeGreaterThanOrEqual(12);
    expect(report.averageSimilarity).toBeLessThan(0.4);
    expect(report.repeatedVocalStarts.every(entry => entry.count <= 3)).toBe(true);
    expect(blueprint.songs.every(song => /mature|male|tenor|baritone/i.test(song.stylePrompt))).toBe(true);
  });

  it('exposes concrete signature sound atoms for the selected genre packs', () => {
    for (const genre of testGenres) {
      expect(genre.signatureSound, genre.id).toBeTruthy();
      const blueprint = generateLocalBlueprint(makeOptions({ songCount: 1, genreIds: [genre.id] }), [genre], testMoods, testSeason);
      const signatureAtoms = genre.signatureSound!.split(',').map(atom => atom.trim()).filter(Boolean).slice(0, 2);
      expect(signatureAtoms.every(atom => blueprint.songs[0].stylePrompt.toLowerCase().includes(atom.toLowerCase())), genre.id).toBe(true);
    }
  });

  it('keeps the first song of three genre choices below the contrast threshold', () => {
    const prompts = testGenres.slice(0, 3).map(genre => generateLocalBlueprint(
      makeOptions({ songCount: 1, genreIds: [genre.id] }),
      [genre],
      testMoods,
      testSeason
    ).songs[0].stylePrompt);
    const report = lintInPackStyleSimilarity(prompts.map((stylePrompt, index) => ({ trackNo: index + 1, stylePrompt })));
    expect(report.averageSimilarity).toBeLessThan(0.35);
  });
});
