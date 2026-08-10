import type { BilingualPair, ChannelArchetype, GenerationOptions, GenrePack, LyricLanguage, PreassignedSongSlot, SongIdea, WorkspaceId } from '../types';
import { lyricLanguageMismatchWarning, verbatimSceneCopyWarning } from './lyricMetrics';
import { lyricMetaLeakWarning } from './lyricMetaLeak';
import { stylePromptWordBudgetWarning } from './stylePromptBudget';
import { buildArrangementRecipe, buildPromptFingerprint } from './promptFingerprint';
import { createTitleGenerator, hashSeed, seedForBlueprint, STRUCTURE_TEMPLATE_MARKER_TAG } from './lyricEngine';
import { averageTempo, buildArcPlanForProfile, clampTempoToKidsAgeTier, emotionArcPlanForArc, nextContestedTitle, resolveKidsAgeTierId, songRolePlanForArc } from './localGenerator';
import { buildTempoBandPlan } from './tempoPlan';
import { buildBpmAwareStructureTemplatePlan, repairStructureTemplatePlanForBpm } from './structureTemplatePlan';
import { audienceProfileForChannelArchetype, tempoBandsForProfile } from '../data/audienceProfiles';
import { buildArrangementDensityPlan, arrangementNarrativeForGenres, buildExcludePrompt, rotatingEarwormText, rotatingGenreText, rotatingInstrumentSet } from './promptComposer';
import { compactMoneyChord, resolveEffectiveMoneyChordId } from './soundSignature';
import { applyMoneyChordLean, buildCustomProgressionPlan, buildFamilyProgressionPlan, buildGenreAwareProgressionPlan, buildProgressionPlan, buildUserChosenProgressionPlan, leanEligibleIndices, leanProtectedIndices, moneyChordLeanFor, usesMoneyChordQuota, usesUserChosenProgressionPlan } from './moneyChordPlan';
import { dominantPaletteFamilyId } from '../data/paletteFamilies';
import { isKidsArchetype } from '../utils/channelArchetype';
import { applySlotOrderOverride } from './slotOrderOverride';
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
  kidsVocalTextFor,
  leaningAdultVocalQuota,
  leaningGenderFor,
  resolveFlagshipVocalOrder,
  resolveVocalMetaTag,
  usesVocalQuota,
  type VocalGender,
  type VocalType
} from './vocalPlan';
import { matchVocalPreset } from '../data/vocalPresets';
import { eraBucketForGenreId } from '../data/eraExclusions';
import { PROXIMITY_POOL } from '../data/vocalTraits';
import { buildHookDevicePlan, hookDeviceIdsForNarrative } from './hookDevicePlan';
import { getHookDeviceById, hookDevices } from '../data/hookDevices';
import { buildChorusContrastPlan } from './chorusContrastPlan';
import { chorusContrastInstructionText, chorusContrastPlanById } from '../data/chorusContrast';
import { buildKpopPartPlan } from './kpopPartPlan';
import { kpopWorkspacePolicyFor } from './kpopWorkspacePolicy';
import { buildKpopSectionStyleShiftPlan } from './kpopSectionStyleShiftPlan';
import { sectionStyleShiftInstructionText, sectionStyleShiftPresetById } from '../data/sectionStyleShifts';
import type { OpeningPackContext } from './openingContest';
import { mergeNegativeStyleText } from '../data/negativeStyles';
import { buildIntroTexturePlan, introTextureTagForId } from './introTexturePlan';
import { buildIntroModePlan, reconcileIntroModeWithStructureTemplate } from './introModePlan';
import { introTexturesForArchetype } from '../data/introTextures';
import { applyNormalizationSafetyNet, normalizeFinalStylePrompt } from './finalPromptNormalizer';
import { reorderForEnergyContinuity } from './energyReconciliation';
import { promptAxisPolicyFor } from '../data/promptAxisPolicy';
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
import { breakLongRuns, pinPrefixPreservingCounts, reorderByArcIntensity } from './arcPlan';
import { assignKillingPoints, killingPointBoostFromInsights } from '../data/killingPoints';
import { kidsKillingPointsForTier } from '../data/killingPointsKids';
import { killingPointSetForNonKidsArchetype } from '../data/killingPointWorkspaceSets';
import { assignOpeningLoudnessDescriptors } from '../data/openingHooks';
import { applyEraQuota, ensureEraNeutralFloor, extractEraConstraint, genreCountsFromIds, resolveConstraintsFromOptions } from './constraints';
import { eraIntentForWorkspace } from '../data/workspaceEraIntent';
import { BREADTH_THRESHOLDS } from './designGate';
import { tightenEraConstraintForSenior } from './seniorOldpopPolicy';
import { resolveBpmLengthTier, estimateSongLengthSec } from './bpmLengthControl';
import { applyVerifiedComboToGenrePlan, resolveFlagshipCombo } from './verifiedCombos';
import { applyFlagshipVariationToSlots } from './comboVariations';
import type { VerifiedCombo } from '../data/verifiedCombos';
import { vocabularyBankForScene } from '../data/vocabularyBanks';
import { workspaceForArchetype } from '../data/workspaces';
import { computePerceivedEnergy } from './perceivedEnergy';
import { PERCEIVED_ENERGY_POLICY } from '../data/perceivedEnergyPolicy';
import { getGenreById, isGenreEligibleForArchetype } from '../data/genreLibrary';
import { genreSanitizationWarningKo, sanitizeGenreIdsForArchetype } from './genreSelection';

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
  opts: Pick<GenerationOptions, 'channel' | 'projectTitle' | 'lyricLanguage' | 'songCount' | 'genreIds' | 'moodIds' | 'moneyChordMode' | 'moneyChordModeIsExplicitChoice' | 'customMoneyChord' | 'earwormMode' | 'vocalQuota' | 'vocalTone' | 'avoidWords' | 'negativeStyle' | 'introUniqueness' | 'diversityAllocations' | 'perspective' | 'customLyricThemeScene' | 'customConcept' | 'genreBlendWeights' | 'genreBlendMode' | 'audience' | 'ratingInsights' | 'slotOrderOverride'>,
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
    /**
     * 지시문 14 (Phase 2 TASK A-1/A-2) — workspace-scoped cross-pack lyric
     * theme/scene history, pre-fetched by the caller (App.tsx's own
     * duplicationHistory fetch already reads situationLedger.ts's
     * recentSceneSignatures for Gate 1/Gate 2 — this reuses that exact same
     * pre-fetch, not a second read) and threaded into buildLyricThemePlan's
     * own new `avoid` param below. This is the real fix for 지시문 14 §2-1's
     * measured gap: recentSituations used to reach only the bridge
     * instruction's TEXT (a "please avoid this" suggestion an LLM can
     * ignore); this actually REMOVES those ids/scenes from the candidate
     * pool before a slot is ever assigned one.
     */
    recentLyricThemeIds?: string[];
    recentSituations?: string[];
  }
): PreassignedSongSlot[] {
  // TASK (genre-archetype sanitization) — mirrors core/localGenerator.ts's
  // generateLocalBlueprint identical fix (see that function's own doc
  // comment for the full reasoning): this is the real batch/Realtime/bridge
  // slot-planning entry point every one of those paths funnels through, so
  // it needs its own defense-in-depth sanitization even though every UI
  // entry point already sanitizes opts.genreIds before it gets here.
  // Reassigns the `opts`/`genres` PARAMETERS (never the caller's own
  // objects) so this function's later genrePool/genresForTrack reads all
  // see the sanitized set.
  const archetype = opts.channel.archetype || 'senior-morning';
  const genreSanitization = sanitizeGenreIdsForArchetype(
    Array.from(new Set((opts.genreIds ?? genres.map(genre => genre.id)).filter(Boolean))),
    archetype
  );
  if (genreSanitization.removed.length) {
    opts = { ...opts, genreIds: genreSanitization.valid };
    genres = genreSanitization.valid.map(id => getGenreById(id)).filter((genre): genre is NonNullable<typeof genre> => Boolean(genre));
  }
  const genreWarningKo = genreSanitizationWarningKo(genreSanitization.removed, archetype);
  const seedBase = seedForBlueprint(opts);
  const seed = hashSeed(seedBase);
  // TASK v3.60 (TASK C) — this pre-pass feeds the realtime/Batch/bridge
  // paths (this whole function's own docstring), which measured BPM 96-104
  // (stddev ~2.2) on a real bridge pack because averageTempo() was still
  // called with only 2 args here, skipping the v3.58 TASK 4 tempo-band
  // system entirely (see averageTempo's own `if (!band) return
  // fallbackCenter` short-circuit in localGenerator.ts). Mirrors
  // localGenerator.ts's own generateLocalBlueprint pre-pass exactly (same
  // seed) so the bridge/Batch path's BPM spread matches the local path's.
  // v5.11 — moved above the arcPlan computation just below (was previously
  // computed after it) so arcModelId-aware dispatch has this available; a
  // pure lookup with no side effects, so moving it earlier changes nothing
  // about what it returns.
  const audienceProfile = audienceProfileForChannelArchetype(opts.channel.archetype, opts.audience);
  // v5.13 (TASK: kidsAgeTierId wiring) — real resolved tier for this pack;
  // undefined for every non-kids channel.
  const resolvedKidsAgeTierId = resolveKidsAgeTierId(opts);
  // TASK v3.67 (TASK C) — same arc-intensity reorder as localGenerator.ts's
  // generateLocalBlueprint (see arcPlan.ts's own doc comment: reorders,
  // never recomputes, buildTempoBandPlan's own output).
  // v5.11 — arcModelId-aware dispatch (see localGenerator.ts's
  // buildArcPlanForProfile doc comment); resolves 'repetition-cycle' for
  // every kids workspace, unaffected for every other profile.
  // v5.13 — now also passes the real resolved tier.
  const arcPlan = buildArcPlanForProfile(opts.songCount, audienceProfile.arcModelId, resolvedKidsAgeTierId);
  // TASK v3.67 (TASK D) — phase-aware emotion-arc shape per track, mirroring
  // localGenerator.ts's own emotionArcPlanForArc call (same seed).
  const emotionArcPlan = emotionArcPlanForArc(arcPlan, seed + 22);
  // v4.2 (TASK A3) — mirrors localGenerator.ts's own generateLocalBlueprint:
  // one ResolvedConstraints instance feeding this path's own title generation.
  const constraints = resolveConstraintsFromOptions(opts, audienceProfile);
  const nextTitle = createTitleGenerator(opts.lyricLanguage, seedBase, opts.songCount, avoid, opts.channel.archetype, constraints);
  const tempoBands = tempoBandsForProfile(audienceProfile);
  // v5.8 (TASK 2) — mirrors localGenerator.ts's identical addition: computed
  // here (before tempoBandPlan) so the tempo lean below has this pack's
  // per-song explicit-choice assignment available; `progressionPlan` below
  // reuses this exact value instead of recomputing it.
  const userChosenProgressionPlan = usesUserChosenProgressionPlan(opts)
    ? buildUserChosenProgressionPlan(opts.moneyChordMode, opts.songCount, seed)
    : null;
  // 지시문 27 (TASK B-4) — localGenerator.ts의 동일 추가와 같은 이유.
  const customChosenProgressionPlan = Boolean(opts.moneyChordModeIsExplicitChoice) && opts.moneyChordMode === 'custom' && opts.customMoneyChord?.trim()
    ? buildCustomProgressionPlan(opts.channel.archetype, opts.songCount, seed)
    : null;
  const moneyChordLean = userChosenProgressionPlan ? moneyChordLeanFor(opts.moneyChordMode) : undefined;
  const tempoBandPlanBase = tempoBands ? reorderByArcIntensity(buildTempoBandPlan(tempoBands, opts.songCount, seed), arcPlan, band => band.low) : [];
  // v5.8 (TASK 2) — mirrors localGenerator.ts's identical soft money-chord
  // tempo lean (see moneyChordPlan.ts's applyMoneyChordLean doc comment).
  const tempoBandPlan = moneyChordLean && moneyChordLean.tempo !== 'neutral' && userChosenProgressionPlan
    ? applyMoneyChordLean(
        tempoBandPlanBase,
        leanEligibleIndices(userChosenProgressionPlan, opts.moneyChordMode, tempoBandPlanBase.length),
        leanProtectedIndices(tempoBandPlanBase.length),
        band => band.low,
        moneyChordLean.tempo === 'lower' ? 'lower' : 'higher'
      )
    : tempoBandPlanBase;
  // TASK I2 (v3.11) — the Batch API path is local-then-submit (this whole
  // function's point per its own docstring), so tracks 1-3 get the same
  // local k=3 contest the synchronous path uses, not a plain single-hook pick.
  const packContext: OpeningPackContext = { dominantGenreIds: opts.genreIds ?? [], dominantMoodIds: opts.moodIds ?? [] };
  const genrePool = Array.from(new Set((opts.genreIds ?? genres.map(genre => genre.id)).filter(Boolean)));
  const genreAllocation = allocationForAxis(opts.diversityAllocations, 'genre');
  /**
   * 지시문 10 (TASK A-3) — real measured bug: this is the actual genre pool
   * the real bridge deployment path (core/bridgeInstruction.ts's
   * preallocateSongSlots call) assigns per track — core/setDirector.ts's own
   * era-quota system (extractEraConstraint -> tightenEraConstraintForSenior
   * -> applyEraQuota) only ever ran inside directSetLocal, the LOCAL PREVIEW
   * path (scripts/audit.ts's own generatePack, never what a real published
   * pack goes through). A real "60년대" concept's genrePool here was every
   * channel.preferredGenres id with zero era awareness — 3 of its 4 real
   * genres for a real pack turned out to be 1970s-bucket (oldpop-soft-rock-am,
   * oldpop-motown-pop-soul, oldpop-piano-ballad-70s), landing 10/18 songs
   * with pure-1970s stylePrompt text against a "60년대" concept. Skipped when
   * the caller already made an explicit 'manual' genre-axis choice (that
   * choice always wins, same as every other axis in this file) or the
   * concept has no era signal at all (era.unspecified — never force an era).
   * Scoped to senior-morning only (this directive's own "시니어 워크스페이스만
   * 실질 변경, 다른 워크스페이스는 additive-only") — directSetLocal's
   * unconditional applyEraQuota call already gives every OTHER workspace's
   * local-preview path era-awareness today, but extending that to their real
   * bridge-deployment path is out of this task's scope.
   */
  const eraConstraint = genreAllocation?.mode === 'manual' || opts.channel.archetype !== 'senior-morning'
    ? undefined
    : extractEraConstraint(opts.customConcept ?? '');
  // 정합성 점검 §1 결함1 fix — same breadth-aware perGenreCap as
  // core/setDirector.ts's own applyEraQuota calls (see applyEraQuota's own
  // doc comment on the perGenreCap parameter). `constraints` (line 190
  // above) already resolved this pack's real breadth via
  // resolveConstraintsFromOptions — reused here rather than re-deriving it.
  const eraQuotaCounts = eraConstraint && !eraConstraint.unspecified
    ? (() => {
        const filter = (genre: GenrePack) => isGenreEligibleForArchetype(genre, opts.channel.archetype || 'senior-morning');
        const cap = BREADTH_THRESHOLDS[constraints.breadth].genre.maxPerGenre;
        const { counts } = applyEraQuota(
          genreCountsFromIds(genrePool, opts.songCount, cap),
          opts.songCount,
          tightenEraConstraintForSenior(eraConstraint, opts.channel.archetype, opts.songCount),
          filter,
          undefined,
          cap
        );
        // 지시문 33 (§1) — era-neutral(발라드 등) 하한을 배정 단계에서
        // 확보한다. applyEraQuota가 끝난 뒤 실행 — 그 안의 anti-singleton/
        // coPrimary 로직은 건드리지 않는다.
        const workspaceId = workspaceForArchetype(opts.channel.archetype)?.id;
        const policy = workspaceId ? eraIntentForWorkspace(workspaceId).eraNeutralPolicy : undefined;
        return ensureEraNeutralFloor(counts, opts.songCount, policy, filter, cap).counts;
      })()
    : undefined;
  // core/setDirector.ts's directSetLocal uses Object.keys(quotaAdjustedCounts)
  // as its own final genre-id list, not the pre-quota pool — applyEraQuota's
  // distributeInto can open a genre outside the original pool to reach a
  // bucket's minimum share (never inventing an ineligible one; still filtered
  // by the same channelFilter predicate passed in above), so filtering
  // through the ORIGINAL genrePool here would silently drop those songs.
  const autoGenrePlan = eraQuotaCounts
    ? buildGenreCountRotationPlan(eraQuotaCounts, Object.keys(eraQuotaCounts), opts.songCount, seed)
    : buildGenreRotationPlan(genrePool, opts.songCount, seed);
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
      eraTag: genresForTrack(genres, genrePlan[idx], opts.genreBlendWeights, opts.genreBlendMode)[0]?.eraTag
    })),
    seed + 67,
    killingPointBoostFromInsights(opts.ratingInsights),
    // v5.13 — tier-aware filter instead of always the unfiltered full set.
    // 지시문 30 TASK C — mirrors the identical fix in localGenerator.ts's two
    // own assignKillingPoints call sites (data/killingPointWorkspaceSets.ts's
    // own doc comment) — this is the third real call site, the bridge/batch
    // preallocation path.
    isKidsArchetype(opts.channel.archetype) ? kidsKillingPointsForTier(resolvedKidsAgeTierId) : killingPointSetForNonKidsArchetype(opts.channel.archetype)
  );
  // TASK v4.11 (TASK B) — mirrors localGenerator.ts's own openingLoudnessPlan
  // (same seed offset): tracks 1-3 only, a real waveform measurement found
  // those tracks rendering ~3.7dB quieter than the same track's own
  // full-song average (see data/openingHooks.ts's own
  // OPENING_LOUDNESS_DESCRIPTORS doc comment for the real numbers).
  const openingLoudnessPlan = assignOpeningLoudnessDescriptors(opts.songCount, seed + 149);

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
  // TASK v4.14 (TASK B) — family-aware money-chord distribution
  // (data/paletteFamilyMoneyChords.ts) when this pack's genrePlan actually
  // resolves to one of data/paletteFamilies.ts's 4 families; falls back to
  // the old flat archetype-pool rotation (buildProgressionPlan) for every
  // other channel/concept, exactly as before this task.
  const dominantFamilyId = dominantPaletteFamilyId(genrePlan);
  // v5.7 (TASK v5.7, TASK B) — mirrors localGenerator.ts's identical
  // addition: an explicit user money-chord pick wins over both the flat
  // 100%-progression text and the default-side family/archetype quota.
  // v5.8 (TASK 2) — reuses userChosenProgressionPlan computed above (same
  // deterministic value) instead of recomputing it.
  // 지시문 27 (TASK B) — localGenerator.ts의 동일 추가와 같은 이유:
  // buildGenreAwareProgressionPlan이 트랙별 실제 lead 장르(genrePlan)를
  // data/genreMoneyChordAffinity.ts와 대조해 family/flat 폴백보다 우선한다.
  const progressionPlan: (string | undefined)[] | null = userChosenProgressionPlan
    ?? customChosenProgressionPlan
    ?? (usesMoneyChordQuota(opts)
      ? (buildGenreAwareProgressionPlan(genrePlan, opts.channel.archetype, seed, opts.songCount)
        ?? buildFamilyProgressionPlan(dominantFamilyId, opts.channel.archetype, seed, opts.songCount)
        ?? buildProgressionPlan(opts.channel.archetype, seed, songRoles))
      : null);
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
  // leaningGenderFor/leaningAdultVocalQuota doc comments).
  // TASK K2 §5-1 — opts.channel.vocalQuotaOverride mirrors localGenerator.ts's
  // identical addition: same priority as opts.vocalQuota, undefined for
  // every existing channel preset so this path is unchanged for them.
  const baseVocalQuota = opts.vocalQuota ?? opts.channel.vocalQuotaOverride ?? (isKidsArchetype(opts.channel.archetype) ? DEFAULT_KIDS_VOCAL_QUOTA : DEFAULT_ADULT_VOCAL_QUOTA);
  // v5.9 (quota/tone separation) — `detectedVocalTone` is a pure recognition
  // signal (does a preset/gender/duet/mixed phrase actually exist in
  // opts.vocalTone?), computed the SAME way regardless of channel type; it
  // used to be entangled with `vocalLeaning` itself (one variable serving
  // both "should the quota shift" and "was the tone recognized"), which
  // wrongly told explicitUnrecognizedVocalTone below that a perfectly valid
  // preset was "unrecognized" on any channel where the quota lean happens to
  // be disabled (kids, before this fix; every vocalQuotaOverride/opts.vocalQuota
  // channel, always by design). See leaningGenderFor's own doc comment for
  // what counts as recognized (matchVocalPreset first, then Korean duet/mixed
  // terms, then English/Korean gender-word detection).
  const detectedVocalTone = leaningGenderFor(opts);
  // Gender-QUOTA lean is the one axis that legitimately depends on channel
  // type: disabled only when the caller supplied an explicit quota
  // (opts.vocalQuota) or the channel enforces a fixed quota
  // (vocalQuotaOverride, e.g. a K-pop boy/girl-group channel) — in both
  // cases the quota split itself IS the point and a vocal-tone pick must not
  // shift it. Kids channels are NO LONGER blanket-excluded here: a kids
  // channel should still be able to lean toward more girl- or boy-voiced
  // songs when the user picks a gendered kids preset, the same way an adult
  // channel already could (leaningAdultVocalQuota's own 0.55 lead-share math
  // is unchanged and already yields a balanced ~10/4/4-of-18 split, not an
  // extreme one, for either audience).
  const vocalLeaning = opts.vocalQuota || opts.channel.vocalQuotaOverride ? undefined : detectedVocalTone;
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
  // v5.9 (quota/tone separation) — checks `detectedVocalTone` (recognition),
  // not `vocalLeaning` (whether the quota actually shifted): a vocalTone that
  // matched a real preset (e.g. an "airy soft female" pick on a fixed-quota
  // K-pop channel) must still count as recognized even on a channel where
  // vocalLeaning is always undefined by design — the old `!vocalLeaning`
  // condition conflated "was this tone recognized" with "did it move the
  // quota", silently discarding a legitimately-picked preset back to the
  // channel's generic defaultVocal on exactly those channels.
  const explicitUnrecognizedVocalTone = !isKidsArchetype(opts.channel.archetype) && !opts.vocalQuota && !detectedVocalTone
    && Boolean(opts.vocalTone?.trim()) && opts.vocalTone!.trim() !== opts.channel.defaultVocal;
  // v5.9 (quota/tone separation) — the kids-channel counterpart of the same
  // "tone preset always applies" fix: whenever opts.vocalTone matches one of
  // vocalPresets.ts's own forKids presets, that preset's own wording now
  // reaches the matching-gender tracks' vocalText below (see vocalPlan.ts's
  // kidsVocalTextFor doc comment) instead of being silently ignored in favor
  // of the flat rotating pool. undefined (no match) for every existing kids
  // channel's own untouched/default vocalTone, so this is a no-op unless a
  // user actually opens the voice picker and chooses a specific kids preset.
  const kidsMatchedVocalPreset = isKidsArchetype(opts.channel.archetype) ? matchVocalPreset(opts.vocalTone?.trim() ?? '') : undefined;
  // v5.11 (TASK L) — mirrors localGenerator.ts's identical addition (same
  // reasoning: see SongIdea.effectiveVocalPresetId's own doc comment).
  const wholePackMatchedVocalPreset = matchVocalPreset(opts.vocalTone?.trim() ?? '');
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
  if (vocalPlan && !isKidsArchetype(opts.channel.archetype)) {
    vocalPlan = applyGenreVocalAffinity(vocalPlan, genrePlan, opts.songCount >= 3 ? 3 : 0);
  }
  // TASK v3.41 Part A2/D — mirrors vocalPlan's pre-pass shape/seed one more
  // step: which of each type's 5 wordings a given trackNo gets, so a 15-song
  // 5/5/5 kids pack no longer reuses one fixed string per type across
  // realtime/Batch/bridge (see vocalPlan.ts's buildVocalVariantPlan). Kids
  // only — the adult path's wording now comes from buildAdultVocalTraitPlan
  // below (TASK v3.72 TASK B), not this flat variant-index scheme.
  const vocalVariantPlan = vocalPlan && isKidsArchetype(opts.channel.archetype) ? buildVocalVariantPlan(vocalPlan, seed) : null;
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
  const vocalTechniquePlan = !isKidsArchetype(opts.channel.archetype) ? buildVocalTechniquePlan(eraBucketByIndex, seed) : null;
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
  const adultVocalTraitPlan = vocalPlan && !isKidsArchetype(opts.channel.archetype) && !explicitUnrecognizedVocalTone
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
  // TASK v4.13 bugfix — explicitUnrecognizedVocalTone (above) now only fires
  // when vocalTone matched no preset AND carried no detectable gender/duet/
  // mixed signal at all (English or Korean, after this task's own
  // leaningGenderFor/detectVocalGender additions) — genuinely unparseable
  // text (gibberish, or a value some other language entirely), not merely
  // "a creative description with no explicit gender word" as v3.77 first
  // scoped this flag. Suno cannot read that text either way, and letting it
  // reach every track's stylePrompt as the literal vocal descriptor is
  // exactly the "실패한 문자열이 그대로 프롬프트에 들어갑니다" failure mode this
  // task exists to close — falls back to the channel default instead, with
  // a console warning (same [tag] convention as this file's own
  // averageTempo band-missing warning) so the silent substitution is at
  // least visible in a dev console, without a new UI surface.
  if (explicitUnrecognizedVocalTone) {
    console.warn(`[vocalTone] "${opts.vocalTone?.trim()}" matched no preset and no detectable gender/duet/mixed word — falling back to the channel default vocal instead of using it as every track's vocal descriptor.`);
  }
  const fallbackVocalText = explicitUnrecognizedVocalTone ? opts.channel.defaultVocal : (opts.vocalTone?.trim() || opts.channel.defaultVocal);
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
  // 지시문 36 (TASK C-3) — hookDevicePlan 바로 옆에 둔다: 같은 시점에
  // 결정되는 같은 신뢰 모델의 슬롯 필드이기 때문(§C-3 "검사만 하면 늦다").
  const chorusContrastPlan = buildChorusContrastPlan(opts.songCount, seed + 173);
  // 지시문 37 (TASK B) — 같은 이유로 같은 자리: chorusContrastPlan과 동일한
  // stride 회전 신뢰 모델. kr-idol-male/kr-idol-female이 아니면 아래
  // per-track 루프에서 kpopPolicy가 undefined라 슬롯에 실리지 않는다.
  const sectionStyleShiftPlan = buildKpopSectionStyleShiftPlan(opts.songCount, seed + 331);
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
  // TASK v4.11 (TASK A) — was the flat, BPM-independent buildStructureTemplatePlan:
  // a real 18-song bridge plan measured 8/18 slots where the assigned
  // template's own nominal section count (lyricEngine.ts's
  // STRUCTURE_TEMPLATE_SECTION_NOTES via bpmLengthControl.ts's
  // TEMPLATE_SECTION_COUNT) fell OUTSIDE that same slot's own BPM-tier
  // sectionRange below — e.g. a 69 BPM track (tier range 5-6) landing on T1
  // (8 sections). The bridge instruction's own "Length target" column and
  // "structureTemplate" field then told the composer two contradictory
  // section counts for the same track, and a real composed pack followed the
  // template's own concrete section list over the abstract range number 14/18
  // times. Same BPM-aware selection localGenerator.ts already uses
  // (core/structureTemplatePlan.ts's buildBpmAwareStructureTemplatePlan),
  // fed the same tempoBandPlan-midpoint proxy (tempoBandPlan is already built
  // above, well before any track's exact tempo is resolved in the per-track
  // loop below) — same accepted proxy-vs-final-tempo tradeoff
  // localGenerator.ts's own identical pre-pass already carries, not a new
  // risk introduced here.
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
  // TASK v4.11 (TASK A) — applyAxisAllocation above almost always overrides
  // buildBpmAwareStructureTemplatePlan's own BPM-eligible pick: opts.diversityAllocations
  // sets a MANUAL, fixed-count target for the 'structureTemplate' axis (e.g.
  // "T1:4, T2:4, T3:4, T4:3, T5:3") purely to guarantee template variety
  // across the pack, with no knowledge of any one track's BPM — so the
  // BPM-aware pick above almost never actually survives to the final plan
  // (real measurement: 8/18 slots mismatched). This repair pass runs AFTER
  // allocation and swaps templates PAIRWISE between tracks — never adding,
  // removing, or recounting one — so the manual count distribution the
  // allocation asked for is preserved exactly; only which track gets which
  // of the already-chosen templates changes.
  const structureTemplatePlan = repairStructureTemplatePlanForBpm(autoStructureTemplatePlan, bpmProxyByIndex);
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
      buildArrangementDensityPlan(opts.songCount, seed),
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
  // per-slot density spec. Re-runs breakLongRuns afterward — pinning 3 of an
  // (v4.16) 6:8:4 split can create a fresh run right at the position-2/3
  // seam that the pre-pin pass never saw (see arcPlan.ts's own breakLongRuns
  // doc comment). Preserves the overall count split either way
  // (pinPrefixPreservingCounts) — 'manual' here only ever fixes TOTALS
  // (setDirector.ts's directSetLocal always sets arrangementDensity to
  // 'manual' with its own weighted default counts, v4.16), so pinning positions 0-2
  // never overrides anything a user actually hand-picked. Data-driven guard
  // instead of a manual/auto check, same reasoning as vocalPlanHasAllThreeTypes
  // above: skips only when the plan doesn't actually contain all 3 levels
  // (e.g. tests/v347step3.test.ts's deliberately narrow `{ full: 3 }`
  // 5-song manual override, whose 2 auto-filled shortfall songs aren't
  // enough to also produce a 'sparse'/'medium' — nothing to legally pin
  // without violating that override's own total).
  const arrangementDensityHasAllThreeLevels = new Set(autoOrManualArrangementDensityPlan).size === 3;
  const arrangementDensityPlanBase = opts.songCount >= 3 && arrangementDensityHasAllThreeLevels
    ? breakLongRuns(pinPrefixPreservingCounts(autoOrManualArrangementDensityPlan, ['medium', 'sparse', 'sparse'] as const), 2)
    : autoOrManualArrangementDensityPlan;
  // v5.8 (TASK 2) — mirrors localGenerator.ts's identical soft money-chord
  // density lean, applied after arc-reordering and flagship pinning.
  const arrangementDensityPlan = moneyChordLean && moneyChordLean.density !== 'neutral' && userChosenProgressionPlan
    ? applyMoneyChordLean(
        arrangementDensityPlanBase,
        leanEligibleIndices(userChosenProgressionPlan, opts.moneyChordMode, arrangementDensityPlanBase.length),
        leanProtectedIndices(arrangementDensityPlanBase.length),
        level => arrangementDensityRank[level],
        moneyChordLean.density === 'sparser' ? 'lower' : 'higher'
      )
    : arrangementDensityPlanBase;
  // 지시문 10 (TASK B-3) — real measured bug: this is the REAL bridge
  // deployment path's own theme assignment, and it was still using the
  // shared, concept-blind `seed` — core/localGenerator.ts's identical call
  // already got the real fix for this (see that file's own lyricThemeSeed
  // comment, 지시문 08 TASK D) but it only ever ran on the LOCAL PREVIEW
  // path. Two different concepts on the same channel (e.g. "60년대 올드팝
  // 명곡" / "70년대 올드팝 명곡") landed the exact same lyricTheme sequence in
  // a real published pack (18/18 same-trackNo theme duplication, 14/18
  // same-trackNo listenerSituation duplication) — this seed swap is that
  // fix, mirrored exactly (same formula, same "only this one call" scope —
  // genre/hook/BPM/vocal rotation all keep the shared seed unchanged).
  const lyricThemeSeed = opts.customConcept?.trim() ? hashSeed(`${seedBase}:${opts.customConcept}`) : seed;
  const lyricThemePlan = buildLyricThemePlan(opts, lyricThemeSeed, {
    recentThemeIds: avoid?.recentLyricThemeIds,
    recentSituations: avoid?.recentSituations
  });
  const povPlan = buildPovPlan(opts, seed);
  const sectionStylePlan = buildSectionStylePlan(opts.songCount, seed, structureTemplatePlan);

  const slots = Array.from({ length: opts.songCount }, (_, idx) => {
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
      ? (isKidsArchetype(opts.channel.archetype)
          ? kidsVocalTextFor(vocalType, opts.lyricLanguage, vocalVariantPlan ? vocalVariantPlan[idx] : 0, opts.channel.archetype, kidsMatchedVocalPreset)
          : (adultVocalTraitPlan?.[idx]
              ? [adultVocalTraitPlan[idx], vocalTechniquePlan?.[idx]].filter(Boolean).join(', ')
              : fallbackVocalText))
      : fallbackVocalText;
    const vocalVariantText = vocalType ? vocalText : undefined;
    const vocalGender: VocalGender | undefined = vocalType
      ? (isKidsArchetype(opts.channel.archetype) ? vocalType : (vocalType === 'mixed' ? 'duet' : vocalType))
      : fallbackVocalGender;
    // 지시문 37 (TASK A) — kr-idol-male/kr-idol-female에서만 설정된다
    // (kpopWorkspacePolicyFor는 그 두 워크스페이스에만 정의돼 있다).
    // moneyChordText/hookDeviceText와 같은 신뢰 모델: 여기서 한 번 계산해
    // 슬롯에 싣고, reconcileWithPreassignedSlot이 양쪽 경로 모두에서
    // SongIdea.partPlan으로 그대로 복사한다.
    const kpopPolicy = kpopWorkspacePolicyFor(workspaceForArchetype(opts.channel.archetype)?.id ?? 'senior-oldpop');
    const partPlan = kpopPolicy ? buildKpopPartPlan(vocalGender, structureTemplatePlan[idx], kpopPolicy, seed + idx * 97 + 401) : undefined;
    // 지시문 37 (TASK B) — partPlan과 같은 게이팅(kr-idol 전용).
    const sectionStyleShiftPreset = kpopPolicy ? sectionStyleShiftPresetById(sectionStyleShiftPlan[idx]) : undefined;
    const hookDeviceId = hookDevicePlan[idx];
    const introTextureId = introTexturePlan[idx];
    const moneyChordId = progressionPlan ? progressionPlan[idx] : undefined;
    // v5.11 (TASK L) — always resolved (unlike moneyChordId above, which
    // stays undefined outside quota rotation) — see
    // core/soundSignature.ts's resolveEffectiveMoneyChordId doc comment.
    const effectiveMoneyChordId = resolveEffectiveMoneyChordId(opts, moneyChordId);
    const hookDeviceText = getHookDeviceById(hookDeviceId)?.prompt;
    const chorusContrastPlanId = chorusContrastPlan[idx];
    const chorusContrastResolved = chorusContrastPlanId ? chorusContrastPlanById(chorusContrastPlanId) : undefined;
    const introTextureText = introTextureTagForId(introTextureId);
    const lyricThemeId = lyricThemePlan[idx];
    const lyricTheme = lyricThemeForSlot(lyricThemeId, opts);
    const sectionStyle = sectionStylePlan[idx];
    const genreId = genrePlan[idx];
    const trackGenres = genresForTrack(genres, genreId, opts.genreBlendWeights, opts.genreBlendMode);
    // v5.11 (TASK L) — this trackNo's actual assigned genre(s), re-sanitized
    // defensively (mirrors SongIdea.effectiveGenreIds's own doc comment) —
    // guards even a verified-combo genre override (applyVerifiedComboToGenrePlan
    // above) that might not have come from this pack's own sanitized pool.
    const effectiveGenreIds = sanitizeGenreIdsForArchetype(trackGenres.map(g => g.id), archetype).valid;
    const resolvedVocalVariantText = vocalVariantText || variedVocalText(fallbackVocalText, idx, trackGenres[0], opts.channel.archetype);
    const genreText = rotatingGenreText(trackGenres, seed, idx);
    const killingPoint = killingPointPlan[idx];
    // v5.10 (TASK H) — computed here (was only computed later, inline, for
    // the vocabularyBankId slot field below) so its `avoid` words can also
    // reach negativeStyleText/excludePrompt just below, for kids channels —
    // see data/vocabularyBanks.ts's own v5.10 doc comment for why kr-kids/
    // jp-kids previously resolved to an unscoped senior/adult bank here.
    const sceneVocabularyBank = vocabularyBankForScene(lyricTheme?.frameId, lyricTheme?.motionKo, workspaceForArchetype(opts.channel.archetype)?.id);
    // TASK v3.67 (TASK B) — this track's own killing point may relax
    // specific audience exclusions for this one song only (see
    // data/killingPoints.ts / promptComposer.ts's buildExcludePrompt, which
    // only ever drops entries actually in the profile's relaxableAtPeak).
    // v5.10 (TASK H) — kids-only: also merges sceneVocabularyBank.avoid, same
    // reasoning/gating as localGenerator.ts's identical excludePrompt change.
    const negativeStyleText = isKidsArchetype(opts.channel.archetype) && sceneVocabularyBank.avoid.length
      ? mergeNegativeStyleText(buildExcludePrompt(opts, trackGenres, killingPoint?.relaxes), sceneVocabularyBank.avoid.join(', '))
      : buildExcludePrompt(opts, trackGenres, killingPoint?.relaxes);
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
    // v5.13 — clamps the final BPM into this pack's real kids age-tier tempo
    // range (data/kidsAgeTiers.ts); no-op for a non-kids/no-tier pack.
    const resolvedTempo = clampTempoToKidsAgeTier(
      idx === 1 && flagshipComboTempo !== undefined
        ? Math.min(audienceProfile.tempoCeiling, Math.max(audienceProfile.tempoFloor, flagshipComboTempo))
        : averageTempo(trackGenres, trackNo, tempoBandPlan[idx], audienceProfile.tempoFloor, audienceProfile.tempoCeiling, audienceProfile.genreBoundedTempo),
      resolvedKidsAgeTierId
    );
    // v3.82 (TASK B) — BPM-appropriate section/word/instrumental-section
    // targets for this track (see core/bpmLengthControl.ts's own doc
    // comment for the real-measurement root cause). Flagship slots (tracks
    // 2-3) are additionally hard-capped at 1 instrumental section
    // regardless of tier, per this task's own §3 대표곡 규격 확정 ("악기 구간
    // 최대 1 — T7이 2개여서 4:16이 됐습니다").
    const bpmTier = resolveBpmLengthTier(resolvedTempo);
    const isFlagshipSlot = idx === 1 || idx === 2;
    // 지시문 23 (TASK A) — 이 트랙의 실제 resolved 필드(tempo/arrangementDensity/
    // instrumentSet/vocalText, lead genre의 rhythm/instruments/vocal/production)
    // 만으로 계산 — 새 입력 필드 없음(§0 원칙). trackGenres[0]이 없을 수 있는
    // 경로(genreWarning만 있고 실제 GenrePack 매칭 실패)에서는 계산을 건너뛴다.
    const perceivedEnergyResult = trackGenres[0]
      ? computePerceivedEnergy(
          { tempo: resolvedTempo, arrangementDensity: arrangementDensityPlan[idx], instrumentSet: rotatingInstrumentSet(trackGenres, seed, idx), vocalText },
          trackGenres[0],
          PERCEIVED_ENERGY_POLICY[workspaceForArchetype(opts.channel.archetype)?.id ?? 'senior-oldpop']
        )
      : undefined;
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
      // v5.8 (TASK 1) — mirrors localGenerator.ts's identical re-enable:
      // reinforced (via the short audibleEffectTag, not audibleEffect) only
      // for the songs carrying the user's own explicit pick verbatim, same
      // condition as the local path so both paths still agree per trackNo.
      moneyChordText: compactMoneyChord(opts, {
        moneyChordIdOverride: moneyChordId,
        includeFeelReinforcement: Boolean(opts.moneyChordModeIsExplicitChoice) && Boolean(moneyChordId) && moneyChordId === opts.moneyChordMode
      }),
        ...(genreId ? { genreId } : {}),
        ...(genreText ? { genreText } : {}),
        ...(trackGenres[0]?.signatureSound ? { signatureSound: trackGenres[0].signatureSound } : {}),
      negativeStyleText,
      ...(introTextureText ? { introTextureText } : {}),
      ...(introTextureId ? { introTextureId } : {}),
      ...(hookDeviceText ? { hookDeviceText } : {}),
      ...(hookDeviceId ? { hookDeviceId } : {}),
      ...(chorusContrastResolved ? {
        chorusContrastPlanId: chorusContrastResolved.id,
        chorusContrastText: chorusContrastInstructionText(chorusContrastResolved),
        chorusContrastScore: chorusContrastResolved.score.total
      } : {}),
      ...(partPlan ? { partPlan } : {}),
      ...(sectionStyleShiftPreset ? { sectionStyleShifts: sectionStyleShiftPreset.shifts, sectionStyleShiftText: sectionStyleShiftInstructionText(sectionStyleShiftPreset) } : {}),
      ...(openingLoudnessPlan[idx] ? { openingLoudnessText: openingLoudnessPlan[idx] } : {}),
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
      // 지시문 26 (TASK A) — arcPlan[idx].peakStrength was only ever read
      // transiently here (to build killingPointPlan above); never snapshotted
      // onto the slot. Always set (unlike killingPointText/Id/Placement,
      // which stay undefined for 'none') so downstream code can tell
      // "genuinely no killing point by design" apart from "field missing".
      peakStrength: arcPlanForKillingPoints[idx].peakStrength,
      ...(perceivedEnergyResult ? { perceivedEnergy: perceivedEnergyResult.value, perceivedEnergyReasonKo: perceivedEnergyResult.reasonKo } : {}),
      ...(moneyChordId ? { moneyChordId } : {}),
      // v5.11 (TASK L) — always-populated counterparts of moneyChordId/
      // genreId above; see each SongIdea field's own doc comment. Copied
      // onto the final SongIdea by reconcileWithPreassignedSlot below.
      effectiveMoneyChordId,
      effectiveGenreIds,
      ...(wholePackMatchedVocalPreset ? { effectiveVocalPresetId: wholePackMatchedVocalPreset.id } : {}),
      // v5.13 (TASK: kidsAgeTierId wiring) — mirrors effectiveMoneyChordId/
      // effectiveGenreIds's own "always-populated counterpart" pattern just
      // above; absent for a non-kids pack. Copied onto the final SongIdea by
      // reconcileWithPreassignedSlot below.
      ...(resolvedKidsAgeTierId ? { effectiveKidsAgeTierId: resolvedKidsAgeTierId } : {}),
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
      // own vocabularyBankForScene doc comment. v5.7 (TASK G) — now passes
      // the real workspaceId (was unscoped, same gap as localGenerator.ts's
      // own fix). v5.10 (TASK H) — reuses sceneVocabularyBank (computed once
      // above, near negativeStyleText) instead of calling
      // vocabularyBankForScene a second time with the same arguments.
      vocabularyBankId: sceneVocabularyBank.id,
      pov: povPlan[idx],
      ...(sectionStyle ? sectionStyle : {}),
      vocalText,
      vocalVariantText: resolvedVocalVariantText,
      ...(conceptStyleText(opts.customConcept, idx) ? { conceptText: conceptStyleText(opts.customConcept, idx) } : {}),
      ...(conceptLyricImages(opts.customConcept).length ? { conceptLyricImages: conceptLyricImages(opts.customConcept) } : {}),
      ...(vocalGender ? { vocalGender } : {}),
      ...(vocalType ? { vocalType } : {}),
      ...(idx === 0 && genreWarningKo ? { genreWarning: genreWarningKo } : {})
    };
  });
  // v5.23 (TASK D gap 2) — "1곡 그대로, 1곡 변주": patches the second
  // same-genre track (see comboVariations.ts's own resolveFlagshipVariationPlan)
  // with one real structural variation instead of leaving it an exact
  // repeat of the flagship combo. A no-op array (same slots back) whenever
  // flagshipCombo is undefined or no second track carries its genre.
  const flagshipVaried = applyFlagshipVariationToSlots(slots, flagshipCombo);
  // 지시문 31 (§1-3 ②) — 지시문 23의 관찰 항목("세트 에너지 급변 지점")이
  // 찾아낸 것을 배정 단계에서 실제로 줄인다. core/energyReconciliation.ts's
  // own doc comment에 전체 설계·미구현으로 남긴 ①(불일치 자체를 장르
  // 재선택으로 고치는 것)의 이유가 있다. 사용자가 직접
  // opts.slotOrderOverride를 지정했으면(수동 재배열) 그것을 우선한다 — 자동
  // 에너지 재배열이 사용자 선택을 덮지 않는다.
  const autoEnergyOrder = opts.slotOrderOverride ? undefined : reorderForEnergyContinuity(flagshipVaried);
  // 지시문 27 (TASK C-2) — 마지막 단계로 한 번만: 위 파이프라인이 평소대로
  // 다 만든 뒤, 곡 내용은 그대로 두고 trackNo 순서만 재배열한다.
  return applySlotOrderOverride(flagshipVaried, opts.slotOrderOverride ?? autoEnergyOrder);
}

