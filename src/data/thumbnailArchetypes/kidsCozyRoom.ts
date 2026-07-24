import type { ThumbnailArchetype } from './types';
import { KIDS_BRIGHT_TYPOGRAPHY } from './types';

// TASK v3.38 Part B5 — kids-channel thumbnail grammar (see kidsAnimalMeadow
// for the shared no-character/no-face policy).
export const kidsCozyRoomArchetype: ThumbnailArchetype = {
  id: 'kids-cozy-room',
  category: 'kids-cozy-room',
  labelKo: '아늑한 놀이방',
  subjectPool: [
    'a stack of colorful building blocks',
    'a row of stuffed animal toys on a shelf',
    'a bright picture book open on a rug',
    'a set of crayons and a coloring page',
    'a toy train set on a colorful play mat'
  ],
  settingPool: [
    'a bright playroom with colorful rugs and toys',
    'a cheerful kids bedroom with soft daylight',
    'a sunny corner filled with toys and picture books',
    'a colorful nursery with playful decorations',
    'a bright reading nook with cushions and toys'
  ],
  compositionPool: [
    'simple centered composition with generous open wall space for text',
    'the subject sits low in frame with a large clean wall area above for a headline',
    'a clean wide shot with soft blurred toys framing the subject',
    'a simple friendly composition with plenty of open space around the subject'
  ],
  lightingPool: [
    'bright warm daylight through a nursery window',
    'soft cheerful indoor light',
    'warm golden afternoon light',
    'clear bright daylight with vivid natural color'
  ],
  palettePool: [
    'bright primary red, yellow, and sky blue',
    'cheerful pastel rainbow colors',
    'warm sunny yellow with fresh mint green',
    'bright playful orange and soft sky blue'
  ],
  propPool: [
    'a building block',
    'a stuffed animal toy',
    'a picture book',
    'a crayon',
    'a toy train',
    'a soft cushion'
  ],
  cameraPool: [
    'eye-level wide shot with bright natural light',
    'slightly high angle looking down at the play area',
    'straight-on friendly framing, simple and clear',
    'wide shot with soft background blur behind the subject'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people; if a child appears at all, only a small distant back-view silhouette — a real child\'s face must never be shown',
  forbiddenElements: [
    'cartoon characters',
    'mascot characters',
    'anime style',
    'Pinkfong-style character',
    'Cocomelon-style character',
    'Disney-style character',
    'branded character',
    'copyrighted character',
    'visible child faces'
  ],
  promptTemplate: 'original bright kids-friendly playroom scene, simple and cheerful, no characters',
  recommendedTypography: KIDS_BRIGHT_TYPOGRAPHY
};
