import { describe, expect, it } from 'vitest';
import { genrePacks } from '../src/data/presets';
import { genreCategories, getCoreGenresForArchetype, SENIOR_MORNING_CORE_GENRE_IDS } from '../src/data/genreLibrary';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { lintInPackStyleSimilarity } from '../src/core/diversityLinter';
import { makeOptions, testMoods, testSeason } from './fixtures';
import { audienceProfileForAgeGroup } from '../src/data/audienceProfiles';

/**
 * TASK v3.61 (TASK A) — the senior-morning channel's real genre candidate
 * pool was dominated by only 4 genres actually warm/slow enough for it
 * (soft-rock, adult-contemporary, acoustic-pop, retro-soul-pop); real
 * measured 18-song packs kept landing on the same 3-4 genres. Adds 28
 * distinct 1950s-80s Western "old pop" genres (doo-wop through torch song),
 * each required to have its own instrumentation/rhythm/harmony/production
 * (not a rename of an existing genre with the same descriptors) and to stay
 * inside the senior audience's 62-112 BPM tempo range.
 */
describe('[v3.61 TASK A] oldpop-* genre family', () => {
  const oldpop = genrePacks.filter(genre => genre.id.startsWith('oldpop-'));

  it('registers exactly 28 oldpop-* genres in the real generation pool (presets.ts genrePacks)', () => {
    expect(oldpop).toHaveLength(28);
  });

  it('keeps every oldpop-* genre inside the senior audience tempo range (62-112 BPM)', () => {
    const profile = audienceProfileForAgeGroup('seniors');
    for (const genre of oldpop) {
      expect(genre.tempoRange[0], genre.id).toBeGreaterThanOrEqual(profile.tempoFloor);
      expect(genre.tempoRange[1], genre.id).toBeLessThanOrEqual(profile.tempoCeiling);
    }
  });

  it('every oldpop-* genre has non-empty, distinct instrumentation (no two genres share an identical instrument list)', () => {
    const seen = new Map<string, string>();
    for (const genre of oldpop) {
      expect(genre.instruments.length, genre.id).toBeGreaterThan(0);
      const key = [...genre.instruments].sort().join('|');
      expect(seen.has(key), `${genre.id} duplicates ${seen.get(key)}'s instrument list`).toBe(false);
      seen.set(key, genre.id);
    }
  });

  it('all 28 oldpop-* genres are registered as core tier for the senior-morning archetype', () => {
    const seniorCoreIds = new Set(getCoreGenresForArchetype('senior-morning').map(genre => genre.id));
    for (const id of SENIOR_MORNING_CORE_GENRE_IDS) {
      if (id.startsWith('oldpop-')) expect(seniorCoreIds.has(id), id).toBe(true);
    }
    const oldpopCoreCount = [...seniorCoreIds].filter(id => id.startsWith('oldpop-')).length;
    expect(oldpopCoreCount).toBe(28);
  });

  it('does not add any oldpop-* id to showa-cafe\'s core tier', () => {
    const showaCoreIds = getCoreGenresForArchetype('showa-cafe').map(genre => genre.id);
    expect(showaCoreIds.some(id => id.startsWith('oldpop-'))).toBe(false);
  });

  it('registers a dedicated "oldpop" genre category', () => {
    expect(genreCategories.some(category => category.id === 'oldpop')).toBe(true);
  });

  /**
   * TASK A's own explicit validation requirement: any two oldpop-* genres,
   * generated as real style prompts, must measure <= 0.28 pairwise
   * similarity (the same threshold v3.58 TASK 1 set for genre
   * differentiation generally) — otherwise the whole point (genuinely
   * different sub-styles, not 28 renames of the same 4 genres) fails.
   */
  it('keeps pairwise style-prompt similarity across all 28 oldpop-* genres at or below 0.28', () => {
    const prompts = oldpop.map((genre, idx) => {
      const blueprint = generateLocalBlueprint(makeOptions({ songCount: 1, genreIds: [genre.id] }), [genre], testMoods, testSeason);
      return { trackNo: idx + 1, stylePrompt: blueprint.songs[0].stylePrompt };
    });
    const report = lintInPackStyleSimilarity(prompts);
    expect(report.maxSimilarity, JSON.stringify(report.worstPair)).toBeLessThanOrEqual(0.28);
  });

  it('generates a valid, within-limit style prompt for every oldpop-* genre with no duplicate clauses', () => {
    for (const genre of oldpop) {
      const blueprint = generateLocalBlueprint(makeOptions({ songCount: 1, genreIds: [genre.id] }), [genre], testMoods, testSeason);
      const song = blueprint.songs[0];
      expect(song.stylePrompt, genre.id).not.toContain('undefined');
      const atoms = song.stylePrompt.split(',').map(atom => atom.trim().toLowerCase()).filter(Boolean);
      expect(new Set(atoms).size, genre.id).toBe(atoms.length);
    }
  });
});
