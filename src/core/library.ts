import type { GenerationOptions, PlaylistBlueprint, SavedPack, SavedPackMeta, SoundSignature } from '../types';
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

function normalizeSavedPack(pack: SavedPack): SavedPack {
  const migrated = migrateLegacyChannelNames(pack);
  const personaMode = migrated.personaMode ?? migrated.options?.personaMode ?? false;
  return {
    ...migrated,
    personaMode,
    options: migrated.options ? { ...migrated.options, personaMode } : migrated.options
  };
}

const DB_NAME = 'suno-weaver-library';
const DB_VERSION = 4;
const STORE = 'packs';
const PERSONA_STORE = 'personas';
const PROGRESS_STORE = 'suno_progress';
const CONCEPT_CACHE_STORE = 'concept_cache';
const CONCEPT_HISTORY_STORE = 'concept_history';
export const AUTOSAVE_ID = 'autosave-temp';

/** TASK H4 (v3.10) — caches a concept agent API recommendation by channel + normalized free-text input, so re-submitting the same phrase never re-calls the API. */
export interface ConceptCacheRecord {
  id: string;
  resultJson: string;
  cachedAt: string;
}

/** TASK H7 (v3.10) — last few free-text inputs per channel, shown as quick-pick chips so the user doesn't retype a phrase they already used for this channel. */
export interface ConceptHistoryRecord {
  id: string;
  channelId: string;
  inputs: string[];
  updatedAt: string;
}

const memoryConceptCache = new Map<string, ConceptCacheRecord>();
const memoryConceptHistory = new Map<string, ConceptHistoryRecord>();
const CONCEPT_HISTORY_MAX = 5;

/** TASK G3 (v3.7) — "곡을 Suno에 넣었음" checkboxes for Focus Mode, keyed by pack id, so the checklist survives a page reload. */
export interface PackProgressRecord {
  id: string;
  doneTrackNos: number[];
  updatedAt: string;
  /** TASK v3.31 — per-track "last copied all fields in Suno Progress Mode" timestamp, so reopening a pack later shows what was already pasted. Optional/absent for records written before this field existed. */
  pastedAt?: Record<number, string>;
}

const memoryProgress = new Map<string, PackProgressRecord>();

export interface ChannelPersonaRecord {
  id: string;
  channelId: string;
  personaName: string;
  createdAt: string;
  lastUsedAt: string;
  useCount: number;
  soundSignature?: SoundSignature;
}

const memoryPacks = new Map<string, SavedPack>();
const memoryPersonas = new Map<string, ChannelPersonaRecord>();

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PERSONA_STORE)) {
        db.createObjectStore(PERSONA_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
        db.createObjectStore(PROGRESS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CONCEPT_CACHE_STORE)) {
        db.createObjectStore(CONCEPT_CACHE_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CONCEPT_HISTORY_STORE)) {
        db.createObjectStore(CONCEPT_HISTORY_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed.'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>, storeName = STORE): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
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
  soundSignature?: SavedPack['soundSignature'];
  personaMode?: boolean;
  setGroupId?: string;
  setIndex?: number;
  setTotal?: number;
}): Promise<string> {
  const id = input.id || (input.isAutosave ? AUTOSAVE_ID : randomId());
  const personaMode = input.personaMode ?? input.options.personaMode ?? false;
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
    options: { ...input.options, personaMode },
    evaluation: input.evaluation,
    thumbnailSpec: input.thumbnailSpec,
    soundSignature: input.soundSignature,
    personaMode,
    setGroupId: input.setGroupId,
    setIndex: input.setIndex,
    setTotal: input.setTotal
  };
  if (!hasIndexedDb()) {
    memoryPacks.set(id, pack);
    return id;
  }
  await withStore('readwrite', store => store.put(pack));
  return id;
}

export async function saveAutosave(
  blueprint: PlaylistBlueprint,
  options: GenerationOptions,
  thumbnailSpec?: SavedPack['thumbnailSpec'],
  soundSignature?: SavedPack['soundSignature']
): Promise<void> {
  await savePack({ blueprint, options, isAutosave: true, id: AUTOSAVE_ID, name: 'Autosave', thumbnailSpec, soundSignature, personaMode: options.personaMode ?? false });
}

export async function promoteAutosave(name: string): Promise<string | null> {
  const autosave = await loadPack(AUTOSAVE_ID);
  if (!autosave) return null;
  return savePack({
    blueprint: autosave.blueprint,
    options: autosave.options,
    name,
    evaluation: autosave.evaluation,
    thumbnailSpec: autosave.thumbnailSpec,
    soundSignature: autosave.soundSignature,
    personaMode: autosave.personaMode ?? autosave.options.personaMode ?? false
  });
}

