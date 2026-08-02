/**
 * TASK v3.79 (TASK E) — shorten a finished Suno mp3 export that rendered
 * longer than wanted (하루님's own framing: "음원이 4분짜리면 내가 30초
 * 줄여서 3분 30초로 만들 수 있는 기능"). Exactly two edit modes, and no
 * others — the parent spec explicitly forbids mid-track cutting/splicing
 * ("섹션 경계를 정확히 못 찾으면 뚝 끊깁니다... 이번 범위에서 제외"):
 *
 *  1. Fade-out early end — ramp to silence over the last several seconds
 *     and discard everything after the target duration. Always hits the
 *     target exactly (as long as the fade fits inside it).
 *  2. Speed adjustment — literal resampling-based playback-rate change
 *     (pitch rises with speed — that's accepted, not a bug: "피치도 함께
 *     올라가므로"). Hard-capped at +3% ("3%를 넘기지 마십시오" — audible
 *     pitch shift beyond that). May not fully reach the target; callers
 *     must surface the real shortfall, never silently fail short.
 *
 * Browser Web Audio API only — no external DSP/audio library (this app's
 * own single-file-build-size constraint; see src/core/audioAnalysis.ts's
 * decodeToMonoPcm for the established decode idiom this file's
 * decodeAudioFile follows, except this keeps original channel count
 * instead of downmixing to mono).
 *
 * The two compute* functions (computeFadeOutPlan, computeSpeedPlan) and
 * encodeWav are pure — no AudioContext/window — so they're fully
 * unit-testable under vitest's node environment. Everything below the
 * "browser-only" marker touches AudioContext/OfflineAudioContext and can
 * only be exercised by hand in a real browser (see this module's own
 * summary note on that limitation).
 */

// ---------------------------------------------------------------------------
// Pure math — testable without a browser.
// ---------------------------------------------------------------------------

export const FADE_LENGTH_MIN_SEC = 3;
export const FADE_LENGTH_MAX_SEC = 15;
export const FADE_LENGTH_DEFAULT_SEC = 8;

export interface FadeOutPlan {
  /** Where the fade-to-silence ramp begins, in seconds from the start of the track. */
  fadeStartSec: number;
  /** Fade length actually used — may be shorter than requested if it wouldn't fit before the target (see warning). */
  fadeLengthSec: number;
  /** The fade length as requested, before any clamping — for the UI to detect+explain a mismatch. */
  requestedFadeLengthSec: number;
  /** Final duration after the edit. Fade-out can always hit any target <= the current duration exactly, so this always equals the (possibly clamped) target. */
  achievedDurationSec: number;
  /** Set when either the fade length or the target itself had to be clamped. Korean, UI-ready. */
  warning?: string;
}

/**
 * Pure — cut a track short by fading to silence over the last
 * `fadeLengthSec` seconds of `targetDurationSec`, then discarding audio
 * after the target. Always achieves the target exactly (clamped to
 * [0, currentDurationSec] if the caller asks for something out of range).
 */
export function computeFadeOutPlan(
  currentDurationSec: number,
  targetDurationSec: number,
  fadeLengthSec: number = FADE_LENGTH_DEFAULT_SEC
): FadeOutPlan {
  const warnings: string[] = [];

  let target = targetDurationSec;
  if (!Number.isFinite(target) || target < 0) target = 0;
  if (target > currentDurationSec) {
    warnings.push(`목표 길이가 원본(${currentDurationSec.toFixed(1)}초)보다 깁니다 — 원본 길이로 조정했습니다.`);
    target = currentDurationSec;
  }

  let fadeLength = Number.isFinite(fadeLengthSec) ? fadeLengthSec : FADE_LENGTH_DEFAULT_SEC;
  if (fadeLength < 0) fadeLength = 0;
  if (fadeLength > target) {
    warnings.push(`페이드 길이(${fadeLengthSec.toFixed(1)}초)가 목표 길이보다 길어 ${target.toFixed(1)}초로 줄였습니다.`);
    fadeLength = target;
  }

  return {
    fadeStartSec: target - fadeLength,
    fadeLengthSec: fadeLength,
    requestedFadeLengthSec: fadeLengthSec,
    achievedDurationSec: target,
    warning: warnings.length ? warnings.join(' ') : undefined
  };
}

