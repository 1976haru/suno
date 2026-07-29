import { describe, expect, it } from 'vitest';
import {
  buildSrtCues,
  buildSrtFile,
  extractLyricSungLines,
  formatSrtTimestamp,
  parseDurationToSeconds,
  srtFilename
} from '../src/core/srtExport';

const SAMPLE_LYRICS = `[male vocal]
Title: Hand Friend & Glow

[cold open]
Hold My Hand, Friend

[verse 1]
Beneath a new year ceiling
of quiet gray and gold

[pre-chorus]
Right here in this moment
I stop and I say

[chorus]
Hold My Hand, Friend
softly through the day

[short bridge]
Some words never leave us

[final chorus]
Hold My Hand, Friend
warm however far

[end]`;

describe('[v3.57] extractLyricSungLines', () => {
  it('strips the vocal meta tag, Title line, section tags, and blank lines', () => {
    const lines = extractLyricSungLines(SAMPLE_LYRICS);
    const texts = lines.map(line => line.text);
    expect(texts).not.toContain('[male vocal]');
    expect(texts.some(text => text.startsWith('Title:'))).toBe(false);
    expect(texts).not.toContain('[verse 1]');
    expect(texts).toContain('Hold My Hand, Friend');
    expect(texts).toContain('Beneath a new year ceiling');
  });

  it('tags each sung line with its nearest preceding section', () => {
    const lines = extractLyricSungLines(SAMPLE_LYRICS);
    const verseLine = lines.find(line => line.text === 'Beneath a new year ceiling');
    const chorusLine = lines.find(line => line.text === 'softly through the day');
    const bridgeLine = lines.find(line => line.text === 'Some words never leave us');
    expect(verseLine?.sectionTag).toBe('verse 1');
    expect(chorusLine?.sectionTag).toBe('chorus');
    expect(bridgeLine?.sectionTag).toBe('short bridge');
  });

  it('produces no cue for a bare closing tag like [end] with nothing under it', () => {
    const lines = extractLyricSungLines(SAMPLE_LYRICS);
    expect(lines.some(line => line.sectionTag === 'end')).toBe(false);
  });

  it('returns an empty array for empty input', () => {
    expect(extractLyricSungLines('')).toEqual([]);
  });
});

describe('[v3.57] buildSrtCues', () => {
  const lines = extractLyricSungLines(SAMPLE_LYRICS);

  it('returns one cue per sung line, sequential index from 1', () => {
    const cues = buildSrtCues(lines, 180);
    expect(cues).toHaveLength(lines.length);
    expect(cues.map(cue => cue.index)).toEqual(lines.map((_, i) => i + 1));
  });

  it('cues are contiguous (no gaps/overlaps) and the last cue ends exactly at the total duration', () => {
    const cues = buildSrtCues(lines, 180);
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i].startMs).toBe(cues[i - 1].endMs);
    }
    expect(cues[cues.length - 1].endMs).toBe(180_000);
    expect(cues[0].startMs).toBe(0);
  });

  it('weights chorus lines heavier than pre-chorus/bridge lines of otherwise equal count', () => {
    const cues = buildSrtCues(lines, 180);
    const chorusLine = cues[lines.findIndex(line => line.sectionTag === 'chorus')];
    const bridgeLine = cues[lines.findIndex(line => line.sectionTag === 'short bridge')];
    const chorusDuration = chorusLine.endMs - chorusLine.startMs;
    const bridgeDuration = bridgeLine.endMs - bridgeLine.startMs;
    expect(chorusDuration).toBeGreaterThan(bridgeDuration);
  });

  it('attaches translatedText only where a translation line exists', () => {
    const translations = lines.map((_, i) => (i === 0 ? '번역된 첫 줄' : ''));
    const cues = buildSrtCues(lines, 180, translations);
    expect(cues[0].translatedText).toBe('번역된 첫 줄');
    expect(cues[1].translatedText).toBeUndefined();
  });

  it('returns an empty array for zero/negative duration or empty lines', () => {
    expect(buildSrtCues(lines, 0)).toEqual([]);
    expect(buildSrtCues(lines, -5)).toEqual([]);
    expect(buildSrtCues([], 180)).toEqual([]);
  });
});

