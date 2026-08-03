import type { GenerationOptions, GenrePack, PreassignedSongSlot, SongIdea } from '../types';
import { buildStructureTemplatePlan, createTitleGenerator, hashSeed, seedForBlueprint, STRUCTURE_TEMPLATE_MARKER_TAG } from './lyricEngine';
import { averageTempo, emotionArcPlanForArc, nextContestedTitle, songRolePlanForArc } from './localGenerator';
import { buildTempoBandPlan } from './tempoPlan';
import { audienceProfileForAgeGroup, tempoBandsForProfile } from '../data/audienceProfiles';
import { ARRANGEMENT_DENSITY_TEXT_BY_LEVEL, arrangementDensityLevel, arrangementNarrativeForGenres, buildExcludePrompt, rotatingEarwormText, rotatingGenreText, rotatingInstrumentSet } from './promptComposer';
import { compactMoneyChord } from './soundSignature';
import { buildProgressionPlan, usesMoneyChordQuota } from './moneyChordPlan';
import {
  applyDuetSectionVocalTags,
  applyFlagshipVocalOrder,
  buildAdultVocalTraitPlan,
  buildVocalPlan,
  buildVocalTechniquePlan,
  buildVocalVariantPlan,
  DEFAULT_ADULT_VOCAL_QUOTA,
  DEFAULT_KIDS_VOCAL_QUOTA,
  ensureVocalMetaTag,
  enforceVocalTextInStylePrompt,
  leaningAdultVocalQuota,
  leaningGenderFor,
  resolveFlagshipVocalOrder,
  resolveVocalMetaTag,
  usesVocalQuota,
  vocalDescriptionFor,
  type VocalGender,
  type VocalType
} from './vocalPlan';
import { matchVocalPreset } from '../data/vocalPresets';
import { eraBucketForGenreId } from '../data/eraExclusions';
import { PROXIMITY_POOL } from '../data/vocalTraits';
import { buildHookDevicePlan, hookDeviceIdsForNarrative } from './hookDevicePlan';
import { getHookDeviceById, hookDevices } from '../data/hookDevices';
import type { OpeningPackContext } from './openingContest';
import { mergeNegativeStyleText, stripNegativeStyleFromStylePrompt } from '../data/negativeStyles';
import { buildIntroTexturePlan, introTextureTagForId } from './introTexturePlan';
import { buildIntroModePlan, reconcileIntroModeWithStructureTemplate } from './introModePlan';
import { enforceSingleBpmText } from './bpmDedupe';
import { introTexturesForArchetype } from '../data/introTextures';
import { applyGenreVocalAffinity } from './vocalGenreAffinity';
import {
  ADULT_STRUCTURE_TEMPLATE_IDS,
  applyAxisAllocation,
  allocationForAxis,
  ARRANGEMENT_DENSITY_IDS,
  KIDS_STRUCTURE_TEMPLATE_IDS,
  VOCAL_TYPE_IDS
} from './diversityAllocation';
import { buildLyricThemePlan, buildPovPlan, buildSectionStylePlan, lyricThemeForSlot } from './lyricDiversityPlan';
import { buildGenreCountRotationPlan, buildGenreRotationPlan, genresForTrack } from './genreRotation';
import { conceptLyricImages, conceptStyleText, variedVocalText } from './conceptDiversity';
import { breakLongRuns, buildArcPlan, pinPrefixPreservingCounts, reorderByArcIntensity } from './arcPlan';
import { assignKillingPoints, killingPointBoostFromInsights } from '../data/killingPoints';
import { resolveConstraintsFromOptions } from './constraints';
import { resolveBpmLengthTier, estimateSongLengthSec } from './bpmLengthControl';
import { applyVerifiedComboToGenrePlan, resolveFlagshipCombo } from './verifiedCombos';
import type { VerifiedCombo } from '../data/verifiedCombos';
import { vocabularyBankForScene } from '../data/vocabularyBanks';

export type { PreassignedSongSlot };

function appendGenreAutoRemainder(manualPlan: string[], autoPlan: string[], songCount: number): string[] {
  const plan = [...manualPlan];
  const autoPoolSize = new Set(autoPlan).size;
  let cursor = 0;
  while (plan.length < songCount && cursor < autoPlan.length * 2) {
    const candidate = autoPlan[cursor % autoPlan.length];
    cursor += 1;
    if (autoPoolSize > 1 && candidate === plan[plan.length - 1]) continue;
    plan.push(candidate);
  }
  return plan.length < songCount
    ? [...plan, ...autoPlan.slice(0, songCount - plan.length)]
    : plan;
}

/**
 * TASK B2 (v3.6) — parallel Anthropic Message Batch requests run with no
 * visibility into each other (see providers/batchAnthropic.ts's known
 * limitation note), so two sub-batches submitted together can independently
 * invent the same title or hook. The fix is to never let a batch invent a
 * title/hook at all: every trackNo's title, hook, song role, tempo, and
 * emotion arc is decided locally, up front, with the exact same
 * (avoid-list-aware, hookLedger-informed) generator the local engine itself
 * uses — then handed to every sub-batch as a fixed assignment. Batches only
 * write lyrics/stylePrompt/situations for the trackNos they own; they can no
 * longer collide on identity because they never choose it.
 */
