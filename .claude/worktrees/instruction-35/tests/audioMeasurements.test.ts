import { describe, expect, it } from 'vitest';
import { computeAudioMeasurements } from '../src/core/audioMeasurements';

/**
 * codex 지시문 06 (TASK A, required test file) — computeAudioMeasurements is
 * pure over already-decoded PCM (same "verifiable with known synthetic
 * signals" convention core/audioAnalysis.ts's own tests already established
 * — a real mp3 can't be decoded under vitest/jsdom; only decodeToChannelsPcm
 * touches AudioContext, browser-only, verified by hand).
 */

const SAMPLE_RATE = 22050;

function silence(durationSec: number, sampleRate = SAMPLE_RATE): Float32Array {
  return new Float32Array(Math.round(durationSec * sampleRate));
}

function sineWave(freqHz: number, durationSec: number, amplitude = 0.5, sampleRate = SAMPLE_RATE): Float32Array {
  const length = Math.round(durationSec * sampleRate);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) samples[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  return samples;
}

function concat(...arrays: Float32Array[]): Float32Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

describe('[codex 지시문 06 TASK A] computeAudioMeasurements — durationSec/sampleRate/channels', () => {
  it('measures real duration from sample count / sample rate', () => {
    const samples = sineWave(440, 3);
    const result = computeAudioMeasurements({ channels: [samples], sampleRate: SAMPLE_RATE });
    expect(result.durationSec).toBeCloseTo(3, 1);
  });

  it('reports the real channel count and sample rate passed in', () => {
    const samples = sineWave(440, 1);
    const mono = computeAudioMeasurements({ channels: [samples], sampleRate: 44100 });
    expect(mono.channels).toBe(1);
    expect(mono.sampleRate).toBe(44100);
    const stereo = computeAudioMeasurements({ channels: [samples, samples], sampleRate: 48000 });
    expect(stereo.channels).toBe(2);
    expect(stereo.sampleRate).toBe(48000);
  });
});

describe('[codex 지시문 06 TASK A] leading/trailing silence detection', () => {
  it('detects real leading and trailing silence around a tone', () => {
    const samples = concat(silence(1.5), sineWave(440, 2), silence(2.5));
    const result = computeAudioMeasurements({ channels: [samples], sampleRate: SAMPLE_RATE });
    expect(result.leadingSilenceSec).toBeCloseTo(1.5, 1);
    expect(result.trailingSilenceSec).toBeCloseTo(2.5, 1);
  });

  it('a track with sound from the very first sample has ~0 leading silence', () => {
    const samples = sineWave(440, 2);
    const result = computeAudioMeasurements({ channels: [samples], sampleRate: SAMPLE_RATE });
    expect(result.leadingSilenceSec).toBeLessThan(0.05);
  });

  it('a fully silent track reports its own full duration as trailing silence', () => {
    const samples = silence(3);
    const result = computeAudioMeasurements({ channels: [samples], sampleRate: SAMPLE_RATE });
    expect(result.trailingSilenceSec).toBeCloseTo(3, 1);
  });
});

describe('[codex 지시문 06 TASK A] clipping detection', () => {
  it('flags real clipping when samples hit full scale', () => {
    const samples = new Float32Array(1000).fill(1.0);
    const result = computeAudioMeasurements({ channels: [samples], sampleRate: SAMPLE_RATE });
    expect(result.clipping).toBe(true);
    expect(result.clippingSampleCount).toBe(1000);
  });

  it('a normally-mastered tone (peak well under full scale) never flags clipping', () => {
    const samples = sineWave(440, 2, 0.5);
    const result = computeAudioMeasurements({ channels: [samples], sampleRate: SAMPLE_RATE });
    expect(result.clipping).toBe(false);
    expect(result.clippingSampleCount).toBe(0);
  });
});

