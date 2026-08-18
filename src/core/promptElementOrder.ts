import { classifyClause } from '../data/promptAxisLexicon';
import { getGenreById } from '../data/genreLibrary';

/**
 * 지시문 59 — "장르가 첫 자리에 오는가"(지시문 58)와는 다른 축: "장르를 만드는
 * 악기가 어디 있는가". 실측(§1) — 8/13(좋음) 세트는 첫 악기가 중앙값 62자에
 * 등장했는데 8/14(별로) 세트는 220자로 밀렸고, 보컬 서술은 8/13이 2개, 8/14가
 * 5개였다. 이 파일은 그 두 수치를 재는 순수 함수 — core/promptSpec.ts(단일
 * 정규화 관문의 warning)와 core/genreFidelity.ts(check:genre-fidelity 스크립트)
 * 양쪽이 같은 판정 로직을 재사용한다(§공통 규약 "같은 판정 로직을 두 곳에
 * 따로 두지 않는다").
 */

/**
 * §A-5 실측 추정치 — 8/13(좋음) 세트 첫 악기 등장 위치 최소 48·중앙 62·최대
 * 124자, 8/14(별로) 세트 최소 22·중앙 220·최대 305자. 100자는 아직 하루의
 * 청취로 확정된 값이 아니라, 8/13의 최대값(124자)에 가깝게 여유를 둔 잠정
 * 정책 임계값이다(§공통 규약 6 "추정 임계값은 정책 필드로 두고 주석에
 * 명시한다" — 실측으로 조정될 수 있다).
 */
export const INSTRUMENT_POSITION_MAX_CHARS = 100;

/** §A-4/A-5 실측 — 보컬 서술 개수 목표. 8/13(좋음) 2개, 8/14(별로) 5개. */
export const VOCAL_DESCRIPTOR_MIN = 2;
export const VOCAL_DESCRIPTOR_MAX = 3;

/**
 * genre.instruments 중 stylePrompt에 가장 먼저 등장하는 문자 위치. 하나도
 * 못 찾으면 null(측정 불가) — genreFidelity.ts의 기존 ③
 * stylePromptKeepsGenreVocabulary가 "장르 어휘 자체가 없다"는 실패를 이미
 * 별도로 잡으므로, 여기서는 그 실패를 위반으로 이중 집계하지 않는다(§공통
 * 규약 7 "실측 없이 blocking을 만들지 않는다").
 */
export function firstInstrumentPosition(genreId: string | undefined, stylePrompt: string): number | null {
  const genre = genreId ? getGenreById(genreId) : undefined;
  if (!genre?.instruments.length) return null;
  const lower = stylePrompt.toLowerCase();
  let earliest = -1;
  for (const term of genre.instruments) {
    const idx = lower.indexOf(term.trim().toLowerCase());
    if (idx !== -1 && (earliest === -1 || idx < earliest)) earliest = idx;
  }
  return earliest === -1 ? null : earliest;
}

/**
 * 보컬 묘사 클로즈 하나가 시작될 만한 신호. data/vocalTraits.ts의 축 어휘(예:
 * "restrained understated reading")는 성별 단어 없이도 등장할 수 있어 축
 * 사전(classifyClause)만으로는 보컬 블록의 시작점을 못 잡는다 — 성별/음역대
 * 계열 단어가 있으면 그 클로즈를 블록의 시작으로 본다.
 */
const VOCAL_BLOCK_START_PATTERN = /\b(male|female|vocal|voice|falsetto|alto|tenor|soprano|baritone|contralto|mezzo)\b/i;

/**
 * stylePrompt 안에서 보컬 묘사가 몇 개의 콤마절로 이어지는지 센다(§1-3
 * 실측: 8/13은 "low calm male baritone, restrained emotional delivery" 2절
 * 연속, 8/14는 5절 연속). 시작점부터 이어서, classifyClause(단일 관문
 * data/promptAxisLexicon.ts)가 다른 축(악기·화성·구조·인트로 등)으로 분류하는
 * 절을 만나면 블록이 끝난 것으로 본다 — 새 어휘 사전을 따로 만들지 않고
 * 기존 축 분류를 그대로 재사용한다. 시작점을 못 찾으면 null(그 stylePrompt가
 * 보컬 묘사를 아예 안 썼다고 단정할 수 없다 — 측정 불가로 둔다, §공통 규약
 * 7).
 */
/**
 * 지시문 65 (TASK C) — scripts/patchVocalTechnique.ts가 "보컬 구절이 어디서
 * 시작하는가"만 따로 필요로 해서 뽑아낸다(vocalDescriptorClauseCount와 같은
 * 시작점 탐지 로직을 두 곳에 따로 두지 않는다, §공통규약). 콤마절 인덱스를
 * 반환 — 없으면 null(측정 불가, §공통규약 7).
 */
export function vocalBlockStartClauseIndex(clauses: readonly string[]): number | null {
  const startIdx = clauses.findIndex((clause, i) => {
    if (i === 0) return false; // 첫 클로즈는 장르 자리(지시문 58) — 보컬 시작점 후보에서 제외.
    const axis = classifyClause(clause, false);
    if (axis === 'leadVocal') return true;
    if (axis) return false; // 이미 다른 축으로 분류된 절은 보컬 신호가 아니다.
    return VOCAL_BLOCK_START_PATTERN.test(clause);
  });
  return startIdx === -1 ? null : startIdx;
}

export function vocalDescriptorClauseCount(stylePrompt: string): number | null {
  const clauses = stylePrompt.split(',').map(c => c.trim()).filter(Boolean);
  const startIdx = vocalBlockStartClauseIndex(clauses);
  if (startIdx === null) return null;
  let end = startIdx;
  for (let i = startIdx + 1; i < clauses.length; i++) {
    const axis = classifyClause(clauses[i], false);
    if (axis && axis !== 'leadVocal' && axis !== 'backingVocal') break;
    end = i;
  }
  return end - startIdx + 1;
}
