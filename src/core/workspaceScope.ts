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

/** For a whole-blob key-value entry (localStorage, or a settingsStore record) — gives each workspace its own separate slot under the same logical key. */
export function scopedKey(key: string): string {
  return `${currentWorkspaceId()}::${key}`;
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
export function scopeFilter<T extends { workspaceId?: WorkspaceId }>(items: readonly T[], forWorkspace: WorkspaceId = currentWorkspaceId()): T[] {
  return items.filter(item => (item.workspaceId ?? DEFAULT_WORKSPACE_ID) === forWorkspace);
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
