import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

export const modernChillNeonRoomArchetype: ThumbnailArchetype = {
  id: 'modern-chill-neon-room',
  category: 'modern-chill-neon-room',
  sceneCore: [
    'rainy apartment desk with headphones and laptop glow',
    'late-night window corner with muted neon reflections',
    'bedside audio setup with soft synth-pad color',
    'small studio desk with rain on the glass',
    'quiet room with phone face-down and wired headphones'
  ],
  signatureObjects: ['headphones', 'laptop glow', 'rain-streaked glass'],
  lighting: 'muted neon and soft screen glow with deep rainy shadows',
  palette: 'charcoal black, muted cyan, soft magenta, warm screen amber',
  cameraFeel: 'close 50mm still-life, shallow focus, low-glare modern polish',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: 'LATE NIGHT',
    mainPhrase: 'CHILL HOURS',
    bottomBrandLine: 'CHILL HOURS PLAYLIST',
    bindSeriesTone: true
  },
  labelKo: 'Modern Chill Neon Room',
  subjectPool: [
    'over-ear headphones resting beside a dim laptop',
    'a phone placed face-down near a rain-streaked window',
    'a small MIDI keyboard with no readable labels',
    'a glass of water catching muted neon reflection',
    'a folded hoodie beside a soft desk lamp'
  ],
  settingPool: [
    'a rainy apartment desk at predawn with muted neon outside',
    'a compact bedroom studio corner lit by laptop glow',
    'a window seat with headphones and rain reflections',
    'a small desk facing a dark city window',
    'a quiet late-night room with soft screen light and no visible brands'
  ],
  compositionPool: [
    'the scene fills the right two-thirds; the left third stays dark, clean, and low-detail for later text overlay',
    'a calm left-third column of shadow is left empty for text; the audio objects sit in the right two-thirds',
    'rain reflections and headphones anchor the right side while the left third remains open for the title block',
    'the left third is uncluttered negative space; the right side carries modern listening details'
  ],
  lightingPool: [
    'muted cyan neon reflected through rain',
    'soft laptop glow with warm amber desk spill',
    'low-key predawn light with magenta edge reflections',
    'quiet screen-lit room with gentle shadow falloff'
  ],
  palettePool: [
    'charcoal black with muted cyan and soft magenta accents',
    'deep graphite, rain blue, and warm screen amber',
    'low-saturation violet, teal reflection, and dark gray',
    'cool rainy blue balanced by a small warm desk light'
  ],
  propPool: [
    'headphones',
    'a laptop with blank screen glow',
    'a phone face-down',
    'a compact MIDI keyboard',
    'a glass of water',
    'a folded hoodie'
  ],
  cameraPool: [
    'close 50mm still-life shot with shallow focus and no readable screens',
    'slightly high desk angle with soft screen glow',
    'straight-on rainy-window composition with subdued reflections',
    'low-angle close framing, modern and unbranded'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant silhouette seen from behind only; face never shown, small and secondary',
  forbiddenElements: [
    'visible brand labels',
    'readable text on screens or stickers',
    'artist posters or album covers',
    'social media app icons',
    'busy RGB gaming setup'
  ],
  promptTemplate: 'original modern chill late-night room still-life thumbnail background, muted neon rain and headphone listening mood, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
