import { describe, expect, it } from 'vitest';
import { shouldContinueRewriteLoop, failingItemsSignature, rewriteLoopHasStagnated } from '../src/core/rewriteLoop';
import { resolveRewriteScope } from '../src/core/rewriteInstruction';
import type { ScopedIssue } from '../src/types';

/**
 * codex 지시문 05 (TASK D, required test file) — real coverage of both stop
 * conditions the 완료 기준 names explicitly: the max-2-rounds cap, and
 * "same failed signature repeated endlessly = 0" (a rewrite round making
 * zero real progress must stop, not spin forever).
 */

describe('[codex 지시문 05 TASK D] shouldContinueRewriteLoop — max 2 automatic rounds', () => {
  it('allows rounds 0 and 1 (the 1st and 2nd automatic attempt)', () => {
    expect(shouldContinueRewriteLoop(0)).toBe(true);
    expect(shouldContinueRewriteLoop(1)).toBe(true);
  });

  it('refuses a 3rd automatic round', () => {
    expect(shouldContinueRewriteLoop(2)).toBe(false);
    expect(shouldContinueRewriteLoop(5)).toBe(false);
  });
});

describe('[codex 지시문 05 TASK D] failingItemsSignature / rewriteLoopHasStagnated', () => {
  it('the same failing ids in a different order produce the identical signature', () => {
    expect(failingItemsSignature([{ id: 'b' }, { id: 'a' }])).toBe(failingItemsSignature([{ id: 'a' }, { id: 'b' }]));
  });

  it('round 1 (no previous failing list yet) never counts as stagnation', () => {
    expect(rewriteLoopHasStagnated([], [{ id: 'a' }])).toBe(false);
  });

  it('flags real stagnation: round 2 reports the exact same failing ids as round 1', () => {
    expect(rewriteLoopHasStagnated([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'a' }])).toBe(true);
  });

  it('does not flag stagnation when real progress was made (a different failing set)', () => {
    expect(rewriteLoopHasStagnated([{ id: 'a' }, { id: 'b' }], [{ id: 'a' }])).toBe(false);
  });

  it('does not flag stagnation when the pack got WORSE (also a different set, still real change)', () => {
    expect(rewriteLoopHasStagnated([{ id: 'a' }], [{ id: 'a' }, { id: 'c' }])).toBe(false);
  });
});

describe('[codex 지시문 05 TASK D] resolveRewriteScope — both stop conditions reach blocked-manual', () => {
  const trackIssue: ScopedIssue = { scope: 'track', id: 'english-grammar-errors', labelKo: '', affectedTracks: [1], fixHintKo: '' };

  it('round budget exhausted -> blocked-manual', () => {
    expect(resolveRewriteScope([trackIssue], 2)).toBe('blocked-manual');
  });

  it('within round budget but stagnated against the previous round -> blocked-manual', () => {
    const previous = [{ id: 'english-grammar-errors' }];
    expect(resolveRewriteScope([trackIssue], 1, previous)).toBe('blocked-manual');
  });

  it('within round budget and real progress made (different failing set) -> a real scope, not blocked-manual', () => {
    const previous = [{ id: 'some-other-issue' }];
    expect(resolveRewriteScope([trackIssue], 1, previous)).toBe('track-rewrite');
  });

  it('no previousFailingIds supplied at all (round 1, first call) never spuriously blocks', () => {
    expect(resolveRewriteScope([trackIssue], 0)).toBe('track-rewrite');
  });
});
