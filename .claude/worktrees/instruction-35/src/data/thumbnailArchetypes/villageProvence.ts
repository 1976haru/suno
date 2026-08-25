import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

export const villageProvenceArchetype: ThumbnailArchetype = {
  id: 'village-provence',
  category: 'village-provence',
  labelKo: 'Provence village series',
  sceneCore: [
    'small village terrace with pale shutters and morning sun',
    'narrow stone lane with herb pots beside a cafe door',
    'quiet square with wooden chairs under soft shade',
    'open kitchen window looking toward a warm courtyard',
    'roadside cafe table with linen cloth and low hills beyond'
  ],
  signatureObjects: ['lavender sprig', 'linen cloth', 'white coffee bowl'],
  lighting: 'dry golden morning light, soft shade, gentle rural highlights',
  palette: 'lavender grey, olive green, warm limestone, linen white',
  cameraFeel: '35mm-to-50mm rural cafe photograph, shallow field, gentle grain',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: '프로방스의 바람과 듣는',
    mainPhrase: '느린마을',
    bottomBrandLine: 'PROVENCE PLAYLIST',
    bindSeriesTone: true
  },
  subjectPool: [
    'a lavender sprig beside a white coffee bowl',
    'a linen cloth folded over a small terrace table',
    'a plain ceramic pitcher near an open window',
    'a small herb pot beside a wooden chair',
    'a simple bread plate with no labels or writing'
  ],
  settingPool: [
    'a small village terrace with pale shutters and morning sun',
    'a narrow stone lane with herb pots beside a cafe door',
    'a quiet square with wooden chairs under soft shade',
    'an open kitchen window looking toward a warm courtyard',
    'a roadside cafe table with linen cloth and low hills beyond'
  ],
  compositionPool: [
    'right two-thirds carry the terrace table and shutters; left third stays quiet for overlay text',
    'stone lane angle leads toward the right, leaving a soft uncluttered text column on the left',
    'foreground bowl sits low right with gentle blank wall tones across the left third',
    'window and herb pots stay right of center while the left third remains calm and readable'
  ],
  lightingPool: [
    'dry golden morning light with soft shade',
    'gentle rural sunlight reflected from limestone walls',
    'warm late-morning highlights with low contrast',
    'soft courtyard glow with natural bokeh'
  ],
  palettePool: [
    'lavender grey, olive green, warm limestone, and linen white',
    'pale cream with muted purple and herb green accents',
    'sun-washed stone, soft olive, and quiet white cloth',
    'warm beige, lavender shadow, and faded green details'
  ],
  propPool: [
    'a lavender sprig',
    'a linen cloth',
    'a white coffee bowl',
    'a ceramic pitcher',
    'a small herb pot',
    'a wooden chair'
  ],
  cameraPool: [
    '50mm village-terrace framing with shallow depth of field',
    'eye-level rural cafe still with soft background bokeh',
    'slightly low tabletop angle with gentle sunlight',
    'close editorial frame with muted warm color grading'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant back-view silhouette only, face never shown, small and secondary to the village setting',
  forbiddenElements: [
    'readable shop signs',
    'visible brand labels',
    'front-facing portraits',
    'overcrowded market scene',
    'oversaturated travel-poster colors'
  ],
  promptTemplate: 'original Provence village terrace scene, dry golden rural morning light, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
