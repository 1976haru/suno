import type { AudioTake } from './audioTakes';
import { confidenceForSampleSize, type ConfidenceTier } from './ratingAnalysis';

/**
 * TASK v3.74 (TASK E) — "지시가 실제로 반영됐는가?" for the handful of
 * directives a real rendered mp3 can actually confirm or refute. Everything
 * this task's own spec explicitly calls "검증 불가" (exact semitone
 * modulation, instrument identification, harmony, lyric content) has no
 * function here at all — not a function that always returns false, simply
 * nothing, so it's structurally impossible to accidentally report a verdict
 * on them. UNMEASURABLE_DIRECTIVES documents that list for the UI/report.
 *
 * TASK F (directive stability) lives in the same module since it consumes
 * the same AudioTake[] input and pairs naturally with execution analysis —
 * both are "does this specific directive actually do what the prompt says"
 * questions, just at different granularities (rate vs A/B variance).
 */

export const UNMEASURABLE_DIRECTIVES = [
  '정확한 반음 전조 (음정 추적 필요)',
  '특정 악기 식별',
  '화성 진행',
  '가사 내용'
] as const;

/** v3.74 TASK E §5-3 — identical bucket boundaries to v3.68's ratingAnalysis.ts confidenceForSampleSize (5/11/29/30), reused rather than reinvented. */
const EXECUTION_MIN_SAMPLE = 5;

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/** A take recorded more than 90 days ago counts for half a sample — "수노 버전이 바뀌면 학습이 낡습니다" (TASK E §5-3). Never zero: old data is stale, not worthless. */
export function directiveAgeWeight(analyzedAt: string, now: Date = new Date()): number {
  const ageMs = now.getTime() - new Date(analyzedAt).getTime();
  return ageMs > NINETY_DAYS_MS ? 0.5 : 1;
}

export interface DirectiveExecutionEntry {
  directiveKey: string;
  labelKo: string;
  /** Raw (unweighted) sample count — confidence is about how many real cases exist, independent of age-decay weighting. */
  totalCount: number;
  executedCount: number;
  /** Age-weighted executed / age-weighted total — an old take counts for half as much (see directiveAgeWeight). */
  executionRate: number;
  confidence: ConfidenceTier;
}

const BPM_TOLERANCE_RATIO = 0.1;

/** True if `measured` is within +-10% of `target`, directly or at half/double tempo (a common estimator octave error — still counts as the prompt's tempo actually landing, just detected at the wrong octave). */
export function bpmMatchesTarget(measuredBpm: number, targetBpm: number, toleranceRatio = BPM_TOLERANCE_RATIO): { matches: boolean; octaveCorrected: boolean } {
  if (targetBpm <= 0) return { matches: false, octaveCorrected: false };
  const within = (value: number) => Math.abs(value - targetBpm) / targetBpm <= toleranceRatio;
  if (within(measuredBpm)) return { matches: true, octaveCorrected: false };
  const octave = within(measuredBpm * 2) || within(measuredBpm / 2);
  return { matches: octave, octaveCorrected: octave };
}

function buildEntry(directiveKey: string, labelKo: string, weightedResults: Array<{ executed: boolean; weight: number }>): DirectiveExecutionEntry {
  const totalCount = weightedResults.length;
  const executedCount = weightedResults.filter(r => r.executed).length;
  const weightedTotal = weightedResults.reduce((sum, r) => sum + r.weight, 0);
  const weightedExecuted = weightedResults.reduce((sum, r) => sum + (r.executed ? r.weight : 0), 0);
  return {
    directiveKey,
    labelKo,
    totalCount,
    executedCount,
    executionRate: weightedTotal > 0 ? weightedExecuted / weightedTotal : 0,
    confidence: confidenceForSampleSize(totalCount, EXECUTION_MIN_SAMPLE)
  };
}

const KILLING_POINT_LATE_PEAK_THRESHOLD = 0.75;

/**
 * TASK v3.74 (TASK E) — duration/BPM/killing-point execution rates, the 3
 * directives with both a concrete pass/fail rule and a real measurement to
 * check it against. `now` is injectable for deterministic testing of the
 * 90-day decay.
 */
