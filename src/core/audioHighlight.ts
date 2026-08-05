import { ANALYSIS_SAMPLE_RATE, computeSpectrumMetrics, decodeToMonoPcm } from './audioAnalysis';
import { decodeAudioFile, encodeWavFromAudioBuffer } from './audioEdit';
import { parseLeadingTrackNumber } from './audioTrackMatch';

/**
 * TASK v4.15 (TASK A) — "숏츠용 하이라이트": auto-picks a ~30s excerpt from a
 * finished Suno export for TikTok/Reels/Shorts. Reuses this app's own
 * established RMS/spectral-centroid math (src/core/audioAnalysis.ts) rather
 * than re-deriving DSP from scratch — only the BINNING differs (fixed
 * 1-second bins here, vs. that module's fixed 20-segment curve, since a
 * sliding 30s window needs a time-addressable resolution independent of a
 * track's total length).
 *
 * Pure functions (computeRmsBinsSec, computeCentroidBinsSec,
 * findClimaxWindow, correctBoundaryToPhraseGap, findRawPeakWindow,
 * buildShortsFadePlan, buildShortsFileName, isRepresentativeTrack) take
 * plain Float32Array/number[] and are fully unit-testable under vitest's
 * node environment, same split as audioAnalysis.ts/audioEdit.ts. Only
 * analyzeForHighlight/renderShortsClip touch browser-only APIs
 * (AudioContext/OfflineAudioContext).
 *
 * §5 do-not-list this task is built against: never overwrite the original
 * file, never store/encode mp3 (WAV only, via audioEdit.ts's encodeWav),
 * never include the excluded intro/outro zone, never cut mid-phrase (see
 * correctBoundaryToPhraseGap), never force the auto pick (every caller gets
 * back plain numbers a UI can override — nothing here mutates app state).
 */

export const SHORTS_LENGTH_OPTIONS = [15, 30, 60] as const;
export type ShortsLengthSec = (typeof SHORTS_LENGTH_OPTIONS)[number];
export const SHORTS_LENGTH_DEFAULT_SEC: ShortsLengthSec = 30;

/** §1-4 — fixed regardless of the chosen total length. */
export const SHORTS_FADE_IN_SEC = 0.3;
export const SHORTS_FADE_OUT_SEC = 1.5;

/** §1-2(3) — candidates never start inside the first 15% / last 10% of the track. */
const CLIMAX_FRONT_EXCLUDE_RATIO = 0.15;
const CLIMAX_BACK_EXCLUDE_RATIO = 0.1;
/** §1-3 — "±2초 이내에서 가장 낮은 RMS 지점을 찾아 보정". */
export const BOUNDARY_CORRECTION_TOLERANCE_SEC = 2;
const BOUNDARY_CORRECTION_BIN_SEC = 0.1;
/** §1-8 — 하루님 always makes shorts from tracks 1-3. */
const TRACK_PRIORITY_MAX = 3;

// ---------------------------------------------------------------------------
// Pure math — testable without a browser.
// ---------------------------------------------------------------------------

/**
 * Pure — linear RMS per `binSec`-second bin across the whole signal (last
 * bin absorbs any remainder). Deliberately a caller-chosen bin WIDTH rather
 * than audioAnalysis.ts's fixed 20-segment curve: scoring a sliding 30s
 * window needs bins addressable in real seconds, independent of how long the
 * track is.
 */
export function computeRmsBinsSec(samples: Float32Array, sampleRate: number, binSec = 1): number[] {
  const binLength = Math.max(1, Math.round(binSec * sampleRate));
  const bins: number[] = [];
  for (let start = 0; start < samples.length; start += binLength) {
    const end = Math.min(samples.length, start + binLength);
    let sumSquares = 0;
    for (let i = start; i < end; i++) sumSquares += samples[i] * samples[i];
    bins.push(Math.sqrt(sumSquares / Math.max(1, end - start)));
  }
  return bins.length ? bins : [0];
}

/** Pure — spectral centroid (Hz) per `binSec`-second bin, reusing audioAnalysis.ts's computeSpectrumMetrics on each slice. A bin shorter than the FFT window (silence at the very tail) reads as 0 — same "no signal" convention that module already uses. */
export function computeCentroidBinsSec(samples: Float32Array, sampleRate: number, binSec = 1): number[] {
  const binLength = Math.max(1, Math.round(binSec * sampleRate));
  const bins: number[] = [];
  for (let start = 0; start < samples.length; start += binLength) {
    const end = Math.min(samples.length, start + binLength);
    bins.push(computeSpectrumMetrics(samples.subarray(start, end), sampleRate).spectralCentroid);
  }
  return bins.length ? bins : [0];
}

