import type { ChannelArchetype, DisplayLanguage, ProviderSettings } from '../types';
import { getCoreGenreIdsForArchetype, getCoreGenresForArchetype, getGenreById } from '../data/genreLibrary';
import { moodPacks, seasonPacks } from '../data/presets';
import { vocalPresets } from '../data/vocalPresets';
import { CONCEPT_KEYWORD_RULES, matchConceptRules } from '../data/conceptKeywords';
import { callGenerateProxy } from '../providers/proxyFetch';
import { buildProxyHeaders } from '../providers/proxyFetch';
import { MODEL_REGISTRY, defaultModelFor } from '../data/modelRegistry';
import { getConceptCache, setConceptCache } from './library';
import { recordUsage } from './usageLedger';
import { decomposeArtistReferences, isSafeDecomposedReference, type DecomposedReference } from './artistReferenceDecomposer';
import { isKidsArchetype } from '../utils/channelArchetype';

/**
 * TASK v3.58 (지시문 v3.58 TASK 2) — applying a natural-language concept used
 * to collapse the whole pack onto ONE genreId (ConceptRecommendation only
 * ever carried a single `genreId`), so every downstream rotation had
 * nothing to rotate across — the actual root cause behind "18 songs, one
 * genre" once a concept was applied (see core/genreRotation.ts's own fix
 * for the second half of that bug, and tests/genreRotationIdentity.test.ts).
 * genreAllocation is the fix: a real multi-genre distribution sized to the
 * pack, capped so no single genre dominates.
 */
export interface GenreAllocationSlot {
  genreId: string;
  songCount: number;
  /** Korean, user-facing role label ("채널 대표 사운드" / "보조 변주" / "변주용"). */
  roleKo: string;
}

export interface ConceptRecommendation {
  id: string;
  /** = genreAllocation[0].genreId. Kept for backward compatibility with callers that only ever read a single genre. */
  genreId: string;
  /** Real per-track genre distribution — always >= 1 entry, summing to the songCount this recommendation was built for. See buildGenreAllocation. */
  genreAllocation: GenreAllocationSlot[];
  moodIds: string[];
  seasonId: string;
  vocalPresetId: string;
  reasonKo: string;
  previewLine: string;
  confidence: 'high' | 'medium';
  /** Artist/band references detected in the free-text input (see core/artistReferenceDecomposer.ts) — UI display only ("이렇게 해석했습니다"). Every field except matchedSurface on each entry is already name-free and safe to weave into a style prompt; matchedSurface itself must never be. */
  decomposedReferences?: DecomposedReference[];
}

export interface ConceptAgentResult {
  input: string;
  recommendations: ConceptRecommendation[];
  method: 'local' | 'api';
}

export interface ConceptWhitelist {
  genreIds: string[];
  moodIds: string[];
  seasonIds: string[];
  vocalPresetIds: string[];
}

/**
 * TASK H2 (v3.10) — never the full 264-genre library; only this archetype's
 * core tier (<=12 ids), same restriction the concept grid itself already
 * enforces (see genreLibrary.ts's getCoreGenresForArchetype). Recommending
 * an 'extended' genre (Bebop, Big Band, ...) would break the channel's tone.
 */
export function buildConceptWhitelist(archetype: ChannelArchetype): ConceptWhitelist {
  return {
    genreIds: getCoreGenreIdsForArchetype(archetype),
    moodIds: moodPacks.map(mood => mood.id),
    seasonIds: seasonPacks.map(season => season.id),
    vocalPresetIds: vocalPresets.map(preset => preset.id)
  };
}

export function validateRecommendation(rec: ConceptRecommendation, whitelist: ConceptWhitelist): boolean {
  if (!whitelist.genreIds.includes(rec.genreId)) return false;
  if (!rec.moodIds.length || !rec.moodIds.every(id => whitelist.moodIds.includes(id))) return false;
  if (!whitelist.seasonIds.includes(rec.seasonId)) return false;
  if (rec.vocalPresetId && !whitelist.vocalPresetIds.includes(rec.vocalPresetId)) return false;
  if (!rec.genreAllocation.length || rec.genreAllocation.some(slot => !whitelist.genreIds.includes(slot.genreId))) return false;
  return true;
}

