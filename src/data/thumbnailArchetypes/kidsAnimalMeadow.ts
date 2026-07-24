import type { ThumbnailArchetype } from './types';
import { KIDS_BRIGHT_TYPOGRAPHY } from './types';

// TASK v3.38 Part B5 — kids-channel thumbnail grammar, deliberately
// different from Part A's Korean-serif grammar: bright, simple, high
// saturation. No characters/mascots/faces of any kind (see forbiddenElements
// and peoplePolicy) — real photos or simple illustration only, never a
// stylized character design that could read as an existing IP.
export const kidsAnimalMeadowArchetype: ThumbnailArchetype = {
  id: 'kids-animal-meadow',
  category: 'kids-animal-meadow',
  labelKo: '동물 초원 놀이',
  subjectPool: [
    'a fluffy sheep grazing in a sunny meadow',
    'a friendly rabbit sitting among wildflowers',
    'a small duck family swimming in a pond',
    'a butterfly resting on a bright flower',
    'a gentle pony standing in tall green grass'
  ],
  settingPool: [
    'a sunny green meadow with scattered wildflowers',
    'a bright open field under a clear blue sky',
    'a cheerful farm pasture with a wooden fence',
    'a colorful garden path lined with flowers',
    'a sunny hillside meadow with soft rolling grass'
  ],
  compositionPool: [
    'simple centered composition with generous open sky for text',
    'the subject sits low in frame with a large clean sky area above for a headline',
    'a clean wide shot with soft blurred grass framing the subject',
    'a simple friendly composition with plenty of open space around the subject'
  ],
  lightingPool: [
    'bright clear midday sunlight',
    'warm cheerful morning light',
    'soft golden sunshine with a happy glow',
    'clear bright daylight with vivid natural color'
  ],
  palettePool: [
    'bright grass green, sky blue, and sunny yellow',
    'vivid meadow green with cheerful flower colors',
    'saturated blue sky with bright green grass',
    'warm sunny yellow and fresh spring green'
  ],
  propPool: [
    'a wildflower',
    'a wooden fence',
    'a fluffy cloud',
    'a butterfly',
    'a small pond',
    'a grassy hill'
  ],
  cameraPool: [
    'eye-level wide shot with bright natural light',
    'slightly low angle looking up at a big open sky',
    'straight-on friendly framing, simple and clear',
    'wide shot with soft background blur behind the subject'
  ],
  textSafeZone: ['left-third'],
  // TASK v3.38 Part B5 — real or simple-illustrated animals only, never a
  // stylized mascot/character design, and no visible child faces.
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
  promptTemplate: 'original bright kids-friendly animal meadow scene, simple and cheerful, no characters',
  recommendedTypography: KIDS_BRIGHT_TYPOGRAPHY
};
