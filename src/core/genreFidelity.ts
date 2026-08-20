import { auditStylePromptAgainstSpec } from './promptSpec';
import { getGenreById } from '../data/genreLibrary';
import {
  firstInstrumentPosition,
  vocalDescriptorClauseCount,
  INSTRUMENT_POSITION_MAX_CHARS,
  VOCAL_DESCRIPTOR_MIN,
  VOCAL_DESCRIPTOR_MAX
} from './promptElementOrder';

/**
 * 지시문 58 (TASK D) — "같은 회귀가 반복되지 않게 한다" — 지시문 44가 확인만
 * 하고 회귀 검사를 안 만들어 지시문 46 이후 다시 깨진 것과 같은 유형을
 * 막는다. core/fullAudit.ts(npm run audit)의 genre_opens_prompt/
 * genre_core_vocabulary 항목과 scripts/checkGenreFidelity.ts(npm run
 * check:genre-fidelity) 둘 다 이 파일의 순수 함수를 그대로 재사용한다 —
 * 판정 로직을 두 곳에 따로 두지 않는다.
 *
 * 지시문 59 (TASK D) — "장르가 첫 자리인가"(58)와 다른 축인 "악기가 어디
 * 있는가"를 더한다. ④ stylePromptInstrumentPositionOk(첫 악기 등장이
 * 100자 이내인가)·⑤ stylePromptVocalDescriptorCountOk(보컬 서술이 2~3개인가)
 * — 둘 다 core/promptElementOrder.ts의 순수 함수를 그대로 재사용한다(같은
 * 이유로 판정 로직을 두 곳에 두지 않는다). core/finalPromptNormalizer.ts의
 * 단일 정규화 관문도 같은 promptElementOrder.ts 함수를 직접 불러 warning을
 * 남긴다(§공통 규약 7 — auditStylePromptAgainstSpec 자체에는 넣지 않았다,
 * finalPromptNormalizer.ts 자기 doc comment 참고).
 */

export interface GenreFidelitySong {
  trackNo: number;
  genreId?: string;
  stylePrompt: string;
}

/** ① stylePrompt가 장르 정체성으로 시작하는가. core/promptSpec.ts의 'genre' finding(지시문 58 TASK A, finalPromptNormalizer.ts의 enforceGenreOpensPrompt와 같은 REQUIRED_AXES_BY_POSITION 기반 판정)을 그대로 재사용한다. */
export function stylePromptOpensWithGenre(stylePrompt: string): boolean {
  return !auditStylePromptAgainstSpec(stylePrompt, { vocal: { gender: undefined, text: '' } }).some(v => v.field === 'genre');
}

/**
 * ③ 장르의 핵심 악기·리듬이 stylePrompt에 남아있는가 — genre.instruments 중
 * 1개 이상, genre.rhythm 중 1개 이상(둘 다 만족해야 통과). genreId가 없거나
 * 라이브러리에서 못 찾으면 null(검증 불가 — 위반으로 세지 않는다, §공통
 * 규약 7).
 */
export function stylePromptKeepsGenreVocabulary(genreId: string | undefined, stylePrompt: string): boolean | null {
  const genre = genreId ? getGenreById(genreId) : undefined;
  if (!genre) return null;
  const lower = stylePrompt.toLowerCase();
  const hasInstrument = !genre.instruments.length || genre.instruments.some(term => lower.includes(term.toLowerCase()));
  const hasRhythm = !genre.rhythm?.length || genre.rhythm.some(term => lower.includes(term.toLowerCase()));
  return hasInstrument && hasRhythm;
}

/** ② 장르 배분이 균등한가 — 최대 곡수 40% 이하(15곡 기준 6곡), 1곡짜리 장르 0개. genreId 없는 곡은 집계에서 제외. */
export interface GenreDistributionReport {
  counts: Record<string, number>;
  maxCount: number;
  maxShare: number;
  maxAllowed: number;
  singletons: string[];
  withinMax: boolean;
  noSingletons: boolean;
}

const MAX_GENRE_SHARE = 0.4;

export function checkGenreDistribution(songs: readonly GenreFidelitySong[]): GenreDistributionReport {
  const counts: Record<string, number> = {};
  let counted = 0;
  for (const song of songs) {
    if (!song.genreId) continue;
    counts[song.genreId] = (counts[song.genreId] ?? 0) + 1;
    counted += 1;
  }
  const values = Object.values(counts);
  const maxCount = values.length ? Math.max(...values) : 0;
  const maxAllowed = Math.max(1, Math.floor(counted * MAX_GENRE_SHARE));
  const singletons = Object.entries(counts).filter(([, count]) => count === 1).map(([id]) => id);
  return {
    counts,
    maxCount,
    maxShare: counted ? maxCount / counted : 0,
    maxAllowed,
    singletons,
    withinMax: maxCount <= maxAllowed,
    noSingletons: singletons.length === 0
  };
}

