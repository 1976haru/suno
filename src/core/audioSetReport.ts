import type { AudienceProfile } from '../types';
import type { SongAudioMetrics } from './audioAnalysis';
import { cosineSimilarity } from './audioAnalysis';

/**
 * TASK v3.73 (TASK C) — turns a pile of per-song SongAudioMetrics into a
 * pack-level judgment, against the audience's own real-world targets
 * (AudienceProfile.songLengthSecondsRange — seniors and kids have different
 * targets, see data/audienceProfiles.ts). Pure — no browser API, no
 * IndexedDB — so it's directly unit-testable with synthetic metrics.
 */

export interface AudioSetReport {
  analyzedCount: number;
  totalTracks: number;

  duration: {
    /** trackNo -> seconds, only for tracks that were actually analyzed. */
    values: Record<number, number>;
    overTarget: number[];
    underTarget: number[];
    targetRange: [number, number];
  };

  killingPoint: {
    /** peakPosition >= 0.75 — reads as an audible late lift. */
    latePeakTracks: number[];
    noLatePeakTracks: number[];
    /** dynamicRange < 6dB — "평평합니다", regardless of where the peak lands. */
    weakDynamicTracks: number[];
    /** share of analyzed tracks with a late peak, 0..1 — the spec's own "60% 이상이 후반 상승이어야 정상" bar. */
    latePeakShare: number;
  };

  timbre: {
    /** max spectralCentroid - min, across analyzed tracks (Hz). */
    centroidSpread: number;
    /** pairs of trackNo whose spectrumProfile cosine similarity is >= 0.95 — "이 두 곡은 비슷하게 들릴 수 있습니다". */
    clusteredPairs: [number, number][];
    /** mean pairwise similarity across the whole analyzed set. */
    meanSimilarity: number;
  };

  level: {
    values: Record<number, number>;
    /** max overallLevel - min, across analyzed tracks (dB). */
    spread: number;
  };

  warnings: string[];
  advisories: string[];
}

const LATE_PEAK_THRESHOLD = 0.75;
const WEAK_DYNAMIC_RANGE_DB = 6;
const LATE_PEAK_SHARE_TARGET = 0.6;
const NARROW_TIMBRE_SPREAD_HZ = 800;
const CLUSTER_SIMILARITY_THRESHOLD = 0.95;
const SET_SIMILARITY_WARN_THRESHOLD = 0.93;
const LEVEL_SPREAD_WARN_DB = 3;

