import type { ChannelArchetype, GenerationOptions, GenrePack, LyricLanguage, MoodPack, OpeningStyle, PlaylistBlueprint, SeasonPack, SongIdea, YoutubeMetadata } from '../types';
import { generationPacks } from '../data/presets';
import { hookDevices } from '../data/hookDevices';
import { introTexturesForArchetype } from '../data/introTextures';
import { ARRANGEMENT_DENSITY_TEXT_BY_LEVEL, buildArrangementDensityPlan, arrangementNarrativeForGenres, buildChannelPromptParts, buildExcludePrompt, hookStyleDirectives, rotatingArrangementNarrativeForGenres, rotatingEarwormText, rotatingGenreSignatureText, rotatingGenreText, rotatingInstrumentText } from './promptComposer';
import { composeStylePrompt, countWords, STYLE_PROMPT_OVER_LIMIT_WARNING, STYLE_WORD_TARGET_MAX, SUNO_COPY_LIMIT, type PromptPart } from './promptBudget';
import { resolvePackagingLanguage } from './packagingLanguage';
import { buildLocalizedTitle, buildTitleDisplay, localizedTitleSeed } from './titleLocalization';
import { buildPersonaStylePrompt, buildSoundSignature, coldOpenHasNoInstrumentalIntro, compactMoneyChord, openingDurationText, PERSONA_STYLE_LIMIT } from './soundSignature';
import { buildFamilyProgressionPlan, buildProgressionPlan, usesMoneyChordQuota } from './moneyChordPlan';
import { applyDuetSectionVocalTags, applyFlagshipVocalOrder, buildAdultVocalTraitPlan, buildVocalPlan, buildVocalTechniquePlan, buildVocalVariantPlan, DEFAULT_ADULT_VOCAL_QUOTA, DEFAULT_KIDS_VOCAL_QUOTA, detectVocalGenderPresence, ensureVocalMetaTag, leaningAdultVocalQuota, leaningGenderFor, resolveFlagshipVocalOrder, resolveVocalMetaTag, usesVocalQuota, vocalDescriptionFor, type VocalType } from './vocalPlan';
import { scoreSongs } from './quality';
import { AI_DISCLOSURE_LINE, sanitizePublicYoutubeTags } from './exportCompliance';
import { isKidsArchetype } from '../utils/channelArchetype';
import { matchVocalPreset } from '../data/vocalPresets';
import { eraBucketForGenreId, ERA_FORBIDDEN_DESCRIPTORS } from '../data/eraExclusions';
import { PROXIMITY_POOL } from '../data/vocalTraits';
import { buildHookDevicePlan, hookDeviceIdsForNarrative } from './hookDevicePlan';
import { getHookDeviceById } from '../data/hookDevices';
import { buildIntroTexturePlan, introTextureTagForId } from './introTexturePlan';
import { buildTempoBandPlan, resolveTempoWithBand } from './tempoPlan';
import { applyGenreVocalAffinity } from './vocalGenreAffinity';
import { assignOpeningHooks, assignOpeningLoudnessDescriptors } from '../data/openingHooks';
import { dominantPaletteFamilyId, paletteFamilyForPaletteId } from '../data/paletteFamilies';
import { audienceProfileForAgeGroup, KIDS_AUDIENCE_PROFILE, SENIOR_AUDIENCE_PROFILE, tempoBandsForProfile } from '../data/audienceProfiles';
import { enforceSingleBpmText } from './bpmDedupe';
import { composeKidsLyrics, type KidsLyricTheme } from './kidsLyricEngine';
import { runOpeningContest, type OpeningPackContext, type OpeningRole } from './openingContest';
import {
  ADULT_STRUCTURE_TEMPLATE_IDS,
  applyAxisAllocation,
  ARRANGEMENT_DENSITY_IDS,
  KIDS_STRUCTURE_TEMPLATE_IDS,
  VOCAL_TYPE_IDS
} from './diversityAllocation';
import { buildLyricThemePlan, buildPovPlan, buildSectionStylePlan, kidsEngineThemeForLyricSlot, lyricThemeForSlot } from './lyricDiversityPlan';
import { QUIET_MORNING_BANK_ID, vocabularyBankForScene } from '../data/vocabularyBanks';
import { ARRANGEMENT_VOCABULARY } from '../data/arrangementVocabulary';
import { buildGenreRotationPlan, genresForTrack } from './genreRotation';
import { conceptLyricImages, conceptStyleText, promptPriorityForTrack, resolveConceptInfluence, safeConceptSummaryForDisplay, variedVocalText } from './conceptDiversity';
import {
  composeLyrics,
  createLyricBatchPools,
  createTitleGenerator,
  hashSeed,
  HOOK_SHAPES,
  seedForBlueprint,
  seasonWordFor,
  shuffle,
  targetHookEmotionalWeight,
  titleFromHook,
  UniquePool,
  wantsFinalChorusModulation,
  type HookContext,
  type TitleGenerator,
  type TitleResult
} from './lyricEngine';
import { resolveConstraintsFromOptions, type ResolvedConstraints } from './constraints';
import { findArtistReferenceLeaks } from './artistReferenceDecomposer';
import { normalizeSongOutput } from './songPostProcess';
import { breakLongRuns, buildArcPlan, pinPrefixPreservingCounts, reorderByArcIntensity, type ArcPhase, type SlotArcPosition } from './arcPlan';
import { assignKillingPoints, killingPointBoostFromInsights, type KillingPoint } from '../data/killingPoints';
import { KIDS_KILLING_POINTS } from '../data/killingPointsKids';
import { applyVerifiedComboToGenrePlan, resolveFlagshipCombo } from './verifiedCombos';
import { buildEraCanonPalettePlan, rotatingEraPaletteAtoms } from './eraCanonPalettePlan';
import { buildBpmAwareStructureTemplatePlan, repairStructureTemplatePlanForBpm } from './structureTemplatePlan';
import type { VerifiedCombo } from '../data/verifiedCombos';

/**
 * Suno-facing text (style prompt, YouTube metadata) stays English regardless
 * of lyricLanguage, but the same "situation" also gets interpolated straight
 * into the lyrics themselves — so it needs a real Korean/Japanese phrase for
 * those languages instead of the English string leaking into the lyrics.
 */
export type SeasonFamily = 'spring' | 'summer' | 'autumn' | 'winter';

export interface LocalizedPhrase {
  english: string;
  korean: string;
  japanese: string;
  /** TASK B2 (v3.5) — which season families this image reads as natural in. Omitted = season-neutral (fine any time of year). Only used by thumbnailSpec.ts's object picker; lyric generation still draws from the full pool regardless of season. */
  seasons?: SeasonFamily[];
}

function phraseFor(phrase: LocalizedPhrase, language: GenerationOptions['lyricLanguage']): string {
  if (language === 'korean') return phrase.korean;
  if (language === 'japanese') return phrase.japanese;
  return phrase.english;
}

/**
 * TASK X5-1 (v3.4) — every enSituation/enPreChorus template plugs this value
 * into a noun slot ("In this X", "Caught up in this X", "Framed by this X",
 * ...); most of those prepositions grammatically require a true noun
 * phrase and can't be rescued by an alternate "while X-ing" wrapper (e.g.
 * "Held here by this watching..." doesn't parse regardless of preposition).
 * Four entries were originally gerund phrases ("writing a letter...",
 * "standing near...", "folding...", "watching...") and broke every
 * template they landed in ("Set inside this watching the first lights come
 * on"). All entries are now noun phrases — the same fix shape as
 * likeMotif()'s article handling: check the grammatical type a slot
 * expects before a value gets plugged into it, and keep the pool
 * type-consistent so it can't recur when new entries are added. Korean/
 * Japanese translations were already independently nominalized and needed
 * no change.
 */
const listenerSituations: LocalizedPhrase[] = [
  { english: 'morning coffee before the day begins', korean: '하루를 여는 아침 커피', japanese: '一日を開く朝のコーヒー' },
  { english: 'quiet walk under seasonal trees', korean: '계절 나무 아래의 조용한 산책', japanese: '季節の木々の下の静かな散歩' },
  { english: 'late cafe seat beside the window', korean: '창가 옆 늦은 카페 자리', japanese: '窓辺の遅い喫茶店の席' },
  { english: 'small kitchen with the radio on', korean: '라디오가 흐르는 작은 부엌', japanese: 'ラジオが流れる小さな台所' },
  { english: 'evening drive through familiar streets', korean: '익숙한 거리를 지나는 저녁 드라이브', japanese: '見慣れた通りを走る夕方のドライブ' },
  { english: 'a letter written after dinner', korean: '저녁 식사 후 편지 쓰는 시간', japanese: '夕食後に手紙を書く時間' },
  { english: 'a warm shop window at dusk', korean: '따뜻한 가게 창가', japanese: '暖かい店の窓辺' },
  { english: 'slow train ride home', korean: '느린 기차를 타고 가는 귀갓길', japanese: 'ゆっくりな列車で帰る道' },
  { english: 'an old sweater folded in a quiet room', korean: '조용한 방에서 개는 오래된 스웨터', japanese: '静かな部屋で畳む古いセーター' },
  { english: 'first light of evening', korean: '하나둘 켜지는 불빛', japanese: 'ひとつずつ灯る明かり' }
];

/** Exported for batchPreallocation.ts (TASK B2, v3.6) — pre-allocating songRole/emotionArc/tempo locally, before a batch job is submitted, needs the exact same pools the local generator itself draws from. */
export const emotionArcs = [
  'lonely memory to warm acceptance',
  'soft nostalgia to renewed hope',
  'quiet longing to calm gratitude',
  'bittersweet reflection to gentle lift',
  'small sadness to steady comfort',
  'old regret to peaceful closure'
];

/**
 * TASK v3.67 (TASK D) — every one of the 6 shapes above is the same curve
 * (dark opening -> bright low-intensity ending): fine for one song, flat
 * across an 18-song set with no other song starting bright, hitting a
 * strong lift, staying calm throughout, or landing anywhere other than
 * "gentle". These 4 new shapes exist to be picked by arc PHASE (see
 * emotionArcPoolForPhase below), never mixed in unconditionally — the
 * original 6 stay the only shapes a caller gets if it never asks for a
 * phase.
 */
export const emotionArcsBrightOpening = [
  'joyful memory blooming into bigger joy',
  'warm reunion feeling lifting into brighter delight'
];
export const emotionArcsStrongLift = [
  'quiet longing swelling into overwhelming feeling',
  'held-back yearning bursting into radiant relief'
];
export const emotionArcsCalmThroughout = [
  'steady peace held gently, start to end',
  'quiet contentment resting undisturbed throughout'
];
/**
 * The one shape that doesn't end fully bright (a lingering, wistful close
 * rather than a sad one) — deliberately used at most once per pack (see
 * emotionArcPlanForArc's own cap), per this task's "슬프게 끝나는 곡은
 * 1~2곡으로 제한" instruction.
 */
export const emotionArcsBrightToWistful = [
  'joyful moment fading into tender wistfulness',
  'bright laughter softening into a quiet farewell'
];

/**
 * TASK v3.67 (TASK D) — which pool(s) an arc phase draws its emotionArc from, per this task's own phase table (5-3).
 *
 * v4.16 (TASK D, §4-2/§4-3) — 'rising' no longer draws emotionArcsBrightOpening.
 * Real listening found "상승·밝음" reading as 5 songs against a 3-4 target —
 * ARC_PHASES' own 'rising' phase (5 tracks, arcPlan.ts) was the source: it
 * mixed in the genuinely bright/joyful shapes on top of the neutral
 * dark-to-light baseline. Only 'peak' (3 tracks, arc position 9-11 for an
 * 18-song set) still draws bright shapes now — matching this task's own
 * "밝은 곡 3~4곡... peak 구간에 배치" exactly, with the freed 'rising' share
 * moved to emotionArcsCalmThroughout instead (§4-3's own "나머지를 차분
 * 쪽으로 옮기십시오"). ARC_PHASES' own shareOf18 numbers are untouched — this
 * only changes which POOL a phase draws from, not the phase structure
 * itself (this task's own "구조 변경은 없습니다").
 */
export function emotionArcPoolForPhase(phase: ArcPhase): string[] {
  switch (phase) {
    case 'opening':
      return [...emotionArcsCalmThroughout, ...emotionArcs];
    case 'rising':
      return [...emotionArcs, ...emotionArcsCalmThroughout];
    case 'peak':
      return [...emotionArcsStrongLift, ...emotionArcsBrightOpening];
    case 'easing':
      return [...emotionArcsBrightToWistful, ...emotionArcs];
    case 'closing':
    default:
      return [...emotionArcsCalmThroughout, ...emotionArcs];
  }
}

