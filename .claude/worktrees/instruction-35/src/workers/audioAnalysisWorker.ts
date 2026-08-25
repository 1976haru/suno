import { analyzeFullPcmData, analyzePcmData } from '../core/audioAnalysis';
import type { FullAudioAnalysis, SongAudioMetrics } from '../core/audioAnalysis';

/**
 * v4.0 (TASK A) — new (main has no equivalent). The hand-rolled radix-2 FFT
 * in core/audioAnalysis.ts (see that file's own doc comment) is pure CPU
 * work that this task's own spec explicitly calls out as a freeze risk on
 * an 18-song pack's worth of takes. `AudioContext`/`OfflineAudioContext`
 * don't exist in a Worker, so decoding stays on the main thread
 * (core/audioAnalysisClient.ts's decodeToMonoPcm re-export) — only the FFT/
 * DSP pass on the already-decoded PCM moves here. The "one file at a time,
 * never Promise.all" contract audioAnalysis.ts's own doc comment requires
 * is unaffected: the client still awaits one file's worker round trip
 * before starting the next.
 */

interface AnalyzeRequest {
  type: 'analyze';
  samples: Float32Array;
  sampleRate: number;
  fileName: string;
}

interface AnalyzeFullRequest {
  type: 'analyzeFull';
  samples: Float32Array;
  sampleRate: number;
  fileName: string;
}

type AudioAnalysisWorkerRequest = AnalyzeRequest | AnalyzeFullRequest;

type AudioAnalysisWorkerResponse =
  | { type: 'analyze'; ok: true; metrics: SongAudioMetrics }
  | { type: 'analyzeFull'; ok: true; result: FullAudioAnalysis }
  | { type: AudioAnalysisWorkerRequest['type']; ok: false; error: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<AudioAnalysisWorkerRequest>) => void) | null;
  postMessage: (message: AudioAnalysisWorkerResponse) => void;
};

workerScope.onmessage = event => {
  const request = event.data;
  try {
    if (request.type === 'analyze') {
      const metrics = analyzePcmData(request.samples, request.sampleRate, request.fileName);
      workerScope.postMessage({ type: 'analyze', ok: true, metrics });
      return;
    }
    if (request.type === 'analyzeFull') {
      const result = analyzeFullPcmData(request.samples, request.sampleRate, request.fileName);
      workerScope.postMessage({ type: 'analyzeFull', ok: true, result });
      return;
    }
  } catch (error) {
    workerScope.postMessage({
      type: request.type,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export {};
