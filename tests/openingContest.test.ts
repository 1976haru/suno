import { describe, expect, it } from 'vitest';
import { runOpeningContest, type OpeningPackContext } from '../src/core/openingContest';
import { HOOK_SHAPES, targetHookSyllables, type HookContext } from '../src/core/lyricEngine';
import type { LyricLanguage } from '../src/types';

const LANGUAGES: LyricLanguage[] = ['english', 'korean', 'japanese'];

function baseCtx(language: LyricLanguage, usedHooks: Set<string> = new Set()): HookContext {
  return {
    language,
    shape: 'declarative',
    usedHooks,
    targetSyllables: targetHookSyllables(language, 1)
  };
}

const emptyPackContext: OpeningPackContext = { dominantGenreIds: [], dominantMoodIds: [] };

describe('openingContest (TASK I2, v3.11)', () => {
  it.each(LANGUAGES)('k=3 candidates are all different hooks, in %s', language => {
    const result = runOpeningContest(1, baseCtx(language), 'cold-open', emptyPackContext, 3);
    const phrases = result.candidates.map(c => c.hook.phrase);
    expect(new Set(phrases).size).toBe(phrases.length);
    expect(phrases.length).toBeGreaterThan(1);
  });

  it('the highest-catchiness candidate is selected as winner (cold-open)', () => {
    const result = runOpeningContest(7, baseCtx('english'), 'cold-open', emptyPackContext, 5);
    const best = result.candidates.reduce((a, b) => (b.score > a.score ? b : a), result.candidates[0]);
    expect(result.winner.hook.phrase).toBe(best.hook.phrase);
    expect(result.winner.score).toBe(Math.max(...result.candidates.map(c => c.score)));
  });

  it('flagship role factors representativeness into the score, cold-open does not', () => {
    const packContext: OpeningPackContext = { dominantGenreIds: ['adult-contemporary'], dominantMoodIds: ['nostalgic'] };
    const coldOpenResult = runOpeningContest(3, baseCtx('english'), 'cold-open', packContext, 3);
    const flagshipResult = runOpeningContest(3, baseCtx('english'), 'flagship', packContext, 3);
    for (const candidate of coldOpenResult.candidates) {
      expect(candidate.scoreBreakdown.representativeness).toBe(0);
    }
    // At least one flagship candidate actually gets a representativeness score computed (not hardcoded 0).
    expect(flagshipResult.candidates.some(c => c.scoreBreakdown.representativeness > 0)).toBe(true);
  });

  it('losing candidates are never added to the shared usedHooks set (never reach hookLedger)', () => {
    const usedHooks = new Set<string>();
    const result = runOpeningContest(11, baseCtx('english', usedHooks), 'cold-open', emptyPackContext, 3);
    expect(usedHooks.size).toBe(0);
    const losers = result.candidates.filter(c => c.hook.phrase !== result.winner.hook.phrase);
    expect(losers.length).toBeGreaterThan(0);
    for (const loser of losers) {
      expect(usedHooks.has(loser.hook.phrase)).toBe(false);
    }
  });

  it('does not infinite-loop when the hook pool is nearly exhausted, and still returns a clear winner', () => {
    // Exhaust every shape's premium+combinatorial pool down to a handful of
    // survivors by pre-marking almost everything as "used" via composeHook
    // in a loop, then confirm the contest still terminates with a result.
    const usedHooks = new Set<string>();
    const ctx = baseCtx('english', usedHooks);
    // Drain most of the pool for this shape using the contest itself, one
    // winner at a time (mirrors how a real multi-song pack would drain it).
    for (let i = 0; i < 40; i += 1) {
      try {
        const result = runOpeningContest(100 + i, { ...ctx, usedHooks }, 'cold-open', emptyPackContext, 3);
        usedHooks.add(result.winner.hook.phrase);
      } catch {
        break; // fully exhausted — expected eventually, not a bug
      }
    }
    // Whatever state the pool ended up in, one more contest call must either
    // return a valid winner or throw a clear, immediate error — never hang.
    let finished = false;
    try {
      const finalResult = runOpeningContest(999, { ...ctx, usedHooks }, 'cold-open', emptyPackContext, 3);
      expect(finalResult.winner).toBeTruthy();
      finished = true;
    } catch (error) {
      expect(String(error)).toContain('훅 풀이 소진되었습니다');
      finished = true;
    }
    expect(finished).toBe(true);
  });

  it.each(LANGUAGES)('works in %s', language => {
    const result = runOpeningContest(5, baseCtx(language), 'flagship', emptyPackContext, 3);
    expect(result.winner.hook.phrase.length).toBeGreaterThan(0);
    expect(result.role).toBe('flagship');
  });
});
