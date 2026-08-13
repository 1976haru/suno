import type { PeakStrength, SlotArcPosition } from './arcPlan';

/**
 * v5.11 (kids repetition-cycle arc) — real gap: core/arcPlan.ts's
 * buildArcPlan is the ONLY arc builder that exists, and every archetype
 * (including kr-kids/jp-kids) gets its five-phase opening/rising/peak/
 * easing/closing set-level emotional curve regardless. Meanwhile
 * types.ts's ArcModelId already declares 'repetition-cycle' and every kids
 * AudienceProfile (data/audienceProfiles.ts: kids-0to2/kids-2to4/kids-4to7/
 * kr-kids/jp-kids) already sets `arcModelId: 'repetition-cycle'` — but
 * nothing ever built one (types.ts's own ArcModelId doc comment says so
 * outright). This file is that builder.
 *
 * Why a five-phase narrative curve doesn't fit kids content: a set-level
 * "opening -> rising -> peak -> easing -> closing" arc assumes a listener
 * hears all 18 songs once, start to finish, in order. Kids content is
 * picked by SITUATION instead (dance time / mealtime / bedtime), and
 * within any one song, repetition (hook repeated N times, call-and-
 * response) matters far more than where that song sits in an 18-song
 * sequence. So instead of one monotonic curve, this bundles songs into a
 * small number of situational groups that repeat the same handful of
 * "modes" a caregiver would actually pick from.
 *
 * Not the same thing as data/kidsArcModel.ts's KIDS_ARC_ZONE model
 * (activate/learn/play/settle/sleep, 5 zones) — that file is a separate,
 * still-fully-unwired candidate from an earlier task (its own doc comment:
 * "정의만 만들고 배선하지 마십시오"), never imported anywhere in src/. This
 * builder implements a different, later spec (4 named bundles of ~3-4
 * songs each, not 5 zones) given directly for this task; the two were
 * deliberately left unreconciled rather than one silently overwriting the
 * other's intent — a future task can decide whether to merge or retire
 * kidsArcModel.ts. (2026-08-06 follow-up: re-verified still zero real call
 * sites for that file and marked it DEPRECATED with a removal plan at its
 * own top comment — no behavior change, this builder's bundle logic below
 * is untouched.)
 *
 * Downstream compatibility: `SlotArcPosition.phase` is typed as arcPlan.ts's
 * `ArcPhase`, which this task's own instructions said may need widening
 * (verified necessary — see arcPlan.ts's own ArcPhase doc comment for what
 * was checked). The five new 'kids-*' literal values below are ADDITIVE to
 * that union: every existing five-phase literal, and buildArcPlan's own
 * runtime behavior, stays byte-for-byte unchanged. Two real (not
 * hypothetical) downstream consumers switch on `.phase` as if it were
 * always one of the five adult values:
 *   1. localGenerator.ts's emotionArcPoolForPhase/songRolePoolForPhase —
 *      handled by adding explicit 'kids-*' cases below that alias to the
 *      same pool their nearest adult analog already uses (opening/rising/
 *      peak/easing/closing), so kids packs keep varied (not flattened-to-
 *      one-pool) emotionArc/songRole text instead of only ever hitting each
 *      function's own `default:` fallback.
 *   2. core/titleLocalization.ts's LocalizedTitleInput.arcPhase, narrowly
 *      typed to the 5-value union (data/titleLocalizationBank.ts's
 *      MOOD_CATEGORY_BY_ARC_PHASE Record only has those 5 keys) — handled at
 *      its one real call site (localGenerator.ts's buildLocalizedTitle call)
 *      with a type-guard that passes `undefined` for a 'kids-*' phase
 *      instead of a value that Record was never built to hold; that
 *      function already treats `undefined` as "use the neutral 'nostalgia'
 *      fallback category", which was already more accurate for kids than a
 *      mapped adult mood category was.
 * `SongIdea.arcPhase`/`PreassignedSongSlot.arcPhase` (types.ts) are both
 * already typed as plain `string`, not `ArcPhase` — no widening needed
 * there, and every generic label/CSV/rating consumer already falls back to
 * printing the raw string for an unrecognized value.
 *
 * Previously-known, now-fixed side effect: core/designGate.ts's
 * killingPointAndArcIssues and core/fullAudit.ts's killingPointItems used to
 * hard-code "exactly 5 distinct arcPhase values" as the pass condition
 * (v3.67 TASK C's own "아크 5구간 사용" gate) — workspace-agnostic, so it
 * would incorrectly read as failing when run against a real generated kids
 * pack (3-5 distinct 'kids-*' values, not 5). v5.12 made both gates
 * arc-model-aware via this file's own `expectedArcPhaseCount` (below) —
 * senior/adult workspaces still require exactly 5 (byte-identical pass/fail
 * behavior), kids workspaces are now checked against their real bundle count
 * instead of a wrong constant.
 */