export function preallocateSongSlots(
  opts: Pick<GenerationOptions, 'channel' | 'projectTitle' | 'lyricLanguage' | 'songCount' | 'genreIds' | 'moodIds' | 'moneyChordMode' | 'customMoneyChord' | 'earwormMode' | 'vocalQuota' | 'vocalTone' | 'avoidWords' | 'negativeStyle' | 'introUniqueness' | 'diversityAllocations' | 'perspective' | 'customLyricThemeScene' | 'customConcept' | 'genreBlendWeights' | 'audience' | 'ratingInsights'>,
  genres: GenrePack[],
  // TASK v3.72 (TASK E) — recentVocalComboSignatures is optional and
  // additive: core/vocalComboLedger.ts's last few "M:<register>|F:<register>"
  // signatures for this channel, pre-fetched by the caller (this function
  // stays a pure sync function — no IndexedDB access here). Softly
  // deprioritizes those exact registers in buildAdultVocalTraitPlan; never
  // required, never blocking.
  // v3.80 (TASK A-3) — previousFlagshipOrder is core/recentFlagshipOrderStore.ts's
  // last-remembered tracks-1-3 vocal-type order for this channel, pre-read
  // by the caller (same "core stays sync/pure, caller owns storage" split
  // as recentVocalComboSignatures above). resolveFlagshipVocalOrder falls
  // back to a plain seed-picked order when this is absent (e.g. a channel's
  // first ever generation).
  avoid?: {
    usedTitles?: string[];
    usedHooks?: string[];
    recentVocalComboSignatures?: string[];
    previousFlagshipOrder?: VocalType[];
    /**
     * v3.82 (TASK A) — already workspace-scoped + seed-merged (see
     * core/verifiedCombos.ts's effectiveVerifiedCombos), pre-fetched by the
     * caller (providers/index.ts) — same "core stays sync/pure, caller owns
     * IndexedDB" split as recentVocalComboSignatures/previousFlagshipOrder
     * above. Consulted only for the flagship (track 2) slot — see this
     * function's own flagshipCombo local below.
     */
    verifiedCombos?: VerifiedCombo[];
  }
): PreassignedSongSlot[] {
  const seedBase = seedForBlueprint(opts);
  const seed = hashSeed(seedBase);
  // TASK v3.67 (TASK C) — same arc-intensity reorder as localGenerator.ts's
  // generateLocalBlueprint (see arcPlan.ts's own doc comment: reorders,
  // never recomputes, buildTempoBandPlan's own output).
  const arcPlan = buildArcPlan(opts.songCount);
  // TASK v3.67 (TASK D) — phase-aware emotion-arc shape per track, mirroring
  // localGenerator.ts's own emotionArcPlanForArc call (same seed).
  const emotionArcPlan = emotionArcPlanForArc(arcPlan, seed + 22);
  // TASK v3.60 (TASK C) — this pre-pass feeds the realtime/Batch/bridge
  // paths (this whole function's own docstring), which measured BPM 96-104
  // (stddev ~2.2) on a real bridge pack because averageTempo() was still
  // called with only 2 args here, skipping the v3.58 TASK 4 tempo-band
  // system entirely (see averageTempo's own `if (!band) return
  // fallbackCenter` short-circuit in localGenerator.ts). Mirrors
  // localGenerator.ts's own generateLocalBlueprint pre-pass exactly (same
  // seed) so the bridge/Batch path's BPM spread matches the local path's.
  const audienceProfile = audienceProfileForAgeGroup(opts.audience);
  // v4.2 (TASK A3) — mirrors localGenerator.ts's own generateLocalBlueprint:
  // one ResolvedConstraints instance feeding this path's own title generation.
  const constraints = resolveConstraintsFromOptions(opts, audienceProfile);
  const nextTitle = createTitleGenerator(opts.lyricLanguage, seedBase, opts.songCount, avoid, opts.channel.archetype, constraints);
  const tempoBands = tempoBandsForProfile(audienceProfile);
  const tempoBandPlan = tempoBands ? reorderByArcIntensity(buildTempoBandPlan(tempoBands, opts.songCount, seed), arcPlan, band => band.low) : [];
  // TASK I2 (v3.11) — the Batch API path is local-then-submit (this whole
  // function's point per its own docstring), so tracks 1-3 get the same
  // local k=3 contest the synchronous path uses, not a plain single-hook pick.
  const packContext: OpeningPackContext = { dominantGenreIds: opts.genreIds ?? [], dominantMoodIds: opts.moodIds ?? [] };
  const genrePool = Array.from(new Set((opts.genreIds ?? genres.map(genre => genre.id)).filter(Boolean)));
  const autoGenrePlan = buildGenreRotationPlan(genrePool, opts.songCount, seed);
  const genreAllocation = allocationForAxis(opts.diversityAllocations, 'genre');
  const manualGenrePlan = genreAllocation?.mode === 'manual'
    ? buildGenreCountRotationPlan(genreAllocation.counts, genrePool, opts.songCount, seed)
    : [];
  const genrePlan = manualGenrePlan.length
    ? appendGenreAutoRemainder(manualGenrePlan, autoGenrePlan, opts.songCount)
    : autoGenrePlan;
  // v3.82 (TASK A) — flagship (track 2, idx=1) genre override from a
  // verified-good combo (see core/verifiedCombos.ts's own doc comment: a
  // real listening-confirmed genre+BPM pairing, e.g. "philly-soul-sweet at
  // 81 BPM", every one of T1/T4/T7 scored good). Only track 2 today, since
  // the registry currently holds exactly one qualifying combo; a second
  // approved combo would naturally have room to also fill track 3 later —
  // this override just applies whatever the registry currently offers,
  // never invents a second one. Swaps with another (non-flagship, idx>=3)
  // track already carrying that genre id when one exists, so the overall
  // genre-count distribution genreIssues (designGate.ts) checks stays
  // intact; falls back to a direct overwrite (a single-track perturbation)
  // only when no such swap candidate exists.
  const flagshipCombo = opts.songCount >= 3 ? resolveFlagshipCombo(avoid?.verifiedCombos ?? [], genrePool) : undefined;
  // TASK v4.6 (TASK B) — expands the old single-track (idx 1 only) override
  // into "세트 전체 최소 2곡, 최대 5곡" — see verifiedCombos.ts's own doc comment.
  applyVerifiedComboToGenrePlan(genrePlan, flagshipCombo);
  const flagshipComboTempo = flagshipCombo
    ? Math.round((flagshipCombo.bpmRange[0] + flagshipCombo.bpmRange[1]) / 2)
    : undefined;
  // TASK v3.67 (TASK A) — one killing point per track (undefined for
  // peakStrength 'none'), matched against this track's own lead genre's
  // eraTag — mirrors localGenerator.ts's own killingPointPlan pre-pass
  // (same seed offset).
  // v3.80 (TASK A-1) — track 2 (idx 1) is a flagship slot and this task's
  // spec requires it to always carry a killing point; buildArcPlan's own
  // 'opening' phase leaves idx 0/1 at peakStrength 'none' and only idx 2
  // 'subtle' (the edge-toward-lift track), so trackNo 2 never got one
  // without this override. trackNo 1 (idx 0, cold-open) is deliberately
  // left untouched — the spec explicitly keeps its existing no-killing-point
  // arc-opening behavior.
  const arcPlanForKillingPoints = opts.songCount >= 2
    ? arcPlan.map((pos, idx) => (idx === 1 && pos.peakStrength === 'none' ? { ...pos, peakStrength: 'subtle' as const } : pos))
    : arcPlan;
  const killingPointPlan = assignKillingPoints(
    arcPlanForKillingPoints.map((pos, idx) => ({
      peakStrength: pos.peakStrength,
      eraTag: genresForTrack(genres, genrePlan[idx], opts.genreBlendWeights)[0]?.eraTag
    })),
    seed + 67,
    killingPointBoostFromInsights(opts.ratingInsights)
  );

  // TASK v3.33 Part C — mirrors localGenerator.ts's own pre-pass exactly
  // (same roles, same seed) so the realtime/Batch/bridge paths that call
  // this function agree with the local path on every trackNo's progression.
  // v4.4 (TASK D) — songRolePlanForArc (phase-aware), same seed+24 offset
  // localGenerator.ts now uses — the old flat resolveSongRole(idx+1, idx)
  // array clamped every track past 12 to 'comforting closer' (a real
  // 18-song pack measured 7 tracks with that identical role); this path
  // had the exact same bug since it called the same function.
  const songRoles = songRolePlanForArc(arcPlan, seed + 24);
  const introModePlan = buildIntroModePlan(opts.songCount, seed);
  const progressionPlan = usesMoneyChordQuota(opts) ? buildProgressionPlan(opts.channel.archetype, seed, songRoles) : null;
  // TASK v3.39 — mirrors progressionPlan immediately above: same pre-pass
  // shape, same seed, so this path (realtime/Batch/bridge) agrees with
  // localGenerator.ts's own buildVocalPlan call on every trackNo's vocal
  // type for the same opts.
  // TASK v3.72 (TASK A) — usesVocalQuota now defaults true for every
  // archetype (see vocalPlan.ts's own doc comment for the regression this
  // fixes); the quota itself still differs by archetype — kids keeps
  // DEFAULT_KIDS_VOCAL_QUOTA, every other archetype falls back to
  // DEFAULT_ADULT_VOCAL_QUOTA (same 6/6/6 shape, 'mixed' means duet here).
  // v3.77 (TASK A) — usesVocalQuota() is now unconditionally true; a
  // user's actual vocalTone pick (when it differs from the channel's own
  // default) now LEANS the quota toward that gender instead of replacing
  // per-song variety with one fixed string (see vocalPlan.ts's own
  // leaningGenderFor/leaningAdultVocalQuota doc comments). Skipped for
  // kids (its own quota system) and whenever the caller supplied an
  // explicit opts.vocalQuota override, which always wins outright.
  const baseVocalQuota = opts.vocalQuota ?? (opts.channel.archetype === 'kids' ? DEFAULT_KIDS_VOCAL_QUOTA : DEFAULT_ADULT_VOCAL_QUOTA);
  const vocalLeaning = opts.channel.archetype === 'kids' || opts.vocalQuota ? undefined : leaningGenderFor(opts);
  const resolvedVocalQuota = vocalLeaning ? leaningAdultVocalQuota(baseVocalQuota, opts.songCount, vocalLeaning) : baseVocalQuota;
  // v3.77 (TASK A) — leaningGenderFor only recognizes a known preset or a
  // literal gender word; a genuinely custom vocalTone with neither (e.g. a
  // hand-written description, or extreme/free-form text) still differs from
  // the channel's default but produces no leaning at all. Without this
  // guard, buildAdultVocalTraitPlan below would silently replace that text
  // with its own generic composed register wording on every track — exactly
  // the "vocalTone을 무시하지 말 것" this task's own spec prohibits, just
  // triggered by an undetectable gender instead of a detectable one. When
  // this is true, adultVocalTraitPlan is skipped so vocalText falls back to
  // fallbackVocalText (the user's own text, verbatim) below; vocalType is
  // still assigned from the (unleaned) base quota, so type diversity is
  // unaffected — only the WORDING stays the user's own.
  const explicitUnrecognizedVocalTone = opts.channel.archetype !== 'kids' && !opts.vocalQuota && !vocalLeaning
    && Boolean(opts.vocalTone?.trim()) && opts.vocalTone!.trim() !== opts.channel.defaultVocal;
  const autoVocalPlan = usesVocalQuota(opts)
    ? buildVocalPlan(resolvedVocalQuota, opts.songCount, seed)
    : null;
  let vocalPlan = autoVocalPlan
    ? applyAxisAllocation(autoVocalPlan, opts.diversityAllocations, 'vocalType', VOCAL_TYPE_IDS, seed)
    : null;
  // v3.80 (TASK A-3) — tracks 1-3 (flagship slots) get 3 distinct vocal
  // types, rotating order set-to-set (never repeating the immediately prior
  // set's own order — see recentFlagshipOrderStore.ts/resolveFlagshipVocalOrder's
  // own doc comment). Applied after applyAxisAllocation so it wins over
  // whatever type order the auto quota OR a manual 8-axis vocalType
  // allocation produced, without disturbing either one's overall counts —
  // 'manual' here only ever fixes TOTALS (setDirector.ts's directSetLocal
  // always sets vocalType to 'manual' with its own default 6/6/6 counts;
  // per-position order is still algorithmic either way, so pinning
  // positions 0-2 never overrides anything a user actually hand-picked).
  // Data-driven guard instead of a manual/auto check: only pins when the
  // plan already contains all 3 types somewhere — an opts.vocalQuota
  // override that's deliberately all-one-type (e.g.
  // tests/lyricBodyFidelity.test.ts's all-duet/all-solo quotas) naturally
  // fails this and is left untouched, without needing to special-case
  // vocalQuota separately. Also skipped whenever vocalLeaning is set — a
  // user's own vocalTone pick (e.g. a duet preset) is a real preference
  // signal (see leaningGenderFor's own doc comment) that this task's
  // "rotate, don't always pin one type" rule must not override; the
  // rotation only applies to the balanced, no-preference default (see
  // tests/v341.test.ts's own "reconcileWithPreassignedSlot enforces a duet
  // end-to-end" — a real regression this guard fixes).
  const vocalPlanHasAllThreeTypes = vocalPlan ? new Set(vocalPlan).size === 3 : false;
  const flagshipVocalOrder = vocalPlan && opts.songCount >= 3 && vocalPlanHasAllThreeTypes && !vocalLeaning
    ? resolveFlagshipVocalOrder(seed, avoid?.previousFlagshipOrder)
    : null;
  if (vocalPlan && flagshipVocalOrder) {
    vocalPlan = applyFlagshipVocalOrder(vocalPlan, flagshipVocalOrder);
  }
  // v3.82 (TASK A) — flagshipCombo.vocalType is undefined for the app's own
  // current registry entry (T7 itself proved gender doesn't matter for this
  // combo — see verifiedCombos.ts), so this never fires today; kept for a
  // future combo that DOES specify one. Swaps track 2 with another (idx>=3)
  // track already carrying that vocal type, preserving the pack's overall
  // 6/6/6-style type totals — never a blunt overwrite, which could silently
  // break vocalIssues' (designGate.ts) own count checks.
  if (vocalPlan && flagshipCombo?.vocalType && vocalPlan[1] !== flagshipCombo.vocalType) {
    const swapIndex = vocalPlan.findIndex((type, i) => i >= 3 && type === flagshipCombo.vocalType);
    if (swapIndex !== -1) {
      const tmp = vocalPlan[1];
      vocalPlan[1] = vocalPlan[swapIndex];
      vocalPlan[swapIndex] = tmp;
    }
  }
  // TASK v4.9 (TASK B, §2-3) — mirrors core/localGenerator.ts's identical
  // genre-vocalType affinity pass (same reasoning: "재즈는 남녀 상관없이 약함.
  // 재즈 = 무조건 여자") so the local and Batch/bridge paths agree on which
  // genre lands on which already-allocated vocalType, not just the raw
  // 6/6/6-style totals.
  if (vocalPlan && opts.channel.archetype !== 'kids') {
    vocalPlan = applyGenreVocalAffinity(vocalPlan, genrePlan, opts.songCount >= 3 ? 3 : 0);
  }
  // TASK v3.41 Part A2/D — mirrors vocalPlan's pre-pass shape/seed one more
  // step: which of each type's 5 wordings a given trackNo gets, so a 15-song
  // 5/5/5 kids pack no longer reuses one fixed string per type across
  // realtime/Batch/bridge (see vocalPlan.ts's buildVocalVariantPlan). Kids
  // only — the adult path's wording now comes from buildAdultVocalTraitPlan
  // below (TASK v3.72 TASK B), not this flat variant-index scheme.
  const vocalVariantPlan = vocalPlan && opts.channel.archetype === 'kids' ? buildVocalVariantPlan(vocalPlan, seed) : null;
  // TASK v3.72 (TASK B) — the 4-axis (register/delivery/timbre/proximity;
  // pairing/blend for duet) per-song wording plan for every non-kids
  // archetype, replacing the old flat 5-variant ADULT_VOCAL_DESCRIPTIONS
  // lookup that produced only 5 distinct sentences per gender pack-wide.
  // isSenior gates ONLY the register axis's brightest/highest entries
  // (data/vocalTraits.ts's *_PEAK_ONLY_REGISTERS) to a track whose killing
  // point actually relaxes SENIOR_AUDIENCE_PROFILE's 'comfortable mid vocal
  // register' constraint; every other axis stays fully open regardless.
  const isSeniorAudience = audienceProfile.id === 'senior';
  const vocalPeakFlags = killingPointPlan.map(kp => Boolean(kp?.relaxes?.includes('comfortable mid vocal register')));
  // v3.80 (TASK B-2-3) — each track's own lead genre's era bucket, so
  // buildAdultVocalTraitPlan can softly prefer era-signature proximity
  // values (plate/chamber/tape-slap/mono) over today's modern default.
  // Mirrors genrePlan's own indexing exactly (same array, same idx).
  const eraBucketByIndex = genrePlan.map(id => eraBucketForGenreId(id) ?? undefined);
  // v3.80 (TASK E) — mirrors localGenerator.ts's identical technique-plan
  // call (same seed); appended onto vocalText below so it reaches both the
  // local path's stylePrompt and the bridge/Batch path's LLM-facing
  // vocalText verbatim-enforcement.
  const vocalTechniquePlan = opts.channel.archetype !== 'kids' ? buildVocalTechniquePlan(eraBucketByIndex, seed) : null;
  // v3.80 (TASK A-1) — track 1 (cold-open) forced spacious/not-dry (any
  // proximity except the "dry and forward" modern-forward character);
  // tracks 2-3 (flagship) forced to plate/chamber ambience specifically —
  // the exact character real listening feedback singled out as the best
  // track's own proximity. A hard override (proximityFilterFor in
  // vocalPlan.ts honors proximityOverrideByIndex as a strict allow-list),
  // not a soft weight — this task's spec states these three slots as
  // non-negotiable, unlike the era-preference weighting above.
  const flagshipProximityOverride = opts.songCount >= 3
    ? {
        0: PROXIMITY_POOL.filter(value => value !== 'dry and forward'),
        1: ['soft plate ambience', 'chamber ambience'],
        2: ['soft plate ambience', 'chamber ambience']
      }
    : undefined;
  const adultVocalTraitPlan = vocalPlan && opts.channel.archetype !== 'kids' && !explicitUnrecognizedVocalTone
    ? buildAdultVocalTraitPlan(vocalPlan, seed, {
        isSenior: isSeniorAudience,
        peakFlags: vocalPeakFlags,
        // v3.77 (TASK A) — prefer the user's actual vocalTone pick for this
        // generation over the channel's stored default, so "따뜻한 중년
        // 남성" softly biases register/timbre toward THAT character, not
        // whatever the channel was originally set up with.
        channelDefaultVocal: opts.vocalTone?.trim() || opts.channel.defaultVocal,
        recentRegisterSignatures: avoid?.recentVocalComboSignatures,
        eraBucketByIndex,
        proximityOverrideByIndex: flagshipProximityOverride
      })
    : null;
  // TASK v3.39 Part H — every channel (not just kids) now carries a per-song
  // vocalText, so reconcileWithPreassignedSlot below can enforce the
  // selected vocal across realtime/Batch/bridge the same way moneyChordText
  // already enforces the progression. Falls back to the channel's own
  // defaultVocal if this particular request never set vocalTone.
  const fallbackVocalText = opts.vocalTone?.trim() || opts.channel.defaultVocal;
  // TASK v3.41 Part A1 — resolves the explicit gender axis for the non-kids-
  // quota case (a known preset's own `gender`, e.g. 'duet'), computed once
  // since fallbackVocalText is constant across the whole pack. Falls back to
  // undefined (prose detection) when vocalTone/defaultVocal doesn't match
  // any known preset (custom free-text).
  const fallbackVocalGender: VocalGender | undefined = matchVocalPreset(fallbackVocalText)?.gender;
  // TASK v3.42 Part B2 — same pre-pass shape/seed as progressionPlan/
  // vocalPlan above, applied unconditionally (every archetype): replaces the
  // old fixed MONEY_CHORD_FEEL_SUFFIX reinforcement boilerplate with a
  // per-song rotating arrangement-contrast device.
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
  // TASK v3.43 Step 2 (Part A3) — mirrors localGenerator.ts's own
  // structureTemplatePlan pre-pass (same seed), applied unconditionally like
  // hookDevicePlan above, so realtime/Batch/bridge songs get a per-song
  // structure-template id instead of only the local path varying its lyric
  // shape.
  const structureTemplatePlan = applyAxisAllocation(
    buildStructureTemplatePlan(opts.songCount, seed, opts.channel.archetype),
    opts.diversityAllocations,
    'structureTemplate',
    opts.channel.archetype === 'kids' ? KIDS_STRUCTURE_TEMPLATE_IDS : ADULT_STRUCTURE_TEMPLATE_IDS,
    seed
  );
  if (structureTemplatePlan.length) structureTemplatePlan[0] = 'T1';
  // v3.75 (TASK A) — see introModePlan.ts's own doc comment: T2/T5's own
  // template text structurally forbids an instrumental intro, so any track
  // that landed both 'instrumental' (introModePlan, above) and T2/T5 (this
  // structureTemplatePlan) had two contradictory instructions in the same
  // per-track table. Resolved here (after both plans exist) rather than by
  // reordering the two independent buildXPlan calls, keeping each plan's own
  // pre-pass untouched.
  const reconciledIntroModePlan = reconcileIntroModeWithStructureTemplate(introModePlan, structureTemplatePlan);
  // TASK v3.67 (TASK C) — same reorder-not-recompute treatment as
  // localGenerator.ts's own arrangementDensityPlan (peak tracks skew toward
  // 'full', closing toward 'sparse'); no-op when arrangementDensity is
  // manually overridden (applyAxisAllocation returns the manual plan
  // untouched, same as always).
  const arrangementDensityRank: Record<string, number> = { sparse: 0, medium: 1, full: 2 };
  const autoOrManualArrangementDensityPlan = applyAxisAllocation(
    reorderByArcIntensity(
      Array.from({ length: opts.songCount }, (_, idx) => arrangementDensityLevel(seed, idx)),
      arcPlan,
      level => arrangementDensityRank[level]
    ),
    opts.diversityAllocations,
    'arrangementDensity',
    ARRANGEMENT_DENSITY_IDS,
    seed
  );
  // v3.80 (TASK A-1) — flagship slots (tracks 2-3) forced sparse, cold-open
  // (track 1) forced medium (not dry/full), per this task's own explicit
  // per-slot density spec. Re-runs breakLongRuns afterward — pinning 3 of a
  // 6:6:6 split can create a fresh run right at the position-2/3 seam that
  // the pre-pin pass never saw (see arcPlan.ts's own breakLongRuns doc
  // comment). Preserves the overall count split either way
  // (pinPrefixPreservingCounts) — 'manual' here only ever fixes TOTALS
  // (setDirector.ts's directSetLocal always sets arrangementDensity to
  // 'manual' with its own default 6/6/6 counts), so pinning positions 0-2
  // never overrides anything a user actually hand-picked. Data-driven guard
  // instead of a manual/auto check, same reasoning as vocalPlanHasAllThreeTypes
  // above: skips only when the plan doesn't actually contain all 3 levels
  // (e.g. tests/v347step3.test.ts's deliberately narrow `{ full: 3 }`
  // 5-song manual override, whose 2 auto-filled shortfall songs aren't
  // enough to also produce a 'sparse'/'medium' — nothing to legally pin
  // without violating that override's own total).
  const arrangementDensityHasAllThreeLevels = new Set(autoOrManualArrangementDensityPlan).size === 3;
  const arrangementDensityPlan = opts.songCount >= 3 && arrangementDensityHasAllThreeLevels
    ? breakLongRuns(pinPrefixPreservingCounts(autoOrManualArrangementDensityPlan, ['medium', 'sparse', 'sparse'] as const), 2)
    : autoOrManualArrangementDensityPlan;
  const lyricThemePlan = buildLyricThemePlan(opts, seed);
  const povPlan = buildPovPlan(opts, seed);
  const sectionStylePlan = buildSectionStylePlan(opts.songCount, seed, structureTemplatePlan);

  return Array.from({ length: opts.songCount }, (_, idx) => {
    const trackNo = idx + 1;
    const songRole = songRoles[idx];
    const { title, hook } = trackNo <= 3
      ? nextContestedTitle(nextTitle, opts.lyricLanguage, opts.channel.archetype, songRole, songRole === 'cold-open' ? 'cold-open' : 'flagship', packContext, 3, false, constraints)
      : nextTitle(songRole);
    const vocalType = vocalPlan ? vocalPlan[idx] : undefined;
    // v3.80 (TASK E) — appends vocalTechniquePlan[idx] only when
    // adultVocalTraitPlan[idx] is actually the text in use — mirrors
    // localGenerator.ts's identical guard (see its own doc comment): never
    // appended onto a kids description or onto a user's own verbatim
    // vocalTone fallback text.
    const vocalText = vocalType
      ? (opts.channel.archetype === 'kids'
          ? vocalDescriptionFor(vocalType, opts.lyricLanguage, vocalVariantPlan ? vocalVariantPlan[idx] : 0, opts.channel.archetype)
          : (adultVocalTraitPlan?.[idx]
              ? [adultVocalTraitPlan[idx], vocalTechniquePlan?.[idx]].filter(Boolean).join(', ')
              : fallbackVocalText))
      : fallbackVocalText;
    const vocalVariantText = vocalType ? vocalText : undefined;
    const vocalGender: VocalGender | undefined = vocalType
      ? (opts.channel.archetype === 'kids' ? vocalType : (vocalType === 'mixed' ? 'duet' : vocalType))
      : fallbackVocalGender;
    const hookDeviceId = hookDevicePlan[idx];
    const introTextureId = introTexturePlan[idx];
    const moneyChordId = progressionPlan ? progressionPlan[idx] : undefined;
    const hookDeviceText = getHookDeviceById(hookDeviceId)?.prompt;
    const introTextureText = introTextureTagForId(introTextureId);
    const lyricThemeId = lyricThemePlan[idx];
    const lyricTheme = lyricThemeForSlot(lyricThemeId, opts);
    const sectionStyle = sectionStylePlan[idx];
    const genreId = genrePlan[idx];
    const trackGenres = genresForTrack(genres, genreId, opts.genreBlendWeights);
    const resolvedVocalVariantText = vocalVariantText || variedVocalText(fallbackVocalText, idx, trackGenres[0], opts.channel.archetype);
    const genreText = rotatingGenreText(trackGenres, seed, idx);
    const killingPoint = killingPointPlan[idx];
    // TASK v3.67 (TASK B) — this track's own killing point may relax
    // specific audience exclusions for this one song only (see
    // data/killingPoints.ts / promptComposer.ts's buildExcludePrompt, which
    // only ever drops entries actually in the profile's relaxableAtPeak).
    const negativeStyleText = buildExcludePrompt(opts, trackGenres, killingPoint?.relaxes);
    // TASK v3.67 (TASK D follow-up) — mirrors localGenerator.ts's own
    // predictable-cadence nudge: don't hand a relaxed track an earworm
    // phrase that IS the thing it was just given permission to break.
    const earwormTextForTrack = (() => {
      if (!opts.earwormMode) return undefined;
      const text = rotatingEarwormText(seed, idx);
      const relaxesDiatonic = killingPoint?.relaxes.includes('predictable diatonic phrase structure');
      return relaxesDiatonic && /predictable cadence/i.test(text) ? rotatingEarwormText(seed, idx + 1) : text;
    })();
    // v3.82 (TASK A) — flagship (track 2) tempo override from the same
    // verified combo that overrode genreId above; clamped to the audience's
    // own tempoFloor/tempoCeiling so it can never violate bpm-within-profile
    // (designGate.ts's bpmIssues) even if a future combo's bpmRange is wider
    // than this audience profile allows.
    const resolvedTempo = idx === 1 && flagshipComboTempo !== undefined
      ? Math.min(audienceProfile.tempoCeiling, Math.max(audienceProfile.tempoFloor, flagshipComboTempo))
      : averageTempo(trackGenres, trackNo, tempoBandPlan[idx], audienceProfile.tempoFloor, audienceProfile.tempoCeiling);
    // v3.82 (TASK B) — BPM-appropriate section/word/instrumental-section
    // targets for this track (see core/bpmLengthControl.ts's own doc
    // comment for the real-measurement root cause). Flagship slots (tracks
    // 2-3) are additionally hard-capped at 1 instrumental section
    // regardless of tier, per this task's own §3 대표곡 규격 확정 ("악기 구간
    // 최대 1 — T7이 2개여서 4:16이 됐습니다").
    const bpmTier = resolveBpmLengthTier(resolvedTempo);
    const isFlagshipSlot = idx === 1 || idx === 2;
    return {
      trackNo,
      title,
      hookPhrase: hook,
      songRole,
      tempo: resolvedTempo,
      sectionCountRange: bpmTier.sectionRange,
      wordCountRange: bpmTier.wordRange,
      maxInstrumentalSections: isFlagshipSlot ? Math.min(1, bpmTier.maxInstrumentalSections) : bpmTier.maxInstrumentalSections,
      estimatedLengthSec: Math.round(estimateSongLengthSec(resolvedTempo, structureTemplatePlan[idx])),
      emotionArc: emotionArcPlan[idx],
      // TASK v4.8 (TASK A, §1-2) — includeFeelReinforcement dropped to stay
      // consistent with localGenerator.ts's own per-song moneyChord
      // override, which no longer attaches the audibleEffect tail either
      // (see that file's own doc comment); tests/moneyChordPlan.test.ts
      // asserts this batch path and the local path agree per trackNo.
      moneyChordText: compactMoneyChord(opts, { moneyChordIdOverride: moneyChordId }),
        ...(genreId ? { genreId } : {}),
        ...(genreText ? { genreText } : {}),
        ...(trackGenres[0]?.signatureSound ? { signatureSound: trackGenres[0].signatureSound } : {}),
      negativeStyleText,
      ...(introTextureText ? { introTextureText } : {}),
      ...(introTextureId ? { introTextureId } : {}),
      ...(hookDeviceText ? { hookDeviceText } : {}),
      ...(hookDeviceId ? { hookDeviceId } : {}),
      // TASK v3.64-B — mirrors localGenerator.ts's own per-song
      // rotatingEarwormText call (same seed/idx), promoted to a slot field
      // so realtime/Batch/bridge songs get the same per-song melodic-design
      // variety the local path now does, instead of one flat whole-pack
      // phrase (see promptComposer.ts's earwormSystemNote).
      ...(earwormTextForTrack ? { earwormText: earwormTextForTrack } : {}),
      // TASK v3.67 (TASK A) — this track's one designed peak moment,
      // conveyed as intent (see data/killingPoints.ts and
      // core/promptComposer.ts's buildBatchSystemNote /
      // core/bridgeInstruction.ts, both of which treat this as a
      // reference-not-verbatim instruction, never force-injected into
      // stylePrompt). Undefined for a peakStrength 'none' track.
      ...(killingPoint ? { killingPointText: killingPoint.descriptor, killingPointPlacement: killingPoint.placement, killingPointId: killingPoint.id } : {}),
      // TASK v3.68 (TASK B) — snapshot fields for rating analysis
      // (core/ratingLedger.ts).
      ...(trackGenres[0]?.eraTag ? { eraTag: trackGenres[0].eraTag } : {}),
      arcPhase: arcPlan[idx].phase,
      intensity: arcPlan[idx].intensity,
      ...(moneyChordId ? { moneyChordId } : {}),
      // TASK v3.43 Step 2 (Part A3) — mirrors localGenerator.ts's own
      // per-song rotatingInstrumentText/arrangementDensityText calls (same
      // genres/seed/idx), promoted to slot fields for realtime/Batch/bridge
      // parity. Structured (array/enum/id) rather than pre-composed text so
      // the agent instruction/import repair can check and weave each part
      // individually — see types.ts's field comments.
      instrumentSet: rotatingInstrumentSet(trackGenres, seed, idx),
      arrangementDensity: arrangementDensityPlan[idx],
      structureTemplate: structureTemplatePlan[idx],
      introMode: reconciledIntroModePlan[idx],
      lyricTheme: lyricThemeId,
      ...(lyricTheme?.scene ? { lyricThemeText: lyricTheme.scene } : {}),
      ...(lyricTheme?.emotionalArc ? { lyricThemeArc: lyricTheme.emotionalArc } : {}),
      ...(lyricThemeId ? { lyricFrameId: lyricTheme?.frameId ?? 'solitary-object' } : {}),
      ...(lyricTheme?.motionKo ? { lyricThemeMotionKo: lyricTheme.motionKo } : {}),
      ...(lyricTheme?.castKo ? { lyricThemeCastKo: lyricTheme.castKo } : {}),
      ...(lyricTheme?.eraSettingKo ? { lyricThemeEraSettingKo: lyricTheme.eraSettingKo } : {}),
      // v4.5 (TASK C) — matched once, from this track's own theme frame/
      // motion (already resolved above) — see data/vocabularyBanks.ts's
      // own vocabularyBankForScene doc comment.
      vocabularyBankId: vocabularyBankForScene(lyricTheme?.frameId, lyricTheme?.motionKo).id,
      pov: povPlan[idx],
      ...(sectionStyle ? sectionStyle : {}),
      vocalText,
      vocalVariantText: resolvedVocalVariantText,
      ...(conceptStyleText(opts.customConcept, idx) ? { conceptText: conceptStyleText(opts.customConcept, idx) } : {}),
      ...(conceptLyricImages(opts.customConcept).length ? { conceptLyricImages: conceptLyricImages(opts.customConcept) } : {}),
      ...(vocalGender ? { vocalGender } : {}),
      ...(vocalType ? { vocalType } : {})
    };
  });
}

