import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

export const cityBarcelonaArchetype: ThumbnailArchetype = {
  id: 'city-barcelona',
  category: 'city-barcelona',
  labelKo: 'Barcelona city series',
  sceneCore: [
    'sunlit balcony cafe with patterned floor tiles',
    'narrow old lane with warm walls and hanging shade',
    'small plaza table with citrus leaves and quiet chairs',
    'open window looking toward a bright side street',
    'corner cafe after a short rain with colored reflections'
  ],
  signatureObjects: ['citrus leaf', 'blue ceramic cup', 'woven chair'],
  lighting: 'Mediterranean morning light, clean shade, bright but muted color',
  palette: 'sun-washed cream, sea blue, muted coral, leaf green',
  cameraFeel: 'relaxed 50mm cafe-street photograph, shallow depth, sunlit bokeh',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: '바르셀로나의 바람과 듣는',
    mainPhrase: '햇살골목',
    bottomBrandLine: 'BARCELONA PLAYLIST',
    bindSeriesTone: true
  },
  subjectPool: [
    'a blue ceramic cup beside a citrus leaf',
    'a woven chair beside a small cafe table',
    'a plain glass catching sun on patterned tile',
    'a folded light scarf on a balcony chair',
    'a small white plate beside a muted coral wall'
  ],
  settingPool: [
    'a sunlit balcony cafe with patterned floor tiles',
    'a narrow old lane with warm walls and hanging shade',
    'a small plaza table with citrus leaves and quiet chairs',
    'an open window looking toward a bright side street',
    'a corner cafe after light rain with colored reflections'
  ],
  compositionPool: [
    'right two-thirds hold the cafe table and tile rhythm; left third stays quiet for overlay text',
    'balcony rail and street angle move toward the right with open calm space on the left',
    'foreground cup sits low right while the left third stays low-detail and sun-washed',
    'window frame anchors the right side, keeping the left third soft and uncluttered'
  ],
  lightingPool: [
    'clear Mediterranean morning light with soft shade',
    'warm sun reflected from pale walls',
    'bright but muted late-morning glow',
    'gentle post-rain highlights on tile and pavement'
  ],
  palettePool: [
    'sun-washed cream, sea blue, muted coral, and leaf green',
    'warm plaster tones with blue ceramic accents',
    'soft terracotta, pale yellow, and quiet turquoise',
    'cream stone, faded coral, and gentle green details'
  ],
  propPool: [
    'a citrus leaf',
    'a blue ceramic cup',
    'a woven chair',
    'a plain water glass',
    'a folded light scarf',
    'a white plate'
  ],
  cameraPool: [
    '50mm balcony-cafe framing with shallow depth of field',
    'eye-level street still with sunlit bokeh',
    'slightly low tabletop angle with warm natural light',
    'editorial window frame with gentle foreground blur'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant back-view silhouette only, face never shown, small and secondary to the sunny street',
  forbiddenElements: [
    'readable shop signs',
    'visible brand labels',
    'front-facing portraits',
    'famous architecture as the main subject',
    'oversaturated postcard colors'
  ],
  promptTemplate: 'original Barcelona balcony-cafe city scene, sunlit Mediterranean warmth, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
