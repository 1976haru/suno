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

interface AveragedMagnitudeSpectrum {
  binCount: number;
  freqPerBin: number;
  /** Averaged (not yet normalized) magnitude per bin — bin i covers frequency i*freqPerBin Hz. */
  magnitudeAvg: Float64Array;
}

/**
 * TASK v3.74 (TASK C) — the actual FFT pass, shared by computeSpectrumMetrics
 * (full 0..Nyquist band) and computeVocalBandMetrics (200-3500Hz subset):
 * both derive from the exact same averaged spectrum instead of each running
 * their own FFT over the whole track, which would double analysis time for
 * no reason (they're just two different ways of reading the same data —
 * see analyzePcmData's own combined call below).
 */
function computeAveragedMagnitudeSpectrum(samples: Float32Array, sampleRate: number): AveragedMagnitudeSpectrum {
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

  const magnitudeAvg = new Float64Array(binCount);
  if (frameCount) {
    for (let bin = 0; bin < binCount; bin++) magnitudeAvg[bin] = magnitudeSum[bin] / frameCount;
  }
  return { binCount, freqPerBin: sampleRate / FFT_SIZE, magnitudeAvg };
}

function spectrumMetricsFromMagnitude(spectrum: AveragedMagnitudeSpectrum): SpectrumMetrics {
  const { binCount, freqPerBin, magnitudeAvg } = spectrum;
  let weightedFreqSum = 0;
  let magSum = 0;
  let lowSum = 0;
  let highSum = 0;
  for (let bin = 0; bin < binCount; bin++) {
    const mag = magnitudeAvg[bin];
    const freq = bin * freqPerBin;
    weightedFreqSum += freq * mag;
    magSum += mag;
    if (freq < LOW_BAND_HZ) lowSum += mag;
    if (freq > HIGH_BAND_HZ) highSum += mag;
  }

  if (magSum <= 0) return { spectralCentroid: 0, lowBandRatio: 0, highBandRatio: 0, spectrumProfile: Array(binCount).fill(0) };

  return {
    spectralCentroid: weightedFreqSum / magSum,
    lowBandRatio: lowSum / magSum,
    highBandRatio: highSum / magSum,
    spectrumProfile: Array.from(magnitudeAvg, mag => mag / magSum)
  };
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
  return spectrumMetricsFromMagnitude(computeAveragedMagnitudeSpectrum(samples, sampleRate));
}

/**
 * TASK v3.74 (TASK C) — real listening feedback: "남녀 가수 음색이 너무
 * 비슷하다". The full-band spectralCentroid above is dominated by the
 * instrumental mix, not the voice; restricting to 200-3500Hz (where vocal
 * formants live) makes the comparison actually about the voice, even though
 * the backing track isn't separated out (real source separation is heavy
 * and unreliable in-browser — see this task's own "반주와 분리하지
 * 마십시오"). This is a relative, cross-track comparison tool, not an
 * absolute measurement of "the singer's timbre" — always labeled as such
 * in the UI.
 */
export interface VocalMetrics {
  vocalCentroid: number;
  vocalLowRatio: number;
  vocalMidRatio: number;
  vocalHighRatio: number;
  vocalProfile: number[];
  registerHint: 'low' | 'mid' | 'high';
}

const VOCAL_BAND_LOW_HZ = 200;
const VOCAL_BAND_LOW_MID_HZ = 600;
const VOCAL_BAND_MID_HIGH_HZ = 1500;
const VOCAL_BAND_HIGH_HZ = 3500;
/** registerHint thresholds — a rough participant-facing label, not a confirmed classification (see this task's own "참고용, 확정 아님"). Picked from this task's own reference measurements: 664Hz read as "low, thick", 946-1109Hz as "mid", 1191Hz as "brighter". */
const REGISTER_HINT_LOW_MAX_HZ = 800;
const REGISTER_HINT_MID_MAX_HZ = 1150;

function vocalBandMetricsFromMagnitude(spectrum: AveragedMagnitudeSpectrum): VocalMetrics {
  const { binCount, freqPerBin, magnitudeAvg } = spectrum;
  const bandMagnitudes: number[] = [];
  const bandFreqs: number[] = [];
  let weightedFreqSum = 0;
  let magSum = 0;
  let lowSum = 0;
  let midSum = 0;
  let highSum = 0;

  for (let bin = 0; bin < binCount; bin++) {
    const freq = bin * freqPerBin;
    if (freq < VOCAL_BAND_LOW_HZ || freq > VOCAL_BAND_HIGH_HZ) continue;
    const mag = magnitudeAvg[bin];
    bandMagnitudes.push(mag);
    bandFreqs.push(freq);
    weightedFreqSum += freq * mag;
    magSum += mag;
    if (freq < VOCAL_BAND_LOW_MID_HZ) lowSum += mag;
    else if (freq < VOCAL_BAND_MID_HIGH_HZ) midSum += mag;
    else highSum += mag;
  }

  const vocalCentroid = magSum > 0 ? weightedFreqSum / magSum : 0;
  const vocalProfile = magSum > 0 ? bandMagnitudes.map(mag => mag / magSum) : bandMagnitudes.map(() => 0);
  const registerHint: VocalMetrics['registerHint'] =
    vocalCentroid < REGISTER_HINT_LOW_MAX_HZ ? 'low' : vocalCentroid < REGISTER_HINT_MID_MAX_HZ ? 'mid' : 'high';

  return {
    vocalCentroid,
    vocalLowRatio: magSum > 0 ? lowSum / magSum : 0,
    vocalMidRatio: magSum > 0 ? midSum / magSum : 0,
    vocalHighRatio: magSum > 0 ? highSum / magSum : 0,
    vocalProfile,
    registerHint
  };
}

