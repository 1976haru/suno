import type { ChannelArchetype, LyricLanguage, PlaylistBlueprint } from '../types';
import { hookPoolSize } from './lyricEngine';

const DB_NAME = 'suno-weaver-hooks';
const DB_VERSION = 2;
const STORE = 'usage';
const INDEX_CHANNEL_LANGUAGE = 'channel-language';
const INDEX_CHANNEL_LANGUAGE_USED_AT = 'channel-language-used-at';
const INDEX_CHANNEL_ID = 'channel-id';
const INDEX_PACK_ID = 'pack-id';

export interface HookUsage {
  /** `${packId}:${trackNo}` — unique per song. */
  id: string;
  hook: string;
  title: string;
  channelId: string;
  language: LyricLanguage;
  usedAt: string;
  packId: string;
  trackNo: number;
}

function ensureIndexes(store: IDBObjectStore) {
  if (!store.indexNames.contains(INDEX_CHANNEL_LANGUAGE)) {
    store.createIndex(INDEX_CHANNEL_LANGUAGE, ['channelId', 'language'], { unique: false });
  }
  if (!store.indexNames.contains(INDEX_CHANNEL_LANGUAGE_USED_AT)) {
    store.createIndex(INDEX_CHANNEL_LANGUAGE_USED_AT, ['channelId', 'language', 'usedAt'], { unique: false });
  }
  if (!store.indexNames.contains(INDEX_CHANNEL_ID)) {
    store.createIndex(INDEX_CHANNEL_ID, 'channelId', { unique: false });
  }
  if (!store.indexNames.contains(INDEX_PACK_ID)) {
    store.createIndex(INDEX_PACK_ID, 'packId', { unique: false });
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(STORE)
        ? (request.transaction as IDBTransaction).objectStore(STORE)
        : db.createObjectStore(STORE, { keyPath: 'id' });
      ensureIndexes(store);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another open tab. Close other Suno Weaver tabs and try again.'));
  });
}

function transactionError(tx: IDBTransaction, fallback: string) {
  return tx.error || new Error(fallback);
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
    tx.onerror = () => {
      db.close();
      reject(transactionError(tx, 'IndexedDB transaction failed.'));
    };
    tx.onabort = () => {
      db.close();
      reject(transactionError(tx, 'IndexedDB transaction was aborted.'));
    };
  });
}

async function getAllFromIndex<T>(indexName: string, query: IDBValidKey | IDBKeyRange): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).index(indexName).getAll(query);
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error || new Error('IndexedDB index read failed.'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(transactionError(tx, 'IndexedDB transaction failed.'));
    };
    tx.onabort = () => {
      db.close();
      reject(transactionError(tx, 'IndexedDB transaction was aborted.'));
    };
  });
}

async function deleteByIndex(indexName: string, query: IDBValidKey | IDBKeyRange): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const index = tx.objectStore(STORE).index(indexName);
    const request = index.openCursor(query);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error('IndexedDB cursor failed.'));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(transactionError(tx, 'IndexedDB transaction failed.'));
    };
    tx.onabort = () => {
      db.close();
      reject(transactionError(tx, 'IndexedDB transaction was aborted.'));
    };
  });
}

/** Every hook this channel (in this language) has ever used, across every pack. */
export async function usedHooks(channelId: string, language: LyricLanguage): Promise<Set<string>> {
  const scoped = await getAllFromIndex<HookUsage>(INDEX_CHANNEL_LANGUAGE, [channelId, language]);
  return new Set(scoped.map(u => u.hook));
}

export async function usedTitles(channelId: string, language: LyricLanguage): Promise<Set<string>> {
  const scoped = await getAllFromIndex<HookUsage>(INDEX_CHANNEL_LANGUAGE, [channelId, language]);
  return new Set(scoped.map(u => u.title));
}

/** Most-recent-first and capped without cloning the entire hook database into the UI thread. */
export async function recentUsedTitlesAndHooks(
  channelId: string,
  language: LyricLanguage,
  limit = 100
): Promise<{ titles: string[]; hooks: string[] }> {
  if (limit <= 0) return { titles: [], hooks: [] };
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const index = tx.objectStore(STORE).index(INDEX_CHANNEL_LANGUAGE_USED_AT);
    const range = IDBKeyRange.bound(
      [channelId, language, ''],
      [channelId, language, '\uffff']
    );
    const request = index.openCursor(range, 'prev');
    const records: HookUsage[] = [];

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || records.length >= limit) {
        resolve({ titles: records.map(u => u.title), hooks: records.map(u => u.hook) });
        return;
      }
      records.push(cursor.value as HookUsage);
      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error('IndexedDB cursor failed.'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(transactionError(tx, 'IndexedDB transaction failed.'));
    };
    tx.onabort = () => {
      db.close();
      reject(transactionError(tx, 'IndexedDB transaction was aborted.'));
    };
  });
}

/**
 * Records every song's hook/title for a pack in one transaction. Re-recording
 * the same pack first removes its previous records through the pack-id index,
 * avoiding the old getAll + one-database-open-per-row slowdown.
 */
export async function recordPackHooks(packId: string, channelId: string, blueprint: PlaylistBlueprint, language: LyricLanguage): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const request = store.index(INDEX_PACK_ID).openCursor(IDBKeyRange.only(packId));
    const now = new Date().toISOString();

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
        return;
      }
      for (const song of blueprint.songs) {
        const record: HookUsage = {
          id: `${packId}:${song.trackNo}`,
          hook: song.hookPhrase,
          title: song.title,
          channelId,
          language,
          usedAt: now,
          packId,
          trackNo: song.trackNo
        };
        store.put(record);
      }
    };
    request.onerror = () => reject(request.error || new Error('IndexedDB cursor failed.'));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(transactionError(tx, 'IndexedDB transaction failed.'));
    };
    tx.onabort = () => {
      db.close();
      reject(transactionError(tx, 'IndexedDB transaction was aborted.'));
    };
  });
}

/** Frees a pack's hooks back into the pool. */
export async function forgetPack(packId: string): Promise<void> {
  await deleteByIndex(INDEX_PACK_ID, IDBKeyRange.only(packId));
}

export interface ExhaustionStats {
  used: number;
  poolSize: number;
  remaining: number;
  percentUsed: number;
}

export function exhaustionStats(used: number, poolSize: number): ExhaustionStats {
  const remaining = Math.max(0, poolSize - used);
  const percentUsed = poolSize > 0 ? Math.round((used / poolSize) * 100) : 0;
  return { used, poolSize, remaining, percentUsed };
}

export async function channelExhaustionStats(channelId: string, language: LyricLanguage, archetype?: ChannelArchetype): Promise<ExhaustionStats> {
  const used = (await usedHooks(channelId, language)).size;
  const poolSize = hookPoolSize(language, archetype);
  return exhaustionStats(used, poolSize);
}

export async function listChannelUsage(channelId: string): Promise<HookUsage[]> {
  const scoped = await getAllFromIndex<HookUsage>(INDEX_CHANNEL_ID, channelId);
  return scoped.sort((a, b) => (a.usedAt < b.usedAt ? 1 : -1));
}

export async function forgetUsage(id: string): Promise<void> {
  await withStore('readwrite', store => store.delete(id));
}

export async function clearChannelHistory(channelId: string): Promise<void> {
  await deleteByIndex(INDEX_CHANNEL_ID, IDBKeyRange.only(channelId));
}

export async function clearAllHookHistory(): Promise<void> {
  await withStore('readwrite', store => store.clear());
}
