/**
 * codex 지시문 05 (TASK A) — real, genuinely new lifecycle-stage concept.
 * Investigation confirmed nothing like this exists today: no `stage`/
 * lifecycle field on any type, no `scorerVersion`/`auditSchemaVersion`/
 * `workspacePolicyVersion` anywhere in src/. GenerationSnapshot's own real
 * `appVersion`/`schemaVersion` (지시문 01 TASK F) capture what BUILD produced
 * an artifact, not how FAR that artifact has progressed through scoring/
 * audit/rewrite — a different axis, tracked here instead.
 *
 * "실제 오디오 전에는 `lyrics-prompt-ready`까지만 가능하다" — this app has no
 * real audio-rendering capability anywhere (confirmed: SongScores.renderScore
 * is "undefined when no audio take exists for this song yet", never computed
 * by this app itself). So `classifyArtifactStage` below only ever DERIVES a
 * stage up to and including 'lyrics-prompt-ready' from real, in-app signals.
 * 'release-ready' is a valid enum value (TASK G's export naming needs it),
 * but this app can never compute it automatically — it's only ever set via
 * an explicit, honestly-named external confirmation (see
 * `elevateToReleaseReady` below), never inferred from text-only signals.
 */

export type ArtifactStage =
  | 'raw-provider'
  | 'normalized'
  | 'scored'
  | 'release-audited'
  | 'rewrite-pending'
  | 'lyrics-prompt-ready'
  | 'release-ready';

export interface ArtifactAuditMeta {
  stage: ArtifactStage;
  sourceProvider?: string;
  sourceModel?: string;
  normalizedAt?: string;
  scoredAt?: string;
  auditedAt?: string;
  scorerVersion: string;
  auditSchemaVersion: string;
  workspacePolicyVersion: string;
}

/**
 * Real, current version numbers for the 3 version fields — bumped by hand
 * whenever the corresponding real logic changes shape in a way a consumer
 * (export reader, dashboard) would need to know about. Starting at 1 for
 * all three since this is the first version of each concept to ever exist.
 *
 * codex 지시문 07 (TASK H) — real clarification, not drift: these 3 are a
 * DIFFERENT axis from `package.json`'s own app version (지시문 18 이후
 * `0.NN.P` — see docs/CHANGELOG.md, whose single source of truth is
 * `package.json`'s `version` field) and `core/schemaVersion.ts`'s
 * `CURRENT_SCHEMA_VERSION` (IndexedDB data-shape version) — they version
 * the SCORING/AUDIT PIPELINE ITSELF (how `finalizeBlueprintForUse` computed
 * a given artifact's scores/audit), independent of which app build or which
 * IndexedDB shape produced it. A pack scored under scorerVersion '1' stays
 * legible even after the app's own semver moves on, as long as this
 * constant hasn't changed. (This comment previously pointed to a
 * "CHANGELOG.md v5.25.0 entry" for the app/schema reconciliation this task
 * found — no such file existed until 지시문 18 created docs/CHANGELOG.md;
 * that reference was stale from the start.)
 */
export const SCORER_VERSION = '1';
export const AUDIT_SCHEMA_VERSION = '1';
export const WORKSPACE_POLICY_VERSION = '1';

export interface ArtifactStageSignals {
  hasRawProviderOutput: boolean;
  hasNormalizedSlots: boolean;
  hasScores: boolean;
  hasAlbumAudit: boolean;
  hasReleaseReadiness: boolean;
  /** True once every blocking release-readiness finding has been resolved (no more rewrite needed). */
  releaseReadinessClean: boolean;
  /** True while a rewrite round has been dispatched and its result not yet folded back in. */
  rewriteInFlight: boolean;
}

/**
 * Real, ordered classification — each stage requires everything the
 * previous one required, so a caller can't accidentally skip forward by
 * only setting a later flag. Mirrors TASK B's own finalizeBlueprintForUse
 * step order (schema/trackNo/reconcile -> normalized, scoreSongs -> scored,
 * album audit + release readiness -> release-audited, rewrite dispatched ->
 * rewrite-pending, release readiness clean -> lyrics-prompt-ready).
 */
export function classifyArtifactStage(signals: ArtifactStageSignals): ArtifactStage {
  if (!signals.hasRawProviderOutput) return 'raw-provider';
  if (!signals.hasNormalizedSlots) return 'normalized';
  if (!signals.hasScores) return 'scored';
  if (!signals.hasAlbumAudit || !signals.hasReleaseReadiness) return 'release-audited';
  if (signals.rewriteInFlight || !signals.releaseReadinessClean) return 'rewrite-pending';
  return 'lyrics-prompt-ready';
}

/**
 * The one, explicit, honestly-named escape hatch to 'release-ready' — never
 * called by classifyArtifactStage itself. A caller who has confirmed real
 * audio exists for every track (a fact this app cannot measure) passes the
 * already-classified stage through here to elevate it. Refuses to elevate
 * anything short of 'lyrics-prompt-ready' — real audio can't make an
 * artifact that still has unresolved text-level problems "release-ready".
 */
export function elevateToReleaseReady(stage: ArtifactStage, audioConfirmed: boolean): ArtifactStage {
  if (!audioConfirmed) return stage;
  return stage === 'lyrics-prompt-ready' ? 'release-ready' : stage;
}

export interface BuildArtifactAuditMetaInput {
  signals: ArtifactStageSignals;
  sourceProvider?: string;
  sourceModel?: string;
  normalizedAt?: string;
  scoredAt?: string;
  auditedAt?: string;
  audioConfirmed?: boolean;
}

export function buildArtifactAuditMeta(input: BuildArtifactAuditMetaInput): ArtifactAuditMeta {
  const stage = elevateToReleaseReady(classifyArtifactStage(input.signals), input.audioConfirmed ?? false);
  return {
    stage,
    sourceProvider: input.sourceProvider,
    sourceModel: input.sourceModel,
    normalizedAt: input.normalizedAt,
    scoredAt: input.scoredAt,
    auditedAt: input.auditedAt,
    scorerVersion: SCORER_VERSION,
    auditSchemaVersion: AUDIT_SCHEMA_VERSION,
    workspacePolicyVersion: WORKSPACE_POLICY_VERSION
  };
}
