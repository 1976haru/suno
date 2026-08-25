import type { ThumbnailArchetype } from './types';
import { KIDS_BRIGHT_TYPOGRAPHY } from './types';

// TASK E1 §7 — kr-kids workspace, 4 of 4 new archetypes. Same scoping and
// safety pattern as krkidsDailyHabitBathroom.ts — see that file's own doc
// comment. "한글·알파벳 병기" (Korean + alphabet lettering side by side) —
// generic decorative letter blocks/cards only, never a readable full word
// that could look like real on-image text (this app's images are prompts,
// not rendered text; forbiddenElements keeps that boundary explicit).
export const krkidsBilingualAlphabetArchetype: ThumbnailArchetype = {
  id: 'krkids-bilingual-alphabet',
  category: 'krkids-bilingual-alphabet',
  suitedArchetypes: ['kr-kids-song'],
  labelKo: '한글·알파벳 병기',
  subjectPool: [
    'colorful alphabet blocks and Hangul blocks mixed together on a table',
    'bright letter cards scattered in a playful arrangement',
    'a wooden letter puzzle with Hangul and alphabet pieces side by side',
    'a row of colorful foam letter tiles',
    'a small chalkboard with a few large friendly letters chalked on'
  ],
  settingPool: [
    'a bright learning corner with a small table',
    'a cheerful rug scattered with letter blocks',
    'a sunny desk set up for early language play',
    'a colorful shelf with letter blocks and cards',
    'a tidy playroom floor with soft natural light'
  ],
  compositionPool: [
    'simple centered composition with open table space for text',
    'the letters sit low in frame with a large clean area above reserved for later text overlay',
    'a clean wide shot with soft blurred background framing the letters',
    'a simple friendly composition with plenty of open space around the subject'
  ],
  lightingPool: [
    'bright clear daylight',
    'warm cheerful window light',
    'soft golden light with a happy glow',
    'clear bright daylight with vivid natural color'
  ],
  palettePool: [
    'bright primary block colors on a light neutral table',
    'cheerful rainbow letter-tile palette',
    'saturated bold colors against soft white',
    'warm sunny yellow and fresh blue accents'
  ],
  propPool: ['an alphabet block', 'a Hangul block', 'a letter card', 'a small chalkboard', 'a foam letter tile', 'a wooden puzzle piece'],
  cameraPool: [
    'eye-level close shot with bright natural light',
    'slightly high angle looking down at the letters',
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
    'a readable full word or sentence spelled out in the scene',
    'visible brand logos on blocks or cards'
  ],
  promptTemplate: 'original bright kids-friendly Hangul and alphabet letter-play scene, simple and cheerful, no characters',
  recommendedTypography: KIDS_BRIGHT_TYPOGRAPHY
};
