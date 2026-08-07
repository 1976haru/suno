/**
 * codex 지시문 03 (TASK G) — composition/performance-instruction vocabulary
 * that must never leak into a SUNG lyric line as a literal meta-instruction
 * (e.g. "the melody rises" describing what the singer should DO, not what
 * the song is ABOUT). Deliberately narrow — same "장면 구체성 후퇴 금지"
 * false-positive discipline data/arrangementVocabulary.ts's own doc comment
 * already established for the identical problem shape (this task's own
 * literal examples are a distinct vocabulary — key/chorus/hook/melody/BPM/
 * modulation — from that file's instrument/production vocabulary, so this
 * is a sibling list, not a duplicate).
 */
export const COMPOSITION_META_SUBJECT_WORDS_EN: string[] = ['hook', 'melody', 'chorus', 'arrangement', 'key'];
export const COMPOSITION_META_SUBJECT_VERBS_EN: string[] = [
  'come', 'comes', 'came', 'home',
  'rise', 'rises', 'rose', 'risen', 'higher',
  'lift', 'lifts', 'lifted',
  'open', 'opens', 'opened',
  'change', 'changes', 'changed'
];

/** Fixed directive phrases (imperative/compound shape, not the noun-as-subject shape above) — matched as their own literal regexes in core/lyricMetaLeak.ts. */
export const COMPOSITION_META_DIRECTIVE_PATTERNS_EN: RegExp[] = [
  /\bhold (?:that|this|the) note\b/i,
  /\bsing (?:higher|louder|softer|lower)\b/i,
  /\bkey change\b/i,
  /\bchorus lift\b/i,
  /\bmodulation\b/i,
  /\b\d{2,3}\s*bpm\b/i
];

/**
 * 한국어 — this task's own literal 4개 예시 그대로: 후렴이 올라가 / 키를 올려 /
 * 멜로디를 / 음정을. 명사+조사 뒤에 실제 지시 동사가 바로 붙을 때만 매칭 —
 * "그대 목소리의 멜로디를 기억해"처럼 명사만 등장하는 서사 문맥은 걸리지 않음
 * (지시 동사가 없으므로).
 */
export const COMPOSITION_META_DIRECTIVE_PATTERNS_KO: RegExp[] = [
  /후렴\s*(?:이|가)?\s*(?:올라가|올려|커져|커진다)/,
  /키\s*를?\s*(?:올려|올리|바꿔|바꾸)/,
  /멜로디\s*(?:를|가|는)?\s*(?:올라가|올려|바꿔|시작해)/,
  /음정\s*(?:을|이)?\s*(?:올려|맞춰|낮춰)/,
  /\bbpm\b/i,
  /모듈레이션/
];

/**
 * 日本語 — this task's own literal 3개 예시: サビを上げて / キーを上げて /
 * メロディーが. Same noun+particle immediately followed by a real directive
 * verb requirement as Korean above.
 */
export const COMPOSITION_META_DIRECTIVE_PATTERNS_JA: RegExp[] = [
  /サビ\s*を?\s*上げ/,
  /キー\s*を?\s*上げ/,
  /メロディー?\s*(?:が|を)?\s*(?:上が|上げ)/,
  /\bbpm\b/i,
  /モジュレーション/
];
