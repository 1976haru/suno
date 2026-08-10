import { CHORUS_CONTRAST_PLANS } from '../data/chorusContrast';
import { buildStridePlan, repairAdjacentRepeats } from './stridePlan';

const DEFAULT_CHORUS_CONTRAST_IDS = CHORUS_CONTRAST_PLANS.map(plan => plan.id);

/**
 * 지시문 36 (TASK C-3) — hookDevicePlan.ts와 동일한 stride 기반 회전.
 * "검사만 하면 늦다" — 이 함수가 세트 배정 시점에 한 번 결정하고, 그
 * 결과를 슬롯 필드로 브릿지/로컬 양쪽에 그대로 전달한다(moneyChordText/
 * hookDeviceText와 같은 신뢰 모델).
 */
export function buildChorusContrastPlan(songCount: number, seed: number): string[] {
  if (songCount <= 0) return [];
  return repairAdjacentRepeats(buildStridePlan(DEFAULT_CHORUS_CONTRAST_IDS, songCount, Math.abs(seed) % DEFAULT_CHORUS_CONTRAST_IDS.length));
}
