import type { DistinctChoiceRuleId, WorkspaceId } from '../types';

/**
 * 지시문 15 (TASK B-1/B-2) — distinctChoice 이행 관문의 워크스페이스별 정책.
 * data/workspaceEraIntent.ts와 같은 패턴이다: 공통 엔진(core/
 * distinctChoiceGate.ts)은 이 정책을 읽기만 하고 archetype을 모른다.
 *
 * "구조는 7개 워크스페이스 공통, 차단 권한은 실측된 곳에만 준다" — 이
 * 프로젝트에서 실전 검증된 워크스페이스는 senior-oldpop 하나뿐이다.
 * verified: false인 6개 워크스페이스는 게이트가 실행되고 위반을 계산은
 * 하지만 절대 blocking하지 않는다(advisory 전용) — 추정 임계값으로 세트를
 * 막으면 몇 달 뒤 그 워크스페이스를 처음 열었을 때 통과 불가능한 관문
 * 벽을 만든다(직전 13커밋이 정확히 그 패턴이었다, 지시문 12 §1-1).
 */
export interface DistinctChoicePolicy {
  /** 이 워크스페이스에서 브릿지가 고를 수 있는 규칙. */
  allowedRuleIds: DistinctChoiceRuleId[];
  /** 세트당 최소 몇 곡이 distinctChoice를 가져야 하는가. */
  minAssignedTracks: number;
  /** lyrics-ast/prompt-only로 검증 가능한 규칙의 최소 이행률. */
  minComplianceRate: number;
  /** not-measured로 처리해도 되는 최대 곡 수. */
  maxNotMeasured: number;
  /** false면 이 정책은 advisory 전용 — 절대 blocking하지 않는다. */
  verified: boolean;
  /** verified로 승격하려면 필요한 실측 곡 수(0 = 이미 verified). */
  promoteAfterMeasuredSongs: number;
  /** 값의 출처. */
  sourceKo: string;
  /** true면 VOCAL_TOGETHER가 혼성 보컬을 지시하는 것 자체가 안전 제약 위반(K-pop 성비 쿼터 보존). */
  sameGenderVocalOnly: boolean;
}

const SENIOR_ALLOWED: DistinctChoiceRuleId[] = ['NO_CHORUS', 'SINGLE_CHORUS', 'VERSE2_HALF_LENGTH', 'FINAL_QUESTION', 'VERSE_TAIL_REPEAT', 'KEY_LIFT', 'NO_INTRO'];

