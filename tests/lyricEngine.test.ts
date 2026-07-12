import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { assertLyricDiversity } from '../src/core/lyricEngine';
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
