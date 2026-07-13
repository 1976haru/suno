import { useCallback, useRef, useState } from 'react';
import { buildBatchRequestSpecs, cancelBatchJob, fetchBatchJobResults, pollBatchJobStatus, submitBatchJob } from '../providers/batchAnthropic';
import { createBatchJob, getBatchJob, listActiveBatchJobs, updateBatchJob, type BatchJobRecord } from '../core/batchJobs';
import { stitchBatchResults } from '../core/batchStitcher';
import { scoreSongs } from '../core/quality';
import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack } from '../types';

// Anthropic gives no hard SLA under 24h, even though most batches finish in
// minutes — never assert a shorter guarantee in UI copy that reads this.
const POLL_INTERVAL_MS = 45_000;

/**
 * TASK E2 (v3.5) — Batch API mode: submit once, poll until done, survive a
 * closed browser tab. This hook only manages Anthropic's Message Batches
 * lifecycle (create/poll/fetch/cancel/retry) and IndexedDB persistence; the
 * resulting blueprint is handed back to the caller via onComplete exactly
 * like the synchronous useGenerationFlow does, so downstream autosave/
 * thumbnail logic in App.tsx doesn't need to know which path produced it.
 */
export function useBatchGenerationFlow() {
  const [activeJob, setActiveJob] = useState<BatchJobRecord | null>(null);
  const [error, setError] = useState('');
  const pollTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const optsRef = useRef<Map<string, GenerationOptions>>(new Map());
  const settingsRef = useRef<Map<string, ProviderSettings>>(new Map());
  const onCompleteRef = useRef<Map<string, (blueprint: PlaylistBlueprint, opts: GenerationOptions) => void>>(new Map());

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
        const updated = await updateBatchJob(jobId, { status: status.status === 'canceled' ? 'canceled' : 'failed', errorMessage: status.status === 'expired' ? '배치 작업이 24시간 내에 끝나지 않았습니다.' : undefined });
        if (updated) setActiveJob(updated);
        return;
      }

      const results = await fetchBatchJobResults(job.anthropicBatchId, settings);
      if (!results.done) {
        schedulePoll(jobId);
        return;
      }
      const stitched = stitchBatchResults(opts, results.results);
      if (!stitched.blueprint) {
        const updated = await updateBatchJob(jobId, { status: 'failed', errorMessage: '모든 배치 요청이 실패했습니다.', failedBatchIndexes: stitched.failedBatchIndexes });
        if (updated) setActiveJob(updated);
        return;
      }
      const scored = { ...stitched.blueprint, songs: scoreSongs(stitched.blueprint.songs, opts.channel, opts.lyricLanguage) };
      const updated = await updateBatchJob(jobId, {
        status: 'ended',
        resultBlueprint: scored,
        failedBatchIndexes: stitched.failedBatchIndexes
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

  const submit = useCallback(async (
    opts: GenerationOptions,
    genres: GenrePack[],
    moods: MoodPack[],
    season: SeasonPack,
    settings: ProviderSettings,
    avoid: { usedTitles?: string[]; usedHooks?: string[] } | undefined,
    onComplete: (blueprint: PlaylistBlueprint, opts: GenerationOptions) => void
  ) => {
    setError('');
    const specs = buildBatchRequestSpecs(opts, genres, moods, season, settings, avoid);
    const job = await createBatchJob({
      channelId: opts.channel.id,
      projectTitle: opts.projectTitle,
      totalSongCount: opts.songCount,
      requests: specs
    });
    setActiveJob(job);
    optsRef.current.set(job.id, opts);
    settingsRef.current.set(job.id, settings);
    onCompleteRef.current.set(job.id, onComplete);

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
    }
  }, [schedulePoll]);

  const cancel = useCallback(async (jobId: string) => {
    const job = await getBatchJob(jobId);
    stopPolling(jobId);
    if (job?.anthropicBatchId) {
      const settings = settingsRef.current.get(jobId);
      try {
        if (settings) await cancelBatchJob(job.anthropicBatchId, settings);
      } catch {
        // Best-effort — mark canceled locally regardless, so the user isn't stuck waiting on a job they asked to stop.
      }
    }
    const updated = await updateBatchJob(jobId, { status: 'canceled' });
    if (updated) setActiveJob(updated);
  }, []);

  /** Resubmits only the sub-batches that errored, as a small child batch job; on completion, merges its songs into the parent's resultBlueprint. */
  const retryFailed = useCallback(async (
    parentJobId: string,
    settings: ProviderSettings,
    onComplete: (blueprint: PlaylistBlueprint, opts: GenerationOptions) => void
  ) => {
    const parent = await getBatchJob(parentJobId);
    const opts = optsRef.current.get(parentJobId);
    if (!parent || !opts || !parent.failedBatchIndexes?.length) return;

    const failedSpecs = parent.requests.filter(spec => parent.failedBatchIndexes!.includes(Number(/^b(\d+)$/.exec(spec.customId)?.[1])));
    if (!failedSpecs.length) return;

    const child = await createBatchJob({
      channelId: parent.channelId,
      projectTitle: `${parent.projectTitle} (재시도)`,
      totalSongCount: failedSpecs.reduce((sum, s) => sum + s.batchSongCount, 0),
      requests: failedSpecs
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

  /** Called on app mount — resumes polling any job left in_progress/submitting from a previous session (e.g. the tab was closed mid-batch). */
  const resumeActiveJobs = useCallback(async (channelId: string, opts: GenerationOptions, settings: ProviderSettings, onComplete: (blueprint: PlaylistBlueprint, opts: GenerationOptions) => void) => {
    const jobs = await listActiveBatchJobs(channelId);
    for (const job of jobs) {
      if (!job.anthropicBatchId) continue;
      optsRef.current.set(job.id, opts);
      settingsRef.current.set(job.id, settings);
      onCompleteRef.current.set(job.id, onComplete);
      setActiveJob(job);
      schedulePoll(job.id);
    }
  }, [schedulePoll]);

  return { activeJob, error, submit, cancel, retryFailed, resumeActiveJobs };
}