export const DISTINCT_CHOICE_POLICY: Record<WorkspaceId, DistinctChoicePolicy> = {
  'senior-oldpop': {
    allowedRuleIds: SENIOR_ALLOWED,
    minAssignedTracks: 18,
    minComplianceRate: 0.8,
    maxNotMeasured: 4,
    verified: true,
    promoteAfterMeasuredSongs: 0,
    sourceKo: '20260808 팩 18곡 실측 — lyrics-ast 검증 가능 8건 중 위반 5건(T8·T11·T12·T14·T15), 정상 1건(T6), 검증불가 2건(T2·T3)',
    sameGenderVocalOnly: false
  },
  // verified: false 6개 — "값은 넣되 차단하지 않으므로 틀려도 피해가 없다.
  // 첫 실측 때 고치면 된다." (§B-2 "비검증 워크스페이스의 초기값")
  'kr-2030': {
    allowedRuleIds: [...SENIOR_ALLOWED, 'CALL_AND_RESPONSE', 'SCENE_PER_VERSE', 'MODE_SHIFT'],
    minAssignedTracks: 18,
    minComplianceRate: 0.8,
    maxNotMeasured: 4,
    verified: false,
    promoteAfterMeasuredSongs: 18,
    sourceKo: '추정치 — 실측 없음. 첫 세트 측정 후 재조정.',
    sameGenderVocalOnly: false
  },
  'jp-2030': {
    allowedRuleIds: [...SENIOR_ALLOWED, 'CALL_AND_RESPONSE', 'SCENE_PER_VERSE', 'MODE_SHIFT'],
    minAssignedTracks: 18,
    minComplianceRate: 0.8,
    maxNotMeasured: 4,
    verified: false,
    promoteAfterMeasuredSongs: 18,
    sourceKo: '추정치 — 실측 없음. 첫 세트 측정 후 재조정.',
    sameGenderVocalOnly: false
  },
  // 지시문 15 §B-2 "안전 제약" — VOCAL_TOGETHER가 혼성을 지시하면 이 두
  // 워크스페이스의 vocalQuotaOverride(성비 쿼터)를 깬다. sameGenderVocalOnly는
  // verified와 무관하게 core/distinctChoiceGate.ts가 항상 강제한다.
  'kr-idol-male': {
    allowedRuleIds: ['CALL_AND_RESPONSE', 'VOCAL_TOGETHER', 'KEY_LIFT', 'SINGLE_CHORUS', 'WORD_ACCUMULATION'],
    minAssignedTracks: 18,
    minComplianceRate: 0.85,
    maxNotMeasured: 4,
    verified: false,
    promoteAfterMeasuredSongs: 18,
    sourceKo: '추정치 — 실측 없음. 첫 세트 측정 후 재조정.',
    sameGenderVocalOnly: true
  },
  'kr-idol-female': {
    allowedRuleIds: ['CALL_AND_RESPONSE', 'VOCAL_TOGETHER', 'KEY_LIFT', 'SINGLE_CHORUS', 'WORD_ACCUMULATION'],
    minAssignedTracks: 18,
    minComplianceRate: 0.85,
    maxNotMeasured: 4,
    verified: false,
    promoteAfterMeasuredSongs: 18,
    sourceKo: '추정치 — 실측 없음. 첫 세트 측정 후 재조정.',
    sameGenderVocalOnly: true
  },
  'kr-kids': {
    allowedRuleIds: ['CALL_AND_RESPONSE', 'WORD_ACCUMULATION', 'VERSE_TAIL_REPEAT', 'SCENE_PER_VERSE'],
    minAssignedTracks: 18,
    minComplianceRate: 0.9,
    maxNotMeasured: 4,
    verified: false,
    promoteAfterMeasuredSongs: 18,
    sourceKo: '추정치 — 실측 없음. 첫 세트 측정 후 재조정.',
    sameGenderVocalOnly: false
  },
  'jp-kids': {
    allowedRuleIds: ['CALL_AND_RESPONSE', 'WORD_ACCUMULATION', 'VERSE_TAIL_REPEAT', 'SCENE_PER_VERSE'],
    minAssignedTracks: 18,
    minComplianceRate: 0.9,
    maxNotMeasured: 4,
    verified: false,
    promoteAfterMeasuredSongs: 18,
    sourceKo: '추정치 — 실측 없음. 첫 세트 측정 후 재조정.',
    sameGenderVocalOnly: false
  }
};

export function distinctChoicePolicyForWorkspace(workspaceId: WorkspaceId): DistinctChoicePolicy {
  return DISTINCT_CHOICE_POLICY[workspaceId];
}

/**
 * 지시문 15 (TASK B-2 "안전 제약만은 verified 와 무관하게 강제한다") —
 * 추정이 아니라 정책이므로 verified: false 워크스페이스에서도 hard 금지다.
 *   kids     NO_CHORUS·FINAL_QUESTION 금지 — 후렴 반복은 교육 장치,
 *            열린 질문은 결말 안정성을 깬다(지시문 11 TASK B KidsOutcome과 충돌 금지)
 *   K-pop    NO_CHORUS 금지 — 후렴 제거는 장르 정체성 훼손.
 *            VOCAL_TOGETHER는 같은 성별 안에서만(core/distinctChoiceGate.ts가
 *            channel.vocalQuotaOverride와 대조해 별도로 강제 — 여기 목록엔
 *            없다, ruleId 하나로 표현되는 금지가 아니기 때문).
 */
export const DISTINCT_CHOICE_SAFETY_FORBIDDEN: Partial<Record<WorkspaceId, DistinctChoiceRuleId[]>> = {
  'kr-kids': ['NO_CHORUS', 'FINAL_QUESTION'],
  'jp-kids': ['NO_CHORUS', 'FINAL_QUESTION'],
  'kr-idol-male': ['NO_CHORUS'],
  'kr-idol-female': ['NO_CHORUS']
};

export function safetyForbiddenRuleIdsForWorkspace(workspaceId: WorkspaceId): DistinctChoiceRuleId[] {
  return DISTINCT_CHOICE_SAFETY_FORBIDDEN[workspaceId] ?? [];
}
