import type { AxisAllocation, DiversityAxisId, LyricPerspective } from '../types';

export const DIVERSITY_AXIS_IDS: DiversityAxisId[] = [
  'vocalType',
  'introTexture',
  'hookDevice',
  'arrangementDensity',
  'structureTemplate',
  'lyricTheme',
  'pov'
];

export const DIVERSITY_AXIS_LABELS: Record<DiversityAxisId, string> = {
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

function manualPlan<T extends string>(allocation: AxisAllocation | undefined, allowedOrder: readonly T[], songCount: number): T[] {
  if (!allocation || allocation.mode !== 'manual' || songCount <= 0) return [];
  const allowed = new Set<string>(allowedOrder);
  const plan: T[] = [];
  for (const id of allowedOrder) {
    const count = allowed.has(id) ? safeCount(allocation.counts[id]) : 0;
    for (let i = 0; i < count && plan.length < songCount; i++) plan.push(id);
  }
  return plan;
}

export function applyAxisAllocation<T extends string>(
  autoPlan: readonly T[],
  values: AxisAllocation[] | undefined,
  axis: DiversityAxisId,
  allowedOrder: readonly T[]
): T[] {
  const allocation = allocationForAxis(values, axis);
  if (!allocation || allocation.mode !== 'manual') return [...autoPlan];
  const manual = manualPlan(allocation, allowedOrder, autoPlan.length);
  if (!manual.length) return [...autoPlan];
  if (manual.length >= autoPlan.length) return manual.slice(0, autoPlan.length);
  return [...manual, ...autoPlan.slice(0, autoPlan.length - manual.length)];
}
