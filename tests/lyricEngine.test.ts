import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint, getRecurringMotifWords } from '../src/core/localGenerator';
import { assertLyricDiversity, createTitleGenerator } from '../src/core/lyricEngine';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

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

  it.each(LANGUAGES)('[R1] the extracted hook is 4 words or fewer, in %s', language => {
    const nextTitle = createTitleGenerator(language, `hook-length-${language}`);
    for (let i = 0; i < 30; i++) {
      const { hook } = nextTitle();
      const wordCount = hook.split(/\s+/).filter(Boolean).length;
      expect(wordCount, `hook "${hook}" has ${wordCount} words`).toBeLessThanOrEqual(4);
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