/** Splits a full slot list into the same trackNo ranges buildBatchRequestSpecs chunks the songs into, so each sub-batch's request only carries its own slots. */
export function slotsForRange(slots: PreassignedSongSlot[], trackNumbers: number[]): PreassignedSongSlot[] {
  const range = new Set(trackNumbers);
  return slots.filter(slot => range.has(slot.trackNo));
}

/**
 * TASK v3.27 — the single place every generation path (realtime, Batch API,
 * Claude Code bridge import) reconciles a model/agent's raw song output
 * against the locally pre-decided slot for its trackNo, so the three paths
 * can't drift out of sync on what "verbatim" means (same drift risk v3.21's
 * batchPlanningBullets/songOutputShape extraction already guards against
 * elsewhere in this codebase).
 *
 * emotionArc/songRole are ALWAYS forced to the slot's value when a slot
 * exists. "title" and "hookPhrase" are the two fields governed by their own
 * mode: titleMode 'local' forces title to the slot's mechanically-derived
 * value (old behavior, unchanged); 'ai-creative' (default) trusts the
 * model/agent's own title, falling back to the slot's only if blank.
 * hookMode (TASK v3.33) works the same way one field over: 'pool' forces
 * hookPhrase to the slot's composeHook()-drawn value (old behavior,
 * hook-collision-zero via the pool — unconditional before this task);
 * 'ai-creative' (default) trusts the model's own hook, falling back to the
 * slot's only if blank. See GenerationOptions.titleMode/hookMode's comments.
 */
