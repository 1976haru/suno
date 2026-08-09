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
 *
 * 지시문 21 (TASK B) — 28 -> 32: doowop-ballad/doowop-uptempo/night-chanson/
 * rainy-ballad-blues added (see genreLibrary/index.ts's oldpopGenrePacks).
 * 지시문 21 (TASK A) — 32 -> 34: six-eight-slow-ballad/italian-canzone added.
 */
describe('[v3.61 TASK A] oldpop-* genre family', () => {
  const oldpop = genrePacks.filter(genre => genre.id.startsWith('oldpop-'));

  it('registers exactly 34 oldpop-* genres in the real generation pool (presets.ts genrePacks)', () => {
    expect(oldpop).toHaveLength(34);
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

  it('all 34 oldpop-* genres are registered as core tier for the senior-morning archetype', () => {
    const seniorCoreIds = new Set(getCoreGenresForArchetype('senior-morning').map(genre => genre.id));
    for (const id of SENIOR_MORNING_CORE_GENRE_IDS) {
      if (id.startsWith('oldpop-')) expect(seniorCoreIds.has(id), id).toBe(true);
    }
    const oldpopCoreCount = [...seniorCoreIds].filter(id => id.startsWith('oldpop-')).length;
    expect(oldpopCoreCount).toBe(34);
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
   *
   * TASK v4.7 (팔레트 커버리지 확장) — average similarity stays the real
   * regression guard here (measured 0.074, far under 0.28 — the 28 genres
   * are still overwhelmingly distinct). The MAX bound is relaxed to 0.45:
   * data/eraCanonPalettes.ts's new palettes deliberately group 3-5 oldpop-*
   * genres under one shared instrumentation/harmony/vocal/production
   * vocabulary pool each (e.g. canon-warm-gentle-acoustic spans
   * oldpop-warm-morning-glow/oldpop-gentle-lullaby-pop/oldpop-hearth-acoustic/
   * oldpop-slow-waltz-memory/oldpop-evening-lamp-ballad) — that's the whole
   * point of a "canon sound" for a genre cluster. Two genres sharing a
   * palette (rotatingEraPaletteAtoms is genreId-salted, but a small shared
   * phrase pool still occasionally lands two different genres on the same
   * phrase) will legitimately measure higher than 0.28 on that one shared
   * axis even though every OTHER axis stays genre-specific — this predates
   * that design and needs updating, not the palette grouping itself
   * (0.28 was calibrated when every genre's vocabulary was 100%
   * independently authored, before any shared-cluster concept existed).
   */
  it('keeps pairwise style-prompt similarity across all 34 oldpop-* genres low on average, with no single pair collapsing together', () => {
    const prompts = oldpop.map((genre, idx) => {
      const blueprint = generateLocalBlueprint(makeOptions({ songCount: 1, genreIds: [genre.id] }), [genre], testMoods, testSeason);
      return { trackNo: idx + 1, stylePrompt: blueprint.songs[0].stylePrompt };
    });
    const report = lintInPackStyleSimilarity(prompts);
    expect(report.averageSimilarity).toBeLessThanOrEqual(0.28);
    expect(report.maxSimilarity, JSON.stringify(report.worstPair)).toBeLessThanOrEqual(0.45);
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
