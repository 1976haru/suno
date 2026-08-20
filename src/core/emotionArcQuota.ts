import { emotionArcs, emotionArcsBrightOpening, emotionArcsBrightToWistful, emotionArcsCalmThroughout, emotionArcsStrongLift } from './localGenerator';
import { emotionQuotaPolicyForWorkspace, type EmotionQuotaCategory } from '../data/emotionQuotaPolicy';
import { scaleQuotaToSongCount } from './quotaScaling';
import type { WorkspaceId } from '../types';

/** data/emotionQuotaPolicy.ts의 EmotionQuotaEntry.targetCount가 튜닝된 기준 곡 수. */
const EMOTION_QUOTA_BASE_SONG_COUNT = 18;

/**
 * 지시문 36 (TASK B) — core/localGenerator.ts의 실제 emotionArc 문구 12종을
 * data/emotionQuotaPolicy.ts의 7개 카테고리로 손으로 분류한 것. 이 매핑은
 * 실측이 아니라 문구 자체를 읽고 판단한 것(추정) — 세 카테고리(따뜻한 사랑·
 * 장난/유머·가벼운 설렘)는 오늘 배정 가능한 문구가 하나도 없다는 것이 이
 * 파일의 핵심 실측 결과다(§B-4 "18곡 감정 분포 기준 7종 이상, 현재 3~4종").
 */
export const EMOTION_CATEGORY_BY_ARC_TEXT: Record<string, EmotionQuotaCategory> = {
  'lonely memory to warm acceptance': 'calm-comfort',
  'quiet longing to calm gratitude': 'calm-comfort',
  'small sadness to steady comfort': 'calm-comfort',
  'old regret to peaceful closure': 'calm-comfort',
  'steady peace held gently, start to end': 'calm-comfort',
  'quiet contentment resting undisturbed throughout': 'calm-comfort',
  'soft nostalgia to renewed hope': 'anticipation-discovery',
  'quiet longing swelling into overwhelming feeling': 'anticipation-discovery',
  'warm reunion feeling lifting into brighter delight': 'pleasant-energy',
  'held-back yearning bursting into radiant relief': 'pleasant-energy',
  'joyful memory blooming into bigger joy': 'pleasant-energy',
  'bittersweet reflection to gentle lift': 'wistfulness',
  'joyful moment fading into tender wistfulness': 'wistfulness',
  'bright laughter softening into a quiet farewell': 'wistfulness'
};

// 실측 확인용 — EMOTION_CATEGORY_BY_ARC_TEXT가 실제 풀 전체(12종, 5개 export
// 배열의 합집합)를 빠짐없이 덮는지 모듈 로드 시점에 스스로 검사한다. 새
// emotionArc 문구가 추가되고 이 매핑이 갱신되지 않으면 즉시 콘솔 경고로
// 드러난다 — 조용히 'calm-comfort' 기본값으로 오분류되는 것보다 낫다.
const ALL_KNOWN_ARC_TEXTS = [
  ...emotionArcs, ...emotionArcsBrightOpening, ...emotionArcsStrongLift,
  ...emotionArcsCalmThroughout, ...emotionArcsBrightToWistful
];
const UNMAPPED_ARC_TEXTS = ALL_KNOWN_ARC_TEXTS.filter(text => !(text in EMOTION_CATEGORY_BY_ARC_TEXT));
if (UNMAPPED_ARC_TEXTS.length > 0) {
  console.warn(`[emotionArcQuota] EMOTION_CATEGORY_BY_ARC_TEXT is missing ${UNMAPPED_ARC_TEXTS.length} emotionArc text(s): ${UNMAPPED_ARC_TEXTS.join(' | ')}`);
}

export function emotionCategoryForArcText(text: string | undefined): EmotionQuotaCategory | undefined {
  if (!text) return undefined;
  return EMOTION_CATEGORY_BY_ARC_TEXT[text];
}

export interface EmotionQuotaDistribution {
  byCategory: Partial<Record<EmotionQuotaCategory, number>>;
  /** 7개 카테고리 중 실제로 1곡 이상 배정된 카테고리 수. */
  coveredCategoryCount: number;
  /** 분류 실패(매핑에 없는 새 문구 등)로 카테고리를 못 정한 곡 수. */
  unclassifiedCount: number;
}

export function measureEmotionQuotaDistribution(emotionArcTexts: readonly (string | undefined)[]): EmotionQuotaDistribution {
  const byCategory: Partial<Record<EmotionQuotaCategory, number>> = {};
  let unclassifiedCount = 0;
  for (const text of emotionArcTexts) {
    const category = emotionCategoryForArcText(text);
    if (!category) {
      unclassifiedCount += 1;
      continue;
    }
    byCategory[category] = (byCategory[category] ?? 0) + 1;
  }
  return { byCategory, coveredCategoryCount: Object.keys(byCategory).length, unclassifiedCount };
}

export interface EmotionQuotaAdvisoryFinding {
  id: string;
  labelKo: string;
  expected: string;
  actual: string;
  fixHintKo: string;
}

/**
 * 지시문 36 (TASK B) — core/designGate.ts의 advisory(non-blocking) 배열용.
 * "verified:false가 blocking 0건"(§B-4)을 코드로 보장한다 — 이 함수는
 * DesignIssue를 blocking 배열에 넣지 않고, 호출부(designGate.ts)도 advisory
 * 배열에만 스프레드한다.
 */
export function emotionQuotaAdvisory(
  workspaceId: WorkspaceId,
  emotionArcTexts: readonly (string | undefined)[],
  /** 지시문 38 (TASK A-3) — targetCount가 18곡 기준이라, 다른 곡 수 세트에서 "목표 5" 같은 그릇된 숫자를 보여주지 않도록 실제 세트 곡 수로 비례 환산한다. 생략 시(기존 호출부) 18로 취급 — 동작 변화 없음. */
  songCount: number = EMOTION_QUOTA_BASE_SONG_COUNT
): EmotionQuotaAdvisoryFinding[] {
  const policy = emotionQuotaPolicyForWorkspace(workspaceId);
  if (!policy) return [];
  const distribution = measureEmotionQuotaDistribution(emotionArcTexts);
  const coveredEnough = distribution.coveredCategoryCount >= 7;
  if (coveredEnough) return [];
  const baseTargets = Object.fromEntries(policy.entries.map(entry => [entry.category, entry.targetCount]));
  const scaledTargets = scaleQuotaToSongCount(baseTargets, EMOTION_QUOTA_BASE_SONG_COUNT, songCount);
  const perCategoryKo = policy.entries
    .map(entry => `${entry.labelKo} ${distribution.byCategory[entry.category] ?? 0}곡(목표 ${scaledTargets[entry.category]})`)
    .join(' · ');
  return [{
    id: 'emotion-quota-distribution',
    labelKo: `${songCount}곡 감정 분포 (advisory, 추정치)`,
    expected: `7개 카테고리 모두 1곡 이상 (정책 근거: ${policy.sourceKo})`,
    actual: `${distribution.coveredCategoryCount}/7종 커버 — ${perCategoryKo}`,
    fixHintKo: '평온/위로 계열에 쏠려 있다면 밝고 경쾌한 장면·테마를 섞는 것을 고려해보세요 — 검증된 값은 아닙니다(하루 청취 후 조정 예정).'
  }];
}
