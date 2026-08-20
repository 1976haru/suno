import { SECTION_STYLE_SHIFT_PRESETS } from '../data/sectionStyleShifts';
import { buildStridePlan, repairAdjacentRepeats } from './stridePlan';

const DEFAULT_SECTION_STYLE_SHIFT_IDS = SECTION_STYLE_SHIFT_PRESETS.map(preset => preset.id);

/**
 * 지시문 37 (TASK B) — chorusContrastPlan.ts와 동일한 stride 기반 회전
 * ("검사만 하면 늦다" — 세트 배정 시점에 한 번 결정하고, 슬롯 필드로
 * 브릿지에 그대로 전달한다. moneyChordText/chorusContrastText와 같은
 * 신뢰 모델).
 */
export function buildKpopSectionStyleShiftPlan(songCount: number, seed: number): string[] {
  if (songCount <= 0) return [];
  return repairAdjacentRepeats(buildStridePlan(DEFAULT_SECTION_STYLE_SHIFT_IDS, songCount, Math.abs(seed) % DEFAULT_SECTION_STYLE_SHIFT_IDS.length));
}
