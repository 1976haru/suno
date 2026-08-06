import { describe, expect, it } from 'vitest';
import { checkTempoAgainstAudienceProfile, checkTempoAgainstGenreRange, checkTempoWordingContradiction } from '../src/core/tempoComplianceGate';
import type { AudienceProfile, GenrePack } from '../src/types';

/**
 * v5.22 (AXIS 2 §2-3) — coverage for the BPM hard gate: a real audit found
 * BPM 131 delivered against a documented 100 ceiling (v4.16's own
 * instruction), and 2 tracks whose BPM sat outside their own genre's
 * tempoRange. These are the POST-hoc checks core/quality.ts's scoreSong now
 * runs on every real generation path (mirrors the same wiring
 * tests/englishLint.test.ts already verifies for AXIS 3).
 */
const seniorProfile: AudienceProfile = { tempoFloor: 62, tempoCeiling: 100 } as AudienceProfile;

describe('[v5.22 AXIS 2] checkTempoAgainstAudienceProfile', () => {
  it('flags BPM over the ceiling (the real 131-vs-100 case)', () => {
    const issues = checkTempoAgainstAudienceProfile(131, seniorProfile);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('tempo-over-ceiling');
  });

  it('flags BPM under the floor', () => {
    const issues = checkTempoAgainstAudienceProfile(40, seniorProfile);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('tempo-under-floor');
  });

  it('does not flag BPM within range', () => {
    expect(checkTempoAgainstAudienceProfile(88, seniorProfile)).toEqual([]);
  });

  it('does not flag BPM exactly at the ceiling or floor (inclusive bounds)', () => {
    expect(checkTempoAgainstAudienceProfile(100, seniorProfile)).toEqual([]);
    expect(checkTempoAgainstAudienceProfile(62, seniorProfile)).toEqual([]);
  });
});

describe('[v5.22 AXIS 2] checkTempoAgainstGenreRange', () => {
  const softRockAm: Pick<GenrePack, 'tempoRange' | 'label'> = { tempoRange: [70, 96], label: 'soft-rock-am' };

  it('flags BPM outside the genre\'s own range (the real T5 soft-rock-am 131 case)', () => {
    const issues = checkTempoAgainstGenreRange(131, softRockAm);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('tempo-outside-genre-range');
  });

  it('does not flag BPM within the genre\'s range', () => {
    expect(checkTempoAgainstGenreRange(85, softRockAm)).toEqual([]);
  });
});

describe('[v5.22 AXIS 2] checkTempoWordingContradiction', () => {
  it('flags a slow-tempo descriptor contradicting BPM > 100', () => {
    const issues = checkTempoWordingContradiction('unhurried acoustic guitar, gentle piano, warm vocals', 131);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('tempo-wording-contradiction');
  });

  it('does not flag when BPM is at or below the threshold', () => {
    expect(checkTempoWordingContradiction('unhurried acoustic guitar, gentle piano', 95)).toEqual([]);
  });

  it('does not flag a stylePrompt with no slow-tempo wording', () => {
    expect(checkTempoWordingContradiction('driving electric guitar, punchy drums', 131)).toEqual([]);
  });
});
