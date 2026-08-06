import type { WorkspaceId } from '../types';
import { EXPLORATION_POLICIES, explorationPolicyFor, type ExplorationAxis, type WorkspaceExplorationPolicy } from '../data/explorationPolicies';

/**
 * v5.24 (TASK A/B/C/D) — data-driven exploration engine for every workspace
 * OTHER than senior-oldpop, which keeps running through
 * core/explorationSlots.ts's own dedicated engine untouched (see this task's
 * own §11 "회귀 방지" and data/explorationPolicies.ts's own `legacyEngine`
 * flag). Structurally this mirrors explorationSlots.ts (same
 * plan-then-render-instruction split, same proportional-position slot
 * selection, same "8곡 미만이면 탐색 없음" floor) but every number/word is
 * read from the policy, not hardcoded — because §0-1's whole point is that
 * kids/K-pop/2030 each need a genuinely different axis set, slot count, and
 * tone, not a re-skinned senior engine.
 */

export interface PolicyExplorationSlotPlan {
  enabled: boolean;
  workspaceId: WorkspaceId;
  trackNos: number[];
  axis: ExplorationAxis | null;
  reason?: 'not-enabled-for-workspace' | 'set-too-small' | 'legacy-engine';
}

/** Same "not daily-reset, real persistent count" rotation core/explorationSlots.ts's own explorationAxisForSequence uses — driven by core/explorationLedger.ts's nextAxisSequence (workspace-scoped already). */
export function explorationAxisForPolicySequence(policy: WorkspaceExplorationPolicy, setSequence: number): ExplorationAxis | null {
  if (!policy.axes.length) return null;
  const index = ((setSequence % policy.axes.length) + policy.axes.length) % policy.axes.length;
  return policy.axes[index];
}

/**
 * §3-4/§9 "탐색 슬롯을 1~3번에 두지 마십시오 (동요는 예외 없음)" — the
 * `Math.max(4, ...)` clamp below enforces that for every workspace, not just
 * kids, exactly like core/explorationSlots.ts's own selectExplorationTrackNos.
 */
export function selectPolicyExplorationTrackNos(songCount: number, workspaceId: WorkspaceId, setSequence: number): PolicyExplorationSlotPlan {
  const policy = explorationPolicyFor(workspaceId);
  if (!policy || policy.legacyEngine || !policy.enabled) {
    return { enabled: false, workspaceId, trackNos: [], axis: null, reason: 'not-enabled-for-workspace' };
  }
  if (songCount < policy.minSongCount) {
    return { enabled: false, workspaceId, trackNos: [], axis: null, reason: 'set-too-small' };
  }
  const trackNos = policy.slotPositionFractions
    .map(fraction => Math.max(4, Math.min(songCount - 1, Math.round(songCount * fraction))))
    .filter((value, index, arr) => arr.indexOf(value) === index) // de-dupe positions that round to the same track at small songCounts
    .slice(0, policy.slotCount)
    .sort((a, b) => a - b);
  return { enabled: true, workspaceId, trackNos, axis: explorationAxisForPolicySequence(policy, setSequence) };
}

/**
 * §3-4 — kr-idol-male/kr-idol-female share one axis set (KPOP_AXES) but the
 * gender-fixed constraint differs per channel; rather than duplicate the
 * whole frozen list per workspace, the one gender-specific line is appended
 * here at render time.
 */
function genderFrozenLineFor(workspaceId: WorkspaceId): string | null {
  if (workspaceId === 'kr-idol-male') return '남성 보컬 (이 채널은 남성 보컬 고정)';
  if (workspaceId === 'kr-idol-female') return '여성 보컬 (이 채널은 여성 보컬 고정)';
  return null;
}

/**
 * §2-4/§9 "동요에 '실패해도 됩니다'를 쓰지 말 것" — the one hard split in this
 * function: `policy.noFailureFraming` (true only for kr-kids/jp-kids) skips
 * straight to `policy.closingLineKo`, never assembling any "실패" wording.
 * Every other workspace still gets its own closingLineKo (a "one good track
 * out of N is success" framing, just worded per-workspace — §3-4's "세 곡 중
 * 하나만 좋아도 성공입니다", §4's "가장 자유로워야" tone).
 */
export function buildPolicyExplorationInstructionLines(plan: PolicyExplorationSlotPlan): string[] {
  if (!plan.enabled || !plan.axis || !plan.trackNos.length) return [];
  const policy = explorationPolicyFor(plan.workspaceId);
  if (!policy || policy.legacyEngine) return [];
  const trackLabel = plan.trackNos.map(n => `T${n}`).join(' · ');
  const frozenLines = [...policy.frozen];
  const genderLine = genderFrozenLineFor(plan.workspaceId);
  if (genderLine) frozenLines.push(genderLine);

  return [
    '',
    `[탐색 슬롯 — ${trackLabel}]`,
    '',
    `  이 ${plan.trackNos.length}곡은 새로운 방식을 시도해 보십시오.`,
    `  이번 세트의 탐색 축은 "${plan.axis.labelKo}"입니다.`,
    '',
    `  ${plan.axis.promptKo}`,
    '',
    '  예시',
    ...plan.axis.examplesKo.map(line => `    ${line}`),
    '',
    policy.noFailureFraming ? '  단, 다음은 반드시 지키십시오' : '  단, 다음은 지키십시오',
    ...frozenLines.map(line => `    ${line}`),
    '',
    `  ${policy.closingLineKo}`
  ];
}

export { EXPLORATION_POLICIES };
