import { useState } from 'react';
import { evaluatePack } from '../agents/evaluator';
import { regenerateTrack } from '../providers';
import type { AgentEvaluation, GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack, SongIdea } from '../types';

interface UndoEntry {
  trackNo: number;
  previousSong: SongIdea;
}

export function useEvaluationFlow() {
  const [evaluation, setEvaluation] = useState<AgentEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalProgress, setEvalProgress] = useState({ done: 0, total: 0 });
  const [evalError, setEvalError] = useState('');
  const [retryingTrack, setRetryingTrack] = useState<number | null>(null);
  const [retryWarning, setRetryWarning] = useState('');
  const [undoEntry, setUndoEntry] = useState<UndoEntry | null>(null);

  async function evaluate(blueprint: PlaylistBlueprint, opts: GenerationOptions, provider: ProviderSettings, scopeTrackNos?: number[]) {
    setIsEvaluating(true);
    setEvalError('');
    const scopedCount = scopeTrackNos && scopeTrackNos.length ? scopeTrackNos.length : blueprint.songs.length;
    setEvalProgress({ done: 0, total: scopedCount });
    try {
      const result = await evaluatePack(blueprint, opts, provider, (done, total) => setEvalProgress({ done, total }), scopeTrackNos);
      setEvaluation(prev => {
        if (!prev || !scopeTrackNos || !scopeTrackNos.length) return result;
        // Scoped re-evaluation only touched a subset — keep prior per-song
        // results for tracks that weren't in scope instead of discarding them.
        const merged = [...prev.songs.filter(song => !scopeTrackNos.includes(song.trackNo)), ...result.songs]
          .sort((a, b) => a.trackNo - b.trackNo);
        return { ...result, songs: merged };
      });
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
    setRetryWarning('');
    const previousSong = blueprint.songs.find(song => song.trackNo === trackNo);
    try {
      const { blueprint: next, warning } = await regenerateTrack(blueprint, trackNo, opts, genres, moods, season, provider, issues);
      onDone(next);
      if (previousSong) setUndoEntry({ trackNo, previousSong });
      if (warning) setRetryWarning(warning);
      setEvaluation(prev => (prev ? { ...prev, songs: prev.songs.filter(song => song.trackNo !== trackNo) } : prev));
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setRetryingTrack(null);
    }
  }

  function undoRetry(blueprint: PlaylistBlueprint, onDone: (next: PlaylistBlueprint) => void) {
    if (!undoEntry) return;
    const songs = blueprint.songs.map(song => (song.trackNo === undoEntry.trackNo ? undoEntry.previousSong : song));
    onDone({ ...blueprint, songs });
    setUndoEntry(null);
    setRetryWarning('');
  }

  return {
    evaluation,
    setEvaluation,
    isEvaluating,
    evalProgress,
    evalError,
    retryingTrack,
    retryWarning,
    undoEntry,
    evaluate,
    retrySong,
    undoRetry
  };
}
