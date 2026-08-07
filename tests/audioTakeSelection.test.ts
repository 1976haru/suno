import { describe, expect, it } from 'vitest';
import {
  REJECTION_REASONS, isValidRejectionReasonId, labelForRejectionReason,
  withTakeSelected, evaluateTakeSelectionSafety, canSelectTake, orderTakesForComparison
} from '../src/core/audioTakeSelection';
import { buildTakeDirectives, type AudioTake } from '../src/core/audioTakes';
import { computeAudioMeasurements } from '../src/core/audioMeasurements';
import { SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';

/**
 * codex 지시문 06 (TASK C, required test file) — real coverage of the
 * rejection-reason taxonomy, the pure selection transform, and the
 * selection-safety gate the 완료 기준 names explicitly (no-measurements /
 * clipping / vocal-gender-without-warning).
 */

function makeTake(overrides: Partial<AudioTake> = {}): AudioTake {
  return {
    takeId: 't1', songId: 's1', trackNo: 1, packId: 'p1', takeNo: 1,
    fileName: 'take1.mp3', versionLabel: 'v1', adopted: false,
    metrics: { fileName: 'take1.mp3', durationSec: 180, rmsCurve: [], peakPosition: 0.8, dynamicRange: 10, overallLevel: -14, spectralCentroid: 2000, lowBandRatio: 0.3, highBandRatio: 0.2, spectrumProfile: [], warnings: [] },
    vocalMetrics: { vocalCentroid: 900, vocalLowRatio: 0.3, vocalMidRatio: 0.4, vocalHighRatio: 0.3, vocalProfile: [], registerHint: 'mid' },
    tempoEstimate: { bpm: 96, confidence: 0.8 },
    directives: buildTakeDirectives({ genreId: 'jazz-pop', vocalType: 'female', bpm: 96 }, SENIOR_AUDIENCE_PROFILE),
    analyzedAt: '2026-01-01T00:00:00.000Z',
    measurements: computeAudioMeasurements({ channels: [new Float32Array(44100 * 3)], sampleRate: 44100 }),
    ...overrides
  } as AudioTake;
}

describe('[codex 지시문 06 TASK C] REJECTION_REASONS — the real 12-item taxonomy', () => {
  it('has exactly the 12 spec-named reasons', () => {
    expect(REJECTION_REASONS).toHaveLength(12);
    expect(REJECTION_REASONS.map(r => r.labelKo)).toEqual([
      '너무 짧음', '너무 김', 'BPM 오류', '보컬 성별 오류', '듀엣 미구현', '가사 누락',
      '발음 오류', '후렴 약함', '인트로 과다', '분위기 불일치', '어린이 부적합', 'K-pop 파트 오류'
    ]);
  });

  it('isValidRejectionReasonId accepts every real id and rejects a made-up one', () => {
    for (const reason of REJECTION_REASONS) expect(isValidRejectionReasonId(reason.id)).toBe(true);
    expect(isValidRejectionReasonId('not-a-real-reason')).toBe(false);
  });

  it('labelForRejectionReason resolves the real Korean label', () => {
    expect(labelForRejectionReason('too-short')).toBe('너무 짧음');
  });
});

describe('[codex 지시문 06 TASK C] withTakeSelected — at most one selected take per track', () => {
  it('selecting one take un-selects every other take of the SAME song', () => {
    const takes = [makeTake({ takeId: 't1', adopted: true }), makeTake({ takeId: 't2', adopted: false })];
    const result = withTakeSelected(takes, 't2');
    expect(result.find(t => t.takeId === 't1')!.adopted).toBe(false);
    expect(result.find(t => t.takeId === 't2')!.adopted).toBe(true);
  });

  it('never touches a DIFFERENT song\'s takes', () => {
    const takes = [makeTake({ takeId: 't1', songId: 's1', adopted: true }), makeTake({ takeId: 't2', songId: 's2', adopted: true })];
    const result = withTakeSelected(takes, 't1');
    expect(result.find(t => t.takeId === 't2')!.adopted).toBe(true);
  });
});

describe('[codex 지시문 06 TASK C] evaluateTakeSelectionSafety / canSelectTake — 완료 기준 gates', () => {
  it('a take with no measurements at all is blocked ("selected take without measurements")', () => {
    const take = makeTake({ measurements: undefined });
    const issues = evaluateTakeSelectionSafety(take);
    expect(issues.some(i => i.id === 'no-measurements' && i.severity === 'blocking')).toBe(true);
    expect(canSelectTake(take)).toBe(false);
  });

  it('a clipped take is blocked ("clipped selected take")', () => {
    const clipped = computeAudioMeasurements({ channels: [new Float32Array(1000).fill(1)], sampleRate: 44100 });
    const take = makeTake({ measurements: clipped });
    const issues = evaluateTakeSelectionSafety(take);
    expect(issues.some(i => i.id === 'clipping' && i.severity === 'blocking')).toBe(true);
    expect(canSelectTake(take)).toBe(false);
  });

  it('a plausible vocal-gender mismatch always surfaces as a warning ("wrong vocal gender selected without warning" — structurally impossible since the warning is always in this function\'s own return value)', () => {
    const take = makeTake({
      directives: { ...buildTakeDirectives({ genreId: 'x', vocalType: 'male', bpm: 96 }, SENIOR_AUDIENCE_PROFILE) },
      vocalMetrics: { vocalCentroid: 2000, vocalLowRatio: 0.1, vocalMidRatio: 0.2, vocalHighRatio: 0.7, vocalProfile: [], registerHint: 'high' }
    });
    const issues = evaluateTakeSelectionSafety(take);
    expect(issues.some(i => i.id === 'vocal-gender-mismatch' && i.severity === 'warning')).toBe(true);
    // A warning-only issue never blocks the selection outright — the user may still proceed, but always WITH the warning surfaced.
    expect(canSelectTake(take)).toBe(true);
  });

  it('a fully clean, measured, non-clipped, plausible-gender take is selectable with zero issues', () => {
    const take = makeTake();
    expect(evaluateTakeSelectionSafety(take)).toEqual([]);
    expect(canSelectTake(take)).toBe(true);
  });
});

describe('[codex 지시문 06 TASK C] orderTakesForComparison', () => {
  it('orders good before unrated before bad', () => {
    const takes = [makeTake({ takeId: 'bad', rating: 'bad', takeNo: 1 }), makeTake({ takeId: 'good', rating: 'good', takeNo: 2 }), makeTake({ takeId: 'unrated', takeNo: 3 })];
    const ordered = orderTakesForComparison(takes);
    expect(ordered.map(t => t.takeId)).toEqual(['good', 'unrated', 'bad']);
  });

  it('breaks ties by takeNo ascending', () => {
    const takes = [makeTake({ takeId: 't2', rating: 'good', takeNo: 2 }), makeTake({ takeId: 't1', rating: 'good', takeNo: 1 })];
    expect(orderTakesForComparison(takes).map(t => t.takeId)).toEqual(['t1', 't2']);
  });
});