export async function listPacks(): Promise<SavedPackMeta[]> {
  if (!hasIndexedDb()) {
    return Array.from(memoryPacks.values())
      .map(normalizeSavedPack)
      .map(({ blueprint: _blueprint, options: _options, evaluation: _evaluation, ...meta }) => meta)
      .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  }
  const all = await withStore<SavedPack[]>('readonly', store => store.getAll());
  return all
    .map(normalizeSavedPack)
    .map(({ blueprint: _blueprint, options: _options, evaluation: _evaluation, ...meta }) => meta)
    .sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

export interface SetGroupSummary {
  groupId: string;
  label: string;
  packs: SavedPackMeta[];
}

/**
 * TASK v3.37-b — groups saved packs that share a multi-set run's
 * `setGroupId` (see SavedPack's TASK v3.33 comment), for any UI that needs
 * to act on a whole set-group at once (batch thumbnail/cover export,
 * batch image generation). Packs outside a multi-set run (`setGroupId`
 * undefined) are excluded — there's no group to act on.
 */
export async function listSetGroups(): Promise<SetGroupSummary[]> {
  const all = await listPacks();
  const groups = new Map<string, SavedPackMeta[]>();
  for (const pack of all) {
    if (!pack.setGroupId) continue;
    const list = groups.get(pack.setGroupId) ?? [];
    list.push(pack);
    groups.set(pack.setGroupId, list);
  }
  return Array.from(groups.entries()).map(([groupId, packs]) => ({
    groupId,
    label: `${(packs[0]?.projectTitle ?? groupId).replace(/ Set \d+$/, '')} (${packs.length}세트)`,
    packs: packs.slice().sort((a, b) => (a.setIndex ?? 0) - (b.setIndex ?? 0))
  }));
}

export async function loadPack(id: string): Promise<SavedPack | undefined> {
  if (!hasIndexedDb()) {
    const pack = memoryPacks.get(id);
    return pack ? normalizeSavedPack(pack) : undefined;
  }
  const pack = await withStore<SavedPack | undefined>('readonly', store => store.get(id));
  return pack ? normalizeSavedPack(pack) : pack;
}

export async function deletePack(id: string): Promise<void> {
  if (!hasIndexedDb()) {
    memoryPacks.delete(id);
    return;
  }
  await withStore('readwrite', store => store.delete(id));
}

export async function renamePack(id: string, name: string): Promise<void> {
  const pack = await loadPack(id);
  if (!pack) return;
  await savePack({ ...pack, id, name });
}

export async function exportAllPacks(): Promise<Blob> {
  if (!hasIndexedDb()) {
    return new Blob([JSON.stringify(Array.from(memoryPacks.values()).map(normalizeSavedPack), null, 2)], { type: 'application/json;charset=utf-8' });
  }
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
  if (!hasIndexedDb()) {
    memoryPacks.clear();
    memoryPersonas.clear();
    return;
  }
  await withStore('readwrite', store => store.clear());
  await withStore('readwrite', store => store.clear(), PERSONA_STORE);
}

function personaRecordId(channelId: string, personaName: string) {
  return `${channelId}::${personaName.trim().toLowerCase()}`;
}

export async function saveChannelPersona(channelId: string, personaName: string, soundSignature?: SoundSignature): Promise<ChannelPersonaRecord> {
  const trimmed = personaName.trim();
  const id = personaRecordId(channelId, trimmed);
  const now = new Date().toISOString();
  const existing = await loadChannelPersona(id);
  const record: ChannelPersonaRecord = {
    id,
    channelId,
    personaName: trimmed,
    createdAt: existing?.createdAt || now,
    lastUsedAt: existing?.lastUsedAt || now,
    useCount: existing?.useCount || 0,
    soundSignature: soundSignature || existing?.soundSignature
  };
  if (!hasIndexedDb()) {
    memoryPersonas.set(id, record);
    return record;
  }
  await withStore('readwrite', store => store.put(record), PERSONA_STORE);
  return record;
}

async function loadChannelPersona(id: string): Promise<ChannelPersonaRecord | undefined> {
  if (!hasIndexedDb()) return memoryPersonas.get(id);
  return withStore<ChannelPersonaRecord | undefined>('readonly', store => store.get(id), PERSONA_STORE);
}

export async function recordChannelPersonaUse(channelId: string, personaName: string, soundSignature?: SoundSignature): Promise<ChannelPersonaRecord> {
  const id = personaRecordId(channelId, personaName);
  const now = new Date().toISOString();
  const existing = await loadChannelPersona(id);
  const record: ChannelPersonaRecord = {
    id,
    channelId,
    personaName: personaName.trim(),
    createdAt: existing?.createdAt || now,
    lastUsedAt: now,
    useCount: (existing?.useCount || 0) + 1,
    soundSignature: soundSignature || existing?.soundSignature
  };
  if (!hasIndexedDb()) {
    memoryPersonas.set(id, record);
    return record;
  }
  await withStore('readwrite', store => store.put(record), PERSONA_STORE);
  return record;
}

export async function listChannelPersonas(channelId: string): Promise<ChannelPersonaRecord[]> {
  const records = hasIndexedDb()
    ? await withStore<ChannelPersonaRecord[]>('readonly', store => store.getAll(), PERSONA_STORE)
    : Array.from(memoryPersonas.values());
  return records
    .filter(record => record.channelId === channelId)
    .sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : -1));
}

