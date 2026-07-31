import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  CHANNEL_IDENTITY_WORD_CAP,
  findExcessiveVocabularyRepetition,
  GENERIC_WORD_CAP,
  topWordFrequencies,
  wordFrequencyAcrossPack
} from '../src/core/lyricVocabularyRepetition';
import type { SongIdea } from '../src/types';

function songWith(lyrics: string): Pick<SongIdea, 'lyrics'> {
  return { lyrics };
}

describe('[v3.64 TASK A-4] lyric vocabulary repetition', () => {
  it('counts words in the lyric body but ignores bracket-tag-only lines', () => {
    const songs = [songWith('[verse 1]\nwindow window window\n[chorus]\nhook line here')];
    const counts = wordFrequencyAcrossPack(songs);
    expect(counts.get('window')).toBe(3);
    expect(counts.has('verse')).toBe(false);
    expect(counts.has('chorus')).toBe(false);
  });

  it('flags a generic word once it exceeds the 12-occurrence cap', () => {
    const lyrics = Array.from({ length: 13 }, () => 'window').join('\n');
    const songs = [songWith(lyrics)];
    const findings = findExcessiveVocabularyRepetition(songs);
    expect(findings.some(f => f.word === 'window' && f.cap === GENERIC_WORD_CAP)).toBe(true);
  });

  it('does not flag a generic word at or under the 12-occurrence cap', () => {
    const lyrics = Array.from({ length: 12 }, () => 'window').join('\n');
    const songs = [songWith(lyrics)];
    const findings = findExcessiveVocabularyRepetition(songs);
    expect(findings.some(f => f.word === 'window')).toBe(false);
  });

  it('gives channel-identity words ("morning") a higher cap (20) than generic words', () => {
    const morningLyrics = Array.from({ length: 15 }, () => 'morning').join('\n');
    const songs = [songWith(morningLyrics)];
    expect(findExcessiveVocabularyRepetition(songs).some(f => f.word === 'morning')).toBe(false);
    const overCap = Array.from({ length: 21 }, () => 'morning').join('\n');
    expect(findExcessiveVocabularyRepetition([songWith(overCap)]).some(f => f.word === 'morning' && f.cap === CHANNEL_IDENTITY_WORD_CAP)).toBe(true);
  });

  it('ignores stopwords and short filler words entirely', () => {
    const songs = [songWith(Array.from({ length: 20 }, () => 'the and but let said').join(' '))];
    const findings = findExcessiveVocabularyRepetition(songs);
    expect(findings).toEqual([]);
  });

  it('TASK v3.64 — reproduces the real pack\'s exact reported offenders (window 28, light 27, old 27, near 22, warm 20, morning 17)', () => {
    const fixturePath = path.resolve(__dirname, 'fixtures', 'realBridgePack.json');
    const data = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
    const counts = wordFrequencyAcrossPack(data.songs);
    expect(counts.get('window')).toBe(28);
    expect(counts.get('light')).toBe(27);
    expect(counts.get('old')).toBe(27);
    expect(counts.get('near')).toBe(22);
    expect(counts.get('warm')).toBe(20);
    expect(counts.get('morning')).toBe(17);

    const findings = findExcessiveVocabularyRepetition(data.songs);
    expect(findings.some(f => f.word === 'window')).toBe(true);
    expect(findings.some(f => f.word === 'light')).toBe(true);
    expect(findings.some(f => f.word === 'old')).toBe(true);
    expect(findings.some(f => f.word === 'near')).toBe(true);
    // 'warm' and 'morning' stay under the higher channel-identity cap (20) in this real pack.
    expect(findings.some(f => f.word === 'warm')).toBe(false);
    expect(findings.some(f => f.word === 'morning')).toBe(false);
  });

  it('topWordFrequencies returns the top N regardless of cap, sorted descending', () => {
    const top = topWordFrequencies([songWith('apple apple banana')], 2);
    expect(top).toEqual([{ word: 'apple', count: 2 }, { word: 'banana', count: 1 }]);
  });
});
