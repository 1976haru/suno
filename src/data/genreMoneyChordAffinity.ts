/**
 * 지시문 27 (TASK B-3) — 장르별 선호 머니코드 진행 대응표. "같은 곡의 장르와
 * 진행이 서로 맞아야 한다"(§B-3) — moneyChordPlan.ts's
 * buildGenreAwareProgressionPlan이 이 데이터를 읽어 각 트랙의 실제 장르에
 * 맞는 진행을 우선 배정한다. 코드 조건문으로 흩뿌리지 않고 데이터로 둔다
 * (§하지 말 것).
 *
 * 순서가 선호 순위다 — 첫 번째가 1순위. 여기 없는 장르는 아키타입 회전
 * 풀에서 균등 배정한다(buildGenreAwareProgressionPlan 자체의 폴백 로직).
 *
 * §9 "정직한 한계" — 이 대응은 verified: false다. 하루의 실측 청취로
 * 검증된 값이 아니라 장르 관행(두왑·브릴빌딩·모타운 등 실제 시대 음악
 * 어법)에 근거한 추정이다.
 */

export const GENRE_MONEY_CHORD_VERIFIED = false as const;

export const GENRE_MONEY_CHORD_AFFINITY: Record<string, string[]> = {
  'oldpop-doowop-harmony': ['doowop', 'default'],
  'oldpop-girl-group-wall': ['doowop', 'emotional'],
  'oldpop-brill-building': ['popStandard', 'doowop'],
  'oldpop-sunshine-pop': ['canon', 'default'],
  'oldpop-british-beat': ['default', 'popStandard'],
  'oldpop-soft-rock-am': ['default', 'warmCycle'],
  'oldpop-piano-ballad-70s': ['emotional', 'winterBallad'],
  'piano-ballad': ['emotional', 'winterBallad'],
  'oldpop-motown-pop-soul': ['doowop', 'warmCycle'],
  'healing-ballad': ['emotional', 'warmCycle'],
  'chanson': ['jazzColor', 'popStandard'],
  'oldpop-philly-soul-sweet': ['jazzColor', 'warmCycle']
};

/** 이 장르에 대한 선호 진행 목록(선호 순) — 없으면 빈 배열(호출부가 회전 풀 폴백으로 처리). */
export function moneyChordAffinityForGenre(genreId: string | undefined): string[] {
  if (!genreId) return [];
  return GENRE_MONEY_CHORD_AFFINITY[genreId] ?? [];
}
