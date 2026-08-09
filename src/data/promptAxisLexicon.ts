/**
 * 지시문 16 (TASK B-4) — "축 판정을 자유 정규식으로 하지 말 것 —
 * promptAxisLexicon 데이터로 한다. eraTag 자유 문자열 문제가 재발한다." This
 * file is the ONE place every stylePrompt clause's axis is decided from —
 * core/promptAxisMerge.ts's mergeAtom (TASK B) and scripts/promptLengthTrial.ts
 * (TASK A-2) both classify clauses through classifyClause below, never their
 * own ad-hoc regex.
 *
 * A "clause" is one comma-separated fragment of a real stylePrompt string
 * (e.g. "female soft head-voice lead", "3:10-3:35", "I-vi-IV-V doo-wop
 * progression") — real fixture text (20260808_oldpoplounge pack) drove every
 * pattern below; nothing here is speculative.
 */

export type PromptAxis =
  | 'era' | 'genre' | 'tempo' | 'leadVocal' | 'backingVocal'
  | 'instrument' | 'harmony' | 'structure' | 'intro'
  | 'arrangementDensity' | 'mix' | 'hookDevice' | 'duration';

export interface PromptAtom {
  axis: PromptAxis;
  text: string;
  /** locked = LLM이 바꿀 수 없음 (batchPreallocation.ts가 슬롯에서 직접 채운 값). creative = LLM 자유 (원문 프로즈에서 그대로 옮겨온 값). */
  locked: boolean;
}

/** 지시문 16 §B-2 — 프롬프트 안에 정확히 하나만 존재해야 하는 축. */
export const SINGLE_DECLARATION_AXES: readonly PromptAxis[] = ['era', 'tempo', 'leadVocal', 'intro', 'duration', 'arrangementDensity'];

/** 지시문 16 §B-2 — 여러 개 존재해도 되는 축. */
export const MULTIPLE_ALLOWED_AXES: readonly PromptAxis[] = ['genre', 'instrument', 'harmony', 'mix', 'hookDevice', 'backingVocal', 'structure'];

/**
 * intro 축 — 지시문 16 §B-4의 두 하위 그룹. 같은 프롬프트 안에 "즉시시작"과
 * "인트로 있음" 어휘가 함께 나오면 모순(실측 T1/T3/T8/T9/T10/T13/T16, 지시문
 * 16 §1-2) — introSubcategory가 이 판정에 쓰인다.
 */
export type IntroSubcategory = 'immediate' | 'has-intro';

const INTRO_IMMEDIATE_PHRASES = [
  'cold open', 'a cappella', 'singing starts immediately', 'straight into the hook',
  'no intro', 'no quiet fade-in', 'vocal-first opening', 'instrumental hook opens the song',
  'spoken-close a cappella hook opens the song'
];

const INTRO_HAS_INTRO_PHRASES = [
  'short intro', 'intro texture', 'instrumental intro', 'intro swell', 'hook intro',
  'bar intro', 'intro opens', 'strum intro', 'chord intro', 'ensemble swell intro'
];

const LEAD_VOCAL_PHRASES = ['lead', 'duet'];
/** leadVocal처럼 "lead"를 포함하지만 실제로는 backing 역할인 어휘 — 지시문 16 §1-3 실측(girl-group unison lead가 T2/T6/T7에서 진짜 리드와 중복). */
const BACKING_VOCAL_MARKERS = ['backing', 'responses', 'chorus vocals', 'unison lead'];

const INSTRUMENT_KEYWORDS = [
  'guitar', 'bass', 'drum', 'piano', 'organ', 'synth', 'string', 'violin', 'cello', 'brass',
  'horn', 'sax', 'flute', 'clarinet', 'harpsichord', 'glockenspiel', 'tambourine', 'mandolin',
  'banjo', 'woodwind', 'kit', 'snare', 'percussion', 'keys', 'harmonica', 'accordion', 'vibraphone'
];

const HARMONY_KEYWORDS = ['progression', 'movement', 'chord', 'maj7', 'harmony color'];
const HARMONY_ROMAN_NUMERAL_PATTERN = /\b[iIvV]+-[iIvV]+-[iIvV]+/;

const STRUCTURE_KEYWORDS = [
  'chorus', 'bridge', 'verse', 'opens the song', 'returns', 'stop-time', 'fill', 'drops out', 'strips to'
];

