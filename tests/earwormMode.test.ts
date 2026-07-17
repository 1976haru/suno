import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { runOpeningContest, scoreFamiliarity, type OpeningPackContext } from '../src/core/openingContest';
import { hookRhythmLength, targetHookSyllables, type HookContext, type HookSpec } from '../src/core/lyricEngine';
import { resolveEarwormMoneyChordMode } from '../src/data/moneyChords';
import { EARWORM_STYLE_ATOMS } from '../src/core/promptComposer';
import { scoreSong } from '../src/core/quality';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { LyricLanguage } from '../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const LANGUAGES: LyricLanguage[] = ['english', 'korean', 'japanese'];

function baseCtx(language: LyricLanguage, usedHooks: Set<string> = new Set()): HookContext {
  return { language, shape: 'declarative', usedHooks, targetSyllables: targetHookSyllables(language, 1) };
}

const emptyPackContext: OpeningPackContext = { dominantGenreIds: [], dominantMoodIds: [] };

/** Averages hook syllable/mora length across tracks 1-3 (the only tracks that run the contest) over several independently-seeded packs. */
function avgContestedHookLength(language: LyricLanguage, earwormMode: boolean, trials = 20): number {
  let total = 0;
  let count = 0;
  for (let i = 0; i < trials; i += 1) {
    const bp = generateLocalBlueprint(
      makeOptions({ songCount: 3, lyricLanguage: language, projectTitle: `Earworm Trial ${earwormMode} ${i}`, earwormMode }),
      testGenres,
      testMoods,
      testSeason
    );
    for (const song of bp.songs) {
      total += hookRhythmLength(song.hookPhrase, language);
      count += 1;
    }
  }
  return total / count;
}

