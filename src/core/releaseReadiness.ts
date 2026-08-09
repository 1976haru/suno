import type { AudienceProfile, ChannelArchetype, SongIdea } from '../types';
import { runFullAudit, type AuditItem, type AuditStatus } from './fullAudit';
import { checkLyricLineOverlap, checkSceneOverlap, checkSceneSimilarity, checkTitleHistoryCollision } from './duplicationGate';
import { SCENE_SIMILARITY_ADVISORY_THRESHOLD, SCENE_SIMILARITY_BLOCKING_THRESHOLD } from './sceneSimilarity';
import { checkMotifFamilyCooldown, checkMotifFamilyQuota } from './motifFamilyCooldown';
import type { SceneSignature } from './situationLedger';
import { lintEnglishLyrics } from './englishLint';
import { checkTempoWordingContradiction } from './tempoComplianceGate';
import { isDuplicateArrangementRecipe, isDuplicateFingerprint } from './promptFingerprintLedger';
import { RELEASE_READINESS_ITEM_IDS, FULL_AUDIT_ITEM_IDS } from './auditItemIds';
import { checkNegativePromptLength } from './negativePromptSpec';
import { checkTitleHookRelationships } from './titleHookRelationship';
import { checkLyricLanguageMatch } from './lyricMetrics';
import { checkSeniorEraShare, checkSeniorMotifQuotas, checkChordProgressionDominance, countFinalKeyUps, countDistinctIntroTypes, SENIOR_MUSIC_POLICY, SLOT_PLAN_LEDGER_POLICY } from './seniorOldpopPolicy';
import { computeSlotPlanOverlap } from './slotPlanOverlap';
import { checkKr2030OpeningClicheOveruse, checkKr2030ModernMotifQuotas, checkKr2030StructureVariety, findUnexpectedRapSections, checkKr2030Translationese } from './kr2030Policy';
import { findKatakanaOveruse, checkJp2030ModernMotifQuotas, checkJp2030TitleSuffixOveruse, checkJp2030Translationese } from './jp2030Policy';
import { resolveKrKidsExpectedPhasePolicy, findAdultPhaseLeaks, findConsecutivePhaseRuns, checkKrKidsSafety, didacticToneAdvisory } from './krKidsPolicy';
import { findJpKidsAdultPhaseLeaks, findJpKidsConsecutivePhaseRuns, checkJpKidsGenericSafety, checkJpKidsKanaRatio, JP_KIDS_KANA_RATIO_CALIBRATION_STATUS } from './jpKidsPolicy';
import { checkKrIdolMaleFixedQuota, checkKrIdolMaleMotifQuotas, checkKrIdolMaleRapShare, checkKrIdolMaleChantOveruse } from './kpopMalePolicy';
import { checkKrIdolFemaleFixedQuota, checkKrIdolFemaleMotifQuotas, checkKrIdolFemaleRapShare, checkKrIdolFemaleChantOveruse } from './kpopFemalePolicy';
import { parseLyricsSections } from './lyricsAst';
import { DEFAULT_KIDS_AGE_TIER_ID } from '../data/kidsAgeTiers';
import type { VocalQuota } from './vocalPlan';

/**
 * v5.22 (AXIS 4 §4-3) — the task spec's own "무검수 발매 기준": 32 pass/fail
 * criteria a pack must ALL pass before it's safe to publish without manual
 * review. Deliberately built as a thin layer ON TOP of core/fullAudit.ts's
 * runFullAudit (already covers ~20 of these 32 — era share, BPM-vs-profile,
 * genre/vocal variety, arrangement density, situation-all-distinct,
 * emotion-arc variety, vocab repetition, title pattern variety, artist
 * leak, prompt length) rather than re-deriving them, per this whole task's
 * own established "reuse existing checks" convention. Only the genuinely
 * missing criteria (confirmed missing by direct code search before writing
 * this file) get NEW checks here: modulation count, intro-type variety,
 * cross-set situation/lyric-line dedup (AXIS 1's core/duplicationGate.ts),
 * subject/material cap, in-song sentence repetition + English grammar
 * (AXIS 3's core/englishLint.ts), exact title=hook count band, full-library
 * title dedup (AXIS 1 again), excludePrompt length, and tempo-wording-vs-BPM
 * contradiction (AXIS 2's core/tempoComplianceGate.ts).
 *
 * IMPORTANT threshold note: fullAudit.ts's own existing items use THEIR
 * OWN, independently-set thresholds for some of the same real-world
 * measurements this task's own §4-3 names a different number for (era
 * share: fullAudit's ERA_POLICY.singlePrimaryMin is 50%, this task's own
 * spec asks 65%; genre count ceiling: fullAudit allows up to 9, spec asks
 * <=7 (5 max per genre matches); emotion-arc variety: fullAudit requires
 * >=8, spec asks >=3 (a LOOSER bar)). This module does NOT silently
 * override fullAudit's own thresholds (that risks fullAudit's own existing
 * test suite and its own, separately-justified reasoning) — it reports
 * BOTH the fullAudit result and, where the spec's own number is stricter,
 * an ADDITIONAL check against the spec's own literal number. See each
 * item's own `detail` for which threshold actually gated it.
 */

/**
 * codex 지시문 05 (TASK F) — real measurement-axis taxonomy, replacing
 * "고정 750~850자 exclude 기준"/"제목=훅 exact 개수" as the deciding signal
 * for release readiness with a broader set of real axes. Every existing
 * item (fullAudit.ts's own ~40 checks plus this file's own ~15) already
 * measures one of these axes in substance — this is a real classification
 * of what already exists, not a promise of 10 brand-new check families.
 * 'safety'/'workspace-policy' are deliberately NOT populated with items in
 * THIS file — core/finalizeBlueprint.ts's own separate schema/workspace-
 * policy validate steps (TASK B, steps 1/4) cover those axes at the whole-
 * pipeline level, so this file doesn't duplicate them with a second,
 * possibly-diverging copy.
 */
export type ReleaseReadinessCategory =
  | 'structural' | 'contract' | 'language' | 'workspace-policy' | 'novelty'
  | 'prompt-consistency' | 'lyric-naturalness' | 'safety' | 'title-hook-relationship' | 'export-completeness';

