import BackupParseWorker from '../workers/backupParseWorker?worker';
import { savePack } from './library';
import type { SavedPack } from '../types';

function isImportablePack(value: unknown): value is SavedPack {
  if (!value || typeof value !== 'object') return false;
  const pack = value as Partial<SavedPack>;
  return Boolean(pack.blueprint && pack.options);
}

async function saveImportedPack(value: unknown): Promise<boolean> {
  if (!isImportablePack(value)) return false;
  await savePack({
    blueprint: value.blueprint,
    options: value.options,
    name: typeof value.name === 'string' && value.name ? value.name : undefined,
    isAutosave: Boolean(value.isAutosave),
    id: typeof value.id === 'string' && value.id ? value.id : undefined,
    evaluation: value.evaluation,
    thumbnailSpec: value.thumbnailSpec
  });
  return true;
}

/**
 * Reads and parses the File inside a dedicated worker. Passing the File object
 * avoids file.text() plus a second full-string structured clone on the UI
 * thread, which was enough to make Chrome report an unresponsive page for
 * large backups. Packs are handed back one at a time and persisted before the
 * worker sends the next one, keeping peak memory bounded.
 */
export async function importPacksResponsive(file: File): Promise<number> {
  if (typeof Worker === 'undefined') {
    throw new Error('이 브라우저에서는 안전한 백업 불러오기를 지원하지 않습니다. 최신 Chrome 또는 Edge를 사용하세요.');
  }

  let worker: Worker;
  try {
    worker = new BackupParseWorker();
  } catch (error) {
    throw new Error(`백업 처리 Worker를 시작하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`);
  }

  return new Promise((resolve, reject) => {
    let count = 0;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      if (error) reject(error);
      else resolve(count);
    };

    worker.onmessage = event => {
      const data = event.data as { type?: string; value?: unknown; message?: string };
      if (data.type === 'ready') return;
      if (data.type === 'error') {
        finish(new Error(data.message || '백업 파일을 읽지 못했습니다.'));
        return;
      }
      if (data.type === 'done') {
        finish();
        return;
      }
      if (data.type !== 'pack') return;

      void (async () => {
        try {
          if (await saveImportedPack(data.value)) count += 1;
          await new Promise<void>(resolveYield => setTimeout(resolveYield, 0));
          worker.postMessage({ type: 'next' });
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      })();
    };

    worker.onerror = event => finish(new Error(event.message || '백업 처리 Worker가 중단되었습니다.'));
    worker.onmessageerror = () => finish(new Error('백업 처리 Worker 결과를 브라우저가 읽지 못했습니다.'));

    try {
      worker.postMessage({ type: 'start', file });
    } catch (error) {
      finish(new Error(`백업 파일을 Worker로 전달하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`));
    }
  });
}
