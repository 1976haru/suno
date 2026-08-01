/**
 * TASK v3.73 (TASK A) — browser-only audio analysis of a real Suno mp3
 * export: RMS curve, spectral centroid/band ratios, a comparable spectrum
 * profile. No server, no ffmpeg, no external DSP library (would bloat the
 * v3.71 single-file build) — decodeAudioData() + a small hand-rolled FFT.
 *
 * `analyzePcmData` is the pure, fully unit-testable half (works on any
 * Float32Array — a real decoded file or a synthetic sine wave). Only
 * `analyzeAudioFile` touches browser-only APIs (AudioContext), so the DSP
 * itself can be verified with known signals independent of real mp3 decode.
 *
 * TASK v3.73 §0-2's own explicit finding is the reason this exists: text
 * metrics (prompt length, genre similarity, word count) have never predicted
 * what a rendered song actually sounds like. This measures the rendered
 * audio directly — duration, whether a track actually lifts late (a killing
 * point's audible signature), how wide the pack's timbre palette really is.
 *
 * TASK v3.73 §1-4 — deliberately NOT true LUFS (EBU R128 needs K-weighting +
 * gating). `overallLevel` is plain RMS in dB, good enough for comparing
 * tracks WITHIN one set; never presented as an absolute loudness standard.
 */

export interface SongAudioMetrics {
  fileName: string;
  matchedSongId?: string;
  matchedTrackNo?: number;

  durationSec: number;

  /** 20-segment RMS curve, in dB (see rmsToDb — silence floors at -100dB, never -Infinity). */
  rmsCurve: number[];
  /** Position (0..1) of the loudest segment. >= 0.75 reads as a late/killing-point-style lift. */
  peakPosition: number;
  /** Loudest segment dB minus quietest segment dB — how much the track's own volume actually moves. */
  dynamicRange: number;
  /** Whole-track RMS in dB — relative-only, see this module's own doc comment. */
  overallLevel: number;

  /** Amplitude-weighted mean frequency (Hz) — higher reads as a brighter mix. */
  spectralCentroid: number;
  /** Share of spectral energy below 250Hz (0..1). */
  lowBandRatio: number;
  /** Share of spectral energy above 4000Hz (0..1). */
  highBandRatio: number;
  /** Normalized (sums to 1) averaged magnitude spectrum — same length/binning for every track in this app, so two tracks' vectors are directly comparable (see cosineSimilarity). */
  spectrumProfile: number[];

  warnings: string[];
}

/** Analysis runs at this sample rate regardless of the source file's own rate — TASK A's own "모노 22050Hz로 다운샘플해도 충분합니다" (speed over needless precision; nothing here needs the full audible band beyond ~11kHz Nyquist). */
export const ANALYSIS_SAMPLE_RATE = 22050;
const RMS_SEGMENTS = 20;
/** Radix-2 FFT size — 2048 samples @ 22050Hz ≈ 93ms per frame, fine resolution for a spectral-centroid/band-ratio estimate. */
const FFT_SIZE = 2048;
/** TASK v3.73 §1-3 spec: hop 4096 (larger than the 2048 window, i.e. frames don't overlap and skip audio between them) — a deliberate speed/coverage tradeoff for an 18-song-in-90-seconds budget, not full-signal STFT precision. */
const HOP_SIZE = 4096;
const LOW_BAND_HZ = 250;
const HIGH_BAND_HZ = 4000;

function rmsToDb(rms: number): number {
  return 20 * Math.log10(Math.max(rms, 1e-5));
}

function segmentRms(samples: Float32Array, start: number, end: number): number {
  let sumSquares = 0;
  const n = Math.max(1, end - start);
  for (let i = start; i < end; i++) sumSquares += samples[i] * samples[i];
  return Math.sqrt(sumSquares / n);
}

/** 20-segment RMS curve in dB, evenly splitting the signal (last segment absorbs any remainder). */
export function computeRmsCurve(samples: Float32Array, segments = RMS_SEGMENTS): number[] {
  if (!samples.length) return Array(segments).fill(-100);
  const segmentLength = Math.floor(samples.length / segments);
  const curve: number[] = [];
  for (let s = 0; s < segments; s++) {
    const start = s * segmentLength;
    const end = s === segments - 1 ? samples.length : start + segmentLength;
    curve.push(rmsToDb(segmentRms(samples, start, end)));
  }
  return curve;
}

/**
 * Iterative radix-2 Cooley-Tukey FFT, in place. `re`/`im` must have a
 * power-of-2 length. No external dependency — this app's whole reason for
 * hand-rolling DSP instead of pulling in a library (single-file build size).
 */
function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const angleStep = (-2 * Math.PI) / len;
    for (let start = 0; start < n; start += len) {
      for (let k = 0; k < half; k++) {
        const angle = angleStep * k;
        const wRe = Math.cos(angle);
        const wIm = Math.sin(angle);
        const evenIdx = start + k;
        const oddIdx = start + k + half;
        const oddRe = re[oddIdx] * wRe - im[oddIdx] * wIm;
        const oddIm = re[oddIdx] * wIm + im[oddIdx] * wRe;
        re[oddIdx] = re[evenIdx] - oddRe;
        im[oddIdx] = im[evenIdx] - oddIm;
        re[evenIdx] += oddRe;
        im[evenIdx] += oddIm;
      }
    }
  }
}

