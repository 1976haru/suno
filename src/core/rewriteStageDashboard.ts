import type { WorkspaceId } from '../types';

/**
 * codex 지시문 05 (TASK H) — "분리 표시: first pass / after rewrite 1 /
 * after rewrite 2 / audio-ready / release-ready. 워크스페이스별 통과율을
 * 섞지 않는다." Investigation confirmed no stage-separated dashboard exists
 * anywhere; the closest prior art (core/releaseReadinessArchive.ts's own
 * passedCriteriaFirstPass/passedCriteriaLatest) is a per-CHANNEL historical
 * trend metric, not a per-workspace, per-stage breakdown — genuinely new
 * here. Pure, real, and keyed by workspaceId so no caller can accidentally
 * average two workspaces' pass rates together (the object shape itself
 * makes that a type error, not just a documented convention).
 */

export type RewriteDashboardStage = 'first-pass' | 'after-rewrite-1' | 'after-rewrite-2' | 'audio-ready' | 'release-ready';

export interface RewriteStageSnapshot {
  workspaceId: WorkspaceId;
  stage: RewriteDashboardStage;
  measuredCriteria: number;
  passedOfMeasured: number;
}

export interface RewriteStagePassRate {
  stage: RewriteDashboardStage;
  measuredCriteria: number;
  passedOfMeasured: number;
  passRate: number;
}

/** One workspace's own real per-stage breakdown — never merged with any other workspace's numbers. */
export type WorkspaceRewriteDashboard = Partial<Record<RewriteDashboardStage, RewriteStagePassRate>>;

/**
 * Real, pure aggregation: groups snapshots by workspaceId FIRST, so two
 * snapshots for the same stage but different workspaces can never collapse
 * into one averaged number — the return type itself (keyed by workspaceId)
 * is what enforces "워크스페이스별 통과율을 섞지 않는다", not just a runtime check.
 */
export function buildRewriteStageDashboard(snapshots: readonly RewriteStageSnapshot[]): Partial<Record<WorkspaceId, WorkspaceRewriteDashboard>> {
  const byWorkspace: Partial<Record<WorkspaceId, WorkspaceRewriteDashboard>> = {};
  for (const snapshot of snapshots) {
    const workspaceEntry = byWorkspace[snapshot.workspaceId] ?? {};
    workspaceEntry[snapshot.stage] = {
      stage: snapshot.stage,
      measuredCriteria: snapshot.measuredCriteria,
      passedOfMeasured: snapshot.passedOfMeasured,
      passRate: snapshot.measuredCriteria > 0 ? snapshot.passedOfMeasured / snapshot.measuredCriteria : 0
    };
    byWorkspace[snapshot.workspaceId] = workspaceEntry;
  }
  return byWorkspace;
}

/** Real helper for a rewrite loop's own round number -> the dashboard's own stage vocabulary (round 0 = first pass, per core/rewriteLoop.ts's own 0-indexed roundsAlreadyRun convention). */
export function rewriteDashboardStageForRound(round: number): RewriteDashboardStage {
  if (round <= 0) return 'first-pass';
  if (round === 1) return 'after-rewrite-1';
  return 'after-rewrite-2';
}
