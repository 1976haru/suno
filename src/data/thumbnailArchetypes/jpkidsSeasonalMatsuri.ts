import type { ThumbnailArchetype } from './types';
import { KIDS_BRIGHT_TYPOGRAPHY } from './types';

// TASK F1 §7-2 — jp-kids workspace, 4 of 4 new archetypes. Same scoping and
// safety pattern as jpkidsTeasobiHands.ts — see that file's own doc
// comment. Covers both seasonal settings the jpkids-seasonal genre spans
// (summer festival and cherry blossoms), staying daytime-bright throughout
// — unlike C2's jp2030-seasonal (adult, allows evening/night warmth), this
// one never uses the quiet-evening palette that could read as showa-cafe.
export const jpkidsSeasonalMatsuriArchetype: ThumbnailArchetype = {
  id: 'jpkids-seasonal-matsuri',
  category: 'jpkids-seasonal-matsuri',
  suitedArchetypes: ['jp-kids-song'],
  labelKo: '여름축제·벚꽃',
  subjectPool: [
    'a paper fan and a small festival lantern on a bright daytime stall',
    'pink cherry blossom petals drifting over a sunny park path',
    'a row of colorful festival paper lanterns strung under daylight',
    'a small child-sized happi coat laid out with a paper fan',
    'cherry blossom branches framing a bright blue sky'
  ],
  settingPool: [
    'a sunny park path lined with cherry blossom trees',
    'a bright daytime festival street with paper lanterns',
    'a cheerful open park lawn under blossoming trees',
    'a sunny festival stall row in the daytime',
    'a bright park bench under a canopy of pink blossoms'
  ],
  compositionPool: [
    'simple centered composition with open sky space for text',
    'the subject sits low in frame with a large clean area above reserved for later text overlay',
    'a clean wide shot with soft blurred blossoms framing the subject',
    'a simple friendly composition with plenty of open space around the subject'
  ],
  lightingPool: [
    'bright clear daytime sunlight',
    'warm cheerful midday glow',
    'soft golden daylight with a happy sparkle',
    'clear bright daylight with vivid natural color'
  ],
  palettePool: [
    'soft pink blossom tones with bright blue sky',
    'cheerful festival red and gold in bright daylight',
    'saturated warm daytime colors, no evening dimness',
    'warm sunny palette with fresh green accents'
  ],
  propPool: ['a paper fan', 'a festival lantern', 'a cherry blossom branch', 'a happi coat', 'a paper streamer', 'a picnic mat'],
  cameraPool: [
    'eye-level wide shot with bright natural light',
    'slightly low angle looking up through blossom branches',
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
    'evening or nighttime festival lighting',
    'sepia or vintage-toned color grading'
  ],
  promptTemplate: 'original bright kids-friendly daytime festival or cherry-blossom scene, simple and cheerful, no characters',
  recommendedTypography: KIDS_BRIGHT_TYPOGRAPHY
};
