import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { thumbnailArchetypes, thumbnailArchetypeCount } from '../src/data/thumbnailArchetypes';
import type { ThumbnailArchetype } from '../src/data/thumbnailArchetypes';

const EXPECTED_CATEGORIES = [
  'refined-cafe',
  'summer-green',
  'midcentury-lofi-room',
  'daily-happiness',
  'cinematic-human-moment'
];

const directReferenceTerms = /\b(in the style of|same composition as|movie scene from|film still from|screenshot from|as seen in|disney|pixar|marvel|netflix|ghibli|miyazaki|nolan|spielberg|tarantino|kubrick|wes anderson|tom hanks|leonardo dicaprio)\b|시소웨이브|GOMCAM/i;

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
    ...archetype.forbiddenElements,
    archetype.promptTemplate
  ].join('\n');
}

describe('thumbnail archetype library', () => {
  it('defines the five requested abstract categories', () => {
    expect(thumbnailArchetypeCount).toBe(5);
    expect(thumbnailArchetypes.map(archetype => archetype.category)).toEqual(EXPECTED_CATEGORIES);
  });

  it('fills every required field with reusable prompt material', () => {
    for (const archetype of thumbnailArchetypes) {
      expect(archetype.id, archetype.id).toBe(archetype.category);
      expect(archetype.labelKo, archetype.id).toBeTruthy();
      expect(archetype.subjectPool.length, archetype.id).toBeGreaterThanOrEqual(5);
      expect(archetype.settingPool.length, archetype.id).toBeGreaterThanOrEqual(5);
      expect(archetype.compositionPool.length, archetype.id).toBeGreaterThanOrEqual(5);
      expect(archetype.lightingPool.length, archetype.id).toBeGreaterThanOrEqual(5);
      expect(archetype.palettePool.length, archetype.id).toBeGreaterThanOrEqual(5);
      expect(archetype.propPool.length, archetype.id).toBeGreaterThanOrEqual(5);
      expect(archetype.cameraPool.length, archetype.id).toBeGreaterThanOrEqual(5);
      expect(archetype.textSafeZone, archetype.id).toEqual(['left', 'right', 'top']);
      expect(archetype.peoplePolicy.length, archetype.id).toBeGreaterThan(20);
      expect(archetype.forbiddenElements.length, archetype.id).toBeGreaterThanOrEqual(5);
      expect(archetype.promptTemplate.length, archetype.id).toBeGreaterThan(20);
    }
  });

  it('contains only abstract traits, not creator, channel, movie, actor, or character references', () => {
    for (const archetype of thumbnailArchetypes) {
      expect(allText(archetype), archetype.id).not.toMatch(directReferenceTerms);
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
