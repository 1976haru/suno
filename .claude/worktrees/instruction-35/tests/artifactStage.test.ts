import { describe, expect, it } from 'vitest';
import { classifyArtifactStage, elevateToReleaseReady, buildArtifactAuditMeta, type ArtifactStageSignals } from '../src/core/artifactStage';

/**
 * codex 지시문 05 (TASK A, required test file) — real coverage of the 7-stage
 * ArtifactStage classification and the honest release-ready escape hatch.
 */

const CLEAN: ArtifactStageSignals = {
  hasRawProviderOutput: true,
  hasNormalizedSlots: true,
  hasScores: true,
  hasAlbumAudit: true,
  hasReleaseReadiness: true,
  releaseReadinessClean: true,
  rewriteInFlight: false
};

describe('[codex 지시문 05 TASK A] classifyArtifactStage — real ordered progression', () => {
  it('no raw output at all -> raw-provider', () => {
    expect(classifyArtifactStage({ ...CLEAN, hasRawProviderOutput: false })).toBe('raw-provider');
  });

  it('raw output but no normalized slots -> normalized (the next step still owed)', () => {
    expect(classifyArtifactStage({ ...CLEAN, hasNormalizedSlots: false })).toBe('normalized');
  });

  it('normalized but not yet scored -> scored (the next step still owed)', () => {
    expect(classifyArtifactStage({ ...CLEAN, hasScores: false })).toBe('scored');
  });

  it('scored but album audit/release readiness not yet run -> release-audited', () => {
    expect(classifyArtifactStage({ ...CLEAN, hasAlbumAudit: false })).toBe('release-audited');
    expect(classifyArtifactStage({ ...CLEAN, hasReleaseReadiness: false })).toBe('release-audited');
  });

  it('audited but release readiness still failing, or a rewrite round in flight -> rewrite-pending', () => {
    expect(classifyArtifactStage({ ...CLEAN, releaseReadinessClean: false })).toBe('rewrite-pending');
    expect(classifyArtifactStage({ ...CLEAN, rewriteInFlight: true })).toBe('rewrite-pending');
  });

  it('every real signal clean -> lyrics-prompt-ready, never further on its own', () => {
    expect(classifyArtifactStage(CLEAN)).toBe('lyrics-prompt-ready');
  });
});

describe('[codex 지시문 05 TASK A] elevateToReleaseReady — the one honest escape hatch', () => {
  it('never elevates without explicit audioConfirmed', () => {
    expect(elevateToReleaseReady('lyrics-prompt-ready', false)).toBe('lyrics-prompt-ready');
  });

  it('elevates lyrics-prompt-ready -> release-ready only when audioConfirmed is true', () => {
    expect(elevateToReleaseReady('lyrics-prompt-ready', true)).toBe('release-ready');
  });

  it('refuses to elevate an earlier stage even with audioConfirmed — real text problems still block release', () => {
    expect(elevateToReleaseReady('rewrite-pending', true)).toBe('rewrite-pending');
    expect(elevateToReleaseReady('scored', true)).toBe('scored');
  });
});

describe('[codex 지시문 05 TASK A] buildArtifactAuditMeta — real version fields, never fabricated stage', () => {
  it('a fully clean pack with no audio confirmation caps at lyrics-prompt-ready', () => {
    const meta = buildArtifactAuditMeta({ signals: CLEAN });
    expect(meta.stage).toBe('lyrics-prompt-ready');
    expect(meta.scorerVersion).toBeTruthy();
    expect(meta.auditSchemaVersion).toBeTruthy();
    expect(meta.workspacePolicyVersion).toBeTruthy();
  });

  it('an explicit audioConfirmed:true on an already-clean pack reaches release-ready', () => {
    const meta = buildArtifactAuditMeta({ signals: CLEAN, audioConfirmed: true });
    expect(meta.stage).toBe('release-ready');
  });

  it('carries through sourceProvider/sourceModel/timestamps when the caller supplies them', () => {
    const meta = buildArtifactAuditMeta({ signals: CLEAN, sourceProvider: 'anthropic', sourceModel: 'claude-sonnet-5', scoredAt: '2026-01-01T00:00:00.000Z' });
    expect(meta.sourceProvider).toBe('anthropic');
    expect(meta.sourceModel).toBe('claude-sonnet-5');
    expect(meta.scoredAt).toBe('2026-01-01T00:00:00.000Z');
  });
});
