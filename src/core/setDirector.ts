import type {
  AxisAllocation,
  ChannelProfile,
  ConceptBreadth,
  DiversityAxisId,
  GenerationOptions,
  GenrePack,
  GenreTraits,
  LyricPerspective,
  PerspectiveMode,
  PreassignedSongSlot,
  ProviderSettings
} from '../types';
import { genreLibrary, getCoreGenreIdsForArchetype, getGenreById, isGenreEligibleForArchetype, totalGenreCount } from '../data/genreLibrary';
import { sanitizeGenreIdsForArchetype } from './genreSelection';
import { moodPacks, seasonPacks } from '../data/presets';
import { matchConceptRules } from '../data/conceptKeywords';
import { hookDevices } from '../data/hookDevices';
import { isKidsArchetype } from '../utils/channelArchetype';
import { introTexturesForArchetype } from '../data/introTextures';
import {
  ADULT_STRUCTURE_TEMPLATE_IDS,
  VOCAL_TYPE_IDS
} from './diversityAllocation';
import { buildLyricThemePlan, povDistribution, resolvePerspectiveMode } from './lyricDiversityPlan';
import { hashSeed, seedForBlueprint } from './lyricEngine';
import { allocateGenreCounts } from './conceptAgent';
import {
  decomposeArtistReferences,
  findArtistReferenceLeaks,
  isSafeDecomposedReference,
  type DecomposedReference
} from './artistReferenceDecomposer';
import { preallocateSongSlots } from './batchPreallocation';
import { arrangementDensityCounts } from './promptComposer';
import { killingPointById } from '../data/killingPoints';
import { GENRE_FAMILIES, membersPerFamilyForSelection, type GenreFamily } from '../data/genreFamilies';
import { PALETTE_FAMILIES, genreIdsForFamilyAndCompatible, genreIdsForPaletteFamily, paletteFamilyForGenreId } from '../data/paletteFamilies';
import { channelSoundFloorForArchetype } from '../data/channelSoundFloor';
import { matchGenresByTraits, type TraitProfile } from './traitMatcher';
import { blendGenreTraits, eraDriftWarning } from './genreBlend';
import { buildProxyHeaders, callGenerateProxy } from '../providers/proxyFetch';
import { defaultModelFor, MODEL_REGISTRY } from '../data/modelRegistry';
import { applyEraQuota, detectConceptBreadth, extractEraConstraint, extractMoodConstraint, genreCountsFromIds, type ConceptAxisCoverage, type ConceptAxisId, type MoodConstraint } from './constraints';
import { tightenEraConstraintForSenior } from './seniorOldpopPolicy';
import { BREADTH_THRESHOLDS } from './designGate';
import { DEFAULT_ADULT_VOCAL_QUOTA, leaningAdultVocalQuota, leaningGenderFor, scaleVocalQuota } from './vocalPlan';
import { assertUserChoicesPreserved, emptyUserChoices, type UserExplicitChoices } from './userChoices';

/**
 * v3.63 재작성 (TASK B) — 2단계 해석의 산출 타입. 1단계(자연어 → 이 타입)는
 * LLM(interpretFreeTextRemote, directSet 경로) 또는 규칙 기반 근사
 * (interpretFreeTextLocal, directSetLocal 폴백 경로)가 채운다. 2단계
 * (이 타입 → SetPlan)는 buildSetPlanFromIntent 하나로 통일 — 어느 경로로
 * 해석됐든 이후 로직은 동일하다.
 */
export interface ListeningContext {
  settingKo: string;
  dynamicCeiling: 'low' | 'medium' | 'wide';
  tempoHint?: [number, number];
  extraExclusions: string[];
}

export interface IntentSegment {
  label: string;
  songCount: number;
  profile: TraitProfile;
  blendHint?: { anchorHintKo: string; flavorHintKo: string; strength: 'light' | 'medium' | 'strong' };
}

export interface InterpretedIntent {
  intentKo: string;
  segments: IntentSegment[];
  listeningContext: ListeningContext;
  reasoningKo: string[];
  unknownTermsKo: string[];
}

export interface SetSegment {
  label: string;
  songCount: number;
  genreIds: string[];
  blendedTraits?: GenreTraits;
  eraTag: string;
  descriptors: string[];
}

export interface SetPlan {
  interpretation: {
    intentKo: string;
    eraFocus: string[];
    /** v3.63 (TASK B) — GenreFamily ids actually used to choose the genre axis; empty when the free-text/keyword path was used instead (see chooseGenreIdsFromFamilies). */
    familyIds: string[];
    artistReferences: DecomposedReference[];
    audienceProfileId: string;
    reasoningKo: string[];
    /** v3.63 재작성 (TASK B) — terms the interpreter (LLM or local) could not confidently interpret (e.g. "오늘 같은 날씨" — the app has no weather data). Never silently dropped; surfaced here so the UI can tell the user why. */
    unknownTermsKo: string[];
    /** v3.63 재작성 (TASK B) — listening-context constraints derived from the free text (e.g. "커피숍에서" -> low dynamic ceiling). */
    listeningContext: ListeningContext;
    /** v4.1 (TASK A) — see types.ts's ConceptBreadth. */
    breadth: ConceptBreadth;
    breadthSource: 'auto' | 'user';
    /** v5.7 (TASK v5.7, TASK C) — mood/atmosphere descriptors extracted from the concept text (e.g. "감미로운" -> sweet/tender/mellow), see constraints.ts's extractMoodConstraint. Undefined when no mood adjective from the dictionary was detected. */
    mood?: MoodConstraint;
    /** v5.7 (TASK v5.7, TASK C §3-5) — one entry per concept axis (era/mood/genre/situation/reference/season), reporting whether it was detected and whether it actually reached genre selection/prompt. Step2Plan.tsx surfaces any entry with unapplied:true as a warning. */
    axisCoverage: ConceptAxisCoverage[];
  };
  /** v3.63 재작성 (TASK B) — one entry per interpreted segment (an artist reference, a blend request, or the whole request when there's only one). Empty only never happens — a plan always has at least one segment covering the whole songCount. */
  segments: SetSegment[];
  allocations: AxisAllocation[];
  slots: PreassignedSongSlot[];
  adjustables: {
    axis: DiversityAxisId;
    labelKo: string;
    current: { id: string; count: number }[];
    alternatives: { id: string; labelKo: string; whyKo: string }[];
  }[];
  warnings: string[];
  /**
   * v3.68 (TASK E) — Korean summary lines of any 'strong'-confidence rating
   * insight actually applied to this plan's killing-point assignment (see
   * data/killingPoints.ts's killingPointBoostFromInsights), for Step2Plan.tsx's
   * "지난 평가 반영" banner. Empty whenever history.insights was empty/
   * undefined — including when the user has turned the banner's own "반영
   * 끄기" toggle off, since that toggle works by simply not passing
   * insights into history at all.
   */
  appliedInsightsKo: string[];
}

/** Reuses GenerationOptions.ratingInsights' element shape rather than redeclaring it — see that field's own doc comment in types.ts. */
export type RatingInsightLike = NonNullable<GenerationOptions['ratingInsights']>[number];

interface RankedGenre {
  genre: GenrePack;
  score: number;
  reasons: string[];
}

/** v4.1 (TASK A) — display label for ConceptBreadth, used in interpretation.reasoningKo and (via export) Step2Plan.tsx's radio control. */
export const BREADTH_LABEL_KO: Record<ConceptBreadth, string> = {
  focused: '집중형',
  balanced: '균형형',
  variety: '폭넓게'
};

