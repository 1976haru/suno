import { useEffect, useRef, useState } from 'react';
import { recentUsedTitlesAndHooks } from '../core/hookLedger';
import { recentSituations, recentSceneSignatures, recentOpenings, type SceneSignature } from '../core/situationLedger';
import { recentLyricLines } from '../core/lyricLineLedger';
import { generationHistoryRevision, subscribeGenerationHistoryRevision } from '../core/generationHistoryRevision';
import type { LyricLanguage } from '../types';

export interface GenerationHistorySnapshot {
  usedTitles: string[];
  usedHooks: string[];
  recentSituations: string[];
  recentLyricLines: string[];
  recentSceneSignatures: SceneSignature[];
  /** 지시문 10 (TASK B-4-3) — core/situationLedger.ts's recentOpenings, same "fetched here, revision-refreshed" treatment as the other 3 avoid-list sources above. */
  recentOpenings: string[];
  revision: number;
  isLoading: boolean;
  refresh(): Promise<void>;
}

const EMPTY: Omit<GenerationHistorySnapshot, 'revision' | 'isLoading' | 'refresh'> = {
  usedTitles: [],
  usedHooks: [],
  recentSituations: [],
  recentLyricLines: [],
  recentSceneSignatures: [],
  recentOpenings: []
};

/**
 * codex 지시문 01 (TASK H) — the one real consumer of
 * core/generationHistoryRevision.ts's revision counter: fetches every real
 * avoid-list source (hookLedger/situationLedger/lyricLineLedger, the exact
 * same 3 modules App.tsx's own safeAvoidSet/recentSituations/recentLyricLines
 * calls already read call-time-fresh for a real generation) for one
 * channel/language, and ALSO refetches whenever the revision changes — not
 * just when channelId/language change. This is the fix for the one
 * confirmed staleness gap: a caller (Step3Generate.tsx's own bridgeAvoid/
 * bridgeConceptSceneContext state) that used to fetch once per
 * channel/language change and never again now sees a same-session pack
 * save/delete/restore immediately, without needing to navigate away and
 * back.
 */
export function useGenerationHistorySnapshot(channelId: string, language: LyricLanguage): GenerationHistorySnapshot {
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [revision, setRevision] = useState(generationHistoryRevision());
  const [isLoading, setIsLoading] = useState(false);
  const requestId = useRef(0);

  async function refresh() {
    const thisRequest = ++requestId.current;
    setIsLoading(true);
    try {
      const [avoid, situations, lines, sceneSignatures, openings] = await Promise.all([
        recentUsedTitlesAndHooks(channelId, language),
        recentSituations(channelId, language),
        recentLyricLines(channelId, language),
        recentSceneSignatures(channelId, language),
        recentOpenings(channelId, language)
      ]);
      // A newer refresh() already started (channel/language/revision changed
      // again mid-flight) — this stale response must never overwrite it.
      if (thisRequest !== requestId.current) return;
      setSnapshot({
        usedTitles: avoid.titles ?? [],
        usedHooks: avoid.hooks ?? [],
        recentSituations: situations,
        recentLyricLines: lines,
        recentSceneSignatures: sceneSignatures,
        recentOpenings: openings
      });
    } catch {
      if (thisRequest === requestId.current) setSnapshot(EMPTY);
    } finally {
      if (thisRequest === requestId.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, language, revision]);

  useEffect(() => subscribeGenerationHistoryRevision(setRevision), []);

  return { ...snapshot, revision, isLoading, refresh };
}
