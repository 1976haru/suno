import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildThumbnailSpec } from '../src/core/thumbnailSpec';
import { THUMBNAIL_PALETTES, paletteForSeason } from '../src/data/thumbnailPalettes';
import { makeOptions, testGenres, testMoods, channelPresets, seasonPacks } from './fixtures';

const LANGUAGES = ['english', 'korean', 'japanese'] as const;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const channel = c / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const [lighter, darker] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (lighter + 0.05) / (darker + 0.05);
}

describe('buildThumbnailSpec (TASK B1, v3.3)', () => {
  it.each(LANGUAGES)('headline is 2 lines, each <=8 characters, in %s', language => {
    for (const season of seasonPacks) {
      const opts = makeOptions({ songCount: 6, lyricLanguage: language, seasonId: season.id });
      const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
      const spec = buildThumbnailSpec(bp, opts, season, channelPresets[0]);
      const lines = spec.headline.split('\n');
      expect(lines.length, `headline "${spec.headline}" is not 2 lines`).toBe(2);
      for (const line of lines) {
        expect([...line].length, `headline line "${line}" exceeds 8 characters`).toBeLessThanOrEqual(8);
      }
    }
  });

  it.each(LANGUAGES)('subline is <=12 characters, in %s', language => {
    for (const songCount of [1, 12, 30]) {
      const opts = makeOptions({ songCount, lyricLanguage: language });
      const bp = generateLocalBlueprint(opts, testGenres, testMoods, seasonPacks[0]);
      const spec = buildThumbnailSpec(bp, opts, seasonPacks[0], channelPresets[0]);
      expect([...spec.subline].length, `subline "${spec.subline}" exceeds 12 characters`).toBeLessThanOrEqual(12);
    }
  });

  it('colorScheme always exactly matches one of the fixed palette table entries — never a generated color', () => {
    const knownTriples = new Set(Object.values(THUMBNAIL_PALETTES).map(p => `${p.background}|${p.accent}|${p.text}`));
    for (const season of seasonPacks) {
      const opts = makeOptions({ songCount: 6, seasonId: season.id });
      const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
      const spec = buildThumbnailSpec(bp, opts, season, channelPresets[0]);
      const triple = `${spec.colorScheme.background}|${spec.colorScheme.accent}|${spec.colorScheme.text}`;
      expect(knownTriples.has(triple), `season "${season.id}" produced an unlisted color triple: ${triple}`).toBe(true);
    }
  });

  it('every palette has background/text contrast >= 4.5:1 (senior-readability bar)', () => {
    for (const palette of Object.values(THUMBNAIL_PALETTES)) {
      expect(contrastRatio(palette.background, palette.text)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('changing the season changes the color scheme (at least between christmas and early-autumn)', () => {
    const christmas = seasonPacks.find(s => s.id === 'christmas')!;
    const earlyAutumn = seasonPacks.find(s => s.id === 'early-autumn')!;
    const optsA = makeOptions({ songCount: 6, seasonId: 'christmas' });
    const optsB = makeOptions({ songCount: 6, seasonId: 'early-autumn' });
    const bpA = generateLocalBlueprint(optsA, testGenres, testMoods, christmas);
    const bpB = generateLocalBlueprint(optsB, testGenres, testMoods, earlyAutumn);
    const specA = buildThumbnailSpec(bpA, optsA, christmas, channelPresets[0]);
    const specB = buildThumbnailSpec(bpB, optsB, earlyAutumn, channelPresets[0]);
    expect(specA.colorScheme).not.toEqual(specB.colorScheme);
  });

  it('imagePrompt always includes "no people", "no text", and "no logos"', () => {
    for (const season of seasonPacks) {
      const opts = makeOptions({ songCount: 6, seasonId: season.id });
      const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
      const spec = buildThumbnailSpec(bp, opts, season, channelPresets[0]);
      expect(spec.imagePrompt).toContain('no people');
      expect(spec.imagePrompt).toContain('no text');
      expect(spec.imagePrompt).toContain('no logos');
    }
  });

  it('forbidden always includes real-person and character-IP warnings', () => {
    const opts = makeOptions({ songCount: 6 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, seasonPacks[0]);
    const spec = buildThumbnailSpec(bp, opts, seasonPacks[0], channelPresets[0]);
    expect(spec.forbidden.some(item => item.includes('실존 인물'))).toBe(true);
    expect(spec.forbidden.some(item => item.includes('캐릭터'))).toBe(true);
  });

  it('variant changes only the headline second line, not colors/objects/composition', () => {
    const opts = makeOptions({ songCount: 6, seasonId: 'christmas' });
    const season = seasonPacks.find(s => s.id === 'christmas')!;
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
    const specA = buildThumbnailSpec(bp, opts, season, channelPresets[0], 0);
    const specB = buildThumbnailSpec(bp, opts, season, channelPresets[0], 1);
    expect(specA.colorScheme).toEqual(specB.colorScheme);
    expect(specA.objects).toEqual(specB.objects);
    expect(specA.composition).toBe(specB.composition);
    const [firstLineA] = specA.headline.split('\n');
    const [firstLineB] = specB.headline.split('\n');
    expect(firstLineA).toBe(firstLineB);
  });
});

describe('paletteForSeason', () => {
  it('every season ID maps to a real palette entry', () => {
    for (const season of seasonPacks) {
      const palette = paletteForSeason(season.id);
      expect(Object.values(THUMBNAIL_PALETTES)).toContainEqual(palette);
    }
  });
});
