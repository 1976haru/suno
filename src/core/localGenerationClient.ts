import LocalGenerationWorker from '../workers/localGenerationWorker?worker';
import { generateLocalBlueprint } from './localGenerator';
import { scoreSongs } from './quality';
import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, SeasonPack } from '../types';

interface LocalGenerationWorkerResponse {
  ok: boolean;
  blueprint?: PlaylistBlueprint;
  error?: string;
}

function generateSynchronously(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  avoid?: { usedTitles?: string[]; usedHooks?: string[] },
  promptCharLimit?: number
): PlaylistBlueprint {
  const blueprint = generateLocalBlueprint(opts, genres, moods, season, avoid, promptCharLimit);
  const songs = scoreSongs(blueprint.songs, opts.channel, opts.lyricLanguage);
  return { ...blueprint, songs };
}

/**
 * Browser UI path for local generation.
 *
 * The browser must never fall back to the synchronous generator: that fallback
 * was effectively the old freeze bug whenever module-worker construction was
 * blocked by a stale dev bundle, extension, or browser policy. Vite's ?worker
 * constructor makes the worker bundle explicit and reliable. The synchronous
 * path remains only for Node/Vitest, where Worker is unavailable by design.
 */
export async function generateLocalBlueprintResponsive(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  avoid?: { usedTitles?: string[]; usedHooks?: string[] },
  promptCharLimit?: number
): Promise<PlaylistBlueprint> {
  if (typeof Worker === 'undefined') {
    return generateSynchronously(opts, genres, moods, season, avoid, promptCharLimit);
  }

  let worker: Worker;
  try {
    worker = new LocalGenerationWorker();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`로컬 생성 Worker를 시작하지 못했습니다: ${detail}. 브라우저 탭을 모두 닫고 개발 서버를 다시 시작하세요.`);
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error('로컬 생성 시간이 120초를 넘겨 중단했습니다. 브라우저의 사이트 데이터를 초기화한 뒤 다시 시도하세요.'));
    }, 120_000);

    const finish = () => {
      window.clearTimeout(timeout);
      worker.terminate();
    };

    worker.onmessage = event => {
      const response = event.data as LocalGenerationWorkerResponse;
      finish();
      if (response.ok && response.blueprint) {
        resolve(response.blueprint);
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
      worker.postMessage({ opts, genres, moods, season, avoid, promptCharLimit });
    } catch (error) {
      finish();
      reject(new Error(`로컬 생성 데이터를 Worker로 전달하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`));
    }
  });
}
