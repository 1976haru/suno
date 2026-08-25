import type { ThumbnailArchetype } from './types';
import { KIDS_BRIGHT_TYPOGRAPHY } from './types';

// TASK E1 §7 — kr-kids workspace, 2 of 4 new archetypes. Same scoping and
// safety pattern as krkidsDailyHabitBathroom.ts — see that file's own doc
// comment.
export const krkidsCountingBlocksArchetype: ThumbnailArchetype = {
  id: 'krkids-counting-blocks',
  category: 'krkids-counting-blocks',
  suitedArchetypes: ['kr-kids-song'],
  labelKo: '숫자·도형 블록놀이',
  subjectPool: [
    'colorful number blocks stacked in a small tower',
    'bright shape blocks — circle, triangle, square — arranged in a row',
    'a scattered pile of rainbow-colored counting blocks',
    'wooden number blocks lined up from one to five',
    'colorful shape blocks fitting into a matching sorter'
  ],
  settingPool: [
    'a bright playroom floor with soft natural light',
    'a colorful rug scattered with counting blocks',
    'a sunny table corner set up for block play',
    'a tidy play area with a small basket of blocks nearby',
    'a bright wooden floor with blocks catching soft daylight'
  ],
  compositionPool: [
    'simple centered composition with open floor space for text',
    'the blocks sit low in frame with a large clean area above reserved for later text overlay',
    'a clean wide shot with soft blurred background framing the blocks',
    'a simple friendly composition with plenty of open space around the subject'
  ],
  lightingPool: [
    'bright clear midday light',
    'warm cheerful window light',
    'soft golden daylight with a happy glow',
    'clear bright daylight with vivid natural color'
  ],
  palettePool: [
    'bright primary red, yellow, and blue block colors',
    'cheerful rainbow block palette on a light neutral floor',
    'saturated bold color blocks against soft white',
    'warm sunny yellow and fresh green block accents'
  ],
  propPool: ['a number block', 'a shape block', 'a small basket', 'a soft rug', 'a wooden sorter toy', 'a counting chart'],
  cameraPool: [
    'eye-level close shot with bright natural light',
    'slightly high angle looking down at the blocks',
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
    'visible brand logos on toy packaging'
  ],
  promptTemplate: 'original bright kids-friendly counting and shape blocks scene, simple and cheerful, no characters',
  recommendedTypography: KIDS_BRIGHT_TYPOGRAPHY
};
