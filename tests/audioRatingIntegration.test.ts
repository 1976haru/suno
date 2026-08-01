import { describe, expect, it } from 'vitest';
import { analyzeRatings } from '../src/core/ratingAnalysis';
import type { RatingRecord, SongRating } from '../src/core/ratingLedger';

// TASK v3.73 (TASK E) — real measured audio, not text prediction, becomes an
// axis in the same v3.68 correlation engine. Mirrors tests/v368.test.ts's own
// "60 dummy ratings" pattern exactly (same makeRating helper shape) so this
// stays consistent with the established coverage for this module.

let counter = 0;
function makeRating(rating: SongRating, attrs: Partial<RatingRecord['attributes']>): RatingRecord {
  counter += 1;
  return {
    songId: `audio-song-${counter}`,
    packId: 'pack-1',
    rating,
    ratedAt: new Date(2026, 0, 1, 0, counter).toISOString(),
    attributes: {
      genreId: 'acoustic-pop',
      bpm: 90,
      vocalType: 'male',
      channelId: 'senior-morning',
      ...attrs
    }
  };
}

function audioAttrs(overrides: Partial<NonNullable<RatingRecord['attributes']['audioMetrics']>>) {
  return {
    audioMetrics: {
      durationSec: 200,
      peakPosition: 0.5,
      dynamicRange: 5,
      spectralCentroid: 2000,
      lowBandRatio: 0.3,
      overallLevel: -13.5,
      ...overrides
    }
  };
}

describe('[v3.73 TASK E] analyzeRatings picks up audio-metric axes when present', () => {
  it('bucketed dynamicRange axis: high-dynamic-range ratings skew good, low skew bad (spec §5-2 example shape)', () => {
    const records: RatingRecord[] = [];
    for (let i = 0; i < 12; i++) records.push(makeRating('good', audioAttrs({ dynamicRange: 6.4 })));
    for (let i = 0; i < 3; i++) records.push(makeRating('ok', audioAttrs({ dynamicRange: 6.8 })));
    for (let i = 0; i < 1; i++) records.push(makeRating('bad', audioAttrs({ dynamicRange: 6.1 })));
    for (let i = 0; i < 2; i++) records.push(makeRating('good', audioAttrs({ dynamicRange: 2.4 })));
    for (let i = 0; i < 5; i++) records.push(makeRating('ok', audioAttrs({ dynamicRange: 2.9 })));
    for (let i = 0; i < 9; i++) records.push(makeRating('bad', audioAttrs({ dynamicRange: 3.2 })));

    const insights = analyzeRatings(records);
    const highBucket = insights.find(i => i.attribute === 'audioDynamicRange' && i.value === '6~8dB');
    const lowBucket = insights.find(i => i.attribute === 'audioDynamicRange' && i.value === '2~4dB');
    expect(highBucket?.sampleSize).toBe(16);
    expect(lowBucket?.sampleSize).toBe(16);
    expect(highBucket!.lift).toBeGreaterThan(0);
    expect(lowBucket!.lift).toBeLessThan(0);
  });

  it('bucketed spectralCentroid axis groups by 500Hz width (half-open bucket, e.g. "2500~3000Hz" covers [2500,3000))', () => {
    const records: RatingRecord[] = [
      makeRating('good', audioAttrs({ spectralCentroid: 2650 })),
      makeRating('good', audioAttrs({ spectralCentroid: 2999 })),
      makeRating('ok', audioAttrs({ spectralCentroid: 1200 }))
    ];
    const insights = analyzeRatings(records);
    expect(insights.find(i => i.attribute === 'audioSpectralCentroid' && i.value === '2500~3000Hz')?.sampleSize).toBe(2);
    expect(insights.find(i => i.attribute === 'audioSpectralCentroid' && i.value === '1000~1500Hz')?.sampleSize).toBe(1);
  });

  it('audioLatePeak is a discrete "후반 상승 있음/없음" label, matching audioSetReport.ts\'s 0.75 threshold', () => {
    const records: RatingRecord[] = [
      makeRating('good', audioAttrs({ peakPosition: 0.9 })),
      makeRating('good', audioAttrs({ peakPosition: 0.75 })),
      makeRating('bad', audioAttrs({ peakPosition: 0.3 }))
    ];
    const insights = analyzeRatings(records);
    expect(insights.find(i => i.attribute === 'audioLatePeak' && i.value === '후반 상승 있음')?.sampleSize).toBe(2);
    expect(insights.find(i => i.attribute === 'audioLatePeak' && i.value === '후반 상승 없음')?.sampleSize).toBe(1);
  });

  it('a rating with no audioMetrics is simply excluded from all three audio axes, never counted as a zero/blank bucket', () => {
    const records: RatingRecord[] = [makeRating('good', {}), makeRating('good', {}), makeRating('ok', {})];
    const insights = analyzeRatings(records);
    expect(insights.some(i => i.attribute.startsWith('audio'))).toBe(false);
  });

  it('a mix of audio-rated and plain ratings only aggregates the audio axes from the ones that have measurements', () => {
    const records: RatingRecord[] = [
      makeRating('good', audioAttrs({ dynamicRange: 6.5 })),
      makeRating('good', {}), // no audioMetrics — must not pollute the audioDynamicRange count
      makeRating('bad', {})
    ];
    const insights = analyzeRatings(records);
    const bucket = insights.find(i => i.attribute === 'audioDynamicRange');
    expect(bucket?.sampleSize).toBe(1);
  });
});
