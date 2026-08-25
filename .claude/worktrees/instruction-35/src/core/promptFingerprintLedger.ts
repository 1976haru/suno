import type { PlaylistBlueprint, WorkspaceId } from '../types';
import { currentWorkspaceId, DEFAULT_WORKSPACE_ID, matchesLedgerScope, scopeFilter, type LedgerScope } from './workspaceScope';
import { resolveWorkspaceIdForChannel } from './channelWorkspaceResolution';

/**
 * codex 지시문 02 (TASK K) — mirrors core/situationLedger.ts's own
 * openDb/withStore/recordPackX/recentX shape exactly (same real "grouped by
 * SET, most-recent-N-sets-first" windowing — see that file's own
 * recentSituations doc comment). A separate store from situationLedger.ts:
 * a fingerprint is a different lifecycle question ("was this STRUCTURAL
 * recipe already used, in the last N sets") than a scene, and the two
 * windows (10-set fingerprint / 5-set arrangement recipe) are independently
 * sized — see this file's own recentFingerprints/recentArrangementRecipes
 * doc comments for why they differ.
 */
const DB_NAME = 'suno-weaver-prompt-fingerprints';
const DB_VERSION = 1;
const STORE = 'usage';

export interface FingerprintUsage {
  /** `${workspaceId}::${packId}:${trackNo}` — same id shape as situationLedger.ts's SituationUsage, same reason (forgetPack needs every record for a pack without a secondary index). */
  id: string;
  promptFingerprint?: string;
  arrangementRecipe?: string;
  channelId: string;
  usedAt: string;
  packId: string;
  trackNo: number;
  /** 지시문 14 (TASK C-3) — 'unknown' is a real third value; see situationLedger.ts's SituationUsage.workspaceId for the full rationale (identical here). */
  workspaceId?: WorkspaceId | 'unknown';
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

async function allRecords(): Promise<FingerprintUsage[]> {
  const all = await withStore<FingerprintUsage[]>('readonly', store => store.getAll());
  return scopeFilter(all);
}

/**
 * Idempotent, same convention as situationLedger.ts's recordPackSituations:
 * clears this pack's own prior entries first. Only records a song that has
 * at least one of the two fingerprint fields (a song reconciled with no
 * matching slot has neither — see types.ts's SongIdea.promptFingerprint
 * doc comment — and contributes nothing rather than a misleading blank row).
 */
export async function recordPackFingerprints(packId: string, channelId: string, blueprint: PlaylistBlueprint): Promise<void> {
  await forgetPack(packId);
  const now = new Date().toISOString();
  for (const song of blueprint.songs) {
    if (!song.promptFingerprint && !song.arrangementRecipe) continue;
    const record: FingerprintUsage = {
      id: `${currentWorkspaceId()}::${packId}:${song.trackNo}`,
      promptFingerprint: song.promptFingerprint,
      arrangementRecipe: song.arrangementRecipe,
      channelId,
      usedAt: now,
      packId,
      trackNo: song.trackNo,
      workspaceId: currentWorkspaceId()
    };
    await withStore('readwrite', store => store.put(record));
  }
}

export async function forgetPack(packId: string): Promise<void> {
  const all = await allRecords();
  const ids = all.filter(u => u.packId === packId).map(u => u.id);
  for (const id of ids) {
    await withStore('readwrite', store => store.delete(id));
  }
}

/** Same scoped-delete rationale as situationLedger.ts's clearAllSituationHistory: "전체 삭제" only ever means the CURRENT workspace's own packs. */
export async function clearAllFingerprintHistory(): Promise<void> {
  const all = await allRecords();
  for (const record of all) {
    await withStore('readwrite', store => store.delete(record.id));
  }
}

function recentSetValues(all: FingerprintUsage[], scope: LedgerScope, setLimit: number, pick: (u: FingerprintUsage) => string | undefined): string[] {
  const scoped = all.filter(u => matchesLedgerScope(u, scope));
  const packOrder = Array.from(new Set(scoped.slice().sort((a, b) => (a.usedAt < b.usedAt ? 1 : -1)).map(u => u.packId)));
  const recentPackIds = new Set(packOrder.slice(0, setLimit));
  return scoped.filter(u => recentPackIds.has(u.packId)).map(pick).filter((v): v is string => Boolean(v));
}

/**
 * "최근 10세트" — the full 8-axis fingerprint is the stricter signal
 * ("this is essentially the same song"), so it gets the wider window: a
 * match against anything in the last 10 sets is worth flagging.
 */
export async function recentFingerprints(scope: LedgerScope, setLimit = 10): Promise<string[]> {
  const all = await allRecords();
  return recentSetValues(all, scope, setLimit, u => u.promptFingerprint);
}

/**
 * "최근 5세트" — the arrangement recipe alone (intro/density/instruments,
 * no genre/chords/hook) is a real but lesser signal — two legitimately
 * different songs can share a production approach — so it only looks back
 * half as far as the full fingerprint above, per this task's own spec.
 */
export async function recentArrangementRecipes(scope: LedgerScope, setLimit = 5): Promise<string[]> {
  const all = await allRecords();
  return recentSetValues(all, scope, setLimit, u => u.arrangementRecipe);
}

/** v4.1 (TASK A2) — export-oriented read for one explicit workspace regardless of the current one, matching the other 3 ledgers' own listAll*ForWorkspace shape (this ledger never had one until now). */
export async function listAllFingerprintsForWorkspace(workspaceId: WorkspaceId): Promise<FingerprintUsage[]> {
  const all = await withStore<FingerprintUsage[]>('readonly', store => store.getAll());
  return scopeFilter(all, workspaceId);
}

/**
 * 지시문 14 (TASK C-3) — this ledger never had a workspace-tag migration at
 * all (only situationLedger/hookLedger/lyricLineLedger did, from v4.0/v5.22)
 * — a real gap, since every FingerprintUsage record has carried an optional
 * `workspaceId` since this ledger's own codex 지시문 02 introduction, exactly
 * like the other 3. Same additive-only/idempotent contract, same
 * channelId -> archetype -> workspace resolution as the other 3 ledgers' own
 * migrate*WorkspaceTags — see situationLedger.ts's own doc comment for the
 * full rationale.
 */
export async function migrateFingerprintLedgerWorkspaceTags(): Promise<{ totalRecords: number; taggedSeniorOldpop: number; taggedUnknown: number }> {
  const all = await withStore<FingerprintUsage[]>('readonly', store => store.getAll());
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

export function isDuplicateFingerprint(fingerprint: string | undefined, recent: string[]): boolean {
  return Boolean(fingerprint) && recent.includes(fingerprint!);
}

export function isDuplicateArrangementRecipe(recipe: string | undefined, recent: string[]): boolean {
  return Boolean(recipe) && recent.includes(recipe!);
}
