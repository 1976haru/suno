import type { ChannelProfile, GenerationOptions, PlaylistBlueprint } from '../types';
import { defaultAvoidWordsString } from '../data/avoidWordPresets';
import { buildDefaultNegativeStyle } from '../data/negativeStyles';
import { normalizeGenreSelection } from '../core/genreSelection';
import { defaultPackagingLanguageForChannel } from '../core/packagingLanguage';

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
  return `${String(trackNo).padStart(2, '0')}. ${stripSetTitlePrefix(title)}`;
}

/**
 * TASK v3.43 Step 3 (Part B1) — real measurement: the prefix only ever
 * reached `song.title`. `youtube.title` and the lyrics' own "Title: X" line
 * (see core/lyricEngine.ts's composeLyrics — always its first line, unless a
 * vocal meta tag was prepended ahead of it, see ensureVocalMetaTag) shipped
 * unnumbered, and utils/exporters.ts's buildSongTxt then added its own
 * second "NN. " on top of the (correctly) already-prefixed song.title,
 * producing "01. 01. Creative Title". Matches the same first-"Title:"-line
 * anywhere in the lyrics, not just index 0, since a vocal meta tag can sit
 * ahead of it. Not present at all for kids-channel lyrics (composeKidsLyrics
 * never writes one) — a no-op in that case, same as any AI-generated lyrics
 * that never included the line either.
 */
const LYRICS_TITLE_LINE_RE = /^Title:\s*(.*)$/;

function applyOrStripLyricsTitleLine(lyrics: string, trackNo: number, enabled: boolean): string {
  const lines = lyrics.split('\n');
  const index = lines.findIndex(line => LYRICS_TITLE_LINE_RE.test(line));
  if (index === -1) return lyrics;
  const [, rawTitle] = lines[index].match(LYRICS_TITLE_LINE_RE)!;
  lines[index] = `Title: ${enabled ? applySetTitlePrefix(trackNo, rawTitle) : stripSetTitlePrefix(rawTitle)}`;
  return lines.join('\n');
}

/**
 * Applies the trusted trackNo display prefix to every title surface a song
 * has (song.title, youtube.title, and the lyrics' own "Title:" line), or
 * strips any existing prefix from all three when the option is disabled.
 * applySetTitlePrefix/stripSetTitlePrefix are each idempotent on their own
 * (applySetTitlePrefix always strips before re-adding), so calling this
 * twice in a row never produces "01. 01." on any of the three surfaces.
 */
export function applySetTitlePrefixesToBlueprint(blueprint: PlaylistBlueprint, enabled = true): PlaylistBlueprint {
  return {
    ...blueprint,
    songs: blueprint.songs.map(song => ({
      ...song,
      title: enabled ? applySetTitlePrefix(song.trackNo, song.title) : stripSetTitlePrefix(song.title),
      youtube: {
        ...song.youtube,
        title: enabled ? applySetTitlePrefix(song.trackNo, song.youtube.title) : stripSetTitlePrefix(song.youtube.title)
      },
      lyrics: applyOrStripLyricsTitleLine(song.lyrics, song.trackNo, enabled)
    }))
  };
}

export function createInitialOptions(channel: ChannelProfile): GenerationOptions {
  return {
    channel,
    projectTitle: 'Autumn to Christmas Playlist Pack',
    songCount: 12,
    // TASK v3.38 Part B1 — was hardcoded 'english' for every channel; both
    // pre-existing presets have primaryLanguage 'english' so this is a
    // behavior-preserving change for them, but the new kids channel preset
    // (primaryLanguage 'korean') now correctly starts in Korean instead of
    // needing a manual language switch every time.
    lyricLanguage: channel.primaryLanguage,
    market: channel.market,
    audience: channel.audience,
    genreIds: normalizeGenreSelection(channel.preferredGenres),
    moodIds: channel.preferredMoods,
    // TASK v3.39.1 Part C4 — 'christmas' was the hardcoded default for every
    // archetype, including kids: the season pack's own label ("Christmas
    // Cafe") then leaked a "Cafe" branding word straight into kids titles
    // ("... - Christmas Cafe Little Singalong Radio Playlist"). 'spring-open'
    // is the least adult-coded season pack (no cafe/coffee/tea keywords) and
    // becomes the kids-only default; every other archetype is unchanged.
    seasonId: channel.archetype === 'kids' ? 'spring-open' : 'christmas',
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: '',
    referenceMood: '',
    genreBlendWeights: {},
    customLyricThemeScene: '',
    avoidWords: defaultAvoidWordsString(),
    negativeStyle: buildDefaultNegativeStyle(channel),
    introUniqueness: 50,
    diversityAllocations: [],
    personaMode: false,
    packagingLanguage: defaultPackagingLanguageForChannel(channel),
    earwormMode: false
  };
}
