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

/**
 * 지시문 17 (TASK A-3) — "blocking 은 주어-동사 인접 구조가 일치한 경우"라는
 * 요구를 실제 코드로 옮기면, 이 파일에 이미 있는 subject-verb-adjacency/
 * directive-phrase 매칭 그 자체가 그 "일치"다 — 별도의 "명사만 있으면
 * advisory" 매칭기를 새로 만들지 않는다(§ 하지 말 것 "주어-동사 인접
 * 구조를 버리고 명사 단독 매칭으로 바꾸지 말 것"과 정면으로 충돌하고,
 * 실제로 "we danced to that old refrain"/"a chord of memory"/"the beat of
 * your heart"/"harmony between us" 같은 TASK A-2 허용 예문 4개가 전부 새
 * 주어 어휘를 명사로만 담고 있어 그 설계로는 즉시 오탐이 난다 — 검증
 * 결과는 이 파일과 짝지어진 tests/lyricMetaLeakSeverity.test.ts 참고).
 * 대신 심각도는 어떤 "언어"의 패턴이 실제로 매칭됐는지로 정한다 — 영어는
 * 워크스페이스의 verified 여부와 무관하게 항상 blocking(작곡 지시 유출은
 * 어디서든 명백한 오류), 한국어·일본어는 아직 실측이 없어 advisory로
 * 시작한다(지시문 17 §2-4).
 */
export type LyricMetaLeakSeverity = 'blocking' | 'advisory';
type LyricMetaLeakMatchLanguage = 'english' | 'korean' | 'japanese';

export interface LyricMetaLeakFinding {
  trackNo: number;
  line: string;
  language: LyricLanguage;
  severity: LyricMetaLeakSeverity;
}

function severityForMatchLanguage(matchLanguage: LyricMetaLeakMatchLanguage): LyricMetaLeakSeverity {
  return matchLanguage === 'english' ? 'blocking' : 'advisory';
}

/** 곡 전체의 language 필드가 아니라, 이 한 줄이 실제로 어느 언어 패턴에 걸렸는지를 판정한다(bilingual 곡은 줄마다 다를 수 있다). */
function matchedLanguageFor(line: string, songLanguage: LyricLanguage): LyricMetaLeakMatchLanguage | undefined {
  const checkEnglish = songLanguage === 'english' || songLanguage === 'bilingual';
  const checkKorean = songLanguage === 'korean' || songLanguage === 'bilingual';
  const checkJapanese = songLanguage === 'japanese' || songLanguage === 'bilingual';
  if (checkEnglish && (SUBJECT_VERB_LEAK_PATTERN_EN.test(line) || COMPOSITION_META_DIRECTIVE_PATTERNS_EN.some(pattern => pattern.test(line)))) {
    return 'english';
  }
  if (checkKorean && COMPOSITION_META_DIRECTIVE_PATTERNS_KO.some(pattern => pattern.test(line))) return 'korean';
  if (checkJapanese && COMPOSITION_META_DIRECTIVE_PATTERNS_JA.some(pattern => pattern.test(line))) return 'japanese';
  return undefined;
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
      const matchLanguage = matchedLanguageFor(line, language);
      if (!matchLanguage) continue;
      findings.push({ trackNo: song.trackNo, line, language, severity: severityForMatchLanguage(matchLanguage) });
    }
  }
  return findings;
}

/** 지시문 17 (TASK A-3) — findLyricMetaLeaks의 별칭. 지시문 원문이 이름 붙인 함수명(lyricMetaLeakFindings)으로도 호출할 수 있게 한다 — 동작은 동일하다. */
export const lyricMetaLeakFindings = findLyricMetaLeaks;

export function lyricMetaLeakWarning(lyrics: string, trackNo: number, language: LyricLanguage): string | undefined {
  const findings = findLyricMetaLeaks([{ trackNo, lyrics }], language);
  if (!findings.length) return undefined;
  const finding = findings[0];
  const severityTag = finding.severity === 'blocking' ? ' [blocking]' : ' [advisory]';
  return `Track ${trackNo}: lyrics contain a composition/performance instruction leaked as sung content${severityTag} — "${finding.line}".`;
}
