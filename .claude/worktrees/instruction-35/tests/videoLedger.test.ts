import { describe, expect, it } from 'vitest';
import { computeInsights, diagnoseCtrVsRetention, exportVideosToCsv, parseYoutubeStudioCsv, type VideoRecord } from '../src/core/videoLedger';

function makeVideo(overrides: Partial<VideoRecord> = {}): VideoRecord {
  return {
    id: overrides.id || `v-${Math.random().toString(36).slice(2)}`,
    channelId: 'channel-1',
    packId: 'pack-1',
    weekNo: 1,
    scheduledAt: new Date().toISOString(),
    videoTitle: 'Autumn Morning Coffee',
    thumbnailA: 'A headline',
    thumbnailB: 'B headline',
    thumbnailC: 'C headline',
    thumbnailUsed: 'A',
    imagePrompt: 'prompt',
    colors: ['#fff', '#000', '#111'],
    seoKeywords: [],
    ...overrides
  };
}

describe('computeInsights (pure — TASK B3, v3.4)', () => {
  it('withholds insights when fewer than 3 videos have a CTR value (never fabricate a trend from noise)', () => {
    const videos = [makeVideo({ ctr: 5 }), makeVideo({ ctr: 6 })];
    const insights = computeInsights(videos);
    expect(insights.insufficientData).toBe(true);
    expect(insights.sampleSize).toBe(2);
    expect(insights.bestVariant).toBeNull();
  });

  it('computes per-variant average CTR and picks the best once sample size clears 3', () => {
    const videos = [
      makeVideo({ thumbnailUsed: 'A', ctr: 4 }),
      makeVideo({ thumbnailUsed: 'A', ctr: 6 }),
      makeVideo({ thumbnailUsed: 'B', ctr: 8 }),
      makeVideo({ thumbnailUsed: 'B', ctr: 10 })
    ];
    const insights = computeInsights(videos);
    expect(insights.insufficientData).toBe(false);
    expect(insights.variantAverageCtr.A).toBe(5);
    expect(insights.variantAverageCtr.B).toBe(9);
    expect(insights.bestVariant).toBe('B');
  });

  it('flags weeks whose view duration is 15%+ below the average', () => {
    const videos = [
      makeVideo({ weekNo: 1, ctr: 5, avgViewDuration: 200 }),
      makeVideo({ weekNo: 2, ctr: 5, avgViewDuration: 200 }),
      makeVideo({ weekNo: 3, ctr: 5, avgViewDuration: 100 })
    ];
    const insights = computeInsights(videos);
    expect(insights.belowAverageWeeks).toContain(3);
    expect(insights.belowAverageWeeks).not.toContain(1);
  });

  it('extracts common keywords only from the top-CTR third of videos, requiring at least 2 occurrences', () => {
    const videos = [
      makeVideo({ videoTitle: '가을 아침 커피', ctr: 10 }),
      makeVideo({ videoTitle: '가을 저녁 산책', ctr: 9 }),
      makeVideo({ videoTitle: '겨울 창가', ctr: 2 }),
      makeVideo({ videoTitle: '여름 바다', ctr: 1 })
    ];
    const insights = computeInsights(videos);
    expect(insights.topKeywords).toContain('가을');
  });
});

describe('parseYoutubeStudioCsv (pure — TASK B3, v3.4)', () => {
  it('parses a realistic YouTube Studio export with English headers', () => {
    const csv = [
      'Video title,Impressions,Impressions click-through rate (%),Average view duration,Views',
      '"Autumn Morning Coffee",1200,5.4,3:12,340',
      '"Rainy Afternoon Letter",900,7.1,2:45,410'
    ].join('\n');
    const rows = parseYoutubeStudioCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ title: 'Autumn Morning Coffee', impressions: 1200, ctr: 5.4, views: 340 });
    expect(rows[0].avgViewDuration).toBe(3 * 60 + 12);
  });

  it('parses Korean column headers too', () => {
    const csv = ['제목,노출수,클릭률,조회수', '"가을 아침 커피",1000,4.2,200'].join('\n');
    const rows = parseYoutubeStudioCsv(csv);
    expect(rows[0]).toMatchObject({ title: '가을 아침 커피', impressions: 1000, ctr: 4.2, views: 200 });
  });

  it('returns an empty array when there is no recognizable title column', () => {
    const csv = ['Some Column,Another Column', 'value1,value2'].join('\n');
    expect(parseYoutubeStudioCsv(csv)).toEqual([]);
  });

  it('ignores unrecognized extra columns rather than failing', () => {
    const csv = ['Video title,Some Unknown Metric,Views', '"Test Video",999,50'].join('\n');
    const rows = parseYoutubeStudioCsv(csv);
    expect(rows[0]).toMatchObject({ title: 'Test Video', views: 50 });
  });

  it('handles quoted titles containing commas', () => {
    const csv = ['Video title,Views', '"Coffee, Letters, and Rain",100'].join('\n');
    const rows = parseYoutubeStudioCsv(csv);
    expect(rows[0].title).toBe('Coffee, Letters, and Rain');
  });
});

