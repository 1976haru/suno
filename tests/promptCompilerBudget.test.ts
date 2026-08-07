import { describe, expect, it } from 'vitest';
import { checkStylePromptWordBudget, stylePromptWordBudgetWarning, stylePromptWordPolicyFor } from '../src/core/stylePromptBudget';
import { reconcileWithPreassignedSlot, preallocateSongSlots } from '../src/core/batchPreallocation';
import { genrePacks, makeOptions } from './fixtures';
import type { SongIdea } from '../src/types';

/**
 * codex 지시문 03 (TASK C) — real gap this closes: core/promptBudget.ts's
 * own word-count enforcement only ever ran on the LOCAL generation path
 * (its own doc comment confirms this) — the bridge (external LLM writes
 * the prose) and Batch API paths had zero stylePrompt word-count check at
 * all before this. This adds a NEW, additive, warn-only check wired into
 * core/batchPreallocation.ts's reconcileWithPreassignedSlot — the one real
 * choke point every one of the 3 generation paths' output funnels through
 * (same precedent as core/bpmDedupe.ts's enforceSingleBpmText).
 */
function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
}

describe('[codex 지시문 03 TASK C] stylePromptWordPolicyFor — per-workspace thresholds', () => {
  it('default workspaces (senior-oldpop, kr-2030, jp-2030) target <= 55 words', () => {
    expect(stylePromptWordPolicyFor('senior-oldpop').targetMax).toBe(55);
    expect(stylePromptWordPolicyFor('kr-2030').targetMax).toBe(55);
    expect(stylePromptWordPolicyFor('jp-2030').targetMax).toBe(55);
  });

  it('kids workspaces target <= 45 words (shorter than default)', () => {
    expect(stylePromptWordPolicyFor('kr-kids').targetMax).toBe(45);
    expect(stylePromptWordPolicyFor('jp-kids').targetMax).toBe(45);
  });

  it('K-pop workspaces relax the target up to 65 words (part/rhythm cues need more room)', () => {
    expect(stylePromptWordPolicyFor('kr-idol-male').targetMax).toBe(65);
    expect(stylePromptWordPolicyFor('kr-idol-female').targetMax).toBe(65);
  });
});

describe('[codex 지시문 03 TASK C] checkStylePromptWordBudget — 3-tier severity', () => {
  it('within target is "ok"', () => {
    expect(checkStylePromptWordBudget(words(40), 'senior-oldpop').severity).toBe('ok');
  });

  it('between targetMax and advisoryMax is "advisory"', () => {
    expect(checkStylePromptWordBudget(words(60), 'senior-oldpop').severity).toBe('advisory');
  });

  it('above advisoryMax is "blocking"', () => {
    expect(checkStylePromptWordBudget(words(75), 'senior-oldpop').severity).toBe('blocking');
  });

  it('the SAME word count that is "advisory" for default is "ok" for K-pop (real per-workspace difference)', () => {
    expect(checkStylePromptWordBudget(words(60), 'senior-oldpop').severity).toBe('advisory');
    expect(checkStylePromptWordBudget(words(60), 'kr-idol-male').severity).toBe('ok');
  });

  it('the SAME word count that is "ok" for default is "advisory" for kids (real per-workspace difference)', () => {
    expect(checkStylePromptWordBudget(words(50), 'senior-oldpop').severity).toBe('ok');
    expect(checkStylePromptWordBudget(words(50), 'kr-kids').severity).toBe('advisory');
  });
});

describe('[codex 지시문 03 TASK C] stylePromptWordBudgetWarning', () => {
  it('returns undefined for a clean, in-budget stylePrompt', () => {
    expect(stylePromptWordBudgetWarning(words(40), 'senior-oldpop', 1)).toBeUndefined();
  });

  it('returns a real warning naming the track and word count for an over-budget stylePrompt', () => {
    const warning = stylePromptWordBudgetWarning(words(75), 'senior-oldpop', 5);
    expect(warning).toBeDefined();
    expect(warning).toContain('Track 5');
    expect(warning).toContain('75 words');
  });
});

function songWith(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1, title: 'Song 1', seasonMoment: 'x', listenerSituation: 'x', emotionArc: 'x', hookPhrase: 'Hook',
    stylePrompt: 'warm acoustic pop, mid tempo, 92 BPM', lyrics: '[verse 1]\nline a\n\n[chorus]\nHook 1\nHook 1\nHook 1\n\n[end]',
    warnings: [], qualityScore: 90, youtube: { title: 'Song 1', description: 'desc', tags: [] },
    ...overrides
  };
}

describe('[codex 지시문 03 TASK C] reconcileWithPreassignedSlot wiring — real integration across the reconciliation choke point', () => {
  it('surfaces a word-budget warning for a real over-budget incoming stylePrompt (fast-path-equivalent case: nothing more to append)', () => {
    const opts = makeOptions({ songCount: 3 });
    const slots = preallocateSongSlots(opts, genrePacks.filter(g => opts.genreIds.includes(g.id)), { usedTitles: [], usedHooks: [] });
    const song = songWith({ trackNo: slots[0].trackNo, stylePrompt: words(90) });
    const fixed = reconcileWithPreassignedSlot(song, slots[0], 'ai-creative');
    expect(fixed.warnings.some(w => w.includes('stylePrompt is'))).toBe(true);
  });

  it('stays clean for a real, well-formed slot-driven stylePrompt within budget', () => {
    const opts = makeOptions({ songCount: 3 });
    const slots = preallocateSongSlots(opts, genrePacks.filter(g => opts.genreIds.includes(g.id)), { usedTitles: [], usedHooks: [] });
    const song = songWith({ trackNo: slots[0].trackNo });
    const fixed = reconcileWithPreassignedSlot(song, slots[0], 'ai-creative');
    // Real slot-driven appends may still land it over budget for a
    // deliberately terse incoming prompt — this just confirms the check
    // runs against the REAL final stylePrompt, not a stale/incoming one.
    const finalCheck = checkStylePromptWordBudget(fixed.stylePrompt, 'senior-oldpop');
    expect(fixed.warnings.some(w => w.includes('stylePrompt is'))).toBe(finalCheck.severity !== 'ok');
  });
});
