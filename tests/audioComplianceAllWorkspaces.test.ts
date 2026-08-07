import { describe, expect, it } from 'vitest';
import { checkCoreAudioCompliance, overallComplianceStatus, type AudioComplianceTarget } from '../src/core/audioCompliance';
import { checkKidsAudioCompliance, checkKpopAudioCompliance, check2030AudioCompliance, checkSeniorAudioCompliance } from '../src/core/audioWorkspaceCompliance';
import type { AudioMeasurements } from '../src/core/audioMeasurements';
import type { VocalMetrics, SongAudioMetrics } from '../src/core/audioAnalysis';

/**
 * codex 지시문 06 (TASK B, required test file) — real coverage of the 5
 * core tolerance-band checks plus every workspace's own additions.
 */

function makeMeasurements(overrides: Partial<AudioMeasurements> = {}): AudioMeasurements {
  return {
    durationSec: 200, bpm: 96, bpmConfidence: 0.8, leadingSilenceSec: 0.3, trailingSilenceSec: 0.5,
    peak: 0.7, approximateLoudnessDb: -14, clippingSampleCount: 0, clipping: false, stereoWidth: 0.4,
    sampleRate: 44100, channels: 2, ...overrides
  };
}

describe('[codex 지시문 06 TASK B] checkCoreAudioCompliance — real literal tolerance bands', () => {
  const target: AudioComplianceTarget = { targetDurationSec: [190, 210], targetBpm: 96 };

  it('a fully compliant take passes every core check', () => {
    const results = checkCoreAudioCompliance(makeMeasurements(), target);
    expect(overallComplianceStatus(results)).toBe('pass');
  });

  it('duration: within target range = pass', () => {
    const results = checkCoreAudioCompliance(makeMeasurements({ durationSec: 195 }), target);
    expect(results.find(r => r.id === 'duration')!.status).toBe('pass');
  });

  it('duration: outside range but within ±15s = warn', () => {
    const results = checkCoreAudioCompliance(makeMeasurements({ durationSec: 220 }), target);
    expect(results.find(r => r.id === 'duration')!.status).toBe('warn');
  });

  it('duration: beyond ±15s = fail', () => {
    const results = checkCoreAudioCompliance(makeMeasurements({ durationSec: 260 }), target);
    expect(results.find(r => r.id === 'duration')!.status).toBe('fail');
  });

  it('bpm: within ±5 = pass', () => {
    const results = checkCoreAudioCompliance(makeMeasurements({ bpm: 99 }), target);
    expect(results.find(r => r.id === 'bpm')!.status).toBe('pass');
  });

  it('bpm: within ±10 (but beyond ±5) = warn', () => {
    const results = checkCoreAudioCompliance(makeMeasurements({ bpm: 104 }), target);
    expect(results.find(r => r.id === 'bpm')!.status).toBe('warn');
  });

  it('bpm: beyond ±10 = fail', () => {
    const results = checkCoreAudioCompliance(makeMeasurements({ bpm: 120 }), target);
    expect(results.find(r => r.id === 'bpm')!.status).toBe('fail');
  });

  it('bpm: a low-confidence estimate is not-measured, never a false fail', () => {
    const results = checkCoreAudioCompliance(makeMeasurements({ bpm: 200, bpmConfidence: 0.1 }), target);
    expect(results.find(r => r.id === 'bpm')!.status).toBe('not-measured');
  });

  it('clipping: any clipping at all = fail (0 tolerance)', () => {
    const results = checkCoreAudioCompliance(makeMeasurements({ clipping: true, clippingSampleCount: 3 }), target);
    expect(results.find(r => r.id === 'clipping')!.status).toBe('fail');
  });

  it('leading silence: ≤1s passes, >1s fails', () => {
    expect(checkCoreAudioCompliance(makeMeasurements({ leadingSilenceSec: 1 }), target).find(r => r.id === 'leading-silence')!.status).toBe('pass');
    expect(checkCoreAudioCompliance(makeMeasurements({ leadingSilenceSec: 1.5 }), target).find(r => r.id === 'leading-silence')!.status).toBe('fail');
  });

  it('trailing silence: ≤2s passes, >2s fails', () => {
    expect(checkCoreAudioCompliance(makeMeasurements({ trailingSilenceSec: 2 }), target).find(r => r.id === 'trailing-silence')!.status).toBe('pass');
    expect(checkCoreAudioCompliance(makeMeasurements({ trailingSilenceSec: 2.5 }), target).find(r => r.id === 'trailing-silence')!.status).toBe('fail');
  });

  it('overallComplianceStatus reports the worst real status, never let by not-measured', () => {
    expect(overallComplianceStatus([{ id: 'a', labelKo: '', status: 'pass', detail: '' }, { id: 'b', labelKo: '', status: 'not-measured', detail: '' }])).toBe('pass');
    expect(overallComplianceStatus([{ id: 'a', labelKo: '', status: 'warn', detail: '' }, { id: 'b', labelKo: '', status: 'fail', detail: '' }])).toBe('fail');
  });
});

