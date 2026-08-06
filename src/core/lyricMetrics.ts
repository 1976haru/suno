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

/**
 * TASK (lyric language mismatch detection) — reuses this file's own
 * HANGUL_SYLLABLE_PATTERN/JAPANESE_CHAR_PATTERN (the same char-range signal
 * measureKorean/measureJapanese above already use for 음절/mora counts), so
 * core/batchPreallocation.ts's reconcileWithPreassignedSlot — the one choke
 * point every non-local generation path (realtime, Batch API, Claude Code
 * bridge import, individual song regeneration) funnels an AI-produced song
 * through — can catch a raw model/bridge response whose `lyrics` body came
 * back in the wrong language entirely (e.g. a `lyricLanguage: 'korean'`
 * pack whose response is actually English prose).
 *
 * This is a coarse script-presence check, not a translation/fluency
 * verifier — it can tell "no Hangul anywhere in this lyric" from "some
 * Hangul present," nothing finer. That coarseness is intentional: it's the
 * same signal tests/workspaceContractMatrix.test.ts's own assertLyricLanguage
 * (its criterion 7) already relies on, and a language mismatch can't be
 * safely auto-corrected the way a wrong genre-id substring can (auto-
 * translating lyrics isn't something this function should ever do), so
 * "detect and surface" is the realistic ceiling here, not "detect and fix."
 *
 * `bilingual` is deliberately never flagged — mixed-script content is the
 * correct, expected shape there, not a defect. Empty/whitespace-only
 * lyrics are also never flagged: there's no script to be wrong about yet,
 * and every other reconciliation warning in this codebase fires on a
 * detected problem, not on missing input another check already covers.
 */
export function lyricLanguageMismatchWarning(lyrics: string, language: LyricLanguage, trackNo: number): string | undefined {
  if (language === 'bilingual' || !lyrics.trim()) return undefined;
  const hangulCount = (lyrics.match(HANGUL_SYLLABLE_PATTERN) || []).length;
  const japaneseCount = (lyrics.match(JAPANESE_CHAR_PATTERN) || []).length;
  if (language === 'korean' && hangulCount === 0) {
    return `Track ${trackNo}: lyricLanguage is 'korean' but the lyrics body contains no Hangul — possible language mismatch.`;
  }
  if (language === 'japanese' && japaneseCount === 0) {
    return `Track ${trackNo}: lyricLanguage is 'japanese' but the lyrics body contains no Japanese kana/kanji — possible language mismatch.`;
  }
  if (language === 'english' && (hangulCount > 0 || japaneseCount > 0)) {
    return `Track ${trackNo}: lyricLanguage is 'english' but the lyrics body contains Hangul or Japanese characters — possible language mismatch.`;
  }
  return undefined;
}
