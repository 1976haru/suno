import { describe, expect, it } from 'vitest';
import { applySetTitlePrefix, applySetTitlePrefixesToBlueprint, stripSetTitlePrefix } from '../src/utils/generation';
import type { PlaylistBlueprint } from '../src/types';

describe('[v3.35] applySetTitlePrefix / stripSetTitlePrefix', () => {
  it('prefixes with the 2-digit trackNo and a ". " separator', () => {
    expect(applySetTitlePrefix(3, 'Winterglass')).toBe('03. Winterglass');
    expect(applySetTitlePrefix(18, 'Hold On Tonight')).toBe('18. Hold On Tonight');
  });

  it('does not zero-pad past 2 digits for trackNo >= 100 (still just the number as-is)', () => {
    expect(applySetTitlePrefix(100, 'X')).toBe('100. X');
  });

  it('strips a leading "NN. " prefix back to the bare creative title', () => {
    expect(stripSetTitlePrefix('03. Winterglass')).toBe('Winterglass');
    expect(stripSetTitlePrefix('18. Hold On Tonight')).toBe('Hold On Tonight');
  });

  it('is a no-op on a title with no prefix', () => {
    expect(stripSetTitlePrefix('Winterglass')).toBe('Winterglass');
  });

  it('round-trips: strip(apply(n, title)) === title', () => {
    for (const [n, title] of [[1, 'Coffee Steam'], [9, 'Winterglass'], [18, 'Hold On Tonight']] as [number, string][]) {
      expect(stripSetTitlePrefix(applySetTitlePrefix(n, title))).toBe(title);
    }
  });

  it('the same core title with different set prefixes strips to the identical string (the whole point — prevents "01. X" vs "05. X" false-negative dedup)', () => {
    const a = stripSetTitlePrefix(applySetTitlePrefix(1, 'Winterglass'));
    const b = stripSetTitlePrefix(applySetTitlePrefix(5, 'Winterglass'));
    expect(a).toBe(b);
  });

  it('never strips a number that is not immediately followed by ". " (a legitimate title starting with digits is left alone)', () => {
    expect(stripSetTitlePrefix('24 Hours of Rain')).toBe('24 Hours of Rain');
    expect(stripSetTitlePrefix('1989 Was A Good Year')).toBe('1989 Was A Good Year');
  });

  it('TASK v3.40: prefixes every song in a single-pack blueprint, 01 through 18', () => {
    const blueprint: PlaylistBlueprint = {
      projectTitle: 'Single Pack',
      channelName: 'Test Channel',
      oneLineConcept: 'x',
      sonicSignature: 'x',
      vocalSignature: 'x',
      lyricRules: [],
      harmonyRules: [],
      visualRules: [],
      songs: Array.from({ length: 18 }, (_, i) => ({
        trackNo: i + 1,
        title: `Song ${i + 1}`,
        seasonMoment: 'x',
        listenerSituation: 'x',
        emotionArc: 'x',
        hookPhrase: `Hook ${i + 1}`,
        stylePrompt: 'warm pop, I-V-vi-IV progression',
        lyrics: '[verse 1]\nline\n[chorus]\nhook\nhook\n[end]',
        youtube: { title: 'x', description: 'x', tags: ['x'] },
        qualityScore: 0,
        warnings: []
      }))
    };

    const prefixed = applySetTitlePrefixesToBlueprint(blueprint, true);

    expect(prefixed.songs.map(song => song.title)).toEqual(
      Array.from({ length: 18 }, (_, i) => `${String(i + 1).padStart(2, '0')}. Song ${i + 1}`)
    );
  });

  it('TASK v3.40: disabling the option strips any existing display prefix instead of preserving stale numbering', () => {
    const blueprint: PlaylistBlueprint = {
      projectTitle: 'Single Pack',
      channelName: 'Test Channel',
      oneLineConcept: 'x',
      sonicSignature: 'x',
      vocalSignature: 'x',
      lyricRules: [],
      harmonyRules: [],
      visualRules: [],
      songs: [
        {
          trackNo: 1,
          title: '01. Winterglass',
          seasonMoment: 'x',
          listenerSituation: 'x',
          emotionArc: 'x',
          hookPhrase: 'Hook One',
          stylePrompt: 'warm pop, I-V-vi-IV progression',
          lyrics: '[verse 1]\nline\n[chorus]\nhook\nhook\n[end]',
          youtube: { title: 'x', description: 'x', tags: ['x'] },
          qualityScore: 0,
          warnings: []
        }
      ]
    };

    expect(applySetTitlePrefixesToBlueprint(blueprint, false).songs[0].title).toBe('Winterglass');
  });
});
