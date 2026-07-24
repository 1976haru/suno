import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

// TASK v3.38 Part A — night-city variant of the approved reference grammar.
export const nightCityWarmArchetype: ThumbnailArchetype = {
  id: 'night-city-warm',
  category: 'night-city-warm',
  labelKo: '밤 도시 창가 온기',
  subjectPool: [
    'a warm mug of cocoa beside a small lamp',
    'a soft blanket folded over a chair',
    'a single candle beside a stack of records',
    'a pair of reading glasses beside an open book',
    'a small potted plant silhouetted against the night'
  ],
  settingPool: [
    'a window ledge overlooking a glowing night skyline',
    'a warm reading corner beside a city-lit window',
    'a small table beside a window with distant lights beyond',
    'a cozy nook overlooking a quiet night street',
    'a windowsill with warm indoor light against the cool city night'
  ],
  compositionPool: [
    'the scene fills the right two-thirds; the left third stays calm and low-detail for a headline, divider, and subtitle',
    'a clean left-third column of soft warm light left empty for text; the subject sits in the right two-thirds',
    'the right two-thirds hold the window and subject; the left third is a quiet gradient reserved for the title block',
    'subject and window anchor the right side; the left third of the frame is deliberately uncluttered for text'
  ],
  lightingPool: [
    'warm indoor lamplight against the cool blue night outside',
    'soft golden lamp glow with distant city lights beyond',
    'gentle warm candlelight contrasting the night skyline',
    'cozy warm light with faint city glow through the glass'
  ],
  palettePool: [
    'warm amber indoors with deep navy night tones',
    'soft gold lamp light against cool midnight blue',
    'warm caramel and deep indigo tones',
    'muted warm orange with cool slate-blue night accents'
  ],
  propPool: [
    'a warm mug',
    'a soft blanket',
    'a lit candle',
    'a stack of records',
    'a pair of reading glasses',
    'a small potted plant'
  ],
  cameraPool: [
    'eye-level shot with a 50mm lens feel, soft background blur',
    'straight-on window shot with soft distant-light bokeh',
    'slightly low angle with warm indoor light',
    'close 50mm framing with the night skyline softly blurred'
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
  promptTemplate: 'original night-city window still-life scene, warm indoor light against a cool night skyline, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
