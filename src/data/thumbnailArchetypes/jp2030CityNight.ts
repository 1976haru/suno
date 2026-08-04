import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

/**
 * TASK C2 — jp-2030 workspace, 3 of 3 new archetypes. §6-3's own explicit
 * cliche warning: the genre library already carries 54 city-pop-family
 * genres (C1 §1-1), so a generic neon-Tokyo-skyline / night-sportscar /
 * palm-trees-and-sunset thumbnail would just repeat what every other
 * city-pop product already looks like. Visualizes C1's own segmented
 * concepts instead (a rainy local-line station, a 2003-summer-vacation
 * feeling, a dawn convenience store, a coastal highway drive) — specific
 * enough that it doesn't read as generic city-pop stock art. Copied from
 * cityNightDriveNeon.ts's own structural shape (not its content) per this
 * task's own "복사 후 수정, 원본은 건드리지 말 것" — that file itself is
 * untouched.
 */
export const jp2030CityNightArchetype: ThumbnailArchetype = {
  id: 'jp2030-city-night',
  category: 'jp2030-city-night',
  suitedArchetypes: ['jp-2030-pop'],
  sceneCore: [
    'a small unmanned local-line station platform in light rain at night, one vending machine glowing',
    'the fluorescent-lit window of an all-night convenience store on an empty street before dawn',
    'an empty coastal highway just before sunrise, sea barely visible past the guardrail',
    'a cassette tape and a small stack of CDs on a low table in a dim studio apartment'
  ],
  signatureObjects: ['a lit vending machine', 'wet pavement reflections', 'a cassette tape'],
  lighting: 'low-saturation night light — fluorescent convenience-store white, wet-pavement reflection, or the first grey-blue of dawn',
  palette: 'muted late-night palette: cool wet-asphalt blue-grey, a single warm fluorescent or vending-machine accent',
  cameraFeel: 'quiet, still, slightly voyeuristic distance — never a moving-car or skyline hero shot',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: 'STILL AWAKE',
    mainPhrase: 'THIS QUIET HOUR',
    bottomBrandLine: 'JP 2030 REIWA PLAYLIST',
    bindSeriesTone: true
  },
  labelKo: 'Late-Night In-Between Places',
  subjectPool: [
    'a single lit vending machine on an empty rainy platform',
    'a convenience store window glowing on a dark, empty street',
    'a guardrail and the first grey light of dawn over the sea',
    'a cassette tape resting on a low table beside a small stack of CDs',
    'wet pavement reflecting a single distant streetlight'
  ],
  settingPool: [
    'a small unmanned local-line station in light night rain',
    'an all-night convenience store street corner before dawn',
    'an empty coastal highway pull-off just before sunrise',
    'a dim, quiet studio apartment table late at night',
    'a narrow back-alley behind a row of closed shopfronts'
  ],
  compositionPool: [
    'the night scene fills the right two-thirds; the left third stays dark and open for text overlay',
    'a clean left-third column of muted night shadow is reserved for text while the scene sits right',
    'the single light source anchors the right side; the left third remains quiet negative space',
    'the left third is soft dark haze; the right side carries the one warm or fluorescent light source'
  ],
  lightingPool: [
    'cool fluorescent white against wet dark asphalt',
    'a single warm vending-machine glow in the rain',
    'the first flat grey-blue light of pre-dawn over water',
    'a low warm desk lamp in an otherwise dark room'
  ],
  palettePool: [
    'cool blue-grey night tones with one warm fluorescent accent',
    'muted wet-asphalt blue with a single vending-machine warm spot',
    'flat pre-dawn grey-blue with the faintest warm horizon line',
    'quiet indoor amber against a dark uncluttered room'
  ],
  propPool: ['vending machine', 'wet pavement', 'guardrail', 'cassette tape', 'CD stack', 'closed shopfront shutters'],
  cameraPool: [
    'still, distant, slightly voyeuristic night framing',
    'low-angle platform-level framing in light rain',
    '35mm still-life framing of a tabletop object',
    'quiet street-corner framing, no readable signage'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant silhouette seen from behind only, small and secondary; face never shown',
  forbiddenElements: [
    'a generic neon Tokyo skyline as the main subject',
    'a moving sports car or night-drive hero shot',
    'palm trees, a sunset horizon, or any tropical-resort framing',
    'readable brand names, logos, or real convenience-store chain signage',
    'artist or character likeness'
  ],
  promptTemplate: 'original quiet late-night in-between-places thumbnail background for a Reiwa-era Japanese city-pop playlist, specific and understated (not a generic neon skyline), left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