/**
 * TASK v3.58 — no single genre may dominate a pack (0.28 ≈ 5/18, the ratio
 * measured against the real 18-song default). Exported (not just a local
 * const) so tests/core/albumAudit.ts can check a real generated pack
 * against the exact same threshold this allocator targets, rather than a
 * second hand-copied number that could drift out of sync.
 */
export const MAX_GENRE_SHARE = 0.28;

function genreAllocationCap(songCount: number): number {
  return Math.max(1, Math.floor(songCount * MAX_GENRE_SHARE));
}

/** The smallest genre-pool size that can actually respect genreAllocationCap for this songCount (e.g. 18 songs / cap 5 -> needs >= 4 genres) — never fewer than 3 regardless, per the brief's "장르 풀 크기 >= 3". */
function minimumGenrePoolSize(songCount: number): number {
  const cap = genreAllocationCap(songCount);
  return Math.max(3, Math.ceil(songCount / cap));
}

/**
 * Builds a genre pool of at least minimumGenrePoolSize, preferring
 * rankedIds (already coreGenreIds-filtered, highest-signal first) and
 * padding from the channel's own core genre order when the input didn't
 * suggest enough distinct genres to fill it.
 */
function buildGenrePool(rankedIds: string[], coreGenreOrder: string[], targetSize: number): string[] {
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const id of rankedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    pool.push(id);
    if (pool.length >= targetSize) return pool;
  }
  for (const id of coreGenreOrder) {
    if (seen.has(id)) continue;
    seen.add(id);
    pool.push(id);
    if (pool.length >= targetSize) return pool;
  }
  return pool;
}

const GENRE_ROLE_KO = ['채널 대표 사운드', '보조 변주', '변주용'];

function genreRoleKo(index: number): string {
  return GENRE_ROLE_KO[Math.min(index, GENRE_ROLE_KO.length - 1)];
}

/**
 * Distributes songCount across genreIds (highest-ranked first, descending
 * weight) capped at genreAllocationCap(songCount) each. Deterministic: the
 * remainder from integer division always fills the highest-ranked slots
 * first, and any cap overflow is redistributed round-robin to slots still
 * under cap — so the returned counts always sum to exactly songCount
 * (never silently drop songs) as long as poolSize * cap >= songCount,
 * which buildGenrePool's caller (minimumGenrePoolSize) guarantees.
 */
export function allocateGenreCounts(genreIds: string[], songCount: number): GenreAllocationSlot[] {
  if (!genreIds.length || songCount <= 0) return [];
  const cap = genreAllocationCap(songCount);
  const poolSize = genreIds.length;
  const weights = genreIds.map((_, index) => poolSize - index);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const counts = weights.map(weight => Math.floor((weight / totalWeight) * songCount));

  let remainder = songCount - counts.reduce((sum, count) => sum + count, 0);
  for (let i = 0; remainder > 0; i = (i + 1) % poolSize) {
    counts[i] += 1;
    remainder -= 1;
  }

  let overflow = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > cap) {
      overflow += counts[i] - cap;
      counts[i] = cap;
    }
  }
  let guard = 0;
  const maxGuard = poolSize * songCount + 1;
  while (overflow > 0 && guard < maxGuard) {
    for (let i = 0; i < poolSize && overflow > 0; i++) {
      if (counts[i] < cap) {
        counts[i] += 1;
        overflow -= 1;
      }
    }
    guard += 1;
  }
  // A pool too small to honor the cap at all (cap * poolSize < songCount —
  // buildGenreAllocation's minimumGenrePoolSize never lets this happen, but
  // this function is exported standalone and must never silently drop
  // songs) falls back to plain round-robin, ignoring the cap as a last
  // resort — an over-cap allocation is still strictly better than an
  // allocation that doesn't sum to songCount.
  for (let i = 0; overflow > 0; i = (i + 1) % poolSize) {
    counts[i] += 1;
    overflow -= 1;
  }

  const finalCounts = enforceMinimumGenreCount(counts, cap);
  return genreIds
    .map((id, index) => ({ genreId: id, songCount: finalCounts[index], roleKo: genreRoleKo(index) }))
    .filter(slot => slot.songCount > 0);
}

