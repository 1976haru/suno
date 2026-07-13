import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import {
  HOOK_SHAPES,
  buildShapeSequence,
  hookWordCount,
  matchHookShape
} from '../src/core/lyricEngine';
import { hookStyleDirectives } from '../src/core/promptComposer';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

const LANGUAGES = ['english', 'korean', 'japanese'] as const;

function bodyLines(lyrics: string): string[] {
  return lyrics
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('[') && !line.startsWith('Title:'));
}

describe('hook engine (v3.3, TASK A1-A5)', () => {
  it.each(LANGUAGES)('[H4] every hook is 2-5 words, in %s', language => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30, lyricLanguage: language }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      const count = hookWordCount(song.hookPhrase);
      // Non-whitespace-delimited languages (Japanese) collapse to 1 "word" by this metric;
      // the meaningful constraint there is covered by the syllable/character checks instead.
      if (language === 'japanese') continue;
      expect(count, `hook "${song.hookPhrase}" has ${count} words`).toBeGreaterThanOrEqual(2);
      expect(count, `hook "${song.hookPhrase}" has ${count} words`).toBeLessThanOrEqual(5);
    }
  });

  it.each(LANGUAGES)('[H4] no hook starts with a lowercase letter, in %s', language => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30, lyricLanguage: language }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      const firstLetter = [...song.hookPhrase].find(ch => /\p{L}/u.test(ch));
      if (!firstLetter) continue;
      const isLowercase = firstLetter === firstLetter.toLowerCase() && firstLetter !== firstLetter.toUpperCase();
      expect(isLowercase, `hook "${song.hookPhrase}" starts with a lowercase letter`).toBe(false);
    }
  });

  it.each(LANGUAGES)('[H2] every title contains the hook phrase verbatim, in %s', language => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30, lyricLanguage: language }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(song.title.toLowerCase().includes(song.hookPhrase.toLowerCase()), `title "${song.title}" does not contain hook "${song.hookPhrase}"`).toBe(true);
    }
  });

  it.each(LANGUAGES)('[H1] the hook appears as its own line 4-7 times in the song body, in %s', language => {
    // Counts exact body-line matches, not a raw substring count across the whole
    // lyrics blob — when title === hookPhrase verbatim (no prefix), the "Title: X"
    // header line also contains the hook substring, which would otherwise inflate
    // the count by 1 without reflecting an actual extra sung repetition.
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30, lyricLanguage: language }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      const count = bodyLines(song.lyrics).filter(line => line === song.hookPhrase).length;
      expect(count, `hook "${song.hookPhrase}" appears ${count}x in "${song.title}"`).toBeGreaterThanOrEqual(4);
      expect(count, `hook "${song.hookPhrase}" appears ${count}x in "${song.title}"`).toBeLessThanOrEqual(7);
    }
  });

  it.each(LANGUAGES)('[H3] no hook matches the vocative-object pattern ("Hold on, coffee"), in %s', language => {
    const objectWords = /,\s*(the\s+)?(coffee|window|radio|letter|train|doorway|umbrella|lamp|calendar|record|photograph|photo|sweater|candle|street|cup|커피|창문|창가|라디오|편지|기차|문가|우산|램프|달력|레코드|사진|스웨터|촛불|거리|잔|コーヒー|窓|ラジオ|手紙|列車|電車|戸口|傘|ランプ|カレンダー|レコード|写真|セーター|キャンドル|通り|カップ)/i;
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30, lyricLanguage: language }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(objectWords.test(song.hookPhrase), `hook "${song.hookPhrase}" matches a vocative-object pattern`).toBe(false);
    }
  });

  it('[H3] all 4 hook shapes appear at least 15% of the time across a 30-song pack', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 30, lyricLanguage: 'english' }), testGenres, testMoods, testSeason);
    const counts: Record<string, number> = { vocative: 0, imperative: 0, nounPhrase: 0, declarative: 0 };
    for (const song of bp.songs) {
      const shape = matchHookShape(song.hookPhrase, 'english');
      if (shape) counts[shape] += 1;
    }
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    expect(total, 'every hook should match some curated shape bank').toBe(30);
    for (const shape of HOOK_SHAPES) {
      expect(counts[shape] / total, `shape "${shape}" only appeared ${counts[shape]}/${total} times`).toBeGreaterThanOrEqual(0.15);
    }
  });

  it('buildShapeSequence distributes all 4 shapes for songCount=30, each >=15%', () => {
    const sequence = buildShapeSequence(30, 12345);
    expect(sequence.length).toBe(30);
    for (const shape of HOOK_SHAPES) {
      const count = sequence.filter(s => s === shape).length;
      expect(count / 30).toBeGreaterThanOrEqual(0.15);
    }
  });

  it.each(LANGUAGES)('[pre-chorus] a [pre-chorus] section with exactly 2 lines exists before [chorus], in %s', language => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 5, lyricLanguage: language }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(song.lyrics).toContain('[pre-chorus]');
      const section = song.lyrics.split('[pre-chorus]')[1].split('[chorus]')[0];
      const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
      expect(lines.length, `pre-chorus for "${song.title}" has ${lines.length} lines`).toBe(2);
    }
  });

  it.each(LANGUAGES)('[bookend] every [chorus]/[final chorus] section opens and closes with the hook, in %s', language => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 5, lyricLanguage: language }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      const sections = song.lyrics.split(/\[chorus\]|\[final chorus\]/).slice(1);
      // Last split segment includes [verse 2]/[short bridge]/[end] tags after the first chorus,
      // so only check up to the next recognized tag boundary for each chorus-type section.
      const boundaries = ['[verse 2]', '[short bridge]', '[end]'];
      for (const raw of sections) {
        let section = raw;
        for (const boundary of boundaries) {
          const idx = section.indexOf(boundary);
          if (idx !== -1) section = section.slice(0, idx);
        }
        const lines = section.split('\n').map(l => l.trim()).filter(Boolean);
        expect(lines[0], `chorus section for "${song.title}" doesn't open with the hook`).toBe(song.hookPhrase);
        expect(lines[lines.length - 1], `chorus section for "${song.title}" doesn't close with the hook`).toBe(song.hookPhrase);
      }
    }
  });

  it('[H5] style prompt tells Suno to bookend and repeat the hook', () => {
    const directive = hookStyleDirectives('Hold On', 'commercial');
    expect(directive).toContain('short repeated chorus hook');
    expect(directive).toContain('identical melody');
    expect(directive).toContain('3-4 clear returns');
  });

  it('[H5] poetic depth softens the repeat count to 3', () => {
    const directive = hookStyleDirectives('Hold On', 'poetic');
    expect(directive).toContain('3 clear returns');
  });

  it.each(LANGUAGES)('[H5] every generated song stylePrompt includes the hook bookend directive, in %s', language => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 3, lyricLanguage: language }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(song.stylePrompt).toContain('short repeated chorus hook');
      expect(song.stylePrompt).toContain('identical melody');
    }
  });
});