describe('[codex 지시문 06 TASK A] peak / approximateLoudnessDb', () => {
  it('peak reflects the real max sample magnitude across channels', () => {
    const loud = new Float32Array([0.1, 0.9, -0.3]);
    const quiet = new Float32Array([0.05, 0.05, 0.05]);
    const result = computeAudioMeasurements({ channels: [loud, quiet], sampleRate: SAMPLE_RATE });
    expect(result.peak).toBeCloseTo(0.9, 5);
  });

  it('a louder signal measures a higher (less negative) approximateLoudnessDb than a quieter one', () => {
    const loud = computeAudioMeasurements({ channels: [sineWave(440, 2, 0.8)], sampleRate: SAMPLE_RATE });
    const quiet = computeAudioMeasurements({ channels: [sineWave(440, 2, 0.1)], sampleRate: SAMPLE_RATE });
    expect(loud.approximateLoudnessDb).toBeGreaterThan(quiet.approximateLoudnessDb);
  });
});

describe('[codex 지시문 06 TASK A] stereoWidth', () => {
  it('is exactly 0 for a mono (single-channel) source', () => {
    const result = computeAudioMeasurements({ channels: [sineWave(440, 1)], sampleRate: SAMPLE_RATE });
    expect(result.stereoWidth).toBe(0);
  });

  it('is 0 for identical L/R channels (mono content panned center)', () => {
    const mono = sineWave(440, 1);
    const result = computeAudioMeasurements({ channels: [mono, mono], sampleRate: SAMPLE_RATE });
    expect(result.stereoWidth).toBeCloseTo(0, 5);
  });

  it('is > 0 for real, distinct L/R channels (a genuine stereo image)', () => {
    const left = sineWave(440, 1, 0.5);
    const right = sineWave(660, 1, 0.5);
    const result = computeAudioMeasurements({ channels: [left, right], sampleRate: SAMPLE_RATE });
    expect(result.stereoWidth).toBeGreaterThan(0.1);
  });
});

describe('[지시문 11 TASK F] oneSecRmsDeviationDb — 실제 1초 폭 윈도우 (audioAnalysis.ts의 고정 20구간과 다름)', () => {
  it('일정한 진폭의 순음은 편차가 거의 0에 가깝다', () => {
    const samples = sineWave(440, 5, 0.5);
    const result = computeAudioMeasurements({ channels: [samples], sampleRate: SAMPLE_RATE });
    expect(result.oneSecRmsDeviationDb).toBeLessThan(1);
  });

  it('조용한 구간과 큰 구간이 번갈아 있으면 편차가 실제로 크게 측정된다', () => {
    const samples = concat(sineWave(440, 2, 0.05), sineWave(440, 2, 0.9));
    const result = computeAudioMeasurements({ channels: [samples], sampleRate: SAMPLE_RATE });
    expect(result.oneSecRmsDeviationDb).toBeGreaterThan(15);
  });

  it('1초 미만 길이의 오디오는 편차를 계산할 수 없어 0을 반환한다 (허구 값 생성 안 함)', () => {
    const samples = sineWave(440, 0.3, 0.5);
    const result = computeAudioMeasurements({ channels: [samples], sampleRate: SAMPLE_RATE });
    expect(result.oneSecRmsDeviationDb).toBe(0);
  });

  it('트랙 길이와 무관하게 윈도우 폭이 항상 1초다 — 20초 트랙도 200초 트랙도 같은 윈도우 크기', () => {
    const shortTrack = concat(sineWave(440, 10, 0.05), sineWave(440, 10, 0.9));
    const longTrack = concat(sineWave(440, 100, 0.05), sineWave(440, 100, 0.9));
    const shortResult = computeAudioMeasurements({ channels: [shortTrack], sampleRate: SAMPLE_RATE });
    const longResult = computeAudioMeasurements({ channels: [longTrack], sampleRate: SAMPLE_RATE });
    expect(shortResult.oneSecRmsDeviationDb).toBeCloseTo(longResult.oneSecRmsDeviationDb, 0);
  });
});

describe('[codex 지시문 06 TASK A] bpm — reuses a supplied TempoEstimate rather than recomputing', () => {
  it('passes through a supplied tempoEstimate unchanged', () => {
    const result = computeAudioMeasurements({
      channels: [sineWave(440, 2)],
      sampleRate: SAMPLE_RATE,
      tempoEstimate: { bpm: 120, confidence: 0.9 }
    });
    expect(result.bpm).toBe(120);
    expect(result.bpmConfidence).toBe(0.9);
  });
});
