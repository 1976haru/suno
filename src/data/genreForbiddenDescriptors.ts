/**
 * TASK v3.58 — regression data for the genreRotation.ts lead-genre-ordering
 * bug (genresForTrack used to put the channel's primary genre in position 0
 * regardless of which genre was actually assigned to a track, so every
 * song's genreSignature/genreNarrative came from the primary genre no
 * matter what genreId it was labeled with — see tests/genreRotationIdentity
 * .test.ts). This table is intentionally scoped to genre pairs that are
 * mutually exclusive by definition (a swing feel and "no swing" cannot both
 * be true), not an exhaustive style guide for every genre in the library.
 */
export interface GenreDescriptorRule {
  /** GenrePack ids this rule applies to. */
  genreIds: string[];
  /** Style-prompt phrases that must never appear for a genre in genreIds — each phrase directly contradicts what defines this genre family. */
  forbiddenPhrases: string[];
}

export const GENRE_FORBIDDEN_DESCRIPTORS: GenreDescriptorRule[] = [
  {
    // Swing/jazz-family genres are defined by their swing feel and walking
    // bass — a straight-pop "no swing"/"simple diatonic harmony" instruction
    // (adult-contemporary's own signature text) directly contradicts them.
    genreIds: ['jazz-pop', 'bossa-cafe', 'smooth-jazz-lounge'],
    forbiddenPhrases: ['no swing', 'simple diatonic harmony', 'straight-pop drum kit']
  },
  {
    // Straight-pop-family genres are defined by NOT swinging — a jazz-family
    // "swing feel"/"walking bass" instruction directly contradicts them.
    genreIds: ['adult-contemporary', 'acoustic-pop', 'retro-soul-pop', 'folk-pop', 'soft-rock'],
    forbiddenPhrases: ['swing feel', 'walking bass', 'walking upright bass']
  }
];