function hannWindow(size: number): Float64Array {
  const window = new Float64Array(size);
  for (let i = 0; i < size; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
  return window;
}

export interface SpectrumMetrics {
  spectralCentroid: number;
  lowBandRatio: number;
  highBandRatio: number;
  spectrumProfile: number[];
}

/**
 * Averages the magnitude spectrum across non-overlapping FFT_SIZE frames
 * (hop HOP_SIZE apart — see this module's own doc comment on why hop >
 * window), then derives centroid/band ratios/the comparable profile vector
 * from that single averaged spectrum. Every track analyzed by this app uses
 * the same sampleRate/FFT_SIZE, so spectrumProfile vectors are always the
 * same length and directly comparable via cosineSimilarity.
 */
export function computeSpectrumMetrics(samples: Float32Array, sampleRate: number): SpectrumMetrics {
  const window = hannWindow(FFT_SIZE);
  const binCount = FFT_SIZE / 2 + 1;
  const magnitudeSum = new Float64Array(binCount);
  let frameCount = 0;

  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  for (let start = 0; start + FFT_SIZE <= samples.length; start += HOP_SIZE) {
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = samples[start + i] * window[i];
      im[i] = 0;
    }
    fftInPlace(re, im);
    for (let bin = 0; bin < binCount; bin++) {
      magnitudeSum[bin] += Math.hypot(re[bin], im[bin]);
    }
    frameCount += 1;
  }

  if (!frameCount) {
    return { spectralCentroid: 0, lowBandRatio: 0, highBandRatio: 0, spectrumProfile: Array(binCount).fill(0) };
  }

  const freqPerBin = sampleRate / FFT_SIZE;
  let weightedFreqSum = 0;
  let magSum = 0;
  let lowSum = 0;
  let highSum = 0;
  for (let bin = 0; bin < binCount; bin++) {
    const mag = magnitudeSum[bin] / frameCount;
    const freq = bin * freqPerBin;
    weightedFreqSum += freq * mag;
    magSum += mag;
    if (freq < LOW_BAND_HZ) lowSum += mag;
    if (freq > HIGH_BAND_HZ) highSum += mag;
  }

  const spectralCentroid = magSum > 0 ? weightedFreqSum / magSum : 0;
  const lowBandRatio = magSum > 0 ? lowSum / magSum : 0;
  const highBandRatio = magSum > 0 ? highSum / magSum : 0;
  const spectrumProfile = magSum > 0
    ? Array.from(magnitudeSum, mag => mag / frameCount / magSum)
    : Array(binCount).fill(0);

  return { spectralCentroid, lowBandRatio, highBandRatio, spectrumProfile };
}

/** Cosine similarity of two equal-length vectors, 0 for a zero vector (never NaN/divide-by-zero). */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Pure analysis of already-decoded mono PCM — no browser API, fully
 * unit-testable with a synthetic signal (e.g. a known-frequency sine wave
 * should land its spectralCentroid near that frequency).
 */
export function analyzePcmData(samples: Float32Array, sampleRate: number, fileName: string): SongAudioMetrics {
  const durationSec = samples.length / sampleRate;
  const rmsCurve = computeRmsCurve(samples);
  const maxIdx = rmsCurve.reduce((best, value, idx) => (value > rmsCurve[best] ? idx : best), 0);
  const minValue = Math.min(...rmsCurve);
  const maxValue = rmsCurve[maxIdx];
  const spectrum = computeSpectrumMetrics(samples, sampleRate);

  const warnings: string[] = [];
  if (durationSec < 5) warnings.push('오디오 길이가 5초 미만입니다 — 잘못된 파일일 수 있습니다.');

  return {
    fileName,
    durationSec,
    rmsCurve,
    peakPosition: rmsCurve.length > 1 ? maxIdx / (rmsCurve.length - 1) : 0,
    dynamicRange: maxValue - minValue,
    overallLevel: rmsToDb(segmentRms(samples, 0, samples.length)),
    spectralCentroid: spectrum.spectralCentroid,
    lowBandRatio: spectrum.lowBandRatio,
    highBandRatio: spectrum.highBandRatio,
    spectrumProfile: spectrum.spectrumProfile,
    warnings
  };
}

/**
 * Browser-only: decodes one file, downmixes to mono, resamples to
 * ANALYSIS_SAMPLE_RATE via OfflineAudioContext, runs analyzePcmData, then
 * lets the (large) decoded buffers go out of scope for GC. TASK A's own
 * "한 곡씩 처리하고 즉시 해제하십시오" — the caller must await this one file
 * at a time (never Promise.all across a whole pack) for that to hold; this
 * function itself never retains a reference past its own return.
 */
export async function analyzeAudioFile(file: File): Promise<SongAudioMetrics> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const decodeContext = new AudioContextCtor();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeContext.decodeAudioData(arrayBuffer);
  } finally {
    await decodeContext.close().catch(() => {});
  }

  const targetLength = Math.max(1, Math.round(decoded.duration * ANALYSIS_SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, targetLength, ANALYSIS_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const mono = rendered.getChannelData(0);

  return analyzePcmData(mono, ANALYSIS_SAMPLE_RATE, file.name);
}
