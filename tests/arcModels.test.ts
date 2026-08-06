import { describe, expect, it } from 'vitest';
import { buildArcPlan } from '../src/core/arcPlan';
import { buildRepetitionCyclePlan } from '../src/core/arcModels';
import { buildArcPlanForProfile } from '../src/core/localGenerator';

/**
 * v5.11 — the kids-workspace 'repetition-cycle' ArcModelId's real builder
 * (previously declared in types.ts but never implemented — see
 * core/arcModels.ts's own top doc comment). Covers: bundle structure
 * (contiguous groups, not a 5-phase curve), non-five-phase phase values,
 * last-bundle-low-intensity, age-tier bundle-count variation, and a
 * byte-for-byte regression proof that buildArcPlan's own five-phase output
 * is completely untouched.
 */

const FIVE_PHASE_VALUES = new Set(['opening', 'rising', 'peak', 'easing', 'closing']);

describe('[v5.11] buildRepetitionCyclePlan — no ageTier (real call-site default)', () => {
  it('returns exactly songCount entries for an 18-song pack', () => {
    const plan = buildRepetitionCyclePlan(18);
    expect(plan).toHaveLength(18);
  });

  it('never produces a five-phase adult phase value', () => {
    const plan = buildRepetitionCyclePlan(18);
    for (const pos of plan) {
      expect(FIVE_PHASE_VALUES.has(pos.phase)).toBe(false);
      expect(pos.phase.startsWith('kids-')).toBe(true);
    }
  });

  it('groups songs into contiguous bundles (familiar -> learning -> moving -> calm), not an interleaved/shuffled order', () => {
    const plan = buildRepetitionCyclePlan(18);
    const phases = plan.map(p => p.phase);
    expect(phases).toEqual([
      'kids-familiar', 'kids-familiar', 'kids-familiar', 'kids-familiar',
      'kids-learning', 'kids-learning', 'kids-learning', 'kids-learning', 'kids-learning',
      'kids-moving', 'kids-moving', 'kids-moving', 'kids-moving', 'kids-moving',
      'kids-calm', 'kids-calm', 'kids-calm', 'kids-calm'
    ]);
  });

  it('each bundle is sized 3-5 (the spec\'s "groups of 3-4", widened slightly since 18 doesn\'t divide evenly across exactly 4 named bundles)', () => {
    const plan = buildRepetitionCyclePlan(18);
    const runs: number[] = [];
    let run = 1;
    for (let i = 1; i < plan.length; i += 1) {
      if (plan[i].phase === plan[i - 1].phase) run += 1;
      else { runs.push(run); run = 1; }
    }
    runs.push(run);
    expect(runs).toHaveLength(4);
    for (const size of runs) expect(size).toBeGreaterThanOrEqual(3);
    for (const size of runs) expect(size).toBeLessThanOrEqual(5);
  });

  it('keeps intensity roughly similar within a bundle (every track in a bundle shares that bundle\'s exact intensity)', () => {
    const plan = buildRepetitionCyclePlan(18);
    const byPhase = new Map<string, number[]>();
    for (const pos of plan) {
      if (!byPhase.has(pos.phase)) byPhase.set(pos.phase, []);
      byPhase.get(pos.phase)!.push(pos.intensity);
    }
    for (const [, intensities] of byPhase) {
      expect(new Set(intensities).size).toBe(1);
    }
  });

  it('only the LAST bundle (kids-calm) is low-intensity — measurably lower than every other bundle', () => {
    const plan = buildRepetitionCyclePlan(18);
    const lastBundlePhase = plan[plan.length - 1].phase;
    const lastBundleIntensity = plan[plan.length - 1].intensity;
    const otherIntensities = plan.filter(p => p.phase !== lastBundlePhase).map(p => p.intensity);
    for (const intensity of otherIntensities) {
      expect(lastBundleIntensity).toBeLessThan(intensity);
    }
  });

  it('returns an empty array for songCount <= 0', () => {
    expect(buildRepetitionCyclePlan(0)).toEqual([]);
    expect(buildRepetitionCyclePlan(-3)).toEqual([]);
  });

  it('scales proportionally for a non-18 songCount and still returns exactly songCount entries', () => {
    for (const count of [1, 5, 9, 12, 24]) {
      expect(buildRepetitionCyclePlan(count)).toHaveLength(count);
    }
  });

  it('every entry is structurally compatible with SlotArcPosition (phase/intensity/peakStrength only)', () => {
    const plan = buildRepetitionCyclePlan(18);
    for (const pos of plan) {
      expect(Object.keys(pos).sort()).toEqual(['intensity', 'peakStrength', 'phase']);
      expect([1, 2, 3, 4, 5]).toContain(pos.intensity);
      expect(['none', 'subtle', 'strong']).toContain(pos.peakStrength);
    }
  });
});

