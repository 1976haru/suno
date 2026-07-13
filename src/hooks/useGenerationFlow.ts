import { useState } from 'react';
import { generateBlueprint, refineTracks } from '../providers';
import { clampSongCount } from '../utils/generation';
import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack, SongIdea } from '../types';

export function useGenerationFlow() {
  const [blueprint, setBlueprint] = useState<PlaylistBlueprint | null>(null);
  const [partialSongs, setPartialSongs] = useState<SongIdea[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [refineProgress, setRefineProgress] = useState({ done: 0, total: 0 });
  const [refineWarnings, setRefineWarnings] = useState<string[]>([]);

  async function generate(
    opts: GenerationOptions,
    genres: GenrePack[],
    moods: MoodPack[],
    season: SeasonPack,
    provider: ProviderSettings,
    afterSuccess?: (next: PlaylistBlueprint, songCount: number) => void
  ) {
    setIsGenerating(true);
    setError('');
    setPartialSongs([]);
    const songCount = clampSongCount(opts.songCount);
    setGenProgress({ done: 0, total: songCount });
    try {
      const next = await generateBlueprint(
        { ...opts, songCount },
        genres,
        moods,
        season,
        provider,
        progress => {
          setGenProgress(progress);
          setPartialSongs(progress.songs);
        }
      );
      setBlueprint(next);
      afterSuccess?.(next, songCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsGenerating(false);
    }
  }

  /**
   * Hybrid mode's selective refine step: the caller already generated a free
   * local draft for the whole pack, and the user hand-picked which tracks
   * are worth an API call. Only those trackNos are ever sent — everything
   * else in the pack stays exactly as the local draft produced it.
   */
  async function refineSelected(
    trackNos: number[],
    opts: GenerationOptions,
    genres: GenrePack[],
    moods: MoodPack[],
    season: SeasonPack,
    provider: ProviderSettings
  ) {
    if (!blueprint || !trackNos.length) return;
    setIsRefining(true);
    setRefineWarnings([]);
    setRefineProgress({ done: 0, total: trackNos.length });
    try {
      const { blueprint: next, warnings } = await refineTracks(
        blueprint,
        trackNos,
        opts,
        genres,
        moods,
        season,
        provider,
        [],
        (done, total) => setRefineProgress({ done, total })
      );
      setBlueprint(next);
      setRefineWarnings(warnings);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRefining(false);
    }
  }

  return {
    blueprint,
    setBlueprint,
    partialSongs,
    isGenerating,
    genProgress,
    error,
    setError,
    generate,
    isRefining,
    refineProgress,
    refineWarnings,
    refineSelected
  };
}
