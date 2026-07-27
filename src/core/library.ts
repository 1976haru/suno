import type { GenerationOptions, PlaylistBlueprint, SavedPack, SavedPackMeta } from '../types';
import { channelPresets } from '../data/presets';

const CURRENT_PRESET_NAMES = new Map(channelPresets.map(c => [c.id, { name: c.name, englishName: c.englishName }]));

/**
 * A built-in preset's display name can be corrected after packs were saved.
 * Saved custom channels are never changed because only known preset ids match.
 */
export function migrateLegacyChannelNames(pack: SavedPack): SavedPack {
  const current = CURRENT_PRESET_NAMES.get(pack.channelId);
  if (!current) return pack;
  const channelNameStale = pack.channelName !== current.name;
  const channelObjStale = pack.options?.channel?.id === pack.channelId && pack.options.channel.name !== current.name;
  if (!channelNameStale && !channelObjStale) return pack;
  return {
    ...pack,
    channelName: current.name,
    options: pack.options
      ? { ...pack.options, channel: { ...pack.options.channel, name: current.name, englishName: current.englishName || pack.options.channel.englishName } }
      : pack.options
  };
}

function migrateLegacyPackMeta(meta: SavedPackMeta): SavedPackMeta {
  const current = CURRENT_PRESET_NAMES.get(meta.channelId);
  return current && meta.channelName !== current.name ? { ...meta, channelName: current.name } : meta;
}

export function toSavedPackMeta(pack: SavedPack): SavedPackMeta {
  return {
    id: pack.id,
    name: pack.name,
    savedAt: pack.savedAt,
    isAutosave: pack.isAutosave,
    channelId: pack.channelId,
    channelName: pack.channelName,
    projectTitle: pack.projectTitle,
    songCount: pack.songCount,
    avgQualityScore: pack.avgQualityScore
  };
}

const DB_NAME = 'suno-weaver-library';
const DB_VERSION = 2;
const PACK_STORE = 'packs';
const META_STORE = 'pack-meta';
export const AUTOSAVE_ID = 'autosave-temp';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const db = request.result;
      const tx = request.transaction as IDBTransaction;
      const packStore = db.objectStoreNames.contains(PACK_STORE)
        ? tx.objectStore(PACK_STORE)
        : db.createObjectStore(PACK_STORE, { keyPath: 'id' });
      const metaStore = db.objectStoreNames.contains(META_STORE)
        ? tx.objectStore(META_STORE)
        : db.createObjectStore(META_STORE, { keyPath: 'id' });

      // v1 stored full lyrics/blueprints in the only object store. Populate a
      // compact metadata store once so the sidebar never clones every lyric
      // merely to display pack names and dates.
      if ((event.oldVersion || 0) < 2) {
        const cursorRequest = packStore.openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const pack = migrateLegacyChannelNames(cursor.value as SavedPack);
          metaStore.put(toSavedPackMeta(pack));
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked by another open tab. Close other Suno Weaver tabs and try again.'));
  });
}

function transactionError(tx: IDBTransaction, fallback: string) {
  return tx.error || new Error(fallback);
}

async function readStore<T>(storeName: string, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = fn(tx.objectStore(storeName));
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

async function writePackAndMeta(pack: SavedPack): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PACK_STORE, META_STORE], 'readwrite');
    tx.objectStore(PACK_STORE).put(pack);
    tx.objectStore(META_STORE).put(toSavedPackMeta(pack));
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

