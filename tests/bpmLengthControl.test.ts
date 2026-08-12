import { describe, expect, it } from 'vitest';
import {
  BPM_ENERGY_BANDS,
  estimateSongLengthSec,
  expectedWordCount,
  formatEstimatedLength,
  LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC,
  NOMINAL_WEIGHT,
  resolveBpmEnergyBand,
  sectionRangeForBpm,
  wordBudgetForTarget,
  WORD_WEIGHT
} from '../src/core/bpmLengthControl';

// 지시문 40 (TASK A/B/C) — estimateSongLengthSec을 nominalSec 계수 모델(x1.35)에서
// 35곡 실측 회귀(0.80×wordCount + 0.20×nominalSec)로 교체하고, BPM_LENGTH_TIERS를
// BPM_ENERGY_BANDS(에너지/섹션 상한)와 wordBudgetForTarget(워크스페이스별 목표
// 길이에서 역산한 단어 예산)으로 분리했다. 원래 4개 밴드의 경계·sectionRange·
// maxInstrumentalSections는 손대지 않았음을 회귀 테스트로 고정한다.

describe('[지시문40 TASK B] resolveBpmEnergyBand', () => {
  it('matches each of the 7 bands exactly (4 original + 3 new >100 bands from TASK C)', () => {
    expect(resolveBpmEnergyBand(65)).toEqual(BPM_ENERGY_BANDS[0]);
    expect(resolveBpmEnergyBand(78)).toEqual(BPM_ENERGY_BANDS[1]);
    expect(resolveBpmEnergyBand(90)).toEqual(BPM_ENERGY_BANDS[2]);
    expect(resolveBpmEnergyBand(98)).toEqual(BPM_ENERGY_BANDS[3]);
    expect(resolveBpmEnergyBand(112)).toEqual(BPM_ENERGY_BANDS[4]); // K-pop's real BPM — TASK C's whole motivation
    expect(resolveBpmEnergyBand(120)).toEqual(BPM_ENERGY_BANDS[5]);
    expect(resolveBpmEnergyBand(140)).toEqual(BPM_ENERGY_BANDS[6]);
  });

  it('boundary BPMs resolve to the band that owns that exact edge — original 4 bands unchanged', () => {
    expect(resolveBpmEnergyBand(72)).toBe(BPM_ENERGY_BANDS[0]);
    expect(resolveBpmEnergyBand(73)).toBe(BPM_ENERGY_BANDS[1]);
    expect(resolveBpmEnergyBand(84)).toBe(BPM_ENERGY_BANDS[1]);
    expect(resolveBpmEnergyBand(85)).toBe(BPM_ENERGY_BANDS[2]);
    expect(resolveBpmEnergyBand(94)).toBe(BPM_ENERGY_BANDS[2]);
    expect(resolveBpmEnergyBand(95)).toBe(BPM_ENERGY_BANDS[3]);
    expect(resolveBpmEnergyBand(100)).toBe(BPM_ENERGY_BANDS[3]);
  });

  it('the 3 new >100 bands (TASK C) cover 101-150 with no gap, fixing 112 BPM being wrongly clamped into the 95-100 tier', () => {
    expect(resolveBpmEnergyBand(101)).toBe(BPM_ENERGY_BANDS[4]);
    expect(resolveBpmEnergyBand(115)).toBe(BPM_ENERGY_BANDS[4]);
    expect(resolveBpmEnergyBand(116)).toBe(BPM_ENERGY_BANDS[5]);
    expect(resolveBpmEnergyBand(130)).toBe(BPM_ENERGY_BANDS[5]);
    expect(resolveBpmEnergyBand(131)).toBe(BPM_ENERGY_BANDS[6]);
    expect(resolveBpmEnergyBand(150)).toBe(BPM_ENERGY_BANDS[6]);
  });

  it('clamps out-of-table BPM to the nearest edge band instead of failing', () => {
    expect(resolveBpmEnergyBand(40)).toBe(BPM_ENERGY_BANDS[0]);
    expect(resolveBpmEnergyBand(200)).toBe(BPM_ENERGY_BANDS[6]);
  });

  it('original 4 bands keep their pre-지시문40 maxInstrumentalSections (1,1,2,2) — a 하루 청취 검증값, must not shift', () => {
    expect(BPM_ENERGY_BANDS[0].maxInstrumentalSections).toBe(1);
    expect(BPM_ENERGY_BANDS[1].maxInstrumentalSections).toBe(1);
    expect(BPM_ENERGY_BANDS[2].maxInstrumentalSections).toBe(2);
    expect(BPM_ENERGY_BANDS[3].maxInstrumentalSections).toBe(2);
  });
});

