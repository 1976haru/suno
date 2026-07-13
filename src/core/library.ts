import type { GenerationOptions, PlaylistBlueprint, SavedPack, SavedPackMeta } from '../types';
import { channelPresets } from '../data/presets';

const CURRENT_PRESET_NAMES = new Map(channelPresets.map(c => [c.id, { name: c.name, englishName: c.englishName }]));

/**
 * TASK C (v3.5) — a built-in preset's display name can be corrected after
 * packs were already saved under it (e.g. the Japanese channel preset was
 * originally named in Korean, then fixed to actual Japanese). Saved packs
 * snapshot the channel at save time, so without this they'd keep showing
 * the old name forever. Matched by id, so custom (non-preset) channels are
 * never touched.
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

const DB_NAME = 'suno-weaver-library';
const DB_VERSION = 1;
const STORE = 'packs';
export const AUTOSAVE_ID = 'autosave-temp';

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
  await withStore('readwrite', store => store.put(pack));
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
  const all = await withStore<SavedPack[]>('readonly', store => store.getAll());
  return all
    .map(migrateLegacyChannelNames)
    .map(({ blueprint: _blueprint, options: _options, evaluation: _evaluation, ...meta }) => meta)
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export async function loadPack(id: string): Promise<SavedPack | undefined> {
  const pack = await withStore<SavedPack | undefined>('readonly', store => store.get(id));
  return pack ? migrateLegacyChannelNames(pack) : pack;
}

export async function deletePack(id: string): Promise<void> {
  await withStore('readwrite', store => store.delete(id));
}

export async function renamePack(id: string, name: string): Promise<void> {
  const pack = await loadPack(id);
  if (!pack) return;
  await savePack({ ...pack, id, name });
}

export async function exportAllPacks(): Promise<Blob> {
  const all = await withStore<SavedPack[]>('readonly', store => store.getAll());
  return new Blob([JSON.stringify(all, null, 2)], { type: 'application/json;charset=utf-8' });
}

export async function importPacks(file: File): Promise<number> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const packs: SavedPack[] = Array.isArray(parsed) ? parsed : [parsed];
  let count = 0;
  for (const pack of packs) {
    if (!pack || typeof pack !== 'object' || !pack.blueprint || !pack.options) continue;
    await savePack({ ...pack, id: pack.id || randomId() });
    count += 1;
  }
  return count;
}

export async function deleteAllPacks(): Promise<void> {
  await withStore('readwrite', store => store.clear());
}
