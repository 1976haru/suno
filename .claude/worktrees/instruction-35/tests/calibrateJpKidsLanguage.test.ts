import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadApprovedJpKidsResults, summarizeCalibration } from '../scripts/calibrateJpKidsLanguage';
import { JP_KIDS_KANA_RATIO_MIN_APPROVED_SAMPLES_FOR_CALIBRATION, JP_KIDS_KANA_RATIO_MIN_BY_TIER } from '../src/core/jpKidsPolicy';

/**
 * 지시문 11 (TASK D, required test file) — "50개 이상 쌓이기 전까지는
 * provisional 유지, 자동으로 floor를 바꾸지 않는다"는 이 스크립트의 핵심
 * 약속을 실제로 검증한다.
 */

const PURE_KANA_LYRICS = 'あさですよ　おきてね　あさひがまぶしいね';
const KANJI_HEAVY_LYRICS = '本日晴天散歩公園友達運動元気笑顔太陽空気水分補給重要安全確認徹底実施';

describe('[지시문 11 TASK D] loadApprovedJpKidsResults — approved: true만 취급', () => {
  it('approved가 아닌 항목은 무시한다', () => {
    const tmpFile = path.join(os.tmpdir(), `jp-kids-calibration-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify([
      { tierId: 'kids-t1', lyrics: PURE_KANA_LYRICS, approved: true },
      { tierId: 'kids-t1', lyrics: KANJI_HEAVY_LYRICS, approved: false },
      { tierId: 'kids-t1', lyrics: KANJI_HEAVY_LYRICS }
    ]));
    const results = loadApprovedJpKidsResults(tmpFile);
    expect(results).toHaveLength(1);
    fs.unlinkSync(tmpFile);
  });

  it('존재하지 않는 파일은 빈 배열을 반환한다 (허구 데이터를 만들지 않음)', () => {
    expect(loadApprovedJpKidsResults('/definitely/not/a/real/path.json')).toEqual([]);
  });
});

describe('[지시문 11 TASK D] summarizeCalibration — 50개 미만은 provisional 유지', () => {
  it('샘플이 하나도 없으면 모든 tier가 데이터 부족으로 보고된다', () => {
    const summaries = summarizeCalibration([]);
    for (const summary of summaries) {
      expect(summary.sampleCount).toBe(0);
      expect(summary.enoughData).toBe(false);
      expect(summary.candidateFloorP10).toBeUndefined();
      expect(summary.currentFloor).toBe(JP_KIDS_KANA_RATIO_MIN_BY_TIER[summary.tierId]);
    }
  });

  it(`정확히 ${JP_KIDS_KANA_RATIO_MIN_APPROVED_SAMPLES_FOR_CALIBRATION - 1}개(임계값 미만)는 여전히 데이터 부족`, () => {
    const results = Array.from({ length: JP_KIDS_KANA_RATIO_MIN_APPROVED_SAMPLES_FOR_CALIBRATION - 1 }, () => ({
      tierId: 'kids-t1' as const, lyrics: PURE_KANA_LYRICS, approved: true
    }));
    const summary = summarizeCalibration(results).find(s => s.tierId === 'kids-t1')!;
    expect(summary.enoughData).toBe(false);
    expect(summary.candidateFloorP10).toBeUndefined();
  });

  it(`정확히 ${JP_KIDS_KANA_RATIO_MIN_APPROVED_SAMPLES_FOR_CALIBRATION}개(임계값 충족)는 후보값을 계산한다 — 여전히 자동으로 상수를 바꾸지는 않는다`, () => {
    const results = Array.from({ length: JP_KIDS_KANA_RATIO_MIN_APPROVED_SAMPLES_FOR_CALIBRATION }, () => ({
      tierId: 'kids-t1' as const, lyrics: PURE_KANA_LYRICS, approved: true
    }));
    const summary = summarizeCalibration(results).find(s => s.tierId === 'kids-t1')!;
    expect(summary.enoughData).toBe(true);
    expect(summary.candidateFloorP10).toBeDefined();
    // 이 함수는 값을 "제안"만 한다 — JP_KIDS_KANA_RATIO_MIN_BY_TIER 자체는 그대로다.
    expect(JP_KIDS_KANA_RATIO_MIN_BY_TIER['kids-t1']).toBe(0.9);
  });

  it('다른 tier는 서로의 샘플 수에 영향을 주지 않는다', () => {
    const results = [
      ...Array.from({ length: 60 }, () => ({ tierId: 'kids-t1' as const, lyrics: PURE_KANA_LYRICS, approved: true })),
      { tierId: 'kids-t2' as const, lyrics: PURE_KANA_LYRICS, approved: true }
    ];
    const summaries = summarizeCalibration(results);
    expect(summaries.find(s => s.tierId === 'kids-t1')!.enoughData).toBe(true);
    expect(summaries.find(s => s.tierId === 'kids-t2')!.enoughData).toBe(false);
    expect(summaries.find(s => s.tierId === 'kids-t2')!.sampleCount).toBe(1);
  });
});
