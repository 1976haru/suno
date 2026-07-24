import { autumnWindowGoldenArchetype } from './autumnWindowGolden';
import { winterWindowSnowArchetype } from './winterWindowSnow';
import { springBlossomWindowArchetype } from './springBlossomWindow';
import { summerSeaMorningArchetype } from './summerSeaMorning';
import { rainWindowQuietArchetype } from './rainWindowQuiet';
import { nightCityWarmArchetype } from './nightCityWarm';
import { cityRomaArchetype } from './cityRoma';
import { cityParisArchetype } from './cityParis';
import { cityBarcelonaArchetype } from './cityBarcelona';
import { cityPragueArchetype } from './cityPrague';
import { cityKyotoArchetype } from './cityKyoto';
import { villageProvenceArchetype } from './villageProvence';
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

export const seasonalThumbnailArchetypes: ThumbnailArchetype[] = [
  autumnWindowGoldenArchetype,
  winterWindowSnowArchetype,
  springBlossomWindowArchetype,
  summerSeaMorningArchetype,
  rainWindowQuietArchetype,
  nightCityWarmArchetype
];

export const placeThumbnailArchetypes: ThumbnailArchetype[] = [
  cityRomaArchetype,
  cityParisArchetype,
  cityBarcelonaArchetype,
  cityPragueArchetype,
  cityKyotoArchetype,
  villageProvenceArchetype
];

export const kidsThumbnailArchetypes: ThumbnailArchetype[] = [
  kidsAnimalMeadowArchetype,
  kidsPlaygroundSkyArchetype,
  kidsCozyRoomArchetype
];

export const thumbnailArchetypes: ThumbnailArchetype[] = [
  ...seasonalThumbnailArchetypes,
  ...placeThumbnailArchetypes,
  ...kidsThumbnailArchetypes
];

export const thumbnailArchetypeById = Object.fromEntries(
  thumbnailArchetypes.map(archetype => [archetype.id, archetype])
) as Record<ThumbnailArchetypeId, ThumbnailArchetype>;

export const thumbnailArchetypeCount = thumbnailArchetypes.length;
