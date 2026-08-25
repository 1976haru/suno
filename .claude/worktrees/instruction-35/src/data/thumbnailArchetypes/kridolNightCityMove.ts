import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

// TASK K2 §8-2 — kr-idol-male workspace, 2 of 3 new archetypes.
export const kridolNightCityMoveArchetype: ThumbnailArchetype = {
  id: 'kridol-night-city-move',
  category: 'kridol-night-city-move',
  suitedArchetypes: ['kr-idol-male'],
  sceneCore: [
    'a distant silhouette walking down an empty night street lit by shop signs and headlights',
    'a figure seen through a moving van window, city lights streaking past',
    'a lone silhouette crossing an intersection under overhead neon',
    'a distant figure standing at a rooftop edge overlooking a glowing skyline',
    'a small silhouette waiting at a bus stop washed in passing headlight glare'
  ],
  signatureObjects: ['neon sign bokeh', 'passing headlight streak', 'skyline glow'],
  lighting: 'mixed neon and headlight sources, motion-streaked light trails, deep night shadow',
  palette: 'saturated night neon (cyan/magenta), warm sodium streetlight, deep indigo sky',
  cameraFeel: 'wide street or skyline perspective, figure small and distant, text-safe upper third',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: 'AFTER HOURS',
    mainPhrase: 'THE CITY MOVES',
    bottomBrandLine: 'KR IDOL NIGHT DRIVE',
    bindSeriesTone: true
  },
  labelKo: 'Night City Silhouette',
  subjectPool: [
    'a distant figure walking away, face never visible',
    'a silhouette framed inside a van window against streaking city lights',
    'a lone figure crossing under a neon sign, seen from behind',
    'a rooftop silhouette overlooking a glowing skyline',
    'a small figure at a bus stop, backlit by passing headlights'
  ],
  settingPool: [
    'an empty night street lit by mixed shop-sign neon',
    'a city intersection under overhead sodium light',
    'a rooftop overlooking a dense glowing skyline',
    'the inside of a moving vehicle with city lights streaking past the window',
    'a quiet night alley with a single distant neon glow'
  ],
  compositionPool: [
    'the street scene fills the lower two-thirds; the upper third stays dark sky for text overlay',
    'a clean upper-third band of night sky is reserved for text while the lit street sits below',
    'the silhouette anchors the right side; the left third stays soft and dim for the title block',
    'the skyline glow sweeps across the background; a dark foreground band along the bottom holds the brand line'
  ],
  lightingPool: [
    'saturated cyan-and-magenta neon wash',
    'warm sodium streetlight against deep indigo shadow',
    'motion-blurred headlight streaks across the frame',
    'soft skyline glow silhouetting the rooftop figure'
  ],
  palettePool: [
    'deep indigo night sky with saturated neon accents',
    'cool cyan-magenta city palette, no daylight warmth',
    'warm amber streetlight against cool shadow',
    'high-contrast night palette, glow against near-black'
  ],
  propPool: ['neon sign bokeh', 'headlight streak', 'skyline silhouette', 'wet-pavement reflection', 'bus-stop shelter frame', 'van window frame'],
  cameraPool: [
    'wide street shot with the figure small and distant',
    'low street-level angle with neon reflections in the foreground',
    'rooftop-height wide shot overlooking the skyline',
    'through-window framing with motion-streaked city lights'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'exactly one distant silhouette, always seen from behind or fully backlit; face must never be shown, figure kept small against the city scene',
  forbiddenElements: [
    'any visible face or facial feature',
    'readable shop signage or street names',
    'visible brand logos',
    'artist likeness or poster',
    'multiple clearly-distinguishable people'
  ],
  promptTemplate: 'original night-city thumbnail background, one small distant silhouette against neon and headlight glow, upper third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