async function deleteFromBothStores(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PACK_STORE, META_STORE], 'readwrite');
    tx.objectStore(PACK_STORE).delete(id);
    tx.objectStore(META_STORE).delete(id);
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

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `pack-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function averageQuality(blueprint: PlaylistBlueprint) {
  if (!blueprint.songs.length) return 0;
  const sum = blueprint.songs.reduce((total, song) => total + song.qualityScore, 0);
  return Math.round(sum / blueprint.songs.length);
}

export function buildDefaultPackName(blueprint: PlaylistBlueprint, opts: GenerationOptions) {
  const date = new Date().toISOString().slice(0, 10);
  return `${opts.channel.name} - ${blueprint.projectTitle} - ${date}`;
}

export async function savePack(input: {
  blueprint: PlaylistBlueprint;
  options: GenerationOptions;
  name?: string;
  isAutosave?: boolean;
  id?: string;
  evaluation?: SavedPack['evaluation'];
  thumbnailSpec?: SavedPack['thumbnailSpec'];
}): Promise<string> {
  const id = input.id || (input.isAutosave ? AUTOSAVE_ID : randomId());
  const pack: SavedPack = {
    id,
    name: input.name || buildDefaultPackName(input.blueprint, input.options),
    savedAt: new Date().toISOString(),
    isAutosave: Boolean(input.isAutosave),
    channelId: input.options.channel.id,
    channelName: input.options.channel.name,
    projectTitle: input.blueprint.projectTitle,
    songCount: input.blueprint.songs.length,
    avgQualityScore: averageQuality(input.blueprint),
    blueprint: input.blueprint,
    options: input.options,
    evaluation: input.evaluation,
    thumbnailSpec: input.thumbnailSpec
  };
  await writePackAndMeta(pack);
  return id;
}

export async function saveAutosave(blueprint: PlaylistBlueprint, options: GenerationOptions, thumbnailSpec?: SavedPack['thumbnailSpec']): Promise<void> {
  await savePack({ blueprint, options, isAutosave: true, id: AUTOSAVE_ID, name: '임시저장', thumbnailSpec });
}

export async function promoteAutosave(name: string): Promise<string | null> {
  const autosave = await loadPack(AUTOSAVE_ID);
  if (!autosave) return null;
  return savePack({ blueprint: autosave.blueprint, options: autosave.options, name, evaluation: autosave.evaluation, thumbnailSpec: autosave.thumbnailSpec });
}

export async function listPacks(): Promise<SavedPackMeta[]> {
  const all = await readStore<SavedPackMeta[]>(META_STORE, store => store.getAll());
  return all
    .map(migrateLegacyPackMeta)
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export async function loadPack(id: string): Promise<SavedPack | undefined> {
  const pack = await readStore<SavedPack | undefined>(PACK_STORE, store => store.get(id));
  return pack ? migrateLegacyChannelNames(pack) : pack;
}

export async function deletePack(id: string): Promise<void> {
  await deleteFromBothStores(id);
}

export async function renamePack(id: string, name: string): Promise<void> {
  const pack = await loadPack(id);
  if (!pack) return;
  await savePack({
    blueprint: pack.blueprint,
    options: pack.options,
    id,
    name,
    isAutosave: pack.isAutosave,
    evaluation: pack.evaluation,
    thumbnailSpec: pack.thumbnailSpec
  });
}

export async function exportAllPacks(): Promise<Blob> {
  const all = await readStore<SavedPack[]>(PACK_STORE, store => store.getAll());
  return new Blob([JSON.stringify(all, null, 2)], { type: 'application/json;charset=utf-8' });
}

function isImportablePack(value: unknown): value is SavedPack {
  if (!value || typeof value !== 'object') return false;
  const pack = value as Partial<SavedPack>;
  return Boolean(pack.blueprint && pack.options);
}

function yieldToBrowser(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function saveImportedPack(value: unknown): Promise<boolean> {
  if (!isImportablePack(value)) return false;
  await savePack({
    blueprint: value.blueprint,
    options: value.options,
    name: typeof value.name === 'string' && value.name ? value.name : undefined,
    isAutosave: Boolean(value.isAutosave),
    id: typeof value.id === 'string' && value.id ? value.id : randomId(),
    evaluation: value.evaluation,
    thumbnailSpec: value.thumbnailSpec
  });
  return true;
}

async function importParsedFallback(text: string): Promise<number> {
  await yieldToBrowser();
  const parsed: unknown = JSON.parse(text);
  const packs = Array.isArray(parsed) ? parsed : [parsed];
  let count = 0;
  for (const pack of packs) {
    if (await saveImportedPack(pack)) count += 1;
    await yieldToBrowser();
  }
  return count;
}

async function importParsedInWorker(text: string): Promise<number> {
  const workerSource = `
    let packs = [];
    let index = 0;
    function sendNext() {
      if (index >= packs.length) {
        self.postMessage({ type: 'done' });
        packs = [];
        return;
      }
      self.postMessage({ type: 'pack', value: packs[index] });
      index += 1;
    }
    self.onmessage = event => {
      const data = event.data || {};
      if (data.type === 'start') {
        try {
          const parsed = JSON.parse(data.text);
          packs = Array.isArray(parsed) ? parsed : [parsed];
          index = 0;
          self.postMessage({ type: 'ready', total: packs.length });
          sendNext();
        } catch (error) {
          self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
        }
      } else if (data.type === 'next') {
        sendNext();
      }
    };
  `;
  const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
  const worker = new Worker(url);

  return new Promise((resolve, reject) => {
    let count = 0;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve(count);
    };

    worker.onmessage = async event => {
      const data = event.data as { type?: string; value?: unknown; message?: string };
      if (data.type === 'ready') return;
      if (data.type === 'error') {
        finish(new Error(data.message || '백업 파일을 읽지 못했습니다.'));
        return;
      }
      if (data.type === 'done') {
        finish();
        return;
      }
      if (data.type !== 'pack') return;
      try {
        if (await saveImportedPack(data.value)) count += 1;
        await yieldToBrowser();
        worker.postMessage({ type: 'next' });
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    };
    worker.onerror = event => finish(new Error(event.message || '백업 파일 처리 Worker가 중단되었습니다.'));
    worker.postMessage({ type: 'start', text });
  });
}

export async function importPacks(file: File): Promise<number> {
  const text = await file.text();
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    return importParsedFallback(text);
  }
  return importParsedInWorker(text);
}

export async function deleteAllPacks(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PACK_STORE, META_STORE], 'readwrite');
    tx.objectStore(PACK_STORE).clear();
    tx.objectStore(META_STORE).clear();
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