export function buildAudioSetReport(
  metrics: readonly SongAudioMetrics[],
  totalTracks: number,
  audienceProfile: AudienceProfile,
  /**
   * v3.75 (TASK B) — real measurement found a real pack averaging 3.3dB
   * dynamic range and one track's loudest moment in the first 20% of the
   * song — but this task's own spec is explicit that a track with NO
   * designed killing point ("킬링포인트가 없는 곡") has "진폭 제한 없음, 평평해도
   * 됩니다" (no amplitude requirement at all, flat is fine). Before this,
   * every analyzed track was judged against the same late-peak/wide-dynamic
   * bar regardless of whether it was ever supposed to have one, which both
   * mis-flagged legitimately-flat non-peak tracks and diluted latePeakShare
   * with tracks that were never candidates for a late peak. Optional and
   * additive — omitting it (e.g. a caller with no per-track killing-point
   * data) preserves the exact old behavior of judging every analyzed track.
   */
  killingPointTrackNos?: ReadonlySet<number>
): AudioSetReport {
  const analyzed = metrics.filter(m => m.matchedTrackNo !== undefined);
  const warnings: string[] = [];
  const advisories: string[] = [];

  const durationValues: Record<number, number> = {};
  const overTarget: number[] = [];
  const underTarget: number[] = [];
  const [minTarget, maxTarget] = audienceProfile.songLengthSecondsRange;
  for (const m of analyzed) {
    const trackNo = m.matchedTrackNo!;
    durationValues[trackNo] = m.durationSec;
    if (m.durationSec > maxTarget) overTarget.push(trackNo);
    else if (m.durationSec < minTarget) underTarget.push(trackNo);
  }

  const peakRelevant = killingPointTrackNos
    ? analyzed.filter(m => killingPointTrackNos.has(m.matchedTrackNo!))
    : analyzed;
  const latePeakTracks: number[] = [];
  const noLatePeakTracks: number[] = [];
  const weakDynamicTracks: number[] = [];
  for (const m of peakRelevant) {
    const trackNo = m.matchedTrackNo!;
    if (m.peakPosition >= LATE_PEAK_THRESHOLD) latePeakTracks.push(trackNo);
    else noLatePeakTracks.push(trackNo);
    if (m.dynamicRange < WEAK_DYNAMIC_RANGE_DB) weakDynamicTracks.push(trackNo);
  }
  const latePeakShare = peakRelevant.length > 0 ? latePeakTracks.length / peakRelevant.length : 0;

  const centroids = analyzed.map(m => m.spectralCentroid);
  const centroidSpread = centroids.length > 1 ? Math.max(...centroids) - Math.min(...centroids) : 0;

  const clusteredPairs: [number, number][] = [];
  let similaritySum = 0;
  let pairCount = 0;
  for (let i = 0; i < analyzed.length; i++) {
    for (let j = i + 1; j < analyzed.length; j++) {
      const similarity = cosineSimilarity(analyzed[i].spectrumProfile, analyzed[j].spectrumProfile);
      similaritySum += similarity;
      pairCount += 1;
      if (similarity >= CLUSTER_SIMILARITY_THRESHOLD) {
        clusteredPairs.push([analyzed[i].matchedTrackNo!, analyzed[j].matchedTrackNo!]);
      }
    }
  }
  const meanSimilarity = pairCount > 0 ? similaritySum / pairCount : 0;

  const levelValues: Record<number, number> = {};
  for (const m of analyzed) levelValues[m.matchedTrackNo!] = m.overallLevel;
  const levels = Object.values(levelValues);
  const levelSpread = levels.length > 1 ? Math.max(...levels) - Math.min(...levels) : 0;

  // Advisories — soft, informational, never blocking.
  if (overTarget.length) advisories.push(`길이 초과 ${overTarget.length}곡: T${overTarget.join(', T')} — 목표 ${formatRange(minTarget, maxTarget)}`);
  if (underTarget.length) advisories.push(`길이 미달 ${underTarget.length}곡: T${underTarget.join(', T')} — 목표 ${formatRange(minTarget, maxTarget)}`);
  const peakScope = killingPointTrackNos ? '킬링포인트 곡 중 ' : '';
  if (peakRelevant.length > 0 && latePeakShare < LATE_PEAK_SHARE_TARGET) {
    advisories.push(`${peakScope}후반 상승이 ${Math.round(latePeakShare * 100)}%뿐입니다 (목표 60% 이상) — 킬링포인트가 후반부에서 잘 안 들릴 수 있습니다.`);
  }
  if (weakDynamicTracks.length) advisories.push(`${peakScope}진폭 부족(<6dB) ${weakDynamicTracks.length}곡: T${weakDynamicTracks.join(', T')} — 평평하게 들릴 수 있습니다.`);
  if (analyzed.length > 1 && centroidSpread < NARROW_TIMBRE_SPREAD_HZ) {
    advisories.push(`음색 팔레트가 좁습니다 (중심 주파수 폭 ${Math.round(centroidSpread)}Hz).`);
  }
  for (const [a, b] of clusteredPairs) advisories.push(`T${a}↔T${b}는 비슷하게 들릴 수 있습니다.`);
  if (pairCount > 0 && meanSimilarity >= SET_SIMILARITY_WARN_THRESHOLD) {
    advisories.push(`세트 평균 음색 유사도가 ${meanSimilarity.toFixed(2)}로 높습니다.`);
  }
  if (levels.length > 1 && levelSpread > LEVEL_SPREAD_WARN_DB) {
    advisories.push(`음량 편차 ${levelSpread.toFixed(1)}dB — 플레이리스트에서 볼륨 차이가 느껴질 수 있습니다.`);
  }

  return {
    analyzedCount: analyzed.length,
    totalTracks,
    duration: { values: durationValues, overTarget, underTarget, targetRange: [minTarget, maxTarget] },
    killingPoint: { latePeakTracks, noLatePeakTracks, weakDynamicTracks, latePeakShare },
    timbre: { centroidSpread, clusteredPairs, meanSimilarity },
    level: { values: levelValues, spread: levelSpread },
    warnings,
    advisories
  };
}

