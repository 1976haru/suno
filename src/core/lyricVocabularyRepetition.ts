import type { SongIdea } from '../types';

/**
 * TASK v3.64 (TASK A-4) — real measurement: a real 18-song pack repeated a
 * handful of generic nouns far more than any single song's own hook
 * repetition would explain (window 28x, light 27x, old 27x, near 22x —
 * roughly 1.5x per song on average). This is a pack-wide vocabulary-choice
 * problem, not a per-song sentence-generation one, so it lives here as its
 * own small module rather than in lyricEngine.ts/lyricVocabularyGuard.ts
 * (explicitly off-limits — this task changes topic *allocation*, never
 * sentence generation).
 */
const SECTION_TAG_LINE_PATTERN = /^\s*\[[^\]]*\]\s*$/;
const WORD_PATTERN = /[a-z']+/gi;

export const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'in', 'on', 'at', 'to', 'of', 'for', 'with', 'is', 'are',
  'was', 'were', 'my', 'your', 'his', 'her', 'their', 'our', 'this', 'that', 'these', 'those', 'it',
  'its', 'i', 'you', 'he', 'she', 'we', 'they', 'as', 'so', 'if', 'not', 'no', 'do', 'does', 'did',
  'from', 'by', 'be', 'been', 'has', 'have', 'had', 'will', 'would', 'can', 'could', 'just', 'now',
  'still', 'one', 'all', 'up', 'out', 'down', 'into', 'over', 'under', 'then', 'than', 'when',
  'where', 'how', 'what', 'who', 'which', 'there', 'here', 'some', 'more', 'most', 'every', 'each',
  'both', 'only', 'also', 'too', 'very', 'like', 'through', 'before', 'after', 'while', 'again',
  'me', 'us', 'them', 'am', 'll', 're', 've', 'd', 's', 't', 'm', 'on', 'off', 'yet', 'ever', 'never',
  // Structural/filler verbs common to any ballad regardless of scene content (e.g. "let the light in",
  // "I said", "I wait", "I know") — not the kind of vocabulary-choice repetition this check targets.
  'let', 'said', 'know', 'wait'
]);

/** Channel-identity words get a higher cap (20) than generic vocabulary (12) — see this module's own doc comment for why "morning"/"warm"/"coffee" specifically match the real measured data. */
export const CHANNEL_IDENTITY_WORDS = new Set(['morning', 'warm', 'coffee']);

export const GENERIC_WORD_CAP = 12;
export const CHANNEL_IDENTITY_WORD_CAP = 20;

/** Strips bracket-tag-only lines (e.g. "[chorus]") before counting — a repeated section tag isn't a vocabulary-choice problem. */
function lyricBodyOnly(lyrics: string): string {
  return lyrics
    .split('\n')
    .filter(line => !SECTION_TAG_LINE_PATTERN.test(line))
    .join('\n');
}

export function wordFrequencyAcrossPack(songs: Pick<SongIdea, 'lyrics'>[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const song of songs) {
    const body = lyricBodyOnly(song.lyrics).toLowerCase();
    const words = body.match(WORD_PATTERN) ?? [];
    for (const raw of words) {
      const word = raw.replace(/'+$/, '').replace(/^'+/, '');
      if (!word || word.length < 3 || STOPWORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return counts;
}

export interface VocabularyRepetitionFinding {
  word: string;
  count: number;
  cap: number;
}

/** TASK A-4 — warning-level only (never blocks): every word whose pack-wide count exceeds its cap (12 generic / 20 channel-identity). */
export function findExcessiveVocabularyRepetition(songs: Pick<SongIdea, 'lyrics'>[]): VocabularyRepetitionFinding[] {
  const counts = wordFrequencyAcrossPack(songs);
  const findings: VocabularyRepetitionFinding[] = [];
  for (const [word, count] of counts) {
    const cap = CHANNEL_IDENTITY_WORDS.has(word) ? CHANNEL_IDENTITY_WORD_CAP : GENERIC_WORD_CAP;
    if (count > cap) findings.push({ word, count, cap });
  }
  return findings.sort((a, b) => b.count - a.count);
}

/** Top N words by pack-wide frequency, regardless of whether they exceed a cap — for reporting (see this task's own mandatory report format: "어휘 빈도 상위 20개"). */
export function topWordFrequencies(songs: Pick<SongIdea, 'lyrics'>[], limit = 20): { word: string; count: number }[] {
  return [...wordFrequencyAcrossPack(songs).entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface HookWordOveruseFinding {
  word: string;
  /** Number of DISTINCT hooks (not raw occurrences) this word appears in. */
  hookCount: number;
}

/**
 * v4.2 (TASK A3 / TASK D) — new check per this task's own §5-2 "훅에서의
 * 반복: 같은 단어가 훅 3개 이상에 등장하면 advisory". Real measurement: "every"
 * appeared in 3 of 18 hooks ("Every Light Tonight" / "Every Mile Tells
 * More" / "Open Every Window"). Distinct from findExcessiveVocabularyRepetition
 * above, which counts raw word occurrences across LYRIC BODIES; this counts
 * DISTINCT HOOKS a word appears in — a word can be pack-wide-common without
 * ever anchoring 3+ different hooks, and vice versa for a rare word that
 * happens to anchor several hooks.
 */
export function findHookWordOveruse(songs: Pick<SongIdea, 'hookPhrase'>[], minHooks = 3): HookWordOveruseFinding[] {
  const hookIndexesByWord = new Map<string, Set<number>>();
  songs.forEach((song, idx) => {
    const words = new Set(
      ((song.hookPhrase ?? '').toLowerCase().match(WORD_PATTERN) ?? [])
        .map(raw => raw.replace(/'+$/, '').replace(/^'+/, ''))
        .filter(word => word && word.length >= 3 && !STOPWORDS.has(word))
    );
    for (const word of words) {
      if (!hookIndexesByWord.has(word)) hookIndexesByWord.set(word, new Set());
      hookIndexesByWord.get(word)!.add(idx);
    }
  });
  const findings: HookWordOveruseFinding[] = [];
  for (const [word, idxSet] of hookIndexesByWord) {
    if (idxSet.size >= minHooks) findings.push({ word, hookCount: idxSet.size });
  }
  return findings.sort((a, b) => b.hookCount - a.hookCount);
}