export type KidsArcBundleId = 'familiar' | 'learning' | 'moving' | 'calm' | 'closing';

interface KidsBundleDefinition {
  id: KidsArcBundleId;
  /** ArcPhase-compatible literal this bundle's tracks populate `SlotArcPosition.phase` with. */
  phase: Extract<SlotArcPosition['phase'], `kids-${string}`>;
  labelKo: string;
  /** Same shareOf18 proportional-scaling convention as arcPlan.ts's own ARC_PHASES (not imported — see this file's own top comment on why arcPlan.ts stays untouched beyond the ArcPhase type). */
  shareOf18: number;
  intensity: 1 | 2 | 3 | 4 | 5;
  peakStrength: PeakStrength;
}

/**
 * Default bundle set — used both when no ageTier is given at all (today's
 * real situation; see this file's top comment) and for 'kids-t2' (2-4세),
 * matching data/kidsAgeTiers.ts's own DEFAULT_KIDS_AGE_TIER_ID so the
 * no-signal fallback lines up with this app's already-established real
 * default tier rather than an arbitrarily chosen one. shareOf18 sums to 18
 * (4/5/5/4) — "groups of 3-4" per bundle is the general target; 18 doesn't
 * divide evenly across exactly 4 named bundles, so two land at 5 rather
 * than invent a 5th bundle name here (kids-t3 below is the one tier that
 * legitimately gets a 5th, named, bundle).
 */
const KIDS_BUNDLES_DEFAULT: KidsBundleDefinition[] = [
  { id: 'familiar', phase: 'kids-familiar', labelKo: '익숙한 것 — 인사송·손동작', shareOf18: 4, intensity: 3, peakStrength: 'subtle' },
  { id: 'learning', phase: 'kids-learning', labelKo: '배우는 것 — 숫자·색깔·생활습관', shareOf18: 5, intensity: 3, peakStrength: 'subtle' },
  { id: 'moving', phase: 'kids-moving', labelKo: '움직이는 것 — 율동·동작 지시', shareOf18: 5, intensity: 4, peakStrength: 'strong' },
  { id: 'calm', phase: 'kids-calm', labelKo: '차분한 것 — 자장가·마무리', shareOf18: 4, intensity: 1, peakStrength: 'none' }
];

/**
 * 'kids-t1' (0-2세): 3 bundles, last = lullaby. Drops the 'moving' bundle
 * entirely rather than shrinking it — an infant/young-toddler audience
 * doesn't get a structured "exercise" bundle at all (hand-play already
 * lives in 'familiar'), matching D1's own T1 forbidden-traits table
 * (data/kidsAgeTiers.ts: "급격한 다이내믹 금지" applies hardest at T1).
 */
const KIDS_BUNDLES_T1: KidsBundleDefinition[] = [
  { id: 'familiar', phase: 'kids-familiar', labelKo: '익숙한 것 — 인사송·손동작', shareOf18: 7, intensity: 2, peakStrength: 'subtle' },
  { id: 'learning', phase: 'kids-learning', labelKo: '배우는 것 — 숫자·색깔·생활습관 (완만하게)', shareOf18: 6, intensity: 2, peakStrength: 'subtle' },
  { id: 'calm', phase: 'kids-calm', labelKo: '차분한 것 — 자장가', shareOf18: 5, intensity: 1, peakStrength: 'none' }
];

