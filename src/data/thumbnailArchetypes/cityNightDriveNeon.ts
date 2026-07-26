import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

export const cityNightDriveNeonArchetype: ThumbnailArchetype = {
  id: 'city-night-drive-neon',
  category: 'city-night-drive-neon',
  sceneCore: [
    'wet night road seen from inside a parked car',
    'dashboard reflection facing a neon-lit avenue',
    'city windshield with rain beads and blurred traffic lights',
    'quiet rooftop parking corner under saturated streetlights',
    'unbranded car interior with glowing city reflections'
  ],
  signatureObjects: ['dashboard glow', 'rainy windshield', 'wet asphalt reflection'],
  lighting: 'saturated city neon, glossy wet-road reflections, clean modern contrast',
  palette: 'midnight black, electric blue, cherry red, clean white highlights',
  cameraFeel: 'wide dashboard perspective, cinematic night-drive depth, text-safe left third',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: 'NIGHT DRIVE',
    mainPhrase: 'CITY NIGHT',
    bottomBrandLine: 'CITY NIGHT DRIVE PLAYLIST',
    bindSeriesTone: true
  },
  labelKo: 'City Night Drive Neon',
  subjectPool: [
    'a clean dashboard edge with no visible logo',
    'rain beads on a windshield',
    'wet asphalt reflecting neon color',
    'a blurred traffic light reflection',
    'a folded jacket on the passenger seat'
  ],
  settingPool: [
    'a neon-lit city avenue seen through a rainy windshield',
    'an unbranded parked car interior facing wet night streets',
    'a quiet rooftop parking edge with city towers beyond',
    'a tunnel exit with saturated reflections and no readable signs',
    'a late-night riverside road with clean skyline light'
  ],
  compositionPool: [
    'the city-road scene fills the right two-thirds; the left third stays dark, smooth, and uncluttered for later text overlay',
    'a clean left-third column of night shadow is reserved for text while dashboard and neon reflections sit right',
    'windshield rain and streetlights anchor the right side; the left third remains open for the title block',
    'the left third is simple negative space; the right side carries dashboard depth and wet-road motion'
  ],
  lightingPool: [
    'electric blue and red city neon on wet asphalt',
    'clean white dashboard glow against midnight street color',
    'rain-softened traffic light reflections',
    'high-contrast tunnel light with glossy road texture'
  ],
  palettePool: [
    'midnight black with electric blue, cherry red, and clean white highlights',
    'deep navy road tones with cyan and magenta reflections',
    'cool black glass, red brake-light streaks, and silver highlights',
    'saturated night-drive color without muddy vintage haze'
  ],
  propPool: [
    'dashboard edge',
    'rainy windshield',
    'wet asphalt reflection',
    'traffic light blur',
    'folded jacket',
    'unbranded steering wheel crop'
  ],
  cameraPool: [
    'wide dashboard perspective with shallow city-light blur',
    'low windshield angle with glossy wet-road depth',
    '50mm interior still-life with rain reflections',
    'cinematic night-drive framing, no readable signage'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant driver silhouette seen from behind only; face never shown, small and secondary',
  forbiddenElements: [
    'visible car brand logos',
    'readable street signs or license plates',
    'phone navigation text',
    'artist likeness or poster',
    'unsafe driving action'
  ],
  promptTemplate: 'original modern city night-drive thumbnail background, wet neon road and unbranded dashboard perspective, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
