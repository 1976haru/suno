import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

export const cityPragueArchetype: ThumbnailArchetype = {
  id: 'city-prague',
  category: 'city-prague',
  labelKo: 'Prague city series',
  sceneCore: [
    'old riverside cafe window with soft morning mist',
    'narrow cobblestone lane after rain with amber lamps',
    'small quiet square with stone arcade shadows',
    'window seat looking toward red roofs in the distance',
    'corner cafe with brass lamp glow and cool blue street light'
  ],
  signatureObjects: ['brass lamp', 'dark coffee cup', 'wool coat'],
  lighting: 'misty morning or warm lamplight against cool stone shadows',
  palette: 'muted amber, river blue, stone grey, deep brown',
  cameraFeel: '50mm old-city editorial still, restrained contrast, natural bokeh',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: '프라하의 아침 안개와 듣는',
    mainPhrase: '고요한강변',
    bottomBrandLine: 'PRAGUE PLAYLIST',
    bindSeriesTone: true
  },
  subjectPool: [
    'a brass lamp beside a dark coffee cup',
    'a wool coat folded over a wooden chair',
    'a small ceramic cup near a rain-marked window',
    'a plain notebook with no readable writing',
    'a candle holder catching warm light'
  ],
  settingPool: [
    'an old riverside cafe window with soft morning mist',
    'a narrow cobblestone lane after rain with amber lamps',
    'a small quiet square with stone arcade shadows',
    'a window seat looking toward red roofs in the distance',
    'a corner cafe with brass lamp glow and cool street light'
  ],
  compositionPool: [
    'right two-thirds carry the lamp, window, and old street depth; left third remains calm for overlay text',
    'cobblestone perspective leads to the right while the left third stays open and low-detail',
    'warm cafe foreground sits on the lower right with soft blank tone across the left third',
    'window and roofline stay right of center, leaving a clear text-safe column on the left'
  ],
  lightingPool: [
    'misty morning light softened by river air',
    'warm brass lamplight against cool stone shadows',
    'gentle blue-grey daylight with amber interior edge',
    'soft after-rain reflections under restrained contrast'
  ],
  palettePool: [
    'muted amber, river blue, stone grey, and deep brown',
    'warm brass with cool slate and faded red roof tones',
    'soft grey-blue, coffee brown, and candle amber',
    'old stone neutrals with a quiet gold accent'
  ],
  propPool: [
    'a brass lamp',
    'a dark coffee cup',
    'a wool coat',
    'a plain notebook',
    'a candle holder',
    'a wooden chair'
  ],
  cameraPool: [
    '50mm old-city cafe framing with shallow depth of field',
    'eye-level window still with misty background bokeh',
    'slightly low angle across a wooden tabletop',
    'close editorial frame with gentle highlight rolloff'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant back-view silhouette only, face never shown, small and secondary to the old-city scene',
  forbiddenElements: [
    'readable signs or lettering',
    'visible brand labels',
    'front-facing portraits',
    'famous bridge as the centered subject',
    'dramatic gothic horror mood'
  ],
  promptTemplate: 'original Prague old-city cafe scene, misty amber morning atmosphere, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
