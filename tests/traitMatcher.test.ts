import { describe, expect, it } from 'vitest';
import { genreLibrary, getGenreById } from '../src/data/genreLibrary';
import { matchGenresByTraits, tokenOverlap } from '../src/core/traitMatcher';

/**
 * v3.65 (TASK B-4) — the 5 validation profiles the task spec itself
 * specifies, plus focused unit tests on tokenOverlap and the estimation
 * fallback for genres with no .traits.
 */

describe('[v3.65] tokenOverlap', () => {
  it('scores a close-but-not-identical phrase highly (partial match, not just exact string match)', () => {
    const score = tokenOverlap(['12-string acoustic guitar'], ['12-string guitar']);
    expect(score).toBeGreaterThan(0.5);
  });

  it('scores completely unrelated phrases at 0', () => {
    expect(tokenOverlap(['breakbeat drums'], ['nylon guitar'])).toBe(0);
  });

  it('returns 0 when either side is empty/undefined', () => {
    expect(tokenOverlap(undefined, ['guitar'])).toBe(0);
    expect(tokenOverlap([], ['guitar'])).toBe(0);
  });
});

describe('[v3.65 TASK B-4] matchGenresByTraits validation profiles', () => {
  it('1. Simon & Garfunkel-style profile surfaces oldpop-folk-rock-70s and/or oldpop-close-harmony-duo near the top', () => {
    const matches = matchGenresByTraits({
      eraTag: '1960s',
      instrumentation: ['12-string acoustic guitar', 'upright bass', 'light percussion'],
      rhythmFeel: ['gentle walking tempo', 'minimal syncopation'],
      harmonyTraits: ['modal folk harmony', 'suspended chords'],
      vocalTraits: ['two-part male close harmony', 'clear diction'],
      dynamicRange: 'low'
    }, genreLibrary, 5);
    const ids = matches.map(m => m.genreId);
    expect(ids).toContain('oldpop-folk-rock-70s');
    expect(matches[0].score).toBeGreaterThan(0);
  });

  it('2. chanson-style profile puts chanson clearly first', () => {
    const matches = matchGenresByTraits({
      instrumentation: ['accordion'],
      rhythmFeel: ['waltz'],
      harmonyTraits: ['minor-key circular progression'],
      vocalTraits: ['declamatory close-mic vocal'],
      productionTraits: ['small room tone']
    }, genreLibrary, 5);
    expect(matches[0].genreId).toBe('chanson');
  });

  it('3. ABBA-style profile puts oldpop-europop-glow clearly first', () => {
    const matches = matchGenresByTraits({
      vocalTraits: ['layered female harmony'],
      rhythmFeel: ['4/4 four-on-the-floor pulse'],
      harmonyTraits: ['minor verse to major chorus'],
      productionTraits: ['bright wide mix']
    }, genreLibrary, 5);
    expect(matches[0].genreId).toBe('oldpop-europop-glow');
  });

  it('4. Carpenters-style profile surfaces oldpop-baroque-pop in the top 5', () => {
    const matches = matchGenresByTraits({
      instrumentation: ['electric piano', 'oboe'],
      harmonyTraits: ['sixth and ninth extended chords'],
      vocalTraits: ['low female contralto'],
      productionTraits: ['dry, little reverb']
    }, genreLibrary, 5);
    const ids = matches.map(m => m.genreId);
    expect(ids).toContain('oldpop-baroque-pop');
  });

  it('5. an unrelated profile (drum-and-bass + opera) never scores above 0.4 for any genre — no forced high score', () => {
    const matches = matchGenresByTraits({
      instrumentation: ['breakbeat drums', 'operatic soprano', 'sub bass'],
      rhythmFeel: ['170 bpm breakbeat'],
      harmonyTraits: ['operatic aria harmony'],
      vocalTraits: ['operatic soprano vibrato']
    }, genreLibrary, 5);
    for (const match of matches) {
      expect(match.score, `${match.genreId}`).toBeLessThan(0.4);
    }
  });
});

describe('[v3.65] matchGenresByTraits fallback estimation for genres with no .traits', () => {
  it('still returns a score for a genre with no traits data (estimated from styleCore/instruments)', () => {
    const genreWithoutTraits = genreLibrary.find(g => !g.traits);
    expect(genreWithoutTraits, 'expected at least one genre without .traits to exist').toBeTruthy();
    const matches = matchGenresByTraits({ instrumentation: genreWithoutTraits!.instruments.slice(0, 1) }, [genreWithoutTraits!], 1);
    expect(matches[0].score).toBeGreaterThan(0);
  });

  it('a genre with real traits and a genre without traits can both be scored side by side without throwing', () => {
    const withTraits = getGenreById('chanson')!;
    const withoutTraits = genreLibrary.find(g => !g.traits)!;
    expect(() => matchGenresByTraits({ instrumentation: ['accordion'] }, [withTraits, withoutTraits], 2)).not.toThrow();
  });
});

describe('[v3.65] traits coverage sanity', () => {
  it('at least 60 genres have .traits populated', () => {
    expect(genreLibrary.filter(g => g.traits).length).toBeGreaterThanOrEqual(60);
  });

  it('every oldpop-* genre (28 total) has .traits', () => {
    const oldpopGenres = genreLibrary.filter(g => g.id.startsWith('oldpop-'));
    expect(oldpopGenres.length).toBe(28);
    for (const genre of oldpopGenres) {
      expect(genre.traits, genre.id).toBeTruthy();
    }
  });

  it('every traits axis (except structureTraits/dynamicRange) has 2-5 items for every genre with traits', () => {
    const axes = ['instrumentation', 'rhythmFeel', 'harmonyTraits', 'productionTraits', 'vocalTraits', 'structureTraits'] as const;
    for (const genre of genreLibrary.filter(g => g.traits)) {
      for (const axis of axes) {
        const len = genre.traits![axis].length;
        expect(len, `${genre.id}.${axis}`).toBeGreaterThanOrEqual(2);
        expect(len, `${genre.id}.${axis}`).toBeLessThanOrEqual(5);
      }
    }
  });
});
