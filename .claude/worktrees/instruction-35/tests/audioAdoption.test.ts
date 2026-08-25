import { describe, expect, it } from 'vitest';
import { analyzeAdoption, confidenceForPairCount, isNeutralWinRate, NEUTRAL_WIN_RATE_RANGE } from '../src/core/audioAdoption';
import type { AudioTake } from '../src/core/audioTakes';

let counter = 0;
function makeTake(songId: string, adopted: boolean, overrides: { dynamicRange?: number; vocalCentroid?: number; durationSec?: number; peakPosition?: number } = {}): AudioTake {
  counter += 1;
  return {
    takeId: `take-${counter}`,
    songId,
    trackNo: counter,
    packId: 'pack-1',
    fileName: `T${counter}.mp3`,
    versionLabel: adopted ? 'A' : 'B',
    adopted,
    metrics: {
      fileName: `T${counter}.mp3`,
      durationSec: overrides.durationSec ?? 200,
      rmsCurve: Array(20).fill(-20),
      peakPosition: overrides.peakPosition ?? 0.5,
      dynamicRange: overrides.dynamicRange ?? 5,
      overallLevel: -13.5,
      spectralCentroid: 2000,
      lowBandRatio: 0.3,
      highBandRatio: 0.2,
      spectrumProfile: [1],
      warnings: []
    },
    vocalMetrics: {
      vocalCentroid: overrides.vocalCentroid ?? 950,
      vocalLowRatio: 0.5,
      vocalMidRatio: 0.3,
      vocalHighRatio: 0.2,
      vocalProfile: [1],
      registerHint: 'mid'
    },
    tempoEstimate: { bpm: 96, confidence: 0.6 },
    directives: {
      genreId: 'jazz-pop',
      arcPhase: 'peak',
      vocalType: 'male',
      vocalDescriptor: 'male',
      targetBpm: 96,
      targetDurationSec: [190, 215],
      instrumentAtoms: []
    },
    analyzedAt: new Date().toISOString()
  };
}

describe('[v3.74 TASK G] confidenceForPairCount / isNeutralWinRate', () => {
  it('follows the 10/29/59 pair-count thresholds (distinct from ratingAnalysis.ts\'s 5/11/29/30)', () => {
    expect(confidenceForPairCount(9)).toBe('insufficient');
    expect(confidenceForPairCount(10)).toBe('weak');
    expect(confidenceForPairCount(29)).toBe('weak');
    expect(confidenceForPairCount(30)).toBe('moderate');
    expect(confidenceForPairCount(59)).toBe('moderate');
    expect(confidenceForPairCount(60)).toBe('strong');
  });

  it('flags 45-55% win rate as neutral', () => {
    expect(isNeutralWinRate(0.5)).toBe(true);
    expect(isNeutralWinRate(0.45)).toBe(true);
    expect(isNeutralWinRate(0.55)).toBe(true);
    expect(isNeutralWinRate(0.44)).toBe(false);
    expect(isNeutralWinRate(0.56)).toBe(false);
    expect(NEUTRAL_WIN_RATE_RANGE).toEqual([0.45, 0.55]);
  });
});

