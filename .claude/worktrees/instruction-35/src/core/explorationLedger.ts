import type { WorkspaceId } from '../types';
import { currentWorkspaceId, scopeFilter } from './workspaceScope';

/**
 * v5.23 (TASK E §5-1) — records what an exploration slot (core/explorationSlots.ts)
 * actually tried per set, and what the result was. Same IndexedDB
 * store-per-module/workspace-scoped pattern as every other ledger in this
 * codebase (hookLedger.ts, situationLedger.ts, lyricLineLedger.ts). This is
 * also where core/explorationSlots.ts's 7-axis rotation counter comes from
 * (nextAxisSequence) — a real, persistent count of exploration-eligible
 * sets generated so far, not a daily-reset counter (matching the task
 * spec's own "7세트 주기로 회전" — 7 real sets, not 7 calendar days).
 */
const DB_NAME = 'suno-weaver-exploration';
const DB_VERSION = 1;
const STORE = 'records';

export interface ExplorationAttempt {
  trackNo: number;
  description: string;
}

export type ExplorationRating = 'good' | 'ok' | 'bad';

export interface ExplorationOutcome {
  trackNo: number;
  rating: ExplorationRating;
  /**
   * v5.24 (TASK F §6-2) — workspace-specific extra judgment questions beyond
   * the shared good/ok/bad rating (§6-1): kids adds "아이가 따라 할 수 있는가"/
   * "한 번 듣고 기억나는가", K-pop adds "후렴이 귀에 걸리는가"/"구조가
   * 지루하지 않은가", 2030 adds "새롭게 들리는가"/"그래도 편안한가". Keys are
   * free-form (no enum here) since each workspace's own question set differs
   * and this is UI-recorded, human-judged data, not something the pipeline
   * itself branches on.
   */
  extra?: Record<string, boolean>;
}

export interface ExplorationRecord {
  /** `${workspaceId}::${setCode}` */
  id: string;
  setCode: string;
  axis: string;
  trackNos: number[];
  attempts: ExplorationAttempt[];
  outcomes?: ExplorationOutcome[];
  recordedAt: string;
  workspaceId?: WorkspaceId;
  /**
   * v5.23 (TASK E UI) — a human-readable label for the ledger screen
   * (e.g. the pack's own projectTitle) — `setCode` alone is a real but
   * cryptic identifier at RECORD time (see recordExplorationOnImport's own
   * doc comment: recording happens right after a bridge import, before
   * core/library.ts's savePack has assigned the pack's real setCode).
   * Falls back to `setCode` in the UI when absent.
   */
  packLabel?: string;
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

async function allRecords(workspaceId?: WorkspaceId): Promise<ExplorationRecord[]> {
  const all = await withStore<ExplorationRecord[]>('readonly', store => store.getAll());
  return scopeFilter(all, workspaceId);
}

/** Idempotent — same convention as every other ledger's own recordPack*: re-recording the same setCode replaces rather than duplicates. */
export async function recordExploration(record: Omit<ExplorationRecord, 'id' | 'recordedAt' | 'workspaceId'>): Promise<void> {
  const workspaceId = currentWorkspaceId();
  const stamped: ExplorationRecord = { ...record, id: `${workspaceId}::${record.setCode}`, recordedAt: new Date().toISOString(), workspaceId };
  await withStore('readwrite', store => store.put(stamped));
}

/** Attaches/updates outcomes for an already-recorded set (the user's 👍/🤷/👎 click, typically later than the original generation). */
export async function recordExplorationOutcomes(setCode: string, outcomes: ExplorationOutcome[]): Promise<void> {
  const workspaceId = currentWorkspaceId();
  const id = `${workspaceId}::${setCode}`;
  const existing = await withStore<ExplorationRecord | undefined>('readonly', store => store.get(id));
  if (!existing) return;
  await withStore('readwrite', store => store.put({ ...existing, outcomes }));
}

/** core/explorationSlots.ts's own 7-axis rotation input — a real, persistent count of exploration-eligible sets generated so far for this workspace. */
export async function nextAxisSequence(workspaceId: WorkspaceId = currentWorkspaceId()): Promise<number> {
  const all = await allRecords(workspaceId);
  return all.length;
}

export async function listExplorationHistory(workspaceId: WorkspaceId = currentWorkspaceId()): Promise<ExplorationRecord[]> {
  const all = await allRecords(workspaceId);
  return all.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
}

/**
 * v5.23 (TASK E UI) — turns the real, imported songs on an exploration
 * slot's own tracks into ExplorationAttempt[] for recordExploration. Pure
 * (no IndexedDB), so it's unit-testable without a browser environment —
 * mirrors this file's own "storage stays at the edge" split. `distinctChoice`
 * (TASK B) doubles as the real "what did this track try" description; a
 * missing one (an agent that skipped the field) still records the attempt
 * rather than silently dropping it, just with a placeholder description.
 */
export function buildExplorationAttempts(
  songs: readonly { trackNo: number; distinctChoice?: string }[],
  trackNos: readonly number[]
): ExplorationAttempt[] {
  const trackSet = new Set(trackNos);
  return songs
    .filter(song => trackSet.has(song.trackNo))
    .map(song => ({ trackNo: song.trackNo, description: song.distinctChoice?.trim() || '(설명 없음)' }))
    .sort((a, b) => a.trackNo - b.trackNo);
}

export interface ExplorationLearningSuggestion {
  description: string;
  kind: 'promote' | 'avoid';
  /** How many times this exact (normalized) description was rated, and how many of those were the triggering rating. */
  count: number;
  matchingCount: number;
  setCodes: string[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * v5.23 (TASK E §5-3) — "좋음 2회 이상 -> verifiedCombos 등록 제안 / 별로 2회
 * 이상 -> 회피 목록... 단, 자동 등록하지 마십시오. 제안만 하십시오." Pure —
 * operates on already-fetched records so it's testable without IndexedDB;
 * the real caller (a UI panel) is what actually shows these as suggestions,
 * never auto-applies them.
 */
export function computeExplorationLearningSuggestions(records: ExplorationRecord[]): ExplorationLearningSuggestion[] {
  const byDescription = new Map<string, { raw: string; ratings: ExplorationRating[]; setCodes: string[] }>();
  for (const record of records) {
    for (const attempt of record.attempts) {
      const outcome = record.outcomes?.find(o => o.trackNo === attempt.trackNo);
      if (!outcome) continue;
      const key = normalize(attempt.description);
      const entry = byDescription.get(key) ?? { raw: attempt.description, ratings: [], setCodes: [] };
      entry.ratings.push(outcome.rating);
      entry.setCodes.push(record.setCode);
      byDescription.set(key, entry);
    }
  }

  const suggestions: ExplorationLearningSuggestion[] = [];
  for (const entry of byDescription.values()) {
    const goodCount = entry.ratings.filter(r => r === 'good').length;
    const badCount = entry.ratings.filter(r => r === 'bad').length;
    if (goodCount >= 2) {
      suggestions.push({ description: entry.raw, kind: 'promote', count: entry.ratings.length, matchingCount: goodCount, setCodes: entry.setCodes });
    }
    if (badCount >= 2) {
      suggestions.push({ description: entry.raw, kind: 'avoid', count: entry.ratings.length, matchingCount: badCount, setCodes: entry.setCodes });
    }
  }
  return suggestions;
}
