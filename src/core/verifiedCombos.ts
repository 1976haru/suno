import type { WorkspaceId } from '../types';
import type { RatingRecord } from './ratingLedger';
import { currentWorkspaceId, DEFAULT_WORKSPACE_ID, scopeFilter } from './workspaceScope';
import { SEED_VERIFIED_COMBOS, type VerifiedCombo } from '../data/verifiedCombos';

/**
 * v3.82 (TASK A) — IndexedDB-backed store for user-APPROVED verified combos
 * (never auto-registered — see suggestCombosFromRatings's own doc comment),
 * mirrors core/ratingLedger.ts's own openDb/withStore shape exactly. A
 * separate database from suno-weaver-library/suno-weaver-ratings, same
 * reasoning as ratingLedger.ts's own doc comment: deleting a saved pack must
 * never delete a combo the user already approved.
 */

const DB_NAME = 'suno-weaver-verified-combos';
const DB_VERSION = 1;
const STORE = 'approvedCombos';

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

/** Persists a combo the user explicitly approved from a suggestion (see suggestCombosFromRatings) — this task's own "자동 등록하지 말 것. 제안하고 하루님이 승인하게 하십시오" means this is the ONLY write path; nothing in this module calls it automatically. */
export async function approveCombo(combo: VerifiedCombo): Promise<void> {
  await withStore('readwrite', store => store.put({ ...combo, workspaceId: combo.workspaceId ?? currentWorkspaceId() }));
}

export async function removeApprovedCombo(id: string): Promise<void> {
  await withStore('readwrite', store => store.delete(id));
}

export async function getApprovedCombos(workspaceId?: WorkspaceId): Promise<VerifiedCombo[]> {
  const all = await withStore<VerifiedCombo[]>('readonly', store => store.getAll());
  return scopeFilter(all, workspaceId ?? currentWorkspaceId());
}

// ---------------------------------------------------------------------------
// Pure logic — no IndexedDB below this line, so it's fully unit-testable
// (mirrors core/ratingAnalysis.ts's own "pure analysis, storage stays at the
// edge" split).
// ---------------------------------------------------------------------------

/** Seed combos (src/data/verifiedCombos.ts) + whatever the user has approved, scoped to one workspace. Seed entries win ties (checked first) since they're the ones this task's own §0 measurement directly backs. */
export function effectiveVerifiedCombos(workspaceId: WorkspaceId, approved: readonly VerifiedCombo[]): VerifiedCombo[] {
  const seedIds = new Set(SEED_VERIFIED_COMBOS.map(combo => combo.id));
  return [
    ...SEED_VERIFIED_COMBOS.filter(combo => combo.workspaceId === workspaceId),
    ...approved.filter(combo => combo.workspaceId === workspaceId && !seedIds.has(combo.id))
  ];
}

const FLAGSHIP_MIN_SAMPLE_SIZE = 3;

/**
 * TASK A (1-3) — "대표곡(2~3번) 배정 시 verdict==='good' 이고 sampleSize>=3인
 * 조합을 우선 배정." Picks the single best candidate (highest sampleSize,
 * `verdict:'bad'` entries never considered) whose genreId is actually
 * available in this channel's own genre pool — a combo can't be assigned if
 * the channel doesn't carry that genre at all. Returns undefined when
 * nothing qualifies (e.g. a workspace with no verified-good combo yet, or
 * none of its genreIds match this channel).
 */
export function resolveFlagshipCombo(effectiveCombos: readonly VerifiedCombo[], availableGenreIds: readonly string[]): VerifiedCombo | undefined {
  const availableSet = new Set(availableGenreIds);
  return effectiveCombos
    .filter(combo => combo.verdict === 'good' && combo.sampleSize >= FLAGSHIP_MIN_SAMPLE_SIZE && availableSet.has(combo.genreId))
    .sort((a, b) => b.sampleSize - a.sampleSize)[0];
}

export interface ComboSuggestion {
  genreId: string;
  bpmRange: [number, number];
  sampleSize: number;
  goodShare: number;
  suggestedVerdict: 'good' | 'bad';
  reasonKo: string;
}

const SUGGESTION_MIN_SAMPLE = 5;
const SUGGESTION_GOOD_THRESHOLD = 0.7;
const SUGGESTION_BAD_THRESHOLD = 0.3;
/** Matches this file's own bpmRange granularity (senior-philly-81 spans 8) — wide enough that a real pack's per-genre BPM spread (v3.77+ targets stddev >= 8) still lands multiple ratings in the same bucket, narrow enough to stay a meaningful "combo", not "this genre at any tempo". */
const BPM_BUCKET_WIDTH = 8;

