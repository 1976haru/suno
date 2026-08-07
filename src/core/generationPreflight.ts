/**
 * TASK (generation preflight) — real, verified bug: v5.10's contract screen
 * (buildResolvedGenerationContract/generationBlockedByContract in
 * userChoices.ts) only ever gated Step3Generate.tsx's OWN buttons/handlers.
 * App.tsx's top-of-page global generate button (~line 933) calls onGenerate/
 * onGenerateMultiSet directly with no check at all beyond `gen.isGenerating`
 * — a user with a genuinely broken selection can watch Step3's own button
 * correctly block, then just click the separate top button and generation
 * proceeds anyway. This module is the single, reusable decision function
 * every real generation trigger point must call from INSIDE its own handler
 * (never only via a `disabled` prop — see this task's own explicit
 * instruction: a `disabled` prop is exactly what let the top button bypass
 * everything, since it's a SEPARATE element with its own, weaker, disabled
 * condition).
 *
 * This function does not re-derive mismatch/gate-failure detection itself —
 * it COMBINES two pre-existing, independently-tested decision engines:
 *   - core/userChoices.ts's ResolvedGenerationContract (did what the user
 *     picked survive resolution — money chord / vocal tone / genre ids)
 *   - core/designGate.ts's DesignGateResult (관문 1 — will this slot PLAN
 *     produce a compliant pack if generation goes exactly as planned)
 * plus three NEW hard-block conditions this task adds on top, none of which
 * either of those two modules already covers on their own.
 */
import type { GenerationOptions, GenrePack, PreassignedSongSlot, WorkspaceId } from '../types';
import { getWorkspace, type WorkspaceDefinition } from '../data/workspaces';
import { workspaceAvailabilityFor } from '../data/workspaceAvailability';
import type { DesignGateResult } from './designGate';
import { buildResolvedGenerationContract, userChoicesFromOptions, type ResolvedGenerationContract } from './userChoices';
import { preallocateSongSlots } from './batchPreallocation';
import { resolveConstraintsFromOptions } from './constraints';
import { audienceProfileForChannelArchetype } from '../data/audienceProfiles';
import { evaluateDesignGateResponsive } from './localGenerationClient';
import { hashSeed } from '../utils/prng';
import { validateChannelProfile } from '../utils/channelProfile';

export interface PreflightReason {
  /** Matches ResolvedGenerationContract.mismatches[].field / DesignIssue.id for a soft (acknowledgeable) reason; one of this module's own hard-block ids ('channelArchetype' | 'genreZeroSongs' | 'workspaceScaffold') for a hard one. */
  field: string;
  messageKo: string;
  /** 'block': no acknowledgment can ever unblock this (see the 3 hard conditions below). 'warn': a real mismatch/gate failure that CAN be unblocked by acknowledging its current content (see mismatchSignature). */
  severity: 'block' | 'warn';
}

export interface PreflightResult {
  allowed: boolean;
  reasons: PreflightReason[];
  requiresAcknowledgement: boolean;
  /**
   * Content-based signature of every current 'warn' reason, present whenever
   * `reasons` contains at least one 'warn' entry (undefined when there is
   * nothing to acknowledge, and always undefined whenever a hard 'block'
   * reason exists — hard blocks never expose anything worth signing).
   * Callers persist this the moment a user explicitly acknowledges every
   * current warn reason, then pass it back in as `acknowledgedSignature` on
   * the next call. Because the signature is computed over the actual
   * mismatch/issue CONTENT (selected/effective values, expected/actual
   * values, a hash of opts, a hash of the slot plan) rather than just which
   * fields/ids are mismatched, changing a mismatched choice to a DIFFERENT
   * wrong value produces a different signature — the stale acknowledgment
   * no longer matches and `requiresAcknowledgement` becomes true again. A
   * prior, naive "which fields mismatched" signature (see
   * Step3Generate.tsx's pre-existing mismatchFieldSignature, sorted field
   * names only) is exactly the bug class this guards against: two DIFFERENT
   * wrong genre picks that both happen to violate the same field would have
   * kept an old acknowledgment silently valid under that scheme.
   */
  mismatchSignature?: string;
}