describe('[v3.74 TASK G] analyzeAdoption — the spec\'s own report-item-4 scenario: 20 dummy pairs', () => {
  // Mirrors spec §7-4's example output: adopted skews toward bigger dynamicRange (~78% win)
  // and bigger peakPosition (~83% win), neutral on vocalCentroid (~50%), and shorter duration (~67%).
  const takes: AudioTake[] = [];
  for (let i = 0; i < 20; i++) {
    const songId = `song-${i}`;
    const adoptedWins = i < 14; // 14/20 = 70% win on dynamicRange, close to the spec's own 78% flavor
    takes.push(makeTake(songId, true, {
      dynamicRange: adoptedWins ? 7 : 3,
      peakPosition: i < 16 ? 0.85 : 0.3, // 16/20 = 80% late-peak win
      durationSec: i < 12 ? 190 : 220, // 12/20 = 60% shorter
      vocalCentroid: i % 2 === 0 ? 1000 : 900 // alternates -- should land near neutral
    }));
    takes.push(makeTake(songId, false, {
      dynamicRange: adoptedWins ? 3 : 7,
      peakPosition: i < 16 ? 0.3 : 0.85,
      durationSec: i < 12 ? 220 : 190,
      vocalCentroid: i % 2 === 0 ? 900 : 1000
    }));
  }

  const insights = analyzeAdoption(takes);

  it('produces exactly 20 pairs for every metric this fixture actually varies (an untouched metric like overallLevel is an exact tie every time and correctly excluded)', () => {
    for (const metric of ['dynamicRange', 'peakPosition', 'durationSec', 'vocalCentroid']) {
      expect(insights.find(i => i.metric === metric)!.totalPairs, metric).toBe(20);
    }
  });

  it('dynamicRange: adopted wins 14/20 (70%), with a positive meanDelta, "weak" confidence at n=20 (10-29 band)', () => {
    const dynamicRange = insights.find(i => i.metric === 'dynamicRange')!;
    expect(dynamicRange.adoptedHigherCount).toBe(14);
    expect(dynamicRange.winRate).toBeCloseTo(0.7, 5);
    expect(dynamicRange.meanDelta).toBeGreaterThan(0);
    expect(dynamicRange.confidence).toBe('weak');
  });

  it('peakPosition: adopted wins 16/20 (80%)', () => {
    const peakPosition = insights.find(i => i.metric === 'peakPosition')!;
    expect(peakPosition.adoptedHigherCount).toBe(16);
    expect(peakPosition.winRate).toBeCloseTo(0.8, 5);
  });

  it('durationSec: adopted is shorter 12/20 times (60% "wins" by being smaller — sign only, direction read by the caller)', () => {
    const duration = insights.find(i => i.metric === 'durationSec')!;
    expect(duration.adoptedHigherCount).toBe(8); // adopted is LARGER only 8/20 times (shorter the other 12)
    expect(duration.meanDelta).toBeLessThan(0); // adopted trends shorter overall
  });

  it('vocalCentroid alternates evenly -- lands at a neutral win rate', () => {
    const vocalCentroid = insights.find(i => i.metric === 'vocalCentroid')!;
    expect(isNeutralWinRate(vocalCentroid.winRate)).toBe(true);
  });
});

describe('[v3.74 TASK G] 5 pairs -> insufficient (spec\'s own explicit report-item-5 check)', () => {
  it('reports "insufficient" confidence with only 5 pairs, regardless of how lopsided the win rate is', () => {
    const takes: AudioTake[] = [];
    for (let i = 0; i < 5; i++) {
      const songId = `song-${i}`;
      takes.push(makeTake(songId, true, { dynamicRange: 8 }));
      takes.push(makeTake(songId, false, { dynamicRange: 2 }));
    }
    const insights = analyzeAdoption(takes);
    const dynamicRange = insights.find(i => i.metric === 'dynamicRange')!;
    expect(dynamicRange.totalPairs).toBe(5);
    expect(dynamicRange.winRate).toBe(1);
    expect(dynamicRange.confidence).toBe('insufficient');
  });
});

describe('[v3.74 TASK G] edge cases', () => {
  it('a song with no adopted take contributes nothing', () => {
    const takes = [makeTake('undecided', false), makeTake('undecided', false)];
    const insights = analyzeAdoption(takes);
    expect(insights.every(i => i.totalPairs === 0)).toBe(true);
  });

  it('a song with only an adopted take (no alternative) contributes nothing', () => {
    const takes = [makeTake('solo', true)];
    const insights = analyzeAdoption(takes);
    expect(insights.every(i => i.totalPairs === 0)).toBe(true);
  });

  it('an exact tie between adopted and discarded is excluded from both the numerator and denominator', () => {
    const takes = [makeTake('tie', true, { dynamicRange: 5 }), makeTake('tie', false, { dynamicRange: 5 })];
    const insights = analyzeAdoption(takes);
    expect(insights.find(i => i.metric === 'dynamicRange')!.totalPairs).toBe(0);
  });

  it('a 3-take song (1 adopted + 2 discarded) contributes 2 pairs, not 1', () => {
    const songId = 'three-takes';
    const takes = [
      makeTake(songId, true, { dynamicRange: 8 }),
      makeTake(songId, false, { dynamicRange: 3 }),
      makeTake(songId, false, { dynamicRange: 4 })
    ];
    const insights = analyzeAdoption(takes);
    expect(insights.find(i => i.metric === 'dynamicRange')!.totalPairs).toBe(2);
  });

  it('never throws on an empty take list', () => {
    expect(() => analyzeAdoption([])).not.toThrow();
    expect(analyzeAdoption([]).every(i => i.totalPairs === 0)).toBe(true);
  });
});