const MIX_KEYWORDS = ['mix', 'ambience', 'mono', 'studio', 'room tone', 'coloration', 'room sound', 'echo'];

const HOOK_DEVICE_KEYWORDS = ['hook'];

const ARRANGEMENT_DENSITY_KEYWORDS = ['arrangement', 'layered', 'voice-forward', 'a few instruments at a time'];

const TEMPO_PATTERN = /\b\d{2,3}\s*bpm\b/i;
const DURATION_PATTERN = /\b\d:\d{2}\s*-\s*\d:\d{2}\b/;
const ERA_PATTERN = /\b(early|mid|late)-\d{4}s\b|\b(19|20)\d0s\b/i;

/**
 * Word-boundary match, not a bare substring `.includes()` — real bug this
 * caught: "harpsichord" contains "chord" as a raw substring, which would
 * misclassify it as the harmony axis under naive `.includes()`. `\b` on a
 * multi-word phrase still only anchors the phrase's own start/end, so "opens
 * the song" etc. keep matching as whole phrases, not just as loose word sets.
 */
function includesAny(lower: string, phrases: readonly string[]): boolean {
  return phrases.some(phrase => new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower));
}

/**
 * Pure — classifies one already-trimmed clause. `isFirstClause` matters
 * because every real stylePrompt observed in this codebase's fixtures opens
 * with the genre name as its very first clause with no other reliable
 * marker (genre names are free text — "Sunshine Pop", "British Beat Pop",
 * "Doo-Wop Close Harmony" — there is no shared keyword to lexicon-match on,
 * unlike every other axis here). Order matters: era/tempo/duration/harmony
 * patterns are checked before the generic keyword scans since they're the
 * least ambiguous (a BPM number can never also look like an instrument
 * name).
 */
export function classifyClause(clause: string, isFirstClause: boolean): PromptAxis | undefined {
  const trimmed = clause.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();

  if (isFirstClause) return 'genre';
  if (TEMPO_PATTERN.test(lower)) return 'tempo';
  if (DURATION_PATTERN.test(lower)) return 'duration';
  if (ERA_PATTERN.test(lower)) return 'era';
  if (includesAny(lower, INTRO_IMMEDIATE_PHRASES) || includesAny(lower, INTRO_HAS_INTRO_PHRASES)) return 'intro';
  if (includesAny(lower, BACKING_VOCAL_MARKERS)) return 'backingVocal';
  if (includesAny(lower, LEAD_VOCAL_PHRASES)) return 'leadVocal';
  if (includesAny(lower, ARRANGEMENT_DENSITY_KEYWORDS)) return 'arrangementDensity';
  if (HARMONY_ROMAN_NUMERAL_PATTERN.test(trimmed) || includesAny(lower, HARMONY_KEYWORDS)) return 'harmony';
  if (includesAny(lower, HOOK_DEVICE_KEYWORDS)) return 'hookDevice';
  if (includesAny(lower, MIX_KEYWORDS)) return 'mix';
  if (includesAny(lower, STRUCTURE_KEYWORDS)) return 'structure';
  if (includesAny(lower, INSTRUMENT_KEYWORDS)) return 'instrument';
  return undefined;
}

/** intro 축 클로즈 하나가 즉시시작/인트로있음 중 어느 하위 그룹인지 — 모순 판정(§B-5)에 쓰인다. classifyClause가 'intro'를 반환한 클로즈에만 의미 있음. */
export function introSubcategory(clause: string): IntroSubcategory | undefined {
  const lower = clause.trim().toLowerCase();
  if (includesAny(lower, INTRO_IMMEDIATE_PHRASES)) return 'immediate';
  if (includesAny(lower, INTRO_HAS_INTRO_PHRASES)) return 'has-intro';
  return undefined;
}

/** 지시문 16 §A-2 — 삭제 금지 8종(TASK A-3/03 TASK C) 중 이 축 판정 시스템이 다루는 6개(장르·시대·BPM·리드보컬·핵심구조·길이). "핵심 악기"와 "사용자 선택"은 instrument/harmony 축에서 clause 위치(첫 번째)로 별도 결정한다 — 이 축 목록만으로는 "몇 번째 instrument/harmony 클로즈가 핵심인지"를 알 수 없기 때문. */
export const REQUIRED_AXES_BY_POSITION: readonly PromptAxis[] = ['genre', 'era', 'tempo', 'leadVocal', 'arrangementDensity', 'duration'];
