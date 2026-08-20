import { parseLyricsSections } from './lyricsAst';
import { CHANT_SECTION_TAG_PATTERN } from './kpopSharedChecks';

/**
 * 지시문 37 (TASK C) — K-pop용 "따라 부르기 쉬움" 실측 지표. 동요 채널의
 * "한 줄 3.1단어" 목표가 실제로 잘 작동한 것과 같은 원리: 절대 개수를
 * 세서 판정 가능한 값으로 만든다. 임계값(HOOK_LINE_WORD_RANGE/
 * CHORUS_SYLLABLE_DENSITY_CEILING)은 지시문 37 본문이 직접 제시한
 * 값이거나(4회 이상·3~6단어) 그로부터 파생한 추정치이며, verified:false —
 * kr-idol 워크스페이스 자체가 아직 미검증이라는 기존 정책(distinctChoicePolicy.ts)과
 * 같은 상태다. 이 지표는 advisory로만 쓰인다(core/fullAudit.ts의
 * kpopSingabilityItems가 항상 pass:null로 낸다) — 실측 없이 blocking을
 * 만들지 않는다(공통 규약 §7).
 */
export interface KpopSingabilityMetrics {
  /** 훅 프레이즈가 가사 전체(섹션 라인)에서 그대로 반복된 횟수. */
  hookRepeatCount: number;
  hookRepeatCountOk: boolean;
  /** 훅 한 줄의 단어 수. */
  hookLineWordCount: number;
  hookLineWordCountOk: boolean;
  /** [Chant]/[Ad-lib]/[Call and Response] 계열 섹션 태그가 하나라도 있는가. */
  chantLinePresent: boolean;
  /** 후렴 섹션 줄당 평균 음절 수(한글은 음절 문자 수, 그 외 언어는 단어 수로 근사). */
  chorusSyllableDensity: number;
  chorusSyllableDensityOk: boolean;
}

const HOOK_REPEAT_MIN = 4;
const HOOK_LINE_WORD_MIN = 3;
const HOOK_LINE_WORD_MAX = 6;
// verified:false — 실측 케이팝 세트(20260810)의 후렴 줄들이 대체로 8~10
// 음절이었다(예: "바람이 묻는 말에 대답해" = 10음절). "과다하지 않을 것"을
// 그 관측값에 여유를 둔 상한으로 옮긴 추정치.
const CHORUS_SYLLABLE_DENSITY_CEILING = 14;

function countSyllables(line: string): number {
  const hangul = line.match(/[가-힣]/g);
  if (hangul && hangul.length) return hangul.length;
  return line.trim().split(/\s+/).filter(Boolean).length;
}

export function measureKpopSingability(song: { lyrics: string; hookPhrase: string }): KpopSingabilityMetrics {
  const sections = parseLyricsSections(song.lyrics);
  const hook = song.hookPhrase.trim();
  const hookLower = hook.toLowerCase();
  const allLines = sections.flatMap(s => s.lines);
  const hookRepeatCount = allLines.filter(l => l.trim().toLowerCase() === hookLower).length;

  const hookLineWordCount = hook ? hook.split(/\s+/).filter(Boolean).length : 0;
  const chantLinePresent = sections.some(s => CHANT_SECTION_TAG_PATTERN.test(s.rawTag));

  const chorusLines = sections
    .filter(s => s.type === 'chorus' || s.type === 'final-chorus')
    .flatMap(s => s.lines)
    .filter(l => l.trim());
  const chorusSyllableDensity = chorusLines.length
    ? chorusLines.reduce((sum, l) => sum + countSyllables(l), 0) / chorusLines.length
    : 0;

  return {
    hookRepeatCount,
    hookRepeatCountOk: hookRepeatCount >= HOOK_REPEAT_MIN,
    hookLineWordCount,
    hookLineWordCountOk: hookLineWordCount >= HOOK_LINE_WORD_MIN && hookLineWordCount <= HOOK_LINE_WORD_MAX,
    chantLinePresent,
    chorusSyllableDensity,
    chorusSyllableDensityOk: chorusSyllableDensity <= CHORUS_SYLLABLE_DENSITY_CEILING || chorusLines.length === 0
  };
}
