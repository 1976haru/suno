/**
 * TASK D2 §3 — per-age-tier song structure. §0-2 measured that all 18
 * little-singalong-radio songs share one identical section structure
 * regardless of the (already-assigned but disconnected — see §0-3 ①)
 * `structureTemplate` field: that field is the ADULT structure axis
 * (data/... T1/T3/T5, see core/structureTemplatePlan.ts) and composeKidsLyrics
 * never reads it. This file is a completely separate, kids-only structure
 * axis — deliberately not reusing the adult StructureTemplateId type/values,
 * per D2 §3-4's explicit instruction not to touch that field or its
 * assignment logic (still used by every adult archetype, kids workspaces'
 * own future genres included once E1/F1 build them).
 */
import type { KidsAgeTierId } from './kidsVocabularyWhitelist';

export type { KidsAgeTierId };

export type KidsStructureSectionKind =
  | 'intro'
  | 'verse1'
  | 'verse2'
  | 'chorus'
  | 'callResponse'
  | 'bridge'
  | 'finalChorus';

export interface KidsStructureTemplate {
  id: KidsAgeTierId;
  sections: KidsStructureSectionKind[];
}

/**
 * §3-2's own literal per-tier orders. T1 drops the bridge entirely (§0-3 ③:
 * a bridge is an adult development device, not appropriate for a 0-2-year-
 * old's "one concept per song"); T2 replaces it with a call-response slot
 * (§0-3 ⑥ — the doc's own #1-ranked structural need for Korean 율동/action
 * songs); T3 keeps a short bridge, closest to the current hardcoded shape.
 */
export const KIDS_STRUCTURE_TEMPLATES: Record<KidsAgeTierId, KidsStructureTemplate> = {
  'kids-t1': {
    id: 'kids-t1',
    sections: ['intro', 'chorus', 'verse1', 'chorus', 'verse2', 'chorus', 'chorus', 'finalChorus']
  },
  'kids-t2': {
    id: 'kids-t2',
    sections: ['intro', 'chorus', 'verse1', 'callResponse', 'chorus', 'verse2', 'callResponse', 'chorus', 'finalChorus']
  },
  'kids-t3': {
    id: 'kids-t3',
    sections: ['intro', 'verse1', 'chorus', 'verse2', 'chorus', 'bridge', 'finalChorus']
  }
};

export function kidsStructureTemplateFor(tierId: KidsAgeTierId): KidsStructureTemplate {
  return KIDS_STRUCTURE_TEMPLATES[tierId];
}

/**
 * TASK D2 §6-2 — WHERE a motion cue belongs, not what it says. §0-2
 * measured 0 motion-cue positions defined anywhere; the research material's
 * #1-ranked Korean structural need is "clapping and body movement cues".
 * `allowedMotions`/`forbiddenMotions` are language-neutral concept tags
 * (physical actions), not authored Korean/Japanese phrases — the actual
 * wording ("손을 흔들어요") is E1/F1's job per §0-1/§7's content boundary.
 */
export interface KidsMotionCueRule {
  tierId: KidsAgeTierId;
  minPerChorus: number;
  alsoInCallResponse: boolean;
  allowedMotions: string[];
  forbiddenMotions: string[];
}

export const KIDS_MOTION_CUE_RULES: Record<KidsAgeTierId, KidsMotionCueRule> = {
  'kids-t1': {
    tierId: 'kids-t1',
    minPerChorus: 1,
    alsoInCallResponse: false,
    allowedMotions: ['hand wave', 'clap'],
    // §6-2: "T1 은 단순 동작만 — 점프·회전 금지"
    forbiddenMotions: ['jump', 'spin']
  },
  'kids-t2': {
    tierId: 'kids-t2',
    minPerChorus: 1,
    alsoInCallResponse: true,
    allowedMotions: ['hand wave', 'clap', 'jump', 'point', 'march in place'],
    forbiddenMotions: []
  },
  'kids-t3': {
    tierId: 'kids-t3',
    minPerChorus: 1,
    alsoInCallResponse: false,
    allowedMotions: ['hand wave', 'clap', 'jump', 'point', 'march in place', 'spin'],
    forbiddenMotions: []
  }
};

export function kidsMotionCueRuleFor(tierId: KidsAgeTierId): KidsMotionCueRule {
  return KIDS_MOTION_CUE_RULES[tierId];
}
