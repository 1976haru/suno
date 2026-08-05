import type { IdolPartPlan } from '../types';
import { shuffle } from './lyricEngine';

/**
 * TASK K3 §4-5 — kr-idol-female's own IdolPartPlan distribution. A
 * standalone sibling to core/idolPartPlan.ts (K2's file, not touched here —
 * §11-2 forbids editing anything K2 made), reusing the shared IdolPartPlan
 * type with K3's own ratios: more layered-harmony on the chorus (7 vs K2's
 * 5) and fewer rap sections (9 vs K2's 12) — the doc's own stated intent
 * (§4-5: "걸그룹 후렴의 겹친 화성이... 유니손과 가장 다른 지점") — a K3-chosen
 * value, not derived from any measurement; see docs/k3-report.md §13-4[D].
 */

const LEAD_RATIO: Record<IdolPartPlan['lead'], number> = { 'main-vocal': 9, 'sub-vocal': 6, rapper: 3 };
const CHORUS_RATIO: Record<IdolPartPlan['chorus'], number> = { unison: 9, 'layered-harmony': 7, 'main-vocal': 2 };
const RAP_SECTION_TARGET_RATIO = 9 / 18;

function scaleByLargestRemainder<T extends string>(ratio: Record<T, number>, songCount: number): Record<T, number> {
  const keys = Object.keys(ratio) as T[];
  const total = keys.reduce((sum, key) => sum + ratio[key], 0);
  const raw: Record<T, number> = {} as Record<T, number>;
  const floors: Record<T, number> = {} as Record<T, number>;
  for (const key of keys) {
    raw[key] = total > 0 ? (ratio[key] / total) * songCount : 0;
    floors[key] = Math.floor(raw[key]);
  }
  let remainder = songCount - keys.reduce((sum, key) => sum + floors[key], 0);
  const byRemainderDesc = keys.slice().sort((a, b) => (raw[b] - floors[b]) - (raw[a] - floors[a]));
  const result = { ...floors };
  let i = 0;
  while (remainder > 0) {
    result[byRemainderDesc[i % byRemainderDesc.length]] += 1;
    remainder -= 1;
    i += 1;
  }
  return result;
}

function flatPool<T extends string>(counts: Record<T, number>): T[] {
  const pool: T[] = [];
  for (const key of Object.keys(counts) as T[]) {
    for (let i = 0; i < counts[key]; i++) pool.push(key);
  }
  return pool;
}

export function buildIdolFemalePartPlanSet(songCount: number, seed: number): IdolPartPlan[] {
  if (songCount <= 0) return [];
  const leadCounts = scaleByLargestRemainder(LEAD_RATIO, songCount);
  const chorusCounts = scaleByLargestRemainder(CHORUS_RATIO, songCount);
  const leadPool = shuffle(flatPool(leadCounts), seed);
  const chorusPool = shuffle(flatPool(chorusCounts), seed + 1);

  const rapTarget = Math.round(songCount * RAP_SECTION_TARGET_RATIO);
  const rapperLeadIndexes = new Set(leadPool.map((lead, i) => (lead === 'rapper' ? i : -1)).filter(i => i >= 0));
  const nonRapperIndexes = shuffle(
    Array.from({ length: songCount }, (_, i) => i).filter(i => !rapperLeadIndexes.has(i)),
    seed + 2
  );
  const extraRapCount = Math.max(0, rapTarget - rapperLeadIndexes.size);
  const extraRapIndexes = new Set(nonRapperIndexes.slice(0, extraRapCount));

  return Array.from({ length: songCount }, (_, i) => ({
    lead: leadPool[i],
    chorus: chorusPool[i],
    hasRapSection: rapperLeadIndexes.has(i) || extraRapIndexes.has(i)
  }));
}

const LEAD_PHRASE: Record<IdolPartPlan['lead'], string> = {
  'main-vocal': 'main lead',
  'sub-vocal': 'sub lead',
  rapper: 'rap lead'
};
const CHORUS_PHRASE: Record<IdolPartPlan['chorus'], string> = {
  unison: 'unison chorus',
  'layered-harmony': 'layered harmony chorus',
  'main-vocal': 'solo-led chorus'
};

/** Same §5-5-style rendering as K2's own renderIdolPartDescriptor — reimplemented here rather than imported so this file never depends on K2's own module internals. */
export function renderIdolFemalePartDescriptor(plan: IdolPartPlan): string {
  const chorusText = CHORUS_PHRASE[plan.chorus];
  if (!plan.hasRapSection) return chorusText;
  return `${LEAD_PHRASE[plan.lead]}, ${chorusText}`;
}
