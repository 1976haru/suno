import { describe, expect, it } from 'vitest';
import {
  candidateVariationsFor,
  generateUntriedVariations,
  nextComboVariation,
  resolveFlagshipVariationPlan,
  buildFlagshipVariationInstructionLines,
  applyComboVariationToSlot,
  applyFlagshipVariationToSlots
} from '../src/core/comboVariations';
import type { VerifiedCombo } from '../src/data/verifiedCombos';

/**
 * v5.23 (TASK D §4-2/§4-3/§4-4) — coverage for the "이 조합을 반복하라 -> 이
 * 조합을 출발점으로 변주하라" reframing: candidateVariationsFor's own 5-axis
 * coverage (BPM shift, vocal swap, instrumentation, arrangement density,
 * money chord — spec's own §4-3 list), generateUntriedVariations removing
 * anything already recorded in triedVariations, and
 * resolveFlagshipVariationPlan picking the real second same-genre track
 * (§4-4's "1곡 그대로, 1곡 변주").
 */
function baseCombo(overrides: Partial<VerifiedCombo> = {}): VerifiedCombo {
  return {
    id: 'senior-philly-81',
    workspaceId: 'senior-oldpop',
    genreId: 'oldpop-philly-soul-sweet',
    bpmRange: [78, 86],
    verdict: 'good',
    sampleSize: 3,
    sampleTracks: ['T1', 'T4', 'T7'],
    verifiedAt: '2026-08-02',
    noteKo: '필라델피아 스위트소울 81 BPM',
    cautionsKo: [],
    ...overrides
  };
}

describe('[v5.23 TASK D] candidateVariationsFor', () => {
  it('covers all 5 spec axes for a combo with no fixed vocal/arrangement', () => {
    const candidates = candidateVariationsFor(baseCombo());
    expect(candidates).toContain('75 BPM');
    expect(candidates).toContain('90 BPM');
    expect(candidates).toContain('여성 듀엣');
    expect(candidates).toContain('남성 솔로');
    expect(candidates).toContain('스트링 없이');
    expect(candidates).toContain('브라스 추가');
    expect(candidates).toContain('sparse 편곡');
    expect(candidates).toContain('full 편곡');
    expect(candidates).toContain('다른 머니코드');
  });

  it('offers the opposite vocal option only when the combo already has a fixed vocalType', () => {
    const candidates = candidateVariationsFor(baseCombo({ vocalType: 'female' }));
    expect(candidates).toContain('남성 솔로');
    expect(candidates).toContain('혼성 듀엣');
    expect(candidates).not.toContain('여성 듀엣');
  });

  it('offers the opposite arrangement density only when the combo already has a fixed one', () => {
    const candidates = candidateVariationsFor(baseCombo({ arrangementDensity: 'sparse' }));
    expect(candidates).toEqual(expect.arrayContaining(['full 편곡']));
    expect(candidates).not.toContain('sparse 편곡');
  });
});

describe('[v5.23 TASK D] generateUntriedVariations / nextComboVariation', () => {
  it('excludes variations already recorded in triedVariations (normalized match)', () => {
    const combo = baseCombo({ triedVariations: [{ variation: '  75  bpm ', verdict: 'mixed', setCode: 'S1' }] });
    const untried = generateUntriedVariations(combo);
    expect(untried).not.toContain('75 BPM');
    expect(untried).toContain('90 BPM');
  });

  it('nextComboVariation returns the first untried candidate', () => {
    expect(nextComboVariation(baseCombo())).toBe(candidateVariationsFor(baseCombo())[0]);
  });

  it('nextComboVariation returns undefined once every candidate has been tried', () => {
    const all = candidateVariationsFor(baseCombo());
    const combo = baseCombo({ triedVariations: all.map(variation => ({ variation, verdict: 'good' as const, setCode: 'S1' })) });
    expect(nextComboVariation(combo)).toBeUndefined();
  });
});

describe('[v5.23 TASK D] resolveFlagshipVariationPlan', () => {
  it('returns undefined when no combo is passed', () => {
    expect(resolveFlagshipVariationPlan([{ trackNo: 2, genreId: 'oldpop-philly-soul-sweet' }], undefined)).toBeUndefined();
  });

  it('returns undefined when only one track carries the combo genre (no room for a variation track)', () => {
    const combo = baseCombo();
    const slots = [{ trackNo: 2, genreId: combo.genreId }, { trackNo: 5, genreId: 'other-genre' }];
    expect(resolveFlagshipVariationPlan(slots, combo)).toBeUndefined();
  });

  it('picks the SECOND same-genre track (by trackNo order) as the variation track', () => {
    const combo = baseCombo();
    const slots = [
      { trackNo: 2, genreId: combo.genreId },
      { trackNo: 5, genreId: 'other-genre' },
      { trackNo: 9, genreId: combo.genreId }
    ];
    const plan = resolveFlagshipVariationPlan(slots, combo);
    expect(plan?.trackNo).toBe(9);
    expect(plan?.variation).toBe(nextComboVariation(combo));
  });

  it('returns undefined once every variation for that combo has already been tried', () => {
    const all = candidateVariationsFor(baseCombo());
    const combo = baseCombo({ triedVariations: all.map(variation => ({ variation, verdict: 'good' as const, setCode: 'S1' })) });
    const slots = [{ trackNo: 2, genreId: combo.genreId }, { trackNo: 9, genreId: combo.genreId }];
    expect(resolveFlagshipVariationPlan(slots, combo)).toBeUndefined();
  });
});

