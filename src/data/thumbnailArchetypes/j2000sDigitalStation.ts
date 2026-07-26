import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

export const j2000sDigitalStationArchetype: ThumbnailArchetype = {
  id: 'j2000s-digital-station',
  category: 'j2000s-digital-station',
  sceneCore: [
    'early-2000s station-front corner with flip phone mail',
    'glossy CD shop listening counter under bright lights',
    'rainy station bus stop with clean digital color',
    'school hallway window after club practice',
    'summer festival side street with abstract lantern color'
  ],
  signatureObjects: ['flip phone', 'compact CD case', 'wired earphones'],
  lighting: 'bright clean digital daylight, crisp highlights, glossy reflections',
  palette: 'clear cyan, bright white, soft magenta, clean silver',
  cameraFeel: 'clean 50mm still-life, shallow focus, polished digital detail',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: 'ミレニアムの駅前で聴く',
    mainPhrase: 'メール待ち',
    bottomBrandLine: 'MILLENNIUM J POP PLAYLIST',
    bindSeriesTone: true
  },
  labelKo: '2000s 디지털 역 앞',
  subjectPool: [
    'a flip phone with an unread mail screen shape but no readable text',
    'a compact CD case catching bright shop light',
    'a clear convenience-store umbrella with rain beads',
    'a school notebook with a small photo sticker tucked inside',
    'wired earphones coiled beside a station ticket'
  ],
  settingPool: [
    'an early-2000s Japanese station-front corner with clean digital brightness',
    'a CD shop listening-booth counter with glossy reflections',
    'a rainy bus-stop bench near station gates, bright and saturated',
    'a school hallway window after club practice with evening light',
    'a summer festival side street with lantern color kept abstract and textless'
  ],
  compositionPool: [
    'the scene fills the right two-thirds; the left third stays bright, simple, and low-detail for later text overlay',
    'a clean left-third column of saturated light is left empty for text; the subject sits in the right two-thirds',
    'station lights and props anchor the right side while the left third remains open for the title block',
    'the left third is calm negative space; the right side carries glossy early-digital details'
  ],
  lightingPool: [
    'bright clean digital daylight with crisp highlights',
    'saturated evening station light with glossy reflections',
    'clear rainy light with shiny pavement detail',
    'fresh high-key pop lighting with polished edges'
  ],
  palettePool: [
    'clear cyan, bright white, soft magenta, and clean silver',
    'saturated sky blue with vivid pink and glossy gray accents',
    'fresh lemon yellow, white, and station-sign blue without readable text',
    'bright digital pop color, clean contrast, no vintage haze'
  ],
  propPool: [
    'a flip phone',
    'a compact CD case',
    'wired earphones',
    'a clear umbrella',
    'a station ticket',
    'a small photo sticker'
  ],
  cameraPool: [
    'clean 50mm still-life shot with glossy highlights and shallow depth of field',
    'slightly high table angle with crisp digital detail',
    'straight-on station-window shot with bright reflections',
    'close pop-product framing, polished but unbranded'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant figure seen from behind only; face never shown, small and secondary',
  forbiddenElements: [
    'visible brand labels',
    'readable text on phone, tickets, signs, or stickers',
    'modern smartphone interface',
    'social media app icons',
    'lo-fi vintage film haze'
  ],
  promptTemplate: 'original early-2000s Japanese J-pop digital station still-life thumbnail background, bright saturated clean digital color, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
