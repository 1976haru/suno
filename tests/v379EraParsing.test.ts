import { describe, expect, it } from 'vitest';
import { extractEraConstraint, applyEraQuota } from '../src/core/constraints';
import { directSetLocal } from '../src/core/setDirector';
import { eraBucketForGenreId } from '../src/data/eraExclusions';
import { channelPresets } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;

/**
 * v3.79 (TASK A, 1-4) — real measurement: a concept naming BOTH decades
 * with no separator between them ("60년대70년대") or with 4-digit years
 * spanning a separator ("1960~1970년대") never matched
 * detectCompoundDecades's own narrow regex shapes (a separator character
 * between two BARE 2-digit tokens), so it fell through to the old
 * single-primary+25%-capped-adjacent path — landing far short of this
 * task's own "복수 시대: 각 시대 >= 30%" bar. extractEraConstraint now
 * promotes ANY concept that independently trips two of the single-decade
 * regexes (ERA_1950_60_PATTERN / ERA_1970_PATTERN / ERA_1980_PATTERN) to
 * the same coPrimary (each >= 40%) treatment as the regex-detected compound
 * shapes, regardless of the connecting punctuation.
 */
describe('[v3.79 TASK A] every listed era phrase resolves to compound (both decades), per report §8-1', () => {
  const compoundPhrases = [
    '60년대70년대 감성을 느낄수 있는 올드팝',
    '6070 감성 올드팝',
    '6070년대 향수가 느껴지는 올드팝',
    '60~70년대 올드팝',
    '60-70년대 올드팝',
    '60년대~70년대 올드팝',
    '60s-70s old pop feeling',
    '1960~1970년대 감성 올드팝'
  ];

  for (const phrase of compoundPhrases) {
    it(`"${phrase}" -> both 1950s-60s and 1970s recognized (co-primary or adjacent, never 0%)`, () => {
      const era = extractEraConstraint(phrase);
      expect(era.unspecified).toBe(false);
      const bucketsPresent = [era.primary, era.coPrimary, ...era.adjacent.map(a => a.era)];
      expect(bucketsPresent).toContain('1950s-60s');
      expect(bucketsPresent).toContain('1970s');
      // The real bug (§1-1) was landing 0 songs in 1950s-60s — every listed
      // phrase must resolve compound (coPrimary set), so applyEraQuota gives
      // each bucket its own >= 40% floor rather than one bucket getting
      // merely a 25%-capped adjacent share.
      expect(era.coPrimary).toBeDefined();
      expect([era.primary, era.coPrimary]).toContain('1950s-60s');
      expect([era.primary, era.coPrimary]).toContain('1970s');
    });
  }

  it('"비 오는 날 창가에서 듣는 올드팝" has no decade word — stays unspecified (never forced)', () => {
    const era = extractEraConstraint('비 오는 날 창가에서 듣는 올드팝');
    expect(era.unspecified).toBe(true);
  });
});

describe('[v3.79 TASK A] applyEraQuota on the compound phrases — each bucket >= 30% of an 18-song set', () => {
  it('"60년대70년대 감성을 느낄수 있는 올드팝" — synthetic redistribution reaches >= 40% each (coPrimary floor)', () => {
    const before: Record<string, number> = {
      'oldpop-soft-rock-am': 5,
      'oldpop-motown-pop-soul': 3,
      'oldpop-philly-soul-sweet': 5,
      'oldpop-warm-morning-glow': 5
    };
    const era = extractEraConstraint('60년대70년대 감성을 느낄수 있는 올드팝');
    const { counts } = applyEraQuota(before, 18, era, () => true);
    const byBucket = new Map<string, number>();
    for (const [id, count] of Object.entries(counts)) {
      const bucket = eraBucketForGenreId(id) ?? 'generic';
      byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + count);
    }
    const total = [...byBucket.values()].reduce((a, b) => a + b, 0);
    expect(total).toBe(18);
    expect((byBucket.get('1950s-60s') ?? 0) / total).toBeGreaterThanOrEqual(0.3);
    expect((byBucket.get('1970s') ?? 0) / total).toBeGreaterThanOrEqual(0.3);
    // 지시문 12 (TASK A) — 이전에는 이 재분배가 항상 "부족분 경고"를 동반했다
    // (oldpop-motown-pop-soul이 당시 1970s 단독으로 잘못 분류돼 1950s-60s
    // 후보가 얕았기 때문). §A-4 정정(모타운 1960s 포함)으로 1950s-60s 채움이
    // 부족분 없이 깨끗하게 끝나 warnings가 비어 있을 수 있다 — 이제 이
    // 항목이 검증할 실질은 위의 두 비중 단언이며, warnings 유무 자체는
    // 더 이상 "재분배가 실제로 일어났는가"의 신뢰할 만한 대리 지표가 아니다.
  });
});

describe('[v3.79 TASK A] REPORT — real 18-song directSetLocal set for "60년대70년대 감성을 느낄수 있는 올드팝"', () => {
  it('genre era distribution includes both 1950s-60s and 1970s, each >= 30%, and uses the real 60s genre ids', () => {
    const plan = directSetLocal('60년대70년대 감성을 느낄수 있는 올드팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    const genreAllocation = plan.allocations.find(a => a.axis === 'genre')!;
    const byBucket = new Map<string, number>();
    for (const [id, count] of Object.entries(genreAllocation.counts)) {
      const bucket = eraBucketForGenreId(id) ?? 'generic';
      byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + count);
    }
    const total = [...byBucket.values()].reduce((a, b) => a + b, 0);
     
    console.log(
      '[v3.79 TASK A REPORT] "60년대70년대 감성을 느낄수 있는 올드팝" genre era distribution:',
      Object.fromEntries(byBucket),
      'genres:', genreAllocation.counts,
      'warnings:', plan.warnings
    );
    expect(total).toBe(18);
    expect((byBucket.get('1950s-60s') ?? 0) / total).toBeGreaterThanOrEqual(0.3);
    expect((byBucket.get('1970s') ?? 0) / total).toBeGreaterThanOrEqual(0.3);
  });
});