describe('[지시문40 TASK B] sectionRangeForBpm — regression: byte-identical to the removed BPM_LENGTH_TIERS.sectionRange for the original 4 bands', () => {
  it('reproduces the exact pre-지시문40 sectionRange values ([5,6],[5,6],[6,7],[6,7])', () => {
    expect(sectionRangeForBpm(65)).toEqual([5, 6]);
    expect(sectionRangeForBpm(78)).toEqual([5, 6]);
    expect(sectionRangeForBpm(90)).toEqual([6, 7]);
    expect(sectionRangeForBpm(98)).toEqual([6, 7]);
  });

  it('does NOT widen the original bands even though word budgets grow — extra words are absorbed via more lines, not more sections', () => {
    expect(sectionRangeForBpm(72)).toEqual([5, 6]);
    expect(sectionRangeForBpm(100)).toEqual([6, 7]);
  });

  it('the 3 new >100 bands (TASK C) get their own explicit section ranges, reported separately rather than silently inheriting the 95-100 band', () => {
    expect(sectionRangeForBpm(112)).toEqual([6, 7]);
    expect(sectionRangeForBpm(120)).toEqual([6, 8]);
    expect(sectionRangeForBpm(140)).toEqual([6, 8]);
  });

  it('clamps out-of-table BPM to the nearest edge band', () => {
    expect(sectionRangeForBpm(40)).toEqual([5, 6]);
    expect(sectionRangeForBpm(200)).toEqual([6, 8]);
  });
});

/**
 * 지시문 40 (TASK A) — 35곡 실측 회귀: estimateSec = 0.80×wordCount + 0.20×nominalSec.
 * wordBudgetForTarget은 이 식을 목표 길이에서 단어 수로 역산한다:
 * wordFor(targetSec) = round((targetSec - 0.20×nominalSec) / 0.80).
 * 아래 값들은 지시문 자체가 제시한 worked-example 표를 손으로 재계산해 그대로
 * 재현한 것 — nominalSec은 structureTemplate 미지정 시 T1(56마디) 기준.
 */
describe('[지시문40 TASK A] WORD_WEIGHT / NOMINAL_WEIGHT are exactly the given regression weights', () => {
  it('0.80 / 0.20 — not to be arbitrarily retuned', () => {
    expect(WORD_WEIGHT).toBe(0.80);
    expect(NOMINAL_WEIGHT).toBe(0.20);
    expect(WORD_WEIGHT + NOMINAL_WEIGHT).toBe(1);
  });
});

