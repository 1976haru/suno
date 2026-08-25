import { describe, expect, it } from 'vitest';
import { ERA_POLICY } from '../src/data/eraPolicy';
import { applyEraQuota, type EraConstraint } from '../src/core/constraints';
import { eraBucketForGenreId } from '../src/data/eraExclusions';

/**
 * TASK E (design-gate and post-generation era-share checks disagree) —
 * dedicated tests for the new shared data/eraPolicy.ts module:
 *  1. its values match what this task's investigation found to be the
 *     real, validated numbers — core/constraints.ts's `applyEraQuota`, the
 *     function that actually SHAPES a real pack's genre distribution at
 *     generation time (not just a check that runs after the fact).
 *  2. a genre distribution `applyEraQuota` actually produces for a real
 *     concept genuinely satisfies ERA_POLICY's own floors — proving these
 *     aren't two independently-invented numbers that happen to agree, but
 *     literally the same real mechanism (`applyEraQuota` hard-codes
 *     `primaryMinShare = era.coPrimary ? 0.4 : 0.5`).
 *
 * core/designGate.ts's evaluateDesignGate and core/compositionScorer.ts's
 * scoreComposition each have their own dedicated TASK E tests (in
 * tests/designGate.test.ts / tests/compositionScorer.test.ts) proving they
 * both read from this exact module and agree on a real 45% single-era case.
 */
describe('ERA_POLICY', () => {
  it("singlePrimaryMin/coPrimaryMinEach match constraints.ts's applyEraQuota real enforcement (primaryMinShare = era.coPrimary ? 0.4 : 0.5)", () => {
    expect(ERA_POLICY.singlePrimaryMin).toBe(0.5);
    expect(ERA_POLICY.coPrimaryMinEach).toBe(0.4);
  });

  // 지시문 12 (TASK A-3) — genericBlockingMax(designGate.ts의 구 전역 25%
  // 블로킹 상한)는 삭제됐다. 그 역할은 이제 워크스페이스별
  // eraNeutralPolicy.maxTracks(data/workspaceEraIntent.ts)가 대신한다 — 전역 상수
  // 하나로는 표현할 수 없던 "워크스페이스마다 다른 상한"을 위해서다.
  it('genericAdvisoryMax is unchanged from its pre-existing real value (20%) — the only remaining ADVISORY-only era-neutral share ceiling in this module', () => {
    expect(ERA_POLICY.genericAdvisoryMax).toBe(0.2);
  });

  it('a real single-primary concept, redistributed by applyEraQuota from an all-forbidden starting point, actually lands the primary bucket at/above ERA_POLICY.singlePrimaryMin', () => {
    const era: EraConstraint = { primary: '1950s-60s', adjacent: [{ era: '1970s', maxShare: 0.25 }], forbidden: ['1980s'], unspecified: false };
    const songCount = 18;
    // Seeded entirely in the forbidden bucket so applyEraQuota has real work
    // to redistribute (an empty starting point has nothing to free/move).
    const { counts } = applyEraQuota({ 'oldpop-adult-contemporary-80s': songCount }, songCount, era, () => true);
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const primaryTotal = Object.entries(counts)
      .filter(([id]) => eraBucketForGenreId(id) === '1950s-60s')
      .reduce((sum, [, n]) => sum + n, 0);
    expect(total).toBe(songCount);
    expect(primaryTotal / total).toBeGreaterThanOrEqual(ERA_POLICY.singlePrimaryMin);
  });

  it('a real co-primary concept, redistributed by applyEraQuota from an all-forbidden starting point, lands BOTH buckets at/above ERA_POLICY.coPrimaryMinEach', () => {
    const era: EraConstraint = { primary: '1950s-60s', coPrimary: '1970s', adjacent: [], forbidden: ['1980s'], unspecified: false };
    const songCount = 18;
    const { counts } = applyEraQuota({ 'oldpop-adult-contemporary-80s': songCount }, songCount, era, () => true);
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const primaryTotal = Object.entries(counts).filter(([id]) => eraBucketForGenreId(id) === '1950s-60s').reduce((sum, [, n]) => sum + n, 0);
    const coPrimaryTotal = Object.entries(counts).filter(([id]) => eraBucketForGenreId(id) === '1970s').reduce((sum, [, n]) => sum + n, 0);
    expect(total).toBe(songCount);
    expect(primaryTotal / total).toBeGreaterThanOrEqual(ERA_POLICY.coPrimaryMinEach);
    expect(coPrimaryTotal / total).toBeGreaterThanOrEqual(ERA_POLICY.coPrimaryMinEach);
  });
});
