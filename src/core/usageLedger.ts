const DB_NAME = 'suno-weaver-usage';
const DB_VERSION = 1;
const STORE = 'usage';

export interface UsageRecord {
  at: string;
  provider: string;
  model: string;
  purpose: 'generate' | 'refine' | 'evaluate';
  inputTokens: number;
  outputTokens: number;
  cacheHit: boolean;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'at' });
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

/** Ensures two records recorded in the same millisecond don't collide on the `at` key. */
function uniqueTimestamp(): string {
  return `${new Date().toISOString()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function recordUsage(record: Omit<UsageRecord, 'at'> & { at?: string }): Promise<void> {
  const full: UsageRecord = { ...record, at: record.at || uniqueTimestamp() };
  await withStore('readwrite', store => store.put(full));
}

export interface UsageSummary {
  totalCalls: number;
  totalInput: number;
  totalOutput: number;
  cacheHits: number;
  byPurpose: Record<string, number>;
}

/** Pure aggregation, kept separate from the IndexedDB read so it's testable without a browser. */
export function summarizeUsage(records: UsageRecord[]): UsageSummary {
  const summary: UsageSummary = { totalCalls: 0, totalInput: 0, totalOutput: 0, cacheHits: 0, byPurpose: {} };
  for (const record of records) {
    summary.totalCalls += 1;
    summary.totalInput += record.inputTokens;
    summary.totalOutput += record.outputTokens;
    if (record.cacheHit) summary.cacheHits += 1;
    summary.byPurpose[record.purpose] = (summary.byPurpose[record.purpose] || 0) + 1;
  }
  return summary;
}

export async function usageSummary(since?: string): Promise<UsageSummary> {
  const all = await withStore<UsageRecord[]>('readonly', store => store.getAll());
  const filtered = since ? all.filter(record => record.at >= since) : all;
  return summarizeUsage(filtered);
}

export async function listUsage(since?: string): Promise<UsageRecord[]> {
  const all = await withStore<UsageRecord[]>('readonly', store => store.getAll());
  return since ? all.filter(record => record.at >= since) : all;
}

export async function clearUsage(): Promise<void> {
  await withStore('readwrite', store => store.clear());
}
