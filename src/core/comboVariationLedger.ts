import type { WorkspaceId } from '../types';
import { currentWorkspaceId, scopeFilter } from './workspaceScope';
import type { VerifiedCombo } from '../data/verifiedCombos';

/**
 * v5.23 (TASK D gap 3) — "triedVariations 실제 기록/갱신 흐름": a
 * VerifiedCombo (src/data/verifiedCombos.ts) is either a static seed entry
 * or a user-approved one (core/verifiedCombos.ts's approvedCombos store) —
 * neither can be mutated in place when a variation actually gets tried and
 * rated. This is the overlay: one record per (combo, variation) tried,
 * IndexedDB-backed, same store-per-module/workspace-scoped pattern as
 * every other ledger in this codebase (explorationLedger.ts, ratingLedger.ts).
 * mergeTriedVariationsIntoCombo below folds these records into a combo's
 * own `triedVariations` field at read time, so comboVariations.ts's
 * generateUntriedVariations/nextComboVariation see the real history
 * without needing to know whether a combo is a seed, approved, or has
 * ledger-recorded tries — it just reads combo.triedVariations either way.
 */
const DB_NAME = 'suno-weaver-combo-variations';
const DB_VERSION = 1;
const STORE = 'records';

export interface ComboVariationRecord {
  /** `${workspaceId}::${comboId}::${normalizedVariation}` — re-recording the same (combo, variation) pair replaces rather than duplicates, same idempotent-put convention every other ledger here follows. */
  id: string;
  comboId: string;
  workspaceId: WorkspaceId;
  variation: string;
  verdict: 'good' | 'mixed' | 'bad';
  setCode: string;
  trackNo: number;
  recordedAt: string;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
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

/** Idempotent — recording the same (comboId, variation) pair again (e.g. a corrected rating) replaces the prior record rather than accumulating duplicates. */
export async function recordComboVariationOutcome(input: {
  comboId: string;
  variation: string;
  verdict: 'good' | 'mixed' | 'bad';
  setCode: string;
  trackNo: number;
}): Promise<void> {
  const workspaceId = currentWorkspaceId();
  const record: ComboVariationRecord = {
    id: `${workspaceId}::${input.comboId}::${normalize(input.variation)}`,
    comboId: input.comboId,
    workspaceId,
    variation: input.variation,
    verdict: input.verdict,
    setCode: input.setCode,
    trackNo: input.trackNo,
    recordedAt: new Date().toISOString()
  };
  await withStore('readwrite', store => store.put(record));
}

export async function listComboVariationRecords(workspaceId: WorkspaceId = currentWorkspaceId()): Promise<ComboVariationRecord[]> {
  const all = await withStore<ComboVariationRecord[]>('readonly', store => store.getAll());
  return scopeFilter(all, workspaceId);
}

// ---------------------------------------------------------------------------
// Pure logic — no IndexedDB below this line (mirrors every other ledger's
// own "storage stays at the edge" split).
// ---------------------------------------------------------------------------

/**
 * Folds ledger records for ONE combo into that combo's own triedVariations
 * field — a real, already-tried variation from the ledger is appended
 * (never duplicated: a variation already present in the combo's own static
 * triedVariations, seed or approved, is left as-is; the ledger record wins
 * only when the combo itself has no entry for that normalized variation
 * yet). Returns a NEW VerifiedCombo (never mutates the input).
 */
export function mergeTriedVariationsIntoCombo(combo: VerifiedCombo, records: readonly ComboVariationRecord[]): VerifiedCombo {
  const relevant = records.filter(record => record.comboId === combo.id);
  if (!relevant.length) return combo;
  const existing = new Set((combo.triedVariations ?? []).map(entry => normalize(entry.variation)));
  const additions = relevant
    .filter(record => !existing.has(normalize(record.variation)))
    .map(record => ({ variation: record.variation, verdict: record.verdict, setCode: record.setCode }));
  if (!additions.length) return combo;
  return { ...combo, triedVariations: [...(combo.triedVariations ?? []), ...additions] };
}

/** Same fold, applied across a whole combo list — the real shape callers (effectiveVerifiedCombosWithTriedVariations below, tests) work with. */
export function mergeTriedVariationsIntoCombos(combos: readonly VerifiedCombo[], records: readonly ComboVariationRecord[]): VerifiedCombo[] {
  return combos.map(combo => mergeTriedVariationsIntoCombo(combo, records));
}
