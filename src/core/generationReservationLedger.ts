import type { LyricLanguage, WorkspaceId } from '../types';
import type { SceneSignature } from './situationLedger';
import { currentWorkspaceId, scopeFilter } from './workspaceScope';

/**
 * codex 지시문 01 (TASK I) — real gap this closes: "지시문만 복사하고 아직
 * 결과를 가져오지 않았거나 두 세션을 동시에 실행해도 중복을 막는다." Two
 * concurrent bridge-instruction copies for the SAME channel/language (one
 * tab still waiting on a paste-back, a second tab/session starts a fresh
 * copy) previously had no way to know about each other at all — each one's
 * own avoid-list only ever reflects what's already IMPORTED (real ledger
 * history), never a sibling generation that's merely in flight. This is a
 * lightweight reservation: one record per runId, holding the exact
 * titles/hooks/sceneSignatures that generation's own bridge instruction was
 * ALREADY told to avoid at copy time, so a concurrent copy for the same
 * scope can fold a sibling's own avoid-list in too, and so the app has a
 * real, inspectable "is there an in-flight generation for this channel"
 * signal (listActiveReservations) instead of none at all. Same IndexedDB
 * store-per-module/workspace-scoped pattern as every other ledger here.
 */
const DB_NAME = 'suno-weaver-generation-reservations';
const DB_VERSION = 1;
const STORE = 'reservations';
const RESERVATION_TTL_MS = 24 * 60 * 60 * 1000; // spec's own "24시간 후 만료"

export interface GenerationReservation {
  runId: string;
  workspaceId: WorkspaceId;
  channelId: string;
  language: LyricLanguage;
  titles: string[];
  hooks: string[];
  sceneSignatures: SceneSignature[];
  createdAt: string;
  expiresAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'runId' });
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

/**
 * "생성 시작/브릿지 복사 시 예약" — idempotent per runId (re-reserving the
 * same runId, e.g. copying the same not-yet-changed instruction a second
 * time, replaces rather than duplicates — same convention every other
 * ledger's own record* function already follows).
 */
export async function reserveGeneration(input: {
  runId: string;
  channelId: string;
  language: LyricLanguage;
  titles: string[];
  hooks: string[];
  sceneSignatures: SceneSignature[];
  workspaceId?: WorkspaceId;
}): Promise<void> {
  const workspaceId = input.workspaceId ?? currentWorkspaceId();
  const now = Date.now();
  const record: GenerationReservation = {
    runId: input.runId,
    workspaceId,
    channelId: input.channelId,
    language: input.language,
    titles: input.titles,
    hooks: input.hooks,
    sceneSignatures: input.sceneSignatures,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + RESERVATION_TTL_MS).toISOString()
  };
  await withStore('readwrite', store => store.put(record));
}

/** "취소 시 해제" AND "정상 import 후 실제 이력으로 승격" — both are the same operation: the reservation's only job was to stand in until the real ledger (hookLedger/situationLedger) has the data, or until the attempt is abandoned. Never throws on a missing runId (already released/expired/never existed — deleting a non-existent key is a safe no-op). */
export async function releaseReservation(runId: string): Promise<void> {
  await withStore('readwrite', store => store.delete(runId));
}

async function allRecords(workspaceId?: WorkspaceId): Promise<GenerationReservation[]> {
  const all = await withStore<GenerationReservation[]>('readonly', store => store.getAll());
  return scopeFilter(all, workspaceId);
}

// ---------------------------------------------------------------------------
// Pure logic — no IndexedDB below this line (mirrors every other ledger's
// own "storage stays at the edge" split).
// ---------------------------------------------------------------------------

/** Pure — the actual expiry test, kept separate from the IndexedDB read so it's directly unit-testable (same convention core/apiCache.ts's own isExpired follows). */
export function isReservationExpired(reservation: Pick<GenerationReservation, 'expiresAt'>, now: number = Date.now()): boolean {
  return new Date(reservation.expiresAt).getTime() <= now;
}

/** Pure filter: same-scope (channelId + language), not expired, and — spec's own "같은 runId 재시도는 자신의 예약과 충돌하지 않음" — never includes the caller's own runId. */
export function filterActiveReservations(
  all: readonly GenerationReservation[],
  scope: { channelId: string; language: LyricLanguage; excludeRunId?: string },
  now: number = Date.now()
): GenerationReservation[] {
  return all.filter(reservation =>
    reservation.channelId === scope.channelId &&
    reservation.language === scope.language &&
    reservation.runId !== scope.excludeRunId &&
    !isReservationExpired(reservation, now)
  );
}

export async function listActiveReservations(
  channelId: string,
  language: LyricLanguage,
  excludeRunId?: string,
  workspaceId: WorkspaceId = currentWorkspaceId()
): Promise<GenerationReservation[]> {
  const all = await allRecords(workspaceId);
  return filterActiveReservations(all, { channelId, language, excludeRunId });
}

/** Pure merge — the real consumption shape a caller folds into its own avoid-list (title/hook dedup) alongside the real ledger history. */
export function mergeReservedAvoidLists(reservations: readonly GenerationReservation[]): { titles: string[]; hooks: string[]; sceneSignatures: SceneSignature[] } {
  return {
    titles: reservations.flatMap(r => r.titles),
    hooks: reservations.flatMap(r => r.hooks),
    sceneSignatures: reservations.flatMap(r => r.sceneSignatures)
  };
}

/** The one real entry point a caller wanting "every sibling in-flight generation's own avoid-list, merged" should use instead of orchestrating listActiveReservations + mergeReservedAvoidLists itself. */
export async function reservedAvoidLists(
  channelId: string,
  language: LyricLanguage,
  excludeRunId?: string,
  workspaceId: WorkspaceId = currentWorkspaceId()
): Promise<{ titles: string[]; hooks: string[]; sceneSignatures: SceneSignature[] }> {
  const active = await listActiveReservations(channelId, language, excludeRunId, workspaceId);
  return mergeReservedAvoidLists(active);
}
