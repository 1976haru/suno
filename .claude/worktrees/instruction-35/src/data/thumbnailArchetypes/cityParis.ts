import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

export const cityParisArchetype: ThumbnailArchetype = {
  id: 'city-paris',
  category: 'city-paris',
  labelKo: 'Paris city series',
  sceneCore: [
    'quiet corner cafe with round table and pale morning glass',
    'narrow apartment street with soft rain on the pavement',
    'small stone square with empty chairs after opening',
    'window seat above a calm boulevard with trees',
    'covered passage cafe with warm lamps and muted reflections'
  ],
  signatureObjects: ['white coffee cup', 'folded newspaper', 'green cafe chair'],
  lighting: 'soft grey morning, gentle window glow, warm lamp edge',
  palette: 'soft grey, cream, bottle green, muted gold',
  cameraFeel: 'elegant 50mm editorial cafe frame, shallow focus, quiet bokeh',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: '파리의 창가에서 듣는',
    mainPhrase: '파리카페',
    bottomBrandLine: 'PARIS PLAYLIST',
    bindSeriesTone: true
  },
  subjectPool: [
    'a white coffee cup on a round cafe table',
    'a folded newspaper with no readable text',
    'a green cafe chair beside a small table',
    'a plain croissant plate partly in soft focus',
    'a warm table lamp behind rain-specked glass'
  ],
  settingPool: [
    'a quiet corner cafe with pale morning glass',
    'a narrow apartment street after light rain',
    'a small stone square with empty green chairs',
    'a window seat above a calm tree-lined boulevard',
    'a covered passage cafe with muted lamp reflections'
  ],
  compositionPool: [
    'right side holds the cafe table and window; left third stays open for overlay text',
    'street perspective recedes to the right while the left third remains softly blank',
    'low table foreground anchors the right two-thirds with clean negative space on the left',
    'lamps and reflections stay right of center, preserving a calm left-third text column'
  ],
  lightingPool: [
    'soft grey morning light through cafe glass',
    'gentle window glow with warm lamp edge',
    'muted overcast light with refined highlights',
    'light rain reflections softened by shallow focus'
  ],
  palettePool: [
    'soft grey, cream, bottle green, and muted gold',
    'warm ivory with zinc grey and dark green accents',
    'pale stone, coffee brown, and quiet brass tones',
    'misty grey-blue with cream and moss green details'
  ],
  propPool: [
    'a white coffee cup',
    'a folded newspaper without readable text',
    'a green cafe chair',
    'a plain plate',
    'a warm table lamp',
    'a small silver spoon'
  ],
  cameraPool: [
    '50mm cafe-window framing with shallow depth of field',
    'eye-level editorial still with soft foreground blur',
    'slightly high tabletop angle with natural bokeh',
    'street-window frame with gentle highlight rolloff'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant back-view silhouette only, face never shown, small and secondary to the cafe setting',
  forbiddenElements: [
    'readable newspaper text',
    'visible brand labels',
    'front-facing pedestrians',
    'famous monuments as the main subject',
    'crowded tourist street'
  ],
  promptTemplate: 'original Paris cafe-window city scene, soft refined morning rain mood, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
