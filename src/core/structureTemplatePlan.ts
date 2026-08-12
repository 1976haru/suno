import type { ChannelArchetype } from '../types';
import { shuffle, type StructureTemplateId } from './lyricEngine';
import { ADULT_STRUCTURE_TEMPLATE_IDS, KIDS_STRUCTURE_TEMPLATE_IDS } from './diversityAllocation';
import { sectionRangeForBpm, TEMPLATE_SECTION_COUNT } from './bpmLengthControl';
import { isKidsArchetype } from '../utils/channelArchetype';

function eligibleTemplates(pool: readonly StructureTemplateId[], bpm: number | undefined): StructureTemplateId[] {
  if (bpm === undefined) return [...pool];
  const [minSections, maxSections] = sectionRangeForBpm(bpm);
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
  const pool = isKidsArchetype(archetype) ? KIDS_STRUCTURE_TEMPLATE_IDS : ADULT_STRUCTURE_TEMPLATE_IDS;
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

/**
 * TASK v4.11 (TASK A) — callers thread this plan's own auto (BPM-eligible)
 * pick through core/diversityAllocation.ts's applyAxisAllocation, which
 * overrides it with a fixed per-template COUNT target whenever the pack's
 * diversityAllocations sets a manual 'structureTemplate' entry (which
 * core/setDirector.ts's directSetLocal always does, purely to guarantee
 * template variety across the pack — it has no idea what BPM any track
 * landed on). That silently defeats buildBpmAwareStructureTemplatePlan
 * above: a real 18-song bridge-plan measurement found 8/18 slots where the
 * FINAL (post-allocation) template's own section count fell outside that
 * track's own BPM-tier sectionRange. Run this after allocation (and after
 * pinning index 0 to 'T1') to repair those mismatches by swapping templates
 * PAIRWISE between two tracks whose own tiers both accept the other's
 * current template — never adding, removing, or recounting a template, so
 * whatever count distribution the manual allocation asked for survives
 * exactly; only which track gets which of the already-chosen templates
 * changes. A track with no valid swap partner (the plan simply contains no
 * template fitting its tier anywhere) is left as-is — this repairs what it
 * can, it doesn't fabricate templates the plan never had.
 */
export function repairStructureTemplatePlanForBpm(
  plan: readonly StructureTemplateId[],
  bpmByIndex: readonly (number | undefined)[]
): StructureTemplateId[] {
  const repaired = [...plan];
  const fitsTier = (id: StructureTemplateId, bpm: number | undefined) => {
    if (bpm === undefined) return true;
    const [minSections, maxSections] = sectionRangeForBpm(bpm);
    const count = TEMPLATE_SECTION_COUNT[id];
    return count >= minSections && count <= maxSections;
  };
  for (let i = 1; i < repaired.length; i++) {
    if (fitsTier(repaired[i], bpmByIndex[i])) continue;
    for (let j = i + 1; j < repaired.length; j++) {
      if (repaired[j] === repaired[i]) continue;
      if (!fitsTier(repaired[j], bpmByIndex[i]) || !fitsTier(repaired[i], bpmByIndex[j])) continue;
      const tmp = repaired[i];
      repaired[i] = repaired[j];
      repaired[j] = tmp;
      break;
    }
  }
  return repaired;
}
