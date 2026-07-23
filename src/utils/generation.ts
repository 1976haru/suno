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

/**
 * TASK v3.35 — a leading "NN. " that core/multiSetGeneration.ts's
 * applySetTitlePrefix adds when GenerationOptions.setNumberPrefix is on
 * (default). A real creative Billboard-style title (see v3.28's titleMode)
 * essentially never starts with this exact shape on its own, so stripping
 * it unconditionally — even for packs where the prefix was never applied —
 * is safe and requires no "was this prefixed?" flag threading.
 */
const SET_TITLE_PREFIX_RE = /^\d{2}\.\s+/;

/** The creative/core title with any set-number prefix removed — this is what dedup/ledger comparisons must always use (see stripSetTitlePrefix's callers: hookLedger.ts's recordPackHooks, core/multiSetGeneration.ts's cross-set avoid-list accumulation), never the prefixed display title, or "01. Winterglass" (set 1) and "05. Winterglass" (set 5) would wrongly read as different titles. */
export function stripSetTitlePrefix(title: string): string {
  return title.replace(SET_TITLE_PREFIX_RE, '');
}

/** trackNo padded to 2 digits + ". " — trackNo is already the set-local 1..songsPerSet number by construction (each set is its own generateBlueprint call, see multiSetGeneration.ts), so no separate "position within set" bookkeeping is needed. */
export function applySetTitlePrefix(trackNo: number, title: string): string {
  return `${String(trackNo).padStart(2, '0')}. ${title}`;
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
