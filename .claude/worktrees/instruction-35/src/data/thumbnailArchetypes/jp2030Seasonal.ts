import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

// TASK C2 — jp-2030 workspace, 1 of 3 new archetypes. suitedArchetypes is
// set (never left undefined) so this stays invisible to every other channel
// archetype's own thumbnail dropdown — see thumbnailArchetypes/index.ts's
// thumbnailArchetypesForArchetype. recommendedTypography reuses
// KOREAN_SERIF_TYPOGRAPHY, same as the two existing Japanese senior
// archetypes (j2000sDigitalStation.ts, showa70sKissatenFilm.ts) — this
// codebase has never split typography guides by script, only by tone
// (serif vs. the kids bright-rounded set).
export const jp2030SeasonalArchetype: ThumbnailArchetype = {
  id: 'jp2030-seasonal',
  category: 'jp2030-seasonal',
  suitedArchetypes: ['jp-2030-pop'],
  sceneCore: [
    'a school path lined with falling cherry blossoms in early spring',
    'a summer festival street strung with paper lanterns at dusk',
    'a quiet path through turning autumn leaves near a train line',
    'a single street corner just after the year\'s first snowfall'
  ],
  signatureObjects: ['falling petals or leaves', 'paper lantern glow', 'a bicycle at the roadside'],
  lighting: 'soft directional seasonal light — pale spring haze, warm festival dusk, low autumn sun, or flat snow-light',
  palette: 'season-led palette: soft pink-and-green spring, warm lantern-orange summer dusk, amber-and-rust autumn, pale blue-white winter',
  cameraFeel: 'eye-level street/path perspective, shallow depth on the seasonal foreground, text-safe left third',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: 'A SEASON PASSING',
    mainPhrase: 'STILL HERE',
    bottomBrandLine: 'JP 2030 REIWA PLAYLIST',
    bindSeriesTone: true
  },
  labelKo: 'Seasonal Turning Point',
  subjectPool: [
    'cherry blossom petals drifting across a school path',
    'paper lanterns strung above a festival street',
    'turning autumn leaves along a quiet rail-side path',
    'the first light snow settling on a street corner',
    'a bicycle leaning against a low wall under seasonal light'
  ],
  settingPool: [
    'a tree-lined school path in early spring',
    'a narrow festival street at summer dusk',
    'a quiet path beside a local train line in autumn',
    'an ordinary street corner just after the year\'s first snow',
    'a park bench under a half-bare tree between seasons'
  ],
  compositionPool: [
    'the seasonal scene fills the right two-thirds; the left third stays soft and open for later text overlay',
    'a clean left-third column of muted seasonal color is reserved for text while the path and light sit right',
    'the path and foreground season detail anchor the right side; the left third remains quiet negative space',
    'the left third is soft atmospheric haze; the right side carries the season\'s own color and texture'
  ],
  lightingPool: [
    'pale hazy spring light through falling petals',
    'warm lantern-orange dusk glow',
    'low golden autumn sun through turning leaves',
    'flat soft winter light on fresh snow'
  ],
  palettePool: [
    'soft pink and fresh green spring tones',
    'warm lantern orange against a deepening summer-dusk blue',
    'amber, rust, and warm brown autumn tones',
    'pale blue-white winter tones with a single warm accent'
  ],
  propPool: ['falling petals', 'paper lanterns', 'turning leaves', 'light snowfall', 'a roadside bicycle', 'a low stone wall'],
  cameraPool: [
    'eye-level path perspective with shallow seasonal-foreground blur',
    'street-corner framing with soft atmospheric depth',
    '35mm still framing of a single seasonal detail',
    'quiet path framing, no readable signage'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant walking silhouette seen from behind only; face never shown, small and secondary',
  forbiddenElements: [
    'readable signage or shop names',
    'school emblem, uniform crest, or any mark tied to a real institution',
    'a specific, recognizable real-world landmark',
    'artist or character likeness',
    'any single season mixed with another season\'s markers in one frame'
  ],
  promptTemplate: 'original seasonal-turning-point thumbnail background for a Reiwa-era Japanese youth playlist, one clear season, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
