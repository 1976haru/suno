import { useState } from 'react';
import { evaluatePack } from '../agents/evaluator';
import { regenerateSong } from '../providers';
import type { AgentEvaluation, GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack } from '../types';

export function useEvaluationFlow() {
  const [evaluation, setEvaluation] = useState<AgentEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState({ done: 0, total: 0 });
  const [evalError, setEvalError] = useState('');
  const [retryingTrack, setRetryingTrack] = useState<number | null>(null);

  async function evaluate(blueprint: PlaylistBlueprint, opts: GenerationOptions, provider: ProviderSettings) {
    setIsEvaluating(true);
    setEvalError('');
    setEvalProgress({ done: 0, total: blueprint.songs.length });
    try {
      const result = await evaluatePack(blueprint, opts, provider, (done, total) => setEvalProgress({ done, total }));
      setEvaluation(result);
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsEvaluating(false);
    }
  }

  async function retrySong(
    blueprint: PlaylistBlueprint,
    trackNo: number,
    opts: GenerationOptions,
    genres: GenrePack[],
    moods: MoodPack[],
    season: SeasonPack,
    provider: ProviderSettings,
    issues: string[],
    onDone: (next: PlaylistBlueprint) => void,
    onError: (message: string) => void
  ) {
    setRetryingTrack(trackNo);
    try {
      const next = await regenerateSong(blueprint, trackNo, opts, genres, moods, season, provider, issues);
      onDone(next);
      setEvaluation(prev => (prev ? { ...prev, songs: prev.songs.filter(song => song.trackNo !== trackNo) } : prev));
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setRetryingTrack(null);
    }
  }

  return { evaluation, setEvaluation, isEvaluating, evalProgress, evalError, retryingTrack, evaluate, retrySong };
}
