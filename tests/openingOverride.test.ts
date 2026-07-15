import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { promoteTrackToOpeningRole } from '../src/core/openingOverride';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

describe('opening override (TASK I3, v3.11, PART D-4)', () => {
  it('promoting a later track to cold-open sends the old track 1 back to track 8\'s old (normal) role — a clean swap', () => {
    const opts = makeOptions({ songCount: 12 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const oldTarget = bp.songs.find(song => song.trackNo === 8)!;
    const { blueprint: next } = promoteTrackToOpeningRole(bp, opts, 8, 'cold-open');

    const newTrack1 = next.songs.find(song => song.trackNo === 1)!;
    const promoted = next.songs.find(song => song.trackNo === 8)!;

    expect(promoted.songRole).toBe('cold-open');
    expect(newTrack1.songRole).not.toBe('cold-open');
    expect(newTrack1.songRole).toBe(oldTarget.songRole);
  });

  it('promotion never rewrites lyrics — only the style prompt changes', () => {
    const opts = makeOptions({ songCount: 12 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const beforeTarget = bp.songs.find(song => song.trackNo === 8)!;
    const beforeHolder = bp.songs.find(song => song.trackNo === 1)!;

    const { blueprint: next } = promoteTrackToOpeningRole(bp, opts, 8, 'cold-open');
    const afterTarget = next.songs.find(song => song.trackNo === 8)!;
    const afterHolder = next.songs.find(song => song.trackNo === 1)!;

    expect(afterTarget.lyrics).toBe(beforeTarget.lyrics);
    expect(afterHolder.lyrics).toBe(beforeHolder.lyrics);
    expect(afterTarget.hookPhrase).toBe(beforeTarget.hookPhrase);
    expect(afterHolder.hookPhrase).toBe(beforeHolder.hookPhrase);
    expect(afterTarget.stylePrompt).not.toBe(beforeTarget.stylePrompt);
    expect(afterTarget.stylePrompt).toContain('no instrumental intro');
  });

  it('trackNo order is unchanged after promotion', () => {
    const opts = makeOptions({ songCount: 12 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const { blueprint: next } = promoteTrackToOpeningRole(bp, opts, 8, 'cold-open');
    expect(next.songs.map(song => song.trackNo)).toEqual(bp.songs.map(song => song.trackNo));
  });

  it('promoting a track to flagship swaps roles with the current flagship holder', () => {
    const opts = makeOptions({ songCount: 12 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const oldFlagshipTrackNo = bp.songs.find(song => song.songRole === 'flagship')!.trackNo;
    const { blueprint: next } = promoteTrackToOpeningRole(bp, opts, 9, 'flagship');

    const promoted = next.songs.find(song => song.trackNo === 9)!;
    const demoted = next.songs.find(song => song.trackNo === oldFlagshipTrackNo)!;
    expect(promoted.songRole).toBe('flagship');
    expect(demoted.songRole).not.toBe('flagship');
  });

  it('is a no-op when the target already holds the requested role', () => {
    const opts = makeOptions({ songCount: 12 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const { blueprint: next } = promoteTrackToOpeningRole(bp, opts, 1, 'cold-open');
    expect(next).toBe(bp);
  });

  it('re-validates hook collisions across the pack after promotion (defensive check)', () => {
    const opts = makeOptions({ songCount: 12 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const { blueprint: next, warning } = promoteTrackToOpeningRole(bp, opts, 8, 'cold-open');
    const hooks = next.songs.map(song => song.hookPhrase.trim().toLowerCase());
    expect(new Set(hooks).size).toBe(hooks.length);
    expect(warning).toBeUndefined();
  });

  it('returns a warning instead of throwing when the target track does not exist', () => {
    const opts = makeOptions({ songCount: 5 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const { blueprint: next, warning } = promoteTrackToOpeningRole(bp, opts, 99, 'cold-open');
    expect(next).toBe(bp);
    expect(warning).toBeTruthy();
  });
});
