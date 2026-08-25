import type { WorkspaceId } from '../types';

/**
 * v4.0 (TASK A1) — the single point every storage module goes through to
 * find out "which workspace am I reading/writing for" (this task's own §3-4
 * "각 저장소 모듈에 직접 workspaceId를 뿌리지 말고 한 곳을 거치게 하십시오").
 * If the scoping rule ever changes, this is the only file that needs to.
 *
 * Two independent patterns live here, matched to two different storage
 * shapes actually present in this codebase:
 *  - scopeFilter() — for per-record IndexedDB stores (many independent
 *    put()-able records, e.g. saved packs, ratings). Tag each record with
 *    workspaceId, filter an already-fetched array with this.
 *  - scopedKey() — for whole-blob key-value storage (one value under one
 *    fixed key, e.g. the custom-channels array, a settings record). Filtering
 *    a shared blob and writing the filtered subset back would silently
 *    delete every OTHER workspace's data the next time that key is
 *    overwritten — prefixing the key itself into a separate slot per
 *    workspace avoids that class of bug entirely.
 */

const CURRENT_WORKSPACE_STORAGE_KEY = 'suno-weaver-current-workspace';

/** Records saved before this task existed have no workspaceId at all; the migration (core/workspaceMigration.ts) tags them 'senior-oldpop', and this same default covers anything the migration hasn't reached yet (e.g. a record written mid-migration). */
export const DEFAULT_WORKSPACE_ID: WorkspaceId = 'senior-oldpop';

let cachedWorkspaceId: WorkspaceId | null = null;

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export function currentWorkspaceId(): WorkspaceId {
  if (cachedWorkspaceId) return cachedWorkspaceId;
  if (hasLocalStorage()) {
    const stored = window.localStorage.getItem(CURRENT_WORKSPACE_STORAGE_KEY) as WorkspaceId | null;
    if (stored) {
      cachedWorkspaceId = stored;
      return stored;
    }
  }
  return DEFAULT_WORKSPACE_ID;
}

export function setCurrentWorkspace(id: WorkspaceId): void {
  cachedWorkspaceId = id;
  if (hasLocalStorage()) {
    try {
      window.localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, id);
    } catch {
      // Storage can be blocked in private/embedded contexts; the in-memory cache above still works for this session.
    }
  }
}

/**
 * For a whole-blob key-value entry (localStorage, or a settingsStore record)
 * — gives each workspace its own separate slot under the same logical key.
 * `forWorkspace` defaults to currentWorkspaceId(), same override pattern as
 * scopeFilter() below — v4.1 (TASK A2)'s cross-workspace export/import needs
 * to read/write a workspace that may not be the current one.
 */
export function scopedKey(key: string, forWorkspace: WorkspaceId = currentWorkspaceId()): string {
  return `${forWorkspace}::${key}`;
}

/**
 * For a per-record IndexedDB store — records with no workspaceId at all
 * (pre-migration, or a bug) are treated as DEFAULT_WORKSPACE_ID rather than
 * silently hidden, so nothing goes missing while migration is in flight.
 *
 * `forWorkspace` defaults to currentWorkspaceId() but can be passed
 * explicitly to read a DIFFERENT workspace's data without touching the
 * shared global — critical for anything that needs to peek at more than one
 * workspace in the same tick (e.g. the entry screen's per-card pack counts).
 * The earlier design (temporarily calling setCurrentWorkspace() then
 * restoring it) raced under React StrictMode's dev-only double-effect
 * invocation: two concurrent probes both mutating the same module-level
 * variable interleaved and attributed one workspace's records to another.
 * An explicit parameter has no shared mutable state to race on.
 */
/**
 * 지시문 14 (TASK C-3) — the constraint accepts the avoid-list ledgers' own
 * `WorkspaceId | 'unknown'` field shape (widened, not narrowed: every
 * existing strictly-WorkspaceId-typed record store, e.g. library.ts's own,
 * still satisfies this same constraint) so a record explicitly tagged
 * 'unknown' by a failed migration resolution compares unequal to every real
 * `forWorkspace` and is correctly excluded, never silently defaulted the way
 * a genuinely ABSENT workspaceId is.
 */
export function scopeFilter<T extends { workspaceId?: WorkspaceId | 'unknown' }>(items: readonly T[], forWorkspace: WorkspaceId = currentWorkspaceId()): T[] {
  return items.filter(item => (item.workspaceId ?? DEFAULT_WORKSPACE_ID) === forWorkspace);
}

/**
 * 지시문 14 (TASK C) — the avoid-list ledgers (situationLedger/hookLedger/
 * lyricLineLedger/promptFingerprintLedger) used to scope every "recent N
 * sets" read by channelId alone, so two channels sharing the same real
 * audience/theme pool (e.g. senior-oldpop's "oldpoplounge" and "굿모닝
 * 추억라디오") could never see each other's history — a fresh channel meant
 * a fresh scene-avoidance memory. `workspaceId` is now the default scope;
 * `channelId` stays a real option (never removed) for the diagnostic/display
 * call sites that genuinely want just one channel's own history (e.g.
 * SettingsModal's per-channel hook usage/forecast panel).
 */
export type LedgerScope = { workspaceId: WorkspaceId } | { channelId: string };

/** Shared predicate every avoid-list ledger's scoped read now filters through — see LedgerScope's own doc comment for why both branches are real, not a transitional shim. Constraint matches scopeFilter's own widened `WorkspaceId | 'unknown'` shape (see that function's own doc comment). */
export function matchesLedgerScope<T extends { workspaceId?: WorkspaceId | 'unknown'; channelId: string }>(record: T, scope: LedgerScope): boolean {
  return 'workspaceId' in scope
    ? (record.workspaceId ?? DEFAULT_WORKSPACE_ID) === scope.workspaceId
    : record.channelId === scope.channelId;
}

/** Test-only reset — the module-level cache would otherwise leak the workspace chosen by one test into the next. */
export function __resetWorkspaceScopeForTests(): void {
  cachedWorkspaceId = null;
  if (hasLocalStorage()) {
    try {
      window.localStorage.removeItem(CURRENT_WORKSPACE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
