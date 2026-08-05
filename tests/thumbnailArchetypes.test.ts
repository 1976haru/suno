import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { jp2030ThumbnailArchetypes, jpkidsThumbnailArchetypes, kidsThumbnailArchetypes, kr2030ThumbnailArchetypes, kridolThumbnailArchetypes, krkidsThumbnailArchetypes, placeThumbnailArchetypes, seasonalThumbnailArchetypes, thumbnailArchetypes, thumbnailArchetypeCount } from '../src/data/thumbnailArchetypes';
import type { ThumbnailArchetype } from '../src/data/thumbnailArchetypes';

// TASK v3.38 Part A/B — 6 seasonal Korean-serif archetypes + 3 kids-bright archetypes.
const EXPECTED_CATEGORIES = [
  'autumn-window-golden',
  'winter-window-snow',
  'spring-blossom-window',
  'summer-sea-morning',
  'rain-window-quiet',
  'night-city-warm',
  'city-roma',
  'city-paris',
  'city-barcelona',
  'city-prague',
  'city-kyoto',
  'village-provence',
  'showa-70s-kissaten-film',
  'j2000s-digital-station',
  'modern-chill-neon-room',
  'city-night-drive-neon',
  'kids-animal-meadow',
  'kids-playground-sky',
  'kids-cozy-room',
  // TASK B2 — kr-2030 workspace's 3 new archetypes, appended (matches
  // thumbnailArchetypes/index.ts's own array order: seasonal, place, kids,
  // then kr2030). These use the same Korean-serif grammar as the place
  // archetypes (see KR2030_CATEGORIES below), not the kids-bright grammar.
  'kr2030-cafe-night',
  'kr2030-seoul-street',
  'kr2030-person-silhouette',
  // TASK C2 — jp-2030 workspace's 3 new archetypes, appended last (matches
  // thumbnailArchetypes/index.ts's own array order: ...kr2030, then jp2030).
  // Same Korean-serif grammar as place/kr2030 (see JP2030_CATEGORIES below).
  'jp2030-seasonal',
  'jp2030-station-platform',
  'jp2030-city-night',
  // TASK E1 — kr-kids workspace's 4 new archetypes, appended last (matches
  // thumbnailArchetypes/index.ts's own array order: ...jp2030, then krkids).
  // Same kids-bright grammar as the existing 3 kids-* archetypes (see
  // KIDS_CATEGORIES below, extended to include these).
  'krkids-daily-habit-bathroom',
  'krkids-counting-blocks',
  'krkids-roleplay-market',
  'krkids-bilingual-alphabet',
  // TASK F1 — jp-kids workspace's 4 new archetypes, appended last (matches
  // thumbnailArchetypes/index.ts's own array order: ...krkids, then jpkids).
  // Same kids-bright grammar as the existing kids-*/krkids-* archetypes
  // (see KIDS_CATEGORIES below, extended to include these).
  'jpkids-teasobi-hands',
  'jpkids-food-character',
  'jpkids-vehicle-parade',
  'jpkids-seasonal-matsuri',
  // TASK K2 — kr-idol-male workspace's 3 new archetypes, appended last
  // (matches thumbnailArchetypes/index.ts's own array order: ...jpkids,
  // then kridol). Same Korean-serif grammar as place/kr2030/jp2030 (see
  // KRIDOL_CATEGORIES below).
  'kridol-stage-performance',
  'kridol-night-city-move',
  'kridol-mono-portrait'
];
const SEASONAL_CATEGORIES = new Set(EXPECTED_CATEGORIES.slice(0, 6));
const PLACE_CATEGORIES = new Set(EXPECTED_CATEGORIES.slice(6, 16));
const KIDS_CATEGORIES = new Set([...EXPECTED_CATEGORIES.slice(16, 19), ...EXPECTED_CATEGORIES.slice(25, 29), ...EXPECTED_CATEGORIES.slice(29, 33)]);
const KR2030_CATEGORIES = new Set(EXPECTED_CATEGORIES.slice(19, 22));
const JP2030_CATEGORIES = new Set(EXPECTED_CATEGORIES.slice(22, 25));
const KRIDOL_CATEGORIES = new Set(EXPECTED_CATEGORIES.slice(33, 36));

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
    // TASK B2 — 19 + 3 kr2030-*. TASK C2 — + 3 jp2030-* (jp2030ThumbnailArchetypes, own serif grammar).
    // TASK E1 — + 4 krkids-* (krkidsThumbnailArchetypes, kids-bright grammar).
    // TASK F1 — + 4 jpkids-* (jpkidsThumbnailArchetypes, kids-bright grammar).
    // TASK K2 — + 3 kridol-* (kridolThumbnailArchetypes, Korean-serif grammar).
    expect(thumbnailArchetypeCount).toBe(36);
    expect(thumbnailArchetypes.map(archetype => archetype.category)).toEqual(EXPECTED_CATEGORIES);
    expect(seasonalThumbnailArchetypes).toHaveLength(6);
    expect(placeThumbnailArchetypes).toHaveLength(10);
    expect(kidsThumbnailArchetypes).toHaveLength(3);
    expect(kr2030ThumbnailArchetypes).toHaveLength(3);
    expect(jp2030ThumbnailArchetypes).toHaveLength(3);
    expect(krkidsThumbnailArchetypes).toHaveLength(4);
    expect(jpkidsThumbnailArchetypes).toHaveLength(4);
    expect(kridolThumbnailArchetypes).toHaveLength(3);
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
      if (SEASONAL_CATEGORIES.has(archetype.category) || PLACE_CATEGORIES.has(archetype.category) || KR2030_CATEGORIES.has(archetype.category) || JP2030_CATEGORIES.has(archetype.category) || KRIDOL_CATEGORIES.has(archetype.category)) {
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
  it('place-series archetypes carry compact city/village fields for small thumbnails', () => {
    for (const archetype of placeThumbnailArchetypes) {
      expect(archetype.sceneCore?.length, archetype.id).toBeGreaterThanOrEqual(4);
      expect(archetype.sceneCore?.length, archetype.id).toBeLessThanOrEqual(6);
      expect(archetype.signatureObjects?.length, archetype.id).toBeGreaterThan(0);
      expect(archetype.signatureObjects?.length, archetype.id).toBeLessThanOrEqual(3);
      expect(archetype.lighting, archetype.id).toBeTruthy();
      expect(archetype.palette, archetype.id).toBeTruthy();
      expect(archetype.cameraFeel, archetype.id).toBeTruthy();
      expect(archetype.textSafeZone, archetype.id).toEqual(['left-third']);
      expect(archetype.negatives?.join(' ').toLowerCase(), archetype.id).toContain('shared');
      expect(archetype.placeSeries?.bottomBrandLine, archetype.id).toMatch(/^[A-Z ]+PLAYLIST$/);
      expect(archetype.placeSeries?.bindSeriesTone, archetype.id).toBe(true);
    }
  });

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
