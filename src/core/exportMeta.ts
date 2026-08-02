import { APP_VERSION, COMMIT_SHA } from './buildInfo';
import { currentWorkspaceId } from './workspaceScope';
import type { WorkspaceId } from '../types';

/**
 * v4.0 (TASK C) — every export this app produces (가사 JSON, 워크스페이스 백업,
 * CSV, 독립 수노모드 HTML, SRT zip manifest) previously carried, at best, its
 * own ad-hoc timestamp — nothing said which app version or IndexedDB schema
 * shape produced the file, so an old export re-imported into a newer app
 * (or vice versa) had no way to detect a mismatch before failing partway
 * through. One shared shape, used by every exporter, so a future format
 * change only needs a `schemaVersion` bump here to be enforceable
 * everywhere at once.
 *
 * `schemaVersion` starts at 1 for this task; a real per-store IndexedDB
 * schemaVersion (see core/workspaceTransfer.ts's own import-time check) is
 * the thing this number is meant to travel alongside, not a duplicate of
 * `exportFormatVersion` (which versions the FILE'S shape, e.g.
 * workspaceTransfer.ts's own TRANSFER_FORMAT_VERSION) or `appVersion`
 * (which versions the whole app).
 */
export const EXPORT_SCHEMA_VERSION = 1;
export const EXPORT_FORMAT_VERSION = 1;

export interface ExportMeta {
  appVersion: string;
  schemaVersion: number;
  commitSha: string;
  workspaceId: WorkspaceId;
  generatedAt: string;
  exportFormatVersion: number;
}

/** `generatedAt` defaults to "now" (export time) — callers with their own more meaningful timestamp (e.g. PlaylistBlueprint.generatedAt, a set's actual generation time) should pass it explicitly. */
export function buildExportMeta(generatedAt?: string, workspaceId: WorkspaceId = currentWorkspaceId()): ExportMeta {
  return {
    appVersion: APP_VERSION,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    commitSha: COMMIT_SHA,
    workspaceId,
    generatedAt: generatedAt ?? new Date().toISOString(),
    exportFormatVersion: EXPORT_FORMAT_VERSION
  };
}
