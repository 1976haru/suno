import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

// TASK v3.38 Part A — winter variant of the approved reference grammar.
export const winterWindowSnowArchetype: ThumbnailArchetype = {
  id: 'winter-window-snow',
  category: 'winter-window-snow',
  labelKo: '눈 내리는 겨울 창가',
  subjectPool: [
    'a warm mug of tea and a lit candle',
    'a knit blanket folded over a chair',
    'a small pine branch in a glass jar',
    'a pair of wool mittens on the windowsill',
    'a steaming cup beside an open book'
  ],
  settingPool: [
    'a window ledge looking out on softly falling snow',
    'a warm reading corner beside a frosted window',
    'a small table beside a window with snow drifting past',
    'a cozy nook overlooking a snow-covered street',
    'a windowsill with snow gathering quietly outside'
  ],
  compositionPool: [
    'the scene fills the right two-thirds; the left third stays calm and low-detail for a headline, divider, and subtitle',
    'a clean left-third column of soft winter light left empty for text; the subject sits in the right two-thirds',
    'the right two-thirds hold the window and subject; the left third is a quiet gradient reserved for the title block',
    'subject and window anchor the right side; the left third of the frame is deliberately uncluttered for text'
  ],
  lightingPool: [
    'soft grey-blue winter daylight through falling snow',
    'warm indoor lamplight contrasting the cool snowy outside',
    'gentle diffused light with a faint blue winter cast',
    'warm candlelight glow against the cold window light'
  ],
  palettePool: [
    'soft powder blue, white, and warm cream tones',
    'cool slate grey with warm amber lamp accents',
    'muted ice blue and soft ivory tones',
    'deep winter blue with a warm candlelit glow'
  ],
  propPool: [
    'a ceramic teacup',
    'a knit blanket',
    'a lit candle',
    'a small pine branch',
    'a pair of wool mittens',
    'a closed book'
  ],
  cameraPool: [
    'eye-level shot with a 50mm lens feel, soft background blur',
    'straight-on window shot with gentle falling-snow bokeh',
    'slightly low angle with cool window light',
    'close 50mm framing with the snowy window softly blurred'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant figure seen from behind only — face never shown, small and secondary to the scene',
  forbiddenElements: [
    'visible brand labels',
    'readable text on any object',
    'busy cluttered background',
    'bright neon colors',
    'more than 5 distinct objects in frame'
  ],
  promptTemplate: 'original winter window still-life scene with soft falling snow, warm indoor light, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
