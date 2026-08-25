import { countWords } from './promptBudget';
import type { WorkspaceId } from '../types';

/**
 * codex 지시문 03 (TASK C) — real gap confirmed by investigation:
 * core/promptBudget.ts's own STYLE_WORD_TARGET_MIN/MAX (15-35, flat, no
 * per-workspace tuning) only runs on the LOCAL-generation path — its own
 * top doc comment says so explicitly ("this module is the local-preview
 * path only"). The bridge (an external LLM writes stylePrompt) and Batch
 * API paths have ZERO stylePrompt word-count enforcement of any kind
 * today. This is a NEW, ADDITIVE post-hoc check (mirrors
 * core/bpmDedupe.ts's enforceSingleBpmText / core/vocalPlan.ts's
 * enforceVocalTextInStylePrompt — the same "the one place realtime/Batch/
 * bridge output all funnel through" reconciliation choke point, see
 * core/batchPreallocation.ts's own reconcileWithPreassignedSlot), not a
 * replacement for promptBudget.ts's own local-path trim logic (that
 * module's 15-35 numbers stay untouched — this task's own 35-55/56-70/71+
 * numbers are a DIFFERENT, explicitly spec'd band, and are advisory/warn
 * only here, never a silent auto-trim, since rewriting a bridge-returned
 * stylePrompt after the fact risks breaking content an external LLM
 * already composed carefully).
 */

export interface StylePromptWordPolicy {
  targetMax: number;
  advisoryMax: number;
}

const DEFAULT_POLICY: StylePromptWordPolicy = { targetMax: 55, advisoryMax: 70 };
/** K-pop's own real reason (this task's own spec text): part-map/rhythm-cue instructions genuinely need more words than a plain pop stylePrompt. */
const KPOP_POLICY: StylePromptWordPolicy = { targetMax: 65, advisoryMax: 80 };
/** kids' own real reason: shorter, simpler prompts for a shorter, simpler song. */
const KIDS_POLICY: StylePromptWordPolicy = { targetMax: 45, advisoryMax: 60 };

const POLICY_BY_WORKSPACE: Record<WorkspaceId, StylePromptWordPolicy> = {
  'senior-oldpop': DEFAULT_POLICY,
  'kr-2030': DEFAULT_POLICY,
  'jp-2030': DEFAULT_POLICY,
  'kr-kids': KIDS_POLICY,
  'jp-kids': KIDS_POLICY,
  'kr-idol-male': KPOP_POLICY,
  'kr-idol-female': KPOP_POLICY
};

export function stylePromptWordPolicyFor(workspaceId: WorkspaceId): StylePromptWordPolicy {
  return POLICY_BY_WORKSPACE[workspaceId] ?? DEFAULT_POLICY;
}

export type StylePromptWordSeverity = 'ok' | 'advisory' | 'blocking';

export interface StylePromptWordCheck {
  wordCount: number;
  severity: StylePromptWordSeverity;
  policy: StylePromptWordPolicy;
}

export function checkStylePromptWordBudget(stylePrompt: string, workspaceId: WorkspaceId): StylePromptWordCheck {
  const policy = stylePromptWordPolicyFor(workspaceId);
  const wordCount = countWords(stylePrompt);
  const severity: StylePromptWordSeverity = wordCount > policy.advisoryMax ? 'blocking' : wordCount > policy.targetMax ? 'advisory' : 'ok';
  return { wordCount, severity, policy };
}

/**
 * Warn-only (matches every other post-hoc reconciliation check's severity
 * model except vocal/BPM, which those fix outright — this one only warns
 * since auto-trimming a bridge-returned stylePrompt risks corrupting
 * content an external LLM already composed carefully). Fires at BOTH
 * advisory and blocking severity — the caller's own consumer (e.g.
 * releaseReadiness.ts) is where the severity actually gates anything.
 */
export function stylePromptWordBudgetWarning(stylePrompt: string, workspaceId: WorkspaceId, trackNo: number): string | undefined {
  const check = checkStylePromptWordBudget(stylePrompt, workspaceId);
  if (check.severity === 'ok') return undefined;
  const tier = check.severity === 'blocking' ? `${check.policy.advisoryMax}+ (blocking)` : `${check.policy.targetMax}~${check.policy.advisoryMax} (advisory)`;
  return `Track ${trackNo}: stylePrompt is ${check.wordCount} words (workspace target <= ${check.policy.targetMax}, ${tier}) — core instructions may be getting diluted.`;
}
