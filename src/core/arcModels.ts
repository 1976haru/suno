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
 * kidsArcModel.ts.
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
 * Known, deliberately-not-fixed side effect: core/designGate.ts's
 * killingPointAndArcIssues and core/fullAudit.ts's killingPointItems both
 * hard-code "exactly 5 distinct arcPhase values" as the pass condition
 * (v3.67 TASK C's own "아크 5구간 사용" gate) — workspace-agnostic, so it
 * would now correctly read as failing if either were ever run against a
 * real generated kids pack (3-5 distinct 'kids-*' values, not 5). This is
 * the same kind of "obsolete assumption for kids" the tests/
 * workspaceContractMatrix.test.ts owner already expected to need updating,
 * not a regression introduced here — `npm run audit`'s own default run
 * (senior-morning/five-phase) is unaffected, and neither gate has a kids-
 * targeted test locking in the old "must equal 5" expectation today (both
 * verified against tests/designGate.test.ts and tests/fullAudit.test.ts).
 * Left as a reported gap rather than silently widened, since making those
 * two gates workspace/arc-model-aware is outside this task's stated scope
 * (arcPlan.ts's own builder + its localGenerator.ts/batchPreallocation.ts
 * call sites).
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