/** Splits a full slot list into the same trackNo ranges buildBatchRequestSpecs chunks the songs into, so each sub-batch's request only carries its own slots. */
export function slotsForRange(slots: PreassignedSongSlot[], trackNumbers: number[]): PreassignedSongSlot[] {
  const range = new Set(trackNumbers);
  return slots.filter(slot => range.has(slot.trackNo));
}

/**
 * TASK (duplicate-trackNo fix) — every reconciliation call site in this
 * codebase (providers/index.ts's generateChunkWithSplitRetry, core/
 * batchStitcher.ts's stitchBatchResults, core/bridgeImport.ts's
 * importSongsJson) used to build `new Map(slots.map(s => [s.trackNo, s]))`
 * and then look up `.get(song.trackNo)` independently per song. A response
 * where two returned songs both claim the SAME trackNo (a duplicate/
 * adversarial or flaky provider response) let BOTH songs reconcile against
 * the identical slot — same genreId/vocalType/tempo/money-chord plan —
 * while whichever slot a different track was actually meant to carry went
 * completely unused, silently (the pack's total song count still balanced,
 * so nothing crashed or looked obviously wrong).
 *
 * This walks `songs` in the given array order and hands each slot to the
 * FIRST song that claims its trackNo; any later song claiming an
 * already-consumed trackNo gets `undefined` back instead — the exact same
 * "no matching slot" outcome an out-of-range/invalid trackNo already
 * produces (reconcileWithPreassignedSlot's own `!slot` branch: defensive
 * genreId re-sanitization only, no slot-forced tempo/vocal/genre/hook
 * contract). Reuses the codebase's one existing "can't trust this trackNo"
 * remedy instead of inventing a second one for duplicates specifically.
 *
 * Keyed by song object identity (not trackNo) in the returned Map, since two
 * colliding songs share the same trackNo and can't both be a key in a
 * `Map<number, ...>`.
 */
