import type { ThumbnailArchetype } from './types';

export const dailyHappinessArchetype: ThumbnailArchetype = {
  id: 'daily-happiness',
  category: 'daily-happiness',
  labelKo: '일상 행복',
  subjectPool: [
    'breakfast tray in a quiet kitchen',
    'fresh laundry basket beside sunlight on the floor',
    'small bouquet on a home desk',
    'open doorway with shoes neatly placed',
    'handwritten-style blank card beside tea with no readable text',
    'sunlit blanket and book on a sofa'
  ],
  settingPool: [
    'modest home kitchen in soft morning light',
    'clean living room with a comfortable sofa',
    'entryway with warm daylight and simple objects',
    'small balcony corner with plants',
    'bedside table after a calm morning routine',
    'home desk with tidy everyday details'
  ],
  compositionPool: [
    'domestic object placed low, open wall reserved for title',
    'doorway creates a natural frame around empty space',
    'soft diagonal sunlight guides attention to the subject',
    'main subject sits on a third with uncluttered background',
    'layered home objects remain sparse and readable',
    'wide room crop with generous breathing room'
  ],
  lightingPool: [
    'gentle morning sun across a clean floor',
    'soft afternoon window light with mild warmth',
    'golden-hour home light through a doorway',
    'bright overcast light for a calm everyday mood',
    'warm lamp glow mixed with dusk blue',
    'fresh post-rain daylight through glass'
  ],
  palettePool: [
    'warm white, honey wood, soft yellow, pale green',
    'cream, blush peach, light oak, gentle blue',
    'linen beige, fresh white, small coral accent, sage',
    'sunny ivory, butter yellow, natural wood, soft gray',
    'pale mint, oatmeal, warm terracotta, off-white',
    'clean white, soft tan, sky blue, light floral color'
  ],
  propPool: [
    'breakfast plate',
    'plain mug',
    'folded towel',
    'small bouquet',
    'blank card',
    'open book',
    'houseplant',
    'woven tray'
  ],
  cameraPool: [
    'eye-level home documentary framing',
    'slightly high table perspective',
    'wide room view with a natural doorway frame',
    'low floor-level angle following sunlight',
    'soft telephoto view across domestic objects',
    'clean straight-on wall and table composition'
  ],
  textSafeZone: ['left', 'right', 'top'],
  peoplePolicy: 'No identifiable person; if used, only a partial distant silhouette with face hidden and no copied pose.',
  forbiddenElements: [
    'readable handwriting',
    'family portrait faces',
    'brand packaging',
    'celebrity likeness',
    'logo',
    'watermark'
  ],
  promptTemplate: 'original 16:9 daily-happiness thumbnail with gentle home details and safe text space'
};
