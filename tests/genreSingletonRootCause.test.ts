import { describe, expect, it } from 'vitest';
import { directSetLocal } from '../src/core/setDirector';
import { applyEraQuota, extractEraConstraint } from '../src/core/constraints';
import { channelPresets } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;

function singletonGenreIds(counts: Record<string, number>): string[] {
  return Object.entries(counts).filter(([, count]) => count === 1).map(([id]) => id);
}

/**
 * Follow-up to v3.78's designGate genre-singleton check — real measurement
 * traced two independent sources for a genre landing at exactly 1 song:
 *
 * 1. `constraints.ts`'s `applyEraQuota`/`distributeInto` used to round-robin
 *    +1 across every candidate genre id in one flat pass, stopping the
 *    moment the fill amount ran out — whenever that amount wasn't a clean
 *    multiple of the candidate count (the common case), the LAST partial
 *    pass gave exactly +1 to however many brand-new genres it took to
 *    exhaust the amount, stranding each at count=1. A first fix (open new
 *    genres in blocks of >=2, greedily maxed to cap before opening another)
 *    still failed for "비틀즈 느낌의 밝은 60년대 팝": it topped one already-
 *    existing genre to cap, opened and maxed ONE new genre to cap too, then
 *    had exactly 1 song left with nothing to top up — forcing a second new
 *    genre open for just that 1.
 *
 * 2. `setDirector.ts`'s `countsFromSlots` (the plain round-robin seed used
 *    to build the pre-era-quota genre count map) has the identical flaw —
 *    a low-ranked candidate can be left at exactly 1 song whenever the
 *    per-genre cap binds for higher-ranked candidates first. Since a bucket
 *    that never gets trimmed by era quota (already at/under its share cap)
 *    passes straight through untouched, a singleton seeded here survives
 *    all the way to the final genre allocation.
 *
 * Both were fixed the same way: decide the genre COUNT needed up front
 * (Math.ceil(remaining / cap)) instead of greedily filling one genre before
 * opening the next, then round-robin evenly across exactly that many genres
 * — see `distributeInto`'s and `genreCountsFromIds`'s own doc comments.
 */
describe('[genre-singleton root cause] applyEraQuota never lands a fresh genre at exactly 1 song', () => {
  it('filling a co-primary bucket mostly from scratch (18-song "60~70년대" concept) has 0 singletons', () => {
    const before: Record<string, number> = {
      'oldpop-yacht-west-coast': 9,
      'oldpop-soft-rock-am': 4,
      'oldpop-warm-morning-glow': 5
    };
    const era = extractEraConstraint('60~70년대 향수가 느껴지는 올드팝');
    const { counts } = applyEraQuota(before, 18, era, () => true);
    expect(singletonGenreIds(counts)).toEqual([]);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(18);
  });

  it('reaching the primary minimum AND absorbing a later leftover in the same bucket has 0 singletons (the merged-call fix)', () => {
    // v3.78 (genre-singleton) — real measurement: era.primary used to be
    // filled by TWO separate distributeInto calls — one to reach its own
    // minimum share, a later independent one to dump whatever forbidden/
    // over-cap trimming still left "freed" — and a small second-call
    // remainder alone could be too small to safely open a new genre even
    // though the COMBINED amount would have. This forbidden bucket (1980s)
    // being trimmed to 0 is what produces that late "still freed" dump into
    // era.primary (1950s-60s) on top of its own reach-minimum need.
    const before: Record<string, number> = {
      'oldpop-british-beat': 3, // primary (1950s-60s), needs 6 more to reach the 9-song minimum
      'oldpop-folk-rock-70s': 4, // adjacent (1970s), already exactly at its 25% cap — untouched
      'soft-rock': 3, // generic (no era tag), already exactly at its 20% cap — untouched
      'oldpop-adult-contemporary-80s': 8 // forbidden for this concept — entirely freed, then dumped into the primary bucket alongside its own top-up need
    };
    const era = extractEraConstraint('비틀즈 느낌의 밝은 60년대 팝');
    expect(era.forbidden).toContain('1980s');
    const { counts } = applyEraQuota(before, 18, era, () => true);
    expect(singletonGenreIds(counts)).toEqual([]);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(18);
  });
});

describe('[genre-singleton root cause] end-to-end via directSetLocal — real reported concepts', () => {
  const concepts = [
    '6070년대 향수가 느껴지는 올드팝',
    '비틀즈 느낌의 밝은 60년대 팝',
    '80년대 초반 어덜트 컨템포러리 발라드'
  ];

  for (const concept of concepts) {
    it(`"${concept}" produces a genre allocation with 0 singleton genres`, () => {
      const plan = directSetLocal(concept, seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
      const genreAllocation = plan.allocations.find(allocation => allocation.axis === 'genre')!;
      const singletons = singletonGenreIds(genreAllocation.counts);
      expect(singletons, `singleton genres: ${singletons.join(', ')}`).toEqual([]);
      expect(Object.values(genreAllocation.counts).reduce((a, b) => a + b, 0)).toBe(18);
    });
  }
});
