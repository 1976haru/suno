import { estimateTempo, type TempoEstimate, ANALYSIS_SAMPLE_RATE } from './audioAnalysis';

/**
 * codex 지시문 06 (TASK A) — real gap confirmed by investigation:
 * core/audioAnalysis.ts already has a substantial, working real-audio
 * measurement pipeline (RMS curve, spectral centroid/band ratios, BPM via
 * onset-autocorrelation, vocal-band metrics) consumed by core/audioTakes.ts's
 * real `AudioTake` — but it deliberately downmixes to mono at a fixed
 * 22050Hz for spectral analysis speed (`decodeToMonoPcm`'s own doc
 * comment), so it never captures the SOURCE file's real channel count/
 * sample rate, and has no clipping/silence/stereo-width detection at all
 * (confirmed absent by investigation). This module is exactly those
 * missing pieces — a real, pure, testable layer alongside (not replacing)
 * audioAnalysis.ts's existing spectral pipeline.
 *
 * Same "pure function over PCM is independently testable; only the decode
 * step touches AudioContext" split this whole audio module already
 * established (audioAnalysis.ts's own top doc comment) — computeAudio­
 * Measurements works on any Float32Array channel data (synthetic or real),
 * only decodeToChannelsPcm below is browser-only.
 */

export interface AudioMeasurements {
  durationSec: number;
  bpm: number;
  bpmConfidence: number;
  leadingSilenceSec: number;
  trailingSilenceSec: number;
  /** Max absolute sample value across every channel, 0..1+ (a value >= 1 already implies clipping). */
  peak: number;
  /**
   * Plain whole-signal RMS in dB, same deliberate "NOT true LUFS" honesty
   * as audioAnalysis.ts's own `overallLevel` (EBU R128 K-weighting/gating
   * isn't implemented here either) — named to match this task's own literal
   * "LUFS/근사 loudness" ask while staying honest about what it actually is.
   */
  approximateLoudnessDb: number;
  clippingSampleCount: number;
  clipping: boolean;
  /** 0 (mono, or perfectly identical L/R) .. 1 (fully decorrelated stereo image). Always 0 for a single-channel source — there's no stereo image to measure. */
  stereoWidth: number;
  sampleRate: number;
  channels: number;
}

/** A sample at or above this magnitude counts as clipped — 0dBFS minus a small margin for lossy-codec ringing/inter-sample peaks, same spirit as broadcast true-peak limiting practice (not a precise ITU-R BS.1770 true-peak measurement — that needs oversampling this module doesn't do). */
const CLIP_THRESHOLD = 0.999;
/** Below this magnitude counts as silence for leading/trailing detection — roughly -60dBFS, quiet enough that normal decoder dither/noise floor doesn't get misread as "sound already started". */
const SILENCE_AMPLITUDE_THRESHOLD = 0.001;

function rmsToDb(rms: number): number {
  return 20 * Math.log10(Math.max(rms, 1e-5));
}

/** First index (in samples) where the combined (max-across-channels) envelope rises above the silence threshold — samples.length itself when the whole signal is silent. */
function firstNonSilentIndex(channels: readonly Float32Array[]): number {
  const length = channels[0]?.length ?? 0;
  for (let i = 0; i < length; i++) {
    for (const channel of channels) {
      if (Math.abs(channel[i]) >= SILENCE_AMPLITUDE_THRESHOLD) return i;
    }
  }
  return length;
}

function lastNonSilentIndex(channels: readonly Float32Array[]): number {
  const length = channels[0]?.length ?? 0;
  for (let i = length - 1; i >= 0; i--) {
    for (const channel of channels) {
      if (Math.abs(channel[i]) >= SILENCE_AMPLITUDE_THRESHOLD) return i;
    }
  }
  return -1;
}

/**
 * Mid/side decomposition width estimate: side = (L-R)/2, mid = (L+R)/2,
 * width = RMS(side) / (RMS(mid) + RMS(side)). 0 when the two channels are
 * identical (mono content panned center, or a real mono file), approaching
 * 1 as the channels diverge — a standard, if approximate, stereo-width
 * proxy (real mastering tools use the same mid/side ratio idea).
 */
