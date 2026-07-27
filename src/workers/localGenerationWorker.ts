import { generateLocalBlueprint } from '../core/localGenerator';
import { scoreSongs } from '../core/quality';
import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, SeasonPack } from '../types';

interface LocalGenerationRequest {
  opts: GenerationOptions;
  genres: GenrePack[];
  moods: MoodPack[];
  season: SeasonPack;
  avoid?: { usedTitles?: string[]; usedHooks?: string[] };
  promptCharLimit?: number;
}

type LocalGenerationResponse =
  | { ok: true; blueprint: PlaylistBlueprint }
  | { ok: false; error: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<LocalGenerationRequest>) => void) | null;
  postMessage: (message: LocalGenerationResponse) => void;
};

workerScope.onmessage = event => {
  try {
    const { opts, genres, moods, season, avoid, promptCharLimit } = event.data;
    const blueprint = generateLocalBlueprint(opts, genres, moods, season, avoid, promptCharLimit);
    const songs = scoreSongs(blueprint.songs, opts.channel, opts.lyricLanguage);
    workerScope.postMessage({ ok: true, blueprint: { ...blueprint, songs } });
  } catch (error) {
    workerScope.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export {};