/**
 * TASK v3.70 (TASK E) — real measurement: an 18-song pack's lowest-ranked
 * genre routinely landed at exactly 1 song (e.g. "folk-rock-70s 1 /
 * baroque-pop 1" alongside 5 genres with 2+). A single-song genre has no
 * real presence in the pack and only occupies an allocation slot another
 * genre could have used instead. Merges any 1-count genre's song into
 * another genre (preferring one still under cap, then the largest), and
 * repeats until no 1-count genre remains — except it never merges below 3
 * distinct genres (the same floor minimumGenrePoolSize already guarantees
 * elsewhere), so a small pack that can only ever produce exactly 1 song per
 * genre (e.g. songCount=3, pool=3) is left alone rather than collapsed to a
 * single genre. Prefers a merge target still under `cap` so this never
 * reintroduces the very "single genre dominates the pack" problem
 * genreAllocationCap exists to prevent; only spills over cap as an absolute
 * last resort (no target has room at all).
 */
function enforceMinimumGenreCount(counts: number[], cap: number): number[] {
  const result = [...counts];
  let guard = 0;
  const maxGuard = result.length * 2 + 5;
  while (guard++ < maxGuard) {
    const nonZeroCount = result.filter(count => count > 0).length;
    if (nonZeroCount <= 3) break;
    const oneIndex = result.findIndex(count => count === 1);
    if (oneIndex === -1) break;
    const otherIndices = result.map((_, index) => index).filter(index => index !== oneIndex && result[index] > 0);
    if (!otherIndices.length) break;
    result[oneIndex] = 0;
    const target = otherIndices.slice().sort((a, b) => {
      const aRoom = result[a] < cap ? 1 : 0;
      const bRoom = result[b] < cap ? 1 : 0;
      if (aRoom !== bRoom) return bRoom - aRoom;
      return result[b] - result[a];
    })[0];
    result[target] += 1;
  }
  return result;
}

/**
 * The one place both recommendConceptLocal and recommendConceptViaApi build
 * genreAllocation from — always at least minimumGenrePoolSize(songCount)
 * distinct genres (never the single-genre collapse the pre-fix
 * ConceptRecommendation.genreId-only shape caused).
 */
function buildGenreAllocation(rankedGenreIds: string[], coreGenreOrder: string[], songCount: number): GenreAllocationSlot[] {
  const targetSize = minimumGenrePoolSize(songCount);
  const pool = buildGenrePool(rankedGenreIds, coreGenreOrder, targetSize);
  return allocateGenreCounts(pool, songCount);
}

function normalizeInput(freeText: string): string {
  return freeText.trim().toLowerCase().replace(/\s+/g, ' ');
}

const PREVIEW_WORDS_BY_MOOD: Record<string, string[]> = {
  nostalgic: ['Old Radio Light', 'Familiar Song', 'Quiet Memory'],
  warm: ['Warm Coffee', 'Gentle Morning', 'Soft Light'],
  bittersweet: ['Falling Leaves', 'Quiet Rain', 'Distant Song'],
  hopeful: ['New Morning', 'Open Sky', 'Fresh Start'],
  romantic: ['Shared Umbrella', 'Soft Rain Walk', 'Quiet Confession'],
  christmas: ['Winter Coffee Light', 'Quiet Bells', 'Candle Window'],
  'calm-focus': ['Slow Afternoon', 'Quiet Desk', 'Steady Hour'],
  'fresh-start': ['Clean Morning', 'Open Calendar', 'New Page'],
  'rainy-comfort': ['Rain Window', 'Warm Inside', 'Umbrella Light'],
  elegant: ['Porcelain Cup', 'Quiet Lobby', 'Old Record']
};

