import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { thumbnailArchetypes, thumbnailArchetypeCount } from '../src/data/thumbnailArchetypes';
import type { ThumbnailArchetype } from '../src/data/thumbnailArchetypes';

// TASK v3.38 Part A/B — 6 seasonal Korean-serif archetypes + 3 kids-bright archetypes.
const EXPECTED_CATEGORIES = [
  'autumn-window-golden',
  'winter-window-snow',
  'spring-blossom-window',
  'summer-sea-morning',
  'rain-window-quiet',
  'night-city-warm',
  'kids-animal-meadow',
  'kids-playground-sky',
  'kids-cozy-room'
];
const SEASONAL_CATEGORIES = new Set(EXPECTED_CATEGORIES.slice(0, 6));
const KIDS_CATEGORIES = new Set(EXPECTED_CATEGORIES.slice(6));

const directReferenceTerms = /\b(in the style of|same composition as|movie scene from|film still from|screenshot from|as seen in|disney|pixar|marvel|netflix|ghibli|miyazaki|nolan|spielberg|tarantino|kubrick|wes anderson|tom hanks|leonardo dicaprio)\b|시소웨이브|GOMCAM/i;

// TASK v3.38 Part B5 — forbiddenElements is deliberately excluded here: the
// 3 kids archetypes' forbiddenElements legitimately name real brand/IP terms
// (Disney, Pinkfong, Cocomelon) precisely in order to BAN them — being
// listed in a negative/forbidden clause is the safe direction, not the
// unsafe one this scan is meant to catch. See the dedicated kids-negative
// test below for a check that these terms are actually present and banned.
function allText(archetype: ThumbnailArchetype): string {
  return [
    archetype.id,
    archetype.category,
    archetype.labelKo,
    ...archetype.subjectPool,
    ...archetype.settingPool,
    ...archetype.compositionPool,
    ...archetype.lightingPool,
    ...archetype.palettePool,
    ...archetype.propPool,
    ...archetype.cameraPool,
    archetype.peoplePolicy,
    archetype.promptTemplate
  ].join('\n');
}

describe('thumbnail archetype library', () => {
  it('defines the 6 seasonal Korean-serif + 3 kids-bright categories', () => {
    expect(thumbnailArchetypeCount).toBe(9);
    expect(thumbnailArchetypes.map(archetype => archetype.category)).toEqual(EXPECTED_CATEGORIES);
  });

  it('fills every required field with reusable prompt material', () => {
    for (const archetype of thumbnailArchetypes) {
      expect(archetype.id, archetype.id).toBe(archetype.category);
      expect(archetype.labelKo, archetype.id).toBeTruthy();
      expect(archetype.subjectPool.length, archetype.id).toBeGreaterThanOrEqual(5);
      expect(archetype.settingPool.length, archetype.id).toBeGreaterThanOrEqual(5);
      expect(archetype.compositionPool.length, archetype.id).toBeGreaterThanOrEqual(4);
      expect(archetype.lightingPool.length, archetype.id).toBeGreaterThanOrEqual(4);
      expect(archetype.palettePool.length, archetype.id).toBeGreaterThanOrEqual(4);
      expect(archetype.propPool.length, archetype.id).toBeGreaterThanOrEqual(5);
      expect(archetype.cameraPool.length, archetype.id).toBeGreaterThanOrEqual(4);
      expect(archetype.textSafeZone, archetype.id).toEqual(['left-third']);
      expect(archetype.peoplePolicy.length, archetype.id).toBeGreaterThan(20);
      expect(archetype.forbiddenElements.length, archetype.id).toBeGreaterThanOrEqual(5);
      expect(archetype.promptTemplate.length, archetype.id).toBeGreaterThan(20);
      // TASK v3.38 Part A — seasonal archetypes use the Korean-serif grammar
      // (thin serif, no outline, divider+subtitle); Part B5's 3 kids
      // archetypes use a deliberately different bold/bright grammar.
      if (SEASONAL_CATEGORIES.has(archetype.category)) {
        expect(archetype.recommendedTypography.outline, archetype.id).toBe('none');
        expect(archetype.recommendedTypography.font.toLowerCase(), archetype.id).toContain('serif');
        expect(archetype.recommendedTypography.divider, archetype.id).toBe(true);
        expect(archetype.recommendedTypography.subtitle, archetype.id).toBe(true);
      } else {
        expect(KIDS_CATEGORIES.has(archetype.category), archetype.id).toBe(true);
        expect(archetype.recommendedTypography.divider, archetype.id).toBe(false);
        expect(archetype.recommendedTypography.subtitle, archetype.id).toBe(false);
      }
    }
  });

  it('contains only abstract traits, not creator, channel, movie, actor, or character references', () => {
    for (const archetype of thumbnailArchetypes) {
      expect(allText(archetype), archetype.id).not.toMatch(directReferenceTerms);
    }
  });

  // TASK v3.38 Part B5 — the 3 kids archetypes must explicitly ban character/
  // mascot/brand-IP terms in their forbiddenElements (this is where those
  // brand names are *supposed* to appear — see allText()'s exclusion above).
  it('kids archetypes ban cartoon/mascot/branded-character terms and never show a child\'s face', () => {
    for (const archetype of thumbnailArchetypes) {
      if (!KIDS_CATEGORIES.has(archetype.category)) continue;
      const forbiddenText = archetype.forbiddenElements.join(' ').toLowerCase();
      for (const term of ['cartoon', 'mascot', 'anime', 'pinkfong', 'cocomelon', 'disney', 'branded character', 'copyrighted character', 'child faces']) {
        expect(forbiddenText, `${archetype.id}: missing "${term}"`).toContain(term);
      }
      expect(archetype.peoplePolicy.toLowerCase(), archetype.id).toContain('face must never be shown');
    }
  });

  it('keeps private import folders ignored and untracked', () => {
    const gitignore = readFileSync('.gitignore', 'utf8');
    expect(gitignore).toContain('private_import/');
    expect(gitignore).toContain('pirvate_import/');

    const tracked = execFileSync('git', ['ls-files', 'private_import', 'pirvate_import'], { encoding: 'utf8' }).trim();
    expect(tracked).toBe('');
  });
});