/**
 * TASK v3.67 (TASK D) — one emotionArc per track, phase-aware (replacing a
 * flat UniquePool(emotionArcs, seed) draw with the same seeded-shuffle
 * discipline per phase, see lyricEngine.ts's shuffle), with
 * emotionArcsBrightToWistful capped at exactly one track pack-wide — the
 * last 'easing' track (the natural hinge into 'closing'), so the pack still
 * settles down without more than one song reading as a sad ending.
 */
export function emotionArcPlanForArc(arc: SlotArcPosition[], seed: number): string[] {
  const lastEasingIdx = arc.reduce((found, pos, idx) => (pos.phase === 'easing' ? idx : found), -1);
  const pools = new Map<ArcPhase, UniquePool<string>>();
  return arc.map((pos, idx) => {
    if (idx === lastEasingIdx) return emotionArcsBrightToWistful[Math.abs(seed) % emotionArcsBrightToWistful.length];
    if (!pools.has(pos.phase)) pools.set(pos.phase, new UniquePool(emotionArcPoolForPhase(pos.phase), seed + pos.phase.length * 733));
    return pools.get(pos.phase)!.take();
  });
}

export const recurringMotifs: LocalizedPhrase[] = [
  { english: 'coffee steam', korean: '커피 김', japanese: 'コーヒーの湯気' },
  { english: 'old radio light', korean: '오래된 라디오 불빛', japanese: '古いラジオの灯り' },
  { english: 'window rain', korean: '창가의 빗물', japanese: '窓辺の雨音', seasons: ['summer', 'autumn'] },
  { english: 'folded letter', korean: '접힌 편지', japanese: '畳んだ手紙' },
  { english: 'street lamp', korean: '가로등', japanese: '街灯' },
  { english: 'wool sweater', korean: '털 스웨터', japanese: 'ウールのセーター', seasons: ['autumn', 'winter'] },
  { english: 'paper calendar', korean: '종이 달력', japanese: '紙のカレンダー' },
  { english: 'warm cafe window', korean: '카페의 창', japanese: 'カフェの窓' },
  { english: 'candle flame', korean: '촛불의 빛', japanese: 'キャンドルの炎', seasons: ['autumn', 'winter'] },
  { english: 'faded photograph', korean: '빛바랜 사진', japanese: '色あせた写真' },
  { english: 'train ticket', korean: '기차표', japanese: '電車の切符' },
  { english: 'quiet doorway', korean: '조용한 문', japanese: '静かな戸口' },
  { english: 'porcelain cup', korean: '도자기 잔', japanese: '陶器のカップ' },
  { english: 'evening train', korean: '저녁 기차', japanese: '夕方の電車' },
  { english: 'small notebook', korean: '작은 수첩', japanese: '小さなノート' }
];

export const songRoles = [
  'clear opener',
  'gentle early lift',
  'first nostalgic turn',
  'brighter sing-along track',
  'quiet middle scene',
  'romantic shade without melodrama',
  'seasonal detail track',
  'late-set emotional center',
  'warm radio-friendly highlight',
  'soft reset before the closing run',
  'memory-focused late track',
  'comforting closer'
];

/**
 * TASK I1 (v3.11) — track 1 is always 'cold-open' and tracks 2-3 are always
 * 'flagship', replacing whatever songRoles[idx] would otherwise have said
 * ('clear opener' / 'gentle early lift' / 'first nostalgic turn'). The
 * songRoles array itself is untouched — every other position still reads
 * from it exactly as before — so the existing emotional-curve design for
 * tracks 4+ is unaffected.
 *
 * v4.4 (TASK D) — kept for backward compatibility (still used by the
 * legacy-pack fallback below), but no longer called by either real
 * generation pre-pass (this file's own songRoles pre-pass, or
 * batchPreallocation.ts's mirror of it) — `Math.min(idx, songRoles.length-1)`
 * has no wraparound, so any pack past 12 songs clamped every remaining
 * track to the last entry ('comforting closer') — a real 18-song pack
 * measured 7 tracks (12-18) with that exact identical role. See
 * songRolePlanForArc below for the phase-aware replacement.
 */
export function resolveSongRole(trackNo: number, idx: number): string {
  if (trackNo === 1) return 'cold-open';
  if (trackNo === 2 || trackNo === 3) return 'flagship';
  return songRoles[Math.min(idx, songRoles.length - 1)];
}

/**
 * v4.4 (TASK D) — song-role pools by arc phase, same architecture as
 * emotionArcPoolForPhase/emotionArcPlanForArc above (buildArcPlan's own
 * ArcPhase, never tied to a flat array's length) so a role no longer
 * freezes on the last entry once idx exceeds a fixed count — it rotates
 * within its phase's own pool instead, which scales to any songCount.
 * Redistributes the original 12 songRoles entries (opening's 3 were
 * already dead content in every real pack — trackNo 1-3 always override
 * them — now genuinely reachable only if 'opening' phase spans past idx 2
 * at a larger songCount) and adds a handful more per phase so no phase's
 * pool is thin enough to repeat within a single pack at realistic sizes.
 */
export function songRolePoolForPhase(phase: ArcPhase): string[] {
  switch (phase) {
    case 'opening':
      return ['clear opener', 'gentle early lift', 'first nostalgic turn'];
    case 'rising':
      return ['brighter sing-along track', 'seasonal detail track', 'warm radio-friendly highlight', 'steady heartfelt build', 'easy singalong verse'];
    case 'peak':
      return ['late-set emotional center', 'romantic shade without melodrama', 'big emotional high point', 'passionate turning point'];
    case 'easing':
      return ['quiet middle scene', 'soft reset before the closing run', 'memory-focused late track', 'gentle wind-down moment', 'tender reflective pause'];
    case 'closing':
    default:
      return ['comforting closer', 'warm goodnight track', 'final quiet reflection', 'peaceful farewell moment'];
  }
}

/**
 * v4.4 (TASK D) — one songRole per track, phase-aware — replaces the flat
 * `Array.from({length}, (_, idx) => resolveSongRole(idx+1, idx))` pre-pass
 * both real generation paths (this file, and batchPreallocation.ts's own
 * mirror) used to run. idx 0/1/2 (trackNo 1-3) still resolve to
 * 'cold-open'/'flagship'/'flagship' exactly as resolveSongRole did — only
 * idx 3+ changes, from a length-clamped flat array to a per-phase rotating
 * pool (mirrors emotionArcPlanForArc's own UniquePool-per-phase pattern).
 */
export function songRolePlanForArc(arc: SlotArcPosition[], seed: number): string[] {
  const pools = new Map<ArcPhase, UniquePool<string>>();
  return arc.map((pos, idx) => {
    if (idx === 0) return 'cold-open';
    if (idx === 1 || idx === 2) return 'flagship';
    if (!pools.has(pos.phase)) pools.set(pos.phase, new UniquePool(songRolePoolForPhase(pos.phase), seed + pos.phase.length * 911));
    return pools.get(pos.phase)!.take();
  });
}

/** TASK I1 (v3.11) — per-archetype recommendation table from the brief; every archetype resolves to a concrete choice, 'lofi-study' being the only one whose recommendation is 'hum-intro'. */
export function defaultOpeningStyleForArchetype(archetype?: ChannelArchetype): 'hook-forward' | 'hum-intro' {
  return archetype === 'lofi-study' ? 'hum-intro' : 'hook-forward';
}

/** 'auto' (or unset) resolves per-archetype; an explicit user choice always wins. */
export function resolveOpeningStyle(requested: OpeningStyle | undefined, archetype?: ChannelArchetype): 'hook-forward' | 'hum-intro' {
  if (requested === 'hook-forward' || requested === 'hum-intro') return requested;
  return defaultOpeningStyleForArchetype(archetype);
}

/** Re-exported for existing callers/tests that import this from localGenerator.ts (TASK I1, v3.11) — the real definition lives in soundSignature.ts so both the plain and Persona-mode style builders share one implementation. */
export { openingDurationText } from './soundSignature';

/**
 * TASK I2 (v3.11) — the cold-open (track 1) / flagship (tracks 2-3) path
 * through the same `gen` (createTitleGenerator's TitleGenerator) state
 * nextTitle() itself uses, except the single composeHook() call is replaced
 * with a k=3 local contest (see core/openingContest.ts). Mutates gen's
 * usedHooks/usedTitles/index exactly like calling gen(role) would — callers
 * must use this *instead of* calling gen(role) for the same slot, never both.
 */
export function nextContestedTitle(
  gen: TitleGenerator,
  language: LyricLanguage,
  archetype: ChannelArchetype | undefined,
  role: string,
  openingRole: OpeningRole,
  packContext: OpeningPackContext,
  k = 3,
  /** v3.15 — see types.ts's GenerationOptions.earwormMode; threaded straight into runOpeningContest's scoring weight. */
  earwormMode = false,
  /** v4.2 (TASK A3) — the same ResolvedConstraints instance the caller built `gen` with (see createTitleGenerator's own constraints param) — title-pattern selection must agree with the rest of the pack's own generator state, so this is never independently re-resolved here. */
  constraints?: ResolvedConstraints
): TitleResult {
  const idx = gen.index;
  const shape = gen.shapeSequence[idx % gen.shapeSequence.length] ?? HOOK_SHAPES[idx % HOOK_SHAPES.length];
  const ctx: HookContext = {
    language,
    shape,
    usedHooks: gen.usedHooks,
    archetype,
    targetSyllables: gen.rhythmTarget,
    emotionalWeight: targetHookEmotionalWeight(role)
  };
  const { winner } = runOpeningContest(gen.seed + 41 + idx * 97, ctx, openingRole, packContext, k, earwormMode);
  gen.usedHooks.add(winner.hook.phrase);
  const resolvedConstraints = constraints ?? resolveConstraintsFromOptions({ projectTitle: 'Set Plan', songCount: gen.shapeSequence.length, channel: { archetype } }, isKidsArchetype(archetype) ? KIDS_AUDIENCE_PROFILE : SENIOR_AUDIENCE_PROFILE);
  const title = titleFromHook(winner.hook, gen.seed + 53 + idx * 131, language, gen.usedTitles, resolvedConstraints, gen.patternUsage);
  gen.usedTitles.add(title);
  gen.index += 1;
  return { title, hook: winner.hook.phrase };
}

/**
 * TASK v3.58 (TASK 4) — `band`, when given, pulls the result toward a
 * genre-independent tempo-band target (core/tempoPlan.ts) instead of the
 * fixed [-4,-2,0,2,3,1,-1,4,2,0] offset cycle, clamped to the audience
 * profile's absolute floor/ceiling — see resolveTempoWithBand. Optional and
 * appended last so every existing caller (e.g. core/batchPreallocation.ts's
 * realtime/Batch/bridge preallocation path) keeps its exact current
 * behavior unless it opts in.
 *
 * The band path maps into genres[0]'s own individual tempoRange (the
 * track's actual lead genre, post core/genreRotation.ts's TASK 1 fix) —
 * NOT the multi-genre blended low/high the no-band fallback below still
 * uses. Measured: blending up to 3 genres' ranges together (this
 * function's original behavior) narrows the effective range every time
 * (e.g. 3 senior genres spanning 82-106 individually blend down to a
 * ~90-102 average), which flattened BPM variety regardless of how wide a
 * spread the band plan asked for — real measurement found stddev stuck at
 * ~3 even with a 4-band plan feeding it. Using the lead genre's own full
 * range instead lets each track's authentic genre range absorb the band
 * spread that genre can actually support.
 */
export function averageTempo(genres: GenrePack[], trackNo: number, band?: { low: number; high: number }, audienceFloor?: number, audienceCeiling?: number) {
  const ranges = genres.length ? genres.map(genre => genre.tempoRange) : ([[92, 104]] as [number, number][]);
  const low = Math.round(ranges.reduce((sum, range) => sum + range[0], 0) / ranges.length);
  const high = Math.round(ranges.reduce((sum, range) => sum + range[1], 0) / ranges.length);
  const center = Math.round((low + high) / 2);
  const offset = [-4, -2, 0, 2, 3, 1, -1, 4, 2, 0][trackNo % 10];
  const fallbackCenter = Math.min(high, Math.max(low, center + offset));
  // v3.77 (TASK B) — data/audienceProfiles.ts's tempoBandsForProfile now
  // always returns real bands (never undefined), so a caller reaching this
  // function with no `band` at all should no longer be possible in normal
  // operation. Kept as a defensive fallback (never remove — a caller this
  // function doesn't control could still omit the argument), but now logs
  // loudly: this exact silent fallback, reached from a profile that
  // resolved to no band plan, is the root cause this task's own §1-2
  // traced BPM stddev collapsing to 2.4. If this ever fires again, it
  // means a NEW path bypassed tempoBandsForProfile entirely.
  if (!band) {
    console.warn('[tempo] band missing — falling back to genre average. This should not happen; tempoBandsForProfile always returns bands now (see v3.77 report).');
    return fallbackCenter;
  }
  const [leadLow, leadHigh] = genres[0]?.tempoRange ?? [low, high];
  return resolveTempoWithBand(leadLow, leadHigh, band, audienceFloor ?? leadLow, audienceCeiling ?? leadHigh, fallbackCenter);
}