export function buildDirectiveExecutionReport(takes: readonly AudioTake[], now: Date = new Date()): DirectiveExecutionEntry[] {
  const entries: DirectiveExecutionEntry[] = [];

  const durationResults = takes.map(take => ({
    executed: take.metrics.durationSec >= take.directives.targetDurationSec[0] && take.metrics.durationSec <= take.directives.targetDurationSec[1],
    weight: directiveAgeWeight(take.analyzedAt, now)
  }));
  if (durationResults.length) entries.push(buildEntry('duration', '길이 지시', durationResults));

  const bpmTakes = takes.filter(take => take.directives.targetBpm > 0 && take.tempoEstimate.confidence >= 0.4);
  const bpmResults = bpmTakes.map(take => ({
    executed: bpmMatchesTarget(take.tempoEstimate.bpm, take.directives.targetBpm).matches,
    weight: directiveAgeWeight(take.analyzedAt, now)
  }));
  if (bpmResults.length) entries.push(buildEntry('bpm', 'BPM 지시', bpmResults));

  const byKillingPoint = new Map<string, AudioTake[]>();
  for (const take of takes) {
    const id = take.directives.killingPointId;
    if (!id) continue;
    const list = byKillingPoint.get(id) ?? [];
    list.push(take);
    byKillingPoint.set(id, list);
  }
  for (const [killingPointId, group] of byKillingPoint) {
    const results = group.map(take => ({
      executed: take.metrics.peakPosition >= KILLING_POINT_LATE_PEAK_THRESHOLD,
      weight: directiveAgeWeight(take.analyzedAt, now)
    }));
    entries.push(buildEntry(`killingPoint:${killingPointId}`, killingPointId, results));
  }

  return entries;
}

export interface InstrumentAtomTendency {
  atom: string;
  sampleSize: number;
  meanSpectralCentroid: number;
  /** meanSpectralCentroid minus the overall mean across all takes — a descriptive lean, not a pass/fail verdict (TASK E's own "검증 가능/변화 경향" framing, softer than the strict executedCount entries above). */
  centroidLift: number;
}

/**
 * TASK v3.74 (TASK E) — instrumentAtoms is explicitly listed as measurable,
 * but only as a "변화 경향" (tendency), not a hard rule with a stated
 * threshold like duration/BPM/killing-point above — so this reports a
 * descriptive lift instead of forcing an executed/not-executed verdict onto
 * something the spec itself doesn't define a pass/fail line for.
 */
/**
 * TASK v3.74 (TASK H) — same structural shape as GenerationOptions.ratingInsights'
 * element (see types.ts's own "structurally mirrors AttributeInsight ...
 * keeping this foundational file free of any core/ dependency" convention) —
 * so an execution-rate entry can be merged into the exact array
 * data/killingPoints.ts's existing killingPointBoostFromInsights already
 * knows how to read, with zero changes to that already-tested v3.68
 * mechanism (including its own MAX_SONGS_PER_KILLING_POINT=3 cap, which
 * already keeps any single killing point's share of an 18-song pack around
 * ~21% — comfortably under this task's own "50%를 넘지 않게" ceiling).
 */
export interface RatingInsightShape {
  attribute: string;
  value: string;
  labelKo: string;
  good: number;
  ok: number;
  bad: number;
  sampleSize: number;
  lift: number;
  confidence: ConfidenceTier;
}

/**
 * Converts a killing-point execution-rate entry into the same shape a real
 * rating insight has, so it can ride the existing boost pipeline unchanged.
 * `good`/`bad` are execution/non-execution counts (there is no "ok" tier for
 * a binary executed/not-executed measurement — always 0). `lift` is centered
 * on a 50% execution rate (0 = neutral): KP-04's real 22% example yields
 * lift=-0.28, which killingPointBoostFromInsights floors to a 0.5x weight —
 * down-weighted, never zero (that function's own existing "0으로 만들지
 *마십시오" guarantee, unchanged).
 */
export function executionEntryToRatingInsightShape(entry: DirectiveExecutionEntry): RatingInsightShape | null {
  if (!entry.directiveKey.startsWith('killingPoint:')) return null;
  const value = entry.directiveKey.slice('killingPoint:'.length);
  return {
    attribute: 'killingPointId',
    value,
    labelKo: entry.labelKo,
    good: entry.executedCount,
    ok: 0,
    bad: entry.totalCount - entry.executedCount,
    sampleSize: entry.totalCount,
    lift: entry.executionRate - 0.5,
    confidence: entry.confidence
  };
}

/** Pure — appends every convertible, strong-confidence execution entry to an existing rating-insight list (never removes/overwrites anything already there). Non-strong entries are dropped here too (killingPointBoostFromInsights already ignores them, but filtering early keeps the merged list meaningful for direct inspection/UI display as well). */
export function mergeExecutionInsightsIntoRatingInsights(
  ratingInsights: readonly RatingInsightShape[] | undefined,
  executionEntries: readonly DirectiveExecutionEntry[]
): RatingInsightShape[] {
  const converted = executionEntries
    .filter(entry => entry.confidence === 'strong')
    .map(executionEntryToRatingInsightShape)
    .filter((insight): insight is RatingInsightShape => insight !== null);
  return [...(ratingInsights ?? []), ...converted];
}

