import type { SongIdea } from '../types';
import { MALE_VOCAL_TRAIT_AXES, FEMALE_VOCAL_TRAIT_AXES } from '../data/vocalTraits';

/**
 * TASK v3.72 (TASK E) — a weekly 10-set channel run repeats not just within
 * one pack (TASK B fixes that) but across sets: nothing remembered which
 * register combination a recent set already leaned on. This is a soft
 * "don't pick what we just used" signal, not a hard rule — see this task's
 * own "강제하지는 마십시오. 가중치 조정 수준으로".
 *
 * Mirrors core/ratingLedger.ts's IndexedDB pattern (same openDb/withStore
 * shape, its own separate database so deleting a saved pack never deletes
 * this history).
 */

const DB_NAME = 'suno-weaver-vocal-combos';
const DB_VERSION = 1;
const STORE = 'combos';

export interface VocalComboRecord {
  /** Auto id — a channel can log the same signature more than once. */
  id?: number;
  channelId: string;
  recordedAt: string;
  /** e.g. "M:mid baritone-tenor lead|F:full chest alto" — see dominantRegisterSignature. */
  signature: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('channelId', 'channelId', { unique: false });
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

/**
 * Pure — finds the most-used male/female register in a finished pack by
 * matching each song's own stylePrompt against the known register pools
 * (same substring technique as vocalPlan.ts's summarizeVocalTraitDistribution;
 * SongIdea itself doesn't carry vocalText as a separate field, only merged
 * into stylePrompt). Returns '' for a gender with no songs (e.g. a kids pack,
 * or a pack that happened to be all-duet).
 */
export function dominantRegisterSignature(songs: Pick<SongIdea, 'vocalType' | 'stylePrompt'>[]): string {
  const parts: string[] = [];
  for (const [label, gender, axes] of [
    ['M', 'male', MALE_VOCAL_TRAIT_AXES],
    ['F', 'female', FEMALE_VOCAL_TRAIT_AXES]
  ] as const) {
    const counts = new Map<string, number>();
    for (const song of songs) {
      if (song.vocalType !== gender) continue;
      const found = axes.register.find(value => song.stylePrompt.includes(value));
      if (found) counts.set(found, (counts.get(found) ?? 0) + 1);
    }
    if (!counts.size) continue;
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    parts.push(`${label}:${dominant}`);
  }
  return parts.join('|');
}

/** Records a just-generated pack's dominant register signature for this channel. Best-effort — never throws into the caller's save flow. */
export async function recordVocalCombo(channelId: string, signature: string): Promise<void> {
  if (!signature) return;
  try {
    await withStore('readwrite', store => store.add({ channelId, signature, recordedAt: new Date().toISOString() }));
  } catch {
    // Best-effort bookkeeping only — a failure here must never block saving the actual pack.
  }
}

/** Most recent `limit` signatures for a channel, newest first. */
export async function getRecentVocalCombos(channelId: string, limit = 3): Promise<string[]> {
  try {
    const all = await withStore<VocalComboRecord[]>('readonly', store => store.getAll());
    return all
      .filter(record => record.channelId === channelId)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
      .slice(0, limit)
      .map(record => record.signature);
  } catch {
    return [];
  }
}
