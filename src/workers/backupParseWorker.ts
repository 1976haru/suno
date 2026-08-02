/**
 * v4.0 (TASK A) — moves the JSON.parse of a workspace backup file off the
 * main thread. Ported from main's backupParseWorker.ts, but adapted to this
 * branch's actual backup format: main's version streamed a flat SavedPack[]
 * array one pack at a time (its own simpler "export all packs" feature, see
 * docs/v400-report.md item 1); this branch's core/workspaceTransfer.ts
 * exports one cohesive WorkspaceExportFile/WorkspaceBundleFile JSON document
 * instead (packs + hooks + ratings + takes + videos + settings all in one
 * object), so there is no natural per-pack streaming point — the one real
 * blocking step is `file.text()` + `JSON.parse()` on however large that
 * single document is. Both run here; the caller (workspaceTransfer.ts's
 * parseTransferFile) still does its own format/version validation and all
 * IndexedDB writes on the main thread exactly as before, unchanged.
 */

interface ParseRequest {
  type: 'parse';
  file: File;
}

type BackupParseWorkerResponse =
  | { type: 'parsed'; ok: true; value: unknown }
  | { type: 'parsed'; ok: false; error: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<ParseRequest>) => void) | null;
  postMessage: (message: BackupParseWorkerResponse) => void;
};

workerScope.onmessage = event => {
  void (async () => {
    try {
      const text = await event.data.file.text();
      const value: unknown = JSON.parse(text);
      workerScope.postMessage({ type: 'parsed', ok: true, value });
    } catch (error) {
      workerScope.postMessage({
        type: 'parsed',
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  })();
};

export {};