function stdev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length);
}

function minMax(values: readonly number[]): [number, number] {
  return [Math.min(...values), Math.max(...values)];
}

/** 0..1, 0 when every value in the range is equal (avoids a NaN from dividing by a zero range). */
function normalize(value: number, [lo, hi]: [number, number]): number {
  return hi > lo ? (value - lo) / (hi - lo) : 0;
}

export interface HighlightWindowScore {
  startSec: number;
  score: number;
  avgRms: number;
  maxRms: number;
  /** Raw stdev (Hz) of the spectral centroid across the window — lower is more "stable". Informational; the score already folds this in (inverted+normalized). */
  centroidStabilityHz: number;
}

/**
 * Pure — §1-2's sliding-window climax score: avg RMS×0.5 + max RMS in
 * window×0.3 + spectral-centroid stability×0.2, excluding the front 15%/
 * back 10% of the track (§1-2(3)). Each component is min-max normalized
 * across all candidate windows of THIS track before weighting, so the score
 * ranks windows within one track regardless of that track's absolute
 * loudness or brightness — no arbitrary absolute scale constant needed.
 *
 * Falls back to scanning the WHOLE track (no exclusion) when the excluded
 * zone would leave no candidate window at all (a track barely longer than
 * the requested window) — returning null here would just push the caller
 * back to "last lengthSec seconds", which is worse than a best-effort scan.
 */
export function findClimaxWindow(rmsBins: readonly number[], centroidBins: readonly number[], windowSec: number, binSec = 1): HighlightWindowScore | null {
  const totalBins = rmsBins.length;
  const windowBins = Math.max(1, Math.round(windowSec / binSec));
  if (totalBins < windowBins) return null;

  const frontExcludeBins = Math.floor(totalBins * CLIMAX_FRONT_EXCLUDE_RATIO);
  const backExcludeBins = Math.floor(totalBins * CLIMAX_BACK_EXCLUDE_RATIO);
  let firstStart = frontExcludeBins;
  let lastStart = totalBins - backExcludeBins - windowBins;
  if (lastStart < firstStart) {
    firstStart = 0;
    lastStart = totalBins - windowBins;
  }

  const raws: { start: number; avgRms: number; maxRms: number; centroidStdev: number }[] = [];
  for (let start = firstStart; start <= lastStart; start++) {
    const rmsSlice = rmsBins.slice(start, start + windowBins);
    const avgRms = rmsSlice.reduce((a, b) => a + b, 0) / rmsSlice.length;
    const maxRms = Math.max(...rmsSlice);
    const centroidSlice = centroidBins.slice(start, start + windowBins).filter(c => c > 0);
    raws.push({ start, avgRms, maxRms, centroidStdev: stdev(centroidSlice) });
  }

  const avgRmsRange = minMax(raws.map(r => r.avgRms));
  const maxRmsRange = minMax(raws.map(r => r.maxRms));
  const stdevRange = minMax(raws.map(r => r.centroidStdev));

  let best = raws[0];
  let bestScore = -Infinity;
  for (const r of raws) {
    const avgNorm = normalize(r.avgRms, avgRmsRange);
    const maxNorm = normalize(r.maxRms, maxRmsRange);
    const stabilityNorm = 1 - normalize(r.centroidStdev, stdevRange); // lower stdev -> higher stability
    const score = avgNorm * 0.5 + maxNorm * 0.3 + stabilityNorm * 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  return { startSec: best.start * binSec, score: bestScore, avgRms: best.avgRms, maxRms: best.maxRms, centroidStabilityHz: best.centroidStdev };
}

/** Pure — the naive "just pick the loudest window, no exclusion/correction" baseline, kept only so a report can show what auto-detection improves on (§4 item 1's own "전체곡 최대구간과 비교"). */
export function findRawPeakWindow(rmsBins: readonly number[], windowBins: number, binSec = 1): { startSec: number; avgRms: number } {
  let bestStart = 0;
  let bestAvg = -Infinity;
  for (let start = 0; start + windowBins <= rmsBins.length; start++) {
    const slice = rmsBins.slice(start, start + windowBins);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestStart = start;
    }
  }
  return { startSec: bestStart * binSec, avgRms: bestAvg };
}