function pickPreviewLine(moodId: string, seed: number): string {
  const pool = PREVIEW_WORDS_BY_MOOD[moodId] || PREVIEW_WORDS_BY_MOOD.warm;
  return pool[Math.abs(seed) % pool.length];
}

function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

interface RankedScores {
  genres: string[];
  moods: string[];
  seasons: string[];
}

function rankFromRules(freeText: string, coreGenreIds: Set<string>): RankedScores {
  const matched = matchConceptRules(freeText);
  const genreScore = new Map<string, number>();
  const moodScore = new Map<string, number>();
  const seasonScore = new Map<string, number>();

  for (const rule of matched) {
    for (const [id, weight] of Object.entries(rule.genreWeights || {})) {
      if (!coreGenreIds.has(id)) continue;
      genreScore.set(id, (genreScore.get(id) || 0) + weight);
    }
    for (const [id, weight] of Object.entries(rule.moodWeights || {})) {
      moodScore.set(id, (moodScore.get(id) || 0) + weight);
    }
    for (const [id, weight] of Object.entries(rule.seasonWeights || {})) {
      seasonScore.set(id, (seasonScore.get(id) || 0) + weight);
    }
  }

  const rank = (scores: Map<string, number>) => [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  return { genres: rank(genreScore), moods: rank(moodScore), seasons: rank(seasonScore) };
}

/**
 * TASK v3.58 — was hardcoded to vocalPresets[0].id, which is 'kid-boy' (the
 * first entry in data/vocalPresets.ts's array, kept first there so a kids
 * channel's own picker lists boy/girl/choir in order) regardless of the
 * requesting channel's archetype. A senior/general-channel concept
 * recommendation silently carried a children's-choir vocal preset id — see
 * VocalPreset.forKids. Picks the first preset matching this archetype's own
 * forKids-ness instead, same filter Step2Concept.tsx's own picker applies.
 */
function defaultVocalPresetIdFor(archetype: ChannelArchetype): string {
  const wantsKids = isKidsArchetype(archetype);
  return vocalPresets.find(preset => Boolean(preset.forKids) === wantsKids)?.id || vocalPresets[0].id;
}

function buildRecommendation(input: {
  id: string;
  archetype: ChannelArchetype;
  genreAllocation: GenreAllocationSlot[];
  moodIds: string[];
  seasonId: string;
  reasonKo: string;
  confidence: 'high' | 'medium';
  decomposedReferences?: DecomposedReference[];
}): ConceptRecommendation {
  const primaryMood = input.moodIds[0] || 'warm';
  const primaryGenreId = input.genreAllocation[0]?.genreId || 'adult-contemporary';
  const seed = hashSeed(`${primaryGenreId}::${primaryMood}::${input.seasonId}`);
  return {
    id: input.id,
    genreId: primaryGenreId,
    genreAllocation: input.genreAllocation,
    moodIds: input.moodIds,
    seasonId: input.seasonId,
    vocalPresetId: defaultVocalPresetIdFor(input.archetype),
    reasonKo: input.reasonKo,
    previewLine: pickPreviewLine(primaryMood, seed),
    confidence: input.confidence,
    decomposedReferences: input.decomposedReferences?.length ? input.decomposedReferences : undefined
  };
}

function seasonLabelKo(seasonId: string): string {
  return seasonPacks.find(season => season.id === seasonId)?.label || seasonId;
}

function genreLabelKo(genreId: string): string {
  return getGenreById(genreId)?.label || genreId;
}

/**
 * TASK H3 (v3.10) — API-free path; always returns at least one
 * recommendation ("아무것도 안 걸리면 채널 대표 조합을 기본 추천으로"). When two
 * genre candidates are roughly equally supported by the input, returns two
 * different angles side by side instead of asking the user to disambiguate
 * ("모호한 입력에는 되묻지 말고 두 방향 모두 보여주십시오").
 */
function rotate<T>(items: T[], offset: number): T[] {
  if (!items.length || !offset) return items;
  const n = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(n), ...items.slice(0, n)];
}

