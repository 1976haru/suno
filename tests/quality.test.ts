import { describe, expect, it } from 'vitest';
import { checkHookQuality, scoreSong, scoreSongs } from '../src/core/quality';
import { buildDurationControl, buildExcludePrompt, buildStylePrompt } from '../src/core/promptComposer';
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

  it('keeps the avoid/copyright safety instruction out of the Style prompt and in a separate Exclude prompt (TASK F4, v3.7)', () => {
    const opts = makeOptions();
    const prompt = buildStylePrompt(opts, testGenres, testMoods, testSeason);
    expect(prompt).not.toContain('soundalike vocals');
    const song = scoreSong(baseSong({ stylePrompt: prompt }));
    expect(song.warnings.some(w => w.startsWith('Artist imitation risk'))).toBe(false);

    const excludePrompt = buildExcludePrompt(opts);
    expect(excludePrompt).toContain('soundalike vocals');
    expect(excludePrompt).toContain('famous artist imitation');
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

describe('checkHookQuality (TASK A5, v3.3)', () => {
  it('penalizes -15 when the hook appears fewer than 3 times in the lyrics', () => {
    const song = baseSong({ title: 'Hold On', hookPhrase: 'Hold On', lyrics: '[chorus]\nHold On\nsome other line' });
    const result = checkHookQuality(song);
    expect(result.penalty).toBeGreaterThanOrEqual(15);
    expect(result.warnings.some(w => w.includes('appears only'))).toBe(true);
  });

  it('penalizes -10 when the hook does not appear in the title', () => {
    const song = baseSong({
      title: 'Some Other Title',
      hookPhrase: 'Hold On',
      lyrics: '[chorus]\nHold On\nline\nHold On\nline\nHold On'
    });
    const result = checkHookQuality(song);
    expect(result.penalty).toBeGreaterThanOrEqual(10);
    expect(result.warnings.some(w => w.includes('does not appear in the title'))).toBe(true);
  });

  it('applies zero penalty for a well-formed hook (short, repeats >=3x, in title, Title Case, no vocative-object pattern)', () => {
    const song = baseSong({
      title: 'Hold On',
      hookPhrase: 'Hold On',
      lyrics: '[chorus]\nHold On\nline one\nHold On\n\n[final chorus]\nHold On\nline two\nHold On'
    });
    const result = checkHookQuality(song);
    expect(result.penalty).toBe(0);
    expect(result.warnings).toEqual([]);
  });

  it('penalizes a hook over 6 words', () => {
    const song = baseSong({ title: 'A Very Long Hook Phrase Right Here', hookPhrase: 'A Very Long Hook Phrase Right Here', lyrics: 'A Very Long Hook Phrase Right Here\nA Very Long Hook Phrase Right Here\nA Very Long Hook Phrase Right Here' });
    expect(checkHookQuality(song).penalty).toBeGreaterThanOrEqual(10);
  });

  it('penalizes a lowercase-starting hook', () => {
    const song = baseSong({ title: 'hold on', hookPhrase: 'hold on', lyrics: 'hold on\nhold on\nhold on' });
    expect(checkHookQuality(song).penalty).toBeGreaterThanOrEqual(5);
  });

  it('penalizes the vocative-object pattern ("Hold on, coffee")', () => {
    const song = baseSong({ title: 'Hold on, coffee', hookPhrase: 'Hold on, coffee', lyrics: 'Hold on, coffee\nHold on, coffee\nHold on, coffee' });
    expect(checkHookQuality(song).penalty).toBeGreaterThanOrEqual(12);
  });
});