const CATEGORY_BY_ITEM_ID: Record<string, ReleaseReadinessCategory> = {
  [FULL_AUDIT_ITEM_IDS.songCount]: 'structural',
  [FULL_AUDIT_ITEM_IDS.genreVariety]: 'structural',
  [FULL_AUDIT_ITEM_IDS.genreMax5]: 'structural',
  [FULL_AUDIT_ITEM_IDS.genreNoSingleton]: 'structural',
  [FULL_AUDIT_ITEM_IDS.genreNoTripleRun]: 'structural',
  [FULL_AUDIT_ITEM_IDS.bpmStddev]: 'structural',
  [FULL_AUDIT_ITEM_IDS.bpmInRange]: 'structural',
  [FULL_AUDIT_ITEM_IDS.vocalDistribution]: 'structural',
  [FULL_AUDIT_ITEM_IDS.vocalZoneMax3]: 'structural',
  [FULL_AUDIT_ITEM_IDS.vocalNoTripleRun]: 'structural',
  [FULL_AUDIT_ITEM_IDS.vocalDescPresent]: 'structural',
  [FULL_AUDIT_ITEM_IDS.femaleGenderExplicit]: 'structural',
  [FULL_AUDIT_ITEM_IDS.vocalDescVariety]: 'structural',
  [FULL_AUDIT_ITEM_IDS.promptLength]: 'prompt-consistency',
  [FULL_AUDIT_ITEM_IDS.descriptorCount]: 'prompt-consistency',
  [FULL_AUDIT_ITEM_IDS.sharedAtoms]: 'prompt-consistency',
  [FULL_AUDIT_ITEM_IDS.eraContradiction]: 'prompt-consistency',
  [FULL_AUDIT_ITEM_IDS.labelLeak]: 'prompt-consistency',
  [FULL_AUDIT_ITEM_IDS.artistLeak]: 'safety',
  [FULL_AUDIT_ITEM_IDS.durationDup]: 'prompt-consistency',
  [FULL_AUDIT_ITEM_IDS.lyricWordCount]: 'structural',
  [FULL_AUDIT_ITEM_IDS.sectionCount]: 'structural',
  [FULL_AUDIT_ITEM_IDS.situationAllDistinct]: 'novelty',
  [FULL_AUDIT_ITEM_IDS.emotionArcVariety]: 'novelty',
  [FULL_AUDIT_ITEM_IDS.arrangementVocabLeak]: 'lyric-naturalness',
  [FULL_AUDIT_ITEM_IDS.titleLineLeak]: 'lyric-naturalness',
  [FULL_AUDIT_ITEM_IDS.placeholderLeak]: 'lyric-naturalness',
  [FULL_AUDIT_ITEM_IDS.grammarArticleErrors]: 'lyric-naturalness',
  [FULL_AUDIT_ITEM_IDS.introLeak]: 'lyric-naturalness',
  [FULL_AUDIT_ITEM_IDS.endTagLeak]: 'lyric-naturalness',
  [FULL_AUDIT_ITEM_IDS.vocabRepeatMax20]: 'lyric-naturalness',
  [FULL_AUDIT_ITEM_IDS.hookWordOveruse]: 'lyric-naturalness',
  [FULL_AUDIT_ITEM_IDS.vocabRepeatAdvisory]: 'lyric-naturalness',
  [FULL_AUDIT_ITEM_IDS.vocabRepeatBlocking]: 'lyric-naturalness',
  [FULL_AUDIT_ITEM_IDS.killingPointAssigned]: 'structural',
  [FULL_AUDIT_ITEM_IDS.killingPointVariety]: 'structural',
  [FULL_AUDIT_ITEM_IDS.arcPhaseAllUsed]: 'structural',
  [FULL_AUDIT_ITEM_IDS.peakNoneCount]: 'structural',
  [FULL_AUDIT_ITEM_IDS.titlePatternVariety]: 'title-hook-relationship',
  [FULL_AUDIT_ITEM_IDS.titlePatternMax4]: 'title-hook-relationship',
  [FULL_AUDIT_ITEM_IDS.hookConnectedTitle]: 'title-hook-relationship',
  [FULL_AUDIT_ITEM_IDS.promiseFulfillment]: 'contract',
  [FULL_AUDIT_ITEM_IDS.realDurationRange]: 'export-completeness',
  [FULL_AUDIT_ITEM_IDS.killingPointAmplitude]: 'export-completeness',
  [FULL_AUDIT_ITEM_IDS.workspaceIsolation]: 'workspace-policy',
  [RELEASE_READINESS_ITEM_IDS.sceneRecentSetOverlap]: 'novelty',
  [RELEASE_READINESS_ITEM_IDS.sceneRecentSetSimilarity]: 'novelty',
  [RELEASE_READINESS_ITEM_IDS.slotPlanOverlap]: 'novelty',
  [RELEASE_READINESS_ITEM_IDS.titleFullHistoryCollision]: 'novelty',
  [RELEASE_READINESS_ITEM_IDS.lyricLineRecentSetOverlap]: 'novelty',
  [RELEASE_READINESS_ITEM_IDS.promptFingerprintRecentSetOverlap]: 'novelty',
  [RELEASE_READINESS_ITEM_IDS.arrangementRecipeRecentSetOverlap]: 'novelty',
  [RELEASE_READINESS_ITEM_IDS.motifFamilyRecentPackCooldown]: 'novelty',
  [RELEASE_READINESS_ITEM_IDS.englishGrammarErrors]: 'lyric-naturalness',
  [RELEASE_READINESS_ITEM_IDS.inSongLineRepetition]: 'lyric-naturalness',
  [RELEASE_READINESS_ITEM_IDS.tempoWordingContradiction]: 'prompt-consistency',
  [RELEASE_READINESS_ITEM_IDS.sameSubjectCap]: 'novelty',
  [RELEASE_READINESS_ITEM_IDS.modulationCount]: 'structural',
  [RELEASE_READINESS_ITEM_IDS.introTypeVariety]: 'structural',
  [RELEASE_READINESS_ITEM_IDS.titleHookDisconnectedQuota]: 'title-hook-relationship',
  [RELEASE_READINESS_ITEM_IDS.negativePromptLength]: 'prompt-consistency',
  [RELEASE_READINESS_ITEM_IDS.languageMatch]: 'language',
  [RELEASE_READINESS_ITEM_IDS.exportFieldCompleteness]: 'export-completeness',
  [RELEASE_READINESS_ITEM_IDS.seniorEraShare]: 'structural',
  [RELEASE_READINESS_ITEM_IDS.seniorMotifQuota]: 'workspace-policy',
  [RELEASE_READINESS_ITEM_IDS.seniorChordDominance]: 'structural',
  [RELEASE_READINESS_ITEM_IDS.kr2030OpeningCliche]: 'workspace-policy',
  [RELEASE_READINESS_ITEM_IDS.kr2030ModernMotif]: 'workspace-policy',
  [RELEASE_READINESS_ITEM_IDS.kr2030StructureVariety]: 'structural',
  [RELEASE_READINESS_ITEM_IDS.kr2030UnexpectedRap]: 'structural',
  [RELEASE_READINESS_ITEM_IDS.kr2030Translationese]: 'lyric-naturalness',
  [RELEASE_READINESS_ITEM_IDS.jp2030KatakanaOveruse]: 'language',
  [RELEASE_READINESS_ITEM_IDS.jp2030ModernMotif]: 'workspace-policy',
  [RELEASE_READINESS_ITEM_IDS.jp2030TitleSuffixOveruse]: 'title-hook-relationship',
  [RELEASE_READINESS_ITEM_IDS.jp2030Translationese]: 'lyric-naturalness',
  [RELEASE_READINESS_ITEM_IDS.krKidsPhasePolicy]: 'structural',
  [RELEASE_READINESS_ITEM_IDS.krKidsConsecutivePhase]: 'structural',
  [RELEASE_READINESS_ITEM_IDS.krKidsSafety]: 'safety',
  [RELEASE_READINESS_ITEM_IDS.krKidsDidacticTone]: 'lyric-naturalness',
  [RELEASE_READINESS_ITEM_IDS.jpKidsPhasePolicy]: 'structural',
  [RELEASE_READINESS_ITEM_IDS.jpKidsConsecutivePhase]: 'structural',
  [RELEASE_READINESS_ITEM_IDS.jpKidsSafety]: 'safety',
  [RELEASE_READINESS_ITEM_IDS.jpKidsKanaRatio]: 'language',
  [RELEASE_READINESS_ITEM_IDS.kpopQuotaFidelity]: 'workspace-policy',
  [RELEASE_READINESS_ITEM_IDS.kpopMotifQuota]: 'workspace-policy',
  [RELEASE_READINESS_ITEM_IDS.kpopRapShare]: 'structural',
  [RELEASE_READINESS_ITEM_IDS.kpopConsecutiveLead]: 'structural',
  [RELEASE_READINESS_ITEM_IDS.kpopChantOveruse]: 'lyric-naturalness'
};

function categoryForItemId(id: string): ReleaseReadinessCategory {
  return CATEGORY_BY_ITEM_ID[id] ?? 'structural';
}

export interface ReleaseReadinessItem {
  id: string;
  categoryKo: string;
  category: ReleaseReadinessCategory;
  labelKo: string;
  status: AuditStatus;
  detail: string;
  notImplemented?: boolean;
  /**
   * v5.23 (TASK C §3-6) — true when this specific item was computed with
   * `explorationTrackNos` excluded from the pack (see STYLE_ALLOCATION_ITEM_IDS
   * below and this file's own evaluateReleaseReadiness doc comment).
   */
  exempted?: boolean;
}

