import type { LyricLanguage } from '../types';
import {
  composeHook,
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
  k = 3
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
    const score = role === 'flagship' ? catchiness * 0.6 + representativeness * 0.4 : catchiness;
    candidates.push({ hook, score, scoreBreakdown: { catchiness, representativeness } });
  }

  const winner = candidates.reduce((best, candidate) => (candidate.score > best.score ? candidate : best), candidates[0]);
  return { role, candidates, winner };
}
