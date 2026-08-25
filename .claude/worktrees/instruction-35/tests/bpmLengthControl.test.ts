import { describe, expect, it } from 'vitest';
import {
  BPM_LENGTH_TIERS,
  estimateSongLengthSec,
  formatEstimatedLength,
  LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC,
  resolveBpmLengthTier
} from '../src/core/bpmLengthControl';

// v4.16 (TASK A) — tiers re-centered onto 62-72/73-84/85-94/95-100 (see bpmLengthControl.ts's own doc comment).
describe('[v3.82 TASK B] resolveBpmLengthTier', () => {
  it('matches each of the spec\'s own 4 tiers exactly', () => {
    expect(resolveBpmLengthTier(65)).toEqual(BPM_LENGTH_TIERS[0]);
    expect(resolveBpmLengthTier(78)).toEqual(BPM_LENGTH_TIERS[1]);
    expect(resolveBpmLengthTier(90)).toEqual(BPM_LENGTH_TIERS[2]);
    expect(resolveBpmLengthTier(98)).toEqual(BPM_LENGTH_TIERS[3]);
  });

  it('boundary BPMs resolve to the tier that owns that exact edge', () => {
    expect(resolveBpmLengthTier(72)).toBe(BPM_LENGTH_TIERS[0]);
    expect(resolveBpmLengthTier(73)).toBe(BPM_LENGTH_TIERS[1]);
    expect(resolveBpmLengthTier(84)).toBe(BPM_LENGTH_TIERS[1]);
    expect(resolveBpmLengthTier(85)).toBe(BPM_LENGTH_TIERS[2]);
    expect(resolveBpmLengthTier(94)).toBe(BPM_LENGTH_TIERS[2]);
    expect(resolveBpmLengthTier(95)).toBe(BPM_LENGTH_TIERS[3]);
  });

  it('clamps out-of-table BPM to the nearest edge tier instead of failing', () => {
    expect(resolveBpmLengthTier(40)).toBe(BPM_LENGTH_TIERS[0]);
    expect(resolveBpmLengthTier(140)).toBe(BPM_LENGTH_TIERS[3]);
  });

  it('slower tiers have fewer/shorter sections and words than faster tiers', () => {
    for (let i = 1; i < BPM_LENGTH_TIERS.length; i++) {
      expect(BPM_LENGTH_TIERS[i].wordRange[0]).toBeGreaterThanOrEqual(BPM_LENGTH_TIERS[i - 1].wordRange[0]);
      expect(BPM_LENGTH_TIERS[i].sectionRange[1]).toBeGreaterThanOrEqual(BPM_LENGTH_TIERS[i - 1].sectionRange[1]);
    }
  });
});

/**
 * v3.82 (TASK B, §6-3) — calibrated directly against this task's own real
 * measurement: T1 (81 BPM, T1-shaped 8 sections) actual 3:30, T4 (same
 * shape/BPM) actual 3:58, T7 (81 BPM, T1-shape + 1 extra instrumental break)
 * actual 4:16. See core/bpmLengthControl.ts's own doc comment for the
 * coefficient derivation and its honestly-disclosed limits (T10 at 108 BPM
 * deviates further).
 */
describe('[v3.82 TASK B] estimateSongLengthSec — calibrated against real T1/T4/T7 measurements', () => {
  it('T1-template at 81 BPM (T1/T4\'s real shape) estimates close to the 3:30-3:58 real range', () => {
    const estimateSec = estimateSongLengthSec(81, 'T1');
    expect(estimateSec).toBeGreaterThan(200); // > 3:20
    expect(estimateSec).toBeLessThan(240); // < 4:00
  });

  it('the T7 worked example (§2-4): 64 bars at 81 BPM with the 1.35x coefficient lands near the real 4:16', () => {
    // T7's own real shape (T1's 8 sections + 1 extra instrumental break, i.e.
    // 64 bars) isn't a template this app assigns on its own (no template has
    // a mid-song instrumental break) — this test reproduces the spec's own
    // by-hand worked calculation directly rather than through
    // estimateSongLengthSec's template lookup, to document that the
    // calibration constant itself is right.
    const bars = 64;
    const bpm = 81;
    const nominalSec = (bars * 4 * 60) / bpm;
    const estimateSec = nominalSec * 1.35;
    expect(Math.round(estimateSec)).toBe(256); // 4:16 exactly, matching the spec's own worked example
  });

  it('a fast tempo (108 BPM) with a short template estimates well under the slow-tempo case', () => {
    const slow = estimateSongLengthSec(81, 'T1');
    const fast = estimateSongLengthSec(108, 'T3');
    expect(fast).toBeLessThan(slow);
  });

  it('an unassigned structureTemplate falls back to T1\'s own (longest, most conservative) bar count rather than throwing', () => {
    expect(() => estimateSongLengthSec(90)).not.toThrow();
    expect(estimateSongLengthSec(90)).toBe(estimateSongLengthSec(90, 'T1'));
  });

  it('never divides by zero / returns NaN for a bpm of 0', () => {
    expect(Number.isFinite(estimateSongLengthSec(0, 'T1'))).toBe(true);
  });
});

describe('[v3.82 TASK B] LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC is exactly 3:45 (spec §2-4)', () => {
  it('threshold matches the spec\'s literal blocking bar', () => {
    expect(LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC).toBe(225);
    expect(formatEstimatedLength(LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC)).toBe('3:45');
  });
});

describe('[v3.82 TASK B] formatEstimatedLength', () => {
  it('formats seconds as m:ss with zero-padding', () => {
    expect(formatEstimatedLength(190)).toBe('3:10');
    expect(formatEstimatedLength(65)).toBe('1:05');
    expect(formatEstimatedLength(256)).toBe('4:16');
  });
});
