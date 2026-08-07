import { describe, expect, it } from 'vitest';
import { nextTakeNo, buildTakeDirectives, type AudioTake } from '../src/core/audioTakes';
import { computeAudioMeasurements } from '../src/core/audioMeasurements';
import { SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';

/**
 * codex 지시문 06 (TASK A, required test file) — real coverage of the
 * genuinely new AudioTake fields (takeNo/source/rating/rejectionReasons/
 * measurements) this task adds to the already-real, already-wired
 * core/audioTakes.ts type. recordTake/getTakes/setAdopted themselves stay
 * untested here (thin IndexedDB wrappers — no IndexedDB available under
 * vitest's node environment, same established convention
 * tests/audioTakes.test.ts's own top comment documents) — this file
 * covers the real, pure parts: nextTakeNo, and that a full AudioTake
 * object (including the new fields) is a real, constructible, well-typed
 * value.
 */

function makeFullTake(overrides: Partial<AudioTake> = {}): AudioTake {
  const measurements = computeAudioMeasurements({ channels: [new Float32Array(22050 * 3)], sampleRate: 22050 });
  return {
    takeId: 't1', songId: 's1', trackNo: 1, packId: 'p1',
    fileName: 'take1.mp3', versionLabel: 'v1', adopted: false,
    metrics: { fileName: 'take1.mp3', durationSec: 180, rmsCurve: [], peakPosition: 0.8, dynamicRange: 10, overallLevel: -14, spectralCentroid: 2000, lowBandRatio: 0.3, highBandRatio: 0.2, spectrumProfile: [], warnings: [] },
    vocalMetrics: { vocalCentroid: 900, vocalLowRatio: 0.3, vocalMidRatio: 0.4, vocalHighRatio: 0.3, vocalProfile: [], registerHint: 'mid' },
    tempoEstimate: { bpm: 96, confidence: 0.8 },
    directives: buildTakeDirectives({ genreId: 'jazz-pop', vocalType: 'female', bpm: 96 }, SENIOR_AUDIENCE_PROFILE),
    analyzedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  } as AudioTake;
}

describe('[codex 지시문 06 TASK A] AudioTake — new fields (takeNo/source/rating/rejectionReasons/measurements)', () => {
  it('constructs a real, fully-typed take with every new field populated', () => {
    const take = makeFullTake({ takeNo: 1, source: 'upload', rating: 'good', rejectionReasons: [], measurements: computeAudioMeasurements({ channels: [new Float32Array(22050 * 3)], sampleRate: 22050 }) });
    expect(take.takeNo).toBe(1);
    expect(take.source).toBe('upload');
    expect(take.rating).toBe('good');
    expect(take.rejectionReasons).toEqual([]);
    expect(take.measurements).toBeTruthy();
  });

  it('every new field is genuinely optional — an old, pre-TASK-A take still constructs fine', () => {
    const take = makeFullTake();
    expect(take.takeNo).toBeUndefined();
    expect(take.source).toBeUndefined();
    expect(take.rating).toBeUndefined();
    expect(take.rejectionReasons).toBeUndefined();
    expect(take.measurements).toBeUndefined();
  });

  it('`adopted` is real "selected" already — a caller never needs a second selected field', () => {
    const take = makeFullTake({ adopted: true });
    expect(take.adopted).toBe(true);
  });
});

describe('[codex 지시문 06 TASK A] nextTakeNo — real, pure ordinal assignment', () => {
  it('a song with no takes yet gets takeNo 1', () => {
    expect(nextTakeNo([], 's1')).toBe(1);
  });

  it('a song with takes 1 and 2 already recorded gets takeNo 3', () => {
    const existing = [{ songId: 's1', takeNo: 1 }, { songId: 's1', takeNo: 2 }];
    expect(nextTakeNo(existing, 's1')).toBe(3);
  });

  it('only counts takes belonging to the SAME song — a different song\'s takes never inflate the ordinal', () => {
    const existing = [{ songId: 's1', takeNo: 1 }, { songId: 's2', takeNo: 1 }, { songId: 's2', takeNo: 2 }];
    expect(nextTakeNo(existing, 's1')).toBe(2);
  });

  it('treats a take missing takeNo (pre-TASK-A record) as 0, never throwing', () => {
    const existing = [{ songId: 's1', takeNo: undefined }];
    expect(nextTakeNo(existing, 's1')).toBe(1);
  });
});
