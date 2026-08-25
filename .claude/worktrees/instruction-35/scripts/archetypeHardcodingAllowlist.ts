/**
 * 지시문 15 TASK D-2 — archetype === '리터럴' 하드코딩 허용 목록.
 * "지금 있는 걸 한 번에 지울 수는 없다. 줄어드는 것을 강제한다." 각 항목에
 * 사유와 제거 예정 지시문 번호를 적는다. allowlist의 총계(count 합)보다
 * 실제 발견 개수가 많으면 check:archetype이 실패한다 — 새로 늘릴 수 없고
 * 줄이는 것만 가능하다.
 *
 * 지시문 15 자신이 만드는 코드(distinctChoiceGate.ts 등)의 하드코딩은 이
 * 목록에 올릴 수 없다 — scripts/checkArchetypeHardcoding.ts가 이 파일에
 * 없는 파일을 발견하면 무조건 실패한다.
 *
 * 실측(지시문 15 착수 시점, scripts/checkArchetypeHardcoding.ts 카운트
 * 방식 — 리터럴 비교가 하나 이상 있는 "줄" 단위): 57곳/13파일. 지시문
 * 원문이 인용한 59곳/13파일과 소폭 다르다 — 원문 실측 이후 코드가
 * 변경됐거나(지시문 12/13 작업) gateDataContract.ts(지시문 12 신규 파일,
 * 원문 실측 시점에는 존재하지 않았음)가 포함됐기 때문이다. 재작업 없이
 * 이 새 실측을 근거로 삼는다.
 *
 * TASK B 완료 후 재실측: 47곳/9파일 (quality.ts/designGate.ts/
 * gateDataContract.ts/vocalPlan.ts/bridgeInstruction.ts 5개 항목,
 * 10곳이 정책 registry로 이전되며 제거됨 — 목표였던 "59→55"를 초과 달성).
 */
export interface ArchetypeHardcodingAllowlistEntry {
  file: string;
  count: number;
  reasonKo: string;
  plannedRemovalIn: string;
}

export const ARCHETYPE_HARDCODING_ALLOWLIST: ArchetypeHardcodingAllowlistEntry[] = [
  {
    file: 'src/core/localGenerator.ts',
    count: 13,
    reasonKo: '로컬 생성 파이프라인 전반에 흩어진 언어/모티프/상황/인트로모드 분기 — 정책 registry로 이전하려면 이 파일의 핵심 조립 로직을 재구조화해야 함, 범위가 큼',
    plannedRemovalIn: '지시문 16'
  },
  {
    file: 'src/data/moneyChords.ts',
    count: 12,
    reasonKo: '데이터 테이블(signatureMoneyChordId/moneyChordRotationPool) — 정책 registry로 이전 예정. 값 자체는 이미 데이터라 워크스페이스 정책 필드로 옮기는 리팩터일 뿐, 이번 지시문 범위 밖',
    plannedRemovalIn: '지시문 16'
  },
  {
    file: 'src/core/releaseReadiness.ts',
    count: 7,
    reasonKo: '발매 준비 판정의 아키타입별 세부 항목(성비 분포 등) — quality.ts와 유사하게 정책화 가능하나 이번 지시문은 quality.ts만 손댐(TASK B가 실제로 건드리는 파일)',
    plannedRemovalIn: '지시문 16'
  },
  {
    file: 'src/core/moneyChordPlan.ts',
    count: 6,
    reasonKo: 'usesMoneyChordQuota의 아키타입 허용목록 — data/moneyChords.ts와 함께 정책 registry로 이전 예정',
    plannedRemovalIn: '지시문 16'
  },
  {
    file: 'src/core/lyricEngine.ts',
    count: 4,
    reasonKo: '언어별 가사 어휘 풀 선택 — 워크스페이스 언어 정책으로 이전 가능하나 범위가 lyricEngine.ts 전체 리팩터와 얽혀 있음',
    plannedRemovalIn: '지시문 16'
  },
  {
    file: 'src/core/lyricMetrics.ts',
    count: 3,
    reasonKo: '한글 비율 최소값의 아키타입별 상수 — 워크스페이스 정책 필드로 이전 가능, 이번 지시문 범위 밖',
    plannedRemovalIn: '지시문 16'
  },
  {
    file: 'src/utils/channelArchetype.ts',
    count: 1,
    reasonKo: 'isKidsArchetype() 자신의 정의 — 이것이 바로 그 "정식 어댑터"다. 다른 모든 파일이 이 함수를 호출해서 하드코딩을 피한다. 정의 자체는 단일 진실 공급원이라 영구 허용',
    plannedRemovalIn: 'N/A — 영구 허용 (정책 registry가 참조하는 정식 정의)'
  },
  {
    file: 'src/core/albumAudit.ts',
    count: 1,
    reasonKo: 'kr-idol-male/female 성비 감사 분기 — releaseReadiness.ts와 같은 성격, 함께 정책화 예정',
    plannedRemovalIn: '지시문 16'
  },
  // 지시문 15 TASK D-3 "우선 제거 대상" 5개(quality.ts/designGate.ts+
  // gateDataContract.ts/vocalPlan.ts/bridgeInstruction.ts) — 착수 시점
  // 실측치(quality.ts 5, designGate.ts 1, gateDataContract.ts 1, vocalPlan.ts
  // 2, bridgeInstruction.ts 1)를 이 세션 안에서 전부 정책 registry로
  // 이전해 제거 완료(TASK B). data/archetypeAudienceProfiles.ts의
  // TITLE_ERA_HINT_RETRO_ARCHETYPES/FIXED_GENRE_MAX_PER_GENRE_ARCHETYPES,
  // data/workspaceQualityPolicies.ts의 CONTENT_CHECKS_POLICY, core/
  // vocalPlan.ts의 IDOL_VOCAL_DESCRIPTIONS_BY_ARCHETYPE로 대체됐다 — 5개
  // 항목이 통째로 빠졌으므로 여기 남기지 않는다(재실측: 47곳/9파일).
];