async function getProgressRecord(packId: string): Promise<PackProgressRecord | undefined> {
  return hasIndexedDb()
    ? withStore<PackProgressRecord | undefined>('readonly', store => store.get(packId), PROGRESS_STORE)
    : memoryProgress.get(packId);
}

export async function getPackProgress(packId: string): Promise<number[]> {
  const record = await getProgressRecord(packId);
  return record?.doneTrackNos || [];
}

/** TASK v3.31 — companion to getPackProgress: the per-track "last pasted" timestamps set by markTrackPasted below. */
export async function getPackPastedAt(packId: string): Promise<Record<number, string>> {
  const record = await getProgressRecord(packId);
  return record?.pastedAt || {};
}

export async function setTrackProgress(packId: string, trackNo: number, done: boolean): Promise<number[]> {
  const existing = await getProgressRecord(packId);
  const current = existing?.doneTrackNos || [];
  const next = done
    ? Array.from(new Set([...current, trackNo])).sort((a, b) => a - b)
    : current.filter(no => no !== trackNo);
  // Preserve pastedAt — this record is put() wholesale, so a naive
  // {id, doneTrackNos, updatedAt} write here would silently wipe out
  // markTrackPasted's history the next time either function runs.
  const record: PackProgressRecord = { id: packId, doneTrackNos: next, updatedAt: new Date().toISOString(), pastedAt: existing?.pastedAt };
  if (!hasIndexedDb()) {
    memoryProgress.set(packId, record);
    return next;
  }
  await withStore('readwrite', store => store.put(record), PROGRESS_STORE);
  return next;
}

/**
 * TASK v3.31 — records when Progress Mode finished copying every field for a
 * track (not necessarily marked "done" — that's still a separate, manual
 * toggle). Lightweight by design: this only ever touches the existing
 * suno_progress record, never a full savePack() round trip, so it's cheap
 * enough to call after every song's last copy.
 */
export async function markTrackPasted(packId: string, trackNo: number): Promise<Record<number, string>> {
  const existing = await getProgressRecord(packId);
  const pastedAt = { ...(existing?.pastedAt || {}), [trackNo]: new Date().toISOString() };
  const record: PackProgressRecord = { id: packId, doneTrackNos: existing?.doneTrackNos || [], updatedAt: new Date().toISOString(), pastedAt };
  if (!hasIndexedDb()) {
    memoryProgress.set(packId, record);
    return pastedAt;
  }
  await withStore('readwrite', store => store.put(record), PROGRESS_STORE);
  return pastedAt;
}

export async function getConceptCache(cacheKey: string): Promise<string | undefined> {
  const record = hasIndexedDb()
    ? await withStore<ConceptCacheRecord | undefined>('readonly', store => store.get(cacheKey), CONCEPT_CACHE_STORE)
    : memoryConceptCache.get(cacheKey);
  return record?.resultJson;
}

export async function setConceptCache(cacheKey: string, resultJson: string): Promise<void> {
  const record: ConceptCacheRecord = { id: cacheKey, resultJson, cachedAt: new Date().toISOString() };
  if (!hasIndexedDb()) {
    memoryConceptCache.set(cacheKey, record);
    return;
  }
  await withStore('readwrite', store => store.put(record), CONCEPT_CACHE_STORE);
}

export async function getConceptHistory(channelId: string): Promise<string[]> {
  const record = hasIndexedDb()
    ? await withStore<ConceptHistoryRecord | undefined>('readonly', store => store.get(channelId), CONCEPT_HISTORY_STORE)
    : memoryConceptHistory.get(channelId);
  return record?.inputs || [];
}

export async function addConceptHistory(channelId: string, input: string): Promise<string[]> {
  const trimmed = input.trim();
  if (!trimmed) return getConceptHistory(channelId);
  const current = await getConceptHistory(channelId);
  const next = [trimmed, ...current.filter(item => item !== trimmed)].slice(0, CONCEPT_HISTORY_MAX);
  const record: ConceptHistoryRecord = { id: channelId, channelId, inputs: next, updatedAt: new Date().toISOString() };
  if (!hasIndexedDb()) {
    memoryConceptHistory.set(channelId, record);
    return next;
  }
  await withStore('readwrite', store => store.put(record), CONCEPT_HISTORY_STORE);
  return next;
}