/** Default assumed when a caller doesn't yet know the real pack size (e.g. an old call site not yet updated) — matches this app's own default GenerationOptions.songCount. */
const DEFAULT_CONCEPT_SONG_COUNT = 18;

export function recommendConceptLocal(
  freeText: string,
  archetype: ChannelArchetype,
  defaults?: { genreId?: string; moodId?: string; seasonId?: string },
  /** TASK H7 (v3.10) — "다른 추천 보기": rotates through the next-ranked candidates instead of dead-ending on the same top-2 every click. */
  variantOffset = 0,
  /** TASK v3.58 — how many songs this recommendation's genreAllocation should sum to; the actual pack size the wizard currently has selected. */
  songCount = DEFAULT_CONCEPT_SONG_COUNT
): ConceptAgentResult {
  const coreGenres = getCoreGenresForArchetype(archetype);
  const coreGenreIds = new Set(coreGenres.map(genre => genre.id));
  const coreGenreOrder = coreGenres.map(genre => genre.id);
  const ranked = rankFromRules(freeText, coreGenreIds);

  // TASK v3.58 TASK 3 — an artist/band reference ("비틀즈 스타일로") suggests
  // real genres too; blend its suggestions in ahead of keyword-rule matches
  // so "비틀즈 스타일, 아침에 커피와 함께" still lands on 1960s-beat-pop-adjacent
  // genres even though the keyword rules alone only recognize the "morning
  // coffee" half of that sentence. Only ids actually in this archetype's
  // core tier are used — never widens the whitelist.
  const decomposedReferences = decomposeArtistReferences(freeText).filter(isSafeDecomposedReference);
  const artistGenreIds = decomposedReferences.flatMap(ref => ref.suggestedGenreIds).filter(id => coreGenreIds.has(id));

  const fallbackGenreId = defaults?.genreId && coreGenreIds.has(defaults.genreId) ? defaults.genreId : coreGenres[0]?.id || 'adult-contemporary';
  const fallbackMoodId = defaults?.moodId && moodPacks.some(m => m.id === defaults.moodId) ? defaults.moodId : 'nostalgic';
  // TASK H2 fix (v3.10) — falling back to seasonPacks[0] ('new-year')
  // whenever no season keyword matched put "New Year Reset" on unrelated
  // recommendations like "café song" or "comfort when it's hard". Prefer
  // whatever season the wizard already had selected; only fall back to a
  // fixed pack if the caller genuinely has no current selection.
  const fallbackSeasonId = defaults?.seasonId && seasonPacks.some(s => s.id === defaults.seasonId) ? defaults.seasonId : (seasonPacks[0]?.id || 'early-autumn');

  const rankedGenres = [...new Set([...artistGenreIds, ...ranked.genres])];
  const genreCandidates = rotate(rankedGenres.length ? rankedGenres : [fallbackGenreId], variantOffset);
  const moodCandidates = rotate(ranked.moods.length ? ranked.moods : [fallbackMoodId], variantOffset);
  const seasonId = ranked.seasons[0] || fallbackSeasonId;

  const recommendations: ConceptRecommendation[] = [];
  const primaryMoodIds = moodCandidates.slice(0, 2);
  const hasSignal = rankedGenres.length > 0 || ranked.moods.length > 0 || ranked.seasons.length > 0;
  const eraNote = decomposedReferences[0] ? ` (${decomposedReferences[0].eraTag} 해석)` : '';

  const primaryAllocation = buildGenreAllocation(genreCandidates, coreGenreOrder, songCount);
  recommendations.push(buildRecommendation({
    id: 'primary',
    archetype,
    genreAllocation: primaryAllocation,
    moodIds: primaryMoodIds,
    seasonId,
    reasonKo: hasSignal
      ? `${seasonLabelKo(seasonId)} 분위기의 ${genreLabelKo(primaryAllocation[0]?.genreId || fallbackGenreId)} 계열 조합이에요${eraNote}. ${primaryAllocation.length}개 장르로 곡마다 다르게 배분됩니다.`
      : `이 채널에서 가장 무난하게 어울리는 조합이에요. ${primaryAllocation.length}개 장르로 배분됩니다.`,
    confidence: hasSignal ? 'high' : 'medium',
    decomposedReferences
  }));

  // Second angle: reorder the same pool around a different lead genre (or,
  // if the pool only ever resolved to one real candidate, a mood-shifted
  // variation) so the user still gets a real choice between two options —
  // both are always real multi-genre allocations, never a single genreId.
  const secondaryLeadId = genreCandidates.find(id => id !== primaryAllocation[0]?.genreId);
  if (secondaryLeadId) {
    const reordered = [secondaryLeadId, ...genreCandidates.filter(id => id !== secondaryLeadId)];
    const secondaryAllocation = buildGenreAllocation(reordered, coreGenreOrder, songCount);
    recommendations.push(buildRecommendation({
      id: 'secondary',
      archetype,
      genreAllocation: secondaryAllocation,
      moodIds: moodCandidates.slice(0, 2),
      seasonId,
      reasonKo: `${genreLabelKo(secondaryLeadId)} 쪽을 대표 사운드로 두는 버전이에요.`,
      confidence: 'medium',
      decomposedReferences
    }));
  } else if (moodCandidates.length > 1) {
    recommendations.push(buildRecommendation({
      id: 'secondary',
      archetype,
      genreAllocation: primaryAllocation,
      moodIds: [moodCandidates[1]],
      seasonId,
      reasonKo: `같은 장르 배분에 조금 더 ${moodPacks.find(m => m.id === moodCandidates[1])?.label || ''} 느낌을 더한 버전이에요.`,
      confidence: 'medium',
      decomposedReferences
    }));
  }

  return { input: freeText, recommendations: recommendations.slice(0, 2), method: 'local' };
}

