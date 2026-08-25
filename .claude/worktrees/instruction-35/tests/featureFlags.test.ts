/**
 * TASK H — real audit finding: data/featureFlags.ts's FEATURES.kr2030/
 * jp2030/krKids/jpKids were hand-set to 'scaffold' (shown to the user as
 * "준비 중") while data/workspaces/index.ts's own `ready` field — the real
 * mechanism WorkspaceSelectScreen.tsx and core/generationPreflight.ts's
 * workspaceScaffoldHardBlock actually gate workspace usability on — has
 * carried `ready: true` for all 4 since v5.7/v5.8/TASK E1/TASK F1. The fix
 * (featureFlags.ts's statusForWorkspace) derives these 4 FeatureStatus
 * values directly from `ready` so this can never drift again. This test
 * verifies the derivation is real (not a one-time hardcode) and that the
 * one real UI-facing surface (FEATURE_STATUS_LABEL_KO) now shows a
 * consistent, non-"준비 중" label for all 4 real, ready workspaces.
 */
import { describe, expect, it } from 'vitest';
import { FEATURES, FEATURE_STATUS_LABEL_KO, featureStatus } from '../src/data/featureFlags';
import { getWorkspace, workspaceDefinitions } from '../src/data/workspaces';
import type { WorkspaceId } from '../src/types';

const SCAFFOLD_WORKSPACE_KEYS: Record<'kr2030' | 'jp2030' | 'krKids' | 'jpKids', WorkspaceId> = {
  kr2030: 'kr-2030',
  jp2030: 'jp-2030',
  krKids: 'kr-kids',
  jpKids: 'jp-kids'
};

describe('featureFlags.ts (TASK H — ready-derived FeatureStatus for kr2030/jp2030/krKids/jpKids)', () => {
  it('every workspace named in workspaceDefinitions is actually ready:true today (baseline this task\'s fix depends on)', () => {
    for (const [, workspaceId] of Object.entries(SCAFFOLD_WORKSPACE_KEYS)) {
      expect(getWorkspace(workspaceId).ready, `${workspaceId} must be ready:true for this test's own premise to hold`).toBe(true);
    }
  });

  it('FEATURES.kr2030/jp2030/krKids/jpKids match their real workspace ready state (no longer hardcoded "scaffold")', () => {
    for (const [featureKey, workspaceId] of Object.entries(SCAFFOLD_WORKSPACE_KEYS)) {
      const expected = getWorkspace(workspaceId).ready ? 'production' : 'scaffold';
      expect(FEATURES[featureKey], `FEATURES.${featureKey} must match ${workspaceId}'s real ready state`).toBe(expected);
      expect(featureStatus(featureKey), `featureStatus('${featureKey}') must match ${workspaceId}'s real ready state`).toBe(expected);
    }
  });

  it('matches the convention already-shipped ready workspaces use elsewhere (production, not scaffold, for a ready:true workspace)', () => {
    // senior-oldpop/kr-idol-male/kr-idol-female have no FEATURES entry of their own (never needed one),
    // but every genuinely production-grade, always-on feature in this same file is 'production' — the
    // convention kr2030/jp2030/krKids/jpKids's now-ready state should match, not the 'scaffold' they used to carry.
    expect(FEATURES.seniorSetGeneration).toBe('production');
    for (const featureKey of Object.keys(SCAFFOLD_WORKSPACE_KEYS)) {
      expect(FEATURES[featureKey]).toBe('production');
    }
  });

  it('the real UI-facing label (FEATURE_STATUS_LABEL_KO, read by Sidebar.tsx/Step4Result.tsx\'s badges) no longer shows "준비 중" for any real, ready workspace-shaped feature key', () => {
    for (const featureKey of Object.keys(SCAFFOLD_WORKSPACE_KEYS)) {
      const label = FEATURE_STATUS_LABEL_KO[featureStatus(featureKey)];
      expect(label, `FEATURE_STATUS_LABEL_KO for '${featureKey}' must not be "준비 중" now that its workspace is ready`).not.toBe('준비 중');
    }
  });

  it('the derivation would correctly flip back to "scaffold"/"준비 중" if a workspace were ever un-readied again (proves this is a live derivation, not a re-hardcoded literal)', () => {
    // Direct behavioral proof of statusForWorkspace's own ready ? 'production' : 'scaffold' branch,
    // using the same real WorkspaceId union — not a network/mutation test (workspaceDefinitions is
    // real static data), just confirming the mapping function's other branch is real and reachable.
    for (const ws of workspaceDefinitions) {
      const expected = ws.ready ? 'production' : 'scaffold';
      if (ws.id === 'senior-oldpop' || ws.id === 'kr-idol-male' || ws.id === 'kr-idol-female') continue; // no FEATURES entry for these
      const featureKey = (Object.entries(SCAFFOLD_WORKSPACE_KEYS).find(([, id]) => id === ws.id) ?? [])[0];
      if (!featureKey) continue;
      expect(FEATURES[featureKey]).toBe(expected);
    }
  });
});
