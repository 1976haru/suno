import { describe, expect, it } from 'vitest';
import {
  deriveVersionLabel,
  groupMatchesByTrackNo,
  labelTakesInGroup,
  matchAudioFileName,
  matchAudioFiles,
  missingTrackNumbers,
  parseLeadingTrackNumber,
  parseVersionSuffix
} from '../src/core/audioTrackMatch';

const candidates = [
  { trackNo: 1, title: 'Two Sugars' },
  { trackNo: 2, title: 'Faded Ink' },
  { trackNo: 3, title: 'Slow Circle' },
  { trackNo: 5, title: 'Two Lanes' },
  { trackNo: 12, title: 'Rural Route' }
];

describe('[v3.73 TASK B] parseLeadingTrackNumber / parseVersionSuffix', () => {
  it('parses a leading number with a space separator', () => {
    expect(parseLeadingTrackNumber('01 Two Sugars')).toBe(1);
    expect(parseLeadingTrackNumber('12 Rural Route')).toBe(12);
  });

  it('returns null when there is no leading number', () => {
    expect(parseLeadingTrackNumber('Two Sugars')).toBeNull();
  });

  it('parses a duplicate-take "(1)" suffix separately from the base name', () => {
    expect(parseVersionSuffix('01 Two Sugars (1)')).toEqual({ baseName: '01 Two Sugars', versionSuffix: '(1)', versionNumber: 1 });
    expect(parseVersionSuffix('01 Two Sugars')).toEqual({ baseName: '01 Two Sugars' });
  });
});

describe('[v3.73 TASK B] matchAudioFileName', () => {
  it('matches by leading trackNo, the primary rule', () => {
    const result = matchAudioFileName('01 Two Sugars.mp3', candidates);
    expect(result).toMatchObject({ trackNo: 1, matchMethod: 'trackNo' });
  });

  it('matches a non-contiguous trackNo (12)', () => {
    const result = matchAudioFileName('12 Rural Route.mp3', candidates);
    expect(result).toMatchObject({ trackNo: 12, matchMethod: 'trackNo' });
  });

  it('falls back to title match when the leading number does not correspond to a real trackNo', () => {
    // trackNo 99 doesn't exist in this pack, but the title after the number does.
    const result = matchAudioFileName('99 Two Lanes.mp3', candidates);
    expect(result).toMatchObject({ trackNo: 5, matchMethod: 'title' });
  });

  it('matches by title alone when there is no leading number at all', () => {
    const result = matchAudioFileName('Faded Ink.mp3', candidates);
    expect(result).toMatchObject({ trackNo: 2, matchMethod: 'title' });
  });

  it('title match is case/whitespace insensitive', () => {
    const result = matchAudioFileName('  slow   circle  .mp3', candidates);
    expect(result).toMatchObject({ trackNo: 3, matchMethod: 'title' });
  });

  it('reports "none" (not an error) when nothing matches, for manual-assign UI', () => {
    const result = matchAudioFileName('random_export_9284.mp3', candidates);
    expect(result.matchMethod).toBe('none');
    expect(result.trackNo).toBeUndefined();
  });

  it('extracts the "(1)"/"(2)" duplicate-take suffix alongside a successful match', () => {
    const first = matchAudioFileName('01 Two Sugars (1).mp3', candidates);
    const second = matchAudioFileName('01 Two Sugars (2).mp3', candidates);
    expect(first).toMatchObject({ trackNo: 1, versionSuffix: '(1)' });
    expect(second).toMatchObject({ trackNo: 1, versionSuffix: '(2)' });
  });
});

describe('[v3.73 TASK B] a partial upload (5 of 18 tracks) never errors, just reports missing', () => {
  const eighteenCandidates = Array.from({ length: 18 }, (_, i) => ({ trackNo: i + 1, title: `Song ${i + 1}` }));
  const fiveFiles = ['01 Song 1.mp3', '02 Song 2.mp3', '03 Song 3.mp3', '05 Song 5.mp3', '12 Song 12.mp3'];

  it('matches exactly the 5 uploaded files and lists the other 13 as missing', () => {
    const matches = matchAudioFiles(fiveFiles, eighteenCandidates);
    expect(matches.every(m => m.matchMethod === 'trackNo')).toBe(true);
    const missing = missingTrackNumbers(matches, eighteenCandidates);
    expect(missing).toHaveLength(13);
    expect(missing).not.toContain(1);
    expect(missing).not.toContain(12);
    expect(missing).toContain(4);
  });

  it('groups multiple takes of the same track together instead of overwriting', () => {
    const matches = matchAudioFiles(['01 Song 1.mp3', '01 Song 1 (1).mp3', '01 Song 1 (2).mp3'], eighteenCandidates);
    const grouped = groupMatchesByTrackNo(matches);
    expect(grouped.get(1)).toHaveLength(3);
  });
});

describe('[v3.74 TASK B] version marker recognition — "v2"/"_2", not just "(N)"', () => {
  it('recognizes a "v2" suffix', () => {
    const result = matchAudioFileName('01 Two Sugars v2.mp3', candidates);
    expect(result).toMatchObject({ trackNo: 1, versionNumber: 2 });
  });

  it('recognizes a bare trailing "_2" suffix', () => {
    const result = matchAudioFileName('01 Two Sugars_2.mp3', candidates);
    expect(result).toMatchObject({ trackNo: 1, versionNumber: 2 });
  });

  it('a plain filename with no marker at all has no versionNumber', () => {
    const result = matchAudioFileName('01 Two Sugars.mp3', candidates);
    expect(result.versionNumber).toBeUndefined();
  });
});

describe('[v3.74 TASK B] deriveVersionLabel / labelTakesInGroup', () => {
  it('an explicit version number always maps to the same letter regardless of which filename shape produced it', () => {
    expect(deriveVersionLabel(1, 0)).toBe('A');
    expect(deriveVersionLabel(2, 0)).toBe('B');
  });

  it('a group with one marked ("v2") and one unmarked file: the unmarked one fills in the gap, not always "A"', () => {
    const matches = matchAudioFiles(['01 Two Sugars.mp3', '01 Two Sugars v2.mp3'], candidates);
    const labeled = labelTakesInGroup(matches);
    const byFile = new Map(labeled.map(m => [m.fileName, m.versionLabel]));
    expect(byFile.get('01 Two Sugars.mp3')).toBe('A');
    expect(byFile.get('01 Two Sugars v2.mp3')).toBe('B');
  });

  it('3+ unmarked takes of the same track get distinct sequential labels', () => {
    const matches = matchAudioFiles(['01 Two Sugars.mp3', '01 Two Sugars (1).mp3', '01 Two Sugars (2).mp3'], candidates);
    const labeled = labelTakesInGroup(matches);
    expect(new Set(labeled.map(m => m.versionLabel)).size).toBe(3);
  });
});
