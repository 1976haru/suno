import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

// TASK v3.38 Part A — the user-approved reference archetype: autumn window
// scene, golden-hour light, left-third text zone, thin Korean serif
// headline. Verified legible at 360px (mobile) and 168px (desktop sidebar).
export const autumnWindowGoldenArchetype: ThumbnailArchetype = {
  id: 'autumn-window-golden',
  category: 'autumn-window-golden',
  labelKo: '가을 창가 골든아워',
  // TASK v3.38 Part A4 — each entry names at most 2 objects; combined with
  // one settingPool object, a generated scene never exceeds 3-5 named
  // elements (measured against real 168px reduction legibility).
  subjectPool: [
    'a gramophone and a warm coffee cup',
    'a stack of old letters beside a small lamp',
    'a woolen scarf draped over a chair',
    'a vintage record player with a spinning disc',
    'a ceramic teapot and a single cup'
  ],
  settingPool: [
    'a wooden window ledge overlooking a maple-lined street',
    'a quiet reading nook beside a tall autumn window',
    'a small cafe table framed by a golden-lit window',
    'a study desk beside a window full of falling leaves',
    'a window seat overlooking a courtyard of maple trees'
  ],
  compositionPool: [
    'the scene fills the right two-thirds; the left third stays calm and low-detail for a headline, divider, and subtitle',
    'a clean left-third column of soft golden light left empty for text; the subject sits in the right two-thirds',
    'the right two-thirds hold the window and subject; the left third is a quiet gradient reserved for the title block',
    'subject and window anchor the right side; the left third of the frame is deliberately uncluttered for text'
  ],
  lightingPool: [
    'warm golden-hour light streaming through the window',
    'soft late-afternoon autumn light with long gentle shadows',
    'warm amber light mixed with cool outdoor air',
    'gentle golden backlight through sheer curtains'
  ],
  palettePool: [
    'warm amber, maple orange, and cream tones',
    'soft terracotta and golden yellow with deep brown accents',
    'muted rust and honey gold tones',
    'warm caramel, cream, and burnt sienna'
  ],
  propPool: [
    'a ceramic mug',
    'a woolen scarf',
    'a small stack of books',
    'a dried maple leaf',
    'an old letter',
    'a small brass lamp'
  ],
  cameraPool: [
    'eye-level shot with a 50mm lens feel, shallow depth of field',
    'straight-on window shot with soft background blur',
    'slightly low angle with warm natural light falloff',
    'close 50mm framing with the window softly blurred behind'
  ],
  textSafeZone: ['left-third'],
  // TASK v3.38 Part A5 — people, if present at all, are back-view or
  // silhouette only; no face is ever shown.
  peoplePolicy: 'no people, or a single distant figure seen from behind only — face never shown, small and secondary to the scene',
  forbiddenElements: [
    'visible brand labels',
    'readable text on any object',
    'busy cluttered background',
    'bright neon colors',
    'more than 5 distinct objects in frame'
  ],
  promptTemplate: 'original autumn window still-life scene, warm golden-hour tones, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
