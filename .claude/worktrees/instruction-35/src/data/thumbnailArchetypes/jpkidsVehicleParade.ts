import type { ThumbnailArchetype } from './types';
import { KIDS_BRIGHT_TYPOGRAPHY } from './types';

// TASK F1 §7-2 — jp-kids workspace, 3 of 4 new archetypes. Same scoping and
// safety pattern as jpkidsTeasobiHands.ts — see that file's own doc comment.
export const jpkidsVehicleParadeArchetype: ThumbnailArchetype = {
  id: 'jpkids-vehicle-parade',
  category: 'jpkids-vehicle-parade',
  suitedArchetypes: ['jp-kids-song'],
  labelKo: '버스·기차 행렬',
  subjectPool: [
    'a bright toy bus lined up with a toy train on a play rug',
    'a small wooden train set with round friendly-shaped cars',
    'a colorful toy bus parked at a felt bus-stop sign',
    'a row of toy vehicles — bus, train, car — lined up in a row',
    'a simple toy train circling a round track'
  ],
  settingPool: [
    'a bright playroom rug with a simple road pattern',
    'a sunny floor corner set up for vehicle play',
    'a cheerful play table with a toy train track',
    'a tidy shelf display of toy vehicles',
    'a bright wooden floor with soft natural light'
  ],
  compositionPool: [
    'simple centered composition with open floor space for text',
    'the vehicles sit low in frame with a large clean area above reserved for later text overlay',
    'a clean wide shot with soft blurred background framing the vehicles',
    'a simple friendly composition with plenty of open space around the subject'
  ],
  lightingPool: [
    'bright clear midday light',
    'warm cheerful window light',
    'soft golden daylight with a happy glow',
    'clear bright daylight with vivid natural color'
  ],
  palettePool: [
    'bright primary vehicle colors on a light neutral floor',
    'cheerful red and yellow toy-vehicle palette',
    'saturated bold colors against soft white',
    'warm sunny yellow and fresh blue accents'
  ],
  propPool: ['a toy bus', 'a toy train', 'a felt road rug', 'a bus-stop sign', 'a small track piece', 'a toy car'],
  cameraPool: [
    'eye-level close shot with bright natural light',
    'slightly high angle looking down at the vehicles',
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
    'visible brand logos on toy packaging'
  ],
  promptTemplate: 'original bright kids-friendly toy bus and train scene, simple and cheerful, no characters',
  recommendedTypography: KIDS_BRIGHT_TYPOGRAPHY
};
