import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint, getRecurringMotifWords } from '../src/core/localGenerator';
import { assertLyricDiversity, createTitleGenerator, dedupeTitlesAcrossPack, hookRhythmLength, titleFromHook, type HookSpec } from '../src/core/lyricEngine';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

describe('lyric engine', () => {
  it('generates 1 song without error', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 1 }), testGenres, testMoods, testSeason);
    expect(bp.songs).toHaveLength(1);
    expect(bp.songs[0].lyrics).toContain('[chorus]');
  });

  it('produces 0 duplicate titles across 30 songs', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30 }), testGenres, testMoods, testSeason);
    const titles = new Set(bp.songs.map(song => song.title));
    expect(titles.size).toBe(30);
  });

  it('keeps pairwise lyric-line Jaccard similarity under 0.4 across 30 songs', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30 }), testGenres, testMoods, testSeason);
    const warnings = assertLyricDiversity(bp.songs, 0.4);
    expect(warnings).toEqual([]);
  });

  it('produces 0 duplicate chorus first lines across 30 songs', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30 }), testGenres, testMoods, testSeason);
    const chorusFirstLines = bp.songs.map(song => {
      const chorusIdx = song.lyrics.indexOf('[chorus]');
      const afterChorus = song.lyrics.slice(chorusIdx).split('\n').filter(Boolean);
      return afterChorus[1];
    });
    expect(new Set(chorusFirstLines).size).toBe(chorusFirstLines.length);
  });

  it('is deterministic for the same channel + project title + song count', () => {
    const a = generateLocalBlueprint(makeOptions({ songCount: 12 }), testGenres, testMoods, testSeason);
    const b = generateLocalBlueprint(makeOptions({ songCount: 12 }), testGenres, testMoods, testSeason);
    expect(a.songs.map(song => song.title)).toEqual(b.songs.map(song => song.title));
    expect(a.songs.map(song => song.lyrics)).toEqual(b.songs.map(song => song.lyrics));
  });

  it('produces a different pack for a different project title (different seed)', () => {
    const a = generateLocalBlueprint(makeOptions({ songCount: 5, projectTitle: 'Pack A' }), testGenres, testMoods, testSeason);
    const b = generateLocalBlueprint(makeOptions({ songCount: 5, projectTitle: 'Pack B' }), testGenres, testMoods, testSeason);
    expect(a.songs.map(song => song.title)).not.toEqual(b.songs.map(song => song.title));
  });

  it.each(['english', 'korean', 'japanese'] as const)('meets uniqueness + diversity requirements in %s', language => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30, lyricLanguage: language }), testGenres, testMoods, testSeason);
    const titles = new Set(bp.songs.map(song => song.title));
    expect(titles.size).toBe(30);
    expect(assertLyricDiversity(bp.songs, 0.4)).toEqual([]);
  });

  it('varies structure by song role (extended bridge for late-set emotional center)', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 12 }), testGenres, testMoods, testSeason);
    const opener = bp.songs[0];
    const emotionalCenter = bp.songs.find((_, idx) => idx === 7); // 'late-set emotional center' role position
    expect(opener).toBeDefined();
    expect(emotionalCenter).toBeDefined();
    const openerBridgeLines = opener.lyrics.split('[short bridge]')[1].split('[final chorus]')[0].trim().split('\n').filter(Boolean);
    const centerBridgeLines = emotionalCenter!.lyrics.split('[short bridge]')[1].split('[final chorus]')[0].trim().split('\n').filter(Boolean);
    expect(centerBridgeLines.length).toBeGreaterThan(openerBridgeLines.length);
  });
});

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

function bodyLines(lyrics: string): string[] {
  return lyrics
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('[') && !line.startsWith('Title:'));
}

const LANGUAGES = ['english', 'korean', 'japanese'] as const;

