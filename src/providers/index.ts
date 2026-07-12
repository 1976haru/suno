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

export const DEFAULT_BATCH_SIZE = 6;

function chunkRange(total: number, size: number): number[][] {
  const batches: number[][] = [];
  for (let start = 1; start <= total; start += size) {
    const end = Math.min(start + size - 1, total);
    batches.push(Array.from({ length: end - start + 1 }, (_, i) => start + i));
  }
  return batches;
}

export function extractIdentity(blueprint: PlaylistBlueprint): PlaylistIdentity {
  return {
    oneLineConcept: blueprint.oneLineConcept,
    sonicSignature: blueprint.sonicSignature,
    vocalSignature: blueprint.vocalSignature,
    lyricRules: blueprint.lyricRules,
    harmonyRules: blueprint.harmonyRules,
    visualRules: blueprint.visualRules
  };
}

export async function callProviderBatch(
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

  const batchSize = Math.min(12, Math.max(1, Math.round(settings.batchSize || DEFAULT_BATCH_SIZE)));
  const batches = chunkRange(opts.songCount, batchSize);
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

export async function regenerateSong(
  blueprint: PlaylistBlueprint,
  trackNo: number,
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  settings: ProviderSettings,
  issues: string[]
): Promise<PlaylistBlueprint> {
  const others = blueprint.songs.filter(song => song.trackNo !== trackNo);
  const avoidWords = [opts.avoidWords, ...issues].filter(Boolean).join('; ');

  let replacement: PlaylistBlueprint['songs'][number];

  if (settings.provider === 'local') {
    const single = generateLocalBlueprint(
      { ...opts, songCount: 1, avoidWords, projectTitle: `${opts.projectTitle}::retry-${trackNo}-${Date.now()}` },
      genres,
      moods,
      season
    );
    replacement = { ...single.songs[0], trackNo };
  } else {
    const batchContext: BatchContext = {
      trackNoOffset: trackNo - 1,
      totalSongCount: blueprint.songs.length,
      usedTitles: others.map(song => song.title),
      usedHooks: others.map(song => song.hookPhrase),
      lockedIdentity: extractIdentity(blueprint)
    };
    const result = await callProviderBatch(settings, { ...opts, songCount: 1, avoidWords }, genres, moods, season, batchContext);
    replacement = { ...result.songs[0], trackNo };
  }

  const songs = blueprint.songs.map(song => (song.trackNo === trackNo ? replacement : song));
  return { ...blueprint, songs: scoreSongs(songs, opts.channel) };
}
