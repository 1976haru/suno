/**
 * 지시문 11 (TASK E) — "synthetic fixture만 쓰지 않고 실제 발견된 오류를 짧은
 * 익명 fixture로 축적한다. 원문 전체가 아니라 문제 문장과 예상 severity만
 * 저장한다." 이 파일은 그 등록부다 — 각 케이스는 실제로 측정된 결함의
 * 메타데이터(증상·기대 판정·어떤 체커가 검증하는지)만 담고, 원본 가사/
 * stylePrompt 전문은 담지 않는다(재현이 필요하면 tests/fixtures/의 실제
 * 팩 파일을 직접 참조 — 이미 커밋돼 있는 realPack60s.json/realPack70s.json
 * 등, 새로 만들지 않음).
 *
 * `status: 'verified'`인 케이스는 tests/goldenCases.test.ts가 실제 체커
 * 함수로 재현해 회귀 잠금한다. `status: 'pending-checker'`는 이 케이스를
 * 검증할 체커가 아직 없다는 뜻(예: 지시문 11 TASK A/B가 만들 예정인
 * relationship continuity / kids outcome 체커) — 정직하게 표시하고, 체커가
 * 생기면 이 필드를 'verified'로 바꾸고 테스트를 추가한다.
 */
export type GoldenCaseSeverity = 'blocking' | 'advisory';

export interface GoldenCase {
  id: string;
  severity: GoldenCaseSeverity;
  category: string;
  /** 증상 한 줄 요약 — 실제 관측된 것만, 지어내지 않는다. */
  symptomKo: string;
  /** 어떤 지시문/TASK에서 처음 실측됐는지 — 추적성. */
  addedFrom: string;
  /** 이 케이스를 실제로 재현·잠금하는 체커/측정 함수. */
  checkerRef: string;
  status: 'verified' | 'pending-checker';
}

export const GOLDEN_CASES: GoldenCase[] = [
  {
    id: 'senior-cross-set-same-song',
    severity: 'blocking',
    category: 'novelty',
    symptomKo: '두 세트(60년대/70년대)의 trackNo 1이 같은 제목·훅·장면·소품·감정 아크로 사실상 같은 곡이었다. 가사 문장 완전일치는 8개뿐(LLM이 문장을 바꿔 씀) — 정확일치 탐지만으로는 안 잡힌다.',
    addedFrom: '지시문 10 TASK B (B-1 실측: listenerSituation 같은 trackNo 중복 14/18, lyricTheme 같은 trackNo 중복 18/18, 제목 완전중복 3개, 훅 완전중복 5개)',
    checkerRef: 'scripts/audit.ts computeCross + src/core/slotPlanOverlap.ts computeSlotPlanOverlap',
    status: 'verified'
  },
  {
    id: 'senior-era-drift',
    severity: 'blocking',
    category: 'era-identity',
    symptomKo: '"60년대" 컨셉 세트의 stylePrompt 18곡 중 10곡이 1970s 단독 텍스트를 claim — 배정된 장르 자체가 시대 이탈이었다(1960s 단독 6곡뿐).',
    addedFrom: '지시문 10 TASK A (A-1 실측)',
    checkerRef: 'src/core/eraIntent.ts checkEraPromptAgainstIntent',
    status: 'verified'
  },
  {
    id: 'senior-exclude-uniform',
    severity: 'blocking',
    category: 'prompt-consistency',
    symptomKo: '실제 18곡 팩의 excludePrompt가 문자 그대로 완전히 동일한 값 1개뿐이었다(1/18 고유) — 곡마다 실제로 충돌 가능한 장르·시대 항목이 전혀 반영되지 않았다.',
    addedFrom: '지시문 10 TASK C (C-1 실측)',
    checkerRef: 'src/core/fullAudit.ts exclude_prompt_unique 항목',
    status: 'verified'
  },
  {
    id: '2030-relation-break',
    severity: 'blocking',
    category: 'relationship-continuity',
    symptomKo: 'kr/jp-2030 세트에서 관계 상태가 섹션 간 모순됐다(예: 문자를 보내지 않은 상태에서 답장을 받거나, 이별한 사이인데 같은 시간선에서 첫 만남을 묘사).',
    addedFrom: '지시문 11 TASK A (챗지피티 지시문 09 TASK 3에서 최초 신고, 코덱스 지시문 03에서 명시적으로 미구현으로 신고됨)',
    checkerRef: 'src/core/relationshipContinuity.ts checkRelationshipContinuity, src/core/quality.ts scoreSong (kr-2030-pop/jp-2030-pop archetype에서 실제로 호출됨)',
    status: 'verified'
  },
  {
    id: 'kids-outcome',
    severity: 'blocking',
    category: 'kids-safety',
    symptomKo: '아이 대상 가사의 서사가 위험한 행동을 보상하거나, 공포·위협 상태로 끝나거나, 안전 규칙 무시를 칭찬하는 방향으로 종결될 위험이 체계적으로 점검되지 않았다.',
    addedFrom: '지시문 11 TASK B (챗지피티 지시문 09 TASK 4에서 최초 신고, 코덱스 지시문 03에서 명시적으로 미구현으로 신고됨)',
    checkerRef: 'src/core/kidsOutcome.ts checkKidsOutcome, src/core/quality.ts scoreSong (kr-kids-song/jp-kids-song archetype에서 실제로 호출됨) — 자동 체크만이며, 지시문이 별도로 요구한 "kr-kids/jp-kids 첫 세트 사람 검수"는 코드로 대체하지 않음(정직하게 별개 항목으로 남김)',
    status: 'verified'
  },
  {
    id: 'kpop-gender-part',
    severity: 'blocking',
    category: 'vocal-consistency',
    symptomKo: 'vocalGender가 duet으로 지정된 곡의 실제 가사 섹션이 전부 같은 vocalist 태그(또는 태그 없음)로 나와, 두 목소리가 실제로는 전혀 분배되지 않았다.',
    addedFrom: '기존 신고 — core/lyricsAst.ts duetPartDistributionIssue의 자체 doc comment(실측 근거)',
    checkerRef: 'src/core/lyricsAst.ts duetPartDistributionIssue',
    status: 'verified'
  },
  {
    id: 'jp-language',
    severity: 'blocking',
    category: 'language-quality',
    symptomKo: 'jp-kids 가사가 해당 연령대의 가나(かな) 비율 하한을 밑돌아 — 한자 위주 표기라 그 연령대 아이가 읽기 어려운 텍스트가 나왔다.',
    addedFrom: '기존 신고 — core/jpKidsPolicy.ts checkJpKidsKanaRatio의 실제 tier별 하한(지시문 11 TASK D가 provisional로 재확인)',
    checkerRef: 'src/core/jpKidsPolicy.ts checkJpKidsKanaRatio',
    status: 'verified'
  }
];
