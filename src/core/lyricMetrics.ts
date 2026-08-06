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
/** Hiragana/katakana only, no kanji — JAPANESE_CHAR_PATTERN minus its 一-鿿 kanji range. Needed on its own for the ratio check below: a 'korean' target must be near-zero on kana SPECIFICALLY, not the combined kana+kanji script, since kanji glyphs overlap with Hanja that could in principle appear in a Korean title/loanword. */
const KANA_ONLY_PATTERN = /[぀-ゟ゠-ヿ]/g;
const LATIN_LETTER_PATTERN = /[A-Za-z]/g;
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
 * TASK (ratio-based lyric language mismatch) — shared meta-tag/section-
 * header stripping. Previously duplicated: core/compositionScorer.ts's
 * lyricWordAndSectionCounts had its own private copy of exactly this
 * VOCAL_META_TAG_LINE + bracket-line loop (see that function's own history —
 * v4.11 TASK A). Moved here (the lower-level metrics module both
 * compositionScorer.ts and this file's own ratio check need) so there is
 * exactly one implementation; compositionScorer.ts now imports this instead
 * of re-deriving its own `text`/`sections`. A bracket-only line (`[chorus]`,
 * `[verse 2: male vocal]`) is structure, not lyric content, and must never
 * count toward a word/section count OR a language ratio — same reasoning
 * either caller has for excluding it.
 */
const VOCAL_META_TAG_LINE = /^\[(male vocal|female vocal|children'?s choir|duet vocal|group vocal)\]$/i;
const SECTION_HEADER_LINE = /^\[[^\]]*\]$/;

export interface StrippedLyricBody {
  /** Non-blank, non-header, non-vocal-meta-tag lines only, trimmed, original order. */
  lines: string[];
  /** lines.join('\n') — the exact "body text" shape lyricWordAndSectionCounts previously built inline. */
  text: string;
  /** Count of stripped bracket-tag lines that were real section headers (excludes the one blanket vocal meta-tag line, which is never a section). */
  sectionCount: number;
}

export function stripLyricsToBody(lyrics: string): StrippedLyricBody {
  let sectionCount = 0;
  const lines: string[] = [];
  for (const rawLine of lyrics.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (VOCAL_META_TAG_LINE.test(line)) continue;
    if (SECTION_HEADER_LINE.test(line)) { sectionCount += 1; continue; }
    lines.push(line);
  }
  return { lines, text: lines.join('\n'), sectionCount };
}

/**
 * TASK (ratio-based lyric language mismatch) — real per-script character
 * ratios over the stripped lyric body (meta-tags/section headers excluded
 * via stripLyricsToBody above, whitespace excluded from the denominator so
 * Korean's spaced eojeol and Japanese's unspaced text are measured on the
 * same footing). Superseded the v5.11-follow-up's presence-only check (any
 * single matching character passed): a real audit found that check lets a
 * ~95%-English body with one stray Korean word sail through a
 * `lyricLanguage: 'korean'` check completely uncaught.
 */
export interface LyricLanguageRatios {
  /** Stripped-body character count, whitespace excluded — the ratio denominator. 0 when nothing is left to measure. */
  totalChars: number;
  hangulRatio: number;
  /** Hiragana/katakana only, no kanji (KANA_ONLY_PATTERN). */
  kanaRatio: number;
  /** Kana + kanji combined (JAPANESE_CHAR_PATTERN) — the real "is this Japanese script" signal, since kanji-only lines are common. */
  kanaKanjiRatio: number;
  latinRatio: number;
}

function charRatio(pattern: RegExp, denseText: string, total: number): number {
  if (total === 0) return 0;
  const matches = denseText.match(pattern);
  return (matches ? matches.length : 0) / total;
}

export function measureLyricLanguageRatios(lyrics: string): LyricLanguageRatios {
  const { text } = stripLyricsToBody(lyrics);
  const dense = text.replace(/\s+/g, '');
  const total = dense.length;
  return {
    totalChars: total,
    hangulRatio: charRatio(HANGUL_SYLLABLE_PATTERN, dense, total),
    kanaRatio: charRatio(KANA_ONLY_PATTERN, dense, total),
    kanaKanjiRatio: charRatio(JAPANESE_CHAR_PATTERN, dense, total),
    latinRatio: charRatio(LATIN_LETTER_PATTERN, dense, total)
  };
}

const KOREAN_HANGUL_RATIO_MIN = 0.6;
const KOREAN_KANA_RATIO_MAX = 0.05;
const JAPANESE_SCRIPT_RATIO_MIN = 0.6;
const JAPANESE_HANGUL_RATIO_MAX = 0.05;
const ENGLISH_LATIN_RATIO_MIN = 0.8;
const ENGLISH_NON_LATIN_RATIO_MAX = 0.02;
/**
 * TASK (ratio-based lyric language mismatch) — 'bilingual' real use case
 * (kids channels mixing Korean/English or Japanese/English, per this task's
 * own brief) is NOT a simple ratio check the way single-language targets
 * are: a legitimately bilingual song is expected to have LOW overall
 * character-ratio purity in either script by design, so a ratio floor would
 * either reject real bilingual content or (set low enough to pass it) admit
 * a single stray word as "bilingual." Instead this requires real per-line
 * presence: at least this many lines with MORE THAN ONE WORD in each
 * language actually appear in the stripped body, so a single decorative
 * word ("Hello 안녕하세요") in an otherwise single-language song doesn't
 * count as satisfying that language's presence.
 */
const BILINGUAL_MIN_REAL_LINES = 2;

/** "word" for English/Korean is a whitespace-delimited token containing that script's characters — mirrors this file's own whitespaceUnits/measureKorean convention (eojeol counted the same way). Japanese has no whitespace word boundary at all (measureJapanese above already substitutes character count for "primary" instead of a word count for exactly this reason) — so a Japanese "real line" instead requires more than a single bare kana/kanji character, i.e. more than one mora, not a one-syllable interjection. This is a judgment call this task's own brief doesn't fully resolve (Japanese genuinely has no word-boundary marker to count), documented here rather than silently assumed. */
function realLanguageLineCounts(lines: string[]): { english: number; korean: number; japanese: number } {
  let english = 0;
  let korean = 0;
  let japanese = 0;
  for (const line of lines) {
    const tokens = line.split(/\s+/).map(token => token.trim()).filter(Boolean);
    if (tokens.filter(token => /[A-Za-z]/.test(token)).length > 1) english += 1;
    if (tokens.filter(token => /[가-힣]/.test(token)).length > 1) korean += 1;
    const jpChars = line.match(JAPANESE_CHAR_PATTERN);
    if (jpChars && jpChars.length > 1) japanese += 1;
  }
  return { english, korean, japanese };
}

export interface LyricLanguageCheck {
  ok: boolean;
  ratios: LyricLanguageRatios;
  /** Only populated when language === 'bilingual'. */
  bilingualDetail?: { englishLines: number; otherLines: number; otherLanguage: 'korean' | 'japanese' };
}

/**
 * TASK (ratio-based lyric language mismatch) — the shared evaluator both
 * lyricLanguageMismatchWarning (English-language warning text, wired into
 * core/batchPreallocation.ts's reconcileWithPreassignedSlot) and
 * core/compositionScorer.ts's new per-track blocking check (Korean-language
 * blocking text, this codebase's established convention for every OTHER
 * compositionScorer.ts finding) build their own message from, so the ratio
 * math itself exists exactly once. Returns undefined when there's nothing to
 * check yet (empty lyrics, or nothing left after stripping meta-tags/
 * section headers) — same "missing input, not a detected problem" carve-out
 * the presence-only check this replaces already had.
 */
export function checkLyricLanguageMatch(lyrics: string, language: LyricLanguage): LyricLanguageCheck | undefined {
  if (!lyrics.trim()) return undefined;
  const { text, lines } = stripLyricsToBody(lyrics);
  if (!text.trim()) return undefined;
  const ratios = measureLyricLanguageRatios(lyrics);

  if (language === 'bilingual') {
    const hasKoreanScript = ratios.hangulRatio > 0;
    const hasJapaneseScript = ratios.kanaKanjiRatio > 0;
    if (!hasKoreanScript && !hasJapaneseScript) {
      return { ok: false, ratios, bilingualDetail: { englishLines: 0, otherLines: 0, otherLanguage: 'korean' } };
    }
    const otherLanguage: 'korean' | 'japanese' = ratios.kanaKanjiRatio > ratios.hangulRatio ? 'japanese' : 'korean';
    const counts = realLanguageLineCounts(lines);
    const otherLines = otherLanguage === 'japanese' ? counts.japanese : counts.korean;
    const ok = counts.english >= BILINGUAL_MIN_REAL_LINES && otherLines >= BILINGUAL_MIN_REAL_LINES;
    return { ok, ratios, bilingualDetail: { englishLines: counts.english, otherLines, otherLanguage } };
  }

  if (language === 'korean') {
    return { ok: ratios.hangulRatio >= KOREAN_HANGUL_RATIO_MIN && ratios.kanaRatio <= KOREAN_KANA_RATIO_MAX, ratios };
  }
  if (language === 'japanese') {
    return { ok: ratios.kanaKanjiRatio >= JAPANESE_SCRIPT_RATIO_MIN && ratios.hangulRatio <= JAPANESE_HANGUL_RATIO_MAX, ratios };
  }
  // english
  return { ok: ratios.latinRatio >= ENGLISH_LATIN_RATIO_MIN && (ratios.hangulRatio + ratios.kanaRatio) <= ENGLISH_NON_LATIN_RATIO_MAX, ratios };
}

/**
 * TASK (ratio-based lyric language mismatch) — reuses checkLyricLanguageMatch
 * above (the real ratio/bilingual-line math), so
 * core/batchPreallocation.ts's reconcileWithPreassignedSlot — the one choke
 * point every non-local generation path (realtime, Batch API, Claude Code
 * bridge import, individual song regeneration) funnels an AI-produced song
 * through — can catch a raw model/bridge response whose `lyrics` body came
 * back in the wrong language, INCLUDING a mostly-right-language body that
 * only has a token amount of the target script (the v5.11-follow-up
 * presence-only check's real gap — see this file's own git history).
 *
 * Still surface-only, never fix: a language mismatch can't be safely
 * auto-corrected the way a wrong genre-id substring can (auto-translating
 * lyrics isn't something this function should ever do), so "detect and
 * surface" stays the realistic ceiling here — this function only ever
 * returns a warning string or undefined, it never touches `lyrics` itself.
 * Actually BLOCKING a track (vs. only warning) is a separate, stricter tier
 * this task also adds — see core/compositionScorer.ts's own per-track
 * language-ratio check, which is what core/compositionRecompose.ts's
 * recomposeBlockingTracks actually retries against; this function's return
 * value only ever lands in `song.warnings`, matching every other
 * reconciliation-time finding in batchPreallocation.ts (structureWarning,
 * genreWarning, ...).
 */
export function lyricLanguageMismatchWarning(lyrics: string, language: LyricLanguage, trackNo: number): string | undefined {
  const check = checkLyricLanguageMatch(lyrics, language);
  if (!check || check.ok) return undefined;
  const { ratios } = check;
  if (language === 'korean') {
    return `Track ${trackNo}: lyricLanguage is 'korean' but the lyrics body is only ${Math.round(ratios.hangulRatio * 100)}% Hangul (minimum ${Math.round(KOREAN_HANGUL_RATIO_MIN * 100)}%) or has too much Japanese kana (${Math.round(ratios.kanaRatio * 100)}%, maximum ${Math.round(KOREAN_KANA_RATIO_MAX * 100)}%) — possible language mismatch.`;
  }
  if (language === 'japanese') {
    return `Track ${trackNo}: lyricLanguage is 'japanese' but the lyrics body is only ${Math.round(ratios.kanaKanjiRatio * 100)}% kana/kanji (minimum ${Math.round(JAPANESE_SCRIPT_RATIO_MIN * 100)}%) or has too much Hangul (${Math.round(ratios.hangulRatio * 100)}%, maximum ${Math.round(JAPANESE_HANGUL_RATIO_MAX * 100)}%) — possible language mismatch.`;
  }
  if (language === 'english') {
    return `Track ${trackNo}: lyricLanguage is 'english' but the lyrics body is only ${Math.round(ratios.latinRatio * 100)}% Latin script (minimum ${Math.round(ENGLISH_LATIN_RATIO_MIN * 100)}%) or has too much Hangul/kana (${Math.round((ratios.hangulRatio + ratios.kanaRatio) * 100)}%, maximum ${Math.round(ENGLISH_NON_LATIN_RATIO_MAX * 100)}%) — possible language mismatch.`;
  }
  // bilingual
  const detail = check.bilingualDetail!;
  if (ratios.hangulRatio === 0 && ratios.kanaKanjiRatio === 0) {
    return `Track ${trackNo}: lyricLanguage is 'bilingual' but the lyrics body has no Korean or Japanese content at all — possible language mismatch.`;
  }
  return `Track ${trackNo}: lyricLanguage is 'bilingual' but doesn't have at least ${BILINGUAL_MIN_REAL_LINES} real (multi-word) lines in both English and ${detail.otherLanguage} (found ${detail.englishLines} English, ${detail.otherLines} ${detail.otherLanguage}) — possible language mismatch (low-effort or single-language response).`;
}

/**
 * TASK (ratio-based lyric language mismatch) — Korean-language sibling of
 * lyricLanguageMismatchWarning above, for core/compositionScorer.ts's new
 * per-track BLOCKING check (every other finding in that file is Korean-
 * language text — 라벨Ko naming convention — unlike batchPreallocation.ts's
 * English-language reconciliation-time warnings). Same
 * checkLyricLanguageMatch call underneath, so the two never disagree on
 * WHETHER a track is mismatched, only on what language they report it in
 * and (via CompositionScore.blocking vs. song.warnings) how severely the
 * two different consumers treat the same finding.
 */
export function lyricLanguageMismatchReasonKo(lyrics: string, language: LyricLanguage): string | undefined {
  const check = checkLyricLanguageMatch(lyrics, language);
  if (!check || check.ok) return undefined;
  const { ratios } = check;
  if (language === 'korean') {
    return `lyricLanguage가 'korean'인데 가사 본문의 한글 비율이 ${Math.round(ratios.hangulRatio * 100)}%입니다 (최소 ${Math.round(KOREAN_HANGUL_RATIO_MIN * 100)}%) 또는 가나 비율이 ${Math.round(ratios.kanaRatio * 100)}%로 너무 높습니다 (최대 ${Math.round(KOREAN_KANA_RATIO_MAX * 100)}%) — 언어 불일치 가능성이 큽니다.`;
  }
  if (language === 'japanese') {
    return `lyricLanguage가 'japanese'인데 가사 본문의 가나/한자 비율이 ${Math.round(ratios.kanaKanjiRatio * 100)}%입니다 (최소 ${Math.round(JAPANESE_SCRIPT_RATIO_MIN * 100)}%) 또는 한글 비율이 ${Math.round(ratios.hangulRatio * 100)}%로 너무 높습니다 (최대 ${Math.round(JAPANESE_HANGUL_RATIO_MAX * 100)}%) — 언어 불일치 가능성이 큽니다.`;
  }
  if (language === 'english') {
    return `lyricLanguage가 'english'인데 가사 본문의 라틴 문자 비율이 ${Math.round(ratios.latinRatio * 100)}%입니다 (최소 ${Math.round(ENGLISH_LATIN_RATIO_MIN * 100)}%) 또는 한글/가나 비율이 ${Math.round((ratios.hangulRatio + ratios.kanaRatio) * 100)}%로 너무 높습니다 (최대 ${Math.round(ENGLISH_NON_LATIN_RATIO_MAX * 100)}%) — 언어 불일치 가능성이 큽니다.`;
  }
  // bilingual
  const detail = check.bilingualDetail!;
  if (ratios.hangulRatio === 0 && ratios.kanaKanjiRatio === 0) {
    return `lyricLanguage가 'bilingual'인데 가사 본문에 한글/일본어가 전혀 없습니다 — 언어 불일치 가능성이 큽니다.`;
  }
  return `lyricLanguage가 'bilingual'인데 영어와 ${detail.otherLanguage === 'japanese' ? '일본어' : '한국어'} 각각 실질 문장(2단어 이상)이 최소 ${BILINGUAL_MIN_REAL_LINES}줄씩 필요합니다 (실제 영어 ${detail.englishLines}줄, ${detail.otherLanguage === 'japanese' ? '일본어' : '한국어'} ${detail.otherLines}줄) — 성의 없는 응답이거나 단일 언어 응답일 가능성이 큽니다.`;
}
