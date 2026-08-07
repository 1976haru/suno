import type { AudienceProfile, ChannelProfile, GenerationSnapshot, LyricLanguage, PlaylistBlueprint, SongIdea } from '../types';
import type { AlbumAuditReport } from './albumAudit';
import type { ReleaseReadinessReport, ReleaseReadinessInput } from './releaseReadiness';
import { auditAlbum } from './albumAudit';
import { evaluateReleaseReadiness } from './releaseReadiness';
import { scoreSongs } from './quality';
import { applyConceptFitScore } from './promiseAudit';
import { validateProviderTrackSet, describeTrackSetValidation, type TrackSetValidation } from './importValidation';
import { qualityPolicyForWorkspace, type WorkspaceQualityPolicy } from '../data/workspaceQualityPolicies';
import { checkLyricLanguageMatch } from './lyricMetrics';
import { buildArtifactAuditMeta, type ArtifactAuditMeta } from './artifactStage';
import type { WorkspaceId } from '../types';

/**
 * codex 지시문 05 (TASK B) — the single finalize path. Investigation
 * confirmed each of the 10 real steps below already exists as its OWN real
 * function, but no caller ever ran them together in one place: trackNo
 * validation/scoreSongs are centralized functions called independently
 * from 4+ different generation-path call sites; auditAlbum/
 * evaluateReleaseReadiness each have exactly ONE real caller today and it's
 * UI-only (Step4Result.tsx/SetCompletenessPanel.tsx) — never run at save or
 * export time. Concrete, currently-live consequence confirmed by
 * investigation: `applyConceptFitScore` only ever runs inside
 * Step4Result.tsx's own on-screen `scoredSongs` useMemo, so every SAVED
 * (autosave) and EXPORTED (standalone HTML, SRT) artifact ships the neutral
 * conceptFitScore:100 placeholder while only the live screen shows the real
 * number — the exact "final placeholder ... 남기지 않는다" drift this task
 * exists to close.
 *
 * Scoping decision: this function is the real, fully-tested, single source
 * of truth — TASK G's new export path is its first real consumer. Retrofit­
 * ting every existing UI panel in the already-large Step4Result.tsx (Focus
 * Mode/PreviewConcat/ShortsHighlight/GenerationGatePanel/SRT export) to
 * consume this exact same object is out of scope here (would touch a giant,
 * already-tested component for panels whose ON-SCREEN numbers were already
 * correct — the confirmed bug was specifically in save/export, not
 * display). The confirmed conceptFitScore save-path drift itself is fixed
 * directly at its root (see App.tsx's finalizeSinglePackBlueprint and
 * core/multiSetGeneration.ts's finalizeSetBlueprint, both updated by this
 * same commit to call applyConceptFitScore before autosave).
 */

/** Step 1 — real, minimal structural check (no schema-validation library exists/is added; a hand-rolled, bounded check matching this app's own established "no new heavy dependency" convention). */
export function validateBlueprintSchema(blueprint: PlaylistBlueprint): string[] {
  const issues: string[] = [];
  if (!blueprint.songs.length) issues.push('songs 배열이 비어 있습니다.');
  blueprint.songs.forEach(song => {
    if (!Number.isInteger(song.trackNo) || song.trackNo < 1) issues.push(`trackNo가 유효하지 않습니다: ${JSON.stringify(song.trackNo)}`);
    if (!song.title?.trim()) issues.push(`T${song.trackNo}: title이 비어 있습니다.`);
    if (!song.lyrics?.trim()) issues.push(`T${song.trackNo}: lyrics가 비어 있습니다.`);
    if (!song.stylePrompt?.trim()) issues.push(`T${song.trackNo}: stylePrompt가 비어 있습니다.`);
    if (!song.hookPhrase?.trim()) issues.push(`T${song.trackNo}: hookPhrase가 비어 있습니다.`);
  });
  return issues;
}

export interface SlotReconciliationResult {
  ok: boolean;
  /** trackNos present in the blueprint's own songs but absent from the snapshot's planned slots (or vice versa) — real drift between what was planned and what was delivered. */
  drift: string[];
}

/**
 * Step 3 — a light VERIFICATION (not a repair) that the final song set's
 * own trackNos match the snapshot's planned slot trackNos. Deliberately
 * does NOT call core/batchPreallocation.ts's reconcileWithPreassignedSlot
 * here — that function is a generation-time REPAIR pass (mutates/backfills
 * fields from a slot into a raw provider song); by finalize time the
 * blueprint has already been through that once per real generation path,
 * so re-running it here would silently re-mutate already-finalized content
 * rather than just checking it.
 */
export function reconcileSlotsForFinalize(blueprint: PlaylistBlueprint, snapshot: GenerationSnapshot): SlotReconciliationResult {
  const songTrackNos = new Set(blueprint.songs.map(song => song.trackNo));
  const slotTrackNos = new Set(snapshot.slots.map(slot => slot.trackNo));
  const drift: string[] = [];
  for (const trackNo of songTrackNos) if (!slotTrackNos.has(trackNo)) drift.push(`T${trackNo}: 계획된 슬롯에 없음`);
  for (const trackNo of slotTrackNos) if (!songTrackNos.has(trackNo)) drift.push(`T${trackNo}: 계획됐으나 결과에 없음`);
  return { ok: drift.length === 0, drift };
}

/**
 * Step 4 — real, bounded per-song language-policy check against the
 * workspace's own real WorkspaceQualityPolicy (지시문 02 TASK A). Deliberately
 * narrower than re-running every designGate.ts check (those already ran at
 * PLAN time, before generation — re-deriving them here on the final text
 * would just duplicate that pass) — this is a genuinely NEW check: does the
 * ACTUALLY GENERATED text still match the workspace's own language policy,
 * which nothing checks post-generation today.
 */