/**
 * 'kids-t3' (4-7세): the default 4 bundles, plus an explicit 5th bundle for
 * wind-down/goodbye framing distinct from the general 'calm' bundle — an
 * older kids audience can sit through (and benefits from) a distinct
 * "we're wrapping up" closer rather than 'calm' doing double duty as both
 * "quiet content" and "the end of the set".
 */
const KIDS_BUNDLES_T3: KidsBundleDefinition[] = [
  { id: 'familiar', phase: 'kids-familiar', labelKo: '익숙한 것 — 인사송·손동작', shareOf18: 4, intensity: 3, peakStrength: 'subtle' },
  { id: 'learning', phase: 'kids-learning', labelKo: '배우는 것 — 숫자·색깔·생활습관', shareOf18: 4, intensity: 3, peakStrength: 'subtle' },
  { id: 'moving', phase: 'kids-moving', labelKo: '움직이는 것 — 율동·운동', shareOf18: 4, intensity: 4, peakStrength: 'strong' },
  { id: 'calm', phase: 'kids-calm', labelKo: '차분한 것 — 마음 가라앉히기', shareOf18: 3, intensity: 2, peakStrength: 'none' },
  { id: 'closing', phase: 'kids-closing', labelKo: '마무리 인사 — 안녕/굿나잇', shareOf18: 3, intensity: 1, peakStrength: 'none' }
];

/**
 * v5.12 — every 'kids-*' phase literal this file can ever emit, across all
 * three age-tier bundle sets (union, not just the default's 4 — a caller
 * validating "is this actually a kids-model phase" shouldn't have to know
 * which ageTier produced it, since real call sites never pass one anyway;
 * see bundlesForAgeTier's own doc comment). Used by expectedArcPhaseCount's
 * callers (designGate.ts/fullAudit.ts) to tell "too few real kids bundle
 * values used" apart from "these aren't kids bundle values at all" (e.g. a
 * dispatch bug that fed adult five-phase strings into a repetition-cycle
 * pack) — the latter must still read as a failure, not merely as "count is
 * technically >= expected" which a bare Set-size comparison alone can't
 * distinguish.
 */
export const KIDS_ARC_PHASE_VALUES: ReadonlySet<string> = new Set([
  ...KIDS_BUNDLES_DEFAULT,
  ...KIDS_BUNDLES_T1,
  ...KIDS_BUNDLES_T3
].map(bundle => bundle.phase));

/**
 * v5.11 — real, honest gap: GenerationOptions has no `ageTier` field
 * reaching the generation pipeline today (confirmed against docs/
 * v58-report.md's own "ageTier(KidsAgeTierId) 파이프라인 연결: 없음—
 * GenerationOptions에 필드 자체가 없음" finding and docs/d2-report.md's
 * identical conclusion — core/promptComposer.ts's hookStyleDirectives
 * already takes an optional kidsAgeTierId param for exactly this reason but
 * its own two real call sites in localGenerator.ts never pass one). So this
 * function accepts `ageTier` (matching this task's required signature) and
 * genuinely branches on it when given one, but every real call site in
 * localGenerator.ts/batchPreallocation.ts calls it with `ageTier` omitted
 * today, since there is no real per-channel/per-generation age-tier signal
 * anywhere upstream to pass — not even a per-channel default (channel
 * presets don't carry one either). See this task's own final report for
 * the two honest options this was weighed against; the choice made here is
 * "(b) single reasonable default", using the app's own already-established
 * DEFAULT_KIDS_AGE_TIER_ID ('kids-t2') shape as that default rather than
 * inventing a separate one.
 */