export interface ReleaseReadinessReport {
  items: ReleaseReadinessItem[];
  totalCriteria: number;
  passedCriteria: number;
  /** true only when every one of the 32 items is 'pass' — spec's own "32개 기준 전부 통과". A 'not-measured'/notImplemented item counts as NOT passed (conservative — never silently treated as passing). */
  releaseReady: boolean;
  failing: ReleaseReadinessItem[];
  /** v5.23 (TASK C §3-6) — how many tracks were excluded from the style-allocation items above (0 for every non-senior-oldpop pack, or a senior-oldpop pack with no exploration slots). Drives the UI's own "발매 가능 (탐색 N곡 포함)" badge. */
  explorationExemptCount: number;
  /**
   * codex 지시문 05 (TASK F/H) — the real "측정 기준 X/Y 통과, 감사 범위 X/32,
   * 미측정 N개" three-number shape, computed here (single source) instead of
   * ad hoc in SetCompletenessPanel.tsx (that panel's own 2-number version —
   * measurablePassed/measurableTotal — is now just this same data, read
   * from here rather than re-derived). `unmeasuredCount` is the real
   * `notImplemented` item count — never silently folded into "passed".
   */
  measuredCriteria: number;
  passedOfMeasured: number;
  unmeasuredCount: number;
}

function fromAuditItem(item: AuditItem, categoryKo: string): ReleaseReadinessItem {
  return {
    id: item.id,
    categoryKo,
    category: categoryForItemId(item.id),
    labelKo: item.labelKo,
    status: item.status,
    detail: `${item.targetKo} → ${item.actualKo}`,
    notImplemented: item.notImplemented
  };
}

export interface ReleaseReadinessInput {
  songs: SongIdea[];
  conceptLabel: string;
  songCount: number;
  audienceProfile: AudienceProfile;
  lyricLanguage: 'english' | 'korean' | 'japanese' | 'bilingual';
  /** codex 지시문 05 (TASK F) — channel.archetype, threaded through to checkNegativePromptLength (kids archetypes get a real, different — currently unenforced — exempt band there). Optional: omitted callers get the non-kids band, same as every archetype-unaware caller before this task. */
  archetype?: string;
  /**
   * 정합성 점검 §1 결함2 fix — channel.vocalQuotaOverride (e.g. kr-idol-male's
   * {male:15,female:0,mixed:3}), threaded through to runFullAudit's
   * vocalItems so the generic 25~42%-per-type/zone/consecutive-run checks
   * don't permanently fail a correctly-generated fixed-quota pack. Mirrors
   * designGate.ts's own vocalQuotaOverride-aware branch (6bc2633) — before
   * this fix, kr-idol-male/female could pass designGate but never reach
   * releaseReady:true because this module's own vocal checks stayed
   * archetype-blind. Optional: omitted callers (every non-quota-override
   * channel) get the unchanged generic checks.
   */
  vocalQuotaOverride?: VocalQuota;
  /**
   * AXIS 1 ledger history — optional; the cross-set items report
   * 'not-measured' (not a silent pass) when omitted.
   * codex 지시문 02 (TASK K) — recentFingerprints/recentArrangementRecipes
   * are core/promptFingerprintLedger.ts's own recentFingerprints(channelId)/
   * recentArrangementRecipes(channelId) output, same "pre-fetched by the
   * caller" convention as recentSituations/recentLyricLines just above.
   * Optional independently of those two (a caller might have scene/line
   * history but not yet be passing fingerprint history, or vice versa).
   */
  duplicationHistory?: {
    recentSituations: string[];
    recentLyricLines: string[];
    historicalTitles: Set<string>;
    recentFingerprints?: string[];
    recentArrangementRecipes?: string[];
    /**
     * codex 지시문 02 (TASK B) — core/situationLedger.ts's own
     * recentSceneSignatures(channelId, language) output, richer than the
     * bare recentSituations strings above (see SceneSignature's own doc
     * comment). Drives the new advisory-tier near-miss check
     * (checkSceneSimilarity) alongside checkSceneOverlap's existing
     * exact-match one — independently optional, same reasoning as
     * recentFingerprints above.
     */
    recentSceneSignatures?: SceneSignature[];
  };
  /**
   * v5.23 (TASK C §3-6) — core/explorationSlots.ts's own resolved
   * ExplorationSlotPlan.trackNos for THIS pack (senior-oldpop only —
   * every other workspace never has any, so this parameter is simply
   * omitted there). Exploration slots deliberately waive style-allocation
   * rules (BPM position, genre/vocal distribution — TASK C's own doc
   * comment) while keeping every safety/quality constraint, so a pack that
   * would otherwise fail a style item ONLY because of its own exploration
   * tracks should not be blocked from release over exactly the
   * intentional deviation those tracks were told to attempt.
   */
  explorationTrackNos?: number[];
}

/**
 * v5.23 (TASK C §3-6) — the real, checkable subset of fullAudit.ts's own
 * item ids that measure STYLE ALLOCATION (BPM position/spread, genre
 * distribution, vocal distribution) — never safety/quality items
 * (duplication, English grammar, artist leaks, prompt hygiene all stay
 * fully enforced on exploration tracks too, per TASK C's own "안전 제약은
 * 그대로 유지"). Deliberately NOT copied from core/rewriteLoop.ts's own
 * (formerly broken) DESIGN_SCOPED_ITEM_IDS — that set used to hand-type
 * hyphenated guesses ('era-primary-share', 'bpm-in-range') that didn't
 * match fullAudit.ts's real, underscored ids ('bpm_in_range'), so reusing
 * it here would have silently exempted nothing. codex 지시문 05 (TASK C)
 * fixed that drift at its source — both this set and rewriteLoop.ts's own
 * now read from the same core/auditItemIds.ts registry.
 */
const STYLE_ALLOCATION_ITEM_IDS = new Set<string>([
  FULL_AUDIT_ITEM_IDS.bpmStddev, FULL_AUDIT_ITEM_IDS.bpmInRange,
  FULL_AUDIT_ITEM_IDS.genreVariety, FULL_AUDIT_ITEM_IDS.genreMax5, FULL_AUDIT_ITEM_IDS.genreNoSingleton, FULL_AUDIT_ITEM_IDS.genreNoTripleRun,
  FULL_AUDIT_ITEM_IDS.vocalDistribution, FULL_AUDIT_ITEM_IDS.vocalZoneMax3, FULL_AUDIT_ITEM_IDS.vocalNoTripleRun
]);

// TASK spec's own §4-3 "제목=훅 일치 8~10곡" band.
const TITLE_EQUALS_HOOK_TARGET = { min: 8, max: 10 };
// 지시문 10 (TASK C-2) — real dead code: this constant's only real consumer
// was replaced by core/negativePromptSpec.ts's own checkNegativePromptLength
// (지시문 05 TASK F, see the negativePromptLength item further down this
// file) — nothing has read EXCLUDE_PROMPT_TARGET since. Removed rather than
// left as a second, silently-stale "750~850자" band sitting next to the
// real one (core/promptComposer.ts's EXCLUDE_PROMPT_SAFE_TARGET/HARD_CAP,
// which the bridge schema text now references directly — see that file's
// own songOutputShape doc comment).
// codex 지시문 02 (TASK C) — TASK spec's own §4-3 "같은 소재 <= 4곡" is now
// checked by core/motifFamilyCooldown.ts's checkMotifFamilyQuota, grouped
// by data/motifFamilies.ts's own real family-per-frameId registry, rather
// than the exact-lyricTheme-id approximation formerly hardcoded here.

/**
 * codex 지시문 05 (TASK F) — every push site below builds an item without
 * its own `category` (computed once, uniformly, from `id` via
 * categoryForItemId at the very end of this function) rather than hand-
 * annotating ~25 call sites individually — one real source for the id ->
 * category mapping (auditItemIds.ts-adjacent CATEGORY_BY_ITEM_ID above),
 * not 25 chances to drift.
 */
