/**
 * TASK v3.62 (TASK 1/2) — the oldpop-* family (TASK v3.61) spans four real
 * eras (1950s-60s through 1980s, plus a deliberately timeless "warmth"
 * sub-family with no decade). A real bridge pack put "warm string pad
 * swell" and "layered backing" into a 1962-flavored British-beat track —
 * production textures that didn't exist yet. An LLM composing this song
 * already knows that; the old template-dictation approach never gave it
 * the chance to apply that knowledge, because it forced verbatim
 * introTextureText/instrumentSet regardless of era. This table is the
 * shared source both the bridge instruction (prevention) and
 * compositionScorer.ts (detection) read from, so the two stay in sync by
 * construction — same pattern as data/arrangementVocabulary.ts.
 */
export type EraBucket = '1950s-60s' | '1970s' | '1980s' | 'timeless';

/** Hardcoded from the oldpop-* family's own 1-A/1-B/1-C/1-D grouping (see genreLibrary/index.ts's oldpopGenrePacks comment) — the era each of the 28 genres was authored for. Genres not listed here (every non-oldpop genre) have no era restriction. */
export const ERA_BUCKET_BY_GENRE_ID: Record<string, EraBucket> = {
  'oldpop-doowop-harmony': '1950s-60s',
  'oldpop-brill-building': '1950s-60s',
  'oldpop-girl-group-wall': '1950s-60s',
  'oldpop-sunshine-pop': '1950s-60s',
  'oldpop-baroque-pop': '1950s-60s',
  'oldpop-british-beat': '1950s-60s',
  'oldpop-soft-rock-am': '1970s',
  'oldpop-orchestral-easy': '1970s',
  'oldpop-close-harmony-duo': '1970s',
  'oldpop-folk-rock-70s': '1970s',
  'oldpop-motown-pop-soul': '1970s',
  'oldpop-philly-soul-sweet': '1970s',
  'oldpop-countrypolitan': '1970s',
  'oldpop-europop-glow': '1970s',
  'oldpop-yacht-west-coast': '1970s',
  'oldpop-piano-ballad-70s': '1970s',
  'oldpop-adult-contemporary-80s': '1980s',
  'oldpop-quiet-storm-warm': '1980s',
  'oldpop-orchestral-ballad-80s': '1980s',
  'oldpop-light-synth-pop-warm': '1980s',
  'oldpop-soft-duet-80s': '1980s',
  'oldpop-standards-torch': '1980s',
  'oldpop-warm-morning-glow': 'timeless',
  'oldpop-gentle-lullaby-pop': 'timeless',
  'oldpop-hearth-acoustic': 'timeless',
  'oldpop-sunlit-strings-pop': 'timeless',
  'oldpop-slow-waltz-memory': 'timeless',
  'oldpop-evening-lamp-ballad': 'timeless'
};

export const ERA_LABEL: Record<EraBucket, string> = {
  '1950s-60s': '1950s-60s',
  '1970s': '1970s',
  '1980s': '1980s',
  timeless: 'timeless (no specific decade)'
};

/**
 * Anachronistic-for-this-era production/instrumentation terms — the task's
 * own explicit list. 1950s-60s forbids things that arrived LATER (string
 * pads/synth pads/gated reverb/wide stereo are 70s-80s production); 1970s
 * forbids things that arrived even later still (gated reverb/digital synth/
 * sidechain are 80s+); 1980s forbids things that are too EARLY/narrow for
 * it (a mono-leaning mix or tape-only production reads as 1950s-60s, not
 * 1980s). Deliberately short and literal (not a broad vocabulary) — this is
 * a blocking check, so false positives here would stall the recomposition
 * loop (TASK 3) on a song that's actually fine.
 */
export const ERA_FORBIDDEN_DESCRIPTORS: Record<EraBucket, string[]> = {
  '1950s-60s': ['string pad', 'synth pad', 'gated reverb', 'wide stereo'],
  '1970s': ['gated reverb', 'digital synth', 'sidechain'],
  '1980s': ['mono-leaning mix', 'mono mix', 'tape-only production'],
  timeless: []
};

export function eraBucketForGenreId(genreId: string | undefined): EraBucket | null {
  if (!genreId) return null;
  return ERA_BUCKET_BY_GENRE_ID[genreId] ?? null;
}