/** Hard ceiling — pitch shifts audibly beyond this (spec's own "3%를 넘기지 마십시오"). Enforced in code below, not just documented. */
export const MAX_SPEEDUP_PCT = 0.03;

export interface SpeedPlan {
  /** Playback-rate multiplier to apply, always in [1, 1 + maxSpeedupPct]. Never exceeds MAX_SPEEDUP_PCT regardless of what the caller passes for maxSpeedupPct. */
  speedRatio: number;
  /** Duration actually achieved at speedRatio. */
  achievedDurationSec: number;
  /** True only if achievedDurationSec reaches (or beats) the requested target. */
  targetReached: boolean;
  /** How many seconds longer than the target the achieved duration still is. 0 when targetReached. */
  shortfallSec: number;
  /** The effective cap actually used (after clamping the caller's request to MAX_SPEEDUP_PCT). */
  maxSpeedupPct: number;
}

/**
 * Pure — the playback-rate increase needed to reach targetDurationSec,
 * capped at maxSpeedupPct (itself hard-capped at MAX_SPEEDUP_PCT no matter
 * what the caller passes — this is the actual code-level enforcement of
 * the spec's 3% ceiling, not just a default value a caller could override
 * upward). If 3% isn't enough to reach the target, returns the real
 * achievable duration and shortfall instead of pretending it worked.
 */
export function computeSpeedPlan(
  currentDurationSec: number,
  targetDurationSec: number,
  maxSpeedupPct: number = MAX_SPEEDUP_PCT
): SpeedPlan {
  const cappedMax = Math.min(Math.max(Number.isFinite(maxSpeedupPct) ? maxSpeedupPct : MAX_SPEEDUP_PCT, 0), MAX_SPEEDUP_PCT);

  let target = targetDurationSec;
  if (!Number.isFinite(target) || target < 0) target = 0;
  if (target > currentDurationSec) target = currentDurationSec;

  const requiredRatio = target > 0 ? currentDurationSec / target : 1 + cappedMax;
  const speedRatio = Math.min(Math.max(requiredRatio, 1), 1 + cappedMax);
  const achievedDurationSec = currentDurationSec / speedRatio;
  const shortfallSec = Math.max(0, achievedDurationSec - target);

  return {
    speedRatio,
    achievedDurationSec,
    targetReached: shortfallSec < 1e-6,
    shortfallSec,
    maxSpeedupPct: cappedMax
  };
}

/** mm:ss, e.g. 210 -> "3:30". Negative/NaN input reads as "0:00". */
export function formatMinSec(totalSec: number): string {
  const clamped = Number.isFinite(totalSec) && totalSec > 0 ? totalSec : 0;
  const minutes = Math.floor(clamped / 60);
  const seconds = Math.round(clamped % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Parses "mm:ss" or a bare seconds number back into seconds. Returns null for unparseable input. */
export function parseMinSec(text: string): number | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^(\d+):([0-5]?\d)$/);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  const asNumber = Number(trimmed);
  return Number.isFinite(asNumber) && asNumber >= 0 ? asNumber : null;
}

/** `<원본이름>_edit.wav` — never the original name, so a save can never collide with/overwrite the source file. */
export function buildEditedFileName(originalFileName: string): string {
  const dot = originalFileName.lastIndexOf('.');
  const base = dot > 0 ? originalFileName.slice(0, dot) : originalFileName;
  return `${base}_edit.wav`;
}

// ---------------------------------------------------------------------------
// WAV encoding — pure (operates on plain Float32Array channel data, not a
// live AudioBuffer), so it's testable under vitest's node environment too.
// Standard 44-byte RIFF/WAVE header + 16-bit PCM interleaved samples — no
// need for 24/32-bit or float WAV per this task's own scope.
// ---------------------------------------------------------------------------

