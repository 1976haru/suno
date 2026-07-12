import { describe, expect, it } from 'vitest';
import { scoreSong, scoreSongs } from '../src/core/quality';
import { buildDurationControl, buildStylePrompt } from '../src/core/promptComposer';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Test Song',
    seasonMoment: 'Christmas Cafe',
    listenerSituation: 'morning coffee before the day begins',
    emotionArc: 'lonely memory to warm acceptance',
    hookPhrase: 'Test Song, keep a little light for me',
    stylePrompt: 'warm adult contemporary pop, money chord foundation: I-V-vi-IV, no long instrumental break',
    lyrics: '[short intro]\nSoft Rhodes.\n\n[verse 1]\nline one\nline two\n\n[chorus]\nline three\nline four\n\n[verse 2]\nline five\n\n[short bridge]\nline six\n\n[final chorus]\nline seven\n\n[end]',
    thumbnailText: 'Christmas Cafe',
    youtube: { title: 'YT title', description: 'YT description', tags: ['tag'], thumbnailText: 'th' },
    qualityScore: 0,
    warnings: [],
    ...overrides
  };
}

describe('quality scorer', () => {
  it('playlistShort duration control includes "no long instrumental break" (Q1 regression)', () => {
    expect(buildDurationControl('playlistShort')).toContain('no long instrumental break');
  });

  it('does not penalize playlistShort-generated songs for a missing prompt term (Q1 regression)', () => {
    const opts = makeOptions({ durationTarget: 'playlistShort' });
    const prompt = buildStylePrompt(opts, testGenres, testMoods, testSeason);
    expect(prompt).toContain('no long instrumental break');
    const song = scoreSong(baseSong({ stylePrompt: prompt }));
    expect(song.warnings.some(w => w.startsWith('Missing prompt term'))).toBe(false);
  });

  it('does not penalize "저작권 안전" as a copyright risk (Q2 regression)', () => {
    const song = scoreSong(baseSong({ stylePrompt: `${baseSong().stylePrompt}, 저작권 안전` }));
    expect(song.warnings.some(w => w.startsWith('Copyright risk'))).toBe(false);
  });

  it('does not penalize "shadow" as containing the artist name "Ado" (substring regression)', () => {
    const song = scoreSong(baseSong({ lyrics: `${baseSong().lyrics}\nevery lonely shadow` }));
    expect(song.warnings.some(w => w.startsWith('Famous artist reference risk'))).toBe(false);
  });

  it('does not penalize its own generated "avoid ... soundalike vocals" safety instruction', () => {
    const opts = makeOptions();
    const prompt = buildStylePrompt(opts, testGenres, testMoods, testSeason);
    expect(prompt).toContain('soundalike vocals');
    const song = scoreSong(baseSong({ stylePrompt: prompt }));
    expect(song.warnings.some(w => w.startsWith('Artist imitation risk'))).toBe(false);
  });

  it('still detects a real imitation phrase like "in the style of Adele"', () => {
    const song = scoreSong(baseSong({ stylePrompt: `${baseSong().stylePrompt}, in the style of Adele` }));
    expect(song.warnings.some(w => w.startsWith('Artist imitation risk'))).toBe(true);
  });

  it('still detects a real famous-artist name as a standalone word', () => {
    const song = scoreSong(baseSong({ lyrics: `${baseSong().lyrics}\nsinging like Adele tonight` }));
    expect(song.warnings.some(w => w.startsWith('Famous artist reference risk'))).toBe(true);
  });

  it('scores a well-formed locally generated song >= 85', () => {
    const opts = makeOptions({ songCount: 1 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const [song] = scoreSongs(bp.songs, opts.channel);
    expect(song.qualityScore).toBeGreaterThanOrEqual(85);
  });
});
