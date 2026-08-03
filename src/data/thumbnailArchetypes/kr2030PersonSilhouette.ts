import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

// TASK B2 — kr-2030 workspace, 3 of 3 new archetypes.
export const kr2030PersonSilhouetteArchetype: ThumbnailArchetype = {
  id: 'kr2030-person-silhouette',
  category: 'kr2030-person-silhouette',
  suitedArchetypes: ['kr-2030-pop'],
  sceneCore: [
    'a distant figure standing on a subway platform, seen from behind, earbuds in',
    'a lone silhouette waiting at a crosswalk under mixed evening light',
    'a figure seen from behind walking down a quiet platform corridor',
    'a distant commuter silhouette framed by a train window',
    'a lone figure standing at a station edge, city lights soft behind them'
  ],
  signatureObjects: ['earbud silhouette', 'platform edge line', 'soft city bokeh'],
  lighting: 'soft directional platform or station light with gentle bokeh behind the figure',
  palette: 'cool platform grey, warm distant light bokeh, muted evening blue',
  cameraFeel: 'wide station perspective, figure small and distant, text-safe left third',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: 'JUST FOR TODAY',
    mainPhrase: 'STILL WALKING',
    bottomBrandLine: 'KR 2030 EMOTIONAL PLAYLIST',
    bindSeriesTone: true
  },
  labelKo: 'Distant Platform Silhouette',
  subjectPool: [
    'a distant figure seen only from behind, face never visible',
    'an earbud wire silhouette against soft light',
    'a platform edge line leading into the distance',
    'a train window frame with a small distant figure inside',
    'a station clock or sign shape kept unreadable'
  ],
  settingPool: [
    'a quiet subway platform with soft directional light',
    'a crosswalk at evening with mixed streetlight and sign bokeh',
    'a station corridor stretching into soft distant blur',
    'a train interior window view with city lights sliding past',
    'a station edge overlooking soft out-of-focus city glow'
  ],
  compositionPool: [
    'the platform scene fills the right two-thirds; the left third stays soft and dim for later text overlay',
    'a clean left-third column of quiet shadow is reserved for text while the distant figure sits right',
    'the figure and platform light anchor the right side; the left third remains open for the title block',
    'the left third is simple negative space; the right side carries depth toward the distant figure'
  ],
  lightingPool: [
    'soft overhead platform light with gentle bokeh',
    'cool evening blue with warm distant sign glow',
    'soft directional station lighting, no harsh shadow',
    'gentle backlight silhouetting the distant figure'
  ],
  palettePool: [
    'cool platform grey with warm distant bokeh highlights',
    'muted evening blue and soft amber station light',
    'quiet desaturated commuter palette, no neon saturation',
    'soft grey-blue with a single warm light source'
  ],
  propPool: ['earbud wire', 'platform edge line', 'soft bokeh lights', 'train window frame', 'unreadable station sign shape', 'distant silhouette'],
  cameraPool: [
    'wide station perspective with the figure small and distant',
    'low platform-level angle with soft depth blur',
    '85mm compression shot keeping the figure distant and anonymous',
    'train-window framing with city light streaks'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'exactly one distant silhouette, always seen from behind or in deep shadow; face never shown, figure kept small and secondary to the scene',
  forbiddenElements: [
    'any visible face or facial feature',
    'readable station names or signage text',
    'visible brand logos',
    'artist likeness or poster',
    'multiple clearly-distinguishable people'
  ],
  promptTemplate: 'original modern commuter-platform thumbnail background, one small distant silhouette seen from behind, left third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
