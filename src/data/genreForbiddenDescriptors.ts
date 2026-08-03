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
  },
  // TASK B1 — kr-2030 workspace guards, so 60s-80s oldpop production
  // vocabulary (this app's only other genre family with heavy era framing)
  // never leaks into these 6 explicitly-modern genres.
  {
    genreIds: ['kr2030-emo-band-pop', 'kr2030-electro-pop', 'kr2030-dawn-rnb', 'kr2030-ost-ballad', 'kr2030-y2k-retro', 'kr2030-acoustic-folk'],
    forbiddenPhrases: ['analog tape saturation', 'mono-leaning mix', 'brushed drum kit', 'crooner delivery', 'AM-radio compression', 'spring reverb']
  },
  {
    genreIds: ['kr2030-electro-pop'],
    forbiddenPhrases: ['acoustic instruments carry the arrangement', 'fingerpicked acoustic guitar', 'brushed snare']
  },
  {
    genreIds: ['kr2030-ost-ballad', 'kr2030-acoustic-folk'],
    forbiddenPhrases: ['four-on-the-floor', 'UK garage rhythm', 'sidechained pump']
  },
  // TASK C1 — jp-2030 workspace guards, mirroring B1's kr-2030 pattern.
  {
    genreIds: ['jp2030-melodic-jrock', 'jp2030-anime-cinematic', 'jp2030-heisei-nostalgia', 'jp2030-dance-vocal', 'jp2030-kawaii-idol', 'jp2030-neo-citypop', 'jp2030-chill-neosoul'],
    forbiddenPhrases: ['analog tape saturation', 'mono-leaning mix', 'brushed drum kit', 'crooner delivery', 'AM-radio compression', 'spring reverb', 'kissaten ambience']
  },
  {
    // TASK C1 (§3-4) — market research's own IP-avoidance requirement.
    genreIds: ['jp2030-anime-cinematic'],
    forbiddenPhrases: ['named anime title reference', 'named character reference', 'named studio reference', 'named voice actor reference']
  },
  {
    // TASK C1 (§1-1/§3-3) — 54 existing city-pop/future-funk ids; these are
    // the exact generic clichés that would make a 55th indistinguishable.
    genreIds: ['jp2030-neo-citypop'],
    forbiddenPhrases: ['generic neon Tokyo skyline', 'sports car at night', 'palm trees and sunset boulevard']
  },
  {
    genreIds: ['jp2030-chill-neosoul', 'jp2030-heisei-nostalgia'],
    forbiddenPhrases: ['four-on-the-floor', 'idol call-and-response chant', 'sidechained pump']
  }
];
