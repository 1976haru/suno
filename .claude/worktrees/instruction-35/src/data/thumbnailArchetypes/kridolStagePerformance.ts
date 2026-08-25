import type { ThumbnailArchetype } from './types';
import { KOREAN_SERIF_TYPOGRAPHY } from './types';

// TASK K2 §8-2 — kr-idol-male workspace, 1 of 3 new archetypes.
export const kridolStagePerformanceArchetype: ThumbnailArchetype = {
  id: 'kridol-stage-performance',
  category: 'kridol-stage-performance',
  suitedArchetypes: ['kr-idol-male'],
  sceneCore: [
    'a lone silhouette mid-motion on a spotlit stage, backlit by a wall of concert lights',
    'a distant figure frozen in a dance pose against sweeping stage beams',
    'a silhouette caught in a haze of stage smoke and colored spotlights',
    'a figure seen from behind, arm raised toward a wall of crowd lights',
    'a small silhouette centered in a huge empty spotlight circle on an otherwise dark stage'
  ],
  signatureObjects: ['spotlight beam', 'stage smoke haze', 'crowd light bokeh'],
  lighting: 'hard spotlight beams cutting through haze, strong backlight silhouetting the figure',
  palette: 'deep stage black, saturated spotlight color (blue/magenta/amber), bright rim light',
  cameraFeel: 'wide stage perspective, figure small against the light wall, text-safe lower third',
  negatives: ['inherits shared textless/no-face negative block'],
  placeSeries: {
    topSubcaption: 'TONIGHT',
    mainPhrase: 'ON STAGE',
    bottomBrandLine: 'KR IDOL PERFORMANCE',
    bindSeriesTone: true
  },
  labelKo: 'Stage Spotlight Silhouette',
  subjectPool: [
    'a single silhouette mid-dance-move, face never visible',
    'a raised-arm silhouette against a spotlight burst',
    'a distant figure kneeling at the edge of a spotlight circle',
    'a backlit figure walking toward the front of the stage',
    'a silhouette frozen mid-jump against stage haze'
  ],
  settingPool: [
    'a dark stage cut through with hard spotlight beams',
    'a smoke-hazed stage lit by sweeping colored lights',
    'an empty arena stage with one bright spotlight circle',
    'a stage edge overlooking a soft blur of distant crowd lights',
    'a backstage-to-stage threshold with light spilling in from one side'
  ],
  compositionPool: [
    'the stage scene fills the upper two-thirds; the lower third stays dark and simple for text overlay',
    'a clean lower-third band of stage-floor shadow is reserved for text while the lit figure stands above',
    'the silhouette anchors the center; both the top and bottom thirds stay dim for title placement',
    'the spotlight beam sweeps from upper-left to the figure; the lower-right stays open for a brand line'
  ],
  lightingPool: [
    'hard spotlight beam with visible haze streaks',
    'saturated magenta-and-blue stage wash',
    'strong backlight rim silhouetting the figure completely',
    'warm amber spotlight circle against a black stage'
  ],
  palettePool: [
    'deep black stage with a single saturated spotlight color',
    'cool blue stage wash with warm rim highlight',
    'magenta-and-amber concert palette, no pastel softness',
    'high-contrast black-and-light stage palette'
  ],
  propPool: ['spotlight beam', 'stage haze', 'crowd light bokeh', 'stage-floor reflection', 'rising smoke wisp', 'light rig silhouette overhead'],
  cameraPool: [
    'wide stage shot with the figure small against the light wall',
    'low upward angle emphasizing the spotlight beam',
    '85mm compression shot keeping the figure distant and anonymous',
    'wide symmetrical stage framing with the figure dead-center'
  ],
  textSafeZone: ['left-third'],
  // TASK K2 §9-1 — idol resemblance risk is structural/visual, not just
  // name-based (K1 §12's own "실존 그룹 모방" warning); silhouette/rear-view/
  // partial framing is the baseline for every kridol thumbnail, never an
  // identifiable face.
  peoplePolicy: 'exactly one distant silhouette, always backlit or seen from behind; face must never be shown, features stay unreadable in the spotlight glare or haze',
  forbiddenElements: [
    'any visible face or facial feature',
    'named idol group logo, fandom symbol, or lightstick shape',
    'readable stage backdrop text or venue signage',
    'artist likeness or poster',
    'multiple clearly-distinguishable people'
  ],
  promptTemplate: 'original concert-stage thumbnail background, one small backlit silhouette against spotlight beams and haze, lower third reserved for text',
  recommendedTypography: KOREAN_SERIF_TYPOGRAPHY
};
