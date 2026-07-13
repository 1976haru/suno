import type { ThumbnailArchetype } from './types';

export const refinedCafeArchetype: ThumbnailArchetype = {
  id: 'refined-cafe',
  category: 'refined-cafe',
  labelKo: '정제된 카페',
  subjectPool: [
    'ceramic cup and steam beside a small dessert plate',
    'warm drink still life on a polished wooden table',
    'open notebook near a quiet window seat',
    'single flower vase beside folded linen',
    'empty cafe chair with a cup placed off center',
    'small breakfast tray with tea and fruit'
  ],
  settingPool: [
    'quiet neighborhood cafe interior with uncluttered tables',
    'window-side cafe nook with soft curtains',
    'old-fashioned tea room corner with warm wood',
    'minimal counter area with shelves kept softly out of focus',
    'small terrace table just inside a glass door',
    'calm home-cafe table near a morning window'
  ],
  compositionPool: [
    'object cluster on one lower third with broad open space',
    'diagonal tabletop line leading toward the empty title area',
    'single main object framed by negative space',
    'foreground cup sharp, background seating softly blurred',
    'balanced still life with a clean upper title field',
    'layered table edge and window frame without visual clutter'
  ],
  lightingPool: [
    'soft morning side light with gentle steam highlights',
    'warm amber lamp mixed with pale daylight',
    'diffused window glow with low contrast shadows',
    'late afternoon light grazing the tabletop',
    'rainy window light with a comfortable indoor glow',
    'quiet golden-hour reflection on glass and wood'
  ],
  palettePool: [
    'ivory, walnut brown, muted brass, deep green accents',
    'warm cream, espresso brown, soft gray, pale gold',
    'linen white, roasted coffee, olive, faded peach',
    'mild beige, dark wood, porcelain white, moss green',
    'smoky teal, warm tan, brass, soft black',
    'oat milk, cocoa, sage, candle amber'
  ],
  propPool: [
    'ceramic cup',
    'linen napkin',
    'small vase',
    'paper calendar',
    'plain notebook',
    'wooden tray',
    'generic radio',
    'vinyl record sleeve with no visible text'
  ],
  cameraPool: [
    'eye-level 50mm still-life framing',
    'slightly high three-quarter tabletop view',
    'low side angle across the table edge',
    'gentle telephoto compression from across the room',
    'close object framing without face or label detail',
    'wide cafe corner view with shallow depth of field'
  ],
  textSafeZone: ['left', 'right', 'top'],
  peoplePolicy: 'Prefer no people; a distant, unidentifiable silhouette may appear only as background atmosphere.',
  forbiddenElements: [
    'visible brand labels',
    'readable menu text',
    'creator-style imitation',
    'recognizable face',
    'logo or watermark',
    'copied cafe layout'
  ],
  promptTemplate: 'original 16:9 cafe thumbnail using abstracted still-life traits'
};
