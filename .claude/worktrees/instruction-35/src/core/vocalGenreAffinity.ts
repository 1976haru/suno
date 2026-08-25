import { getGenreById } from '../data/genreLibrary';

/**
 * TASK v4.9 (TASK B, §2-3) — genre and vocalType are independently allocated
 * axes (core/diversityAllocation.ts's applyAxisAllocation), so a song's own
 * genre+vocalType pairing was previously arbitrary — a real listening
 * complaint ("재즈는 남녀 상관없이 약함. 재즈 = 무조건 여자") is really about which
 * genre landed on which vocalType, not the pack-wide 6-male/6-female/6-mixed
 * split itself, which the spec's own "전체 배분은 유지하십시오" keeps untouched.
 * A bounded greedy pairwise-swap local search: swapping two song-slots'
 * vocalType assignments never changes the plan's own marginal per-type
 * count (a pure permutation), so this only ever improves which genre gets
 * which already-allocated vocalType, never how many of each type exist.
 */
function affinityWeight(genreId: string | undefined, vocalType: string): number {
  const genre = genreId ? getGenreById(genreId) : undefined;
  const preference = genre?.vocalPreference;
  if (!preference) return 1;
  return (preference as Record<string, number>)[vocalType] ?? 1;
}

const MAX_PASSES = 3;
const IMPROVEMENT_EPSILON = 0.01;

export function applyGenreVocalAffinity<T extends string>(
  vocalPlan: readonly T[],
  genrePlan: readonly (string | undefined)[],
  /**
   * TASK v4.9 (TASK B, §2-3) bugfix — a real regression: this pass first
   * ran over every index including 0-2, and could swap away resolveFlagshipVocalOrder's
   * own "tracks 1-3 are 3 distinct vocal types" guarantee (tests/v380.test.ts)
   * whenever doing so happened to raise total affinity. Tracks 0..minSwapIndex-1
   * are now never a swap source OR target — still eligible as an affinity
   * REFERENCE (a track 0-2 slot's own vocalType still counts when scoring
   * candidate swaps among later indices), just never reassigned themselves.
   */
  minSwapIndex = 0
): T[] {
  const plan = [...vocalPlan];
  const n = Math.min(plan.length, genrePlan.length);
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let improved = false;
    for (let i = Math.max(0, minSwapIndex); i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const currentScore = affinityWeight(genrePlan[i], plan[i]) + affinityWeight(genrePlan[j], plan[j]);
        const swappedScore = affinityWeight(genrePlan[i], plan[j]) + affinityWeight(genrePlan[j], plan[i]);
        if (swappedScore > currentScore + IMPROVEMENT_EPSILON) {
          const tmp = plan[i];
          plan[i] = plan[j];
          plan[j] = tmp;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return plan;
}
