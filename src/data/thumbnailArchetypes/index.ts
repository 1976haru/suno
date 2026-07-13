import { cinematicMomentArchetype } from './cinematicMoment';
import { dailyHappinessArchetype } from './dailyHappiness';
import { lofiRoomArchetype } from './lofiRoom';
import { refinedCafeArchetype } from './refinedCafe';
import { summerGreenArchetype } from './summerGreen';
import type { ThumbnailArchetype, ThumbnailArchetypeId } from './types';

export type {
  ThumbnailArchetype,
  ThumbnailArchetypeCategory,
  ThumbnailArchetypeId,
  ThumbnailPeopleMode,
  ThumbnailTextSafeZone,
  ThumbnailTimeOfDay
} from './types';

export const thumbnailArchetypes: ThumbnailArchetype[] = [
  refinedCafeArchetype,
  summerGreenArchetype,
  lofiRoomArchetype,
  dailyHappinessArchetype,
  cinematicMomentArchetype
];

export const thumbnailArchetypeById = Object.fromEntries(
  thumbnailArchetypes.map(archetype => [archetype.id, archetype])
) as Record<ThumbnailArchetypeId, ThumbnailArchetype>;

export const thumbnailArchetypeCount = thumbnailArchetypes.length;
