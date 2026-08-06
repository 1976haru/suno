import { describe, expect, it } from 'vitest';
import { lintEnglishLyrics } from '../src/core/englishLint';

/**
 * v5.22 (AXIS 3) — coverage for core/englishLint.ts, the grammar/style
 * linter this task's audit found completely missing (bilingualLint.ts/
 * diversityLinter.ts/idolExpressionLint.ts/idolTitleLint.ts cover language
 * ratio/pack diversity/idol phrasing, none of them grammar). Tests the
 * task spec's own §3-3 example patterns verbatim (its literal "자동 검출
 * 가능" list), plus the real observed errors from §3-2 where a regex-based
 * check can plausibly catch them — see the last describe block for which
 * of the 3 real errors are/aren't in scope for this kind of linter, and why.
 */
function idOf(result: ReturnType<typeof lintEnglishLyrics>, id: string) {
  return result.issues.filter(issue => issue.id === id);
}

describe('[v5.22 AXIS 3] case-pronoun-after-preposition/verb (blocking)', () => {
  it('catches "for you and I" (§3-3 own example)', () => {
    const result = lintEnglishLyrics('This song is for you and I to remember.', 'Hook');
    expect(idOf(result, 'case-pronoun')).toHaveLength(1);
    expect(result.blocking).toBe(true);
  });

  it('catches "between he and I" (§3-3 own example)', () => {
    const result = lintEnglishLyrics('A secret kept between he and I.', 'Hook');
    expect(idOf(result, 'case-pronoun')).toHaveLength(1);
  });

  it('catches "told she and I" (§3-3 own example)', () => {
    const result = lintEnglishLyrics('He told she and I the truth.', 'Hook');
    expect(idOf(result, 'case-pronoun')).toHaveLength(1);
  });

  it('does not flag correct object-case pronouns', () => {
    const result = lintEnglishLyrics('This song is for you and me to remember.', 'Hook');
    expect(idOf(result, 'case-pronoun')).toEqual([]);
  });
});

describe('[v5.22 AXIS 3] adjective-for-adverb / missing -ly (blocking)', () => {
  it('catches "rose gentle" (§3-3 own example)', () => {
    const result = lintEnglishLyrics('And certainty rose gentle in the morning light.', 'Hook');
    expect(idOf(result, 'adjective-for-adverb')).toHaveLength(1);
  });

  it('catches "moved quiet" (§3-3 own example)', () => {
    const result = lintEnglishLyrics('She moved quiet through the empty hall.', 'Hook');
    expect(idOf(result, 'adjective-for-adverb')).toHaveLength(1);
  });

  it('catches "sang soft" (§3-3 own example)', () => {
    const result = lintEnglishLyrics('He sang soft into the microphone.', 'Hook');
    expect(idOf(result, 'adjective-for-adverb')).toHaveLength(1);
  });

  it('does not flag the correct adverb form', () => {
    const result = lintEnglishLyrics('And certainty rose gently in the morning light.', 'Hook');
    expect(idOf(result, 'adjective-for-adverb')).toEqual([]);
  });
});

describe('[v5.22 AXIS 3] article errors (blocking)', () => {
  it('catches "a apple" (§3-3 own example)', () => {
    const result = lintEnglishLyrics('She held a apple in her hand.', 'Hook');
    expect(idOf(result, 'article-a-before-vowel')).toHaveLength(1);
  });

  it('catches "a hour" (§3-3 own example)', () => {
    const result = lintEnglishLyrics('Just a hour before the sun comes up.', 'Hook');
    expect(idOf(result, 'article-a-before-silent-h')).toHaveLength(1);
  });

  it('catches "a stars" (§3-3 own example, "like a stars")', () => {
    const result = lintEnglishLyrics('Shining like a stars above the town.', 'Hook');
    expect(idOf(result, 'article-a-before-plural')).toHaveLength(1);
  });

  it('does not flag legitimate vowel-sound exceptions ("a university")', () => {
    const result = lintEnglishLyrics('She went back to a university downtown.', 'Hook');
    expect(idOf(result, 'article-a-before-vowel')).toEqual([]);
  });

  it('does not flag legitimate silent-h "an hour"', () => {
    const result = lintEnglishLyrics('Just an hour before the sun comes up.', 'Hook');
    expect(idOf(result, 'article-an-before-consonant')).toEqual([]);
  });

  it('does not flag ordinary singular nouns ending in s ("a bus", "a class")', () => {
    const result = lintEnglishLyrics('She waited for a bus outside a class.', 'Hook');
    expect(idOf(result, 'article-a-before-plural')).toEqual([]);
  });
});

