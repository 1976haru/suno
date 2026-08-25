import { describe, expect, it } from 'vitest';
import { qualityPolicyForWorkspace } from '../src/data/workspaceQualityPolicies';
import type { WorkspaceId } from '../src/types';

const ALL_WORKSPACE_IDS: WorkspaceId[] = ['senior-oldpop', 'kr-2030', 'jp-2030', 'kr-kids', 'jp-kids', 'kr-idol-male', 'kr-idol-female'];

/**
 * codex 지시문 02 (TASK A) — companion to tests/workspaceQualityPolicy.test.ts:
 * that file proves each workspace's policy is REAL and correctly populated;
 * this file proves policies stay properly SCOPED — one workspace's data
 * never leaks into another's resolved WorkspaceQualityPolicy, the same
 * "data isolation" concern scripts/isolationAudit.ts's own checkL1
 * (genre leakage) already established a precedent for, one layer up (policy
 * aggregation, not raw genre/theme data).
 */
describe('[codex 지시문 02 TASK A] cross-workspace policy isolation', () => {
  it('every workspace resolves its OWN workspaceId, never another\'s', () => {
    for (const id of ALL_WORKSPACE_IDS) {
      expect(qualityPolicyForWorkspace(id).workspaceId).toBe(id);
    }
  });

  it('exploration policy is workspace-scoped — each workspace\'s explorationPolicy.workspaceId matches its own, never a neighbor\'s', () => {
    for (const id of ALL_WORKSPACE_IDS) {
      expect(qualityPolicyForWorkspace(id).explorationPolicy.workspaceId).toBe(id);
    }
  });

  it('ownedGenreIds never overlaps between two workspaces with disjoint genre pools (kr-2030 vs jp-2030)', () => {
    const kr2030 = new Set(qualityPolicyForWorkspace('kr-2030').ownedGenreIds);
    const jp2030 = new Set(qualityPolicyForWorkspace('jp-2030').ownedGenreIds);
    const overlap = [...kr2030].filter(id => jp2030.has(id));
    expect(overlap).toEqual([]);
  });

  it('kr-idol-male and kr-idol-female legitimately SHARE their genre pool (real many-to-many ownership, not a leak) — both contain the same kridol- ids', () => {
    const male = new Set(qualityPolicyForWorkspace('kr-idol-male').ownedGenreIds);
    const female = new Set(qualityPolicyForWorkspace('kr-idol-female').ownedGenreIds);
    const kridolMale = [...male].filter(id => id.startsWith('kridol-'));
    expect(kridolMale.length).toBeGreaterThan(0);
    expect(kridolMale.every(id => female.has(id))).toBe(true);
  });

  it('kr-2030 never owns a kr-kids-prefixed genre id, and vice versa', () => {
    const kr2030 = qualityPolicyForWorkspace('kr-2030').ownedGenreIds;
    const krKids = qualityPolicyForWorkspace('kr-kids').ownedGenreIds;
    expect(kr2030.some(id => id.startsWith('krkids-'))).toBe(false);
    expect(krKids.some(id => id.startsWith('kr2030-'))).toBe(false);
  });

  it('performance-stage motif family is scoped to kr-idol-* only — no other workspace\'s scenePolicy includes it', () => {
    for (const id of ALL_WORKSPACE_IDS) {
      if (id === 'kr-idol-male' || id === 'kr-idol-female') continue;
      expect(qualityPolicyForWorkspace(id).scenePolicy.motifFamilyIds).not.toContain('performance-stage');
    }
  });

  it('kids-interactive motif family is scoped to kr-kids/jp-kids only', () => {
    for (const id of ALL_WORKSPACE_IDS) {
      if (id === 'kr-kids' || id === 'jp-kids') continue;
      expect(qualityPolicyForWorkspace(id).scenePolicy.motifFamilyIds).not.toContain('kids-interactive');
    }
  });

  it('every universal (workspace-unscoped) motif family appears in every workspace\'s scenePolicy', () => {
    const universalFamilies = ['romantic-connection', 'nightlife-motion', 'everyday-life', 'memory-reflection', 'self-growth', 'group-community'];
    for (const id of ALL_WORKSPACE_IDS) {
      const families = qualityPolicyForWorkspace(id).scenePolicy.motifFamilyIds;
      for (const familyId of universalFamilies) {
        expect(families, `${id} missing universal family ${familyId}`).toContain(familyId);
      }
    }
  });

  it('eraIntent mode never accidentally matches across workspaces with genuinely different real stances (senior-oldpop strict-decade vs kr-kids safety-over-era)', () => {
    expect(qualityPolicyForWorkspace('senior-oldpop').eraIntent.mode).not.toBe(qualityPolicyForWorkspace('kr-kids').eraIntent.mode);
  });

  it('calling qualityPolicyForWorkspace twice for two different workspaces in sequence never mutates a shared object (no cross-call contamination)', () => {
    const first = qualityPolicyForWorkspace('senior-oldpop');
    const second = qualityPolicyForWorkspace('kr-kids');
    expect(first.workspaceId).toBe('senior-oldpop');
    expect(second.workspaceId).toBe('kr-kids');
    expect(first.scenePolicy.safetyOverEra).toBe(false);
    expect(second.scenePolicy.safetyOverEra).toBe(true);
  });
});
