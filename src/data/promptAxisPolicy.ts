/**
 * 지시문 16 (TASK C) — 7 워크스페이스 공통 원칙(지시문 15 TASK D 준수). 축 인식
 * 병합(core/promptAxisMerge.ts's mergeAtom, data/promptAxisLexicon.ts's
 * classifyClause)은 워크스페이스를 모른다 — 이 파일 안에도, mergeAtom/
 * classifyClause 안에도 archetype 분기가 없다. 워크스페이스별로 다른 것은
 * 여기 정의된 "정책 값"뿐이다.
 *
 * §C-2 검증 상태: senior-oldpop만 실측(20260808 팩 18곡: 인트로 모순 7곡·
 * 리드 중복 5곡·중복 토큰 1곡)을 근거로 verified: true — 위반 시 blocking.
 * 나머지 6개는 게이트는 돌되(관찰용) blocking하지 않고 qualityScore에도
 * 반영하지 않는다(provisional). 단, 리드 보컬 2개 이상/중복 토큰/인트로
 * 축 모순 3종은 verified 여부와 무관하게 항상 blocking — "추정 임계값은
 * advisory, 명백한 오류는 blocking"(지시문 15 §B-2와 동일 구분).
 */
import type { WorkspaceId } from '../types';
import { SINGLE_DECLARATION_AXES, type PromptAxis } from './promptAxisLexicon';

export interface PromptAxisPolicy {
  workspaceId: WorkspaceId;
  /** 이 워크스페이스에서 단일 선언을 강제할 축 — 지금은 7개 워크스페이스 모두 동일(SINGLE_DECLARATION_AXES 그대로): 인트로 모순·리드 중복 같은 축 위반은 워크스페이스와 무관한 구조적 오류이지, 워크스페이스별 취향 차이가 아니다. */
  singleDeclarationAxes: PromptAxis[];
  /**
   * 길이 상한(문자 기준, scripts/audit.ts의 기존 350~650자 감사 기준을 잠정
   * 값으로 사용) — 지시문 16 TASK A-4(하루의 청취 결과로 단위·임계값 확정)
   * 전까지는 확정값이 아니다. A-4가 끝나면 이 필드를 그 결과로 교체한다.
   */
  maxLength: number;
  verified: boolean;
  sourceKo: string;
}

const COMMON_SINGLE_DECLARATION_AXES = [...SINGLE_DECLARATION_AXES];

/** 지시문 16 TASK A-4 확정 전 잠정 상한 — scripts/audit.ts의 기존 prompt_length 감사 기준(350~650자)과 동일. */
const PROVISIONAL_MAX_LENGTH = 650;

export const PROMPT_AXIS_POLICIES: Record<WorkspaceId, PromptAxisPolicy> = {
  'senior-oldpop': {
    workspaceId: 'senior-oldpop',
    singleDeclarationAxes: COMMON_SINGLE_DECLARATION_AXES,
    maxLength: PROVISIONAL_MAX_LENGTH,
    verified: true,
    sourceKo: '20260808_oldpoplounge_60년대가생각하는올드팝명곡.json 18곡 실측 — 인트로 모순 7곡 · 리드 중복 5곡 · 중복 토큰 1곡 (지시문 16 §1)'
  },
  'kr-2030': {
    workspaceId: 'kr-2030',
    singleDeclarationAxes: COMMON_SINGLE_DECLARATION_AXES,
    maxLength: PROVISIONAL_MAX_LENGTH,
    verified: false,
    sourceKo: '미실측 — provisional. 게이트는 돌되 blocking하지 않는다.'
  },
  'jp-2030': {
    workspaceId: 'jp-2030',
    singleDeclarationAxes: COMMON_SINGLE_DECLARATION_AXES,
    maxLength: PROVISIONAL_MAX_LENGTH,
    verified: false,
    sourceKo: '미실측 — provisional. 게이트는 돌되 blocking하지 않는다.'
  },
  'kr-kids': {
    workspaceId: 'kr-kids',
    singleDeclarationAxes: COMMON_SINGLE_DECLARATION_AXES,
    maxLength: PROVISIONAL_MAX_LENGTH,
    verified: false,
    sourceKo: '미실측 — provisional. 게이트는 돌되 blocking하지 않는다.'
  },
  'jp-kids': {
    workspaceId: 'jp-kids',
    singleDeclarationAxes: COMMON_SINGLE_DECLARATION_AXES,
    maxLength: PROVISIONAL_MAX_LENGTH,
    verified: false,
    sourceKo: '미실측 — provisional. 게이트는 돌되 blocking하지 않는다.'
  },
  'kr-idol-male': {
    workspaceId: 'kr-idol-male',
    singleDeclarationAxes: COMMON_SINGLE_DECLARATION_AXES,
    maxLength: PROVISIONAL_MAX_LENGTH,
    verified: false,
    sourceKo: '미실측 — provisional. 게이트는 돌되 blocking하지 않는다.'
  },
  'kr-idol-female': {
    workspaceId: 'kr-idol-female',
    singleDeclarationAxes: COMMON_SINGLE_DECLARATION_AXES,
    maxLength: PROVISIONAL_MAX_LENGTH,
    verified: false,
    sourceKo: '미실측 — provisional. 게이트는 돌되 blocking하지 않는다.'
  }
};

export function promptAxisPolicyFor(workspaceId: WorkspaceId): PromptAxisPolicy {
  return PROMPT_AXIS_POLICIES[workspaceId];
}

/**
 * §C-2 — "리드 보컬 2개 이상 선언 · 중복 토큰 · 인트로 축 상호 모순"은
 * verified 여부와 무관하게 항상 blocking이다(어느 워크스페이스에서도 잘못된
 * 산출이므로 워크스페이스별 검증 상태를 기다릴 이유가 없다). scripts/audit.ts의
 * intro_axis_contradiction/lead_vocal_axis_duplicate/duplicate_token 세
 * 항목이 이 3종에 대응한다 — 이 함수는 그 항목들의 "workspace 검증 상태와
 * 무관하게 항상 심각하다"는 성질을 코드로 표시한다(현재는 audit.ts가 항상
 * 이 3항목을 측정·보고하므로 순수 문서화 함수; 실제 blocking 게이트로 쓰려면
 * 호출부가 이 값을 읽어 판단해야 한다 — 이 지시문은 "새 관문을 만들지 말 것"을
 * 명시했으므로 여기서는 판정 로직만 제공하고 새 차단 지점은 만들지 않는다).
 */
export const ALWAYS_BLOCKING_VIOLATION_IDS = ['intro_axis_contradiction', 'lead_vocal_axis_duplicate', 'duplicate_token'] as const;
