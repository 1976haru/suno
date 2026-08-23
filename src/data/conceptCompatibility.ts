import type { ChannelArchetype } from '../types';
import type { EraBucket } from './eraExclusions';

/**
 * 지시문 32 (§1) — "컨셉×채널 조합 불성립"을 데이터로 명시한다.
 * check:gates가 워크스페이스당 대표 컨셉 3개를 그 워크스페이스에 묶인 모든
 * 채널(아키타입)에 무조건 대입하면서(scripts/checkGateContract.ts) 실제로는
 * 애초에 그 채널이 표현하도록 설계된 적 없는 시대를 요구하는 조합이 섞여
 * 들어갔다 — 예: senior-oldpop 워크스페이스는 archetypeIds에 'lofi-study'/
 * 'modern-chill'/'kids'/'city-night'/'j2000s'까지 묶는데(src/data/workspaces/
 * index.ts:70, [[senior_oldpop_multi_audience]] 참고), 이 채널들은 "60년대
 * 올드팝"류 컨셉을 표현하도록 설계된 적이 없다.
 *
 * supportedEraBuckets/crossStyleEraBuckets는 두 근거로 정했다:
 * 1) 실측 — core/constraints.ts의 eraPrimaryShareOf(채널 preferredGenres를
 *    era-neutral 제외 세밀 시대 버킷으로 실제 분류)를 각 아키타입의 전체
 *    채널 genre 합집합에 돌려 어느 버킷이 0%가 아닌지 확인했다(지시문 32
 *    작업 중 scripts/_tmp_era_probe.ts로 1회성 실측, 결과는 §3/§5 보고에
 *    남긴다).
 * 2) 채널의 실제 정체성 — 실측이 0%라도 그 채널의 기획 의도상 "다른 스타일로
 *    재해석 가능"하면 crossStyleEraBuckets에 넣지 unsupported로 떨어뜨리지
 *    않는다(§ "하지 말 것": city-night + 60년대 올드팝 = 레트로 시티팝은
 *    반드시 cross-style로 남아야 한다).
 *
 * 이 표에 없는 아키타입은 checkConceptCompatibility가 기본 'supported'로
 * 처리한다 — 데이터가 없다고 제약을 지어내지 않는다.
 */
export interface ArchetypeEraCompatibility {
  /** 이 아키타입의 장르 풀이 실측으로 뒷받침하는 주력 시대. */
  supportedEraBuckets: EraBucket[];
  /** 주력 시대는 아니지만 재해석(레트로/오마주)으로 정당하게 선택 가능 — 절대 unsupported로 강등 금지. */
  crossStyleEraBuckets: EraBucket[];
  /** unsupported일 때 사용자에게 보여줄 실제 존재하는 대안 채널 id. */
  suggestedChannelIds: string[];
  sourceKo: string;
}

