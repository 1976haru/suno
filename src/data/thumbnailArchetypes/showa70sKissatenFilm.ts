import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

export const showa70sKissatenFilmArchetype: ThumbnailArchetype = {
  id: 'showa-70s-kissaten-film',
  category: 'showa-70s-kissaten-film',
  sceneCore: [
    'quiet 1970s kissaten table with paper train ticket',
    'warm station waiting room seen through cafe glass',
    'narrow record shop counter with afternoon dust',
    'harbor-side coffee shop after rain',
    'small curtain window with paper calendar'
  ],
  signatureObjects: ['paper train ticket', 'handwritten letter', 'vinyl record sleeve'],
  lighting: 'warm tungsten lamp glow, soft film grain, muted amber reflections',
  palette: 'sepia amber, muted olive, coffee brown, faded cream',
  cameraFeel: 'analog 50mm still-life, shallow focus, gentle corner falloff',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: '昭和の灯りで聴く',
    mainPhrase: '古い駅灯り',
    bottomBrandLine: 'SHOWA SEVENTIES PLAYLIST',
    bindSeriesTone: true
  },
  labelKo: '쇼와 70s 필름 다방',
  subjectPool: [
    'a paper train ticket beside a porcelain coffee cup',
    'a folded handwritten letter under warm lamplight',
    'a vinyl record sleeve on a small kissaten table',
    'a dark umbrella leaning beside a wooden chair',
    'a brass ashtray-like vintage tray with no cigarette or smoke'
  ],
  settingPool: [
    'a quiet 1970s Japanese kissaten corner with wood grain and warm film color',
    'a tiled station waiting room seen through a warm cafe window',
    'a narrow record shop counter with soft afternoon dust',
    'a harbor-side coffee shop after rain with muted amber lamps',
    'a small table beside thin curtains and a paper calendar'
  ],
  compositionPool: [
    'the scene fills the right two-thirds; the left third stays blank, warm, and low-detail for later text overlay',
    'a clean left-third column of faded warm light is left empty for text; the subject sits in the right two-thirds',
    'wood table and props anchor the right side while the left third remains uncluttered for the title block',
    'the left third is calm negative space; the right side carries the era props and window mood'
  ],
  lightingPool: [
    'warm tungsten lamp glow with subtle film grain',
    'soft late-afternoon window light with gentle top-end rolloff',
    'muted amber cafe lighting after rain',
    'quiet low-key light with a warm paper texture'
  ],
  palettePool: [
    'warm sepia, muted olive, deep coffee brown, and faded cream',
    'amber tungsten, dark green vinyl, and soft beige paper',
    'muted gold with smoky brown shadows and restrained red accents',
    'soft orange-brown film color with low saturation'
  ],
  propPool: [
    'a paper train ticket',
    'a handwritten letter',
    'a vinyl record sleeve',
    'a porcelain coffee cup',
    'a dark umbrella',
    'a paper calendar'
  ],
  cameraPool: [
    'eye-level still-life shot with a 50mm lens feel and soft film grain',
    'slightly low table angle, shallow depth of field, analog photo texture',
    'straight-on cafe-window shot with soft reflections',
    'close still-life framing with gentle corner falloff'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant figure seen from behind only; face never shown, small and secondary',
  forbiddenElements: [
    'visible brand labels',
    'readable text on any object',
    'modern smartphone or app icon',
    'neon cyberpunk look',
    'busy cluttered background'
  ],
  promptTemplate: 'original 1970s Showa Japanese kissaten film still-life thumbnail background, warm film grain and muted color, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
