import type { BatchRequestSpec } from '../providers/batchAnthropic';
import type { PlaylistBlueprint } from '../types';

const DB_NAME = 'suno-weaver-batch';
const DB_VERSION = 1;
const STORE = 'jobs';

/**
 * TASK E2 (v3.5) — a batch job can take minutes to ~24 hours (Anthropic
 * gives no hard SLA shorter than that), so it must survive the browser
 * being closed and reopened. This is the persistence layer; polling logic
 * lives in hooks/useBatchGenerationFlow.ts.
 */
export type BatchJobStatus = 'submitting' | 'in_progress' | 'ended' | 'failed' | 'canceled';

export interface BatchJobRecord {
  id: string;
  channelId: string;
  projectTitle: string;
  createdAt: string;
  status: BatchJobStatus;
  anthropicBatchId?: string;
  requests: BatchRequestSpec[];
  totalSongCount: number;
  errorMessage?: string;
  resultBlueprint?: PlaylistBlueprint;
  failedBatchIndexes?: number[];
  lastPolledAt?: string;
  /** Set on a job created by retryFailed() to resubmit only the sub-batches that errored in a parent job. */
  parentJobId?: string;
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

function randomId() {
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createBatchJob(input: {
  channelId: string;
  projectTitle: string;
  totalSongCount: number;
  requests: BatchRequestSpec[];
}): Promise<BatchJobRecord> {
  const record: BatchJobRecord = {
    id: randomId(),
    channelId: input.channelId,
    projectTitle: input.projectTitle,
    createdAt: new Date().toISOString(),
    status: 'submitting',
    requests: input.requests,
    totalSongCount: input.totalSongCount
  };
  await withStore('readwrite', store => store.put(record));
  return record;
}

export async function updateBatchJob(id: string, patch: Partial<BatchJobRecord>): Promise<BatchJobRecord | undefined> {
  const existing = await getBatchJob(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  await withStore('readwrite', store => store.put(updated));
  return updated;
}

export async function getBatchJob(id: string): Promise<BatchJobRecord | undefined> {
  return withStore<BatchJobRecord | undefined>('readonly', store => store.get(id));
}

export async function listBatchJobs(channelId: string): Promise<BatchJobRecord[]> {
  const all = await withStore<BatchJobRecord[]>('readonly', store => store.getAll());
  return all.filter(job => job.channelId === channelId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Jobs still worth polling on app reopen. */
export async function listActiveBatchJobs(channelId: string): Promise<BatchJobRecord[]> {
  const jobs = await listBatchJobs(channelId);
  return jobs.filter(job => job.status === 'submitting' || job.status === 'in_progress');
}

export async function deleteBatchJob(id: string): Promise<void> {
  await withStore('readwrite', store => store.delete(id));
}