export interface GenerationPreflightInput {
  workspaceId: WorkspaceId;
  options: GenerationOptions;
  /** The real preallocated slot plan this generation attempt would actually use (core/batchPreallocation.ts's preallocateSongSlots output, or a real finished blueprint's songs) — same shape ResolvedGenerationContract/DesignGateResult were themselves built from. */
  slots: PreassignedSongSlot[];
  contract: ResolvedGenerationContract;
  designGate: DesignGateResult;
  acknowledgedSignature?: string;
  /**
   * Test-only escape hatch: overrides the real getWorkspace(workspaceId)
   * lookup with a hand-built WorkspaceDefinition. Every real, shipped
   * workspace currently has `ready: true` (the 4 that were still scaffolds —
   * kr-2030/jp-2030/kr-kids/jp-kids — were all flipped true across
   * v5.7-v5.8), so the workspaceScaffold hard-block below has no live
   * `WorkspaceId` to reproduce against today; this lets tests exercise that
   * branch directly with a synthetic `ready: false` definition instead of
   * mocking data/workspaces.ts (this codebase's tests avoid module mocking —
   * see tests/*.test.ts's consistent real-data convention). Production
   * callers should never set this.
   */
  workspaceOverride?: WorkspaceDefinition;
}

/** Recursively sorts object keys (arrays keep their own order — order is semantically meaningful there, e.g. contract.mismatches) so two structurally-identical values with differently-ordered keys hash identically. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) sorted[key] = canonicalize(source[key]);
    return sorted;
  }
  return value;
}

/**
 * Deterministic, key-order-independent hash of an arbitrary JSON-serializable
 * value. Not cryptographic — this only needs to distinguish "the same
 * mismatch content" from "different mismatch content" for one browser
 * session's acknowledgment tracking, not resist a deliberate collision
 * attack. Reuses utils/prng.ts's existing hashSeed (already the app's own
 * deterministic string hash, used for palette/hook seeding) rather than
 * introducing a second hashing primitive.
 */
export function stableHash(value: unknown): string {
  return hashSeed(JSON.stringify(canonicalize(value))).toString(16);
}

/**
 * v5.9's own check (hooks/useChannelManager.ts's findArchetypeMismatches),
 * reused as a HARD gate here rather than imported directly: core/ modules
 * don't otherwise depend on hooks/ (that file also pulls in React-adjacent
 * channel-storage helpers with no bearing on this one condition), so this
 * mirrors that function's exact single condition
 * (`channel.archetype && !workspace.archetypeIds.includes(channel.archetype)`)
 * instead of importing across that layering boundary.
 */
function channelArchetypeHardBlock(workspace: WorkspaceDefinition, options: GenerationOptions): PreflightReason | null {
  const archetype = options.channel.archetype;
  if (archetype && !workspace.archetypeIds.includes(archetype)) {
    return {
      field: 'channelArchetype',
      messageKo: `채널 "${options.channel.name}"(${archetype})은 "${workspace.labelKo}" 워크스페이스에서 사용할 수 없는 채널 유형입니다 — 이 워크스페이스의 채널로 바꾸기 전에는 생성할 수 없습니다.`,
      severity: 'block'
    };
  }
  return null;
}

/**
 * "선택한 장르가 실제 계획에 0곡 반영" — a real, severe contract violation,
 * distinct from computeStructuredViolations' own genreIds mismatch (which
 * only fires when `choices.source.genreIds === 'user'`, i.e. was tracked as
 * an explicit pick this session). This checks the actual resolved slot plan
 * directly regardless of provenance: if NONE of the currently-selected genre
 * ids show up on a single real slot, no acknowledgment should ever paper
 * over that — there is nothing left to generate that matches the
 * selection at all.
 */
