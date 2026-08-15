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

/**
 * 지시문 64 (TASK B) — "매칭된 키워드를 화면에 보여준다" / "아무것도 안
 * 잡히면 알린다" / "일부만 잡히면 무엇이 안 잡혔는지 보여준다"의 데이터
 * 축. `matchedPhrases`는 CONCEPT_KEYWORD_RULES 중 실제로 매칭된 규칙의
 * 정규식이 입력 텍스트에서 실제로 잡아낸 원문 부분 문자열(추정이 아니라
 * `.exec()`의 실측 결과) — Step2Concept.tsx의 컨셉 에이전트 패널이 이걸
 * 그대로 "해석: ..." 줄에 쓴다. has*Signal 셋은 장르/무드/계절 세 축
 * 각각 실제로 매칭된 규칙이 있었는지 — 매칭된 phrase는 있지만 어느 한
 * 축에 signal이 없으면("이 단어는 인식했지만 구체적인 축은 못 채웠다")
 * 그게 이 지시문의 "부분 매칭" 신호다. local 경로에서만 채워진다 —
 * API 경로(recommendConceptViaApi)는 키워드 정규식이 아니라 LLM 해석을
 * 쓰므로 이 개념 자체가 없다.
 */
export interface ConceptMatchInfo {
  matchedPhrases: string[];
  hasGenreSignal: boolean;
  hasMoodSignal: boolean;
  hasSeasonSignal: boolean;
}