describe('[지시문40 TASK A] wordBudgetForTarget — reproduces the instruction\'s own worked-example table exactly', () => {
  it('senior default target [185,205]s spans a 178-223 word range across BPM 63-100 (T1/56-bar default)', () => {
    const at63 = wordBudgetForTarget([185, 205], 63);
    expect(at63.wordRange).toEqual([178, 203]);

    const at100 = wordBudgetForTarget([185, 205], 100);
    expect(at100.wordRange).toEqual([198, 223]);
  });

  it('K-pop\'s new target [150,190]s at its real 112 BPM yields the instruction\'s own 158-208 word range', () => {
    const result = wordBudgetForTarget([150, 190], 112);
    expect(result.wordRange).toEqual([158, 208]);
  });

  it('a faster BPM (shorter nominalSec) needs MORE words to fill the same target length, not fewer', () => {
    const slow = wordBudgetForTarget([185, 205], 63);
    const fast = wordBudgetForTarget([185, 205], 100);
    expect(fast.wordRange[0]).toBeGreaterThan(slow.wordRange[0]);
    expect(fast.wordRange[1]).toBeGreaterThan(slow.wordRange[1]);
  });

  it('sectionRange returned alongside the word budget matches sectionRangeForBpm exactly (single source of truth)', () => {
    const result = wordBudgetForTarget([185, 205], 90);
    expect(result.sectionRange).toEqual(sectionRangeForBpm(90));
  });

  it('never returns a negative word count even for a target shorter than the nominal instrumental length', () => {
    const result = wordBudgetForTarget([10, 20], 63);
    expect(result.wordRange[0]).toBeGreaterThanOrEqual(0);
    expect(result.wordRange[1]).toBeGreaterThanOrEqual(0);
  });
});

describe('[지시문40 TASK A] expectedWordCount — design-time BPM-only fallback for wordCount-less call sites', () => {
  it('returns the midpoint of wordBudgetForTarget at the senior default target range', () => {
    const bpm = 90;
    const { wordRange } = wordBudgetForTarget([185, 205], bpm);
    expect(expectedWordCount(bpm)).toBe(Math.round((wordRange[0] + wordRange[1]) / 2));
  });

  it('is a real fallback, not the removed BPM-only estimation path — it feeds into estimateSongLengthSec\'s own wordCount, never bypasses it', () => {
    const bpm = 90;
    expect(estimateSongLengthSec(bpm)).toBe(estimateSongLengthSec(bpm, undefined, expectedWordCount(bpm)));
  });
});

describe('[지시문40 TASK A] estimateSongLengthSec — real wordCount vs the expectedWordCount(bpm) fallback', () => {
  it('with a real wordCount, follows the regression formula directly rather than guessing from BPM', () => {
    const bpm = 90;
    const wordCount = 210;
    const nominalSec = (56 * 4 * 60) / bpm; // default T1 bars
    const expected = WORD_WEIGHT * wordCount + NOMINAL_WEIGHT * nominalSec;
    expect(estimateSongLengthSec(bpm, undefined, wordCount)).toBeCloseTo(expected, 5);
  });

  it('a wordCount of 0 or undefined falls back to expectedWordCount(bpm), not to a bare BPM-only estimate', () => {
    const bpm = 90;
    expect(estimateSongLengthSec(bpm, undefined, 0)).toBe(estimateSongLengthSec(bpm));
    expect(estimateSongLengthSec(bpm, undefined, undefined)).toBe(estimateSongLengthSec(bpm));
  });

  it('more actual words in the lyrics produces a longer estimate than the generic fallback, and fewer produces a shorter one', () => {
    const bpm = 90;
    const baseline = estimateSongLengthSec(bpm);
    const wordy = estimateSongLengthSec(bpm, undefined, expectedWordCount(bpm) + 60);
    const terse = estimateSongLengthSec(bpm, undefined, Math.max(1, expectedWordCount(bpm) - 60));
    expect(wordy).toBeGreaterThan(baseline);
    expect(terse).toBeLessThan(baseline);
  });

  it('never divides by zero / returns NaN for a bpm of 0', () => {
    expect(Number.isFinite(estimateSongLengthSec(0))).toBe(true);
  });
});

describe('[지시문40] LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC is unchanged at 3:45', () => {
  it('threshold matches the pre-지시문40 blocking bar', () => {
    expect(LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC).toBe(225);
    expect(formatEstimatedLength(LENGTH_ESTIMATE_BLOCKING_THRESHOLD_SEC)).toBe('3:45');
  });
});

describe('formatEstimatedLength', () => {
  it('formats seconds as m:ss with zero-padding', () => {
    expect(formatEstimatedLength(190)).toBe('3:10');
    expect(formatEstimatedLength(65)).toBe('1:05');
    expect(formatEstimatedLength(256)).toBe('4:16');
  });
});