export interface ReconcilePreassignedOptions {
  /**
   * Bridge imports must preserve the imported hook/lyrics pair. Realtime and
   * Batch paths leave this off so hookMode governs hookPhrase normally.
   */
  keepHook?: boolean;
  /**
   * Metadata-only field. Bridge imports may keep the agent's arc because it
   * can describe the imported lyric tone more accurately than the planning
   * slot. Song role stays slot-owned because it drives opener/flagship
   * structure.
   */
  keepEmotionArc?: boolean;
}

/**
 * TASK v3.43 Part A1 — appends `verbatim` to `stylePrompt` if it isn't
 * already present (case-insensitive), the same "trust but verify" pattern
 * enforceVocalTextInStylePrompt already uses for vocalText: the bridge/Batch
 * instructions ask the model to weave moneyChordText/hookDeviceText verbatim,
 * but real output can still drop or paraphrase it away. No-op when
 * `verbatim` is falsy (e.g. a slot with no hookDeviceText) or already
 * present anywhere in the prompt.
 */
function appendVerbatimIfMissing(stylePrompt: string, verbatim: string | undefined): string {
  if (!verbatim) return stylePrompt;
  if (stylePrompt.toLowerCase().includes(verbatim.trim().toLowerCase())) return stylePrompt;
  const trimmed = stylePrompt.trim().replace(/,\s*$/, '');
  return trimmed ? `${trimmed}, ${verbatim}` : verbatim;
}

