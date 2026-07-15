import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { hookEmotionalWeight } from '../src/core/lyricEngine';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

describe('flagship (TASK I1, v3.11)', () => {
  it('tracks 2 and 3 have songRole "flagship"', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 12 }), testGenres, testMoods, testSeason);
    expect(bp.songs[1].songRole).toBe('flagship');
    expect(bp.songs[2].songRole).toBe('flagship');
  });

  it('tracks 2-3 never carry the same emotional weight as "late-set emotional center"', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 12 }), testGenres, testMoods, testSeason);
    // 'late-set emotional center' (track 8, idx 7) is the one role that
    // resolves to 'high' via targetHookEmotionalWeight — flagship tracks
    // must never match that same weight class.
    for (const song of [bp.songs[1], bp.songs[2]]) {
      expect(hookEmotionalWeight(song.hookPhrase)).not.toBe('high');
    }
  });

  it('flagship tracks share the pack\'s selected genre content in their style prompt', () => {
    const opts = makeOptions({ songCount: 12, genreIds: testGenres.map(g => g.id) });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const primaryGenreWord = testGenres[0].styleCore.split(',')[0].trim();
    expect(bp.songs[1].stylePrompt).toContain(primaryGenreWord);
    expect(bp.songs[2].stylePrompt).toContain(primaryGenreWord);
  });

  it('songCount=1 never assigns a flagship slot, and does not crash', () => {
    expect(() => generateLocalBlueprint(makeOptions({ songCount: 1 }), testGenres, testMoods, testSeason)).not.toThrow();
    const bp = generateLocalBlueprint(makeOptions({ songCount: 1 }), testGenres, testMoods, testSeason);
    expect(bp.songs).toHaveLength(1);
    expect(bp.songs[0].songRole).toBe('cold-open');
    expect(bp.songs.some(song => song.songRole === 'flagship')).toBe(false);
  });

  it('songCount=2 works with only one flagship slot (track 2), no track 3', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 2 }), testGenres, testMoods, testSeason);
    expect(bp.songs).toHaveLength(2);
    expect(bp.songs[0].songRole).toBe('cold-open');
    expect(bp.songs[1].songRole).toBe('flagship');
  });
});
