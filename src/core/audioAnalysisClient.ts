import AudioAnalysisWorker from '../workers/audioAnalysisWorker?worker';
import { ANALYSIS_SAMPLE_RATE, analyzeFullPcmData, analyzePcmData, decodeToMonoPcm } from './audioAnalysis';
import type { FullAudioAnalysis, SongAudioMetrics } from './audioAnalysis';

/**
 * v4.0 (TASK A) — browser UI path for audio analysis. Decode
 * (AudioContext/OfflineAudioContext, main-thread-only APIs) stays here; the
 * FFT/DSP pass on the decoded PCM runs in audioAnalysisWorker.ts. Same
 * non-fallback-in-browser contract as the other *Client.ts modules in this
 * app — `typeof Worker === 'undefined'` only fires in Node/Vitest.
 * The PCM Float32Array is transferred (not cloned) to the worker — it can be
 * several MB for a 3-minute track, and analyzeAudioFile's own caller never
 * needs it again after this call.
 */

function runOnWorker<TResponse extends { ok: boolean }>(
  samples: Float32Array,
  sampleRate: number,
  fileName: string,
  type: 'analyze' | 'analyzeFull'
): Promise<TResponse> {
  let worker: Worker;
  try {
    worker = new AudioAnalysisWorker();
  } catch (error) {
    throw new Error(`오디오 분석 Worker를 시작하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`);
  }

  return new Promise<TResponse>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error('오디오 분석 시간이 60초를 넘겨 중단했습니다.'));
    }, 60_000);

    const finish = () => {
      window.clearTimeout(timeout);
      worker.terminate();
    };

    worker.onmessage = event => {
      const response = event.data as TResponse & { error?: string };
      finish();
      if (response.ok) resolve(response);
      else reject(new Error(response.error || '오디오 분석 Worker가 결과를 반환하지 못했습니다.'));
    };
    worker.onerror = event => {
      finish();
      reject(new Error(event.message || '오디오 분석 Worker가 중단되었습니다.'));
    };
    worker.onmessageerror = () => {
      finish();
      reject(new Error('오디오 분석 Worker 결과를 브라우저가 읽지 못했습니다.'));
    };

    try {
      // Transferable: the worker takes ownership of the buffer, no copy.
      worker.postMessage({ type, samples, sampleRate, fileName }, [samples.buffer]);
    } catch (error) {
      finish();
      reject(new Error(`오디오 데이터를 Worker로 전달하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`));
    }
  });
}

export async function analyzeAudioFileResponsive(file: File): Promise<SongAudioMetrics> {
  const mono = await decodeToMonoPcm(file);
  if (typeof Worker === 'undefined') return analyzePcmData(mono, ANALYSIS_SAMPLE_RATE, file.name);
  const response = await runOnWorker<{ type: 'analyze'; ok: true; metrics: SongAudioMetrics }>(mono, ANALYSIS_SAMPLE_RATE, file.name, 'analyze');
  return response.metrics;
}

export async function analyzeFullAudioFileResponsive(file: File): Promise<FullAudioAnalysis> {
  const mono = await decodeToMonoPcm(file);
  if (typeof Worker === 'undefined') return analyzeFullPcmData(mono, ANALYSIS_SAMPLE_RATE, file.name);
  const response = await runOnWorker<{ type: 'analyzeFull'; ok: true; result: FullAudioAnalysis }>(mono, ANALYSIS_SAMPLE_RATE, file.name, 'analyzeFull');
  return response.result;
}