function resolveSunoStyleLimit(styleLimit: number | undefined) {
  return styleLimit && styleLimit > 0 ? Math.min(styleLimit, SUNO_COPY_LIMIT) : SUNO_COPY_LIMIT;
}

function resolvePersonaTrackLimit(styleLimit: number | undefined, trackNo: number) {
  const base = resolveSunoStyleLimit(styleLimit);
  return trackNo === 1 ? base : Math.min(base, PERSONA_STYLE_LIMIT);
}

function stylePromptOverLimitWarning(limit: number) {
  return limit === SUNO_COPY_LIMIT
    ? STYLE_PROMPT_OVER_LIMIT_WARNING
    : `스타일 프롬프트가 ${limit}자를 초과합니다 - 수동 확인 필요`;
}

function mergeWarnings(...groups: Array<readonly string[] | undefined>): string[] {
  const warnings: string[] = [];
  for (const group of groups) {
    for (const warning of group || []) {
      if (!warnings.includes(warning)) warnings.push(warning);
    }
  }
  return warnings;
}

function warningsForComposedPrompt(composed: { withinLimit: boolean; warnings?: string[] }, limit: number) {
  return composed.withinLimit
    ? mergeWarnings(composed.warnings)
    : mergeWarnings(composed.warnings, [stylePromptOverLimitWarning(limit)]);
}

/** TASK v3.24 — exported for claudeCodeBridge.ts's importSongsJson: an imported song list still needs the same pack-level identity (oneLineConcept/sonicSignature/vocalSignature/lyricRules/harmonyRules/visualRules) any other blueprint has, computed the same deterministic (no-API-call) way local generation already does. */
export function buildSignatureBlueprint(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  concept: string,
  songs: SongIdea[] = [],
  /**
   * v3.69 (TASK B/D) — defaults to "now" (correct for local generation,
   * which really is happening now), but bridgeImport.ts passes the
   * imported file's own "meta.generatedAt" when present, so a Codex/Claude
   * Code bridge file's set name is dated by when it was actually written,
   * not whenever the user later imports it (see this task's own "생성
   * 시각 기준, import 시각이 아니라" requirement).
   */
  generatedAt: string = new Date().toISOString()
): PlaylistBlueprint {
  return {
    projectTitle: opts.projectTitle,
    channelName: opts.channel.name,
    oneLineConcept: concept,
    sonicSignature: `${genres.map(g => g.label).join(' + ')} / ${moods.map(m => m.label).join(' + ')}`,
    vocalSignature: opts.vocalTone || opts.channel.defaultVocal,
    lyricRules: [],
    harmonyRules: [],
    visualRules: [season.visualDirection, opts.channel.visualIdentity],
    songs,
    generatedAt
  };
}

export function rebuildStylePromptsForPersonaMode(
  blueprint: PlaylistBlueprint,
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  styleLimit?: number
): PlaylistBlueprint {
  const channelParts = buildChannelPromptParts(opts, genres, moods, season);
  const styleLimitValue = resolveSunoStyleLimit(styleLimit);
  const signatureBlueprint = buildSignatureBlueprint(opts, genres, moods, season, blueprint.oneLineConcept, blueprint.songs);
  const generationPack = generationPacks.find(pack => pack.id === opts.audience);
  const seed = hashSeed(seedForBlueprint(opts));
  // TASK v3.60 (TASK C) — this rebuild path (persona-mode toggle in App.tsx)
  // was still calling averageTempo() with only 2 args, so it never reached
  // the v3.58 TASK 4 tempo-band system either, same bug class as the bridge
  // path's batchPreallocation.ts.
  const audienceProfile = audienceProfileForAgeGroup(opts.audience);
  const tempoBands = tempoBandsForProfile(audienceProfile);
  // TASK v3.67 (TASK C) — same arc-intensity reorder as generateLocalBlueprint
  // (see arcPlan.ts); this rebuild keeps every song's existing emotionArc
  // (song spread below), so only tempo/killing-point/exclude are arc-aware
  // here, not emotionArc itself.
  const arcPlan = buildArcPlan(blueprint.songs.length);
  const tempoBandPlan = tempoBands ? reorderByArcIntensity(buildTempoBandPlan(tempoBands, blueprint.songs.length, seed), arcPlan, band => band.low) : [];
  const genrePool = Array.from(new Set((opts.genreIds ?? genres.map(genre => genre.id)).filter(Boolean)));
  const autoGenrePlan = buildGenreRotationPlan(genrePool, blueprint.songs.length, seed);
  const genrePlan = applyAxisAllocation(autoGenrePlan, opts.diversityAllocations, 'genre', genrePool, seed);
  const autoIntroTexturePlan = buildIntroTexturePlan(opts.channel.archetype, blueprint.songs.length, seed, opts.introUniqueness);
  const introTexturePool = introTexturesForArchetype(opts.channel.archetype).map(texture => texture.id);
  const introTexturePlan = applyAxisAllocation(autoIntroTexturePlan, opts.diversityAllocations, 'introTexture', introTexturePool, seed);
  // TASK v3.67 (TASK A) — same seed as generateLocalBlueprint's own
  // killingPointPlan pre-pass, so toggling persona mode on/off reproduces
  // the identical killing-point assignment rather than re-rolling it.
  const killingPointPlan = assignKillingPoints(
    arcPlan.map((pos, idx) => ({
      peakStrength: pos.peakStrength,
      eraTag: genresForTrack(genres, genrePlan[idx], opts.genreBlendWeights)[0]?.eraTag
    })),
    seed + 67,
    killingPointBoostFromInsights(opts.ratingInsights),
    // TASK D2 §4-5 — kids workspaces draw from the separate kid-safe set instead of KILLING_POINTS.
    isKidsArchetype(opts.channel.archetype) ? KIDS_KILLING_POINTS : undefined
  );
  const songs = blueprint.songs.map((song, idx) => {
    const trackNo = song.trackNo;
    const genreId = genrePlan[idx];
    const trackGenres = genresForTrack(genres, genreId, opts.genreBlendWeights);
    const tempo = averageTempo(trackGenres, trackNo, tempoBandPlan[idx], audienceProfile.tempoFloor, audienceProfile.tempoCeiling);
    const killingPoint = killingPointPlan[idx];
    // TASK I1 (v3.11) — prefer the role actually assigned at generation time
    // (including any manual promotion via core/openingOverride.ts) over
    // recomputing from idx; only legacy packs saved before songRole existed
    // fall back to the idx-based lookup.
    const role = song.songRole || resolveSongRole(trackNo, idx);
    const openingStyle = role === 'cold-open' ? (song.openingStyle || resolveOpeningStyle(opts.openingStyle, opts.channel.archetype)) : undefined;
    const introTextureText = introTextureTagForId(introTexturePlan[idx]);
    const trackNarrativeText = rotatingArrangementNarrativeForGenres(trackGenres, idx);
    // TASK v4.8 (TASK A) — 1-atom fallback for composeStylePrompt's shortForm
    // compression stage, used only under hard-limit pressure.
    const trackNarrativeShortForm = rotatingArrangementNarrativeForGenres(trackGenres, idx, 1);
    const excludePrompt = buildExcludePrompt(opts, trackGenres, killingPoint?.relaxes);
    const earwormTextForTrack = (() => {
      if (!opts.earwormMode) return undefined;
      const text = rotatingEarwormText(seed, idx);
      const relaxesDiatonic = killingPoint?.relaxes.includes('predictable diatonic phrase structure');
      return relaxesDiatonic && /predictable cadence/i.test(text) ? rotatingEarwormText(seed, idx + 1) : text;
    })();
    const composed = opts.personaMode
      ? composePersonaSongStylePrompt({
        blueprint: signatureBlueprint,
        opts,
        genres,
        hookPhrase: song.hookPhrase,
        trackNo,
        role,
        tempo,
        openingStyle,
        styleLimitValue: resolvePersonaTrackLimit(styleLimit, trackNo)
      })
      : composeStylePrompt([
        ...channelParts.filter(part =>
          !(role === 'cold-open' && part.id === 'duration')
          && part.id !== 'genre'
          && part.id !== 'genreNarrative'
          && part.id !== 'genreSignature'
          && part.id !== 'instruments'
        ),
        { id: 'genre' as const, text: rotatingGenreText(trackGenres, seed, idx) },
        ...(trackGenres[0]?.signatureSound ? [{ id: 'genreSignature' as const, text: rotatingGenreSignatureText(trackGenres, seed, idx), shortForm: trackGenres[0].shortSignatureSound, minimalForm: trackGenres[0].minimalSignatureSound }] : []),
        ...(trackNarrativeText ? [{ id: 'genreNarrative' as const, text: trackNarrativeText, shortForm: trackNarrativeShortForm }] : []),
        // TASK v3.64-B — per-song rotating melodic-design phrase, replacing
        // the old flat whole-pack EARWORM_STYLE_ATOMS this channelParts
        // entry used to carry (see promptComposer.ts's rotatingEarwormText).
        ...(earwormTextForTrack ? [{ id: 'earworm' as const, text: earwormTextForTrack }] : []),
        // TASK v3.67 (TASK A) — mirrors generateLocalBlueprint's own single
        // killing-point atom.
        ...(killingPoint ? [{ id: 'killingPoint' as const, text: killingPoint.descriptor }] : []),
        ...(role === 'cold-open' ? [{ id: 'duration' as const, text: openingDurationText(role, openingStyle, opts.durationTarget) }] : []),
        // TASK v3.59 (TASK D-1) — a cold-open track whose opening style
        // already says "no instrumental intro, hook heard immediately"
        // (openingDurationText above) must not also carry an introTexture
        // atom describing an instrumental intro texture — the two
        // contradicted each other in the same style prompt in real output.
        ...(introTextureText && !coldOpenHasNoInstrumentalIntro(role, openingStyle) ? [{ id: 'introTexture' as const, text: introTextureText }] : []),
        { id: 'instruments' as const, text: rotatingInstrumentText(trackGenres, seed, idx) },
        { id: 'hook', text: hookStyleDirectives(song.hookPhrase, opts.lyricDepth) },
        { id: 'tempo', text: `${tempo} BPM` },
        { id: 'songRole', text: `track ${trackNo} role: ${role}` },
        { id: 'listenerScene', text: `listener scene: ${song.listenerSituation}` },
        {
          id: 'mixNotes',
          text: [
            generationPack?.tempoBias,
            wantsFinalChorusModulation(role) ? 'modulate up a half step for the final chorus' : null,
            'same channel vocal signature and mix balance across the full playlist set'
          ].filter(Boolean).join(', ')
        }
      // v4.4 (TASK F) — see generateLocalBlueprint's matching
      // composeStylePrompt call below for the full finding: a tighter
      // safeTarget (3rd arg) here too would crowd out genre-differentiating
      // atoms and regress tests/promptBudgetLoopGuard.test.ts's style
      // similarity guard. Left unchanged (styleLimitValue for both).
      ], styleLimitValue, styleLimitValue, undefined, idx);
    const stylePrompt = enforceSingleBpmText(composed.prompt, tempo);
    const promptWarnings = warningsForComposedPrompt(composed, styleLimitValue);
    return {
      ...song,
      stylePrompt,
      excludePrompt,
      ...(genreId ? { genreId } : {}),
      genreText: rotatingGenreText(trackGenres, seed, idx),
      songRole: role,
      openingStyle,
      warnings: mergeWarnings(song.warnings, promptWarnings),
      promptLength: stylePrompt.length,
      promptWithinLimit: stylePrompt.length <= styleLimitValue,
      promptDroppedTerms: composed.droppedTerms,
      promptWordCount: countWords(stylePrompt),
      promptWithinWordTarget: countWords(stylePrompt) <= STYLE_WORD_TARGET_MAX
    };
  });
  return { ...blueprint, songs };
}

function composePersonaSongStylePrompt(input: {
  blueprint: PlaylistBlueprint;
  opts: GenerationOptions;
  genres: GenrePack[];
  hookPhrase: string;
  trackNo: number;
  role: string;
  tempo: number;
  styleLimitValue: number;
  openingStyle?: 'hook-forward' | 'hum-intro';
}) {
  const signature = buildSoundSignature(input.blueprint, input.opts, input.opts.channel);
  return buildPersonaStylePrompt({
    signature,
    opts: input.opts,
    genres: input.genres,
    hookPhrase: input.hookPhrase,
    trackNo: input.trackNo,
    role: input.role,
    tempo: input.tempo,
    isSeed: input.trackNo === 1,
    limit: input.styleLimitValue,
    openingStyle: input.openingStyle
  });
}