function makeVocalMetrics(overrides: Partial<VocalMetrics> = {}): VocalMetrics {
  return { vocalCentroid: 900, vocalLowRatio: 0.3, vocalMidRatio: 0.4, vocalHighRatio: 0.3, vocalProfile: [], registerHint: 'mid', ...overrides };
}

function makeSongAudioMetrics(overrides: Partial<SongAudioMetrics> = {}): SongAudioMetrics {
  return { fileName: 'x.mp3', durationSec: 200, rmsCurve: [], peakPosition: 0.8, dynamicRange: 10, overallLevel: -14, spectralCentroid: 2000, lowBandRatio: 0.3, highBandRatio: 0.2, spectrumProfile: [], warnings: [], ...overrides };
}

describe('[codex 지시문 06 TASK B] kids — 음량 advisory / 공포음향(honest not-measured) / 가사 속도', () => {
  it('flags excessive volume as an advisory warn, never a hard fail', () => {
    const results = checkKidsAudioCompliance({
      measurements: makeMeasurements({ approximateLoudnessDb: -4 }),
      lyricWordCount: 80, kidsAgeTierId: 'kids-t2', targetDurationSec: [150, 180]
    });
    expect(results.find(r => r.id === 'kids-volume-advisory')!.status).toBe('warn');
  });

  it('scary-sound is honestly not-measured, never faked', () => {
    const results = checkKidsAudioCompliance({ measurements: makeMeasurements(), lyricWordCount: 80, kidsAgeTierId: 'kids-t2', targetDurationSec: [150, 180] });
    expect(results.find(r => r.id === 'kids-scary-sound')!.status).toBe('not-measured');
  });

  it('flags a lyric pace far too fast for the age tier', () => {
    const results = checkKidsAudioCompliance({
      measurements: makeMeasurements({ durationSec: 60 }),
      lyricWordCount: 400, kidsAgeTierId: 'kids-t1', targetDurationSec: [90, 120]
    });
    expect(results.find(r => r.id === 'kids-lyric-pace')!.status).toBe('warn');
  });

  it('a reasonable pace for the age tier passes', () => {
    const results = checkKidsAudioCompliance({
      measurements: makeMeasurements({ durationSec: 100 }),
      lyricWordCount: 60, kidsAgeTierId: 'kids-t2', targetDurationSec: [90, 120]
    });
    expect(results.find(r => r.id === 'kids-lyric-pace')!.status).toBe('pass');
  });
});

describe('[codex 지시문 06 TASK B] K-pop — vocal gender advisory + honest not-measured part checks', () => {
  it('flags a possible gender mismatch as advisory (never a hard fail — registerHint is reference-only)', () => {
    const results = checkKpopAudioCompliance(makeVocalMetrics({ registerHint: 'high' }), 'male');
    expect(results.find(r => r.id === 'vocal-gender-plausibility')!.status).toBe('warn');
  });

  it('does not flag a plausible match', () => {
    const results = checkKpopAudioCompliance(makeVocalMetrics({ registerHint: 'low' }), 'male');
    expect(results.find(r => r.id === 'vocal-gender-plausibility')!.status).toBe('pass');
  });

  it('part implementation / part distribution are honestly not-measured (need ASR, TASK E future scope)', () => {
    const results = checkKpopAudioCompliance(makeVocalMetrics(), 'male');
    expect(results.find(r => r.id === 'kpop-part-implementation')!.status).toBe('not-measured');
    expect(results.find(r => r.id === 'kpop-part-distribution')!.status).toBe('not-measured');
  });
});

describe('[codex 지시문 06 TASK B] 2030 — vocal gender advisory + honest not-measured genre/mood', () => {
  it('reuses the same real vocal-gender advisory as K-pop', () => {
    const results = check2030AudioCompliance(makeVocalMetrics({ registerHint: 'high' }), 'female');
    expect(results.find(r => r.id === 'vocal-gender-plausibility')!.status).toBe('pass');
  });

  it('genre/mood matching is honestly not-measured (no audio genre-classifier exists)', () => {
    const results = check2030AudioCompliance(makeVocalMetrics(), 'female');
    expect(results.find(r => r.id === 'modern2030-genre-mood')!.status).toBe('not-measured');
  });
});

describe('[codex 지시문 06 TASK B] senior — 과도한 고역 / 보컬 편안함', () => {
  it('flags excessive high-band share as advisory', () => {
    const results = checkSeniorAudioCompliance(makeSongAudioMetrics({ highBandRatio: 0.5 }));
    expect(results.find(r => r.id === 'senior-high-band')!.status).toBe('warn');
  });

  it('does not flag a normal high-band share', () => {
    const results = checkSeniorAudioCompliance(makeSongAudioMetrics({ highBandRatio: 0.2 }));
    expect(results.find(r => r.id === 'senior-high-band')!.status).toBe('pass');
  });

  it('flags an uncomfortably wide dynamic range as advisory', () => {
    const results = checkSeniorAudioCompliance(makeSongAudioMetrics({ dynamicRange: 30 }));
    expect(results.find(r => r.id === 'senior-vocal-comfort')!.status).toBe('warn');
  });
});
