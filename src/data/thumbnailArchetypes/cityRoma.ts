import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

export const cityRomaArchetype: ThumbnailArchetype = {
  id: 'city-roma',
  category: 'city-roma',
  labelKo: 'Roma city series',
  sceneCore: [
    'sunlit cafe terrace on a quiet stone side street',
    'narrow ochre alley with linen shade and morning light',
    'small old plaza after rain with warm pavement reflection',
    'open apartment window above a modest corner cafe',
    'slow street corner with marble tabletop and distant bells'
  ],
  signatureObjects: ['espresso cup', 'folded linen jacket', 'small paper map'],
  lighting: 'clear morning sun, honey highlights, soft shaded edges',
  palette: 'travertine cream, muted terracotta, olive green, espresso brown',
  cameraFeel: '50mm street-cafe still, close but not portrait-like, natural film grain',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: '로마의 햇살과 함께 듣는',
    mainPhrase: '로마의아침',
    bottomBrandLine: 'ROMA PLAYLIST',
    bindSeriesTone: true
  },
  subjectPool: [
    'an espresso cup on a small marble table',
    'a folded linen jacket on a terrace chair',
    'a small paper map weighted by a plain spoon',
    'a ceramic sugar bowl beside a shaded saucer',
    'a simple glass of water catching morning sun'
  ],
  settingPool: [
    'a sunlit cafe terrace on a quiet stone side street',
    'a narrow ochre alley with linen shade and warm air',
    'a small old plaza after rain with no visible signage',
    'an open apartment window above a modest corner cafe',
    'a slow street corner with stone walls and potted herbs'
  ],
  compositionPool: [
    'right two-thirds carry the terrace scene; left third stays quiet for overlay text',
    'foreground table detail sits low and right; left third remains open and softly lit',
    'street depth leads toward the right side while the left third stays calm and low-detail',
    'window and cafe details frame the right side, with clear breathing room on the left third'
  ],
  lightingPool: [
    'clear morning sun with honey highlights',
    'soft shade under a terrace awning',
    'gentle reflected light from pale stone walls',
    'warm late-morning brightness with mild contrast'
  ],
  palettePool: [
    'travertine cream with muted terracotta and olive green',
    'warm plaster tones with espresso brown shadows',
    'soft sand, clay red, and quiet green accents',
    'pale stone with warm coffee and linen neutrals'
  ],
  propPool: [
    'an espresso cup',
    'a folded linen jacket',
    'a small paper map',
    'a plain spoon',
    'a ceramic sugar bowl',
    'a glass of water'
  ],
  cameraPool: [
    '50mm street-cafe framing with shallow depth of field',
    'eye-level terrace still with natural bokeh',
    'slightly low table-level view with soft background falloff',
    'close editorial frame with no visible face or readable sign'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'no people, or a single distant back-view silhouette only, face never shown, small and secondary to the city scene',
  forbiddenElements: [
    'readable signs or menu text',
    'visible brand labels',
    'front-facing tourists',
    'recognizable landmarks as the main subject',
    'busy souvenir clutter'
  ],
  promptTemplate: 'original Roma cafe terrace city scene, elegant warm morning light, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
