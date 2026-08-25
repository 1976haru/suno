import { describe, expect, it } from 'vitest';
import { applyAxisAllocation } from '../src/core/diversityAllocation';
import type { AxisAllocation } from '../src/types';

/**
 * TASK v3.64-B — real measurement: a manual 6/6/6 (male/female/mixed)
 * vocalType allocation across 18 songs came back as 6 male songs in a row,
 * then 6 female, then 6 mixed — exact counts, but a completely un-shuffled
 * playlist order. This is the direct regression coverage for the fix
 * (applyAxisAllocation's manual branch now spreads the order instead of
 * stacking each value contiguously).
 */

const VOCAL_IDS = ['male', 'female', 'mixed'] as const;

function manualAllocation(counts: Record<string, number>): AxisAllocation {
  return { axis: 'vocalType', mode: 'manual', counts };
}

function maxConsecutiveRun(plan: readonly string[]): number {
  let max = 1;
  let run = 1;
  for (let i = 1; i < plan.length; i++) {
    run = plan[i] === plan[i - 1] ? run + 1 : 1;
    max = Math.max(max, run);
  }
  return plan.length ? max : 0;
}

function countsOf(plan: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of plan) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

describe('[v3.64-B] applyAxisAllocation manual-mode interleaving', () => {
  it('preserves the exact per-value counts for a 6/6/6 split across 18 songs', () => {
    const autoPlan = Array.from({ length: 18 }, () => 'male');
    const plan = applyAxisAllocation(autoPlan, [manualAllocation({ male: 6, female: 6, mixed: 6 })], 'vocalType', VOCAL_IDS, 42);
    expect(countsOf(plan)).toEqual({ male: 6, female: 6, mixed: 6 });
    expect(plan).toHaveLength(18);
  });

  it('never repeats the same value 3 times in a row for a 6/6/6 split (max consecutive <= 2)', () => {
    const autoPlan = Array.from({ length: 18 }, () => 'male');
    for (const seed of [1, 2, 3, 42, 1234, 99999]) {
      const plan = applyAxisAllocation(autoPlan, [manualAllocation({ male: 6, female: 6, mixed: 6 })], 'vocalType', VOCAL_IDS, seed);
      expect(maxConsecutiveRun(plan), `seed=${seed}`).toBeLessThanOrEqual(2);
    }
  });

  it('is deterministic — the same allocation and seed always produce the same order', () => {
    const autoPlan = Array.from({ length: 18 }, () => 'male');
    const allocation = [manualAllocation({ male: 6, female: 6, mixed: 6 })];
    const a = applyAxisAllocation(autoPlan, allocation, 'vocalType', VOCAL_IDS, 7);
    const b = applyAxisAllocation(autoPlan, allocation, 'vocalType', VOCAL_IDS, 7);
    expect(a).toEqual(b);
  });

  it('a different seed can produce a different order (seed is actually used, not ignored)', () => {
    const autoPlan = Array.from({ length: 18 }, () => 'male');
    const allocation = [manualAllocation({ male: 6, female: 6, mixed: 6 })];
    const orders = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(seed => applyAxisAllocation(autoPlan, allocation, 'vocalType', VOCAL_IDS, seed).join(',')));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('handles an uneven 10/5/3 split: counts preserved, no run of 3', () => {
    const autoPlan = Array.from({ length: 18 }, () => 'male');
    for (const seed of [1, 2, 42, 99999]) {
      const plan = applyAxisAllocation(autoPlan, [manualAllocation({ male: 10, female: 5, mixed: 3 })], 'vocalType', VOCAL_IDS, seed);
      expect(countsOf(plan), `seed=${seed}`).toEqual({ male: 10, female: 5, mixed: 3 });
      expect(maxConsecutiveRun(plan), `seed=${seed}`).toBeLessThanOrEqual(2);
    }
  });

  it('handles a heavily skewed 14/2/2 split: counts preserved and still deterministic (a run of 3+ for the majority value is mathematically unavoidable here — 14 of 18 slots with only 4 minority items to break it up — so this only asserts what is actually achievable)', () => {
    const autoPlan = Array.from({ length: 18 }, () => 'male');
    const plan = applyAxisAllocation(autoPlan, [manualAllocation({ male: 14, female: 2, mixed: 2 })], 'vocalType', VOCAL_IDS, 42);
    expect(countsOf(plan)).toEqual({ male: 14, female: 2, mixed: 2 });
    expect(plan).toHaveLength(18);
    const again = applyAxisAllocation(autoPlan, [manualAllocation({ male: 14, female: 2, mixed: 2 })], 'vocalType', VOCAL_IDS, 42);
    expect(plan).toEqual(again);
  });

  it('handles a single-value 18/0/0 split without error (a contiguous run is unavoidable and correct here)', () => {
    const autoPlan = Array.from({ length: 18 }, () => 'male');
    const plan = applyAxisAllocation(autoPlan, [manualAllocation({ male: 18, female: 0, mixed: 0 })], 'vocalType', VOCAL_IDS, 42);
    expect(countsOf(plan)).toEqual({ male: 18 });
    expect(plan).toHaveLength(18);
  });

  it('real-world case: 18-song 6/6/6 vocalType run — max consecutive same vocal <= 2 (was 6 before the fix)', () => {
    const autoPlan = Array.from({ length: 18 }, () => 'male');
    const plan = applyAxisAllocation(autoPlan, [manualAllocation({ male: 6, female: 6, mixed: 6 })], 'vocalType', VOCAL_IDS, 2026);
    expect(maxConsecutiveRun(plan)).toBeLessThanOrEqual(2);
    expect(countsOf(plan)).toEqual({ male: 6, female: 6, mixed: 6 });
  });
});
