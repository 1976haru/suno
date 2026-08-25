/**
 * 지시문 11 (TASK E) — "synthetic fixture만 쓰지 않고 실제 발견된 오류를 짧은
 * 익명 fixture로 축적한다. 원문 전체가 아니라 문제 문장과 예상 severity만
 * 저장한다." 이 파일은 그 등록부다 — 각 케이스는 실제로 측정된 결함의
 * 메타데이터(증상·기대 판정·어떤 체커가 검증하는지)만 담고, 원본 가사/
 * stylePrompt 전문은 담지 않는다(재현이 필요하면 tests/fixtures/의 실제
 * 팩 파일을 직접 참조 — 이미 커밋돼 있는 historical/20260807-60s.json·70s.json
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
  },
  // 지시문 17 (TASK C-3) — 20260808 팩 실측 5건. core/semanticCritic.ts의
  // SemanticCritic은 provider-gated이고 실제로 연결된 공급자가 없다
  // (resolveSemanticCritic()가 항상 UnavailableSemanticCritic을 반환) — 그래서
  // 이 5건 전부 status: 'pending-checker'다. "재현 불가능한데 verified라고
  // 속이지 않는다"는 이 파일 자신의 원칙 그대로: 진짜 공급자가 연결되면
  // 이 status를 'verified'로 바꾸고 tests/goldenCases.test.ts에 재현
  // 테스트를 추가한다. 오탐 방지용 반대 케이스(정상 문장 5개)는
  // SEMANTIC_CRITIC_ALLOW_EXAMPLES(이 파일 하단)에 짝지어 등록돼 있다 —
  // 진짜 공급자가 연결됐을 때 이 5건과 함께 검증해야 "좋은 문장까지
  // 고치자고 하지 않는다"를 보장할 수 있다.
  {
    id: 'en-relative-clause',
    severity: 'blocking',
    category: 'en-grammar',
    symptomKo: '"What I was quiet for so long" — 관계사절 구조 오류(파싱은 되나 의미가 성립하지 않음).',
    addedFrom: '지시문 17 §1-2 (20260808 팩 T2 실측)',
    checkerRef: 'src/core/semanticCritic.ts SemanticCritic — provider 미설정, 아직 재현할 실제 체커 없음',
    status: 'pending-checker'
  },
  {
    id: 'en-verb-choice',
    severity: 'blocking',
    category: 'en-grammar',
    symptomKo: '"Someone else insists that\'s not how it got" — got/went 오용(동사 자체는 정상이나 이 문맥에 맞지 않음).',
    addedFrom: '지시문 17 §1-2 (20260808 팩 T16 실측)',
    checkerRef: 'src/core/semanticCritic.ts SemanticCritic — provider 미설정, 아직 재현할 실제 체커 없음',
    status: 'pending-checker'
  },
  {
    id: 'en-article-uncountable',
    severity: 'blocking',
    category: 'en-grammar',
    symptomKo: '"A gold came next, then orange down the walk" — 불가산 명사에 부정관사 오용.',
    addedFrom: '지시문 17 §1-2 (20260808 팩 T17 실측)',
    checkerRef: 'src/core/semanticCritic.ts SemanticCritic — provider 미설정, 아직 재현할 실제 체커 없음',
    status: 'pending-checker'
  },
  {
    id: 'en-preposition',
    severity: 'blocking',
    category: 'en-grammar',
    symptomKo: '"And the whole warm afternoon came pouring on" — 전치사 on/in 오용.',
    addedFrom: '지시문 17 §1-2 (20260808 팩 T18 실측)',
    checkerRef: 'src/core/semanticCritic.ts SemanticCritic — provider 미설정, 아직 재현할 실제 체커 없음',
    status: 'pending-checker'
  },
  {
    id: 'en-intransitive',
    severity: 'blocking',
    category: 'en-grammar',
    symptomKo: '"The whole long winter finally survived" — 자동사/타동사 오용(겨울이 스스로 살아남았다는 뜻이 되어버림).',
    addedFrom: '지시문 17 §1-2 (20260808 팩 T18 실측)',
    checkerRef: 'src/core/semanticCritic.ts SemanticCritic — provider 미설정, 아직 재현할 실제 체커 없음',
    status: 'pending-checker'
  }
];

/**
 * 지시문 17 (TASK C-3) — 위 en-* 5건과 짝지어 등록하는 반대 케이스(오탐
 * 방지). "반대 케이스가 없으면 critic이 좋은 문장까지 고치자고 한다" —
 * 지시문 자신의 경고 그대로, GOLDEN_CASES(결함 전용 레지스트리)와 같은
 * 파일에 두되 별도 배열로 둔다(GoldenCase 타입 자체가 "결함+체커"
 * 모델이라 "이 문장은 정상"이라는 반대 명제를 담을 자리가 없다). 앞의 2개는
 * 이 지시문 §1-3이 "취향이지 오류가 아니다"로 명시적으로 제외한 예시,
 * 뒤의 3개는 §1-1이 "훼손하지 말 것"으로 지목한 실제 20260808 팩 문장이다.
 */
export interface SemanticCriticAllowExample {
  id: string;
  sentence: string;
  reasonKo: string;
  addedFrom: string;
}

export const SEMANTIC_CRITIC_ALLOW_EXAMPLES: SemanticCriticAllowExample[] = [
  {
    id: 'en-idiom-ok',
    sentence: "We've got nowhere to be but gone",
    reasonKo: '로드송 관용구 — 더 자연스러운 대안이 있다는 것과 문법 오류라는 것은 다르다.',
    addedFrom: '지시문 17 §1-3 (20260808 팩 T5)'
  },
  {
    id: 'en-taste-ok-1',
    sentence: 'No Fixed Hour to Arrive',
    reasonKo: '취향의 영역 — 기계로 판정할 문법적 근거가 없다.',
    addedFrom: '지시문 17 §1-3 (20260808 팩 T14 훅)'
  },
  {
    id: 'en-taste-ok-2',
    sentence: "And nowhere left that we've been told",
    reasonKo: '취향의 영역 — 기계로 판정할 문법적 근거가 없다.',
    addedFrom: '지시문 17 §1-3 (20260808 팩 T14)'
  },
  {
    id: 'en-good-1',
    sentence: "You didn't say a thing, just moved your hand",
    reasonKo: '하루가 좋다고 판정한 T4 문장 — 억지 은유가 줄어든 실제 개선 사례.',
    addedFrom: '지시문 17 §1-1 (20260808 팩 T4)'
  },
  {
    id: 'en-good-2',
    sentence: 'An inch across the wood, and let it rest',
    reasonKo: '하루가 좋다고 판정한 T4 문장 — 구체적 동작 묘사.',
    addedFrom: '지시문 17 §1-1 (20260808 팩 T4)'
  }
];
