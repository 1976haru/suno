/**
 * v4.15 (TASK A/B verification) — no real Suno mp3 exports exist in this
 * headless environment. Synthesizes 3 stereo WAV files with realistic
 * verse/chorus-shaped amplitude envelopes (quiet intro -> body -> loud
 * final chorus -> quiet outro, one with an explicit silence gap near the
 * climax boundary) so core/audioHighlight.ts's climax detection/boundary
 * correction can be exercised against REAL decoded audio in a real browser,
 * not just synthetic Float32Arrays inside vitest. Reuses this app's own
 * encodeWav (src/core/audioEdit.ts) rather than a second WAV writer.
 */
import { writeFileSync } from 'node:fs';
import { encodeWav } from '../src/core/audioEdit';

// v4.15 verification note — mono/22050Hz (not the 44100 stereo a real Suno
// export would be) purely to keep these throwaway fixtures under the
// browser-upload bridge's 10MB per-file limit in this headless environment;
// the DSP under test (RMS/spectral-centroid math) is sample-rate-agnostic,
// and core/audioEdit.ts's decodeAudioFile still exercises the real
// preserve-channel-count path for whatever channel count it's given.
const SAMPLE_RATE = 22050;

interface Section {
  durationSec: number;
  amplitude: number;
  freqsHz: number[];
}

function synthesize(sections: readonly Section[]): Float32Array[] {
  const totalSamples = sections.reduce((sum, s) => sum + Math.round(s.durationSec * SAMPLE_RATE), 0);
  const mono = new Float32Array(totalSamples);
  let offset = 0;
  const RAMP_SAMPLES = Math.round(0.05 * SAMPLE_RATE); // 50ms ramp between sections to avoid clicks

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const section = sections[sIdx];
    const n = Math.round(section.durationSec * SAMPLE_RATE);
    for (let i = 0; i < n; i++) {
      let sample = 0;
      for (const freq of section.freqsHz) sample += Math.sin((2 * Math.PI * freq * (offset + i)) / SAMPLE_RATE);
      sample = (sample / section.freqsHz.length) * section.amplitude;
      // Ramp in/out at section boundaries so the raw RMS-based boundary-correction test has a genuine local dip to find, not a click artifact.
      let gain = 1;
      if (i < RAMP_SAMPLES) gain = i / RAMP_SAMPLES;
      else if (i > n - RAMP_SAMPLES) gain = (n - i) / RAMP_SAMPLES;
      mono[offset + i] = sample * gain;
    }
    offset += n;
  }
  return [mono];
}

// --- Track 1 (representative, trackNo 1): clean climax in the final chorus, no extra gap. ---
const track1 = synthesize([
  { durationSec: 15, amplitude: 0.08, freqsHz: [220, 330] }, // quiet intro
  { durationSec: 25, amplitude: 0.25, freqsHz: [330, 440] }, // verse
  { durationSec: 15, amplitude: 0.15, freqsHz: [260, 390] }, // quiet bridge dip
  { durationSec: 30, amplitude: 0.85, freqsHz: [440, 660, 880] }, // loud final chorus (climax)
  { durationSec: 10, amplitude: 0.1, freqsHz: [220] } // outro
]);
// total 95s; climax window should land inside [15+25+15, 15+25+15+30] = [55, 85]s, excluding front 15%(~14.25s)/back 10%(~9.5s).

// --- Track 2 (representative, trackNo 2): climax preceded by a real 0.4s silence gap 1.2s before its natural start, to verify §1-3 boundary correction snaps to it. ---
const preClimaxSections: Section[] = [
  { durationSec: 20, amplitude: 0.1, freqsHz: [200, 300] },
  { durationSec: 30, amplitude: 0.3, freqsHz: [300, 450] },
  { durationSec: 1.2, amplitude: 0.3, freqsHz: [300, 450] }, // tail of the verse, right up to the gap
  { durationSec: 0.4, amplitude: 0.0, freqsHz: [1] }, // phrase gap (near-silence) — the correction target
  { durationSec: 30, amplitude: 0.9, freqsHz: [523, 784, 1046] }, // loud final chorus
  { durationSec: 12, amplitude: 0.12, freqsHz: [200] }
];
const track2 = synthesize(preClimaxSections);
// total ~93.6s

// --- Track 3 (NOT representative, trackNo 5): shorter track, tests the exclusion-fallback path (window close to track length) and confirms isRepresentativeTrack is false. ---
const track3 = synthesize([
  { durationSec: 8, amplitude: 0.1, freqsHz: [180, 260] },
  { durationSec: 18, amplitude: 0.3, freqsHz: [260, 390] },
  { durationSec: 22, amplitude: 0.8, freqsHz: [390, 585, 780] },
  { durationSec: 6, amplitude: 0.1, freqsHz: [180] }
]);
// total 54s

const outDir = process.argv[2];
if (!outDir) {
  console.error('Usage: npx tsx scripts/genShortsTestAudio.ts <outDir>');
  process.exit(1);
}

function writeTrack(fileName: string, channels: Float32Array[]) {
  const blob = encodeWav(channels, SAMPLE_RATE);
  // encodeWav returns a browser Blob; in Node (vitest/tsx) that's the undici/Node Blob polyfill, which has arrayBuffer().
  void (blob as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer().then(buf => {
    writeFileSync(`${outDir}/${fileName}`, Buffer.from(buf));
    console.log(`wrote ${outDir}/${fileName} (${(buf.byteLength / 1024).toFixed(0)}KB)`);
  });
}

writeTrack('01 Test Song A.wav', track1);
writeTrack('02 Test Song B.wav', track2);
writeTrack('05 Test Song C.wav', track3);
