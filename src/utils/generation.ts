import type { ChannelProfile, GenerationOptions } from '../types';
import { defaultAvoidWordsString } from '../data/avoidWordPresets';
import { normalizeGenreSelection } from '../core/genreSelection';
import { defaultPackagingLanguage } from '../core/packagingLanguage';

export function clampSongCount(value: number) {
  if (!Number.isFinite(value)) return 12;
  return Math.min(80, Math.max(1, Math.round(value)));
}

/** TASK v3.33 — multi-set generation: how many sets in one run (each its own SavedPack/video). */
export function clampSetCount(value: number) {
  if (!Number.isFinite(value)) return 5;
  return Math.min(10, Math.max(1, Math.round(value)));
}

/** TASK v3.33 — songs per set; independent from clampSongCount's single-pack 80 cap (default 18, matches the "1 set = 1 video" operating model). */
export function clampSongsPerSet(value: number) {
  if (!Number.isFinite(value)) return 18;
  return Math.min(20, Math.max(6, Math.round(value)));
}

/** TASK v3.33 — combined multi-set total cap (200), independent of the per-set 6-20 range above — e.g. 10 sets x 20 songs is already at the ceiling. */
export const MULTI_SET_TOTAL_CAP = 200;

export function clampMultiSetTotal(setCount: number, songsPerSet: number): { setCount: number; songsPerSet: number } {
  const clampedSetCount = clampSetCount(setCount);
  const clampedSongsPerSet = clampSongsPerSet(songsPerSet);
  if (clampedSetCount * clampedSongsPerSet <= MULTI_SET_TOTAL_CAP) {
    return { setCount: clampedSetCount, songsPerSet: clampedSongsPerSet };
  }
  // Reduce songsPerSet first (keeps the requested number of sets/videos intact), floor at the 6-song minimum.
  const maxSongsPerSet = Math.max(6, Math.floor(MULTI_SET_TOTAL_CAP / clampedSetCount));
  return { setCount: clampedSetCount, songsPerSet: Math.min(clampedSongsPerSet, maxSongsPerSet) };
}

export function createInitialOptions(channel: ChannelProfile): GenerationOptions {
  return {
    channel,
    projectTitle: 'Autumn to Christmas Playlist Pack',
    songCount: 12,
    lyricLanguage: 'english',
    market: channel.market,
    audience: channel.audience,
    genreIds: normalizeGenreSelection(channel.preferredGenres),
    moodIds: channel.preferredMoods,
    seasonId: 'christmas',
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: '',
    avoidWords: defaultAvoidWordsString(),
    personaMode: false,
    packagingLanguage: defaultPackagingLanguage(channel.market),
    earwormMode: false
  };
}
