import type { ThumbnailArchetype } from './types';
import { KIDS_BRIGHT_TYPOGRAPHY } from './types';

// TASK E1 §7 — kr-kids workspace, 1 of 4 new archetypes. suitedArchetypes is
// set (never left undefined) so this stays invisible to every other channel
// archetype's own thumbnail dropdown, same scoping pattern kr2030/jp2030
// used — see thumbnailArchetypes/index.ts's thumbnailArchetypesForArchetype.
// Same safety grammar as the existing 3 kids-* archetypes: no characters,
// mascots, or visible child faces (see forbiddenElements/peoplePolicy).
export const krkidsDailyHabitBathroomArchetype: ThumbnailArchetype = {
  id: 'krkids-daily-habit-bathroom',
  category: 'krkids-daily-habit-bathroom',
  suitedArchetypes: ['kr-kids-song'],
  labelKo: '양치·손 씻기 욕실',
  subjectPool: [
    'a bright toothbrush and cup standing by a bathroom sink',
    'soap bubbles foaming in cupped hands under running water',
    'a colorful towel hanging beside a small step stool',
    'a rubber duck sitting on the edge of a bright sink',
    'a toothbrush holder with two small colorful toothbrushes'
  ],
  settingPool: [
    'a bright cheerful bathroom sink at child height',
    'a sunny bathroom counter with a small step stool',
    'a clean colorful sink corner with a round mirror',
    'a tidy bathroom shelf with soap and towels',
    'a bright morning bathroom with soft natural light'
  ],
  compositionPool: [
    'simple centered composition with open wall space for text',
    'the subject sits low in frame with a large clean wall area above reserved for later text overlay',
    'a clean wide shot with soft blurred tile framing the subject',
    'a simple friendly composition with plenty of open space around the subject'
  ],
  lightingPool: [
    'bright clear morning light through a bathroom window',
    'warm cheerful daylight',
    'soft clean light with a happy glow',
    'clear bright daylight with vivid natural color'
  ],
  palettePool: [
    'bright bathroom white with cheerful color accents',
    'soft mint and yellow with clean white tile',
    'saturated sky blue and sunny yellow accents',
    'warm pastel palette with bright white fixtures'
  ],
  propPool: ['a toothbrush', 'a small towel', 'a bar of soap', 'a rubber duck', 'a step stool', 'a round mirror'],
  cameraPool: [
    'eye-level close shot with bright natural light',
    'slightly low angle looking up at a bright wall',
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
    'visible brand logos on soap or toothbrush packaging'
  ],
  promptTemplate: 'original bright kids-friendly bathroom routine scene, simple and cheerful, no characters',
  recommendedTypography: KIDS_BRIGHT_TYPOGRAPHY
};
