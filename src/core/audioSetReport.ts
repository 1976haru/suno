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
  audienceProfile: AudienceProfile
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

  const latePeakTracks: number[] = [];
  const noLatePeakTracks: number[] = [];
  const weakDynamicTracks: number[] = [];
  for (const m of analyzed) {
    const trackNo = m.matchedTrackNo!;
    if (m.peakPosition >= LATE_PEAK_THRESHOLD) latePeakTracks.push(trackNo);
    else noLatePeakTracks.push(trackNo);
    if (m.dynamicRange < WEAK_DYNAMIC_RANGE_DB) weakDynamicTracks.push(trackNo);
  }
  const latePeakShare = analyzed.length > 0 ? latePeakTracks.length / analyzed.length : 0;

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
  if (analyzed.length > 0 && latePeakShare < LATE_PEAK_SHARE_TARGET) {
    advisories.push(`후반 상승이 ${Math.round(latePeakShare * 100)}%뿐입니다 (목표 60% 이상) — 킬링포인트가 후반부에서 잘 안 들릴 수 있습니다.`);
  }
  if (weakDynamicTracks.length) advisories.push(`진폭 부족(<6dB) ${weakDynamicTracks.length}곡: T${weakDynamicTracks.join(', T')} — 평평하게 들릴 수 있습니다.`);
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
