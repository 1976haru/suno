import type { ThumbnailArchetype } from './types';

export const lofiRoomArchetype: ThumbnailArchetype = {
  id: 'midcentury-lofi-room',
  category: 'midcentury-lofi-room',
  labelKo: '미드센추리 로파이 룸',
  subjectPool: [
    'low table with a lamp and stacked books',
    'empty lounge chair beside a softly glowing window',
    'record player corner with no visible album text',
    'small desk with headphones and a notebook',
    'sofa edge with folded blanket and warm lamp',
    'night window reflection over a quiet music room'
  ],
  settingPool: [
    'midcentury-inspired living room with clean lines',
    'small study room with warm wood furniture',
    'lofi listening corner near a city window',
    'compact apartment room with a low table',
    'quiet shelf wall with analog audio objects',
    'evening room with simple curtains and a soft rug'
  ],
  compositionPool: [
    'lamp and table anchor one side, title space remains open',
    'window rectangle creates a calm block for text',
    'furniture lines lead diagonally into negative space',
    'main object placed low with open wall above',
    'layered shelves stay blurred behind a clear foreground',
    'wide room view with balanced empty floor and wall areas'
  ],
  lightingPool: [
    'warm table lamp against cool blue evening window light',
    'soft late-night amber glow with subdued shadows',
    'dusty afternoon light through thin curtains',
    'rainy city-window reflection with warm interior highlights',
    'dim study light with gentle vignetting',
    'low contrast sunset light across wood and fabric'
  ],
  palettePool: [
    'teak brown, muted mustard, olive green, cream',
    'warm walnut, smoky blue, amber, soft beige',
    'dusty orange, sage, off-white, charcoal accent',
    'moss green, brass, faded coral, dark wood',
    'cream wall, cocoa brown, desaturated teal, lamp gold',
    'soft gray, burnt umber, pale yellow, muted navy'
  ],
  propPool: [
    'table lamp',
    'plain record player',
    'stacked books without readable titles',
    'generic headphones',
    'soft blanket',
    'small plant',
    'plain speaker',
    'paper note with no visible writing'
  ],
  cameraPool: [
    'wide 28mm room view from doorway height',
    'eye-level 35mm framing across the table',
    'low seated perspective from sofa height',
    'slight top-down view over the desk',
    'telephoto compression toward the window',
    'straight-on wall and furniture composition'
  ],
  textSafeZone: ['left', 'right', 'top'],
  peoplePolicy: 'Keep the room empty or use a distant faceless silhouette outside the main focal area.',
  forbiddenElements: [
    'readable album art',
    'brand marks on devices',
    'specific creator style',
    'identifiable person',
    'face close-up',
    'watermark'
  ],
  promptTemplate: 'original 16:9 lofi room thumbnail with midcentury warmth and safe title space'
};
