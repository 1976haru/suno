import { describe, expect, it } from 'vitest';
import { buildExplorationInstructionLines, explorationAxisForSequence, EXPLORATION_AXES, selectExplorationTrackNos } from '../src/core/explorationSlots';

/**
 * v5.23 (TASK C) — coverage for exploration-slot placement/rotation/
 * instruction text. §11's own explicit workspace gate (senior-oldpop only —
 * no other workspace has real listening verification yet) is the most
 * important behavior here: verified directly (scenario H/I from §12).
 */
describe('[v5.23 TASK C §11] workspace gate — senior-oldpop only', () => {
  it('kr-2030 gets zero exploration slots, with the documented reason', () => {
    const plan = selectExplorationTrackNos(18, 'kr-2030', 0);
    expect(plan.enabled).toBe(false);
    expect(plan.trackNos).toEqual([]);
    expect(plan.reason).toBe('not-enabled-for-workspace');
  });

  it('kr-kids gets zero exploration slots', () => {
    expect(selectExplorationTrackNos(18, 'kr-kids', 0).enabled).toBe(false);
  });

  it('senior-oldpop gets real exploration slots', () => {
    const plan = selectExplorationTrackNos(18, 'senior-oldpop', 0);
    expect(plan.enabled).toBe(true);
    expect(plan.trackNos.length).toBeGreaterThan(0);
  });
});

describe('[v5.23 TASK C §3-1] slot count — 3-4 of 18', () => {
  it('an 18-song senior-oldpop set gets exactly 4 exploration slots', () => {
    const plan = selectExplorationTrackNos(18, 'senior-oldpop', 0);
    expect(plan.trackNos).toHaveLength(4);
  });

  it('a smaller (but still eligible) set gets 3', () => {
    const plan = selectExplorationTrackNos(10, 'senior-oldpop', 0);
    expect(plan.trackNos).toHaveLength(3);
  });

  it('a too-small set gets none, not a degenerate 1-track slot', () => {
    const plan = selectExplorationTrackNos(4, 'senior-oldpop', 0);
    expect(plan.enabled).toBe(false);
    expect(plan.reason).toBe('set-too-small');
  });
});

describe('[v5.23 TASK C §3-4] placement — never tracks 1-3, prefers the 6-8/12-14 zone', () => {
  it('no exploration track is ever 1, 2, or 3', () => {
    for (const songCount of [8, 10, 12, 18, 24, 30]) {
      const plan = selectExplorationTrackNos(songCount, 'senior-oldpop', 0);
      expect(plan.trackNos.every(n => n > 3), `songCount=${songCount}: ${plan.trackNos}`).toBe(true);
    }
  });

  it('an 18-song set lands close to the spec\'s own 6-8/12-14 example', () => {
    const plan = selectExplorationTrackNos(18, 'senior-oldpop', 0);
    expect(plan.trackNos.every(n => (n >= 6 && n <= 8) || (n >= 12 && n <= 15))).toBe(true);
  });

  it('every selected track is within range and unique', () => {
    const plan = selectExplorationTrackNos(18, 'senior-oldpop', 0);
    expect(new Set(plan.trackNos).size).toBe(plan.trackNos.length);
    expect(plan.trackNos.every(n => n <= 18)).toBe(true);
  });
});

describe('[v5.23 TASK C §3-2] 7-axis rotation', () => {
  it('cycles through all 7 axes over 7 consecutive sequence numbers', () => {
    const axes = Array.from({ length: 7 }, (_, i) => explorationAxisForSequence(i));
    expect(new Set(axes).size).toBe(7);
    expect([...axes].sort()).toEqual([...EXPLORATION_AXES].sort());
  });

  it('repeats identically on the 8th set (true rotation, not random)', () => {
    expect(explorationAxisForSequence(7)).toBe(explorationAxisForSequence(0));
    expect(explorationAxisForSequence(8)).toBe(explorationAxisForSequence(1));
  });

  it('never breaks on a negative or huge sequence number', () => {
    expect(EXPLORATION_AXES).toContain(explorationAxisForSequence(-1));
    expect(EXPLORATION_AXES).toContain(explorationAxisForSequence(1000000));
  });
});

describe('[v5.23 TASK C §3-5/§9] instruction text', () => {
  it('always includes the literal "실패해도 됩니다" line (spec\'s own "하지 말 것" — never drop it)', () => {
    const plan = selectExplorationTrackNos(18, 'senior-oldpop', 1);
    const lines = buildExplorationInstructionLines(plan).join('\n');
    expect(lines).toContain('실패해도 됩니다');
  });

  it('names the real track numbers and the real axis', () => {
    const plan = selectExplorationTrackNos(18, 'senior-oldpop', 1); // sequence 1 -> 'structure'
    const lines = buildExplorationInstructionLines(plan).join('\n');
    for (const trackNo of plan.trackNos) expect(lines).toContain(`T${trackNo}`);
    expect(lines).toContain('구조');
  });

  it('still states the safety constraints that survive exploration (senior listening safety, analog production, length)', () => {
    const plan = selectExplorationTrackNos(18, 'senior-oldpop', 0);
    const lines = buildExplorationInstructionLines(plan).join('\n');
    expect(lines).toContain('시니어가 듣기 편한');
    expect(lines).toContain('아날로그 프로덕션');
    expect(lines).toContain('3:05~3:25');
  });

  it('returns no lines at all when exploration is disabled (kr-2030) — no leaked exploration text for other workspaces', () => {
    const plan = selectExplorationTrackNos(18, 'kr-2030', 0);
    expect(buildExplorationInstructionLines(plan)).toEqual([]);
  });
});