function bundlesForAgeTier(ageTier?: string): KidsBundleDefinition[] {
  if (ageTier === 'kids-t1') return KIDS_BUNDLES_T1;
  if (ageTier === 'kids-t3') return KIDS_BUNDLES_T3;
  return KIDS_BUNDLES_DEFAULT;
}

/**
 * Same largest-remainder proportional scaling arcPlan.ts's own
 * scalePhaseCounts uses, reimplemented locally (not imported) so arcPlan.ts
 * itself needs zero changes beyond the additive ArcPhase type widening —
 * see this file's top comment for why that file's five-phase behavior must
 * stay byte-for-byte untouched.
 */
function scaleBundleCounts(bundles: readonly KidsBundleDefinition[], songCount: number): number[] {
  const totalShare = bundles.reduce((sum, entry) => sum + entry.shareOf18, 0) || 1;
  const raw = bundles.map(entry => (entry.shareOf18 / totalShare) * songCount);
  const floors = raw.map(Math.floor);
  let remainder = songCount - floors.reduce((sum, value) => sum + value, 0);
  const byFraction = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  const counts = [...floors];
  for (let k = 0; k < byFraction.length && remainder > 0; k += 1, remainder -= 1) {
    counts[byFraction[k].index] += 1;
  }
  return counts;
}

/**
 * The 'repetition-cycle' ArcModelId's real builder (see types.ts's
 * ArcModelId doc comment — previously "not yet implemented"). Returns the
 * same `SlotArcPosition[]` shape buildArcPlan does (same 3 fields, no new
 * ones), but `phase` holds one of the 'kids-*' bundle values instead of an
 * adult ArcPhase literal, and songs are grouped into 3-5 named situational
 * bundles (see bundlesForAgeTier above) instead of one 18-song opening-to-
 * closing curve. Within a bundle every track shares that bundle's own
 * intensity/peakStrength; only the LAST bundle in the sequence is the
 * low-intensity one (verified by this file's own tests — see
 * tests/arcModels.test.ts).
 */
export function buildRepetitionCyclePlan(songCount: number, ageTier?: string): SlotArcPosition[] {
  if (songCount <= 0) return [];
  const bundles = bundlesForAgeTier(ageTier);
  const counts = scaleBundleCounts(bundles, songCount);
  const plan: SlotArcPosition[] = [];
  bundles.forEach((bundle, bundleIdx) => {
    for (let i = 0; i < counts[bundleIdx]; i += 1) {
      plan.push({ phase: bundle.phase, intensity: bundle.intensity, peakStrength: bundle.peakStrength });
    }
  });
  return plan.slice(0, songCount);
}

/**
 * v5.12 — closes the gap this file's own top comment flagged ("Known,
 * deliberately-not-fixed side effect: core/designGate.ts's
 * killingPointAndArcIssues and core/fullAudit.ts's killingPointItems both
 * hard-code 'exactly 5 distinct arcPhase values'"). Tells a caller how many
 * DISTINCT phase/bundle values a given (arcModelId, songCount, ageTier)
 * combination will actually produce, without re-running the whole builder
 * just to count — reuses this file's own scaleBundleCounts (same math
 * buildRepetitionCyclePlan itself uses) and only counts bundles whose scaled
 * count is > 0, since a small enough songCount can genuinely zero out a
 * low-share bundle (see scaleBundleCounts's largest-remainder allocation).
 *
 * 'five-phase' unconditionally returns 5 (never derived from arcPlan.ts's
 * own scalePhaseCounts) — that gate's original "exactly 5" pass condition
 * (v3.67 TASK C) predates this file and must stay byte-identical for every
 * non-kids workspace; this function only adds a real, config-aware answer
 * for the 'repetition-cycle' branch that previously had none.
 *
 * `ageTier` defaults the same way bundlesForAgeTier does (KIDS_BUNDLES_DEFAULT,
 * 4 bundles) — matching every real call site today, which never has a real
 * per-generation ageTier signal to pass (see bundlesForAgeTier's own doc
 * comment).
 */
