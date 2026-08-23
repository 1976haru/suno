import type { AgeGroup, ChannelArchetype, ChannelProfile, KidsAgeTierId, LyricLanguage, Market, WorkspaceId } from '../types';
import { scopedKey } from '../core/workspaceScope';
import { genrePacks, moodPacks } from '../data/presets';

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
  'kr-idol-female': 'twenties',
  // 지시문 71 (TASK A) — en-chillhop 워크스페이스의 단일 아키타입.
  // modern-chill/city-night과 같은 성인 도시 청취층.
  'en-chillhop': 'twenties'
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
    // codex 지시문 01 (TASK J) — was a direct reference passthrough
    // (`input.preferredGenres`, no copy) whenever `input` already carried a
    // non-empty array — two channels normalized from the same source array
    // (e.g. two drafts built from the same preset's own preferredGenres,
    // both never spread before reaching here) would share the identical
    // array object. No in-place mutation call site exists in this codebase
    // today (confirmed by search), so this was latent, not yet triggered —
    // but a future `channel.preferredGenres.push(...)`-style edit would
    // silently corrupt every OTHER channel sharing that reference. `[...]`
    // is enough (these are string arrays, no nested objects to worry about).
    preferredGenres: input.preferredGenres?.length ? [...input.preferredGenres] : ['adult-contemporary', 'acoustic-pop'],
    preferredMoods: input.preferredMoods?.length ? [...input.preferredMoods] : ['warm', 'hopeful'],
    forbiddenCliches: input.forbiddenCliches?.length ? [...input.forbiddenCliches] : ['famous artist imitation', 'copied song structure'],
    seoKeywords: input.seoKeywords ? [...input.seoKeywords] : [],
    archetype,
    // v5.12 — real bug fix: this return object never included
    // vocalQuotaOverride at all, so EVERY channel that passed through
    // normalizeChannel (readStoredChannels on load, writeStoredChannels's
    // callers on save, createDraftChannel on draft creation — i.e. nearly
    // every real channel) silently lost a set gender-quota override, even
    // though it was present on `input`. Concretely: kr-idol-male's own
    // channel presets (data/presets.ts) carry `{ male: 15, female: 0,
    // mixed: 3 }`; after normalizeChannel the field came back `undefined`,
    // silently falling back to the generic adult 6/6/6 quota — defeating
    // the entire point of TASK K2 §5-1's per-workspace override. Copied
    // straight through, never defaulted: an absent override on `input`
    // must stay absent on output, same as this function already treats
    // every other genuinely-optional field with no fallback value.
    vocalQuotaOverride: input.vocalQuotaOverride,
    // v5.13 (TASK: kidsAgeTierId wiring) — same copy-through, never-defaulted
    // pattern as vocalQuotaOverride just above (see that field's own v5.12
    // doc comment for the real bug this mirrors — an absent-from-return-object
    // field silently drops any real value `input` was carrying).
    kidsAgeTierId: input.kidsAgeTierId
  };
}

const VALID_MARKETS: readonly Market[] = ['korea', 'japan', 'global', 'custom'];
const VALID_LYRIC_LANGUAGES: readonly LyricLanguage[] = ['english', 'korean', 'japanese', 'bilingual'];
const VALID_AGE_GROUPS: readonly AgeGroup[] = ['kids', 'teens', 'twenties', 'thirtiesForties', 'seniors', 'allAges', 'general'];
const VALID_ARCHETYPES: readonly ChannelArchetype[] = [
  'senior-morning', 'showa-cafe', 'christmas', 'lofi-study', 'kids', 'showa-70s', 'j2000s',
  'modern-chill', 'city-night', 'oldpop-lounge', 'kr-2030-pop', 'jp-2030-pop', 'kr-kids-song',
  'jp-kids-song', 'kr-idol-male', 'kr-idol-female'
];
/** codex 지시문 01 (TASK J) — data/kidsAgeTiers.ts's own tier ids (see types.ts's KidsAgeTierId doc comment) — kept as a plain literal list here rather than importing data/kidsAgeTiers.ts, mirroring this file's own existing "small duplicated table, kept in sync by hand" trade-off (see ARCHETYPE_DEFAULT_AUDIENCE's own doc comment above). */
const VALID_KIDS_AGE_TIER_IDS: readonly KidsAgeTierId[] = ['kids-t1', 'kids-t2', 'kids-t3'];

