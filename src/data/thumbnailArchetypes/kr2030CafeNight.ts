import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

// TASK B2 — kr-2030 workspace, 1 of 3 new archetypes. suitedArchetypes is
// set (never left undefined) so this stays invisible to every other channel
// archetype's own thumbnail dropdown — see thumbnailArchetypes/index.ts's
// thumbnailArchetypesForArchetype.
export const kr2030CafeNightArchetype: ThumbnailArchetype = {
  id: 'kr2030-cafe-night',
  category: 'kr2030-cafe-night',
  suitedArchetypes: ['kr-2030-pop'],
  sceneCore: [
    'a small 24-hour cafe table by a rain-streaked window before dawn',
    'a warm-lit counter corner with an empty seat and a closed laptop',
    'a window-side seat facing a quiet, half-lit city street',
    'a corner table with a single warm pendant light overhead',
    'an unbranded coffee cup on a dark wood table, city glow outside'
  ],
  signatureObjects: ['window condensation', 'warm pendant light', 'closed laptop'],
  lighting: 'warm amber interior light against a cool blue pre-dawn street outside',
  palette: 'warm amber, deep charcoal, muted blue-grey night tones',
  cameraFeel: 'close café-table perspective, shallow depth, text-safe left third',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: 'LATE NIGHT CAFE',
    mainPhrase: 'STILL HERE',
    bottomBrandLine: 'KR 2030 EMOTIONAL PLAYLIST',
    bindSeriesTone: true
  },
  labelKo: 'Late-Night Cafe Window',
  subjectPool: [
    'an unbranded coffee cup with rising steam',
    'a closed laptop on a wood table',
    'a window fogged with condensation',
    'a single warm pendant light overhead',
    'an empty chair across the table'
  ],
  settingPool: [
    'a small 24-hour cafe table facing a quiet pre-dawn street',
    'a window-side counter seat with a half-lit city block outside',
    'a corner table under one warm light, rest of the room dim',
    'a cafe doorway view onto an empty sidewalk before sunrise',
    'a rain-flecked window seat overlooking a sleeping city corner'
  ],
  compositionPool: [
    'the cafe interior fills the right two-thirds; the left third stays soft and dark for later text overlay',
    'a clean left-third column of dim warm shadow is reserved for text while the window and table sit right',
    'the window and table anchor the right side; the left third remains open for the title block',
    'the left third is quiet negative space; the right side carries warm light and window depth'
  ],
  lightingPool: [
    'warm amber pendant light against a cool blue window',
    'soft steam-lit tabletop glow',
    'condensation-softened streetlight through glass',
    'low warm interior light with a dim exterior blue hour'
  ],
  palettePool: [
    'warm amber and charcoal with a cool blue window backdrop',
    'deep coffee-brown tones with soft golden highlights',
    'muted night-blue exterior against warm interior amber',
    'quiet late-night palette, no neon saturation'
  ],
  propPool: ['coffee cup', 'closed laptop', 'window condensation', 'pendant light', 'empty chair', 'unbranded coaster'],
  cameraPool: [
    'close table-level perspective with shallow warm-light blur',
    'window-seat angle with soft condensation depth',
    '50mm still-life framing of cup and table',
    'quiet interior framing, no readable signage'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant seated silhouette seen from behind only; face never shown, small and secondary',
  forbiddenElements: [
    'visible cafe brand logos',
    'readable menu or signage text',
    'phone screen content',
    'artist likeness or poster',
    'daylight scenes (this archetype is dawn/night only)'
  ],
  promptTemplate: 'original modern late-night cafe thumbnail background, warm window-side table before dawn, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
