import { useCallback, useRef, useState } from 'react';
import {
  buildBatchRequestSpecs,
  cancelBatchJob,
  fetchBatchJobResults,
  fetchLockedIdentityForBatch,
  pollBatchJobStatus,
  submitBatchJob
} from '../providers/batchAnthropic';
import {
  createBatchJob,
  getBatchJob,
  listActiveBatchJobs,
  updateBatchJob,
  type BatchJobRecord,
  type BatchJobSnapshot
} from '../core/batchJobs';
import { preallocateSongSlots } from '../core/batchPreallocation';
import { stitchBatchResults, validateStitched } from '../core/batchStitcher';
import { scoreSongs } from '../core/quality';
import { recentUsedTitlesAndHooks } from '../core/hookLedger';
import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, PlaylistIdentity, ProviderSettings, SeasonPack } from '../types';

// Anthropic gives no hard SLA under 24h, even though most batches finish in
// minutes — never assert a shorter guarantee in UI copy that reads this.
const POLL_INTERVAL_MS = 45_000;
// TASK B4 (v3.6) — slower cadence while waiting for a cancel request to
// actually land (Anthropic goes 'canceling' -> 'ended', not instant), since
// there's no new content to show the user in between checks.
const CANCEL_POLL_INTERVAL_MS = 30_000;

/**
 * TASK E2 (v3.5) — Batch API mode: submit once, poll until done, survive a
 * closed browser tab. This hook only manages Anthropic's Message Batches
 * lifecycle (create/poll/fetch/cancel/retry) and IndexedDB persistence; the
 * resulting blueprint is handed back to the caller via onComplete exactly
 * like the synchronous useGenerationFlow does, so downstream autosave/
 * thumbnail logic in App.tsx doesn't need to know which path produced it.
 *
 * TASK B1 (v3.6): every job in flight is driven off job.snapshot, never the
 * live opts the channel setup screen currently shows — optsRef exists only
 * as a same-tick cache of each job's own snapshot.options, not a shared
 * "current settings" value.
 */