export interface ConceptAgentResult {
  input: string;
  recommendations: ConceptRecommendation[];
  method: 'local' | 'api';
  matchInfo?: ConceptMatchInfo;
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
 * 지시문 51 (TASK A-1/A-2) — 실측(원인 ③): buildGenrePool이 랭킹 후보가
 * 모자랄 때 coreGenreOrder(SENIOR_MORNING_CORE_GENRE_IDS 등, archetype당
 * 고정된 정적 배열)를 앞에서부터 그대로 채워 넣었다 — 어떤 컨셉을
 * 넣든 padding은 항상 coreGenreOrder[0], [1], [2]...였다. senior-morning은
 * ['adult-contemporary', 'acoustic-pop', 'jazz-pop', ...] 순이라, 컨셉
 * 텍스트가 keyword rule을 4종 미만으로만 맞혀도(대부분의 짧은 컨셉이
 * 그렇다) 이 두 장르가 거의 매번 채워졌다(실측: 10개 컨셉 전부).
 * "이력 기반 tie-break"(§A-2①, 지시문33 TASK B와 같은 발상 — 새 원장을
 * 만들지 않고 core/recentGenreStore.ts 재사용)로 최근 쓰인 장르를 뒤로
 * 밀고, "동점 시 seed 회전"(§A-2②)으로 남은 순서를 컨셉 텍스트 해시로
 * 돌려 같은 채널이라도 컨셉마다 다른 지점에서 시작하게 한다.
 */
function orderCoreGenresForPadding(coreGenreOrder: string[], recentIds: readonly string[], seed: number): string[] {
  if (!coreGenreOrder.length) return coreGenreOrder;
  const recentSet = new Set(recentIds);
  const fresh = coreGenreOrder.filter(id => !recentSet.has(id));
  const stale = coreGenreOrder.filter(id => recentSet.has(id));
  return [...rotate(fresh, seed), ...rotate(stale, seed)];
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
 *
 * 지시문 24 TASK A — `protectedIds` (default none, so every existing
 * recommendation-path caller keeps its exact prior behavior) marks ids that
 * enforceMinimumGenreCount must never pick as the "1곡짜리라 지운다" merge
 * source, because setDirector.ts's makeAllocations calls this function
 * directly with the user's own explicit genre picks as genreIds — a
 * protected id can still receive a merge (gain a song), it just can never
 * be the one silently zeroed out.
 */
export function allocateGenreCounts(genreIds: string[], songCount: number, protectedIds: string[] = []): GenreAllocationSlot[] {
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

  const finalCounts = enforceMinimumGenreCount(counts, cap, genreIds, protectedIds);
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
 *
 * 지시문 24 TASK A — `protectedIds` (matched against `genreIds`, the same
 * order `counts` is indexed by) excludes those indices from ever being
 * picked as the 1-count merge source. Before this, a user's own explicit
 * genre pick that happened to land at exactly 1 song (a normal outcome of
 * the weighted split above, not a signal the genre is unwanted) was
 * silently zeroed out here with no warning — the exact "선택했는데 결과에
 * 없다" defect this task exists to fix.
 */
function enforceMinimumGenreCount(counts: number[], cap: number, genreIds: string[], protectedIds: string[]): number[] {
  const result = [...counts];
  const protectedSet = new Set(protectedIds);
  let guard = 0;
  const maxGuard = result.length * 2 + 5;
  while (guard++ < maxGuard) {
    const nonZeroCount = result.filter(count => count > 0).length;
    if (nonZeroCount <= 3) break;
    const oneIndex = result.findIndex((count, index) => count === 1 && !protectedSet.has(genreIds[index]));
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
 *
 * 지시문 51 (TASK A-2) — coreGenreOrder를 그대로 padding 순서로 쓰지 않고
 * orderCoreGenresForPadding으로 재배열한 뒤 넘긴다. rankedGenreIds(실제
 * 컨셉 키워드 매칭 결과)는 그대로 최우선 — "컨셉 적합성이 우선이다"(§하지
 * 말 것)를 지킨다. padding만 이력/시드로 회전한다.
 */
function buildGenreAllocation(rankedGenreIds: string[], coreGenreOrder: string[], songCount: number, recentIds: readonly string[] = [], paddingSeed = 0): GenreAllocationSlot[] {
  const targetSize = minimumGenrePoolSize(songCount);
  const orderedPadding = orderCoreGenresForPadding(coreGenreOrder, recentIds, paddingSeed);
  const pool = buildGenrePool(rankedGenreIds, orderedPadding, targetSize);
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

function rankFromRules(freeText: string, coreGenreIds: Set<string>, archetype?: ChannelArchetype): RankedScores {
  const matched = matchConceptRules(freeText, archetype);
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

  // 지시문 51 (TASK A-1/A-2②) — 실측: "아침" 컨셉에서 oldpop-warm-morning-glow
  // (weight 4)와 oldpop-hearth-acoustic(weight 4)가 동점이었는데, 동점일 때
  // Array.sort의 안정 정렬이 rule 객체의 키 삽입 순서를 그대로 유지해 매번
  // 같은 쪽(hearth-acoustic)이 이겼다 — "정렬이 결정적이라 상위 몇 개만 계속
  // 뽑힌다"(§A-1 원인 ③)가 padding뿐 아니라 점수 동점에도 있었다. 동점인
  // id끼리만 컨셉 텍스트 해시로 회전한다 — 점수 자체(컨셉 적합성)는
  // 그대로 두고 "누가 이기는가"만 매 컨셉마다 달라지게 한다.
  const tieBreakSeed = hashSeed(freeText);
  const rank = (scores: Map<string, number>) => {
    const grouped = new Map<number, string[]>();
    for (const [id, weight] of scores.entries()) {
      if (!grouped.has(weight)) grouped.set(weight, []);
      grouped.get(weight)!.push(id);
    }
    const weightsDesc = [...grouped.keys()].sort((a, b) => b - a);
    return weightsDesc.flatMap(weight => rotate(grouped.get(weight)!, tieBreakSeed));
  };
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

/**
 * 지시문 64 (TASK B-3) — 실측: "첫사랑이 생각나는 밤" 같은 계절 신호가
 * 전혀 없는 입력이 seasonPacks[0]('new-year')로 떨어지는 원인을 직접
 * 재현해 확인했다 — 정규식이 "밤"을 계절로 잘못 매칭하는 버그는 없었다
 * (conceptKeywords.ts 전수 확인: 계절 룰 중 "밤"에 매칭되는 패턴이
 * 하나도 없다). 진짜 원인은 이 파일 자신의 옛 폴백
 * (`seasonPacks[0]?.id`)이 seasonPacks 배열의 첫 항목이 우연히
 * 'new-year'라는 점 — TASK H2가 "호출자가 이미 고른 계절(defaults.
 * seasonId)을 우선한다"로 절반만 고쳤을 뿐, defaults.seasonId 자체가
 * 없거나 무효한 호출(예: 이 지시문의 check:concept-coverage, 또는
 * 컨셉 에이전트 패널이 아직 어떤 계절도 넘겨받지 못한 최초 진입)에는
 * 여전히 1월 느낌의 'new-year'가 아무 관련 없는 컨셉에도 붙었다.
 * 달력상 현재 월에 맞는 시즌팩으로 대체한다 — 추정 매핑(각 시즌팩의
 * period 필드가 자유 텍스트라 기계적으로 파싱할 수 없어 직접 12개월
 * 표로 짠 것, verified: false)이지만 최소한 "무관한 입력에 항상 1월이
 * 붙는다"는 실측된 결함보다는 낫다.
 */
const CALENDAR_MONTH_SEASON_FALLBACK: Record<number, string> = {
  1: 'new-year',
  2: 'late-winter',
  3: 'spring-open',
  4: 'cherry-blossom',
  5: 'may-cafe',
  6: 'rainy-season',
  7: 'summer-night',
  8: 'late-summer-open',
  9: 'early-autumn',
  10: 'maple-autumn',
  11: 'early-winter',
  12: 'christmas'
};

function calendarSeasonFallback(now: Date = new Date()): string {
  const month = now.getMonth() + 1;
  const candidate = CALENDAR_MONTH_SEASON_FALLBACK[month];
  return candidate && seasonPacks.some(pack => pack.id === candidate) ? candidate : (seasonPacks[0]?.id || 'early-autumn');
}

/**
 * 지시문 64 (TASK B) — ConceptMatchInfo 자기 doc comment 참고. `.exec()`은
 * 매칭된 규칙의 패턴 중 실제로 이 텍스트에서 뭔가를 잡아낸 첫 패턴만
 * 쓴다(규칙 하나가 여러 언어 패턴을 갖고 있어도 실제 입력에 존재하는
 * 언어 하나만 화면에 보여주면 된다) — 전역(`g`) 플래그가 있는 패턴이
 * 하나도 없으므로(conceptKeywords.ts 전수 확인) `.exec()`의 lastIndex
 * 상태 문제는 없다.
 */
function buildConceptMatchInfo(freeText: string, archetype: ChannelArchetype, ranked: RankedScores): ConceptMatchInfo {
  const matchedRules = matchConceptRules(freeText, archetype);
  const matchedPhrases = [...new Set(matchedRules.flatMap(rule => {
    for (const pattern of rule.patterns) {
      const found = pattern.exec(freeText);
      if (found?.[0]) return [found[0].trim()];
    }
    return [];
  }))];
  return {
    matchedPhrases,
    hasGenreSignal: ranked.genres.length > 0,
    hasMoodSignal: ranked.moods.length > 0,
    hasSeasonSignal: ranked.seasons.length > 0
  };
}

export function recommendConceptLocal(
  freeText: string,
  archetype: ChannelArchetype,
  defaults?: { genreId?: string; moodId?: string; seasonId?: string },
  /** TASK H7 (v3.10) — "다른 추천 보기": rotates through the next-ranked candidates instead of dead-ending on the same top-2 every click. */
  variantOffset = 0,
  /** TASK v3.58 — how many songs this recommendation's genreAllocation should sum to; the actual pack size the wizard currently has selected. */
  songCount = DEFAULT_CONCEPT_SONG_COUNT,
  /** 지시문 51 (TASK A-2①) — 이 채널의 최근 추천/적용 이력(core/recentGenreStore.ts, 새 원장 아님 — 지시문33 TASK B와 같은 저장소 재사용). buildGenreAllocation의 padding이 최근 쓰인 장르를 뒤로 미루는 데만 쓰인다 — 컨셉 키워드 매칭 결과(rankedGenres)는 건드리지 않는다. */
  recentGenreIds: readonly string[] = []
): ConceptAgentResult {
  const coreGenres = getCoreGenresForArchetype(archetype);
  const coreGenreIds = new Set(coreGenres.map(genre => genre.id));
  const coreGenreOrder = coreGenres.map(genre => genre.id);
  const ranked = rankFromRules(freeText, coreGenreIds, archetype);
  // 지시문 51 (TASK A-2②) — "동점 시 seed 회전": variantOffset(재추천
  // 클릭)이 이미 있는 회전축과 별개로, 같은 텍스트라도 컨셉 자체의
  // 해시를 padding 회전 시드로 써서 매 컨셉마다 padding 시작점이
  // 달라지게 한다(§실측 원인 ③, "정렬이 결정적이라 상위 몇 개만 계속
  // 뽑힌다"가 padding에도 그대로 적용되던 것을 고친다).
  const paddingSeed = hashSeed(freeText) + variantOffset;

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
  // 지시문 64 (TASK B-3) — that fixed-pack fallback was itself still
  // `seasonPacks[0]` ('new-year') whenever defaults.seasonId was genuinely
  // absent (e.g. this file's own check:concept-coverage sample run, or a
  // panel that hasn't received a current selection yet) — see
  // calendarSeasonFallback's own doc comment for the real repro. Swapped
  // for a calendar-month-based pick, never a fixed literal.
  const fallbackSeasonId = defaults?.seasonId && seasonPacks.some(s => s.id === defaults.seasonId) ? defaults.seasonId : calendarSeasonFallback();

  const rankedGenres = [...new Set([...artistGenreIds, ...ranked.genres])];
  const genreCandidates = rotate(rankedGenres.length ? rankedGenres : [fallbackGenreId], variantOffset);
  const moodCandidates = rotate(ranked.moods.length ? ranked.moods : [fallbackMoodId], variantOffset);
  const seasonId = ranked.seasons[0] || fallbackSeasonId;

  const recommendations: ConceptRecommendation[] = [];
  const primaryMoodIds = moodCandidates.slice(0, 2);
  const hasSignal = rankedGenres.length > 0 || ranked.moods.length > 0 || ranked.seasons.length > 0;
  const eraNote = decomposedReferences[0] ? ` (${decomposedReferences[0].eraTag} 해석)` : '';

  const primaryAllocation = buildGenreAllocation(genreCandidates, coreGenreOrder, songCount, recentGenreIds, paddingSeed);
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
    const secondaryAllocation = buildGenreAllocation(reordered, coreGenreOrder, songCount, recentGenreIds, paddingSeed + 1);
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

  return {
    input: freeText,
    recommendations: recommendations.slice(0, 2),
    method: 'local',
    matchInfo: buildConceptMatchInfo(freeText, archetype, ranked)
  };
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
  const ranked = rankFromRules(freeText, coreGenreIds, archetype);

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