/**
 * TASK v3.43 Step 2 (Part A3) — instrumentSet is an array (unlike
 * moneyChordText/hookDeviceText's single ready-to-weave string), so this
 * checks/appends each instrument name individually: an agent that wove 2 of
 * 3 assigned instruments into the stylePrompt only needs the missing one
 * injected, not the whole set duplicated.
 */
function enforceInstrumentSetInStylePrompt(stylePrompt: string, instrumentSet: string[] | undefined): string {
  if (!instrumentSet?.length) return stylePrompt;
  const promptLower = stylePrompt.toLowerCase();
  const missing = instrumentSet.filter(instrument => !promptLower.includes(instrument.trim().toLowerCase()));
  if (!missing.length) return stylePrompt;
  const trimmed = stylePrompt.trim().replace(/,\s*$/, '');
  return trimmed ? `${trimmed}, ${missing.join(', ')}` : missing.join(', ');
}

/**
 * TASK v3.43 Step 2 (Part A3) — arrangementDensity is a bare level tag, not
 * text to weave; looks up its canonical descriptive phrase (the same one
 * the batch/bridge legend hands the agent) before falling back to the same
 * append-if-missing check every other verbatim atom uses.
 */
function enforceArrangementDensityInStylePrompt(stylePrompt: string, density: PreassignedSongSlot['arrangementDensity']): string {
  if (!density) return stylePrompt;
  return appendVerbatimIfMissing(stylePrompt, ARRANGEMENT_DENSITY_TEXT_BY_LEVEL[density]);
}