export function claimSlotsByTrackNo<T extends { trackNo: number }>(
  songs: readonly T[],
  slots: readonly PreassignedSongSlot[]
): Map<T, PreassignedSongSlot | undefined> {
  const slotByTrackNo = new Map(slots.map(slot => [slot.trackNo, slot]));
  const claimedTrackNos = new Set<number>();
  const claims = new Map<T, PreassignedSongSlot | undefined>();
  for (const song of songs) {
    const slot = slotByTrackNo.get(song.trackNo);
    if (slot && !claimedTrackNos.has(song.trackNo)) {
      claimedTrackNos.add(song.trackNo);
      claims.set(song, slot);
    } else {
      claims.set(song, undefined);
    }
  }
  return claims;
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
  /**
   * TASK (genre-archetype sanitization) — optional so every existing caller
   * that omits it keeps compiling unchanged. When `slot` is present, `song`'s
   * own genreId/genreText is always overwritten by the slot's (already
   * sanitized by preallocateSongSlots — see its own doc comment), so this is
   * a no-op there. It only matters for the `if (!slot) return song` branch
   * below: an out-of-range trackNo (an agent inventing an extra track, or a
   * bridge JSON entry with no matching preassigned slot) returns `song`
   * completely unreconciled — including any genreId it carried — with
   * nothing else in this function to catch it. Passing this lets that one
   * branch sanitize it too instead of silently trusting raw model/import
   * output.
   */
  archetype?: ChannelArchetype;
  /**
   * TASK (lyric language mismatch detection) — the pack's chosen target
   * lyric language (GenerationOptions.lyricLanguage), threaded through so
   * this function — the one choke point every non-local generation path
   * (realtime, Batch API, Claude Code bridge import, individual song
   * regeneration) funnels an AI-produced song through — can check whether
   * `song.lyrics`' actual script matches it. Optional so every existing
   * caller that omits it keeps compiling unchanged and simply skips the
   * check, same as every other optional field here. Unlike a wrong
   * genreId/stylePrompt substring, a language mismatch can't be silently
   * "fixed" here (auto-translating lyrics isn't safe) — see
   * lyricLanguageMismatchWarning's own doc comment for what this does
   * instead (surface a warning, matching how structureWarning/genreWarning
   * already get folded into `song.warnings` below rather than blocking).
   */
  lyricLanguage?: LyricLanguage;
  /**
   * TASK (bilingual pair auto-detection gap) — the pack's expected
   * BilingualPair (core/localGenerator.ts's resolveBilingualPair), threaded
   * through the same way `archetype`/`lyricLanguage` are so
   * lyricLanguageMismatchWarning can validate a 'bilingual' pack against the
   * real expected pair instead of auto-detecting. Optional, same as every
   * other field here — omitting it keeps the old auto-detect fallback.
   */
  bilingualPair?: BilingualPair;
}

