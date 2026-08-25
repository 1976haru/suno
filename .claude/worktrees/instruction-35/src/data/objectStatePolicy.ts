import type { ObjectStateKind } from '../core/narrativeState';
import type { WorkspaceId } from '../types';

/**
 * 지시문 17 (TASK B-3) — ObjectState의 워크스페이스별 정책. data/
 * distinctChoicePolicy.ts와 같은 패턴이다: 공통 엔진(core/narrativeState.ts)은
 * 이 정책을 읽기만 하고 archetype을 모른다.
 *
 * "구조는 7개 워크스페이스 공통, 차단 권한은 실측된 곳에만 준다"를 이번엔
 * kind 단위로 적용한다 — 지시문 원문은 senior-oldpop의 5개 kind
 * (letter/window/light/door/vehicle) 전부를 "verified: true (T10 실측
 * 근거)"로 묶어 지시했지만, 실측 결과 T10이 실제로 뒷받침하는 건 letter
 * 하나뿐이다(§1-2). 같은 워크스페이스에 배정됐다고 모든 kind가 자동으로
 * blocking 권한을 갖지 않는다 — window/light/door/vehicle은 kinds에는
 * 있지만 verifiedKinds에는 없어 advisory로 남는다.
 */
export interface ObjectStatePolicy {
  /** 이 워크스페이스에서 검사할 kind. */
  kinds: ObjectStateKind[];
  /** kinds의 부분집합 — 실측으로 뒷받침돼 blocking 권한이 있는 kind만. */
  verifiedKinds: ObjectStateKind[];
  sourceKo: string;
}

export const OBJECT_STATE_POLICY: Record<WorkspaceId, ObjectStatePolicy> = {
  'senior-oldpop': {
    kinds: ['letter', 'window', 'light', 'door', 'vehicle'],
    verifiedKinds: ['letter'],
    sourceKo: '20260808 팩 T10 실측(편지: 발송 후 재독 모순) — window/light/door/vehicle은 같은 워크스페이스에 배정됐으나 아직 실측 사례 없음, advisory'
  },
  'kr-2030': {
    kinds: ['message', 'vehicle'],
    verifiedKinds: [],
    sourceKo: '추정치 — 실측 없음. message는 core/relationshipContinuity.ts의 실측 unsent-then-reply를 위임하지만 워크스페이스 자체는 아직 verified가 아니다(§B-2 원칙: kind 실측과 워크스페이스 verified는 별개 축).'
  },
  'jp-2030': {
    kinds: ['message', 'vehicle'],
    verifiedKinds: [],
    sourceKo: '추정치 — 실측 없음.'
  },
  'kr-kids': {
    kinds: ['container', 'door', 'light'],
    verifiedKinds: [],
    // 지시문 11 TASK B KidsOutcome(위험 행동 보상/공포 종결 검사)과 별개 축 —
    // ObjectState는 물리적 소품 모순만 본다, 서사의 안전성 판단과 겹치지 않는다.
    sourceKo: '추정치 — 실측 없음.'
  },
  'jp-kids': {
    kinds: ['container', 'door', 'light'],
    verifiedKinds: [],
    sourceKo: '추정치 — 실측 없음.'
  },
  'kr-idol-male': {
    kinds: [],
    verifiedKinds: [],
    sourceKo: '적용 대상 적음 — 빈 목록 허용(지시문 원문 §B-3).'
  },
  'kr-idol-female': {
    kinds: [],
    verifiedKinds: [],
    sourceKo: '적용 대상 적음 — 빈 목록 허용(지시문 원문 §B-3).'
  }
};

export function objectStatePolicyForWorkspace(workspaceId: WorkspaceId): ObjectStatePolicy {
  return OBJECT_STATE_POLICY[workspaceId];
}
