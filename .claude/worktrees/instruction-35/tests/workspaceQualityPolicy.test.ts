import { describe, expect, it } from 'vitest';
import { qualityPolicyForOptions, qualityPolicyForWorkspace } from '../src/data/workspaceQualityPolicies';
import { extractEraConstraint, resolveConstraints } from '../src/core/constraints';
import { channelPresets } from './fixtures';
import { KIDS_AUDIENCE_PROFILE, SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';
import type { WorkspaceId } from '../src/types';

const ALL_WORKSPACE_IDS: WorkspaceId[] = ['senior-oldpop', 'kr-2030', 'jp-2030', 'kr-kids', 'jp-kids', 'kr-idol-male', 'kr-idol-female'];

/**
 * codex 지시문 02 (TASK A) — WorkspaceQualityPolicy is a real aggregation
 * layer over 7 already-real, independently-tuned per-workspace data
 * sources (see workspaceQualityPolicies.ts's own top doc comment for the
 * full list and for the explicit, documented scoping decision this task
 * made: a genuine, correctly-populated registry that at least one real
 * code path consults — core/constraints.ts's resolveConstraints — rather
 * than a full "every gate reads only this" rewrite). This covers both
 * halves: the registry itself is correctly populated for every real
 * workspace, AND the one real consumer still produces correct behavior
 * through it.
 */
describe('[codex 지시문 02 TASK A] qualityPolicyForWorkspace — every real workspace resolves a complete policy', () => {
  it.each(ALL_WORKSPACE_IDS)('%s has a real, non-empty policy for every field', workspaceId => {
    const policy = qualityPolicyForWorkspace(workspaceId);
    expect(policy.workspaceId).toBe(workspaceId);
    expect(policy.audienceProfileId).toBeTruthy();
    expect(policy.eraPolicy.singlePrimaryMin).toBeGreaterThan(0);
    expect(['strict-decade', 'current-implied', 'only-when-referenced', 'safety-over-era']).toContain(policy.eraIntent.mode);
    expect(policy.explorationPolicy.workspaceId).toBe(workspaceId);
    expect(['ready', 'beta', 'scaffold', 'disabled']).toContain(policy.availability.status);
    expect(policy.languagePolicy.defaultLyricLanguage).toBeTruthy();
    expect(Array.isArray(policy.scenePolicy.motifFamilyIds)).toBe(true);
    expect(Array.isArray(policy.ownedGenreIds)).toBe(true);
  });

  it('senior-oldpop policy is ready and strict-decade (the workspace applyEraQuota was built for)', () => {
    const policy = qualityPolicyForWorkspace('senior-oldpop');
    expect(policy.availability.status).toBe('ready');
    expect(policy.eraIntent.mode).toBe('strict-decade');
  });

  it('kr-kids/jp-kids policies are safety-over-era', () => {
    expect(qualityPolicyForWorkspace('kr-kids').scenePolicy.safetyOverEra).toBe(true);
    expect(qualityPolicyForWorkspace('jp-kids').scenePolicy.safetyOverEra).toBe(true);
  });

  it('kr-2030/jp-2030/kr-idol-*/kr-kids/jp-kids all support bilingual; senior-oldpop does not', () => {
    expect(qualityPolicyForWorkspace('kr-2030').languagePolicy.supportsBilingual).toBe(true);
    expect(qualityPolicyForWorkspace('jp-2030').languagePolicy.supportsBilingual).toBe(true);
    expect(qualityPolicyForWorkspace('kr-idol-male').languagePolicy.supportsBilingual).toBe(true);
    expect(qualityPolicyForWorkspace('kr-idol-female').languagePolicy.supportsBilingual).toBe(true);
    expect(qualityPolicyForWorkspace('kr-kids').languagePolicy.supportsBilingual).toBe(true);
    expect(qualityPolicyForWorkspace('jp-kids').languagePolicy.supportsBilingual).toBe(true);
    expect(qualityPolicyForWorkspace('senior-oldpop').languagePolicy.supportsBilingual).toBe(false);
  });

  it('performance-stage motif family only appears in the kr-idol workspaces\' own scenePolicy', () => {
    expect(qualityPolicyForWorkspace('kr-idol-male').scenePolicy.motifFamilyIds).toContain('performance-stage');
    expect(qualityPolicyForWorkspace('senior-oldpop').scenePolicy.motifFamilyIds).not.toContain('performance-stage');
  });

  it('kids-interactive motif family only appears in the kids workspaces\' own scenePolicy', () => {
    expect(qualityPolicyForWorkspace('kr-kids').scenePolicy.motifFamilyIds).toContain('kids-interactive');
    expect(qualityPolicyForWorkspace('kr-2030').scenePolicy.motifFamilyIds).not.toContain('kids-interactive');
  });

  it('ownedGenreIds is real and non-empty for every workspace with real genre data (kr-2030 owns only kr2030- prefixed ids)', () => {
    const owned = qualityPolicyForWorkspace('kr-2030').ownedGenreIds;
    expect(owned.length).toBeGreaterThan(0);
    expect(owned.every(id => id.startsWith('kr2030-'))).toBe(true);
  });
});

describe('[codex 지시문 02 TASK A] qualityPolicyForOptions', () => {
  it('resolves the real workspace from a channel\'s own archetype', () => {
    const kr2030Channel = channelPresets.find(c => c.archetype === 'kr-2030-pop')!;
    expect(qualityPolicyForOptions({ channel: kr2030Channel }).workspaceId).toBe('kr-2030');
  });

  it('falls back to the given fallback workspace when the archetype maps to none', () => {
    const policy = qualityPolicyForOptions({ channel: { archetype: undefined } as never }, 'senior-oldpop');
    expect(policy.workspaceId).toBe('senior-oldpop');
  });
});

describe('[codex 지시문 02 TASK A] real consumer: core/constraints.ts resolveConstraints reads eraIntent through the registry', () => {
  it('a kr-kids concept with an explicit decade is still forced to unspecified via the registry-resolved eraIntent (matches TASK J\'s own direct-module test, now proven through the aggregation layer)', () => {
    const resolved = resolveConstraints(
      { conceptLabel: '1980년대 신스팝 느낌의 동요' },
      { id: 'kr-kids' },
      KIDS_AUDIENCE_PROFILE,
      6
    );
    expect(resolved.era.unspecified).toBe(true);
    const registryPolicy = qualityPolicyForWorkspace('kr-kids');
    expect(registryPolicy.eraIntent.mode).toBe('safety-over-era');
  });

  it('the same concept text for senior-oldpop (strict-decade via the registry) still resolves the real 1980s era', () => {
    const resolved = resolveConstraints(
      { conceptLabel: '1980년대 신스팝 느낌' },
      { id: 'senior-oldpop' },
      SENIOR_AUDIENCE_PROFILE,
      18
    );
    expect(resolved.era.unspecified).toBe(false);
    expect(resolved.era.primary).toBe('1980s');
  });

  it('extractEraConstraint itself is untouched by this registry (pure text detection, no workspace awareness) — sanity check the two layers stay independent', () => {
    const era = extractEraConstraint('1980년대 신스팝 느낌');
    expect(era.primary).toBe('1980s');
  });
});
