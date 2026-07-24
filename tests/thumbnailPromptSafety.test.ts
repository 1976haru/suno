import { describe, expect, it } from 'vitest';
import {
  composeThumbnailPromptSet,
  countThumbnailAxisDifferences
} from '../src/core/thumbnailPromptComposer';
import { REQUIRED_THUMBNAIL_NEGATIVE_TERMS, thumbnailPromptSafetyIssues } from '../src/core/thumbnailSafety';
import { thumbnailArchetypes } from '../src/data/thumbnailArchetypes';

const directNames = /\b(disney|pixar|marvel|netflix|ghibli|miyazaki|nolan|spielberg|tarantino|kubrick|wes anderson|tom hanks|leonardo dicaprio|scarlett johansson|meryl streep|youtube channel)\b|시소웨이브|GOMCAM/i;

describe('thumbnail prompt composer safety', () => {
  it('adds required negative guardrails to every generated prompt', () => {
    for (const archetype of thumbnailArchetypes) {
      const set = composeThumbnailPromptSet({
        archetypeId: archetype.id,
        seasonId: 'summer-night',
        timeOfDay: 'golden-hour',
        peopleMode: 'distant-silhouette',
        textSafeZone: 'left'
      });

      for (const variant of set.variants) {
        const lower = variant.prompt.toLowerCase();
        for (const required of REQUIRED_THUMBNAIL_NEGATIVE_TERMS) {
          expect(lower, `${archetype.id} ${variant.id}`).toContain(required);
        }
        expect(variant.prompt, `${archetype.id} ${variant.id}`).toContain('16:9');
        expect(variant.prompt, `${archetype.id} ${variant.id}`).toMatch(/1280x720|1920x1080/);
        expect(variant.prompt, `${archetype.id} ${variant.id}`).not.toMatch(directNames);
        expect(thumbnailPromptSafetyIssues(variant.prompt), `${archetype.id} ${variant.id}`).toEqual([]);
      }
    }
  });

  it('makes A/B/C differ by at least five visual axes', () => {
    for (const archetype of thumbnailArchetypes) {
      const set = composeThumbnailPromptSet({
        archetypeId: archetype.id,
        seasonId: 'early-autumn',
        timeOfDay: 'morning',
        peopleMode: 'none',
        textSafeZone: 'right',
        seed: 4
      });

      expect(set.variants.map(variant => variant.id)).toEqual(['A', 'B', 'C']);
      for (let i = 0; i < set.variants.length; i++) {
        for (let j = i + 1; j < set.variants.length; j++) {
          expect(
            countThumbnailAxisDifferences(set.variants[i], set.variants[j]),
            `${archetype.id} ${set.variants[i].id}/${set.variants[j].id}`
          ).toBeGreaterThanOrEqual(5);
        }
      }
    }
  });

  // TASK v3.37 (spec item D) — cover mode (1:1 channel/album cover) reuses
  // the exact same forbidden/negative clause as thumbnail mode, just swaps
  // the frame clause and appends the album-cover style directive.
  it('cover mode swaps the frame clause and adds the album-cover directive, keeping every safety guarantee', () => {
    for (const archetype of thumbnailArchetypes) {
      const set = composeThumbnailPromptSet({
        archetypeId: archetype.id,
        seasonId: 'may-cafe',
        timeOfDay: 'morning',
        peopleMode: 'none',
        textSafeZone: 'top',
        mode: 'cover'
      });

      for (const variant of set.variants) {
        const lower = variant.prompt.toLowerCase();
        for (const required of REQUIRED_THUMBNAIL_NEGATIVE_TERMS) {
          expect(lower, `${archetype.id} ${variant.id}`).toContain(required);
        }
        expect(variant.prompt, `${archetype.id} ${variant.id}`).toContain('1:1');
        expect(variant.prompt, `${archetype.id} ${variant.id}`).toContain('3000x3000');
        expect(variant.prompt, `${archetype.id} ${variant.id}`).not.toContain('16:9');
        expect(lower, `${archetype.id} ${variant.id}`).toContain('album cover aesthetic');
        expect(variant.prompt, `${archetype.id} ${variant.id}`).not.toMatch(directNames);
        expect(thumbnailPromptSafetyIssues(variant.prompt), `${archetype.id} ${variant.id}`).toEqual([]);
      }
    }
  });

  it('thumbnail mode (default, unchanged) never adds the album-cover directive', () => {
    const set = composeThumbnailPromptSet({ archetypeId: 'refined-cafe', seasonId: 'may-cafe' });
    for (const variant of set.variants) {
      expect(variant.prompt.toLowerCase()).not.toContain('album cover aesthetic');
    }
  });

  // TASK v3.37-b (work item 1) — concept binding for the axis-based composer.
  describe('concept binding', () => {
    it('a concept appears verbatim, and never disturbs the required negative terms', () => {
      const set = composeThumbnailPromptSet({ archetypeId: 'refined-cafe', seasonId: 'may-cafe', concept: '여름 바닷가 아침' });
      for (const variant of set.variants) {
        expect(variant.prompt).toContain('Concept detail: 여름 바닷가 아침.');
        expect(thumbnailPromptSafetyIssues(variant.prompt)).toEqual([]);
      }
    });

    it('empty, whitespace-only, and omitted concept all produce byte-identical output', () => {
      const base = { archetypeId: 'refined-cafe' as const, seasonId: 'may-cafe', seed: 7 };
      const empty = composeThumbnailPromptSet({ ...base, concept: '' });
      const whitespace = composeThumbnailPromptSet({ ...base, concept: '   \n\t ' });
      const omitted = composeThumbnailPromptSet(base);
      expect(empty.variants.map(v => v.prompt)).toEqual(whitespace.variants.map(v => v.prompt));
      expect(empty.variants.map(v => v.prompt)).toEqual(omitted.variants.map(v => v.prompt));
      for (const variant of empty.variants) expect(variant.prompt).not.toContain('Concept detail');
    });

    it('a concept never changes which archetype pool items get picked for the same seed', () => {
      const base = { archetypeId: 'summer-green' as const, seasonId: 'summer-night', timeOfDay: 'evening' as const, seed: 3 };
      const withConcept = composeThumbnailPromptSet({ ...base, concept: 'a red bicycle by the wall' });
      const withoutConcept = composeThumbnailPromptSet(base);
      for (let i = 0; i < 3; i++) {
        expect(withConcept.variants[i].subject).toBe(withoutConcept.variants[i].subject);
        expect(withConcept.variants[i].setting).toBe(withoutConcept.variants[i].setting);
        expect(withConcept.variants[i].composition).toBe(withoutConcept.variants[i].composition);
        expect(withConcept.variants[i].lighting).toBe(withoutConcept.variants[i].lighting);
        expect(withConcept.variants[i].palette).toBe(withoutConcept.variants[i].palette);
        expect(withConcept.variants[i].camera).toBe(withoutConcept.variants[i].camera);
      }
    });

    it('a style-imitation concept is silently dropped rather than passed through', () => {
      const set = composeThumbnailPromptSet({ archetypeId: 'refined-cafe', seasonId: 'may-cafe', concept: 'in the style of Ghibli' });
      for (const variant of set.variants) {
        expect(variant.prompt.toLowerCase()).not.toContain('ghibli');
        expect(thumbnailPromptSafetyIssues(variant.prompt)).toEqual([]);
      }
    });

    it('5 different multi-set concepts produce 5 genuinely different prompt sets', () => {
      const concepts = ['여름 바닷가 아침', '가을 단풍 골목', '겨울 벽난로', '봄 벚꽃길', '도시 야경 옥상'];
      const prompts = concepts.map(concept => composeThumbnailPromptSet({ archetypeId: 'refined-cafe', seasonId: 'may-cafe', concept }).variants[0].prompt);
      expect(new Set(prompts).size).toBe(concepts.length);
    });
  });

  it('keeps cinematic human figures small, anonymous, and not face-led', () => {
    const set = composeThumbnailPromptSet({
      archetypeId: 'cinematic-human-moment',
      peopleMode: 'distant-silhouette',
      textSafeZone: 'top',
      seasonId: 'autumn-rain',
      timeOfDay: 'evening'
    });

    for (const variant of set.variants) {
      const lower = variant.prompt.toLowerCase();
      expect(lower).toContain('under 20% of the frame');
      expect(lower).toContain('face hidden');
      expect(lower).toContain('no face close-up');
      expect(lower).toContain('no copied pose');
      expect(lower).toContain('no film character');
    }
  });
});
