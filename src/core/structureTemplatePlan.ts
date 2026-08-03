import type { ChannelArchetype } from '../types';
import { shuffle, type StructureTemplateId } from './lyricEngine';
import { ADULT_STRUCTURE_TEMPLATE_IDS, KIDS_STRUCTURE_TEMPLATE_IDS } from './diversityAllocation';
import { resolveBpmLengthTier, TEMPLATE_SECTION_COUNT } from './bpmLengthControl';

function eligibleTemplates(pool: readonly StructureTemplateId[], bpm: number | undefined): StructureTemplateId[] {
  if (bpm === undefined) return [...pool];
  const [minSections, maxSections] = resolveBpmLengthTier(bpm).sectionRange;
  const eligible = pool.filter(id => {
    const count = TEMPLATE_SECTION_COUNT[id];
    return count >= minSections && count <= maxSections;
  });
  return eligible.length ? eligible : [...pool];
}

/**
 * TASK v4.6 (TASK C) — BPM-aware replacement for lyricEngine.ts's own
 * buildStructureTemplatePlan (kept unchanged there for callers that don't
 * have a per-song BPM yet). Track 1 stays pinned to 'T1' regardless of its
 * own tempo — same pre-existing cold-open convention as the BPM-independent
 * version (composeLyrics itself also forces this, per that function's own
 * doc comment), unrelated to this task's own bug. Every other track is
 * seed-picked only from the templates whose section count fits that track's
 * own BPM tier (core/bpmLengthControl.ts's BPM_LENGTH_TIERS), then repaired
 * for adjacent repeats the same way the original does — except the repair
 * only ever swaps a track into a template that ALSO fits ITS OWN tier
 * (never assigns a BPM-mismatched template just to break a repeat, which
 * would reintroduce the exact bug this function exists to fix).
 */
export function buildBpmAwareStructureTemplatePlan(
  songCount: number,
  seed: number,
  archetype: ChannelArchetype | undefined,
  bpmByIndex: readonly (number | undefined)[]
): StructureTemplateId[] {
  if (songCount <= 0) return [];
  const pool = archetype === 'kids' ? KIDS_STRUCTURE_TEMPLATE_IDS : ADULT_STRUCTURE_TEMPLATE_IDS;
  const eligibleByIndex = Array.from({ length: songCount }, (_, i) => eligibleTemplates(pool, bpmByIndex[i]));
  const plan: StructureTemplateId[] = eligibleByIndex.map((eligible, i) => shuffle(eligible, seed + i * 601)[0]);
  plan[0] = 'T1';

  for (let i = 1; i < plan.length; i++) {
    if (plan[i] !== plan[i - 1]) continue;
    const own = eligibleByIndex[i];
    let swapIndex = -1;
    for (let j = i + 1; j < plan.length; j++) {
      if (plan[j] === plan[i]) continue;
      if (!own.includes(plan[j])) continue;
      if (!eligibleByIndex[j].includes(plan[i])) continue;
      swapIndex = j;
      break;
    }
    if (swapIndex === -1) continue;
    const tmp = plan[i];
    plan[i] = plan[swapIndex];
    plan[swapIndex] = tmp;
  }

  return plan;
}