/**
 * 지시문 10 (TASK D) — the real, single choke point every provider-written
 * stylePrompt (bridge, Batch API, realtime) already passed through.
 *
 * 지시문 31 (§2) — the actual overlay logic (enforceInstrumentSetInStylePrompt/
 * enforceArrangementDensityInStylePrompt/enforceTempoInStylePrompt/
 * diversifyVocalLedOpening/removeRepeatedInstrumentMentions + the mergeAtom
 * chain) moved verbatim to core/finalPromptNormalizer.ts's
 * normalizeFinalStylePrompt — that module is now the ONE place every raw
 * stylePrompt (this function's bridge/Batch path, promptComposer.ts's local
 * assembly, and the same function again) gets normalized, with two new
 * safety-net passes (collapseSingleDeclarationDuplicates/
 * collapseAdjacentDuplicateWords) added on top that this function's own
 * pre-지시문-31 behavior didn't have. This function is now a thin wrapper —
 * kept under its old name/signature (plus an added optional workspaceId,
 * this file's own only call site immediately below always passes one) so
 * its one real caller (reconcileWithPreassignedSlot) doesn't change shape
 * (§하지 말 것 "normalizeProviderStylePrompt를 남겨둔 채 새 함수를 추가하지
 * 말 것" — the old name survives, the new logic lives in one place).
 */