export const CONCEPT_COMPATIBILITY_BY_ARCHETYPE: Partial<Record<ChannelArchetype, ArchetypeEraCompatibility>> = {
  'senior-morning': {
    supportedEraBuckets: ['1950s-60s', '1970s', '1980s'],
    crossStyleEraBuckets: ['timeless'],
    suggestedChannelIds: [],
    sourceKo: '실측 genre 풀 1950s-60s 77%·1970s 14%·1980s 9% — 시니어 올드팝의 핵심 시대 범위'
  },
  'oldpop-lounge': {
    supportedEraBuckets: ['1950s-60s', '1970s', '1980s'],
    crossStyleEraBuckets: ['timeless'],
    suggestedChannelIds: [],
    sourceKo: '실측 genre 풀 1950s-60s 63%·1970s 19%·1980s 19% — senior-morning과 같은 올드팝 라운지 계열'
  },
  'showa-cafe': {
    supportedEraBuckets: ['1970s'],
    crossStyleEraBuckets: ['1950s-60s', '1980s'],
    suggestedChannelIds: ['good-morning-memory-radio', 'showa-seventies'],
    sourceKo: '실측 genre 풀 1970s 100% — 쇼와 다방 감성의 주력 연대는 70년대지만, 같은 쇼와/올드팝 계열 인접 연대(60·80년대)는 "이른 쇼와"/"후기 쇼와" 재해석으로 선택 가능'
  },
  'showa-70s': {
    supportedEraBuckets: ['1970s'],
    crossStyleEraBuckets: ['1950s-60s', '1980s'],
    suggestedChannelIds: ['morning-showa-cafe', 'good-morning-memory-radio'],
    sourceKo: '실측 genre 풀 1970s 100% — showa-cafe와 동일 계열, 70년대가 유일한 실측 주력 시대'
  },
  'j2000s': {
    supportedEraBuckets: ['2000s'],
    crossStyleEraBuckets: ['1980s'],
    suggestedChannelIds: ['morning-showa-cafe', 'showa-seventies'],
    sourceKo: '실측 genre 풀 2000s 100%, 1950s-60s/1970s 0% — 밀레니엄 J-pop(Y2K)은 쇼와 올드팝과 장르 계보가 다른 채널. 80년대 시티팝은 2000s 리바이벌과 정서적으로 인접해 cross-style, 60·70년대 서구/한국 올드팝은 이 채널의 장르 데이터로 표현할 근거가 전혀 없음'
  },
  'modern-chill': {
    supportedEraBuckets: [],
    crossStyleEraBuckets: [],
    suggestedChannelIds: ['morning-showa-cafe', 'showa-seventies', 'good-morning-memory-radio'],
    sourceKo: '실측 genre 풀이 사실상 전부 era-neutral(로파이/칠아웃) — 특정 연대를 주장하지 않는 채널 정체성 자체가 목적이라 시대 컨셉과 근본적으로 불성립'
  },
  'lofi-study': {
    supportedEraBuckets: [],
    crossStyleEraBuckets: [],
    suggestedChannelIds: ['morning-showa-cafe', 'showa-seventies', 'good-morning-memory-radio'],
    sourceKo: '지시문 31 신설 채널(글로벌/영어/20대) — 시니어 올드팝 워크스페이스에 archetypeIds로만 묶여 있을 뿐 실제로는 완전히 다른 청자층. 실측 genre 풀도 era-neutral 100%'
  },
  'city-night': {
    supportedEraBuckets: [],
    crossStyleEraBuckets: ['1950s-60s', '1970s'],
    suggestedChannelIds: [],
    sourceKo: '실측 genre 풀은 generic(모던 시티팝) 91% — 자체 주력 시대는 없지만, 60·70년대 올드팝 컨셉은 "레트로 시티팝" 재해석으로 이 채널에서 정당하게 선택 가능한 컨셉(지시문 32 명시 사례) — 절대 unsupported로 떨어뜨리지 않는다'
  },
  'kids': {
    supportedEraBuckets: [],
    crossStyleEraBuckets: [],
    suggestedChannelIds: ['good-morning-memory-radio', 'morning-showa-cafe'],
    sourceKo: '동요 채널 — 시니어 올드팝 워크스페이스에 묶여 있을 뿐 청자층과 장르 정체성이 완전히 다름. 실측 genre 풀 era-neutral 100%'
  },
  christmas: {
    supportedEraBuckets: ['timeless'],
    crossStyleEraBuckets: ['1950s-60s', '1970s'],
    suggestedChannelIds: [],
    sourceKo: '현재 활성 채널 프리셋 없음(타입에만 존재) — 크리스마스 스탠다드는 관습적으로 1950-70년대 클래식과 강하게 겹쳐 cross-style로 열어 둠'
  },
  // 지시문 71 (TASK A) — check:gates(scripts/checkGateContract.ts)가 32개
  // 채널 전부에 시니어/동요 등 다른 워크스페이스의 대표 컨셉("60년대
  // 올드팝" 등)을 대입하면서 en-chillhop의 3개 채널도 실측(0% CONTRACT
  // VIOLATION)에 걸렸다 — lofi-study/modern-chill/kids와 같은 이유
  // (§30-32 "그 채널이 표현하도록 설계된 적 없는 시대"). en-chillhop 자신은
  // 시대 정체성이 없는 워크스페이스(WORKSPACE_ERA_INTENT의
  // 'current-implied')이므로 전부 unsupported.
  // 지시문 73 (TASK C) — 실측: supported/crossStyleEraBuckets가 둘 다
  // 빈 배열이라 "비어 있다"고 보고됐으나(§1.3), modern-chill/lofi-study의
  // 기입 방식(바로 위)과 대조한 결과 이게 정확히 같은 형식 — 시대(decade)
  // 정체성이 없는 워크스페이스는 원래 둘 다 빈 배열이 맞는 값이다("기입
  // 안 됨"이 아니라 "이 워크스페이스는 어떤 연대도 지원하지 않는다"는
  // 값 자체). 이 파일이 판정하는 축(1950s-60s/1970s/1980s/2000s/timeless
  // 같은 EraBucket)은 core/setDirector.ts의 랩/하우스 BPM 대역 잠금(지시문
  // 71 TASK E)과 전혀 다른 축이다 — 이 파일과 checkConceptCompatibility의
  // 실제 소비처는 scripts/checkGateContract.ts와 checkWorkspaceRegistration.ts
  // 뿐이고(grep 확인), BPM 대역 로직 어디에서도 이 데이터를 읽지 않는다.
  // 즉 "두 대역을 자유롭게 섞도록 기입"할 여지 자체가 이 파일에 없다 —
  // 값을 바꾸지 않고 이 사실을 주석으로 명시한다.
  'en-chillhop': {
    supportedEraBuckets: [],
    crossStyleEraBuckets: [],
    suggestedChannelIds: ['good-morning-memory-radio', 'morning-showa-cafe', 'showa-seventies'],
    sourceKo: '지시문 71 신설 워크스페이스(글로벌/영어/20대, 칠랩·힙합·딥하우스) — 실측 genre 풀도 era-neutral/2010s-2020s 100%, 특정 연대를 주장하지 않는 채널 정체성. supported/crossStyle 둘 다 빈 배열이 정확한 값이며(modern-chill/lofi-study와 동일 패턴), 랩/하우스 BPM 대역 분리(지시문 71 TASK E)와는 무관한 축이다.'
  }
};