function conceptSystemPrompt(): string {
  return `너는 시니어 대상 플레이리스트 채널의 곡 컨셉을 추천하는 도우미다. 사용자가 한국어/영어/일본어로 막연한 느낌을 설명하면, 제공된 화이트리스트 id 안에서만 1~2개 조합을 추천하고 각각 한국어 한 줄 이유(reasonKo)와 짧은 영어 미리보기 제목(previewLine, 2-4단어)을 단다. 화이트리스트에 없는 id는 절대 만들어내지 마라. 모호한 입력이면 되묻지 말고 서로 다른 두 조합을 제시하라. 반드시 JSON으로만 답하라. 형식: {"recommendations":[{"genreId":"","moodIds":[""],"seasonId":"","reasonKo":"","previewLine":"","confidence":"high"}]}`;
}

/**
 * TASK H4 (v3.10) — Haiku-only, output capped small (~80 tokens), whitelist
 * re-validated on every response regardless of cache/API result since an
 * LLM can hallucinate an id that looks plausible but isn't in this
 * channel's core tier. Any failure (network, parse, hallucinated id) falls
 * back to the local matcher rather than surfacing an error — the agent is
 * optional, never a blocking gate.
 */
export async function recommendConceptViaApi(
  freeText: string,
  archetype: ChannelArchetype,
  settings: ProviderSettings,
  /** TASK v3.58 — see recommendConceptLocal's own songCount param. */
  songCount = DEFAULT_CONCEPT_SONG_COUNT
): Promise<ConceptAgentResult> {
  const whitelist = buildConceptWhitelist(archetype);
  const cacheKey = `${archetype}::${normalizeInput(freeText)}::${songCount}`;

  const cached = await getConceptCache(cacheKey).catch(() => undefined);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as ConceptAgentResult;
      if (
        parsed.recommendations?.length
        && parsed.recommendations.every(rec => rec.genreAllocation?.length && validateRecommendation(rec, whitelist))
      ) {
        return { ...parsed, method: 'api' };
      }
    } catch {
      // stale/corrupt cache entry — fall through to a fresh call
    }
  }

  const coreGenres = getCoreGenresForArchetype(archetype);
  const coreGenreIds = new Set(coreGenres.map(genre => genre.id));
  const coreGenreOrder = coreGenres.map(genre => genre.id);
  // TASK v3.58 TASK 3 — the API call itself stays small/cheap (one
  // whitelist-validated primary genreId per TASK H4's design), but the rest
  // of the genre pool around that validated primary is still built the same
  // way the local path does: keyword-ranked candidates plus any artist
  // reference detected in the free text, both restricted to this
  // archetype's core tier.
  const decomposedReferences = decomposeArtistReferences(freeText).filter(isSafeDecomposedReference);
  const artistGenreIds = decomposedReferences.flatMap(ref => ref.suggestedGenreIds).filter(id => coreGenreIds.has(id));
  const ranked = rankFromRules(freeText, coreGenreIds);

  try {
    const model = MODEL_REGISTRY.anthropic.find(m => m.tier === 'fast')?.id || defaultModelFor('anthropic');
    const data = await callGenerateProxy(settings.proxyEndpoint || '/api/generate', buildProxyHeaders(settings), {
      provider: 'anthropic',
      model,
      temperature: 0.6,
      batchSize: 1,
      cacheableSystemBlocks: [conceptSystemPrompt()],
      user: { whitelist, input: freeText }
    });

    const usage = data.usage as { inputTokens?: number; outputTokens?: number } | undefined;
    if (usage) {
      try {
        await recordUsage({ provider: 'anthropic', model, purpose: 'concept', inputTokens: usage.inputTokens || 0, outputTokens: usage.outputTokens || 0, cacheHit: false });
      } catch {
        // usage tracking is a convenience dashboard; never block on it
      }
    }

    const raw = (data.blueprint ?? data) as { recommendations?: unknown[] };
    const candidates = (raw.recommendations || []) as Array<Record<string, unknown>>;
    const recommendations: ConceptRecommendation[] = candidates.slice(0, 2).map((candidate, index) => {
      const apiGenreId = String(candidate.genreId || '');
      const rankedGenres = [...new Set([apiGenreId, ...artistGenreIds, ...ranked.genres].filter(Boolean))];
      const genreAllocation = buildGenreAllocation(rankedGenres, coreGenreOrder, songCount);
      return {
        id: `api-${index}`,
        genreId: genreAllocation[0]?.genreId || apiGenreId,
        genreAllocation,
        moodIds: Array.isArray(candidate.moodIds) ? candidate.moodIds.map(String) : [],
        seasonId: String(candidate.seasonId || ''),
        vocalPresetId: String(candidate.vocalPresetId || defaultVocalPresetIdFor(archetype)),
        reasonKo: String(candidate.reasonKo || ''),
        previewLine: String(candidate.previewLine || ''),
        confidence: candidate.confidence === 'high' ? 'high' : 'medium',
        decomposedReferences: decomposedReferences.length ? decomposedReferences : undefined
      };
    });

    if (!recommendations.length || !recommendations.every(rec => validateRecommendation(rec, whitelist))) {
      return recommendConceptLocal(freeText, archetype, undefined, 0, songCount);
    }

    const result: ConceptAgentResult = { input: freeText, recommendations, method: 'api' };
    void setConceptCache(cacheKey, JSON.stringify(result));
    return result;
  } catch {
    return recommendConceptLocal(freeText, archetype, undefined, 0, songCount);
  }
}

