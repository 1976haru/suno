/**
 * v4.3 (TASK E-2) — "각 곡의 첫 15초만 이어붙인 파일 생성. 18곡이면 4분
 * 30초. 유튜브는 초반 이탈이 결정적입니다." (하루님). Browser-only concern
 * (decodes real uploaded mp3s via Web Audio API), but the actual
 * truncate+concatenate+WAV-encode math is pure and takes a small
 * structural subset of AudioBuffer (numberOfChannels/sampleRate/
 * getChannelData) so it's unit-testable in Node with a synthetic buffer —
 * no jsdom/real AudioContext needed for the math itself. WAV (not mp3) is
 * the output format: encoding mp3 client-side needs an external codec
 * library this app doesn't otherwise depend on, and WAV needs nothing but
 * a hand-written 44-byte header.
 */

export interface DecodedTrackAudio {
  trackNo: number;
  title: string;
  buffer: Pick<AudioBuffer, 'numberOfChannels' | 'sampleRate' | 'length' | 'getChannelData'>;
}

export interface PreviewConcatOptions {
  /** Seconds taken from the start of each track. Default 15 per this task's own spec. */
  secondsPerTrack?: number;
  /** Linear fade-out applied to the last N ms of each clip so the cut into the next track isn't a hard click. */
  fadeOutMs?: number;
  /** TASK v4.14 (TASK E) — silence inserted between tracks, "0.5초 무음 삽입" so back-to-back clips read as 18 distinct openings, not one continuous song. Not applied before the first track or after the last. */
  gapMs?: number;
}

const DEFAULT_SECONDS_PER_TRACK = 15;
const DEFAULT_FADE_OUT_MS = 150;
const DEFAULT_GAP_MS = 500;

export interface PreviewConcatResult {
  sampleRate: number;
  numberOfChannels: number;
  totalSamples: number;
  totalSeconds: number;
  /** Interleaved PCM samples, one Float32Array per channel — same shape buildWavFile expects. */
  channelData: Float32Array[];
  /** trackNo order actually used, for the caller's own tracklist display/export. */
  order: number[];
}

/**
 * Truncates each track to `secondsPerTrack`, resamples nothing (tracks are
 * expected to already share a sample rate — real Suno exports are 44.1kHz
 * consistently; a mismatched track is skipped with a warning rather than
 * silently resampled, since naive resampling would need its own DSP this
 * task's scope doesn't ask for), applies a short linear fade-out at the end
 * of each clip, and concatenates in the given order.
 */
export function buildPreviewConcat(tracks: DecodedTrackAudio[], options: PreviewConcatOptions = {}): { result: PreviewConcatResult | null; warnings: string[] } {
  const warnings: string[] = [];
  if (!tracks.length) return { result: null, warnings: ['미리듣기를 만들 트랙이 없습니다.'] };

  const secondsPerTrack = options.secondsPerTrack ?? DEFAULT_SECONDS_PER_TRACK;
  const fadeOutMs = options.fadeOutMs ?? DEFAULT_FADE_OUT_MS;
  const gapMs = options.gapMs ?? DEFAULT_GAP_MS;
  const sampleRate = tracks[0].buffer.sampleRate;
  const numberOfChannels = Math.max(...tracks.map(t => t.buffer.numberOfChannels));

  const usable = tracks.filter(track => {
    if (track.buffer.sampleRate !== sampleRate) {
      warnings.push(`Track ${track.trackNo}: 샘플레이트(${track.buffer.sampleRate}Hz)가 다른 트랙(${sampleRate}Hz)과 달라 건너뜁니다.`);
      return false;
    }
    return true;
  });
  if (!usable.length) return { result: null, warnings };

  const clipSamples = Math.round(secondsPerTrack * sampleRate);
  const fadeSamples = Math.min(clipSamples, Math.round((fadeOutMs / 1000) * sampleRate));
  const gapSamples = Math.max(0, Math.round((gapMs / 1000) * sampleRate));
  const clipTotalSamples = usable.reduce((sum, track) => sum + Math.min(clipSamples, track.buffer.length), 0);
  const totalSamples = clipTotalSamples + gapSamples * Math.max(0, usable.length - 1);

  const channelData: Float32Array[] = Array.from({ length: numberOfChannels }, () => new Float32Array(totalSamples));
  let cursor = 0;
  usable.forEach((track, trackIndex) => {
    const clipLength = Math.min(clipSamples, track.buffer.length);
    if (clipLength < clipSamples) {
      warnings.push(`Track ${track.trackNo}: 길이가 ${secondsPerTrack}초보다 짧아 전체 길이(${(clipLength / sampleRate).toFixed(1)}초)만 사용합니다.`);
    }
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const sourceChannel = ch < track.buffer.numberOfChannels ? track.buffer.getChannelData(ch) : track.buffer.getChannelData(0);
      const dest = channelData[ch];
      for (let i = 0; i < clipLength; i++) {
        let sample = sourceChannel[i] ?? 0;
        if (fadeSamples > 0 && i >= clipLength - fadeSamples) {
          const fadeProgress = (clipLength - i) / fadeSamples;
          sample *= Math.max(0, Math.min(1, fadeProgress));
        }
        dest[cursor + i] = sample;
      }
    }
    cursor += clipLength;
    // Silence gap left as zero-filled (channelData is already zero-initialized) — skipped after the last track.
    if (trackIndex < usable.length - 1) cursor += gapSamples;
  });

  return {
    result: {
      sampleRate,
      numberOfChannels,
      totalSamples,
      totalSeconds: totalSamples / sampleRate,
      channelData,
      order: usable.map(track => track.trackNo)
    },
    warnings
  };
}

/** Standard 16-bit PCM WAV encoder — the 44-byte header + interleaved little-endian samples every audio player reads natively, no external library. */
export function encodeWavFile(concat: PreviewConcatResult): Blob {
  const { sampleRate, numberOfChannels, totalSamples, channelData } = concat;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const dataSize = totalSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, text: string) {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const clamped = Math.max(-1, Math.min(1, channelData[ch][i]));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * TASK v4.14 (TASK E) — spec names the pattern "<세트코드>_인트로.mp3"; kept
 * as .wav (this task's own explicit "외부 라이브러리 없이" — mp3 encoding
 * needs a codec library the app doesn't otherwise depend on, same reasoning
 * as encodeWavFile's own doc comment) but renamed from the old
 * "_15s미리듣기" to "_인트로" to match the spec's own naming as closely as
 * the format substitution allows.
 */
export function previewConcatFileName(setLabel: string): string {
  const safe = setLabel.replace(/[\\/:*?"<>|]/g, '_').trim() || 'preview';
  return `${safe}_인트로.wav`;
}