const AXIS_LABEL_KO: Record<DiversityAxisId, string> = {
  genre: '장르',
  vocalType: '보컬',
  introTexture: '인트로 질감 그룹',
  hookDevice: '훅 장치 그룹',
  arrangementDensity: '편곡 밀도',
  structureTemplate: '구조',
  lyricTheme: '가사 장면',
  pov: '시점'
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasAny(text: string, terms: string[]) {
  return terms.some(term => text.includes(term));
}

function deriveEraFocus(freeText: string, refs: DecomposedReference[]): string[] {
  const text = normalizeText(freeText);
  const eras = new Set<string>();
  for (const ref of refs) eras.add(ref.eraTag);
  if (/(60s|1960|60년|60년대|비틀|beat)/i.test(text)) eras.add('1960s beat-pop / old-pop');
  if (/(70s|1970|70년|70년대|7080|카펜|carpenter|abba|아바)/i.test(text)) eras.add('1970s soft pop / AM radio');
  if (/(80s|1980|80년|80년대)/i.test(text)) eras.add('1980s adult contemporary');
  if (/(샹송|chanson)/i.test(text)) eras.add('mid-century chanson');
  if (/(재즈|jazz)/i.test(text)) eras.add('classic jazz lounge');
  if (!eras.size && /(올드팝|old pop|oldies|옛날|추억)/i.test(text)) eras.add('1960s-80s old-pop warmth');
  return [...eras];
}

function inferSeasonId(freeText: string, channel: ChannelProfile) {
  const matched = matchConceptRules(freeText);
  const seasonScores = new Map<string, number>();
  for (const rule of matched) {
    for (const [id, score] of Object.entries(rule.seasonWeights || {})) {
      seasonScores.set(id, (seasonScores.get(id) || 0) + score);
    }
  }
  const top = [...seasonScores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (top && seasonPacks.some(season => season.id === top)) return top;
  if (isKidsArchetype(channel.archetype)) return 'spring-open';
  return seasonPacks.some(season => season.id === 'spring-open') ? 'spring-open' : seasonPacks[0].id;
}

function inferMoodIds(freeText: string, channel: ChannelProfile) {
  const matched = matchConceptRules(freeText);
  const moodScores = new Map<string, number>();
  for (const rule of matched) {
    for (const [id, score] of Object.entries(rule.moodWeights || {})) {
      moodScores.set(id, (moodScores.get(id) || 0) + score);
    }
  }
  const ranked = [...moodScores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const fallback = channel.preferredMoods.length ? channel.preferredMoods : ['warm', 'nostalgic'];
  return [...new Set([...ranked, ...fallback])].filter(id => moodPacks.some(mood => mood.id === id)).slice(0, 2);
}

// TASK (genre-archetype sanitization) — the actual predicate now lives in
// data/genreLibrary/index.ts's isGenreEligibleForArchetype (extracted
// unchanged, see its own doc comment) so core/genreSelection.ts's
// sanitizeGenreIdsForArchetype can reuse the exact same rule this file's own
// candidate filtering already relies on. Kept as a thin channel-shaped
// wrapper since every call site below already has `channel`, not a bare
// archetype.
function genreMatchesChannel(genre: GenrePack, channel: ChannelProfile) {
  return isGenreEligibleForArchetype(genre, channel.archetype || 'senior-morning');
}

/**
 * TASK v4.9 (TASK A, §1-5) — concept-text keyword hints for which
 * data/paletteFamilies.ts family a set should stay within. Checked in
 * PALETTE_FAMILIES' own declared order (acoustic-soft, bright-pop,
 * orchestral, soul) so a concept naming more than one family's artists
 * (rare) resolves deterministically rather than by object-key iteration
 * order.
 */
const PALETTE_FAMILY_HINT_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['family-acoustic-soft', /(포크|사이먼|가펑클|카펜터|carpenter|이글스|eagles|존\s?덴버|denver|어쿠스틱|acoustic)/i],
  ['family-bright-pop', /(아바|abba|비틀|beat|걸그룹|두왑|doowop|유로팝|europop)/i],
  ['family-orchestral', /(샹송|chanson|톰\s?존스|tom\s?jones|엥겔베르트|engelbert|오케스트럴|orchestral|크루너|크루나|crooner)/i],
  ['family-soul', /(소울|soul|모타운|motown|필라델피아|philly)/i]
];

/**
 * TASK v5.7 (TASK C §3-3/§3-5) — real gap this closes: "60년대 감미로운
 * 올드팝" had no artist/genre keyword PALETTE_FAMILY_HINT_PATTERNS could
 * match ("감미로운" isn't an artist or genre name), so resolveMainFamilyId
 * fell straight through to the recency-rotation fallback, which landed on
 * family-bright-pop by coincidence (whichever family this channel used
 * least recently) — the loudest/brightest 60s genres, the opposite of what
 * "sweet/tender/mellow" asked for. Keyed by each MOOD_CLUSTERS entry's own
 * first descriptor (constraints.ts) so this table and the dictionary can't
 * drift apart silently — a new cluster added there with no entry here just
 * means that mood falls through to the existing rotation fallback, not a
 * crash.
 */
const MOOD_FAMILY_HINT: Record<string, string> = {
  sweet: 'family-orchestral',
  calm: 'family-acoustic-soft',
  bright: 'family-bright-pop',
  wistful: 'family-orchestral',
  warm: 'family-acoustic-soft',
  lyrical: 'family-orchestral'
};

/** TASK v5.7 (TASK C) — exported so setDirector's own ConceptAxisCoverage builder and Step2Plan.tsx can both tell whether a detected mood actually influenced the family/genre axis, without re-deriving the MOOD_FAMILY_HINT lookup themselves. */
export function moodFamilyHint(mood: MoodConstraint | undefined): string | undefined {
  if (!mood) return undefined;
  for (const descriptor of mood.descriptors) {
    const familyId = MOOD_FAMILY_HINT[descriptor];
    if (familyId) return familyId;
  }
  return undefined;
}

/**
 * TASK v4.9 (TASK A, §1-5) — resolves this set's own "주 그룹"
 * (data/paletteFamilies.ts PaletteFamily): an explicit `override` (Step2Plan's
 * family selector) always wins; failing that, a concept-text keyword hint;
 * failing that, a mood-adjective hint (v5.7, TASK C — see MOOD_FAMILY_HINT
 * above); failing that, the family least represented in this channel's own
 * recent genre history (`history.recentGenreIds`, mapped to families via
 * paletteFamilyForGenreId) — so consecutive sets for the same channel
 * naturally rotate through families instead of always landing on the same
 * default. Falls back to family-acoustic-soft (the widest, safest default)
 * when history is empty or maps to nothing.
 */
export function resolveMainFamilyId(
  freeText: string,
  history: { recentGenreIds: string[] },
  override?: string
): string {
  if (override && PALETTE_FAMILIES.some(family => family.id === override)) return override;
  for (const [familyId, pattern] of PALETTE_FAMILY_HINT_PATTERNS) {
    if (pattern.test(freeText)) return familyId;
  }
  const moodHintFamilyId = moodFamilyHint(extractMoodConstraint(freeText));
  if (moodHintFamilyId) return moodHintFamilyId;
  const recentFamilyCounts = new Map<string, number>(PALETTE_FAMILIES.map(family => [family.id, 0]));
  for (const genreId of history.recentGenreIds) {
    const family = paletteFamilyForGenreId(genreId);
    if (family) recentFamilyCounts.set(family.id, (recentFamilyCounts.get(family.id) ?? 0) + 1);
  }
  const [leastUsedFamilyId] = [...recentFamilyCounts.entries()].sort((a, b) => a[1] - b[1])[0] ?? ['family-acoustic-soft'];
  return leastUsedFamilyId;
}

function scoreGenre(
  genre: GenrePack,
  freeText: string,
  refs: DecomposedReference[],
  eraFocus: string[],
  channel: ChannelProfile,
  history: { recentGenreIds: string[] },
  /** TASK v4.9 (TASK A) — when set, a genre reachable ONLY via this family's own palettes (not a compatible neighbor) gets a strong boost, so chooseGenreIds' targetCount fills with main-family genres before any compatible-family genre gets a look-in. */
  mainFamilyId?: string,
  /** v5.7 (TASK v5.7, TASK C §3-3) — see constraints.ts's extractMoodConstraint; undefined when the concept text has no recognized mood adjective (never invented — see this task's own "억지로 매칭하지 말 것"). */
  mood?: MoodConstraint
): RankedGenre {
  const text = normalizeText(freeText);
  const haystack = normalizeText([
    genre.id,
    genre.label,
    genre.styleCore,
    genre.signatureSound,
    genre.eraTag,
    genre.categoryId,
    ...(genre.instruments || []),
    ...(genre.goodFor || []),
    ...(genre.audiences || []),
    ...(genre.moods || []),
    ...(genre.aliases || [])
  ].join(' '));
  let score = genre.tier === 'core' ? 2 : 0.75;
  const reasons: string[] = [];

  if (channel.preferredGenres.includes(genre.id)) {
    score += 1.5;
    reasons.push('채널 기본 장르');
  }
  if (history.recentGenreIds.includes(genre.id)) score -= 2;

  for (const rule of matchConceptRules(freeText)) {
    const weight = rule.genreWeights?.[genre.id] || 0;
    if (weight) {
      score += weight * 2;
      reasons.push(`키워드 ${rule.id}`);
    }
  }

  for (const ref of refs) {
    const index = ref.suggestedGenreIds.indexOf(genre.id);
    if (index >= 0) {
      score += 12 - index * 2;
      reasons.push('참조 사운드 분해');
    }
  }

  if (/(비틀|beat)/i.test(text) && (genre.id === 'oldpop-british-beat' || haystack.includes('british beat'))) {
    score += 10;
    reasons.push('1960s 비트팝');
  }
  if (/(카펜|carpenter)/i.test(text) && hasAny(haystack, ['soft rock', 'baroque pop', 'close harmony', 'adult contemporary'])) {
    score += 8;
    reasons.push('따뜻한 1970s 소프트팝');
  }
  if (/(아바|abba)/i.test(text) && hasAny(haystack, ['europop', 'close harmony', 'orchestral easy'])) {
    score += 8;
    reasons.push('밝은 1970s 유럽 팝');
  }
  if (/(샹송|chanson)/i.test(text) && hasAny(haystack, ['chanson', 'french'])) {
    score += 10;
    reasons.push('샹송 키워드');
  }
  if (/(재즈|jazz)/i.test(text) && hasAny(haystack, ['jazz', 'lounge', 'standards'])) {
    score += 7;
    reasons.push('재즈 키워드');
  }
  if (/(올드팝|old pop|oldies|7080|추억)/i.test(text) && genre.id.startsWith('oldpop-')) {
    score += 5;
    reasons.push('올드팝 계열');
  }
  if (/(커피|coffee|아침|morning)/i.test(text) && hasAny(haystack, ['morning', 'coffee', 'warm'])) {
    score += 2.5;
    reasons.push('아침/커피 청취 상황');
  }
  if (eraFocus.some(era => genre.eraTag && normalizeText(era).includes(normalizeText(genre.eraTag).slice(0, 4)))) {
    score += 1.5;
    reasons.push('시대 초점 일치');
  }
  if (mainFamilyId && genreIdsForPaletteFamily(mainFamilyId).has(genre.id)) {
    score += 6;
    reasons.push('주 팔레트 계열');
  }

  // v5.7 (TASK v5.7, TASK C §3-3) — mood.preferredTraits used as a genre
  // matching weight, per this task's own explicit instruction. A genre with
  // no genre.moods/traits data simply scores 0 on this axis (never
  // penalized for missing metadata — same convention applyListeningContextFilter
  // already uses for dynamicRange).
  if (mood) {
    if (hasAny(haystack, mood.descriptors.map(word => word.toLowerCase()))) {
      score += 3;
      reasons.push(`분위기(${mood.sourceText}) 어휘 일치`);
    }
    const dynamicRange = genre.traits?.dynamicRange;
    if (mood.preferredTraits.dynamicRange && dynamicRange && dynamicRange === mood.preferredTraits.dynamicRange) {
      score += 2;
      reasons.push(`분위기(${mood.sourceText}) 다이내믹 일치`);
    }
    if (mood.preferredTraits.tempoLean && genre.tempoRange) {
      const avgTempo = (genre.tempoRange[0] + genre.tempoRange[1]) / 2;
      const tempoBucket = avgTempo < 96 ? 'slow' : avgTempo < 126 ? 'mid' : 'fast';
      if (tempoBucket === mood.preferredTraits.tempoLean) {
        score += 2;
        reasons.push(`분위기(${mood.sourceText}) 템포 일치`);
      }
    }
    if (mood.preferredTraits.harmonyLean?.some(term => haystack.includes(normalizeText(term)))) {
      score += 2;
      reasons.push(`분위기(${mood.sourceText}) 화성 일치`);
    }
  }

  return { genre, score, reasons };
}

function chooseGenreIds(
  freeText: string,
  channel: ChannelProfile,
  songCount: number,
  refs: DecomposedReference[],
  eraFocus: string[],
  history: { recentGenreIds: string[] },
  /**
   * v4.1 (TASK A) — without this, a 'focused' concept ("잔잔한 보사노바
   * 18곡") still got 4-8 genres allocated here, which then failed its OWN
   * (now breadth-aware) designGate.ts check for having too MANY genres —
   * the gate and the allocator disagreeing about what "focused" means.
   * Reuses designGate.ts's BREADTH_THRESHOLDS.genre range directly (not a
   * second copy of the numbers) so the two can never drift apart.
   */
  breadth: ConceptBreadth = 'balanced',
  /** TASK v4.9 (TASK A, §1-3) — when set, the candidate pool is pre-narrowed to genres reachable from this family plus its declared compatibleWith neighbors (data/paletteFamilies.ts) — a non-adjacent-family genre never even reaches scoring, guaranteeing "비인접 그룹 0곡" rather than just discouraging it via score. */
  mainFamilyId?: string,
  /** v5.7 (TASK v5.7, TASK C §3-3) — computed once by the caller (directSetLocal) and threaded through to every scoreGenre call, rather than each call re-deriving it from freeText. */
  mood?: MoodConstraint
) {
  const familyPool = mainFamilyId ? genreIdsForFamilyAndCompatible(mainFamilyId) : undefined;
  const mainOnlyPool = mainFamilyId ? genreIdsForPaletteFamily(mainFamilyId) : undefined;
  const candidates = genreLibrary.filter(genre => genreMatchesChannel(genre, channel) && (!familyPool || familyPool.has(genre.id)));
  const ranked = candidates
    .map(genre => scoreGenre(genre, freeText, refs, eraFocus, channel, history, mainFamilyId, mood))
    .sort((a, b) => b.score - a.score || a.genre.id.localeCompare(b.genre.id));
  const { min: breadthMin, max: breadthMax } = BREADTH_THRESHOLDS[breadth].genre;
  const minimumForCap = clamp(Math.ceil(songCount / 5), breadthMin, breadthMax);
  const targetCount = clamp(Math.max(minimumForCap, ranked.filter(item => item.score >= 5).length >= 5 ? 5 : minimumForCap), breadthMin, breadthMax);
  const selected: string[] = [];
  const add = (id: string | undefined) => {
    if (!id || selected.includes(id)) return;
    const genre = getGenreById(id);
    if (!genre || !genreMatchesChannel(genre, channel)) return;
    if (familyPool && !familyPool.has(id)) return;
    selected.push(id);
  };

  // TASK v4.9 (TASK A, §1-3) bugfix — real measurement: a +6 scoreGenre boost
  // (see scoreGenre's own mainFamilyId branch) was nowhere near enough to
  // beat an existing keyword rule (e.g. the pre-existing "아바" boost matching
  // ANY genre whose text mentions "close harmony", not just a genuine
  // europop one) plus channel.preferredGenres' own +1.5 — a real "아바 느낌"
  // concept picked 17 compatible-family songs against just 1 main-family
  // song, the opposite of "주 그룹 12곡 이상". A soft score nudge can't give a
  // structural guarantee, so main-family candidates (by rank) are now added
  // FIRST, up to targetCount, before any compatible-family candidate gets a
  // look-in at all; compatible-family only fills whatever's left.
  if (mainOnlyPool) {
    for (const item of ranked) {
      if (!mainOnlyPool.has(item.genre.id)) continue;
      add(item.genre.id);
      if (selected.length >= targetCount) break;
    }
  }
  for (const ref of refs) for (const id of ref.suggestedGenreIds) add(id);
  for (const item of ranked) {
    add(item.genre.id);
    if (selected.length >= targetCount) break;
  }
  for (const id of getCoreGenreIdsForArchetype(channel.archetype || 'senior-morning')) {
    add(id);
    if (selected.length >= targetCount) break;
  }
  return {
    selectedIds: selected.slice(0, targetCount),
    ranked
  };
}

/**
 * TASK v4.9 (TASK A, §1-3) — "인접 그룹 최대 5곡 (28% 이하)". chooseGenreIds'
 * own family-pool filter + scoring boost already biases selection toward
 * main-family genres, but a compatible-family genre can still outscore a
 * weak main-family match on raw keyword/era signals — this is the actual
 * enforcement, applied to the genre axis's final per-genre song counts
 * after core/conceptAgent.ts's allocateGenreCounts (or this file's own
 * era-quota path) has produced them. Shrinks compatible-family genres
 * (largest first) down to `cap` total songs and redistributes the removed
 * count round-robin across whichever main-family genres are already
 * selected — never introduces a genre that wasn't already selected.
 * No-op for family-soul (compatibleWith: [] means every selected genre is
 * already "main"), matching this task's own "다른 그룹과 섞으면 튑니다".
 */
/**
 * 지시문 24 TASK A — `protectedIds` (default none, existing callers keep
 * prior behavior) excludes those ids from the "compatible 장르는 통째로
 * 지운다" removal below. Before this, a user's own explicit genre pick
 * that happened to fall outside mainFamilyId's member set (a completely
 * normal, allowed choice — this function's whole job is to bound
 * cross-family songs, not forbid them) could be deleted entirely with no
 * warning once the compatible total crossed `cap`. A protected id can still
 * be counted toward compatibleTotal and can still push the total over cap
 * (accepted as the lesser problem — matching allocateGenreCounts' own
 * "over cap as last resort beats silently dropping the pick" precedent),
 * it just can never be the one removed.
 */
function capCompatibleFamilySongs(counts: Record<string, number>, mainFamilyId: string, cap: number, protectedIds: string[] = []): Record<string, number> {
  const mainGenreIds = genreIdsForPaletteFamily(mainFamilyId);
  const protectedSet = new Set(protectedIds);
  const result = { ...counts };
  const compatibleIds = Object.keys(result).filter(id => !mainGenreIds.has(id));
  const compatibleTotal = compatibleIds.reduce((sum, id) => sum + (result[id] ?? 0), 0);
  if (compatibleTotal <= cap) return result;
  // TASK v4.9 bugfix — a real regression: partially shrinking a compatible
  // genre by an arbitrary "excess" amount could leave it at exactly 1 song,
  // reintroducing the exact bug tests/genreSingletonRootCause.test.ts exists
  // to catch. A compatible genre is now only ever removed ENTIRELY (smallest
  // count first) until the running total is back under the cap — never
  // partially reduced, so it either survives at its own real count or
  // disappears outright, same as this app's other genre-count paths.
  let removedTotal = 0;
  const sortedCompatible = [...compatibleIds]
    .filter(id => !protectedSet.has(id))
    .sort((a, b) => (result[a] ?? 0) - (result[b] ?? 0));
  for (const id of sortedCompatible) {
    if (compatibleTotal - removedTotal <= cap) break;
    removedTotal += result[id] ?? 0;
    delete result[id];
  }
  const mainIds = Object.keys(result).filter(id => mainGenreIds.has(id));
  let remaining = removedTotal;
  let idx = 0;
  while (remaining > 0 && mainIds.length) {
    const id = mainIds[idx % mainIds.length];
    result[id] = (result[id] ?? 0) + 1;
    remaining -= 1;
    idx += 1;
  }
  return result;
}

/**
 * TASK v3.63 (TASK B-3) — a user checking 1+ GenreFamily boxes picks the
 * genre axis directly by musical similarity ("샹송+pop", "abba/카펜터스 계열")
 * instead of relying on free-text keyword scoring. Round-robins across the
 * selected families (rather than dumping one family's full member list
 * first) so a 2+ family pick actually blends, capped at 9 total ids
 * (membersPerFamilyForSelection already targets 4-9 for 1-2 families; the
 * cap here is what keeps 3+ families from exceeding it — see
 * genreFamilies.test.ts's own note on why that arithmetic needs a caller-side cap).
 */
const MAX_FAMILY_GENRE_SELECTION = 9;

function chooseGenreIdsFromFamilies(familyIds: string[], channel: ChannelProfile): { selectedIds: string[]; families: GenreFamily[] } {
  const families = familyIds
    .map(id => GENRE_FAMILIES.find(family => family.id === id))
    .filter((family): family is GenreFamily => Boolean(family));
  if (!families.length) return { selectedIds: [], families: [] };

  const perFamily = membersPerFamilyForSelection(families.length);
  const pools = families.map(family => family.memberGenreIds.filter(id => {
    const genre = getGenreById(id);
    return genre && genreMatchesChannel(genre, channel);
  }).slice(0, perFamily));

  const selected: string[] = [];
  let round = 0;
  while (selected.length < MAX_FAMILY_GENRE_SELECTION) {
    let addedThisRound = false;
    for (const pool of pools) {
      if (selected.length >= MAX_FAMILY_GENRE_SELECTION) break;
      const id = pool[round];
      if (id && !selected.includes(id)) {
        selected.push(id);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
    round += 1;
  }
  return { selectedIds: selected, families };
}

function countsFromSlots(ids: string[], songCount: number, maxPer?: number) {
  const counts: Record<string, number> = {};
  if (!ids.length || songCount <= 0) return counts;
  let index = 0;
  let guard = 0;
  while (Object.values(counts).reduce((sum, count) => sum + count, 0) < songCount && guard < songCount * ids.length * 2) {
    const id = ids[index % ids.length];
    if (!maxPer || (counts[id] || 0) < maxPer) counts[id] = (counts[id] || 0) + 1;
    index += 1;
    guard += 1;
    if (maxPer && ids.every(item => (counts[item] || 0) >= maxPer)) break;
  }
  return counts;
}

function exactBalancedCounts(ids: readonly string[], songCount: number) {
  const counts: Record<string, number> = {};
  if (!ids.length || songCount <= 0) return counts;
  for (let idx = 0; idx < songCount; idx += 1) {
    const id = ids[idx % ids.length];
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

function vocalCounts(songCount: number) {
  return exactBalancedCounts(VOCAL_TYPE_IDS, songCount);
}

/**
 * v3.77 (TASK A) — real gap found while verifying this task's own §10 "결과물
 * 검사에서 이 기능이 작동했는가를 직접 확인": the real Step2Concept -> Step2Plan
 * -> generate UI flow bakes THIS function's blind, vocalTone-blind
 * vocalCounts(songCount) split into plan.allocations as a 'manual' axis, and
 * core/diversityAllocation.ts's applyAxisAllocation always lets a manual
 * allocation win over the auto/leaning-aware quota — so leaningAdultVocalQuota
 * (however correct in isolation) never actually reached a real end-to-end
 * generation, only direct generateLocalBlueprint/preallocateSongSlots calls
 * with no diversityAllocations override (exactly what this session's own unit
 * tests use). This computes the SAME leaning the auto path would, so the
 * manual allocation directSetLocal hands off is leaning-aware from the start
 * instead of silently discarding vocalTone. Scoped to directSetLocal's own
 * plain (non-segment) path only — buildSetPlanFromIntent's segment/
 * artist-blend path still uses the blind split; a documented, not silent,
 * remaining gap (see this task's own report).
 *
 * P0 fix (정합성 점검 §1) — a channel with a fixed vocalQuotaOverride (e.g.
 * kr-idol-male's real {male:15,female:0,mixed:3}) used to fall straight
 * through to the generic 6/6/6 vocalCounts(songCount) below, same as any
 * other channel. That blind split got stamped into plan.allocations as a
 * 'manual' axis (see makeAllocations below), and
 * core/diversityAllocation.ts's applyAxisAllocation always lets a manual
 * allocation win — so it silently overrode the correct, vocalQuotaOverride-
 * aware quota core/batchPreallocation.ts's real generation path computes for
 * itself (baseVocalQuota there). Net effect: every kr-idol-male/female
 * channel failed the design gate's vocal-quota-fidelity check unconditionally,
 * regardless of concept. Mirrors designGate.ts's own vocalQuotaForAutoFix,
 * which already gets this right for the same reason (a fixed quota channel's
 * autoFix must never suggest discarding its own imbalance) — same priority,
 * same scaleVocalQuota call, and same "leaning never applies" rule a fixed
 * quota already implies in batchPreallocation.ts/localGenerator.ts.
 */
function resolveVocalCounts(channel: ChannelProfile, songCount: number, vocalTone: string | undefined): Record<string, number> {
  if (channel.vocalQuotaOverride) return { ...scaleVocalQuota(channel.vocalQuotaOverride, songCount) };
  if (isKidsArchetype(channel.archetype) || !vocalTone) return vocalCounts(songCount);
  const leaning = leaningGenderFor({ channel, vocalTone });
  if (!leaning) return vocalCounts(songCount);
  return { ...leaningAdultVocalQuota(DEFAULT_ADULT_VOCAL_QUOTA, songCount, leaning) };
}

/**
 * v5.7 follow-up (TASK v5.7 §4-2 verification) — real measurement found
 * that the "관점(POV)" picker in Step2Concept.tsx (opts.perspective) was
 * silently discarded the moment a real user reached Step2Plan.tsx: that
 * screen's applyPlanToOptions copies THIS function's manual 'pov' axis
 * (via makeAllocations) into opts.diversityAllocations, and
 * core/diversityAllocation.ts's applyAxisAllocation always lets a manual
 * allocation win over generateLocalBlueprint's own perspective-aware
 * defaultPovPattern — the exact same "auto default allocation baked into a
 * manual axis and shipped to Step2Plan wins over an explicit user choice"
 * bug class v3.77 (TASK A) already found and fixed for vocalTone
 * (resolveVocalCounts). Mirrors that fix's shape exactly: thread the user's
 * real choice through as a plain optional parameter (not a new mechanism),
 * defaulting to 'firstPerson' — the same default this function always used
 * — so every existing caller that doesn't pass a perspective keeps its
 * exact prior behavior. Secondary/tertiary resolution mirrors
 * lyricDiversityPlan.ts's own defaultPovPattern exactly, so the manual axis
 * this hands off agrees with what the (now-overridden) auto plan would have
 * produced instead of picking its own independent order.
 *
 * TASK v6.0 (perspectiveMode) — `mode` added, defaulting to 'dominant' (this
 * function's own pre-existing body, unchanged when mode is omitted or
 * 'dominant' — the regression-safety contract this task's own report
 * verifies). The actual per-mode count math now lives in
 * lyricDiversityPlan.ts's povDistribution (shared with that file's own
 * auto/fallback pov path) rather than being reimplemented here a second time.
 */
function povCounts(songCount: number, perspective?: LyricPerspective, mode: PerspectiveMode = 'dominant'): Record<string, number> {
  return povDistribution(songCount, perspective, mode);
}

/**
 * v5.7 (TASK v5.7, TASK A §1-4) — was `moneyChordMode: 'default'` and
 * `earwormMode: true`, both hardcoded literals that discarded whatever the
 * user had actually picked in Step2Concept before SetPlan ever saw it (see
 * this task's own root-cause note on setDirector.ts:633). `choices` is
 * optional (every pre-existing caller that doesn't pass one gets the exact
 * same 'default'/customMoneyChord:'' behavior as before — a deliberate
 * no-regression default, not a silent behavior change), but any caller that
 * DOES have the user's real choices (Step2Plan.tsx, multiSetGeneration.ts)
 * should pass them so the plan's own preview/design-gate/adjustables agree
 * with what generation will actually do. earwormMode now defaults to
 * `false` (this app's own real default — see utils/generation.ts's
 * createInitialOptions) instead of a hardcoded `true` this function invented
 * on its own with no UI control feeding it.
 */
function buildBaseOptions(
  freeText: string,
  channel: ChannelProfile,
  songCount: number,
  genreIds: string[],
  allocations: AxisAllocation[],
  choices: UserExplicitChoices = emptyUserChoices()
): GenerationOptions {
  const moneyChordMode = choices.source.moneyChordMode === 'user' && choices.moneyChordMode ? choices.moneyChordMode : 'default';
  return {
    channel,
    projectTitle: freeText.trim() || 'Set Plan',
    songCount,
    lyricLanguage: choices.source.lyricLanguage === 'user' && choices.lyricLanguage ? choices.lyricLanguage : channel.primaryLanguage,
    market: channel.market,
    audience: channel.audience,
    genreIds,
    moodIds: inferMoodIds(freeText, channel),
    seasonId: choices.source.seasonId === 'user' && choices.seasonId ? choices.seasonId : inferSeasonId(freeText, channel),
    vocalTone: choices.source.vocalTone === 'user' && choices.vocalTone ? choices.vocalTone : channel.defaultVocal,
    perspective: choices.source.perspective === 'user' && choices.perspective ? choices.perspective : 'firstPerson',
    // TASK v6.0 (perspectiveMode) — same "explicit choice" shape as
    // moneyChordMode just below: undefined here (not a hardcoded 'dominant')
    // so this plan's own makeAllocations can tell "user really picked a
    // mode" apart from "nothing chosen yet" and apply the kids-varied
    // fallback (resolvePerspectiveMode) only in the latter case.
    perspectiveMode: choices.source.perspectiveMode === 'user' && choices.perspectiveMode ? choices.perspectiveMode : undefined,
    perspectiveModeIsExplicitChoice: choices.source.perspectiveMode === 'user',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode,
    moneyChordModeIsExplicitChoice: choices.source.moneyChordMode === 'user',
    customMoneyChord: moneyChordMode === 'custom' ? (choices.customMoneyChord ?? '') : '',
    customConcept: freeText,
    referenceMood: '',
    genreBlendWeights: {},
    // v5.7 follow-up (TASK v5.7 §4-2 verification) — was hardcoded '',
    // meaning this preview's own buildLyricThemePlan call (below, via
    // makeAllocations) could never know about a real customLyricThemeScene
    // the user actually typed into DiversityAllocationPanel's "직접 주제/상황"
    // textarea — so the 'lyricTheme' manual axis Step2Plan.tsx bakes into
    // opts.diversityAllocations (applyPlanToOptions) never included the
    // user's own scene, and that manual axis always wins over the real
    // auto plan (which DOES read the real customLyricThemeScene) at
    // generation time — same "manual preview axis silently discards an
    // explicit user input" bug class as vocalTone (v3.77) and perspective
    // (this same follow-up session, see povCounts' own doc comment).
    customLyricThemeScene: choices.source.customLyricThemeScene === 'user' && choices.customLyricThemeScene ? choices.customLyricThemeScene : '',
    avoidWords: channel.forbiddenCliches.join(', '),
    negativeStyle: '',
    introUniqueness: 100,
    diversityAllocations: allocations,
    personaMode: false,
    earwormMode: false
  };
}

function makeAllocations(freeText: string, channel: ChannelProfile, songCount: number, genreIds: string[], vocalTone?: string, choices?: UserExplicitChoices, protectedGenreIds: string[] = []): AxisAllocation[] {
  const emptyBase = buildBaseOptions(freeText, channel, songCount, genreIds, [], choices);
  // TASK v3.64 (TASK A) — this used to slice the theme pool in raw array
  // order (the first N ids), which bypassed core/lyricDiversityPlan.ts's
  // frame-capped allocation entirely: the naive slice becomes THIS axis's
  // 'manual' allocation, and preallocateSongSlots always lets a manual
  // allocation win over its own auto (frame-aware) computation — so every
  // real senior-morning plan built through directSetLocal kept landing on
  // 18/18 solitary-object themes regardless of the new frames existing at
  // all. Reuses the exact same seed preallocateSongSlots will later derive
  // from this same opts shape (seedForBlueprint only reads channel.id/
  // projectTitle, both already fixed here), so this axis and the slots it
  // seeds agree instead of drifting.
  const seed = hashSeed(seedForBlueprint(emptyBase));
  const lyricThemeIds = buildLyricThemePlan(emptyBase, seed);
  const lyricThemeCounts: Record<string, number> = {};
  for (const id of lyricThemeIds) lyricThemeCounts[id] = (lyricThemeCounts[id] ?? 0) + 1;
  const introIds = introTexturesForArchetype(channel.archetype || 'senior-morning').map(texture => texture.id);
  const hookIds = hookDevices.map(device => device.id);
  const structureIds = ADULT_STRUCTURE_TEMPLATE_IDS;
  const genreAllocation = allocateGenreCounts(genreIds, songCount, protectedGenreIds);

  return [
    {
      axis: 'genre',
      mode: 'manual',
      counts: Object.fromEntries(genreAllocation.map(slot => [slot.genreId, slot.songCount]))
    },
    { axis: 'vocalType', mode: 'manual', counts: resolveVocalCounts(channel, songCount, vocalTone) },
    { axis: 'introTexture', mode: 'manual', counts: countsFromSlots(introIds, songCount, 4) },
    { axis: 'hookDevice', mode: 'manual', counts: countsFromSlots(hookIds, songCount, 4) },
    // v4.16 (TASK B) — weighted 3:4:2 (sparse:medium:full, see promptComposer.ts's
    // arrangementDensityCounts), not an even split — §2-3's own explicit
    // "full 을 4곡 이하로 제한하는 것이 핵심".
    { axis: 'arrangementDensity', mode: 'manual', counts: arrangementDensityCounts(songCount) },
    { axis: 'structureTemplate', mode: 'manual', counts: exactBalancedCounts(structureIds, songCount) },
    { axis: 'lyricTheme', mode: 'manual', counts: lyricThemeCounts },
    // v5.7 follow-up — emptyBase.perspective is buildBaseOptions' own
    // choices.perspective-aware resolution (see that function's existing
    // `choices.source.perspective === 'user' ? ... : 'firstPerson'` line,
    // which this manual axis previously never consulted at all).
    // TASK v6.0 (perspectiveMode) — resolvePerspectiveMode applies the same
    // "explicit choice, else kids-varied, else dominant" fallback this
    // file's buildBaseOptions and lyricDiversityPlan.ts's own auto pov path
    // both use (see that function's doc comment) — a kids channel that never
    // touched Step2Concept's "적용 방식" picker gets a 'varied' manual pov
    // axis here instead of always landing on the 'dominant' 60% split.
    { axis: 'pov', mode: 'manual', counts: povCounts(songCount, emptyBase.perspective, resolvePerspectiveMode(emptyBase)) }
  ] satisfies AxisAllocation[];
}

function allocationCurrent(allocation: AxisAllocation) {
  return Object.entries(allocation.counts).map(([id, count]) => ({ id, count }));
}

function makeAdjustables(allocations: AxisAllocation[], ranked: RankedGenre[]): SetPlan['adjustables'] {
  return allocations.map(allocation => {
    const alternatives = allocation.axis === 'genre'
      ? ranked
        .filter(item => !allocation.counts[item.genre.id])
        .slice(0, 6)
        .map(item => ({
          id: item.genre.id,
          labelKo: item.genre.label,
          whyKo: item.reasons.slice(0, 2).join(', ') || `${item.genre.tier || 'extended'} 후보`
        }))
      : [];
    return {
      axis: allocation.axis,
      labelKo: AXIS_LABEL_KO[allocation.axis],
      current: allocationCurrent(allocation),
      alternatives
    };
  });
}

function intentSummaryKo(freeText: string, eraFocus: string[], genreIds: string[], families: GenreFamily[]) {
  const genreLabels = genreIds.map(id => getGenreById(id)?.label || id).slice(0, 4).join(', ');
  const eraText = eraFocus.length ? eraFocus.join(', ') : '채널 기본 올드팝/성인 팝';
  if (families.length) {
    const familyLabels = families.map(family => family.labelKo).join(' + ');
    return `${familyLabels} 패밀리${freeText.trim() ? ` + "${freeText.trim()}"` : ''} 입력을 ${eraText} 중심의 ${genreLabels} 세트로 해석했습니다.`;
  }
  return `"${freeText.trim() || '무지정'}" 입력을 ${eraText} 중심의 ${genreLabels} 세트로 해석했습니다.`;
}

// ============================================================
// v3.63 재작성 (TASK B) — segments, blending, and listening-context
// detection. Everything below is NEW and additive: it only activates for
// inputs the OLD single-pass keyword logic above genuinely couldn't handle
// (2+ known artist references, an explicit "X 느낌이 나는 Y" blend pattern).
// A plain single-reference/no-reference/family-picker input never reaches
// this code — it keeps using the exact logic above, unchanged, so every
// pre-existing directSetLocal test keeps passing byte-for-byte.
// ============================================================

const NO_LISTENING_CONTEXT_KO = '특별한 청취 상황 지정 없음';

function evenSplit(segmentCount: number, songCount: number): number[] {
  const base = Math.floor(songCount / segmentCount);
  const remainder = songCount - base * segmentCount;
  return Array.from({ length: segmentCount }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * TASK B (1-3) — "9곡씩" / "각각 10곡" / "반반" quantity-phrase parsing.
 * Anything else (including no quantity phrase at all) falls back to an even
 * split — never throws, never leaves a segment at 0.
 */
export function parseQuantityPhrase(freeText: string, segmentCount: number, songCount: number): number[] {
  if (segmentCount <= 1) return [songCount];
  const text = normalizeText(freeText);
  const eachMatch = text.match(/(\d+)\s*곡\s*씩/) || text.match(/각각\s*(\d+)\s*곡/);
  if (eachMatch) {
    const each = clamp(parseInt(eachMatch[1], 10) || 0, 1, songCount);
    const counts = Array(segmentCount).fill(each);
    const total = each * segmentCount;
    if (total !== songCount) counts[counts.length - 1] = Math.max(1, counts[counts.length - 1] + (songCount - total));
    return counts;
  }
  return evenSplit(segmentCount, songCount);
}

/**
 * TASK B (1-3) — "샹송 느낌이 나는 올드팝" style genre-blend requests. The
 * capture groups are deliberately a single unbroken token (`[\p{L}0-9]+`)
 * right before the trigger phrase, not `.+?`, so noise earlier in the
 * sentence ("7080 올드팝 채널에 샹송 느낌이 나는 올드팝") doesn't get pulled
 * into the flavor hint — only the word immediately before "느낌이 나는" does.
 */
function detectBlendHint(freeText: string): { flavorKo: string; anchorKo: string } | undefined {
  const match = freeText.match(/([\p{L}0-9]+)\s*(?:느낌이?\s*나는|느낌의|풍의|스타일의)\s*(.+)/u);
  if (!match) return undefined;
  const flavorKo = match[1].trim();
  const anchorKo = match[2].trim();
  if (!flavorKo || !anchorKo || flavorKo === anchorKo) return undefined;
  return { flavorKo, anchorKo };
}

/**
 * TASK B (1-3) — resolves a short Korean/English hint phrase ("샹송",
 * "올드팝") to a single concrete genre id by reusing the same keyword-scoring
 * chooseGenreIds already uses for the whole free-text input — proven
 * accurate for exactly this kind of Korean genre-name text (see
 * scoreGenre's own 샹송/재즈/올드팝/카펜/아바 regex cases).
 */
function resolveHintToGenreId(hintText: string, channel: ChannelProfile, history: { recentGenreIds: string[] }): string | undefined {
  const { ranked } = chooseGenreIds(hintText, channel, 1, [], [], history);
  return ranked[0]?.genre.id;
}

/**
 * TASK B (1-3) — listening-context keyword detection ("커피숍에서" ->
 * low dynamic ceiling + no-conversation-disruption exclusion; "잔잔한" ->
 * low ceiling + a slower tempo hint; "비 오는 날" -> low ceiling). Multiple
 * cues combine (dynamicCeiling only ever tightens, never loosens); an input
 * with none of these just returns the neutral default.
 */
function detectListeningContext(freeText: string): ListeningContext {
  const text = normalizeText(freeText);
  const settingParts: string[] = [];
  const extraExclusions: string[] = [];
  let dynamicCeiling: ListeningContext['dynamicCeiling'] = 'wide';
  let tempoHint: [number, number] | undefined;
  const tighten = (next: ListeningContext['dynamicCeiling']) => {
    const order = { low: 0, medium: 1, wide: 2 };
    if (order[next] < order[dynamicCeiling]) dynamicCeiling = next;
  };

  if (/(커피숍|카페|coffee shop|cafe)/i.test(text)) {
    settingParts.push('커피숍 배경음');
    tighten('low');
    extraExclusions.push('대화를 방해하는 큰 다이내믹');
  }
  if (/(잔잔|조용|차분|calm|quiet|mellow)/i.test(text)) {
    settingParts.push('잔잔한 배경음');
    tighten('low');
    tempoHint = tempoHint || [62, 92];
  }
  if (/(비\s*오는|rainy|장마)/i.test(text)) {
    settingParts.push('비 오는 날 분위기');
    tighten('medium');
    extraExclusions.push('밝고 들뜬 장조 위주 진행');
  }

  return {
    settingKo: settingParts.length ? [...new Set(settingParts)].join(', ') : NO_LISTENING_CONTEXT_KO,
    dynamicCeiling,
    tempoHint,
    extraExclusions
  };
}

/**
 * TASK B (1-3) — things the app genuinely cannot interpret (real-time
 * weather, "today's mood" without any further description) get flagged
 * here instead of silently ignored, per this task's own explicit "조용히
 * 무시하는 것이 가장 나쁩니다" instruction. No weather API is added — the
 * note tells the user to describe it in words instead.
 */
const UNKNOWABLE_PATTERNS: { pattern: RegExp; noteKo: string }[] = [
  { pattern: /오늘\s*(같은\s*)?날씨|이런\s*날씨|날씨에/, noteKo: '"날씨" — 앱은 실시간 날씨를 알 수 없습니다. "비 오는", "맑은"처럼 직접 적어주시면 반영됩니다.' },
  { pattern: /오늘\s*기분|지금\s*기분/, noteKo: '"오늘/지금 기분" — "차분한", "들뜬"처럼 구체적으로 적어주시면 반영됩니다.' },
  { pattern: /요즘\s*(인기|유행)|최근\s*(인기|유행)/, noteKo: '"요즘 인기/유행" — 앱은 실시간 인기 순위를 알 수 없습니다. 원하는 장르나 분위기를 직접 적어주시면 반영됩니다.' }
];

function detectUnknownTerms(freeText: string): string[] {
  return UNKNOWABLE_PATTERNS.filter(({ pattern }) => pattern.test(freeText)).map(({ noteKo }) => noteKo);
}

function profileFromDecomposedReference(ref: DecomposedReference): TraitProfile {
  return {
    eraTag: ref.eraTag,
    instrumentation: ref.instrumentation,
    rhythmFeel: ref.rhythmTraits,
    harmonyTraits: ref.harmonyTraits,
    productionTraits: ref.productionTraits,
    vocalTraits: ref.vocalTraits
  };
}

function candidatesForChannel(channel: ChannelProfile): GenrePack[] {
  return genreLibrary.filter(genre => genreMatchesChannel(genre, channel));
}

/**
 * TASK B (1-4) — dynamicCeiling only ever narrows the candidate list, and
 * only when doing so still leaves >= 4 genres (never lets a listening-
 * context constraint alone collapse a segment down to nothing). Genres with
 * no `.traits` (dynamicRange unknown) are never penalized for it.
 */
function applyListeningContextFilter(ids: string[], listeningContext: ListeningContext): string[] {
  if (listeningContext.dynamicCeiling === 'wide') return ids;
  const order = { low: 0, medium: 1, wide: 2 };
  const ceilingRank = order[listeningContext.dynamicCeiling];
  const filtered = ids.filter(id => {
    const dynamicRange = getGenreById(id)?.traits?.dynamicRange;
    return !dynamicRange || order[dynamicRange] <= ceilingRank;
  });
  return filtered.length >= 4 ? filtered : ids;
}

// ============================================================
// v5.7 (TASK v5.7, TASK C §3-5) — ConceptAxisCoverage. This is the "did the
// app silently ignore part of what 하루 typed" detector §9's own self-check
// question #3 asks for: every axis a concept COULD name is checked here for
// whether it was (a) detected at all and (b) actually reached genre
// selection/prompt, rather than only ever surfacing in a code-review.
// ============================================================

/** A deliberately small, explicit genre-name vocabulary (not a full classifier) — same scope/purpose as constraints.ts's own SINGLE_GENRE_HINT_WORDS, kept separate here since that list isn't exported (private to breadth detection) and this axis check has a slightly different job (any mention, not "exactly one"). */
const GENRE_AXIS_HINT_WORDS = [
  '샹송', '보사노바', '재즈', '발라드', '시티팝', '어쿠스틱', 'r&b', '알앤비',
  '소울', '트로트', '포크', '신스팝', '컨템포러리', '로파이', 'lo-fi', '올드팝', '두왑', '스탠더드'
];

function seasonAxisDetected(freeText: string): boolean {
  return matchConceptRules(freeText).some(rule => Object.keys(rule.seasonWeights || {}).length > 0);
}

function axisEntry(axis: ConceptAxisId, detected: boolean, applied: boolean, appliedTo: string[], sourceText?: string): ConceptAxisCoverage {
  return {
    axis,
    detected,
    sourceText: detected ? sourceText : undefined,
    appliedTo: detected && applied ? appliedTo : [],
    unapplied: detected && !applied
  };
}

/**
 * Builds the 6-axis coverage table for one SetPlan. `moodApplied` differs by
 * caller: directSetLocal's plain/family path threads mood all the way into
 * scoreGenre (see chooseGenreIds' own mood param) and into resolveMainFamilyId
 * (moodFamilyHint), so it's always true there once a mood is detected;
 * buildSetPlanFromIntent's segment/artist-blend path does NOT thread mood
 * through its own matchGenresByTraits-based selection yet — a real,
 * documented gap (not silently glossed over), so callers on that path must
 * pass `moodApplied: false`.
 */
function computeAxisCoverage(input: {
  freeText: string;
  eraDetected: boolean;
  mood?: MoodConstraint;
  moodApplied: boolean;
  referenceCount: number;
  listeningContext: ListeningContext;
  genreAxisApplied: boolean;
}): ConceptAxisCoverage[] {
  const situationDetected = input.listeningContext.settingKo !== NO_LISTENING_CONTEXT_KO;
  const genreAxisDetected = GENRE_AXIS_HINT_WORDS.some(word => input.freeText.toLowerCase().includes(word.toLowerCase()));
  return [
    axisEntry('era', input.eraDetected, input.eraDetected, ['genre selection', 'era quota']),
    axisEntry('mood', Boolean(input.mood), input.moodApplied, ['genre selection(palette family)', 'genre scoring'], input.mood?.sourceText),
    axisEntry('genre', genreAxisDetected, genreAxisDetected && input.genreAxisApplied, ['genre selection']),
    axisEntry('situation', situationDetected, situationDetected, ['genre selection(filter)', 'arrangement'], input.listeningContext.settingKo),
    axisEntry('reference', input.referenceCount > 0, input.referenceCount > 0, ['genre selection(decomposed)']),
    axisEntry('season', seasonAxisDetected(input.freeText), seasonAxisDetected(input.freeText), ['season'])
  ];
}

function segmentGenreIdsFromProfile(profile: TraitProfile, channel: ChannelProfile, limit: number): string[] {
  if (!Object.keys(profile).length) return [];
  return matchGenresByTraits(profile, candidatesForChannel(channel), limit)
    .filter(match => match.score > 0)
    .map(match => match.genreId);
}

interface BuiltBlendSegment {
  genreIds: string[];
  blendedTraits: GenreTraits;
  eraTag: string;
  descriptors: string[];
  warnings: string[];
}

/**
 * TASK B (1-4) — resolves both hint phrases to concrete genres (reusing the
 * proven keyword scorer, not trait-matching, since these are short Korean
 * genre-name fragments, not full musical descriptions), blends them
 * (v3.65's blendGenreTraits — anchor keeps structure/rhythm/era, flavor
 * gives instrumentation/harmony), then re-matches the BLENDED traits
 * against the whole library to add 2-4 genuinely adjacent genres, per this
 * task's own "합성 traits로 다시 매칭해 인접 장르 2~4종 추가" instruction.
 */
function buildBlendSegment(
  flavorHintKo: string,
  anchorHintKo: string,
  channel: ChannelProfile,
  history: { recentGenreIds: string[] }
): BuiltBlendSegment | undefined {
  const anchorGenre = getGenreById(resolveHintToGenreId(anchorHintKo, channel, history) || '');
  const flavorGenre = getGenreById(resolveHintToGenreId(flavorHintKo, channel, history) || '');
  if (!anchorGenre?.traits || !flavorGenre?.traits || anchorGenre.id === flavorGenre.id) return undefined;

  const blended = blendGenreTraits(anchorGenre, flavorGenre, 'medium');
  const adjacent = segmentGenreIdsFromProfile(blended, channel, 6).filter(id => id !== anchorGenre.id && id !== flavorGenre.id);
  const genreIds = [...new Set([anchorGenre.id, flavorGenre.id, ...adjacent])].slice(0, 6);
  const warning = eraDriftWarning(anchorGenre.traits.eraTag, flavorGenre.traits.eraTag);

  return {
    genreIds,
    blendedTraits: blended,
    eraTag: blended.eraTag,
    descriptors: [...blended.instrumentation.slice(0, 2), ...blended.harmonyTraits.slice(0, 2)],
    warnings: warning ? [warning] : []
  };
}

/**
 * v5.7 follow-up (production wiring) — closes the exact gap userChoices.ts's
 * own doc comment names: assertUserChoicesPreserved/assertUserChoicesPreservedOrThrow
 * existed but were only ever called from scripts/v57Measure.ts (a manual
 * measurement script) and test files — never from the live pipeline a real
 * "생성" click actually runs. Called from both directSetLocal and
 * buildSetPlanFromIntent, right after each has finished building `slots` —
 * preallocateSongSlots' own real per-song moneyChordId/genreId decisions,
 * not the axis-allocation preview — i.e. "after genre/moneyChord/vocal/etc.
 * allocation is finalized, not before", per this task's own instruction.
 * moneyChordCounts/genreIdsUsed are read off that same real, already-computed
 * `slots`/`allocations` rather than re-derived, mirroring exactly how
 * scripts/v57Measure.ts builds its own `resolved` argument (moneyChordCounts
 * from a real generated pack's per-song assignment, genreIdsUsed from the
 * plan's own genre axis) instead of duplicating that construction ad-hoc.
 *
 * Per the original task doc's own "개발 모드에서는 throw, 운영에서는
 * blocking 으로 처리하십시오": import.meta.env.PROD === true (a real
 * built-and-shipped app — see vite.config.ts) is the ONLY condition that
 * downgrades a violation to a non-throwing warning string appended to this
 * plan's own `warnings` (SetPlan.warnings — already rendered by
 * Step2Plan.tsx as an `.error`-class paragraph, the exact mechanism that
 * screen already uses for both its own ConceptAxisCoverage "반영되지 않음"
 * warnings and this array's other entries — no new UI surface needed, and
 * generation is never blocked/thrown in production, only flagged). Every
 * other case throws: `npm run dev`/Vitest (import.meta.env.DEV === true,
 * verified empirically) AND plain `tsx` execution (scripts/audit.ts,
 * scripts/v57Measure.ts — import.meta.env itself is undefined there, since
 * neither goes through Vite's transform) — developer-run contexts should
 * fail loudly, not log a warning string nobody's watching stdout for.
 */
function isProductionRuntime(): boolean {
  return typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined' && import.meta.env.PROD === true;
}

/** See isProductionRuntime's own doc comment for the dev/prod split this implements. Returns violation strings to append to SetPlan.warnings in production; throws (rather than returning) everywhere else. */
function checkUserChoicesPreservation(
  choices: UserExplicitChoices,
  slots: PreassignedSongSlot[],
  allocations: AxisAllocation[],
  stage: string
): string[] {
  const moneyChordCounts: Record<string, number> = {};
  for (const slot of slots) {
    if (slot.moneyChordId) moneyChordCounts[slot.moneyChordId] = (moneyChordCounts[slot.moneyChordId] ?? 0) + 1;
  }
  const genreAllocation = allocations.find(allocation => allocation.axis === 'genre');
  const genreIdsUsed = genreAllocation ? Object.keys(genreAllocation.counts) : [];
  const result = assertUserChoicesPreserved(choices, { moneyChordCounts, genreIdsUsed }, stage);
  if (result.ok) return [];
  if (isProductionRuntime()) return result.violations;
  throw new Error(`[UserChoicePreservation] ${result.violations.join(' / ')}`);
}

/**
 * TASK B (2단계) — the single stage-2 function shared by every 1단계
 * interpretation path (directSetLocal's new segment/blend branches, and
 * directSet's LLM-derived intent below): turns an already-interpreted
 * InterpretedIntent into a full SetPlan by reusing the exact same
 * 8-axis/slot machinery (makeAllocations/preallocateSongSlots/
 * makeAdjustables) the original single-segment path already used — no new
 * data structures, per this task's own "새 데이터 구조를 만들지 마십시오".
 */
export function buildSetPlanFromIntent(
  intent: InterpretedIntent,
  channel: ChannelProfile,
  history: { recentGenreIds: string[]; recentHooks: string[]; insights?: RatingInsightLike[] },
  /** v4.1 (TASK A) — pre-computed by the caller (directSetLocal/directSet both already have the original freeText detectConceptBreadth needs; this function only ever sees the already-interpreted InterpretedIntent, not the raw text). Defaults to 'balanced'/'auto' for any caller that hasn't migrated. */
  breadth: ConceptBreadth = 'balanced',
  breadthSource: 'auto' | 'user' = 'auto',
  /**
   * TASK v4.13 bugfix — directSetLocal's own multi-artist-segment
   * ("카펜터스와 아바 9곡씩") and genre-blend ("시티팝 느낌의 발라드") branches
   * both early-return through this function without ever passing the
   * caller's vocalTone along, so this function's own makeAllocations call
   * below always fell back to a blind vocalCounts(songCount) split — no
   * different from omitting vocalTone entirely, regardless of whether the
   * user picked a valid English preset, typed free text, or left it at the
   * channel default. resolveVocalCounts's own doc comment already named this
   * "a documented, not silent, remaining gap"; this closes it the same way
   * directSetLocal's own plain (non-segment) path already works. Optional,
   * trailing — this function has no other caller, so this is purely additive.
   */
  vocalTone?: string,
  /** v5.7 (TASK v5.7, TASK A) — see core/userChoices.ts. Threaded into buildBaseOptions so the plan's own moneyChordMode preview matches what generation will actually use instead of the old hardcoded 'default'. */
  choices: UserExplicitChoices = emptyUserChoices()
): SetPlan {
  const safeSongCount = clamp(intent.segments.reduce((sum, segment) => sum + segment.songCount, 0) || 18, 1, 80);
  const blendWarnings: string[] = [];

  const resolvedSegments: SetSegment[] = intent.segments.map(segment => {
    if (segment.blendHint) {
      const built = buildBlendSegment(segment.blendHint.flavorHintKo, segment.blendHint.anchorHintKo, channel, history);
      if (built) {
        blendWarnings.push(...built.warnings);
        return {
          label: segment.label,
          songCount: segment.songCount,
          genreIds: applyListeningContextFilter(built.genreIds, intent.listeningContext),
          blendedTraits: built.blendedTraits,
          eraTag: built.eraTag,
          descriptors: built.descriptors
        };
      }
    }
    const matchedIds = applyListeningContextFilter(segmentGenreIdsFromProfile(segment.profile, channel, 4), intent.listeningContext);
    const fallbackIds = getCoreGenreIdsForArchetype(channel.archetype || 'senior-morning').slice(0, 4);
    return {
      label: segment.label,
      songCount: segment.songCount,
      genreIds: matchedIds.length ? matchedIds : fallbackIds,
      eraTag: segment.profile.eraTag || 'mixed',
      descriptors: [...(segment.profile.instrumentation ?? []).slice(0, 2), ...(segment.profile.harmonyTraits ?? []).slice(0, 2)]
    };
  });

  // Merge every segment's genre selection into one manual count map, each
  // segment's own ids capped at 5 songs (same per-genre cap the old path
  // enforces) and totaling exactly that segment's own songCount — this is
  // what keeps a "9곡씩" request honestly at 9+9 rather than an
  // approximation.
  //
  // Insertion order matters here, not just the counts: buildGenreCountRotationPlan
  // (genreRotation.ts, reused as-is) only refuses to repeat the single
  // immediately-previous genre id — it has no notion of "segment", so when
  // two ids tie on remaining count it breaks the tie by this map's key
  // order. Inserting segment 1's ids fully before segment 2's let it
  // exhaust one segment's 4 genres before touching the other's, producing
  // runs of ~4 same-segment tracks in a row even though no single genre
  // ever repeated back-to-back — exactly the block-clumping this task
  // exists to avoid. Round-robining one genre id from each segment at a
  // time keeps every segment's ids threaded through the map's order, so
  // the existing tie-break naturally alternates segments too.
  // 정합성 점검 §1 결함1 fix — this seed cap must match the same breadth-aware
  // cap applyEraQuota now uses below (BREADTH_THRESHOLDS[breadth].genre.
  // maxPerGenre), not the old hardcoded 5 — otherwise a genre could already
  // land at 5 songs here, before applyEraQuota even runs, and survive
  // untouched if era-quota trimming never revisits it (era-quota only trims
  // buckets that are OVER their own share cap, not every genre).
  const perSegmentCounts = resolvedSegments.map(segment => Object.entries(genreCountsFromIds(segment.genreIds, segment.songCount, BREADTH_THRESHOLDS[breadth].genre.maxPerGenre)));
  const genreCounts: Record<string, number> = {};
  const maxEntries = Math.max(0, ...perSegmentCounts.map(entries => entries.length));
  for (let i = 0; i < maxEntries; i++) {
    for (const entries of perSegmentCounts) {
      if (i >= entries.length) continue;
      const [id, count] = entries[i];
      genreCounts[id] = (genreCounts[id] ?? 0) + count;
    }
  }
  // v4.2 (TASK A3, TASK B) — the concept's own era constraint (extracted
  // from intentKo, which always carries the user's original decade/artist
  // words verbatim) applied to the merged genre-count map before it becomes
  // the genre axis, so a "60년대 비틀즈" concept can't land 50%+ of its
  // songs in the 1970s bucket the way real measurement showed (see
  // docs/v4.2-a3-report.md). era.unspecified (no decade/artist-era signal)
  // makes applyEraQuota a no-op, per this task's own "억지로 시대를 정하지
  // 말 것". Only applied for a SINGLE resolved segment: a multi-segment
  // request ("카펜터스 9곡 + 아바 9곡") already carries its own explicit
  // per-segment song-count split — a global era quota redistributing counts
  // across segment boundaries would fight that explicit split rather than
  // the vague/single-concept case this task's own measurement was about.
  // v3.79 (TASK A) — segment.eraTag for a BLEND segment (built.eraTag,
  // see buildBlendSegment above) is `anchorGenre.traits.eraTag` — whichever
  // genre chooseGenreIds happened to rank #1 for the anchor hint text, not
  // curated user-facing copy. Real measurement: "비틀즈 느낌이 나는 밝은
  // 60년대 팝" resolved its anchor to `oldpop-soft-rock-am` (eraTag "1970s
  // AM-gold soft rock") despite the hint text itself saying "60년대" — that
  // stray "1970s" then got joined into the haystack below and, once two
  // distinct era buckets are both treated as compound co-primaries (see
  // extractEraConstraint's own hits.length>=2 branch), pulled 50% of the
  // set into 1970s for a concept that never asked for it. blendedTraits is
  // only ever set for blend segments (see SetSegment's own field comment),
  // so it doubles as the "is this eraTag curated or just a genre-ranking
  // side effect" marker — a real DecomposedReference-sourced eraTag (e.g.
  // ARTIST_REFERENCE_SEEDS' curated "early-1970s soft adult-contemporary
  // pop" for 카펜터스) has no blendedTraits and still counts.
  const eraConstraintRaw = resolvedSegments.length === 1
    ? extractEraConstraint([intent.intentKo, ...resolvedSegments.filter(segment => !segment.blendedTraits).map(segment => segment.eraTag)].filter(Boolean).join(' '))
    : { primary: 'timeless' as const, adjacent: [], forbidden: [], unspecified: true };
  const eraConstraint = tightenEraConstraintForSenior(eraConstraintRaw, channel.archetype, safeSongCount);
  // 정합성 점검 §1 결함1 fix — same breadth-aware perGenreCap as directSetLocal's
  // own applyEraQuota call below (see that call site's comment / applyEraQuota's
  // own doc comment on the perGenreCap parameter).
  const { counts: quotaAdjustedGenreCounts, warnings: eraQuotaWarnings } = applyEraQuota(
    genreCounts,
    safeSongCount,
    eraConstraint,
    genre => genreMatchesChannel(genre, channel),
    undefined,
    BREADTH_THRESHOLDS[breadth].genre.maxPerGenre
  );
  const selectedIds = Object.keys(quotaAdjustedGenreCounts);

  const allocations = makeAllocations(intent.intentKo, channel, safeSongCount, selectedIds, vocalTone, choices);
  const genreAxisIndex = allocations.findIndex(item => item.axis === 'genre');
  if (genreAxisIndex >= 0) allocations[genreAxisIndex] = { axis: 'genre', mode: 'manual', counts: quotaAdjustedGenreCounts };

  // TASK v3.68 (TASK E) — only ever set when the caller (Step2Plan.tsx's
  // "지난 평가 반영" toggle) explicitly passes insights; undefined here
  // means preallocateSongSlots' own killingPointBoostFromInsights call
  // computes an empty boost map, i.e. zero influence — exactly what the
  // toggle turning "off" needs.
  const opts = { ...buildBaseOptions(intent.intentKo, channel, safeSongCount, selectedIds, allocations, choices), ratingInsights: history.insights };
  const selectedIdSet = new Set(selectedIds);
  const genres = genreLibrary.filter(genre => selectedIdSet.has(genre.id));
  const slots = preallocateSongSlots(opts, genres, { usedTitles: [], usedHooks: history.recentHooks });

  const densityAllocation = allocations.find(allocation => allocation.axis === 'arrangementDensity');
  const densityMax = densityAllocation ? Math.max(...Object.values(densityAllocation.counts)) : 0;
  const warnings = [
    ...(selectedIds.length < 4 ? ['장르 후보가 4종 미만입니다. 채널 필터 또는 입력 키워드를 확인하십시오.'] : []),
    ...(densityMax > 5 ? ['arrangementDensity는 내부 값이 3종뿐이라 슬롯 값 기준으로는 5곡 초과가 발생합니다. 브릿지 다양성 그룹에서 5곡 이하 하위 그룹으로 분할합니다.'] : []),
    ...blendWarnings,
    ...eraQuotaWarnings
  ];
  // v5.7 follow-up (production wiring) — see checkUserChoicesPreservation's
  // own doc comment. Throws in dev/tooling contexts; in production appends
  // any violation strings here, so they surface exactly like this array's
  // other entries (Step2Plan.tsx's plan.warnings.map -> `.error` paragraph).
  warnings.push(...checkUserChoicesPreservation(choices, slots, allocations, 'buildSetPlanFromIntent'));
  // TASK v3.68 (TASK E) — Step2.5's "지난 평가 반영" banner text: only
  // 'strong'-confidence killingPointId insights ever produce a line here
  // (mirrors killingPointBoostFromInsights' own filter exactly), counted
  // against how many of this plan's own slots actually landed on that
  // killing point — a real number, not the insight's own historical count.
  const appliedInsightsKo = (history.insights ?? [])
    .filter(insight => insight.attribute === 'killingPointId' && insight.confidence === 'strong')
    .map(insight => {
      const count = slots.filter(slot => slot.killingPointId === insight.value).length;
      const labelKo = killingPointById(insight.value)?.labelKo ?? insight.value;
      return insight.lift >= 0
        ? `${labelKo} 킬링포인트가 반응이 좋아 ${count}곡에 배정했습니다.`
        : `${labelKo} 킬링포인트는 반응이 약해 ${count}곡으로 줄였습니다.`;
    });

  // v5.7 (TASK v5.7, TASK C) — this segment/artist-blend path resolves
  // genres via matchGenresByTraits (segmentGenreIdsFromProfile) or the
  // hint-resolution blend path, NOT chooseGenreIds/scoreGenre — so the mood
  // dictionary isn't threaded into genre scoring here the way directSetLocal's
  // plain/family path does. Detected honestly (extractMoodConstraint still
  // runs), but reported as unapplied rather than silently claiming it worked —
  // a real, documented gap (see computeAxisCoverage's own doc comment).
  const moodConstraint = extractMoodConstraint(intent.intentKo);
  const referenceCount = resolvedSegments.length > 1 ? resolvedSegments.length : (intent.segments[0]?.blendHint ? 1 : 0);
  const axisCoverage = computeAxisCoverage({
    freeText: intent.intentKo,
    eraDetected: !eraConstraint.unspecified,
    mood: moodConstraint,
    moodApplied: false,
    referenceCount,
    listeningContext: intent.listeningContext,
    genreAxisApplied: true
  });

  return {
    interpretation: {
      intentKo: intent.intentKo,
      eraFocus: [...new Set(resolvedSegments.map(segment => segment.eraTag).filter(Boolean))],
      familyIds: [],
      artistReferences: [],
      audienceProfileId: channel.archetype || channel.audience,
      reasoningKo: intent.reasoningKo,
      unknownTermsKo: intent.unknownTermsKo,
      listeningContext: intent.listeningContext,
      breadth,
      breadthSource,
      mood: moodConstraint,
      axisCoverage
    },
    segments: resolvedSegments,
    allocations,
    slots,
    adjustables: makeAdjustables(allocations, []),
    warnings,
    appliedInsightsKo
  };
}

export function directSetLocal(
  freeText: string,
  channel: ChannelProfile,
  songCount: number,
  history: { recentGenreIds: string[]; recentHooks: string[]; insights?: RatingInsightLike[] },
  /** v3.63 (TASK B) — GenreFamily ids from Step2Concept's family picker. When non-empty, these choose the genre axis directly (see chooseGenreIdsFromFamilies); free text still drives era/mood/season/artist-reference interpretation either way. */
  familyIds: string[] = [],
  /**
   * v3.77 (TASK A) — the caller's actual current vocalTone selection (e.g.
   * opts.vocalTone from Step2Plan.tsx), when different from omitted/undefined.
   * Threaded through so this plan's own 'vocalType' manual allocation (see
   * resolveVocalCounts) reflects the same leaning generation-time would apply,
   * instead of a blind even split that then wins over leaning anyway via
   * applyAxisAllocation's manual-always-wins rule. Only affects this
   * function's own plain (non-segment) path; omitted entirely preserves this
   * function's exact prior behavior.
   */
  vocalTone?: string,
  /** v4.1 (TASK A) — explicit user choice (GenerationOptions.breadthOverride, Step2Plan.tsx's "이 세트의 성격" radio); undefined trusts detectConceptBreadth's own auto-detection. */
  breadthOverride?: ConceptBreadth,
  /** TASK v4.9 (TASK A, §1-6) — explicit user choice (GenerationOptions.paletteFamilyOverride, Step2Plan.tsx's "이 세트의 계열" radio); undefined trusts resolveMainFamilyId's own auto-resolution (concept keyword hint, then recency rotation). */
  paletteFamilyOverride?: string,
  /** v5.7 (TASK v5.7, TASK A) — see core/userChoices.ts. Threaded into buildBaseOptions/makeAllocations so this plan's own moneyChordMode preview reflects the user's real pick instead of setDirector.ts's old hardcoded 'default'. */
  choices: UserExplicitChoices = emptyUserChoices()
): SetPlan {
  const safeSongCount = clamp(Math.round(songCount) || 18, 1, 80);
  const listeningContext = detectListeningContext(freeText);
  const unknownTermsKo = detectUnknownTerms(freeText);
  const artistReferences = decomposeArtistReferences(freeText).filter(isSafeDecomposedReference);
  // v4.1 (TASK A) — computed once here (not separately per branch below) so
  // every return path — multi-artist segments, blend-hint, and the plain
  // keyword/family path — reports the same breadth in its own
  // interpretation, even though only the plain path's own chooseGenreIds
  // actually acts on it today (multi-artist/blend-hint have their own
  // segment-count semantics — see docs/v410-report.md's own 미구현 note).
  // Also reused below (unchanged) as this function's own pre-existing
  // era-quota input — same freeText/artistReferences inputs, so computing
  // it twice would just be the same result computed again.
  const eraConstraint = extractEraConstraint(freeText, artistReferences.map(ref => ref.eraTag));
  const breadth = breadthOverride ?? detectConceptBreadth(freeText, eraConstraint);
  const breadthSource: 'auto' | 'user' = breadthOverride ? 'user' : 'auto';

  // v3.63 재작성 (TASK B) — 2+ known-artist segments ("카펜터스와 아바 9곡씩").
  // Only when there's no family selection active (a family pick already
  // means "장르로 직접 선택했다" — segments would fight it).
  if (!familyIds.length && artistReferences.length >= 2) {
    const labels = artistReferences.map(ref => `${ref.matchedSurface}풍`);
    const counts = parseQuantityPhrase(freeText, artistReferences.length, safeSongCount);
    return buildSetPlanFromIntent({
      intentKo: `${labels.join(' + ')} ${safeSongCount}곡 세트로 해석했습니다.`,
      segments: artistReferences.map((ref, idx) => ({ label: labels[idx], songCount: counts[idx], profile: profileFromDecomposedReference(ref) })),
      listeningContext,
      reasoningKo: [
        `자유 입력에서 서로 다른 참조 ${artistReferences.length}개(${artistReferences.map(ref => ref.matchedSurface).join(', ')})를 감지해 세그먼트로 분리했습니다.`,
        `곡 수는 ${counts.join('+')}로 배분했습니다(입력에 곡 수 표현이 없으면 균등 분배).`,
        listeningContext.settingKo !== NO_LISTENING_CONTEXT_KO ? `청취 상황(${listeningContext.settingKo})을 반영했습니다.` : '별도 청취 상황 지정은 없었습니다.',
        '아티스트명은 프롬프트에 넣지 않고 음악 특성으로만 분해했습니다.'
      ],
      unknownTermsKo
    }, channel, history, breadth, breadthSource, vocalTone, choices);
  }

  // v3.63 재작성 (TASK B) — explicit "X 느낌이 나는 Y" genre-blend request.
  if (!familyIds.length) {
    const blendHint = detectBlendHint(freeText);
    if (blendHint) {
      const anchorGenre = getGenreById(resolveHintToGenreId(blendHint.anchorKo, channel, history) || '');
      const flavorGenre = getGenreById(resolveHintToGenreId(blendHint.flavorKo, channel, history) || '');
      if (anchorGenre?.traits && flavorGenre?.traits && anchorGenre.id !== flavorGenre.id) {
        return buildSetPlanFromIntent({
          intentKo: `"${blendHint.flavorKo} 느낌이 나는 ${blendHint.anchorKo}" 장르 합성으로 해석했습니다.`,
          segments: [{
            label: `${anchorGenre.label} × ${flavorGenre.label}`,
            songCount: safeSongCount,
            profile: {},
            blendHint: { anchorHintKo: blendHint.anchorKo, flavorHintKo: blendHint.flavorKo, strength: 'medium' }
          }],
          listeningContext,
          reasoningKo: [
            `"${blendHint.flavorKo} 느낌이 나는 ${blendHint.anchorKo}" 패턴을 장르 합성 요청으로 해석해 ${anchorGenre.label}을(를) 뼈대(구조/리듬/시대), ${flavorGenre.label}을(를) 색(악기/화성)으로 사용했습니다.`,
            listeningContext.settingKo !== NO_LISTENING_CONTEXT_KO ? `청취 상황(${listeningContext.settingKo})을 반영했습니다.` : '별도 청취 상황 지정은 없었습니다.'
          ],
          unknownTermsKo
        }, channel, history, breadth, breadthSource, vocalTone, choices);
      }
    }
  }

  // TASK v4.9 (TASK A, §1-5) — resolved only when this channel's own archetype
  // is covered by a ChannelSoundFloor (senior-morning/showa-cafe/oldpop-lounge/
  // showa-70s — see data/channelSoundFloor.ts) and the user hasn't already
  // picked explicit GenreFamily checkboxes (familyIds.length), which already
  // pick a coherent cluster by explicit choice — this constraint layers on
  // top of the free-text/keyword path only.
  // v5.7 (TASK C) — was a mere floor-presence check; now gated on
  // `usesPaletteFamily` specifically (see that field's own doc comment in
  // channelSoundFloor.ts). A floor's presence no longer implies its
  // workspace participates in the palette-family system — kr-2030/jp-2030/
  // kr-idol-* now have their own real floors (requiredAtoms/forbiddenAtoms)
  // but zero data/paletteFamilies.ts membership, and the old presence-only
  // check would have run every one of their genres through
  // capCompatibleFamilySongs as "compatible" (none are ever "main"),
  // silently discarding most of a pack down to a 5-song cap with nowhere
  // for the removed songs to go back to.
  const mainFamilyId = !familyIds.length && channelSoundFloorForArchetype(channel.archetype)?.usesPaletteFamily
    ? resolveMainFamilyId(freeText, history, paletteFamilyOverride)
    : undefined;
  // v5.7 (TASK v5.7, TASK C §3-3) — see constraints.ts's extractMoodConstraint;
  // threaded into both resolveMainFamilyId above (via its own internal
  // moodFamilyHint call) and chooseGenreIds below (scoreGenre's mood boost),
  // so a mood adjective with no artist/genre keyword match still reaches
  // genre selection instead of being silently dropped.
  const moodConstraint = extractMoodConstraint(freeText);
  const eraFocus = deriveEraFocus(freeText, artistReferences);
  const { selectedIds: keywordSelectedIds, ranked } = chooseGenreIds(freeText, channel, safeSongCount, artistReferences, eraFocus, history, breadth, mainFamilyId, moodConstraint);
  const { selectedIds: familySelectedIds, families } = chooseGenreIdsFromFamilies(familyIds, channel);
  // 지시문 24 (TASK A) — "사용자 명시 선택 > 계열 선택 > 키워드 추론 >
  // 채널 기본값"(§A-1)의 1순위가 이전에는 아예 없었다: choices.genreIds는
  // userChoicesFromOptions가 정상적으로 채우는데(입력 있음) 이 함수는 그걸
  // 한 번도 읽지 않았다(소비 없음) — checkUserChoicesPreservation 가드가
  // 실측으로 잡아낸 결함(§2). 가드를 고치지 않고 가드가 요구하는 실제
  // 동작(사용자가 고른 장르가 실제로 쓰인다)을 만든다.
  const userSelectedIdsRaw = choices.source.genreIds === 'user' ? (choices.genreIds ?? []) : [];
  const userSelectedIds = sanitizeGenreIdsForArchetype(userSelectedIdsRaw, channel.archetype || 'senior-morning').valid;
  // TASK A-3 — 사용자가 목표 수(4종, 기존 "장르 후보가 4종 미만입니다"
  // 경고와 같은 기준)보다 적게 고르면 키워드 추론 결과로 부족분만 채운다.
  // 사용자가 고른 것은 배열 앞쪽에 둬 시대 쿼터/계열 상한이 먼저 잘라내는
  // 대상이 되지 않게 한다(§A-3 "사용자 선택을 순서상 앞에 둔다").
  const GENRE_TARGET_MIN = 4;
  const autoCompletedGenreIds = userSelectedIds.length && userSelectedIds.length < GENRE_TARGET_MIN
    ? keywordSelectedIds.filter(id => !userSelectedIds.includes(id)).slice(0, GENRE_TARGET_MIN - userSelectedIds.length)
    : [];
  const baseSelectedIds = userSelectedIds.length
    ? [...userSelectedIds, ...autoCompletedGenreIds]
    : familySelectedIds.length ? familySelectedIds : keywordSelectedIds;
  // v3.63 재작성 (TASK B, 1-4) — listening-context is detected above
  // regardless of which genre-selection path ran; apply it as a light
  // post-filter here too (family/keyword path), not just inside
  // buildSetPlanFromIntent, so "커피숍에서"/"잔잔한" actually narrows the
  // genre pool instead of only being echoed back in the interpretation.
  const preQuotaSelectedIds = applyListeningContextFilter(baseSelectedIds, listeningContext);
  // v4.2 (TASK A3, TASK B) — same era-quota enforcement as
  // buildSetPlanFromIntent (this path is directSetLocal's own plain-keyword/
  // family-picker branch, which never calls that function). Genres here have
  // no per-id count yet (preQuotaSelectedIds is a flat list, not counts), so
  // this seeds an even split first — makeAllocations/allocateGenreCounts
  // would otherwise redo that same even split with no era awareness at all.
  // 정합성 점검 §1 결함1 fix — same reasoning as buildSetPlanFromIntent's
  // identical perSegmentCounts seed just above: this cap must track
  // BREADTH_THRESHOLDS[breadth].genre.maxPerGenre, not a hardcoded 5, or a
  // genre can already sit at 5 songs before applyEraQuota (below) ever runs.
  const preQuotaCounts = genreCountsFromIds(preQuotaSelectedIds, safeSongCount, BREADTH_THRESHOLDS[breadth].genre.maxPerGenre);
  // TASK v4.9 (TASK A) bugfix — real regression: applyEraQuota's own
  // "reach this era's minimum share" fill searches every channel-matching
  // genre, not just the family-filtered pool chooseGenreIds already
  // narrowed to — for family-soul specifically (compatibleWith: [], meant
  // to never mix) an explicit-era concept ("70년대") let it reach outside
  // the pool for an acoustic-soft genre to hit its 1970s quota. AND'd onto
  // the existing genreMatchesChannel predicate so an explicit era request
  // still can't cross a family boundary this task's own family pool
  // already decided.
  const eraQuotaGenrePredicate = mainFamilyId
    ? (genre: GenrePack) => genreMatchesChannel(genre, channel) && genreIdsForFamilyAndCompatible(mainFamilyId).has(genre.id)
    : (genre: GenrePack) => genreMatchesChannel(genre, channel);
  // v5.7 follow-up (TASK C §3-4) — `ranked` is scoreGenre's own output for
  // this exact concept (already mood-boosted, see moodConstraint threaded
  // into chooseGenreIds above), reused here as applyEraQuota's genreOrder so
  // a quota bucket that needs new genres beyond what chooseGenreIds already
  // picked opens the best mood/score match available in that bucket first,
  // not just whichever genre data/genreLibrary happens to declare first.
  // 정합성 점검 §1 결함1 fix — applyEraQuota's own per-genre cap now matches
  // THIS concept's actual resolved breadth (BREADTH_THRESHOLDS[breadth].
  // genre.maxPerGenre) instead of always using the module-wide constant
  // (5) — see applyEraQuota's own doc comment on its new perGenreCap
  // parameter for the real bug this closes (a 'variety'-breadth era-quota
  // fill opening genres capped at 5 each, one over variety's own 4-cap,
  // tripping designGate.ts's 'genre-max' check on an otherwise
  // satisfiable concept).
  const { counts: quotaAdjustedCounts, warnings: eraQuotaWarnings } = applyEraQuota(
    preQuotaCounts,
    safeSongCount,
    tightenEraConstraintForSenior(eraConstraint, channel.archetype, safeSongCount),
    eraQuotaGenrePredicate,
    ranked.map(item => item.genre.id),
    BREADTH_THRESHOLDS[breadth].genre.maxPerGenre
  );
  // 지시문 24 (TASK A-4) — applyEraQuota는 시대 불일치 장르를 통째로
  // 제외할 수 있다(forbidden bucket 삭제·adjacent cap trim·
  // primary/adjacent/generic 어디에도 안 걸리면 삭제). 사용자가 명시
  // 선택한 장르가 여기서 조용히 0곡이 되면 안 된다 — "제외하지 말고
  // advisory로 알린다"(§A-4). 다른(비-사용자) 장르에서 1곡씩 빌려와
  // 최소 1곡은 지키고, 그 사실을 reasoningKo로만 알린다(차단 없음).
  const eraExcludedUserIds = userSelectedIds.filter(id => !(quotaAdjustedCounts[id] > 0));
  const eraRestoredCounts = { ...quotaAdjustedCounts };
  if (!eraConstraint.unspecified && eraExcludedUserIds.length) {
    for (const id of eraExcludedUserIds) {
      const donorEntry = Object.entries(eraRestoredCounts)
        .filter(([donorId, count]) => !userSelectedIds.includes(donorId) && count > 1)
        .sort(([, a], [, b]) => b - a)[0];
      if (donorEntry) eraRestoredCounts[donorEntry[0]] -= 1;
      eraRestoredCounts[id] = (eraRestoredCounts[id] ?? 0) + 1;
    }
  }
  const selectedIds = eraConstraint.unspecified ? preQuotaSelectedIds : Object.keys(eraRestoredCounts);
  // 지시문 24 TASK A — era-unspecified path never built eraRestoredCounts,
  // so makeAllocations' own allocateGenreCounts call was the only place
  // still computing final genre counts for it — and its internal
  // enforceMinimumGenreCount could (and did, per live reproduction) merge
  // away a user-selected genre that landed at exactly 1 song. Passing
  // userSelectedIds as protectedIds closes that gap for both branches
  // (era-specified already restores drops via eraRestoredCounts above, but
  // protecting here too costs nothing and guards against a future allocator
  // change reintroducing the same class of drop).
  const allocations = makeAllocations(freeText, channel, safeSongCount, selectedIds, vocalTone, choices, userSelectedIds);
  // 지시문 24 (TASK A-2/A-3/A-4) — 사용자 장르 선택에 관한 설명을
  // reasoningKo(중립 정보, Step2Plan.tsx가 .supporting으로 렌더)로 남긴다.
  // warnings(.error 렌더, 실제 문제 전용)와 섞지 않는다 — 이건 정상 동작
  // 설명이지 오류가 아니다.
  const userGenreReasoningKo: string[] = [];
  if (userSelectedIds.length) {
    const labels = userSelectedIds.map(id => getGenreById(id)?.label ?? id).join(', ');
    userGenreReasoningKo.push(`선택하신 장르 ${userSelectedIds.length}종(${labels})을 그대로 설계에 반영했습니다.`);
  }
  if (autoCompletedGenreIds.length) {
    const labels = autoCompletedGenreIds.map(id => getGenreById(id)?.label ?? id).join(', ');
    userGenreReasoningKo.push(`선택하신 장르가 ${userSelectedIds.length}종이라 관련 장르 ${autoCompletedGenreIds.length}종을 자동으로 보완했습니다: ${labels}.`);
  }
  // eraExcludedUserIds is derived from quotaAdjustedCounts, which only
  // decides the final genre axis when !eraConstraint.unspecified (see the
  // eraRestoredCounts override just below). When era IS unspecified,
  // quotaAdjustedCounts is never consulted for the final result — selectedIds
  // falls back to preQuotaSelectedIds and makeAllocations/capCompatibleFamilySongs
  // decide instead, both now protecting userSelectedIds directly — so this
  // "시대 비중과 안 맞아 빠졌다" message would be actively wrong here (the
  // genre didn't get excluded for an era reason, and may not be excluded at
  // all).
  if (!eraConstraint.unspecified && eraExcludedUserIds.length) {
    const labels = eraExcludedUserIds.map(id => getGenreById(id)?.label ?? id).join(', ');
    userGenreReasoningKo.push(`선택하신 ${labels}은(는) 이 컨셉의 시대 비중 기준과 맞지 않습니다(era-neutral이거나 다른 시대). 선택을 그대로 유지했지만, 시대색 장르를 추가하거나 컨셉을 조정하면 시대 비중이 더 잘 맞습니다.`);
  }
  if (!eraConstraint.unspecified) {
    const genreAxisIndex = allocations.findIndex(item => item.axis === 'genre');
    if (genreAxisIndex >= 0) allocations[genreAxisIndex] = { axis: 'genre', mode: 'manual', counts: eraRestoredCounts };
  }
  // TASK v4.9 (TASK A, §1-3) — "인접 그룹 최대 5곡" enforcement, applied to
  // whichever genre-axis counts ended up selected above (era-quota override
  // or makeAllocations' own allocateGenreCounts) — see capCompatibleFamilySongs'
  // own doc comment. Skipped when the concept explicitly names its own era
  // mix (eraConstraint.unspecified === false, e.g. "60년대70년대 감성" naming
  // both 1950s-60s AND 1970s) — v3.79's own applyEraQuota already guarantees
  // each named era >=30% share, which can legitimately require more than 5
  // compatible-family songs; an explicit era request is a more specific,
  // later user signal than the family-cohesion default this task adds, so
  // it wins rather than fighting it (real regression: tests/v379EraParsing.test.ts's
  // "60년대70년대" concept dropped to 27.8% 1950s-60s once capped at 5).
  //
  // v5.7 (TASK v5.7, TASK C) — investigated widening this gate to also cap
  // a single-primary explicit-era concept with a mood hint (e.g. "60년대
  // 감미로운 올드팝", which this task's own moodFamilyHint fix correctly
  // resolves to family-orchestral, but whose compatible-family bright-pop
  // genres still outnumbered it 14-to-4 in a real measured run — see
  // scripts/v57Measure.ts). Reverted: real measurement (`npm run audit`)
  // showed the same widening regressed the audit's own flagship "비틀즈
  // 느낌의 밝은 60년대 팝" baseline (prompt length 722-942 vs the 350-650
  // expected range, descriptor count 29-35 vs 15-25) — that concept ALSO has
  // a single-primary explicit era plus a mood word ("밝은"), so it hit the
  // same newly-capped path. Per this task's own explicit "시니어 워크스페이스
  // 성과를 되돌리지 말 것", kept at the original, narrower
  // `eraConstraint.unspecified` gate. Net effect on TASK C: the mood axis
  // still reaches genre selection (mainFamilyId correctly resolves to
  // family-orchestral, and its genres score higher and do enter the mix via
  // scoreGenre's mood boost + era-quota's existing adjacency allowance) —
  // only the family-cap ENFORCEMENT for a single-primary explicit era is
  // left unchanged, so a bright-pop-vs-orchestral count imbalance can still
  // remain. See this task's own report for the measured before/after.
  if (mainFamilyId && eraConstraint.unspecified) {
    const genreAxisIndex = allocations.findIndex(item => item.axis === 'genre');
    if (genreAxisIndex >= 0) {
      allocations[genreAxisIndex] = {
        axis: 'genre',
        mode: 'manual',
        counts: capCompatibleFamilySongs(allocations[genreAxisIndex].counts, mainFamilyId, 5, userSelectedIds)
      };
    }
  }
  // v3.77 (TASK A) — overrides buildBaseOptions' own channel.defaultVocal
  // fallback so this plan's own preview slots (below) agree with the
  // leaning-aware manual vocalType allocation just built above, instead of
  // resolving vocalType leaning while still previewing with the untouched
  // channel default.
  const opts = { ...buildBaseOptions(freeText, channel, safeSongCount, selectedIds, allocations, choices), ...(vocalTone?.trim() ? { vocalTone: vocalTone.trim() } : {}), ratingInsights: history.insights };
  const selectedIdSet = new Set(selectedIds);
  const genres = genreLibrary.filter(genre => selectedIdSet.has(genre.id));
  const slots = preallocateSongSlots(opts, genres, { usedTitles: [], usedHooks: history.recentHooks });
  const densityAllocation = allocations.find(allocation => allocation.axis === 'arrangementDensity');
  const densityMax = densityAllocation ? Math.max(...Object.values(densityAllocation.counts)) : 0;
  const warnings = [
    ...(selectedIds.length < 4 ? ['장르 후보가 4종 미만입니다. 채널 필터 또는 입력 키워드를 확인하십시오.'] : []),
    ...(densityMax > 5 ? ['arrangementDensity는 내부 값이 3종뿐이라 슬롯 값 기준으로는 5곡 초과가 발생합니다. 브릿지 다양성 그룹에서 5곡 이하 하위 그룹으로 분할합니다.'] : []),
    ...(eraConstraint.unspecified ? [] : eraQuotaWarnings)
  ];
  // v5.7 follow-up (production wiring) — see checkUserChoicesPreservation's
  // own doc comment. Throws in dev/tooling contexts; in production appends
  // any violation strings here, so they surface exactly like this array's
  // other entries (Step2Plan.tsx's plan.warnings.map -> `.error` paragraph).
  warnings.push(...checkUserChoicesPreservation(choices, slots, allocations, 'directSetLocal'));
  // TASK v3.68 (TASK E) — mirrors buildSetPlanFromIntent's own banner-text
  // computation exactly (same filter, same per-slot recount).
  const appliedInsightsKo = (history.insights ?? [])
    .filter(insight => insight.attribute === 'killingPointId' && insight.confidence === 'strong')
    .map(insight => {
      const count = slots.filter(slot => slot.killingPointId === insight.value).length;
      const labelKo = killingPointById(insight.value)?.labelKo ?? insight.value;
      return insight.lift >= 0
        ? `${labelKo} 킬링포인트가 반응이 좋아 ${count}곡에 배정했습니다.`
        : `${labelKo} 킬링포인트는 반응이 약해 ${count}곡으로 줄였습니다.`;
    });
  // v5.7 (TASK v5.7, TASK C §3-5) — genreAxisApplied is always true here:
  // this is the plain keyword/family path, where a genre-name mention in
  // freeText (or an explicit family checkbox) IS what chooseGenreIds/
  // chooseGenreIdsFromFamilies just used above.
  const axisCoverage = computeAxisCoverage({
    freeText,
    eraDetected: !eraConstraint.unspecified,
    mood: moodConstraint,
    moodApplied: true,
    referenceCount: artistReferences.length,
    listeningContext,
    genreAxisApplied: true
  });
  return {
    interpretation: {
      intentKo: intentSummaryKo(freeText, eraFocus, selectedIds, families),
      eraFocus,
      familyIds: families.map(family => family.id),
      artistReferences,
      audienceProfileId: channel.archetype || channel.audience,
      reasoningKo: [
        `장르 후보는 core/extended 구분 없이 ${totalGenreCount}종 전체에서 보되, ${channel.archetype || 'senior-morning'} 채널에 맞는 후보로 1차 필터했습니다.`,
        families.length
          ? `선택한 패밀리 ${families.map(family => family.labelKo).join(', ')}에서 ${selectedIds.length}개 장르를 골랐고 같은 장르는 최대 5곡 이하가 되도록 배분했습니다.`
          : `${selectedIds.length}개 장르를 골랐고 같은 장르는 최대 5곡 이하가 되도록 배분했습니다.`,
        '보컬은 남성/여성/듀엣 축을 균등 배분하고, 구조 템플릿은 5종을 순환시켰습니다.',
        '인트로/훅 장치/밀도는 문구가 아니라 그룹 제약으로 브릿지에 전달합니다.',
        breadthSource === 'user'
          ? `이 세트의 성격을 "${BREADTH_LABEL_KO[breadth]}"으로 직접 선택하셨습니다.`
          : `이 세트의 성격을 "${BREADTH_LABEL_KO[breadth]}"으로 자동 판정했습니다 — 필요하면 아래에서 바꾸실 수 있습니다.`,
        moodConstraint
          ? `분위기 "${moodConstraint.sourceText}"을(를) 감지해 장르 선택/스코어링에 반영했습니다(${moodConstraint.descriptors.join(', ')}).`
          : '컨셉에서 별도의 분위기 형용사는 감지되지 않았습니다.',
        ...userGenreReasoningKo
      ],
      unknownTermsKo,
      listeningContext,
      breadth,
      breadthSource,
      mood: moodConstraint,
      axisCoverage
    },
    segments: [{
      label: families.length ? families.map(family => family.labelKo).join(' + ') : '전체',
      songCount: safeSongCount,
      genreIds: selectedIds,
      eraTag: eraFocus[0] || 'mixed',
      descriptors: []
    }],
    allocations,
    slots,
    adjustables: makeAdjustables(allocations, ranked),
    warnings,
    appliedInsightsKo
  };
}

// ============================================================
// v3.63 재작성 (TASK B) — directSet, the "본 경로": an LLM does 1단계
// (freeText -> InterpretedIntent), buildSetPlanFromIntent (already used by
// directSetLocal's new segment/blend branches above) does 2단계. Reuses the
// exact same remote-call pattern already proven by conceptAgent.ts's
// recommendConceptViaApi (callGenerateProxy against the existing
// /api/generate proxy, cacheableSystemBlocks for the stable prompt,
// data.blueprint for the parsed response) — no new serverless endpoint.
// ============================================================

function directSetSystemPrompt(): string {
  return [
    '너는 음악 플레이리스트 자연어 요청을 "음악 특성 프로파일"로 해석하는 도우미다.',
    '장르 이름이나 장르 ID를 절대 고르지 마라 — 악기/리듬/화성/보컬/프로덕션/시대만 서술하라. 앱이 그 서술을 자체 데이터베이스와 매칭한다.',
    '',
    '절대 규칙:',
    '- 아티스트/밴드/가수 이름을 출력의 어떤 필드에도 절대 넣지 마라. 이름이 언급되면 그 이름이 만드는 "소리"만 음악 서술어로 변환하라 (예: "사이먼과 가펑클" -> instrumentation:["12-string acoustic guitar","upright bass"], vocalTraits:["two-part male close harmony"], rhythmFeel:["gentle walking tempo"], harmonyTraits:["modal folk harmony"] — "Simon", "Garfunkel", 원어/한글 표기 어떤 것도 출력에 포함하지 마라).',
    '- 곡 수 표현("9곡씩", "각각 10곡", "반반")을 파싱해 각 세그먼트 songCount에 반영하라. 표현이 없으면 균등 분배하라. 세그먼트가 1개면 songCount는 전체 곡 수와 같다.',
    '- "OO 느낌이 나는 XX" 같은 장르 합성 요청이면 segments[0].blendHint에 anchorHintKo(뼈대), flavorHintKo(색), strength를 채워라. profile은 비워둬도 된다 — 앱이 blendHint로 직접 합성한다.',
    '- 앱이 알 수 없는 정보(실시간 날씨, "오늘 기분" 등 구체적 서술이 없는 표현)는 무시하지 말고 unknownTermsKo 배열에 한국어 문장으로 적어라.',
    '- 반드시 JSON만 반환하라. 다른 텍스트를 붙이지 마라. 스키마:',
    '{"intentKo":"","segments":[{"label":"","songCount":0,"profile":{"eraTag":"","instrumentation":[],"rhythmFeel":[],"harmonyTraits":[],"productionTraits":[],"vocalTraits":[],"dynamicRange":"low|medium|wide"},"blendHint":{"anchorHintKo":"","flavorHintKo":"","strength":"light|medium|strong"}}],"listeningContext":{"settingKo":"","dynamicCeiling":"low|medium|wide","tempoHint":[0,0],"extraExclusions":[]},"reasoningKo":[],"unknownTermsKo":[]}'
  ].join('\n');
}

function sanitizeProfile(raw: Record<string, unknown> | undefined): TraitProfile {
  if (!raw || typeof raw !== 'object') return {};
  const arr = (value: unknown): string[] | undefined => Array.isArray(value) ? value.map(String).filter(Boolean) : undefined;
  const dynamicRangeRaw = String((raw as Record<string, unknown>).dynamicRange || '');
  const dynamicRange = (['low', 'medium', 'wide'] as const).includes(dynamicRangeRaw as 'low' | 'medium' | 'wide') ? (dynamicRangeRaw as TraitProfile['dynamicRange']) : undefined;
  const instrumentation = arr(raw.instrumentation);
  const rhythmFeel = arr(raw.rhythmFeel);
  const harmonyTraits = arr(raw.harmonyTraits);
  const productionTraits = arr(raw.productionTraits);
  const vocalTraits = arr(raw.vocalTraits);
  return {
    ...(raw.eraTag ? { eraTag: String(raw.eraTag) } : {}),
    ...(instrumentation ? { instrumentation } : {}),
    ...(rhythmFeel ? { rhythmFeel } : {}),
    ...(harmonyTraits ? { harmonyTraits } : {}),
    ...(productionTraits ? { productionTraits } : {}),
    ...(vocalTraits ? { vocalTraits } : {}),
    ...(dynamicRange ? { dynamicRange } : {})
  };
}

function profileTextFields(profile: TraitProfile): string[] {
  return [
    profile.eraTag,
    ...(profile.instrumentation ?? []),
    ...(profile.rhythmFeel ?? []),
    ...(profile.harmonyTraits ?? []),
    ...(profile.productionTraits ?? []),
    ...(profile.vocalTraits ?? [])
  ].filter((value): value is string => Boolean(value));
}

/**
 * TASK B — turns the model's raw JSON into a trusted InterpretedIntent.
 * Every field is defensively coerced (never trusts the shape blindly), and
 * the whole thing is scanned for a leaked artist/band name before being
 * trusted — an LLM ignoring the "never include a name" instruction is a
 * real failure mode, not a hypothetical one (see v3.58's own artist-leak
 * guard rationale), so this throws (caught by directSet's fallback) rather
 * than silently passing a name through to a style prompt.
 */
function validateInterpretedIntent(raw: unknown, songCount: number): InterpretedIntent {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const segmentsRaw = Array.isArray(obj.segments) ? obj.segments : [];
  if (!segmentsRaw.length) throw new Error('directSet: response had no segments');

  const segments: IntentSegment[] = segmentsRaw
    .map((rawSegment): IntentSegment | undefined => {
      const segment = (rawSegment ?? {}) as Record<string, unknown>;
      const label = String(segment.label || '').trim();
      if (!label) return undefined;
      const profile = sanitizeProfile(segment.profile as Record<string, unknown> | undefined);
      const blendHintRaw = segment.blendHint as Record<string, unknown> | undefined;
      const blendHint = blendHintRaw && (blendHintRaw.anchorHintKo || blendHintRaw.flavorHintKo)
        ? {
          anchorHintKo: String(blendHintRaw.anchorHintKo || ''),
          flavorHintKo: String(blendHintRaw.flavorHintKo || ''),
          strength: ((['light', 'medium', 'strong'] as const).includes(blendHintRaw.strength as 'light' | 'medium' | 'strong') ? blendHintRaw.strength : 'medium') as 'light' | 'medium' | 'strong'
        }
        : undefined;
      if (!Object.keys(profile).length && !blendHint) return undefined;
      const songCountRaw = Math.round(Number(segment.songCount));
      return { label, songCount: Number.isFinite(songCountRaw) && songCountRaw > 0 ? songCountRaw : 0, profile, blendHint };
    })
    .filter((segment): segment is IntentSegment => Boolean(segment));
  if (!segments.length) throw new Error('directSet: no usable segments after validation');

  // Normalize songCounts to sum exactly to songCount (LLM arithmetic isn't trusted).
  const totalRequested = segments.reduce((sum, segment) => sum + segment.songCount, 0);
  if (totalRequested <= 0) {
    const even = evenSplit(segments.length, songCount);
    segments.forEach((segment, idx) => { segment.songCount = even[idx]; });
  } else if (totalRequested !== songCount) {
    const scale = songCount / totalRequested;
    let running = 0;
    segments.forEach((segment, idx) => {
      const isLast = idx === segments.length - 1;
      segment.songCount = isLast ? Math.max(1, songCount - running) : Math.max(1, Math.round(segment.songCount * scale));
      running += segment.songCount;
    });
  }

  const listeningContextRaw = (obj.listeningContext ?? {}) as Record<string, unknown>;
  const dynamicCeilingRaw = String(listeningContextRaw.dynamicCeiling || 'wide');
  const tempoHintRaw = listeningContextRaw.tempoHint;
  const listeningContext: ListeningContext = {
    settingKo: String(listeningContextRaw.settingKo || NO_LISTENING_CONTEXT_KO),
    dynamicCeiling: ((['low', 'medium', 'wide'] as const).includes(dynamicCeilingRaw as 'low' | 'medium' | 'wide') ? dynamicCeilingRaw : 'wide') as ListeningContext['dynamicCeiling'],
    tempoHint: Array.isArray(tempoHintRaw) && tempoHintRaw.length === 2 && tempoHintRaw.every(value => Number.isFinite(Number(value)))
      ? [Number(tempoHintRaw[0]), Number(tempoHintRaw[1])]
      : undefined,
    extraExclusions: Array.isArray(listeningContextRaw.extraExclusions) ? listeningContextRaw.extraExclusions.map(String) : []
  };

  const intentKo = String(obj.intentKo || '해석된 세트 계획');
  const reasoningKo = Array.isArray(obj.reasoningKo) && obj.reasoningKo.length ? obj.reasoningKo.map(String) : ['LLM이 자유 입력을 음악 특성으로 해석했습니다.'];
  const unknownTermsKo = Array.isArray(obj.unknownTermsKo) ? obj.unknownTermsKo.map(String) : [];

  const allText = [
    intentKo,
    ...reasoningKo,
    ...unknownTermsKo,
    listeningContext.settingKo,
    ...segments.flatMap(segment => [segment.label, ...profileTextFields(segment.profile), segment.blendHint?.anchorHintKo, segment.blendHint?.flavorHintKo].filter((value): value is string => Boolean(value)))
  ].join(' ');
  if (findArtistReferenceLeaks(allText).length) {
    throw new Error('directSet: response leaked an artist/band reference — discarding');
  }

  return { intentKo, segments, listeningContext, reasoningKo, unknownTermsKo };
}

async function interpretFreeTextRemote(freeText: string, songCount: number, settings: ProviderSettings): Promise<InterpretedIntent> {
  const model = MODEL_REGISTRY.anthropic.find(entry => entry.tier === 'fast')?.id || defaultModelFor('anthropic');
  const data = await callGenerateProxy(settings.proxyEndpoint || '/api/generate', buildProxyHeaders(settings), {
    provider: 'anthropic',
    model,
    temperature: 0.5,
    batchSize: 1,
    cacheableSystemBlocks: [directSetSystemPrompt()],
    user: { freeText, songCount }
  });
  const raw = (data.blueprint ?? data) as Record<string, unknown>;
  return validateInterpretedIntent(raw, songCount);
}

/**
 * TASK B (본 경로) — 자유 입력을 실제 LLM에게 해석시킨다(1단계), 그 결과를
 * buildSetPlanFromIntent(2단계)로 SetPlan을 만든다. 네트워크 오류, 파싱 실패,
 * 검증 실패(아티스트명 누출 포함) 어느 것이든 조용히 directSetLocal로
 * 폴백한다 — "API 실패 시 화면이 비면 안 된다"는 이 작업의 명시적 요구사항.
 */
export async function directSet(
  freeText: string,
  channel: ChannelProfile,
  songCount: number,
  history: { recentGenreIds: string[]; recentHooks: string[]; insights?: RatingInsightLike[] },
  settings: ProviderSettings,
  familyIds: string[] = [],
  /** v4.1 (TASK A) — same override as directSetLocal's own, threaded through both the remote-interpretation success path and the local fallback. */
  breadthOverride?: ConceptBreadth,
  /** v5.7 (TASK v5.7, TASK A) — see core/userChoices.ts. */
  choices: UserExplicitChoices = emptyUserChoices()
): Promise<SetPlan> {
  // v4.1 (TASK A) — computed from the raw freeText (still available here,
  // unlike inside buildSetPlanFromIntent which only sees the already-
  // interpreted InterpretedIntent) so the remote-LLM path reports the same
  // breadth detectConceptBreadth would give the local path for identical input.
  const breadth = breadthOverride ?? detectConceptBreadth(freeText, extractEraConstraint(freeText));
  const breadthSource: 'auto' | 'user' = breadthOverride ? 'user' : 'auto';
  try {
    const intent = await interpretFreeTextRemote(freeText, songCount, settings);
    return buildSetPlanFromIntent(intent, channel, history, breadth, breadthSource, undefined, choices);
  } catch {
    return directSetLocal(freeText, channel, songCount, history, familyIds, undefined, breadthOverride, undefined, choices);
  }
}
