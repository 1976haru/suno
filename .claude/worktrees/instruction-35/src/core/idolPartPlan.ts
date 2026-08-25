import type { IdolPartPlan } from '../types';
import { shuffle } from './lyricEngine';

/**
 * TASK K2 §5-3/§5-4/§5-5 — a standalone, additive companion to
 * types.ts's own IdolPartPlan: builds a deterministic per-song distribution
 * across a set (§5-4's own target ratios) and renders it as short,
 * headcount-free prose (§5-5: "그룹"이나 인원수를 직접 쓰지 말 것). Like
 * core/sectionGenrePlan.ts (K1), this never touches core/vocalPlan.ts,
 * core/localGenerator.ts's real per-song generation, or
 * core/promptComposer.ts's existing assembly — it's a parallel, opt-in
 * module the future kr-idol-male/kr-idol-female generation UI can call,
 * not something wired into the five existing workspaces' own output.
 */

const LEAD_RATIO: Record<IdolPartPlan['lead'], number> = { 'main-vocal': 8, 'sub-vocal': 5, rapper: 5 };
const CHORUS_RATIO: Record<IdolPartPlan['chorus'], number> = { unison: 10, 'layered-harmony': 5, 'main-vocal': 3 };
/** §5-4 — 12/18 songs carry a rap section; every rapper-lead song counts, plus enough non-rapper-lead songs to reach the target. */
const RAP_SECTION_TARGET_RATIO = 12 / 18;

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

/**
 * Deterministic (seeded) per-song IdolPartPlan set — §5-4's own target
 * ratios (lead 8/5/5, chorus 10/5/3, rap section 12/18 of songCount),
 * scaled proportionally for songCount != 18 the same way vocalPlan.ts's own
 * scaleVocalQuota scales the 6/6/6 default.
 */
export function buildIdolPartPlanSet(songCount: number, seed: number): IdolPartPlan[] {
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

// §5-5 — sound-described, never headcount/"group"-described, and short
// enough that even the worst-case combination (longest lead + longest
// chorus phrase) stays under the 40-char budget (§5-4).
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

/**
 * §5-5 — meant for the whole-song spine clause (stated once per song), not
 * a per-section descriptor. Chorus phrase alone when there's no rap
 * section; lead phrase prepended when there is one. Worst case ("main
 * lead, layered harmony chorus") is 34 chars, comfortably under §5-4's
 * 40-char cap — verified for every combination, not just the common case.
 */
export function renderIdolPartDescriptor(plan: IdolPartPlan): string {
  const chorusText = CHORUS_PHRASE[plan.chorus];
  if (!plan.hasRapSection) return chorusText;
  return `${LEAD_PHRASE[plan.lead]}, ${chorusText}`;
}
