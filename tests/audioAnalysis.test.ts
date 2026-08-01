import { describe, expect, it } from 'vitest';
import { analyzePcmData, computeRmsCurve, computeSpectrumMetrics, cosineSimilarity } from '../src/core/audioAnalysis';

// TASK v3.73 (TASK A) — analyzePcmData/computeRmsCurve/computeSpectrumMetrics
// are pure functions over already-decoded PCM, so they're verifiable with
// KNOWN synthetic signals (a real mp3 can't be decoded under vitest/jsdom —
// only analyzeAudioFile touches AudioContext, and that's browser-only,
// verified separately by hand in a real browser — see docs/v373-report.md).

const SAMPLE_RATE = 22050;

function sineWave(freqHz: number, durationSec: number, amplitude = 1, sampleRate = SAMPLE_RATE): Float32Array {
  const length = Math.round(durationSec * sampleRate);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) samples[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  return samples;
}

describe('[v3.73 TASK A] computeSpectrumMetrics', () => {
  it('a pure 1000Hz sine wave centers its spectral centroid near 1000Hz', () => {
    const samples = sineWave(1000, 3);
    const spectrum = computeSpectrumMetrics(samples, SAMPLE_RATE);
    expect(spectrum.spectralCentroid).toBeGreaterThan(900);
    expect(spectrum.spectralCentroid).toBeLessThan(1100);
  });

  it('a low 150Hz tone reads almost entirely in the low band, none in the high band', () => {
    const samples = sineWave(150, 3);
    const spectrum = computeSpectrumMetrics(samples, SAMPLE_RATE);
    expect(spectrum.lowBandRatio).toBeGreaterThan(0.9);
    expect(spectrum.highBandRatio).toBeLessThan(0.05);
  });

  it('a high 6000Hz tone reads almost entirely in the high band, none in the low band', () => {
    const samples = sineWave(6000, 3);
    const spectrum = computeSpectrumMetrics(samples, SAMPLE_RATE);
    expect(spectrum.highBandRatio).toBeGreaterThan(0.9);
    expect(spectrum.lowBandRatio).toBeLessThan(0.05);
  });

  it('spectrumProfile always sums to ~1 (normalized) and is the same length for any input', () => {
    const a = computeSpectrumMetrics(sineWave(1000, 3), SAMPLE_RATE);
    const b = computeSpectrumMetrics(sineWave(4000, 5), SAMPLE_RATE);
    const sumA = a.spectrumProfile.reduce((x, y) => x + y, 0);
    expect(sumA).toBeGreaterThan(0.99);
    expect(sumA).toBeLessThan(1.01);
    expect(a.spectrumProfile.length).toBe(b.spectrumProfile.length);
  });
});

describe('[v3.73 TASK A] cosineSimilarity', () => {
  it('identical spectra are similarity 1', () => {
    const spectrum = computeSpectrumMetrics(sineWave(1200, 3), SAMPLE_RATE).spectrumProfile;
    expect(cosineSimilarity(spectrum, spectrum)).toBeCloseTo(1, 5);
  });

  it('a 1000Hz tone and a 6000Hz tone are near-orthogonal (low similarity)', () => {
    const low = computeSpectrumMetrics(sineWave(1000, 3), SAMPLE_RATE).spectrumProfile;
    const high = computeSpectrumMetrics(sineWave(6000, 3), SAMPLE_RATE).spectrumProfile;
    expect(cosineSimilarity(low, high)).toBeLessThan(0.3);
  });

  it('two close tones (1000Hz vs 1100Hz) are more similar than two far tones (1000Hz vs 6000Hz)', () => {
    const a = computeSpectrumMetrics(sineWave(1000, 3), SAMPLE_RATE).spectrumProfile;
    const bClose = computeSpectrumMetrics(sineWave(1100, 3), SAMPLE_RATE).spectrumProfile;
    const bFar = computeSpectrumMetrics(sineWave(6000, 3), SAMPLE_RATE).spectrumProfile;
    expect(cosineSimilarity(a, bClose)).toBeGreaterThan(cosineSimilarity(a, bFar));
  });
});

describe('[v3.73 TASK A] computeRmsCurve', () => {
  it('a constant-amplitude tone has a near-flat RMS curve (small dynamic range)', () => {
    const curve = computeRmsCurve(sineWave(440, 4, 0.5));
    expect(curve).toHaveLength(20);
    expect(Math.max(...curve) - Math.min(...curve)).toBeLessThan(1);
  });

  it('a tone that ramps up in amplitude peaks in the last segment (peakPosition near 1)', () => {
    const length = 4 * SAMPLE_RATE;
    const samples = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const amp = 0.05 + 0.9 * (i / length); // quiet start, loud end
      samples[i] = amp * Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE);
    }
    const curve = computeRmsCurve(samples);
    const peakIdx = curve.reduce((best, v, idx) => (v > curve[best] ? idx : best), 0);
    expect(peakIdx / (curve.length - 1)).toBeGreaterThanOrEqual(0.75);
  });

  it('silence floors at -100dB rather than -Infinity', () => {
    const curve = computeRmsCurve(new Float32Array(SAMPLE_RATE * 2));
    for (const value of curve) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeLessThan(-90);
    }
  });
});

describe('[v3.73 TASK A] analyzePcmData', () => {
  it('reports correct duration, a real spectral centroid, and no crash on a quiet-to-loud ramp', () => {
    const durationSec = 5;
    const samples = sineWave(2000, durationSec, 0.3);
    const metrics = analyzePcmData(samples, SAMPLE_RATE, 'test.mp3');
    expect(metrics.fileName).toBe('test.mp3');
    expect(metrics.durationSec).toBeCloseTo(durationSec, 1);
    expect(metrics.spectralCentroid).toBeGreaterThan(1800);
    expect(metrics.spectralCentroid).toBeLessThan(2200);
    expect(metrics.rmsCurve).toHaveLength(20);
    expect(metrics.warnings).toEqual([]);
  });

  it('warns on a suspiciously short file', () => {
    const metrics = analyzePcmData(sineWave(440, 2), SAMPLE_RATE, 'short.mp3');
    expect(metrics.warnings.some(w => w.includes('5초'))).toBe(true);
  });
});
