import type { LyricLanguage } from '../types';
import {
  composeHook,
  estimateSyllables,
  hookRhythmLength,
  isWithinHookLengthBounds,
  type HookContext,
  type HookEmotionalWeight,
  type HookSpec
} from './lyricEngine';
import { hasVocativeObjectPattern, startsWithLowercase } from './quality';

export type OpeningRole = 'cold-open' | 'flagship';

export interface OpeningPackContext {
  /** Accepted for interface symmetry with dominantMoodIds — see scoreRepresentativeness for why genre isn't actually scored against. */
  dominantGenreIds: string[];
  dominantMoodIds: string[];
}

export interface OpeningCandidate {
  hook: HookSpec;
  score: number;
  scoreBreakdown: {
    catchiness: number;
    representativeness: number;
    familiarity: number;
  };
}

export interface OpeningContestResult {
  role: OpeningRole;
  candidates: OpeningCandidate[];
  winner: OpeningCandidate;
}

/**
 * TASK I2 (v3.11) — a bare hook phrase carries no genre tag (genre lives on
 * GenrePack objects, never on the hook text itself), so genre overlap can't
 * be measured without inventing a fake keyword-matching heuristic against
 * arbitrary lyrics text — that would score noise, not signal. Emotional
 * weight ('medium' | 'high', already computed per-hook by
 * lyricEngine.hookEmotionalWeight) is the one real, objective property a
 * bare hook has, so representativeness is simple set overlap between the
 * pack's dominant moods' preferred intensity and the candidate's weight —
 * exactly the "무거운 통계 필요 없음" scope the brief asked for.
 */
const MOOD_PREFERRED_INTENSITY: Record<string, HookEmotionalWeight> = {
  nostalgic: 'high',
  bittersweet: 'high',
  romantic: 'high',
  warm: 'medium',
  hopeful: 'medium',
  christmas: 'medium',
  'calm-focus': 'medium',
  'fresh-start': 'medium',
  'rainy-comfort': 'medium',
  elegant: 'medium'
};

/**
 * Rebuilds (without duplicating) the same rule-based penalties
 * quality.ts's checkHookQuality applies — length bounds, vocative-object
 * safety net, lowercase start, target rhythm — minus the two checks that
 * need lyrics/title to exist yet (hook-repeat count, title-contains-hook),
 * since the contest runs before either is written. Exported for tests that
 * compare a contest-picked hook's catchiness against a plain single-draw
 * hook elsewhere in the same pack.
 */
export function scoreCatchiness(hook: HookSpec, language: LyricLanguage, targetSyllables?: number): number {
  let score = 100;
  if (!isWithinHookLengthBounds(hook.phrase, language)) score -= 20;
  if (startsWithLowercase(hook.phrase)) score -= 10;
  if (hasVocativeObjectPattern(hook.phrase)) score -= 25;
  if (targetSyllables && Math.abs(hookRhythmLength(hook.phrase, language) - targetSyllables) > 1) score -= 10;
  return Math.max(0, score);
}

function scoreRepresentativeness(hook: HookSpec, packContext: OpeningPackContext): number {
  if (!packContext.dominantMoodIds.length) return 50;
  const matches = packContext.dominantMoodIds.filter(id => (MOOD_PREFERRED_INTENSITY[id] || 'medium') === hook.emotionalWeight).length;
  return Math.round((matches / packContext.dominantMoodIds.length) * 100);
}

// ---------------------------------------------------------------------------
// v3.15 — "familiarity" scoring. Every check below is a text-level proxy for
// how easy a bare hook phrase is to pick up on first listen (short, ends on
// an open/singable sound, repeats its own rhythm, leans on common words,
// avoids hard consonant clusters). None of it looks at melody, rhythm audio,
// or any specific existing song — it's the same generic "easy to hum" shape
// shared by decades of pop hooks, not a fingerprint of one.
// ---------------------------------------------------------------------------

type ResolvedHookLanguage = 'english' | 'korean' | 'japanese';

function resolveLanguage(language: LyricLanguage): ResolvedHookLanguage {
  return language === 'bilingual' ? 'english' : language;
}

/** Sweet-spot syllable/mora windows from the brief: EN 2-4, KO 4-8, JA 5-10. Outside the window, score falls off gradually rather than cliff-dropping to 0. */
const FAMILIARITY_SWEET_SPOT: Record<ResolvedHookLanguage, [number, number]> = {
  english: [2, 4],
  korean: [4, 8],
  japanese: [5, 10]
};

