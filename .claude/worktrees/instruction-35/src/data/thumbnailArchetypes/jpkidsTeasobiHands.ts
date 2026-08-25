import type { ThumbnailArchetype } from './types';
import { KIDS_BRIGHT_TYPOGRAPHY } from './types';

// TASK F1 §7-2 — jp-kids workspace, 1 of 4 new archetypes. suitedArchetypes
// is set (never left undefined) so this stays invisible to every other
// channel archetype's own thumbnail dropdown, same scoping pattern
// krkids* used — see thumbnailArchetypes/index.ts's thumbnailArchetypesForArchetype.
// Same safety grammar as the existing kids-*/krkids-* archetypes: no
// characters, mascots, or visible child faces, PLUS §7-2's own addendum —
// no anime-style art that could read as an existing IP.
export const jpkidsTeasobiHandsArchetype: ThumbnailArchetype = {
  id: 'jpkids-teasobi-hands',
  category: 'jpkids-teasobi-hands',
  suitedArchetypes: ['jp-kids-song'],
  labelKo: '손동작 클로즈업',
  subjectPool: [
    'two small hands mid-clap, fingers spread in a playful gesture',
    'a close-up of fingers wiggling one by one in a hand-play rhyme',
    'two hands cupped together as if catching something small',
    'small hands making a simple shadow-puppet shape',
    'fingers tapping lightly on a tabletop in a rhythm pattern'
  ],
  settingPool: [
    'a bright tatami-mat floor corner with soft natural light',
    'a sunny low table set up for hand-play games',
    'a cheerful playroom corner with a soft round cushion',
    'a bright wooden floor with warm afternoon light',
    'a tidy play corner with a small folded blanket nearby'
  ],
  compositionPool: [
    'simple centered composition with open floor space for text',
    'the hands sit low in frame with a large clean area above reserved for later text overlay',
    'a clean close-up shot with soft blurred background framing the hands',
    'a simple friendly composition with plenty of open space around the subject'
  ],
  lightingPool: [
    'bright clear midday light',
    'warm cheerful window light',
    'soft golden daylight with a happy glow',
    'clear bright daylight with vivid natural color'
  ],
  palettePool: [
    'bright warm wood tones with cheerful color accents',
    'soft cream and coral with clean natural light',
    'saturated sky blue and sunny yellow accents',
    'warm pastel palette with bright white highlights'
  ],
  propPool: ['a soft cushion', 'a folded blanket', 'a tatami mat edge', 'a small wooden table', 'a paper fan', 'a round rug'],
  cameraPool: [
    'close-up shot with bright natural light',
    'slightly high angle looking down at the hands',
    'straight-on friendly framing, simple and clear',
    'wide shot with soft background blur behind the subject'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people; hands only — a real child\'s face must never be shown, and no other body parts appear',
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
    'named anime title or character reference'
  ],
  promptTemplate: 'original bright kids-friendly hand-play close-up scene, simple and cheerful, no characters',
  recommendedTypography: KIDS_BRIGHT_TYPOGRAPHY
};