function bpmBucket(bpm: number): [number, number] {
  const low = Math.floor(bpm / BPM_BUCKET_WIDTH) * BPM_BUCKET_WIDTH;
  return [low, low + BPM_BUCKET_WIDTH - 1];
}

/**
 * TASK A (1-4) — "sampleSize >= 5 이고 좋음 비율 >= 70% → good 후보로 제안,
 * <= 30% → bad 후보로 제안. 자동 등록하지 마십시오." Groups already-recorded
 * ratings (core/ratingLedger.ts) by (genreId, 8-BPM-wide bucket) — vocal
 * type deliberately excluded from the grouping key, since this task's own
 * §0-1 finding is that vocal gender was a confound, not a real axis (T7).
 * Never returns a suggestion for a (genreId, bpmRange) pair that's already
 * in `existingCombos` (seeded or previously approved) — nothing to suggest
 * twice. Pure — the caller loads ratings via core/ratingLedger.ts's
 * getRatings/listAllRatingsForWorkspace.
 */
function bpmRangesOverlap(a: readonly [number, number], b: readonly [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

export function suggestCombosFromRatings(
  ratings: readonly RatingRecord[],
  workspaceId: WorkspaceId,
  existingCombos: readonly VerifiedCombo[]
): ComboSuggestion[] {
  const scoped = ratings.filter(record => (record.workspaceId ?? DEFAULT_WORKSPACE_ID) === workspaceId && record.attributes.genreId && record.attributes.bpm);

  const groups = new Map<string, { genreId: string; bpmRange: [number, number]; records: RatingRecord[] }>();
  for (const record of scoped) {
    const bucket = bpmBucket(record.attributes.bpm);
    const key = `${record.attributes.genreId}|${bucket[0]}`;
    const group = groups.get(key) ?? { genreId: record.attributes.genreId, bpmRange: bucket, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }

  const suggestions: ComboSuggestion[] = [];
  for (const group of groups.values()) {
    // A group already covered by an existing (seed or approved) combo for
    // the SAME genre with an OVERLAPPING bpm range is skipped — seed combos
    // don't necessarily align to this function's own 8-BPM bucket grid (e.g.
    // senior-philly-81 spans 78-86), so an exact bucket-start match would
    // miss real overlaps; range overlap is the correct test.
    if (existingCombos.some(combo => combo.genreId === group.genreId && bpmRangesOverlap(combo.bpmRange, group.bpmRange))) continue;
    const sampleSize = group.records.length;
    if (sampleSize < SUGGESTION_MIN_SAMPLE) continue;
    const goodCount = group.records.filter(r => r.rating === 'good').length;
    const goodShare = goodCount / sampleSize;
    if (goodShare >= SUGGESTION_GOOD_THRESHOLD) {
      suggestions.push({
        genreId: group.genreId,
        bpmRange: group.bpmRange,
        sampleSize,
        goodShare,
        suggestedVerdict: 'good',
        reasonKo: `${sampleSize}곡 중 ${goodCount}곡(${Math.round(goodShare * 100)}%) 좋음 — 검증된 조합으로 등록을 제안합니다.`
      });
    } else if (goodShare <= SUGGESTION_BAD_THRESHOLD) {
      suggestions.push({
        genreId: group.genreId,
        bpmRange: group.bpmRange,
        sampleSize,
        goodShare,
        suggestedVerdict: 'bad',
        reasonKo: `${sampleSize}곡 중 좋음 ${Math.round(goodShare * 100)}%뿐 — 피해야 할 조합으로 등록을 제안합니다.`
      });
    }
  }
  return suggestions.sort((a, b) => b.sampleSize - a.sampleSize);
}

/** Turns an approved-or-seeded ComboSuggestion into a real VerifiedCombo record — the one conversion step approveCombo's caller (the suggestion-approval UI) needs. */
export function verifiedComboFromSuggestion(suggestion: ComboSuggestion, workspaceId: WorkspaceId): VerifiedCombo {
  const [low, high] = suggestion.bpmRange;
  return {
    id: `${workspaceId}-${suggestion.genreId}-${low}-${suggestion.suggestedVerdict}`,
    workspaceId,
    genreId: suggestion.genreId,
    bpmRange: suggestion.bpmRange,
    verdict: suggestion.suggestedVerdict,
    sampleSize: suggestion.sampleSize,
    sampleTracks: [],
    verifiedAt: new Date().toISOString().slice(0, 10),
    noteKo: `평가 데이터 기반 자동 제안 (${low}~${high} BPM, 좋음 비율 ${Math.round(suggestion.goodShare * 100)}%) — 하루님 승인으로 등록됨.`,
    cautionsKo: []
  };
}

export { SEED_VERIFIED_COMBOS };
export type { VerifiedCombo };
