import type { WorkspaceId } from '../types';

/**
 * 지시문 36 (TASK B) — 하루의 관찰: senior-oldpop 18곡의 감정 엔드포인트가
 * 거의 전부 평온/위로/감사/정적/안도로 수렴한다 — 곡마다 다른 노래인데도
 * 같은 감정적 "속도"로 흐른다. "60~70년대 팝에 밝고 경쾌한 노래가 자연스럽다"
 * (하루) — 시니어가 항상 회상/그리움일 필요는 없다.
 *
 * 이 정책은 챗지피티 제안값(verified:false)이다. 처음부터 advisory 전용으로
 * 시작한다(§B "하지 말 것: 이 값으로 세트를 막지 말 것") — 실제 분포를
 * 세도록만 core/emotionArcQuota.ts에서 쓰인다. 쓸쓸함(wistfulness) 최소
 * 1곡은 유지한다(§ "하지 말 것: 쓸쓸함을 0으로 만들지 말 것") — 기존
 * emotionArcsBrightToWistful의 "최대 1곡" 상한(localGenerator.ts)과 만나는
 * 지점이라 하한도 명시해 둔다.
 *
 * 현재 실제 emotionArc 문구 풀(core/localGenerator.ts의 emotionArcs 등
 * 12종)은 이 7개 카테고리 중 4종(평온/위로·기분 좋은 활기·기대/발견·
 * 쓸쓸함)만 실제로 커버한다 — 따뜻한 사랑/장난 유머/가벼운 설렘 3종은
 * 오늘 배정 가능한 문구가 하나도 없다(core/emotionArcQuota.ts의
 * EMOTION_CATEGORY_BY_ARC_TEXT 참고). 이 간극을 메우는 일(지시문 14 TASK B의
 * 110종 테마 확장)은 이 지시문의 범위 밖이다(§B-3) — 여기서는 정책과 실측
 * 가시화까지만 한다.
 */
export type EmotionQuotaCategory =
  | 'calm-comfort' | 'light-excitement' | 'pleasant-energy'
  | 'warm-love' | 'playful-humor' | 'anticipation-discovery' | 'wistfulness';

export interface EmotionQuotaEntry {
  category: EmotionQuotaCategory;
  labelKo: string;
  /** 18곡 기준 목표 곡수 — 추정치, 검증 아님. */
  targetCount: number;
}

export interface EmotionArcQuotaPolicy {
  entries: EmotionQuotaEntry[];
  verified: boolean;
  sourceKo: string;
}

export const SENIOR_OLDPOP_EMOTION_QUOTA: EmotionArcQuotaPolicy = {
  entries: [
    { category: 'calm-comfort', labelKo: '평온/위로', targetCount: 5 },
    { category: 'light-excitement', labelKo: '가벼운 설렘', targetCount: 3 },
    { category: 'pleasant-energy', labelKo: '기분 좋은 활기', targetCount: 3 },
    { category: 'warm-love', labelKo: '따뜻한 사랑', targetCount: 2 },
    { category: 'playful-humor', labelKo: '장난/유머', targetCount: 2 },
    { category: 'anticipation-discovery', labelKo: '기대/발견', targetCount: 2 },
    { category: 'wistfulness', labelKo: '쓸쓸함', targetCount: 1 }
  ],
  verified: false,
  sourceKo: '추정치 — 챗지피티 제안값. "60~70년대 팝에 밝고 경쾌한 노래가 자연스럽다"는 하루의 관찰(지시문 36 §0)을 반영해 calm-comfort 외 6개 카테고리를 명시했다. 하루가 실제 세트를 들어본 뒤 조정될 수 있다.'
};

/** 지시문 36 §B — 현재는 senior-oldpop에만 실측 근거가 있다(§0의 관찰이 이 워크스페이스 한정). 다른 워크스페이스는 정책 없음(undefined = 검사 대상 아님). */
export const EMOTION_QUOTA_POLICY: Partial<Record<WorkspaceId, EmotionArcQuotaPolicy>> = {
  'senior-oldpop': SENIOR_OLDPOP_EMOTION_QUOTA
};

export function emotionQuotaPolicyForWorkspace(id: WorkspaceId): EmotionArcQuotaPolicy | undefined {
  return EMOTION_QUOTA_POLICY[id];
}

/** 지시문 36 §B "하지 말 것: 쓸쓸함을 0으로 만들지 말 것" — wistfulness 하한, 정책과 별개로 코드에서 참조하는 값이라 상수로 분리. */
export const WISTFULNESS_MIN_COUNT = 1;
