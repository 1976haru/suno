import type { RatingRecord } from './ratingLedger';
import { killingPointById } from '../data/killingPoints';
import { getGenreById } from '../data/genreLibrary';

/**
 * TASK v3.68 (TASK D) — turns accumulated ratings into "what actually makes
 * a good result", the thing six prior text-metric-only tasks couldn't
 * answer (see docs/v368-report.md §0). Pure and IndexedDB-free by design —
 * core/ratingLedger.ts owns storage, this module only ever receives an
 * already-loaded RatingRecord[] — so it's fully testable without a browser,
 * the same split core/videoLedger.ts's computeInsights already established.
 *
 * The single rule that matters most here (this task's own "가장 중요한
 * 규칙"): never claim a pattern from a small sample. See confidenceFor and
 * the >=20 combination-analysis floor below.
 */

export type ConfidenceTier = 'insufficient' | 'weak' | 'moderate' | 'strong';

export interface AttributeInsight {
  /** e.g. 'killingPointId', 'genreId', 'bpm', or a combination key like 'genreId+vocalType'. */
  attribute: string;
  /** e.g. 'KP-01', 'jazz-pop', '76~84 BPM', or 'jazz-pop+female' for a combination. */
  value: string;
  labelKo: string;
  good: number;
  ok: number;
  bad: number;
  sampleSize: number;
  /** This value's own good-ratio minus the overall average good-ratio across the same (channel-filtered) ratings. Never the raw good count — a value used often isn't the same as a value that works. */
  lift: number;
  confidence: ConfidenceTier;
}

const INSUFFICIENT_MAX = 4;
const WEAK_MAX = 11;
const MODERATE_MAX = 29;
/** Combination (2-attribute) insights are never reported below this — not merely low-confidence-labeled, absent entirely (see this task's own "조합은 sampleSize >= 20 일 때만 보고하십시오"). */
const COMBINATION_MIN_SAMPLE = 20;

export function confidenceForSampleSize(n: number, minSample = INSUFFICIENT_MAX + 1): ConfidenceTier {
  if (n < Math.min(minSample, INSUFFICIENT_MAX + 1)) return 'insufficient';
  if (n <= WEAK_MAX) return 'weak';
  if (n <= MODERATE_MAX) return 'moderate';
  return 'strong';
}

const BPM_BUCKET_WIDTH = 12;

function bpmBucketLabel(bpm: number): string {
  const low = Math.floor(bpm / BPM_BUCKET_WIDTH) * BPM_BUCKET_WIDTH;
  return `${low}~${low + BPM_BUCKET_WIDTH - 1} BPM`;
}

/**
 * v3.73 (TASK E) — same uniform-bucket-width pattern as bpmBucketLabel above,
 * applied to the two continuous audio measurements the spec's own example
 * output calls out (§5-2: "진폭 6dB 이상...", "스펙트럼 중심 2500Hz 이상...").
 * A fixed bucket width (not the spec's illustrative >=/< threshold framing)
 * keeps this consistent with every other continuous axis in this file.
 *
 * Label uses a half-open `low~low+width` (e.g. "6~8dB" covers [6,8)), unlike
 * bpmBucketLabel's `low~low+width-1` — BPM is effectively integer already,
 * but dB/Hz measurements are real-valued, and `76~87` implying "never 88"
 * would misdescribe a bucket that actually contains 87.4.
 */
const DYNAMIC_RANGE_BUCKET_WIDTH_DB = 2;
const SPECTRAL_CENTROID_BUCKET_WIDTH_HZ = 500;
/** peakPosition >= 0.75 — same threshold core/audioSetReport.ts uses for "an audible late lift". */
const LATE_PEAK_THRESHOLD = 0.75;

function dynamicRangeBucketLabel(dynamicRangeDb: number): string {
  const low = Math.floor(dynamicRangeDb / DYNAMIC_RANGE_BUCKET_WIDTH_DB) * DYNAMIC_RANGE_BUCKET_WIDTH_DB;
  return `${low}~${low + DYNAMIC_RANGE_BUCKET_WIDTH_DB}dB`;
}

function spectralCentroidBucketLabel(centroidHz: number): string {
  const low = Math.floor(centroidHz / SPECTRAL_CENTROID_BUCKET_WIDTH_HZ) * SPECTRAL_CENTROID_BUCKET_WIDTH_HZ;
  return `${low}~${low + SPECTRAL_CENTROID_BUCKET_WIDTH_HZ}Hz`;
}

const ARC_PHASE_LABELS_KO: Record<string, string> = {
  opening: '도입부',
  rising: '상승부',
  peak: '정점부',
  easing: '이완부',
  closing: '마무리부'
};

function labelKoFor(attribute: string, value: string): string {
  if (attribute === 'killingPointId') return killingPointById(value)?.labelKo ?? value;
  if (attribute === 'genreId' || attribute.includes('genreId')) {
    const genre = getGenreById(value.split('+')[0]);
    return genre?.label ?? value;
  }
  if (attribute === 'arcPhase') return ARC_PHASE_LABELS_KO[value] ?? value;
  return value;
}

function tally(records: RatingRecord[]): { good: number; ok: number; bad: number } {
  const counts = { good: 0, ok: 0, bad: 0 };
  for (const record of records) counts[record.rating] += 1;
  return counts;
}

function goodRatio(bucket: { good: number; ok: number; bad: number }): number {
  const total = bucket.good + bucket.ok + bucket.bad;
  return total > 0 ? bucket.good / total : 0;
}

