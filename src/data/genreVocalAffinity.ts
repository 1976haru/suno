/**
 * 지시문 38 (TASK D2-6, 선택) — 장르별 선호 보컬 프리셋 대응표.
 * data/genreMoneyChordAffinity.ts(지시문 27 TASK B-3)와 완전히 같은
 * 형식·같은 정직성 원칙을 따른다: 순서가 선호 순위(1순위가 먼저)이고,
 * 여기 없는 장르는 아무 가산점도 받지 않는다(호출부의 채널 적합도 필터가
 * 이미 고른 후보 안에서 advisory로 순서만 조정할 뿐, 이 표가 없다고 추천이
 * 막히지 않는다).
 *
 * §9 "정직한 한계"(genreMoneyChordAffinity.ts와 동일) — verified: false다.
 * 하루의 실측 청취로 검증된 값이 아니라 장르 관행(두왑·모타운·브릴빌딩 등
 * 실제 시대 음악 어법)에 근거한 추정이다.
 *
 * TASK D2-3의 채널 하드 필터(core/vocalRecommender.ts's
 * suitablePresetsForArchetype)를 통과한 후보 안에서만 의미가 있다 — 예를
 * 들어 'oldpop-british-beat'의 선호 목록에 있는 'bright-young-male'은
 * oldpop-lounge/senior-morning의 후보 풀에 애초에 없으므로(data/
 * vocalPresets.ts의 매트릭스) 이 아키타입에서는 조용히 아무 효과가 없다 —
 * 억지로 채널 필터를 우회하지 않는다(§D2-6 "채널 필터를 통과한 후보 안에서
 * 순서만 조정한다").
 */

export const GENRE_VOCAL_AFFINITY_VERIFIED = false as const;

export const GENRE_VOCAL_AFFINITY: Record<string, string[]> = {
  // close harmony 계열 — 여러 목소리가 화음을 쌓는 장르라 그룹/듀엣 프리셋이 우선.
  'oldpop-doowop-harmony': ['mixed-harmony-group', 'male-female-duet'],
  // 피아노 발라드 — 잔잔하고 절제된 톤.
  'piano-ballad': ['soft-female', 'low-calm-male'],
  'oldpop-piano-ballad-70s': ['soft-female', 'low-calm-male'],
  // 60년대 브리티시 비트 — 깨끗하고 산뜻한 남성 톤.
  'oldpop-british-beat': ['clear-light-male', 'bright-young-male'],
  // 모타운 팝소울 — 감정을 실어 부르는 소울풀한 여성 리드.
  'oldpop-motown-pop-soul': ['soulful-female'],
  // 걸그룹 월오브사운드 — 여성 리드 우대(감정 실은 소울풀 > 우아한 성숙).
  'oldpop-girl-group-wall': ['soulful-female', 'mature-female']
};

/** 이 장르에 대한 선호 프리셋 id 목록(선호 순) — 없으면 빈 배열(advisory 가산점 없음, 채널 필터 결과 그대로 씀). */
export function vocalAffinityForGenre(genreId: string | undefined): string[] {
  if (!genreId) return [];
  return GENRE_VOCAL_AFFINITY[genreId] ?? [];
}
