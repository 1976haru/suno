import { describe, expect, it, vi } from 'vitest';
import {
  buildLyricsTranslationBridgeInstruction,
  importLyricsTranslationsJson,
  LYRICS_TRANSLATION_BRIDGE_OUTPUT_FILENAME,
  songLyricLinesFor,
  translateSongLyricsBatch,
  type SongLyricLines
} from '../src/core/lyricsTranslation';
import type { ProviderSettings } from '../src/types';

const SAMPLE_LYRICS = `[male vocal]
Title: Hand Friend & Glow

[verse 1]
Beneath a new year ceiling
of quiet gray and gold

[chorus]
Hold My Hand, Friend
softly through the day`;

describe('[v3.57] songLyricLinesFor', () => {
  it('extracts only the sung lines, in order, per song', () => {
    const result = songLyricLinesFor([{ trackNo: 1, lyrics: SAMPLE_LYRICS }]);
    expect(result).toEqual([
      { trackNo: 1, lines: ['Beneath a new year ceiling', 'of quiet gray and gold', 'Hold My Hand, Friend', 'softly through the day'] }
    ]);
  });
});

const SONGS: SongLyricLines[] = [
  { trackNo: 1, lines: ['line one', 'line two'] },
  { trackNo: 2, lines: ['only line'] }
];

describe('[v3.57] translateSongLyricsBatch (mocked API)', () => {
  it('parses a well-formed response into a trackNo-keyed map', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      blueprint: {
        translations: [
          { trackNo: 1, ko: ['한 줄', '두 줄'], ja: ['一行目', '二行目'] },
          { trackNo: 2, ko: ['유일한 줄'], ja: ['唯一の行'] }
        ]
      }
    }), { status: 200 })));

    const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.7, proxyEndpoint: '/api/generate' };
    const { translations, errors } = await translateSongLyricsBatch(SONGS, settings);
    expect(errors).toEqual([]);
    expect(translations.get(1)).toEqual({ ko: ['한 줄', '두 줄'], ja: ['一行目', '二行目'] });
    expect(translations.get(2)).toEqual({ ko: ['유일한 줄'], ja: ['唯一の行'] });
    vi.unstubAllGlobals();
  });

  it('drops only the mismatched language for a track whose line count is wrong, keeps the other', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      blueprint: {
        translations: [
          { trackNo: 1, ko: ['한 줄'], ja: ['一行目', '二行目'] } // ko has 1 line, expected 2
        ]
      }
    }), { status: 200 })));

    const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.7, proxyEndpoint: '/api/generate' };
    const { translations, errors } = await translateSongLyricsBatch(SONGS, settings);
    expect(translations.get(1)?.ko).toBeUndefined();
    expect(translations.get(1)?.ja).toEqual(['一行目', '二行目']);
    expect(errors.some(e => e.includes('트랙 1') && e.includes('한국어'))).toBe(true);
    vi.unstubAllGlobals();
  });

  it('reports a missing track entirely', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      blueprint: { translations: [{ trackNo: 1, ko: ['한 줄', '두 줄'], ja: ['一行目', '二行目'] }] }
    }), { status: 200 })));

    const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.7, proxyEndpoint: '/api/generate' };
    const { translations, errors } = await translateSongLyricsBatch(SONGS, settings);
    expect(translations.has(2)).toBe(false);
    expect(errors.some(e => e.includes('트랙 2'))).toBe(true);
    vi.unstubAllGlobals();
  });

  it('returns empty results for an empty song list without calling fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.7, proxyEndpoint: '/api/generate' };
    const { translations, errors } = await translateSongLyricsBatch([], settings);
    expect(translations.size).toBe(0);
    expect(errors).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('[v3.57] buildLyricsTranslationBridgeInstruction', () => {
  it('embeds every song\'s lines and the fixed output filename', () => {
    const instruction = buildLyricsTranslationBridgeInstruction(SONGS);
    expect(instruction).toContain(LYRICS_TRANSLATION_BRIDGE_OUTPUT_FILENAME);
    expect(instruction).toContain('"trackNo": 1');
    expect(instruction).toContain('line one');
    expect(instruction).toContain('only line');
    expect(instruction).toMatch(/no Anthropic\/OpenAI API call/i);
  });
});

describe('[v3.57] importLyricsTranslationsJson', () => {
  it('imports a well-formed JSON file', () => {
    const raw = JSON.stringify({
      translations: [
        { trackNo: 1, ko: ['한 줄', '두 줄'], ja: ['一行目', '二行目'] },
        { trackNo: 2, ko: ['유일한 줄'], ja: ['唯一の行'] }
      ]
    });
    const { translations, report } = importLyricsTranslationsJson(raw, SONGS);
    expect(report.imported).toBe(2);
    expect(report.errors).toEqual([]);
    expect(translations.get(1)?.ko).toEqual(['한 줄', '두 줄']);
  });

  it('tolerates a markdown-fenced JSON block', () => {
    const raw = '```json\n' + JSON.stringify({
      translations: [
        { trackNo: 1, ko: ['한 줄', '두 줄'], ja: ['一行目', '二行目'] },
        { trackNo: 2, ko: ['유일한 줄'], ja: ['唯一の行'] }
      ]
    }) + '\n```';
    const { report } = importLyricsTranslationsJson(raw, SONGS);
    expect(report.imported).toBe(2);
  });

  it('reports a clear error for unparseable input instead of throwing', () => {
    const { translations, report } = importLyricsTranslationsJson('not json at all', SONGS);
    expect(translations.size).toBe(0);
    expect(report.imported).toBe(0);
    expect(report.errors.length).toBeGreaterThan(0);
  });

  it('reports a line-count mismatch instead of silently misaligning lines', () => {
    const raw = JSON.stringify({
      translations: [
        { trackNo: 1, ko: ['too', 'many', 'lines', 'here'], ja: ['一行目', '二行目'] },
        { trackNo: 2, ko: ['유일한 줄'], ja: ['唯一の行'] }
      ]
    });
    const { translations, report } = importLyricsTranslationsJson(raw, SONGS);
    expect(translations.get(1)?.ko).toBeUndefined();
    expect(translations.get(1)?.ja).toEqual(['一行目', '二行目']);
    expect(report.errors.some(e => e.includes('트랙 1'))).toBe(true);
  });
});
