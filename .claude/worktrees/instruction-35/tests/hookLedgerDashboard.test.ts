import { describe, expect, it } from 'vitest';
import { computeCapacityForecast, exhaustionStats, hookPoolGraduatedWarning, hookPoolNeedsWarning, packCapacityWarning } from '../src/core/hookLedger';
import { hookPoolSize } from '../src/core/lyricEngine';

/**
 * v3.12 PART C-1/C-3 — hookLedger's dashboard/warning helpers. Node has no
 * IndexedDB (see tests/stress.test.ts's S8 note on why fake-indexeddb was
 * deliberately not added as a dependency), so this exercises the pure
 * computeCapacityForecast/exhaustionStats/hookPoolGraduatedWarning functions
 * directly with hand-built HookUsage-shaped records rather than going
 * through channelCapacityForecast's IndexedDB read.
 */

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('v3.12 hook pool dashboard — exhaustionStats / computeCapacityForecast / graduated warning', () => {
  it('exhaustionStats calculates percentUsed/remaining from a real used count and poolSize', () => {
    const poolSize = hookPoolSize('english', 'senior-morning');
    const stats = exhaustionStats(Math.round(poolSize * 0.5), poolSize);
    expect(stats.percentUsed).toBe(50);
    expect(stats.remaining).toBe(poolSize - Math.round(poolSize * 0.5));
  });

  it('computeCapacityForecast derives songsPerWeek from real usedAt intervals, not a fixed assumption', () => {
    // 20 hooks spread evenly over exactly 5 weeks => 4 songs/week actual pace.
    const records = Array.from({ length: 20 }, (_, i) => ({ usedAt: daysAgo(35 - i * (35 / 19)) }));
    const poolSize = 400;
    const forecast = computeCapacityForecast(records, 'english', 'senior-morning', poolSize);
    expect(forecast.estimatedSongsPerWeek).not.toBeNull();
    expect(forecast.estimatedSongsPerWeek!).toBeCloseTo(20 / 5, 0);
    expect(forecast.used).toBe(20);
    expect(forecast.poolSize).toBe(poolSize);
  });

  it('fewer than 2 usage records returns null weeksUntilExhaustion/estimatedSongsPerWeek rather than guessing', () => {
    expect(computeCapacityForecast([], 'english', 'senior-morning', 400).weeksUntilExhaustion).toBeNull();
    expect(computeCapacityForecast([{ usedAt: daysAgo(1) }], 'english', 'senior-morning', 400).weeksUntilExhaustion).toBeNull();
  });

  it('a very fast historical pace projects sooner exhaustion than a slow one, for the same pool', () => {
    const poolSize = 400;
    const fast = computeCapacityForecast(
      Array.from({ length: 40 }, (_, i) => ({ usedAt: daysAgo(14 - i * (14 / 39)) })), // 40 hooks in 2 weeks
      'english', 'senior-morning', poolSize
    );
    const slow = computeCapacityForecast(
      Array.from({ length: 10 }, (_, i) => ({ usedAt: daysAgo(70 - i * (70 / 9)) })), // 10 hooks in 10 weeks
      'english', 'senior-morning', poolSize
    );
    expect(fast.weeksUntilExhaustion).not.toBeNull();
    expect(slow.weeksUntilExhaustion).not.toBeNull();
    expect(fast.weeksUntilExhaustion!).toBeLessThan(slow.weeksUntilExhaustion!);
  });

  it('multi-channel stats do not mix: forecasting two channels from separately-scoped record lists never leaks counts between them', () => {
    const channelARecords = Array.from({ length: 30 }, (_, i) => ({ usedAt: daysAgo(20 - i * (20 / 29)) }));
    const channelBRecords = Array.from({ length: 5 }, (_, i) => ({ usedAt: daysAgo(20 - i * (20 / 4)) }));
    const forecastA = computeCapacityForecast(channelARecords, 'english', 'senior-morning', hookPoolSize('english', 'senior-morning'));
    const forecastB = computeCapacityForecast(channelBRecords, 'english', 'senior-morning', hookPoolSize('english', 'senior-morning'));
    expect(forecastA.used).toBe(30);
    expect(forecastB.used).toBe(5);
    expect(forecastA.used).not.toBe(forecastB.used);
  });

  it('hookPoolGraduatedWarning triggers only at 90%+ usage with hooks still remaining (not at the 80% soft-warning threshold, and not once fully exhausted)', () => {
    const poolSize = 400;
    expect(hookPoolGraduatedWarning(exhaustionStats(Math.round(poolSize * 0.85), poolSize))).toBe(false);
    expect(hookPoolNeedsWarning(exhaustionStats(Math.round(poolSize * 0.85), poolSize))).toBe(true);
    expect(hookPoolGraduatedWarning(exhaustionStats(Math.round(poolSize * 0.9), poolSize))).toBe(true);
    expect(hookPoolGraduatedWarning(exhaustionStats(poolSize, poolSize))).toBe(false); // fully exhausted — hard error path takes over, not this graduated screen
  });

  describe('[v3.32] packCapacityWarning — per-pack-size warning for an 80-song pack', () => {
    it('numbers always agree with the exhaustionStats they were derived from', () => {
      const stats = exhaustionStats(320, 400); // remaining = 80
      const warning = packCapacityWarning(stats, 80);
      expect(warning.remainingBeforePack).toBe(stats.remaining);
      expect(warning.remainingAfterPack).toBe(Math.max(0, stats.remaining - 80));
    });

    it('level is "none" when remaining is at least double the selected pack size', () => {
      const stats = exhaustionStats(40, 400); // remaining = 360
      const warning = packCapacityWarning(stats, 80);
      expect(warning.level).toBe('none');
      expect(warning.remainingAfterPack).toBe(280);
      expect(warning.packsWorthAfter).toBe(3);
    });

    it('level is "yellow" when remaining is less than double the pack size but still covers it', () => {
      const stats = exhaustionStats(280, 400); // remaining = 120, songCount*2 = 160
      const warning = packCapacityWarning(stats, 80);
      expect(warning.level).toBe('yellow');
      expect(warning.remainingAfterPack).toBe(40);
      expect(warning.packsWorthAfter).toBe(0);
    });

    it('level is "red" when remaining is less than the pack size itself — this pack could fail some songs', () => {
      const stats = exhaustionStats(360, 400); // remaining = 40, songCount = 80
      const warning = packCapacityWarning(stats, 80);
      expect(warning.level).toBe('red');
      expect(warning.remainingAfterPack).toBe(0); // clamped, never negative
      expect(warning.packsWorthAfter).toBe(0);
    });

    it('boundary: remaining exactly equal to songCount is not red (still just enough), remaining one below is red', () => {
      const exact = packCapacityWarning(exhaustionStats(320, 400), 80); // remaining = 80
      expect(exact.level).not.toBe('red');
      const oneShort = packCapacityWarning(exhaustionStats(321, 400), 80); // remaining = 79
      expect(oneShort.level).toBe('red');
    });
  });
});
