import type { LyricLanguage, PlaylistBlueprint, WorkspaceId } from '../types';
import { currentWorkspaceId, DEFAULT_WORKSPACE_ID, matchesLedgerScope, scopeFilter, type LedgerScope } from './workspaceScope';
import { resolveWorkspaceIdForChannel } from './channelWorkspaceResolution';

/**
 * v5.22 (AXIS 1, TASK B §1-6) — same real gap situationLedger.ts's own doc
 * comment describes for scenes, one layer deeper: even when two sets'
 * scenes/themes differ, the actual WRITTEN sentences can still collide
 * verbatim — a real audit found 28 exact-match (25+ char) lines shared
 * between two concept-distinct sets ("a chair scraped back for my brother",
 * "a dish went sailing hand to hand", ...). This ledger is the memory a
 * later generation's avoid-list and Gate 2's blocking check both read from
 * (see core/multiSetImportInspection.ts / the bridge instruction's own
 * recent-lines list).
 *
 * Only lines >= 25 chars are recorded — deliberately excludes short lines
 * (a 6-word hook-length line has a real chance of legitimately recurring
 * across unrelated songs; hookLedger.ts already owns hook-phrase collision
 * detection specifically) and excludes the hookPhrase itself (repeating the
 * chorus hook within one song is by design, not a defect this ledger should
 * ever flag).
 */
const DB_NAME = 'suno-weaver-lyric-lines';
const DB_VERSION = 1;
const STORE = 'usage';

export interface LyricLineUsage {
  /** `${workspaceId}::${packId}:${trackNo}:${lineIndex}` — one record per qualifying line, so a single song can contribute more than one. */
  id: string;
  line: string;
  channelId: string;
  language: LyricLanguage;
  usedAt: string;
  packId: string;
  trackNo: number;
  /** This line's own index within its song's qualifying-line list — a real field (not parsed back out of `id`) so putLyricLineRecord can reconstruct `id` the same deterministic way recordPackLyricLines does, matching hookLedger.ts's putHookRecord contract. */
  lineIndex: number;
  /** 지시문 14 (TASK C-3) — 'unknown' is a real third value; see situationLedger.ts's SituationUsage.workspaceId for the full rationale (identical here). */
  workspaceId?: WorkspaceId | 'unknown';
}

/** Minimum length (chars, trimmed) for a lyric line to be worth remembering — see this file's own header doc comment. */
export const LYRIC_LINE_MIN_LENGTH = 25;

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

async function allRecords(): Promise<LyricLineUsage[]> {
  const all = await withStore<LyricLineUsage[]>('readonly', store => store.getAll());
  return scopeFilter(all);
}

/**
 * Pure — extracts every body line >= LYRIC_LINE_MIN_LENGTH chars from a raw
 * lyrics block, excluding Suno section tags (`[chorus]`), a leading
 * `Title:` line (bridge-agent output sometimes prepends one), and the
 * song's own hookPhrase (see this file's header doc comment on why the
 * chorus hook is never flagged as a collision with itself).
 */
export function extractQualifyingLines(lyrics: string, hookPhrase: string): string[] {
  const hookNormalized = hookPhrase.trim().toLowerCase();
  return lyrics
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('[') && !line.toLowerCase().startsWith('title:'))
    .filter(line => line.length >= LYRIC_LINE_MIN_LENGTH)
    .filter(line => line.toLowerCase() !== hookNormalized);
}

/** Idempotent, same convention as hookLedger.ts's recordPackHooks — clears this pack's own prior entries first. */
export async function recordPackLyricLines(packId: string, channelId: string, blueprint: PlaylistBlueprint, language: LyricLanguage): Promise<void> {
  await forgetPack(packId);
  const now = new Date().toISOString();
  for (const song of blueprint.songs) {
    const lines = extractQualifyingLines(song.lyrics, song.hookPhrase);
    for (const [lineIndex, line] of lines.entries()) {
      const record: LyricLineUsage = {
        id: `${currentWorkspaceId()}::${packId}:${song.trackNo}:${lineIndex}`,
        line,
        channelId,
        language,
        usedAt: now,
        packId,
        trackNo: song.trackNo,
        lineIndex,
        workspaceId: currentWorkspaceId()
      };
      await withStore('readwrite', store => store.put(record));
    }
  }
}

