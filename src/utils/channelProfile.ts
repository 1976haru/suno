import type { AgeGroup, ChannelArchetype, ChannelProfile, WorkspaceId } from '../types';
import { scopedKey } from '../core/workspaceScope';

const STORAGE_KEY = 'suno-weaver-custom-channels-v2';

/**
 * v3.77 (TASK C) — mirrors components/steps/Step1Channel.tsx's own
 * archetypeChoices[].audience table (not imported directly — a utils/
 * module importing a component file would invert the normal dependency
 * direction; kept in sync by hand, same trade-off this app already accepts
 * elsewhere for small duplicated tables). Real bug found while
 * investigating this task's own §4: normalizeChannel defaulted a missing
 * `archetype` to 'senior-morning' but a missing `audience` to a totally
 * unrelated 'allAges' — a fresh custom channel (createDraftChannel, the
 * "New"/quick-create flow, which sets neither field) ended up
 * archetype:'senior-morning' + audience:'allAges', a real mismatch: the
 * senior archetype's own template card sets audience:'seniors', but a
 * quick-created channel skipped that card entirely and got the generic
 * age-group fallback instead — exactly the kind of "특정 조건에서만 켜지는
 * 구조" (audienceProfileForAgeGroup('allAges') resolves to
 * GENERAL_AUDIENCE_PROFILE, not SENIOR_AUDIENCE_PROFILE) this task's own
 * §10 names as the root pattern behind repeated regressions.
 */
const ARCHETYPE_DEFAULT_AUDIENCE: Record<ChannelArchetype, AgeGroup> = {
  'senior-morning': 'seniors',
  'oldpop-lounge': 'seniors',
  'showa-cafe': 'seniors',
  'showa-70s': 'seniors',
  j2000s: 'general',
  christmas: 'allAges',
  'lofi-study': 'twenties',
  'modern-chill': 'twenties',
  'city-night': 'thirtiesForties',
  kids: 'kids',
  // TASK B1 — kr-2030 workspace's single archetype (see genreLibrary's
  // kr2030GenrePacks / KR_2030_CORE_GENRE_IDS).
  'kr-2030-pop': 'twenties',
  // TASK C1 — jp-2030 workspace's single archetype (see genreLibrary's
  // jp2030GenrePacks / JP_2030_CORE_GENRE_IDS).
  'jp-2030-pop': 'twenties',
  // TASK D1 §3-2 — kr-kids/jp-kids workspaces' own archetypes (Approach A).
  'kr-kids-song': 'kids',
  'jp-kids-song': 'kids',
  // TASK K2 — kr-idol-male's own archetype. 'kr-idol-female' stays reserved
  // for K3 (§3-3's forward-declared union member — see types.ts's own
  // ChannelArchetype doc comment) but still needs an entry here for Record
  // completeness; 'twenties' matches kr-idol-male's own channel presets
  // (§10-2's audience: 'twenties') since K3 will use the same audience.
  'kr-idol-male': 'twenties',
  'kr-idol-female': 'twenties'
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 44) || `channel-${Date.now()}`;
}