function genreZeroSongsHardBlock(options: GenerationOptions, slots: PreassignedSongSlot[]): PreflightReason | null {
  const selected = new Set((options.genreIds ?? []).filter(Boolean));
  if (!selected.size || !slots.length) return null;
  const matched = slots.some(slot => slot.genreId && selected.has(slot.genreId));
  if (matched) return null;
  return {
    field: 'genreZeroSongs',
    messageKo: `선택한 장르(${[...selected].join(', ')})가 실제 생성 계획 ${slots.length}곡 중 단 한 곡에도 반영되지 않았습니다 — 장르 선택을 고치기 전에는 생성할 수 없습니다.`,
    severity: 'block'
  };
}

/**
 * "scaffold 워크스페이스" — this codebase's real, existing concept is
 * data/workspaces/index.ts's WorkspaceDefinition.ready: false means "skeleton
 * only, placeholder value" per that field's own doc comment (never built out
 * with real archetypeIds/genre layer/etc). Every one of the 7 shipped
 * workspaces has `ready: true` today (the 4 that were still scaffolds —
 * kr-2030/jp-2030/kr-kids/jp-kids — were all flipped true across v5.7-v5.8),
 * so this condition has no live trigger to reproduce right now; it's kept as
 * a real, structural guard for the next workspace that ships with `ready:
 * false` while still under construction, exactly the scenario `ready` exists
 * to distinguish. data/featureFlags.ts's separate 'scaffold' FeatureStatus
 * (kr2030/jp2030/krKids/jpKids) is unrelated and currently stale/unused for
 * gating (only ratingLearning/imageGeneration/audioAnalysis badges read
 * featureStatus() at all) — WorkspaceDefinition.ready is the real mechanism
 * that actually gates what a user can select and generate.
 *
 * codex 지시문 07 (TASK G) — reads through data/workspaceAvailability.ts's
 * own real workspaceAvailabilityFor() instead of `workspace.ready`
 * directly, so this hard block and WorkspaceSelectScreen.tsx's own card
 * gate (and data/featureFlags.ts's statusForWorkspace) all share exactly
 * one real status derivation — see that module's own doc comment. Uses the
 * "already-resolved object" variant (not the by-id one) since `workspace`
 * here may be a test-only workspaceOverride, never re-fetched by id.
 */
function workspaceScaffoldHardBlock(workspace: WorkspaceDefinition): PreflightReason | null {
  if (workspaceAvailabilityFor(workspace).status === 'ready') return null;
  return {
    field: 'workspaceScaffold',
    messageKo: `"${workspace.labelKo}" 워크스페이스는 아직 준비 중입니다 — 이 워크스페이스에서는 생성할 수 없습니다.`,
    severity: 'block'
  };
}

/**
 * codex 지시문 01 (TASK J) — real, confirmed gap: utils/channelProfile.ts's
 * own validateChannelProfile only ever ran at channel-SAVE time
 * (useChannelManager's saveEditorProfile) — a channel saved before that
 * check existed, corrupted by a hand-edited localStorage blob, or restored
 * from a differently-versioned backup was never re-checked before a real
 * generation request used it. Mirrors this file's other 3 hard-block
 * functions exactly (same shape, same "no acknowledgment can ever unblock
 * this" reasoning — an invalid channel isn't a judgment call to override,
 * it's a structurally broken input).
 */
function channelProfileInvalidHardBlock(options: GenerationOptions): PreflightReason | null {
  const validation = validateChannelProfile(options.channel);
  if (validation.valid) return null;
  return {
    field: 'channelProfileInvalid',
    messageKo: `채널 "${options.channel.name}" 설정이 유효하지 않습니다 — ${validation.errors.join(' / ')} — 채널 편집 화면에서 고친 뒤 다시 시도하세요.`,
    severity: 'block'
  };
}

