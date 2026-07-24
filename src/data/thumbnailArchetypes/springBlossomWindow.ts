import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

// TASK v3.38 Part A — spring variant of the approved reference grammar.
export const springBlossomWindowArchetype: ThumbnailArchetype = {
  id: 'spring-blossom-window',
  category: 'spring-blossom-window',
  labelKo: '벚꽃 새싹 창가',
  subjectPool: [
    'a small vase of cherry blossom branches',
    'a potted seedling on the windowsill',
    'a light cardigan draped over a chair',
    'a cup of pale tea beside an open notebook',
    'a small basket of fresh spring flowers'
  ],
  settingPool: [
    'a window ledge overlooking a blooming cherry tree',
    'a bright reading corner beside a spring-lit window',
    'a small table beside a window with petals drifting past',
    'a cozy nook overlooking a garden of new sprouts',
    'a windowsill with soft spring light and pale blossoms'
  ],
  compositionPool: [
    'the scene fills the right two-thirds; the left third stays calm and low-detail for a headline, divider, and subtitle',
    'a clean left-third column of soft spring light left empty for text; the subject sits in the right two-thirds',
    'the right two-thirds hold the window and subject; the left third is a quiet gradient reserved for the title block',
    'subject and window anchor the right side; the left third of the frame is deliberately uncluttered for text'
  ],
  lightingPool: [
    'soft fresh morning light through pale blossoms',
    'gentle diffused daylight with a pastel spring cast',
    'warm soft light filtering through sheer curtains',
    'clear bright spring daylight with a mild warm tone'
  ],
  palettePool: [
    'pale pink, soft mint, and cream tones',
    'soft blossom pink with light sage green accents',
    'pastel lavender and fresh spring green',
    'warm ivory with a hint of pale pink'
  ],
  propPool: [
    'a ceramic teacup',
    'a light cardigan',
    'a small potted seedling',
    'a cherry blossom branch',
    'an open notebook',
    'a small woven basket'
  ],
  cameraPool: [
    'eye-level shot with a 50mm lens feel, soft background blur',
    'straight-on window shot with gentle petal bokeh',
    'slightly low angle with fresh spring light',
    'close 50mm framing with the blossom window softly blurred'
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
  promptTemplate: 'original spring window still-life scene with pale cherry blossoms, soft morning light, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
