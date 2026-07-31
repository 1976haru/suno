import type { AxisAllocation, DiversityAxisId, LyricPerspective } from '../types';
import { shuffle } from './lyricEngine';

export const DIVERSITY_AXIS_IDS: DiversityAxisId[] = [
  'genre',
  'vocalType',
  'introTexture',
  'hookDevice',
  'arrangementDensity',
  'structureTemplate',
  'lyricTheme',
  'pov'
];

export const DIVERSITY_AXIS_LABELS: Record<DiversityAxisId, string> = {
  genre: 'Genre',
  vocalType: 'Vocal',
  introTexture: 'Intro texture',
  hookDevice: 'Hook device',
  arrangementDensity: 'Arrangement density',
  structureTemplate: 'Structure template',
  lyricTheme: 'Lyric theme',
  pov: 'Point of view'
};

export const VOCAL_TYPE_IDS = ['male', 'female', 'mixed'] as const;
export const ARRANGEMENT_DENSITY_IDS = ['sparse', 'medium', 'full'] as const;
export const ADULT_STRUCTURE_TEMPLATE_IDS = ['T1', 'T2', 'T3', 'T4', 'T5'] as const;
export const KIDS_STRUCTURE_TEMPLATE_IDS = ['T1', 'T3', 'T5'] as const;
export const POV_IDS: LyricPerspective[] = ['firstPerson', 'secondPerson', 'thirdPerson', 'radioHost'];

export interface AllocationStatus {
  total: number;
  state: 'auto' | 'under' | 'exact' | 'over';
  overBy: number;
  underBy: number;
}

function safeCount(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

export function normalizeAxisAllocation(value: Partial<AxisAllocation> | undefined): AxisAllocation | undefined {
  if (!value || !DIVERSITY_AXIS_IDS.includes(value.axis as DiversityAxisId)) return undefined;
  const counts: Record<string, number> = {};
  for (const [key, count] of Object.entries(value.counts || {})) {
    const normalized = safeCount(count);
    if (normalized > 0) counts[key] = normalized;
  }
  return {
    axis: value.axis as DiversityAxisId,
    mode: value.mode === 'manual' ? 'manual' : 'auto',
    counts
  };
}

export function normalizeDiversityAllocations(values: AxisAllocation[] | undefined): AxisAllocation[] {
  if (!Array.isArray(values)) return [];
  const byAxis = new Map<DiversityAxisId, AxisAllocation>();
  for (const value of values) {
    const normalized = normalizeAxisAllocation(value);
    if (normalized) byAxis.set(normalized.axis, normalized);
  }
  return DIVERSITY_AXIS_IDS
    .map(axis => byAxis.get(axis))
    .filter((value): value is AxisAllocation => Boolean(value));
}

export function allocationForAxis(values: AxisAllocation[] | undefined, axis: DiversityAxisId): AxisAllocation | undefined {
  return normalizeDiversityAllocations(values).find(value => value.axis === axis);
}

/**
 * TASK v3.58 — replaces (or removes, if `next` is undefined) exactly one
 * axis's allocation, leaving every other axis's allocation untouched. The
 * one place a system-computed allocation (e.g. core/conceptAgent.ts's
 * genreAllocation, applied from Step2Concept.tsx) should write into
 * GenerationOptions.diversityAllocations, so a concept recommendation's
 * genre distribution doesn't clobber a vocalType/introTexture/... manual
 * allocation the user already set up on a different axis.
 */
export function replaceAxisAllocation(values: AxisAllocation[] | undefined, next: AxisAllocation | undefined): AxisAllocation[] {
  const withoutAxis = next
    ? normalizeDiversityAllocations(values).filter(item => item.axis !== next.axis)
    : normalizeDiversityAllocations(values);
  return next ? [...withoutAxis, next] : withoutAxis;
}

export function isManualAllocation(values: AxisAllocation[] | undefined, axis: DiversityAxisId): boolean {
  return allocationForAxis(values, axis)?.mode === 'manual';
}

export function manualCountTotal(allocation: AxisAllocation | undefined): number {
  if (!allocation || allocation.mode !== 'manual') return 0;
  return Object.values(allocation.counts).reduce((sum, count) => sum + safeCount(count), 0);
}

export function allocationStatus(allocation: AxisAllocation | undefined, songCount: number): AllocationStatus {
  if (!allocation || allocation.mode !== 'manual') {
    return { total: 0, state: 'auto', overBy: 0, underBy: 0 };
  }
  const total = manualCountTotal(allocation);
  if (total > songCount) return { total, state: 'over', overBy: total - songCount, underBy: 0 };
  if (total < songCount) return { total, state: 'under', overBy: 0, underBy: songCount - total };
  return { total, state: 'exact', overBy: 0, underBy: 0 };
}

export function hasAllocationOverflow(values: AxisAllocation[] | undefined, songCount: number): boolean {
  return normalizeDiversityAllocations(values).some(allocation => allocationStatus(allocation, songCount).state === 'over');
}

/**
 * TASK v3.64-B — real measurement: a user-set manual allocation of 6/6/6
 * (male/female/mixed) across 18 songs came back as 6 male songs in a row,
 * then 6 female, then 6 mixed ("남 남 남 남 남 남 여 여 여 여 여 여 듀 듀 듀
 * 듀 듀 듀") — the exact counts were right, but stacking each value
 * contiguously in allowedOrder made the whole first third of the playlist
 * sound like one repeated male voice. Reused verbatim from
 * lyricDiversityPlan.ts's own `spreadPlanByCounts` (was private there,
 * used to spread lyricTheme/pov after their own applyAxisAllocation calls
 * for the same reason) rather than reimplementing the same greedy
 * highest-remaining-count/tie-break algorithm a second time; moved here
 * (the lower-level module) since lyricDiversityPlan.ts already depends on
 * this file, and is now imported back from there instead of duplicated.
 */
export function spreadPlanByCounts<T extends string>(plan: readonly T[], allowedOrder: readonly T[], maxConsecutive: number): T[] {
  if (plan.length <= 1) return [...plan];
  const counts = new Map<T, number>();
  for (const item of plan) counts.set(item, (counts.get(item) || 0) + 1);
  if (counts.size <= 1) return [...plan];

  const result: T[] = [];
  const orderIndex = new Map<T, number>();
  allowedOrder.forEach((item, index) => orderIndex.set(item, index));

  function wouldExceed(candidate: T): boolean {
    if (maxConsecutive <= 0) return false;
    if (result.length < maxConsecutive) return false;
    for (let i = 1; i <= maxConsecutive; i++) {
      if (result[result.length - i] !== candidate) return false;
    }
    return true;
  }

  while (result.length < plan.length) {
    const candidates = [...counts.entries()]
      .filter(([, count]) => count > 0)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return (orderIndex.get(a[0]) ?? 999) - (orderIndex.get(b[0]) ?? 999);
      });
    const picked = candidates.find(([candidate]) => !wouldExceed(candidate)) ?? candidates[0];
    if (!picked) break;
    const [value, count] = picked;
    result.push(value);
    counts.set(value, count - 1);
  }

  return result;
}