function sweetSpotScore(length: number, language: ResolvedHookLanguage): number {
  const [min, max] = FAMILIARITY_SWEET_SPOT[language];
  if (length >= min && length <= max) return 25;
  const distance = length < min ? min - length : length - max;
  return Math.max(0, 25 - distance * 6);
}

function stripPunctuation(word: string): string {
  return word.replace(/[,.!?'"…、。]/g, '');
}

function endsOnOpenVowel(word: string, language: ResolvedHookLanguage): boolean {
  const clean = stripPunctuation(word).trim();
  if (!clean) return false;
  if (language === 'korean') {
    const last = clean.slice(-1);
    const code = last.charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return false;
    return (code - 0xac00) % 28 === 0; // no batchim (받침) — open syllable
  }
  if (language === 'japanese') {
    const last = clean.slice(-1);
    return last !== 'ん' && last !== 'ン' && last !== 'っ' && last !== 'ッ';
  }
  return /[aeiouy]/i.test(clean.slice(-1));
}

/** English/Korean split on whitespace (real word boundaries); Japanese has none, so the whole phrase is treated as a single unit — a coarser but still meaningful proxy for "does this hook end on an open, singable sound". */
function vowelEndingScore(phrase: string, language: ResolvedHookLanguage): number {
  if (language === 'japanese') {
    return endsOnOpenVowel(phrase, language) ? 15 : 0;
  }
  const words = phrase.split(/\s+/).map(stripPunctuation).filter(Boolean);
  if (!words.length) return 0;
  const openCount = words.filter(word => endsOnOpenVowel(word, language)).length;
  return Math.round((openCount / words.length) * 15);
}

/** Splits into rhythm "cells" for repetition-checking: whitespace-delimited words for EN/KO, comma/、-delimited clauses for JA (which has no whitespace word boundary). */
function rhythmCells(phrase: string, language: ResolvedHookLanguage): string[] {
  if (language === 'japanese') {
    return phrase.split(/[,、]+/).map(cell => cell.trim()).filter(Boolean);
  }
  return phrase.split(/\s+/).map(stripPunctuation).filter(Boolean);
}

/**
 * "리듬 셀이 1회 이상 반복되면 가점" — a generic proxy: if two or more cells in
 * the same hook share the same syllable count, the hook repeats its own
 * rhythmic skeleton (e.g. "Keep the Light On" / "Keep it Bright Tonight"-style
 * matching cadence), which is the repeatable-shape trait the brief describes.
 * Needs at least 2 cells to say anything about repetition.
 */
function rhythmRepetitionScore(phrase: string, language: ResolvedHookLanguage): number {
  const cells = rhythmCells(phrase, language);
  if (cells.length < 2) return 0;
  const counts = new Map<number, number>();
  for (const cell of cells) {
    const n = estimateSyllables(cell, language);
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  return [...counts.values()].some(count => count >= 2) ? 15 : 0;
}

// Small, generic high-frequency word lists (prepositions, short verbs, basic
// nouns) — not drawn from or matched against any specific song's lyrics.
const COMMON_WORDS: Record<ResolvedHookLanguage, Set<string>> = {
  english: new Set(['the', 'a', 'an', 'on', 'in', 'to', 'of', 'my', 'you', 'me', 'we', 'be', 'go', 'so', 'it', 'is', 'are', 'now', 'here', 'home', 'love', 'stay', 'hold', 'keep', 'wait', 'know', 'feel', 'come', 'back', 'still', 'with', 'for', 'one', 'more']),
  korean: new Set(['나', '너', '그대', '우리', '집', '사랑', '아침', '오늘', '다시', '아직', '여기', '그냥', '조금', '함께', '친구', '지금']),
  japanese: new Set(['わたし', '私', 'あなた', 'ここ', 'いま', '今', 'また', 'まだ', 'ずっと', 'ともに', '朝', '家', '歌', '愛'])
};

function commonWordScore(phrase: string, language: ResolvedHookLanguage): number {
  const dictionary = COMMON_WORDS[language];
  if (language === 'japanese') {
    const clean = phrase.replace(/[,、]/g, '');
    const matched = [...dictionary].filter(word => clean.includes(word)).length;
    return Math.min(15, matched * 6);
  }
  const words = phrase.split(/\s+/).map(word => stripPunctuation(word).toLowerCase()).filter(Boolean);
  if (!words.length) return 0;
  const matched = words.filter(word => dictionary.has(word)).length;
  return Math.round((matched / words.length) * 15);
}

/** English-only proxy for "hard to pronounce" — 3+ consecutive consonants (e.g. "-rst", "-mpt"). Korean/Japanese syllable structure doesn't produce comparable clusters, so this never penalizes those languages. */
function consonantClusterPenalty(phrase: string, language: ResolvedHookLanguage): number {
  if (language !== 'english') return 0;
  const clusters = phrase.toLowerCase().match(/[bcdfghjklmnpqrstvwxz]{3,}/g);
  return clusters ? Math.min(20, clusters.length * 8) : 0;
}

/**
 * v3.15 — third openingContest scoring dimension (see PART A of the brief).
 * All five components are text-level proxies for "easy to pick up on first
 * listen": short-ish, ends open, repeats its own rhythm, uses common words,
 * avoids hard consonant clusters. 50 base + up to 25+15+15+15 bonus, minus up
 * to 20 penalty, clamped to 0-100 — same scale/shape as scoreCatchiness.
 */
export function scoreFamiliarity(hook: HookSpec, language: LyricLanguage): number {
  const resolved = resolveLanguage(language);
  const length = hookRhythmLength(hook.phrase, language);
  let score = 50;
  score += sweetSpotScore(length, resolved);
  score += vowelEndingScore(hook.phrase, resolved);
  score += rhythmRepetitionScore(hook.phrase, resolved);
  score += commonWordScore(hook.phrase, resolved);
  score -= consonantClusterPenalty(hook.phrase, resolved);
  return Math.max(0, Math.min(100, score));
}

/**
 * TASK I2 (v3.11) — local, free, no API call: generates up to `k` hook
 * candidates for the same slot (varying only the composeHook seed, never
 * ctx.usedHooks between candidates so they can't collide with each other),
 * scores each, and returns the highest scorer as `winner`. Callers must only
 * ever add `winner.hook.phrase` to the real usedHooks/usedTitles sets —
 * losing candidates are never meant to be used, so they must never reach
 * hookLedger (see core/localGenerator.ts's call site).
 *
 * If the hook pool is nearly exhausted, composeHook may throw before `k`
 * candidates are reached; whatever candidates were already found are still
 * scored and a winner returned. Only if the very first candidate can't be
 * generated does the underlying "pool exhausted" error propagate — same
 * failure mode composeHook already has everywhere else.
 */
export function runOpeningContest(
  seed: number,
  ctx: HookContext,
  role: OpeningRole,
  packContext: OpeningPackContext,
  k = 3,
  /** v3.15 — "earworm" mode (see types.ts's GenerationOptions.earwormMode): when on, familiarity is folded into the winning score for cold-open/flagship slots at a heavier weight than the default catchiness/representativeness split. scoreBreakdown.familiarity is always computed regardless, so callers/tests can inspect it either way. */
  earwormMode = false
): OpeningContestResult {
  const tried = new Set<string>(ctx.usedHooks);
  const candidates: OpeningCandidate[] = [];

  for (let i = 0; i < k; i += 1) {
    let hook: HookSpec;
    try {
      hook = composeHook(seed + i * 9973, { ...ctx, usedHooks: tried });
    } catch (error) {
      if (candidates.length) break;
      throw error;
    }
    tried.add(hook.phrase);
    const catchiness = scoreCatchiness(hook, ctx.language, ctx.targetSyllables);
    const representativeness = role === 'flagship' ? scoreRepresentativeness(hook, packContext) : 0;
    const familiarity = scoreFamiliarity(hook, ctx.language);
    let score: number;
    if (role === 'flagship') {
      score = earwormMode
        ? catchiness * 0.4 + representativeness * 0.25 + familiarity * 0.35
        : catchiness * 0.6 + representativeness * 0.4;
    } else {
      score = earwormMode ? catchiness * 0.55 + familiarity * 0.45 : catchiness;
    }
    candidates.push({ hook, score, scoreBreakdown: { catchiness, representativeness, familiarity } });
  }

  const winner = candidates.reduce((best, candidate) => (candidate.score > best.score ? candidate : best), candidates[0]);
  return { role, candidates, winner };
}
