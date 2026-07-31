import type { IntroMode } from '../types';
import { buildGenreCountRotationPlan } from './genreRotation';

export const INTRO_MODE_IDS: readonly IntroMode[] = ['instrumental', 'vocal-immediate', 'vocal-after-texture'];

/**
 * TASK v3.64 (TASK B) — spec's own reference distribution for an 18-song
 * pack: instrumental 8, vocal-immediate 4 (including the cold-open track),
 * vocal-after-texture 6. Scaled proportionally for other song counts.
 */
function introModeCounts(songCount: number): Record<IntroMode, number> {
  if (songCount <= 0) return { instrumental: 0, 'vocal-immediate': 0, 'vocal-after-texture': 0 };
  const vocalImmediate = Math.max(1, Math.round((songCount * 4) / 18));
  const instrumental = Math.max(0, Math.round((songCount * 8) / 18));
  const vocalAfterTexture = Math.max(0, songCount - vocalImmediate - instrumental);
  return { instrumental, 'vocal-immediate': vocalImmediate, 'vocal-after-texture': vocalAfterTexture };
}

/**
 * Track 1 (cold-open) is always 'vocal-immediate' — no [intro] tag, the hook
 * is heard immediately (mirrors lyricEngine.ts's own cold-open convention).
 * The remaining tracks rotate across all 3 modes via the same generic
 * count-based rotation genreRotation.ts already uses for the genre axis —
 * reused rather than reimplemented.
 */
export function buildIntroModePlan(songCount: number, seed: number): IntroMode[] {
  if (songCount <= 0) return [];
  if (songCount === 1) return ['vocal-immediate'];
  const counts = introModeCounts(songCount);
  const remaining = { ...counts, 'vocal-immediate': Math.max(0, counts['vocal-immediate'] - 1) };
  const rest = buildGenreCountRotationPlan(remaining, INTRO_MODE_IDS, songCount - 1, seed) as IntroMode[];
  return ['vocal-immediate', ...rest];
}