function buildYoutubeMetadata(
  opts: GenerationOptions,
  song: Pick<SongIdea, 'trackNo' | 'title' | 'seasonMoment' | 'listenerSituation' | 'hookPhrase'>,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack
): YoutubeMetadata {
  const channelName = opts.channel.englishName || opts.channel.name;
  const genreTags = genres.map(genre => genre.label);
  const moodTags = moods.map(mood => mood.label);
  const baseTags = [
    channelName,
    opts.channel.name,
    song.title,
    season.label,
    ...season.keywords,
    ...genreTags,
    ...moodTags,
    ...opts.channel.seoKeywords
  ];
  const tags = sanitizePublicYoutubeTags(Array.from(new Set(baseTags.map(tag => tag.trim()).filter(Boolean)))).slice(0, 18);
  const title = `${song.title} - ${season.label} ${channelName} Playlist`;
  // TASK v3.39.1 Part C2 — real exported output showed
  // "Suno style prompt and lyrics are generated as original material for
  // <channel name>" going straight into the public description field: an
  // internal/dev-facing sentence, not copy meant to be posted. Replaced with
  // AI_DISCLOSURE_LINE (core/exportCompliance.ts) — the actual policy-facing
  // disclosure YouTube's Studio "Altered or synthetic content" flow expects
  // creators to also state in their own words, not an internal note about
  // how this app works.
  // TASK v3.59 — found while assembling this task's own final report:
  // opts.projectTitle is just as much a free-text, user-authorable field as
  // customConcept (Step2Concept.tsx's plain <input>), and it flowed
  // straight into this public description line unguarded — a project name
  // that naturally echoes an artist-style concept (e.g. one built from the
  // same free-text concept this whole task series is about) got "Famous
  // artist reference risk" flagged on every song in the pack, the same
  // self-penalty class of bug B-1 fixed for customConcept.
  const description = [
    `${song.title} is track ${song.trackNo} from ${safeConceptSummaryForDisplay(opts.projectTitle, channelName)}.`,
    `Concept: ${safeConceptSummaryForDisplay(opts.customConcept, opts.channel.promise)}`,
    `Mood: ${song.listenerSituation}, ${song.seasonMoment}.`,
    AI_DISCLOSURE_LINE,
    `Tags: ${tags.slice(0, 10).join(', ')}`
  ].join('\n');
  // TASK D5 (v3.6) — packagingLanguage (market-derived, independently
  // overridable from lyricLanguage) decides the thumbnail's own language;
  // previously all three market branches here produced identical English
  // text, so a Korean or Japanese channel got an English thumbnail whenever
  // its lyrics happened to be in English.
  const packagingLanguage = resolvePackagingLanguage(opts);
  const localizedSeasonWord = packagingLanguage === 'english' ? season.label : seasonWordFor(season, packagingLanguage);
  const thumbnailText = `${localizedSeasonWord}\n${song.title}`;

  return { title, description, tags, thumbnailText };
}

/** Exposed for tests that need to check how often the real recurring motif appears in generated lyrics. */
export function getRecurringMotifWords(language: GenerationOptions['lyricLanguage']): string[] {
  return recurringMotifs.map(phrase => phraseFor(phrase, language));
}

/** All three language forms of every motif, positionally aligned — used by thumbnailSpec.ts to derive display objects and their English equivalent in one pass. */
export function getRecurringMotifPhrases(): LocalizedPhrase[] {
  return recurringMotifs;
}

/**
 * TASK v3.58 TASK 3 — picks a small, per-song-varying subset of an
 * artist-reference-derived descriptor pool (era tag always first/anchored,
 * then 2 shuffled traits), mirroring promptComposer.ts's rotatingInstrumentText/
 * rotatingGenreSignatureText anchor+shuffle pattern so this new atom source
 * doesn't become yet another clause identical across every song in the pack.
 */
function rotatingArtistStyleAtoms(pool: string[], seed: number, index: number): string[] {
  if (!pool.length) return [];
  const [anchor, ...rest] = pool;
  if (!rest.length) return [anchor];
  const shuffled = shuffle(rest, seed + index * 173);
  return [anchor, ...shuffled.slice(0, 2)];
}

/**
 * TASK v3.68 (TASK A) — generation-time songId, unique to this trackNo in
 * this generation run and stable thereafter (nothing later ever regenerates
 * it — see core/batchPreallocation.ts's reconcileWithPreassignedSlot and
 * core/library.ts's migratePackSongIds, both of which only ever fill this
 * in when it's missing, never overwrite an existing one).
 */
