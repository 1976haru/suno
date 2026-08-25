import type { LyricLanguage } from '../types';

/**
 * codex 지시문 03 (TASK J) — real investigation finding: English already has
 * substantial infrastructure (core/englishLint.ts's grammar-regex/
 * forced-metaphor/abstract-noun-density checks) — this module adds the two
 * genuinely missing English checks (syllable density, consonant-cluster
 * pronounceability) using the same simple vowel-cluster technique
 * core/lyricMetrics.ts's own approximateSyllables already established (not
 * imported — that function is private to that file; same technique,
 * independently applied here, since re-exporting a private helper from a
 * well-tested, unrelated-purpose file for one new caller isn't worth the
 * coupling).
 *
 * Korean/Japanese had almost no existing quality-check infrastructure
 * (confirmed by investigation — only a narrow English-word-particle-glue
 * check scoped to bilingual content, core/bilingualLint.ts). Building a
 * real, general Korean/Japanese GRAMMAR checker (조사/어미 정확성, 명사
 * 나열) would need real morphological analysis this codebase has no
 * precedent for and no way to validate reliably — so, matching this
 * session's established false-positive discipline (see e.g.
 * core/artistReferenceDecomposer.ts's own "breaking bread at the table"
 * P0 incident, or core/kidsLyricEngine.ts's narrow blacklist-only safety
 * scanner), this module ships the one class of Korean/Japanese quality
 * signal that IS reliably detectable without morphological analysis: a
 * small, real, fixed list of 번역체/직역체 (translationese) MARKER PHRASES —
 * grammatical constructions that read as machine-translated-from-English
 * regardless of surrounding content, not a general grammar judgment.
 * 조사/어미 correctness, general noun-stacking, and kids vocabulary-
 * simplicity scoring are explicitly left undone (미구현) — the honest call
 * given no reliable way to check them without a real Korean/Japanese NLP
 * pipeline this codebase doesn't have.
 */

// ---------------------------------------------------------------------------
// English — syllable density + consonant-cluster pronounceability
// ---------------------------------------------------------------------------

const VOWEL_CLUSTER_PATTERN = /[aeiouy]+/gi;
/** Same technique/threshold class as lyricMetrics.ts's own approximateSyllables — at least 1 syllable per real word, never 0. */
function approximateSyllableCount(word: string): number {
  const clusters = word.match(VOWEL_CLUSTER_PATTERN);
  return Math.max(1, clusters ? clusters.length : 1);
}

/** Real, singable English pop lyrics run close to 1.2-1.4 syllables/word on average (short, punchy words); a line averaging 2+ reads as prose, not a lyric — advisory only, never blocking, since this is a style preference, not a correctness rule. */
const SYLLABLE_DENSITY_ADVISORY_THRESHOLD = 2.0;

export interface EnglishLyricLineQualityFinding {
  line: string;
  kind: 'syllable-density' | 'consonant-cluster';
  detail: string;
}

export function englishSyllableDensityWarning(line: string): EnglishLyricLineQualityFinding | undefined {
  const words = line.trim().split(/\s+/).filter(w => /[a-z]/i.test(w));
  if (words.length < 3) return undefined;
  const totalSyllables = words.reduce((sum, word) => sum + approximateSyllableCount(word), 0);
  const density = totalSyllables / words.length;
  if (density < SYLLABLE_DENSITY_ADVISORY_THRESHOLD) return undefined;
  return { line, kind: 'syllable-density', detail: `~${density.toFixed(1)} syllables/word — may read as dense prose rather than a singable line` };
}

/**
 * A real 5+ LETTER consonant cluster within one word (e.g. "strengths" ->
 * "ngths", "twelfths" -> "lfths") is genuinely hard to sing on a single
 * syllable — advisory only. Deliberately 5+, not 4+: English spelling
 * doesn't reflect pronunciation (silent letters), and a 4-letter threshold
 * flags completely ordinary, easily-sung words like "lights"/"nights"/
 * "rights" (their "ghts" cluster's "gh" is silent) — real-measured false
 * positive this threshold was raised specifically to avoid.
 */
const HARD_CONSONANT_CLUSTER_PATTERN = /[bcdfghjklmnpqrstvwxz]{5,}/i;

export function englishConsonantClusterWarning(line: string): EnglishLyricLineQualityFinding | undefined {
  const words = line.trim().split(/\s+/).filter(w => /[a-z]/i.test(w));
  const hardWord = words.find(word => HARD_CONSONANT_CLUSTER_PATTERN.test(word));
  if (!hardWord) return undefined;
  return { line, kind: 'consonant-cluster', detail: `"${hardWord}" has a hard-to-sing consonant cluster` };
}

export function checkEnglishLyricLineQuality(lines: string[]): EnglishLyricLineQualityFinding[] {
  const findings: EnglishLyricLineQualityFinding[] = [];
  for (const line of lines) {
    const density = englishSyllableDensityWarning(line);
    if (density) findings.push(density);
    const cluster = englishConsonantClusterWarning(line);
    if (cluster) findings.push(cluster);
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Korean / Japanese — bounded translationese marker detection
// ---------------------------------------------------------------------------

/**
 * A small, real set of Korean grammatical constructions that read as
 * machine-translated-from-English regardless of context — passive-voice
 * "~에 의해" (by X), reported-speech "~라고 말했다"/"~것으로 보인다" (it is
 * said that/it appears that), and "그러나"/"하지만" used as a stiff
 * sentence-opening "however" (the literal English discourse-marker
 * position, unusual in sung Korean lyrics). Deliberately NOT a general
 * grammar checker — these are the specific constructions that are genuine
 * translationese tells, not merely "unusual" Korean.
 */
const KOREAN_TRANSLATIONESE_PATTERNS: RegExp[] = [
  /에\s*의해/,
  /것으로\s*보인다/,
  /라고\s*말했다/,
  /^(그러나|하지만)[,\s]/
];

export function koreanTranslationeseWarning(line: string): string | undefined {
  const match = KOREAN_TRANSLATIONESE_PATTERNS.find(pattern => pattern.test(line));
  if (!match) return undefined;
  return `"${line.trim()}" reads as translationese (번역체) — a construction typical of machine-translated-from-English Korean, not natural sung Korean.`;
}

/**
 * Japanese equivalent — passive-voice "〜によって" (by X), reported-speech
 * "〜と言った"/"〜ようだ" as a stiff clause-final hedge, same bounded,
 * fixed-phrase scope as Korean above.
 */
const JAPANESE_TRANSLATIONESE_PATTERNS: RegExp[] = [
  /によって/,
  /と言った/,
  /ということだ/
];

export function japaneseTranslationeseWarning(line: string): string | undefined {
  const match = JAPANESE_TRANSLATIONESE_PATTERNS.find(pattern => pattern.test(line));
  if (!match) return undefined;
  return `"${line.trim()}" reads as translationese (直訳体) — a construction typical of machine-translated-from-English Japanese, not natural sung Japanese.`;
}

export function checkTranslationese(lines: string[], language: LyricLanguage): string[] {
  const check = language === 'korean' ? koreanTranslationeseWarning : language === 'japanese' ? japaneseTranslationeseWarning : undefined;
  if (!check) return [];
  return lines.map(check).filter((w): w is string => Boolean(w));
}
