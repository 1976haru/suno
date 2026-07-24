import type { ThumbnailArchetype } from './types';
import { KIDS_BRIGHT_TYPOGRAPHY } from './types';

// TASK v3.38 Part B5 — kids-channel thumbnail grammar (see kidsAnimalMeadow
// for the shared no-character/no-face policy).
export const kidsPlaygroundSkyArchetype: ThumbnailArchetype = {
  id: 'kids-playground-sky',
  category: 'kids-playground-sky',
  labelKo: '놀이터 하늘 놀이',
  subjectPool: [
    'a bright red swing set against a blue sky',
    'a colorful slide in a sunny playground',
    'a cluster of balloons floating in a clear sky',
    'a bright kite flying high above a park',
    'a cheerful merry-go-round in a sunny park'
  ],
  settingPool: [
    'a sunny playground with a clear blue sky above',
    'a bright park with colorful play equipment',
    'an open field under a wide cheerful sky',
    'a cheerful neighborhood playground on a sunny day',
    'a colorful park corner with soft clouds overhead'
  ],
  compositionPool: [
    'simple centered composition with generous open sky for text',
    'the subject sits low in frame with a large clean sky area above for a headline',
    'a clean wide shot with soft blurred trees framing the subject',
    'a simple friendly composition with plenty of open space around the subject'
  ],
  lightingPool: [
    'bright clear midday sunlight',
    'warm cheerful afternoon light',
    'soft golden sunshine with a happy glow',
    'clear bright daylight with vivid natural color'
  ],
  palettePool: [
    'bright primary red, yellow, and sky blue',
    'cheerful rainbow colors against a clear sky',
    'vivid sky blue with warm sunny yellow',
    'bright playful orange and fresh green'
  ],
  propPool: [
    'a bright balloon',
    'a colorful kite',
    'a soft cloud',
    'a wooden bench',
    'a small flower bed',
    'a park tree'
  ],
  cameraPool: [
    'eye-level wide shot with bright natural light',
    'slightly low angle looking up at a big open sky',
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
  promptTemplate: 'original bright kids-friendly playground scene under an open sky, simple and cheerful, no characters',
  recommendedTypography: KIDS_BRIGHT_TYPOGRAPHY
};
