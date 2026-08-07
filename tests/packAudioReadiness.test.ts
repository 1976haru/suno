import { describe, expect, it } from 'vitest';
import { evaluatePackAudioReadiness } from '../src/core/packAudioReadiness';
import { buildTakeDirectives, type AudioTake } from '../src/core/audioTakes';
import { SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';
import type { AudioMeasurements } from '../src/core/audioMeasurements';

/**
 * 지시문 11 (TASK F-6, required test file) — evaluatePackAudioReadiness가
 * 실제로 "채택 없음/측정 없음/클리핑/컴플라이언스 fail" 각각을 구분해서
 * 보고하는지, 그리고 이전의 단일 audioConfirmed boolean과 달리 트랙별 근거를
 * 그대로 들고 있는지 검증한다.
 */

function makeMeasurements(overrides: Partial<AudioMeasurements> = {}): AudioMeasurements {
  return {
    durationSec: 200, bpm: 96, bpmConfidence: 0.8, leadingSilenceSec: 0.3, trailingSilenceSec: 0.5,
    peak: 0.7, approximateLoudnessDb: -14, clippingSampleCount: 0, clipping: false, stereoWidth: 0.4,
    sampleRate: 44100, channels: 2, oneSecRmsDeviationDb: 5.0, ...overrides
  };
}

function makeTake(trackNo: number, overrides: Partial<AudioTake> = {}): AudioTake {
  return {
    takeId: `take-${trackNo}`, songId: `song-${trackNo}`, trackNo, packId: 'p1', takeNo: 1,
    fileName: `t${trackNo}.mp3`, versionLabel: 'A', adopted: true,
    metrics: { fileName: `t${trackNo}.mp3`, durationSec: 200, rmsCurve: [], peakPosition: 0.8, dynamicRange: 10, overallLevel: -14, spectralCentroid: 2000, lowBandRatio: 0.3, highBandRatio: 0.2, spectrumProfile: [], warnings: [] },
    vocalMetrics: { vocalCentroid: 900, vocalLowRatio: 0.3, vocalMidRatio: 0.4, vocalHighRatio: 0.3, vocalProfile: [], registerHint: 'mid' },
    tempoEstimate: { bpm: 96, confidence: 0.8 },
    directives: buildTakeDirectives({ genreId: 'jazz-pop', vocalType: 'female', bpm: 96 }, SENIOR_AUDIENCE_PROFILE),
    analyzedAt: '2026-01-01T00:00:00.000Z',
    measurements: makeMeasurements(),
    ...overrides
  } as AudioTake;
}

describe('[지시문 11 TASK F-6] evaluatePackAudioReadiness — 트랙 없음/채택 없음', () => {
  it('채택된 테이크가 있는 트랙은 실제 측정값·컴플라이언스가 정상이면 ready', () => {
    const result = evaluatePackAudioReadiness([{ trackNo: 1 }], [makeTake(1)]);
    expect(result.trackReadiness[0].ready).toBe(true);
    expect(result.readyTrackCount).toBe(1);
    expect(result.overallReady).toBe(true);
  });

  it('채택된 테이크가 아예 없는 트랙은 missing으로 분류되고 ready가 아니다', () => {
    const result = evaluatePackAudioReadiness([{ trackNo: 1 }, { trackNo: 2 }], [makeTake(1)]);
    const track2 = result.trackReadiness.find(t => t.trackNo === 2)!;
    expect(track2.hasAdoptedTake).toBe(false);
    expect(track2.ready).toBe(false);
    expect(result.missingTrackCount).toBe(1);
    expect(result.overallReady).toBe(false);
  });

  it('채택은 됐지만 unadopted 테이크만 있으면(다른 트랙 것) 여전히 missing', () => {
    const unadopted = makeTake(1, { adopted: false });
    const result = evaluatePackAudioReadiness([{ trackNo: 1 }], [unadopted]);
    expect(result.trackReadiness[0].hasAdoptedTake).toBe(false);
    expect(result.missingTrackCount).toBe(1);
  });
});

describe('[지시문 11 TASK F-6] evaluatePackAudioReadiness — 채택됐지만 blocked', () => {
  it('측정값이 없는 채택 테이크는 blocked (missing이 아니라 blocked로 구분)', () => {
    const take = makeTake(1, { measurements: undefined });
    const result = evaluatePackAudioReadiness([{ trackNo: 1 }], [take]);
    const track = result.trackReadiness[0];
    expect(track.hasAdoptedTake).toBe(true);
    expect(track.hasMeasurements).toBe(false);
    expect(track.ready).toBe(false);
    expect(result.blockedTrackCount).toBe(1);
    expect(result.missingTrackCount).toBe(0);
  });

  it('클리핑된 채택 테이크는 blocked', () => {
    const take = makeTake(1, { measurements: makeMeasurements({ clipping: true, clippingSampleCount: 5 }) });
    const result = evaluatePackAudioReadiness([{ trackNo: 1 }], [take]);
    expect(result.trackReadiness[0].ready).toBe(false);
    expect(result.blockedTrackCount).toBe(1);
  });

  it('코어 컴플라이언스가 fail(길이 ±15초 초과)이면 blocking 이슈가 없어도 ready가 아니다', () => {
    const take = makeTake(1, { measurements: makeMeasurements({ durationSec: 400 }) });
    const result = evaluatePackAudioReadiness([{ trackNo: 1 }], [take]);
    expect(result.trackReadiness[0].complianceStatus).toBe('fail');
    expect(result.trackReadiness[0].ready).toBe(false);
    expect(result.blockedTrackCount).toBe(1);
  });

  it('warn 수준 컴플라이언스는 ready를 막지 않는다 (fail만 막음)', () => {
    const take = makeTake(1, { measurements: makeMeasurements({ durationSec: 218 }) }); // target 190-210 -> warn band
    const result = evaluatePackAudioReadiness([{ trackNo: 1 }], [take]);
    expect(result.trackReadiness[0].complianceStatus).toBe('warn');
    expect(result.trackReadiness[0].ready).toBe(true);
  });
});

describe('[지시문 11 TASK F-6] overallReady — 부분 준비는 절대 전체 통과로 취급하지 않는다', () => {
  it('18곡 중 17곡만 ready면 overallReady는 false다', () => {
    const takes = Array.from({ length: 17 }, (_, i) => makeTake(i + 1));
    const songs = Array.from({ length: 18 }, (_, i) => ({ trackNo: i + 1 }));
    const result = evaluatePackAudioReadiness(songs, takes);
    expect(result.readyTrackCount).toBe(17);
    expect(result.missingTrackCount).toBe(1);
    expect(result.overallReady).toBe(false);
  });

  it('빈 팩(트랙 0개)은 overallReady가 아니다 — 준비된 게 있어서가 아니라 아무것도 없어서 true가 되는 허점을 막는다', () => {
    const result = evaluatePackAudioReadiness([], []);
    expect(result.overallReady).toBe(false);
  });
});
