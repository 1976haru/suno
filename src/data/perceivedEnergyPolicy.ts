import type { WorkspaceId } from '../types';

/**
 * 지시문 23 (TASK A-4) — PerceivedEnergy 계산 가중치·경계값의 워크스페이스별
 * 정책. data/distinctChoicePolicy.ts와 같은 패턴: 공통 엔진(core/
 * perceivedEnergy.ts)은 이 정책을 읽기만 하고 workspace를 모른다.
 *
 * 이 지시문의 모든 임계값이 verified: false다 — 전부 advisory로 시작한다
 * (§B-2 원문, §D "하지 말 것"). 20260808 팩(senior-oldpop) 손 계산 결과를
 * 출발점으로 삼되, 실제 첫 세트 청취 전까지는 추정치로 남긴다.
 */
export interface PerceivedEnergyPolicy {
  weights: {
    tempo: number;
    rhythm: number;
    instrumentation: number;
    density: number;
    vocal: number;
    production: number;
  };
  /** raw score(-1~+1 근사)를 1~5로 나누는 경계값 4개. */
  thresholds: [number, number, number, number];
  /** tempo 축 정규화 앵커 — 이 BPM 이하는 -1, 이 BPM 이상은 +1로 클램프. */
  tempoAnchorLow: number;
  tempoAnchorHigh: number;
  verified: boolean;
  sourceKo: string;
}

const SENIOR_OLDPOP_POLICY: PerceivedEnergyPolicy = {
  weights: { tempo: 0.30, rhythm: 0.20, instrumentation: 0.15, density: 0.15, vocal: 0.10, production: 0.10 },
  // 실측 재조정: 최초 [-0.6,-0.2,0.2,0.6]은 6축을 동시에 합산한 raw score의
  // 실제 도달 범위(oldpoplounge 실제 생성 팩 실측 -0.56~+0.21, 20260808
  // 재현 -0.24~+0.30 — 6축이 서로 상쇄돼 이론상 한계 -1~+1까지 거의 가지
  // 않는다)보다 훨씬 넓어, 값이 2~4 사이에 몰리고 인접 곡 차이가 3 이상
  // 벌어지는 경우가 실측 0건이었다(TASK C의 급변 감지가 사실상 죽어
  // 있었음). 실제 관측된 raw 범위에 맞춰 버킷 폭을 좁힌다.
  thresholds: [-0.35, -0.12, 0.12, 0.35],
  // 20260808 팩 실측 BPM 범위(62 시니어 tempoFloor ~ 131 실제 최고치, T11)를
  // 감싸는 앵커. §1-1의 손 계산과 같은 방향(BPM이 낮과 높을수록 체감도 따라
  // 움직이되, 장르 어휘가 이를 뒤집을 수 있어야 한다 — 그래서 tempo 가중치가
  // 6축 중 가장 크지만 0.30으로 과반은 아니다).
  tempoAnchorLow: 62,
  tempoAnchorHigh: 130,
  verified: false,
  sourceKo: '추정치 — 20260808 세트 18곡의 어휘 계수 분포(§1-1 손 계산)를 참고한 초기값. 첫 세트 청취 후 조정.'
};

// 지시문 23 §A-4 — "구조는 7개 워크스페이스 공통" 원칙(지시문 15와 동일).
// senior-oldpop 외 6개 워크스페이스는 20260808급 실측이 전혀 없어 같은
// 시작값을 그대로 쓰되, sourceKo로 정직하게 구분한다.
const UNMEASURED_POLICY: PerceivedEnergyPolicy = {
  ...SENIOR_OLDPOP_POLICY,
  sourceKo: '추정치 — 실측 없음(senior-oldpop의 20260808 초기값을 그대로 이식). 첫 세트 측정 후 재조정.'
};

export const PERCEIVED_ENERGY_POLICY: Record<WorkspaceId, PerceivedEnergyPolicy> = {
  'senior-oldpop': SENIOR_OLDPOP_POLICY,
  'kr-2030': UNMEASURED_POLICY,
  'jp-2030': UNMEASURED_POLICY,
  'kr-kids': UNMEASURED_POLICY,
  'jp-kids': UNMEASURED_POLICY,
  'kr-idol-male': UNMEASURED_POLICY,
  'kr-idol-female': UNMEASURED_POLICY
};
