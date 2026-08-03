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

export const thumbnailArchetypes: ThumbnailArchetype[] = [
  ...seasonalThumbnailArchetypes,
  ...placeThumbnailArchetypes,
  ...kidsThumbnailArchetypes,
  ...kr2030ThumbnailArchetypes
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