export function useBatchGenerationFlow() {
  const [activeJob, setActiveJob] = useState<BatchJobRecord | null>(null);
  const [error, setError] = useState('');
  const pollTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const optsRef = useRef<Map<string, GenerationOptions>>(new Map());
  const settingsRef = useRef<Map<string, ProviderSettings>>(new Map());
  const onCompleteRef = useRef<Map<string, (blueprint: PlaylistBlueprint, opts: GenerationOptions) => void>>(new Map());
  /** TASK v3.33 — optional per-job failure callback, so a caller that needs to await a specific job's outcome as a Promise (e.g. hooks/useMultiSetGenerationFlow.ts's sequential per-set batch submission) can reject instead of hanging forever when a job ends in a terminal failure state. Single-pack callers (App.tsx) don't pass one — they already show failure via activeJob.status/error in the existing BatchJobPanel UI, unchanged. */
  const onErrorRef = useRef<Map<string, (message: string) => void>>(new Map());

  function stopPolling(jobId: string) {
    const timer = pollTimers.current.get(jobId);
    if (timer) clearTimeout(timer);
    pollTimers.current.delete(jobId);
  }

  const schedulePoll = useCallback((jobId: string) => {
    stopPolling(jobId);
    const timer = setTimeout(() => void pollOnce(jobId), POLL_INTERVAL_MS);
    pollTimers.current.set(jobId, timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleCancelPoll = useCallback((jobId: string) => {
    stopPolling(jobId);
    const timer = setTimeout(() => void pollUntilCanceled(jobId), CANCEL_POLL_INTERVAL_MS);
    pollTimers.current.set(jobId, timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pollOnce(jobId: string) {
    const job = await getBatchJob(jobId);
    const opts = optsRef.current.get(jobId);
    const settings = settingsRef.current.get(jobId);
    if (!job || !job.anthropicBatchId || !opts || !settings) return;
    if (job.status !== 'in_progress' && job.status !== 'submitting') return;

    try {
      const status = await pollBatchJobStatus(job.anthropicBatchId, settings);
      await updateBatchJob(jobId, { lastPolledAt: new Date().toISOString() });

      if (status.status !== 'ended' && status.status !== 'canceled' && status.status !== 'expired') {
        const refreshed = await getBatchJob(jobId);
        if (refreshed) setActiveJob(refreshed);
        schedulePoll(jobId);
        return;
      }

      if (status.status === 'canceled' || status.status === 'expired') {
        const errorMessage = status.status === 'expired' ? '배치 작업이 24시간 내에 끝나지 않았습니다.' : '배치 작업이 취소되었습니다.';
        const updated = await updateBatchJob(jobId, { status: status.status === 'canceled' ? 'canceled' : 'failed', errorMessage: status.status === 'expired' ? errorMessage : undefined });
        if (updated) setActiveJob(updated);
        onErrorRef.current.get(jobId)?.(errorMessage);
        return;
      }

      const results = await fetchBatchJobResults(job.anthropicBatchId, settings);
      if (!results.done) {
        schedulePoll(jobId);
        return;
      }
      // TASK v3.27 (Part A3) — an AI-creative title isn't locally pre-decided
      // like hookPhrase is, so cross-pack title collisions are possible;
      // fetch the channel's title history fresh here (poll can resume after
      // a browser restart, with no in-memory avoid-set left from submit
      // time) so stitchBatchResults' dedup pass can catch them.
      const avoidTitles = await recentUsedTitlesAndHooks(job.channelId, opts.lyricLanguage).then(r => r.titles).catch(() => [] as string[]);
      const stitched = stitchBatchResults(opts, results.results, job.snapshot.preassignedSlots, avoidTitles);
      if (!stitched.blueprint) {
        const errorMessage = '모든 배치 요청이 실패했습니다.';
        const updated = await updateBatchJob(jobId, { status: 'failed', errorMessage, failedBatchIndexes: stitched.failedBatchIndexes });
        if (updated) setActiveJob(updated);
        onErrorRef.current.get(jobId)?.(errorMessage);
        return;
      }
      const scored = { ...stitched.blueprint, songs: scoreSongs(stitched.blueprint.songs, opts.channel, opts.lyricLanguage) };
      // TASK B3 (v3.6) — surface missing tracks instead of silently shipping a pack with holes.
      const validation = validateStitched(scored.songs, job.totalSongCount);
      const updated = await updateBatchJob(jobId, {
        status: 'ended',
        resultBlueprint: scored,
        failedBatchIndexes: stitched.failedBatchIndexes,
        missingTrackNos: validation.missingTrackNos.length ? validation.missingTrackNos : undefined
      });
      if (updated) {
        setActiveJob(updated);
        onCompleteRef.current.get(jobId)?.(scored, opts);
      }
    } catch (e) {
      // Transient network hiccup — keep polling rather than giving up, matching "batches can take hours" expectations.
      setError(e instanceof Error ? e.message : String(e));
      schedulePoll(jobId);
    }
  }

  /**
   * TASK B4 (v3.6) — after a cancel request, Anthropic keeps finishing
   * already-in-flight requests until the batch reaches a terminal status; this
   * keeps checking at a slower cadence and, once terminal, fetches and
   * stitches whatever completed before the cutoff instead of discarding it.
   */
  async function pollUntilCanceled(jobId: string) {
    const job = await getBatchJob(jobId);
    const opts = optsRef.current.get(jobId);
    const settings = settingsRef.current.get(jobId);
    if (!job || !job.anthropicBatchId || !opts || !settings) return;
    if (job.status !== 'canceling') return;

    try {
      const status = await pollBatchJobStatus(job.anthropicBatchId, settings);
      if (status.status !== 'ended' && status.status !== 'canceled' && status.status !== 'expired') {
        scheduleCancelPoll(jobId);
        return;
      }

      const results = await fetchBatchJobResults(job.anthropicBatchId, settings);
      const avoidTitles = await recentUsedTitlesAndHooks(job.channelId, opts.lyricLanguage).then(r => r.titles).catch(() => [] as string[]);
      const stitched = stitchBatchResults(opts, results.results, job.snapshot.preassignedSlots, avoidTitles);
      const scored = stitched.blueprint ? { ...stitched.blueprint, songs: scoreSongs(stitched.blueprint.songs, opts.channel, opts.lyricLanguage) } : undefined;
      const finalStatus: BatchJobRecord['status'] = scored && scored.songs.length ? 'canceled_with_partial_results' : 'canceled';
      const updated = await updateBatchJob(jobId, {
        status: finalStatus,
        resultBlueprint: scored,
        failedBatchIndexes: stitched.failedBatchIndexes
      });
      if (updated) setActiveJob(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      scheduleCancelPoll(jobId);
    }
  }

  const submit = useCallback(async (
    opts: GenerationOptions,
    genres: GenrePack[],
    moods: MoodPack[],
    season: SeasonPack,
    settings: ProviderSettings,
    avoid: { usedTitles?: string[]; usedHooks?: string[] } | undefined,
    onComplete: (blueprint: PlaylistBlueprint, opts: GenerationOptions) => void,
    /** TASK v3.33 — see onErrorRef's comment. Optional; single-pack callers omit it. */
    onError?: (message: string) => void
  ) => {
    setError('');

    // TASK B2 (v3.6) — decide every track's identity locally, up front, so
    // parallel sub-batches have nothing left to collide on. The locked
    // playlist identity is a best-effort single small API call; if it fails
    // (offline, rate limit), batches still can't collide on title/hook —
    // only the shared sonicSignature/vocalSignature framing may drift.
    const slots = preallocateSongSlots(opts, genres, avoid);
    let lockedIdentity: PlaylistIdentity | null = null;
    try {
      lockedIdentity = await fetchLockedIdentityForBatch(opts, genres, moods, season, settings);
    } catch {
      // See comment above — non-fatal.
    }

    const specs = buildBatchRequestSpecs(opts, genres, moods, season, settings, avoid, undefined, { slots, lockedIdentity });

    // TASK B1 (v3.6) — never include settings/apiKey; resume re-reads it live.
    const snapshot: BatchJobSnapshot = {
      options: opts,
      channel: opts.channel,
      genreIds: opts.genreIds,
      moodIds: opts.moodIds,
      seasonId: opts.seasonId,
      providerType: settings.provider,
      model: settings.model,
      temperature: settings.temperature,
      preassignedSlots: slots,
      lockedIdentity
    };

    const job = await createBatchJob({
      channelId: opts.channel.id,
      projectTitle: opts.projectTitle,
      totalSongCount: opts.songCount,
      requests: specs,
      snapshot
    });
    setActiveJob(job);
    optsRef.current.set(job.id, snapshot.options);
    settingsRef.current.set(job.id, settings);
    onCompleteRef.current.set(job.id, onComplete);
    if (onError) onErrorRef.current.set(job.id, onError);

    try {
      const { anthropicBatchId } = await submitBatchJob(specs, settings);
      const updated = await updateBatchJob(job.id, { status: 'in_progress', anthropicBatchId });
      if (updated) setActiveJob(updated);
      schedulePoll(job.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const updated = await updateBatchJob(job.id, { status: 'failed', errorMessage: message });
      if (updated) setActiveJob(updated);
      setError(message);
      onError?.(message);
    }
  }, [schedulePoll]);

  const cancel = useCallback(async (jobId: string) => {
    const job = await getBatchJob(jobId);
    stopPolling(jobId);
    if (!job?.anthropicBatchId) {
      const updated = await updateBatchJob(jobId, { status: 'canceled' });
      if (updated) setActiveJob(updated);
      return;
    }
    const settings = settingsRef.current.get(jobId);
    try {
      if (settings) await cancelBatchJob(job.anthropicBatchId, settings);
    } catch {
      // Best-effort — still move to 'canceling' and poll for a terminal status regardless.
    }
    const canceling = await updateBatchJob(jobId, { status: 'canceling' });
    if (canceling) setActiveJob(canceling);
    scheduleCancelPoll(jobId);
  }, [scheduleCancelPoll]);

  /** Resubmits only the sub-batches that errored, as a small child batch job; on completion, merges its songs into the parent's resultBlueprint. */
  const retryFailed = useCallback(async (
    parentJobId: string,
    settings: ProviderSettings,
    onComplete: (blueprint: PlaylistBlueprint, opts: GenerationOptions) => void
  ) => {
    const parent = await getBatchJob(parentJobId);
    const opts = parent?.snapshot.options;
    if (!parent || !opts || !parent.failedBatchIndexes?.length) return;

    const failedSpecs = parent.requests.filter(spec => parent.failedBatchIndexes!.includes(Number(/^b(\d+)$/.exec(spec.customId)?.[1])));
    if (!failedSpecs.length) return;

    const child = await createBatchJob({
      channelId: parent.channelId,
      projectTitle: `${parent.projectTitle} (재시도)`,
      totalSongCount: failedSpecs.reduce((sum, s) => sum + s.batchSongCount, 0),
      requests: failedSpecs,
      snapshot: parent.snapshot
    });
    await updateBatchJob(child.id, { parentJobId: parent.id });
    optsRef.current.set(child.id, opts);
    settingsRef.current.set(child.id, settings);
    onCompleteRef.current.set(child.id, (childBlueprint, childOpts) => {
      const merged: PlaylistBlueprint = {
        ...(parent.resultBlueprint ?? childBlueprint),
        songs: [...(parent.resultBlueprint?.songs ?? []), ...childBlueprint.songs].sort((a, b) => a.trackNo - b.trackNo)
      };
      void updateBatchJob(parent.id, {
        resultBlueprint: merged,
        failedBatchIndexes: parent.failedBatchIndexes!.filter(
          idx => !failedSpecs.some(spec => Number(/^b(\d+)$/.exec(spec.customId)?.[1]) === idx)
        )
      }).then(updated => {
        if (updated) setActiveJob(updated);
      });
      onComplete(merged, childOpts);
    });

    try {
      const { anthropicBatchId } = await submitBatchJob(failedSpecs, settings);
      await updateBatchJob(child.id, { status: 'in_progress', anthropicBatchId });
      schedulePoll(child.id);
    } catch (e) {
      await updateBatchJob(child.id, { status: 'failed', errorMessage: e instanceof Error ? e.message : String(e) });
    }
  }, [schedulePoll]);

  /**
   * Called on app mount — resumes polling any job left in_progress/
   * submitting/canceling from a previous session (e.g. the tab was closed
   * mid-batch). TASK B1 (v3.6): each job drives off its own snapshot, not a
   * live `opts` the caller happens to have on screen right now.
   */
  const resumeActiveJobs = useCallback(async (channelId: string, settings: ProviderSettings, onComplete: (blueprint: PlaylistBlueprint, opts: GenerationOptions) => void) => {
    const jobs = await listActiveBatchJobs(channelId);
    for (const job of jobs) {
      if (!job.anthropicBatchId) continue;
      optsRef.current.set(job.id, job.snapshot.options);
      settingsRef.current.set(job.id, settings);
      onCompleteRef.current.set(job.id, onComplete);
      setActiveJob(job);
      if (job.status === 'canceling') scheduleCancelPoll(job.id);
      else schedulePoll(job.id);
    }
  }, [schedulePoll, scheduleCancelPoll]);

  return { activeJob, error, submit, cancel, retryFailed, resumeActiveJobs };
}
