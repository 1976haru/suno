/**
 * v4.0 (TASK D, P1) — audit report §9-4's own finding: an experimental
 * feature's error (audio analysis, image generation, ...) had no
 * structural reason it couldn't take down the core generation flow — no
 * flag distinguished "this must always work" from "this is still being
 * proven out". `FeatureStatus` is documentation-and-gating combined: the
 * UI reads it for badges, and call sites of an experimental/scaffold
 * feature are expected to isolate their own errors (try/catch, never let
 * an exception here reach a core-flow boundary) — see
 * AudioAnalysisPanel.tsx's own per-file try/catch for the existing
 * pattern this task extends, not invents.
 */
export type FeatureStatus = 'production' | 'experimental' | 'scaffold' | 'disabled';

export const FEATURES: Record<string, FeatureStatus> = {
  seniorSetGeneration: 'production',
  qualityGates: 'production',
  bridgeInstruction: 'production',
  srtExport: 'production',
  standaloneProgressMode: 'production',
  workspaceTransfer: 'production',

  audioAnalysis: 'experimental',
  audioEdit: 'experimental',
  ratingLearning: 'experimental',
  imageGeneration: 'experimental',
  /** v4.15 (TASK A/B) — new audio tooling, same isolate-your-own-errors expectation as audioAnalysis/audioEdit above. */
  shortsHighlight: 'experimental',
  audioArchive: 'experimental',

  kr2030: 'scaffold',
  jp2030: 'scaffold',
  krKids: 'scaffold',
  jpKids: 'scaffold'
};

export const FEATURE_STATUS_LABEL_KO: Record<FeatureStatus, string> = {
  production: '',
  experimental: '실험',
  scaffold: '준비 중',
  disabled: '비활성'
};

export function featureStatus(id: keyof typeof FEATURES): FeatureStatus {
  return FEATURES[id] ?? 'production';
}
