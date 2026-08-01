import { describe, expect, it } from 'vitest';
import { buildAudioSetReport, buildVocalDiversityReport, type VocalDiversityEntry } from '../src/core/audioSetReport';
import type { SongAudioMetrics } from '../src/core/audioAnalysis';
import { SENIOR_AUDIENCE_PROFILE, KIDS_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';

// TASK v3.73 (TASK C) — synthetic SongAudioMetrics fixtures, mirroring the
// spec's own §0-2 reference measurements closely enough to sanity-check the
// judgment thresholds (>=0.75 late peak, <6dB weak dynamic range, <800Hz
// narrow timbre, >=0.95 cluster similarity, >3dB level spread).

function metric(overrides: Partial<SongAudioMetrics> & { matchedTrackNo: number }): SongAudioMetrics {
  return {
    fileName: `T${overrides.matchedTrackNo}.mp3`,
    durationSec: 200,
    rmsCurve: Array(20).fill(-20),
    peakPosition: 0.5,
    dynamicRange: 8,
    overallLevel: -13.5,
    spectralCentroid: 2000,
    lowBandRatio: 0.3,
    highBandRatio: 0.2,
    spectrumProfile: [1],
    warnings: [],
    ...overrides
  };
}

describe('[v3.73 TASK C] buildAudioSetReport — duration', () => {
  it('flags a track over the senior target (3:10-3:35) and one under it', () => {
    const metrics = [
      metric({ matchedTrackNo: 1, durationSec: 222 }), // 3:42, over
      metric({ matchedTrackNo: 2, durationSec: 150 }), // 2:30, under
      metric({ matchedTrackNo: 3, durationSec: 200 }) // 3:20, in range
    ];
    const report = buildAudioSetReport(metrics, 18, SENIOR_AUDIENCE_PROFILE);
    expect(report.duration.overTarget).toEqual([1]);
    expect(report.duration.underTarget).toEqual([2]);
    expect(report.duration.targetRange).toEqual([190, 215]);
  });

  it('uses the kids target range (1:30-2:30) for a kids audience profile', () => {
    const metrics = [metric({ matchedTrackNo: 1, durationSec: 200 })]; // fine for seniors, over for kids
    const report = buildAudioSetReport(metrics, 18, KIDS_AUDIENCE_PROFILE);
    expect(report.duration.overTarget).toEqual([1]);
  });
});

describe('[v3.73 TASK C] buildAudioSetReport — killing point', () => {
  it('classifies peakPosition >= 0.75 as a late peak, below as not', () => {
    const metrics = [
      metric({ matchedTrackNo: 1, peakPosition: 0.9 }),
      metric({ matchedTrackNo: 2, peakPosition: 0.75 }),
      metric({ matchedTrackNo: 3, peakPosition: 0.5 })
    ];
    const report = buildAudioSetReport(metrics, 18, SENIOR_AUDIENCE_PROFILE);
    expect(report.killingPoint.latePeakTracks).toEqual([1, 2]);
    expect(report.killingPoint.noLatePeakTracks).toEqual([3]);
    expect(report.killingPoint.latePeakShare).toBeCloseTo(2 / 3, 5);
  });

  it('flags dynamicRange < 6dB as weak, independent of peak position', () => {
    const metrics = [
      metric({ matchedTrackNo: 1, dynamicRange: 2.8, peakPosition: 0.9 }),
      metric({ matchedTrackNo: 2, dynamicRange: 7.1, peakPosition: 0.9 })
    ];
    const report = buildAudioSetReport(metrics, 18, SENIOR_AUDIENCE_PROFILE);
    expect(report.killingPoint.weakDynamicTracks).toEqual([1]);
  });

  it('advises when fewer than 60% of the set has a late peak', () => {
    const metrics = [
      metric({ matchedTrackNo: 1, peakPosition: 0.9 }),
      metric({ matchedTrackNo: 2, peakPosition: 0.2 }),
      metric({ matchedTrackNo: 3, peakPosition: 0.3 })
    ];
    const report = buildAudioSetReport(metrics, 18, SENIOR_AUDIENCE_PROFILE);
    expect(report.advisories.some(a => a.includes('후반 상승'))).toBe(true);
  });
});

describe('[v3.73 TASK C] buildAudioSetReport — timbre', () => {
  it('reports centroidSpread as max-min and warns under 800Hz', () => {
    const metrics = [
      metric({ matchedTrackNo: 1, spectralCentroid: 2200 }),
      metric({ matchedTrackNo: 2, spectralCentroid: 2600 })
    ];
    const report = buildAudioSetReport(metrics, 18, SENIOR_AUDIENCE_PROFILE);
    expect(report.timbre.centroidSpread).toBe(400);
    expect(report.advisories.some(a => a.includes('음색 팔레트'))).toBe(true);
  });

  it('flags a pair with cosine similarity >= 0.95 as a cluster', () => {
    const metrics = [
      metric({ matchedTrackNo: 1, spectrumProfile: [1, 0, 0] }),
      metric({ matchedTrackNo: 12, spectrumProfile: [0.99, 0.01, 0] }), // nearly identical
      metric({ matchedTrackNo: 5, spectrumProfile: [0, 0, 1] }) // orthogonal
    ];
    const report = buildAudioSetReport(metrics, 18, SENIOR_AUDIENCE_PROFILE);
    expect(report.timbre.clusteredPairs).toContainEqual([1, 12]);
    expect(report.timbre.clusteredPairs).not.toContainEqual([1, 5]);
    expect(report.advisories.some(a => a.includes('T1↔T12'))).toBe(true);
  });
});

describe('[v3.73 TASK C] buildAudioSetReport — level', () => {
  it('reports spread as max-min dB and warns over 3dB', () => {
    const metrics = [
      metric({ matchedTrackNo: 1, overallLevel: -13.5 }),
      metric({ matchedTrackNo: 2, overallLevel: -13.5 })
    ];
    const uniform = buildAudioSetReport(metrics, 18, SENIOR_AUDIENCE_PROFILE);
    expect(uniform.level.spread).toBe(0);
    expect(uniform.advisories.some(a => a.includes('음량 편차'))).toBe(false);

    const uneven = buildAudioSetReport(
      [metric({ matchedTrackNo: 1, overallLevel: -10 }), metric({ matchedTrackNo: 2, overallLevel: -15 })],
      18,
      SENIOR_AUDIENCE_PROFILE
    );
    expect(uneven.level.spread).toBe(5);
    expect(uneven.advisories.some(a => a.includes('음량 편차'))).toBe(true);
  });
});

describe('[v3.73 TASK C] buildAudioSetReport — partial analysis never errors', () => {
  it('handles 5-of-18 analyzed tracks cleanly (unmatched metrics are ignored, not counted)', () => {
    const metrics = [
      metric({ matchedTrackNo: 1 }),
      metric({ matchedTrackNo: 2 }),
      { ...metric({ matchedTrackNo: 3 }), matchedTrackNo: undefined } // failed to match — excluded
    ];
    const report = buildAudioSetReport(metrics, 18, SENIOR_AUDIENCE_PROFILE);
    expect(report.analyzedCount).toBe(2);
    expect(report.totalTracks).toBe(18);
  });

  it('a single analyzed track never crashes on spread/similarity math', () => {
    const report = buildAudioSetReport([metric({ matchedTrackNo: 1 })], 18, SENIOR_AUDIENCE_PROFILE);
    expect(report.timbre.centroidSpread).toBe(0);
    expect(report.level.spread).toBe(0);
    expect(report.timbre.meanSimilarity).toBe(0);
  });

  it('zero analyzed tracks never crashes', () => {
    const report = buildAudioSetReport([], 18, SENIOR_AUDIENCE_PROFILE);
    expect(report.analyzedCount).toBe(0);
    expect(report.killingPoint.latePeakShare).toBe(0);
  });
});

describe('[v3.74 TASK C] buildVocalDiversityReport', () => {
  function entry(trackNo: number, vocalType: string, vocalCentroid: number, vocalProfile: number[]): VocalDiversityEntry {
    return { trackNo, vocalType, vocalCentroid, vocalProfile };
  }

  it('flags a pair with vocal-band similarity >= 0.95 (the spec\'s own real 01<->12 = 0.969 scenario)', () => {
    const entries = [
      entry(1, 'male', 946, [1, 0, 0]),
      entry(12, 'male', 1109, [0.99, 0.01, 0]), // near-identical -- should cluster
      entry(5, 'male', 664, [0, 0, 1]) // very different -- should not cluster with either
    ];
    const report = buildVocalDiversityReport(entries);
    expect(report.clusteredPairs).toContainEqual([1, 12]);
    expect(report.clusteredPairs).not.toContainEqual([1, 5]);
    expect(report.advisories.some(a => a.includes('T1↔T12'))).toBe(true);
  });

  it('flags a narrow same-vocalType centroid spread (e.g. all 6 male tracks within 200Hz)', () => {
    const entries = [
      entry(1, 'male', 950, [1, 0]),
      entry(2, 'male', 1000, [0.9, 0.1]),
      entry(3, 'male', 1050, [0.8, 0.2])
    ];
    const report = buildVocalDiversityReport(entries);
    const maleSpread = report.sameTypeSpread.find(s => s.vocalType === 'male')!;
    expect(maleSpread.spread).toBeLessThan(200);
    expect(report.advisories.some(a => a.includes('같은 보컬 타입'))).toBe(true);
  });

  it('a wide, varied set produces no advisories', () => {
    const entries = [
      entry(1, 'male', 700, [1, 0, 0, 0]),
      entry(2, 'female', 1600, [0, 1, 0, 0]),
      entry(3, 'male', 1300, [0, 0, 1, 0]),
      entry(4, 'female', 2400, [0, 0, 0, 1])
    ];
    const report = buildVocalDiversityReport(entries);
    expect(report.clusteredPairs).toEqual([]);
  });

  it('never crashes on 0 or 1 entries', () => {
    expect(() => buildVocalDiversityReport([])).not.toThrow();
    expect(() => buildVocalDiversityReport([entry(1, 'male', 900, [1])])).not.toThrow();
    expect(buildVocalDiversityReport([]).centroidSpread).toBe(0);
  });
});