export function makeUniqueId(label: string, existingIds: Set<string>, currentId?: string) {
  const root = slugify(label);
  let candidate = root;
  let suffix = 2;
  while (existingIds.has(candidate) && candidate !== currentId) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function normalizeChannel(input: Partial<ChannelProfile>): ChannelProfile {
  // v3.4 — channels saved before archetypes existed have no `archetype` field;
  // they fall back to 'senior-morning' rather than an unscoped/empty hook bank.
  const archetype = input.archetype || 'senior-morning';
  return {
    id: input.id || `channel-${Date.now()}`,
    name: input.name?.trim() || 'Untitled Channel',
    englishName: input.englishName?.trim() || input.name?.trim() || 'Untitled Channel',
    market: input.market || 'custom',
    primaryLanguage: input.primaryLanguage || 'english',
    // v3.77 (TASK C) — was `input.audience || 'allAges'`, independent of
    // archetype; now derives from the SAME resolved archetype this function
    // already falls back to, so archetype and audience never end up an
    // inconsistent pair again (see ARCHETYPE_DEFAULT_AUDIENCE's own doc
    // comment for the real bug this closes).
    audience: input.audience || ARCHETYPE_DEFAULT_AUDIENCE[archetype] || 'allAges',
    promise: input.promise?.trim() || 'custom playlist channel concept',
    visualIdentity: input.visualIdentity?.trim() || 'consistent thumbnail layout, readable typography, recognizable channel colors',
    defaultVocal: input.defaultVocal?.trim() || 'clear emotional vocal, polished playlist-friendly delivery',
    preferredGenres: input.preferredGenres?.length ? input.preferredGenres : ['adult-contemporary', 'acoustic-pop'],
    preferredMoods: input.preferredMoods?.length ? input.preferredMoods : ['warm', 'hopeful'],
    forbiddenCliches: input.forbiddenCliches?.length ? input.forbiddenCliches : ['famous artist imitation', 'copied song structure'],
    seoKeywords: input.seoKeywords || [],
    archetype
  };
}

/**
 * v5.9 (TASK: workspace-scoped draft channels) — real bug fixed here: this
 * used to take no workspace context at all, so EVERY draft channel (both
 * useChannelManager's addQuickChannel and startNewProfile call sites) fell
 * through normalizeChannel's own 'senior-morning' fallback regardless of
 * which workspace the user was actually in — a kr-kids-workspace user's
 * quick-created channel silently got the senior archetype/audience/vocal.
 *
 * `templateChannel` is optional and additive: when the caller has workspace
 * context (useChannelManager already computes `defaultChannel` =
 * presetsForWorkspace(workspaceId)[0]), it passes that preset in and this
 * draft clones its archetype/audience/market/primaryLanguage/defaultVocal/
 * preferredGenres — so a new draft always starts as a valid member of the
 * caller's own workspace instead of an unscoped hardcoded default. Omitting
 * `templateChannel` (any caller without workspace context) preserves the
 * exact previous behavior: normalizeChannel's own 'senior-morning'/'custom'/
 * 'english' fallbacks, unchanged.
 */
export function createDraftChannel(name = 'New Playlist Channel', templateChannel?: ChannelProfile): ChannelProfile {
  return normalizeChannel({
    id: slugify(name),
    name,
    englishName: name,
    market: templateChannel?.market ?? 'custom',
    primaryLanguage: templateChannel?.primaryLanguage ?? 'english',
    // No template → leave both unset. normalizeChannel derives audience from
    // archetype (see ARCHETYPE_DEFAULT_AUDIENCE above) so the pair stays
    // consistent either way — templated or falling back to 'senior-morning'.
    archetype: templateChannel?.archetype,
    audience: templateChannel?.audience,
    promise: 'creator-defined playlist channel with a clear listener promise',
    visualIdentity: 'consistent colors, readable thumbnail typography, clear seasonal object',
    defaultVocal: templateChannel?.defaultVocal || 'clear emotional vocal, polished playlist-friendly delivery',
    preferredGenres: templateChannel?.preferredGenres?.length ? templateChannel.preferredGenres : ['adult-contemporary', 'acoustic-pop'],
    preferredMoods: ['warm', 'hopeful'],
    forbiddenCliches: ['famous artist imitation', 'copied song structure'],
    seoKeywords: []
  });
}

/**
 * v4.0 (TASK A1) — scoped by workspace via scopedKey(): each workspace gets
 * its own separate custom-channels array under its own key, rather than one
 * shared array that a naive read-filter-then-write-back would silently
 * shrink to just the current workspace's subset (see workspaceScope.ts's own
 * doc comment on why scopedKey(), not per-record filtering, is used for
 * whole-blob storage like this).
 */
export function readStoredChannels(): ChannelProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(scopedKey(STORAGE_KEY)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(item => normalizeChannel(item)).filter(channel => channel.id);
  } catch {
    return [];
  }
}

export function writeStoredChannels(channels: ChannelProfile[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(channels));
  } catch {
    // Storage can be blocked in private or embedded browser contexts.
  }
}

/** v4.1 (TASK A2) — export-oriented read for one explicit workspace regardless of the current one. */
export function readStoredChannelsForWorkspace(workspaceId: WorkspaceId): ChannelProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(scopedKey(STORAGE_KEY, workspaceId)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(item => normalizeChannel(item)).filter(channel => channel.id);
  } catch {
    return [];
  }
}

/** v4.1 (TASK A2) — the import path's primitive: merges `incoming` into the CURRENT workspace's stored channels, skipping any id that already exists (spec §3-2 "같으면 건너뜀 — 사용자 설정을 지우지 않음"). Returns how many were actually added. */
export function mergeStoredChannels(incoming: ChannelProfile[]): number {
  const current = readStoredChannels();
  const existingIds = new Set(current.map(c => c.id));
  const additions = incoming.filter(c => !existingIds.has(c.id));
  if (additions.length) writeStoredChannels([...current, ...additions]);
  return additions.length;
}
