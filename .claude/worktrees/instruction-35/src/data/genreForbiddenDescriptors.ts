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
  },
  // TASK E1 (§3-4) — senior-emotion vocabulary blocked from all 7 kr-kids
  // genres, a second line of defense alongside D1's vocabulary whitelist.
  {
    genreIds: ['krkids-action', 'krkids-daily-habit', 'krkids-counting-color', 'krkids-animal-vehicle', 'krkids-roleplay-story', 'krkids-bilingual', 'krkids-sleep-calm'],
    forbiddenPhrases: ['analog tape saturation', 'crooner delivery', 'smoky late-night atmosphere', 'wistful nostalgia', 'aching longing', 'bittersweet reflection']
  },
  {
    // TASK E1 (§3-4) — directly contradicts a lullaby's own definition.
    genreIds: ['krkids-sleep-calm'],
    forbiddenPhrases: ['hand claps', 'call and response', 'energetic', 'four-on-the-floor']
  },
  // TASK F1 (§3-4) — senior Japanese vocabulary blocked from all 7 jp-kids
  // genres, drawn from BOTH senior Japanese dictionaries (japaneseDefault +
  // showaCafe) since F1 §0-4 measured this workspace has twice the exposure
  // risk E1's Korean-only senior dictionary has.
  {
    genreIds: ['jpkids-teasobi', 'jpkids-taiso-dance', 'jpkids-onomatopoeia', 'jpkids-food-vehicle', 'jpkids-daily-habit', 'jpkids-seasonal', 'jpkids-english-learning'],
    forbiddenPhrases: ['analog tape saturation', 'crooner delivery', 'showa-era kissaten', 'sepia tone', 'wistful nostalgia', 'aching longing', 'bittersweet reflection']
  },
  {
    // TASK F1 (§3-4) — jpkids-seasonal sits closest to the senior seasonal
    // vocabulary of any jp-kids genre, so it gets a second, narrower guard.
    genreIds: ['jpkids-seasonal'],
    forbiddenPhrases: ['quiet winter melancholy', 'first snow nostalgia', 'looking back on the year']
  },
  {
    genreIds: ['jpkids-teasobi', 'jpkids-daily-habit'],
    forbiddenPhrases: ['driving beat', 'four-on-the-floor', 'big dynamic build']
  },
  // TASK K2 (§4-3) — senior/oldpop vocabulary blocked from all 7 kridol
  // genres, same "second line of defense alongside the genre's own
  // avoidTraits" pattern E1/F1 already established.
  {
    genreIds: ['kridol-performance-trap', 'kridol-synth-dance', 'kridol-band-crossover', 'kridol-midtempo-rnb', 'kridol-latin-afro', 'kridol-emotional-ballad', 'kridol-retro-funk'],
    forbiddenPhrases: ['analog tape saturation', 'crooner delivery', 'showa-era kissaten', 'wistful nostalgia', 'AM-radio compression', 'spring reverb']
  },
  {
    // TASK K2 (§4-3) — 54 existing city-pop/future-funk ids in the library;
    // these are the exact generic clichés that would make kridol-retro-funk
    // indistinguishable, same reasoning as C1's identical jp2030-neo-citypop guard.
    genreIds: ['kridol-retro-funk'],
    forbiddenPhrases: ['generic neon Tokyo skyline', 'sports car at night']
  },
  {
    // TASK K2 (§4-3) — distinguishes from modern-chill's own r&b/lo-fi vocabulary.
    genreIds: ['kridol-midtempo-rnb'],
    forbiddenPhrases: ['lo-fi study beat', 'dusty piano loop', 'bedroom tape hiss']
  },
  // TASK K2 (§9-2 item 4) — anti-imitation guard specific to the idol
  // workspace: existing avoidTraits already block generic "famous artist
  // imitation" (sharedAvoid, genreLibrary/index.ts), but idol groups are
  // identifiable by structure/hook/timbre even without a name ever
  // appearing — see K2 §9-1's own reasoning. '~ style' comparisons and
  // direct group/song-name patterns are blocked here as forbidden PHRASES
  // (checked against generated prose), separate from avoidTraits (checked
  // against style-prompt atom selection).
  {
    genreIds: ['kridol-performance-trap', 'kridol-synth-dance', 'kridol-band-crossover', 'kridol-midtempo-rnb', 'kridol-latin-afro', 'kridol-emotional-ballad', 'kridol-retro-funk'],
    forbiddenPhrases: [' style', 'in the style of', 'sounds like', 'reminiscent of']
  }
];
