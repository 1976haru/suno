/**
 * TASK v6.0 (perspectiveMode) — real-generation coverage for the new
 * 'fixed' | 'dominant' | 'varied' axis added to how strongly `perspective`
 * dominates a pack's own pov distribution (see types.ts's PerspectiveMode
 * doc comment and core/lyricDiversityPlan.ts's povDistribution/
 * resolvePerspectiveMode for the shared math both the manual axis
 * (core/setDirector.ts's povCounts, real Step2Plan.tsx flow) and the auto/
 * fallback path (core/lyricDiversityPlan.ts's defaultPovPattern/buildPovPlan,
 * any direct generateLocalBlueprint call) resolve through).
 *
 * Mirrors userChoicePreservation.test.ts's own POV describe block's real
 * plan -> diversityAllocations -> generateLocalBlueprint round trip for the
 * manual-axis assertions, and plain generateLocalBlueprint(makeOptions(...))
 * calls (same shape as that file's vocalTone tests) for the auto-path
 * assertions — both are real code paths a real user's session can hit
 * (manual axis once Step2Plan.tsx has run; auto path before that, or for any
 * caller that builds GenerationOptions directly).
 */
import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { povDistribution } from '../src/core/lyricDiversityPlan';
import type { GenerationOptions } from '../src/types';
import { channelPresets, makeOptions, testGenres, testMoods, testSeason } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;
const kidsChannel = channelPresets.find(channel => channel.archetype === 'kids')!;

function povCountsFromBlueprint(opts: GenerationOptions) {
  const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
  const counts: Record<string, number> = {};
  for (const song of bp.songs) counts[song.pov ?? 'unknown'] = (counts[song.pov ?? 'unknown'] ?? 0) + 1;
  return counts;
}

describe('[v6.0] perspectiveMode — regression safety (auto/fallback pov path)', () => {
  /**
   * TASK v6.0 — real measurement found this app already has TWO separate
   * "dominant" pov implementations that were never reconciled with each
   * other pre-v6.0 (both untouched by this task, preserved as-is):
   * core/setDirector.ts's povCounts (the MANUAL axis Step2Plan.tsx bakes
   * into diversityAllocations, exact-count formula: primary gets
   * songCount minus a 2-3 song reserve — 15/2/1 of 18) vs.
   * core/lyricDiversityPlan.ts's defaultPovPattern (the AUTO/fallback path
   * exercised whenever no manual pov axis is present — a repeating 10-slot
   * pattern where primary appears 6/10 times, tiled across songCount — a
   * real ~60% lean, 11/18 for this seed). This file's own task background
   * description ("roughly 60%, 11 of 18") matches the AUTO path exactly;
   * the manual axis's real 83% (15/18) split is a separate, pre-existing
   * number this task did not introduce or change either. Neither branch's
   * source code changed in this task (see this task's report for the diff
   * confirming both bodies are byte-identical to pre-v6.0) — this test
   * pins the AUTO path's real, seed-dependent output as the regression
   * baseline.
   */
  it('omitting perspectiveMode entirely reproduces the pre-v6.0 dominant split exactly (11/5/2 of 18 for firstPerson, this seed)', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 18, perspective: 'firstPerson', genreIds: seniorChannel.preferredGenres });
    expect(opts.perspectiveMode).toBeUndefined();
    const counts = povCountsFromBlueprint(opts);
    expect(counts).toEqual({ firstPerson: 11, secondPerson: 5, thirdPerson: 2 });
  });

  it('setting perspectiveMode explicitly to "dominant" is byte-identical to omitting it', () => {
    const withoutMode = makeOptions({ channel: seniorChannel, songCount: 18, perspective: 'thirdPerson', genreIds: seniorChannel.preferredGenres });
    const withDominant = makeOptions({ channel: seniorChannel, songCount: 18, perspective: 'thirdPerson', perspectiveMode: 'dominant', genreIds: seniorChannel.preferredGenres });
    expect(JSON.stringify(povCountsFromBlueprint(withoutMode))).toBe(JSON.stringify(povCountsFromBlueprint(withDominant)));
  });

  it('povDistribution\'s own "dominant" branch matches the exact pre-v6.0 povCounts formula for every songCount bucket', () => {
    expect(povDistribution(1, 'firstPerson', 'dominant')).toEqual({ firstPerson: 1 });
    expect(povDistribution(2, 'secondPerson', 'dominant')).toEqual({ secondPerson: 2 });
    // songCount 3-9: variantCount=2 -> primary = n-2, secondary = 1, tertiary = 1
    expect(povDistribution(6, 'firstPerson', 'dominant')).toEqual({ firstPerson: 4, secondPerson: 1, thirdPerson: 1 });
    // songCount >=10: variantCount=3 -> primary = n-3, secondary = 2, tertiary = 1
    expect(povDistribution(18, 'firstPerson', 'dominant')).toEqual({ firstPerson: 15, secondPerson: 2, thirdPerson: 1 });
    expect(povDistribution(12, 'thirdPerson', 'dominant')).toEqual({ thirdPerson: 9, firstPerson: 2, secondPerson: 1 });
  });
});

