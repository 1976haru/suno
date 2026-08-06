import type { GenerationOptions, GenerationSnapshot, GenrePack, MoodPack, PlaylistBlueprint, PreassignedSongSlot, ProviderSettings, SeasonPack, WorkspaceId } from '../types';
import { genrePacks, moodPacks } from '../data/presets';
import { getDefaultGenreIdsForArchetype } from '../data/genreLibrary';
import { normalizeGenreSelection } from './genreSelection';
import { preallocateSongSlots } from './batchPreallocation';
import { stableHash } from './generationPreflight';
import { currentWorkspaceId } from './workspaceScope';

/**
 * TASK (post-generation operation snapshot) — see types.ts's GenerationSnapshot
 * doc comment for the full real bug this module exists to fix. Everything
 * here is pure/sync: no IndexedDB, no React, no live component state — the
 * whole point is a value every consumer (App.tsx, hooks, Step4Result.tsx)
 * can build/read deterministically from a real GenerationOptions, instead of
 * reaching for whatever `cm.selectedChannel`/`opts` happens to be on screen.
 */

/**
 * Pure equivalent of App.tsx's real fallbackGenres() (confirmed body:
 * `selectedGenres.length ? selectedGenres : channel.preferredGenres ||
 * getDefaultGenreIdsForArchetype(channel.archetype) -> genrePacks[0]`),
 * operating on a passed-in `options` instead of live `cm.selectedChannel`/
 * component state. Used both as the fix for the bridge-import
 * onSelectChannel-then-fallbackGenres() same-tick race (TASK 4) and as the
 * genre source for every post-generation operation that resolves its genres
 * from a GenerationSnapshot's own `options` instead of live state.
 */
export function genresForOptions(options: Pick<GenerationOptions, 'genreIds' | 'channel'>): GenrePack[] {
  const selected = genrePacks.filter(genre => options.genreIds.includes(genre.id));
  if (selected.length) return selected;
  const channel = options.channel;
  const fallbackIds = normalizeGenreSelection(
    channel.preferredGenres.length ? channel.preferredGenres : getDefaultGenreIdsForArchetype(channel.archetype)
  );
  const fallback = genrePacks.filter(genre => fallbackIds.includes(genre.id));
  return fallback.length ? fallback : [genrePacks[0]];
}

/** Pure equivalent of App.tsx's real fallbackMoods() (`selectedMoods.length ? selectedMoods : [moodPacks[0]]`) — see genresForOptions's own doc comment for why this exists as a pure, options-driven twin instead of reading live component state. */
export function moodsForOptions(options: Pick<GenerationOptions, 'moodIds'>): MoodPack[] {
  const selected = moodPacks.filter(mood => options.moodIds.includes(mood.id));
  return selected.length ? selected : [moodPacks[0]];
}

/** The real preassigned slot plan `options` would generate against right now — same deterministic function (core/batchPreallocation.ts's preallocateSongSlots) every real generation path already calls, reused here so a snapshot's `slots` reflect the actual plan rather than a re-derived approximation. */
export function slotsForOptions(options: GenerationOptions, avoid?: { usedTitles?: string[]; usedHooks?: string[] }): PreassignedSongSlot[] {
  return preallocateSongSlots(options, genresForOptions(options), avoid);
}

export interface BuildGenerationSnapshotInput {
  options: GenerationOptions;
  provider: ProviderSettings;
  season: SeasonPack;
  /** Real preassigned slot plan, when the caller already computed one (avoids a redundant recompute); falls back to slotsForOptions(options) otherwise. */
  slots?: PreassignedSongSlot[];
  workspaceId?: WorkspaceId;
}

/** `contractSignature` reuses core/generationPreflight.ts's own stableHash — the same mechanism ResolvedGenerationContract/DesignGateResult acknowledgment tracking already uses — rather than a second hashing approach. */
export function buildGenerationSnapshot(input: BuildGenerationSnapshotInput): GenerationSnapshot {
  const { options, provider, season } = input;
  const slots = input.slots ?? slotsForOptions(options);
  return {
    workspaceId: input.workspaceId ?? currentWorkspaceId(),
    channel: options.channel,
    options,
    provider,
    season,
    slots,
    contractSignature: stableHash({ options, slots }),
    generatedAt: new Date().toISOString()
  };
}

/**
 * Attaches a real GenerationSnapshot to `blueprint` — but ONLY when it
 * doesn't already carry one. This is what makes it safe to call from every
 * real "finalize this blueprint" choke point (App.tsx's
 * finalizeSinglePackBlueprint, core/multiSetGeneration.ts's
 * finalizeSetBlueprint) regardless of whether that particular call is a
 * brand-new generation (no snapshot yet -> attaches one) or a later re-
 * finalize of an already-generated pack (retry/refine/title-prefix-reapply —
 * snapshot already present -> left untouched, so the ORIGINAL generation's
 * settings survive every later post-generation operation by construction).
 */
export function withGenerationSnapshot(blueprint: PlaylistBlueprint, input: BuildGenerationSnapshotInput): PlaylistBlueprint {
  if (blueprint.generationSnapshot) return blueprint;
  return { ...blueprint, generationSnapshot: buildGenerationSnapshot(input) };
}

export interface ResolvedGenerationContext {
  options: GenerationOptions;
  provider: ProviderSettings;
  season: SeasonPack;
  genres: GenrePack[];
  moods: MoodPack[];
}

/** Whatever's live on screen right now — App.tsx's own `{ ...opts, channel: cm.selectedChannel }`/`provider`/`selectedSeason`/`fallbackGenres()`/`fallbackMoods()`, passed in by the caller so this module never reaches for React state itself. */
export type LiveGenerationState = ResolvedGenerationContext;

/**
 * TASK (post-generation operation snapshot) — the one real decision every
 * post-generation operation (retry/refine/evaluate — see App.tsx's
 * onRetrySong/onRefineSelected/onEvaluate) makes: use `blueprint`'s own
 * GenerationSnapshot (what it was ACTUALLY generated under) by default, or
 * fall back to `live` (whatever's currently on screen) only when there's no
 * snapshot at all (an old pack from before this task, or a display-only
 * synthetic blueprint) or the caller explicitly opted in via
 * `useCurrentSettings` — the "[현재 설정으로 다시 스타일링]" escape hatch (see
 * Step4Result.tsx's own per-action checkboxes: one per operation, never a
 * single global toggle that silently changes all of them at once).
 */
export function resolveGenerationContext(
  blueprint: Pick<PlaylistBlueprint, 'generationSnapshot'> | null | undefined,
  live: LiveGenerationState,
  useCurrentSettings?: boolean
): ResolvedGenerationContext {
  const snapshot = !useCurrentSettings ? blueprint?.generationSnapshot : undefined;
  if (!snapshot) return live;
  return {
    options: snapshot.options,
    provider: snapshot.provider,
    season: snapshot.season,
    genres: genresForOptions(snapshot.options),
    moods: moodsForOptions(snapshot.options)
  };
}
