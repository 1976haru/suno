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
  'oldpop-girl-group-wall': ['soulful-female', 'mature-female'],
  // 지시문 46 (TASK C-2) — 재즈 6종. jazz-classic-vocal-lounge/hotel-lounge-jazz는
  // 라운지 스탠더드(성별 균형), swing-crooner-ballroom은 남성 크루너 우세,
  // torch-vocal-jazz는 여성 토치송 리드, brush-ballad-jazz는 균형, soft-vocal-trio는
  // 그룹 편성이 정체성이라 mixed-harmony-group 우선. VOCAL_PREFERENCE_OVERRIDES
  // (genreLibrary/index.ts, 같은 지시문)의 male/female/mixed 가중치와 방향이 같다.
  'jazz-classic-vocal-lounge': ['husky-jazz-female', 'warm-mature-male', 'mature-female'],
  'jazz-hotel-lounge-jazz': ['husky-jazz-female', 'warm-mature-male'],
  'jazz-swing-crooner-ballroom': ['warm-mature-male', 'smoky-jazz-male'],
  'jazz-torch-vocal-jazz': ['husky-jazz-female', 'soulful-female', 'mature-female'],
  'jazz-brush-ballad-jazz': ['soft-female', 'low-calm-male'],
  'jazz-soft-vocal-trio': ['mixed-harmony-group']
};

/**
 * 지시문 46 (TASK C-3) — genreVocalAffinity를 advisory 가산점에서 실제
 * 필터로 강화한다. "산뜻하고 젊은 느낌"(bright-young-*)은 토치송·크루너
 * 같은 재즈 보컬 스타일과 어울리지 않는다는 하루의 지적("재즈에 로리
 * 계열")이 근거다 — verified: false, 장르 관행에 근거한 추정.
 *
 * 실측: senior-morning/oldpop-lounge의 채널 후보 풀(core/vocalRecommender.ts's
 * suitablePresetsForArchetype)은 data/vocalPresets.ts's suitedArchetypes
 * 매트릭스(지시문 38)가 이미 bright-young-*를 포함하지 않아, 이 표는
 * 현재로선 이 두 아키타입에 한해 관측 가능한 효과가 0이다(이미 제외된
 * 것을 다시 제외) — 그래도 향후 채널이 넓어질 때를 대비한 방어적 필터로
 * 남겨 둔다.
 */
export const GENRE_VOCAL_AVOID: Record<string, string[]> = {
  'jazz-torch-vocal-jazz': ['bright-young-female', 'bright-young-male'],
  'jazz-swing-crooner-ballroom': ['bright-young-female', 'bright-young-male'],
  'jazz-classic-vocal-lounge': ['bright-young-female', 'bright-young-male'],
  'jazz-hotel-lounge-jazz': ['bright-young-female', 'bright-young-male']
};

/** 이 장르에 대한 선호 프리셋 id 목록(선호 순) — 없으면 빈 배열(advisory 가산점 없음, 채널 필터 결과 그대로 씀). */
export function vocalAffinityForGenre(genreId: string | undefined): string[] {
  if (!genreId) return [];
  return GENRE_VOCAL_AFFINITY[genreId] ?? [];
}

/** 이 장르에 부적합한 프리셋 id 목록 — 없으면 빈 배열(필터 없음). */
export function vocalAvoidForGenre(genreId: string | undefined): string[] {
  if (!genreId) return [];
  return GENRE_VOCAL_AVOID[genreId] ?? [];
}
