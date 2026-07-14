import type { ThumbnailArchetype } from './types';

export const summerGreenArchetype: ThumbnailArchetype = {
  id: 'summer-green',
  category: 'summer-green',
  labelKo: '여름 그린',
  subjectPool: [
    'sunlit leaves casting shadows over a simple table',
    'iced drink near a wide open window',
    'garden chair partly framed by fresh foliage',
    'white curtain moving beside bright greenery',
    'picnic cloth with fruit and a glass pitcher',
    'open book under tree shade'
  ],
  settingPool: [
    'leafy veranda with clear summer air',
    'small garden table beside a bright window',
    'quiet park edge with a bench in soft focus',
    'indoor room looking out to dense green trees',
    'sunny terrace surrounded by potted plants',
    'sunny kitchen window with outdoor greenery beyond'
  ],
  compositionPool: [
    'greenery frames the edges while the title area stays clean',
    'foreground leaves form a soft natural vignette',
    'table object sits low with open sky or wall above',
    'window frame divides image into calm geometric planes',
    'main subject placed on the opposite third from the text zone',
    'layered leaves and table line guide the eye across the frame'
  ],
  lightingPool: [
    'bright morning daylight filtered through leaves',
    'clear afternoon sun softened by sheer curtains',
    'dappled tree shade with fresh highlights',
    'golden summer backlight with translucent leaves',
    'clean overcast light after rain',
    'late-day green reflection across a white wall'
  ],
  palettePool: [
    'fresh leaf green, white, lemon cream, pale wood',
    'mint green, soft sky blue, ivory, light tan',
    'deep summer green, warm white, straw yellow, glass blue',
    'sage, lime wash, linen, honey beige',
    'fern green, cloud white, soft gray, peach accent',
    'grass green, milk white, pale aqua, natural wicker'
  ],
  propPool: [
    'iced tea glass',
    'plain book',
    'linen picnic cloth',
    'small fruit bowl',
    'glass pitcher',
    'potted plant',
    'woven basket',
    'simple white curtain'
  ],
  cameraPool: [
    'wide 35mm view through leaves',
    'eye-level view from inside looking outdoors',
    'slightly high table view with soft shadows',
    'low garden-table angle with foreground blur',
    'telephoto view compressing tree layers',
    'clean straight-on window composition'
  ],
  textSafeZone: ['left', 'right', 'top'],
  peoplePolicy: 'No identifiable person; use only empty summer spaces or a very small distant silhouette.',
  forbiddenElements: [
    'brand logos',
    'readable signage',
    'identifiable face',
    'specific travel landmark',
    'copied pose',
    'watermark'
  ],
  promptTemplate: 'original 16:9 summer-green thumbnail using foliage, air, and clean title space'
};
