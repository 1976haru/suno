import type { ChannelArchetype, LyricLanguage, PlaylistBlueprint } from '../types';
import { hookPoolSize } from './lyricEngine';
import { forecastCapacity } from './capacityPlanner';

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

/**
 * Most-recent-first, capped — used to keep the "don't reuse these" list sent
 * to a remote LLM prompt from growing unbounded (token cost).
 *
 * TASK v3.33 — titles and hooks now have independent caps (titleLimit=100,
 * unchanged; hookLimit=500). Before this task both shared one `limit`
 * because hookMode='pool' made a hook's real collision-avoidance guarantee
 * come from the pool being pre-decided locally, not from this avoid-list —
 * the list was prompt-guidance only. hookMode='ai-creative' (new default,
 * see GenerationOptions.hookMode) makes this list hooks' *only* real
 * collision defense (besides the post-generation regenerate-on-collision
 * retry, see core/hookDedup.ts), so it needs deeper history than titles
 * ever did — 500 covers ~2.7 weeks at the 180-songs/week multi-set pace,
 * matched to a real cost/coverage tradeoff the user confirmed rather than
 * literally sending the channel's entire hook history on every request.
 */
export async function recentUsedTitlesAndHooks(
  channelId: string,
  language: LyricLanguage,
  options: { titleLimit?: number; hookLimit?: number } = {}
): Promise<{ titles: string[]; hooks: string[] }> {
  const { titleLimit = 100, hookLimit = 500 } = options;
  const all = await allRecords();
  const scoped = all
    .filter(u => u.channelId === channelId && u.language === language)
    .sort((a, b) => (a.usedAt < b.usedAt ? 1 : -1));
  return {
    titles: scoped.slice(0, titleLimit).map(u => u.title),
    hooks: scoped.slice(0, hookLimit).map(u => u.hook)
  };
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

export function hookPoolNeedsWarning(stats: ExhaustionStats): boolean {
  return stats.percentUsed >= 80 && stats.remaining > 0;
}

/**
 * v3.12 PART C-3 — a graduated screen shown at 90%+ usage, before the hard
 * exhaustion error (composeHook's "훅 풀이 소진되었습니다" throw, unchanged and
 * still correct at 100%). Deliberately a separate, higher threshold from
 * hookPoolNeedsWarning's existing 80% (that one was never wired to any UI;
 * this one gates a blocking screen, so it needs a tighter margin).
 */
export function hookPoolGraduatedWarning(stats: ExhaustionStats): boolean {
  return stats.percentUsed >= 90 && stats.remaining > 0;
}

export interface PackCapacityWarning {
  level: 'none' | 'yellow' | 'red';
  remainingBeforePack: number;
  remainingAfterPack: number;
  /** null when songCount <= 0 — no meaningful "packs worth" to project. */
  packsWorthAfter: number | null;
}

/**
 * v3.32 — per-pack-size warning for the songCount the user actually has
 * selected, shown in Step3 before generating. Distinct from
 * hookPoolGraduatedWarning's 90%-of-total-pool threshold (percent-based,
 * blind to how big *this* pack is): a large pack (e.g. 80 songs) can run out
 * of remaining hooks well before the channel's overall pool crosses 90%, so
 * this checks the pack size against the pool directly. red means this pack
 * alone would need more hooks than remain (some songs would fail to get a
 * hook); yellow means it would leave less than one more pack's worth of
 * headroom.
 */
export function packCapacityWarning(stats: ExhaustionStats, songCount: number): PackCapacityWarning {
  const remainingAfterPack = Math.max(0, stats.remaining - songCount);
  const level: PackCapacityWarning['level'] = stats.remaining < songCount
    ? 'red'
    : stats.remaining < songCount * 2
      ? 'yellow'
      : 'none';
  return {
    level,
    remainingBeforePack: stats.remaining,
    remainingAfterPack,
    packsWorthAfter: songCount > 0 ? Math.floor(remainingAfterPack / songCount) : null
  };
}

export interface ChannelCapacityForecast extends ExhaustionStats {
  /** null when there's not enough usage history yet (fewer than 2 recorded packs) to estimate a real pace. */
  weeksUntilExhaustion: number | null;
  /** Actual historical pace (songs/week), derived from real pack-generation date intervals — not a fixed assumption. */
  estimatedSongsPerWeek: number | null;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * v3.12 PART C-1 — "weeks until exhaustion" computed from this channel's own
 * real usage history (recordPackHooks' usedAt timestamps), not a generic
 * fixed-pace guess. Reuses forecastCapacity's per-HookShape bottleneck logic
 * (see capacityPlanner.ts) rather than a flat poolSize/pace division, since
 * that flat math is exactly what made the v3.11 showa-cafe finding look
 * inconsistent (see hookPoolSizeByShape's doc comment).
 *
 * Pure — kept separate from the IndexedDB read (same pattern as
 * exhaustionStats/usageLedger's summarizeUsage) so it's testable in Node
 * without a browser IndexedDB polyfill.
 */
export function computeCapacityForecast(records: Pick<HookUsage, 'usedAt'>[], language: LyricLanguage, archetype: ChannelArchetype | undefined, poolSize: number): ChannelCapacityForecast {
  const stats = exhaustionStats(records.length, poolSize);

  if (records.length < 2) {
    return { ...stats, weeksUntilExhaustion: null, estimatedSongsPerWeek: null };
  }

  const sortedTimes = records.map(u => new Date(u.usedAt).getTime()).sort((a, b) => a - b);
  const spanMs = sortedTimes[sortedTimes.length - 1] - sortedTimes[0];
  const weeksSpan = Math.max(spanMs / MS_PER_WEEK, 1 / 7); // guard against same-day packs (avoid divide-by-near-zero)
  const estimatedSongsPerWeek = records.length / weeksSpan;
  const forecast = forecastCapacity(archetype ?? 'senior-morning', language, estimatedSongsPerWeek);

  return {
    ...stats,
    estimatedSongsPerWeek,
    weeksUntilExhaustion: Number.isFinite(forecast.weeksAtCurrentPace) ? forecast.weeksAtCurrentPace : null
  };
}

export async function channelCapacityForecast(channelId: string, language: LyricLanguage, archetype?: ChannelArchetype): Promise<ChannelCapacityForecast> {
  const all = await allRecords();
  const scoped = all.filter(u => u.channelId === channelId && u.language === language);
  return computeCapacityForecast(scoped, language, archetype, hookPoolSize(language, archetype));
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
