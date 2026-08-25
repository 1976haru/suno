import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

// TASK B2 — kr-2030 workspace, 2 of 3 new archetypes.
export const kr2030SeoulStreetArchetype: ThumbnailArchetype = {
  id: 'kr2030-seoul-street',
  category: 'kr2030-seoul-street',
  suitedArchetypes: ['kr-2030-pop'],
  sceneCore: [
    'a narrow Seoul back alley at night, wet asphalt reflecting shop signs',
    'a quiet residential alley with glowing window lights and a parked bicycle',
    'a rain-slicked crosswalk under mixed neon and streetlight color',
    'an alley corner with stacked delivery boxes and a single glowing sign',
    'a rooftop-level view over low rain-wet rooftops and distant signage glow'
  ],
  signatureObjects: ['wet asphalt reflection', 'glowing shop sign blur', 'narrow alley walls'],
  lighting: 'mixed warm shop-sign glow and cool streetlight on wet surfaces',
  palette: 'wet-asphalt black, warm sign amber, cool streetlight blue',
  cameraFeel: 'eye-level alley perspective, gentle rain haze, text-safe left third',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: 'SEOUL NIGHT',
    mainPhrase: 'BACK ALLEY',
    bottomBrandLine: 'KR 2030 CITY NIGHT PLAYLIST',
    bindSeriesTone: true
  },
  labelKo: 'Rainy Seoul Back Alley',
  subjectPool: [
    'wet asphalt reflecting blurred sign colors',
    'a narrow alley wall with unreadable glowing signage',
    'a parked bicycle against a brick wall',
    'stacked delivery boxes beside a doorway',
    'a rain-beaded streetlight globe'
  ],
  settingPool: [
    'a narrow residential alley at night with mixed shop-sign glow',
    'a quiet back street with wet reflections and no visible faces',
    'a rain-slicked crosswalk lit by streetlight and distant neon',
    'an alley corner near a closed shutter and glowing sign blur',
    'a low rooftop view over rain-wet rooftops and distant city glow'
  ],
  compositionPool: [
    'the alley scene fills the right two-thirds; the left third stays dark and uncluttered for later text overlay',
    'a clean left-third column of wet-night shadow is reserved for text while the alley and lights sit right',
    'sign glow and wet asphalt anchor the right side; the left third remains open for the title block',
    'the left third is simple negative space; the right side carries alley depth and reflected light'
  ],
  lightingPool: [
    'warm amber shop-sign glow blurred by rain',
    'cool blue streetlight on wet asphalt',
    'mixed warm-and-cool reflected color on stone walls',
    'soft rain haze softening every light source'
  ],
  palettePool: [
    'wet black asphalt with warm amber and cool blue sign reflections',
    'deep charcoal alley tones with scattered warm highlights',
    'muted rain-night palette, no harsh saturation',
    'cool streetlight blue against warm doorway glow'
  ],
  propPool: ['wet asphalt', 'glowing sign blur', 'parked bicycle', 'delivery boxes', 'streetlight globe', 'brick wall texture'],
  cameraPool: [
    'eye-level alley framing with soft rain haze',
    'low-angle wet-reflection perspective',
    '35mm street-level still life, no readable signage',
    'quiet rooftop-view framing over rain-wet roofs'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant walking silhouette seen from behind only; face never shown, small and secondary',
  forbiddenElements: [
    'readable shop names, signage text, or license plates',
    'visible brand logos',
    'artist likeness or poster',
    'daylight scenes (this archetype is night only)',
    'crowded or busy street scenes'
  ],
  promptTemplate: 'original modern rainy Seoul back-alley thumbnail background, unreadable glowing signage and wet reflections, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
