import { describe, expect, it } from 'vitest';
import { buildPreviewConcat, encodeWavFile, previewConcatFileName, type DecodedTrackAudio } from '../src/core/previewConcat';

// TASK v4.14 (TASK E) — previewConcat.ts had zero test coverage before this
// task. Covers the new 0.5s silence gap between tracks (this task's own
// spec explicitly asks for it; the pre-existing implementation had no gap
// at all, only a fade-out on each clip's own tail) and confirms the
// original per-track audio is never mutated.

function makeTrack(trackNo: number, seconds: number, sampleRate = 1000, fillValue = 1): DecodedTrackAudio {
  const length = Math.round(seconds * sampleRate);
  const data = new Float32Array(length).fill(fillValue);
  return {
    trackNo,
    title: `Track ${trackNo}`,
    buffer: {
      numberOfChannels: 1,
      sampleRate,
      length,
      getChannelData: () => data
    }
  };
}

describe('[v4.14 TASK E] buildPreviewConcat', () => {
  it('inserts a 0.5s silence gap between tracks by default, none before the first or after the last', () => {
    const sampleRate = 1000;
    const tracks = [makeTrack(1, 2, sampleRate), makeTrack(2, 2, sampleRate), makeTrack(3, 2, sampleRate)];
    const { result, warnings } = buildPreviewConcat(tracks, { secondsPerTrack: 2 });
    expect(warnings).toEqual([]);
    expect(result).not.toBeNull();
    // 3 clips x 2s + 2 gaps x 0.5s = 7s
    expect(result!.totalSeconds).toBeCloseTo(7, 5);
    // sample right at the boundary between track 1's clip and the gap is silent
    const gapStartSample = 2 * sampleRate;
    expect(result!.channelData[0][gapStartSample]).toBe(0);
  });

  it('supports a custom gapMs (0 reproduces the old no-gap behavior)', () => {
    const sampleRate = 1000;
    const tracks = [makeTrack(1, 1, sampleRate), makeTrack(2, 1, sampleRate)];
    const { result } = buildPreviewConcat(tracks, { secondsPerTrack: 1, gapMs: 0, fadeOutMs: 0 });
    expect(result!.totalSeconds).toBeCloseTo(2, 5);
  });

  it('truncates each track to secondsPerTrack and never mutates the source buffer', () => {
    const sampleRate = 1000;
    const track = makeTrack(1, 20, sampleRate);
    const originalFirstSample = track.buffer.getChannelData(0)[0];
    const { result } = buildPreviewConcat([track], { secondsPerTrack: 15, gapMs: 0, fadeOutMs: 0 });
    expect(result!.totalSamples).toBe(15 * sampleRate);
    expect(track.buffer.getChannelData(0)[0]).toBe(originalFirstSample);
    expect(track.buffer.length).toBe(20 * sampleRate);
  });

  it('encodeWavFile produces a valid RIFF/WAVE header sized to the sample count', () => {
    const sampleRate = 1000;
    const tracks = [makeTrack(1, 1, sampleRate)];
    const { result } = buildPreviewConcat(tracks, { secondsPerTrack: 1, gapMs: 0, fadeOutMs: 0 });
    const blob = encodeWavFile(result!);
    expect(blob.size).toBe(44 + result!.totalSamples * 2);
    expect(blob.type).toBe('audio/wav');
  });

  it('file name pattern matches <label>_인트로.wav', () => {
    expect(previewConcatFileName('S20260804-01')).toBe('S20260804-01_인트로.wav');
  });
});