describe('v3.1 grammar/repetition regressions (B1 lyric-quality follow-up)', () => {
  it.each(LANGUAGES)('[R2] no recurring motif appears more than 3 times in any of 30 songs in %s', language => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30, lyricLanguage: language }), testGenres, testMoods, testSeason);
    const motifWords = getRecurringMotifWords(language);
    for (const song of bp.songs) {
      for (const motifWord of motifWords) {
        const count = countOccurrences(song.lyrics, motifWord);
        expect(count, `"${motifWord}" appeared ${count}x in "${song.title}"`).toBeLessThanOrEqual(3);
      }
    }
  });

  it('[R3] English lyrics never interpolate a bare "like <noun>" without an article', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30, lyricLanguage: 'english' }), testGenres, testMoods, testSeason);
    const fillables = [...getRecurringMotifWords('english'), 'morning', 'evening', 'quiet hour', 'soft light', 'gentle hour'];
    for (const song of bp.songs) {
      for (const word of fillables) {
        // "like an evening train" / "like the evening train" must not also match a *bare* "like evening train".
        expect(song.lyrics, `found bare "like ${word}" in "${song.title}"`).not.toContain(`like ${word}`);
      }
    }
  });

  it.each(LANGUAGES)('[R1] lyrics never contain the full title lowercased and stuffed into an unrelated line, in %s', language => {
    // v3.3 (TASK A1/A3) made title===hook (or title containing hook) intentional: the hook now
    // bookends every chorus verbatim, so the hook-bookend line is *expected* to match the title.
    // This guard still catches the original v3.1 bug (title text smashed into some other,
    // unrelated line) by exempting only the song's own hookPhrase line, not every line.
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30, lyricLanguage: language }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      const titleCore = song.title.split(/[,、]/)[0].trim();
      if (titleCore.length < 4) continue;
      const lowered = titleCore.toLowerCase();
      for (const line of bodyLines(song.lyrics)) {
        if (line === song.hookPhrase) continue;
        expect(line.toLowerCase()).not.toContain(lowered);
      }
    }
  });

  it.each(LANGUAGES)('[R1] the extracted hook stays inside the singable rhythm range in %s', language => {
    const nextTitle = createTitleGenerator(language, `hook-length-${language}`);
    for (let i = 0; i < 30; i++) {
      const { hook } = nextTitle();
      const rhythmLength = hookRhythmLength(hook, language);
      if (language === 'english') {
        expect(rhythmLength, `hook "${hook}" has ${rhythmLength} syllables`).toBeGreaterThanOrEqual(4);
        expect(rhythmLength, `hook "${hook}" has ${rhythmLength} syllables`).toBeLessThanOrEqual(7);
      } else if (language === 'korean') {
        expect(rhythmLength, `hook "${hook}" has ${rhythmLength} syllables`).toBeGreaterThanOrEqual(6);
        expect(rhythmLength, `hook "${hook}" has ${rhythmLength} syllables`).toBeLessThanOrEqual(10);
      } else {
        expect(rhythmLength, `hook "${hook}" has ${rhythmLength} mora`).toBeGreaterThanOrEqual(7);
        expect(rhythmLength, `hook "${hook}" has ${rhythmLength} mora`).toBeLessThanOrEqual(12);
      }
    }
  });

  it.each(LANGUAGES)('[R1] song.hookPhrase matches the actual first chorus line, in %s', language => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 12, lyricLanguage: language }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      const chorusIdx = song.lyrics.indexOf('[chorus]');
      const actualFirstChorusLine = song.lyrics.slice(chorusIdx).split('\n').filter(Boolean)[1];
      expect(song.hookPhrase).toBe(actualFirstChorusLine);
    }
  });

  it.each(['english', 'korean'] as const)('[R4] no title contains a repeated word, in %s', language => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30, lyricLanguage: language }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      const core = song.title.split(/[,、]/)[0];
      const words = core.toLowerCase().split(/\s+/).filter(Boolean);
      expect(new Set(words).size, `"${song.title}" repeats a word`).toBe(words.length);
    }
  });

  it('[R4] no duplicate titles across 30 songs (existing guarantee, re-checked here)', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30 }), testGenres, testMoods, testSeason);
    expect(new Set(bp.songs.map(song => song.title)).size).toBe(30);
  });

  it.each(LANGUAGES)('no line repeats more than twice within a single song, except the intentionally-repeated hook bookend, in %s', language => {
    // v3.3 (TASK A3) deliberately repeats the hook line 4-7 times to bookend every chorus-type
    // section — that repetition is the whole point of the hook, not the bug this test originally
    // guarded against (accidental duplicate filler lines). Exclude only the hook line itself.
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30, lyricLanguage: language }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      const counts = new Map<string, number>();
      for (const line of bodyLines(song.lyrics)) {
        if (line === song.hookPhrase) continue;
        counts.set(line, (counts.get(line) || 0) + 1);
      }
      for (const [line, count] of counts) {
        expect(count, `line "${line}" repeated ${count}x in "${song.title}"`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('[manual read-through] no Korean/Japanese title chains two genitive particles around an abstract noun', () => {
    // Regression for '오래된 아침의 정적' / '古い朝の静寂' as a time word: joinTitle() appends its own
    // 의/の after the time phrase, so a time word that already ends in 의/の produced titles like
    // "고요한 아침의 정적의 달력" ("the old morning's silence's calendar") - grammatical but reads as a
    // stacked, awkward double-possession chain. Caught only by reading actual generated titles, not
    // by any structural test (uniqueness/word-overlap checks don't see word order or particle chaining).
    for (const language of ['korean', 'japanese'] as const) {
      const bp = generateLocalBlueprint(makeOptions({ songCount: 30, lyricLanguage: language }), testGenres, testMoods, testSeason);
      for (const song of bp.songs) {
        expect(song.title).not.toMatch(/정적의|静寂の/);
      }
    }
  });
});

// TASK v3.27 (Part A4, low priority) — titleFromHook's local/offline fallback
// now rotates between 3 shapes for an English nounPhrase hook (verbatim,
// time-word prefix, hook+contrast suffix) instead of the old binary choice,
// while always keeping the hook phrase verbatim inside the title and never
// touching Korean/Japanese or non-nounPhrase shapes (see the function's own
// docstring for why those stay out of scope).
describe('[v3.27] titleFromHook shape diversity (Part A4)', () => {
  function makeHook(overrides: Partial<HookSpec> = {}): HookSpec {
    return { phrase: 'Morning Light', shape: 'nounPhrase', ...overrides };
  }

  it('every produced title still contains the hook phrase verbatim', () => {
    const usedTitles = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const title = titleFromHook(makeHook(), seed, 'english', usedTitles);
      expect(title).toContain('Morning Light');
    }
  });

  it('across many seeds, produces more than 2 distinct structural shapes for an English nounPhrase hook (verbatim / time-prefix / contrast-suffix)', () => {
    const shapes = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const usedTitles = new Set<string>();
      const title = titleFromHook(makeHook(), seed, 'english', usedTitles);
      if (title === 'Morning Light') shapes.add('verbatim');
      else if (title.startsWith('Morning Light,')) shapes.add('contrast-suffix');
      else shapes.add('time-prefix');
    }
    expect(shapes.size).toBeGreaterThan(2);
  });

  it('non-nounPhrase shapes (e.g. imperative) always stay verbatim, unaffected by the new contrast-suffix path', () => {
    const usedTitles = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const title = titleFromHook(makeHook({ shape: 'imperative', phrase: 'Hold On Tight' }), seed, 'english', usedTitles);
      expect(title).toBe('Hold On Tight');
    }
  });

  it('Korean/Japanese hooks stay verbatim regardless of shape (no particle-chaining risk reintroduced)', () => {
    const usedTitles = new Set<string>();
    for (const language of ['korean', 'japanese'] as const) {
      for (let seed = 0; seed < 20; seed++) {
        const title = titleFromHook(makeHook({ phrase: '고요한 아침' }), seed, language, usedTitles);
        expect(title === '고요한 아침' || title.startsWith('고요한 아침 #')).toBe(true);
      }
    }
  });
});

