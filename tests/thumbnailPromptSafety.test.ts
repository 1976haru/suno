import { describe, expect, it } from 'vitest';
import {
  composeThumbnailPromptSet,
  countThumbnailAxisDifferences
} from '../src/core/thumbnailPromptComposer';
import { REQUIRED_THUMBNAIL_NEGATIVE_TERMS, thumbnailPromptSafetyIssues } from '../src/core/thumbnailSafety';
import { thumbnailArchetypes } from '../src/data/thumbnailArchetypes';

const directNames = /\b(disney|pixar|marvel|netflix|ghibli|miyazaki|nolan|spielberg|tarantino|kubrick|wes anderson|tom hanks|leonardo dicaprio|scarlett johansson|meryl streep|youtube channel|pinkfong|cocomelon)\b|시소웨이브|GOMCAM/i;

/**
 * TASK v3.38 Part B5 — the 3 kids archetypes legitimately ban Disney/
 * Pinkfong/Cocomelon by name inside their Negative clause; directNames must
 * only ever catch a POSITIVE reference (e.g. "in the style of Disney"), so
 * the Negative clause itself is stripped before this check runs. See the
 * equivalent exclusion in tests/thumbnailArchetypes.test.ts.
 */
function promptWithoutNegativeClause(prompt: string): string {
  return prompt.replace(/Negative:.*$/s, '');
}

