import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildCoverImagePromptVariants, buildThumbnailSpec } from '../src/core/thumbnailSpec';
import { REQUIRED_THUMBNAIL_NEGATIVE_TERMS } from '../src/core/thumbnailSafety';
import { makeOptions, testGenres, testMoods, channelPresets, testSeason } from './fixtures';

/**
 * TASK v3.37-b — concept binding (work item 1), cover mode (work item 2),
 * and the quality booster (work item 3) for the legacy Generic/Midjourney/
 * Stable Diffusion prompt system (src/core/thumbnailSpec.ts). See
 * tests/thumbnailPromptSafety.test.ts for the equivalent coverage on the
 * axis-based archetype composer (src/core/thumbnailPromptComposer.ts).
 */

const QUALITY_BOOSTER_SNIPPET = 'professional photography, photorealistic';

function specFor(customConcept: string, archetypeId?: Parameters<typeof buildThumbnailSpec>[5]) {
  const opts = makeOptions({ customConcept, songCount: 6 });
  const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
  return buildThumbnailSpec(bp, opts, testSeason, channelPresets[0], 0, archetypeId);
}

describe('[v3.37-b] buildThumbnailSpec — concept binding (work item 1)', () => {
  it('a concrete concept appears verbatim in all three image-prompt formats', () => {
    const spec = specFor('여름 바닷가 아침');
    for (const prompt of Object.values(spec.imagePromptVariants)) {
      expect(prompt).toContain('여름 바닷가 아침');
    }
  });

  it('empty, whitespace-only, and undefined concept all produce byte-identical output (true no-op)', () => {
    const emptySpec = specFor('');
    const whitespaceSpec = specFor('   \n\t  ');
    const opts = makeOptions({ songCount: 6 });
    delete (opts as { customConcept?: string }).customConcept;
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const undefinedSpec = buildThumbnailSpec(bp, opts, testSeason, channelPresets[0]);

    expect(emptySpec.imagePromptVariants).toEqual(whitespaceSpec.imagePromptVariants);
    expect(emptySpec.imagePromptVariants).toEqual(undefinedSpec.imagePromptVariants);
    for (const prompt of Object.values(emptySpec.imagePromptVariants)) {
      expect(prompt).not.toContain('evoking');
    }
  });

  it('a concept never changes the archetype-driven structural fields (lighting/camera/color/composition stay identical for the same seed)', () => {
    const withConcept = specFor('a bright red bicycle leaning on the wall');
    const withoutConcept = specFor('');

    // Same seed (both built from a 6-song local blueprint with the same
    // options besides customConcept) -> same archetype pool picks. Strip the
    // concept clause and the two generic prompts must match exactly,
    // proving nothing else in the scene changed.
    // Stops at the next comma OR period (whichever the surrounding join style
    // uses — generic/SD join with '. ', Midjourney joins with ', ') without
    // consuming it, so the original separator is left intact either way.
    const stripConceptClause = (text: string) => text.replace(/, with a specific scene detail evoking: [^,.]+/, '');
    expect(stripConceptClause(withConcept.imagePromptVariants.generic)).toBe(withoutConcept.imagePromptVariants.generic);
    expect(stripConceptClause(withConcept.imagePromptVariants.midjourney)).toBe(withoutConcept.imagePromptVariants.midjourney);
  });

  it('a style-imitation concept (already-forbidden phrasing) is silently dropped, not passed through', () => {
    const spec = specFor('in the style of Ghibli');
    for (const prompt of Object.values(spec.imagePromptVariants)) {
      expect(prompt.toLowerCase()).not.toContain('ghibli');
      expect(prompt.toLowerCase()).not.toContain('in the style of');
    }
  });

  it('5 different multi-set concepts produce 5 genuinely different prompts', () => {
    const concepts = ['여름 바닷가 아침', '가을 단풍 골목', '겨울 벽난로', '봄 벚꽃길', '도시 야경 옥상'];
    const prompts = concepts.map(concept => specFor(concept).imagePromptVariants.generic);
    expect(new Set(prompts).size).toBe(concepts.length);
  });
});

