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

/**
 * 지시문 57 (TASK A/E) — 실측 회귀: 시니어 채널 기본 4종 풀(adult-contemporary/
 * acoustic-pop/chanson/retro-soul-pop, good-morning-memory-radio
 * preferredGenres 앞 4개)이 이 지시문에서 처음으로 전부 vocalPreference를
 * 갖게 되자, 이 함수의 그리디 스왑이 core/designGate.ts의 관문1
 * vocal-consecutive(같은 타입 연속 ≤2)·vocal-segment-balance(6곡 구간당
 * ≤3)를 위반하는 순서를 만들었다(tests/multiSetPreflight.test.ts로 실측 —
 * songCount=18 기본 옵션이 allowed:true에서 false로 이동). affinity 점수만
 * 보고 순서 제약을 전혀 몰랐던 것이 원인 — 이 두 상수는 designGate.ts의
 * 동일 임계값을 그대로 미러링한다(그 파일을 이 함수가 import하면
 * core/*→core/* 순환 의존이 생기므로 값만 복제, 로직은 별도 유지).
 */
const MAX_CONSECUTIVE_RUN = 2;
const SEGMENT_WINDOW_SIZE = 6;
const MAX_PER_SEGMENT = 3;

function longestRun<T>(items: readonly T[]): number {
  if (!items.length) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < items.length; i++) {
    current = items[i] === items[i - 1] ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

function maxSegmentCount<T>(items: readonly T[], windowSize = SEGMENT_WINDOW_SIZE): number {
  let max = 0;
  for (let start = 0; start < items.length; start += windowSize) {
    const window = items.slice(start, start + windowSize);
    const counts = new Map<T, number>();
    for (const item of window) counts.set(item, (counts.get(item) ?? 0) + 1);
    for (const count of counts.values()) max = Math.max(max, count);
  }
  return max;
}

/**
 * 이미 위반 상태(예: vocalQuotaOverride 채널의 15남/0여/3듀엣처럼 쿼터
 * 자체가 긴 연속을 강제하는 경우 — designGate.ts의 vocalIssues는 그런
 * 채널을 quotaFidelityIssues로 아예 다른 검사로 우회한다)를 더 악화시키는
 * 스왑만 막는다. 이미 2/3을 넘던 채널까지 이 함수가 억지로 손대려 들지
 * 않는다 — affinity 최적화가 무력화될 뿐 새 위반을 만들지는 않는다는
 * 원칙만 지킨다.
 */
function worsensVocalBalance<T>(before: readonly T[], after: readonly T[]): boolean {
  const beforeRun = longestRun(before);
  const afterRun = longestRun(after);
  if (afterRun > MAX_CONSECUTIVE_RUN && afterRun > beforeRun) return true;
  const beforeSegment = maxSegmentCount(before);
  const afterSegment = maxSegmentCount(after);
  if (afterSegment > MAX_PER_SEGMENT && afterSegment > beforeSegment) return true;
  return false;
}

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
          const candidate = [...plan];
          candidate[i] = plan[j];
          candidate[j] = plan[i];
          if (worsensVocalBalance(plan, candidate)) continue;
          plan[i] = candidate[i];
          plan[j] = candidate[j];
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return plan;
}
