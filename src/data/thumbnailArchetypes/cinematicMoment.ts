import type { ThumbnailArchetype } from './types';

export const cinematicMomentArchetype: ThumbnailArchetype = {
  id: 'cinematic-human-moment',
  category: 'cinematic-human-moment',
  labelKo: '시네마틱 휴먼 모먼트',
  subjectPool: [
    'distant person-shaped silhouette at the edge of a rainy street',
    'small figure near a window with face fully obscured',
    'empty bench with a coat and soft backlight',
    'wide corridor with one tiny silhouette at the far end',
    'train platform edge with an anonymous figure in the distance',
    'street corner after rain with human presence implied by objects'
  ],
  settingPool: [
    'quiet urban street after rain',
    'wide station platform with soft practical lights',
    'building hallway with deep perspective',
    'window-lit room looking toward the city',
    'empty roadside bus stop at dusk',
    'small plaza under evening streetlights'
  ],
  compositionPool: [
    'wide negative-space frame with the figure under 20 percent of image height',
    'strong leading lines toward a small distant subject',
    'large open wall or sky area reserved for title',
    'foreground object anchors the frame while the person stays distant',
    'backlit silhouette placed on a lower third',
    'environment dominates the frame with the human element kept minimal'
  ],
  lightingPool: [
    'soft backlight through mist or rain',
    'blue-hour city light with warm window accents',
    'low sun flare softened by haze',
    'practical lamps reflecting on wet ground',
    'dim interior light spilling into a darker corridor',
    'overcast daylight with gentle cinematic contrast'
  ],
  palettePool: [
    'cool blue gray, warm amber, black, muted cream',
    'rainy teal, sodium gold, asphalt gray, soft white',
    'deep navy, pale cyan, warm window yellow, charcoal',
    'mist gray, faded green, lamp amber, dark brown',
    'soft black, slate blue, dusty rose, warm beige',
    'muted concrete, cloud white, dim gold, desaturated green'
  ],
  propPool: [
    'umbrella silhouette',
    'wet pavement reflection',
    'empty bench',
    'window glow',
    'plain coat',
    'streetlamp',
    'unbranded suitcase',
    'rain-speckled glass'
  ],
  cameraPool: [
    'wide 24mm establishing view',
    'distant telephoto compression with the person small',
    'low angle across wet ground reflections',
    'eye-level corridor perspective',
    'high corner view showing environment first',
    'static frame with shallow foreground blur'
  ],
  textSafeZone: ['left', 'right', 'top'],
  peoplePolicy: 'Any human figure must be distant, anonymous, face-hidden, and under 20% of the frame.',
  forbiddenElements: [
    'film still recreation',
    'known actor likeness',
    'recognizable character costume',
    'face close-up',
    'same pose reproduction',
    'studio logo'
  ],
  promptTemplate: 'original 16:9 cinematic human-moment thumbnail with anonymous small figures and safe title space'
};