function computeStereoWidth(left: Float32Array, right: Float32Array): number {
  const length = Math.min(left.length, right.length);
  if (!length) return 0;
  let midSumSquares = 0;
  let sideSumSquares = 0;
  for (let i = 0; i < length; i++) {
    const mid = (left[i] + right[i]) / 2;
    const side = (left[i] - right[i]) / 2;
    midSumSquares += mid * mid;
    sideSumSquares += side * side;
  }
  const midRms = Math.sqrt(midSumSquares / length);
  const sideRms = Math.sqrt(sideSumSquares / length);
  const denominator = midRms + sideRms;
  return denominator > 0 ? sideRms / denominator : 0;
}

export interface ComputeAudioMeasurementsInput {
  /** 1 (mono) or 2+ (stereo/multichannel) equal-length channel buffers, at the SOURCE file's own real sample rate (not resampled/downmixed — unlike audioAnalysis.ts's spectral pipeline, this module measures the file as it actually is). */
  channels: readonly Float32Array[];
  sampleRate: number;
  /** Reuses an already-computed TempoEstimate (e.g. from analyzeFullPcmData's own onset-autocorrelation pass) when the caller has one, so BPM is never computed twice over the same audio — falls back to running it here (over channel 0) when omitted. */
  tempoEstimate?: TempoEstimate;
}

export function computeAudioMeasurements(input: ComputeAudioMeasurementsInput): AudioMeasurements {
  const { channels, sampleRate } = input;
  const length = channels[0]?.length ?? 0;
  const durationSec = sampleRate > 0 ? length / sampleRate : 0;

  let peak = 0;
  let clippingSampleCount = 0;
  let sumSquares = 0;
  let totalSamples = 0;
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const magnitude = Math.abs(channel[i]);
      if (magnitude > peak) peak = magnitude;
      if (magnitude >= CLIP_THRESHOLD) clippingSampleCount += 1;
      sumSquares += channel[i] * channel[i];
      totalSamples += 1;
    }
  }
  const approximateLoudnessDb = rmsToDb(totalSamples > 0 ? Math.sqrt(sumSquares / totalSamples) : 0);

  const firstIndex = firstNonSilentIndex(channels);
  const lastIndex = lastNonSilentIndex(channels);
  const leadingSilenceSec = sampleRate > 0 ? Math.min(firstIndex, length) / sampleRate : 0;
  const trailingSilenceSec = sampleRate > 0 && lastIndex >= 0 ? Math.max(0, (length - 1 - lastIndex)) / sampleRate : durationSec;

  const tempoEstimate = input.tempoEstimate ?? estimateTempo(channels[0] ?? new Float32Array(0), sampleRate || ANALYSIS_SAMPLE_RATE);

  const stereoWidth = channels.length >= 2 ? computeStereoWidth(channels[0], channels[1]) : 0;

  return {
    durationSec,
    bpm: tempoEstimate.bpm,
    bpmConfidence: tempoEstimate.confidence,
    leadingSilenceSec,
    trailingSilenceSec,
    peak,
    approximateLoudnessDb,
    clippingSampleCount,
    clipping: clippingSampleCount > 0,
    stereoWidth,
    sampleRate,
    channels: channels.length
  };
}

/**
 * Browser-only: decodes a file to its REAL native channel layout/sample
 * rate (unlike audioAnalysis.ts's decodeToMonoPcm, which deliberately
 * downmixes+resamples for spectral-analysis speed) — this module needs the
 * genuine per-channel data to measure stereo width, and the genuine
 * sampleRate/channel count as real fields, not audioAnalysis.ts's fixed
 * analysis-rate stand-ins.
 */
export async function decodeToChannelsPcm(file: File): Promise<{ channels: Float32Array[]; sampleRate: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const decodeContext = new AudioContextCtor();
  let decoded: AudioBuffer;
  try {
    decoded = await decodeContext.decodeAudioData(arrayBuffer);
  } finally {
    await decodeContext.close().catch(() => {});
  }
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < decoded.numberOfChannels; ch++) channels.push(decoded.getChannelData(ch));
  return { channels, sampleRate: decoded.sampleRate };
}

/** Combined browser-facing entry: decode + measure, one file at a time (same "await one file, let it go out of scope" discipline as audioAnalysis.ts's own analyzeAudioFile). */
export async function analyzeAudioMeasurementsFromFile(file: File, tempoEstimate?: TempoEstimate): Promise<AudioMeasurements> {
  const { channels, sampleRate } = await decodeToChannelsPcm(file);
  return computeAudioMeasurements({ channels, sampleRate, tempoEstimate });
}
