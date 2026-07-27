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
 * Browser UI path for local generation. The old implementation ran the full
 * lyric/title/prompt pipeline synchronously inside the React click handler,
 * so a large hook history or pack could trigger Chrome's "page unresponsive"
 * dialog. Vite bundles this module worker separately; Node/tests keep the pure
 * synchronous fallback because Worker is unavailable there.
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
    worker = new Worker(new URL('../workers/localGenerationWorker.ts', import.meta.url), { type: 'module' });
  } catch {
    return generateSynchronously(opts, genres, moods, season, avoid, promptCharLimit);
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error('로컬 생성 시간이 너무 오래 걸려 중단했습니다. 다른 탭을 닫고 다시 시도하세요.'));
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
    worker.postMessage({ opts, genres, moods, season, avoid, promptCharLimit });
  });
}