export function expectedArcPhaseCount(arcModelId: 'five-phase' | 'repetition-cycle', songCount: number, ageTier?: string): number {
  if (arcModelId !== 'repetition-cycle') return 5;
  if (songCount <= 0) return 0;
  const bundles = bundlesForAgeTier(ageTier);
  const counts = scaleBundleCounts(bundles, songCount);
  return counts.filter(count => count > 0).length;
}

/**
 * 지시문 47 (TASK C) — 실측: core/designGate.ts's killing-point-count 관문은
 * 모든 아키타입에 같은 flat 비율(KILLING_POINT_ASSIGNED_RATIO, 12/18)을
 * 썼다. kids-t3(KIDS_BUNDLES_T3)는 'calm'·'closing' 두 번들이 의도적으로
 * peakStrength:'none'이라(마음 가라앉히기·마무리 인사 — 따라 부르기
 * 쉬움이 우선인 구간, §"동요에 킬링포인트를 억지로 늘리지 말 것") 18곡
 * 기준으로도 정확히 12/18(67%)까지만 도달한다 — 문턱과 정확히 같다.
 * scaleBundleCounts의 largest-remainder 반올림이 다른 songCount(예: 15)에서
 * 'none' 번들 쪽으로 1곡 더 배정하면 실제 배정 수가 문턱 아래로 내려간다
 * (실측: 15곡에서 9/10). 시니어 등 'five-phase'는 기존 flat 비율 그대로
 * 두고(§"시니어 기준은 건드리지 않는다"), 'repetition-cycle'(kids)만 그
 * 번들 설계 자체가 실제로 약속하는 수치(= peakStrength가 'none'이 아닌
 * 번들들의 scaleBundleCounts 합)로 재계산한다 — 새 추정치가 아니라 실제
 * 생성이 쓰는 것과 같은 함수(scaleBundleCounts)로 역산한 것이라 항상
 * 일치한다.
 */
export function expectedKillingPointAssignedCount(arcModelId: 'five-phase' | 'repetition-cycle', songCount: number, ageTier?: string, fallbackRatio: number = 12 / 18): number {
  if (arcModelId !== 'repetition-cycle') return Math.round(songCount * fallbackRatio);
  if (songCount <= 0) return 0;
  const bundles = bundlesForAgeTier(ageTier);
  const counts = scaleBundleCounts(bundles, songCount);
  return bundles.reduce((sum, bundle, i) => sum + (bundle.peakStrength !== 'none' ? counts[i] : 0), 0);
}

/**
 * v(design-gate audience decoupling follow-up) — purely additive: exposes the
 * SAME per-bundle (id/phase/intensity) data expectedArcPhaseCount already
 * computes a bare count from, so a caller (core/designGate.ts's new
 * structural checks) can validate WHICH bundles a real plan used and their
 * relative intensity, not just how many. Reuses bundlesForAgeTier/
 * scaleBundleCounts verbatim (no new math, no change to either) — this file's
 * own existing bundle/intensity definitions and buildRepetitionCyclePlan/
 * expectedArcPhaseCount's own behavior stay byte-for-byte untouched.
 */
export interface KidsArcBundlePlanEntry {
  id: KidsArcBundleId;
  phase: string;
  intensity: number;
  /** Scaled count for this (songCount, ageTier) — 0 for a bundle a small songCount legitimately drops (see scaleBundleCounts's own largest-remainder allocation). */
  count: number;
}

export function kidsArcBundlePlanFor(songCount: number, ageTier?: string): KidsArcBundlePlanEntry[] {
  const bundles = bundlesForAgeTier(ageTier);
  if (songCount <= 0) return bundles.map(bundle => ({ id: bundle.id, phase: bundle.phase, intensity: bundle.intensity, count: 0 }));
  const counts = scaleBundleCounts(bundles, songCount);
  return bundles.map((bundle, i) => ({ id: bundle.id, phase: bundle.phase, intensity: bundle.intensity, count: counts[i] }));
}
