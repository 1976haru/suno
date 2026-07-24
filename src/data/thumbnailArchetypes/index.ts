import { autumnWindowGoldenArchetype } from './autumnWindowGolden';
import { winterWindowSnowArchetype } from './winterWindowSnow';
import { springBlossomWindowArchetype } from './springBlossomWindow';
import { summerSeaMorningArchetype } from './summerSeaMorning';
import { rainWindowQuietArchetype } from './rainWindowQuiet';
import { nightCityWarmArchetype } from './nightCityWarm';
import { kidsAnimalMeadowArchetype } from './kidsAnimalMeadow';
import { kidsPlaygroundSkyArchetype } from './kidsPlaygroundSky';
import { kidsCozyRoomArchetype } from './kidsCozyRoom';
import type { ThumbnailArchetype, ThumbnailArchetypeId } from './types';

export type {
  ThumbnailArchetype,
  ThumbnailArchetypeCategory,
  ThumbnailArchetypeId,
  ThumbnailPeopleMode,
  ThumbnailTextSafeZone,
  ThumbnailTimeOfDay,
  ThumbnailTypographyGuide
} from './types';
export { KOREAN_SERIF_TYPOGRAPHY, KIDS_BRIGHT_TYPOGRAPHY } from './types';

// TASK v3.38 — 6 seasonal Korean-serif archetypes (Part A) followed by 3
// kids-bright archetypes (Part B5).
export const thumbnailArchetypes: ThumbnailArchetype[] = [
  autumnWindowGoldenArchetype,
  winterWindowSnowArchetype,
  springBlossomWindowArchetype,
  summerSeaMorningArchetype,
  rainWindowQuietArchetype,
  nightCityWarmArchetype,
  kidsAnimalMeadowArchetype,
  kidsPlaygroundSkyArchetype,
  kidsCozyRoomArchetype
];

/** TASK v3.38 Part A — the 6 seasonal archetype ids only, for UI pickers that shouldn't offer kids-grammar archetypes to a non-kids channel. */
export const seasonalThumbnailArchetypes: ThumbnailArchetype[] = thumbnailArchetypes.slice(0, 6);

/** TASK v3.38 Part B5 — the 3 kids archetype ids only. */
export const kidsThumbnailArchetypes: ThumbnailArchetype[] = thumbnailArchetypes.slice(6);

export const thumbnailArchetypeById = Object.fromEntries(
  thumbnailArchetypes.map(archetype => [archetype.id, archetype])
) as Record<ThumbnailArchetypeId, ThumbnailArchetype>;

export const thumbnailArchetypeCount = thumbnailArchetypes.length;