/**
 * Pure — §1-3: within ±toleranceSec of `candidateStartSec`, snap to the
 * lowest-RMS point (a gap between phrases) at fine (0.1s) resolution, rather
 * than starting mid-sentence. Operates directly on the decoded samples (not
 * the 1-second bins above) since ±2 seconds needs finer-than-1s resolution
 * to find a real gap.
 */
export function correctBoundaryToPhraseGap(
  samples: Float32Array,
  sampleRate: number,
  candidateStartSec: number,
  toleranceSec = BOUNDARY_CORRECTION_TOLERANCE_SEC,
  fineBinSec = BOUNDARY_CORRECTION_BIN_SEC
): number {
  const rangeStart = Math.max(0, candidateStartSec - toleranceSec);
  const rangeEnd = candidateStartSec + toleranceSec;
  const startSample = Math.floor(rangeStart * sampleRate);
  const endSample = Math.min(samples.length, Math.ceil(rangeEnd * sampleRate));
  if (endSample <= startSample) return Math.max(0, candidateStartSec);

  const binLength = Math.max(1, Math.round(fineBinSec * sampleRate));
  let bestSec = candidateStartSec;
  let bestRms = Infinity;
  for (let s = startSample; s < endSample; s += binLength) {
    const e = Math.min(endSample, s + binLength);
    let sumSquares = 0;
    for (let i = s; i < e; i++) sumSquares += samples[i] * samples[i];
    const rms = Math.sqrt(sumSquares / Math.max(1, e - s));
    if (rms < bestRms) {
      bestRms = rms;
      bestSec = s / sampleRate;
    }
  }
  return bestSec;
}

export interface ShortsFadePlan {
  /** Clip start in the SOURCE track's own timeline. */
  startSec: number;
  lengthSec: number;
  fadeInSec: number;
  fadeOutSec: number;
  /** Where the fade-out ramp begins, relative to the clip's own start (0 = clip start). */
  fadeOutStartSec: number;
  /** Clip end in the source track's own timeline. */
  endSec: number;
}

/** Pure — §1-4: 0.3s fade-in, 1.5s fade-out, total length (incl. fades) exactly `lengthSec`. */
export function buildShortsFadePlan(
  startSec: number,
  lengthSec: number,
  fadeInSec: number = SHORTS_FADE_IN_SEC,
  fadeOutSec: number = SHORTS_FADE_OUT_SEC
): ShortsFadePlan {
  const clampedStart = Math.max(0, startSec);
  const clampedFadeIn = Math.min(fadeInSec, lengthSec);
  const clampedFadeOut = Math.min(fadeOutSec, lengthSec);
  return {
    startSec: clampedStart,
    lengthSec,
    fadeInSec: clampedFadeIn,
    fadeOutSec: clampedFadeOut,
    fadeOutStartSec: Math.max(0, lengthSec - clampedFadeOut),
    endSec: clampedStart + lengthSec
  };
}

/** `<원본명>_shorts<길이>.wav` — e.g. "01 Still Warm_shorts30.wav". Never the original name, so a save can never overwrite the source file. */
export function buildShortsFileName(originalFileName: string, lengthSec: number): string {
  const dot = originalFileName.lastIndexOf('.');
  const base = dot > 0 ? originalFileName.slice(0, dot) : originalFileName;
  return `${base}_shorts${lengthSec}.wav`;
}

/** §1-8 — trackNo 1-3 (하루님's own "대표곡" convention). Reuses audioTrackMatch.ts's own leading-track-number parser rather than a second regex. */
export function isRepresentativeTrack(fileName: string): boolean {
  const noExt = fileName.replace(/\.[^./\\]+$/, '');
  const trackNo = parseLeadingTrackNumber(noExt);
  return trackNo !== null && trackNo >= 1 && trackNo <= TRACK_PRIORITY_MAX;
}

// ---------------------------------------------------------------------------
// Browser-only — decode + analyze + render via Web Audio API. Not exercised
// by vitest (node environment, no AudioContext global); the pure functions
// above carry the unit-test coverage, same split as audioAnalysis.ts/
// audioEdit.ts.
// ---------------------------------------------------------------------------

export interface HighlightAnalysis {
  fileName: string;
  durationSec: number;
  lengthSec: number;
  /** 1-second RMS bins across the whole track — for a waveform/volume-curve UI. */
  rmsBinsSec: number[];
  /** Final recommended start, AFTER §1-3 boundary correction. */
  recommendedStartSec: number;
  recommendedEndSec: number;
  /** Start BEFORE boundary correction — the UI/report can show the correction delta. */
  rawDetectedStartSec: number;
  /** The naive "loudest window, no exclusion" baseline — for report comparison only, never shown as a second recommendation. */
  wholeSongPeakStartSec: number;
  isRepresentative: boolean;
}