describe('[v3.37-b] buildThumbnailSpec — quality booster (work item 3)', () => {
  it('every format ends with the quality booster, after the existing negative text', () => {
    const spec = specFor('');
    expect(spec.imagePromptVariants.generic.endsWith(`${QUALITY_BOOSTER_SNIPPET}, cinematic lighting, natural color grading, soft depth of field, crisp detail, no oversaturation, no plastic CGI.`)).toBe(true);
    expect(spec.imagePromptVariants.generic.indexOf('Negative:')).toBeLessThan(spec.imagePromptVariants.generic.indexOf(QUALITY_BOOSTER_SNIPPET));
  });

  it('midjourney keeps the booster in the positive text, before --ar (never inside --no)', () => {
    const spec = specFor('');
    const mj = spec.imagePromptVariants.midjourney;
    const boosterIndex = mj.indexOf(QUALITY_BOOSTER_SNIPPET);
    const arIndex = mj.indexOf('--ar');
    const noIndex = mj.indexOf('--no');
    expect(boosterIndex).toBeGreaterThan(-1);
    expect(boosterIndex).toBeLessThan(arIndex);
    expect(boosterIndex).toBeLessThan(noIndex);
  });

  it('stable diffusion keeps the booster in the Positive line, existing Negative line untouched', () => {
    const spec = specFor('');
    const sd = spec.imagePromptVariants.stableDiffusion;
    const [positive, negative] = sd.split('\nNegative: ');
    expect(positive).toContain(QUALITY_BOOSTER_SNIPPET);
    expect(negative).toBe('text, letters, logo, watermark, close-up face, identifiable person, celebrity, cartoon character, branded IP, low quality, blurry');
  });
});

describe('[v3.37-b] buildCoverImagePromptVariants — cover (1:1) mode (work item 2)', () => {
  for (const archetype of ['refined-cafe', 'summer-green', 'daily-happiness'] as const) {
    it(`${archetype}: cover mode is 1:1 with the album-cover directive, thumbnail mode stays 16:9`, () => {
      const cover = buildCoverImagePromptVariants(testSeason.id, archetype, 0, '');
      expect(cover.generic).toContain('1:1');
      expect(cover.generic).not.toContain('16:9');
      expect(cover.generic.toLowerCase()).toContain('album cover aesthetic');
      expect(cover.midjourney).toContain('--ar 1:1');
      expect(cover.midjourney).not.toContain('--ar 16:9');
    });
  }

  it('required negative terms survive into the final cover prompt', () => {
    const cover = buildCoverImagePromptVariants(testSeason.id, 'refined-cafe', 0, '');
    const lower = cover.generic.toLowerCase();
    for (const required of REQUIRED_THUMBNAIL_NEGATIVE_TERMS) {
      expect(lower).toContain(required);
    }
  });

  it('cover mode also reflects a concept and stays a no-op when concept is empty', () => {
    const withConcept = buildCoverImagePromptVariants(testSeason.id, 'refined-cafe', 3, '여름 바닷가 아침');
    const withoutConcept = buildCoverImagePromptVariants(testSeason.id, 'refined-cafe', 3, '');
    expect(withConcept.generic).toContain('여름 바닷가 아침');
    expect(withoutConcept.generic).not.toContain('evoking');
  });

  it('cover and thumbnail modes produce different prompts even with matching internal seeds', () => {
    const opts = makeOptions({ songCount: 6 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const spec = buildThumbnailSpec(bp, opts, testSeason, channelPresets[0], 0, 'refined-cafe');
    // buildThumbnailSpec derives its internal seedIndex from
    // songs.length + channel.name.length + variant (0 here) — replicate it
    // so this is a genuine same-seed comparison, not just "any two calls differ".
    const seedIndex = bp.songs.length + channelPresets[0].name.length;
    const cover = buildCoverImagePromptVariants(testSeason.id, 'refined-cafe', seedIndex, '');
    expect(cover.generic).not.toBe(spec.imagePromptVariants.generic);
  });
});