/** Standalone entry point — see analyzePcmData for the combined (single-FFT-pass) production path. */
export function computeVocalBandMetrics(samples: Float32Array, sampleRate: number): VocalMetrics {
  return vocalBandMetricsFromMagnitude(computeAveragedMagnitudeSpectrum(samples, sampleRate));
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
function rmsCurveStats(samples: Float32Array) {
  const rmsCurve = computeRmsCurve(samples);
  const maxIdx = rmsCurve.reduce((best, value, idx) => (value > rmsCurve[best] ? idx : best), 0);
  const minValue = Math.min(...rmsCurve);
  const maxValue = rmsCurve[maxIdx];
  return { rmsCurve, peakPosition: rmsCurve.length > 1 ? maxIdx / (rmsCurve.length - 1) : 0, dynamicRange: maxValue - minValue };
}

export function analyzePcmData(samples: Float32Array, sampleRate: number, fileName: string): SongAudioMetrics {
  const durationSec = samples.length / sampleRate;
  const { rmsCurve, peakPosition, dynamicRange } = rmsCurveStats(samples);
  const spectrum = computeSpectrumMetrics(samples, sampleRate);

  const warnings: string[] = [];
  if (durationSec < 5) warnings.push('오디오 길이가 5초 미만입니다 — 잘못된 파일일 수 있습니다.');

  return {
    fileName,
    durationSec,
    rmsCurve,
    peakPosition,
    dynamicRange,
    overallLevel: rmsToDb(segmentRms(samples, 0, samples.length)),
    spectralCentroid: spectrum.spectralCentroid,
    lowBandRatio: spectrum.lowBandRatio,
    highBandRatio: spectrum.highBandRatio,
    spectrumProfile: spectrum.spectrumProfile,
    warnings
  };
}

/**
 * TASK v3.74 (TASK D) — does the prompt's BPM instruction actually land?
 * Spectral-flux onset envelope (1024-sample window, hop 512 — a much finer
 * hop than the 2048/4096 spectral pass above, since tempo needs real timing
 * resolution) autocorrelated over the 60-150 BPM range. Diagnostic only —
 * this task's own "템포를 곡 생성에 되먹이지 마십시오" — and never trusted
 * below ONSET_CONFIDENCE_FLOOR (0.4): a low autocorrelation peak means no
 * reliable beat was found, not that the beat is exactly at the highest
 * (possibly noise-driven) lag.
 */
export interface TempoEstimate {
  bpm: number;
  /** Normalized autocorrelation at the winning lag, roughly 0..1. Below 0.4, treat as unreliable (see this task's own "상관계수 0.4 미만이면 신뢰도 낮음"). */
  confidence: number;
}

const ONSET_FFT_SIZE = 1024;
const ONSET_HOP_SIZE = 512;
export const TEMPO_MIN_BPM = 60;
export const TEMPO_MAX_BPM = 150;
export const TEMPO_LOW_CONFIDENCE_THRESHOLD = 0.4;

function onsetEnvelope(samples: Float32Array): Float64Array {
  const window = hannWindow(ONSET_FFT_SIZE);
  const binCount = ONSET_FFT_SIZE / 2 + 1;
  const re = new Float64Array(ONSET_FFT_SIZE);
  const im = new Float64Array(ONSET_FFT_SIZE);
  let previousMag: Float64Array | null = null;
  const flux: number[] = [];

  for (let start = 0; start + ONSET_FFT_SIZE <= samples.length; start += ONSET_HOP_SIZE) {
    for (let i = 0; i < ONSET_FFT_SIZE; i++) {
      re[i] = samples[start + i] * window[i];
      im[i] = 0;
    }
    fftInPlace(re, im);
    const mag = new Float64Array(binCount);
    let frameFlux = 0;
    for (let bin = 0; bin < binCount; bin++) {
      mag[bin] = Math.hypot(re[bin], im[bin]);
      if (previousMag) frameFlux += Math.max(0, mag[bin] - previousMag[bin]);
    }
    flux.push(frameFlux);
    previousMag = mag;
  }
  return Float64Array.from(flux);
}

/**
 * Pure — autocorrelates an onset envelope over the lag range corresponding
 * to 60-150 BPM at this envelope's own frame rate (sampleRate/ONSET_HOP_SIZE
 * frames/sec), so it's independently testable against a synthetic
 * periodic-click envelope without decoding any audio.
 */
export function estimateTempoFromOnsetEnvelope(flux: Float64Array, sampleRate: number): TempoEstimate {
  const framesPerSecond = sampleRate / ONSET_HOP_SIZE;
  const minLag = Math.max(1, Math.floor((60 / TEMPO_MAX_BPM) * framesPerSecond));
  const maxLag = Math.min(flux.length - 1, Math.ceil((60 / TEMPO_MIN_BPM) * framesPerSecond));
  if (maxLag <= minLag) return { bpm: 0, confidence: 0 };

  // Mean-remove so a constant/DC-heavy envelope doesn't fake a correlation.
  const mean = flux.reduce((a, b) => a + b, 0) / flux.length;
  const centered = Float64Array.from(flux, v => v - mean);
  const energy = centered.reduce((sum, v) => sum + v * v, 0);
  if (energy <= 0) return { bpm: 0, confidence: 0 };

  let bestLag = minLag;
  let bestCorrelation = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < centered.length; i++) sum += centered[i] * centered[i + lag];
    const normalized = sum / energy;
    if (normalized > bestCorrelation) {
      bestCorrelation = normalized;
      bestLag = lag;
    }
  }

  const bpm = (60 * framesPerSecond) / bestLag;
  return { bpm, confidence: Math.max(0, bestCorrelation) };
}

