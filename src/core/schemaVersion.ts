import { getSetting, setSetting } from './settingsStore';
import { EXPORT_SCHEMA_VERSION } from './exportMeta';

/**
 * v4.0 (TASK C-4) — a single app-wide schema-version marker for this
 * browser's own IndexedDB data (distinct from core/workspaceTransfer.ts's
 * `schemaVersion` field, which travels with an EXPORTED file — this is the
 * marker for data that never left the browser). Deliberately NOT a per-
 * store rework (no changes to library.ts's/hookLedger.ts's own DB_VERSION,
 * object stores, or record shapes — see docs/v400-report.md's own
 * "명시적으로 하지 않는 것"): this task is integration/stabilization only, and
 * there is no real migration to perform yet at schema version 1. Stored via
 * settingsStore.ts (the one database repair mode never wipes — see
 * browserRecovery.ts — matching "손실돼도 되는 데이터가 아니다").
 *
 * Same version number as EXPORT_SCHEMA_VERSION by design: both start at 1
 * together and are meant to stay in lockstep going forward (a schema change
 * big enough to need an export-side migration is exactly the kind of
 * change that also needs this marker bumped).
 */
export const CURRENT_SCHEMA_VERSION = EXPORT_SCHEMA_VERSION;

const SCHEMA_VERSION_KEY = 'schemaVersion';

export type SchemaVersionCheck =
  | { status: 'ok' | 'migrated' }
  | { status: 'newer-than-app'; storedVersion: number };

/**
 * Call once at startup (see main.tsx). Reads whatever version this
 * browser's data was last stamped with:
 * - unset (never stamped, or pre-v4.0 data) or lower than current: stamps
 *   CURRENT_SCHEMA_VERSION and returns 'migrated' (a no-op migration today
 *   — nothing to actually transform at version 1 — but this is the real
 *   hook a future version bump would extend).
 * - equal: returns 'ok', no write.
 * - higher than this app's own CURRENT_SCHEMA_VERSION: this browser's data
 *   was written by a newer app version. Never auto-downgrades or deletes
 *   anything — just reports it so the UI can warn the user (spec's own
 *   "더 최신 앱에서 만든 파일입니다" pattern, applied to local data instead of
 *   an imported file).
 */
export async function ensureSchemaVersion(): Promise<SchemaVersionCheck> {
  const stored = await getSetting<number>(SCHEMA_VERSION_KEY);
  if (typeof stored === 'number' && stored > CURRENT_SCHEMA_VERSION) {
    return { status: 'newer-than-app', storedVersion: stored };
  }
  if (stored === CURRENT_SCHEMA_VERSION) {
    return { status: 'ok' };
  }
  await setSetting(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION);
  return { status: 'migrated' };
}
