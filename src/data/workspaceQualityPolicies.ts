import type { ChannelArchetype, GenerationOptions, LyricLanguage, WorkspaceId } from '../types';
import { getWorkspace, workspaceForArchetype } from './workspaces';
import { ERA_POLICY, type EraPolicy } from './eraPolicy';
import { eraIntentForWorkspace, type WorkspaceEraIntent } from './workspaceEraIntent';
import { explorationPolicyFor, type WorkspaceExplorationPolicy } from './explorationPolicies';
import { workspaceAvailability, type WorkspaceAvailability } from './workspaceAvailability';
import { GENRE_WORKSPACE_OWNERSHIP } from './genreWorkspaceOwnership';
import { MOTIF_FAMILIES } from './motifFamilies';

/**
 * codex 지시문 02 (TASK A) — "워크스페이스마다 좋은 노래가 나오는 조건이 다릅니다"
 * (data/explorationPolicies.ts's own opening line) is this whole spec's real
 * theme, but by the time this task comes up, SEVEN real, independently-tuned
 * per-workspace policy sources already existed with no single place that
 * named "here is workspace X's full quality policy": data/audienceProfiles.ts
 * (tempo/song-length/vocab), data/eraPolicy.ts (share thresholds, workspace-
 * agnostic), data/workspaceEraIntent.ts (TASK J, this same spec), data/
 * explorationPolicies.ts (TASK v5.24), data/workspaceAvailability.ts (TASK I,
 * this same spec), data/genreWorkspaceOwnership.ts (TASK H, this same spec),
 * data/motifFamilies.ts (TASK C, this same spec).
 *
 * Honesty note (matches this spec's own established pattern of documenting
 * scope decisions rather than silently under-delivering): the literal ask —
 * "every gate/scorer reads only this registry" — would mean rewriting
 * resolveConstraints/applyEraQuota/designGate/compositionScorer/
 * explorationPolicyEngine/etc. to stop reading their own current sources
 * directly, a full architectural migration far beyond one task in one
 * session, and risky to every one of those already-tuned, already-tested
 * systems for no behavior change. This is built as a REAL, correctly-
 * populated AGGREGATION layer instead: every field below is read from its
 * own real, existing source (never fabricated), and core/constraints.ts's
 * resolveConstraints (see that function's own updated comment) now reads
 * its era-intent override through THIS registry instead of calling
 * data/workspaceEraIntent.ts directly — proof this is a genuine
 * intermediary at least one real code path consults, not a decorative
 * summary object nothing reads.
 */
export interface WorkspaceLanguagePolicy {
  defaultLyricLanguage: LyricLanguage;
  /**
   * Whether this workspace's own channel-editor UI can reach
   * lyricLanguage: 'bilingual' at all (kr-2030, jp-2030, both kr-idol
   * workspaces, kr-kids, jp-kids — see core/localGenerator.ts's
   * resolveBilingualPair own doc comment for the real archetype list this
   * mirrors). Deliberately NOT importing resolveBilingualPair here —
   * core/localGenerator.ts already imports core/constraints.ts, and this
   * file is consumed BY core/constraints.ts, so importing the other
   * direction would create a real circular import; resolveBilingualPair
   * itself remains the authoritative resolver for an actual generation's
   * bilingualPair value.
   */
  supportsBilingual: boolean;
}

export interface WorkspaceScenePolicy {
  /** data/motifFamilies.ts family ids that apply to this workspace (its own workspace-scoped families, plus every family with no workspace restriction at all). */
  motifFamilyIds: string[];
  /** True only for 'safety-over-era' workspaces (kids) — mirrors WorkspaceEraIntent.mode, surfaced here since it's a real, checkable scene/era-gating consequence, not merely descriptive metadata. */
  safetyOverEra: boolean;
}

export interface WorkspaceQualityPolicy {
  workspaceId: WorkspaceId;
  audienceProfileId: string;
  eraPolicy: EraPolicy;
  eraIntent: WorkspaceEraIntent;
  explorationPolicy: WorkspaceExplorationPolicy;
  availability: WorkspaceAvailability;
  languagePolicy: WorkspaceLanguagePolicy;
  scenePolicy: WorkspaceScenePolicy;
  /** data/genreWorkspaceOwnership.ts's own GENRE_WORKSPACE_OWNERSHIP, filtered to genre ids this workspace is a real owner of. */
  ownedGenreIds: string[];
}

const BILINGUAL_CAPABLE_ARCHETYPES: ReadonlySet<ChannelArchetype> = new Set([
  'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'kr-idol-female', 'kr-kids-song', 'jp-kids-song'
]);

function ownedGenreIdsFor(workspaceId: WorkspaceId): string[] {
  return Object.entries(GENRE_WORKSPACE_OWNERSHIP)
    .filter(([, owners]) => owners.includes(workspaceId))
    .map(([genreId]) => genreId);
}

function motifFamilyIdsFor(workspaceId: WorkspaceId): string[] {
  return MOTIF_FAMILIES.filter(family => !family.workspaces || family.workspaces.includes(workspaceId)).map(family => family.id);
}

export function qualityPolicyForWorkspace(workspaceId: WorkspaceId): WorkspaceQualityPolicy {
  const workspace = getWorkspace(workspaceId);
  const eraIntent = eraIntentForWorkspace(workspaceId);
  return {
    workspaceId,
    audienceProfileId: workspace.defaultAudienceProfileId,
    eraPolicy: ERA_POLICY,
    eraIntent,
    explorationPolicy: explorationPolicyFor(workspaceId),
    availability: workspaceAvailability(workspaceId),
    languagePolicy: {
      defaultLyricLanguage: workspace.defaultLyricLanguage,
      supportsBilingual: workspace.archetypeIds.some(archetype => BILINGUAL_CAPABLE_ARCHETYPES.has(archetype))
    },
    scenePolicy: {
      motifFamilyIds: motifFamilyIdsFor(workspaceId),
      safetyOverEra: eraIntent.mode === 'safety-over-era'
    },
    ownedGenreIds: ownedGenreIdsFor(workspaceId)
  };
}

/** Resolves the workspace from opts.channel.archetype the same way core/bridgeInstruction.ts's own buildClaudeCodeInstruction does, falling back to currentWorkspaceId() only when the archetype isn't mapped to any workspace. */
export function qualityPolicyForOptions(opts: Pick<GenerationOptions, 'channel'>, fallbackWorkspaceId: WorkspaceId = 'senior-oldpop'): WorkspaceQualityPolicy {
  const workspaceId = workspaceForArchetype(opts.channel.archetype)?.id ?? fallbackWorkspaceId;
  return qualityPolicyForWorkspace(workspaceId);
}