/** Combined browser-facing entry: decodes/resamples once, then runs the onset envelope over the same mono PCM. */
export function estimateTempo(samples: Float32Array, sampleRate: number): TempoEstimate {
  return estimateTempoFromOnsetEnvelope(onsetEnvelope(samples), sampleRate);
}

/**
 * TASK v3.74 — the combined per-file analysis AudioTake recording actually
 * uses: one averaged-magnitude spectrum pass feeds both SongAudioMetrics and
 * VocalMetrics (see computeAveragedMagnitudeSpectrum's own doc comment), plus
 * one separate onset-envelope pass for TempoEstimate. `analyzePcmData`/
 * `analyzeAudioFile` above are kept as v3.73's original, smaller-surface
 * entry points (still used by AudioAnalysisPanel.tsx) — this is additive.
 */
export interface FullAudioAnalysis {
  metrics: SongAudioMetrics;
  vocalMetrics: VocalMetrics;
  tempoEstimate: TempoEstimate;
}

export function analyzeFullPcmData(samples: Float32Array, sampleRate: number, fileName: string): FullAudioAnalysis {
  const durationSec = samples.length / sampleRate;
  const { rmsCurve, peakPosition, dynamicRange } = rmsCurveStats(samples);
  const spectrum = computeAveragedMagnitudeSpectrum(samples, sampleRate);
  const spectrumMetrics = spectrumMetricsFromMagnitude(spectrum);
  const vocalMetrics = vocalBandMetricsFromMagnitude(spectrum);
  const tempoEstimate = estimateTempo(samples, sampleRate);

  const warnings: string[] = [];
  if (durationSec < 5) warnings.push('오디오 길이가 5초 미만입니다 — 잘못된 파일일 수 있습니다.');

  return {
    metrics: {
      fileName,
      durationSec,
      rmsCurve,
      peakPosition,
      dynamicRange,
      overallLevel: rmsToDb(segmentRms(samples, 0, samples.length)),
      spectralCentroid: spectrumMetrics.spectralCentroid,
      lowBandRatio: spectrumMetrics.lowBandRatio,
      highBandRatio: spectrumMetrics.highBandRatio,
      spectrumProfile: spectrumMetrics.spectrumProfile,
      warnings
    },
    vocalMetrics,
    tempoEstimate
  };
}

/**
 * Shared browser-only decode step: file -> mono PCM at ANALYSIS_SAMPLE_RATE.
 * Used by both analyzeAudioFile (v3.73) and analyzeFullAudioFile (v3.74) so
 * there's exactly one decode implementation. Exported (v4.0 TASK A) so
 * core/audioAnalysisClient.ts can call it directly: AudioContext/
 * OfflineAudioContext don't exist inside a Worker, so decode must stay on
 * the main thread even though the FFT/DSP pass that follows it now runs in
 * audioAnalysisWorker.ts.
 */
export async function decodeToMonoPcm(file: File): Promise<Float32Array> {
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
  return rendered.getChannelData(0);
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
  const mono = await decodeToMonoPcm(file);
  return analyzePcmData(mono, ANALYSIS_SAMPLE_RATE, file.name);
}

/** TASK v3.74 — same one-file-at-a-time contract as analyzeAudioFile, returning the full metrics+vocalMetrics+tempoEstimate bundle AudioTake recording needs. */
export async function analyzeFullAudioFile(file: File): Promise<FullAudioAnalysis> {
  const mono = await decodeToMonoPcm(file);
  return analyzeFullPcmData(mono, ANALYSIS_SAMPLE_RATE, file.name);
}