export async function forgetPack(packId: string): Promise<void> {
  const all = await allRecords();
  const ids = all.filter(u => u.packId === packId).map(u => u.id);
  for (const id of ids) {
    await withStore('readwrite', store => store.delete(id));
  }
}

/** v5.22 (AXIS 1) — same scoped-delete rationale as hookLedger.ts's clearAllHookHistory: "전체 삭제" only ever means the CURRENT workspace's own packs. */
export async function clearAllLyricLineHistory(): Promise<void> {
  const all = await allRecords();
  for (const record of all) {
    await withStore('readwrite', store => store.delete(record.id));
  }
}

/** v5.22 (AXIS 1 §1-6) — "최근 5세트", grouped by SET (packId) — see situationLedger.ts's recentSituations for the identical grouping reasoning. */
export async function recentLyricLines(scope: LedgerScope, language: LyricLanguage, setLimit = 5): Promise<string[]> {
  const all = await allRecords();
  const scoped = all.filter(u => matchesLedgerScope(u, scope) && u.language === language);
  const packOrder = Array.from(new Set(scoped.slice().sort((a, b) => (a.usedAt < b.usedAt ? 1 : -1)).map(u => u.packId)));
  const recentPackIds = new Set(packOrder.slice(0, setLimit));
  return scoped.filter(u => recentPackIds.has(u.packId)).map(u => u.line);
}

export async function listAllLyricLinesForWorkspace(workspaceId: WorkspaceId): Promise<LyricLineUsage[]> {
  const all = await withStore<LyricLineUsage[]>('readonly', store => store.getAll());
  return scopeFilter(all, workspaceId);
}

/** v5.22 (AXIS 1, A2 import primitive) — same union-merge/id-reconstruction contract as hookLedger.ts's putHookRecord. */
export async function putLyricLineRecord(record: LyricLineUsage): Promise<void> {
  const workspaceId = currentWorkspaceId();
  const stamped: LyricLineUsage = { ...record, workspaceId, id: `${workspaceId}::${record.packId}:${record.trackNo}:${record.lineIndex}` };
  await withStore('readwrite', store => store.put(stamped));
}

/**
 * v5.22 (AXIS 1, migration) — same shape/contract as core/library.ts's
 * migrateLibraryWorkspaceTags: additive-only, idempotent.
 *
 * 지시문 14 (TASK C-3) — now resolves each untagged record's own channelId
 * first — see situationLedger.ts's own migrateSituationLedgerWorkspaceTags
 * doc comment for the full rationale (identical fix here).
 */
export async function migrateLyricLineLedgerWorkspaceTags(): Promise<{ totalRecords: number; taggedSeniorOldpop: number; taggedUnknown: number }> {
  const all = await withStore<LyricLineUsage[]>('readonly', store => store.getAll());
  let taggedSeniorOldpop = 0;
  let taggedUnknown = 0;
  for (const record of all) {
    const finalWorkspaceId = record.workspaceId ?? resolveWorkspaceIdForChannel(record.channelId) ?? 'unknown';
    if (finalWorkspaceId === DEFAULT_WORKSPACE_ID) taggedSeniorOldpop += 1;
    if (finalWorkspaceId === 'unknown') taggedUnknown += 1;
    if (!record.workspaceId) await withStore('readwrite', store => store.put({ ...record, workspaceId: finalWorkspaceId }));
  }
  return { totalRecords: all.length, taggedSeniorOldpop, taggedUnknown };
}
