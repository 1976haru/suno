import { describe, expect, it } from 'vitest';
import { resolveLyricBudget } from '../src/core/lyricBudget';
import { resolveBpmLengthTier } from '../src/core/bpmLengthControl';
import { KIDS_AGE_TIERS } from '../src/data/kidsAgeTiers';
import { KIDS_STRUCTURE_TEMPLATES } from '../src/data/kidsStructureTemplates';

/**
 * codex 지시문 03 (TASK K) — real gap this closes: resolveLyricBudget did
 * not exist. Built as a real aggregation over 3 already-calibrated data
 * sources (core/bpmLengthControl.ts's BPM_LENGTH_TIERS, data/kidsAgeTiers.ts,
 * data/kidsStructureTemplates.ts) rather than invented numbers — see
 * src/core/lyricBudget.ts's own doc comment.
 */
describe('[codex 지시문 03 TASK K] resolveLyricBudget — non-kids (BPM_LENGTH_TIERS)', () => {
  it('a slow BPM resolves the real slowest tier\'s word range', () => {
    const budget = resolveLyricBudget({ bpm: 65, workspaceId: 'senior-oldpop' });
    const tier = resolveBpmLengthTier(65);
    expect(budget.wordRange).toEqual(tier.wordRange);
    expect(budget.maxSections).toBe(tier.sectionRange[1]);
    expect(budget.maxInstrumentalSections).toBe(tier.maxInstrumentalSections);
  });

  it('a fast BPM resolves a different, real tier', () => {
    const budget = resolveLyricBudget({ bpm: 98, workspaceId: 'kr-2030' });
    const tier = resolveBpmLengthTier(98);
    expect(budget.wordRange).toEqual(tier.wordRange);
  });

  it('an out-of-table BPM clamps to the nearest real edge tier (never throws, never undefined)', () => {
    const budget = resolveLyricBudget({ bpm: 200, workspaceId: 'kr-idol-male' });
    expect(budget.maxSections).toBeGreaterThan(0);
    expect(budget.wordRange[1]).toBeGreaterThan(budget.wordRange[0]);
  });

  it('has a real default chorusRepetitions and no rapLineBudget when rapShare is omitted', () => {
    const budget = resolveLyricBudget({ bpm: 92, workspaceId: 'senior-oldpop' });
    expect(budget.chorusRepetitions).toBeGreaterThan(0);
    expect(budget.rapLineBudget).toBeUndefined();
  });
});

describe('[codex 지시문 03 TASK K] resolveLyricBudget — K-pop rapShare', () => {
  it('a real rapShare produces a positive rapLineBudget proportional to maxSections', () => {
    const budget = resolveLyricBudget({ bpm: 100, workspaceId: 'kr-idol-male', rapShare: 0.3 });
    expect(budget.rapLineBudget).toBeGreaterThan(0);
  });

  it('a higher rapShare narrows the sung wordRange floor (denser rap lines displace some sung word budget) without changing the ceiling', () => {
    const base = resolveLyricBudget({ bpm: 100, workspaceId: 'kr-idol-male' });
    const withRap = resolveLyricBudget({ bpm: 100, workspaceId: 'kr-idol-male', rapShare: 0.5 });
    expect(withRap.wordRange[0]).toBeLessThan(base.wordRange[0]);
    expect(withRap.wordRange[1]).toBe(base.wordRange[1]);
  });

  it('rapShare 0 or omitted behaves identically (no rapLineBudget, no wordRange shrink)', () => {
    const withoutRap = resolveLyricBudget({ bpm: 100, workspaceId: 'kr-idol-male' });
    const zeroRap = resolveLyricBudget({ bpm: 100, workspaceId: 'kr-idol-male', rapShare: 0 });
    expect(withoutRap).toEqual(zeroRap);
  });
});

describe('[codex 지시문 03 TASK K] resolveLyricBudget — kids (real per-age-tier data)', () => {
  it.each(['kids-t1', 'kids-t2', 'kids-t3'] as const)('%s: uses the real age-tier word target and structure-template section count, not the BPM table', tierId => {
    const budget = resolveLyricBudget({ bpm: 110, workspaceId: 'kr-kids', kidsAgeTierId: tierId });
    const tier = KIDS_AGE_TIERS[tierId];
    const template = KIDS_STRUCTURE_TEMPLATES[tierId];
    expect(budget.wordRange[1]).toBe(tier.totalWordTarget);
    expect(budget.maxSections).toBe(template.sections.length);
    expect(budget.chorusRepetitions).toBe(tier.minHookRepeats);
  });

  it('a younger tier (T1) has a real, lower word target than an older tier (T3)', () => {
    const t1 = resolveLyricBudget({ bpm: 90, workspaceId: 'kr-kids', kidsAgeTierId: 'kids-t1' });
    const t3 = resolveLyricBudget({ bpm: 90, workspaceId: 'kr-kids', kidsAgeTierId: 'kids-t3' });
    expect(t1.wordRange[1]).toBeLessThan(t3.wordRange[1]);
  });

  it('kids resolution ignores BPM entirely (same age tier, different BPM, identical budget)', () => {
    const a = resolveLyricBudget({ bpm: 90, workspaceId: 'kr-kids', kidsAgeTierId: 'kids-t2' });
    const b = resolveLyricBudget({ bpm: 130, workspaceId: 'kr-kids', kidsAgeTierId: 'kids-t2' });
    expect(a).toEqual(b);
  });
});
