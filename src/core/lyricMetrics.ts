import type { AudienceProfile, LyricLanguage } from '../types';

/**
 * v4.1 (TASK B) — real per-language lyric measurement. Before this, every
 * caller counted "words" via a plain whitespace split
 * (compositionScorer.ts's lyricWordAndSectionCounts, promptComposer.ts's
 * MIN_LYRIC_WORDS, generationGate.ts's LYRIC_WORD_COUNT_MIN/MAX — three
 * independent copies of the same flaw). Korean/Japanese lyrics don't
 * whitespace-segment the way English does — a whole Japanese lyric can come
 * back as ~1 "word". `primary` below is the language-appropriate count
 * (English/Korean: whitespace-delimited unit; Japanese: character count via
 * script regex, NOT whitespace); `syllables` is a parallel signal (English:
 * vowel-cluster approximation; Korean: 가-힣 완성형 문자 수; Japanese: mora
 * approximation) since 조사/어미 make Korean 어절 count alone high-variance.
 */
export interface LyricMetrics {
  language: LyricLanguage;
  /** English/Korean: whitespace-delimited word/어절 count. Japanese: character count (script regex, not whitespace). */
  primary: number;
  /** English: vowel-cluster syllable approximation. Korean: 가-힣 완성형 문자 수. Japanese: mora approximation (요음/촉음/발음 aware). */
  syllables: number;
}

const VOWEL_CLUSTER_PATTERN = /[aeiouy]+/gi;
const HANGUL_SYLLABLE_PATTERN = /[가-힣]/g;
const JAPANESE_CHAR_PATTERN = /[぀-ゟ゠-ヿ一-鿿]/g;
/** 요음(拗音, e.g. きゃ) — merges into the PRECEDING kana as one mora, not two. */
const YOON_PATTERN = /[ゃゅょャュョ]/g;

export function measureLyrics(lyrics: string, language: LyricLanguage): LyricMetrics {
  switch (language) {
    case 'korean':
      return measureKorean(lyrics);
    case 'japanese':
      return measureJapanese(lyrics);
    case 'english':
    case 'bilingual':
    default:
      return measureEnglish(lyrics, language);
  }
}

function whitespaceUnits(lyrics: string): string[] {
  return lyrics.split(/\s+/).map(unit => unit.trim()).filter(Boolean);
}

function approximateSyllables(word: string): number {
  const clusters = word.match(VOWEL_CLUSTER_PATTERN);
  return Math.max(1, clusters ? clusters.length : 1);
}

function measureEnglish(lyrics: string, language: LyricLanguage): LyricMetrics {
  const words = whitespaceUnits(lyrics);
  const syllables = words.reduce((sum, word) => sum + approximateSyllables(word), 0);
  return { language, primary: words.length, syllables };
}

function measureKorean(lyrics: string): LyricMetrics {
  const eojeol = whitespaceUnits(lyrics).length;
  const syllableMatches = lyrics.match(HANGUL_SYLLABLE_PATTERN);
  return { language: 'korean', primary: eojeol, syllables: syllableMatches ? syllableMatches.length : 0 };
}

function measureJapanese(lyrics: string): LyricMetrics {
  const charMatches = lyrics.match(JAPANESE_CHAR_PATTERN);
  const charCount = charMatches ? charMatches.length : 0;
  const yoonCount = (lyrics.match(YOON_PATTERN) || []).length;
  // 촉음(っ)/발음(ん) already count as their own mora via charCount (each is
  // its own character); 요음 is the only case that needs subtracting since
  // it merges into the kana before it. Kanji have no fixed mora count
  // without a reading, so this stays a character-based approximation, not
  // an exact mora count — documented in docs/v410-report.md.
  const moraCount = Math.max(0, charCount - yoonCount);
  return { language: 'japanese', primary: charCount, syllables: moraCount };
}

/**
 * v4.1 (TASK B) — English/bilingual fallback mirrors this app's own
 * pre-v4.1 hardcoded constants (compositionScorer.ts's 190/generationGate.ts's
 * 200-240) so omitting an AudienceProfile changes nothing for existing
 * callers. Korean/Japanese fallbacks are ESTIMATES from this task's own
 * spec, not yet calibrated against a real generated set (v4.2's stated job)
 * — only used when a caller has no AudienceProfile.lyricMetricsByLanguage
 * entry at all; SENIOR_AUDIENCE_PROFILE (data/audienceProfiles.ts) carries
 * the real values.
 */
const FALLBACK_RANGE_BY_LANGUAGE: Record<LyricLanguage, { primaryRange: [number, number]; syllableRange: [number, number] }> = {
  english: { primaryRange: [200, 240], syllableRange: [260, 320] },
  korean: { primaryRange: [150, 180], syllableRange: [350, 450] },
  japanese: { primaryRange: [400, 520], syllableRange: [400, 520] },
  bilingual: { primaryRange: [200, 240], syllableRange: [260, 320] }
};

export function resolveLyricRange(
  language: LyricLanguage,
  profile?: AudienceProfile
): { primaryRange: [number, number]; syllableRange: [number, number] } {
  return profile?.lyricMetricsByLanguage?.[language] ?? FALLBACK_RANGE_BY_LANGUAGE[language];
}