/**
 * ④ 지시문 59 (TASK D) — 장르 핵심 악기의 첫 등장이 정책 임계값
 * (INSTRUMENT_POSITION_MAX_CHARS, core/promptElementOrder.ts 참고, 잠정) 이내에
 * 오는가. genreId가 없거나 악기를 하나도 못 찾으면 null(측정 불가 — ③
 * stylePromptKeepsGenreVocabulary가 그 실패를 이미 별도로 잡는다, §공통 규약
 * 7).
 */
export function stylePromptInstrumentPositionOk(genreId: string | undefined, stylePrompt: string): boolean | null {
  const position = firstInstrumentPosition(genreId, stylePrompt);
  return position === null ? null : position <= INSTRUMENT_POSITION_MAX_CHARS;
}

/**
 * ⑤ 지시문 59 (TASK D) — 보컬 서술 클로즈 개수가 정책 범위
 * (VOCAL_DESCRIPTOR_MIN~MAX, core/promptElementOrder.ts 참고, 잠정) 안에
 * 드는가. 시작점을 못 찾으면 null(측정 불가).
 */
export function stylePromptVocalDescriptorCountOk(stylePrompt: string): boolean | null {
  const count = vocalDescriptorClauseCount(stylePrompt);
  return count === null ? null : count >= VOCAL_DESCRIPTOR_MIN && count <= VOCAL_DESCRIPTOR_MAX;
}

export interface GenreFidelityReport {
  songCount: number;
  opensWithGenre: { pass: number; total: number; failedTrackNos: number[] };
  coreVocabulary: { pass: number; total: number; failedTrackNos: number[] };
  /** §공통 규약 6 — positions는 "측정 가능했던 곡"만의 실제 첫 악기 등장 위치(문자 인덱스) 목록, min/median/max 리포팅용. */
  instrumentPosition: { pass: number; total: number; failedTrackNos: number[]; positions: number[] };
  /** counts는 "측정 가능했던 곡"만의 실제 보컬 서술 클로즈 개수 목록. */
  vocalDescriptorCount: { pass: number; total: number; failedTrackNos: number[]; counts: number[] };
  distribution: GenreDistributionReport;
}

export function runGenreFidelityCheck(songs: readonly GenreFidelitySong[]): GenreFidelityReport {
  const genreOpenFailed = songs.filter(song => !stylePromptOpensWithGenre(song.stylePrompt));
  const vocabApplicable = songs.filter(song => stylePromptKeepsGenreVocabulary(song.genreId, song.stylePrompt) !== null);
  const vocabFailed = vocabApplicable.filter(song => stylePromptKeepsGenreVocabulary(song.genreId, song.stylePrompt) === false);

  const instrumentMeasured = songs
    .map(song => ({ trackNo: song.trackNo, position: firstInstrumentPosition(song.genreId, song.stylePrompt) }))
    .filter((entry): entry is { trackNo: number; position: number } => entry.position !== null);
  const instrumentFailed = instrumentMeasured.filter(entry => entry.position > INSTRUMENT_POSITION_MAX_CHARS);

  const vocalMeasured = songs
    .map(song => ({ trackNo: song.trackNo, count: vocalDescriptorClauseCount(song.stylePrompt) }))
    .filter((entry): entry is { trackNo: number; count: number } => entry.count !== null);
  const vocalFailed = vocalMeasured.filter(entry => entry.count < VOCAL_DESCRIPTOR_MIN || entry.count > VOCAL_DESCRIPTOR_MAX);

  return {
    songCount: songs.length,
    opensWithGenre: { pass: songs.length - genreOpenFailed.length, total: songs.length, failedTrackNos: genreOpenFailed.map(s => s.trackNo) },
    coreVocabulary: { pass: vocabApplicable.length - vocabFailed.length, total: vocabApplicable.length, failedTrackNos: vocabFailed.map(s => s.trackNo) },
    instrumentPosition: {
      pass: instrumentMeasured.length - instrumentFailed.length,
      total: instrumentMeasured.length,
      failedTrackNos: instrumentFailed.map(entry => entry.trackNo),
      positions: instrumentMeasured.map(entry => entry.position)
    },
    vocalDescriptorCount: {
      pass: vocalMeasured.length - vocalFailed.length,
      total: vocalMeasured.length,
      failedTrackNos: vocalFailed.map(entry => entry.trackNo),
      counts: vocalMeasured.map(entry => entry.count)
    },
    distribution: checkGenreDistribution(songs)
  };
}
