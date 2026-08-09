import type { ListeningIntent, PerceivedEnergy } from '../types';

/**
 * 지시문 23 (TASK B-3) — 3개 preset의 초기값. 전부 provisional(§B "하지 말
 * 것: verified:false인 값으로 세트를 차단하지 말 것 — 이 지시문의 모든
 * 임계값이 verified:false다").
 */
export interface ListeningIntentPolicy {
  intent: ListeningIntent;
  labelKo: string;
  descriptionKo: string;
  /** 0~100. */
  eraColorStrength: number;
  /** 1.0~5.0. */
  targetAverageEnergy: number;
  maxEnergy: PerceivedEnergy;
  /** songCount=18 기준 배분 — 다른 songCount는 core/listeningIntent.ts가 비례 스케일링한다. */
  energyDistribution: Record<PerceivedEnergy, number>;
  /** 시대색 뚜렷한(eraTag 보유) 장르에 배정하는 곡 수 하한 — songCount=18 기준. 상한이 아니다(§B-4). */
  minEraColorTracks: number;
  verified: boolean;
  sourceKo: string;
}

// §B-3 "감성 장시간형의 4단계를 0이 아니라 3곡으로 둔 것이 챗지피티 안과의
// 핵심 차이다" — T13(에너지 최상위)을 하루가 좋아했다는 실측(§1-3)을
// 반영한 값. maxEnergy를 3이 아니라 4로 둔 이유도 같다(§B-4/하지 말 것).
const LONG_LISTEN_COMFORT: ListeningIntentPolicy = {
  intent: 'long-listen-comfort',
  labelKo: '감성 장시간형',
  descriptionKo: '잔잔하고 따뜻하며 오래 듣기 편한 음악',
  eraColorStrength: 30,
  targetAverageEnergy: 2.1,
  maxEnergy: 4,
  energyDistribution: { 1: 3, 2: 8, 3: 4, 4: 3, 5: 0 },
  minEraColorTracks: 3,
  verified: false,
  sourceKo: '추정치 — 챗지피티 제안값을 출발점으로 하되 maxEnergy와 4단계 곡 수는 하루의 T13 청취(§1-3, "비틀즈 느낌이 나서 좋았다")를 반영해 상향. 첫 세트 후 조정.'
};

const BALANCED: ListeningIntentPolicy = {
  intent: 'balanced',
  labelKo: '감성 + 올드팝 균형형',
  descriptionKo: '편안함을 유지하면서 60~70년대 색깔 강화',
  eraColorStrength: 50,
  targetAverageEnergy: 2.5,
  maxEnergy: 4,
  energyDistribution: { 1: 2, 2: 6, 3: 6, 4: 4, 5: 0 },
  minEraColorTracks: 6,
  verified: false,
  sourceKo: '추정치 — 실측 없음. 첫 세트 측정 후 재조정.'
};

// §B-3 "정통 올드팝형 — 현재 형태. 제거하지 않는다" — §0-2 "되돌릴 길을
// 남긴다"의 실제 구현. 상한 없음(energyDistribution 없이 전체 22개 장르
// 풀에서 기존 방식대로 자유 배정).
const ERA_AUTHENTIC: ListeningIntentPolicy = {
  intent: 'era-authentic',
  labelKo: '정통 올드팝형',
  descriptionKo: '시대별 장르·악기·편곡 재현 우선',
  eraColorStrength: 80,
  targetAverageEnergy: 3.0,
  maxEnergy: 5,
  // "제한 없음"(§B-3) — 5단계까지 고르게 허용, 하한만 상징적으로 표시.
  energyDistribution: { 1: 2, 2: 4, 3: 4, 4: 4, 5: 4 },
  minEraColorTracks: 12,
  verified: false,
  sourceKo: '추정치 — 기존(지시문 23 이전) oldpop-lounge-main 배선을 그대로 옮긴 것. 실측은 §1의 20260808 팩 자체(이 preset과 동일한 정통형 배선에서 나온 결과).'
};

export const LISTENING_INTENT_POLICY: Record<ListeningIntent, ListeningIntentPolicy> = {
  'long-listen-comfort': LONG_LISTEN_COMFORT,
  balanced: BALANCED,
  'era-authentic': ERA_AUTHENTIC
};

export const DEFAULT_LISTENING_INTENT: ListeningIntent = 'long-listen-comfort';