/**
 * TASK v3.43 Part A2 — tempo/BPM never had any post-hoc enforcement: the
 * model was only ever handed the slot's tempo as one of several "fallback
 * suggestion" fields (same tier as title/hookPhrase, both of which DO get
 * reconciled below), so a Batch/bridge stylePrompt could carry a BPM figure
 * that silently didn't match the tempo actually planned for that trackNo (or
 * carry none at all). Mirrors enforceVocalTextInStylePrompt's shape: replace
 * a wrong BPM figure in place if one is present, otherwise append the
 * correct one.
 */
function enforceTempoInStylePrompt(stylePrompt: string, tempo: number): string {
  return enforceSingleBpmText(stylePrompt, tempo);
}

function diversifyVocalLedOpening(stylePrompt: string, slot: PreassignedSongSlot): string {
  const trimmed = stylePrompt.trim();
  const lower = trimmed.toLowerCase();
  const vocalStarts = [slot.vocalText, slot.vocalVariantText].filter(Boolean).map(value => value!.trim().toLowerCase());
  if (!vocalStarts.some(start => start && lower.startsWith(start))) return stylePrompt;

  const instrument = slot.instrumentSet?.[0] || 'the small ensemble';
  const openings = [
      slot.genreText,
      slot.signatureSound,
    `${instrument} leads the opening`,
    slot.conceptText,
    slot.introTextureText,
    'a restrained cafe groove opens before the vocal',
    'brushed rhythm establishes the room before the vocal',
    `${instrument} and close room tone frame the first phrase`,
    'the bass pocket arrives before the lead voice',
    'a soft answering phrase opens the arrangement',
    'the harmony color arrives before the vocal enters',
    'a quiet instrumental breath starts the track',
    'the intimate room sound leads into the first line'
  ];
  const opening = openings[(Math.max(1, slot.trackNo) - 1) % openings.length];
  if (!opening || lower.startsWith(opening.toLowerCase())) return stylePrompt;
  return `${opening}, ${trimmed}`;
}

