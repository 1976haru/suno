import { describe, expect, it } from 'vitest';
import { buildIntroModePlan, INTRO_MODE_IDS } from '../src/core/introModePlan';

describe('[v3.64 TASK B] buildIntroModePlan', () => {
  it('always makes track 1 (cold-open) vocal-immediate', () => {
    for (const songCount of [1, 5, 12, 18, 30, 80]) {
      const plan = buildIntroModePlan(songCount, 42);
      expect(plan[0], `songCount=${songCount}`).toBe('vocal-immediate');
    }
  });

  it('an 18-song plan uses roughly the spec\'s reference distribution (8 instrumental / 4 vocal-immediate / 6 vocal-after-texture)', () => {
    const plan = buildIntroModePlan(18, 42);
    expect(plan).toHaveLength(18);
    const counts = { instrumental: 0, 'vocal-immediate': 0, 'vocal-after-texture': 0 };
    for (const mode of plan) counts[mode] += 1;
    expect(counts.instrumental).toBe(8);
    expect(counts['vocal-immediate']).toBe(4);
    expect(counts['vocal-after-texture']).toBe(6);
  });

  it('uses all 3 modes for a normal-sized pack', () => {
    const plan = buildIntroModePlan(18, 7);
    expect(new Set(plan).size).toBe(INTRO_MODE_IDS.length);
  });

  it('never returns more entries than requested and handles small/edge song counts without crashing', () => {
    for (const songCount of [0, 1, 2, 3]) {
      const plan = buildIntroModePlan(songCount, 1);
      expect(plan).toHaveLength(songCount);
    }
  });

  it('is deterministic for the same songCount/seed', () => {
    const a = buildIntroModePlan(18, 99);
    const b = buildIntroModePlan(18, 99);
    expect(a).toEqual(b);
  });

  it('a different seed can reorder non-cold-open tracks (not hardcoded to one fixed pattern)', () => {
    const a = buildIntroModePlan(18, 1);
    const b = buildIntroModePlan(18, 2);
    expect(a).not.toEqual(b);
    // Track 1 stays vocal-immediate regardless of seed.
    expect(a[0]).toBe('vocal-immediate');
    expect(b[0]).toBe('vocal-immediate');
  });
});
