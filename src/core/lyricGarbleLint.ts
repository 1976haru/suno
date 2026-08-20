/**
 * 지시문 37 (TASK E) — "가져오기 검사에 '가사에 ?? 이상 연속'을 blocking 으로."
 * K-pop 세트 실측(20260810 낮의도시를걷는KPOP, 18곡)에서 가사 541줄 중 71줄
 * (13.1%)이 물음표 연속으로 깨져 있었는데, 가져오기 검사가 이를 전혀 잡지
 * 못해 18곡 전부 통과했다. 근본 원인(LLM 생성 길이 한계인지, 반복 요구로
 * 인한 것인지)은 실측 없이 단정할 수 없어 이 파일은 원인을 고치지 않는다
 * (인코딩 변환 금지 — stylePrompt/titleLocalized 등 다른 필드는 0/18로
 * 멀쩡했으므로 인코딩 문제가 아니다). 여기서는 최소 요구인 검출만 구현한다.
 *
 * 임계값 "물음표 2개 이상 연속"은 지시문 37 본문이 직접 지정한 값이다(추정
 * 아님) — 실측 사례(예: "?? ? ?? ????")가 모두 이 패턴을 포함했다.
 */

const GARBLE_PATTERN = /\?{2,}/;

/** 섹션 태그([Verse 1] 등)는 절대 물음표를 포함하지 않으므로 라인 분리 시 제외할 필요가 없다 — 애초에 매칭되지 않는다. */
export function findGarbledLyricLines(lyrics: string): string[] {
  if (!lyrics) return [];
  return lyrics.split('\n').filter(line => GARBLE_PATTERN.test(line));
}

export function lyricsHaveGarbledLines(lyrics: string): boolean {
  return findGarbledLyricLines(lyrics).length > 0;
}
