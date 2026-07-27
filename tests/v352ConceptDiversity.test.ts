import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { lintInPackStyleSimilarity } from '../src/core/diversityLinter';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

describe('v3.52 concept and vocal diversity', () => {
  it('injects four mapped concepts into both style prompts and lyric imagery', () => {
    const cases = [
      ['아침 카페', 'morning light'],
      ['비 오는 밤', 'rain on window'],
      ['도시의 불빛', 'city neon'],
      ['청춘과 꿈', 'open road']
    ] as const;

    for (const [concept, styleAtom] of cases) {
      const blueprint = generateLocalBlueprint(
        makeOptions({ songCount: 1, customConcept: concept }),
        testGenres,
        testMoods,
        testSeason
      );
      expect(blueprint.songs[0].stylePrompt.toLowerCase()).toContain(styleAtom);
      expect(blueprint.songs[0].lyrics.toLowerCase()).toContain(styleAtom.split(' ')[0]);
    }
  });

  it('varies style-prompt starts across an 18-song pack while preserving channel vocal identity', () => {
    const blueprint = generateLocalBlueprint(makeOptions({ songCount: 18, customConcept: '아침 카페' }), testGenres, testMoods, testSeason);
    const starts = new Set(blueprint.songs.map(song => song.stylePrompt.split(',').slice(0, 2).join(',').toLowerCase()));
    const report = lintInPackStyleSimilarity(blueprint.songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
    expect(starts.size).toBeGreaterThanOrEqual(3);
    expect(blueprint.songs.every(song => song.stylePrompt.includes('mature soulful male tenor'))).toBe(true);
    expect(report.averageSimilarity).toBeLessThan(0.4);
  });

  it('keeps different genre signatures distinct in the generated style prompts', () => {
    const prompts = testGenres.map(genre => {
      const blueprint = generateLocalBlueprint(
        makeOptions({ songCount: 1, genreIds: [genre.id], customConcept: '도시의 불빛' }),
        [genre],
        testMoods,
        testSeason
      );
      return blueprint.songs[0].stylePrompt;
    });
    const report = lintInPackStyleSimilarity(prompts.map((stylePrompt, index) => ({ trackNo: index + 1, stylePrompt })));
    expect(new Set(prompts).size).toBe(3);
    expect(report.averageSimilarity).toBeLessThan(0.35);
  });

  it('reports repeated vocal openings separately from musical similarity', () => {
    const report = lintInPackStyleSimilarity([
      { trackNo: 1, stylePrompt: 'acoustic pop, mature male vocal, piano-led opening' },
      { trackNo: 2, stylePrompt: 'jazz pop, mature male vocal, brushed trio' },
      { trackNo: 3, stylePrompt: 'soft rock, mature male vocal, guitar lift' }
    ]);
    expect(report.repeatedVocalStarts[0]?.count).toBe(3);
    expect(report.warnings.some(warning => warning.includes('Vocal description starts'))).toBe(true);
  });
});