/** Single-attribute value extractors — one entry per attribute this task tracks (spec section 2-1's attribute list). Returns undefined when this record has no value for that attribute, so it's simply excluded from that attribute's grouping (never counted as a zero/blank value). */
const SINGLE_ATTRIBUTE_EXTRACTORS: Record<string, (record: RatingRecord) => string | undefined> = {
  genreId: record => record.attributes.genreId,
  eraTag: record => record.attributes.eraTag,
  killingPointId: record => record.attributes.killingPointId,
  arcPhase: record => record.attributes.arcPhase,
  bpm: record => (record.attributes.bpm ? bpmBucketLabel(record.attributes.bpm) : undefined),
  vocalType: record => record.attributes.vocalType,
  structureTemplate: record => record.attributes.structureTemplate,
  earwormVariantId: record => record.attributes.earwormVariantId,
  segmentLabel: record => record.attributes.segmentLabel,
  lyricFrameId: record => record.attributes.lyricFrameId,
  moneyChordId: record => record.attributes.moneyChordId,
  // v3.73 (TASK E) — only present for ratings recorded from the 음원 분석
  // panel (real decoded mp3), so these three are excluded from the vast
  // majority of ratings rather than treated as zero/blank.
  audioDynamicRange: record => (record.attributes.audioMetrics ? dynamicRangeBucketLabel(record.attributes.audioMetrics.dynamicRange) : undefined),
  audioSpectralCentroid: record => (record.attributes.audioMetrics ? spectralCentroidBucketLabel(record.attributes.audioMetrics.spectralCentroid) : undefined),
  audioLatePeak: record => (record.attributes.audioMetrics ? (record.attributes.audioMetrics.peakPosition >= LATE_PEAK_THRESHOLD ? '후반 상승 있음' : '후반 상승 없음') : undefined)
};

/** Attribute pairs worth checking together — deliberately a short, named list rather than every possible pairwise combination (this task's own "조합 분석은 표본이 급격히 줄어듭니다" warning; an unbounded combinatorial sweep would multiply that problem, not just tolerate it). */
const COMBINATION_PAIRS: [string, string][] = [
  ['genreId', 'vocalType'],
  ['killingPointId', 'arcPhase']
];

function buildInsights(
  records: RatingRecord[],
  overallGoodRatio: number,
  minSample: number,
  extract: (record: RatingRecord) => string | undefined,
  attributeKey: string
): AttributeInsight[] {
  const groups = new Map<string, RatingRecord[]>();
  for (const record of records) {
    const value = extract(record);
    if (value === undefined) continue;
    const list = groups.get(value) ?? [];
    list.push(record);
    groups.set(value, list);
  }
  const insights: AttributeInsight[] = [];
  for (const [value, group] of groups) {
    const counts = tally(group);
    const sampleSize = group.length;
    insights.push({
      attribute: attributeKey,
      value,
      labelKo: labelKoFor(attributeKey, value),
      ...counts,
      sampleSize,
      lift: goodRatio(counts) - overallGoodRatio,
      confidence: confidenceForSampleSize(sampleSize, minSample)
    });
  }
  return insights;
}

export interface AnalyzeRatingsOptions {
  channelId?: string;
  /** Overrides the 'insufficient' cutoff for single-attribute insights only (default 5, i.e. n<5 is insufficient). Never applied to the combination-analysis floor (always >=20, per this task's own explicit rule). */
  minSample?: number;
}

/**
 * Pure aggregation over an already-loaded rating list (core/ratingLedger.ts
 * owns the IndexedDB read). Single-attribute insights are reported for
 * every sample size (down to n=1, labeled 'insufficient') so a caller can
 * grey them out rather than hide them (see this task's own Step F "표본
 * 부족은 회색으로 흐리게" instruction) — but SetDirector wiring (TASK E)
 * must only ever act on entries with confidence === 'strong'.
 * Combination insights are the one exception: they are silently absent
 * below COMBINATION_MIN_SAMPLE, never merely low-confidence-labeled.
 */
export function analyzeRatings(ratings: readonly RatingRecord[], options: AnalyzeRatingsOptions = {}): AttributeInsight[] {
  const scoped = options.channelId ? ratings.filter(record => record.attributes.channelId === options.channelId) : [...ratings];
  if (!scoped.length) return [];
  const overallGoodRatio = goodRatio(tally(scoped));
  const minSample = options.minSample ?? INSUFFICIENT_MAX + 1;

  const singleAttribute = Object.entries(SINGLE_ATTRIBUTE_EXTRACTORS).flatMap(([attributeKey, extract]) =>
    buildInsights(scoped, overallGoodRatio, minSample, extract, attributeKey)
  );

  const combinations = COMBINATION_PAIRS.flatMap(([attrA, attrB]) => {
    const extractA = SINGLE_ATTRIBUTE_EXTRACTORS[attrA];
    const extractB = SINGLE_ATTRIBUTE_EXTRACTORS[attrB];
    const combinationKey = `${attrA}+${attrB}`;
    const extractCombo = (record: RatingRecord): string | undefined => {
      const a = extractA(record);
      const b = extractB(record);
      return a !== undefined && b !== undefined ? `${a}+${b}` : undefined;
    };
    return buildInsights(scoped, overallGoodRatio, minSample, extractCombo, combinationKey)
      .filter(insight => insight.sampleSize >= COMBINATION_MIN_SAMPLE);
  });

  return [...singleAttribute, ...combinations].sort((a, b) => b.sampleSize - a.sampleSize);
}
