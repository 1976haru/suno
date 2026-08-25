import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

/**
 * TASK K3 §6-3 — kr-idol-female workspace, 1 of 3 new archetypes. §6-3's
 * own explicit instruction: the direction is deliberately opposite K2's own
 * 3 (stage-spotlight-night / neon-night-city / monochrome) — bright
 * saturated daylight instead of dark spotlight-and-haze.
 */
export const kridolfDaylightCityArchetype: ThumbnailArchetype = {
  id: 'kridolf-daylight-city',
  category: 'kridolf-daylight-city',
  suitedArchetypes: ['kr-idol-female'],
  sceneCore: [
    'a distant silhouette walking briskly down a sunlit city street, bold saturated color blocks on the buildings',
    'a figure seen from behind crossing a bright plaza under clear midday light',
    'a small silhouette on a rooftop overlooking a sunlit skyline, sharp clean shadows',
    'a distant figure striding through a colorful alley, saturated wall murals passing by',
    'a lone silhouette pausing at a crosswalk in bright daylight, bold graphic shadow underfoot'
  ],
  signatureObjects: ['sharp midday shadow', 'saturated color-block wall', 'clear blue sky'],
  lighting: 'hard clean midday sun, sharp defined shadows, no haze or glow',
  palette: 'bold saturated primary and pastel color blocks, clear bright sky, high contrast',
  cameraFeel: 'wide open-air perspective, figure small and distant, text-safe lower third',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: 'BROAD DAYLIGHT',
    mainPhrase: 'THE CITY IS MINE',
    bottomBrandLine: 'KR IDOL DAYLIGHT CITY',
    bindSeriesTone: true
  },
  labelKo: 'Daylight City Silhouette',
  subjectPool: [
    'a distant silhouette striding forward, face never visible',
    'a figure seen from behind against a color-block wall',
    'a small silhouette pausing at a bright crosswalk',
    'a rooftop silhouette overlooking a sunlit skyline',
    'a figure mid-stride through a colorful alley, seen only from the side and behind'
  ],
  settingPool: [
    'a sunlit city street with bold color-block storefronts',
    'an open plaza under clear midday light',
    'a rooftop overlooking a bright skyline',
    'a colorful mural-lined alley in full daylight',
    'a crosswalk under a clear blue sky'
  ],
  compositionPool: [
    'the street scene fills the upper two-thirds; the lower third stays a clean color block for text overlay',
    'a clean lower-third band of solid saturated color is reserved for text while the lit figure stands above',
    'the silhouette anchors one side; the opposite third stays open sky for the title block',
    'bold color blocks fill the background; a light negative-space band along the bottom holds the brand line'
  ],
  lightingPool: [
    'hard clean midday sun with sharp shadow edges',
    'bright even daylight, no haze',
    'clear blue-sky backlight silhouetting the rooftop figure',
    'bold saturated color-block lighting, high contrast'
  ],
  palettePool: [
    'saturated primary color blocks against a clear sky',
    'bright pastel-and-bold color combination, high contrast',
    'clean white daylight with one bold accent color',
    'high-saturation graphic palette, no muted tones'
  ],
  propPool: ['sharp midday shadow', 'color-block wall', 'clear sky', 'crosswalk stripe', 'rooftop railing silhouette', 'mural color patch'],
  cameraPool: [
    'wide street shot with the figure small and distant',
    'low upward angle emphasizing the clear sky',
    'rooftop-height wide shot overlooking the skyline',
    'symmetrical wide framing with bold color blocks on both sides'
  ],
  textSafeZone: ['left-third'],
  // TASK K3 §7-1/§7-2 — silhouette/rear-view/partial framing throughout,
  // same bar K2 already set; explicitly no youth-coded composition (no
  // school uniform, no lowered camera angle implying a child's height).
  peoplePolicy: 'exactly one distant silhouette, always seen from behind or fully backlit; face must never be shown, figure kept adult-proportioned and small against the scene',
  forbiddenElements: [
    'any visible face or facial feature',
    'school uniform or any youth-coded clothing silhouette',
    'readable shop signage or street names',
    'visible brand logos',
    'artist likeness or poster',
    'multiple clearly-distinguishable people'
  ],
  promptTemplate: 'original sunlit city-street thumbnail background, one small backlit silhouette against bold color-block architecture, lower third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