function manualPlan<T extends string>(allocation: AxisAllocation | undefined, allowedOrder: readonly T[], songCount: number, seed = 0): T[] {
  if (!allocation || allocation.mode !== 'manual' || songCount <= 0) return [];
  const allowed = new Set<string>(allowedOrder);
  const plan: T[] = [];
  for (const id of allowedOrder) {
    const count = allowed.has(id) ? safeCount(allocation.counts[id]) : 0;
    for (let i = 0; i < count && plan.length < songCount; i++) plan.push(id);
  }
  // TASK v3.64-B — plan above is still built in allowedOrder's contiguous
  // block shape (preserves each value's exact count); spread it so equal
  // runs don't land back-to-back. maxConsecutive=2 allows up to 2 in a row
  // (never 3+), matching this task's own requirement. The tie-break order
  // is seed-shuffled rather than always allowedOrder itself, so two axes
  // with tied counts don't always resolve the same way regardless of seed.
  return spreadPlanByCounts(plan, shuffle([...allowedOrder], seed), 2);
}

export function applyAxisAllocation<T extends string>(
  autoPlan: readonly T[],
  values: AxisAllocation[] | undefined,
  axis: DiversityAxisId,
  allowedOrder: readonly T[],
  seed = 0
): T[] {
  const allocation = allocationForAxis(values, axis);
  if (!allocation || allocation.mode !== 'manual') return [...autoPlan];
  const manual = manualPlan(allocation, allowedOrder, autoPlan.length, seed);
  if (!manual.length) return [...autoPlan];
  if (manual.length >= autoPlan.length) return manual.slice(0, autoPlan.length);
  return [...manual, ...autoPlan.slice(0, autoPlan.length - manual.length)];
}