describe('[v6.0] perspectiveMode — "fixed" gives the chosen perspective 100% of an adult pack', () => {
  it('18/18 songs land on the chosen perspective via the auto/fallback path (plain generateLocalBlueprint call)', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 18, perspective: 'thirdPerson', perspectiveMode: 'fixed', genreIds: seniorChannel.preferredGenres });
    const counts = povCountsFromBlueprint(opts);
    expect(counts.thirdPerson).toBe(18);
    expect(Object.keys(counts)).toEqual(['thirdPerson']);
  });

  it('18/18 songs land on the chosen perspective via the manual axis (real Step2Plan.tsx round trip)', async () => {
    const { directSetLocal } = await import('../src/core/setDirector');
    const { userChoicesFromOptions } = await import('../src/core/userChoices');
    const opts0 = makeOptions({
      channel: seniorChannel, songCount: 18, perspective: 'secondPerson',
      perspectiveMode: 'fixed', perspectiveModeIsExplicitChoice: true, genreIds: seniorChannel.preferredGenres
    });
    const plan = directSetLocal('겨울 발라드 세트', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, [], opts0.vocalTone, undefined, undefined, userChoicesFromOptions(opts0));
    const povCounts = plan.allocations.find(a => a.axis === 'pov')!.counts;
    expect(povCounts).toEqual({ secondPerson: 18 });
    const opts = { ...opts0, diversityAllocations: plan.allocations };
    const counts = povCountsFromBlueprint(opts);
    expect(counts.secondPerson).toBe(18);
  });

  it('works at other song counts too (7 songs, firstPerson)', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 7, perspective: 'firstPerson', perspectiveMode: 'fixed', genreIds: seniorChannel.preferredGenres });
    expect(povCountsFromBlueprint(opts)).toEqual({ firstPerson: 7 });
  });
});

describe('[v6.0] perspectiveMode — "varied" spreads evenly with no lean toward the chosen perspective', () => {
  it('18 songs split exactly 6/6/6 across first/second/third person', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 18, perspective: 'firstPerson', perspectiveMode: 'varied', genreIds: seniorChannel.preferredGenres });
    const counts = povCountsFromBlueprint(opts);
    expect(counts.firstPerson).toBe(6);
    expect(counts.secondPerson).toBe(6);
    expect(counts.thirdPerson).toBe(6);
  });

  it('the chosen perspective is no longer dominant compared to the "dominant" mode result', () => {
    const dominant = povCountsFromBlueprint(makeOptions({ channel: seniorChannel, songCount: 18, perspective: 'firstPerson', perspectiveMode: 'dominant', genreIds: seniorChannel.preferredGenres }));
    const varied = povCountsFromBlueprint(makeOptions({ channel: seniorChannel, songCount: 18, perspective: 'firstPerson', perspectiveMode: 'varied', genreIds: seniorChannel.preferredGenres }));
    expect(varied.firstPerson).toBeLessThan(dominant.firstPerson);
    expect(Math.max(...Object.values(varied)) - Math.min(...Object.values(varied))).toBeLessThanOrEqual(1);
  });

  it('an uneven songCount (13) stays even-ish (max-min spread <= 1)', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 13, perspective: 'thirdPerson', perspectiveMode: 'varied', genreIds: seniorChannel.preferredGenres });
    const counts = povCountsFromBlueprint(opts);
    const values = Object.values(counts);
    expect(values.reduce((a, b) => a + b, 0)).toBe(13);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });
});

