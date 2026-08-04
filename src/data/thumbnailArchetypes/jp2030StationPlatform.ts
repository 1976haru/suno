import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

// TASK C2 — jp-2030 workspace, 2 of 3 new archetypes. See kr2030CafeNight.ts's
// own comment for why suitedArchetypes is always set and why
// recommendedTypography reuses KOREAN_SERIF_TYPOGRAPHY.
export const jp2030StationPlatformArchetype: ThumbnailArchetype = {
  id: 'jp2030-station-platform',
  category: 'jp2030-station-platform',
  suitedArchetypes: ['jp-2030-pop'],
  sceneCore: [
    'an empty local train platform at dusk, one bench under a platform lamp',
    'a ticket-gate corridor with the evening light coming through in long lines',
    'a platform edge looking out over quiet suburban rooftops at sunset',
    'a covered platform bench with a school bag set down beside it'
  ],
  signatureObjects: ['platform lamp glow', 'a station clock', 'a bench with a bag beside it'],
  lighting: 'low warm dusk light angled along the platform, deepening toward blue at the edges',
  palette: 'warm amber platform light against a cooling dusk-blue sky',
  cameraFeel: 'straight-on platform-level perspective, long sightline down the tracks, text-safe left third',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: 'WAITING FOR THE NEXT ONE',
    mainPhrase: 'STILL HERE',
    bottomBrandLine: 'JP 2030 REIWA PLAYLIST',
    bindSeriesTone: true
  },
  labelKo: 'Evening Station Platform',
  subjectPool: [
    'a station platform lamp just switching on at dusk',
    'a ticket-gate corridor lit by long evening light',
    'an empty bench on a covered platform',
    'a station clock reading early evening',
    'a school bag left beside an empty platform bench'
  ],
  settingPool: [
    'a quiet local train platform at dusk',
    'a ticket-gate corridor between the street and the platform',
    'a platform edge overlooking suburban rooftops at sunset',
    'a covered waiting area on an otherwise empty platform',
    'a stairwell down to the platform with evening light at the top'
  ],
  compositionPool: [
    'the platform and track line recede into the right two-thirds; the left third stays open for text',
    'a clean left-third column of dusk-blue shadow is reserved for text while the platform sits right',
    'the platform lamp and bench anchor the right side; the left third remains quiet negative space',
    'the left third is soft dusk haze; the right side carries the platform\'s own warm lamp light'
  ],
  lightingPool: [
    'warm platform lamps against a deepening blue dusk sky',
    'long low sunset light down the track line',
    'soft overcast evening light with a single warm lamp accent',
    'cool blue pre-night light with distant station glow'
  ],
  palettePool: [
    'warm amber lamp light against cool dusk blue',
    'soft sunset orange fading into evening grey-blue',
    'muted platform tones with one warm light source',
    'quiet blue-hour palette, no neon saturation'
  ],
  propPool: ['platform lamp', 'station clock', 'empty bench', 'school bag', 'ticket gate', 'track line'],
  cameraPool: [
    'straight platform-level perspective with a long track sightline',
    'ticket-gate corridor framing with backlit evening glow',
    '50mm still framing of a single platform detail',
    'quiet platform framing, no readable station name or signage'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant standing/walking silhouette seen from behind only; face never shown, small and secondary',
  forbiddenElements: [
    'readable station name, line name, or any real transit signage',
    'a specific, recognizable real-world station',
    'train livery or a real operator\'s branding',
    'artist or character likeness',
    'crowded rush-hour scenes (this archetype is quiet and near-empty only)'
  ],
  promptTemplate: 'original evening train-platform thumbnail background for a Reiwa-era Japanese youth playlist, quiet and near-empty, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