function generateSongId(seedBase: string, trackNo: number): string {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${seedBase}-${trackNo}-${suffix}`;
}

export function generateLocalBlueprint(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  // TASK v3.72 (TASK E) — see batchPreallocation.ts's preallocateSongSlots's
  // matching parameter doc comment. v3.80 (TASK A-3) — previousFlagshipOrder
  // mirrors preallocateSongSlots's own new field, same doc comment there.
  avoid?: {
    usedTitles?: string[];
    usedHooks?: string[];
    recentVocalComboSignatures?: string[];
    previousFlagshipOrder?: VocalType[];
    /** v3.82 (TASK A) — mirrors batchPreallocation.ts's identical field/doc comment. */
    verifiedCombos?: VerifiedCombo[];
  },
  /** TASK A5 (v3.5) — Suno's own limit may change; the user can raise/lower it in Settings (default SUNO_STYLE_LIMIT). */
  styleLimit?: number
): PlaylistBlueprint {
  const generationPack = generationPacks.find(pack => pack.id === opts.audience);
  const concept = opts.customConcept || `${opts.channel.name} ${season.label} playlist with ${genres.map(g => g.label).join(' + ')}`;
  const conceptInfluence = resolveConceptInfluence(opts.customConcept);
  const conceptImages = conceptLyricImages(opts.customConcept);
  // TASK v3.58 TASK 3 — every atom here is already name-free (built by
  // core/artistReferenceDecomposer.ts and re-checked here as defense in
  // depth — see findArtistReferenceLeaks), but they're still just one flat
  // list shared by the whole pack; rotatingArtistStyleAtoms below picks a
  // different small subset per song so 18 songs don't all carry the exact
  // same extra clause.
  const artistStyleAtomPool = (opts.artistReferenceStyleAtoms || []).filter(atom => findArtistReferenceLeaks(atom).length === 0);
  const channelParts = buildChannelPromptParts(opts, genres, moods, season);
  const styleLimitValue = resolveSunoStyleLimit(styleLimit);
  const signatureBlueprint = buildSignatureBlueprint(opts, genres, moods, season, concept);

  const seedBase = seedForBlueprint(opts);
  const seed = hashSeed(seedBase);
  // v4.3 (TASK A) — this pack's packaging-language title axis; see
  // core/titleLocalization.ts's own doc comment for why the local generator
  // builds a bank-based reinterpretation here rather than a literal
  // translation of `title`. usedLocalizedTitles is shared across every song
  // in this call so 18 songs don't collide on the same bank phrase.
  const packagingLanguageForTitles = resolvePackagingLanguage(opts);
  const usedLocalizedTitles = new Set<string>();
  // TASK v3.58 (TASK 4) — genre-independent tempo-band distribution (see
  // core/tempoPlan.ts), so BPM variety comes from a deliberate, data-driven
  // spread across the audience profile's own tempo range instead of only
  // from which genre happened to be assigned per track.
  const audienceProfile = audienceProfileForAgeGroup(opts.audience);
  // v4.2 (TASK A3) — the single ResolvedConstraints instance this whole
  // blueprint's title generation (createTitleGenerator/nextContestedTitle
  // below) reads from; see core/constraints.ts's own top doc comment for
  // why this is re-derived from opts.customConcept rather than sharing the
  // exact object core/setDirector.ts built for the same concept text.
  const constraints = resolveConstraintsFromOptions(opts, audienceProfile);
  const tempoBands = tempoBandsForProfile(audienceProfile);
  // TASK v3.67 (TASK C) — an 18-song curve instead of flat intensity: the
  // arc's own intensity ranking reorders (never recomputes — see
  // arcPlan.ts's own doc comment) the tempo-band plan buildTempoBandPlan
  // already produces, so peak tracks land in the highest bands and closing
  // tracks land in the lowest, instead of wherever buildTempoBandPlan's own
  // seeded shuffle happened to put them.
  const arcPlan = buildArcPlan(opts.songCount);
  const tempoBandPlan = tempoBands ? reorderByArcIntensity(buildTempoBandPlan(tempoBands, opts.songCount, seed), arcPlan, band => band.low) : [];
  const genrePool = Array.from(new Set((opts.genreIds ?? genres.map(genre => genre.id)).filter(Boolean)));
  const autoGenrePlan = buildGenreRotationPlan(genrePool, opts.songCount, seed);
  const genrePlan = applyAxisAllocation(autoGenrePlan, opts.diversityAllocations, 'genre', genrePool, seed);
  // v3.82 (TASK A) — mirrors batchPreallocation.ts's identical flagship
  // (track 2) genre/tempo override from a verified-good combo — see that
  // file's own doc comment for the swap-preserving-counts reasoning.
  const flagshipCombo = opts.songCount >= 3 ? resolveFlagshipCombo(avoid?.verifiedCombos ?? [], genrePool) : undefined;
  // TASK v4.6 (TASK B) — expands the old single-track (idx 1 only) override
  // into "세트 전체 최소 2곡, 최대 5곡" — see verifiedCombos.ts's own doc comment.
  applyVerifiedComboToGenrePlan(genrePlan, flagshipCombo);
  const flagshipComboTempo = flagshipCombo
    ? Math.round((flagshipCombo.bpmRange[0] + flagshipCombo.bpmRange[1]) / 2)
    : undefined;
  // TASK v4.6 (TASK A) — era-canon-sound fallback for when no artist
  // reference exists (the common case for a concept like "70년대 올드팝" with
  // no artist name in it — decomposeArtistReferences then returns [] and
  // artistStyleAtomPool is empty). Per this task's own §1-5, an artist
  // reference (when present) already carries its own instrumentation/
  // harmony/vocal/production atoms via DecomposedReference, so the palette
  // is skipped rather than doubled up when artistStyleAtomPool is non-empty.
  const eraCanonPalettePlan = artistStyleAtomPool.length === 0 ? buildEraCanonPalettePlan(genrePlan, seed) : [];
  const situationPool = new UniquePool(listenerSituations, seed + 21);
  // TASK v3.67 (TASK D) — phase-aware emotion-arc shape per track, replacing
  // the flat UniquePool(emotionArcs, seed) draw (every shape used to be the
  // same dark-to-light curve regardless of position in the pack).
  const emotionArcPlan = emotionArcPlanForArc(arcPlan, seed + 22);
  const motifPool = new UniquePool(recurringMotifs, seed + 23);
  // TASK v3.67 (TASK A) — one killing point per track (undefined for
  // peakStrength 'none'), matched against that track's own lead genre's
  // eraTag (see data/killingPoints.ts's own "세그먼트가 없으면 eraTag로
  // 매칭" fallback — segment identity itself doesn't survive past
  // setDirector.ts into this pipeline, see docs/v367-report.md).
  // v3.80 (TASK A-1) — mirrors batchPreallocation.ts's identical override:
  // track 2 (idx 1, flagship) always gets a killing point; track 1
  // (idx 0, cold-open) is left untouched.
  const arcPlanForKillingPoints = opts.songCount >= 2
    ? arcPlan.map((pos, idx) => (idx === 1 && pos.peakStrength === 'none' ? { ...pos, peakStrength: 'subtle' as const } : pos))
    : arcPlan;
  const killingPointPlan = assignKillingPoints(
    arcPlanForKillingPoints.map((pos, idx) => ({
      peakStrength: pos.peakStrength,
      eraTag: genresForTrack(genres, genrePlan[idx], opts.genreBlendWeights)[0]?.eraTag
    })),
    seed + 67,
    killingPointBoostFromInsights(opts.ratingInsights),
    isKidsArchetype(opts.channel.archetype) ? KIDS_KILLING_POINTS : undefined
  );
  // TASK v4.9 (TASK C) — a first-15-seconds hooking device, distinct from
  // killingPointPlan's final-chorus peak (see data/openingHooks.ts's own
  // doc comment for why both are needed — real amplitude measurement found
  // tracks 1-3's own peak sitting at 9/10 of the track, i.e. only at the
  // very end, nothing up front to keep a listener from skipping). Tracks
  // 1-3 always get one (3 distinct); tracks 4+ get one on at most 4 more
  // songs. Family-aware via eraCanonPalettePlan's own per-song palette
  // (undefined for any song with no palette match — assignOpeningHooks
  // just falls back to the full dictionary for those).
  const openingHookFamilyByIndex = eraCanonPalettePlan.map(assignment => assignment ? paletteFamilyForPaletteId(assignment.palette.id)?.id : undefined);
  const openingHookPlan = assignOpeningHooks(opts.songCount, seed + 83, openingHookFamilyByIndex);
  // TASK v4.11 (TASK B) — a separate axis from openingHookPlan above (what
  // the opening contains vs. how loud it renders — see
  // data/openingHooks.ts's own OPENING_LOUDNESS_DESCRIPTORS doc comment).
  // Tracks 1-3 only, same required-coverage shape as openingHookPlan.
  const openingLoudnessPlan = assignOpeningLoudnessDescriptors(opts.songCount, seed + 149);
  // TASK H2 (v3.13) — the primary selected genre's own lyric imagery (see
  // GenrePack.lyricFlavorImages), resolved to this pack's lyricLanguage once
  // up front. Undefined for genres without an entry — composeLyrics falls
  // back to the generic filler pool in that case, unchanged from before v3.13.
  const genreFlavorImages = genres[0]?.lyricFlavorImages?.map(image => phraseFor(image, opts.lyricLanguage));
  const nextTitle = createTitleGenerator(opts.lyricLanguage, seedBase, opts.songCount, avoid, opts.channel.archetype, constraints);
  const lyricPools = createLyricBatchPools(opts.lyricLanguage, seedBase);
  const packMotif = recurringMotifs[seed % recurringMotifs.length];
  // TASK I2 (v3.11) — "팩에서 고른 moodIds/genreIds" per the brief: the plain
  // set of ids the user selected for the whole pack, not a derived/weighted
  // statistic.
  const openingPackContext: OpeningPackContext = { dominantGenreIds: opts.genreIds, dominantMoodIds: opts.moodIds };

  // TASK v3.33 Part C — per-song money-chord progression quota (opt-in via
  // usesMoneyChordQuota: only when the channel hasn't picked a specific
  // moneyChordMode, and only for archetypes with a real signature
  // progression). roles is computed as its own pre-pass since
  // buildProgressionPlan needs every trackNo's role before the main loop
  // below assigns anything else.
  // v4.4 (TASK D) — phase-aware (songRolePlanForArc), not the old flat
  // length-clamped array — see that function's own doc comment for the
  // duplication bug this replaces.
  const songRoles = songRolePlanForArc(arcPlan, seed + 24);
  // TASK v4.14 (TASK B) — mirrors batchPreallocation.ts's identical
  // family-aware money-chord distribution (same reasoning: falls back to
  // the old flat archetype-pool rotation for any pack whose genrePlan
  // never resolves to a data/paletteFamilies.ts family).
  const dominantFamilyId = dominantPaletteFamilyId(genrePlan);
  const progressionPlan = usesMoneyChordQuota(opts)
    ? (buildFamilyProgressionPlan(dominantFamilyId, opts.channel.archetype, seed, opts.songCount) ?? buildProgressionPlan(opts.channel.archetype, seed, songRoles))
    : null;
  // TASK v3.38 Part B2 — per-song male/female/mixed vocal-type quota.
  // TASK v3.72 (TASK A) — usesVocalQuota now defaults true for every
  // archetype, not just kids (see vocalPlan.ts's own doc comment for the
  // regression this fixes); the quota shape still differs by archetype —
  // kids keeps DEFAULT_KIDS_VOCAL_QUOTA, every other archetype falls back to
  // DEFAULT_ADULT_VOCAL_QUOTA (both mean a boy-and-girl/male-female mixed
  // vocal as of D2 §6-3 — see vocalPlan.ts's own doc comment).
  // v3.77 (TASK A) — mirrors batchPreallocation.ts's own leaning-quota
  // wiring (same reasoning: see vocalPlan.ts's leaningGenderFor doc comment).
  // TASK K2 §5-1 — opts.channel.vocalQuotaOverride slots in ahead of the
  // kids/adult default, same priority as opts.vocalQuota itself (a
  // single-gender-group channel's own fixed quota should win the same way
  // an explicit caller-supplied quota already does). undefined for every
  // existing channel preset, so this fallback chain is unchanged for them.
  const baseVocalQuota = opts.vocalQuota ?? opts.channel.vocalQuotaOverride ?? (isKidsArchetype(opts.channel.archetype) ? DEFAULT_KIDS_VOCAL_QUOTA : DEFAULT_ADULT_VOCAL_QUOTA);
  const vocalLeaning = isKidsArchetype(opts.channel.archetype) || opts.vocalQuota || opts.channel.vocalQuotaOverride ? undefined : leaningGenderFor(opts);
  const resolvedVocalQuota = vocalLeaning ? leaningAdultVocalQuota(baseVocalQuota, opts.songCount, vocalLeaning) : baseVocalQuota;
  // v3.77 (TASK A) — mirrors batchPreallocation.ts's identical guard/comment:
  // a custom vocalTone with no detectable preset/gender word must still
  // reach the stylePrompt verbatim (via fallbackVocalText below) rather than
  // being silently replaced by buildAdultVocalTraitPlan's generic composed
  // wording.
  const explicitUnrecognizedVocalTone = !isKidsArchetype(opts.channel.archetype) && !opts.vocalQuota && !vocalLeaning
    && Boolean(opts.vocalTone?.trim()) && opts.vocalTone!.trim() !== opts.channel.defaultVocal;
  const autoVocalPlan = usesVocalQuota(opts)
    ? buildVocalPlan(resolvedVocalQuota, opts.songCount, seed)
    : null;
  let vocalPlan = autoVocalPlan
    ? applyAxisAllocation(autoVocalPlan, opts.diversityAllocations, 'vocalType', VOCAL_TYPE_IDS, seed)
    : null;
  // v3.80 (TASK A-3) — mirrors batchPreallocation.ts's identical flagship
  // vocal-type-order pin (same seed, same rotation rule, same data-driven
  // guard, same vocalLeaning skip — see that file's own doc comment for
  // both).
  const vocalPlanHasAllThreeTypes = vocalPlan ? new Set(vocalPlan).size === 3 : false;
  const flagshipVocalOrder = vocalPlan && opts.songCount >= 3 && vocalPlanHasAllThreeTypes && !vocalLeaning
    ? resolveFlagshipVocalOrder(seed, avoid?.previousFlagshipOrder)
    : null;
  if (vocalPlan && flagshipVocalOrder) {
    vocalPlan = applyFlagshipVocalOrder(vocalPlan, flagshipVocalOrder);
  }
  // v3.82 (TASK A) — mirrors batchPreallocation.ts's identical flagship
  // vocal-type override from a verified combo (see that file's own doc
  // comment — never fires for the app's current registry, since its one
  // entry's vocalType is deliberately undefined/gender-independent).
  if (vocalPlan && flagshipCombo?.vocalType && vocalPlan[1] !== flagshipCombo.vocalType) {
    const swapIndex = vocalPlan.findIndex((type, i) => i >= 3 && type === flagshipCombo.vocalType);
    if (swapIndex !== -1) {
      const tmp = vocalPlan[1];
      vocalPlan[1] = vocalPlan[swapIndex];
      vocalPlan[swapIndex] = tmp;
    }
  }
  // TASK v4.9 (TASK B, §2-3) — genre-vocalType affinity pairing (real
  // listening feedback: "재즈는 남녀 상관없이 약함. 재즈 = 무조건 여자"). Runs after
  // every other vocalPlan reordering above (flagship pins) so it never
  // fights them — applyGenreVocalAffinity only ever swaps two slots when
  // doing so strictly improves the pack's total genre/vocalType affinity,
  // so any position a flagship override already pinned just won't be a
  // net-improving swap target unless doing so ALSO happens to raise the
  // total (in which case the flagship's own vocalType is preserved anyway,
  // just relocated). Kids skipped — data/genreLibrary vocalPreference is
  // only authored for adult/senior oldpop genres.
  if (vocalPlan && !isKidsArchetype(opts.channel.archetype)) {
    vocalPlan = applyGenreVocalAffinity(vocalPlan, genrePlan, opts.songCount >= 3 ? 3 : 0);
  }
  // TASK v3.41 Part A2/D — mirrors batchPreallocation.ts's own
  // buildVocalVariantPlan call (same seed) so the local and realtime/Batch/
  // bridge paths rotate through the same per-song wording for the same opts.
  // Kids only now — the adult path uses buildAdultVocalTraitPlan below
  // (TASK v3.72 TASK B).
  const vocalVariantPlan = vocalPlan && isKidsArchetype(opts.channel.archetype) ? buildVocalVariantPlan(vocalPlan, seed) : null;
  // TASK v3.72 (TASK B) — mirrors batchPreallocation.ts's own
  // buildAdultVocalTraitPlan call (same seed) so the local and realtime/
  // Batch/bridge paths agree on every trackNo's 4-axis vocal wording for the
  // same opts. audienceProfile is already computed above (same var used for
  // tempoBandPlan); killingPointPlan is already computed above too.
  const isSeniorAudience = audienceProfile.id === 'senior';
  const vocalPeakFlags = killingPointPlan.map(kp => Boolean(kp?.relaxes?.includes('comfortable mid vocal register')));
  // v3.80 (TASK B-2-3) — mirrors batchPreallocation.ts's identical
  // eraBucketByIndex construction (same genrePlan indexing).
  const eraBucketByIndex = genrePlan.map(id => eraBucketForGenreId(id) ?? undefined);
  // v3.80 (TASK E) — 1-2 era-matched vocal technique phrases per song,
  // appended onto the 'vocal' style-prompt atom below (essential, never
  // budget-dropped — see data/vocalTechniquesByEra.ts's own doc comment).
  // Kids only skips this (its own vocalDescriptionFor archetype branch has
  // no era concept).
  const vocalTechniquePlan = !isKidsArchetype(opts.channel.archetype) ? buildVocalTechniquePlan(eraBucketByIndex, seed) : null;
  // v3.80 (TASK A-1) — mirrors batchPreallocation.ts's identical flagship
  // proximity hard-override (same reasoning: track 1 spacious/not-dry,
  // tracks 2-3 plate/chamber ambience specifically).
  const flagshipProximityOverride = opts.songCount >= 3
    ? {
        0: PROXIMITY_POOL.filter(value => value !== 'dry and forward'),
        1: ['soft plate ambience', 'chamber ambience'],
        2: ['soft plate ambience', 'chamber ambience']
      }
    : undefined;
  const adultVocalTraitPlan = vocalPlan && !isKidsArchetype(opts.channel.archetype) && !explicitUnrecognizedVocalTone
    ? buildAdultVocalTraitPlan(vocalPlan, seed, {
        isSenior: isSeniorAudience,
        peakFlags: vocalPeakFlags,
        // v3.77 (TASK A) — see batchPreallocation.ts's identical comment.
        channelDefaultVocal: opts.vocalTone?.trim() || opts.channel.defaultVocal,
        recentRegisterSignatures: avoid?.recentVocalComboSignatures,
        eraBucketByIndex,
        proximityOverrideByIndex: flagshipProximityOverride
      })
    : null;
  // TASK v3.39.1 Part H4 — matches batchPreallocation.ts's own fallback so
  // the local path's lyric meta tag agrees with what the realtime/Batch/
  // bridge paths would tag the same opts with.
  // TASK v4.13 bugfix — mirrors batchPreallocation.ts's identical fallback:
  // explicitUnrecognizedVocalTone means vocalTone matched no preset and
  // carried no detectable gender/duet/mixed word (English or Korean) at
  // all — genuinely unparseable text Suno can't read either way, so it must
  // not become every track's literal vocal descriptor. Falls back to the
  // channel default with the same console warning.
  if (explicitUnrecognizedVocalTone) {
    console.warn(`[vocalTone] "${opts.vocalTone?.trim()}" matched no preset and no detectable gender/duet/mixed word — falling back to the channel default vocal instead of using it as every track's vocal descriptor.`);
  }
  const fallbackVocalText = explicitUnrecognizedVocalTone ? opts.channel.defaultVocal : (opts.vocalTone?.trim() || opts.channel.defaultVocal);
  // TASK v3.41 Part A1 — mirrors batchPreallocation.ts's fallbackVocalGender.
  const fallbackVocalGender = matchVocalPreset(fallbackVocalText)?.gender;
  // TASK v3.42 Part B2 — mirrors batchPreallocation.ts's own hookDevicePlan
  // (same seed), applied unconditionally (every archetype).
  const narrativeText = arrangementNarrativeForGenres(genres);
  const hookDevicePlan = applyAxisAllocation(
    buildHookDevicePlan(opts.songCount, seed, hookDeviceIdsForNarrative(narrativeText)),
    opts.diversityAllocations,
    'hookDevice',
    hookDevices.map(device => device.id),
    seed
  );
  const introTexturePlan = applyAxisAllocation(
    buildIntroTexturePlan(opts.channel.archetype, opts.songCount, seed, opts.introUniqueness),
    opts.diversityAllocations,
    'introTexture',
    introTexturesForArchetype(opts.channel.archetype).map(texture => texture.id),
    seed
  );
  // TASK v3.42 Part C — per-song lyric section-tag shape (see
  // lyricEngine.ts's buildStructureTemplatePlan); track 1 always resolves to
  // 'T1' inside composeLyrics regardless of what this plan assigns it.
  // TASK v4.6 (TASK C) — BPM-aware selection (core/structureTemplatePlan.ts)
  // replaces the old BPM-independent rotation: tempoBandPlan is already
  // built above (well before any song's exact tempo is computed), so its
  // own band midpoint is a good-enough per-song BPM proxy for picking a
  // section-count-appropriate template, without needing to reorder the
  // per-song loop below where the exact tempo is finalized.
  const bpmProxyByIndex = Array.from({ length: opts.songCount }, (_, i) => {
    const band = tempoBandPlan[i];
    return band ? (band.low + band.high) / 2 : undefined;
  });
  const autoStructureTemplatePlan = applyAxisAllocation(
    buildBpmAwareStructureTemplatePlan(opts.songCount, seed, opts.channel.archetype, bpmProxyByIndex),
    opts.diversityAllocations,
    'structureTemplate',
    isKidsArchetype(opts.channel.archetype) ? KIDS_STRUCTURE_TEMPLATE_IDS : ADULT_STRUCTURE_TEMPLATE_IDS,
    seed
  );
  if (autoStructureTemplatePlan.length) autoStructureTemplatePlan[0] = 'T1';
  // TASK v4.11 (TASK A) — mirrors batchPreallocation.ts's identical repair:
  // applyAxisAllocation above almost always overrides the BPM-eligible pick
  // with opts.diversityAllocations' manual, fixed-count 'structureTemplate'
  // target (pure variety guarantee, no BPM awareness) — see
  // repairStructureTemplatePlanForBpm's own doc comment for the real 8/18
  // mismatch measurement this fixes. Swaps templates pairwise only; the
  // manual count distribution survives exactly.
  const structureTemplatePlan = repairStructureTemplatePlanForBpm(autoStructureTemplatePlan, bpmProxyByIndex);
  // TASK v3.67 (TASK C) — same reorder-not-recompute treatment as
  // tempoBandPlan above: buildArrangementDensityPlan's own weighted values
  // (v4.16 TASK B — 3:4:2 sparse:medium:full, see promptComposer.ts) are
  // unchanged, only WHICH track gets which of sparse/medium/full is
  // realigned to the arc (peak tracks skew toward 'full', closing toward
  // 'sparse'). Only takes effect when arrangementDensity isn't manually
  // overridden — applyAxisAllocation returns the manual plan untouched
  // otherwise, same as for any other caller.
  const arrangementDensityRank: Record<string, number> = { sparse: 0, medium: 1, full: 2 };
  const autoOrManualArrangementDensityPlan = applyAxisAllocation(
    reorderByArcIntensity(
      buildArrangementDensityPlan(opts.songCount, seed),
      arcPlan,
      level => arrangementDensityRank[level]
    ),
    opts.diversityAllocations,
    'arrangementDensity',
    ARRANGEMENT_DENSITY_IDS,
    seed
  );
  // v3.80 (TASK A-1) — mirrors batchPreallocation.ts's identical flagship
  // density pin (cold-open medium, flagship slots forced sparse), same
  // preserve-counts + re-break-runs treatment and same data-driven guard
  // (see that file's own doc comment for why a manual/auto check would be
  // wrong here).
  const arrangementDensityHasAllThreeLevels = new Set(autoOrManualArrangementDensityPlan).size === 3;
  const arrangementDensityPlan = opts.songCount >= 3 && arrangementDensityHasAllThreeLevels
    ? breakLongRuns(pinPrefixPreservingCounts(autoOrManualArrangementDensityPlan, ['medium', 'sparse', 'sparse'] as const), 2)
    : autoOrManualArrangementDensityPlan;
  const lyricThemePlan = buildLyricThemePlan(opts, seed);
  const povPlan = buildPovPlan(opts, seed);
  const sectionStylePlan = buildSectionStylePlan(opts.songCount, seed, structureTemplatePlan);

  const songs: SongIdea[] = Array.from({ length: opts.songCount }, (_, idx) => {
    const trackNo = idx + 1;
    const role = songRoles[idx];
    // TASK I1/I2 (v3.11) — tracks 1-3 run a local k=3 hook contest instead of
    // taking the first composeHook() candidate; every other track is
    // unchanged. nextContestedTitle mutates the exact same nextTitle
    // state (usedHooks/usedTitles/index) nextTitle(role) would have, so
    // later tracks can never collide with a contest-picked hook.
    const { title, hook } = trackNo <= 3
      ? nextContestedTitle(nextTitle, opts.lyricLanguage, opts.channel.archetype, role, role === 'cold-open' ? 'cold-open' : 'flagship', openingPackContext, 3, opts.earwormMode, constraints)
      : nextTitle(role);
    const openingStyle = role === 'cold-open' ? resolveOpeningStyle(opts.openingStyle, opts.channel.archetype) : undefined;
    const situationOption = situationPool.take();
    const situation = situationOption.english;
    const emotionArc = emotionArcPlan[idx];
    const genreId = genrePlan[idx];
    const trackGenres = genresForTrack(genres, genreId, opts.genreBlendWeights);
    // v3.82 (TASK A) — mirrors batchPreallocation.ts's identical flagship
    // (track 2) tempo override, clamped to the audience's own tempo range.
    const tempo = idx === 1 && flagshipComboTempo !== undefined
      ? Math.min(audienceProfile.tempoCeiling, Math.max(audienceProfile.tempoFloor, flagshipComboTempo))
      : averageTempo(trackGenres, trackNo, tempoBandPlan[idx], audienceProfile.tempoFloor, audienceProfile.tempoCeiling);
    const killingPoint = killingPointPlan[idx];
    const openingHook = openingHookPlan[idx];
    const openingLoudness = openingLoudnessPlan[idx];
    const lyricThemeId = lyricThemePlan[idx];
    const lyricTheme = lyricThemeForSlot(lyricThemeId, opts);
    const lyricThemeText = lyricTheme?.scene;
    const lyricThemeArc = lyricTheme?.emotionalArc;
    const listenerScene = lyricThemeText || situation;
    // v4.5 (TASK D follow-up) — vocabularyBankId (below) was only ever a
    // metadata snapshot for the bridge instruction's "reference list"; the
    // local composer's own conceptImages source (customConcept-derived only)
    // never actually drew from a track's assigned scene bank, so a song
    // tagged 'dance-saturday'/'dance-night' still sang quiet-morning-style
    // imagery. Gated to non-default banks only (quiet-morning stays
    // untouched — "실제 청취 피드백: quiet-morning 뱅크를 삭제하지 말 것") so
    // this only changes the ~explicit-frame minority of tracks. Capped to 2
    // nouns, not the full bank: each core genre already carries its own
    // small (3-word) lyricFlavorImages pool that
    // tests/genreDifferentiation.test.ts measures as genre-identity signal
    // (line overlap between two genres, same concept/season, must stay
    // <=80%). Mixing in the full 8-word bank overwhelmed that 3-word pool
    // with genre-agnostic words shared across every genre and pushed
    // measured overlap to 87-89%; 2 words keeps the scene audible without
    // drowning out genre identity. Also filtered against
    // ARRANGEMENT_VOCABULARY first — dance-night's own 'band' noun is a
    // real production term data/arrangementVocabulary.ts's own
    // findArrangementVocabularyInLyrics flags as a leak when it becomes a
    // lyric line's subject, so it (and any future bank noun that collides)
    // must never be a candidate here.
    const sceneVocabularyBank = vocabularyBankForScene(lyricTheme?.frameId, lyricTheme?.motionKo);
    const sceneVocabImages = sceneVocabularyBank.id !== QUIET_MORNING_BANK_ID
      ? sceneVocabularyBank.nouns
        .filter(noun => !noun.toLowerCase().split(/\s+/).some(word => ARRANGEMENT_VOCABULARY.includes(word)))
        .slice(0, 2)
      : [];
    const trackMotifOption = motifPool.take();
    const manualKidsTheme = kidsEngineThemeForLyricSlot(lyricThemeId) as KidsLyricTheme | undefined;
    const sectionStyle = sectionStylePlan[idx];
    // TASK v3.38 Part B3 — the 'kids' channel archetype uses a dedicated,
    // self-contained lyric body composer instead of the adult engine's
    // situation/motif pools (coffee, commute, quiet longing — unsafe for
    // children's content). Title/hook (above) are unaffected: they already
    // come from the kid-safe hookBanks/kids.ts vocabulary via
    // opts.channel.archetype, independent of this branch.
    // TASK v3.70 (TASK C) — reuses this track's own hookDevice pick (already
    // a deterministic per-song rotation, see hookDevicePlan below) to derive
    // which position the single non-final-chorus hook occurrence lands on,
    // rather than introducing a separate new rotation/axis for it.
    const hookPositionVariant = (hookDevices.findIndex(device => device.id === hookDevicePlan[idx]) % 3 + 3) % 3 as 0 | 1 | 2;
    const { lyrics: composedLyrics, hookPhrase } = isKidsArchetype(opts.channel.archetype)
      ? composeKidsLyrics({ language: opts.lyricLanguage, title, hook, seed: seed + trackNo * 13, theme: manualKidsTheme })
      : composeLyrics({
        language: opts.lyricLanguage,
        season,
        title,
        hook,
        situation: phraseFor(situationOption, opts.lyricLanguage),
        motif: phraseFor(trackMotifOption, opts.lyricLanguage),
        role,
        pools: lyricPools,
        openingStyle,
        // v4.5 (TASK D follow-up) — merged into genreFlavorImages, not
        // conceptImages: composeLyrics's pickMotifOrFlavor() treats any
        // non-empty conceptImages as a full override of genre-specific
        // imagery at the guaranteed "real motif" slot. Since lyricTheme
        // allocation is genre-independent, feeding scene words through
        // conceptImages made same-slot tracks across different genres draw
        // from the same genre-agnostic pool there, collapsing genre
        // differentiation (regression caught by
        // tests/genreDifferentiation.test.ts). genreFlavorImages already
        // varies per genre and only ever gets mixed into the shared flavor
        // pool, never used as a full override, so scene words still surface
        // without erasing genre identity.
        genreFlavorImages: sceneVocabImages.length ? [...(genreFlavorImages || []), ...sceneVocabImages] : genreFlavorImages,
        conceptImages,
        structureTemplate: structureTemplatePlan[idx],
        hookPositionVariant
      });
    // TASK A1/A2 (v3.5): every fragment is tagged with its priority id and
    // handed to composeStylePrompt, which dedupes and — if the combined
    // length would cross the Suno-safe budget — drops the lowest-priority
    // ids first (never truncating mid-phrase). See promptComposer.ts.
    const vocalType = vocalPlan ? vocalPlan[idx] : undefined;
    // TASK v3.41 Part A2/D — same rotation index batchPreallocation.ts's
    // preallocateSongSlots uses for the same opts/trackNo (kids only — see
    // TASK v3.72 TASK B for the adult path below).
    const vocalDescriptionText = vocalType
      ? (isKidsArchetype(opts.channel.archetype)
          ? vocalDescriptionFor(vocalType, opts.lyricLanguage, vocalVariantPlan ? vocalVariantPlan[idx] : 0, opts.channel.archetype)
          : (adultVocalTraitPlan?.[idx] ?? fallbackVocalText))
      : variedVocalText(fallbackVocalText, idx, trackGenres[0], opts.channel.archetype);
    // TASK v3.41 Part A1 — vocalType already IS the explicit gender for a
    // kids-quota song; otherwise falls back to the matched preset's own
    // gender (mirrors batchPreallocation.ts's fallbackVocalGender) so a
    // locally generated non-kids pack also gets a correct duet/group tag
    // instead of relying on prose sniffing alone.
    const vocalGender = vocalType
      ? (isKidsArchetype(opts.channel.archetype) ? vocalType : (vocalType === 'mixed' ? 'duet' : vocalType))
      : fallbackVocalGender;
    // TASK v3.39.1 Part H4 — realtime/Batch/bridge output all get a
    // [male vocal]/[female vocal]/[mixed vocal] lyric meta tag via
    // batchPreallocation.ts's reconcileWithPreassignedSlot, but a local-only
    // generated pack never passes through that function, so its lyrics
    // always started with the section tag ([short intro], etc.) and no
    // vocal tag at all. Same tag resolution, applied directly here instead.
    const lyrics = ensureVocalMetaTag(applyDuetSectionVocalTags(composedLyrics, vocalGender), resolveVocalMetaTag(vocalType, vocalGender, vocalDescriptionText));
    // TASK v3.48.1 — narrative genres still get one auxiliary hook device,
    // but the auto plan filters out devices already described by the
    // arrangement narrative so the two cues do not fight each other.
    // TASK v4.8 (TASK A, §1-2) — uses the device's own shortForm as the
    // PRIMARY local-generation text (not just a shortForm fallback): the
    // full `.prompt` sentence (12-23 words) never actually got compressed
    // in practice, since composeStylePrompt's shortForm stage only fires
    // once a song's raw prompt already exceeds the hard 1000-char limit,
    // and a real measured pack sat at 831-998 chars — always under that
    // trigger. `.prompt` itself is untouched (still used by the bridge/
    // batch path's own slot metadata at batchPreallocation.ts, which faces
    // no equivalent per-atom budget concern).
    const hookDeviceEntry = getHookDeviceById(hookDevicePlan[idx]);
    const hookDeviceText = hookDeviceEntry?.shortForm;
    // TASK v4.8 (TASK D-2) — real measurement found "warm string pad swell
    // intro texture" (data/introTextures.ts's 'str_warm_pad', suited to
    // senior-morning broadly) landing on an early-1960s Brill Building song
    // — 'string pad' is on data/eraExclusions.ts's own 1950s-60s forbidden
    // list (a pad is a sustained synth/analog-synth texture, a later-era
    // production technique). introTexturesForArchetype only ever filters by
    // channel archetype, not by a song's own era bucket (which varies
    // within one senior-morning pack) — dropped here via the same
    // defense-in-depth output-guard pattern already used for palette atoms
    // just below (rotatingEraPaletteAtoms's own findArtistReferenceLeaks
    // filter) rather than reworking the pool-selection layer itself.
    const rawIntroTextureText = introTextureTagForId(introTexturePlan[idx]);
    const introEraBucket = eraBucketByIndex[idx];
    const introTextureText = rawIntroTextureText && introEraBucket
      && ERA_FORBIDDEN_DESCRIPTORS[introEraBucket]?.some(term => rawIntroTextureText.toLowerCase().includes(term.toLowerCase()))
      ? undefined
      : rawIntroTextureText;
    const trackNarrativeText = rotatingArrangementNarrativeForGenres(trackGenres, idx);
    // TASK v4.8 (TASK A) — 1-atom fallback for composeStylePrompt's shortForm
    // compression stage, used only under hard-limit pressure.
    const trackNarrativeShortForm = rotatingArrangementNarrativeForGenres(trackGenres, idx, 1);
    const genreText = rotatingGenreText(trackGenres, seed, idx);
    // TASK v3.67 (TASK B) — this track's own killing point may relax
    // specific audience exclusions, only for this one song (see
    // data/killingPoints.ts's KillingPoint.relaxes / promptComposer.ts's
    // buildExcludePrompt, which itself only ever drops entries that are
    // actually in the profile's relaxableAtPeak — hardExclusions never move).
    const excludePrompt = buildExcludePrompt(opts, trackGenres, killingPoint?.relaxes);
    // TASK v3.67 (TASK D follow-up) — a killing point relaxing "predictable
    // diatonic phrase structure" should not sit next to an earworm variant
    // that IS a predictable-cadence phrase; nudge to the adjacent rotation
    // slot instead of turning earworm mode off (still a real, still-varied
    // melodic-design phrase, just not this one for this one song).
    const earwormTextForTrack = (() => {
      if (!opts.earwormMode) return undefined;
      const text = rotatingEarwormText(seed, idx);
      const relaxesDiatonic = killingPoint?.relaxes.includes('predictable diatonic phrase structure');
      return relaxesDiatonic && /predictable cadence/i.test(text) ? rotatingEarwormText(seed, idx + 1) : text;
    })();
    const songParts: PromptPart[] = [
      ...channelParts.filter(part =>
        !(role === 'cold-open' && part.id === 'duration')
        && !(progressionPlan && part.id === 'moneyChord')
        && part.id !== 'vocal'
        && part.id !== 'genreNarrative'
        && part.id !== 'genreSignature'
        && part.id !== 'instruments'
        && part.id !== 'genre'
      ),
      // TASK v3.42 Part D follow-up — always overrides channelParts' flat
      // whole-pack genre atom with a per-song rotated anchor+2-3 combination;
      // see promptComposer.ts's rotatingGenreText.
      { id: 'genre' as const, text: genreText },
      ...(trackGenres[0]?.signatureSound ? [{ id: 'genreSignature' as const, text: rotatingGenreSignatureText(trackGenres, seed, idx), shortForm: trackGenres[0].shortSignatureSound, minimalForm: trackGenres[0].minimalSignatureSound }] : []),
      ...(trackNarrativeText ? [{ id: 'genreNarrative' as const, text: trackNarrativeText }] : []),
      // TASK v3.64-B — per-song rotating melodic-design phrase, replacing
      // the old flat whole-pack EARWORM_STYLE_ATOMS this channelParts entry
      // used to carry (see promptComposer.ts's rotatingEarwormText).
      ...(earwormTextForTrack ? [{ id: 'earworm' as const, text: earwormTextForTrack }] : []),
      // TASK v3.67 (TASK A) — this track's one designed peak moment, a
      // single style-prompt atom conveyed as intent (see
      // data/killingPoints.ts) — never present for a peakStrength 'none'
      // track (killingPoint is undefined in that case).
      ...(killingPoint ? [{ id: 'killingPoint' as const, text: killingPoint.descriptor }] : []),
      // TASK v4.9 (TASK C) — first-15-seconds hooking device, distinct from
      // killingPoint above (see data/openingHooks.ts's own doc comment).
      // Never present beyond openingHookPlan's own tracks-1-3-required +
      // up-to-4-more cap.
      ...(openingHook ? [{ id: 'openingHook' as const, text: openingHook.descriptor }] : []),
      // TASK v4.11 (TASK B) — same tracks-1-3-only coverage as openingHook
      // above, but for playback LEVEL rather than content (see
      // data/openingHooks.ts's own OPENING_LOUDNESS_DESCRIPTORS doc comment
      // — real waveform measurement: tracks 1-3 rendered 3.7dB quieter than
      // the same track's own full-song average even with an opening hook in
      // place, since Suno tends to render an intro quietly by default
      // regardless of what it contains).
      ...(openingLoudness ? [{ id: 'openingLoudness' as const, text: openingLoudness }] : []),
      ...(conceptInfluence || eraCanonPalettePlan[idx]
        ? [{
          id: 'concept' as const,
          // TASK v3.58 TASK 3 — artist-derived descriptors listed first: the
          // soft word-budget stage's concept floor-reduction (see
          // promptBudget.ts's CONCEPT_FLOOR_ATOMS) keeps only the first N
          // atoms of this joined group, and a concrete, authentic descriptor
          // ("jangly 12-string electric guitar") is worth protecting ahead
          // of conceptStyleText's own generic fallback filler ("concept cue:
          // custom concept focus") when a long customConcept forces a choice
          // between them.
          // TASK v4.6 (TASK A) — era-canon-palette atoms listed next (still
          // ahead of the generic conceptStyleText fallback, same reasoning):
          // rotatingEraPaletteAtoms returns [] whenever eraCanonPalettePlan[idx]
          // is undefined (no artist ref AND no matching oldpop palette, or an
          // artist ref IS present so the plan was never built at all), so this
          // is a no-op for every non-oldpop/non-artist-reference song, and the
          // branch condition above still needs the `|| eraCanonPalettePlan[idx]`
          // check since a channel with no customConcept text at all would
          // otherwise skip this whole atom (conceptInfluence is null for an
          // empty customConcept, independent of whether a palette applies).
          text: [
            ...rotatingArtistStyleAtoms(artistStyleAtomPool, seed, idx),
            // TASK v4.6 (§1-6) — same defense-in-depth re-check as
            // artistStyleAtomPool above: every palette string is hand-authored
            // artist-free, but this is the same output guard reused, not a
            // new one, per this task's own "출력 가드로 검사하십시오 (v3.58 기존
            // 가드 재사용)".
            ...rotatingEraPaletteAtoms(eraCanonPalettePlan[idx], seed, idx, genreId).filter(atom => findArtistReferenceLeaks(atom).length === 0),
            conceptStyleText(opts.customConcept, idx)
          ].filter(Boolean).join(', ')
        }]
        : []),
      ...(role === 'cold-open' ? [{ id: 'duration' as const, text: openingDurationText(role, openingStyle, opts.durationTarget) }] : []),
      // TASK v3.33 Part C — per-song progression override when the quota plan
      // is active; channelParts' flat whole-pack moneyChord atom is filtered
      // out above for exactly this case, so there's never a duplicate.
      // TASK v4.8 (TASK A, §1-2) — includeFeelReinforcement dropped to its
      // default (false): a `shortForm`-only fix doesn't help here, since
      // composeStylePrompt's shortForm compression stage only fires once
      // the RAW prompt already exceeds the hard 1000-char SUNO_COPY_LIMIT —
      // a real measured pack sat at 831-998 chars, comfortably under that
      // trigger on every song, so shortForm was silently never activating.
      // The audibleEffect half ("- chorus lifts noticeably higher than the
      // verse and lands with a soft ache", 10-17 words) is now dropped from
      // the DEFAULT text outright — moneyChordPresets.ts's own
      // compactProgression field (2-6 words) already carries the harmonic
      // identity that matters; audibleEffect was decorative prose Suno
      // reads as tags, not sentences, per this file's own established
      // "Suno responds to descriptors, not paragraphs" convention.
      ...(progressionPlan
        ? [{ id: 'moneyChord' as const, text: compactMoneyChord(opts, { moneyChordIdOverride: progressionPlan[idx] }) }]
        : channelParts.some(part => part.id === 'moneyChord')
          ? []
          : [{ id: 'moneyChord' as const, text: compactMoneyChord(opts) }]),
      // TASK v3.38 Part B2 — per-song vocal-type override when the kids
      // quota plan is active; this 'vocal' id is in promptBudget.ts's
      // ESSENTIAL_TERM_IDS, so it's never trimmed away like the whole-pack
      // vocal atom it replaces.
      //
      // TASK v3.58 (TASK 4) — a single audience-profile constraint (vocal
      // register/diction/mix character, see types.ts's AudienceProfile) is
      // appended here rather than left in the non-essential 'mood' atom it
      // was first tried in: 'mood' sits at a low priority position and
      // measured as low as 6/18 songs actually keeping it under real budget
      // pressure — the exact opposite of "applies unconditionally to every
      // song" this profile exists to guarantee. 'vocal' is essential and
      // never dropped, so this is a reliable home. Only the single most
      // load-bearing constraint (constraints[0]) is added here, not the
      // whole list — appending all of them measurably raised cross-genre
      // style similarity (shared essential text is identical regardless of
      // genre) past this app's own 0.35 jazz-vs-adult-contemporary
      // regression threshold, and squeezed out earwormMode's/genreNarrative's
      // own budget. The rest of the profile's constraints still apply via
      // excludePrompt's exclusions (see promptComposer.ts's
      // buildExcludePrompt) even though only one constraint phrase makes it
      // into the Style field itself. vocalDescriptionText itself
      // (unmodified) still drives the lyrics' vocal-meta-tag/gender
      // resolution above — only this style-prompt-facing copy gets the
      // extra atom.
      // v3.80 (TASK E) — vocalTechniquePlan[idx] inserted between the
      // register/delivery wording and the audience constraint, matching
      // this task's own "vocal technique 는 보컬 묘사와 나란히" placement —
      // 'vocal' is ESSENTIAL_TERM_IDS (promptBudget.ts), so the technique
      // phrase is never budget-dropped like a new non-essential atom id
      // would risk being. Only added when adultVocalTraitPlan[idx] is the
      // text actually in use (guarded by the same adultVocalTraitPlan?.[idx]
      // presence check as vocalDescriptionText's own composition above) —
      // never appended onto a user's own verbatim vocalTone text
      // (explicitUnrecognizedVocalTone's fallback branch), which must stay
      // untouched per v3.77 TASK A's "vocalTone을 무시하지 말 것".
      // v4.4 (TASK F) — 'vocal' is ESSENTIAL_TERM_IDS (promptBudget.ts), so it
      // is never dropped, but essential atoms are only ever SHRUNK via an
      // authored shortForm (promptBudget.ts's compressHardLimitWithGuard
      // stage 1) — without one there was nothing for compression to grab,
      // and the v3.80 technique phrase pushed real packs to 651-879 chars
      // against a 350-650 target. shortForm drops only the technique phrase
      // (reference color), NOT audienceProfile.constraints[0] — an earlier
      // version of this fix dropped the constraint too, which broke
      // tests/audienceProfile.test.ts's "every song weaves in at least one
      // senior audience constraint" guarantee for any song that actually
      // hit stage-1 compression; the constraint is load-bearing, the
      // technique phrase is not.
      // v4.4 (TASK F) — 'vocal' is ESSENTIAL_TERM_IDS (promptBudget.ts), so it
      // is never dropped, but essential atoms are only ever SHRUNK via an
      // authored shortForm (promptBudget.ts's compressHardLimitWithGuard
      // stage 1) — without one there was nothing for compression to grab,
      // and the v3.80 technique phrase pushed real packs to 651-879 chars
      // against a 350-650 target. shortForm keeps audienceProfile.constraints[0]
      // (load-bearing — tests/audienceProfile.test.ts requires it on every
      // song) and drops the technique phrase entirely; composeStylePrompt's
      // own shortAtomsById caps ANY id's short-form atom count at 3
      // (.slice(0,3)), so vocalDescriptionText itself is trimmed to its
      // first 2 comma-segments here to leave room for the constraint as the
      // 3rd — an earlier version of this fix appended the constraint as a
      // 4th atom and it silently got sliced off for any track whose
      // pre-compression prompt happened to cross the hard limit.
      {
        id: 'vocal' as const,
        text: [vocalDescriptionText, adultVocalTraitPlan?.[idx] ? vocalTechniquePlan?.[idx] : undefined, audienceProfile.constraints[0]].filter(Boolean).join(', '),
        // TASK v4.7 (TASK A) — a real generated pack found this shortForm's
        // blind "first 2 segments" slice dropping v3.80's own flagship
        // proximity override (tracks 2-3's forced 'soft plate ambience'/
        // 'chamber ambience') once channelSoundFloor.requiredAtoms' extra
        // ~90 chars pushed that track's raw prompt just past SUNO_COPY_LIMIT
        // for the first time — the override was never actually protected
        // from this pre-existing v4.4 shortForm, only lucky not to collide
        // with it before. When this track's own flagshipProximityOverride
        // value is present in vocalDescriptionText, keep it explicitly
        // instead of whichever 2 segments happened to come first.
        //
        // TASK v4.7 (팔레트 커버리지 확장) — same collision hit a second, wider
        // target once palette coverage rose to ~97%: `npm run audit`'s own
        // "여성 곡의 female 명시" (explicit "female" word in every female-typed
        // song) regressed 100%->67%, because segment 0 doesn't always carry
        // the gender word (some vocalDescriptionFor phrasings put it later)
        // and the blind 2-segment slice could drop it just like it dropped
        // the proximity clause. Now also keeps the first segment containing
        // a gender word explicitly, alongside segment 0 and any flagship
        // clause, rather than assuming position 0 always has it.
        shortForm: (() => {
          const segments = vocalDescriptionText.split(',').map(s => s.trim());
          const flagshipCandidates: string[] | undefined = (flagshipProximityOverride as Record<number, string[]> | undefined)?.[idx];
          const flagshipClause = flagshipCandidates?.find(value => segments.includes(value));
          const genderClause = segments.find(segment => {
            const presence = detectVocalGenderPresence(segment);
            return presence.male || presence.female;
          });
          // composeStylePrompt caps any id's shortForm atom list at 3 total
          // (shortAtomsById's own .slice(0,3)) and the constraint below MUST
          // survive (load-bearing, tests/audienceProfile.test.ts requires
          // it on every song) — so at most 2 of these 3 candidates can be
          // kept here, gender/flagship prioritized over the plain segment-0
          // fallback since those are the two that have actually been found
          // silently dropped.
          const priority = [genderClause, flagshipClause, segments[0]].filter((value, i, arr): value is string => Boolean(value) && arr.indexOf(value) === i);
          const kept = priority.slice(0, 2);
          return [kept.join(', '), audienceProfile.constraints[0]].filter(Boolean).join(', ');
        })()
      },
      ...(hookDeviceText ? [{ id: 'hookDevice' as const, text: hookDeviceText }] : []),
      // TASK v3.59 (TASK D-1) — see the other composeStylePrompt call's own
      // comment above; same "no instrumental intro" vs. introTexture
      // contradiction, same fix.
      ...(introTextureText && !coldOpenHasNoInstrumentalIntro(role, openingStyle) ? [{ id: 'introTexture' as const, text: introTextureText }] : []),
      // TASK v3.42 Part A1 — always overrides channelParts' flat whole-pack
      // instruments atom (filtered out above) with a per-song rotated
      // anchor+1-2 combination; see promptComposer.ts's rotatingInstrumentText.
      { id: 'instruments' as const, text: rotatingInstrumentText(trackGenres, seed, idx) },
      // TASK v3.42 Part A3 — sparse/medium/full rotation.
      { id: 'arrangementDensity' as const, text: ARRANGEMENT_DENSITY_TEXT_BY_LEVEL[arrangementDensityPlan[idx]] },
      { id: 'hook', text: hookStyleDirectives(hookPhrase, opts.lyricDepth) },
      { id: 'tempo', text: `${tempo} BPM` },
      { id: 'songRole', text: `track ${trackNo} role: ${role}` },
      { id: 'motif', text: lyricThemeText ? `lyric scene: ${lyricThemeText}` : `use recurring playlist motif: ${packMotif.english}` },
      { id: 'listenerScene', text: lyricThemeText ? `listener scene: ${lyricThemeText}; supporting detail: ${situation}` : `listener scene: ${situation}` },
      {
        id: 'mixNotes',
        text: [
          generationPack?.tempoBias,
          sectionStyle ? `verse style: ${sectionStyle.verseStyleText}; chorus style: ${sectionStyle.chorusStyleText}` : null,
          wantsFinalChorusModulation(role) ? 'modulate up a half step for the final chorus' : null,
          'same channel vocal signature and mix balance across the full playlist set'
        ].filter(Boolean).join(', ')
      }
    ];
    const composed = opts.personaMode
      ? composePersonaSongStylePrompt({
        blueprint: signatureBlueprint,
        opts,
        genres,
        hookPhrase,
        trackNo,
        role,
        tempo,
        openingStyle,
        styleLimitValue: resolvePersonaTrackLimit(styleLimit, trackNo)
      })
      // v4.4 (TASK F) — tried lowering safeTarget (3rd arg) toward
      // STYLE_CHAR_TARGET (450) to bring prompt length into fullAudit's
      // 350-650 target (was 651-879, styleLimitValue used for both limit
      // and safeTarget so the soft-fill loop never stopped short of the
      // ~1000-char hard ceiling). Real measurement found a genuine
      // tradeoff: tightening safeTarget crowds out the non-essential
      // genre/mood/instrument atoms that keep different genres' style
      // prompts distinct, and tests/promptBudgetLoopGuard.test.ts's own
      // jazz-pop vs adult-contemporary similarity guard (< 0.35) started
      // failing (0.36) once safeTarget dropped below ~750-800 — at which
      // point prompt length barely moves (still ~800+ at the ceiling,
      // nowhere near 650). Left as styleLimitValue (no behavior change)
      // rather than trade a real cross-genre-distinctness regression for a
      // soft length target — see docs/v440-report.md TASK F for the full
      // finding. The 'vocal' atom's own new shortForm (see its own doc
      // comment above) is kept: it only ever activates near the true hard
      // limit, so it helps in that case without this tradeoff.
      : composeStylePrompt(
        songParts,
        styleLimitValue,
        styleLimitValue,
        promptPriorityForTrack(idx),
        idx
      );
    const stylePrompt = enforceSingleBpmText(composed.prompt, tempo);
    const promptWarnings = warningsForComposedPrompt(composed, opts.personaMode ? resolvePersonaTrackLimit(styleLimit, trackNo) : styleLimitValue);
    const partialSong = {
      trackNo,
      title,
      seasonMoment: season.label,
      listenerSituation: listenerScene,
      emotionArc: lyricThemeArc || emotionArc,
      hookPhrase
    };
    const youtube = buildYoutubeMetadata(opts, partialSong, genres, moods, season);
    // v4.3 (TASK A) — 곡 제목의 이중언어 표시. english 패키징이면 undefined
    // (표시하지 않음). See core/titleLocalization.ts's own doc comment.
    const titleLocalized = buildLocalizedTitle(
      packagingLanguageForTitles,
      {
        emotionArc: partialSong.emotionArc,
        listenerSituation: partialSong.listenerSituation,
        arcPhase: arcPlan[idx]?.phase,
        eraTag: trackGenres[0]?.eraTag,
        archetype: opts.channel.archetype,
        seed: localizedTitleSeed(seedBase, trackNo)
      },
      usedLocalizedTitles
    );
    const titleDisplay = buildTitleDisplay(title, titleLocalized);

    return {
      ...partialSong,
      stylePrompt,
      excludePrompt,
      songRole: role,
      openingStyle,
      lyrics,
      thumbnailText: youtube.thumbnailText,
      youtube,
      youtubeTitleKo: `${title} | ${season.label} ${opts.channel.name} 플레이리스트`,
      youtubeTitleJa: `${title} | ${season.label} ${opts.channel.name} プレイリスト`,
      ...(titleLocalized ? { titleLocalized, titleDisplay } : {}),
      qualityScore: 0,
      warnings: promptWarnings,
      promptLength: stylePrompt.length,
      promptWithinLimit: stylePrompt.length <= styleLimitValue,
      promptDroppedTerms: composed.droppedTerms,
      promptWordCount: countWords(stylePrompt),
      promptWithinWordTarget: countWords(stylePrompt) <= STYLE_WORD_TARGET_MAX,
      lyricTheme: lyricThemeId,
      ...(genreId ? { genreId } : {}),
      ...(genreText ? { genreText } : {}),
      ...(lyricThemeText ? { lyricThemeText } : {}),
      ...(lyricThemeArc ? { lyricThemeArc } : {}),
      ...(lyricTheme?.motionKo ? { lyricThemeMotionKo: lyricTheme.motionKo } : {}),
      ...(lyricTheme?.castKo ? { lyricThemeCastKo: lyricTheme.castKo } : {}),
      ...(lyricTheme?.eraSettingKo ? { lyricThemeEraSettingKo: lyricTheme.eraSettingKo } : {}),
      // v4.5 (TASK C) — mirrors batchPreallocation.ts's identical field.
      vocabularyBankId: sceneVocabularyBank.id,
      pov: povPlan[idx],
      ...(sectionStyle ? sectionStyle : {}),
      vocalType,
      // TASK v3.68 (TASK A) — assigned once, here, at generation time.
      songId: generateSongId(seedBase, trackNo),
      // TASK v3.68 (TASK B) — snapshot fields for rating analysis
      // (core/ratingLedger.ts); mirrors the genreId/genreText pattern above.
      ...(trackGenres[0]?.eraTag ? { eraTag: trackGenres[0].eraTag } : {}),
      ...(killingPoint ? { killingPointId: killingPoint.id } : {}),
      arcPhase: arcPlan[idx].phase,
      intensity: arcPlan[idx].intensity,
      bpm: tempo,
      ...(structureTemplatePlan[idx] ? { structureTemplate: structureTemplatePlan[idx] } : {}),
      ...(progressionPlan?.[idx] ? { moneyChordId: progressionPlan[idx] } : {}),
      ...(earwormTextForTrack ? { earwormText: earwormTextForTrack } : {}),
      ...(lyricThemeId ? { lyricFrameId: lyricTheme?.frameId ?? 'solitary-object' } : {})
    };
  });

  return {
    projectTitle: opts.projectTitle,
    channelName: opts.channel.name,
    oneLineConcept: concept,
    sonicSignature: `${genres.map(g => g.label).join(' + ')} / ${moods.map(m => m.label).join(' + ')}`,
    vocalSignature: opts.vocalTone || opts.channel.defaultVocal,
    lyricRules: [
      'original lyrics only',
      'short 2-5 word hook that bookends and repeats through every chorus',
      'consistent recurring motif without repeated lines',
      'Suno section tags included',
      generationPack?.audienceNote || 'audience-safe language'
    ],
    harmonyRules: [
      'money chords enabled by default',
      'emotional chorus lift',
      'gentle maj7/add9 color when appropriate',
      'no direct reference to existing songs'
    ],
    visualRules: [
      season.visualDirection,
      opts.channel.visualIdentity,
      generationPack?.youtubeAngle || 'playlist-friendly thumbnail angle',
      'large readable title typography'
    ],
    // TASK v3.39.1 Part H5 — scoreSongs previously only ran on the
    // realtime/Batch API/bridge paths (each wired it in separately at their
    // own call sites), so a purely local-generation pack always shipped with
    // qualityScore: 0 and warnings: [] — not because it was flawless, but
    // because nothing had actually checked it. Same gate every other path
    // already runs through.
    // TASK v3.60 (TASK B) — normalizeSongOutput (songPostProcess.ts) is a
    // no-op here in practice (this path never produces the labels/leaks it
    // guards against) but runs unconditionally so the local and bridge paths
    // share one normalization pass instead of only the bridge having it.
    songs: scoreSongs(songs.map(song => normalizeSongOutput(song)), opts.channel, opts.lyricLanguage),
    generatedAt: new Date().toISOString()
  };
}