describe('[v5.22 AXIS 3] subject-verb agreement (blocking)', () => {
  it('catches "the years was" (§3-3 own example)', () => {
    const result = lintEnglishLyrics('The years was long and slow.', 'Hook');
    expect(idOf(result, 'subject-verb-agreement')).toHaveLength(1);
  });

  it('catches "they was" (§3-3 own example)', () => {
    const result = lintEnglishLyrics('They was waiting by the door.', 'Hook');
    expect(idOf(result, 'subject-verb-agreement')).toHaveLength(1);
  });

  it('does not flag "the news was" (a singular noun ending in s)', () => {
    const result = lintEnglishLyrics('The news was good that morning.', 'Hook');
    expect(idOf(result, 'subject-verb-agreement')).toEqual([]);
  });

  it('does not flag correct agreement', () => {
    const result = lintEnglishLyrics('The years were long and slow. They were waiting by the door.', 'Hook');
    expect(idOf(result, 'subject-verb-agreement')).toEqual([]);
  });
});

describe('[v5.22 AXIS 3] in-song sentence repetition, excluding the hook (blocking)', () => {
  it('flags the same non-hook line repeated within one song', () => {
    const lyrics = [
      '[verse]',
      'the doorway framed the summer yard in gold',
      '[verse]',
      'the doorway framed the summer yard in gold',
      '[chorus]',
      'Hold on tight'
    ].join('\n');
    const result = lintEnglishLyrics(lyrics, 'Hold on tight');
    expect(idOf(result, 'in-song-line-repetition')).toHaveLength(1);
  });

  it('never flags the repeated chorus hook itself', () => {
    const lyrics = ['[chorus]', 'Hold on tight through the storm tonight', '[chorus]', 'Hold on tight through the storm tonight'].join('\n');
    const result = lintEnglishLyrics(lyrics, 'Hold on tight through the storm tonight');
    expect(idOf(result, 'in-song-line-repetition')).toEqual([]);
  });
});

describe('[v5.22 AXIS 3] forced-metaphor / abstract-noun-overload (advisory only, never blocking)', () => {
  it('flags "coin of common sense" as advisory', () => {
    const result = lintEnglishLyrics('She held the coin of common sense in her palm.', 'Hook');
    const found = idOf(result, 'forced-metaphor');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('advisory');
    expect(result.blocking).toBe(false);
  });

  it('flags 3+ abstract nouns in one line as advisory', () => {
    const result = lintEnglishLyrics('Hope and faith and truth filled the quiet room.', 'Hook');
    const found = idOf(result, 'abstract-noun-overload');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('advisory');
  });

  it('advisory-only issues never set result.blocking', () => {
    const result = lintEnglishLyrics('She held the coin of common sense, full of hope and faith and truth.', 'Hook');
    expect(result.issues.every(issue => issue.severity === 'advisory')).toBe(true);
    expect(result.blocking).toBe(false);
  });
});

describe('[v5.22 AXIS 3] a clean lyric produces no issues', () => {
  it('grammatically correct, non-repetitive, non-abstract-heavy lyrics pass with nothing flagged', () => {
    const lyrics = [
      '[verse]',
      'the morning light came softly through the door',
      'she made the coffee like she always had before',
      '[chorus]',
      'Hold on tight through the storm tonight',
      '[verse]',
      'the radio played something warm and low',
      'he smiled and said it\'s time for us to go',
      '[chorus]',
      'Hold on tight through the storm tonight'
    ].join('\n');
    const result = lintEnglishLyrics(lyrics, 'Hold on tight through the storm tonight');
    expect(result.issues).toEqual([]);
    expect(result.blocking).toBe(false);
  });
});

describe('[v5.22 AXIS 3 §3-2] the 3 real observed errors — verified against this linter', () => {
  it('"And certainty rose gentle" — caught (adjective-for-adverb)', () => {
    const result = lintEnglishLyrics('And certainty rose gentle in her eyes.', 'Hook');
    expect(idOf(result, 'adjective-for-adverb').length).toBeGreaterThan(0);
  });

  it('"I said that suited you and I" — caught (case-pronoun, after widening DITRANSITIVE_VERBS to include "suited")', () => {
    const result = lintEnglishLyrics('I said that suited you and I just fine.', 'Hook');
    expect(idOf(result, 'case-pronoun').length).toBeGreaterThan(0);
  });

  // "If her heart was ready so" is NOT caught, and deliberately isn't
  // targeted: it isn't a crisp grammar-RULE violation (no wrong pronoun
  // case, no missing -ly, no article/agreement error) — it reads as an
  // incomplete/awkward sentence ("ready so" -> "ready to go"), which is a
  // fluency/completeness judgment, not something a regex-based rule can
  // target without high false-positive risk on legitimately different
  // sentences. Documented here as an explicit, known gap rather than an
  // untested one.
  it('"If her heart was ready so" — NOT caught (fluency issue, out of scope for a regex-based linter)', () => {
    const result = lintEnglishLyrics('If her heart was ready so.', 'Hook');
    expect(result.blocking).toBe(false);
  });
});
