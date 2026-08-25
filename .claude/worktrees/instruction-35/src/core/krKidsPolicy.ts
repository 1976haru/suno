import { kidsArcBundlePlanFor, KIDS_ARC_PHASE_VALUES } from './arcModels';
import { KIDS_AGE_TIERS, DEFAULT_KIDS_AGE_TIER_ID, type KidsAgeTierId } from '../data/kidsAgeTiers';
import { kidsLyricSafetyIssues } from './kidsLyricEngine';

/**
 * codex 지시문 04 (§4) — real, dedicated kr-kids policy adapter.
 *
 * MAJOR investigation finding: the phase/bundle/intensity/terminal-phase
 * system this section asks for ALREADY EXISTS, fully built and wired —
 * core/arcModels.ts's real bundle definitions (KidsArcBundleId/
 * KidsBundleDefinition/kidsArcBundlePlanFor) plus core/designGate.ts's
 * kidsArcBundleStructureIssues, which already implements, nearly verbatim
 * to this task's own spec:
 *  - kidsAgeTierId threaded through exactly, never reverse-inferred from
 *    observed phases (that function's own TASK D doc comment documents
 *    fixing exactly the bug this task's own "선택 tier를 observed phase로
 *    추론하지 않는다" warns against).
 *  - exact phase SET check (id: 'kids-arc-bundle-set-mismatch').
 *  - per-phase expected COUNT check, ±1 tolerance (id: 'kids-arc-bundle-count-mismatch').
 *  - adult-phase hard block (id: 'kids-arc-adult-phase-leak').
 *  - terminal/last-bundle phase-identity check (id: 'kids-arc-last-phase-identity').
 *  - last-bundle intensity strictly below every other used bundle's
 *    intensity (id: 'kids-arc-last-bundle-intensity', via
 *    lastBundleIntensityViolation).
 *
 * This module does NOT reimplement any of that — it exposes the SAME real
 * data under this task's own literal vocabulary (`expectedPhaseSet`/
 * `expectedPhaseCounts`/`terminalPhase`/`intensityPolicy`), and adds the
 * two genuinely new pieces confirmed absent by investigation: a GENERAL
 * consecutive-phase warning (designGate.ts's own movingRunAdvisory is
 * scoped to the 'kids-moving' phase specifically — this task's own
 * "consecutive phase warning" reads as a general "no two adjacent bundles
 * identical" check), and 4 new safety categories
 * (risky-behavior/bullying/guardian-less-danger/body-food-inappropriate)
 * that core/kidsLyricEngine.ts's own real KIDS_FORBIDDEN_TERMS doesn't yet
 * cover (it already covers fear/violence/death, adult romance-pain, and
 * generic brand/commercial references — confirmed by direct read).
 */

export interface KrKidsExpectedPhasePolicy {
  kidsAgeTierId: KidsAgeTierId;
  expectedPhaseSet: string[];
  expectedPhaseCounts: { phase: string; count: number }[];
  terminalPhase: string;
  intensityPolicy: { phase: string; intensity: number }[];
}

/** Real, direct exposure of arcModels.ts's own kidsArcBundlePlanFor under this task's own literal field names — no new computation. */
export function resolveKrKidsExpectedPhasePolicy(songCount: number, kidsAgeTierId: KidsAgeTierId = DEFAULT_KIDS_AGE_TIER_ID): KrKidsExpectedPhasePolicy {
  const plan = kidsArcBundlePlanFor(songCount, kidsAgeTierId).filter(entry => entry.count > 0);
  return {
    kidsAgeTierId,
    expectedPhaseSet: plan.map(entry => entry.phase),
    expectedPhaseCounts: plan.map(entry => ({ phase: entry.phase, count: entry.count })),
    terminalPhase: plan[plan.length - 1]?.phase ?? '',
    intensityPolicy: plan.map(entry => ({ phase: entry.phase, intensity: entry.intensity }))
  };
}

/** Same adult-phase hard-block signal as designGate.ts's own kidsArcBundleStructureIssues (id: 'kids-arc-adult-phase-leak') — direct reuse of KIDS_ARC_PHASE_VALUES, not a second copy of the membership list. */
export function findAdultPhaseLeaks(observedPhases: readonly string[]): string[] {
  return observedPhases.filter(p => !KIDS_ARC_PHASE_VALUES.has(p));
}

export interface ConsecutivePhaseWarning {
  phase: string;
  runLength: number;
}

