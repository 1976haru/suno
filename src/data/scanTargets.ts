import type { SongIdea } from '../types';

/**
 * TASK v5.18 (유형 D 근본 수정, "검사 대상 필드를 한 곳에서 정의하고 모든
 * 검사기가 참조하게 하십시오") — real, verified gap: core/importInspection.ts's
 * artist-safety check only ever scanned title/stylePrompt/lyrics;
 * core/compositionScorer.ts's own artist-safety check scanned
 * stylePrompt/lyrics/youtube(title+description) — two DIFFERENT field lists
 * for what's supposed to be the same safety guarantee, and BOTH missed
 * titleLocalized/hookPhrase/excludePrompt/listenerSituation/emotionArc/
 * youtube.tags entirely. A real artist/band name in any of those omitted
 * fields would reach Suno (or a display surface) with zero check ever
 * running on it. This file is the single source of truth every checker now
 * reads from — adding a field here (or fixing its scope) fixes every
 * checker at once, instead of needing the same edit made N times and
 * inevitably missed in one of them (exactly how this gap happened).
 *
 * `scope` is core/artistReferenceDecomposer.ts's own ArtistReferenceScope
 * (not imported here — this file stays in data/, importing from core/ would
 * create a data->core dependency this codebase's layering avoids
 * elsewhere; see e.g. data/killingPoints.ts's own identical note) — it
 * decides how strict a commonWordRisk seed match needs to be for THIS
 * field:
 *  - 'stylePrompt': fully strict, no context required. Used for stylePrompt
 *    itself (Suno's one field that actually renders) and excludePrompt (a
 *    short comma-list of terms, not natural prose, so leniency isn't
 *    needed there either).
 *  - 'title': medium — a commonWordRisk seed needs a trigger phrase or
 *    non-Latin match, capitalization alone doesn't count (titles are
 *    conventionally title-cased). Used for title/titleLocalized/hookPhrase/
 *    youtube.title/youtube.tags — all short, title-like text.
 *  - 'lyrics': lenient — natural language, capitalization mid-sentence also
 *    counts as a signal. Used for lyrics/listenerSituation/emotionArc/
 *    youtube.description — free-form prose fields.
 */
export type ArtistScanScope = 'stylePrompt' | 'title' | 'lyrics';

export interface ArtistScanFieldRef {
  /** Human-readable id, also used as the field key for a flat (non-youtube) SongIdea field. */
  id: string;
  scope: ArtistScanScope;
  /** Reads this field's text off a song. Handles youtube.* (array-valued tags joined) and always-string-safe. */
  read: (song: SongIdea) => string;
}

export const ARTIST_SCAN_FIELDS: readonly ArtistScanFieldRef[] = [
  { id: 'title', scope: 'title', read: song => song.title || '' },
  { id: 'titleLocalized', scope: 'title', read: song => song.titleLocalized || '' },
  { id: 'hookPhrase', scope: 'title', read: song => song.hookPhrase || '' },
  { id: 'stylePrompt', scope: 'stylePrompt', read: song => song.stylePrompt || '' },
  { id: 'excludePrompt', scope: 'stylePrompt', read: song => song.excludePrompt || '' },
  { id: 'lyrics', scope: 'lyrics', read: song => song.lyrics || '' },
  { id: 'listenerSituation', scope: 'lyrics', read: song => song.listenerSituation || '' },
  { id: 'emotionArc', scope: 'lyrics', read: song => song.emotionArc || '' },
  { id: 'youtube.title', scope: 'title', read: song => song.youtube?.title || '' },
  { id: 'youtube.description', scope: 'lyrics', read: song => song.youtube?.description || '' },
  { id: 'youtube.tags', scope: 'title', read: song => (song.youtube?.tags || []).join(' ') }
] as const;

/**
 * TASK v5.18 — same centralization for the "arrangement/instrument
 * vocabulary sung as a lyric subject" guard (core/lyricVocabularyGuard.ts's
 * findArrangementVocabularyInLyrics) and the era-anachronism guard
 * (data/eraExclusions.ts's ERA_FORBIDDEN_DESCRIPTORS), so a future field
 * addition to either check only needs one list edited, not each checker's
 * own call site. Both currently only ever apply to `lyrics`/`stylePrompt`
 * respectively (the fields those checks are actually about — an
 * arrangement-vocabulary-as-subject error is a lyrics-only failure mode,
 * an era-anachronistic descriptor only ever appears in stylePrompt), so
 * this is a 1-entry list each today; kept as a real list (not a bare
 * constant) so a future field addition doesn't need a shape change.
 */
export const ARRANGEMENT_VOCABULARY_SCAN_FIELDS: readonly ArtistScanFieldRef[] = [
  { id: 'lyrics', scope: 'lyrics', read: song => song.lyrics || '' }
] as const;

export const ERA_ANACHRONISM_SCAN_FIELDS: readonly ArtistScanFieldRef[] = [
  { id: 'stylePrompt', scope: 'stylePrompt', read: song => song.stylePrompt || '' }
] as const;