describe('diagnoseCtrVsRetention (pure — TASK F, v3.5)', () => {
  it('never diagnoses from fewer than 3 videos with both CTR and duration', () => {
    const videos = [
      makeVideo({ weekNo: 1, ctr: 5, avgViewDuration: 200 }),
      makeVideo({ weekNo: 2, ctr: 5, avgViewDuration: 200 })
    ];
    expect(diagnoseCtrVsRetention(videos)).toBeNull();
  });

  it('[F] high CTR + low retention -> thumbnail is fine, the song itself is the mismatch', () => {
    const videos = [
      makeVideo({ weekNo: 1, ctr: 5, avgViewDuration: 200 }),
      makeVideo({ weekNo: 2, ctr: 5, avgViewDuration: 200 }),
      makeVideo({ weekNo: 3, ctr: 10, avgViewDuration: 100 }) // latest: high ctr, low duration
    ];
    const diagnosis = diagnoseCtrVsRetention(videos);
    expect(diagnosis?.weekNo).toBe(3);
    expect(diagnosis?.ctrLevel).toBe('high');
    expect(diagnosis?.retentionLevel).toBe('low');
    expect(diagnosis?.messageKo).toContain('곡이 안 맞습니다');
  });

  it('[F] low CTR + high retention -> the song is fine, thumbnail/title is weak', () => {
    const videos = [
      makeVideo({ weekNo: 1, ctr: 10, avgViewDuration: 100 }),
      makeVideo({ weekNo: 2, ctr: 10, avgViewDuration: 100 }),
      makeVideo({ weekNo: 3, ctr: 2, avgViewDuration: 250 }) // latest: low ctr, high duration
    ];
    const diagnosis = diagnoseCtrVsRetention(videos);
    expect(diagnosis?.ctrLevel).toBe('low');
    expect(diagnosis?.retentionLevel).toBe('high');
    expect(diagnosis?.messageKo).toContain('썸네일·제목이 약합니다');
  });

  it('[F] low CTR + low retention -> concept-level review', () => {
    const videos = [
      makeVideo({ weekNo: 1, ctr: 10, avgViewDuration: 250 }),
      makeVideo({ weekNo: 2, ctr: 10, avgViewDuration: 250 }),
      makeVideo({ weekNo: 3, ctr: 2, avgViewDuration: 50 })
    ];
    const diagnosis = diagnoseCtrVsRetention(videos);
    expect(diagnosis?.ctrLevel).toBe('low');
    expect(diagnosis?.retentionLevel).toBe('low');
    expect(diagnosis?.messageKo).toContain('컨셉 자체를 재검토');
  });

  it('[F] high CTR + high retention -> success pattern, repeat it', () => {
    const videos = [
      makeVideo({ weekNo: 1, ctr: 5, avgViewDuration: 150 }),
      makeVideo({ weekNo: 2, ctr: 5, avgViewDuration: 150 }),
      makeVideo({ weekNo: 3, ctr: 10, avgViewDuration: 250 })
    ];
    const diagnosis = diagnoseCtrVsRetention(videos);
    expect(diagnosis?.ctrLevel).toBe('high');
    expect(diagnosis?.retentionLevel).toBe('high');
    expect(diagnosis?.messageKo).toContain('성공 패턴');
  });

  it('computeInsights folds ctrRetentionDiagnosis into VideoInsights, null while insufficient', () => {
    const insufficientVideos = [makeVideo({ ctr: 5 }), makeVideo({ ctr: 6 })];
    expect(computeInsights(insufficientVideos).ctrRetentionDiagnosis).toBeNull();

    const sufficientVideos = [
      makeVideo({ weekNo: 1, ctr: 5, avgViewDuration: 150 }),
      makeVideo({ weekNo: 2, ctr: 5, avgViewDuration: 150 }),
      makeVideo({ weekNo: 3, ctr: 10, avgViewDuration: 250 })
    ];
    expect(computeInsights(sufficientVideos).ctrRetentionDiagnosis).not.toBeNull();
  });
});

describe('exportVideosToCsv (pure — TASK B3, v3.4)', () => {
  it('produces a header row plus one row per video', () => {
    const videos = [makeVideo({ weekNo: 1, ctr: 5 }), makeVideo({ weekNo: 2, ctr: 6 })];
    const csv = exportVideosToCsv(videos);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('주차');
    expect(lines[1]).toContain('1');
  });

  it('quotes and escapes fields containing commas or quotes', () => {
    const videos = [makeVideo({ videoTitle: 'Coffee, "Warm" Mornings' })];
    const csv = exportVideosToCsv(videos);
    expect(csv).toContain('Coffee, ""Warm"" Mornings');
  });
});