describe('[v5.11] buildRepetitionCyclePlan — age-tier variation', () => {
  it('kids-t1 (0-2세): 3 bundles, last bundle is kids-calm (lullaby), no kids-moving bundle at all', () => {
    const plan = buildRepetitionCyclePlan(18, 'kids-t1');
    const distinctPhases = [...new Set(plan.map(p => p.phase))];
    expect(distinctPhases).toEqual(['kids-familiar', 'kids-learning', 'kids-calm']);
    expect(plan[plan.length - 1].phase).toBe('kids-calm');
    expect(plan.some(p => p.phase === 'kids-moving')).toBe(false);
  });

  it('kids-t2 (2-4세) matches the no-ageTier default shape (4 bundles, motion-instruction-focused moving bundle present)', () => {
    const withTier = buildRepetitionCyclePlan(18, 'kids-t2');
    const withoutTier = buildRepetitionCyclePlan(18);
    expect(withTier).toEqual(withoutTier);
    expect(withTier.some(p => p.phase === 'kids-moving')).toBe(true);
  });

  it('kids-t3 (4-7세): 5 bundles, ending in a distinct kids-closing (wind-down/goodbye) bundle', () => {
    const plan = buildRepetitionCyclePlan(18, 'kids-t3');
    const distinctPhases = [...new Set(plan.map(p => p.phase))];
    expect(distinctPhases).toEqual(['kids-familiar', 'kids-learning', 'kids-moving', 'kids-calm', 'kids-closing']);
    expect(plan[plan.length - 1].phase).toBe('kids-closing');
  });

  it('an unrecognized ageTier string falls back to the same default shape as no ageTier at all', () => {
    expect(buildRepetitionCyclePlan(18, 'not-a-real-tier')).toEqual(buildRepetitionCyclePlan(18));
  });
});

describe('[v5.11] buildArcPlanForProfile — arcModelId-aware dispatch', () => {
  it('"five-phase" dispatches to buildArcPlan, byte-for-byte identical', () => {
    expect(buildArcPlanForProfile(18, 'five-phase')).toEqual(buildArcPlan(18));
  });

  it('"repetition-cycle" dispatches to buildRepetitionCyclePlan, byte-for-byte identical', () => {
    expect(buildArcPlanForProfile(18, 'repetition-cycle')).toEqual(buildRepetitionCyclePlan(18));
  });
});

describe('[v5.11] regression — buildArcPlan\'s own five-phase output is completely untouched', () => {
  it('buildArcPlan(18) still produces the exact v3.67 5-phase sequence, unchanged by the ArcPhase type widening or this task\'s new file', () => {
    const arc = buildArcPlan(18);
    expect(arc.map(p => p.phase)).toEqual([
      'opening', 'opening', 'opening',
      'rising', 'rising', 'rising', 'rising', 'rising',
      'peak', 'peak', 'peak',
      'easing', 'easing', 'easing', 'easing',
      'closing', 'closing', 'closing'
    ]);
    expect(arc.filter(p => p.peakStrength === 'none')).toHaveLength(4);
    expect(arc.filter(p => p.peakStrength === 'strong')).toHaveLength(3);
    expect(arc.filter(p => p.peakStrength === 'subtle')).toHaveLength(11);
    for (const pos of arc.filter(p => p.phase === 'peak')) {
      expect(pos.intensity).toBe(5);
      expect(pos.peakStrength).toBe('strong');
    }
    for (const pos of arc.filter(p => p.phase === 'closing')) {
      expect(pos.intensity).toBe(1);
    }
  });
});