function newItems(input: ReleaseReadinessInput): ReleaseReadinessItem[] {
  const { songs, duplicationHistory, lyricLanguage, archetype, conceptLabel, explorationTrackNos } = input;
  const items: Omit<ReleaseReadinessItem, 'category'>[] = [];

  // Gate 1 (AXIS 1) — scene vs. recent-set history, title vs. full history.
  if (duplicationHistory) {
    const sceneOverlap = checkSceneOverlap(songs, duplicationHistory.recentSituations);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.sceneRecentSetOverlap, categoryKo: '가사', labelKo: '최근 5세트와 장면 중복 0건',
      status: sceneOverlap.blocking ? 'fail' : 'pass',
      detail: sceneOverlap.blocking ? `중복 ${sceneOverlap.collisions.length}건: T${sceneOverlap.collisions.map(c => c.trackNo).join(', T')}` : '중복 0건'
    });
    // codex 지시문 02 (TASK B) — NEW near-miss advisory signal, alongside
    // (never replacing) the exact-match check just above. Only runs when
    // the caller passed the richer recentSceneSignatures; independently
    // optional of recentSituations, so this can be 'not-measured' even when
    // the exact-match item above is genuinely measured.
    if (duplicationHistory.recentSceneSignatures) {
      const similarity = checkSceneSimilarity(songs, duplicationHistory.recentSceneSignatures);
      const status = similarity.blocking ? 'fail' : 'pass';
      const detailParts: string[] = [];
      if (similarity.blockingMatches.length) {
        detailParts.push(`근접 일치(임계값 ${Math.round(SCENE_SIMILARITY_BLOCKING_THRESHOLD * 100)}% 이상) ${similarity.blockingMatches.length}건: T${similarity.blockingMatches.map(m => `${m.trackNo}(${Math.round(m.score * 100)}%)`).join(', T')}`);
      }
      if (similarity.advisoryMatches.length) {
        detailParts.push(`참고용 유사 ${similarity.advisoryMatches.length}건(${Math.round(SCENE_SIMILARITY_ADVISORY_THRESHOLD * 100)}~${Math.round(SCENE_SIMILARITY_BLOCKING_THRESHOLD * 100)}%, 발매를 막지 않음): T${similarity.advisoryMatches.map(m => `${m.trackNo}(${Math.round(m.score * 100)}%)`).join(', T')}`);
      }
      items.push({
        id: RELEASE_READINESS_ITEM_IDS.sceneRecentSetSimilarity, categoryKo: '가사', labelKo: '최근 세트와 장면 유사도(근접 재사용) 없음',
        status,
        detail: detailParts.length ? detailParts.join(' / ') : '유사 장면 없음'
      });
    } else {
      items.push({ id: RELEASE_READINESS_ITEM_IDS.sceneRecentSetSimilarity, categoryKo: '가사', labelKo: '최근 세트와 장면 유사도(근접 재사용) 없음', status: 'not-measured', detail: 'duplicationHistory.recentSceneSignatures 없이 호출됨 — 실제 이력 대조 없이는 판정 불가', notImplemented: false });
    }
    // 지시문 10 (TASK B-4-2) — "같은 배정표가 재사용되는 것을 탐지할 방법이 지금
    // 없다": distinct from sceneRecentSetOverlap/sceneRecentSetSimilarity just
    // above (those flag an individual scene reused ANYWHERE in the recent
    // history) — this flags a NEW set's whole per-trackNo assignment table
    // (lyricTheme/situation) matching a SINGLE recent set's, position-aware.
    // Real measured trigger: two concept-distinct real packs landed 18/18
    // same-trackNo theme + 14/18 same-trackNo situation. 60%/80% thresholds
    // are the directive's own unvalidated estimates (core/seniorOldpopPolicy.ts's
    // SLOT_PLAN_LEDGER_POLICY) — advisory at warn, blocking at block.
    if (duplicationHistory.recentSceneSignatures) {
      const overlap = computeSlotPlanOverlap(
        songs.map(s => ({ trackNo: s.trackNo, lyricTheme: s.lyricTheme, situation: s.listenerSituation })),
        duplicationHistory.recentSceneSignatures
      );
      items.push({
        id: RELEASE_READINESS_ITEM_IDS.slotPlanOverlap, categoryKo: '가사', labelKo: `배정표(trackNo→테마·장면) 재사용 없음 (경고 ${SLOT_PLAN_LEDGER_POLICY.warnShare * 100}%· 차단 ${SLOT_PLAN_LEDGER_POLICY.blockShare * 100}%, 추정치)`,
        status: overlap.verdict === 'block' ? 'fail' : 'pass',
        detail: overlap.worstMatch
          ? `최고 일치 팩 ${overlap.worstMatch.packId} — ${Math.round(overlap.worstMatch.overlapShare * 100)}% (T${overlap.worstMatch.matchedTrackNos.join(', T')}) — ${overlap.verdict.toUpperCase()}`
          : '재사용 없음'
      });
    } else {
      items.push({ id: RELEASE_READINESS_ITEM_IDS.slotPlanOverlap, categoryKo: '가사', labelKo: '배정표(trackNo→테마·장면) 재사용 없음', status: 'not-measured', detail: 'duplicationHistory.recentSceneSignatures 없이 호출됨 — 실제 이력 대조 없이는 판정 불가', notImplemented: false });
    }
    const titleCollision = checkTitleHistoryCollision(songs, duplicationHistory.historicalTitles);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.titleFullHistoryCollision, categoryKo: '제목', labelKo: '전체 이력과 제목 중복 0건',
      status: titleCollision.blocking ? 'fail' : 'pass',
      detail: titleCollision.blocking ? `중복 ${titleCollision.collisions.length}건: T${titleCollision.collisions.map(c => c.trackNo).join(', T')}` : '중복 0건'
    });
    const lineOverlap = checkLyricLineOverlap(songs, duplicationHistory.recentLyricLines);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.lyricLineRecentSetOverlap, categoryKo: '가사', labelKo: '최근 세트와 가사 문장 완전일치 0건',
      status: lineOverlap.matches.length > 0 ? 'fail' : 'pass',
      detail: lineOverlap.matches.length ? `일치 ${lineOverlap.matches.length}건 (3개 이상이면 세트 전체 불신)` : '일치 0건'
    });
  } else {
    for (const [id, labelKo] of [
      [RELEASE_READINESS_ITEM_IDS.sceneRecentSetOverlap, '최근 5세트와 장면 중복 0건'],
      [RELEASE_READINESS_ITEM_IDS.slotPlanOverlap, '배정표(trackNo→테마·장면) 재사용 없음'],
      [RELEASE_READINESS_ITEM_IDS.titleFullHistoryCollision, '전체 이력과 제목 중복 0건'],
      [RELEASE_READINESS_ITEM_IDS.lyricLineRecentSetOverlap, '최근 세트와 가사 문장 완전일치 0건']
    ] as const) {
      items.push({ id, categoryKo: '가사', labelKo, status: 'not-measured', detail: 'duplicationHistory 없이 호출됨 — 실제 이력 대조 없이는 판정 불가', notImplemented: false });
    }
  }

  // codex 지시문 02 (TASK K) — prompt-fingerprint / arrangement-recipe
  // cross-set duplication, independent of the scene/title/line gate above
  // (a caller may have one history without the other yet — see
  // ReleaseReadinessInput.duplicationHistory's own doc comment).
  if (duplicationHistory?.recentFingerprints) {
    const recent = duplicationHistory.recentFingerprints;
    const dupTracks = songs.filter(song => isDuplicateFingerprint(song.promptFingerprint, recent)).map(song => song.trackNo);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.promptFingerprintRecentSetOverlap, categoryKo: '구성', labelKo: '최근 10세트와 프롬프트 지문(장르·템포·보컬·인트로·진행·훅장치·전조·밀도) 중복 0건',
      status: dupTracks.length ? 'fail' : 'pass',
      detail: dupTracks.length ? `중복 ${dupTracks.length}건: T${dupTracks.join(', T')}` : '중복 0건'
    });
  } else {
    items.push({ id: RELEASE_READINESS_ITEM_IDS.promptFingerprintRecentSetOverlap, categoryKo: '구성', labelKo: '최근 10세트와 프롬프트 지문 중복 0건', status: 'not-measured', detail: 'duplicationHistory.recentFingerprints 없이 호출됨 — 실제 이력 대조 없이는 판정 불가', notImplemented: false });
  }
  if (duplicationHistory?.recentArrangementRecipes) {
    const recent = duplicationHistory.recentArrangementRecipes;
    const dupTracks = songs.filter(song => isDuplicateArrangementRecipe(song.arrangementRecipe, recent)).map(song => song.trackNo);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.arrangementRecipeRecentSetOverlap, categoryKo: '구성', labelKo: '최근 5세트와 편곡 레시피(인트로·밀도·악기 구성) 중복 0건',
      status: dupTracks.length ? 'fail' : 'pass',
      detail: dupTracks.length ? `중복 ${dupTracks.length}건: T${dupTracks.join(', T')}` : '중복 0건'
    });
  } else {
    items.push({ id: RELEASE_READINESS_ITEM_IDS.arrangementRecipeRecentSetOverlap, categoryKo: '구성', labelKo: '최근 5세트와 편곡 레시피 중복 0건', status: 'not-measured', detail: 'duplicationHistory.recentArrangementRecipes 없이 호출됨 — 실제 이력 대조 없이는 판정 불가', notImplemented: false });
  }

  // English grammar + in-song line repetition (AXIS 3) — English-only, same convention core/quality.ts's own scoreSong wiring already follows.
  if (lyricLanguage === 'english') {
    let blockingCount = 0;
    let repetitionCount = 0;
    for (const song of songs) {
      const lint = lintEnglishLyrics(song.lyrics, song.hookPhrase);
      blockingCount += lint.issues.filter(i => i.severity === 'blocking' && i.id !== RELEASE_READINESS_ITEM_IDS.inSongLineRepetition).length;
      repetitionCount += lint.issues.filter(i => i.id === RELEASE_READINESS_ITEM_IDS.inSongLineRepetition).length;
    }
    items.push({ id: RELEASE_READINESS_ITEM_IDS.englishGrammarErrors, categoryKo: '가사', labelKo: '영어 문법 오류 0건', status: blockingCount === 0 ? 'pass' : 'fail', detail: `${blockingCount}건 감지` });
    items.push({ id: RELEASE_READINESS_ITEM_IDS.inSongLineRepetition, categoryKo: '가사', labelKo: '한 곡 내 문장 반복 0건', status: repetitionCount === 0 ? 'pass' : 'fail', detail: `${repetitionCount}건 감지` });
  } else {
    items.push({ id: RELEASE_READINESS_ITEM_IDS.englishGrammarErrors, categoryKo: '가사', labelKo: '영어 문법 오류 0건', status: 'not-measured', detail: '영어 팩이 아님', notImplemented: false });
    items.push({ id: RELEASE_READINESS_ITEM_IDS.inSongLineRepetition, categoryKo: '가사', labelKo: '한 곡 내 문장 반복 0건', status: 'not-measured', detail: '영어 팩이 아님 — englishLint는 영어 전용', notImplemented: false });
  }

  // Tempo-wording contradiction (AXIS 2).
  const tempoContradictions = songs.filter(song => typeof song.bpm === 'number' && checkTempoWordingContradiction(song.stylePrompt, song.bpm).length > 0);
  items.push({
    id: RELEASE_READINESS_ITEM_IDS.tempoWordingContradiction, categoryKo: '음악 설계', labelKo: '템포 서술과 BPM 모순 0건',
    status: tempoContradictions.length === 0 ? 'pass' : 'fail',
    detail: tempoContradictions.length ? `T${tempoContradictions.map(s => s.trackNo).join(', T')}` : '모순 0건'
  });

  // codex 지시문 05 (TASK F) — replaces the old "제목=훅 exact 개수" 8~10곡
  // hard band with core/titleHookRelationship.ts's own real, already-
  // calibrated quota (지시문 03 TASK I): fails only when the pack has more
  // genuinely DISCONNECTED titles than its own real per-songCount quota
  // allows — a title matching the hook exactly, nearly, or semantically all
  // still count as connected; only 'disconnected' ever counts against the
  // quota, so this no longer arbitrarily penalizes a pack for having, say,
  // 11 or 7 exact matches instead of the old fixed 8~10 window.
  const titleHookReport = checkTitleHookRelationships(songs.map(song => ({ trackNo: song.trackNo, title: song.title, hookPhrase: song.hookPhrase })));
  items.push({
    id: RELEASE_READINESS_ITEM_IDS.titleHookDisconnectedQuota, categoryKo: '제목', labelKo: '제목-훅 연결 (disconnected 쿼터 이내)',
    status: titleHookReport.disconnectedOverQuota ? 'fail' : 'pass',
    detail: `disconnected ${titleHookReport.disconnectedCount}곡`
  });

  // codex 지시문 05 (TASK F) — replaces the old fixed excludePrompt 750~850자
  // hard band with core/negativePromptSpec.ts's own real, already-built
  // advisory-tier length check (지시문 03 TASK D: recommendedMax/advisoryMax,
  // kids workspaces exempt) — only a genuinely 'blocking'-severity excludePrompt
  // fails here; 'advisory'/'ok' both pass (an 'advisory' detail is still
  // surfaced, just never blocks release on its own).
  const excludeSeverities = songs
    .filter(song => (song.excludePrompt ?? '').length > 0)
    .map(song => ({ trackNo: song.trackNo, severity: checkNegativePromptLength(song.excludePrompt ?? '', input.archetype) }));
  const blockingExcludes = excludeSeverities.filter(s => s.severity === 'blocking');
  const advisoryExcludes = excludeSeverities.filter(s => s.severity === 'advisory');
  // 결함5 전수 재검토 — labelKo가 약속하는 조건("blocking 0건")과 실제
  // status 계산이 어긋나 있었다: 팩의 모든 곡이 excludePrompt를 아예 갖고
  // 있지 않으면(excludeSeverities.length === 0) blocking 건수가 자명하게
  // 0인데도 무조건 'fail'로 표시됐다 — 라벨이 약속하지 않은 "excludePrompt가
  // 하나 이상 존재해야 한다"는 조건이 몰래 섞여 있었던 것. 라벨 그대로,
  // blocking 건수만으로 판정하도록 수정.
  items.push({
    id: RELEASE_READINESS_ITEM_IDS.negativePromptLength, categoryKo: '프롬프트', labelKo: 'excludePrompt 길이 (blocking 0건)',
    status: blockingExcludes.length === 0 ? 'pass' : 'fail',
    detail: excludeSeverities.length
      ? `blocking ${blockingExcludes.length}곡 / advisory ${advisoryExcludes.length}곡`
      : 'excludePrompt 없음'
  });

  // codex 지시문 05 (TASK F) — genuinely new "language" category item: does
  // the final generated lyric text actually match the pack's own declared
  // lyricLanguage, aggregated across the whole pack (real per-song
  // core/lyricMetrics.ts checkLyricLanguageMatch, already used elsewhere in
  // this file's own STYLE_ALLOCATION-adjacent checks — not reimplemented).
  if (lyricLanguage === 'bilingual') {
    items.push({ id: RELEASE_READINESS_ITEM_IDS.languageMatch, categoryKo: '언어', labelKo: '언어 일치 (bilingual)', status: 'not-measured', detail: 'bilingual 팩은 단일 언어 비율 검사 대상이 아님', notImplemented: false });
  } else {
    const languageMismatches = songs.filter(song => {
      const check = checkLyricLanguageMatch(song.lyrics, lyricLanguage);
      return check && !check.ok;
    });
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.languageMatch, categoryKo: '언어', labelKo: `언어 일치 (${lyricLanguage})`,
      status: languageMismatches.length === 0 ? 'pass' : 'fail',
      detail: languageMismatches.length ? `T${languageMismatches.map(s => s.trackNo).join(', T')}` : '불일치 0건'
    });
  }

  // codex 지시문 05 (TASK F) — genuinely new "export-completeness" category
  // item: every song carries the real content fields a final export needs
  // (title/lyrics/stylePrompt/hookPhrase all non-empty) — the same
  // structural floor core/finalizeBlueprint.ts's own validateBlueprintSchema
  // checks at finalize time, surfaced here too so a release-readiness-only
  // caller (without running the full finalize pipeline) still sees it.
  const incompleteSongs = songs.filter(song => !song.title?.trim() || !song.lyrics?.trim() || !song.stylePrompt?.trim() || !song.hookPhrase?.trim());
  items.push({
    id: RELEASE_READINESS_ITEM_IDS.exportFieldCompleteness, categoryKo: '내보내기', labelKo: '내보내기 필수 필드 완비',
    status: incompleteSongs.length === 0 ? 'pass' : 'fail',
    detail: incompleteSongs.length ? `T${incompleteSongs.map(s => s.trackNo).join(', T')}` : '누락 0건'
  });

  // codex 지시문 02 (TASK C) — same-subject cap, now grouped by MotifFamily
  // (data/motifFamilies.ts) instead of the old exact-lyricTheme-id
  // approximation — see that registry's own doc comment for why the old
  // check almost never actually fired (dozens of individual themes share
  // only ~44 real frameId values, and an 18-song pack essentially never
  // repeats one exact theme id 5+ times even when 5+ songs share a real
  // subject family).
  const quotaFindings = checkMotifFamilyQuota(songs.map(song => ({ trackNo: song.trackNo, frameId: song.lyricFrameId })));
  items.push({
    id: RELEASE_READINESS_ITEM_IDS.sameSubjectCap, categoryKo: '가사', labelKo: `같은 소재(모티프 계열) <= 계열별 한도`,
    status: quotaFindings.length === 0 ? 'pass' : 'fail',
    detail: quotaFindings.length
      ? quotaFindings.map(f => `${f.labelKo} ${f.count}곡(한도 ${f.maxPerPack}): T${f.trackNos.join(', T')}`).join(' / ')
      : '계열별 한도 내'
  });

  // codex 지시문 02 (TASK C) — NEW cross-pack cooldown signal, independent
  // of the within-pack quota just above. Only measured when the caller
  // passed recentSceneSignatures (same optional axis TASK B's scene-
  // similarity item already uses) — reports not-measured otherwise, same
  // "never a silent pass" convention as every other ledger-based item.
  if (duplicationHistory?.recentSceneSignatures) {
    const cooldownFindings = checkMotifFamilyCooldown(
      songs.map(song => ({ trackNo: song.trackNo, frameId: song.lyricFrameId })),
      duplicationHistory.recentSceneSignatures
    );
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.motifFamilyRecentPackCooldown, categoryKo: '가사', labelKo: '최근 세트와 소재(모티프 계열) 쿨다운 준수',
      status: cooldownFindings.length === 0 ? 'pass' : 'fail',
      detail: cooldownFindings.length
        ? cooldownFindings.map(f => `${f.labelKo}: 최근 ${f.recentPackCount}개 세트에서도 사용됨 (T${f.trackNos.join(', T')})`).join(' / ')
        : '쿨다운 위반 없음'
    });
  } else {
    items.push({ id: RELEASE_READINESS_ITEM_IDS.motifFamilyRecentPackCooldown, categoryKo: '가사', labelKo: '최근 세트와 소재(모티프 계열) 쿨다운 준수', status: 'not-measured', detail: 'duplicationHistory.recentSceneSignatures 없이 호출됨 — 실제 이력 대조 없이는 판정 불가', notImplemented: false });
  }

  // 지시문 08 (TASK C) — real gap-fills: core/seniorOldpopPolicy.ts's
  // countFinalKeyUps/countDistinctIntroTypes were built (지시문 04) but
  // never wired into this file's own real, previously-acknowledged
  // modulationCount/introTypeVariety gaps. SENIOR_MUSIC_POLICY's own
  // thresholds (maxFinalKeyUp/minIntroTypeVariety) are senior-oldpop-
  // specific by design, so these only ever evaluate for that archetype —
  // every other workspace stays honestly 'not-measured' rather than being
  // judged against a threshold that was never calibrated for it.
  const isSeniorOldpop = archetype === 'senior-morning';
  if (isSeniorOldpop) {
    const finalKeyUps = countFinalKeyUps(songs);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.modulationCount, categoryKo: '음악 설계', labelKo: `전조 ≤ ${SENIOR_MUSIC_POLICY.maxFinalKeyUp}곡`,
      status: finalKeyUps <= SENIOR_MUSIC_POLICY.maxFinalKeyUp ? 'pass' : 'fail',
      detail: `전조(key-lift final chorus) ${finalKeyUps}곡`
    });
    const introTypes = countDistinctIntroTypes(songs);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.introTypeVariety, categoryKo: '음악 설계', labelKo: `인트로 유형 >= ${SENIOR_MUSIC_POLICY.minIntroTypeVariety}종`,
      status: introTypes >= SENIOR_MUSIC_POLICY.minIntroTypeVariety ? 'pass' : 'fail',
      detail: `인트로 유형 ${introTypes}종`
    });
    const eraShare = checkSeniorEraShare(songs, conceptLabel, explorationTrackNos ?? []);
    if (eraShare) {
      const eraFail = eraShare.primaryBelowTarget || eraShare.transitionOverTarget || eraShare.blockingOtherEraPureTrackNos.length > 0;
      items.push({
        id: RELEASE_READINESS_ITEM_IDS.seniorEraShare, categoryKo: '음악 설계', labelKo: '단일 시대 78/11/11 배분',
        status: eraFail ? 'fail' : 'pass',
        detail: `primary ${(eraShare.primaryShare * 100).toFixed(0)}% / transition ${(eraShare.transitionShare * 100).toFixed(0)}% / other-era-pure ${(eraShare.otherEraPureShare * 100).toFixed(0)}%${eraShare.blockingOtherEraPureTrackNos.length ? ` (탐색 아님: T${eraShare.blockingOtherEraPureTrackNos.join(', T')})` : ''}`
      });
    } else {
      items.push({ id: RELEASE_READINESS_ITEM_IDS.seniorEraShare, categoryKo: '음악 설계', labelKo: '단일 시대 78/11/11 배분', status: 'not-measured', detail: '컨셉에 명시된 시대가 없어 판정 불가' });
    }
    const motifFindings = checkSeniorMotifQuotas(songs, conceptLabel);
    const blockingMotifFindings = motifFindings.filter(f => !f.overridden);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.seniorMotifQuota, categoryKo: '가사', labelKo: '시니어 소재 세부 쿼터 (letter/coffee/window/train/porch/diner)',
      status: blockingMotifFindings.length === 0 ? 'pass' : 'fail',
      detail: motifFindings.length ? motifFindings.map(f => `${f.labelKo}${f.overridden ? ' (콘셉트 지정, 위반 아님)' : ''}: ${f.count}곡 (한도 ${f.maxPerPack})`).join(' / ') : '위반 없음'
    });
    const chordDominance = checkChordProgressionDominance(songs);
    if (chordDominance) {
      items.push({
        id: RELEASE_READINESS_ITEM_IDS.seniorChordDominance, categoryKo: '음악 설계', labelKo: `단일 코드 진행 점유율 ≤ ${(SENIOR_MUSIC_POLICY.maxSingleProgressionShare * 100).toFixed(0)}%`,
        status: chordDominance.overCap ? 'fail' : 'pass',
        detail: `${chordDominance.dominantId} ${(chordDominance.share * 100).toFixed(0)}%`
      });
    } else {
      items.push({ id: RELEASE_READINESS_ITEM_IDS.seniorChordDominance, categoryKo: '음악 설계', labelKo: `단일 코드 진행 점유율 ≤ ${(SENIOR_MUSIC_POLICY.maxSingleProgressionShare * 100).toFixed(0)}%`, status: 'not-measured', detail: 'effectiveMoneyChordId가 있는 곡 없음' });
    }
  } else {
    items.push({ id: RELEASE_READINESS_ITEM_IDS.modulationCount, categoryKo: '음악 설계', labelKo: '전조 5~6곡', status: 'not-measured', detail: 'senior-morning 아카이타입 전용 기준 — 이 워크스페이스는 판정 대상 아님', notImplemented: false });
    items.push({ id: RELEASE_READINESS_ITEM_IDS.introTypeVariety, categoryKo: '음악 설계', labelKo: '인트로 유형 >= 4종', status: 'not-measured', detail: 'senior-morning 아카이타입 전용 기준 — 이 워크스페이스는 판정 대상 아님', notImplemented: false });
  }

  // 지시문 08 (TASK C) — core/kr2030Policy.ts, kr-2030-pop archetype only.
  if (archetype === 'kr-2030-pop') {
    const cliches = checkKr2030OpeningClicheOveruse(songs);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.kr2030OpeningCliche, categoryKo: '가사', labelKo: 'kr-2030 도입부 클리셰 과다 없음',
      status: cliches.length === 0 ? 'pass' : 'fail',
      detail: cliches.length ? cliches.map(f => `${f.labelKo} ${f.count}곡`).join(' / ') : '위반 없음'
    });
    const modernMotif = checkKr2030ModernMotifQuotas(songs, conceptLabel);
    const blockingModernMotif = modernMotif.filter(f => !f.overridden);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.kr2030ModernMotif, categoryKo: '가사', labelKo: 'kr-2030 모던 소재 쿼터',
      status: blockingModernMotif.length === 0 ? 'pass' : 'fail',
      detail: modernMotif.length ? modernMotif.map(f => `${f.labelKo}${f.overridden ? ' (콘셉트 지정)' : ''}: ${f.count}곡`).join(' / ') : '위반 없음'
    });
    const structureVariety = checkKr2030StructureVariety(songs);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.kr2030StructureVariety, categoryKo: '생성 구조', labelKo: 'kr-2030 구조 형태 다양성',
      status: structureVariety.belowTarget ? 'fail' : 'pass',
      detail: `${structureVariety.distinctCount}종 사용`
    });
    const unexpectedRap = findUnexpectedRapSections(songs);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.kr2030UnexpectedRap, categoryKo: '가사', labelKo: 'kr-2030 예상 밖 랩 섹션 없음',
      status: unexpectedRap.length === 0 ? 'pass' : 'fail',
      detail: unexpectedRap.length ? `T${unexpectedRap.join(', T')}` : '없음'
    });
    const translationese = checkKr2030Translationese(songs);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.kr2030Translationese, categoryKo: '가사', labelKo: 'kr-2030 번역체 없음',
      status: translationese.length === 0 ? 'pass' : 'fail',
      detail: translationese.length ? translationese.slice(0, 5).join(' / ') : '없음'
    });
  }

  // 지시문 08 (TASK C) — core/jp2030Policy.ts, jp-2030-pop archetype only.
  if (archetype === 'jp-2030-pop') {
    const katakana = findKatakanaOveruse(songs);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.jp2030KatakanaOveruse, categoryKo: '가사', labelKo: 'jp-2030 katakana 과다 없음',
      status: katakana.length === 0 ? 'pass' : 'fail',
      detail: katakana.length ? `T${katakana.join(', T')}` : '없음'
    });
    const modernMotif = checkJp2030ModernMotifQuotas(songs, conceptLabel);
    const blockingModernMotif = modernMotif.filter(f => !f.overridden);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.jp2030ModernMotif, categoryKo: '가사', labelKo: 'jp-2030 모던 소재 쿼터',
      status: blockingModernMotif.length === 0 ? 'pass' : 'fail',
      detail: modernMotif.length ? modernMotif.map(f => `${f.labelKo}${f.overridden ? ' (콘셉트 지정)' : ''}: ${f.count}곡`).join(' / ') : '위반 없음'
    });
    const titleSuffix = checkJp2030TitleSuffixOveruse(songs);
    const blockingTitleSuffix = titleSuffix.filter(f => !f.overridden);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.jp2030TitleSuffixOveruse, categoryKo: '제목', labelKo: 'jp-2030 제목 접미사 과다 없음',
      status: blockingTitleSuffix.length === 0 ? 'pass' : 'fail',
      detail: titleSuffix.length ? titleSuffix.map(f => `${f.labelKo}: ${f.count}곡`).join(' / ') : '위반 없음'
    });
    const translationese = checkJp2030Translationese(songs);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.jp2030Translationese, categoryKo: '가사', labelKo: 'jp-2030 번역체 없음',
      status: translationese.length === 0 ? 'pass' : 'fail',
      detail: translationese.length ? translationese.slice(0, 5).join(' / ') : '없음'
    });
  }

  // 지시문 08 (TASK C) — core/krKidsPolicy.ts/jpKidsPolicy.ts, kr-kids-song/jp-kids-song archetypes.
  if (archetype === 'kr-kids-song' || archetype === 'jp-kids-song') {
    const isJp = archetype === 'jp-kids-song';
    const resolvePhase = isJp ? findJpKidsAdultPhaseLeaks : findAdultPhaseLeaks;
    const resolveConsecutive = isJp ? findJpKidsConsecutivePhaseRuns : findConsecutivePhaseRuns;
    const resolveSafety = isJp ? checkJpKidsGenericSafety : checkKrKidsSafety;
    const kidsAgeTierId = songs.find(s => s.effectiveKidsAgeTierId)?.effectiveKidsAgeTierId ?? DEFAULT_KIDS_AGE_TIER_ID;
    const observedPhases = songs.map(s => s.arcPhase).filter((p): p is string => Boolean(p));
    const expectedPolicy = resolveKrKidsExpectedPhasePolicy(songs.length, kidsAgeTierId);
    const adultLeaks = resolvePhase(observedPhases);
    items.push({
      id: isJp ? RELEASE_READINESS_ITEM_IDS.jpKidsPhasePolicy : RELEASE_READINESS_ITEM_IDS.krKidsPhasePolicy,
      categoryKo: '생성 구조', labelKo: `${isJp ? 'jp' : 'kr'}-kids 아크 단계 (성인 단계 누출 0건)`,
      status: adultLeaks.length === 0 ? 'pass' : 'fail',
      detail: adultLeaks.length ? `성인 단계 누출: ${adultLeaks.join(', ')} (기대: ${expectedPolicy.expectedPhaseSet.join(', ')})` : `기대 단계 ${expectedPolicy.expectedPhaseSet.join(', ')}`
    });
    const consecutiveRuns = resolveConsecutive(observedPhases);
    items.push({
      id: isJp ? RELEASE_READINESS_ITEM_IDS.jpKidsConsecutivePhase : RELEASE_READINESS_ITEM_IDS.krKidsConsecutivePhase,
      categoryKo: '생성 구조', labelKo: `${isJp ? 'jp' : 'kr'}-kids 연속 동일 단계 없음`,
      status: consecutiveRuns.length === 0 ? 'pass' : 'fail',
      detail: consecutiveRuns.length ? consecutiveRuns.map(r => `${r.phase} ${r.runLength}연속`).join(' / ') : '없음'
    });
    const safetyIssues = songs.flatMap(song => resolveSafety(song.lyrics).map(issue => ({ trackNo: song.trackNo, issue })));
    items.push({
      id: isJp ? RELEASE_READINESS_ITEM_IDS.jpKidsSafety : RELEASE_READINESS_ITEM_IDS.krKidsSafety,
      categoryKo: '안전', labelKo: `${isJp ? 'jp' : 'kr'}-kids 안전 어휘 위반 0건`,
      status: safetyIssues.length === 0 ? 'pass' : 'fail',
      detail: safetyIssues.length ? safetyIssues.map(i => `T${i.trackNo}: ${i.issue}`).join(' / ') : '없음'
    });
    if (isJp) {
      const kanaIssues = songs.filter(song => checkJpKidsKanaRatio(song.lyrics, kidsAgeTierId).belowFloor).map(s => s.trackNo);
      const kanaCalibrationStatus = JP_KIDS_KANA_RATIO_CALIBRATION_STATUS[kidsAgeTierId];
      items.push({
        id: RELEASE_READINESS_ITEM_IDS.jpKidsKanaRatio, categoryKo: '언어', labelKo: `jp-kids kana 비율 (연령대별, ${kanaCalibrationStatus}) 준수`,
        status: kanaIssues.length === 0 ? 'pass' : 'fail',
        detail: kanaIssues.length ? `T${kanaIssues.join(', T')} kana 비율 미달` : `없음${kanaCalibrationStatus === 'provisional' ? ' (기준값 provisional — 승인된 실제 결과 50개 누적 전까지 미검증)' : ''}`
      });
    } else {
      const didacticTracks = songs.filter(song => didacticToneAdvisory(parseLyricsSections(song.lyrics).flatMap(s => s.lines))).map(s => s.trackNo);
      items.push({
        id: RELEASE_READINESS_ITEM_IDS.krKidsDidacticTone, categoryKo: '가사', labelKo: 'kr-kids 설교식 어조 advisory',
        status: didacticTracks.length === 0 ? 'pass' : 'fail',
        detail: didacticTracks.length ? `T${didacticTracks.join(', T')}` : '없음'
      });
    }
  }

  // 지시문 08 (TASK C) — core/kpopMalePolicy.ts/kpopFemalePolicy.ts (thin
  // per-workspace instantiations of core/kpopSharedChecks.ts's shared
  // engine — see that file's own doc comment), kr-idol-male/kr-idol-female
  // archetypes only.
  if (archetype === 'kr-idol-male' || archetype === 'kr-idol-female') {
    const isMale = archetype === 'kr-idol-male';
    const checkFixedQuota = isMale ? checkKrIdolMaleFixedQuota : checkKrIdolFemaleFixedQuota;
    const checkMotifQuotas = isMale ? checkKrIdolMaleMotifQuotas : checkKrIdolFemaleMotifQuotas;
    const checkRapShare = isMale ? checkKrIdolMaleRapShare : checkKrIdolFemaleRapShare;
    const checkChantOveruse = isMale ? checkKrIdolMaleChantOveruse : checkKrIdolFemaleChantOveruse;

    const counts = songs.reduce<Partial<Record<'male' | 'female' | 'mixed', number>>>((acc, song) => {
      if (song.vocalType) acc[song.vocalType] = (acc[song.vocalType] ?? 0) + 1;
      return acc;
    }, {});
    const quotaFindings = checkFixedQuota(counts, songs.length);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.kpopQuotaFidelity, categoryKo: '보컬', labelKo: 'kpop 고정 보컬 쿼터 준수',
      status: quotaFindings.length === 0 ? 'pass' : 'fail',
      detail: quotaFindings.length ? quotaFindings.map(f => `${f.type}: 기대 ${f.expected} / 실제 ${f.actual}`).join(' / ') : '위반 없음'
    });
    const motifFindings = checkMotifQuotas(songs);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.kpopMotifQuota, categoryKo: '가사', labelKo: 'kpop 소재 쿼터 준수',
      status: motifFindings.length === 0 ? 'pass' : 'fail',
      detail: motifFindings.length ? motifFindings.map(f => `${f.labelKo}: ${f.count}곡`).join(' / ') : '위반 없음'
    });
    const rapPlans = songs.map(song => ({ hasRapSection: parseLyricsSections(song.lyrics).some(s => s.type === 'rap') }));
    const rapShare = checkRapShare(rapPlans);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.kpopRapShare, categoryKo: '생성 구조', labelKo: 'kpop 랩 비중 목표 근접',
      status: rapShare.withinTolerance ? 'pass' : 'fail',
      detail: `실제 ${(rapShare.actualRatio * 100).toFixed(0)}% / 목표 ${(rapShare.targetRatio * 100).toFixed(0)}%`
    });
    const chantFindings = checkChantOveruse(songs);
    items.push({
      id: RELEASE_READINESS_ITEM_IDS.kpopChantOveruse, categoryKo: '가사', labelKo: 'kpop 챈트 과다 없음',
      status: chantFindings.length === 0 ? 'pass' : 'fail',
      detail: chantFindings.length ? chantFindings.map(f => `"${f.phrase}" ${f.count}곡`).join(' / ') : '없음'
    });
  }

  return items.map(item => ({ ...item, category: categoryForItemId(item.id) }));
}