function removeRepeatedInstrumentMentions(stylePrompt: string, instrumentSet: string[] | undefined): string {
  if (!instrumentSet?.length) return stylePrompt;
  const seen = new Set<string>();
  return stylePrompt.split(',').map(clause => {
    let next = clause.trim();
    for (const instrument of instrumentSet) {
      const value = instrument.trim();
      const key = value.toLowerCase();
      const expression = new RegExp(`\\b${value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'ig');
      if (!expression.test(next)) continue;
      if (seen.has(key)) next = next.replace(expression, '').replace(/\\s{2,}/g, ' ').trim();
      else seen.add(key);
    }
    return next;
  }).filter(Boolean).join(', ');
}

export function reconcileWithPreassignedSlot(
  song: SongIdea,
  slot: PreassignedSongSlot | undefined,
  titleMode: 'local' | 'ai-creative' = 'ai-creative',
  options: ReconcilePreassignedOptions = {},
  /** TASK v3.33 — see GenerationOptions.hookMode. Kept as its own trailing param (not folded into ReconcilePreassignedOptions) since every non-bridge caller passes it explicitly, the same way titleMode is its own positional param rather than an option. */
  hookMode: 'pool' | 'ai-creative' = 'ai-creative'
): SongIdea {
  if (!slot) return song;
  // TASK v3.68 (TASK A) — this is the one place every generation path
  // (realtime, Batch API, Claude Code bridge import) already reconciles a
  // model/agent's raw output (see this function's own docstring above), so
  // it's also the one place that reliably assigns a songId regardless of
  // which path produced the song — a remote model has no reason to invent
  // one itself. Never overwrites an existing songId (bridge re-imports of
  // an already-migrated pack, or a retried/edited song, keep their id).
  const songId = song.songId || `song-${slot.trackNo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const title = titleMode === 'local' ? slot.title : song.title?.trim() ? song.title : slot.title;
  const hookPhrase = options.keepHook && song.hookPhrase?.trim()
    ? song.hookPhrase
    : hookMode === 'ai-creative' && song.hookPhrase?.trim()
      ? song.hookPhrase
      : slot.hookPhrase;
  const completeFields = [
    slot.vocalText,
    slot.moneyChordText,
    slot.genreText,
    slot.signatureSound,
    slot.hookDeviceText,
    slot.introTextureText,
    ...(slot.instrumentSet || [])
  ].filter(Boolean).every(value => song.stylePrompt.toLowerCase().includes(value!.trim().toLowerCase()));
  const startsWithVocal = [slot.vocalText, slot.vocalVariantText].filter(Boolean).some(value => song.stylePrompt.trim().toLowerCase().startsWith(value!.trim().toLowerCase()));
  if (completeFields && !startsWithVocal && song.stylePrompt.includes(`${slot.tempo} BPM`)) {
    return { ...song, title, hookPhrase };
  }
  // TASK v3.39 Part H — a real showa-cafe channel selected a male vocal
  // preset but a Codex-bridge-generated stylePrompt came back female,
  // because nothing forced the agent's free-form text to actually match the
  // selection. Rather than trust the verbatim-weave instruction alone (see
  // claudeCodeBridge.ts/promptComposer.ts), this deterministically corrects
  // the gender here — the one place realtime/Batch/bridge output all funnel
  // through — regardless of whether the agent complied. No-op when
  // vocalText has no detectable gender (e.g. a children's choir) or when the
  // stylePrompt already matches.
  const vocalFix = enforceVocalTextInStylePrompt(song.stylePrompt, slot.vocalVariantText || slot.vocalText, slot.vocalGender);
  // TASK v3.43 Part A1/A2, Step 2 Part A3 — same "don't just trust the
  // instruction" principle applied to every other verbatim-weave slot field:
  // moneyChordText and hookDeviceText previously had no post-hoc check at
  // all (unlike vocalText above), and tempo/instrumentSet/arrangementDensity
  // are new fields this task adds to the same pattern.
  let stylePrompt = vocalFix.text;
  stylePrompt = appendVerbatimIfMissing(stylePrompt, slot.vocalText);
  stylePrompt = appendVerbatimIfMissing(stylePrompt, slot.conceptText);
    stylePrompt = appendVerbatimIfMissing(stylePrompt, slot.moneyChordText);
    stylePrompt = appendVerbatimIfMissing(stylePrompt, slot.signatureSound);
  const existingPromptLower = stylePrompt.toLowerCase();
  const genreTextToAppend = slot.genreText
    && !existingPromptLower.includes(slot.genreText.trim().toLowerCase())
    && slot.instrumentSet?.some(instrument =>
    existingPromptLower.includes(instrument.trim().toLowerCase())
  )
    ? slot.genreText.split(',').map(atom => atom.trim()).filter(atom =>
      !slot.instrumentSet!.some(instrument => atom.toLowerCase() === instrument.trim().toLowerCase())
    ).join(', ')
    : slot.genreText;
  stylePrompt = appendVerbatimIfMissing(stylePrompt, genreTextToAppend);
  stylePrompt = appendVerbatimIfMissing(stylePrompt, slot.hookDeviceText);
  stylePrompt = appendVerbatimIfMissing(stylePrompt, slot.introTextureText);
  stylePrompt = enforceInstrumentSetInStylePrompt(stylePrompt, slot.instrumentSet);
  stylePrompt = enforceArrangementDensityInStylePrompt(stylePrompt, slot.arrangementDensity);
  stylePrompt = stripNegativeStyleFromStylePrompt(stylePrompt, slot.negativeStyleText);
  stylePrompt = enforceTempoInStylePrompt(stylePrompt, slot.tempo);
  stylePrompt = diversifyVocalLedOpening(stylePrompt, slot);
  stylePrompt = removeRepeatedInstrumentMentions(stylePrompt, slot.instrumentSet);
  const excludePrompt = slot.negativeStyleText
    ? mergeNegativeStyleText(song.excludePrompt, slot.negativeStyleText)
    : song.excludePrompt;
  const vocalTag = resolveVocalMetaTag(slot.vocalType, slot.vocalGender, slot.vocalText);
  // TASK v3.43 Step 2 (Part A3) — structureTemplate shapes the lyric's own
  // section tags, not stylePrompt, so unlike every field above there's
  // nothing to inject post-hoc; this only warns (never silently rewrites
  // someone else's lyrics) when the assigned template's distinctive marker
  // tag never shows up, meaning the agent likely ignored the structure
  // guideline and wrote the default shape instead. T1 has no marker (it's
  // the unmarked default), so this never fires for a track assigned T1.
  const structureMarker = slot.structureTemplate ? STRUCTURE_TEMPLATE_MARKER_TAG[slot.structureTemplate] : undefined;
  const structureWarning = structureMarker && !song.lyrics.includes(structureMarker)
    ? `Track ${slot.trackNo}: assigned structureTemplate ${slot.structureTemplate} but its section marker (${structureMarker}) doesn't appear in the lyrics — the structure guideline may not have been followed.`
    : undefined;
  const warnings = structureWarning && !song.warnings.includes(structureWarning)
    ? [...song.warnings, structureWarning]
    : song.warnings;
  const listenerSituation = slot.lyricThemeText || song.listenerSituation;
  return {
    ...song,
    songId,
    title,
    hookPhrase,
    stylePrompt,
    excludePrompt,
    // TASK v3.70 (TASK A) — the realtime/Batch/bridge path never applied
    // applyDuetSectionVocalTags (see that function's own updated comment):
    // a duet stylePrompt alone never told Suno WHICH section is which
    // singer, so a real duet-prompted track rendered as a single voice.
    lyrics: ensureVocalMetaTag(applyDuetSectionVocalTags(song.lyrics, slot.vocalGender), vocalTag),
    listenerSituation,
    emotionArc: options.keepEmotionArc && song.emotionArc?.trim() ? song.emotionArc : slot.emotionArc,
    songRole: slot.songRole,
    warnings,
    ...(slot.lyricTheme ? { lyricTheme: slot.lyricTheme } : {}),
    ...(slot.genreId ? { genreId: slot.genreId } : {}),
      ...(slot.genreText ? { genreText: slot.genreText } : {}),
      ...(slot.signatureSound ? { signatureSound: slot.signatureSound } : {}),
    ...(slot.lyricThemeText ? { lyricThemeText: slot.lyricThemeText } : {}),
    ...(slot.lyricThemeArc ? { lyricThemeArc: slot.lyricThemeArc } : {}),
    ...(slot.pov ? { pov: slot.pov } : {}),
    ...(slot.verseStyle ? { verseStyle: slot.verseStyle } : {}),
    ...(slot.verseStyleText ? { verseStyleText: slot.verseStyleText } : {}),
    ...(slot.chorusStyle ? { chorusStyle: slot.chorusStyle } : {}),
    ...(slot.chorusStyleText ? { chorusStyleText: slot.chorusStyleText } : {}),
    // TASK v3.39 — vocalType is slot-owned like songRole/emotionArc: it
    // drives the per-song male/female/mixed quota, so a realtime/Batch/
    // bridge response can never silently drift from the locally-decided
    // plan. Non-kids slots never set this field, so this is a no-op there.
    ...(slot.vocalType ? { vocalType: slot.vocalType } : {}),
    // TASK v3.68 (TASK B) — snapshot fields for rating analysis
    // (core/ratingLedger.ts); mirrors the genreId/genreText pattern above.
    ...(slot.eraTag ? { eraTag: slot.eraTag } : {}),
    ...(slot.killingPointId ? { killingPointId: slot.killingPointId } : {}),
    ...(slot.arcPhase ? { arcPhase: slot.arcPhase } : {}),
    ...(slot.intensity !== undefined ? { intensity: slot.intensity } : {}),
    bpm: slot.tempo,
    ...(slot.structureTemplate ? { structureTemplate: slot.structureTemplate } : {}),
    ...(slot.moneyChordId ? { moneyChordId: slot.moneyChordId } : {}),
    ...(slot.earwormText ? { earwormText: slot.earwormText } : {}),
    ...(slot.lyricFrameId ? { lyricFrameId: slot.lyricFrameId } : {})
  };
}
