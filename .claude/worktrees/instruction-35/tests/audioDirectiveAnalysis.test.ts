import { describe, expect, it } from 'vitest';
import {
  bpmMatchesTarget,
  buildDirectiveExecutionReport,
  buildDirectiveStabilityReport,
  buildInstrumentAtomTendencies,
  directiveAgeWeight,
  executionEntryToRatingInsightShape,
  mergeExecutionInsightsIntoRatingInsights,
  UNMEASURABLE_DIRECTIVES
} from '../src/core/audioDirectiveAnalysis';
import { killingPointBoostFromInsights } from '../src/data/killingPoints';
import type { AudioTake } from '../src/core/audioTakes';

let counter = 0;
function makeTake(overrides: {
  songId?: string;
  durationSec?: number;
  targetDurationSec?: [number, number];
  bpm?: number;
  targetBpm?: number;
  tempoConfidence?: number;
  peakPosition?: number;
  dynamicRange?: number;
  spectralCentroid?: number;
  vocalCentroid?: number;
  killingPointId?: string;
  introMode?: string;
  instrumentAtoms?: string[];
  analyzedAt?: string;
} = {}): AudioTake {
  counter += 1;
  return {
    takeId: `take-${counter}`,
    songId: overrides.songId ?? `song-${counter}`,
    trackNo: counter,
    packId: 'pack-1',
    fileName: `T${counter}.mp3`,
    versionLabel: 'A',
    adopted: false,
    metrics: {
      fileName: `T${counter}.mp3`,
      durationSec: overrides.durationSec ?? 200,
      rmsCurve: Array(20).fill(-20),
      peakPosition: overrides.peakPosition ?? 0.5,
      dynamicRange: overrides.dynamicRange ?? 5,
      overallLevel: -13.5,
      spectralCentroid: overrides.spectralCentroid ?? 2000,
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
    tempoEstimate: { bpm: overrides.bpm ?? 96, confidence: overrides.tempoConfidence ?? 0.6 },
    directives: {
      genreId: 'jazz-pop',
      killingPointId: overrides.killingPointId,
      arcPhase: 'peak',
      introMode: overrides.introMode,
      vocalType: 'male',
      vocalDescriptor: 'male',
      targetBpm: overrides.targetBpm ?? 96,
      targetDurationSec: overrides.targetDurationSec ?? [190, 215],
      instrumentAtoms: overrides.instrumentAtoms ?? []
    },
    analyzedAt: overrides.analyzedAt ?? new Date().toISOString()
  };
}

describe('[v3.74 TASK E] bpmMatchesTarget', () => {
  it('matches within +-10% directly', () => {
    expect(bpmMatchesTarget(96, 100).matches).toBe(true);
    expect(bpmMatchesTarget(100, 96).matches).toBe(true);
    expect(bpmMatchesTarget(80, 100).matches).toBe(false);
  });

  it('matches at half/double tempo, flagged as octave-corrected', () => {
    const doubled = bpmMatchesTarget(200, 100);
    expect(doubled.matches).toBe(true);
    expect(doubled.octaveCorrected).toBe(true);
    const halved = bpmMatchesTarget(50, 100);
    expect(halved.matches).toBe(true);
    expect(halved.octaveCorrected).toBe(true);
  });

  it('a direct match is never flagged as octave-corrected', () => {
    expect(bpmMatchesTarget(98, 100).octaveCorrected).toBe(false);
  });
});

describe('[v3.74 TASK E] directiveAgeWeight — 90-day decay', () => {
  it('a fresh take counts full weight', () => {
    expect(directiveAgeWeight(new Date().toISOString())).toBe(1);
  });

  it('a take older than 90 days counts half weight, never zero', () => {
    const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    expect(directiveAgeWeight(old)).toBe(0.5);
  });
});

describe('[v3.74 TASK E] buildDirectiveExecutionReport', () => {
  it('duration execution rate: matches spec\'s own reference table shape (e.g. 17% -> mostly ignored)', () => {
    const takes = [
      ...Array.from({ length: 6 }, () => makeTake({ durationSec: 200 })), // within [190,215]
      ...Array.from({ length: 30 }, () => makeTake({ durationSec: 249 })) // 4:09, over target
    ];
    const report = buildDirectiveExecutionReport(takes);
    const duration = report.find(e => e.directiveKey === 'duration')!;
    expect(duration.totalCount).toBe(36);
    expect(duration.executedCount).toBe(6);
    expect(duration.executionRate).toBeCloseTo(6 / 36, 5);
    expect(duration.confidence).toBe('strong');
  });

  it('BPM execution excludes low-confidence tempo estimates entirely (never counted as failed)', () => {
    const takes = [
      makeTake({ bpm: 96, targetBpm: 96, tempoConfidence: 0.6 }), // counted, matches
      makeTake({ bpm: 40, targetBpm: 96, tempoConfidence: 0.2 }) // low confidence -- excluded, not counted as a failure
    ];
    const report = buildDirectiveExecutionReport(takes);
    const bpm = report.find(e => e.directiveKey === 'bpm')!;
    expect(bpm.totalCount).toBe(1);
    expect(bpm.executionRate).toBe(1);
  });

  it('killing-point execution is grouped per killingPointId, matching the spec\'s own KP-01/KP-04 example shape', () => {
    const takes = [
      ...Array.from({ length: 11 }, () => makeTake({ killingPointId: 'KP-01', peakPosition: 0.85 })),
      ...Array.from({ length: 3 }, () => makeTake({ killingPointId: 'KP-01', peakPosition: 0.4 })),
      ...Array.from({ length: 2 }, () => makeTake({ killingPointId: 'KP-04', peakPosition: 0.85 })),
      ...Array.from({ length: 7 }, () => makeTake({ killingPointId: 'KP-04', peakPosition: 0.3 }))
    ];
    const report = buildDirectiveExecutionReport(takes);
    const kp01 = report.find(e => e.directiveKey === 'killingPoint:KP-01')!;
    const kp04 = report.find(e => e.directiveKey === 'killingPoint:KP-04')!;
    expect(kp01.executedCount).toBe(11);
    expect(kp01.totalCount).toBe(14);
    expect(kp04.executedCount).toBe(2);
    expect(kp04.totalCount).toBe(9);
    expect(kp04.executionRate).toBeLessThan(kp01.executionRate);
  });

  it('a directive with fewer than 5 samples is reported but marked "insufficient" (never a false confident verdict)', () => {
    const takes = Array.from({ length: 3 }, () => makeTake({ killingPointId: 'KP-99', peakPosition: 0.9 }));
    const report = buildDirectiveExecutionReport(takes);
    expect(report.find(e => e.directiveKey === 'killingPoint:KP-99')!.confidence).toBe('insufficient');
  });

  it('never reports a verdict for an unmeasurable directive — no function/entry exists for them at all', () => {
    for (const label of UNMEASURABLE_DIRECTIVES) {
      expect(typeof label).toBe('string'); // documented, not computed
    }
    const report = buildDirectiveExecutionReport([makeTake()]);
    expect(report.some(e => e.directiveKey.includes('harmony') || e.directiveKey.includes('lyric'))).toBe(false);
  });
});

describe('[v3.74 TASK E] buildInstrumentAtomTendencies', () => {
  it('reports a descriptive centroid lift per instrument atom, not a pass/fail verdict', () => {
    const takes = [
      ...Array.from({ length: 5 }, () => makeTake({ instrumentAtoms: ['bright synth'], spectralCentroid: 3000 })),
      ...Array.from({ length: 5 }, () => makeTake({ instrumentAtoms: ['upright bass'], spectralCentroid: 900 }))
    ];
    const tendencies = buildInstrumentAtomTendencies(takes);
    const synth = tendencies.find(t => t.atom === 'bright synth')!;
    const bass = tendencies.find(t => t.atom === 'upright bass')!;
    expect(synth.centroidLift).toBeGreaterThan(0);
    expect(bass.centroidLift).toBeLessThan(0);
  });

  it('excludes an atom below the minimum sample size', () => {
    const takes = [makeTake({ instrumentAtoms: ['rare-instrument'] })];
    expect(buildInstrumentAtomTendencies(takes)).toEqual([]);
  });
});

describe('[v3.74 TASK F] buildDirectiveStabilityReport', () => {
  it('a killing point whose A/B dynamicRange stays close is "stable"', () => {
    const songId = 'song-stable';
    const takes = [
      makeTake({ songId, killingPointId: 'KP-01', dynamicRange: 6.2 }),
      makeTake({ songId, killingPointId: 'KP-01', dynamicRange: 5.9 })
    ];
    const report = buildDirectiveStabilityReport(takes);
    const kp01 = report.find(e => e.directiveKey === 'killingPoint:KP-01')!;
    expect(kp01.stability).toBe('stable');
    expect(kp01.meanAbsDelta.dynamicRange).toBeCloseTo(0.3, 5);
  });

  it('a killing point whose A/B dynamicRange swings wildly is "unstable"', () => {
    const songId = 'song-unstable';
    const takes = [
      makeTake({ songId, killingPointId: 'KP-04', dynamicRange: 6.2 }),
      makeTake({ songId, killingPointId: 'KP-04', dynamicRange: 2.1 })
    ];
    const report = buildDirectiveStabilityReport(takes);
    expect(report.find(e => e.directiveKey === 'killingPoint:KP-04')!.stability).toBe('unstable');
  });

  it('a moderate A/B gap (1.5-3.5dB) is "variable"', () => {
    const songId = 'song-variable';
    const takes = [
      makeTake({ songId, killingPointId: 'KP-02', dynamicRange: 6.0 }),
      makeTake({ songId, killingPointId: 'KP-02', dynamicRange: 3.5 })
    ];
    const report = buildDirectiveStabilityReport(takes);
    expect(report.find(e => e.directiveKey === 'killingPoint:KP-02')!.stability).toBe('variable');
  });

  it('aggregates across every song sharing a directiveKey, not just one song\'s own pair (a single noisy song cannot flip the verdict alone)', () => {
    const takes = [
      makeTake({ songId: 'a', killingPointId: 'KP-01', dynamicRange: 6.0 }),
      makeTake({ songId: 'a', killingPointId: 'KP-01', dynamicRange: 5.8 }),
      makeTake({ songId: 'b', killingPointId: 'KP-01', dynamicRange: 6.1 }),
      makeTake({ songId: 'b', killingPointId: 'KP-01', dynamicRange: 5.9 })
    ];
    const report = buildDirectiveStabilityReport(takes);
    const kp01 = report.find(e => e.directiveKey === 'killingPoint:KP-01')!;
    expect(kp01.pairCount).toBe(2);
    expect(kp01.stability).toBe('stable');
  });

  it('a song with 3 takes forms 3 pairs, not just 1', () => {
    const takes = [
      makeTake({ songId: 'three', killingPointId: 'KP-05', dynamicRange: 6.0 }),
      makeTake({ songId: 'three', killingPointId: 'KP-05', dynamicRange: 5.8 }),
      makeTake({ songId: 'three', killingPointId: 'KP-05', dynamicRange: 6.2 })
    ];
    const report = buildDirectiveStabilityReport(takes);
    expect(report.find(e => e.directiveKey === 'killingPoint:KP-05')!.pairCount).toBe(3);
  });

  it('a song with only 1 take (no pair) contributes nothing', () => {
    const takes = [makeTake({ songId: 'solo', killingPointId: 'KP-06' })];
    const report = buildDirectiveStabilityReport(takes);
    expect(report.find(e => e.directiveKey === 'killingPoint:KP-06')).toBeUndefined();
  });
});

describe('[v3.74 TASK H] executionEntryToRatingInsightShape / mergeExecutionInsightsIntoRatingInsights', () => {
  it('converts a low-execution killing point (KP-04\'s own 22% example) into a negative-lift, floored-not-zeroed boost through the real v3.68 mechanism', () => {
    const takes = [
      ...Array.from({ length: 2 }, () => makeTake({ killingPointId: 'KP-04', peakPosition: 0.85 })),
      ...Array.from({ length: 7 }, () => makeTake({ killingPointId: 'KP-04', peakPosition: 0.3 }))
    ];
    const report = buildDirectiveExecutionReport(takes);
    const kp04 = report.find(e => e.directiveKey === 'killingPoint:KP-04')!;
    const insight = executionEntryToRatingInsightShape(kp04)!;
    expect(insight.attribute).toBe('killingPointId');
    expect(insight.value).toBe('KP-04');
    expect(insight.lift).toBeLessThan(0);

    // Feed straight into the real, unmodified v3.68 boost function.
    const boost = killingPointBoostFromInsights([{ ...insight, confidence: 'strong' }]);
    expect(boost['KP-04']).toBeGreaterThanOrEqual(0.5); // floored, never 0 — that guarantee lives entirely in killingPointBoostFromInsights, untouched by this task.
    expect(boost['KP-04']).toBeLessThan(1); // still a real down-weight
  });

  it('a non-killing-point directive (e.g. "duration") converts to null — only killing points ride this pipeline', () => {
    const takes = Array.from({ length: 10 }, () => makeTake({ durationSec: 249 }));
    const duration = buildDirectiveExecutionReport(takes).find(e => e.directiveKey === 'duration')!;
    expect(executionEntryToRatingInsightShape(duration)).toBeNull();
  });

  it('mergeExecutionInsightsIntoRatingInsights only carries over strong-confidence entries, appended to (never replacing) existing rating insights', () => {
    const strongTakes = Array.from({ length: 30 }, () => makeTake({ killingPointId: 'KP-01', peakPosition: 0.9 }));
    const weakTakes = Array.from({ length: 6 }, () => makeTake({ killingPointId: 'KP-09', peakPosition: 0.9 }));
    const entries = buildDirectiveExecutionReport([...strongTakes, ...weakTakes]);
    const existingRatingInsight = { attribute: 'genreId', value: 'jazz-pop', labelKo: 'Jazz Pop', good: 10, ok: 2, bad: 1, sampleSize: 13, lift: 0.2, confidence: 'strong' as const };

    const merged = mergeExecutionInsightsIntoRatingInsights([existingRatingInsight], entries);
    expect(merged).toContainEqual(existingRatingInsight);
    expect(merged.some(i => i.attribute === 'killingPointId' && i.value === 'KP-01')).toBe(true);
    expect(merged.some(i => i.attribute === 'killingPointId' && i.value === 'KP-09')).toBe(false); // weak/moderate at n=6, correctly excluded
  });

  it('an empty execution-entry list leaves the rating insights completely untouched', () => {
    const existing = [{ attribute: 'genreId', value: 'jazz-pop', labelKo: 'Jazz Pop', good: 1, ok: 0, bad: 0, sampleSize: 1, lift: 0, confidence: 'insufficient' as const }];
    expect(mergeExecutionInsightsIntoRatingInsights(existing, [])).toEqual(existing);
  });
});