export function resolveGenerationPreflight(input: GenerationPreflightInput): PreflightResult {
  const { workspaceId, options, slots, contract, designGate, acknowledgedSignature, workspaceOverride } = input;
  const workspace = workspaceOverride ?? getWorkspace(workspaceId);

  const hardReasons: PreflightReason[] = [
    channelArchetypeHardBlock(workspace, options),
    genreZeroSongsHardBlock(options, slots),
    workspaceScaffoldHardBlock(workspace),
    channelProfileInvalidHardBlock(options)
  ].filter((reason): reason is PreflightReason => reason !== null);

  if (hardReasons.length) {
    // No `mismatchSignature` — per this task's own constraint, a hard block
    // never exposes a "proceed anyway" path, so there is nothing here for a
    // caller to acknowledge or persist.
    return { allowed: false, reasons: hardReasons, requiresAcknowledgement: false };
  }

  const warnReasons: PreflightReason[] = [
    ...contract.mismatches.map(mismatch => ({
      field: mismatch.field,
      messageKo: mismatch.reasonKo,
      severity: 'warn' as const
    })),
    ...designGate.blocking.map(issue => ({
      field: issue.id,
      messageKo: `[관문 1] ${issue.labelKo} — 기대: ${issue.expected} / 실제: ${issue.actual}`,
      severity: 'warn' as const
    }))
  ];

  if (!warnReasons.length) {
    return { allowed: true, reasons: [], requiresAcknowledgement: false };
  }

  const mismatchSignature = stableHash({
    mismatches: contract.mismatches.map(m => ({ field: m.field, selected: m.selected, effective: m.effective })),
    designIssues: designGate.blocking.map(i => ({ id: i.id, expected: i.expected, actual: i.actual })),
    optionsHash: stableHash(options),
    slotsHash: stableHash(slots.map(s => `${s.genreId ?? ''}|${s.vocalType ?? ''}|${s.moneyChordId ?? ''}`))
  });

  const acknowledged = acknowledgedSignature !== undefined && acknowledgedSignature === mismatchSignature;

  return {
    allowed: acknowledged,
    reasons: warnReasons,
    requiresAcknowledgement: !acknowledged,
    mismatchSignature
  };
}

export interface GenerationRequestInput {
  workspaceId: WorkspaceId;
  options: GenerationOptions;
  genres: GenrePack[];
  avoid?: { usedTitles?: string[]; usedHooks?: string[] };
  acknowledgedSignature?: string;
}

/**
 * The one real orchestration path every generation trigger point (top
 * button, Step3's own button, batch submit, bridge-instruction copy,
 * hook-warning "continue anyway", cache-bypass "regenerate", ...) should
 * call from INSIDE its own handler function — builds the exact same
 * slots/contract/design-gate resolveGenerationPreflight needs, the same way
 * Step3Generate.tsx's own preview already builds them
 * (preallocateSongSlots -> userChoicesFromOptions/buildResolvedGenerationContract
 * -> resolveConstraintsFromOptions/evaluateDesignGateResponsive), so every
 * trigger point evaluates identical real state through one shared function
 * instead of each hand-rolling its own (potentially inconsistent) version.
 * Pure aside from evaluateDesignGateResponsive's own Worker dispatch (a
 * no-op fallback to the sync evaluateDesignGate when Worker is unavailable,
 * e.g. under vitest/node — see localGenerationClient.ts), so this is
 * directly unit-testable with real fixtures, no DOM/React needed.
 */
export async function evaluateGenerationRequest(input: GenerationRequestInput): Promise<PreflightResult> {
  const { workspaceId, options, genres, avoid, acknowledgedSignature } = input;
  const slots = preallocateSongSlots(options, genres, avoid);
  const choices = userChoicesFromOptions(options);
  const contract = buildResolvedGenerationContract(options, choices, slots, workspaceId);
  const constraints = resolveConstraintsFromOptions(
    options,
    audienceProfileForChannelArchetype(options.channel.archetype, options.audience),
    workspaceId
  );
  const designGate = await evaluateDesignGateResponsive(slots, constraints, options);
  return resolveGenerationPreflight({ workspaceId, options, slots, contract, designGate, acknowledgedSignature });
}
