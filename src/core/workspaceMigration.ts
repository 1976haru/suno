import { migrateLibraryWorkspaceTags, migrateLibrarySnapshotSecrets, exportAllPacks } from './library';
import { migrateHookLedgerWorkspaceTags } from './hookLedger';
import { migrateSituationLedgerWorkspaceTags } from './situationLedger';
import { migrateLyricLineLedgerWorkspaceTags } from './lyricLineLedger';
import { migrateRatingLedgerWorkspaceTags } from './ratingLedger';
import { migrateVideoLedgerWorkspaceTags } from './videoLedger';
import { migrateUsageLedgerWorkspaceTags } from './usageLedger';
import { migrateBatchJobsWorkspaceTags } from './batchJobs';
import { migrateAudioTakesWorkspaceTags } from './audioTakes';
import { migrateReleaseReadinessArchiveWorkspaceTags } from './releaseReadinessArchive';
import { DEFAULT_WORKSPACE_ID } from './workspaceScope';

/**
 * v4.0 (TASK A1) — the one-time, app-startup migration this task's §4
 * requires. Two independent jobs, matched to the two storage patterns this
 * task introduced (see workspaceScope.ts's own doc comment):
 *
 *  - Pattern-A IndexedDB stores (packs/hooks/ratings/videos/usage/batch/
 *    audio takes): tagging is technically optional for correctness today —
 *    scopeFilter() already treats an untagged record as 'senior-oldpop' — but
 *    this task's own §4 explicitly asks for it, and leaving records
 *    permanently untagged would make "저장소별 분리 확인" (§8-4) unverifiable
 *    and would leave deleteAllPacks-style bulk operations relying on a
 *    fallback forever instead of real data.
 *  - Pattern-B localStorage/settings keys (custom channels, recent genres,
 *    the kids-banner-dismissed flag, diversity/thumbnail-brand templates):
 *    tagging is NOT optional here — scopedKey() produces a genuinely
 *    different physical key, so without an explicit copy, pre-v4.0 data at
 *    the old unscoped key would be invisible to every workspace, including
 *    senior-oldpop. This is the part of the migration that actually matters.
 *
 * §4's own explicit safety rules are followed throughout:
 *  - never deletes the original — Pattern A only adds a field to existing
 *    records (never removes rows); Pattern B copies to a NEW key, the old
 *    key is left untouched.
 *  - a failure in one store must not abort the rest, and must never crash
 *    the app — each step is individually wrapped in try/catch.
 */

const MIGRATION_DONE_KEY = 'suno-weaver-workspace-migration-v1-done';

/** Pre-v4.0 localStorage keys that need a 'senior-oldpop::'-prefixed copy — see this task's own §1-2/§3-2 inventory. Custom channels use a different literal constant than its own doc description ("suno-weaver-custom-channels-v2", from utils/channelProfile.ts) — included here by its real name, not the spec's shorthand. */
const LEGACY_LOCAL_STORAGE_KEYS = [
  'diversityAllocationChannels',
  'thumbnailBrandChannels',
  'suno-weaver-recent-genres-v1',
  'kidsChannelBannerDismissed',
  'suno-weaver-custom-channels-v2'
] as const;

export interface StoreMigrationResult {
  store: string;
  totalRecords: number;
  taggedSeniorOldpop: number;
  error?: string;
}

export interface LocalStorageMigrationResult {
  key: string;
  copied: boolean;
  reason: 'copied' | 'no-legacy-value' | 'already-migrated' | 'no-localStorage' | 'error';
}

export interface WorkspaceMigrationReport {
  alreadyDone: boolean;
  stores: StoreMigrationResult[];
  localStorageKeys: LocalStorageMigrationResult[];
}

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

/**
 * codex 지시문 07 (TASK F) — `onStoreDone` is the real progress-reporting
 * gap investigation confirmed absent from every migration in this app —
 * fires once per store as it finishes (success OR error, since a failed
 * store still represents "one more step done" for a progress bar), in
 * whatever order the real, still-parallel Promise.all below resolves them.
 * Optional so every existing caller (none passed one before this task)
 * keeps working unchanged.
 */
