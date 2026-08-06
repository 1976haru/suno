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
import type { WorkspaceId } from '../types';
import { getWorkspace } from './workspaces';

export type FeatureStatus = 'production' | 'experimental' | 'scaffold' | 'disabled';

/**
 * TASK H — real audit finding: kr2030/jp2030/krKids/jpKids were hand-set to
 * 'scaffold' here back when this file was written, but
 * data/workspaces/index.ts's own `ready` field (the actual, currently-real
 * mechanism WorkspaceSelectScreen.tsx and core/generationPreflight.ts's
 * workspaceScaffoldHardBlock both gate real workspace usability on — see
 * that function's own doc comment) has carried `ready: true` for all 4 of
 * these workspaces since v5.7/v5.8/TASK E1/TASK F1 respectively. Nothing in
 * this codebase currently reads FEATURES.kr2030/jp2030/krKids/jpKids at all
 * (verified: Sidebar.tsx/Step4Result.tsx, the only two real featureStatus()
 * callers, only ever look up 'ratingLearning'/'imageGeneration'/
 * 'audioAnalysis') — but that's exactly why the drift went unnoticed this
 * long, and it means the stale value is a live landmine for the next badge
 * that DOES read one of these 4 keys, not a hypothetical one.
 *
 * Fix: derive these 4 from `ready` directly (statusForWorkspace below)
 * instead of a separately hand-maintained literal — a derived value cannot
 * go stale again the way a manually-set one already did once; re-syncing it
 * by hand here would only prevent THIS drift, not the next one.
 */
function statusForWorkspace(id: WorkspaceId): FeatureStatus {
  return getWorkspace(id).ready ? 'production' : 'scaffold';
}

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

  kr2030: statusForWorkspace('kr-2030'),
  jp2030: statusForWorkspace('jp-2030'),
  krKids: statusForWorkspace('kr-kids'),
  jpKids: statusForWorkspace('jp-kids')
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
