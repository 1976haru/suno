import LocalGenerationWorker from '../workers/localGenerationWorker?worker';
import { generateLocalBlueprint } from './localGenerator';
import { scoreSongs } from './quality';
import { runFullAudit } from './fullAudit';
import type { FullAuditReport } from './fullAudit';
import { evaluateDesignGate } from './designGate';
import type { DesignGateResult } from './designGate';
import { evaluateGenerationGate } from './generationGate';
import type { GenerationGateResult } from './generationGate';
import type { AudienceProfile, GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, PreassignedSongSlot, SeasonPack, SongIdea } from '../types';
import type { AudioSetReport } from './audioSetReport';
import type { ResolvedConstraints } from './constraints';
import type { VocalType, VocalQuota } from './vocalPlan';
import type { VerifiedCombo } from '../data/verifiedCombos';
import type { ScoreCompositionOptions } from './compositionScorer';

type Avoid = { usedTitles?: string[]; usedHooks?: string[]; recentVocalComboSignatures?: string[]; previousFlagshipOrder?: VocalType[]; verifiedCombos?: VerifiedCombo[] };

/**
 * v4.0 (TASK A) — browser UI path for the local-generation pipeline (blueprint
 * generation, scoring, the 49-item audit, the design gate). Ported from
 * main's localGenerationClient.ts (see that file's own doc comment on why
 * the browser must never fall back to a synchronous call: that fallback WAS
 * the freeze bug whenever module-worker construction was blocked). The
 * `typeof Worker === 'undefined'` branch below is NOT that fallback — it
 * only fires in Node/Vitest, which structurally has no Worker global; a
 * real browser always takes the worker path, and any worker
 * construction/runtime failure there throws instead of degrading.
 */

const WORKER_TIMEOUT_MS = 120_000;

function runOnWorker<TResponse>(
  request: Record<string, unknown> & { type: string },
  responseType: TResponse extends { type: infer T } ? T : never,
  timeoutMessage: string
): Promise<TResponse> {
  let worker: Worker;
  try {
    worker = new LocalGenerationWorker();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`로컬 생성 Worker를 시작하지 못했습니다: ${detail}. 브라우저 탭을 모두 닫고 개발 서버를 다시 시작하세요. 문제가 계속되면 /?repair=1 로 접속해 복구 모드를 사용하세요.`);
  }

  return new Promise<TResponse>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error(`${timeoutMessage} 브라우저의 사이트 데이터를 초기화하거나 /?repair=1 로 접속해 복구 모드를 사용하세요.`));
    }, WORKER_TIMEOUT_MS);

    const finish = () => {
      window.clearTimeout(timeout);
      worker.terminate();
    };

    worker.onmessage = event => {
      const response = event.data as { type: string; ok: boolean; error?: string };
      finish();
      if (response.ok && response.type === responseType) {
        resolve(response as unknown as TResponse);
      } else {
        reject(new Error(response.error || '로컬 생성 Worker가 결과를 반환하지 못했습니다.'));
      }
    };
    worker.onerror = event => {
      finish();
      reject(new Error(event.message || '로컬 생성 Worker가 중단되었습니다.'));
    };
    worker.onmessageerror = () => {
      finish();
      reject(new Error('로컬 생성 Worker 결과를 브라우저가 읽지 못했습니다.'));
    };

    try {
      worker.postMessage(request);
    } catch (error) {
      finish();
      reject(new Error(`데이터를 Worker로 전달하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`));
    }
  });
}

export async function generateLocalBlueprintResponsive(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  avoid?: Avoid,
  promptCharLimit?: number
): Promise<PlaylistBlueprint> {
  if (typeof Worker === 'undefined') {
    const blueprint = generateLocalBlueprint(opts, genres, moods, season, avoid, promptCharLimit);
    const songs = scoreSongs(blueprint.songs, opts.channel, opts.lyricLanguage);
    return { ...blueprint, songs };
  }
  const response = await runOnWorker<{ type: 'generate'; ok: true; blueprint: PlaylistBlueprint }>(
    { type: 'generate', opts, genres, moods, season, avoid, promptCharLimit },
    'generate',
    '로컬 생성 시간이 120초를 넘겨 중단했습니다.'
  );
  return response.blueprint;
}

export async function runFullAuditResponsive(
  songs: SongIdea[],
  opts: { conceptLabel: string; songCount: number; audienceProfile: AudienceProfile; audioReport?: AudioSetReport; vocalQuotaOverride?: VocalQuota }
): Promise<FullAuditReport> {
  if (typeof Worker === 'undefined') return runFullAudit(songs, opts);
  const response = await runOnWorker<{ type: 'fullAudit'; ok: true; report: FullAuditReport }>(
    { type: 'fullAudit', songs, opts },
    'fullAudit',
    '전체 감사 시간이 120초를 넘겨 중단했습니다.'
  );
  return response.report;
}

export async function evaluateDesignGateResponsive(
  slots: PreassignedSongSlot[],
  constraints: ResolvedConstraints,
  opts: GenerationOptions
): Promise<DesignGateResult> {
  if (typeof Worker === 'undefined') return evaluateDesignGate(slots, constraints, opts);
  const response = await runOnWorker<{ type: 'designGate'; ok: true; result: DesignGateResult }>(
    { type: 'designGate', slots, constraints, opts },
    'designGate',
    '설계 관문 평가 시간이 120초를 넘겨 중단했습니다.'
  );
  return response.result;
}

/** v4.1 (TASK C) — closes the one gap left over from v4.0's own worker migration: evaluateGenerationGate ("관문 2") was still running synchronously in Step4Result.tsx's own useMemo. */
export async function evaluateGenerationGateResponsive(
  songs: SongIdea[],
  opts: ScoreCompositionOptions & { conceptLabel?: string }
): Promise<GenerationGateResult> {
  if (typeof Worker === 'undefined') return evaluateGenerationGate(songs, opts);
  const response = await runOnWorker<{ type: 'generationGate'; ok: true; result: GenerationGateResult }>(
    { type: 'generationGate', songs, opts },
    'generationGate',
    '생성 검증(관문 2) 시간이 120초를 넘겨 중단했습니다.'
  );
  return response.result;
}