// ---------------------------------------------------------------------------
// TASK H6 (v3.10) — thumbnail copy: same free-text-in, pick-one-out pattern
// as the concept agent, but for headline text rather than genre/mood. Reuses
// the v3.6 ThumbnailVariant shape so callers can drop these straight into
// an existing thumbnailSpec.variants array; the season/emotion/audience A/B/C
// strategy from v3.6 is untouched and still the default when no free text
// is given (see thumbnailSpec.ts).
// ---------------------------------------------------------------------------

export interface ThumbnailCopySuggestion {
  headline: string;
  angle: string;
}

interface ThumbnailThemeBank {
  patterns: RegExp[];
  phrases: Record<DisplayLanguage, [string, string, string]>;
}

const THUMBNAIL_THEME_BANKS: ThumbnailThemeBank[] = [
  {
    patterns: [/어디선가\s*들어본/, /들어본\s*적/, /익숙한/, /heard\s*(it\s*)?before/i, /familiar/i, /どこかで聞いた/, /聞き覚え/],
    phrases: {
      korean: ['어디서 들어본 그 노래', '익숙한 그 멜로디', '다시 만난 옛 노래'],
      english: ['A Song You\'ve Heard', 'That Familiar Tune', 'An Old Song Again'],
      japanese: ['どこかで聞いた歌', '懐かしいメロディ', 'また出会った歌']
    }
  },
  {
    patterns: [/겨울/, /winter/i, /冬/, /雪/],
    phrases: {
      korean: ['그 겨울이 떠오르는 노래', '겨울밤의 작은 위로', '눈 내리던 그 계절'],
      english: ['That Winter Feeling', 'A Small Winter Comfort', 'The Season It Snowed'],
      japanese: ['あの冬を思い出す歌', '冬の夜の小さな癒し', '雪が降ったあの季節']
    }
  },
  {
    patterns: [/카페/, /커피/, /창가/, /\bcafe\b/i, /coffee/i, /カフェ/, /コーヒー/],
    phrases: {
      korean: ['카페에서 듣던 노래', '창가에 앉아 듣는 음악', '커피 한 잔의 여유'],
      english: ['That Cafe Playlist', 'Songs by the Window', 'A Cup of Coffee Calm'],
      japanese: ['カフェで聴いた歌', '窓辺で聴く音楽', 'コーヒー一杯の余裕']
    }
  },
  {
    patterns: [/위로/, /힘들\s*때/, /지칠\s*때/, /comfort/i, /healing/i, /癒し/, /疲れた/],
    phrases: {
      korean: ['지친 하루의 위로', '괜찮다고 말해주는 노래', '오늘의 작은 쉼표'],
      english: ['Comfort for a Tired Day', 'A Song That Says It\'s Okay', 'Today\'s Small Rest'],
      japanese: ['疲れた一日の癒し', '大丈夫だよと言う歌', '今日の小さな休息']
    }
  },
  {
    patterns: [/가을/, /단풍/, /낙엽/, /autumn/i, /\bfall\b/i, /秋/, /紅葉/],
    phrases: {
      korean: ['가을이 스며드는 노래', '낙엽 지는 계절의 기억', '단풍처럼 물든 하루'],
      english: ['A Song Autumn Seeps Into', 'Memories as Leaves Fall', 'A Day Colored Like Maple'],
      japanese: ['秋がしみこむ歌', '落ち葉の季節の記憶', '紅葉に染まる一日']
    }
  }
];

export function recommendThumbnailCopyLocal(freeText: string, language: DisplayLanguage): ThumbnailCopySuggestion[] {
  const text = freeText.trim();
  const bank = text ? THUMBNAIL_THEME_BANKS.find(candidate => candidate.patterns.some(pattern => pattern.test(text))) : undefined;
  const angles = ['계절/느낌 강조', '감정 강조', '다시 만남 강조'];
  if (!bank) {
    // No theme matched — still return something rather than nothing, using
    // the most broadly applicable bank (familiarity) as a safe default.
    const fallback = THUMBNAIL_THEME_BANKS[0];
    return fallback.phrases[language].map((headline, index) => ({ headline, angle: angles[index] }));
  }
  return bank.phrases[language].map((headline, index) => ({ headline, angle: angles[index] }));
}

export { CONCEPT_KEYWORD_RULES };