describe('thumbnail prompt composer safety', () => {
  it('adds required negative guardrails to every generated prompt', () => {
    for (const archetype of thumbnailArchetypes) {
      const set = composeThumbnailPromptSet({
        archetypeId: archetype.id,
        seasonId: 'summer-night',
        timeOfDay: 'golden-hour',
        peopleMode: 'distant-silhouette'
      });

      for (const variant of set.variants) {
        const lower = variant.prompt.toLowerCase();
        for (const required of REQUIRED_THUMBNAIL_NEGATIVE_TERMS) {
          expect(lower, `${archetype.id} ${variant.id}`).toContain(required);
        }
        expect(variant.prompt, `${archetype.id} ${variant.id}`).toContain('16:9');
        expect(variant.prompt, `${archetype.id} ${variant.id}`).toMatch(/1280x720|1920x1080/);
        expect(promptWithoutNegativeClause(variant.prompt), `${archetype.id} ${variant.id}`).not.toMatch(directNames);
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
        expect(promptWithoutNegativeClause(variant.prompt), `${archetype.id} ${variant.id}`).not.toMatch(directNames);
        expect(thumbnailPromptSafetyIssues(variant.prompt), `${archetype.id} ${variant.id}`).toEqual([]);
      }
    }
  });

  it('thumbnail mode (default, unchanged) never adds the album-cover directive', () => {
    const set = composeThumbnailPromptSet({ archetypeId: 'autumn-window-golden', seasonId: 'may-cafe' });
    for (const variant of set.variants) {
      expect(variant.prompt.toLowerCase()).not.toContain('album cover aesthetic');
    }
  });

  // TASK v3.38 Part A1 — every seasonal archetype's textSafeZone pool now
  // contains only 'left-third'; every generated variant must resolve to it.
  it('every seasonal-archetype variant resolves to the fixed left-third text zone', () => {
    for (const archetype of thumbnailArchetypes.slice(0, 6)) {
      const set = composeThumbnailPromptSet({ archetypeId: archetype.id, seasonId: 'may-cafe', seed: 9 });
      for (const variant of set.variants) {
        expect(variant.textSafeZone, `${archetype.id} ${variant.id}`).toBe('left-third');
        expect(variant.prompt.toLowerCase(), `${archetype.id} ${variant.id}`).toContain('left third of the frame reserved for a thin korean serif headline');
      }
    }
  });

  // TASK v3.37-b (work item 1) — concept binding for the axis-based composer.
  describe('concept binding', () => {
    it('a concept appears verbatim, and never disturbs the required negative terms', () => {
      const set = composeThumbnailPromptSet({ archetypeId: 'autumn-window-golden', seasonId: 'may-cafe', concept: '여름 바닷가 아침' });
      for (const variant of set.variants) {
        expect(variant.prompt).toContain('Concept detail: 여름 바닷가 아침.');
        expect(thumbnailPromptSafetyIssues(variant.prompt)).toEqual([]);
      }
    });

    it('empty, whitespace-only, and omitted concept all produce byte-identical output', () => {
      const base = { archetypeId: 'autumn-window-golden' as const, seasonId: 'may-cafe', seed: 7 };
      const empty = composeThumbnailPromptSet({ ...base, concept: '' });
      const whitespace = composeThumbnailPromptSet({ ...base, concept: '   \n\t ' });
      const omitted = composeThumbnailPromptSet(base);
      expect(empty.variants.map(v => v.prompt)).toEqual(whitespace.variants.map(v => v.prompt));
      expect(empty.variants.map(v => v.prompt)).toEqual(omitted.variants.map(v => v.prompt));
      for (const variant of empty.variants) expect(variant.prompt).not.toContain('Concept detail');
    });

    it('a concept never changes which archetype pool items get picked for the same seed', () => {
      const base = { archetypeId: 'rain-window-quiet' as const, seasonId: 'summer-night', timeOfDay: 'evening' as const, seed: 3 };
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
      const set = composeThumbnailPromptSet({ archetypeId: 'autumn-window-golden', seasonId: 'may-cafe', concept: 'in the style of Ghibli' });
      for (const variant of set.variants) {
        expect(variant.prompt.toLowerCase()).not.toContain('ghibli');
        expect(thumbnailPromptSafetyIssues(variant.prompt)).toEqual([]);
      }
    });

    it('5 different multi-set concepts produce 5 genuinely different prompt sets', () => {
      const concepts = ['여름 바닷가 아침', '가을 단풍 골목', '겨울 벽난로', '봄 벚꽃길', '도시 야경 옥상'];
      const prompts = concepts.map(concept => composeThumbnailPromptSet({ archetypeId: 'autumn-window-golden', seasonId: 'may-cafe', concept }).variants[0].prompt);
      expect(new Set(prompts).size).toBe(concepts.length);
    });

    // TASK v3.38 Part A6 — "비 오는 오후" should bias naturally toward the
    // rain-window-quiet archetype's own scene when that archetype is
    // selected; this confirms the concept clause reflects it verbatim while
    // rain-window-quiet's own pool-driven setting/lighting stay archetype-true.
    it('"비 오는 오후" concept binds cleanly onto the rain-window-quiet archetype', () => {
      const set = composeThumbnailPromptSet({ archetypeId: 'rain-window-quiet', seasonId: 'rainy-season', concept: '비 오는 오후' });
      for (const variant of set.variants) {
        expect(variant.prompt).toContain('Concept detail: 비 오는 오후.');
        expect(variant.prompt.toLowerCase()).toMatch(/rain|grey|green/);
        expect(thumbnailPromptSafetyIssues(variant.prompt)).toEqual([]);
      }
    });
  });

  // TASK v3.38 Part A5 — every seasonal archetype applies the same
  // backs/silhouette-only people rule now (no more per-archetype special case).
  it('keeps people small, anonymous, and seen from behind or in silhouette only, across every seasonal archetype', () => {
    for (const archetype of thumbnailArchetypes.slice(0, 6)) {
      const set = composeThumbnailPromptSet({
        archetypeId: archetype.id,
        peopleMode: 'distant-silhouette',
        seasonId: 'autumn-rain',
        timeOfDay: 'evening'
      });

      for (const variant of set.variants) {
        const lower = variant.prompt.toLowerCase();
        expect(lower, archetype.id).toContain('seen from behind or in silhouette only');
        expect(lower, archetype.id).toContain('face never shown');
        expect(lower, archetype.id).toContain('no face close-up');
        expect(lower, archetype.id).toContain('no copied pose');
        expect(lower, archetype.id).toContain('no film character');
      }
    }
  });

  // TASK v3.38 Part B5 — the 3 kids archetypes use a different visual
  // grammar (bright/saturated, no film grain, centered/open composition
  // instead of the fixed left-third) and explicitly ban character/mascot IP.
  describe('kids archetypes (Part B5)', () => {
    const kidsArchetypes = thumbnailArchetypes.slice(6);

    it('produce bright, non-photographic-grain prompts with character/mascot bans, no undefined text-zone leakage', () => {
      for (const archetype of kidsArchetypes) {
        const set = composeThumbnailPromptSet({ archetypeId: archetype.id, seasonId: 'may-cafe', seed: 2 });
        for (const variant of set.variants) {
          const lower = variant.prompt.toLowerCase();
          expect(lower, `${archetype.id} ${variant.id}`).not.toContain('undefined');
          expect(lower, `${archetype.id} ${variant.id}`).toContain('no cartoon characters');
          expect(lower, `${archetype.id} ${variant.id}`).toContain('no mascot characters');
          expect(thumbnailPromptSafetyIssues(variant.prompt), `${archetype.id} ${variant.id}`).toEqual([]);
        }
      }
    });
  });
});
