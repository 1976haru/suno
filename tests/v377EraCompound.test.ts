import { describe, expect, it } from 'vitest';
import { applyEraQuota, extractEraConstraint } from '../src/core/constraints';
import { directSetLocal } from '../src/core/setDirector';
import { eraBucketForGenreId } from '../src/data/eraExclusions';
import { channelPresets } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;

/**
 * v3.77 (TASK D) — real measurement: "60~70년대 향수가 느껴지는 올드팝"
 * landed 0/18 songs in the 1960s bucket (13 in 1970s, 5 generic) because
 * the old era regex only ever matched the "70년대" half of the phrase —
 * "60년" never appears as a literal substring in "60~70년대" (there's a
 * "~" between "60" and "70년대"). detectCompoundDecades fixes this by
 * checking for the compound pattern FIRST.
 */
describe('[v3.77 TASK D] compound-decade era extraction', () => {
  it('"60~70년대 향수가 느껴지는 올드팝" resolves BOTH 1950s-60s and 1970s as co-primary, not just 1970s', () => {
    const era = extractEraConstraint('60~70년대 향수가 느껴지는 올드팝');
    expect(era.unspecified).toBe(false);
    expect([era.primary, era.coPrimary]).toContain('1950s-60s');
    expect([era.primary, era.coPrimary]).toContain('1970s');
    expect(era.forbidden).toContain('1980s');
  });

  it('"7080" resolves 1970s + 1980s co-primary', () => {
    const era = extractEraConstraint('7080 감성 올드팝');
    expect([era.primary, era.coPrimary]).toContain('1970s');
    expect([era.primary, era.coPrimary]).toContain('1980s');
  });

  it('"60s-70s old pop" (English compound) also resolves both', () => {
    const era = extractEraConstraint('60s-70s old pop feeling');
    expect([era.primary, era.coPrimary]).toContain('1950s-60s');
    expect([era.primary, era.coPrimary]).toContain('1970s');
  });

  it('a single-decade concept ("60년대") is NOT treated as compound — no coPrimary', () => {
    const era = extractEraConstraint('비틀즈 느낌의 밝은 60년대 팝');
    expect(era.coPrimary).toBeUndefined();
    expect(era.primary).toBe('1950s-60s');
  });

  it('"50~60년대" (both decades map to the SAME bucket) is not treated as compound', () => {
    const era = extractEraConstraint('50~60년대 올드팝');
    expect(era.coPrimary).toBeUndefined();
    expect(era.primary).toBe('1950s-60s');
  });
});

describe('[v3.77 TASK D] applyEraQuota with coPrimary — each bucket >= 40%', () => {
  it('redistributes a 1970s-only genre selection so both 1950s-60s and 1970s reach >= 40%', () => {
    const before: Record<string, number> = {
      'oldpop-yacht-west-coast': 9,
      'oldpop-soft-rock-am': 4,
      'oldpop-warm-morning-glow': 5
    };
    const era = extractEraConstraint('60~70년대 향수가 느껴지는 올드팝');
    const { counts, warnings } = applyEraQuota(before, 18, era, () => true);
    const byBucket = new Map<string, number>();
    for (const [id, count] of Object.entries(counts)) {
      const bucket = eraBucketForGenreId(id) ?? 'generic';
      byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + count);
    }
    const total = [...byBucket.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(18);
    expect((byBucket.get('1950s-60s') ?? 0) / total).toBeGreaterThanOrEqual(0.4 - 1e-9);
    expect((byBucket.get('1970s') ?? 0) / total).toBeGreaterThanOrEqual(0.4 - 1e-9);
    expect(byBucket.get('1980s') ?? 0).toBe(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('[v3.77 TASK D] REPORT — real 18-song set for "60~70년대 향수가 느껴지는 올드팝"', () => {
  it('genre era distribution actually includes 1960s now', () => {
    const plan = directSetLocal('60~70년대 향수가 느껴지는 올드팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    const genreAllocation = plan.allocations.find(a => a.axis === 'genre')!;
    const byBucket = new Map<string, number>();
    for (const [id, count] of Object.entries(genreAllocation.counts)) {
      const bucket = eraBucketForGenreId(id) ?? 'generic';
      byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + count);
    }
    // eslint-disable-next-line no-console
    console.log('[TASK v3.77 REPORT] "60~70년대 향수" genre era distribution:', Object.fromEntries(byBucket), 'genres:', genreAllocation.counts);
    expect(byBucket.get('1950s-60s') ?? 0).toBeGreaterThan(0);
    expect(byBucket.get('1970s') ?? 0).toBeGreaterThan(0);
  });
});