/**
 * TASK v6.0 (perspectiveMode) §2 — kids channels. Real investigation
 * (core/kidsLyricEngine.ts's composeKidsLyrics) found the actual Korean/
 * Japanese/English sentence pools are keyed ONLY by KidsLyricTheme
 * (animal/season/family/friend/play/school/counting/hangul) — perspective is
 * never a parameter composeKidsLyrics accepts, and the hand-written pool
 * sentences themselves are heavily pro-drop / mixed-person (a single theme's
 * 3 line-pairs routinely mix an implied-1st-person statement, a vocative
 * 2nd-person address, and a 3rd-person description of an animal/teacher — see
 * this task's own report for concrete examples), so there is no reliable
 * per-line "dominant grammatical person" to tag without either rewriting the
 * hand-authored sentences (explicitly out of scope) or inventing an
 * arbitrary/fragile per-theme label that wouldn't actually make "fixed"
 * songs read as that person's dedicated POV.
 *
 * What IS real and testable: the pov *metadata* axis (SongIdea.pov, and the
 * diversityAllocations 'pov' manual axis) already flows through the exact
 * same generic povDistribution/resolvePerspectiveMode machinery for kids as
 * for adults (kids channels were never special-cased out of setDirector.ts's
 * makeAllocations) — so "default varied" and "respect an explicit fixed
 * pick" both hold at the METADATA level. The lyric TEXT itself (composedLyrics)
 * is unaffected by perspective/perspectiveMode either way — asserted
 * directly below as the honest boundary of this fix.
 */
describe('[v6.0] perspectiveMode — kids channels', () => {
  it('a kids channel defaults to "varied" pov (not the old ignore-perspective hardcoded dominant pattern) when perspectiveMode is omitted', () => {
    const opts = makeOptions({
      channel: kidsChannel, songCount: 18, lyricLanguage: 'korean', perspective: 'firstPerson',
      genreIds: kidsChannel.preferredGenres, vocalTone: kidsChannel.defaultVocal
    });
    expect(opts.perspectiveMode).toBeUndefined();
    const counts = povCountsFromBlueprint(opts);
    // varied at songCount 18 = exact 6/6/6, unlike dominant's 15/2/1.
    expect(counts.firstPerson).toBe(6);
    expect(counts.secondPerson).toBe(6);
    expect(counts.thirdPerson).toBe(6);
  });

  it('an explicit perspectiveMode: "fixed" pick is respected at the pov-metadata/axis level for a kids channel', async () => {
    const { directSetLocal } = await import('../src/core/setDirector');
    const { userChoicesFromOptions } = await import('../src/core/userChoices');
    const opts0 = makeOptions({
      channel: kidsChannel, songCount: 18, lyricLanguage: 'korean', perspective: 'secondPerson',
      perspectiveMode: 'fixed', perspectiveModeIsExplicitChoice: true,
      genreIds: kidsChannel.preferredGenres, vocalTone: kidsChannel.defaultVocal
    });
    const plan = directSetLocal('아이들과 함께 부르는 노래', kidsChannel, 18, { recentGenreIds: [], recentHooks: [] }, [], opts0.vocalTone, undefined, undefined, userChoicesFromOptions(opts0));
    const povCounts = plan.allocations.find(a => a.axis === 'pov')!.counts;
    expect(povCounts).toEqual({ secondPerson: 18 });
    const opts = { ...opts0, diversityAllocations: plan.allocations };
    const counts = povCountsFromBlueprint(opts);
    expect(counts.secondPerson).toBe(18);
  });

  it('HONEST GAP: kids lyric TEXT itself is identical regardless of perspective/perspectiveMode (composeKidsLyrics never reads either) — same seed/theme, different perspective, same composed lyrics', () => {
    const base = { channel: kidsChannel, songCount: 6, lyricLanguage: 'korean' as const, genreIds: kidsChannel.preferredGenres, vocalTone: kidsChannel.defaultVocal, projectTitle: 'Kids Perspective Text Check' };
    const firstPersonFixed = makeOptions({ ...base, perspective: 'firstPerson', perspectiveMode: 'fixed' });
    const thirdPersonFixed = makeOptions({ ...base, perspective: 'thirdPerson', perspectiveMode: 'fixed' });
    const bpFirst = generateLocalBlueprint(firstPersonFixed, testGenres, testMoods, testSeason);
    const bpThird = generateLocalBlueprint(thirdPersonFixed, testGenres, testMoods, testSeason);
    // pov metadata really does differ...
    expect(bpFirst.songs.map(s => s.pov)).toEqual(Array(6).fill('firstPerson'));
    expect(bpThird.songs.map(s => s.pov)).toEqual(Array(6).fill('thirdPerson'));
    // ...but the actual composed lyric body text does not (same seed, same
    // theme plan — only the pov label passed through with the change).
    expect(bpFirst.songs.map(s => s.lyrics)).toEqual(bpThird.songs.map(s => s.lyrics));
  });
});