export function buildInstrumentAtomTendencies(takes: readonly AudioTake[], minSample = EXECUTION_MIN_SAMPLE): InstrumentAtomTendency[] {
  const withCentroid = takes.filter(take => take.directives.instrumentAtoms.length > 0);
  if (!withCentroid.length) return [];
  const overallMean = withCentroid.reduce((sum, t) => sum + t.metrics.spectralCentroid, 0) / withCentroid.length;

  const byAtom = new Map<string, number[]>();
  for (const take of withCentroid) {
    for (const atom of take.directives.instrumentAtoms) {
      const list = byAtom.get(atom) ?? [];
      list.push(take.metrics.spectralCentroid);
      byAtom.set(atom, list);
    }
  }

  const tendencies: InstrumentAtomTendency[] = [];
  for (const [atom, centroids] of byAtom) {
    if (centroids.length < minSample) continue;
    const meanSpectralCentroid = centroids.reduce((a, b) => a + b, 0) / centroids.length;
    tendencies.push({ atom, sampleSize: centroids.length, meanSpectralCentroid, centroidLift: meanSpectralCentroid - overallMean });
  }
  return tendencies.sort((a, b) => b.sampleSize - a.sampleSize);
}

/**
 * TASK v3.74 (TASK F) — "지시 안정성": the same prompt/directive rendered
 * twice by Suno with a big A/B gap means the DIRECTIVE is unstable, not that
 * one take is simply bad — this task's own "한 곡만 보면 지시가 안 먹힌다고
 * 잘못 판단합니다" is exactly the mistake pairing guards against. Aggregated
 * across every song that shares a directiveKey (not just one song's own A/B
 * pair), so a single noisy song can't make a directive look unstable on its
 * own.
 */
export interface DirectiveStability {
  directiveKey: string;
  pairCount: number;
  meanAbsDelta: Record<string, number>;
  stability: 'stable' | 'variable' | 'unstable';
}

const STABLE_MAX_DB = 1.5;
const VARIABLE_MAX_DB = 3.5;

function stabilityFromDynamicRangeDelta(meanAbsDeltaDynamicRange: number): DirectiveStability['stability'] {
  if (meanAbsDeltaDynamicRange < STABLE_MAX_DB) return 'stable';
  if (meanAbsDeltaDynamicRange <= VARIABLE_MAX_DB) return 'variable';
  return 'unstable';
}

interface TakePair {
  a: AudioTake;
  b: AudioTake;
}

/** Every pairwise combination of takes sharing the same songId (2 takes -> 1 pair; 3 takes -> 3 pairs, etc — TASK B's own "3개 이상 들어와도 허용하십시오"). */
function buildPairsBySong(takes: readonly AudioTake[]): TakePair[] {
  const bySong = new Map<string, AudioTake[]>();
  for (const take of takes) {
    const list = bySong.get(take.songId) ?? [];
    list.push(take);
    bySong.set(take.songId, list);
  }
  const pairs: TakePair[] = [];
  for (const group of bySong.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) pairs.push({ a: group[i], b: group[j] });
    }
  }
  return pairs;
}

/** Both takes of a pair share the same directives object (same song, same prompt) — keys are derived once from either side. */
function directiveKeysForTake(take: AudioTake): string[] {
  const keys: string[] = [];
  if (take.directives.killingPointId) keys.push(`killingPoint:${take.directives.killingPointId}`);
  if (take.directives.introMode) keys.push(`introMode:${take.directives.introMode}`);
  return keys;
}

const STABILITY_METRICS: Array<{ key: string; get: (take: AudioTake) => number }> = [
  { key: 'dynamicRange', get: take => take.metrics.dynamicRange },
  { key: 'durationSec', get: take => take.metrics.durationSec },
  { key: 'peakPosition', get: take => take.metrics.peakPosition },
  { key: 'spectralCentroid', get: take => take.metrics.spectralCentroid },
  { key: 'vocalCentroid', get: take => take.vocalMetrics.vocalCentroid }
];

export function buildDirectiveStabilityReport(takes: readonly AudioTake[]): DirectiveStability[] {
  const pairs = buildPairsBySong(takes);
  const byKey = new Map<string, TakePair[]>();
  for (const pair of pairs) {
    for (const key of directiveKeysForTake(pair.a)) {
      const list = byKey.get(key) ?? [];
      list.push(pair);
      byKey.set(key, list);
    }
  }

  const results: DirectiveStability[] = [];
  for (const [directiveKey, groupPairs] of byKey) {
    const meanAbsDelta: Record<string, number> = {};
    for (const metric of STABILITY_METRICS) {
      const deltas = groupPairs.map(pair => Math.abs(metric.get(pair.a) - metric.get(pair.b)));
      meanAbsDelta[metric.key] = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
    }
    results.push({
      directiveKey,
      pairCount: groupPairs.length,
      meanAbsDelta,
      stability: stabilityFromDynamicRangeDelta(meanAbsDelta.dynamicRange)
    });
  }
  return results;
}
