import { describe, expect, it } from 'vitest';
import { computeMoneyChordComparison } from '../src/core/moneyChordDisplay';
import { moneyChordPresets } from '../src/data/moneyChords';

/**
 * TASK v5.8 (TASK B) — pure-function coverage for the "선택 vs 실제 적용"
 * comparison and its mismatch warning. Mirrors the real distributions
 * measured via a scratch probe script (directSetLocal -> generateLocalBlueprint,
 * same pattern as scripts/v57FollowupMeasure.ts) for each branch below —
 * see src/core/moneyChordDisplay.ts's own doc comment for what was and
 * wasn't found to be a real mismatch.
 */
describe('computeMoneyChordComparison', () => {
  it('auto (non-explicit) mode with a rotation breakdown reports the rotation, no warning', () => {
    const result = computeMoneyChordComparison(
      { moneyChordMode: 'default', moneyChordModeIsExplicitChoice: false, customMoneyChord: '' },
      [{ id: 'doowop', count: 4 }, { id: 'warmCycle', count: 4 }, { id: 'cityPop', count: 4 }, { id: 'jazzColor', count: 2 }, { id: 'default', count: 4 }],
      18
    );
    expect(result.chosenLabelKo).toBe('자동 배분');
    expect(result.appliedSummaryKo).toContain('5종 회전');
    expect(result.appliedSummaryKo).toContain(`${moneyChordPresets.doowop.labelKo} 4곡`);
    expect(result.mismatchWarningKo).toBeNull();
  });

  it('auto (non-explicit) mode with an empty breakdown (non-quota archetype) reports flat 100% application, no warning', () => {
    const result = computeMoneyChordComparison(
      { moneyChordMode: 'default', moneyChordModeIsExplicitChoice: false, customMoneyChord: '' },
      [],
      18
    );
    expect(result.chosenLabelKo).toBe('자동 배분');
    expect(result.appliedSummaryKo).toContain('18곡 동일 진행');
    expect(result.mismatchWarningKo).toBeNull();
  });

  it('explicit non-default/non-custom pick with the expected 50-60% share reports the chosen id and its share, no warning', () => {
    const result = computeMoneyChordComparison(
      { moneyChordMode: 'winterBallad', moneyChordModeIsExplicitChoice: true, customMoneyChord: '' },
      [{ id: 'winterBallad', count: 10 }, { id: 'canon', count: 3 }, { id: 'emotional', count: 3 }, { id: 'default', count: 2 }],
      18
    );
    expect(result.chosenLabelKo).toBe(moneyChordPresets.winterBallad.labelKo);
    expect(result.appliedSummaryKo).toBe(`${moneyChordPresets.winterBallad.labelKo} 10곡 (나머지는 ${moneyChordPresets.canon.labelKo}·${moneyChordPresets.emotional.labelKo}·${moneyChordPresets.default.labelKo} 등)`);
    expect(result.mismatchWarningKo).toBeNull();
  });

  it('explicit non-default/non-custom pick resolving to 0 songs is a real mismatch and warns (the v5.6-era bug shape)', () => {
    const result = computeMoneyChordComparison(
      { moneyChordMode: 'winterBallad', moneyChordModeIsExplicitChoice: true, customMoneyChord: '' },
      [{ id: 'default', count: 18 }],
      18
    );
    expect(result.appliedSummaryKo).toContain('적용되지 않음');
    expect(result.mismatchWarningKo).not.toBeNull();
    expect(result.mismatchWarningKo).toContain(moneyChordPresets.winterBallad.labelKo);
  });

  it('explicit "default" pick with an empty breakdown (non-quota archetype) reports flat 100% application, no warning (not a mismatch — default has nothing to blend against)', () => {
    const result = computeMoneyChordComparison(
      { moneyChordMode: 'default', moneyChordModeIsExplicitChoice: true, customMoneyChord: '' },
      [],
      18
    );
    expect(result.chosenLabelKo).toBe(moneyChordPresets.default.labelKo);
    expect(result.appliedSummaryKo).toContain('18곡 동일 진행');
    expect(result.mismatchWarningKo).toBeNull();
  });

  it('explicit "default" pick with a quota-archetype rotation breakdown reports the rotation, no warning', () => {
    const result = computeMoneyChordComparison(
      { moneyChordMode: 'default', moneyChordModeIsExplicitChoice: true, customMoneyChord: '' },
      [{ id: 'doowop', count: 4 }, { id: 'warmCycle', count: 4 }],
      18
    );
    expect(result.appliedSummaryKo).toContain('2종 회전');
    expect(result.mismatchWarningKo).toBeNull();
  });

  it('explicit custom pick with real text reports 100% application verbatim, no warning', () => {
    const result = computeMoneyChordComparison(
      { moneyChordMode: 'custom', moneyChordModeIsExplicitChoice: true, customMoneyChord: 'I-bIII-IV-iv noir progression' },
      [],
      18
    );
    expect(result.chosenLabelKo).toContain('I-bIII-IV-iv noir progression');
    expect(result.appliedSummaryKo).toContain('18곡 동일 진행');
    expect(result.mismatchWarningKo).toBeNull();
  });

  it('explicit custom pick with no text yet reports the generic fallback and a soft (non-alarming) warning', () => {
    const result = computeMoneyChordComparison(
      { moneyChordMode: 'custom', moneyChordModeIsExplicitChoice: true, customMoneyChord: '   ' },
      [],
      18
    );
    expect(result.chosenLabelKo).toBe('커스텀 진행 (입력 없음)');
    expect(result.mismatchWarningKo).not.toBeNull();
  });
});
