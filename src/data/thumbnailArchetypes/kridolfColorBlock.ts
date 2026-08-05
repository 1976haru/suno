import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

/**
 * TASK K3 §6-3 — kr-idol-female workspace, 3 of 3 new archetypes. Graphic/
 * color-block-forward rather than photographic — the furthest departure
 * from K2's own 3 (all photographic silhouette scenes), giving the female
 * workspace a distinct visual system rather than just a recolored version
 * of the same composition grammar.
 */
export const kridolfColorBlockArchetype: ThumbnailArchetype = {
  id: 'kridolf-color-block',
  category: 'kridolf-color-block',
  suitedArchetypes: ['kr-idol-female'],
  sceneCore: [
    'bold overlapping color-block shapes with one small distant silhouette cut into a corner block',
    'a grid of saturated color panels, one panel holding a small backlit figure in silhouette',
    'large flat color shapes in a dynamic diagonal arrangement, a tiny distant silhouette at the edge',
    'a color-blocked poster-style layout with one abstracted figure shape in negative space',
    'overlapping circular and rectangular color fields with a small silhouette centered in one field'
  ],
  signatureObjects: ['flat color panel', 'graphic shape edge', 'small silhouette cutout'],
  lighting: 'flat even graphic lighting, no realistic shadow falloff, poster-style clarity',
  palette: 'bold saturated multi-color blocking, high contrast, graphic and clean',
  cameraFeel: 'flat graphic composition, figure small and abstracted, generous text-safe space',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: 'BOLD AND BRIGHT',
    mainPhrase: 'COLOR ON COLOR',
    bottomBrandLine: 'KR IDOL COLOR BLOCK',
    bindSeriesTone: true
  },
  labelKo: 'Color Block Graphic',
  subjectPool: [
    'a small distant silhouette cut into one corner of a color panel',
    'a tiny backlit figure abstracted within a graphic shape',
    'a small silhouette centered in one circular color field',
    'a distant figure shape rendered as flat negative space against color',
    'a small silhouette at the edge of a diagonal color arrangement'
  ],
  settingPool: [
    'a poster-style grid of saturated color panels',
    'overlapping flat color shapes in dynamic arrangement',
    'a bold diagonal color-block layout',
    'a graphic field of circular and rectangular color panels',
    'a flat color backdrop with sharp geometric divisions'
  ],
  compositionPool: [
    'large flat color panels fill most of the frame; one clean panel is reserved as solid color for text',
    'a bold diagonal color division splits the frame, with a plain panel held open for text',
    'the small silhouette sits in one corner block; the opposite corner stays a clean color panel for the title',
    'overlapping color shapes surround a plain central band reserved for text'
  ],
  lightingPool: [
    'flat even graphic lighting, no realistic falloff',
    'poster-flat color fields, no gradient',
    'bold high-contrast color blocking',
    'clean flat backlight silhouetting the small figure only'
  ],
  palettePool: [
    'bold saturated multi-color blocking, high contrast',
    'two-tone graphic color scheme with one accent',
    'bright poster-style primary and pastel mix',
    'clean flat color fields, no photographic texture'
  ],
  propPool: ['flat color panel', 'graphic shape edge', 'diagonal color division', 'geometric panel grid', 'small silhouette cutout'],
  cameraPool: [
    'flat graphic composition, no depth perspective',
    'poster-style symmetrical layout',
    'diagonal dynamic color-block arrangement',
    'centered grid composition with the figure small in one cell'
  ],
  textSafeZone: ['left-third'],
  peoplePolicy: 'at most one small, heavily abstracted silhouette rendered as flat negative space or backlit shape; face must never be shown or implied, no realistic body proportion detail beyond a simple adult silhouette',
  forbiddenElements: [
    'any visible face or facial feature',
    'school uniform or any youth-coded clothing silhouette',
    'readable text or logos within the graphic panels',
    'photographic realism (this archetype is graphic/flat by design)',
    'artist likeness or poster',
    'multiple clearly-distinguishable people'
  ],
  promptTemplate: 'original bold color-block graphic thumbnail background, one small abstracted silhouette within flat saturated color panels, one panel reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
