import type {
  BatchContext,
  GenerationOptions,
  GenerationProgress,
  GenrePack,
  MoodPack,
  PlaylistBlueprint,
  PlaylistIdentity,
  ProviderSettings,
  SeasonPack
} from '../types';
import { generateLocalBlueprint } from '../core/localGenerator';
import { scoreSongs } from '../core/quality';
import { generateWithOpenAI } from './openai';
import { generateWithAnthropic } from './anthropic';

export const BATCH_SIZE = 6;

function chunkRange(total: number, size: number): number[][] {
  const batches: number[][] = [];
  for (let start = 1; start <= total; start += size) {
    const end = Math.min(start + size - 1, total);
    batches.push(Array.from({ length: end - start + 1 }, (_, i) => start + i));
  }
  return batches;
}

function extractIdentity(blueprint: PlaylistBlueprint): PlaylistIdentity {
  return {
    oneLineConcept: blueprint.oneLineConcept,
    sonicSignature: blueprint.sonicSignature,
    vocalSignature: blueprint.vocalSignature,
    lyricRules: blueprint.lyricRules,
    harmonyRules: blueprint.harmonyRules,
    visualRules: blueprint.visualRules
  };
}

async function callProviderBatch(
  settings: ProviderSettings,
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  batch: BatchContext
): Promise<PlaylistBlueprint> {
  if (settings.provider === 'openai') return generateWithOpenAI(opts, genres, moods, season, settings, batch);
  return generateWithAnthropic(opts, genres, moods, season, settings, batch);
}

export async function generateBlueprint(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings,
  onProgress?: (progress: GenerationProgress) => void
): Promise<PlaylistBlueprint> {
  if (settings.provider === 'local') {
    const blueprint = generateLocalBlueprint(opts, genres, moods, season);
    onProgress?.({ done: blueprint.songs.length, total: opts.songCount });
    return { ...blueprint, songs: scoreSongs(blueprint.songs, opts.channel) };
  }

  const batches = chunkRange(opts.songCount, BATCH_SIZE);
  let lockedIdentity: PlaylistIdentity | null = null;
  let base: Omit<PlaylistBlueprint, 'songs'> | null = null;
  const allSongs: PlaylistBlueprint['songs'] = [];

  for (const [index, trackNumbers] of batches.entries()) {
    const batchOpts: GenerationOptions = { ...opts, songCount: trackNumbers.length };
    const batchContext: BatchContext = {
      trackNoOffset: trackNumbers[0] - 1,
      totalSongCount: opts.songCount,
      usedTitles: allSongs.map(song => song.title),
      usedHooks: allSongs.map(song => song.hookPhrase),
      lockedIdentity
    };

    const result = await callProviderBatch(settings, batchOpts, genres, moods, season, batchContext);

    if (index === 0) {
      base = {
        projectTitle: result.projectTitle || opts.projectTitle,
        channelName: result.channelName || opts.channel.name,
        oneLineConcept: result.oneLineConcept,
        sonicSignature: result.sonicSignature,
        vocalSignature: result.vocalSignature,
        lyricRules: result.lyricRules,
        harmonyRules: result.harmonyRules,
        visualRules: result.visualRules
      };
      lockedIdentity = extractIdentity(result);
    }

    allSongs.push(...(result.songs || []));
    onProgress?.({ done: allSongs.length, total: opts.songCount });
  }

  const blueprint: PlaylistBlueprint = {
    ...(base as Omit<PlaylistBlueprint, 'songs'>),
    songs: allSongs
  };

  return { ...blueprint, songs: scoreSongs(blueprint.songs, opts.channel) };
}