/**
 * One file, start to finish: decode (mono, analysis-rate — see
 * audioAnalysis.ts's decodeToMonoPcm) -> RMS/centroid bins -> climax window
 * -> boundary correction. Never touches the original File beyond reading it.
 */
export async function analyzeForHighlight(file: File, lengthSec: ShortsLengthSec = SHORTS_LENGTH_DEFAULT_SEC): Promise<HighlightAnalysis> {
  const mono = await decodeToMonoPcm(file);
  const sampleRate = ANALYSIS_SAMPLE_RATE;
  const durationSec = mono.length / sampleRate;

  const rmsBinsSec = computeRmsBinsSec(mono, sampleRate, 1);
  const centroidBinsSec = computeCentroidBinsSec(mono, sampleRate, 1);
  const windowBins = Math.max(1, Math.min(rmsBinsSec.length, Math.round(lengthSec)));

  const climax = findClimaxWindow(rmsBinsSec, centroidBinsSec, lengthSec, 1);
  const rawPeak = findRawPeakWindow(rmsBinsSec, windowBins, 1);
  const rawStartSec = climax?.startSec ?? Math.max(0, durationSec - lengthSec);
  const correctedStartSec = correctBoundaryToPhraseGap(mono, sampleRate, rawStartSec);

  return {
    fileName: file.name,
    durationSec,
    lengthSec,
    rmsBinsSec,
    recommendedStartSec: correctedStartSec,
    recommendedEndSec: Math.min(durationSec, correctedStartSec + lengthSec),
    rawDetectedStartSec: rawStartSec,
    wholeSongPeakStartSec: rawPeak.startSec,
    isRepresentative: isRepresentativeTrack(file.name)
  };
}

function getOfflineAudioContextCtor(): typeof OfflineAudioContext {
  return window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
}

/** Slices [startSec, startSec+lengthSec) out of `buffer` then applies the fade-in/fade-out gain envelope from `plan` via OfflineAudioContext — original channel count preserved (unlike the mono analysis pass above). */
async function renderShortsBuffer(buffer: AudioBuffer, plan: ShortsFadePlan): Promise<AudioBuffer> {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.max(0, Math.min(buffer.length, Math.floor(plan.startSec * sampleRate)));
  const lengthSamples = Math.max(1, Math.round(plan.lengthSec * sampleRate));
  const endSample = Math.min(buffer.length, startSample + lengthSamples);
  const sliceLength = Math.max(1, endSample - startSample);

  const sliced = new AudioBuffer({ numberOfChannels: buffer.numberOfChannels, length: sliceLength, sampleRate });
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    sliced.copyToChannel(buffer.getChannelData(ch).subarray(startSample, endSample), ch);
  }

  const OfflineCtor = getOfflineAudioContextCtor();
  const offline = new OfflineCtor(sliced.numberOfChannels, sliced.length, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = sliced;
  const gain = offline.createGain();

  const fadeInEnd = Math.min(plan.fadeInSec, plan.lengthSec);
  const fadeOutStart = Math.max(fadeInEnd, plan.fadeOutStartSec);
  gain.gain.setValueAtTime(0, 0);
  if (fadeInEnd > 0) gain.gain.linearRampToValueAtTime(1, fadeInEnd);
  else gain.gain.setValueAtTime(1, 0);
  gain.gain.setValueAtTime(1, fadeOutStart);
  gain.gain.linearRampToValueAtTime(0, plan.lengthSec);

  source.connect(gain).connect(offline.destination);
  source.start(0);
  return offline.startRendering();
}

/** Full-quality (original channel count, no downmix — see audioEdit.ts's decodeAudioFile) render of the shorts clip described by `plan`. Ready for encodeWavFromAudioBuffer. Never touches/mutates the source File. */
export async function renderShortsClip(file: File, plan: ShortsFadePlan): Promise<AudioBuffer> {
  const decoded = await decodeAudioFile(file);
  return renderShortsBuffer(decoded, plan);
}

/** Convenience: render + encode straight to a WAV Blob, ready for download. */
export async function renderShortsClipToWav(file: File, plan: ShortsFadePlan): Promise<Blob> {
  const rendered = await renderShortsClip(file, plan);
  return encodeWavFromAudioBuffer(rendered);
}
