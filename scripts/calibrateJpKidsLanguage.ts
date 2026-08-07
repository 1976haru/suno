/**
 * 지시문 11 (TASK D) — jp-kids kana 비율 하한(0.9/0.8/0.7, core/jpKidsPolicy.ts의
 * JP_KIDS_KANA_RATIO_MIN_BY_TIER) 재검증 도구. 그 값들은 실측 검증된 게 아니라
 * "합리적으로 보이는" 확장이었다는 사실이 이미 그 파일의 doc comment에
 * 있었다 — 이 스크립트는 "50개 이상의 승인된 실제 jp-kids 결과가 쌓이기
 * 전까지는 provisional을 유지한다"는 이 지시문의 명시 요구를 실제로 강제한다.
 *
 * 이 스크립트가 하지 않는 것: JP_KIDS_KANA_RATIO_MIN_BY_TIER를 자동으로
 * 덮어쓰지 않는다("50곡 쌓이기 전에 자동으로 바꾸지 않는다"는 지시문 자신의
 * "하지 말 것"). 데이터가 충분해도 후보값만 출력하고, 실제 상수 수정은
 * 사람이 하루가 직접 듣고 검토한 뒤 core/jpKidsPolicy.ts를 손으로 고친다.
 *
 * 입력 형식: JSON 배열, 각 원소는 { tierId: 'kids-t1'|'kids-t2'|'kids-t3',
 * lyrics: string, approved: true } — "approved"는 하루가 실제로 듣고 통과
 * 판정한 결과만 이 파일에 넣으라는 뜻(자동 생성된 초안을 그대로 쌓으면
 * 캘리브레이션 자체가 오염된다). approved가 아닌 항목은 무시한다.
 *
 * Usage:
 *   npx tsx scripts/calibrateJpKidsLanguage.ts --input <path.json>
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { measureLyricLanguageRatios } from '../src/core/lyricMetrics';
import { KIDS_AGE_TIERS, type KidsAgeTierId } from '../src/data/kidsAgeTiers';
import { JP_KIDS_KANA_RATIO_MIN_BY_TIER, JP_KIDS_KANA_RATIO_MIN_APPROVED_SAMPLES_FOR_CALIBRATION } from '../src/core/jpKidsPolicy';

interface ApprovedJpKidsResult {
  tierId: KidsAgeTierId;
  lyrics: string;
  approved?: boolean;
}

export interface TierCalibrationSummary {
  tierId: KidsAgeTierId;
  sampleCount: number;
  currentFloor: number;
  enoughData: boolean;
  /** 실측 하위 10퍼센타일 kana 비율 — 데이터가 부족하면 undefined(허구 값을 만들지 않는다). */
  candidateFloorP10?: number;
}

function percentile(sortedAsc: readonly number[], p: number): number {
  if (!sortedAsc.length) return NaN;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.round((p / 100) * (sortedAsc.length - 1))));
  return sortedAsc[idx];
}

export function loadApprovedJpKidsResults(inputPath: string): ApprovedJpKidsResult[] {
  if (!fs.existsSync(inputPath)) return [];
  const raw: unknown = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is ApprovedJpKidsResult =>
    entry && typeof entry === 'object' && 'tierId' in entry && 'lyrics' in entry && (entry as ApprovedJpKidsResult).approved === true
  );
}

/** 순수 함수 — 실제 측정만 하고 아무것도 쓰지 않는다. CLI 출력과 테스트 양쪽에서 재사용. */
export function summarizeCalibration(results: readonly ApprovedJpKidsResult[]): TierCalibrationSummary[] {
  const byTier = new Map<KidsAgeTierId, number[]>();
  for (const result of results) {
    const ratio = measureLyricLanguageRatios(result.lyrics).kanaRatio;
    const list = byTier.get(result.tierId) ?? [];
    list.push(ratio);
    byTier.set(result.tierId, list);
  }

  return (Object.keys(KIDS_AGE_TIERS) as KidsAgeTierId[]).map(tierId => {
    const ratios = (byTier.get(tierId) ?? []).slice().sort((a, b) => a - b);
    const enoughData = ratios.length >= JP_KIDS_KANA_RATIO_MIN_APPROVED_SAMPLES_FOR_CALIBRATION;
    return {
      tierId,
      sampleCount: ratios.length,
      currentFloor: JP_KIDS_KANA_RATIO_MIN_BY_TIER[tierId],
      enoughData,
      ...(enoughData ? { candidateFloorP10: percentile(ratios, 10) } : {})
    };
  });
}

function printReport(inputPath: string, results: ApprovedJpKidsResult[], summaries: TierCalibrationSummary[]) {
  console.log(`[calibrateJpKidsLanguage] 입력 파일: ${inputPath}`);
  console.log(`[calibrateJpKidsLanguage] 승인된(approved: true) 결과: ${results.length}개`);
  console.log(`[calibrateJpKidsLanguage] 캘리브레이션 기준: 연령대별 ${JP_KIDS_KANA_RATIO_MIN_APPROVED_SAMPLES_FOR_CALIBRATION}개 이상\n`);

  for (const summary of summaries) {
    console.log(`${summary.tierId}: 샘플 ${summary.sampleCount}개 / 현재 floor(provisional) ${summary.currentFloor}`);
    if (!summary.enoughData) {
      console.log(`  -> 데이터 부족 (${summary.sampleCount}/${JP_KIDS_KANA_RATIO_MIN_APPROVED_SAMPLES_FOR_CALIBRATION}) — provisional 유지, floor를 바꾸지 않음`);
    } else {
      console.log(`  -> 실측 하위 10퍼센타일: ${summary.candidateFloorP10!.toFixed(3)} (후보값 — core/jpKidsPolicy.ts를 사람이 직접 검토 후 수정)`);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf('--input');
  const inputPath = inputIdx >= 0 ? args[inputIdx + 1] : undefined;
  if (!inputPath) {
    console.error('사용법: npx tsx scripts/calibrateJpKidsLanguage.ts --input <path.json>');
    process.exit(1);
  }
  const results = loadApprovedJpKidsResults(inputPath);
  const summaries = summarizeCalibration(results);
  printReport(inputPath, results, summaries);
}
