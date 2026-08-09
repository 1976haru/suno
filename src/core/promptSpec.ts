import type { VocalGender } from './vocalPlan';
import { countBpmTextMentions } from './bpmDedupe';
import { detectVocalGenderPresence } from './vocalPlan';

/**
 * codex 지시문 03 (TASK A) — real investigation finding (4 parallel research
 * agents, before writing any of this): stylePrompt text is built/mutated by
 * THREE structurally different subsystems today, not one —
 * core/promptComposer.ts (an atom-priority compiler, used by both local
 * generation and the Batch API path), core/bridgeInstruction.ts (free-text
 * instructions that ask an EXTERNAL LLM to write its own prose), and
 * core/batchPreallocation.ts's reconcileWithPreassignedSlot (a post-hoc
 * fix-up chain that runs on all three paths' output afterward). Unifying
 * those into one compiler would be a multi-week rewrite touching ~3200
 * passing tests, explicitly out of scope for that task.
 *
 * 정합성 점검 §3 (dual-authority cleanup) — this file originally also shipped
 * a full PromptSpec contract + promptSpecFromSlot + compilePromptSpec as
 * proof that the type wasn't merely decorative. Real measurement found
 * neither was ever wired into any of the 3 live generation paths — a
 * second, parallel stylePrompt-compilation authority that existed only in
 * tests. Removed rather than left half-wired (checkReachability.ts's own
 * file-level granularity missed this exact gap: auditStylePromptAgainstSpec
 * below kept the file "reachable" while the other two functions were
 * genuinely dead code). What remains is the one real, live consumer.
 */

export interface VocalSpec {
  gender?: VocalGender;
  text: string;
}

export interface PromptSpecViolation {
  field: 'vocal' | 'tempo';
  detail: string;
}

/**
 * The bridge between a resolved vocal choice and the string-level reality
 * every real generation path still works in — scans an ALREADY-PRODUCED
 * stylePrompt string (from any of the 3 live paths, after
 * core/batchPreallocation.ts's reconciliation) for two concrete violations
 * (dual BPM claims, dual lead-vocal gender declarations), reusing the real
 * detectors those existing fixes already rely on rather than
 * re-implementing them.
 */
export function auditStylePromptAgainstSpec(stylePrompt: string, spec: { vocal: VocalSpec }): PromptSpecViolation[] {
  const violations: PromptSpecViolation[] = [];
  const bpmMentions = countBpmTextMentions(stylePrompt);
  if (bpmMentions > 1) {
    violations.push({ field: 'tempo', detail: `stylePrompt declares BPM ${bpmMentions} times, expected exactly 1` });
  }
  if (spec.vocal.gender === 'male' || spec.vocal.gender === 'female') {
    const presence = detectVocalGenderPresence(stylePrompt);
    if (presence.male && presence.female) {
      violations.push({ field: 'vocal', detail: `stylePrompt declares both male and female lead-vocal words for a single-gender (${spec.vocal.gender}) resolution` });
    }
  }
  return violations;
}