describe('earwormMode (v3.15)', () => {
  describe('PART A — familiarity scoring', () => {
    it('ranks a short, open-ending, common-word hook above a long, consonant-cluster-heavy one', () => {
      const easy: HookSpec = { phrase: 'Stay With Me', syllables: 3, isTitle: true, shape: 'declarative', emotionalWeight: 'medium' };
      const hard: HookSpec = { phrase: 'Clasped Amidst Strict Wrapped Thoughts', syllables: 6, isTitle: true, shape: 'declarative', emotionalWeight: 'medium' };
      expect(scoreFamiliarity(easy, 'english')).toBeGreaterThan(scoreFamiliarity(hard, 'english'));
    });

    it.each(LANGUAGES)('average tracks 1-3 hook length is no longer with earwormMode on than off, in %s', language => {
      const withEarworm = avgContestedHookLength(language, true);
      const withoutEarworm = avgContestedHookLength(language, false);
      expect(withEarworm).toBeLessThanOrEqual(withoutEarworm + 0.3);
    });

    it('earwormMode=true folds familiarity into the cold-open score at the documented weight', () => {
      const result = runOpeningContest(42, baseCtx('english'), 'cold-open', emptyPackContext, 3, true);
      for (const candidate of result.candidates) {
        const expected = candidate.scoreBreakdown.catchiness * 0.55 + candidate.scoreBreakdown.familiarity * 0.45;
        expect(candidate.score).toBeCloseTo(expected, 5);
      }
    });

    it('earwormMode=true folds familiarity into the flagship score at the documented weight', () => {
      const packContext: OpeningPackContext = { dominantGenreIds: [], dominantMoodIds: ['nostalgic'] };
      const result = runOpeningContest(42, baseCtx('english'), 'flagship', packContext, 3, true);
      for (const candidate of result.candidates) {
        const expected =
          candidate.scoreBreakdown.catchiness * 0.4 + candidate.scoreBreakdown.representativeness * 0.25 + candidate.scoreBreakdown.familiarity * 0.35;
        expect(candidate.score).toBeCloseTo(expected, 5);
      }
    });

    it('earwormMode=false (default) never lets familiarity affect the score, for cold-open or flagship', () => {
      const coldOpen = runOpeningContest(7, baseCtx('english'), 'cold-open', emptyPackContext, 3, false);
      for (const candidate of coldOpen.candidates) {
        expect(candidate.score).toBeCloseTo(candidate.scoreBreakdown.catchiness, 5);
      }
      const packContext: OpeningPackContext = { dominantGenreIds: [], dominantMoodIds: ['nostalgic'] };
      const flagship = runOpeningContest(7, baseCtx('english'), 'flagship', packContext, 3, false);
      for (const candidate of flagship.candidates) {
        const expected = candidate.scoreBreakdown.catchiness * 0.6 + candidate.scoreBreakdown.representativeness * 0.4;
        expect(candidate.score).toBeCloseTo(expected, 5);
      }
    });

    it('when earwormMode is on, the contest winner is at least as familiar, on average, as the candidate pool', () => {
      let winnerTotal = 0;
      let candidateTotal = 0;
      let candidateCount = 0;
      const trials = 30;
      for (let i = 0; i < trials; i += 1) {
        const result = runOpeningContest(1000 + i * 7, baseCtx('english'), 'cold-open', emptyPackContext, 3, true);
        winnerTotal += result.winner.scoreBreakdown.familiarity;
        for (const candidate of result.candidates) {
          candidateTotal += candidate.scoreBreakdown.familiarity;
          candidateCount += 1;
        }
      }
      expect(winnerTotal / trials).toBeGreaterThanOrEqual(candidateTotal / candidateCount);
    });
  });

  describe('PART B — style prompt safety, on or off', () => {
    it.each(LANGUAGES)('generated songs carry zero artist/copyright-risk warnings, earwormMode on or off, in %s', language => {
      for (const earwormMode of [true, false]) {
        const bp = generateLocalBlueprint(makeOptions({ songCount: 6, lyricLanguage: language, earwormMode }), testGenres, testMoods, testSeason);
        for (const song of bp.songs) {
          const scored = scoreSong(song, undefined, language);
          const riskWarnings = scored.warnings.filter(w => /artist|copyright/i.test(w));
          expect(riskWarnings).toEqual([]);
        }
      }
    });

    it('earwormMode=true appends only safe, generic technique language to the style prompt (no imitation phrasing)', () => {
      const bp = generateLocalBlueprint(makeOptions({ songCount: 3, earwormMode: true }), testGenres, testMoods, testSeason);
      expect(bp.songs.some(song => song.stylePrompt.includes('stepwise melody') || song.stylePrompt.includes('singalong-friendly'))).toBe(true);
      expect(EARWORM_STYLE_ATOMS).not.toMatch(/\bin the style of\b|\bsounds like\b|\bas sung by\b/i);
    });
  });

  describe('PART C — money chord nudge', () => {
    it('resolveEarwormMoneyChordMode nudges an unrelated preset to default, but leaves default/canon/custom untouched', () => {
      expect(resolveEarwormMoneyChordMode('showaModern', true)).toBe('default');
      expect(resolveEarwormMoneyChordMode('jazzColor', true)).toBe('default');
      expect(resolveEarwormMoneyChordMode('cityPop', true)).toBe('default');
      expect(resolveEarwormMoneyChordMode('canon', true)).toBe('canon');
      expect(resolveEarwormMoneyChordMode('default', true)).toBe('default');
      expect(resolveEarwormMoneyChordMode('custom', true)).toBe('custom');
    });

    it('resolveEarwormMoneyChordMode is a no-op when earwormMode is off/undefined', () => {
      expect(resolveEarwormMoneyChordMode('showaModern', false)).toBe('showaModern');
      expect(resolveEarwormMoneyChordMode('jazzColor', undefined)).toBe('jazzColor');
    });

    it('generated style prompts reflect the default/canon progression text when earwormMode nudges away from an unrelated preset', () => {
      const bp = generateLocalBlueprint(makeOptions({ songCount: 2, earwormMode: true, moneyChordMode: 'showaModern' }), testGenres, testMoods, testSeason);
      for (const song of bp.songs) {
        expect(song.stylePrompt).not.toMatch(/IVmaj7-iii7-vi7/);
      }
    });
  });

  describe('PART E — compatibility with hookLedger / diversity', () => {
    it('earwormMode=true still produces a full pack with no duplicate hooks', () => {
      const bp = generateLocalBlueprint(makeOptions({ songCount: 12, earwormMode: true }), testGenres, testMoods, testSeason);
      const hooks = bp.songs.map(song => song.hookPhrase);
      expect(new Set(hooks).size).toBe(hooks.length);
    });

    it('earwormMode=true still produces a full pack with no duplicate titles', () => {
      const bp = generateLocalBlueprint(makeOptions({ songCount: 12, earwormMode: true }), testGenres, testMoods, testSeason);
      const titles = bp.songs.map(song => song.title);
      expect(new Set(titles).size).toBe(titles.length);
    });
  });

  describe('static safety scan — no real song/artist names in the earworm feature source', () => {
    // Independent of quality.ts's own famousArtistNames list — this is a
    // regression guard on the actual source files this feature touches, not
    // a test of the existing runtime filter.
    const FORBIDDEN_NAMES = [
      'adele', 'beatles', 'beyonce', 'bts', 'bruno mars', 'carpenters', 'celine dion', 'ed sheeran',
      'frank sinatra', 'taylor swift', 'the weeknd', 'queen', 'iu', 'utada', 'yumi matsutoya', 'ado', 'yoasobi',
      'cho yong-pil', 'na hoon-a', 'lim young-woong', '아이유', '방탄소년단', '임영웅', '조용필', '나훈아',
      'shape of you', 'someone like you', 'let it be', 'bohemian rhapsody', 'perfect (', 'happy birthday to you'
    ];
    const files = [
      'src/core/openingContest.ts',
      'src/core/promptComposer.ts',
      'src/core/localGenerator.ts',
      'src/core/soundSignature.ts',
      'src/data/moneyChords.ts',
      'src/types.ts',
      'src/components/steps/Step2Concept.tsx'
    ];

    // Short ASCII names ('iu', 'bts', 'ado', 'queen'...) are checked on word
    // boundaries — plain substring containment would false-positive on
    // ordinary English inside comments/identifiers (e.g. 'iu' inside
    // "requiu..."/"premium"). Multi-word phrases and non-ASCII (Korean) names
    // are long/distinctive enough that a plain substring check is safe.
    function sourceContainsName(content: string, name: string): boolean {
      if (/^[\x00-\x7f]+$/.test(name) && !name.includes(' ')) {
        return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(content);
      }
      return content.includes(name);
    }

    it.each(files)('%s contains no forbidden artist/song name strings', file => {
      const content = fs.readFileSync(join(repoRoot, file), 'utf8').toLowerCase();
      for (const name of FORBIDDEN_NAMES) {
        expect(sourceContainsName(content, name)).toBe(false);
      }
    });
  });
});
