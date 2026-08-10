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
  /**
   * 지시문 11 TASK F — 진짜 1초 단위 RMS dB 곡선의 최댓값-최솟값. `audioAnalysis.ts`의
   * `dynamicRange`는 트랙 길이와 무관하게 고정 20구간(RMS_SEGMENTS)이라 트랙이 길수록
   * 구간이 1초보다 훨씬 넓어져 하루가 실측한 "1초 단위" 진폭 편차와 다른 값이 된다 —
   * 이 필드는 실제로 1초 폭 윈도우로 계산해 그 실측값과 직접 비교 가능하게 한다.
   */
  oneSecRmsDeviationDb: number;
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

/**
 * Real 1-second-window RMS dB curve — max-across-channels combined per
 * window (same combine strategy as `firstNonSilentIndex`/`lastNonSilentIndex`
 * above), one value per whole second. The final partial window (< 1s of
 * remaining samples) is included only when it has at least half a second of
 * audio, so a track whose length isn't an exact multiple of 1s doesn't get a
 * spuriously quiet/loud trailing window skewing the deviation.
 */
function oneSecRmsDeviationDb(channels: readonly Float32Array[], sampleRate: number): number {
  const length = channels[0]?.length ?? 0;
  if (sampleRate <= 0 || length <= 0) return 0;
  const windowSamples = Math.round(sampleRate);
  const windowDbs: number[] = [];
  for (let start = 0; start < length; start += windowSamples) {
    const end = Math.min(start + windowSamples, length);
    if (end - start < windowSamples / 2 && windowDbs.length > 0) break;
    let sumSquares = 0;
    let count = 0;
    for (const channel of channels) {
      for (let i = start; i < end; i++) {
        sumSquares += channel[i] * channel[i];
        count += 1;
      }
    }
    windowDbs.push(rmsToDb(count > 0 ? Math.sqrt(sumSquares / count) : 0));
  }
  if (windowDbs.length < 2) return 0;
  return Math.max(...windowDbs) - Math.min(...windowDbs);
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
    channels: channels.length,
    oneSecRmsDeviationDb: oneSecRmsDeviationDb(channels, sampleRate)
  };
}

export type AmplitudeDeviationBand = 'flat' | 'good' | 'unrealistic' | 'unclassified';

/**
 * 지시문 28 (TASK C-4/C-6) — 하루가 20260808 세트 청취로 직접 정한 진폭 편차
 * 판정 대역("2.3~3.3dB 평평 · 5.0~5.8dB 좋음 · 6dB는 비현실적(36곡 중
 * 1곡)"). 실측(20260810 세트) 결과 18곡 중 11곡이 "평평" 대역에 있었고
 * 목표(5.0dB)와의 중앙값 격차가 이 지시문의 핵심 발견 중 하나였다 — 이
 * 함수는 그 판정을 코드로 고정해 다음 세트부터 업로드만 하면 바로 보이게
 * 한다. 청취로 검증된 값이므로 여기서 임의로 조정하지 않는다(§하지 말 것
 * "진폭 편차 목표 5.0dB를 실측에 맞춰 낮추지 말 것"). 차단하지 않는다 —
 * 표시용 라벨일 뿐, 어떤 관문에도 연결하지 않는다.
 */
export function amplitudeDeviationBand(deviationDb: number): AmplitudeDeviationBand {
  if (deviationDb >= 2.3 && deviationDb <= 3.3) return 'flat';
  if (deviationDb >= 5.0 && deviationDb <= 5.8) return 'good';
  if (deviationDb >= 6.0) return 'unrealistic';
  return 'unclassified';
}

export const AMPLITUDE_DEVIATION_BAND_LABEL_KO: Record<AmplitudeDeviationBand, string> = {
  flat: '평평 (2.3~3.3dB)',
  good: '좋음 (5.0~5.8dB)',
  unrealistic: '비현실적 (≥6dB)',
  unclassified: '미분류'
};

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
