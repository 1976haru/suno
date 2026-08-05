import { describe, expect, it } from 'vitest';
import {
  buildShortsFadePlan,
  buildShortsFileName,
  computeCentroidBinsSec,
  computeRmsBinsSec,
  correctBoundaryToPhraseGap,
  findClimaxWindow,
  findRawPeakWindow,
  isRepresentativeTrack,
  SHORTS_FADE_IN_SEC,
  SHORTS_FADE_OUT_SEC
} from '../src/core/audioHighlight';

// TASK v4.15 (TASK A) — every function here is pure (no AudioContext), so
// it's fully verifiable under vitest's node environment. The browser-only
// analyzeForHighlight/renderShortsClip are NOT exercised here — see
// docs/v415-report.md for the real-browser verification with synthetic WAV
// files (same split as audioAnalysis.test.ts/audioEdit.test.ts).

const SAMPLE_RATE = 22050;

/** Builds a synthetic mono signal: `sections` is a list of [seconds, amplitude] pairs concatenated back to back, each filled with a fixed-frequency sine so spectral centroid is well-defined and stable within a section. */
function buildSections(sections: readonly [durationSec: number, amplitude: number, freqHz?: number][]): Float32Array {
  const totalSamples = sections.reduce((sum, [dur]) => sum + Math.round(dur * SAMPLE_RATE), 0);
  const out = new Float32Array(totalSamples);
  let offset = 0;
  for (const [durationSec, amplitude, freqHz = 440] of sections) {
    const n = Math.round(durationSec * SAMPLE_RATE);
    for (let i = 0; i < n; i++) {
      out[offset + i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / SAMPLE_RATE);
    }
    offset += n;
  }
  return out;
}

describe('[v4.15 TASK A] computeRmsBinsSec', () => {
  it('one bin per second, higher amplitude reads as higher RMS', () => {
    const samples = buildSections([
      [2, 0.1],
      [2, 0.8]
    ]);
    const bins = computeRmsBinsSec(samples, SAMPLE_RATE, 1);
    expect(bins).toHaveLength(4);
    expect(bins[0]).toBeCloseTo(bins[1], 3);
    expect(bins[2]).toBeCloseTo(bins[3], 3);
    expect(bins[2]).toBeGreaterThan(bins[0] * 4);
  });

  it('never throws on an empty signal', () => {
    expect(computeRmsBinsSec(new Float32Array(0), SAMPLE_RATE)).toEqual([0]);
  });
});

describe('[v4.15 TASK A] findClimaxWindow', () => {
  it('picks the loud section over quiet intro/outro, excluding the front 15%/back 10%', () => {
    // 40s total: 8s quiet intro, 24s quiet body, 8s loud finale.
    const samples = buildSections([
      [8, 0.05],
      [24, 0.1],
      [8, 0.9]
    ]);
    const rmsBins = computeRmsBinsSec(samples, SAMPLE_RATE, 1);
    const centroidBins = computeCentroidBinsSec(samples, SAMPLE_RATE, 1);
    const result = findClimaxWindow(rmsBins, centroidBins, 6, 1);
    expect(result).not.toBeNull();
    // the loud finale starts at t=32s; a 6s window should land inside [32, 34].
    expect(result!.startSec).toBeGreaterThanOrEqual(30);
    expect(result!.startSec).toBeLessThanOrEqual(34);
  });

  it('a track barely longer than the window falls back to scanning the whole track instead of returning null', () => {
    const samples = buildSections([[10, 0.3]]);
    const rmsBins = computeRmsBinsSec(samples, SAMPLE_RATE, 1);
    const centroidBins = computeCentroidBinsSec(samples, SAMPLE_RATE, 1);
    const result = findClimaxWindow(rmsBins, centroidBins, 9, 1);
    expect(result).not.toBeNull();
  });

  it('returns null only when the track is shorter than the requested window', () => {
    const rmsBins = computeRmsBinsSec(buildSections([[5, 0.3]]), SAMPLE_RATE, 1);
    const centroidBins = computeCentroidBinsSec(buildSections([[5, 0.3]]), SAMPLE_RATE, 1);
    expect(findClimaxWindow(rmsBins, centroidBins, 30, 1)).toBeNull();
  });
});

describe('[v4.15 TASK A] findRawPeakWindow (naive comparison baseline)', () => {
  it('picks the single loudest window with no exclusion at all — may land right at the very start/end unlike findClimaxWindow', () => {
    const samples = buildSections([
      [3, 0.9], // loud right at t=0 — a real intro, which findClimaxWindow would exclude
      [20, 0.1]
    ]);
    const rmsBins = computeRmsBinsSec(samples, SAMPLE_RATE, 1);
    const raw = findRawPeakWindow(rmsBins, 3, 1);
    expect(raw.startSec).toBe(0);
  });
});

describe('[v4.15 TASK A] correctBoundaryToPhraseGap', () => {
  it('snaps to the lowest-RMS point (silence gap) within ±2s of the candidate', () => {
    // Loud, then a 0.3s silence gap at t=10, then loud again.
    const samples = buildSections([
      [9.85, 0.8],
      [0.3, 0.0],
      [9.85, 0.8]
    ]);
    const corrected = correctBoundaryToPhraseGap(samples, SAMPLE_RATE, 9.5, 2);
    expect(corrected).toBeGreaterThanOrEqual(9.8);
    expect(corrected).toBeLessThanOrEqual(10.2);
  });

  it('never returns a negative time even when the candidate is near t=0', () => {
    const samples = buildSections([[5, 0.5]]);
    const corrected = correctBoundaryToPhraseGap(samples, SAMPLE_RATE, 0.5, 2);
    expect(corrected).toBeGreaterThanOrEqual(0);
  });
});

describe('[v4.15 TASK A] buildShortsFadePlan', () => {
  it('0.3s fade-in / 1.5s fade-out, total length exactly the requested lengthSec', () => {
    const plan = buildShortsFadePlan(120, 30);
    expect(plan.fadeInSec).toBe(SHORTS_FADE_IN_SEC);
    expect(plan.fadeOutSec).toBe(SHORTS_FADE_OUT_SEC);
    expect(plan.lengthSec).toBe(30);
    expect(plan.endSec - plan.startSec).toBe(30);
    expect(plan.fadeOutStartSec).toBeCloseTo(28.5, 5);
  });

  it('clamps fade lengths to the clip length for a very short clip and never goes negative', () => {
    const plan = buildShortsFadePlan(-5, 1, 0.3, 1.5);
    expect(plan.startSec).toBe(0);
    expect(plan.fadeOutSec).toBeLessThanOrEqual(1);
    expect(plan.fadeOutStartSec).toBeGreaterThanOrEqual(0);
  });
});

describe('[v4.15 TASK A] buildShortsFileName', () => {
  it('appends _shorts<length>.wav, never reusing the original name', () => {
    expect(buildShortsFileName('01 Still Warm.mp3', 30)).toBe('01 Still Warm_shorts30.wav');
    expect(buildShortsFileName('no-extension', 15)).toBe('no-extension_shorts15.wav');
  });
});

describe('[v4.15 TASK A] isRepresentativeTrack', () => {
  it('flags tracks 1-3 as 대표곡, not 4+', () => {
    expect(isRepresentativeTrack('01 Two Sugars.mp3')).toBe(true);
    expect(isRepresentativeTrack('03 Still Warm.mp3')).toBe(true);
    expect(isRepresentativeTrack('04 Other Song.mp3')).toBe(false);
    expect(isRepresentativeTrack('Keep Close My Friend.mp3')).toBe(false);
  });
});
