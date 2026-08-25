import { describe, expect, it } from 'vitest';
import { evaluateAudioGate } from '../src/core/audioGate';
import { buildAudioSetReport } from '../src/core/audioSetReport';
import { SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';
import type { SongAudioMetrics } from '../src/core/audioAnalysis';

/**
 * v3.78 (TASK C) — evaluateAudioGate is a thin wire-up over v3.73/v3.74's
 * already-existing measurement (buildAudioSetReport) — these tests confirm
 * the wiring (only duration blocks; everything else stays advisory; no
 * audio supplied never fails), not the underlying measurement itself
 * (already covered by audioSetReport's own tests).
 */

function metricsFor(trackNo: number, overrides: Partial<SongAudioMetrics> = {}): SongAudioMetrics {
  return {
    fileName: `track-${trackNo}.mp3`,
    matchedTrackNo: trackNo,
    durationSec: 200,
    rmsCurve: Array.from({ length: 20 }, () => -20),
    peakPosition: 0.8,
    dynamicRange: 8,
    overallLevel: -18,
    spectralCentroid: 1500 + trackNo * 50,
    lowBandRatio: 0.3,
    highBandRatio: 0.2,
    spectrumProfile: Array.from({ length: 32 }, (_, i) => (i === trackNo % 32 ? 1 : 0)),
    warnings: [],
    ...overrides
  };
}

describe('evaluateAudioGate — no audio supplied', () => {
  it('never fails when there is no audio report at all', () => {
    const result = evaluateAudioGate(undefined);
    expect(result.passed).toBe(true);
    expect(result.measured).toBe(false);
    expect(result.blocking).toEqual([]);
  });
});

describe('evaluateAudioGate — duration is the only blocking check', () => {
  it('blocks audio-duration when a track falls outside the profile target range', () => {
    const metrics = [metricsFor(1, { durationSec: 260 })];
    const report = buildAudioSetReport(metrics, 1, SENIOR_AUDIENCE_PROFILE);
    const result = evaluateAudioGate(report);
    expect(result.blocking.some(i => i.id === 'audio-duration')).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('blocks audio-duration-min when a track is under the absolute 2:50 floor', () => {
    const metrics = [metricsFor(1, { durationSec: 100 })];
    const report = buildAudioSetReport(metrics, 1, SENIOR_AUDIENCE_PROFILE);
    const result = evaluateAudioGate(report);
    expect(result.blocking.some(i => i.id === 'audio-duration-min')).toBe(true);
  });

  it('every non-duration finding stays advisory, never blocking, even when it fires', () => {
    const metrics = [
      metricsFor(1, { dynamicRange: 2, peakPosition: 0.2 }),
      metricsFor(2, { dynamicRange: 2, peakPosition: 0.2, spectrumProfile: metricsFor(1).spectrumProfile })
    ];
    const report = buildAudioSetReport(metrics, 2, SENIOR_AUDIENCE_PROFILE, new Set([1, 2]));
    const result = evaluateAudioGate(report);
    const blockingIds = result.blocking.map(i => i.id);
    expect(blockingIds).not.toContain('audio-dynamic-range');
    expect(blockingIds).not.toContain('audio-peak-position');
    expect(blockingIds).not.toContain('audio-mix-brightness-spread');
    expect(blockingIds).not.toContain('audio-mix-brightness-similarity');
  });

  it('passes cleanly on a healthy audio report', () => {
    const metrics = Array.from({ length: 4 }, (_, i) => metricsFor(i + 1, { durationSec: 200, dynamicRange: 9, peakPosition: 0.85 }));
    const report = buildAudioSetReport(metrics, 4, SENIOR_AUDIENCE_PROFILE, new Set([1, 2, 3, 4]));
    const result = evaluateAudioGate(report);
    expect(result.blocking).toEqual([]);
  });
});
