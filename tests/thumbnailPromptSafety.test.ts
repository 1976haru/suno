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