/**
 * The one real entry point. Pure — no IndexedDB (duplicationHistory is
 * pre-fetched by the caller, same convention core/importInspection.ts's
 * own duplicationHistory param already established).
 */
export function evaluateReleaseReadiness(input: ReleaseReadinessInput): ReleaseReadinessReport {
  const fullAuditReport = runFullAudit(input.songs, {
    conceptLabel: input.conceptLabel,
    songCount: input.songCount,
    audienceProfile: input.audienceProfile,
    vocalQuotaOverride: input.vocalQuotaOverride,
    archetype: input.archetype as ChannelArchetype | undefined
  });
  let reused = fullAuditReport.items
    .filter(item => !item.requiresAudio) // audio-dependent items are never measurable pre-release without a rendered take; excluded from this checklist rather than reported as a fake failure.
    .map(item => fromAuditItem(item, item.category));

  // v5.23 (TASK C §3-6) — re-measures ONLY the style-allocation items
  // (STYLE_ALLOCATION_ITEM_IDS) on the pack with its exploration tracks
  // removed, and splices just those results back in as `exempted: true`.
  // Every other item (safety, quality, duplication, prompt hygiene, ...)
  // still comes from the full pack above — exploration tracks are never
  // exempt from those.
  const explorationTrackNos = input.explorationTrackNos ?? [];
  if (explorationTrackNos.length) {
    const nonExplorationSongs = input.songs.filter(song => !explorationTrackNos.includes(song.trackNo));
    const exemptAuditReport = runFullAudit(nonExplorationSongs, {
      conceptLabel: input.conceptLabel,
      songCount: nonExplorationSongs.length,
      audienceProfile: input.audienceProfile,
      vocalQuotaOverride: input.vocalQuotaOverride,
      archetype: input.archetype as ChannelArchetype | undefined
    });
    const exemptItemsById = new Map(exemptAuditReport.items.map(auditItem => [auditItem.id, auditItem]));
    reused = reused.map(item => {
      if (!STYLE_ALLOCATION_ITEM_IDS.has(item.id)) return item;
      const recomputed = exemptItemsById.get(item.id);
      if (!recomputed) return item;
      return { ...fromAuditItem(recomputed, item.categoryKo), exempted: true };
    });
  }

  const items = [...reused, ...newItems(input)];
  const passedCriteria = items.filter(item => item.status === 'pass').length;
  const failing = items.filter(item => item.status !== 'pass');

  // codex 지시문 05 (TASK F/H) — real "미측정은 pass로 계산하지 않는다" 3-number
  // shape, computed once here (see ReleaseReadinessReport's own doc comment).
  const unmeasuredCount = items.filter(item => item.notImplemented).length;
  const measuredCriteria = items.length - unmeasuredCount;
  const passedOfMeasured = items.filter(item => item.status === 'pass' && !item.notImplemented).length;

  return {
    items,
    totalCriteria: items.length,
    passedCriteria,
    releaseReady: failing.length === 0,
    failing,
    explorationExemptCount: explorationTrackNos.length,
    measuredCriteria,
    passedOfMeasured,
    unmeasuredCount
  };
}
