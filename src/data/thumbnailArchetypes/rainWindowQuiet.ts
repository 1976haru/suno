import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

// TASK v3.38 Part A — rainy variant of the approved reference grammar.
export const rainWindowQuietArchetype: ThumbnailArchetype = {
  id: 'rain-window-quiet',
  category: 'rain-window-quiet',
  labelKo: '빗방울 조용한 창가',
  subjectPool: [
    'a warm cup of tea beside a closed umbrella',
    'a small potted plant on the rainy windowsill',
    'a soft cardigan draped over a chair',
    'a stack of books beside a reading lamp',
    'a single candle beside a fogged window'
  ],
  settingPool: [
    'a window ledge with raindrops tracing down the glass',
    'a quiet reading corner beside a rain-streaked window',
    'a small table beside a window overlooking wet green streets',
    'a cozy nook with soft grey rain light outside',
    'a windowsill with gentle rain and blurred greenery beyond'
  ],
  compositionPool: [
    'the scene fills the right two-thirds; the left third stays calm and low-detail for a headline, divider, and subtitle',
    'a clean left-third column of soft grey light left empty for text; the subject sits in the right two-thirds',
    'the right two-thirds hold the window and subject; the left third is a quiet gradient reserved for the title block',
    'subject and window anchor the right side; the left third of the frame is deliberately uncluttered for text'
  ],
  lightingPool: [
    'soft overcast grey daylight through rain-streaked glass',
    'muted daylight diffused by rain clouds',
    'gentle grey-green ambient light with a warm indoor lamp',
    'cool soft light filtering through wet glass'
  ],
  palettePool: [
    'green-grey and muted teal tones',
    'cool grey with soft moss green accents',
    'desaturated blue-green rainy palette with warm lamp light',
    'muted slate and sage tones'
  ],
  propPool: [
    'a ceramic teacup',
    'a closed umbrella',
    'a small potted plant',
    'a soft cardigan',
    'a stack of books',
    'a single candle'
  ],
  cameraPool: [
    'eye-level shot with a 50mm lens feel, soft background blur',
    'straight-on window shot with gentle raindrop bokeh',
    'slightly low angle with soft grey light',
    'close 50mm framing with the rainy window softly blurred'
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
  promptTemplate: 'original rainy window still-life scene, muted green-grey tones, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
