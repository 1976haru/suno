import { describe, expect, it } from 'vitest';
import {
  buildEditedFileName,
  computeFadeOutPlan,
  computeSpeedPlan,
  encodeWav,
  formatMinSec,
  parseMinSec,
  MAX_SPEEDUP_PCT
} from '../src/core/audioEdit';

// TASK v3.79 (TASK E) — computeFadeOutPlan/computeSpeedPlan/encodeWav are
// pure functions with no AudioContext dependency, so they're fully
// verifiable under vitest's node environment (this app's vitest.config.ts
// runs `environment: 'node'` — no window/AudioContext/AudioBuffer global,
// same limitation audioAnalysis.test.ts already documents for decode-side
// code). The browser-only render*/decodeAudioFile functions in
// src/core/audioEdit.ts are NOT exercised here — only reasoned through by
// hand — see this file's own summary note.

describe('[v3.79 TASK E] computeFadeOutPlan', () => {
  it('normal case: 4:16 -> 3:30 with an 8s fade starts the fade at 3:22 and hits 3:30 exactly', () => {
    const plan = computeFadeOutPlan(4 * 60 + 16, 3 * 60 + 30, 8);
    expect(plan.achievedDurationSec).toBe(210); // 3:30
    expect(plan.fadeStartSec).toBe(202); // 3:22
    expect(plan.fadeLengthSec).toBe(8);
    expect(plan.warning).toBeUndefined();
  });

  it('fade length longer than the target clamps to the target instead of going negative, and reports it', () => {
    const plan = computeFadeOutPlan(120, 10, 15);
    expect(plan.fadeLengthSec).toBe(10);
    expect(plan.fadeStartSec).toBe(0);
    expect(plan.fadeStartSec).toBeGreaterThanOrEqual(0);
    expect(plan.achievedDurationSec).toBe(10);
    expect(plan.warning).toBeTruthy();
  });

  it('target longer than the current duration clamps to the current duration and reports it', () => {
    const plan = computeFadeOutPlan(100, 500, 8);
    expect(plan.achievedDurationSec).toBe(100);
    expect(plan.fadeStartSec).toBe(92);
    expect(plan.warning).toBeTruthy();
  });

  it('a zero fade length is allowed (hard cut at the target, no ramp) and never negative', () => {
    const plan = computeFadeOutPlan(200, 100, 0);
    expect(plan.fadeLengthSec).toBe(0);
    expect(plan.fadeStartSec).toBe(100);
  });

  it('fadeStartSec is never negative for any combination of inputs', () => {
    for (const [cur, target, fade] of [[10, 5, 20], [1, 0, 8], [50, 50, 8], [300, 0, 8]] as const) {
      const plan = computeFadeOutPlan(cur, target, fade);
      expect(plan.fadeStartSec).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('[v3.79 TASK E] computeSpeedPlan', () => {
  it('speed can fully reach a modest target with room to spare', () => {
    // 100s -> 99s needs only a ~1.01x speedup, well under the 3% cap.
    const plan = computeSpeedPlan(100, 99);
    expect(plan.targetReached).toBe(true);
    expect(plan.shortfallSec).toBeCloseTo(0, 6);
    expect(plan.speedRatio).toBeLessThan(1 + MAX_SPEEDUP_PCT);
    expect(plan.achievedDurationSec).toBeCloseTo(99, 6);
  });

  it('speed exactly at the 3% boundary reaches the target with speedRatio == 1.03', () => {
    const current = 103;
    const target = 100; // 103 / 1.03 == 100 exactly
    const plan = computeSpeedPlan(current, target);
    expect(plan.speedRatio).toBeCloseTo(1.03, 6);
    expect(plan.targetReached).toBe(true);
    expect(plan.achievedDurationSec).toBeCloseTo(100, 6);
  });

  it('speed alone cannot reach the target (cutting 60s off 4:16 via speed only): caps at 3%, reports the real shortfall, never exceeds the cap', () => {
    const current = 4 * 60 + 16; // 256s
    const target = current - 60; // 196s — far more than 3% can close
    const plan = computeSpeedPlan(current, target);
    expect(plan.speedRatio).toBeCloseTo(1.03, 6);
    expect(plan.speedRatio).toBeLessThanOrEqual(1 + MAX_SPEEDUP_PCT);
    expect(plan.targetReached).toBe(false);
    expect(plan.achievedDurationSec).toBeCloseTo(current / 1.03, 6);
    const expectedShortfall = current / 1.03 - target;
    expect(plan.shortfallSec).toBeCloseTo(expectedShortfall, 6);
    expect(plan.shortfallSec).toBeGreaterThan(0);
  });

  it('a caller-supplied maxSpeedupPct above 3% is still hard-capped at 3% in code, not just by convention', () => {
    const plan = computeSpeedPlan(200, 100, 0.5); // asks for 50% speedup, which would fully reach the target
    expect(plan.maxSpeedupPct).toBeCloseTo(MAX_SPEEDUP_PCT, 10);
    expect(plan.speedRatio).toBeLessThanOrEqual(1 + MAX_SPEEDUP_PCT + 1e-9);
    expect(plan.targetReached).toBe(false); // 3% of 200s cannot reach 100s
  });

  it('target equal to or beyond current duration needs no speedup (ratio clamps to 1)', () => {
    const plan = computeSpeedPlan(150, 200);
    expect(plan.speedRatio).toBe(1);
    expect(plan.targetReached).toBe(true);
    expect(plan.achievedDurationSec).toBeCloseTo(150, 6);
  });
});

describe('[v3.79 TASK E] formatMinSec / parseMinSec', () => {
  it('formats seconds as mm:ss', () => {
    expect(formatMinSec(210)).toBe('3:30');
    expect(formatMinSec(5)).toBe('0:05');
    expect(formatMinSec(0)).toBe('0:00');
  });

  it('parses mm:ss back to seconds', () => {
    expect(parseMinSec('3:30')).toBe(210);
    expect(parseMinSec('0:05')).toBe(5);
  });

  it('parses a bare seconds number', () => {
    expect(parseMinSec('45')).toBe(45);
  });

  it('rejects unparseable input', () => {
    expect(parseMinSec('abc')).toBeNull();
    expect(parseMinSec('-5')).toBeNull();
  });
});

describe('[v3.79 TASK E] buildEditedFileName', () => {
  it('appends _edit and switches the extension to .wav, never returning the original name', () => {
    expect(buildEditedFileName('T7 Dance Hall Smile.mp3')).toBe('T7 Dance Hall Smile_edit.wav');
    expect(buildEditedFileName('song.wav')).toBe('song_edit.wav');
  });

  it('handles a file name with no extension', () => {
    expect(buildEditedFileName('song')).toBe('song_edit.wav');
  });
});

describe('[v3.79 TASK E] encodeWav', () => {
  // AudioBuffer isn't available under vitest's node environment, so this
  // exercises encodeWav directly against hand-built Float32Array channel
  // data (its actual parameter type) rather than a real AudioBuffer — the
  // AudioBuffer-consuming wrapper (encodeWavFromAudioBuffer) is browser-only
  // and not covered here; see this test file's own top note.

  it('produces a valid 44-byte RIFF/WAVE header with correct sizes for mono PCM', async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const blob = encodeWav([samples], 44100);
    expect(blob.type).toBe('audio/wav');
    const buffer = await blob.arrayBuffer();
    expect(buffer.byteLength).toBe(44 + samples.length * 2);
    const view = new DataView(buffer);

    const readStr = (offset: number, len: number) => String.fromCharCode(...new Uint8Array(buffer, offset, len));
    expect(readStr(0, 4)).toBe('RIFF');
    expect(readStr(8, 4)).toBe('WAVE');
    expect(readStr(12, 4)).toBe('fmt ');
    expect(readStr(36, 4)).toBe('data');

    expect(view.getUint32(4, true)).toBe(36 + samples.length * 2);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(44100); // sample rate
    expect(view.getUint16(34, true)).toBe(16); // bit depth
    expect(view.getUint32(40, true)).toBe(samples.length * 2); // data size
  });

  it('interleaves stereo channels correctly and clamps out-of-range samples to +-1', async () => {
    const left = new Float32Array([1, -1]);
    const right = new Float32Array([0.5, -0.5]);
    const blob = encodeWav([left, right], 22050);
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);
    expect(view.getUint16(22, true)).toBe(2); // stereo

    // Frame 0: L=1.0 -> 0x7fff, R=0.5 -> ~0x3fff
    const l0 = view.getInt16(44, true);
    const r0 = view.getInt16(46, true);
    expect(l0).toBe(0x7fff);
    expect(r0).toBeCloseTo(0.5 * 0x7fff, -1);

    // Frame 1: L=-1.0 -> -0x8000, R=-0.5
    const l1 = view.getInt16(48, true);
    const r1 = view.getInt16(50, true);
    expect(l1).toBe(-0x8000);
    expect(r1).toBeCloseTo(-0.5 * 0x8000, -1);
  });

  it('round-trips silence (all zero samples) without NaN/garbage bytes', async () => {
    const blob = encodeWav([new Float32Array(10)], 22050);
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);
    for (let i = 0; i < 10; i++) expect(view.getInt16(44 + i * 2, true)).toBe(0);
  });
});
