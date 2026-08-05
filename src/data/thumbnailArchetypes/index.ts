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
import { showa70sKissatenFilmArchetype } from './showa70sKissatenFilm';
import { j2000sDigitalStationArchetype } from './j2000sDigitalStation';
import { modernChillNeonRoomArchetype } from './modernChillNeonRoom';
import { cityNightDriveNeonArchetype } from './cityNightDriveNeon';
import { kidsAnimalMeadowArchetype } from './kidsAnimalMeadow';
import { kidsPlaygroundSkyArchetype } from './kidsPlaygroundSky';
import { kidsCozyRoomArchetype } from './kidsCozyRoom';
import { kr2030CafeNightArchetype } from './kr2030CafeNight';
import { kr2030SeoulStreetArchetype } from './kr2030SeoulStreet';
import { kr2030PersonSilhouetteArchetype } from './kr2030PersonSilhouette';
import { jp2030SeasonalArchetype } from './jp2030Seasonal';
import { jp2030StationPlatformArchetype } from './jp2030StationPlatform';
import { jp2030CityNightArchetype } from './jp2030CityNight';
import { krkidsDailyHabitBathroomArchetype } from './krkidsDailyHabitBathroom';
import { krkidsCountingBlocksArchetype } from './krkidsCountingBlocks';
import { krkidsRoleplayMarketArchetype } from './krkidsRoleplayMarket';
import { krkidsBilingualAlphabetArchetype } from './krkidsBilingualAlphabet';
import { jpkidsTeasobiHandsArchetype } from './jpkidsTeasobiHands';
import { jpkidsFoodCharacterArchetype } from './jpkidsFoodCharacter';
import { jpkidsVehicleParadeArchetype } from './jpkidsVehicleParade';
import { jpkidsSeasonalMatsuriArchetype } from './jpkidsSeasonalMatsuri';
import { kridolStagePerformanceArchetype } from './kridolStagePerformance';
import { kridolNightCityMoveArchetype } from './kridolNightCityMove';
import { kridolMonoPortraitArchetype } from './kridolMonoPortrait';
import { kridolfDaylightCityArchetype } from './kridolfDaylightCity';
import { kridolfGroupLineArchetype } from './kridolfGroupLine';
import { kridolfColorBlockArchetype } from './kridolfColorBlock';
import type { ThumbnailArchetype, ThumbnailArchetypeId } from './types';
import type { ChannelArchetype } from '../../types';

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
  villageProvenceArchetype,
  showa70sKissatenFilmArchetype,
  j2000sDigitalStationArchetype,
  modernChillNeonRoomArchetype,
  cityNightDriveNeonArchetype
];

export const kidsThumbnailArchetypes: ThumbnailArchetype[] = [
  kidsAnimalMeadowArchetype,
  kidsPlaygroundSkyArchetype,
  kidsCozyRoomArchetype
];

// TASK B2 — kr-2030 workspace's 3 new archetypes. Each sets
// suitedArchetypes: ['kr-2030-pop'] (see their own files), so
// thumbnailArchetypesForArchetype below is what keeps them out of every
// other channel archetype's dropdown.
export const kr2030ThumbnailArchetypes: ThumbnailArchetype[] = [
  kr2030CafeNightArchetype,
  kr2030SeoulStreetArchetype,
  kr2030PersonSilhouetteArchetype
];

// TASK C2 — jp-2030 workspace's 3 new archetypes, same suitedArchetypes
// scoping pattern as kr2030ThumbnailArchetypes above.
export const jp2030ThumbnailArchetypes: ThumbnailArchetype[] = [
  jp2030SeasonalArchetype,
  jp2030StationPlatformArchetype,
  jp2030CityNightArchetype
];

// TASK E1 — kr-kids workspace's 4 new archetypes, same suitedArchetypes
// scoping pattern as kr2030ThumbnailArchetypes/jp2030ThumbnailArchetypes above.
export const krkidsThumbnailArchetypes: ThumbnailArchetype[] = [
  krkidsDailyHabitBathroomArchetype,
  krkidsCountingBlocksArchetype,
  krkidsRoleplayMarketArchetype,
  krkidsBilingualAlphabetArchetype
];

// TASK F1 — jp-kids workspace's 4 new archetypes, same suitedArchetypes
// scoping pattern as krkidsThumbnailArchetypes above.
export const jpkidsThumbnailArchetypes: ThumbnailArchetype[] = [
  jpkidsTeasobiHandsArchetype,
  jpkidsFoodCharacterArchetype,
  jpkidsVehicleParadeArchetype,
  jpkidsSeasonalMatsuriArchetype
];

// TASK K2 — kr-idol-male workspace's 3 new archetypes, same
// suitedArchetypes scoping pattern as jpkidsThumbnailArchetypes above.
export const kridolThumbnailArchetypes: ThumbnailArchetype[] = [
  kridolStagePerformanceArchetype,
  kridolNightCityMoveArchetype,
  kridolMonoPortraitArchetype
];

// TASK K3 — kr-idol-female workspace's 3 new archetypes, same
// suitedArchetypes scoping pattern as kridolThumbnailArchetypes above.
export const kridolfThumbnailArchetypes: ThumbnailArchetype[] = [
  kridolfDaylightCityArchetype,
  kridolfGroupLineArchetype,
  kridolfColorBlockArchetype
];

export const thumbnailArchetypes: ThumbnailArchetype[] = [
  ...seasonalThumbnailArchetypes,
  ...placeThumbnailArchetypes,
  ...kidsThumbnailArchetypes,
  ...kr2030ThumbnailArchetypes,
  ...jp2030ThumbnailArchetypes,
  ...krkidsThumbnailArchetypes,
  ...jpkidsThumbnailArchetypes,
  ...kridolThumbnailArchetypes,
  ...kridolfThumbnailArchetypes
];

/**
 * TASK B2 (§6-3) — `!a.suitedArchetypes` is the key clause: the existing 19
 * archetypes never set this field, so they pass through unfiltered for
 * EVERY channel archetype (including undefined/no-channel callers) — the
 * exact pre-existing behavior, unchanged. Only archetype-scoped entries
 * (currently just the 3 kr2030-* ones) get filtered out for a non-matching
 * channel archetype.
 */
export function thumbnailArchetypesForArchetype(archetype?: ChannelArchetype): ThumbnailArchetype[] {
  if (!archetype) return thumbnailArchetypes;
  return thumbnailArchetypes.filter(a => !a.suitedArchetypes || a.suitedArchetypes.includes(archetype));
}

export const thumbnailArchetypeById = Object.fromEntries(
  thumbnailArchetypes.map(archetype => [archetype.id, archetype])
) as Record<ThumbnailArchetypeId, ThumbnailArchetype>;

export const thumbnailArchetypeCount = thumbnailArchetypes.length;
