import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

/**
 * TASK K2 §8-2 — kr-idol-male workspace, 3 of 3 new archetypes. "모노톤
 * 인물 클로즈업" (§8-2's own label) reads like it wants a close-up face, but
 * §8-2's very next line is explicit: "실루엣·후면·부분 구도를 기본으로
 * 하십시오" — resolved by keeping the close-up on a PARTIAL, unidentifiable
 * feature (jawline in hard shadow, a hand against fabric, the back of a
 * neck) rather than a full recognizable face, same as the other two kridol
 * archetypes' own peoplePolicy.
 */
export const kridolMonoPortraitArchetype: ThumbnailArchetype = {
  id: 'kridol-mono-portrait',
  category: 'kridol-mono-portrait',
  suitedArchetypes: ['kr-idol-male'],
  sceneCore: [
    'a monochrome close-up on a jawline and shoulder in hard directional shadow, eyes out of frame',
    'a high-contrast black-and-white close-up of a hand resting against dark fabric',
    'a monochrome close-up on the back of a neck and collar, lit from one side',
    'a grainy black-and-white close-up on clasped hands under a single hard light',
    'a monochrome profile silhouette cropped tight at the jaw, upper face out of frame'
  ],
  signatureObjects: ['hard rim light edge', 'film-grain texture', 'deep black shadow block'],
  lighting: 'single hard directional light source, deep black shadow fill, strong rim highlight on the edge',
  palette: 'true monochrome black-and-white, occasional single muted duotone wash',
  cameraFeel: 'tight macro-leaning crop, shallow depth of field, generous text-safe negative space',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: 'CLOSER',
    mainPhrase: 'IN BLACK AND WHITE',
    bottomBrandLine: 'KR IDOL MONO SERIES',
    bindSeriesTone: true
  },
  labelKo: 'Monochrome Partial Portrait',
  subjectPool: [
    'a jawline and shoulder cropped tight, eyes and upper face out of frame',
    'a single hand resting against dark fabric, lit from one side',
    'the back of a neck and collar under hard directional light',
    'clasped hands under a single hard spotlight',
    'a cropped profile silhouette at the jaw only, rest of the face unseen'
  ],
  settingPool: [
    'a plain dark studio backdrop with one hard light source',
    'a close, shallow-focus setting with heavy black shadow fill',
    'a minimal textured wall lit from a single hard angle',
    'a dark fabric backdrop with strong rim lighting',
    'a bare concrete corner lit only by one hard side light'
  ],
  compositionPool: [
    'the partial figure sits off-center in the lower half; the upper half stays deep black for text overlay',
    'a clean side band of pure black negative space is reserved for text beside the lit partial figure',
    'the lit feature anchors one corner; the rest of the frame stays in deep shadow for the title block',
    'a tight center crop with wide black borders on both sides for text'
  ],
  lightingPool: [
    'single hard side light with a sharp shadow edge',
    'strong rim light against a fully black background',
    'grainy low-key lighting, most of the frame in shadow',
    'one soft top light with heavy vignette falloff'
  ],
  palettePool: [
    'true black-and-white, no color cast',
    'muted single-tone duotone (deep grey/black)',
    'high-contrast black-and-white with crushed shadows',
    'soft grey monochrome with a single bright highlight'
  ],
  propPool: ['film-grain texture', 'hard shadow edge', 'dark fabric fold', 'rim-light highlight', 'shallow-focus blur'],
  cameraPool: [
    'tight macro-leaning crop with shallow depth of field',
    'close 85mm-style portrait crop, partial feature only',
    'low-angle close crop emphasizing the shadow edge',
    'symmetrical tight crop with wide negative-space borders'
  ],
  textSafeZone: ['left-third'],
  // TASK K2 §9-1 — same reasoning as the other two kridol archetypes: this
  // is the highest-resemblance-risk of the three by name alone ("인물
  // 클로즈업"), so the policy is written even more conservatively — no full
  // face at any crop distance, ever, ONLY a partial, unidentifiable feature.
  peoplePolicy: 'a partial, unidentifiable feature only (jawline in shadow, a hand, the back of a neck) — face must never be shown, no crop or angle ever reveals eyes, nose, and mouth together',
  forbiddenElements: [
    'any visible face or facial feature (eyes, nose, mouth together)',
    'named idol group logo or fandom symbol',
    'artist likeness, lookalike styling, or poster',
    'readable text, tattoos, or identifying marks',
    'multiple clearly-distinguishable people'
  ],
  promptTemplate: 'original monochrome close-up thumbnail background, one partial unidentifiable feature under hard directional light, generous negative space reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
