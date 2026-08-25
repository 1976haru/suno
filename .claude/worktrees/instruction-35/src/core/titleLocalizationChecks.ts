/**
 * v4.3 (TASK A) — compositionScorer.ts's per-track checks for
 * SongIdea.titleLocalized/titleDisplay. Kept in its own module (same
 * pattern as titleShapeVariety.ts) rather than inlined, so the detection
 * heuristics below have room for their own doc comments without bloating
 * compositionScorer.ts's already-long per-track block.
 */

const MAX_TITLE_LOCALIZED_LENGTH_ADVISORY = 15;

/**
 * Blocking signal #1 — Latin letters inside a Korean/Japanese title almost
 * always means the agent pasted the English title (or part of it) instead
 * of writing a real localized one. Low false-positive risk: a genuine
 * Korean/Japanese pop title essentially never mixes in bare Latin letters.
 */
function containsLatinLetters(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

/**
 * Blocking signal #2 (Japanese only) — a title that is almost entirely
 * katakana is very likely a phonetic transliteration of an English/foreign
 * word (がいらいご) rather than a real reinterpretation; genuine Japanese
 * song titles in this app's own era-flavored bank (data/titleLocalizationBank.ts)
 * mix kanji/hiragana. The katakana prolongation mark (ー) and full katakana
 * block are counted; punctuation/whitespace are excluded from the ratio so
 * a short title isn't skewed by a stray symbol.
 */
const KATAKANA_RANGE = /[゠-ヿ]/;
const KANA_KANJI_CHAR = /[぀-ヿ一-鿿]/;

function katakanaRatio(text: string): number {
  const chars = [...text].filter(ch => KANA_KANJI_CHAR.test(ch));
  if (!chars.length) return 0;
  const katakanaCount = chars.filter(ch => KATAKANA_RANGE.test(ch)).length;
  return katakanaCount / chars.length;
}

const KATAKANA_TRANSLITERATION_RATIO_THRESHOLD = 0.7;

/**
 * v4.3 (TASK A) — "titleLocalized 가 영어 음차(가타카나·한글 음차)면 blocking".
 * Deliberately conservative/narrow (see each signal's own doc comment) —
 * this task's own instruction for the SEPARATE literal-translation advisory
 * check explicitly accepts false positives there ("판정이 어려우면 advisory로만"),
 * implying the opposite for this blocking check: high precision matters more
 * than recall here, since a false positive here blocks a real song.
 */
export function isTransliteratedTitle(titleLocalized: string, language: 'korean' | 'japanese'): boolean {
  if (containsLatinLetters(titleLocalized)) return true;
  if (language === 'japanese' && katakanaRatio(titleLocalized) >= KATAKANA_TRANSLITERATION_RATIO_THRESHOLD) return true;
  return false;
}

export function isOverLengthAdvisory(titleLocalized: string): boolean {
  return titleLocalized.length > MAX_TITLE_LOCALIZED_LENGTH_ADVISORY;
}

/**
 * v4.3 (TASK A) — a small, honestly-scoped calque dictionary: common
 * old-pop/adult-pop title vocabulary mapped to its literal Korean/Japanese
 * translation. If titleLocalized contains 2+ of these DIRECT calques of
 * `title`'s own words, it's very likely a word-for-word translation rather
 * than a scene reinterpretation. This is explicitly a low-precision,
 * advisory-only heuristic per this task's own "판정이 어려우면 advisory로만.
 * 오탐이 낫습니다" — it will miss most real literal translations (anything
 * outside this ~40-word list) and is not a substitute for a human read of
 * the title-pair report this task also produces.
 */
const LITERAL_CALQUE_DICTIONARY: Record<string, { ko: string[]; ja: string[] }> = {
  blue: { ko: ['파란', '푸른'], ja: ['青い', '青'] },
  cup: { ko: ['컵', '잔'], ja: ['カップ', '杯'] },
  lamp: { ko: ['램프', '등불'], ja: ['ランプ', '灯'] },
  morning: { ko: ['아침'], ja: ['朝'] },
  night: { ko: ['밤'], ja: ['夜'] },
  rain: { ko: ['비'], ja: ['雨'] },
  snow: { ko: ['눈'], ja: ['雪'] },
  summer: { ko: ['여름'], ja: ['夏'] },
  winter: { ko: ['겨울'], ja: ['冬'] },
  home: { ko: ['집'], ja: ['家'] },
  heart: { ko: ['마음', '심장'], ja: ['心'] },
  love: { ko: ['사랑'], ja: ['愛', '恋'] },
  star: { ko: ['별'], ja: ['星'] },
  sky: { ko: ['하늘'], ja: ['空'] },
  sea: { ko: ['바다'], ja: ['海'] },
  gold: { ko: ['금', '황금'], ja: ['金'] },
  old: { ko: ['오래된', '낡은'], ja: ['古い'] },
  meet: { ko: ['만나다', '만남'], ja: ['会う'] },
  leave: { ko: ['떠나다', '남기다'], ja: ['去る', '残す'] },
  burning: { ko: ['타는', '불타는'], ja: ['燃える'] },
  window: { ko: ['창문', '창'], ja: ['窓'] },
  road: { ko: ['길', '도로'], ja: ['道'] },
  door: { ko: ['문'], ja: ['扉', 'ドア'] },
  light: { ko: ['빛'], ja: ['光'] },
  dark: { ko: ['어둠'], ja: ['暗い'] },
  dream: { ko: ['꿈'], ja: ['夢'] },
  time: { ko: ['시간'], ja: ['時間'] },
  friend: { ko: ['친구'], ja: ['友'] },
  goodbye: { ko: ['안녕', '작별'], ja: ['さよなら'] },
  today: { ko: ['오늘'], ja: ['今日'] },
  tomorrow: { ko: ['내일'], ja: ['明日'] },
  memory: { ko: ['기억', '추억'], ja: ['記憶', '思い出'] }
};

const STOPWORDS = new Set(['a', 'an', 'the', 'my', 'your', 'our', 'his', 'her', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'i', 'you', 'we']);

export function looksLikeLiteralTranslation(title: string, titleLocalized: string, language: 'korean' | 'japanese'): boolean {
  const words = title.toLowerCase().replace(/[,.!?]/g, '').split(/\s+/).filter(word => word && !STOPWORDS.has(word));
  let calqueMatches = 0;
  for (const word of words) {
    const entry = LITERAL_CALQUE_DICTIONARY[word];
    if (!entry) continue;
    const candidates = language === 'korean' ? entry.ko : entry.ja;
    if (candidates.some(candidate => titleLocalized.includes(candidate))) calqueMatches += 1;
  }
  return calqueMatches >= 2;
}