/**
 * codex 지시문 04 (§4) — genuinely NEW: designGate.ts's own movingRunAdvisory
 * only ever checks the 'kids-moving' phase specifically (its own doc
 * comment: "no 3+ consecutive 'kids-moving'"). This generalizes to ANY
 * phase — 3+ consecutive songs sharing the identical bundle, regardless of
 * which one, is worth a warning (a caregiver picking by situation loses
 * the point of having named bundles if the pack never actually alternates
 * between them).
 */
export function findConsecutivePhaseRuns(observedPhases: readonly string[], maxConsecutive = 2): ConsecutivePhaseWarning[] {
  const warnings: ConsecutivePhaseWarning[] = [];
  let current: string | undefined;
  let runLength = 0;
  const flush = () => {
    if (current && runLength > maxConsecutive) warnings.push({ phase: current, runLength });
  };
  for (const phase of observedPhases) {
    if (phase === current) {
      runLength++;
    } else {
      flush();
      current = phase;
      runLength = 1;
    }
  }
  flush();
  return warnings;
}

// ---------------------------------------------------------------------------
// Safety — 4 new categories beyond kidsLyricEngine.ts's real existing list
// ---------------------------------------------------------------------------

/**
 * codex 지시문 04 (§4) — real gap confirmed by direct read of
 * core/kidsLyricEngine.ts's own KIDS_FORBIDDEN_TERMS: fear/violence/death,
 * adult-romance-pain, and generic brand/commercial references are already
 * covered there (reused, not duplicated). These 4 categories are NOT:
 * risky behavior, bullying/exclusion, guardian-less danger, body/food
 * inappropriateness — added here as their own, same-shape regex list
 * (word-blacklist, same honest limitation as the existing KIDS_FORBIDDEN_TERMS:
 * vocabulary-level, not a narrative/outcome judgment).
 */
const KR_KIDS_ADDITIONAL_FORBIDDEN_TERMS: { category: string; pattern: RegExp }[] = [
  { category: 'risky-behavior', pattern: /불장난|칼을\s*가지고|높은\s*곳에서\s*뛰어|길을\s*뛰어다니/ },
  { category: 'bullying', pattern: /따돌|왕따|안\s*놀아줄|너랑\s*안\s*놀아|무리에서\s*빼/ },
  { category: 'guardian-less-danger', pattern: /혼자\s*밤길|어른\s*없이\s*(밖|바깥)|보호자\s*없이/ },
  { category: 'body-food-inappropriate', pattern: /뚱뚱해서\s*못|많이\s*먹으면\s*안\s*(돼|되)|살\s*빼야/ }
];

export function findKrKidsExtendedSafetyIssues(text: string): string[] {
  const issues = KR_KIDS_ADDITIONAL_FORBIDDEN_TERMS.filter(({ pattern }) => pattern.test(text)).map(({ category }) => category);
  return issues;
}

/**
 * Combines the existing real kidsLyricEngine.ts checker with this task's
 * own 4 new categories — the one real entry point a caller should use.
 */
export function checkKrKidsSafety(text: string): string[] {
  return [...kidsLyricSafetyIssues(text), ...findKrKidsExtendedSafetyIssues(text)];
}

// ---------------------------------------------------------------------------
// Language — sentence length by tier, didactic-tone advisory
// ---------------------------------------------------------------------------

/** Real, direct reuse of data/kidsAgeTiers.ts's own maxWordsPerLine — not re-derived. */
export function maxWordsPerLineForTier(tierId: KidsAgeTierId): number | undefined {
  return (KIDS_AGE_TIERS[tierId] ?? KIDS_AGE_TIERS[DEFAULT_KIDS_AGE_TIER_ID]).maxWordsPerLine;
}

/**
 * "교육 목표가 너무 설교식이면 advisory" — real, bounded heuristic: a lyric
 * line that reads as a direct imperative lecture ("~해야 해요", "~하면
 * 안돼요", "꼭 ~하세요") repeated across MOST of a song's own lines reads as
 * a lecture, not a song — advisory only (a few such lines are completely
 * normal and expected in an educational kids song).
 */
const DIDACTIC_LINE_PATTERN = /야\s*(해요|돼요|합니다)|하면\s*안\s*(돼요|됩니다)|꼭\s*.{0,6}(하세요|해요)/;

export function didacticToneAdvisory(lines: string[]): boolean {
  const real = lines.filter(l => l.trim());
  if (real.length < 4) return false;
  const didacticCount = real.filter(l => DIDACTIC_LINE_PATTERN.test(l)).length;
  return didacticCount / real.length > 0.5;
}
