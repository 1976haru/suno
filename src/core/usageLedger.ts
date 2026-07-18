const DB_NAME = 'suno-weaver-usage';
const DB_VERSION = 1;
const STORE = 'usage';

export interface UsageRecord {
  at: string;
  provider: string;
  model: string;
  purpose: 'generate' | 'refine' | 'evaluate' | 'concept';
  inputTokens: number;
  outputTokens: number;
  /** Whole-response app-level cache reuse (core/apiCache.ts) — a full API call was skipped entirely. */
  cacheHit: boolean;
  /** TASK E1 (v3.5) — Anthropic prompt-cache read tokens for this call (0 if not reported/not applicable). Distinct from cacheHit: this is a discount on part of a real call, not skipping the call. */
  cacheReadTokens?: number;
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
  /** TASK E1 (v3.5) — sum of Anthropic prompt-cache read tokens across all calls; 0 means either no Anthropic calls yet or the cache boundary isn't actually hitting. */
  totalCacheReadTokens: number;
  byPurpose: Record<string, number>;
}

/** Pure aggregation, kept separate from the IndexedDB read so it's testable without a browser. */
export function summarizeUsage(records: UsageRecord[]): UsageSummary {
  const summary: UsageSummary = { totalCalls: 0, totalInput: 0, totalOutput: 0, cacheHits: 0, totalCacheReadTokens: 0, byPurpose: {} };
  for (const record of records) {
    summary.totalCalls += 1;
    summary.totalInput += record.inputTokens;
    summary.totalOutput += record.outputTokens;
    if (record.cacheHit) summary.cacheHits += 1;
    summary.totalCacheReadTokens += record.cacheReadTokens || 0;
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

/**
 * TASK v3.23 — a real 40-song run showed totalCacheReadTokens=8,210 (prompt
 * caching genuinely hitting) right next to a "캐시로 절약: 0회 호출" row, which
 * measures a completely different thing (core/apiCache.ts whole-response
 * skip count — always 0 for real, non-identical generations). That reads as
 * "caching isn't working" even though it is; this turns the raw cache-read
 * token count into a concrete KRW figure so the savings are visible as a
 * number instead of implied by a token count next to an unrelated zero.
 * Anthropic bills a prompt-cache read at 10% of the normal input-token price
 * (a 90% discount vs. paying full price for the same tokens again).
 */
export function estimateCacheSavingsKrw(totalCacheReadTokens: number, inputPricePerM: number | null): number | null {
  if (inputPricePerM == null || Number.isNaN(inputPricePerM) || totalCacheReadTokens <= 0) return null;
  return (totalCacheReadTokens / 1_000_000) * inputPricePerM * 0.9;
}
