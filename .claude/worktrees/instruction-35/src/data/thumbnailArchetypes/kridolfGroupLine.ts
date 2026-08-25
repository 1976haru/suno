import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

// TASK K3 §6-3 — kr-idol-female workspace, 2 of 3 new archetypes.
export const kridolfGroupLineArchetype: ThumbnailArchetype = {
  id: 'kridolf-group-line',
  category: 'kridolf-group-line',
  suitedArchetypes: ['kr-idol-female'],
  sceneCore: [
    'several distant silhouettes standing in a matched diagonal line, backlit by bright even light',
    'a row of figures seen from behind walking in step down a bright open street',
    'silhouettes arranged in a loose cluster on a sunlit rooftop, all faces turned away',
    'a line of distant figures crossing a plaza together, evenly spaced shadows underfoot',
    'several silhouettes standing shoulder to shoulder against a bright color-block wall'
  ],
  signatureObjects: ['matched shadow row', 'evenly spaced silhouettes', 'bright even backlight'],
  lighting: 'bright even backlight, soft-edged shadows, no single dramatic spotlight',
  palette: 'clean bright daylight tones, one bold accent color, high key overall',
  cameraFeel: 'wide symmetrical group perspective, figures small and distant, text-safe lower third',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: 'SIDE BY SIDE',
    mainPhrase: 'TOGETHER WE MOVE',
    bottomBrandLine: 'KR IDOL GROUP LINE',
    bindSeriesTone: true
  },
  labelKo: 'Group Line Silhouette',
  subjectPool: [
    'several distant silhouettes in a matched line, faces never visible',
    'a row of figures seen from behind, evenly spaced',
    'a loose cluster of silhouettes on a rooftop, all turned away from camera',
    'figures crossing a plaza together, seen only as shadow shapes',
    'silhouettes standing shoulder to shoulder against a bright wall'
  ],
  settingPool: [
    'a bright open street with even daylight',
    'a sunlit rooftop with a clean horizon',
    'an open plaza under high-key light',
    'a bright color-block wall backdrop',
    'a wide open courtyard in full daylight'
  ],
  compositionPool: [
    'the group scene fills the upper two-thirds; the lower third stays a clean band for text overlay',
    'a clean lower-third band of solid color is reserved for text while the line of figures stands above',
    'the silhouettes anchor the center in a diagonal line; both outer thirds stay open for the title block',
    'evenly spaced figures span the frame; a light negative-space band along the bottom holds the brand line'
  ],
  lightingPool: [
    'bright even backlight with soft shadow edges',
    'high-key daylight, no single dramatic spotlight',
    'clean overcast-bright light, evenly distributed',
    'warm late-morning backlight silhouetting the whole line'
  ],
  palettePool: [
    'clean bright daylight palette with one bold accent color',
    'high-key neutral tones, no heavy shadow',
    'soft pastel-and-bright combination',
    'crisp white-and-color graphic palette'
  ],
  propPool: ['matched shadow row', 'even backlight glow', 'clean horizon line', 'color-block backdrop', 'plaza paving pattern'],
  cameraPool: [
    'wide symmetrical shot with the line of figures centered',
    'low upward angle emphasizing the matched silhouettes',
    'rooftop-height wide shot with a clean horizon',
    'evenly spaced wide framing across the full width'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'several distant silhouettes only, always seen from behind or fully backlit; face must never be shown, every figure kept adult-proportioned and equally distant',
  forbiddenElements: [
    'any visible face or facial feature',
    'school uniform or any youth-coded clothing silhouette',
    'readable signage or venue names',
    'visible brand logos',
    'artist likeness or poster',
    'a number of silhouettes that reads as a specific named group\'s member count'
  ],
  promptTemplate: 'original bright daylight thumbnail background, several small backlit silhouettes standing in a matched line, lower third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