// TASK v3.27 (Part A3) — letting a remote model/coding agent write its own
// title reopens a title-only collision risk preallocateSongSlots existed to
// close (hookPhrase never has this problem — see reconcileWithPreassignedSlot
// in batchPreallocation.ts). dedupeTitlesAcrossPack is the shared post-hoc
// catch, run identically by the realtime, Batch API, and Claude Code bridge
// paths after their songs are merged/stitched/imported.
describe('[v3.27] dedupeTitlesAcrossPack', () => {
  function makeSong(trackNo: number, title: string): SongIdea {
    return {
      trackNo,
      title,
      seasonMoment: 'x',
      listenerSituation: 'x',
      emotionArc: 'x',
      hookPhrase: `Hook ${trackNo}`,
      stylePrompt: 'style',
      lyrics: '[chorus]\nline\n[end]',
      youtube: { title, description: 'd', tags: [] },
      qualityScore: 90,
      warnings: []
    };
  }

  it('leaves titles untouched when none collide', () => {
    const songs = [makeSong(1, 'First Light'), makeSong(2, 'Second Light')];
    const { songs: result, changedTrackNos } = dedupeTitlesAcrossPack(songs);
    expect(result.map(s => s.title)).toEqual(['First Light', 'Second Light']);
    expect(changedTrackNos).toEqual([]);
  });

  it('uniquifies a within-pack duplicate title and records a warning', () => {
    const songs = [makeSong(1, 'Same Title'), makeSong(2, 'Same Title')];
    const { songs: result, changedTrackNos } = dedupeTitlesAcrossPack(songs);
    const titles = result.map(s => s.title);
    expect(new Set(titles.map(t => t.trim().toLowerCase())).size).toBe(2);
    expect(titles[0]).toBe('Same Title');
    expect(titles[1]).not.toBe('Same Title');
    expect(changedTrackNos).toEqual([2]);
    expect(result[1].warnings.some(w => w.includes('auto-uniquified'))).toBe(true);
  });

  it('is case/whitespace-insensitive when detecting a duplicate', () => {
    const songs = [makeSong(1, 'Same Title'), makeSong(2, '  same title  ')];
    const { songs: result } = dedupeTitlesAcrossPack(songs);
    expect(result[1].title).not.toBe('  same title  ');
  });

  it('also catches a collision against the channel\'s cross-pack title history (avoidTitles)', () => {
    const songs = [makeSong(1, 'Old Favorite')];
    const { songs: result, changedTrackNos } = dedupeTitlesAcrossPack(songs, ['Old Favorite']);
    expect(result[0].title).not.toBe('Old Favorite');
    expect(changedTrackNos).toEqual([1]);
  });

  it('handles more collisions than the curated suffix pool by falling back to a numeric suffix', () => {
    const songs = Array.from({ length: 8 }, (_, i) => makeSong(i + 1, 'Repeat Title'));
    const { songs: result } = dedupeTitlesAcrossPack(songs);
    const titles = result.map(s => s.title.trim().toLowerCase());
    expect(new Set(titles).size).toBe(8);
  });
});
