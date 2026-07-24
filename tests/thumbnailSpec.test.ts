import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildThumbnailSpec } from '../src/core/thumbnailSpec';
import { THUMBNAIL_PALETTES, paletteForSeason } from '../src/data/thumbnailPalettes';
import { thumbnailArchetypes } from '../src/data/thumbnailArchetypes';
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
  // TASK v3.38 Part A6 — full A/B/C redesign for the Korean-serif grammar:
  // A (질문형/question), B (감성형/emotional), C (공감형/empathy) are all
  // Korean-first, up to 2 lines, 6-10 characters total (including
  // punctuation) when packagingLanguage is Korean. English/Japanese pools
  // (routed via packagingLanguage — TASK D5, unchanged mechanism) use a
  // looser bound since the exact Korean character-count rule doesn't
  // translate 1:1 across languages.
  it.each(LANGUAGES)('every headline stays within its language\'s length budget, up to 2 lines, in %s', language => {
    for (const season of seasonPacks) {
      const opts = makeOptions({ songCount: 6, lyricLanguage: language, seasonId: season.id });
      const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
      const spec = buildThumbnailSpec(bp, opts, season, channelPresets[0]);
      for (const variant of spec.variants) {
        const lines = variant.headline.split('\n');
        expect(lines.length, `${variant.id} headline "${variant.headline}" exceeds 2 lines`).toBeLessThanOrEqual(2);
        const totalChars = [...variant.headline.replace('\n', '')].length;
        if (language === 'korean') {
          expect(totalChars, `${variant.id} Korean headline "${variant.headline}" outside the 6-10 character budget`).toBeGreaterThanOrEqual(6);
          expect(totalChars, `${variant.id} Korean headline "${variant.headline}" outside the 6-10 character budget`).toBeLessThanOrEqual(10);
        } else {
          expect(totalChars, `${variant.id} ${language} headline "${variant.headline}" unreasonably long`).toBeLessThanOrEqual(24);
        }
      }
    }
  });

  it.each(LANGUAGES)('every variant subline is <=12 characters, in %s', language => {
    for (const songCount of [1, 12, 30]) {
      const opts = makeOptions({ songCount, lyricLanguage: language });
      const bp = generateLocalBlueprint(opts, testGenres, testMoods, seasonPacks[0]);
      const spec = buildThumbnailSpec(bp, opts, seasonPacks[0], channelPresets[0]);
      for (const variant of spec.variants) {
        expect([...variant.subline].length, `${variant.id}안 subline "${variant.subline}" exceeds 12 characters`).toBeLessThanOrEqual(12);
      }
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

  it('[B2] imagePrompt keeps "no text" and "no logos", but no longer bans people outright', () => {
    // TASK B2 (v3.4): a blanket "no people" was replaced with a narrower ban on
    // identifiable individuals — distant silhouettes are now explicitly welcomed,
    // since they raise emotional pull without any portrait/publicity-rights risk.
    for (const season of seasonPacks) {
      const opts = makeOptions({ songCount: 6, seasonId: season.id });
      const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
      const spec = buildThumbnailSpec(bp, opts, season, channelPresets[0]);
      expect(spec.imagePrompt).toContain('no text');
      expect(spec.imagePrompt).toContain('no logos');
      expect(spec.imagePrompt).not.toContain('no people');
    }
  });

  it('[B2] imagePrompt bans close-up/identifiable faces and real public figures', () => {
    for (const season of seasonPacks) {
      const opts = makeOptions({ songCount: 6, seasonId: season.id });
      const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
      const spec = buildThumbnailSpec(bp, opts, season, channelPresets[0]);
      expect(spec.imagePrompt).toContain('no close-up faces');
      expect(spec.imagePrompt).toContain('no identifiable person');
      expect(spec.imagePrompt).toContain('no real celebrity or public figure');
    }
  });

  it('forbidden always includes real-person and character-IP warnings', () => {
    const opts = makeOptions({ songCount: 6 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, seasonPacks[0]);
    const spec = buildThumbnailSpec(bp, opts, seasonPacks[0], channelPresets[0]);
    expect(spec.forbidden.some(item => item.includes('실존 인물'))).toBe(true);
    expect(spec.forbidden.some(item => item.includes('캐릭터'))).toBe(true);
  });

  // TASK v3.38 Part A6 — the new headline pools rotate the *whole* headline
  // per regenerate seed (no more fixed-first-line/rotating-second-line
  // split), so "stability across regenerate" now only claims colors/
  // objects/composition — headline text is expected to (and, over a big
  // enough pool, generally does) change; that's the point of "다른 문구 제안".
  it('regenerate variant changes headline wording, not colors/objects/composition', () => {
    const opts = makeOptions({ songCount: 6, seasonId: 'christmas' });
    const season = seasonPacks.find(s => s.id === 'christmas')!;
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
    const specA = buildThumbnailSpec(bp, opts, season, channelPresets[0], 0);
    const specB = buildThumbnailSpec(bp, opts, season, channelPresets[0], 1);
    expect(specA.colorScheme).toEqual(specB.colorScheme);
    expect(specA.objects).toEqual(specB.objects);
    expect(specA.composition).toBe(specB.composition);
    expect(specA.typography).toEqual(specB.typography);
  });

  it('[B1] always produces exactly 3 variants (A/B/C), each with a distinct angle and headline', () => {
    const opts = makeOptions({ songCount: 6 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, seasonPacks[0]);
    const spec = buildThumbnailSpec(bp, opts, seasonPacks[0], channelPresets[0]);
    expect(spec.variants.map(v => v.id)).toEqual(['A', 'B', 'C']);
    expect(new Set(spec.variants.map(v => v.angle)).size).toBe(3);
    expect(new Set(spec.variants.map(v => v.headline)).size).toBe(3);
  });

  it('[B1] defaults to variant A selected, and selected always matches one of the variants', () => {
    const opts = makeOptions({ songCount: 6 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, seasonPacks[0]);
    const spec = buildThumbnailSpec(bp, opts, seasonPacks[0], channelPresets[0]);
    expect(spec.selected).toBe('A');
    expect(spec.variants.some(v => v.id === spec.selected)).toBe(true);
  });

  // TASK v3.38 Part A6 — replaces the old "타겟 명시" (audience-named) C
  // strategy: A is 질문형 (question), B is 감성형 (emotional), C is 공감형
  // (empathy). Angles are fixed regardless of packagingLanguage.
  it.each(LANGUAGES)('[B1] variants use the question/emotional/empathy angle set, in %s', language => {
    const opts = makeOptions({ songCount: 6, lyricLanguage: language });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, seasonPacks[0]);
    const spec = buildThumbnailSpec(bp, opts, seasonPacks[0], channelPresets[0]);
    expect(spec.variants.find(v => v.id === 'A')!.angle).toBe('질문형');
    expect(spec.variants.find(v => v.id === 'B')!.angle).toBe('감성형');
    const variantC = spec.variants.find(v => v.id === 'C')!;
    expect(variantC.angle).toBe('공감형');
    expect(variantC.headline.length).toBeGreaterThan(0);
  });
});

describe('buildThumbnailSpec — v3.5 image-prompt rewrite', () => {
  it('[B2] objects never mix a wool sweater (autumn/winter) into a cherry-blossom (spring) thumbnail', () => {
    for (let i = 0; i < 20; i++) {
      const opts = makeOptions({ songCount: 6, seasonId: 'cherry-blossom', projectTitle: `Blossom Pack ${i}` });
      const season = seasonPacks.find(s => s.id === 'cherry-blossom')!;
      const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
      const spec = buildThumbnailSpec(bp, opts, season, channelPresets[0]);
      expect(spec.objects.some(o => o.includes('sweater') || o.includes('스웨터') || o.includes('セーター'))).toBe(false);
    }
  });

  it('[B3] imagePrompt never contains a hex color code', () => {
    for (const season of seasonPacks) {
      const opts = makeOptions({ songCount: 3, seasonId: season.id });
      const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
      const spec = buildThumbnailSpec(bp, opts, season, channelPresets[0]);
      expect(spec.imagePrompt).not.toMatch(/#[0-9A-Fa-f]{6}/);
    }
  });

  it('[B3] imagePrompt uses the palette\'s plain-English color names', () => {
    const season = seasonPacks.find(s => s.id === 'christmas')!;
    const opts = makeOptions({ songCount: 3, seasonId: season.id });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
    const spec = buildThumbnailSpec(bp, opts, season, channelPresets[0]);
    const palette = paletteForSeason(season.id);
    expect(spec.imagePrompt).toContain(palette.backgroundNameEn);
    expect(spec.imagePrompt).toContain(palette.accentNameEn);
  });

  it('[B1] imagePrompt reads as a scene (lighting/camera/composition language), not a bare object list', () => {
    const opts = makeOptions({ songCount: 3 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, seasonPacks[0]);
    const spec = buildThumbnailSpec(bp, opts, seasonPacks[0], channelPresets[0]);
    expect(spec.imagePrompt).toMatch(/light/i);
    expect(spec.imagePrompt).toMatch(/lens|bokeh|depth of field/i);
    expect(spec.imagePrompt).toMatch(/composition/i);
  });

  it('[B1] imagePrompt is specific enough to be at least 400 characters', () => {
    const opts = makeOptions({ songCount: 3 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, seasonPacks[0]);
    const spec = buildThumbnailSpec(bp, opts, seasonPacks[0], channelPresets[0]);
    expect(spec.imagePrompt.length).toBeGreaterThanOrEqual(400);
  });

  it('[B4] every tool variant is present and the Midjourney version carries --ar 16:9 and --no text', () => {
    const opts = makeOptions({ songCount: 3 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, seasonPacks[0]);
    const spec = buildThumbnailSpec(bp, opts, seasonPacks[0], channelPresets[0]);
    expect(spec.imagePromptVariants.generic).toBe(spec.imagePrompt);
    expect(spec.imagePromptVariants.midjourney).toContain('--ar 16:9');
    expect(spec.imagePromptVariants.midjourney).toContain('--no text');
    expect(spec.imagePromptVariants.stableDiffusion).toContain('Positive:');
    expect(spec.imagePromptVariants.stableDiffusion).toContain('Negative:');
  });

  it('negative/forbidden guardrails keep "no identifiable person" and a branded-IP ban across every variant', () => {
    const opts = makeOptions({ songCount: 3 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, seasonPacks[0]);
    const spec = buildThumbnailSpec(bp, opts, seasonPacks[0], channelPresets[0]);
    expect(spec.imagePrompt).toContain('no identifiable person');
    expect(spec.imagePrompt).toContain('branded IP');
    expect(spec.imagePromptVariants.midjourney).toContain('branded IP');
    expect(spec.imagePromptVariants.stableDiffusion).toContain('branded IP');
  });

  // TASK v3.38 Part A1 — object/text placement is now a fixed structural
  // rule (always left-third for text), not a per-pack seed-derived side.
  it('object/text placement (composition) is the fixed left-third layout, stable across headline regeneration', () => {
    const opts = makeOptions({ songCount: 3, seasonId: 'christmas' });
    const season = seasonPacks.find(s => s.id === 'christmas')!;
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
    const specA = buildThumbnailSpec(bp, opts, season, channelPresets[0], 0);
    const specB = buildThumbnailSpec(bp, opts, season, channelPresets[0], 5);
    expect(specA.composition).toBe(specB.composition);
    expect(specA.composition).toMatch(/왼쪽 1\/3/);
  });
});

describe('[D4] Midjourney prompt includes composition (text-safe-zone) instruction', () => {
  it('the Midjourney variant carries the same "left third reserved for text" clause the generic/SD variants do', () => {
    const opts = makeOptions({ songCount: 3, seasonId: 'christmas' });
    const season = seasonPacks.find(s => s.id === 'christmas')!;
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
    const spec = buildThumbnailSpec(bp, opts, season, channelPresets[0]);
    expect(spec.imagePromptVariants.midjourney).toMatch(/composition|intentionally empty|text overlay/i);
    expect(spec.imagePromptVariants.midjourney.toLowerCase()).toContain('left third');
  });
});

describe('[D5] thumbnail packaging language follows market, independent of lyricLanguage', () => {
  it('market=korea + lyricLanguage=english produces Korean thumbnail headlines', () => {
    const koreanChannel = channelPresets.find(c => c.market === 'korea')!;
    const opts = makeOptions({ channel: koreanChannel, songCount: 3, lyricLanguage: 'english', market: 'korea' });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, seasonPacks[0]);
    const spec = buildThumbnailSpec(bp, opts, seasonPacks[0], koreanChannel);
    expect(spec.variants.some(v => /[가-힣]/.test(v.headline))).toBe(true);
  });

  it('market=japan + lyricLanguage=english produces Japanese thumbnail headlines', () => {
    const japanChannel = channelPresets.find(c => c.market === 'japan')!;
    const opts = makeOptions({ channel: japanChannel, songCount: 3, lyricLanguage: 'english', market: 'japan' });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, seasonPacks[0]);
    const spec = buildThumbnailSpec(bp, opts, seasonPacks[0], japanChannel);
    expect(spec.variants.some(v => /[぀-ヿ一-鿿]/.test(v.headline))).toBe(true);
  });

  it('an explicit packagingLanguage override wins over the market default', () => {
    const koreanChannel = channelPresets.find(c => c.market === 'korea')!;
    const opts = makeOptions({ channel: koreanChannel, songCount: 3, lyricLanguage: 'english', market: 'korea', packagingLanguage: 'english' });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, seasonPacks[0]);
    const spec = buildThumbnailSpec(bp, opts, seasonPacks[0], koreanChannel);
    expect(spec.variants.every(v => !/[가-힣]/.test(v.headline))).toBe(true);
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

describe('[v3.7] thumbnail archetype image prompt wiring', () => {
  it('does not contain the old hardcoded cafe scene sentence', () => {
    const opts = makeOptions({ songCount: 3, seasonId: 'summer-night' });
    const season = seasonPacks.find(s => s.id === 'summer-night')!;
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
    const spec = buildThumbnailSpec(bp, opts, season, channelPresets[0], 0, 'summer-sea-morning');
    expect(spec.imagePrompt).not.toContain('A quiet cafe window');
  });

  it('produces a different scene description for each archetype', () => {
    const opts = makeOptions({ songCount: 3, seasonId: 'summer-night' });
    const season = seasonPacks.find(s => s.id === 'summer-night')!;
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
    const sceneDescriptions = thumbnailArchetypes.map(archetype => {
      const spec = buildThumbnailSpec(bp, opts, season, channelPresets[0], 0, archetype.id);
      return spec.imagePrompt.split('.')[0];
    });
    expect(new Set(sceneDescriptions).size).toBe(thumbnailArchetypes.length);
  });

  // TASK v3.38 Part A — 'summer-green' no longer exists; the coastal
  // seasonal archetype replacing it is 'summer-sea-morning'.
  it('summer-sea-morning archetype does not generate a cafe scene', () => {
    const opts = makeOptions({ songCount: 3, seasonId: 'summer-night' });
    const season = seasonPacks.find(s => s.id === 'summer-night')!;
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, season);
    const spec = buildThumbnailSpec(bp, opts, season, channelPresets[0], 0, 'summer-sea-morning');
    expect(spec.imagePrompt.toLowerCase()).not.toContain('cafe');
    expect(spec.imagePrompt.toLowerCase()).toMatch(/sea|sand|ocean|coastal|water|sky/);
  });
});