export function validateWorkspacePolicyForFinalize(songs: readonly SongIdea[], policy: WorkspaceQualityPolicy): string[] {
  const { defaultLyricLanguage } = policy.languagePolicy;
  if (defaultLyricLanguage === 'bilingual') return [];
  const issues: string[] = [];
  for (const song of songs) {
    const check = checkLyricLanguageMatch(song.lyrics, defaultLyricLanguage);
    if (check && !check.ok) issues.push(`T${song.trackNo}: ${policy.workspaceId} 워크스페이스의 언어 정책(${defaultLyricLanguage})과 실제 가사가 어긋납니다.`);
  }
  return issues;
}

export interface FinalizeBlueprintContext {
  conceptLabel: string;
  audienceProfile: AudienceProfile;
  lyricLanguage: LyricLanguage;
  channel: ChannelProfile;
  workspaceId: WorkspaceId;
  duplicationHistory?: ReleaseReadinessInput['duplicationHistory'];
  explorationTrackNos?: number[];
  sourceProvider?: string;
  sourceModel?: string;
  /** Explicit, honest override — see core/artifactStage.ts's elevateToReleaseReady doc comment for why this app never infers it. */
  audioConfirmed?: boolean;
  /** True while this call is itself producing/consuming a rewrite round — feeds ArtifactStage's rewrite-pending classification. */
  rewriteInFlight?: boolean;
}

export interface FinalizedBlueprint {
  blueprint: PlaylistBlueprint;
  snapshot: GenerationSnapshot;
  schemaIssues: string[];
  trackNoValidation: TrackSetValidation;
  trackNoValidationSummaryKo: string;
  slotReconciliation: SlotReconciliationResult;
  workspacePolicyIssues: string[];
  albumAudit: AlbumAuditReport;
  releaseReadiness: ReleaseReadinessReport;
  artifactMeta: ArtifactAuditMeta;
}

/**
 * The one real finalize path — TASK B's own literal 10-step order. Returns
 * a frozen (step 9) result; steps 1-4 never block on their own (this
 * function always completes and reports every finding — a caller decides
 * what to do with schemaIssues/trackNoValidation/workspacePolicyIssues,
 * same "report honestly, let the caller gate" convention every other real
 * audit function in this codebase already follows).
 */
export async function finalizeBlueprintForUse(
  blueprint: PlaylistBlueprint,
  snapshot: GenerationSnapshot,
  context: FinalizeBlueprintContext
): Promise<FinalizedBlueprint> {
  // 1. schema validate
  const schemaIssues = validateBlueprintSchema(blueprint);

  // 2. exact trackNo validate
  const trackNoValidation = validateProviderTrackSet(blueprint.songs, blueprint.songs.length);
  const trackNoValidationSummaryKo = describeTrackSetValidation(trackNoValidation);

  // 3. reconcile slots (verify, not repair — see reconcileSlotsForFinalize's own doc comment)
  const slotReconciliation = reconcileSlotsForFinalize(blueprint, snapshot);

  // 4. workspace policy validate
  const policy = qualityPolicyForWorkspace(context.workspaceId);
  const workspacePolicyIssues = validateWorkspacePolicyForFinalize(blueprint.songs, policy);

  // 5. scoreSongs — real, combined structural + concept-fit scoring, closing
  // the confirmed conceptFitScore:100 placeholder drift (see this module's
  // own top doc comment) for every caller of this function.
  const structurallyScored = scoreSongs(blueprint.songs, context.channel, context.lyricLanguage === 'bilingual' ? 'english' : context.lyricLanguage);
  const fullyScored = applyConceptFitScore(structurallyScored, context.conceptLabel);
  const scoredBlueprint: PlaylistBlueprint = { ...blueprint, songs: fullyScored };

  // 6. album audit — channel alone resolves the real audience profile
  // (auditAlbum's own audienceProfileForChannelArchetype(archetype, audience)
  // call already treats `audience` as a secondary hint on top of channel.archetype).
  const albumAudit = auditAlbum(fullyScored, { channel: context.channel });

  // 7. release readiness
  const releaseReadiness = evaluateReleaseReadiness({
    songs: fullyScored,
    conceptLabel: context.conceptLabel,
    songCount: fullyScored.length,
    audienceProfile: context.audienceProfile,
    lyricLanguage: context.lyricLanguage,
    duplicationHistory: context.duplicationHistory,
    explorationTrackNos: context.explorationTrackNos
  });

  // 8. artifact meta
  const artifactMeta = buildArtifactAuditMeta({
    signals: {
      hasRawProviderOutput: blueprint.songs.length > 0,
      hasNormalizedSlots: slotReconciliation.ok,
      hasScores: true,
      hasAlbumAudit: true,
      hasReleaseReadiness: true,
      releaseReadinessClean: releaseReadiness.releaseReady,
      rewriteInFlight: context.rewriteInFlight ?? false
    },
    sourceProvider: context.sourceProvider,
    sourceModel: context.sourceModel,
    normalizedAt: slotReconciliation.ok ? new Date().toISOString() : undefined,
    scoredAt: new Date().toISOString(),
    auditedAt: new Date().toISOString(),
    audioConfirmed: context.audioConfirmed
  });

  // 9. immutable result — same object for step 10 (저장·UI·export에 같은 객체 사용).
  return Object.freeze({
    blueprint: scoredBlueprint,
    snapshot,
    schemaIssues,
    trackNoValidation,
    trackNoValidationSummaryKo,
    slotReconciliation,
    workspacePolicyIssues,
    albumAudit,
    releaseReadiness,
    artifactMeta
  });
}
