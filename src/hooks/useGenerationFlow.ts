import { useState } from 'react';
import { generateBlueprint } from '../providers';
import { clampSongCount } from '../utils/generation';
import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, ProviderSettings, SeasonPack, SongIdea } from '../types';

export function useGenerationFlow() {
  const [blueprint, setBlueprint] = useState<PlaylistBlueprint | null>(null);
  const [partialSongs, setPartialSongs] = useState<SongIdea[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');

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

  return { blueprint, setBlueprint, partialSongs, isGenerating, genProgress, error, setError, generate };
}
