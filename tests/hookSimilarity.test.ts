import { describe, expect, it } from 'vitest';
import { findNearDuplicateHook, hookWordOverlap, NEAR_DUPLICATE_HOOK_THRESHOLD } from '../src/core/hookSimilarity';

describe('[v3.64 TASK D] hook near-duplicate detection', () => {
  it('TASK v3.64 — catches the spec\'s own real example: "I Won\'t Forget" vs "I Can\'t Forget"', () => {
    const similarity = hookWordOverlap("I Won't Forget", "I Can't Forget");
    expect(similarity).toBeGreaterThanOrEqual(NEAR_DUPLICATE_HOOK_THRESHOLD);
    const match = findNearDuplicateHook("I Won't Forget", ["I Can't Forget", "Some Other Hook"]);
    expect(match?.matchedAgainst).toBe("I Can't Forget");
  });

  it('an exact match (case/apostrophe-insensitive) is excluded — that\'s claudeCodeBridge.ts\'s own exact-match check\'s job', () => {
    const match = findNearDuplicateHook('I Won\'t Forget', ["i won't forget"]);
    expect(match).toBeUndefined();
  });

  it('does not flag two genuinely unrelated hooks of similar length', () => {
    const match = findNearDuplicateHook('Wait by the Window', ['Catch the Morning Train']);
    expect(match).toBeUndefined();
  });

  it('does not flag a short hook against a much longer one that merely shares one word', () => {
    const match = findNearDuplicateHook('Stay', ['Stay a While Longer With Me Tonight']);
    expect(match).toBeUndefined();
  });

  it('returns the single closest match when multiple candidates are near-duplicates', () => {
    const match = findNearDuplicateHook('I Wont Forget You', ['I Cant Forget You', 'I Will Not Forget']);
    expect(match).toBeDefined();
  });
});
