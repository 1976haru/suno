import type { WorkspaceId } from '../types';
import { currentWorkspaceId, scopeFilter } from './workspaceScope';

/**
 * v5.22 (AXIS 4 §4-5) — "통과율 추이": records each set's own
 * ReleaseReadinessReport (core/releaseReadiness.ts) totals over time, so
 * "첫 생성 통과율 90%" (the task spec's own stated target) is a real,
 * checkable number instead of an impression. Same IndexedDB
 * store-per-module/workspace-scoped pattern as usageLedger.ts.
 */
const DB_NAME = 'suno-weaver-release-readiness';
const DB_VERSION = 1;
const STORE = 'archive';

export interface ReleaseReadinessArchiveRecord {
  /** `${workspaceId}::${setCode}` — one record per set, re-recording the same setCode overwrites (e.g. after a rewrite-loop pass improves the count). */
  id: string;
  setCode: string;
  recordedAt: string;
  totalCriteria: number;
  /** The FIRST measurement for this set — before any automatic rewrite (AXIS 5) ran. Never overwritten by a later re-measurement (see recordReleaseReadiness's own doc comment). */
  passedCriteriaFirstPass: number;
  /** The latest measurement — after however many rewrite-loop passes actually ran (0 if none). */
  passedCriteriaLatest: number;
  rewritePassesRun: number;
  workspaceId?: WorkspaceId;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
    tx.oncomplete = () => db.close();
  });
}

async function allRecords(): Promise<ReleaseReadinessArchiveRecord[]> {
  const all = await withStore<ReleaseReadinessArchiveRecord[]>('readonly', store => store.getAll());
  return scopeFilter(all);
}

/**
 * Records or updates one set's own readiness measurement. `isFirstPass`
 * tells this whether to also set passedCriteriaFirstPass (only ever set
 * once, on the very first measurement for a setCode) — a later rewrite-loop
 * re-measurement passes `isFirstPass: false` so the archive can still
 * answer "did the FIRST attempt clear the bar" (this task's own target
 * metric) even after rewrites improved the final result.
 */
export async function recordReleaseReadiness(
  setCode: string,
  report: { totalCriteria: number; passedCriteria: number },
  isFirstPass: boolean,
  rewritePassesRun = 0
): Promise<void> {
  const workspaceId = currentWorkspaceId();
  const id = `${workspaceId}::${setCode}`;
  const existing = await withStore<ReleaseReadinessArchiveRecord | undefined>('readonly', store => store.get(id));
  const record: ReleaseReadinessArchiveRecord = {
    id,
    setCode,
    recordedAt: new Date().toISOString(),
    totalCriteria: report.totalCriteria,
    passedCriteriaFirstPass: isFirstPass ? report.passedCriteria : (existing?.passedCriteriaFirstPass ?? report.passedCriteria),
    passedCriteriaLatest: report.passedCriteria,
    rewritePassesRun,
    workspaceId
  };
  await withStore('readwrite', store => store.put(record));
}

export interface ReleaseReadinessTrend {
  records: ReleaseReadinessArchiveRecord[];
  /** Share of sets whose FIRST-pass measurement already cleared totalCriteria — this task's own "첫 생성 통과율 90%" target metric. */
  firstPassCleanRate: number;
}

/** Pure — kept separate from the IndexedDB read (same pattern as hookLedger.ts's exhaustionStats). */
export function summarizeReleaseReadinessTrend(records: ReleaseReadinessArchiveRecord[]): ReleaseReadinessTrend {
  if (!records.length) return { records, firstPassCleanRate: 0 };
  const cleanFirstPass = records.filter(r => r.passedCriteriaFirstPass === r.totalCriteria).length;
  return { records, firstPassCleanRate: cleanFirstPass / records.length };
}

export async function listReleaseReadinessHistory(): Promise<ReleaseReadinessTrend> {
  const all = await allRecords();
  return summarizeReleaseReadinessTrend(all.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1)));
}