async function migrateStore(
  store: string,
  fn: () => Promise<{ totalRecords: number; taggedSeniorOldpop: number }>,
  onStoreDone?: (result: StoreMigrationResult) => void
): Promise<StoreMigrationResult> {
  try {
    const result = await fn();
    const done = { store, ...result };
    onStoreDone?.(done);
    return done;
  } catch (err) {
    // A single store's migration failing must never stop the others, and
    // must never surface as an app crash (this task's own §4 안전장치).
    const failed = { store, totalRecords: 0, taggedSeniorOldpop: 0, error: err instanceof Error ? err.message : String(err) };
    onStoreDone?.(failed);
    return failed;
  }
}

function migrateLocalStorageKey(key: string): LocalStorageMigrationResult {
  if (!hasLocalStorage()) return { key, copied: false, reason: 'no-localStorage' };
  try {
    const scopedKeyName = `${DEFAULT_WORKSPACE_ID}::${key}`;
    if (window.localStorage.getItem(scopedKeyName) !== null) {
      return { key, copied: false, reason: 'already-migrated' };
    }
    const legacyValue = window.localStorage.getItem(key);
    if (legacyValue === null) return { key, copied: false, reason: 'no-legacy-value' };
    window.localStorage.setItem(scopedKeyName, legacyValue); // copy only — the original key is left in place, untouched
    return { key, copied: true, reason: 'copied' };
  } catch {
    return { key, copied: false, reason: 'error' };
  }
}

/**
 * v4.1 (TASK A2, §4-3) — lets the caller show "먼저 백업을 저장해 주세요" BEFORE
 * actually running the migration, without triggering it as a side effect of
 * just checking. `runWorkspaceMigrationOnce()` itself still checks the same
 * flag internally, so calling it after this always behaves correctly even
 * if the caller never checks first.
 */
export function isMigrationPending(): boolean {
  return !hasLocalStorage() || window.localStorage.getItem(MIGRATION_DONE_KEY) !== 'true';
}

/** Real store list — one place both the count-based progress denominator and the actual Promise.all below read from, so they can never drift apart. */
const MIGRATED_STORES: { name: string; migrate: () => Promise<{ totalRecords: number; taggedSeniorOldpop: number }> }[] = [
  { name: 'suno-weaver-library (packs)', migrate: migrateLibraryWorkspaceTags },
  { name: 'suno-weaver-hooks', migrate: migrateHookLedgerWorkspaceTags },
  // v5.22 (AXIS 1) — new stores, same migration contract as every other
  // Pattern-A IndexedDB store here (additive-only, idempotent).
  { name: 'suno-weaver-situations', migrate: migrateSituationLedgerWorkspaceTags },
  { name: 'suno-weaver-lyric-lines', migrate: migrateLyricLineLedgerWorkspaceTags },
  { name: 'suno-weaver-ratings', migrate: migrateRatingLedgerWorkspaceTags },
  { name: 'suno-weaver-videos', migrate: migrateVideoLedgerWorkspaceTags },
  { name: 'suno-weaver-usage', migrate: migrateUsageLedgerWorkspaceTags },
  { name: 'suno-weaver-batch', migrate: migrateBatchJobsWorkspaceTags },
  { name: 'suno-weaver-audio (takes)', migrate: migrateAudioTakesWorkspaceTags },
  // codex 지시문 07 (TASK F) — the one real gap investigation found: the only
  // optional-workspaceId Pattern-A store with no migration function at all.
  { name: 'suno-weaver-release-readiness', migrate: migrateReleaseReadinessArchiveWorkspaceTags }
];

/**
 * codex 지시문 07 (TASK F) — real migration-progress reporting: `onProgress`
 * fires once per store as it completes, `{ done, total }` — the total is
 * MIGRATED_STORES.length + LEGACY_LOCAL_STORAGE_KEYS.length (both real
 * counts, not an estimate), so a caller can render a real "N/M 완료" bar.
 * Optional — omitted, this behaves byte-identical to before this task.
 *
 * combo-variation/generation-reservation ledgers are deliberately NOT in
 * MIGRATED_STORES: both real record types have `workspaceId` as a
 * REQUIRED (never optional) field, always stamped at write time since
 * those modules were created — confirmed by direct read, there was never
 * an untagged period for either, so a backfill migration would be a
 * structural no-op. "motif" has no store of its own (data/motifFamilies.ts
 * cooldown checks derive everything from situationLedger's own
 * SceneSignature/frameId records — migrateSituationLedgerWorkspaceTags
 * above already covers it).
 *
 * Runs once per browser profile (guarded by MIGRATION_DONE_KEY). Safe to
 * call on every app start — after the first successful run it's an
 * immediate no-op. Never throws: a mid-migration failure is reported in the
 * returned object, not thrown, so a broken store can never block the app
 * from loading (this task's own "마이그레이션 실패 시 앱이 멈추지 말고 경고만
 * 띄우십시오").
 */