describe('[v3.57] formatSrtTimestamp', () => {
  it('formats HH:MM:SS,mmm with zero padding', () => {
    expect(formatSrtTimestamp(0)).toBe('00:00:00,000');
    expect(formatSrtTimestamp(1500)).toBe('00:00:01,500');
    expect(formatSrtTimestamp(61_234)).toBe('00:01:01,234');
    expect(formatSrtTimestamp(3_661_004)).toBe('01:01:01,004');
  });

  it('clamps negative input to zero', () => {
    expect(formatSrtTimestamp(-100)).toBe('00:00:00,000');
  });
});

describe('[v3.57] buildSrtFile (SRT spec compliance)', () => {
  const lines = extractLyricSungLines(SAMPLE_LYRICS);
  const translations = lines.map(() => '번역');
  const cues = buildSrtCues(lines, 120, translations);

  function parseSrt(content: string) {
    return content
      .trim()
      .split(/\r?\n\r?\n/)
      .map(block => block.split(/\r?\n/));
  }

  it('en mode has index, arrow timestamp line, and exactly one text line per block', () => {
    const content = buildSrtFile(cues, 'en');
    const blocks = parseSrt(content);
    expect(blocks).toHaveLength(cues.length);
    blocks.forEach((block, i) => {
      expect(block[0]).toBe(String(i + 1));
      expect(block[1]).toMatch(/^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/);
      expect(block).toHaveLength(3);
    });
  });

  it('en-ko/en-ja mode has English line then translation line', () => {
    const content = buildSrtFile(cues, 'en-ko');
    const blocks = parseSrt(content);
    blocks.forEach((block, i) => {
      expect(block).toHaveLength(4);
      expect(block[2]).toBe(cues[i].englishText);
      expect(block[3]).toBe('번역');
    });
  });

  it('falls back to English-only for a cue missing its translation even in en-ko mode', () => {
    const partialCues = buildSrtCues(lines, 120, [lines[0] ? '번역 첫줄' : '']);
    const content = buildSrtFile(partialCues, 'en-ko');
    const blocks = parseSrt(content);
    expect(blocks[0]).toHaveLength(4);
    expect(blocks[1]).toHaveLength(3);
  });

  it('is valid UTF-8 with no BOM when encoded for a file (Korean/Japanese survive round-trip)', () => {
    const jaCues = buildSrtCues(lines, 120, lines.map(() => '日本語のテスト行'));
    const content = buildSrtFile(jaCues, 'en-ja');
    const encoded = new TextEncoder().encode(content);
    expect(encoded[0]).not.toBe(0xef);
    const decoded = new TextDecoder('utf-8').decode(encoded);
    expect(decoded).toContain('日本語のテスト行');
    expect(decoded).toBe(content);
  });

  it('returns an empty string for no cues', () => {
    expect(buildSrtFile([], 'en')).toBe('');
  });
});

describe('[v3.57] parseDurationToSeconds', () => {
  it('parses MM:SS', () => {
    expect(parseDurationToSeconds('3:15')).toBe(195);
    expect(parseDurationToSeconds('03:15')).toBe(195);
  });

  it('parses HH:MM:SS', () => {
    expect(parseDurationToSeconds('1:02:03')).toBe(3723);
  });

  it('parses bare seconds', () => {
    expect(parseDurationToSeconds('42')).toBe(42);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseDurationToSeconds('  3:15  ')).toBe(195);
  });

  it('returns null for invalid input', () => {
    expect(parseDurationToSeconds('')).toBeNull();
    expect(parseDurationToSeconds('abc')).toBeNull();
    expect(parseDurationToSeconds('3:15:30:99')).toBeNull();
    expect(parseDurationToSeconds('3:xx')).toBeNull();
  });
});

describe('[v3.57] srtFilename', () => {
  it('builds {NN}_{title}_{mode}.srt with a zero-padded track number', () => {
    expect(srtFilename(1, 'Hold My Hand, Friend', 'en')).toBe('01_Hold My Hand, Friend_en.srt');
    expect(srtFilename(12, 'Test', 'en-ko')).toBe('12_Test_en-ko.srt');
  });
});