const WAV_BITS_PER_SAMPLE = 16;
const WAV_BYTES_PER_SAMPLE = WAV_BITS_PER_SAMPLE / 8;

/** Pure — encodes already-extracted per-channel PCM (all channels same length) as a 16-bit PCM WAV Blob. */
export function encodeWav(channels: Float32Array[], sampleRate: number): Blob {
  const numChannels = Math.max(1, channels.length);
  const numFrames = channels[0]?.length ?? 0;
  const blockAlign = numChannels * WAV_BYTES_PER_SAMPLE;
  const dataSize = numFrames * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // format 1 = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, WAV_BITS_PER_SAMPLE, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let frame = 0; frame < numFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][frame] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/** Convenience wrapper over encodeWav for a real decoded AudioBuffer. */
export function encodeWavFromAudioBuffer(buffer: AudioBuffer): Blob {
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) channels.push(buffer.getChannelData(ch));
  return encodeWav(channels, buffer.sampleRate);
}

// ---------------------------------------------------------------------------
// Browser-only — decode + render via Web Audio API. None of this is
// exercised by vitest (node environment, no AudioContext/OfflineAudioContext
// global); verified by hand in a real browser only. Kept out of the pure
// section above deliberately, per this task's own instruction to separate
// pure math from browser-dependent rendering.
// ---------------------------------------------------------------------------

function getAudioContextCtor(): typeof AudioContext {
  return window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
}

function getOfflineAudioContextCtor(): typeof OfflineAudioContext {
  return window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
}

/** Decodes a File to an AudioBuffer, preserving its original channel count (unlike audioAnalysis.ts's decodeToMonoPcm, which intentionally downmixes for analysis-only purposes). Never mutates or consumes the caller's File. */
export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextCtor = getAudioContextCtor();
  const ctx = new AudioContextCtor();
  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    await ctx.close().catch(() => {});
  }
}

/** Extracts [startSec, endSec) of an AudioBuffer into a new, standalone AudioBuffer. Used to render only the tail portion for preview, instead of processing the whole track. */
function sliceAudioBuffer(buffer: AudioBuffer, startSec: number, endSec: number): AudioBuffer {
  const start = Math.max(0, Math.min(buffer.length, Math.floor(startSec * buffer.sampleRate)));
  const end = Math.max(start, Math.min(buffer.length, Math.ceil(endSec * buffer.sampleRate)));
  const length = Math.max(1, end - start);
  const sliced = new AudioBuffer({ numberOfChannels: buffer.numberOfChannels, length, sampleRate: buffer.sampleRate });
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    sliced.copyToChannel(buffer.getChannelData(ch).subarray(start, start + length), ch);
  }
  return sliced;
}

/** Renders `buffer` through a GainNode fade-to-silence envelope ([fadeStartSec, fadeStartSec+fadeLengthSec] -> silence), truncated to outputDurationSec. */
async function renderFadeOutBuffer(buffer: AudioBuffer, fadeStartSec: number, fadeLengthSec: number, outputDurationSec: number): Promise<AudioBuffer> {
  const sampleRate = buffer.sampleRate;
  const length = Math.max(1, Math.round(outputDurationSec * sampleRate));
  const OfflineCtor = getOfflineAudioContextCtor();
  const offline = new OfflineCtor(buffer.numberOfChannels, length, sampleRate);

  const source = offline.createBufferSource();
  source.buffer = buffer;
  const gain = offline.createGain();

  const fadeStart = Math.max(0, fadeStartSec);
  const fadeEnd = Math.max(fadeStart, Math.min(outputDurationSec, fadeStart + Math.max(0, fadeLengthSec)));
  gain.gain.setValueAtTime(1, 0);
  if (fadeEnd > fadeStart) {
    gain.gain.setValueAtTime(1, fadeStart);
    gain.gain.linearRampToValueAtTime(0, fadeEnd);
  }

  source.connect(gain).connect(offline.destination);
  source.start(0);
  return offline.startRendering();
}

