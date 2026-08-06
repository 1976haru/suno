import { describe, expect, it } from 'vitest';
import { mergeTriedVariationsIntoCombo, mergeTriedVariationsIntoCombos, type ComboVariationRecord } from '../src/core/comboVariationLedger';
import type { VerifiedCombo } from '../src/data/verifiedCombos';

/**
 * v5.23 (TASK D gap 3) — coverage for mergeTriedVariationsIntoCombo(s), the
 * one pure function in comboVariationLedger.ts (the rest is IndexedDB CRUD,
 * same untestable-in-Node limitation as every other ledger — see
 * tests/lyricLineLedger.test.ts's own doc comment). Real behavior this
 * verifies: a ledger-recorded try folds into combo.triedVariations without
 * mutating the input or duplicating an entry the combo's own static data
 * already carries.
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
    noteKo: 'note',
    cautionsKo: [],
    ...overrides
  };
}

function record(overrides: Partial<ComboVariationRecord> = {}): ComboVariationRecord {
  return {
    id: 'senior-oldpop::senior-philly-81::sparse 편곡',
    comboId: 'senior-philly-81',
    workspaceId: 'senior-oldpop',
    variation: 'sparse 편곡',
    verdict: 'good',
    setCode: 'S20260806-01',
    trackNo: 9,
    recordedAt: '2026-08-06T00:00:00.000Z',
    ...overrides
  };
}

describe('[v5.23 TASK D gap 3] mergeTriedVariationsIntoCombo', () => {
  it('appends a ledger-recorded variation the combo has no static entry for', () => {
    const merged = mergeTriedVariationsIntoCombo(baseCombo(), [record()]);
    expect(merged.triedVariations).toEqual([{ variation: 'sparse 편곡', verdict: 'good', setCode: 'S20260806-01' }]);
  });

  it('never mutates the input combo', () => {
    const combo = baseCombo();
    mergeTriedVariationsIntoCombo(combo, [record()]);
    expect(combo.triedVariations).toBeUndefined();
  });

  it('does not duplicate a variation the combo already has (static wins, normalized match)', () => {
    const combo = baseCombo({ triedVariations: [{ variation: '  Sparse  편곡 ', verdict: 'mixed', setCode: 'S-old' }] });
    const merged = mergeTriedVariationsIntoCombo(combo, [record()]);
    expect(merged.triedVariations).toHaveLength(1);
    expect(merged.triedVariations![0].setCode).toBe('S-old'); // the combo's own static entry, not the ledger record
  });

  it('ignores records for a different combo id', () => {
    const combo = baseCombo();
    const merged = mergeTriedVariationsIntoCombo(combo, [record({ comboId: 'other-combo' })]);
    expect(merged).toBe(combo); // same reference — nothing relevant to merge
  });

  it('returns the SAME object reference when nothing to merge (no-op is cheap)', () => {
    const combo = baseCombo();
    expect(mergeTriedVariationsIntoCombo(combo, [])).toBe(combo);
    expect(mergeTriedVariationsIntoCombo(combo, [record({ comboId: 'other-combo' })])).toBe(combo);
  });
});

describe('[v5.23 TASK D gap 3] mergeTriedVariationsIntoCombos', () => {
  it('merges each combo independently against the full record list', () => {
    const comboA = baseCombo({ id: 'combo-a' });
    const comboB = baseCombo({ id: 'combo-b', genreId: 'other-genre' });
    const records = [record({ comboId: 'combo-a', variation: '브라스 추가' }), record({ comboId: 'combo-b', variation: '다른 머니코드' })];
    const [mergedA, mergedB] = mergeTriedVariationsIntoCombos([comboA, comboB], records);
    expect(mergedA.triedVariations?.map(v => v.variation)).toEqual(['브라스 추가']);
    expect(mergedB.triedVariations?.map(v => v.variation)).toEqual(['다른 머니코드']);
  });
});