export function normalizeProviderStylePrompt(rawStylePrompt: string, slot: PreassignedSongSlot, workspaceId: WorkspaceId = 'senior-oldpop'): string {
  return normalizeFinalStylePrompt(rawStylePrompt, slot, promptAxisPolicyFor(workspaceId)).prompt;
}

export function reconcileWithPreassignedSlot(
  song: SongIdea,
  slot: PreassignedSongSlot | undefined,
  titleMode: 'local' | 'ai-creative' = 'ai-creative',
  options: ReconcilePreassignedOptions = {},
  /** TASK v3.33 — see GenerationOptions.hookMode. Kept as its own trailing param (not folded into ReconcilePreassignedOptions) since every non-bridge caller passes it explicitly, the same way titleMode is its own positional param rather than an option. */
  hookMode: 'pool' | 'ai-creative' = 'ai-creative'
): SongIdea {
  // v5.11 (TASK L) — resolved once, used by EVERY return path below
  // (including both no-slot branches just below), so effectiveArchetype/
  // workspaceId are never silently skipped just because a trackNo had no
  // matching slot (e.g. an agent-invented extra track). Falls back to
  // whatever `song` already carried (rare — only when this song was
  // already reconciled once before) and only then to the same
  // 'senior-morning'/'senior-oldpop' defensive default this file's own
  // preallocateSongSlots uses.
  const resolvedArchetype: ChannelArchetype = options.archetype ?? song.effectiveArchetype ?? 'senior-morning';
  const resolvedWorkspaceId: WorkspaceId = workspaceForArchetype(resolvedArchetype)?.id ?? song.workspaceId ?? 'senior-oldpop';
  // TASK (lyric language mismatch detection) — resolved once, used by EVERY
  // return path below (mirrors resolvedArchetype/resolvedWorkspaceId just
  // above), so a wrong-language response can't slip through any one branch
  // this function returns from. undefined whenever the caller didn't pass
  // lyricLanguage (every existing caller before this task).
  // TASK (ratio-based lyric language mismatch) — 'bilingual' USED to always
  // return undefined here unconditionally; now it's checked for real (at
  // least 2 real multi-word lines in English and in whichever of
  // Korean/Japanese is present — see lyricLanguageMismatchWarning's own doc
  // comment in core/lyricMetrics.ts), since a single decorative word in one
  // language is not the "correct, expected mixed-script shape" the old
  // blanket skip assumed.
  const languageWarning = options.lyricLanguage
    ? lyricLanguageMismatchWarning(song.lyrics, options.lyricLanguage, slot?.trackNo ?? song.trackNo, {
        archetype: options.archetype ?? resolvedArchetype,
        bilingualPair: options.bilingualPair
      })
    : undefined;
  // codex 지시문 02 (TASK D) — resolved once, same "every return path" shape
  // as languageWarning just above (undefined whenever there's no slot, since
  // verbatimSceneCopyWarning's own sceneText param is then undefined too —
  // no separate no-slot branching needed).
  const sceneCopyWarning = verbatimSceneCopyWarning(song.lyrics, slot?.lyricThemeText, slot?.trackNo ?? song.trackNo);
  // codex 지시문 03 (TASK G) — resolved once here, same "every return path"
  // shape as languageWarning/sceneCopyWarning above. Defaults to 'english'
  // when the caller didn't pass lyricLanguage (matches every other
  // language-scoped check in this same function's own precedent).
  const metaLeakWarning = lyricMetaLeakWarning(song.lyrics, slot?.trackNo ?? song.trackNo, options.lyricLanguage ?? 'english');
  // codex 지시문 03 (TASK C) — resolved once here, checked against
  // song.stylePrompt (the INCOMING prompt) for the fast-path/no-slot
  // branches below, which never mutate stylePrompt further (fast path's own
  // completeFields precondition means nothing more gets appended; no-slot
  // means there's no plan data to append from at all) — see
  // stylePromptBudget.ts's own doc comment for why the bridge/Batch API
  // paths had zero word-count enforcement before this. The main return path
  // re-checks against the FINAL stylePrompt separately (finalWordBudgetWarning,
  // below) since that one's stylePrompt keeps growing after this point.
  const wordBudgetWarningForIncoming = stylePromptWordBudgetWarning(song.stylePrompt, resolvedWorkspaceId, slot?.trackNo ?? song.trackNo);
  const withLanguageWarning = (warnings: string[]): string[] => {
    const extra = [languageWarning, sceneCopyWarning, metaLeakWarning, wordBudgetWarningForIncoming].filter((w): w is string => typeof w === 'string' && !warnings.includes(w));
    return extra.length ? [...warnings, ...extra] : warnings;
  };
  // codex 지시문 02 (TASK K) — resolved once here (both fast-path and
  // main-path returns below attach these), undefined when there's no slot
  // (no plan data to fingerprint) — see types.ts's SongIdea.promptFingerprint
  // doc comment for why this lives on the slot, not re-derived from `song`.
  const promptFingerprint = slot ? buildPromptFingerprint(slot) : undefined;
  const arrangementRecipe = slot ? buildArrangementRecipe(slot) : undefined;
  // v5.11 (TASK L) — the no-slot fallback for the two per-track "effective"
  // fields: there's no plan data to draw from here, so this reuses
  // whatever `song` already carried, or falls back to 'default'/this
  // song's own raw genreId — never left unset.
  const noSlotEffectiveFields = () => ({
    effectiveMoneyChordId: song.effectiveMoneyChordId || 'default',
    effectiveGenreIds: song.effectiveGenreIds?.length ? song.effectiveGenreIds : (song.genreId ? [song.genreId] : []),
    effectiveArchetype: resolvedArchetype,
    workspaceId: resolvedWorkspaceId,
    // v5.13 (TASK: kidsAgeTierId wiring) — no plan data to draw from here
    // either; reuses whatever `song` already carried, same as the other
    // "effective" fields just above.
    ...(song.effectiveKidsAgeTierId ? { effectiveKidsAgeTierId: song.effectiveKidsAgeTierId } : {})
  });
  if (!slot) {
    // TASK (genre-archetype sanitization) — see ReconcilePreassignedOptions.archetype's
    // own doc comment for why this branch needs its own check: nothing else
    // in this function touches `song` when there's no slot to reconcile
    // against.
    if (!options.archetype || !song.genreId) return { ...song, warnings: withLanguageWarning(song.warnings), ...noSlotEffectiveFields() };
    const { removed } = sanitizeGenreIdsForArchetype([song.genreId], options.archetype);
    if (!removed.length) return { ...song, warnings: withLanguageWarning(song.warnings), ...noSlotEffectiveFields() };
    const warning = genreSanitizationWarningKo(removed, options.archetype);
    return {
      ...song,
      genreId: undefined,
      genreText: undefined,
      warnings: withLanguageWarning(song.warnings.includes(warning) ? song.warnings : [...song.warnings, warning]),
      ...noSlotEffectiveFields(),
      effectiveGenreIds: []
    };
  }
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
  // 지시문 10 (TASK C) — real bug found by TASK F's own fresh-pack
  // measurement: this excludePrompt computation used to live AFTER the fast
  // path below, so a song whose PROMPT happened to already be complete
  // (every locked stylePrompt atom present, exact "N BPM") took the fast
  // path's `...song` passthrough and never reached the genre-differentiation
  // append at all — excludePrompt stayed byte-identical across every song
  // sharing a genre regardless of this fix, exactly the measured bug it was
  // meant to close. stylePrompt completeness and excludePrompt
  // differentiation are independent concerns; computed here, once, so
  // BOTH return paths below get it.
  const genreAvoidTraits = slot.genreId ? getGenreById(slot.genreId)?.avoidTraits : undefined;
  const excludePromptWithNegativeStyle = slot.negativeStyleText
    ? mergeNegativeStyleText(song.excludePrompt, slot.negativeStyleText)
    : song.excludePrompt;
  const excludePrompt = genreAvoidTraits?.length
    ? mergeNegativeStyleText(excludePromptWithNegativeStyle, genreAvoidTraits.join(', '))
    : excludePromptWithNegativeStyle;
  if (completeFields && !startsWithVocal && song.stylePrompt.includes(`${slot.tempo} BPM`)) {
    // v5.11 (TASK L) — this fast path used to skip every other slot-sourced
    // field (moneyChordId, eraTag, arcPhase, ...) below, not just these 5;
    // still true for those pre-existing optional fields, but the 5 new
    // "effective" fields are required and this is a real generation-path
    // return, so they're attached here explicitly rather than inheriting
    // that same silent gap.
    // 지시문 31 (§2-5 실측) — this fast path used to return song.stylePrompt
    // completely untouched, meaning normalizeFinalStylePrompt never ran at
    // all for any "looks complete" prompt — real measurement found this is
    // exactly what a real bridge-imported pack hits almost every time (see
    // core/finalPromptNormalizer.ts's applyNormalizationSafetyNet doc
    // comment for the full trace). The locked-value overlay stays skipped
    // (this path's whole point — trust an already-complete response, don't
    // re-inject), but the removal-only safety net (duplicate single-
    // declaration clauses, adjacent duplicate words, length policy) now
    // always runs — it only ever deletes excess, never injects a new value,
    // so it can't contradict "already complete".
    // 지시문 31 (§2-3 실측 회귀) — core/finalPromptNormalizer.ts의
    // normalizeFinalStylePrompt 자기 doc comment와 같은 이유: slot에 실제
    // vocalText/vocalVariantText가 있으면(completeFields가 이미 그 값이
    // stylePrompt 안에 있다고 확인했으므로) leadVocal 축은 안전망 대상에서
    // 뺀다 — 의도된 duet 복수 어구를 중복으로 오인해 지우지 않기 위해서다.
    const fastPathLeadVocalPresent = Boolean((slot.vocalVariantText || slot.vocalText)?.trim());
    const stylePrompt = applyNormalizationSafetyNet(song.stylePrompt, promptAxisPolicyFor(resolvedWorkspaceId), fastPathLeadVocalPresent ? ['leadVocal'] : []);
    return {
      ...song,
      stylePrompt,
      title,
      hookPhrase,
      excludePrompt,
      // TASK (lyric language mismatch detection) — this fast path otherwise
      // skips every other slot-sourced warning too (see comment above), but
      // language is checked against `song.lyrics` itself, not any
      // stylePrompt-completeness signal this fast path tests for, so it's
      // attached here the same way the "effective" fields are.
      warnings: withLanguageWarning(song.warnings),
      effectiveMoneyChordId: slot.effectiveMoneyChordId,
      effectiveGenreIds: slot.effectiveGenreIds,
      ...(slot.effectiveVocalPresetId ? { effectiveVocalPresetId: slot.effectiveVocalPresetId } : {}),
      ...(slot.effectiveKidsAgeTierId ? { effectiveKidsAgeTierId: slot.effectiveKidsAgeTierId } : {}),
      effectiveArchetype: resolvedArchetype,
      workspaceId: resolvedWorkspaceId,
      ...(promptFingerprint ? { promptFingerprint } : {}),
      ...(arrangementRecipe ? { arrangementRecipe } : {}),
      // 지시문 26 (TASK C) — this fast path's own pre-existing comment
      // (immediately above the `return` this block replaced) admits it
      // "used to skip every other slot-sourced field (moneyChordId, eraTag,
      // arcPhase, ...)... still true for those pre-existing optional
      // fields" — a known, accepted gap for THIS path specifically, going
      // back to when the fast path was first added (v5.11), before most of
      // these fields (killingPoint* v3.68, perceivedEnergy 지시문23,
      // lyricThemeMotionKo/CastKo/EraSettingKo codex 지시문02) even existed
      // — every one of them was added to the main path below without a
      // matching update here. tests/slotFieldRoundTrip.test.ts now exercises
      // BOTH return paths for exactly this reason: a slot-owned field fixed
      // in one path but not the other is still broken for any real response
      // complete enough to take this fast path (this is not a rare case —
      // a fully-compliant LLM response, one that already contains every
      // locked verbatim field, is EXACTLY what triggers this fast path).
      // Mirrors the main path's own conditional-copy list below field for
      // field (except transformations that don't apply to an
      // already-complete song: lyrics vocal-tag normalization/emotionArc
      // fallback/listenerSituation fallback — those are content rewrites,
      // not slot->song field copies, and are intentionally out of this
      // task's "필드 왕복" scope).
      songRole: slot.songRole,
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
      ...(slot.vocalType ? { vocalType: slot.vocalType } : {}),
      ...(slot.eraTag ? { eraTag: slot.eraTag } : {}),
      ...(slot.killingPointText ? { killingPointText: slot.killingPointText } : {}),
      ...(slot.killingPointPlacement ? { killingPointPlacement: slot.killingPointPlacement } : {}),
      ...(slot.killingPointId ? { killingPointId: slot.killingPointId } : {}),
      ...(slot.moneyChordText ? { moneyChordText: slot.moneyChordText } : {}),
      ...(slot.partPlan ? { partPlan: slot.partPlan } : {}),
      ...(slot.sectionStyleShifts ? { sectionStyleShifts: slot.sectionStyleShifts } : {}),
      ...(slot.arcPhase ? { arcPhase: slot.arcPhase } : {}),
      ...(slot.intensity !== undefined ? { intensity: slot.intensity } : {}),
      ...(slot.peakStrength ? { peakStrength: slot.peakStrength } : {}),
      ...(slot.perceivedEnergy !== undefined ? { perceivedEnergy: slot.perceivedEnergy, perceivedEnergyReasonKo: slot.perceivedEnergyReasonKo } : {}),
      bpm: slot.tempo,
      ...(slot.structureTemplate ? { structureTemplate: slot.structureTemplate } : {}),
      ...(slot.moneyChordId ? { moneyChordId: slot.moneyChordId } : {}),
      ...(slot.earwormText ? { earwormText: slot.earwormText } : {}),
      ...(slot.lyricFrameId ? { lyricFrameId: slot.lyricFrameId } : {}),
      ...(slot.lyricThemeMotionKo ? { lyricThemeMotionKo: slot.lyricThemeMotionKo } : {}),
      ...(slot.lyricThemeCastKo ? { lyricThemeCastKo: slot.lyricThemeCastKo } : {}),
      ...(slot.lyricThemeEraSettingKo ? { lyricThemeEraSettingKo: slot.lyricThemeEraSettingKo } : {})
    };
  }
  // 지시문 10 (TASK D) — normalizeProviderStylePrompt (this file, above) is
  // now the one named function every provider-written stylePrompt funnels
  // through for locked-field enforcement (vocal gender, verbatim atoms,
  // instrument set, arrangement density, negative-style stripping, tempo,
  // opening diversification, repeated-instrument cleanup) — see that
  // function's own doc comment for why this stays an overlay on provider
  // prose rather than a from-scratch compile. rawProviderStylePrompt
  // preserves the untouched incoming text as debug metadata (never shown to
  // the user, never re-used downstream) so a real divergence between what
  // the provider wrote and what shipped is always inspectable later.
  const rawProviderStylePrompt = song.stylePrompt;
  const stylePrompt = normalizeProviderStylePrompt(rawProviderStylePrompt, slot, resolvedWorkspaceId);
  // excludePrompt (genre-differentiated, TASK C) was already computed above,
  // before the fast-path branch — see that computation's own doc comment.
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
  // codex 지시문 03 (TASK C) — re-checked here against the FINAL stylePrompt
  // (after every append/enforcement step above), not the earlier
  // wordBudgetWarning (computed on the still-incoming song.stylePrompt,
  // correct only for the fast-path/no-slot branches above which never
  // mutate it further) — the main path's own stylePrompt can grow
  // significantly between those two points.
  const finalWordBudgetWarning = stylePromptWordBudgetWarning(stylePrompt, resolvedWorkspaceId, slot.trackNo);
  // TASK (genre-archetype sanitization) — mirrors structureWarning
  // immediately above: preallocateSongSlots computes this once per pack
  // (trackNo 1's slot only — see PreassignedSongSlot.genreWarning's own doc
  // comment), folded into that one song's own warnings here, the same way
  // every other post-hoc reconciliation warning already surfaces.
  const newWarnings = [structureWarning, slot.genreWarning, languageWarning, sceneCopyWarning, metaLeakWarning, finalWordBudgetWarning].filter(
    (warning): warning is string => typeof warning === 'string' && !song.warnings.includes(warning)
  );
  const warnings = newWarnings.length ? [...song.warnings, ...newWarnings] : song.warnings;
  const listenerSituation = slot.lyricThemeText || song.listenerSituation;
  return {
    ...song,
    songId,
    title,
    hookPhrase,
    stylePrompt,
    ...(rawProviderStylePrompt !== stylePrompt ? { rawProviderStylePrompt } : {}),
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
    // 지시문 26 (TASK A) — killingPointText/killingPointPlacement/peakStrength
    // were missing from this reconciliation entirely (only killingPointId/
    // arcPhase/intensity were copied) despite PreassignedSongSlot already
    // carrying them — the exact "슬롯이 만들었는데 팩에 안 남는" gap this
    // task exists to close. Unconditional override (LLM response's own
    // fields, if any, are ignored — the slot's assignment is truth, per
    // §A-2's own restoration rule).
    ...(slot.killingPointText ? { killingPointText: slot.killingPointText } : {}),
    ...(slot.killingPointPlacement ? { killingPointPlacement: slot.killingPointPlacement } : {}),
    ...(slot.killingPointId ? { killingPointId: slot.killingPointId } : {}),
    ...(slot.moneyChordText ? { moneyChordText: slot.moneyChordText } : {}),
    // 지시문 37 (TASK A-5) — killingPointText 바로 위 사례와 같은 유형:
    // 슬롯의 partPlan은 앱이 배정한 값이고, LLM 응답이 뭘 썼든 이 값이
    // 진실이다(§A-5 "가져오기 시 슬롯에서 복원한다").
    ...(slot.partPlan ? { partPlan: slot.partPlan } : {}),
    ...(slot.sectionStyleShifts ? { sectionStyleShifts: slot.sectionStyleShifts } : {}),
    ...(slot.arcPhase ? { arcPhase: slot.arcPhase } : {}),
    ...(slot.intensity !== undefined ? { intensity: slot.intensity } : {}),
    ...(slot.peakStrength ? { peakStrength: slot.peakStrength } : {}),
    ...(slot.perceivedEnergy !== undefined ? { perceivedEnergy: slot.perceivedEnergy, perceivedEnergyReasonKo: slot.perceivedEnergyReasonKo } : {}),
    bpm: slot.tempo,
    ...(slot.structureTemplate ? { structureTemplate: slot.structureTemplate } : {}),
    ...(slot.moneyChordId ? { moneyChordId: slot.moneyChordId } : {}),
    ...(slot.earwormText ? { earwormText: slot.earwormText } : {}),
    ...(slot.lyricFrameId ? { lyricFrameId: slot.lyricFrameId } : {}),
    // codex 지시문 02 (TASK B) — real gap this closes: SongIdea.lyricThemeMotionKo/
    // lyricThemeCastKo/lyricThemeEraSettingKo have carried a v4.5 doc comment
    // claiming "snapshotted here for the same rating-analysis parity every
    // other lyricTheme field already has" since they were added, but nothing
    // ever actually copied them from slot to song here — only lyricFrameId
    // (the line just above) was. core/situationLedger.ts's richer
    // SceneSignature (motionKo/castKo/eraSettingKo/frameId) needs these real
    // to be worth anything more than the bare frameId it already had.
    ...(slot.lyricThemeMotionKo ? { lyricThemeMotionKo: slot.lyricThemeMotionKo } : {}),
    ...(slot.lyricThemeCastKo ? { lyricThemeCastKo: slot.lyricThemeCastKo } : {}),
    ...(slot.lyricThemeEraSettingKo ? { lyricThemeEraSettingKo: slot.lyricThemeEraSettingKo } : {}),
    // v5.11 (TASK L) — always-populated "what actually went into this song"
    // fields; see each SongIdea field's own doc comment.
    effectiveMoneyChordId: slot.effectiveMoneyChordId,
    effectiveGenreIds: slot.effectiveGenreIds,
    ...(slot.effectiveVocalPresetId ? { effectiveVocalPresetId: slot.effectiveVocalPresetId } : {}),
    ...(slot.effectiveKidsAgeTierId ? { effectiveKidsAgeTierId: slot.effectiveKidsAgeTierId } : {}),
    effectiveArchetype: resolvedArchetype,
    workspaceId: resolvedWorkspaceId,
    ...(promptFingerprint ? { promptFingerprint } : {}),
    ...(arrangementRecipe ? { arrangementRecipe } : {})
  };
}
