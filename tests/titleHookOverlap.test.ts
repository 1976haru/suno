import { describe, expect, it } from 'vitest';
import { checkHookQuality, titleHookOverlapWarning } from '../src/core/quality';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

/**
 * TASK v3.58 (TASK 5-6) — weak, warning-only title/hook noun-overlap check.
 * Explicitly NOT a reintroduction of the pre-v3.28 "hook must appear in the
 * title verbatim" rule (see quality.ts's checkHookQuality comment) and NOT
 * a specific match-percentage requirement — only flags the rarer case where
 * title and hook share zero content words at all.
 */
describe('[v3.58 TASK 5-6] weak title/hook noun-overlap check', () => {
  it('warns when title and hook share no content word', () => {
    const warning = titleHookOverlapWarning('Frost and Static', 'Coffee and Rain');
    expect(warning).toContain('shares no word with the hook');
  });

  it('does not warn when at least one content word overlaps', () => {
    expect(titleHookOverlapWarning('Golden Window Light', 'Golden Window Light')).toBeNull();
    expect(titleHookOverlapWarning('Window & Frost', 'Golden Window Light')).toBeNull();
  });

  it('does not warn on empty title or hook (nothing to compare)', () => {
    expect(titleHookOverlapWarning('', 'Golden Window Light')).toBeNull();
    expect(titleHookOverlapWarning('Golden Window Light', '')).toBeNull();
  });

  it('checkHookQuality surfaces the overlap warning with zero score penalty', () => {
    const song = { title: 'Frost and Static', hookPhrase: 'Coffee and Rain', lyrics: 'Coffee and Rain\nCoffee and Rain\nCoffee and Rain' } as SongIdea;
    const result = checkHookQuality(song, 'english');
    expect(result.warnings.some(w => w.includes('shares no word with the hook'))).toBe(true);
  });

  it('a real locally generated pack never triggers the overlap warning (titleFromHook always keeps at least one hook word, or Korean/Japanese titles are the hook itself)', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 18 }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(song.warnings.some(w => w.includes('shares no word with the hook')), `${song.title} / ${song.hookPhrase}`).toBe(false);
    }
  });
});