/** Renders `buffer` at `speedRatio` playback rate (pitch moves with it — intentional, see this module's own doc comment) via OfflineAudioContext. */
async function renderSpeedBuffer(buffer: AudioBuffer, speedRatio: number, outputDurationSec?: number): Promise<AudioBuffer> {
  const sampleRate = buffer.sampleRate;
  const duration = outputDurationSec ?? buffer.duration / speedRatio;
  const length = Math.max(1, Math.round(duration * sampleRate));
  const OfflineCtor = getOfflineAudioContextCtor();
  const offline = new OfflineCtor(buffer.numberOfChannels, length, sampleRate);

  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = speedRatio;
  source.connect(offline.destination);
  source.start(0);
  return offline.startRendering();
}

/** Full-length fade-out render — decode -> gain-envelope render -> truncated AudioBuffer, ready for encodeWavFromAudioBuffer. Never touches/mutates the source File. */
export async function renderFadeOutEdit(file: File, plan: FadeOutPlan): Promise<AudioBuffer> {
  const decoded = await decodeAudioFile(file);
  return renderFadeOutBuffer(decoded, plan.fadeStartSec, plan.fadeLengthSec, plan.achievedDurationSec);
}

/** Full-length speed-change render — decode -> playbackRate render at plan.speedRatio, length = plan.achievedDurationSec. */
export async function renderSpeedEdit(file: File, plan: SpeedPlan): Promise<AudioBuffer> {
  const decoded = await decodeAudioFile(file);
  return renderSpeedBuffer(decoded, plan.speedRatio, plan.achievedDurationSec);
}

/** Default preview length — spec's own "마지막 30초만 재생하면 충분합니다". */
export const PREVIEW_TAIL_SEC = 30;

/**
 * Renders only the last `previewTailSec` of the would-be fade-out result
 * (not the whole track) so a preview is cheap. Fade-out never touches
 * timing before the fade starts, so the tail's source range is a direct
 * 1:1 slice of the original — only the fade envelope itself needs
 * re-deriving relative to the slice's own start.
 */
export async function renderFadeOutPreview(file: File, plan: FadeOutPlan, previewTailSec: number = PREVIEW_TAIL_SEC): Promise<AudioBuffer> {
  const decoded = await decodeAudioFile(file);
  const tailLen = Math.min(previewTailSec, plan.achievedDurationSec);
  const sliceStartInOutput = Math.max(0, plan.achievedDurationSec - tailLen);
  const sourceSlice = sliceAudioBuffer(decoded, sliceStartInOutput, plan.achievedDurationSec);
  const fadeStartInSlice = plan.fadeStartSec - sliceStartInOutput;
  return renderFadeOutBuffer(sourceSlice, fadeStartInSlice, plan.fadeLengthSec, sourceSlice.duration);
}

/**
 * Renders only the last `previewTailSec` of the would-be speed-changed
 * result. Since output time = source time / speedRatio, the source range
 * needed for the output's last previewTailSec is derived by scaling back
 * up by speedRatio before slicing — again avoiding rendering/processing
 * audio the user isn't going to listen to.
 */
export async function renderSpeedPreview(file: File, plan: SpeedPlan, previewTailSec: number = PREVIEW_TAIL_SEC): Promise<AudioBuffer> {
  const decoded = await decodeAudioFile(file);
  const tailLen = Math.min(previewTailSec, plan.achievedDurationSec);
  const outputSliceStart = Math.max(0, plan.achievedDurationSec - tailLen);
  const sourceSliceStart = outputSliceStart * plan.speedRatio;
  const sourceSlice = sliceAudioBuffer(decoded, sourceSliceStart, decoded.duration);
  return renderSpeedBuffer(sourceSlice, plan.speedRatio);
}
