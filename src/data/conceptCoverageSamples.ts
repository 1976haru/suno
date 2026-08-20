/**
 * 지시문 64 (TASK C-2) — check:concept-coverage가 매번 재사용하는 표본
 * 자연어 컨셉 50개. "50개를 문서로 남긴다 — 앞으로 회귀 검사에 쓴다"는
 * 본문 요구대로 데이터 파일로 분리해, 스크립트와 향후 다른 회귀 검사
 * (예: tests/*.test.ts)가 같은 표본을 재사용할 수 있게 한다.
 */
import type { ChannelArchetype } from '../types';

export interface ConceptSample {
  text: string;
  archetype: ChannelArchetype;
}

export const CONCEPT_COVERAGE_SAMPLES: ConceptSample[] = [
  // 시니어 (senior-morning) — 20개
  { text: '퇴근길 버스에서 창밖 보며 듣는 노래', archetype: 'senior-morning' },
  { text: '비 오는 날 카페에서', archetype: 'senior-morning' },
  { text: '첫사랑이 생각나는 밤', archetype: 'senior-morning' },
  { text: '잠들기 전 조용히', archetype: 'senior-morning' },
  { text: '아침 햇살 드는 창가에서', archetype: 'senior-morning' },
  { text: '오래된 사진첩을 넘기며', archetype: 'senior-morning' },
  { text: '혼자 걷는 저녁 산책길', archetype: 'senior-morning' },
  { text: '은퇴하고 나서 듣는 노래', archetype: 'senior-morning' },
  { text: '손주 재롱 보며 웃는 오후', archetype: 'senior-morning' },
  { text: '동창회 다녀온 밤', archetype: 'senior-morning' },
  { text: '텃밭 가꾸는 이른 아침', archetype: 'senior-morning' },
  { text: '라디오 듣던 옛날 생각', archetype: 'senior-morning' },
  { text: '병원 대기실에서 기다리며', archetype: 'senior-morning' },
  { text: '지하철역 계단을 오르며', archetype: 'senior-morning' },
  { text: '골목길 다방에서 커피 한 잔', archetype: 'senior-morning' },
  { text: '설거지하며 흥얼거리는 노래', archetype: 'senior-morning' },
  { text: '해질녘 다리 위에서', archetype: 'senior-morning' },
  { text: '고향집 마당에 앉아서', archetype: 'senior-morning' },
  { text: '결혼기념일 저녁 식탁에서', archetype: 'senior-morning' },
  { text: '주말 아침 늦잠 자고 일어나서', archetype: 'senior-morning' },
  // 2030 (kr-2030-pop) — 10개
  { text: '퇴근길 버스에서 창밖 보며 듣는 노래', archetype: 'kr-2030-pop' },
  { text: '야근하고 막차 타고 집에 가는 길', archetype: 'kr-2030-pop' },
  { text: '원룸에서 혼밥하며 듣는 노래', archetype: 'kr-2030-pop' },
  { text: '서른 앞두고 새벽에 잠 안 올 때', archetype: 'kr-2030-pop' },
  { text: '이직 준비하며 불안한 저녁', archetype: 'kr-2030-pop' },
  { text: '금요일 밤 혼자 마시는 맥주', archetype: 'kr-2030-pop' },
  { text: '싸이월드 감성 드라이브', archetype: 'kr-2030-pop' },
  { text: '월요일 아침 출근길', archetype: 'kr-2030-pop' },
  { text: '헤어지고 혼자 걷는 밤거리', archetype: 'kr-2030-pop' },
  { text: '휴가 가는 날 아침 공항', archetype: 'kr-2030-pop' },
  // K-pop (kr-idol-male) — 10개
  { text: '퇴근길 버스에서 창밖 보며 듣는 노래', archetype: 'kr-idol-male' },
  { text: '무대에 오르기 직전 연습실', archetype: 'kr-idol-male' },
  { text: '데뷔를 앞둔 연습생의 밤', archetype: 'kr-idol-male' },
  { text: '컴백 준비하는 새벽', archetype: 'kr-idol-male' },
  { text: '자신감 넘치는 무대 퍼포먼스', archetype: 'kr-idol-male' },
  { text: '야간 도시를 달리는 드라이브', archetype: 'kr-idol-male' },
  { text: '랩과 힙합이 어울리는 곡', archetype: 'kr-idol-male' },
  { text: '이별 후 무너지는 감정 발라드', archetype: 'kr-idol-male' },
  { text: '한계를 넘는 도전의 순간', archetype: 'kr-idol-male' },
  { text: '레트로 펑크 댄스 무대', archetype: 'kr-idol-male' },
  // 동요 (kr-kids-song) — 10개
  { text: '아침에 일어나서 양치하는 노래', archetype: 'kr-kids-song' },
  { text: '숫자랑 색깔 배우는 노래', archetype: 'kr-kids-song' },
  { text: '동물원에서 동물 소리 흉내내기', archetype: 'kr-kids-song' },
  { text: '병원 놀이 하는 아이들', archetype: 'kr-kids-song' },
  { text: '영어 알파벳 배우는 노래', archetype: 'kr-kids-song' },
  { text: '낮잠 자기 전 자장가', archetype: 'kr-kids-song' },
  { text: '율동하며 따라 부르는 노래', archetype: 'kr-kids-song' },
  { text: '손 씻고 이 닦는 시간', archetype: 'kr-kids-song' },
  { text: '기차랑 버스 소리 흉내내기', archetype: 'kr-kids-song' },
  { text: '놀이터에서 신나게 뛰노는 오후', archetype: 'kr-kids-song' },
  // 지시문 67 (TASK D) — 장르 키워드 표본 20개. "장르 키워드가 시대
  // 키워드를 이긴다"(§본문)의 인수 기준: 각 표본이 매칭하는 axis:'genre'
  // 규칙(conceptKeywords.ts)의 장르군이 recommendConceptLocal 결과의
  // 60% 이상을 차지해야 한다(checkConceptCoverage.ts §④). 대상 id는 모두
  // 해당 archetype의 코어 티어에 실재함을 getCoreGenreIdsForArchetype로
  // 직접 실측 확인했다.
  { text: '70년대 재즈 감성', archetype: 'oldpop-lounge' },
  { text: '70년대 소울 감성', archetype: 'oldpop-lounge' },
  { text: '70년대 R&B 감성', archetype: 'oldpop-lounge' },
  { text: '60년대 두왑', archetype: 'senior-morning' },
  { text: '80년대 발라드', archetype: 'oldpop-lounge' },
  { text: '보사노바 위주로', archetype: 'senior-morning' },
  { text: '모타운 사운드', archetype: 'oldpop-lounge' },
  { text: '필리 소울', archetype: 'oldpop-lounge' },
  { text: '재즈 라운지', archetype: 'senior-morning' },
  { text: '어쿠스틱 포크', archetype: 'senior-morning' },
  { text: '시티팝', archetype: 'showa-cafe' },
  { text: '디스코', archetype: 'oldpop-lounge' },
  { text: '60년대 브리티시 비트', archetype: 'senior-morning' },
  { text: '스무스 재즈', archetype: 'senior-morning' },
  { text: '70년대 소프트록', archetype: 'oldpop-lounge' },
  { text: '가스펠 소울', archetype: 'oldpop-lounge' },
  { text: '샹송', archetype: 'senior-morning' },
  { text: '올드스쿨 R&B', archetype: 'oldpop-lounge' },
  { text: '두왑 하모니', archetype: 'senior-morning' },
  { text: '컨트리 팝', archetype: 'senior-morning' }
];
