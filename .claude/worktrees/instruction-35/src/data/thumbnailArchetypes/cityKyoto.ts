import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

export const cityKyotoArchetype: ThumbnailArchetype = {
  id: 'city-kyoto',
  category: 'city-kyoto',
  labelKo: 'Kyoto city series',
  sceneCore: [
    'quiet machiya cafe window with morning garden light',
    'narrow stone lane with wooden lattice and soft shade',
    'small tea table near an open sliding window',
    'calm street corner after rain with warm lantern glow',
    'window seat looking toward a modest inner garden'
  ],
  signatureObjects: ['tea cup', 'small ceramic plate', 'folded cloth'],
  lighting: 'soft morning shade, garden-reflected light, warm interior edge',
  palette: 'matcha green, warm cedar, cream paper, muted charcoal',
  cameraFeel: 'quiet 50mm cafe still, low height, shallow natural focus',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: '교토의 창가에서 듣는',
    mainPhrase: '차분한길',
    bottomBrandLine: 'KYOTO PLAYLIST',
    bindSeriesTone: true
  },
  subjectPool: [
    'a tea cup beside a small ceramic plate',
    'a folded cloth on a low wooden table',
    'a plain sweets plate with no decoration text',
    'a small flower stem in a simple vase',
    'a warm cup near an open sliding window'
  ],
  settingPool: [
    'a quiet machiya cafe window with morning garden light',
    'a narrow stone lane with wooden lattice and soft shade',
    'a small tea table near an open sliding window',
    'a calm street corner after rain with warm lantern glow',
    'a window seat looking toward a modest inner garden'
  ],
  compositionPool: [
    'right two-thirds hold the wooden window and tea setting; left third remains soft for overlay text',
    'low table detail sits right of center while the left third stays calm and uncluttered',
    'stone lane rhythm leads gently right, preserving a pale left-third text column',
    'garden light and cup stay on the right side with clean negative space on the left'
  ],
  lightingPool: [
    'soft morning shade with garden-reflected light',
    'warm interior edge light against calm wood tones',
    'gentle overcast daylight after rain',
    'low amber glow softened by paper and wood surfaces'
  ],
  palettePool: [
    'matcha green, warm cedar, cream paper, and muted charcoal',
    'soft moss, beige paper, and deep wood brown',
    'quiet green-grey with warm tea and cedar tones',
    'pale cream, leaf green, and restrained ink-black accents'
  ],
  propPool: [
    'a tea cup',
    'a small ceramic plate',
    'a folded cloth',
    'a simple vase',
    'a low wooden table',
    'a warm cup'
  ],
  cameraPool: [
    'low 50mm cafe framing with shallow natural focus',
    'eye-level window still with soft garden bokeh',
    'slightly low angle across a wooden tabletop',
    'close editorial frame with gentle warm falloff'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant back-view silhouette only, face never shown, small and secondary to the quiet street',
  forbiddenElements: [
    'readable shop signs',
    'visible brand labels',
    'front-facing kimono portrait',
    'famous temple as the main subject',
    'tourist snapshot clutter'
  ],
  promptTemplate: 'original Kyoto machiya cafe scene, quiet garden morning light, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