export interface ChannelProfileValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * TASK v5.18 (TASK F, P2) — real gap: normalizeChannel above defends every
 * field against being EMPTY/missing (falls back to a sensible default), but
 * never checks whether a PRESENT value is actually a real, recognized one —
 * a hand-edited localStorage blob, or a channel imported from a differently-
 * versioned build, can carry a `market`/`primaryLanguage`/`audience`/
 * `archetype` string that TypeScript's own union types would reject at
 * compile time but that survives untouched at runtime (JSON has no type
 * system), or a `preferredGenres`/`preferredMoods` id that doesn't match
 * any real genre/mood pack (a typo, or an id from a genre pack that's since
 * been renamed/removed) — genresForOptions/moodsForOptions
 * (core/generationSnapshot.ts) silently filter those down to an empty list,
 * which can produce a generation with zero usable genre/mood context. This
 * is a pure check, not a second normalizer — normalizeChannel still owns
 * "fill in what's missing"; this owns "flag what's present but wrong" so a
 * caller (useChannelManager's saveEditorProfile) can block the save with a
 * concrete reason instead of persisting a channel that only fails much
 * later, deep inside a generation run, with no context for why.
 */
export function validateChannelProfile(channel: ChannelProfile): ChannelProfileValidationResult {
  const errors: string[] = [];
  if (!channel.id.trim()) errors.push('id가 비어 있습니다.');
  if (!channel.name.trim()) errors.push('채널 이름이 비어 있습니다.');
  if (!VALID_MARKETS.includes(channel.market)) errors.push(`알 수 없는 market 값: "${channel.market}"`);
  if (!VALID_LYRIC_LANGUAGES.includes(channel.primaryLanguage)) errors.push(`알 수 없는 primaryLanguage 값: "${channel.primaryLanguage}"`);
  if (!VALID_AGE_GROUPS.includes(channel.audience)) errors.push(`알 수 없는 audience 값: "${channel.audience}"`);
  if (channel.archetype && !VALID_ARCHETYPES.includes(channel.archetype)) {
    errors.push(`알 수 없는 archetype 값: "${channel.archetype}"`);
  }
  // codex 지시문 01 (TASK J) — real gaps this closes, each confirmed absent
  // by direct investigation before writing this: (1) kidsAgeTierId was never
  // checked at all despite existing on ChannelProfile since v5.13; (2) the
  // old vocalQuotaOverride check only summed the 3 fields (`male+female+mixed
  // <= 0`), so a NaN value (NaN+10+10 = NaN, and `NaN <= 0` is false) or a
  // single negative field offset by a larger positive one both silently
  // passed; (3) preferredGenres/preferredMoods were assumed to already be
  // real arrays and handed straight to `.filter()` — a hand-edited blob with
  // a string instead of an array would throw here, not produce a validation
  // error, defeating this whole function's own "flag what's wrong instead of
  // crashing deep inside generation" purpose.
  if (channel.kidsAgeTierId !== undefined && !VALID_KIDS_AGE_TIER_IDS.includes(channel.kidsAgeTierId)) {
    errors.push(`알 수 없는 kidsAgeTierId 값: "${channel.kidsAgeTierId}"`);
  }
  if (!Array.isArray(channel.preferredGenres)) {
    errors.push('preferredGenres가 배열이 아닙니다.');
  } else {
    const knownGenreIds = new Set(genrePacks.map(genre => genre.id));
    const unknownGenres = channel.preferredGenres.filter(id => !knownGenreIds.has(id));
    if (unknownGenres.length) errors.push(`존재하지 않는 장르 ID: ${unknownGenres.join(', ')}`);
  }
  if (!Array.isArray(channel.preferredMoods)) {
    errors.push('preferredMoods가 배열이 아닙니다.');
  } else {
    const knownMoodIds = new Set(moodPacks.map(mood => mood.id));
    const unknownMoods = channel.preferredMoods.filter(id => !knownMoodIds.has(id));
    if (unknownMoods.length) errors.push(`존재하지 않는 무드 ID: ${unknownMoods.join(', ')}`);
  }
  if (channel.forbiddenCliches !== undefined && !Array.isArray(channel.forbiddenCliches)) {
    errors.push('forbiddenCliches가 배열이 아닙니다.');
  }
  if (channel.seoKeywords !== undefined && !Array.isArray(channel.seoKeywords)) {
    errors.push('seoKeywords가 배열이 아닙니다.');
  }
  if (channel.vocalQuotaOverride) {
    const { male, female, mixed } = channel.vocalQuotaOverride;
    for (const [label, value] of [['male', male], ['female', female], ['mixed', mixed]] as const) {
      if (!Number.isFinite(value)) errors.push(`vocalQuotaOverride.${label} 값이 유효한 숫자가 아닙니다: ${value}`);
      else if (value < 0) errors.push(`vocalQuotaOverride.${label} 값이 음수입니다: ${value}`);
    }
    if (Number.isFinite(male) && Number.isFinite(female) && Number.isFinite(mixed) && male + female + mixed <= 0) {
      errors.push('vocalQuotaOverride 값이 전부 0이라 생성 가능한 보컬 슬롯이 없습니다.');
    }
  }
  return { valid: errors.length === 0, errors };
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
    // v5.12 — real bug fix: promise/visualIdentity/preferredMoods/
    // forbiddenCliches/seoKeywords/vocalQuotaOverride below used to be
    // hardcoded generic defaults regardless of `templateChannel`, unlike
    // market/primaryLanguage/archetype/audience/defaultVocal/preferredGenres
    // just above, which already clone the template. A draft created in the
    // kr-idol-male workspace (from that workspace's own real preset, e.g.
    // 'stage-night') would silently drop that preset's promise, visual
    // identity, moods, forbidden-cliche list, SEO keywords, and — most
    // importantly — its `{ male: 15, female: 0, mixed: 3 }` vocalQuotaOverride,
    // even though the whole point of threading templateChannel through here
    // (v5.9) was for a new draft to start as a valid, fully-seeded member of
    // the caller's workspace. Every field now clones the template when one
    // is given and falls back to the same generic defaults as before when it
    // is not — no behavior change for the no-template call path.
    promise: templateChannel?.promise || 'creator-defined playlist channel with a clear listener promise',
    visualIdentity: templateChannel?.visualIdentity || 'consistent colors, readable thumbnail typography, clear seasonal object',
    defaultVocal: templateChannel?.defaultVocal || 'clear emotional vocal, polished playlist-friendly delivery',
    preferredGenres: templateChannel?.preferredGenres?.length ? templateChannel.preferredGenres : ['adult-contemporary', 'acoustic-pop'],
    preferredMoods: templateChannel?.preferredMoods?.length ? templateChannel.preferredMoods : ['warm', 'hopeful'],
    forbiddenCliches: templateChannel?.forbiddenCliches?.length ? templateChannel.forbiddenCliches : ['famous artist imitation', 'copied song structure'],
    seoKeywords: templateChannel?.seoKeywords ?? [],
    vocalQuotaOverride: templateChannel?.vocalQuotaOverride,
    // v5.13 (TASK: kidsAgeTierId wiring) — clones the template's own tier the
    // same way vocalQuotaOverride does just above, so a draft created from a
    // real kids preset (e.g. 'bedtime-lullaby-radio') starts as a valid
    // member of its tier instead of silently losing it.
    kidsAgeTierId: templateChannel?.kidsAgeTierId
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
