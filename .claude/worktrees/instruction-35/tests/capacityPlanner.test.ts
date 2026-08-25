import { describe, expect, it } from 'vitest';
import { forecastCapacity } from '../src/core/capacityPlanner';
import { hookPoolSize } from '../src/core/lyricEngine';

describe('v3.12 PART C-2: capacityPlanner.forecastCapacity', () => {
  it('bounds weeksAtCurrentPace by the scarcest HookShape, not poolSize/songsPerWeek', () => {
    // senior-morning/english's vocative pool is 72 (not the flat 400 total);
    // at 12 songs/week (4/week/shape), that's exactly 18 weeks — matching
    // the real edge this channel sits at in the 18-week stress sweep. Naive
    // division (400/12 ≈ 33 weeks) would have overstated this by nearly 2x.
    const forecast = forecastCapacity('senior-morning', 'english', 12);
    expect(forecast.poolSize).toBe(hookPoolSize('english', 'senior-morning'));
    expect(forecast.weeksAtCurrentPace).toBe(18);
    expect(forecast.weeksAtCurrentPace).toBeLessThan(forecast.poolSize / 12);
  });

  it('reflects the v3.12 fix: showa-cafe/english now has a much longer runway than pre-fix (was ~17 weeks)', () => {
    const forecast = forecastCapacity('showa-cafe', 'english', 12);
    expect(forecast.weeksAtCurrentPace).toBeGreaterThan(18);
  });

  it('songsPerWeek = 0 does not crash and reports no projected exhaustion', () => {
    expect(() => forecastCapacity('showa-cafe', 'english', 0)).not.toThrow();
    const forecast = forecastCapacity('showa-cafe', 'english', 0);
    expect(forecast.weeksAtCurrentPace).toBe(Infinity);
    expect(forecast.exhaustionDate).toBe('');
  });

  it('negative songsPerWeek does not crash (treated the same as zero pace)', () => {
    expect(() => forecastCapacity('senior-morning', 'korean', -5)).not.toThrow();
    expect(forecastCapacity('senior-morning', 'korean', -5).weeksAtCurrentPace).toBe(Infinity);
  });

  it('forecasts for different archetype/language combos are independent (pure function, no shared state)', () => {
    const first = forecastCapacity('kids', 'english', 12);
    const second = forecastCapacity('senior-morning', 'korean', 12);
    const firstAgain = forecastCapacity('kids', 'english', 12);
    expect(firstAgain).toEqual(first);
    expect(second.poolSize).not.toBe(first.poolSize);
  });

  it('exhaustionDate is a well-formed future date when a pace is given', () => {
    const forecast = forecastCapacity('christmas', 'english', 12);
    expect(forecast.exhaustionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(forecast.exhaustionDate).getTime()).toBeGreaterThan(Date.now());
  });
});
