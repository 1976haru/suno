import { HOOK_SHAPES, hookPoolSize, hookPoolSizeByShape } from './lyricEngine';
import type { ChannelArchetype, LyricLanguage } from '../types';

export interface CapacityForecast {
  archetype: ChannelArchetype;
  language: LyricLanguage;
  poolSize: number;
  /** songsPerWeek 기준 — bounded by the smallest per-HookShape pool, not poolSize/songsPerWeek (see hookPoolSizeByShape's doc comment for why that naive division undercounts real exhaustion risk). */
  weeksAtCurrentPace: number;
  /** 대략적 예상일 (ISO date) — '' when songsPerWeek <= 0, since there is no pace to project from. */
  exhaustionDate: string;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * composeHook draws each HookShape from its own independent pool with no
 * cross-shape fallback, and buildShapeSequence splits songCount as evenly as
 * possible across HOOK_SHAPES. So a channel's real runway is set by its
 * scarcest shape, not by dividing the flat total pool size by songsPerWeek —
 * that flat-division math is exactly what made v3.11's showa-cafe finding
 * look inconsistent (see hookPoolSizeByShape's doc comment).
 */
export function forecastCapacity(archetype: ChannelArchetype, language: LyricLanguage, songsPerWeek: number): CapacityForecast {
  const poolSize = hookPoolSize(language, archetype);
  if (songsPerWeek <= 0) {
    return { archetype, language, poolSize, weeksAtCurrentPace: Infinity, exhaustionDate: '' };
  }

  const perShapePool = hookPoolSizeByShape(language, archetype);
  const demandPerShape = songsPerWeek / HOOK_SHAPES.length;
  const weeksAtCurrentPace = Math.floor(Math.min(...HOOK_SHAPES.map(shape => perShapePool[shape] / demandPerShape)));

  const exhaustionDate = new Date(Date.now() + weeksAtCurrentPace * MS_PER_WEEK).toISOString().slice(0, 10);
  return { archetype, language, poolSize, weeksAtCurrentPace, exhaustionDate };
}
