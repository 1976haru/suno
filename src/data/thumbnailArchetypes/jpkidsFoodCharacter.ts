import type { ThumbnailArchetype } from './types';
import { KIDS_BRIGHT_TYPOGRAPHY } from './types';

// TASK F1 §7-2 — jp-kids workspace, 2 of 4 new archetypes. Same scoping and
// safety pattern as jpkidsTeasobiHands.ts — see that file's own doc
// comment. "食べ物キャラクター" read literally would mean an actual food
// mascot/character design — deliberately NOT built that way: real/
// simple-illustrated food only, same "no stylized character" rule the
// existing kids-animal-meadow archetype already applies to animals.
export const jpkidsFoodCharacterArchetype: ThumbnailArchetype = {
  id: 'jpkids-food-character',
  category: 'jpkids-food-character',
  suitedArchetypes: ['jp-kids-song'],
  labelKo: '타코야키·음식 장면',
  subjectPool: [
    'a plate of round takoyaki balls with a light drizzle of sauce',
    'a small food stall griddle with takoyaki turning and sizzling',
    'a cheerful bento box with simple colorful food shapes',
    'a bowl of rice balls shaped like simple rounds',
    'a paper tray of festival snacks steaming lightly'
  ],
  settingPool: [
    'a bright festival food-stall counter',
    'a cheerful kitchen counter with warm daylight',
    'a sunny outdoor table set up for a snack',
    'a small food cart with a bright awning',
    'a tidy counter with a checkered paper liner'
  ],
  compositionPool: [
    'simple centered composition with open counter space for text',
    'the food sits low in frame with a large clean area above reserved for later text overlay',
    'a clean close-up shot with soft blurred background framing the food',
    'a simple friendly composition with plenty of open space around the subject'
  ],
  lightingPool: [
    'bright clear daylight',
    'warm cheerful stall lighting',
    'soft golden light with a happy glow',
    'clear bright daylight with vivid natural color'
  ],
  palettePool: [
    'warm golden-brown food tones with cheerful accents',
    'bright red and white festival-stall colors',
    'saturated warm orange and cream tones',
    'warm pastel palette with bright highlights'
  ],
  propPool: ['a takoyaki pick', 'a paper tray', 'a small griddle', 'a checkered liner', 'a light sauce drizzle', 'a festival awning'],
  cameraPool: [
    'close-up shot with bright natural light',
    'slightly high angle looking down at the food',
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
    'visible child faces',
    'named anime title or character reference',
    'visible brand or stall-name logos'
  ],
  promptTemplate: 'original bright kids-friendly festival food scene, simple and cheerful, no characters',
  recommendedTypography: KIDS_BRIGHT_TYPOGRAPHY
};