export async function runWorkspaceMigrationOnce(onProgress?: (done: number, total: number) => void): Promise<WorkspaceMigrationReport> {
  if (hasLocalStorage() && window.localStorage.getItem(MIGRATION_DONE_KEY) === 'true') {
    return { alreadyDone: true, stores: [], localStorageKeys: [] };
  }

  const total = MIGRATED_STORES.length + LEGACY_LOCAL_STORAGE_KEYS.length;
  let done = 0;
  const reportProgress = () => {
    done += 1;
    onProgress?.(done, total);
  };

  const stores = await Promise.all(MIGRATED_STORES.map(({ name, migrate }) => migrateStore(name, migrate, reportProgress)));

  const localStorageKeys = LEGACY_LOCAL_STORAGE_KEYS.map(key => {
    const result = migrateLocalStorageKey(key);
    reportProgress();
    return result;
  });

  if (hasLocalStorage()) {
    try {
      window.localStorage.setItem(MIGRATION_DONE_KEY, 'true');
    } catch {
      // If we can't even persist the done-flag, migration will simply run
      // again next launch — harmless, since every step above is idempotent.
    }
  }

  return { alreadyDone: false, stores, localStorageKeys };
}

/**
 * §4 안전장치 — "마이그레이션 전에 전체 백업을 JSON으로 내보낼 수 있게 하십시오".
 * A minimal backup of every pack in suno-weaver-library (the store TASK C
 * explicitly calls out as the one that must never lose data). Meant to be
 * called BEFORE runWorkspaceMigrationOnce() / before the user ever switches
 * workspaces: exportAllPacks() is itself workspace-scoped (current
 * workspace only), but pre-migration every real pack is implicitly
 * 'senior-oldpop' (scopeFilter's own default), so calling this at the
 * default, never-yet-switched workspace captures everything. Deliberately
 * not a full multi-store/multi-key export — A2's own document is where a
 * proper workspace-aware export/import format belongs; this exists only so
 * a user can protect themselves right before the one operation this task
 * performs automatically on their behalf.
 */
export async function exportPreMigrationBackup(): Promise<Blob> {
  return exportAllPacks();
}

const SNAPSHOT_SECRET_MIGRATION_DONE_KEY = 'suno-weaver-snapshot-secret-migration-v1-done';

export interface SnapshotSecretMigrationReport {
  alreadyDone: boolean;
  totalRecords: number;
  scrubbed: number;
  error?: string;
}

/**
 * v5.17 (TASK A §1-3 item 1) — the "앱 시작 시 1회 마이그레이션" this task's
 * spec requires, cleaning up packs saved before generationSnapshot.provider
 * was narrowed to the credential-free SnapshotProviderInfo. Deliberately its
 * OWN done-flag rather than reusing MIGRATION_DONE_KEY above: that flag is
 * already 'true' for any browser profile that ran the v4.0 workspace-tag
 * migration, which would silently skip this fix for exactly the users who
 * most need it (anyone with existing saved packs). Never gated behind the
 * v4.0 backup prompt (see runWorkspaceMigrationOnce's own doc comment) —
 * stripping a secret is a safety improvement, not data loss.
 */
export async function runSnapshotSecretMigrationOnce(): Promise<SnapshotSecretMigrationReport> {
  if (hasLocalStorage() && window.localStorage.getItem(SNAPSHOT_SECRET_MIGRATION_DONE_KEY) === 'true') {
    return { alreadyDone: true, totalRecords: 0, scrubbed: 0 };
  }
  try {
    const { totalRecords, scrubbed } = await migrateLibrarySnapshotSecrets();
    if (hasLocalStorage()) {
      try {
        window.localStorage.setItem(SNAPSHOT_SECRET_MIGRATION_DONE_KEY, 'true');
      } catch {
        // Same tolerance as runWorkspaceMigrationOnce: worst case this simply reruns (harmlessly) next launch.
      }
    }
    return { alreadyDone: false, totalRecords, scrubbed };
  } catch (err) {
    // Same "never blocks the app" rule as migrateStore above.
    return { alreadyDone: false, totalRecords: 0, scrubbed: 0, error: err instanceof Error ? err.message : String(err) };
  }
}
