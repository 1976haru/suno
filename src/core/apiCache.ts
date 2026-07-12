import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack } from '../types';

const DB_NAME = 'suno-weaver-cache';
const STORE_NAME = 'responses';
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CacheEntry {
  key: string;
  blueprint: PlaylistBlueprint;
  cachedAt: string;
  provider: string;
  model: string;
  songCount: number;
}

export interface CacheStats {
  count: number;
  oldestAt: string | null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = run(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// FNV-1a — good enough to fingerprint a request payload for cache lookup;
// no cryptographic guarantees needed since a collision just means a cache
// miss/extra API call, never data corruption.
function fingerprint(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/** Pure — computes the same key for the same request shape, no IndexedDB involved. */
export function computeCacheKey(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings
): string {
  const stable = {
    projectTitle: opts.projectTitle,
    songCount: opts.songCount,
    lyricLanguage: opts.lyricLanguage,
    market: opts.market,
    audience: opts.audience,
    genreIds: [...opts.genreIds].sort(),
    moodIds: [...opts.moodIds].sort(),
    seasonId: opts.seasonId,
    vocalTone: opts.vocalTone,
    perspective: opts.perspective,
    lyricDepth: opts.lyricDepth,
    durationTarget: opts.durationTarget,
    moneyChordMode: opts.moneyChordMode,
    customMoneyChord: opts.customMoneyChord,
    customConcept: opts.customConcept,
    avoidWords: opts.avoidWords,
    channelId: opts.channel.id,
    genres: genres.map(genre => genre.id).sort(),
    moods: moods.map(mood => mood.id).sort(),
    seasonPackId: season.id,
    provider: settings.provider,
    model: settings.model || '',
    temperature: settings.temperature,
    batchSize: settings.batchSize || 6
  };
  return fingerprint(JSON.stringify(stable));
}

/** Pure — kept separate from IndexedDB reads so expiry logic is unit-testable without a browser. */
export function isExpired(cachedAt: string, now: number = Date.now()): boolean {
  return now - new Date(cachedAt).getTime() > CACHE_TTL_MS;
}

export async function getCached(key: string): Promise<CacheEntry | null> {
  const entry = await withStore<CacheEntry | undefined>('readonly', store => store.get(key));
  if (!entry) return null;
  if (isExpired(entry.cachedAt)) {
    void deleteCached(key);
    return null;
  }
  return entry;
}

export async function setCached(
  key: string,
  blueprint: PlaylistBlueprint,
  meta: { provider: string; model: string; songCount: number }
): Promise<void> {
  const entry: CacheEntry = { key, blueprint, cachedAt: new Date().toISOString(), ...meta };
  await withStore('readwrite', store => store.put(entry));
}

export async function deleteCached(key: string): Promise<void> {
  await withStore('readwrite', store => store.delete(key));
}

export async function listCached(): Promise<CacheEntry[]> {
  return withStore<CacheEntry[]>('readonly', store => store.getAll());
}

export async function cacheStats(): Promise<CacheStats> {
  const entries = await listCached();
  const active = entries.filter(entry => !isExpired(entry.cachedAt));
  if (!active.length) return { count: 0, oldestAt: null };
  const oldestAt = active.reduce((oldest, entry) => (entry.cachedAt < oldest ? entry.cachedAt : oldest), active[0].cachedAt);
  return { count: active.length, oldestAt };
}

export async function clearCache(): Promise<void> {
  await withStore('readwrite', store => store.clear());
}
