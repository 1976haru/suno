import { ARRANGEMENT_SUBJECT_VERBS } from '../data/arrangementVocabulary';
import {
  COMPOSITION_META_SUBJECT_WORDS_EN,
  COMPOSITION_META_SUBJECT_VERBS_EN,
  COMPOSITION_META_DIRECTIVE_PATTERNS_EN,
  COMPOSITION_META_DIRECTIVE_PATTERNS_KO,
  COMPOSITION_META_DIRECTIVE_PATTERNS_JA
} from '../data/compositionMetaVocabulary';
import type { LyricLanguage } from '../types';

/**
 * codex 지시문 03 (TASK G) — real, reusable architectural precedent this
 * extends: core/lyricVocabularyGuard.ts's findArrangementVocabularyInLyrics
 * already solves the identical problem shape (a technical/instructional
 * vocabulary word must not be the line's grammatical SUBJECT of a motion/
 * state verb) for arrangement/production vocabulary. This module reuses the
 * exact same subject-verb-adjacency architecture for TASK G's own,
 * different vocabulary (hook/melody/chorus/arrangement/key + rise/lift/
 * open/come/change), and adds Korean/Japanese coverage via bounded
 * directive-phrase regexes (data/compositionMetaVocabulary.ts) matching
 * this task's own literal examples, narrative-vs-meta disambiguation
 * achieved the same way English's does: a bare noun with no adjacent
 * directive verb never matches (e.g. "그대 목소리의 멜로디를 기억해" —
 * "I remember the melody of your voice" — has no directive verb next to
 * 멜로디를, so it never fires; "our song on the radio" / "a note in your
 * letter" are English's own equivalent non-matches, since neither has a
 * COMPOSITION_META_SUBJECT_VERBS_EN word immediately following).
 */

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const AUX_INFIX_WORDS = [
  'will', 'can', 'could', 'would', 'should', 'must', 'may', 'might',
  'is', 'was', 'are', 'were', 'has', 'have', 'had', 'do', 'does', 'did',
  'still', 'softly', 'gently', 'slowly', 'quietly', 'now', 'again', 'always', 'never', 'just'
];

const SUBJECT_WORD_PATTERN = COMPOSITION_META_SUBJECT_WORDS_EN.map(escapeRegex).join('|');
const VERB_PATTERN = [...new Set([...ARRANGEMENT_SUBJECT_VERBS, ...COMPOSITION_META_SUBJECT_VERBS_EN])].map(escapeRegex).join('|');
const AUX_PATTERN = AUX_INFIX_WORDS.map(escapeRegex).join('|');

/** Same "noun-as-subject immediately (within 0-2 tolerated auxiliary words) followed by a motion/state verb" shape as lyricVocabularyGuard.ts's SUBJECT_LEAK_PATTERN — reused here, not duplicated logic, just a different vocabulary pair. */
const SUBJECT_VERB_LEAK_PATTERN_EN = new RegExp(
  `\\b(?:${SUBJECT_WORD_PATTERN})\\b(?:\\s+(?:${AUX_PATTERN})){0,2}\\s+(?:${VERB_PATTERN})\\b`,
  'i'
);

function isLyricBodyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^\[[^\]]*\]$/.test(trimmed)) return false;
  if (/^Title:/i.test(trimmed)) return false;
  if (/no lyrics/i.test(trimmed)) return false;
  return true;
}

export interface LyricMetaLeakFinding {
  trackNo: number;
  line: string;
  language: LyricLanguage;
}

function directivePatternsFor(language: LyricLanguage): RegExp[] {
  switch (language) {
    case 'korean':
      return COMPOSITION_META_DIRECTIVE_PATTERNS_KO;
    case 'japanese':
      return COMPOSITION_META_DIRECTIVE_PATTERNS_JA;
    case 'bilingual':
      return [...COMPOSITION_META_DIRECTIVE_PATTERNS_EN, ...COMPOSITION_META_DIRECTIVE_PATTERNS_KO, ...COMPOSITION_META_DIRECTIVE_PATTERNS_JA];
    case 'english':
    default:
      return COMPOSITION_META_DIRECTIVE_PATTERNS_EN;
  }
}

function lineHasLeak(line: string, language: LyricLanguage): boolean {
  if ((language === 'english' || language === 'bilingual') && SUBJECT_VERB_LEAK_PATTERN_EN.test(line)) return true;
  return directivePatternsFor(language).some(pattern => pattern.test(line));
}

/**
 * Scans every real sung lyric line (bracket tags/Title:/self-declared
 * "no lyrics" cues excluded, same as lyricVocabularyGuard.ts's own
 * isLyricBodyLine) for a composition/performance-instruction meta-leak —
 * "hold that note", "the hook comes home", "sing higher", a literal key
 * change/modulation/BPM mention, or their Korean/Japanese equivalents.
 */
export function findLyricMetaLeaks(songs: { trackNo: number; lyrics: string }[], language: LyricLanguage): LyricMetaLeakFinding[] {
  const findings: LyricMetaLeakFinding[] = [];
  for (const song of songs) {
    for (const rawLine of song.lyrics.split('\n')) {
      if (!isLyricBodyLine(rawLine)) continue;
      const line = rawLine.trim();
      if (!lineHasLeak(line, language)) continue;
      findings.push({ trackNo: song.trackNo, line, language });
    }
  }
  return findings;
}

export function lyricMetaLeakWarning(lyrics: string, trackNo: number, language: LyricLanguage): string | undefined {
  const findings = findLyricMetaLeaks([{ trackNo, lyrics }], language);
  if (!findings.length) return undefined;
  return `Track ${trackNo}: lyrics contain a composition/performance instruction leaked as sung content — "${findings[0].line}".`;
}
