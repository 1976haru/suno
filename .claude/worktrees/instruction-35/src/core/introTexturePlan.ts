import type { ChannelArchetype, GenerationOptions } from '../types';
import { getIntroTextureById, introTexturesForArchetype } from '../data/introTextures';
import { buildStridePlan, repairAdjacentRepeats, stridePick } from './stridePlan';

export type IntroUniquenessRatio = 0 | 50 | 100;

function uniquenessTarget(songCount: number, poolLength: number, ratio: IntroUniquenessRatio): number {
  if (songCount <= 0 || poolLength <= 0) return 0;
  if (ratio === 100) return Math.min(songCount, poolLength);
  if (ratio === 0) return Math.min(songCount, poolLength, 2);
  return Math.min(songCount, poolLength, Math.max(1, Math.ceil(songCount * 2 / 3)));
}

export function resolveIntroUniqueness(value: GenerationOptions['introUniqueness']): IntroUniquenessRatio {
  return value === 0 || value === 100 ? value : 50;
}

export function buildIntroTexturePlan(
  archetype: ChannelArchetype | undefined,
  songCount: number,
  seed: number,
  uniqueness: GenerationOptions['introUniqueness'] = 50
): string[] {
  const pool = introTexturesForArchetype(archetype).map(texture => texture.id);
  if (!pool.length || songCount <= 0) return [];

  const offset = Math.abs(seed + 503) % pool.length;
  const target = uniquenessTarget(songCount, pool.length, resolveIntroUniqueness(uniqueness));
  const uniqueIds = buildStridePlan(pool, target, offset);
  const plan: string[] = [];

  for (let index = 0; index < songCount; index++) {
    const candidate = index < uniqueIds.length
      ? uniqueIds[index]
      : stridePick(uniqueIds, index, offset + 7) ?? uniqueIds[0];
    plan.push(candidate);
  }

  return repairAdjacentRepeats(plan);
}

export function introTextureTagForId(id: string | undefined): string | undefined {
  return getIntroTextureById(id)?.tag;
}
