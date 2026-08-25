import { describe, expect, it } from 'vitest';
import { lintGrammar } from '../src/core/grammarLinter';

/**
 * TASK v5.21 (TASK G) — real, measured error: T14's real bridge-imported
 * lyrics sang "I said that suited you and I" (verified directly against
 * lyrics/20260806_굿모닝추억라디오_60년대향수가물씬풍기는올드팝.json).
 */
describe('[v5.21 TASK G] lintGrammar — objective case ("you and I")', () => {
  it('flags the real T14 clause-final error', () => {
    const result = lintGrammar('You said the miles looked endless\nI said that suited you and I\nAimless never felt so gentle');
    expect(result.blocking.some(f => f.match.toLowerCase().includes('you and i'))).toBe(true);
  });

  it('flags a preposition-anchored error regardless of clause position', () => {
    const result = lintGrammar('This song is for you and I to remember always');
    expect(result.blocking.some(f => f.match.toLowerCase() === 'for you and i')).toBe(true);
  });

  it('does not flag a legitimate compound subject ("You and I are happy")', () => {
    const result = lintGrammar('You and I are happy tonight\nThe world feels bright and warm');
    expect(result.blocking).toEqual([]);
  });

  it('does not flag "and I" as a normal sentence start', () => {
    const result = lintGrammar('And I remember every word you said');
    expect(result.blocking).toEqual([]);
  });
});

describe('[v5.21 TASK G] lintGrammar — article errors (advisory)', () => {
  it('flags "a" before a vowel-starting word', () => {
    const result = lintGrammar('like a apple on the tree, a evening walk with you');
    expect(result.advisory.some(f => f.match === 'a apple')).toBe(true);
    expect(result.advisory.some(f => f.match === 'a evening')).toBe(true);
  });

  it('flags "an" before a consonant-starting word', () => {
    const result = lintGrammar('an star in the sky tonight');
    expect(result.advisory.some(f => f.match === 'an star')).toBe(true);
  });

  it('does not flag the real "an hour"/"an honest" silent-h exceptions', () => {
    const result = lintGrammar('waited an hour by the door, told an honest truth');
    expect(result.advisory.some(f => f.match.includes('an hour'))).toBe(false);
    expect(result.advisory.some(f => f.match.includes('an honest'))).toBe(false);
  });

  it('does not flag correct article usage', () => {
    const result = lintGrammar('a quiet evening, an old letter, a warm memory');
    expect(result.advisory).toEqual([]);
  });
});

describe('[v5.21 TASK G] lintGrammar — subject-verb agreement (advisory)', () => {
  it('flags a definite plural determiner + plural noun + singular verb', () => {
    const result = lintGrammar('the years was long and slow, these memories was fading');
    expect(result.advisory.some(f => f.match.includes('the years was'))).toBe(true);
  });

  it('does not flag a genuinely singular subject ending in -s (bus, focus)', () => {
    const result = lintGrammar('the bus is late, the focus was clear, always is true');
    expect(result.advisory).toEqual([]);
  });
});

describe('[v5.21 TASK G] lintGrammar — empty/no-issue input', () => {
  it('returns empty results for clean lyrics', () => {
    const result = lintGrammar('[Verse 1]\nThe morning light comes soft and slow\nWe watch the coffee steam and glow');
    expect(result).toEqual({ blocking: [], advisory: [] });
  });

  it('returns empty results for empty input', () => {
    expect(lintGrammar('')).toEqual({ blocking: [], advisory: [] });
  });
});
