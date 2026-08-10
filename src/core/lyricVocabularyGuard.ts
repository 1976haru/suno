import { ARRANGEMENT_SUBJECT_VERBS, ARRANGEMENT_VOCABULARY } from '../data/arrangementVocabulary';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const VOCAB_PATTERN = ARRANGEMENT_VOCABULARY.map(escapeRegex).join('|');
const VERB_PATTERN = ARRANGEMENT_SUBJECT_VERBS.map(escapeRegex).join('|');

/**
 * v4.4 (TASK B) — a small, closed set of auxiliary/modal/copula words and a
 * few common manner adverbs that may sit between the arrangement noun and
 * its verb without breaking the "this noun is the line's subject" reading
 * ("the string WILL HOLD it", "the strings ARE STILL RISING"). Deliberately
 * NOT open-ended (no arbitrary word skipping) — each slot in the gap must
 * itself be one of these words, so an unrelated word ("the guitar MY FATHER
 * still plays") breaks the chain and correctly falls through to no match,
 * preserving the original false-positive-avoidance design.
 */
const AUX_INFIX_WORDS = [
  'will', 'can', 'could', 'would', 'should', 'must', 'may', 'might',
  'is', 'was', 'are', 'were', 'has', 'have', 'had', 'do', 'does', 'did',
  'still', 'softly', 'gently', 'slowly', 'quietly', 'now', 'again', 'always', 'never', 'just',
];
const AUX_PATTERN = AUX_INFIX_WORDS.map(escapeRegex).join('|');

/**
 * TASK v3.60 (TASK A-2) — "the arrangement/production term is the line's
 * grammatical subject" is narrowed to "an arrangement-vocabulary word is
 * immediately followed by a motion/state verb" (see arrangementVocabulary.ts's
 * own doc comment for the real examples this was built against). Matches
 * anywhere in the line, not just at the start, so a compound subject like
 * "The bass and drums fall silent" is still caught via "drums fall" even
 * though "bass" itself is followed by "and". Deliberately does NOT match
 * an arrangement word used as an object ("I hold my father's guitar" has
 * nothing after "guitar" for this pattern to latch onto) or modified by an
 * unrelated noun ("a brass lamp warms..." — "brass" is followed by "lamp",
 * not a verb).
 *
 * v4.4 (TASK B) — real measurement (tests/fixtures/historical/bridge-import-sample.json)
 * found a leak this missed: "the string WILL HOLD it tight" — an auxiliary
 * sat between the noun and verb, so the old immediately-adjacent match
 * never fired. Now tolerates 0-2 words from the closed AUX_INFIX_WORDS set
 * in that gap (see its own doc comment above for why this doesn't reopen
 * the false-positive problem the original design avoided).
 */
const SUBJECT_LEAK_PATTERN = new RegExp(
  `\\b(?:${VOCAB_PATTERN})\\b(?:\\s+(?:${AUX_PATTERN})){0,2}\\s+(?:${VERB_PATTERN})\\b`,
  'i'
);

/**
 * A line is part of the sung lyric body if it isn't a bracket section tag
 * ([chorus], [verse 1], ...), isn't empty, and isn't a parenthetical
 * production/stage direction explicitly marked as unsung.
 *
 * v4.4 (TASK B) — real measurement found every local-generator pack
 * flagging the SAME false positive 4x/pack: '(instrumental hook, band
 * plays the melody, no lyrics, 2 bars)' (lyricEngine.ts's own instrumental
 * section text) — this line is never sung (says so itself), so it isn't a
 * lyric leak. Excluding lines that self-declare "no lyrics" fixes this
 * without touching lyricEngine.ts's own template text.
 */
function isLyricBodyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^\[[^\]]*\]$/.test(trimmed)) return false;
  if (/^Title:/i.test(trimmed)) return false;
  if (/no lyrics/i.test(trimmed)) return false;
  return true;
}

export interface LyricVocabularyFinding {
  trackNo: number;
  line: string;
  terms: string[];
}

function matchedTerms(line: string): string[] {
  const found = new Set<string>();
  const termPattern = new RegExp(`\\b(${VOCAB_PATTERN})\\b`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = termPattern.exec(line))) {
    found.add(match[1].toLowerCase());
  }
  return [...found];
}

/**
 * TASK v3.60 (TASK A-2) — a real bridge-imported pack sang its own
 * arrangement/production instructions ("Spiccato strings flicker over
 * quiet water", "The straight-pop drums move softly") because the bridge
 * instruction told the agent to weave those exact terms into the style
 * prompt, but never said they must NOT also appear in the lyric body — the
 * same leak class TASK 5-3/v3.59 TASK A fixed for other placeholder text,
 * recurring on the bridge path specifically. Scans every non-tag lyric
 * line for an arrangement-vocabulary word acting as the line's subject.
 */
export function findArrangementVocabularyInLyrics(
  songs: { trackNo: number; lyrics: string }[]
): LyricVocabularyFinding[] {
  const findings: LyricVocabularyFinding[] = [];
  for (const song of songs) {
    for (const rawLine of song.lyrics.split('\n')) {
      if (!isLyricBodyLine(rawLine)) continue;
      const line = rawLine.trim();
      if (!SUBJECT_LEAK_PATTERN.test(line)) continue;
      findings.push({ trackNo: song.trackNo, line, terms: matchedTerms(line) });
    }
  }
  return findings;
}

/**
 * TASK v3.60 (TASK A-3) — the actual measured pack had 15/17 songs
 * affected (88%) — the agent had systematically ignored the "stylePrompt-
 * only" intent, not made one or two incidental slips. At that rate the
 * pack should be treated as needing regeneration, not a per-song nudge;
 * below the threshold, individual songs are still usable and this is
 * informational only (see auditAlbum's own errors-vs-warnings split).
 */
export const ARRANGEMENT_VOCABULARY_SET_ERROR_RATIO = 0.3;

export function affectedTrackRatio(findings: LyricVocabularyFinding[], songCount: number): number {
  if (!songCount) return 0;
  return new Set(findings.map(finding => finding.trackNo)).size / songCount;
}
