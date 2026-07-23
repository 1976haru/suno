import { useCallback, useRef, useState } from 'react';
import { buildSetOptions, finalizeSetBlueprint, runMultiSetGeneration, type SetResult } from '../core/multiSetGeneration';
import { stripSetTitlePrefix } from '../utils/generation';
import type { useBatchGenerationFlow } from './useBatchGenerationFlow';
import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack } from '../types';

export interface MultiSetRunState {
  isRunning: boolean;
  /** 1-based, 0 before the first set starts. */
  currentSet: number;
  totalSets: number;
  setProgress: { done: number; total: number };
  error: string;
}

const IDLE_STATE: MultiSetRunState = { isRunning: false, currentSet: 0, totalSets: 0, setProgress: { done: 0, total: 0 }, error: '' };

/**
 * TASK v3.33 — orchestrates a multi-set generation run at the React-hook
 * layer, on top of two independent pieces: core/multiSetGeneration.ts's pure
 * runMultiSetGeneration (local/realtime — no React, fully unit-testable) and
 * useBatchGenerationFlow's existing submit() (Batch API — must run here
 * since submit/poll is a React-hook-managed async lifecycle,
 * batchFlow is passed in rather than instantiated again so this hook shares
 * the *same* activeJob/state the app's existing single-pack batch UI
 * already reads, instead of running two independent batch flows in
 * parallel).
 *
 * Batch-mode sets are submitted sequentially (not concurrently): set 2
 * doesn't start until set 1's whole batch job (submit -> poll -> stitch,
 * which can take minutes) has completed, so set 2's avoid-list can include
 * set 1's real output. Known limitation: unlike a single batch job (which
 * survives a browser restart via useBatchGenerationFlow's resumeActiveJobs),
 * the *sequence* "continue to set N+1 after a restart" is not persisted —
 * only the individual in-flight job is. A restart mid-run requires manually
 * starting the remaining sets.
 */
export function useMultiSetGenerationFlow(batchFlow: ReturnType<typeof useBatchGenerationFlow>) {
  const [state, setState] = useState<MultiSetRunState>(IDLE_STATE);
  const cancelRef = useRef(false);

  function submitSetAndWait(
    setOpts: GenerationOptions,
    genres: GenrePack[],
    moods: MoodPack[],
    season: SeasonPack,
    settings: ProviderSettings,
    avoid: { usedTitles?: string[]; usedHooks?: string[] }
  ): Promise<PlaylistBlueprint> {
    return new Promise((resolve, reject) => {
      void batchFlow.submit(setOpts, genres, moods, season, settings, avoid, blueprint => resolve(blueprint), message => reject(new Error(message)));
    });
  }

  const runBatchMode = useCallback(async (
    baseOpts: GenerationOptions,
    setCount: number,
    songsPerSet: number,
    genres: GenrePack[],
    moods: MoodPack[],
    season: SeasonPack,
    settings: ProviderSettings,
    initialAvoid: { usedTitles?: string[]; usedHooks?: string[] } | undefined,
    onSetComplete: (result: SetResult) => Promise<void> | void
  ) => {
    let usedTitles = [...(initialAvoid?.usedTitles ?? [])];
    let usedHooks = [...(initialAvoid?.usedHooks ?? [])];

    for (let index = 0; index < setCount; index++) {
      if (cancelRef.current) break;
      const setOpts = buildSetOptions(baseOpts, index, setCount, songsPerSet);
      setState(prev => ({ ...prev, currentSet: index + 1, setProgress: { done: 0, total: songsPerSet } }));
      const avoid = { usedTitles, usedHooks };

      const blueprint = await submitSetAndWait(setOpts, genres, moods, season, settings, avoid);
      const { blueprint: finalBlueprint, warnings } = await finalizeSetBlueprint(blueprint, setOpts, genres, moods, season, settings, avoid);

      const result: SetResult = { index, opts: setOpts, blueprint: finalBlueprint, warnings };
      usedTitles = [...usedTitles, ...finalBlueprint.songs.map(song => stripSetTitlePrefix(song.title))];
      usedHooks = [...usedHooks, ...finalBlueprint.songs.map(song => song.hookPhrase)];
      setState(prev => ({ ...prev, setProgress: { done: songsPerSet, total: songsPerSet } }));
      await onSetComplete(result);
    }
  }, [batchFlow]);

  const run = useCallback(async (
    baseOpts: GenerationOptions,
    setCount: number,
    songsPerSet: number,
    genres: GenrePack[],
    moods: MoodPack[],
    season: SeasonPack,
    settings: ProviderSettings,
    batchMode: boolean,
    initialAvoid: { usedTitles?: string[]; usedHooks?: string[] } | undefined,
    onSetComplete: (result: SetResult) => Promise<void> | void
  ) => {
    cancelRef.current = false;
    setState({ isRunning: true, currentSet: 0, totalSets: setCount, setProgress: { done: 0, total: songsPerSet }, error: '' });
    try {
      if (batchMode && settings.provider === 'anthropic') {
        await runBatchMode(baseOpts, setCount, songsPerSet, genres, moods, season, settings, initialAvoid, onSetComplete);
      } else {
        await runMultiSetGeneration(
          baseOpts,
          setCount,
          songsPerSet,
          genres,
          moods,
          season,
          settings,
          initialAvoid,
          progress => setState(prev => ({
            ...prev,
            currentSet: progress.currentSet,
            setProgress: { done: progress.setDone, total: progress.setTotal }
          })),
          onSetComplete
        );
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setState(prev => ({ ...prev, error: message }));
      throw e;
    } finally {
      setState(prev => ({ ...prev, isRunning: false }));
    }
  }, [runBatchMode]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  return { ...state, run, cancel };
}
