import type { ThumbnailArchetype } from './types';
import { KIDS_BRIGHT_TYPOGRAPHY } from './types';

// TASK E1 §7 — kr-kids workspace, 3 of 4 new archetypes. Same scoping and
// safety pattern as krkidsDailyHabitBathroom.ts — see that file's own doc
// comment. Covers both roleplay settings the E1 genre spans (market and
// hospital play), never a real medical setting or branded storefront.
export const krkidsRoleplayMarketArchetype: ThumbnailArchetype = {
  id: 'krkids-roleplay-market',
  category: 'krkids-roleplay-market',
  suitedArchetypes: ['kr-kids-song'],
  labelKo: '역할놀이 (마트·병원)',
  subjectPool: [
    'a small toy shopping basket filled with play fruit',
    'a colorful toy cash register on a play counter',
    'a toy doctor kit with a soft stethoscope laid out neatly',
    'a play market stand with felt fruits and vegetables',
    'a small toy medical bag with friendly rounded tools'
  ],
  settingPool: [
    'a bright playroom set up like a tiny market stall',
    'a cheerful corner with a toy shopping cart and play food',
    'a sunny table set up for pretend doctor play',
    'a colorful play market counter with baskets of felt produce',
    'a tidy play area with a toy register and shopping basket'
  ],
  compositionPool: [
    'simple centered composition with open space for text',
    'the subject sits low in frame with a large clean area above reserved for later text overlay',
    'a clean wide shot with soft blurred background framing the subject',
    'a simple friendly composition with plenty of open space around the subject'
  ],
  lightingPool: [
    'bright clear daylight',
    'warm cheerful window light',
    'soft golden light with a happy glow',
    'clear bright daylight with vivid natural color'
  ],
  palettePool: [
    'bright market-stall colors — red, orange, and green produce tones',
    'cheerful pastel play-medical white and soft blue',
    'saturated bold toy colors against a light neutral background',
    'warm sunny palette with fresh green and orange accents'
  ],
  propPool: ['a play basket', 'a toy register', 'a felt fruit', 'a toy stethoscope', 'a small medical bag', 'a play counter'],
  cameraPool: [
    'eye-level close shot with bright natural light',
    'slightly high angle looking down at the play setup',
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
    'real medical equipment or clinical setting',
    'visible store or brand logos'
  ],
  promptTemplate: 'original bright kids-friendly roleplay scene (market or doctor play), simple and cheerful, no characters',
  recommendedTypography: KIDS_BRIGHT_TYPOGRAPHY
};
