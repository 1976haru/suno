import { shuffle } from './lyricEngine';

/**
 * v5.24 (TASK C §3-5) — "아이돌 곡은 파트가 곧 구조입니다. 곡마다 파트 배분을
 * 명시하십시오... 세트 18곡에서 파트 패턴 8종 이상, 같은 패턴 최대 3곡." This is
 * a standalone module (same "opt-in, not wired into core/batchPreallocation.ts's
 * PreassignedSongSlot shape" convention as core/idolPartPlan.ts, which covers
 * a different axis — WHO sings lead/chorus, not the section-by-section part
 * map) — core/bridgeInstruction.ts renders its output as its own instruction
 * block for kr-idol-male/kr-idol-female only, rather than threading a new
 * field through the shared preassignment pipeline every other workspace also
 * uses.
 */

export interface IdolPartPattern {
  id: string;
  /** The literal part-map text an agent should follow for this track, e.g. "[Verse 1: A] [Verse 2: B] [Pre: A+B] [Chorus: All] [Bridge: C solo] [Final: All + C ad-lib]". */
  mapKo: string;
}

const IDOL_PART_PATTERNS: IdolPartPattern[] = [
  { id: 'p1', mapKo: '[Verse 1: A] [Verse 2: B] [Pre: A+B] [Chorus: All] [Bridge: C solo] [Final: All + C ad-lib]' },
  { id: 'p2', mapKo: '[Verse 1: A] [Verse 2: A] [Pre: All] [Chorus: All] [Rap: C] [Chorus: All]' },
  { id: 'p3', mapKo: '[Verse 1: B] [Pre: B+C] [Chorus: All] [Verse 2: A] [Bridge: All] [Chorus: All]' },
  { id: 'p4', mapKo: '[Verse 1: All trade] [Pre: A] [Chorus: All] [Verse 2: C rap] [Chorus: All]' },
  { id: 'p5', mapKo: '[Intro: A] [Verse 1: A+B] [Chorus: All] [Verse 2: B] [Bridge: C solo] [Chorus: All]' },
  { id: 'p6', mapKo: '[Verse 1: A] [Chorus: All] [Verse 2: B] [Chorus: All] [Dance Break] [Chorus: All]' },
  { id: 'p7', mapKo: '[Verse 1: C rap] [Pre: A] [Chorus: All] [Verse 2: B] [Bridge: A+B+C] [Chorus: All]' },
  { id: 'p8', mapKo: '[Verse 1: A] [Verse 2: B] [Chorus: All] [Verse 3: A+B+C trade] [Chorus: All]' },
  { id: 'p9', mapKo: '[Verse 1: A] [Pre: B] [Chorus: All] [Bridge: acapella All] [Chorus: All]' },
  { id: 'p10', mapKo: '[Verse 1: B] [Verse 2: A] [Pre: All] [Chorus: All] [Rap: C] [Bridge: A solo] [Chorus: All]' }
];

const MAX_REPEAT = 3;

/**
 * Deterministic (seeded) per-song pattern assignment. Cycles through a
 * shuffled pattern order, filling each pattern up to MAX_REPEAT before it
 * repeats — with 10 patterns and MAX_REPEAT 3 this guarantees at least 6
 * distinct patterns for any songCount up to 30, and in practice (18 songs)
 * lands on all 10 (2 uses each for 8 of them, 1 use each for the other 2),
 * comfortably past the spec's own "8종 이상" floor.
 */
export function buildIdolPartPatternSet(songCount: number, seed: number): IdolPartPattern[] {
  if (songCount <= 0) return [];
  const order = shuffle(IDOL_PART_PATTERNS, seed);
  const pool: IdolPartPattern[] = [];
  let guard = 0;
  while (pool.length < songCount && guard < MAX_REPEAT + 1) {
    for (const pattern of order) {
      if (pool.length >= songCount) break;
      const usedCount = pool.filter(p => p.id === pattern.id).length;
      if (usedCount < MAX_REPEAT) pool.push(pattern);
    }
    guard += 1;
  }
  return shuffle(pool.slice(0, songCount), seed + 1);
}

/** Counts distinct pattern ids actually used in a set — for audit/reporting, not part of the generation path itself. */
export function distinctPatternCount(patterns: readonly IdolPartPattern[]): number {
  return new Set(patterns.map(p => p.id)).size;
}

export function renderIdolPartPatternLine(trackNo: number, pattern: IdolPartPattern): string {
  return `    T${trackNo}: ${pattern.mapKo}`;
}
