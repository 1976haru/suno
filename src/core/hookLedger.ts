import type { ChannelArchetype, LyricLanguage, PlaylistBlueprint } from '../types';
import { hookPoolSize } from './lyricEngine';

const DB_NAME = 'suno-weaver-hooks';
const DB_VERSION = 1;
const STORE = 'usage';

export interface HookUsage {
  /** `${packId}:${trackNo}` — unique per song, and lets forgetPack() find every record for a pack without a secondary index. */
  id: string;
  hook: string;
  title: string;
  channelId: string;
  language: LyricLanguage;
  usedAt: string;
  packId: string;
  trackNo: number;
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

async function allRecords(): Promise<HookUsage[]> {
  return withStore<HookUsage[]>('readonly', store => store.getAll());
}

/** Every hook this channel (in this language) has ever used, across every pack — not just the current one. This is TASK X1's core fix: without cross-pack history, a hook bank of any size eventually repeats because nothing remembers what the *previous* pack already used. */
export async function usedHooks(channelId: string, language: LyricLanguage): Promise<Set<string>> {
  const all = await allRecords();
  return new Set(all.filter(u => u.channelId === channelId && u.language === language).map(u => u.hook));
}

export async function usedTitles(channelId: string, language: LyricLanguage): Promise<Set<string>> {
  const all = await allRecords();
  return new Set(all.filter(u => u.channelId === channelId && u.language === language).map(u => u.title));
}

/** Most-recent-first, capped — used to keep the "don't reuse these" list sent to a remote LLM prompt from growing unbounded (token cost). */
export async function recentUsedTitlesAndHooks(
  channelId: string,
  language: LyricLanguage,
  limit = 100
): Promise<{ titles: string[]; hooks: string[] }> {
  const all = await allRecords();
  const scoped = all
    .filter(u => u.channelId === channelId && u.language === language)
    .sort((a, b) => (a.usedAt < b.usedAt ? 1 : -1))
    .slice(0, limit);
  return { titles: scoped.map(u => u.title), hooks: scoped.map(u => u.hook) };
}

/**
 * Records every song's hook/title for a pack. Idempotent: re-recording the
 * same packId first clears its old entries, so calling this again for an
 * updated version of the same pack (e.g. the autosave slot being
 * overwritten by the next generation) replaces rather than duplicates.
 */
export async function recordPackHooks(packId: string, channelId: string, blueprint: PlaylistBlueprint, language: LyricLanguage): Promise<void> {
  await forgetPack(packId);
  const now = new Date().toISOString();
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
    await withStore('readwrite', store => store.put(record));
  }
}

/** Frees a pack's hooks back into the pool — call when a pack is deleted, so a discarded pack doesn't permanently lock its hooks out of the channel. */
export async function forgetPack(packId: string): Promise<void> {
  const all = await allRecords();
  const ids = all.filter(u => u.packId === packId).map(u => u.id);
  for (const id of ids) {
    await withStore('readwrite', store => store.delete(id));
  }
}

export interface ExhaustionStats {
  used: number;
  poolSize: number;
  remaining: number;
  percentUsed: number;
}

/** Pure — kept separate from the IndexedDB read so it's testable without a browser (same pattern as usageLedger's summarizeUsage). */
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
  const all = await allRecords();
  return all.filter(u => u.channelId === channelId).sort((a, b) => (a.usedAt < b.usedAt ? 1 : -1));
}

export async function forgetUsage(id: string): Promise<void> {
  await withStore('readwrite', store => store.delete(id));
}

export async function clearChannelHistory(channelId: string): Promise<void> {
  const all = await allRecords();
  const ids = all.filter(u => u.channelId === channelId).map(u => u.id);
  for (const id of ids) {
    await withStore('readwrite', store => store.delete(id));
  }
}
