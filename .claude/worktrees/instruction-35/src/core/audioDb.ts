/**
 * v4.15 (TASK B) — the `suno-weaver-audio` IndexedDB database now has two
 * independent object stores: core/audioTakes.ts's pre-existing 'takes', and
 * this task's new 'archives' (core/audioArchive.ts). IndexedDB versions/
 * upgrades are per-DATABASE, not per-store: two modules each independently
 * calling `indexedDB.open(sameName, differentVersion)` race — whichever
 * opens first "wins" the version and runs its own onupgradeneeded, so the
 * OTHER module's store-creation logic never fires and that store silently
 * never exists. Centralizing the open+upgrade step here (both audioTakes.ts
 * and audioArchive.ts call withAudioStore()/openAudioDb() instead of
 * managing their own connection) avoids that — the same "several stores,
 * one openDb" shape core/library.ts already uses for its own 4 stores in
 * one DB (`suno-weaver-packs`).
 *
 * Bumping AUDIO_DB_VERSION here (1 -> 2) is additive and backward-safe: an
 * existing 'takes' store from a v1 database is left untouched (guarded by
 * `objectStoreNames.contains`), only the new 'archives' store gets created
 * on that user's next open.
 */

export const AUDIO_DB_NAME = 'suno-weaver-audio';
export const AUDIO_DB_VERSION = 2;

export const TAKES_STORE = 'takes';
export const ARCHIVES_STORE = 'archives';

export function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUDIO_DB_NAME, AUDIO_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TAKES_STORE)) {
        const takes = db.createObjectStore(TAKES_STORE, { keyPath: 'takeId' });
        takes.createIndex('songId', 'songId', { unique: false });
        takes.createIndex('packId', 'packId', { unique: false });
      }
      if (!db.objectStoreNames.contains(ARCHIVES_STORE)) {
        const archives = db.createObjectStore(ARCHIVES_STORE, { keyPath: 'archiveLabel' });
        archives.createIndex('workspaceId', 'workspaceId', { unique: false });
        archives.createIndex('channelSlug', 'channelSlug', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
  });
}

/** Single-request convenience wrapper, same shape as the per-module withStore() helpers this app already had one of per database — now shared so `takes`/`archives` never disagree about the database's version. */
export async function withAudioStore<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openAudioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
    tx.oncomplete = () => db.close();
  });
}
