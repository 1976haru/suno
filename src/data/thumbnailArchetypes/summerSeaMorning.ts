import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

// TASK v3.38 Part A — summer variant of the approved reference grammar.
export const summerSeaMorningArchetype: ThumbnailArchetype = {
  id: 'summer-sea-morning',
  category: 'summer-sea-morning',
  labelKo: '여름 바닷가 아침',
  subjectPool: [
    'a cold glass of lemonade and a straw hat',
    'a pair of sandals beside a folded towel',
    'a small seashell and a glass of iced tea',
    'a light linen shirt draped over a chair',
    'a woven beach bag and a pair of sunglasses'
  ],
  settingPool: [
    'a window ledge overlooking a calm morning sea',
    'a bright porch corner facing a blue-sky beach view',
    'a small table beside a window with the ocean beyond',
    'a cozy nook overlooking white sand and clear water',
    'a windowsill with soft sea breeze and morning light'
  ],
  compositionPool: [
    'the scene fills the right two-thirds; the left third stays calm and low-detail for a headline, divider, and subtitle',
    'a clean left-third column of soft sky left empty for text; the subject sits in the right two-thirds',
    'the right two-thirds hold the window and subject; the left third is a quiet gradient reserved for the title block',
    'subject and window anchor the right side; the left third of the frame is deliberately uncluttered for text'
  ],
  lightingPool: [
    'clear bright morning sunlight over calm water',
    'soft coastal daylight with a gentle sea breeze feel',
    'warm early sun with a fresh clean cast',
    'bright diffused morning light off the water'
  ],
  palettePool: [
    'clear sky blue, white, and warm sand tones',
    'soft aqua and cream with warm gold accents',
    'bright ocean blue with pale sand neutrals',
    'fresh turquoise and warm ivory tones'
  ],
  propPool: [
    'a straw hat',
    'a pair of sandals',
    'a seashell',
    'a woven beach bag',
    'a folded towel',
    'a glass of iced tea'
  ],
  cameraPool: [
    'eye-level shot with a 50mm lens feel, soft background blur',
    'straight-on window shot with gentle sea-glare bokeh',
    'slightly low angle with bright coastal light',
    'close 50mm framing with the sea view softly blurred'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant figure seen from behind only — face never shown, small and secondary to the scene',
  forbiddenElements: [
    'visible brand labels',
    'readable text on any object',
    'busy cluttered background',
    'bright neon colors',
    'more than 5 distinct objects in frame'
  ],
  promptTemplate: 'original summer window still-life scene overlooking a calm morning sea, bright clean tones, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