function formatRange(minSec: number, maxSec: number): string {
  return `${formatMinSec(minSec)}~${formatMinSec(maxSec)}`;
}

function formatMinSec(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60);
  const seconds = Math.round(totalSec % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * TASK v3.74 (TASK C) — real listening feedback: "남녀 가수 음색이 너무
 * 비슷하다". Same shape/thresholds as buildAudioSetReport's `timbre` section
 * above, but on the 200-3500Hz vocal-band measurements (audioAnalysis.ts's
 * computeVocalBandMetrics) instead of the full-spectrum ones — this is the
 * check that's actually about the VOICE, not the whole mix. A separate
 * function (not folded into buildAudioSetReport) since it needs vocalType
 * per entry for the same-gender-narrow check, which the full-spectrum report
 * has no use for.
 */
export interface VocalDiversityEntry {
  trackNo: number;
  vocalType: string;
  vocalCentroid: number;
  vocalProfile: number[];
}

export interface VocalDiversityReport {
  centroidSpread: number;
  clusteredPairs: [number, number][];
  meanSimilarity: number;
  /** Per vocalType (e.g. 'male'/'female') with >=2 entries, the centroid spread within that type alone — spec's own "같은 vocalType 안에서 폭 < 200Hz → 경고, 남성 6곡이 다 같은 목소리". */
  sameTypeSpread: Array<{ vocalType: string; spread: number; count: number }>;
  advisories: string[];
}

const VOCAL_NARROW_SPREAD_HZ = 300;
const VOCAL_CLUSTER_SIMILARITY_THRESHOLD = 0.95;
const VOCAL_SET_SIMILARITY_WARN_THRESHOLD = 0.9;
const VOCAL_SAME_TYPE_NARROW_SPREAD_HZ = 200;

export function buildVocalDiversityReport(entries: readonly VocalDiversityEntry[]): VocalDiversityReport {
  const advisories: string[] = [];
  const centroids = entries.map(e => e.vocalCentroid);
  const centroidSpread = centroids.length > 1 ? Math.max(...centroids) - Math.min(...centroids) : 0;

  const clusteredPairs: [number, number][] = [];
  let similaritySum = 0;
  let pairCount = 0;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const similarity = cosineSimilarity(entries[i].vocalProfile, entries[j].vocalProfile);
      similaritySum += similarity;
      pairCount += 1;
      if (similarity >= VOCAL_CLUSTER_SIMILARITY_THRESHOLD) clusteredPairs.push([entries[i].trackNo, entries[j].trackNo]);
    }
  }
  const meanSimilarity = pairCount > 0 ? similaritySum / pairCount : 0;

  const byType = new Map<string, number[]>();
  for (const entry of entries) {
    const list = byType.get(entry.vocalType) ?? [];
    list.push(entry.vocalCentroid);
    byType.set(entry.vocalType, list);
  }
  const sameTypeSpread = [...byType.entries()]
    .filter(([, values]) => values.length >= 2)
    .map(([vocalType, values]) => ({ vocalType, spread: Math.max(...values) - Math.min(...values), count: values.length }));

  if (entries.length > 1 && centroidSpread < VOCAL_NARROW_SPREAD_HZ) advisories.push(`보컬 음색 폭이 좁습니다 (${Math.round(centroidSpread)}Hz) — 목소리가 다 비슷하게 들릴 수 있습니다.`);
  for (const [a, b] of clusteredPairs) advisories.push(`T${a}↔T${b}는 같은 목소리처럼 들릴 수 있습니다 (보컬 대역 유사도 높음).`);
  if (pairCount > 0 && meanSimilarity >= VOCAL_SET_SIMILARITY_WARN_THRESHOLD) advisories.push(`세트 평균 보컬 유사도가 ${meanSimilarity.toFixed(2)}로 높습니다.`);
  for (const { vocalType, spread, count } of sameTypeSpread) {
    if (spread < VOCAL_SAME_TYPE_NARROW_SPREAD_HZ) advisories.push(`같은 보컬 타입(${vocalType}) ${count}곡의 음역 폭이 좁습니다 (${Math.round(spread)}Hz) — 다 같은 목소리로 들릴 수 있습니다.`);
  }

  return { centroidSpread, clusteredPairs, meanSimilarity, sameTypeSpread, advisories };
}
