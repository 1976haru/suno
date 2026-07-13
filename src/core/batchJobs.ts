import type { BatchRequestSpec } from '../providers/batchAnthropic';
import type { ChannelProfile, GenerationOptions, PlaylistBlueprint, PlaylistIdentity, PreassignedSongSlot, ProviderType } from '../types';

const DB_NAME = 'suno-weaver-batch';
const DB_VERSION = 1;
const STORE = 'jobs';

/**
 * TASK E2 (v3.5) — a batch job can take minutes to ~24 hours (Anthropic
 * gives no hard SLA shorter than that), so it must survive the browser
 * being closed and reopened. This is the persistence layer; polling logic
 * lives in hooks/useBatchGenerationFlow.ts.
 *
 * TASK B4 (v3.6): 'canceling' covers the window between the user asking to
 * cancel and Anthropic actually reaching a terminal batch status — canceled
 * requests keep completing until then, so ending the job immediately would
 * throw away work that's already paid for. 'canceled_with_partial_results'
 * is the terminal state once whatever finished before cancellation lands.
 */
export type BatchJobStatus =
  | 'submitting'
  | 'in_progress'
  | 'canceling'
  | 'ended'
  | 'failed'
  | 'canceled'
  | 'canceled_with_partial_results';

/**
 * TASK B1 (v3.6) — everything a resumed or re-polled job needs to behave
 * exactly as it did at submission time, regardless of what the channel
 * setup screen currently shows. Deliberately excludes the API key (and all
 * of ProviderSettings) — that's re-read from settingsStore at resume time,
 * never persisted here (see hooks/useBatchGenerationFlow.ts).
 */
export interface BatchJobSnapshot {
  options: GenerationOptions;
  channel: ChannelProfile;
  genreIds: string[];
  moodIds: string[];
  seasonId: string;
  providerType: ProviderType;
  model?: string;
  temperature: number;
  /** TASK B2 (v3.6) — the exact title/hook/role/tempo/emotionArc assignment every sub-batch was pinned to; resuming must reuse it, not recompute a fresh (differently-seeded) one. */
  preassignedSlots: PreassignedSongSlot[];
  lockedIdentity: PlaylistIdentity | null;
}

export interface BatchJobRecord {
  id: string;
  channelId: string;
  projectTitle: string;
  createdAt: string;
  status: BatchJobStatus;
  anthropicBatchId?: string;
  requests: BatchRequestSpec[];
  totalSongCount: number;
  errorMessage?: string;
  resultBlueprint?: PlaylistBlueprint;
  failedBatchIndexes?: number[];
  /** TASK B3 (v3.6) — trackNos absent from the stitched result after validateStitched(); surfaced in the UI with a per-track regenerate action. */
  missingTrackNos?: number[];
  lastPolledAt?: string;
  /** Set on a job created by retryFailed() to resubmit only the sub-batches that errored in a parent job. */
  parentJobId?: string;
  snapshot: BatchJobSnapshot;
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

function randomId() {
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createBatchJob(input: {
  channelId: string;
  projectTitle: string;
  totalSongCount: number;
  requests: BatchRequestSpec[];
  snapshot: BatchJobSnapshot;
}): Promise<BatchJobRecord> {
  const record: BatchJobRecord = {
    id: randomId(),
    channelId: input.channelId,
    projectTitle: input.projectTitle,
    createdAt: new Date().toISOString(),
    status: 'submitting',
    requests: input.requests,
    totalSongCount: input.totalSongCount,
    snapshot: input.snapshot
  };
  await withStore('readwrite', store => store.put(record));
  return record;
}

/**
 * TASK B1 (v3.6) — compares the settings a batch job actually started with
 * against what the channel setup screen currently shows, so the UI can warn
 * "this batch will finish under its original settings" instead of silently
 * implying the current screen controls an in-flight job.
 */
export function describeSnapshotMismatch(snapshot: BatchJobSnapshot, currentOpts: GenerationOptions): string | null {
  const diffs: string[] = [];
  if (snapshot.seasonId !== currentOpts.seasonId) diffs.push(`시즌: ${snapshot.seasonId} → ${currentOpts.seasonId}`);
  if (snapshot.options.lyricLanguage !== currentOpts.lyricLanguage) diffs.push(`가사 언어: ${snapshot.options.lyricLanguage} → ${currentOpts.lyricLanguage}`);
  if (snapshot.channel.id !== currentOpts.channel.id) diffs.push(`채널: ${snapshot.channel.name} → ${currentOpts.channel.name}`);
  return diffs.length
    ? `이 배치는 다른 설정으로 시작됐습니다 (${diffs.join(', ')}). 배치는 생성 당시 설정으로 완료됩니다.`
    : null;
}

export async function updateBatchJob(id: string, patch: Partial<BatchJobRecord>): Promise<BatchJobRecord | undefined> {
  const existing = await getBatchJob(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  await withStore('readwrite', store => store.put(updated));
  return updated;
}

export async function getBatchJob(id: string): Promise<BatchJobRecord | undefined> {
  return withStore<BatchJobRecord | undefined>('readonly', store => store.get(id));
}

export async function listBatchJobs(channelId: string): Promise<BatchJobRecord[]> {
  const all = await withStore<BatchJobRecord[]>('readonly', store => store.getAll());
  return all.filter(job => job.channelId === channelId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Jobs still worth polling on app reopen. */
export async function listActiveBatchJobs(channelId: string): Promise<BatchJobRecord[]> {
  const jobs = await listBatchJobs(channelId);
  return jobs.filter(job => job.status === 'submitting' || job.status === 'in_progress' || job.status === 'canceling');
}

export async function deleteBatchJob(id: string): Promise<void> {
  await withStore('readwrite', store => store.delete(id));
}
