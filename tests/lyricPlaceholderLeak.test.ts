import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

const PLACEHOLDER_PHRASES = [
  'small meaningful detail',
  'private memory',
  'personal scene details',
  'custom concept focus',
  'scene-specific arrangement detail'
];

/** Same exclusion list aMotif()'s UNCOUNTABLE_MOTIF_NOUNS + -ss/-us/-is exception uses, kept independent here so this test doesn't just re-check the function it's meant to guard. */
function isPluralNounWord(word: string): boolean {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean || /(ss|us|is)$/.test(clean)) return false;
  return /s$/.test(clean);
}

/**
 * TASK v3.59 (TASK A-4) — regression tests for TASK A's 3 lyric-body leaks:
 * a literal "Title: <title>" line sung as if it were lyric content (A-1),
 * meta-description placeholder phrases substituted for a concept image and
 * then sung verbatim (A-2), and "a <plural noun>" article/plural mismatches
 * from lyricEngine.ts's aMotif() (A-3).
 */
describe('[v3.59 TASK A] no lyric-body placeholder leaks in real generated output', () => {
  it('no song\'s lyrics contain a "Title:" line', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 18 }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(song.lyrics, song.lyrics).not.toMatch(/^Title:/m);
    }
  });

  it('no song\'s lyrics contain a concept-fallback placeholder phrase', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 18 }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      for (const phrase of PLACEHOLDER_PHRASES) {
        expect(song.lyrics, `${song.title}: ${song.lyrics}`).not.toContain(phrase);
      }
    }
  });

  // Scoped to "like a <word>" specifically (lyricEngine.ts's likeMotif()
  // output — the exact reported failure, "like a worn guitar strings") not
  // every "a <word ending in s>" in the whole lyrics blob: ordinary prose
  // has plenty of legitimate matches (proper nouns like "Christmas",
  // pronouns like "us"/"this") that have nothing to do with aMotif()'s
  // article logic and would be false positives here.
  it('no song\'s lyrics contain "like a <plural noun>" (article/plural mismatch)', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 18 }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      const matches = [...song.lyrics.matchAll(/\blike a (\w+)\b/gi)].map(m => m[1]);
      const badMatches = matches.filter(isPluralNounWord);
      expect(badMatches, `${song.title}: ${JSON.stringify(badMatches)}`).toEqual([]);
    }
  });

  it('a Korean customConcept (the exact reported scenario) produces zero leaks of any of the above across 18 songs', () => {
    const opts = makeOptions({ songCount: 18, customConcept: '비틀즈 스타일로, 아침에 커피와 함께 듣고 싶은 올드팝' });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(song.lyrics, song.lyrics).not.toMatch(/^Title:/m);
      for (const phrase of PLACEHOLDER_PHRASES) {
        expect(song.lyrics, `${song.title}: ${song.lyrics}`).not.toContain(phrase);
      }
      const matches = [...song.lyrics.matchAll(/\blike a (\w+)\b/gi)].map(m => m[1]);
      const badMatches = matches.filter(isPluralNounWord);
      expect(badMatches, `${song.title}: ${JSON.stringify(badMatches)}`).toEqual([]);
    }
  });
});
