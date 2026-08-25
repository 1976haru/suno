const DB_NAME = 'suno-weaver-settings';
const DB_VERSION = 1;
const STORE = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
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

/** Local BYOK keys and provider prefs live in IndexedDB, never localStorage or a log line. */
export async function getSetting<T>(key: string): Promise<T | undefined> {
  return withStore<T | undefined>('readonly', store => store.get(key));
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await withStore('readwrite', store => store.put(value, key));
}

export async function deleteSetting(key: string): Promise<void> {
  await withStore('readwrite', store => store.delete(key));
}

export async function clearAllSettings(): Promise<void> {
  await withStore('readwrite', store => store.clear());
}
