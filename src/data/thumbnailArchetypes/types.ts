export type ThumbnailArchetypeCategory =
  | 'refined-cafe'
  | 'summer-green'
  | 'midcentury-lofi-room'
  | 'daily-happiness'
  | 'cinematic-human-moment';

export type ThumbnailArchetypeId = ThumbnailArchetypeCategory;

export type ThumbnailTextSafeZone = 'left' | 'right' | 'top';

export type ThumbnailPeopleMode = 'none' | 'distant-silhouette';

export type ThumbnailTimeOfDay = 'morning' | 'afternoon' | 'golden-hour' | 'evening' | 'night';

export interface ThumbnailArchetype {
  id: ThumbnailArchetypeId;
  category: ThumbnailArchetypeCategory;
  labelKo: string;
  subjectPool: string[];
  settingPool: string[];
  compositionPool: string[];
  lightingPool: string[];
  palettePool: string[];
  propPool: string[];
  cameraPool: string[];
  textSafeZone: ThumbnailTextSafeZone[];
  peoplePolicy: string;
  forbiddenElements: string[];
  promptTemplate: string;
}