/**
 * v5.23 (TASK D gap 2) — coverage for the deterministic structural patch:
 * arrangementDensity/instrumentSet/moneyChord get a REAL change, BPM/vocal
 * variations are deliberately left alone (see applyComboVariationToSlot's
 * own doc comment for why).
 */
function baseSlot(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    trackNo: 9,
    genreId: 'oldpop-philly-soul-sweet',
    moneyChordText: 'IV-V-vi-I - some effect',
    moneyChordId: 'default',
    instrumentSet: ['piano', 'strings'],
    arrangementDensity: 'medium' as const,
    tempo: 81,
    ...overrides
  };
}

describe('[v5.23 TASK D gap 2] applyComboVariationToSlot', () => {
  it('"스트링 없이" removes string-like instruments', () => {
    const patched = applyComboVariationToSlot(baseSlot(), '스트링 없이');
    expect(patched.instrumentSet).toEqual(['piano']);
  });

  it('"브라스 추가" adds brass without duplicating an existing brass/horn entry', () => {
    const patched = applyComboVariationToSlot(baseSlot(), '브라스 추가');
    expect(patched.instrumentSet).toContain('brass');
    const already = applyComboVariationToSlot(baseSlot({ instrumentSet: ['horns'] }), '브라스 추가');
    expect(already.instrumentSet).toEqual(['horns']);
  });

  it('"sparse 편곡" / "full 편곡" override arrangementDensity', () => {
    expect(applyComboVariationToSlot(baseSlot(), 'sparse 편곡').arrangementDensity).toBe('sparse');
    expect(applyComboVariationToSlot(baseSlot(), 'full 편곡').arrangementDensity).toBe('full');
  });

  it('"다른 머니코드" picks a different preset id and rebuilds moneyChordText', () => {
    const patched = applyComboVariationToSlot(baseSlot(), '다른 머니코드');
    expect(patched.moneyChordId).not.toBe('default');
    expect(patched.moneyChordText).not.toBe(baseSlot().moneyChordText);
  });

  it('a BPM variation ("NN BPM") leaves the slot completely unchanged (advisory-only, real downstream dependents elsewhere)', () => {
    const slot = baseSlot();
    expect(applyComboVariationToSlot(slot, '90 BPM')).toEqual(slot);
  });

  it('a vocal variation ("여성 듀엣" 등) leaves the slot completely unchanged (advisory-only)', () => {
    const slot = baseSlot();
    expect(applyComboVariationToSlot(slot, '여성 듀엣')).toEqual(slot);
  });
});

describe('[v5.23 TASK D gap 2] applyFlagshipVariationToSlots', () => {
  const combo: VerifiedCombo = {
    id: 'senior-philly-81', workspaceId: 'senior-oldpop', genreId: 'oldpop-philly-soul-sweet',
    bpmRange: [78, 86], verdict: 'good', sampleSize: 3, sampleTracks: ['T1', 'T4', 'T7'],
    verifiedAt: '2026-08-02', noteKo: 'note', cautionsKo: [],
    // BPM and vocal variations are the first 4 candidates (see
    // candidateVariationsFor's own order) and are deliberately
    // advisory-only (no structural patch) — marking them tried here so
    // nextComboVariation lands on '스트링 없이' (a real, structurally-applied
    // axis), matching this test's own intent.
    triedVariations: [
      { variation: '75 BPM', verdict: 'mixed', setCode: 'S0' },
      { variation: '90 BPM', verdict: 'mixed', setCode: 'S0' },
      { variation: '여성 듀엣', verdict: 'mixed', setCode: 'S0' },
      { variation: '남성 솔로', verdict: 'mixed', setCode: 'S0' }
    ]
  };

  it('patches only the second same-genre track, leaving every other slot byte-identical', () => {
    const slots = [baseSlot({ trackNo: 2 }), baseSlot({ trackNo: 5, genreId: 'other' }), baseSlot({ trackNo: 9 })];
    const patched = applyFlagshipVariationToSlots(slots, combo);
    expect(patched[0]).toBe(slots[0]); // same reference — untouched
    expect(patched[1]).toBe(slots[1]);
    expect(patched[2]).not.toBe(slots[2]); // real, patched object
  });

  it('returns the exact same array when no combo is passed (byte-identical to every pre-v5.23 caller)', () => {
    const slots = [baseSlot({ trackNo: 2 }), baseSlot({ trackNo: 9 })];
    expect(applyFlagshipVariationToSlots(slots, undefined)).toBe(slots);
  });
});

describe('[v5.23 TASK D] buildFlagshipVariationInstructionLines', () => {
  it('returns an empty array when there is no plan', () => {
    expect(buildFlagshipVariationInstructionLines(undefined)).toEqual([]);
  });

  it('renders the track number, combo label, and chosen variation', () => {
    const lines = buildFlagshipVariationInstructionLines({ trackNo: 9, comboLabelKo: '필라델피아 스위트소울 81 BPM', variation: '90 BPM' });
    const text = lines.join('\n');
    expect(text).toContain('T9');
    expect(text).toContain('필라델피아 스위트소울 81 BPM');
    expect(text).toContain('90 BPM');
  });
});
