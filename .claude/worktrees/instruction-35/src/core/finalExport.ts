import type { GenerationSnapshot, SongScores, WorkspaceId } from '../types';
import type { AlbumAuditReport } from './albumAudit';
import type { ReleaseReadinessReport } from './releaseReadiness';
import type { ArtifactAuditMeta, ArtifactStage } from './artifactStage';
import type { FinalizedBlueprint } from './finalizeBlueprint';
import { classifyTitleHookRelationship, type TitleHookRelationship } from './titleHookRelationship';
import { WORKSPACE_POLICY_VERSION } from './artifactStage';

/**
 * codex 지시문 05 (TASK G) — real export-artifact assembler, the first
 * real consumer of core/finalizeBlueprint.ts's FinalizedBlueprint (TASK B).
 * Investigation confirmed core/standaloneProgressExport.ts's existing
 * StandaloneSong carries only raw song fields — none of this task's own
 * required fields (scores/warnings/album audit/release readiness/
 * workspace policy version/scene signature/title-hook relationship/rewrite
 * history) exist in that export today. This is a NEW, separate export
 * shape — it does not replace standaloneProgressExport.ts's own real
 * purpose (a human-facing offline viewer HTML), it's the machine-readable
 * generation-artifact record this task's own §6 asks for.
 */

export interface RewriteRoundRecord {
  round: number;
  scope: string;
  issuesResolvedCount: number;
  timestamp: string;
}

export interface FinalExportSceneSignature {
  situation: string;
  frameId?: string;
}

export interface FinalExportSong {
  trackNo: number;
  title: string;
  lyrics: string;
  stylePrompt: string;
  hookPhrase: string;
  scores?: SongScores;
  warnings: string[];
  sceneSignature: FinalExportSceneSignature;
  titleHookRelationship: TitleHookRelationship;
}

export interface FinalExportArtifact {
  generationSnapshot: GenerationSnapshot;
  artifactAuditMeta: ArtifactAuditMeta;
  songs: FinalExportSong[];
  warnings: string[];
  albumAudit: AlbumAuditReport;
  releaseReadiness: ReleaseReadinessReport;
  workspacePolicyId: WorkspaceId;
  workspacePolicyVersion: string;
  /**
   * Real, caller-supplied history — this app has no persisted "N automatic
   * rewrite rounds already ran on this exact pack" store yet (confirmed by
   * investigation: core/rewriteLoop.ts itself has zero real callers today).
   * Defaults to empty (a pack that never went through a rewrite round) —
   * honest, not fabricated.
   */
  rewriteHistory: RewriteRoundRecord[];
}

export function buildFinalExportArtifact(
  finalized: FinalizedBlueprint,
  workspaceId: WorkspaceId,
  rewriteHistory: RewriteRoundRecord[] = []
): FinalExportArtifact {
  const songs: FinalExportSong[] = finalized.blueprint.songs.map(song => ({
    trackNo: song.trackNo,
    title: song.title,
    lyrics: song.lyrics,
    stylePrompt: song.stylePrompt,
    hookPhrase: song.hookPhrase,
    scores: song.scores,
    warnings: song.warnings ?? [],
    sceneSignature: { situation: song.listenerSituation, frameId: song.lyricFrameId },
    titleHookRelationship: classifyTitleHookRelationship(song.title, song.hookPhrase)
  }));

  return {
    generationSnapshot: finalized.snapshot,
    artifactAuditMeta: finalized.artifactMeta,
    songs,
    warnings: [...finalized.schemaIssues, ...finalized.trackNoValidationSummaryKo.split(' / ').filter(Boolean), ...finalized.slotReconciliation.drift, ...finalized.workspacePolicyIssues, ...finalized.albumAudit.warnings],
    albumAudit: finalized.albumAudit,
    releaseReadiness: finalized.releaseReadiness,
    workspacePolicyId: workspaceId,
    workspacePolicyVersion: WORKSPACE_POLICY_VERSION,
    rewriteHistory
  };
}

/**
 * codex 지시문 05 (TASK G) — the real stage-suffixed filename convention:
 * `*.raw-provider.json` / `*.audited.json` / `*.lyrics-prompt-ready.json` /
 * `*.release-ready.json`. `release-audited`/`rewrite-pending` both map onto
 * the `.audited.json` suffix (the spec's own literal 4-suffix list has no
 * separate slot for those two intermediate stages — both mean "an audit
 * pass has run and this isn't final yet", the real distinction a reader of
 * the FILE NAME cares about) — `normalized`/`scored` (pre-audit stages)
 * fall back to `.raw-provider.json` for the same reason: from a file-naming
 * consumer's perspective, "not yet audited" is the only thing that matters
 * pre-audit, not which exact internal step got there.
 */
export function finalExportStageSuffix(stage: ArtifactStage): 'raw-provider' | 'audited' | 'lyrics-prompt-ready' | 'release-ready' {
  if (stage === 'lyrics-prompt-ready') return 'lyrics-prompt-ready';
  if (stage === 'release-ready') return 'release-ready';
  if (stage === 'release-audited' || stage === 'rewrite-pending') return 'audited';
  return 'raw-provider';
}

export function finalExportFileName(baseName: string, stage: ArtifactStage): string {
  return `${baseName}.${finalExportStageSuffix(stage)}.json`;
}
