import BackupParseWorker from '../workers/backupParseWorker?worker';

/**
 * v4.0 (TASK A) — browser UI path for parsing a workspace backup file (see
 * backupParseWorker.ts's own doc comment on why this branch's format needs
 * a different worker shape than main's). Same non-fallback-in-browser
 * contract as core/localGenerationClient.ts: a real browser always uses the
 * worker; the `typeof Worker === 'undefined'` branch only fires in
 * Node/Vitest (tests/workspaceTransfer.test.ts calls previewImport/
 * applyImport directly and must keep working without a Worker global).
 */
export async function parseJsonFileResponsive(file: File): Promise<unknown> {
  if (typeof Worker === 'undefined') {
    const text = await file.text();
    return JSON.parse(text);
  }

  let worker: Worker;
  try {
    worker = new BackupParseWorker();
  } catch (error) {
    throw new Error(`백업 처리 Worker를 시작하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`);
  }

  return new Promise<unknown>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error('백업 파일 처리 시간이 120초를 넘겨 중단했습니다.'));
    }, 120_000);

    const finish = () => {
      window.clearTimeout(timeout);
      worker.terminate();
    };

    worker.onmessage = event => {
      const response = event.data as { ok: boolean; value?: unknown; error?: string };
      finish();
      if (response.ok) resolve(response.value);
      else reject(new Error(response.error || '이 파일은 올바른 JSON이 아닙니다.'));
    };
    worker.onerror = event => {
      finish();
      reject(new Error(event.message || '백업 처리 Worker가 중단되었습니다.'));
    };
    worker.onmessageerror = () => {
      finish();
      reject(new Error('백업 처리 Worker 결과를 브라우저가 읽지 못했습니다.'));
    };

    try {
      worker.postMessage({ type: 'parse', file });
    } catch (error) {
      finish();
      reject(new Error(`백업 파일을 Worker로 전달하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`));
    }
  });
}
