import type { GenreTraits } from '../types';

/**
 * v3.65 (TASK A) — hand-curated GenreTraits overrides for the senior/
 * oldpop-lounge candidate pool (~60-80 genres out of the 320-genre
 * catalog; see docs/v365-report.md's own coverage table). Genres not
 * listed here get no `.traits` at all — core/traitMatcher.ts falls back to
 * styleCore/instruments/tempoRange estimation for those, at a score
 * penalty, per this task's own explicit design (do not populate all 320).
 *
 * Most of this data is not invented from scratch: genreLibrary/index.ts's
 * existing `rhythm`/`vocal`/`harmony`/`production`/`instruments` fields
 * (already axis-separated per genre, just often only 1 item per axis) are
 * reused directly wherever they already meet the 2-5-item quality bar;
 * this file only supplies what doesn't already exist anywhere
 * (`dynamicRange`, `structureTraits`) plus targeted expansions where an
 * existing axis had only 1 item. See buildGenreTraits below for exactly
 * how the two sources merge — no existing signatureSound information is
 * dropped, only reorganized (TASK A-4's own requirement).
 */
interface GenreTraitOverride {
  /** Only set when a more specific era statement than the genre's own eraTag is useful (mirrors eraExclusions.ts's vocabulary). */
  eraTag?: string;
  /** Only set when genre.instruments doesn't already give 2-5 good items (rare — instruments is almost always already fine). */
  instrumentation?: string[];
  /** Supplements/replaces genre.rhythm when it has fewer than 2 items. */
  rhythmFeel?: string[];
  /** Supplements/replaces genre.harmony when it has fewer than 2 items. */
  harmonyTraits?: string[];
  /** Supplements/replaces genre.production when it has fewer than 2 items. */
  productionTraits?: string[];
  /** Supplements/replaces genre.vocal when it has fewer than 2 items. */
  vocalTraits?: string[];
  /** New axis — not present anywhere else in the data model. */
  dynamicRange: GenreTraits['dynamicRange'];
  /** New axis — not present anywhere else in the data model. */
  structureTraits: string[];
}

export const GENRE_TRAIT_OVERRIDES: Record<string, GenreTraitOverride> = {
  // ===== oldpop-* 1950s-60s (6) =====
  'oldpop-doowop-harmony': {
    eraTag: '1950s-60s doo-wop',
    harmonyTraits: ['I-vi-IV-V doo-wop turnaround', 'close parallel-thirds backing chords'],
    dynamicRange: 'low',
    structureTraits: ['short verse leading straight into a repeated hook chorus', 'call-and-response between lead and backing group']
  },
  'oldpop-brill-building': {
    eraTag: '1960-1963 Brill Building pop',
    rhythmFeel: ['bouncy two-beat pop pulse', 'four-on-the-floor backbeat with tambourine accents'],
    vocalTraits: ['clear youthful lead vocal', 'close unison backing on the hook'],
    harmonyTraits: ['simple diatonic I-IV-V hook', 'bright major-key verse-to-chorus lift'],
    productionTraits: ['bright compact 1960s single mix', 'narrow mono-leaning stereo image'],
    dynamicRange: 'medium',
    structureTraits: ['short 2-minute single form', 'hook stated in the intro before the first verse']
  },
  'oldpop-girl-group-wall': {
    eraTag: '1962-1965 girl-group pop',
    rhythmFeel: ['driving eighth-note backbeat', 'handclap accents on the offbeat'],
    vocalTraits: ['unison female lead answered by a backing chorus', 'lead kept forward in the mix, never buried'],
    harmonyTraits: ['bright major-key call and response', 'stepwise verse melody resolving up into the chorus'],
    productionTraits: ['layered wall-of-sound reverb', 'crash-cymbal swells marking each chorus entry'],
    dynamicRange: 'wide',
    structureTraits: ['spoken-style intro leading into the hook', 'chorus repeats behind a rising vocal ad-lib in the outro']
  },
  'oldpop-sunshine-pop': {
    eraTag: '1967-1969 sunshine pop',
    rhythmFeel: ['bright bouncing 4/4 pop pulse', 'light tambourine shimmer on the backbeat'],
    vocalTraits: ['blended bright harmony vocals in parallel thirds and sixths', 'no single lead voice dominates'],
    productionTraits: ['crisp bright chamber-pop mix', 'harpsichord and woodwind sitting forward in the balance'],
    dynamicRange: 'medium',
    structureTraits: ['verse-pre-chorus-chorus form with a woodwind answer phrase', 'bridge modulates up before the final chorus']
  },
  'oldpop-baroque-pop': {
    eraTag: 'mid-1960s baroque pop',
    rhythmFeel: ['gentle chamber-pop pulse', 'rubato phrase endings before each chorus'],
    vocalTraits: ['restrained, classically-inflected lead vocal', 'warm low-register delivery, minimal vibrato'],
    harmonyTraits: ['extended sixth and ninth chords', 'chromatic descending bass line under refined chamber harmony'],
    productionTraits: ['intimate chamber-music room tone', 'oboe and flugelhorn kept close and dry'],
    dynamicRange: 'medium',
    structureTraits: ['string-quartet interlude between verse and chorus', 'restrained arrangement that never fully opens up']
  },
  'oldpop-british-beat': {
    eraTag: 'early-1960s British beat pop',
    rhythmFeel: ['jangly eighth-note beat pulse', 'tambourine locked to the backbeat'],
    vocalTraits: ['clear youthful group harmony', 'lead doubled by close backing vocals on the hook'],
    harmonyTraits: ['mid-song key-change lift', 'jangly major-key I-IV-V-vi movement'],
    productionTraits: ['bright British-beat studio mix', 'narrow warm mono-leaning image'],
    dynamicRange: 'medium',
    structureTraits: ['short verse-chorus form under 2:30', 'guitar hook doubles the vocal melody in the intro']
  },

  // ===== oldpop-* 1970s (10) =====
  'oldpop-soft-rock-am': {
    eraTag: '1970s AM-gold soft rock',
    rhythmFeel: ['relaxed soft-rock eighth-note pulse', 'brushed snare keeping time behind the beat'],
    vocalTraits: ['smooth adult tenor lead', 'unforced, conversational phrasing'],
    harmonyTraits: ['warm major-seventh chord color', 'gentle IV-I resolution into the chorus'],
    productionTraits: ['warm AM-radio compression', 'clean electric-guitar arpeggios sitting just under the vocal'],
    dynamicRange: 'medium',
    structureTraits: ['verse-chorus with a guitar-led instrumental bridge', 'chorus repeats the hook exactly, no variation']
  },
  'oldpop-orchestral-easy': {
    eraTag: '1970s orchestral easy listening',
    rhythmFeel: ['slow rubato easing into a gentle 4/4', 'harp glissando marking phrase transitions'],
    vocalTraits: ['warm orchestral-backed lead vocal', 'restrained vibrato, no belting'],
    productionTraits: ['polished middle-of-the-road easy-listening mix', 'strings placed forward, rhythm section kept soft'],
    dynamicRange: 'wide',
    structureTraits: ['through-composed, story unfolds across verses rather than a repeating hook', 'strings swell into a single climactic chorus late in the song']
  },
  'oldpop-close-harmony-duo': {
    eraTag: '1970s close-harmony duo pop',
    rhythmFeel: ['gentle folk-pop duet pulse', 'restrained brushed-drum backbeat'],
    vocalTraits: ['two-voice close-harmony duet', 'voices blend rather than one leading'],
    harmonyTraits: ['two-part close vocal harmony', 'simple I-IV-V duet movement'],
    productionTraits: ['intimate duo studio warmth', 'acoustic guitar and electric piano kept close and dry'],
    dynamicRange: 'low',
    structureTraits: ['verses alternate or share lead between two voices', 'chorus locks into tight two-part harmony throughout']
  },
  'oldpop-folk-rock-70s': {
    eraTag: '1970s folk rock',
    rhythmFeel: ['unhurried walking folk-rock tempo', 'light acoustic strum driving the pulse'],
    vocalTraits: ['plainspoken storytelling lead vocal', 'natural, unpolished delivery'],
    harmonyTraits: ['open-string folk chord voicings', 'modal touches under a mostly diatonic progression'],
    productionTraits: ['natural unvarnished folk-rock room tone', '12-string acoustic sitting forward in the mix'],
    dynamicRange: 'low',
    structureTraits: ['verse-driven storytelling with a short refrain, not a big hook chorus', 'harmonica answers the vocal line between verses']
  },
  'oldpop-motown-pop-soul': {
    eraTag: '1965-1972 Motown pop-soul',
    rhythmFeel: ['driving four-on-the-floor soul pulse', 'tambourine on all four beats'],
    vocalTraits: ['soulful lead with call-and-response backing', 'gospel-toned backing vocal stack'],
    harmonyTraits: ['gospel-tinged pop-soul chord color', 'call-and-response verse-to-backing movement'],
    productionTraits: ['tight punchy soul-pop mix', 'horn section stabs cutting through cleanly'],
    dynamicRange: 'medium',
    structureTraits: ['tight verse-chorus form under 3 minutes', 'horn stabs punctuate the end of each chorus line']
  },
  'oldpop-philly-soul-sweet': {
    eraTag: '1970s Philadelphia sweet soul',
    rhythmFeel: ['lush sixteenth-note soul groove', 'soft hi-hat pattern under a smooth bassline'],
    vocalTraits: ['velvet-toned romantic lead vocal', 'falls into a soft falsetto on high phrase endings'],
    harmonyTraits: ['sweet extended soul-pop chords', 'lush major-seventh color resolving softly at each phrase end'],
    productionTraits: ['velvet Philadelphia-style orchestral soul mix', 'sweeping strings placed just behind the lead vocal'],
    dynamicRange: 'wide',
    structureTraits: ['long intro with strings before the vocal enters', 'chorus expands with full strings on each repeat']
  },
  'oldpop-countrypolitan': {
    eraTag: '1970s countrypolitan pop',
    rhythmFeel: ['gentle countrypolitan two-step', 'brushed drums keeping a soft, unhurried pulse'],
    vocalTraits: ['warm plainspoken country-pop lead', 'clear, unaffected diction'],
    harmonyTraits: ['Nashville-style pop-country progression', 'pedal steel slides connecting each chord change'],
    productionTraits: ['polished countrypolitan studio sheen', 'string pads softening the country twang'],
    dynamicRange: 'low',
    structureTraits: ['plain verse-chorus form, no bridge', 'pedal steel answers the vocal line between phrases']
  },
  'oldpop-europop-glow': {
    eraTag: 'mid-1970s Scandinavian europop',
    rhythmFeel: ['bright driving four-on-the-floor europop pulse', 'clean electric bass locked to the kick'],
    vocalTraits: ['layered female harmony lead', 'bright, open vowel tone'],
    productionTraits: ['polished bright 1970s Scandinavian studio mix', 'arpeggiated synth and piano interlocking cleanly'],
    dynamicRange: 'wide',
    structureTraits: ['minor-key verse opening into a major-key anthemic chorus', 'layered female harmony stacks on the final chorus repeat']
  },
  'oldpop-yacht-west-coast': {
    eraTag: 'late-1970s West Coast yacht pop',
    rhythmFeel: ['smooth laid-back west-coast groove', 'fretless bass gliding between chord changes'],
    vocalTraits: ['smooth breezy adult-pop lead', 'relaxed, unhurried phrasing'],
    harmonyTraits: ['extended jazz-pop chord voicings', 'smooth ii-V movement under the chorus'],
    productionTraits: ['glossy polished studio mix', 'electric piano and clean guitar comping kept airy'],
    dynamicRange: 'low',
    structureTraits: ['long groove-based verses before a understated chorus lift', 'saxophone obbligato answers the vocal in the bridge']
  },
  'oldpop-piano-ballad-70s': {
    eraTag: '1970s piano pop ballad',
    rhythmFeel: ['rubato verse settling into a slow 4/4 chorus', 'brushed drums entering only once the chorus opens'],
    vocalTraits: ['emotive piano-ballad lead vocal', 'dynamic swell from a near-whisper verse to a fuller chorus'],
    harmonyTraits: ['cinematic ballad chord movement', 'lifted major-key color arriving at the chorus'],
    productionTraits: ['intimate piano-forward room tone widening at the chorus', 'strings held back until the arrangement opens up'],
    dynamicRange: 'wide',
    structureTraits: ['rubato piano-only verse opening into a full-band chorus', 'strings enter only from the second chorus onward']
  },

  // ===== oldpop-* 1980s (6) =====
  'oldpop-adult-contemporary-80s': {
    eraTag: '1980s warm adult contemporary',
    rhythmFeel: ['smooth 1980s adult-contemporary pulse', 'ungated soft kick keeping an even pocket'],
    vocalTraits: ['warm mature adult-contemporary lead', 'clear, controlled dynamics with no shouting'],
    harmonyTraits: ['warm sustained pad harmony', 'simple diatonic verse-to-chorus lift'],
    productionTraits: ['polished but ungated 1980s soft mix', 'sustained synth pad sitting under the electric piano'],
    dynamicRange: 'medium',
    structureTraits: ['even verse-chorus balance, no big dynamic swing', 'synth pad sustains under the whole chorus']
  },
  'oldpop-quiet-storm-warm': {
    eraTag: '1980s quiet-storm soul',
    rhythmFeel: ['slow quiet-storm groove', 'soft brushed drums barely audible under the bass'],
    vocalTraits: ['low close-mic quiet-storm lead', 'breathy, intimate delivery'],
    harmonyTraits: ['smooth minor-seventh quiet-storm chords', 'suspended chords resolving slowly'],
    productionTraits: ['intimate late-night close mix', 'fretless bass and alto saxophone kept warm and low'],
    dynamicRange: 'low',
    structureTraits: ['long groove-based verses, chorus barely lifts in volume', 'saxophone solo replaces a second bridge']
  },
  'oldpop-orchestral-ballad-80s': {
    eraTag: '1980s orchestral pop ballad',
    rhythmFeel: ['grand rubato-to-4/4 ballad pulse', 'timpani rolls building into each chorus'],
    vocalTraits: ['powerful-but-controlled ballad lead', 'restrained in the verse, opens up by the final chorus'],
    harmonyTraits: ['late key-change ballad lift', 'wide string harmony under the final chorus'],
    productionTraits: ['expansive 1980s orchestral ballad mix', 'wide string section given room to swell'],
    dynamicRange: 'wide',
    structureTraits: ['restrained verses building through a bridge into a key-change final chorus', 'timpani swells mark the transition into the last chorus']
  },
  'oldpop-light-synth-pop-warm': {
    eraTag: '1980s light synth pop',
    rhythmFeel: ['gentle mid-tempo synth-pop pulse', 'soft arpeggiator pattern driving the rhythm'],
    vocalTraits: ['clear light pop lead', 'unforced, conversational tone'],
    harmonyTraits: ['bright-but-soft synth-pop chords', 'gentle minor-to-major verse-to-chorus shift'],
    productionTraits: ['warm analog-digital hybrid mix', 'acoustic guitar blended under the synth pad'],
    dynamicRange: 'medium',
    structureTraits: ['even verse-chorus form with a short synth interlude', 'arpeggiator pattern carries through verse and chorus alike']
  },
  'oldpop-soft-duet-80s': {
    eraTag: '1980s soft pop duet',
    rhythmFeel: ['gentle 1980s duet ballad pulse', 'soft brushed drums entering after the first verse'],
    vocalTraits: ['alternating male and female verse leads', 'both voices blend evenly, neither dominates the chorus'],
    harmonyTraits: ['chorus harmony in thirds', 'simple I-IV-V duet movement'],
    productionTraits: ['warm intimate duet studio mix', 'electric piano and string pads kept soft behind both voices'],
    dynamicRange: 'medium',
    structureTraits: ['verses alternate between the two leads', 'chorus harmony in thirds locks both voices together']
  },
  'oldpop-standards-torch': {
    eraTag: 'mid-20th-century torch-song standard',
    rhythmFeel: ['relaxed jazz-standard swing', 'brushed drums keeping a soft, unhurried pulse'],
    vocalTraits: ['crooning torch-song lead vocal', 'behind-the-beat phrasing, close to speech at phrase endings'],
    harmonyTraits: ['jazz-standard extended chord changes', 'ii-V-I turnarounds resolving into each new section'],
    productionTraits: ['dim intimate torch-song lounge mix', 'muted trumpet and piano kept close and dry'],
    dynamicRange: 'low',
    structureTraits: ['AABA standard song form', 'rubato phrase endings before the final line of each section']
  },

  // ===== oldpop-* timeless warmth (6) =====
  'oldpop-warm-morning-glow': {
    eraTag: 'timeless warm morning pop',
    rhythmFeel: ['unhurried morning-glow pulse', 'minimal light percussion, almost no drive'],
    vocalTraits: ['gentle unhurried morning lead', 'soft, close-mic warmth with no vibrato flourish'],
    harmonyTraits: ['warm open major-key harmony', 'simple I-IV movement with no tension chords'],
    productionTraits: ['soft close morning-room mix', 'acoustic arpeggio and electric piano blended evenly'],
    dynamicRange: 'low',
    structureTraits: ['gentle verse-chorus form, never rises above a soft mezzo-piano', 'no bridge, chorus repeats plainly']
  },
  'oldpop-gentle-lullaby-pop': {
    eraTag: 'timeless lullaby-pop',
    rhythmFeel: ['gentle 6/8 lullaby sway', 'no percussion drive, just a soft rocking pulse'],
    vocalTraits: ['whispered gentle lead vocal', 'close-mic, almost spoken softness'],
    harmonyTraits: ['simple lullaby-like major harmony', 'repeating two-chord cradle figure'],
    productionTraits: ['hushed intimate lullaby mix', 'celesta and music-box color kept soft and distant'],
    dynamicRange: 'low',
    structureTraits: ['short looping verse-chorus form', 'melody repeats with only small variation each time']
  },
  'oldpop-hearth-acoustic': {
    eraTag: 'timeless hearth-side acoustic pop',
    rhythmFeel: ['gentle fireside acoustic pulse', 'soft brushed percussion, barely present'],
    vocalTraits: ['close warm fireside lead vocal', 'unhurried, conversational phrasing'],
    harmonyTraits: ['warm open major-key harmony', 'gentle countermelody answering the vocal'],
    productionTraits: ['minimal room ambience, close intimate vocal', 'nylon guitar and cello kept forward and dry'],
    dynamicRange: 'low',
    structureTraits: ['plain verse-chorus form, minimal dynamic movement', 'cello answers each vocal phrase rather than a separate instrumental break']
  },
  'oldpop-sunlit-strings-pop': {
    eraTag: 'timeless sunlit chamber-strings pop',
    rhythmFeel: ['mid-tempo sunlit lift pulse', 'light brushed drums keeping a gentle forward motion'],
    vocalTraits: ['bright gentle lead vocal', 'open, unforced upper register on the chorus'],
    harmonyTraits: ['bright gentle major-key rise', 'string counter-melody lifting into the chorus'],
    productionTraits: ['warm sunlit chamber-pop mix', 'chamber strings placed evenly with the acoustic rhythm guitar'],
    dynamicRange: 'medium',
    structureTraits: ['verse-chorus form with a string-led instrumental bridge', 'chorus opens wider each repeat as strings layer in']
  },
  'oldpop-slow-waltz-memory': {
    eraTag: 'timeless slow-waltz memory pop',
    rhythmFeel: ['slow 3/4 memory waltz', 'soft upright bass marking the downbeat of each measure'],
    vocalTraits: ['reflective waltz-tempo lead vocal', 'unhurried phrasing that lingers on phrase endings'],
    harmonyTraits: ['reflective minor-to-major progression', 'gentle countermelody answering the vocal phrase'],
    productionTraits: ['warm reflective waltz-hall room tone', 'accordion or vibraphone kept close, light brushed drums behind'],
    dynamicRange: 'medium',
    structureTraits: ['3/4 verse-chorus form', 'instrumental turn restates the melody once before the final verse']
  },
  'oldpop-evening-lamp-ballad': {
    eraTag: 'timeless low-dynamic evening ballad',
    rhythmFeel: ['low-dynamic evening ballad pulse', 'brushed drums entering only once the final chorus opens'],
    vocalTraits: ['restrained close evening lead vocal', 'never rises above a controlled mezzo-forte'],
    harmonyTraits: ['restrained evening-ballad chord movement', 'suspended chords held rather than resolved'],
    productionTraits: ['low-dynamic close evening mix, strings held back for the final chorus', 'piano and brushed drums given most of the space'],
    dynamicRange: 'wide',
    structureTraits: ['piano-only verses, strings held back until the final chorus', 'single dynamic swell reserved for the very end']
  },

  // ===== 11 named senior/cafe genres =====
  chanson: {
    eraTag: 'mid-20th-century French cafe pop',
    rhythmFeel: ['slow waltz in three', 'or a relaxed cafe four-four pulse', 'minimal syncopation'],
    harmonyTraits: ['minor-key melancholy', 'chromatic inner voice movement', 'circular progression that resists resolution'],
    vocalTraits: ['intimate close-mic delivery', 'declamatory phrasing close to speech', 'expressive rubato on phrase endings'],
    productionTraits: ['small room tone', 'little reverb', 'narrow warm stereo field'],
    dynamicRange: 'low',
    structureTraits: ['verse-driven with a short refrain', 'story unfolds across verses rather than repeating a hook']
  },
  'bossa-cafe': {
    eraTag: '1960s-present bossa cafe pop',
    rhythmFeel: ['soft bossa clave syncopation', 'nylon-guitar comping just behind the beat'],
    vocalTraits: ['elegant warm vocal', 'whispered syncopated phrasing that trails behind the beat'],
    harmonyTraits: ['bossa jazz chord color', 'ii-V-I movement under a whispered melody'],
    productionTraits: ['sunlit cafe mix', 'nylon guitar and light shaker kept close and airy'],
    dynamicRange: 'low',
    structureTraits: ['even verse-chorus form with almost no dynamic change', 'nylon guitar answers every vocal phrase']
  },
  'smooth-jazz-lounge': {
    eraTag: 'timeless cocktail-lounge jazz',
    rhythmFeel: ['cocktail-lounge shuffle swing', 'brushed ride cymbal keeping a soft pulse'],
    vocalTraits: ['optional mellow lounge vocal', 'relaxed, unhurried phrasing behind the beat'],
    harmonyTraits: ['ii-V-I turnarounds', 'extended maj7/9 lounge chords'],
    productionTraits: ['dim analog lounge room tone', 'vibraphone and saxophone kept warm and close'],
    dynamicRange: 'low',
    structureTraits: ['AABA lounge form', 'saxophone solo across the bridge in place of a sung verse']
  },
  'jazz-pop': {
    eraTag: 'mid-century-to-modern jazz pop',
    rhythmFeel: ['light swing feel', 'walking upright bass'],
    vocalTraits: ['warm cafe vocal', 'relaxed phrasing just behind the beat'],
    harmonyTraits: ['ii-V-I turnarounds', 'maj7/9/13 extended voicings'],
    productionTraits: ['warm analog room tone', 'Rhodes and brushed snare kept close and unhurried'],
    dynamicRange: 'low',
    structureTraits: ['verse-chorus form with a short improvised solo in the bridge', 'brushed snare opens each chorus']
  },
  'retro-soul-pop': {
    eraTag: '1960s-70s soul pop',
    rhythmFeel: ['sixteenth-note hi-hat groove', 'ghost-note electric bass pocket'],
    vocalTraits: ['soulful lead with tasteful backing vocals', 'natural rasp on emotional phrase peaks'],
    harmonyTraits: ['soul seventh chords', 'gospel-tinged passing chords'],
    productionTraits: ['hand-played retro warmth', 'tape saturation rounding the drums and bass'],
    dynamicRange: 'medium',
    structureTraits: ['tight verse-chorus form with horn-stab punctuation', 'backing vocals answer the lead call-and-response style']
  },
  'soft-rock': {
    eraTag: '1970s-80s soft rock radio',
    rhythmFeel: ['steady soft rock pulse', 'straight eighth-note guitar strum'],
    vocalTraits: ['clear adult vocal', 'confident but never shouted delivery'],
    harmonyTraits: ['restrained chorus lift', 'simple I-IV-V-vi movement'],
    productionTraits: ['polished radio arrangement', 'clean electric guitars layered evenly with the piano'],
    dynamicRange: 'medium',
    structureTraits: ['verse-chorus form with a guitar solo in the bridge', 'chorus repeats the hook with no variation']
  },
  'adult-contemporary': {
    eraTag: '1980s-present adult contemporary',
    rhythmFeel: ['straight 4/4 pop feel', 'no swing, no syncopation'],
    vocalTraits: ['mature clear vocal', 'conversational, unforced delivery'],
    harmonyTraits: ['simple diatonic harmony', 'gentle pre-chorus lift with no tension chords'],
    productionTraits: ['radio-friendly polish', 'sustained piano pads sitting under a clean strummed acoustic'],
    dynamicRange: 'medium',
    structureTraits: ['even verse-chorus balance', 'pre-chorus adds a small lift before every chorus']
  },
  'acoustic-pop': {
    eraTag: 'timeless acoustic pop',
    rhythmFeel: ['light acoustic pulse', 'fingerpicked pattern under a simple strum'],
    vocalTraits: ['clear intimate vocal', 'close-mic warmth with natural dynamics'],
    harmonyTraits: ['simple pop lift', 'diatonic I-V-vi-IV movement'],
    productionTraits: ['natural acoustic room', 'soft piano answers kept just behind the guitar'],
    dynamicRange: 'low',
    structureTraits: ['plain verse-chorus form, natural and unproduced', 'piano answers the vocal between phrases']
  },
  'folk-pop': {
    eraTag: '1960s-present folk pop',
    rhythmFeel: ['strummed folk-pop pulse', 'steady acoustic backbeat'],
    vocalTraits: ['plainspoken storyteller vocal', 'natural, unpolished warmth'],
    harmonyTraits: ['sing-along chorus lift', 'open diatonic folk chords'],
    productionTraits: ['natural acoustic warmth', 'light mandolin texture kept close and dry'],
    dynamicRange: 'low',
    structureTraits: ['verse-driven storytelling with a plainspoken refrain', 'mandolin answers the vocal between verses']
  },
  'piano-ballad': {
    eraTag: '1970s-present piano pop ballad',
    rhythmFeel: ['slow rubato-to-4/4 piano pulse', 'settles into a steady pulse by the first chorus'],
    vocalTraits: ['intimate verse vocal', 'opens into a fuller, more emotional tone by the chorus'],
    harmonyTraits: ['suspended piano voicings', 'cinematic chord movement into the chorus'],
    productionTraits: ['gentle cinematic chorus space', 'felt piano and soft strings widening at the chorus'],
    dynamicRange: 'wide',
    structureTraits: ['piano-only verse opening into a string-backed chorus', 'single dynamic climax reserved for the final chorus']
  },
  'healing-ballad': {
    eraTag: 'timeless pop ballad',
    rhythmFeel: ['slow 4/4 pulse', 'no rhythmic drive, almost rubato'],
    vocalTraits: ['gentle emotional vocal', 'soft, controlled dynamics throughout'],
    harmonyTraits: ['suspended add9 harmony', 'hopeful resolution at the very end'],
    productionTraits: ['soft comfort mix', 'piano and acoustic guitar kept close, strings held back'],
    dynamicRange: 'low',
    structureTraits: ['verse-chorus form with minimal dynamic movement', 'string swells only in the final chorus']
  },

  // ===== optional: rnb-* candidates passing senior constraints =====
  'rnb-modern-soft-male': { dynamicRange: 'low', structureTraits: ['verse-chorus slow-jam form', 'chorus barely rises above the verse in volume'] },
  'rnb-neo-soul-pocket': { dynamicRange: 'low', structureTraits: ['groove-driven verses with a short vocal ad-lib outro', 'no big dynamic lift at the chorus'] },
  'rnb-nineties-slow-jam': { dynamicRange: 'medium', structureTraits: ['verse-chorus slow-jam form', 'backing vocals stack in on the second chorus'] },
  'rnb-quiet-storm-baritone': { dynamicRange: 'low', structureTraits: ['long groove-based verses, chorus lifts only slightly', 'instrumental solo stands in for a second bridge'] },
  'rnb-soulful-gospel-warmth': { dynamicRange: 'wide', structureTraits: ['verse building into a gospel-lifted chorus', 'call-and-response backing vocals answer the lead'] },
  'rnb-silky-studio-rnb': { dynamicRange: 'low', structureTraits: ['even verse-chorus balance, polished and understated', 'no dramatic bridge, chorus repeats cleanly'] },
  'rnb-neo-soul-groove': { dynamicRange: 'low', structureTraits: ['groove-first verse-chorus form', 'live drum fill marks each transition instead of a big dynamic jump'] },
  'rnb-two-thousands-rnb': { dynamicRange: 'medium', structureTraits: ['tight verse-chorus pop-R&B form', 'stacked harmonies enter from the second chorus'] },
  'rnb-intimate-rnb-ballad': { dynamicRange: 'wide', structureTraits: ['piano-led verse building into a fuller chorus', 'single emotional peak near the end'] },
  'rnb-old-school-romance-rnb': { dynamicRange: 'medium', structureTraits: ['classic verse-chorus soul-pop form', 'backing vocals answer the lead each chorus'] },
  'rnb-late-night-neo-soul': { dynamicRange: 'low', structureTraits: ['loose groove-based verses, understated chorus', 'Rhodes solo replaces a second verse late in the song'] },
  'rnb-elegant-neo-soul': { dynamicRange: 'low', structureTraits: ['even verse-chorus balance, restrained throughout', 'stacked harmony enters only on the final chorus'] },
  'rnb-glossy-nineties-rnb': { dynamicRange: 'medium', structureTraits: ['polished verse-chorus form', 'bridge modulates gently before the final chorus'] },
  'neo-soul': {
    vocalTraits: ['soulful controlled R&B vocal', 'close-mic warmth with restrained runs'],
    dynamicRange: 'low',
    structureTraits: ['hand-played groove-first verse-chorus form', 'stacked background vocals answer the lead in the chorus']
  },
  'rnb-ballad-2020s': {
    vocalTraits: ['emotional close R&B vocal', 'controlled dynamics that open only at the peak'],
    dynamicRange: 'wide',
    structureTraits: ['piano-and-sub-bass verse building into an airy chorus', 'single dynamic swell near the end, otherwise restrained']
  },

  // ===== optional: jazz-* vocal/smooth candidates =====
  'jazz-classic-vocal-lounge': { dynamicRange: 'low', structureTraits: ['AABA standard form', 'crooner phrasing stretches behind the beat'] },
  'jazz-soft-vocal-trio': { dynamicRange: 'low', structureTraits: ['intimate trio form, verse-driven', 'piano answers the vocal between phrases'] },
  'jazz-jazz-ballad-vocal': { dynamicRange: 'wide', structureTraits: ['rubato verse opening into a fuller ballad chorus', 'single emotional peak near the end'] },
  'jazz-smooth-sax-vocal': { dynamicRange: 'low', structureTraits: ['verse-chorus form with a saxophone answering the vocal', 'no dramatic bridge'] },
  'jazz-bossa-vocal-jazz': { dynamicRange: 'low', structureTraits: ['even bossa verse-chorus form', 'guitar comping answers every vocal phrase'] },
  'jazz-torch-vocal-jazz': { dynamicRange: 'low', structureTraits: ['AABA torch-song form', 'rubato phrase endings before each new section'] },
  'jazz-late-night-lounge': { dynamicRange: 'low', structureTraits: ['loose lounge form, understated throughout', 'guitar solo stands in for a second verse'] },
  'jazz-mellow-flugelhorn-vocal': { dynamicRange: 'medium', structureTraits: ['verse-chorus ballad form', 'flugelhorn answers the vocal between phrases'] },
  'jazz-cabaret-jazz': { dynamicRange: 'wide', structureTraits: ['theatrical verse building into a bigger chorus', 'piano punctuates the ends of phrases'] },

  // ===== TASK B1 — kr-2030 workspace, 6 new genres =====
  // Korean-axis rule (this task's own §3-1): at least 4/6 lead with bass or
  // drum vocabulary in instrumentation's first 2 items, and at least 4/6
  // carry a short-repeated-chorus structureTraits entry — the measurable
  // form of "베이스·드럼 중심, 후렴 짧고 직접적" versus C1's future Japanese-axis
  // contrast (guitar/piano-led, A멜로-B멜로-사비 structure, which never
  // appears anywhere below on purpose).
  'kr2030-emo-band-pop': {
    eraTag: '2020s Korean band pop',
    instrumentation: ['driving electric bass', 'live rock drum kit', 'clean-to-crunch electric guitar', 'piano countermelody'],
    rhythmFeel: ['driving straight-eighth band pulse', 'tom-heavy prechorus build'],
    harmonyTraits: ['minor-to-major prechorus lift', 'anthemic diatonic chorus'],
    productionTraits: ['modern clean band mix', 'tight punchy low end'],
    vocalTraits: ['emotionally direct Korean lead vocal', 'occasional falsetto lift on the hook'],
    dynamicRange: 'wide',
    structureTraits: ['short repeated one-line chorus hook', 'prechorus builds directly into the chorus with no bridge detour']
  },
  'kr2030-electro-pop': {
    eraTag: '2020s Korean electro pop',
    instrumentation: ['punchy synth bass', 'four-on-the-floor electronic kick', 'bright pluck synth', 'filtered synth pad'],
    rhythmFeel: ['four-on-the-floor pulse with offbeat accents', 'UK garage-influenced syncopation'],
    harmonyTraits: ['simple repeated verse-chorus progression', 'minimal chord substitution, direct diatonic movement'],
    productionTraits: ['clean digital pop mix', 'sidechain-pumped low end'],
    vocalTraits: ['confident female-led pop vocal', 'short clipped phrasing on the verse'],
    dynamicRange: 'low',
    structureTraits: ['one-line chorus hook repeated verbatim across the song', 'chorus arrives early with no extended bridge section']
  },
  'kr2030-dawn-rnb': {
    eraTag: '2020s Korean R&B',
    instrumentation: ['deep round bass', 'soft brushed trap drum programming', 'muted electric piano', 'airy synth pad'],
    rhythmFeel: ['slow half-time R&B pocket', 'loose behind-the-beat swing'],
    harmonyTraits: ['extended minor-seventh chord color', 'smooth ii-V neo-soul movement'],
    productionTraits: ['dark intimate late-night mix', 'sparse negative space between hits'],
    vocalTraits: ['close intimate Korean R&B lead', 'airy ad-lib runs'],
    dynamicRange: 'low',
    structureTraits: ['short repeated hook phrase carries the chorus', 'verse and chorus share the same low-key dynamic level']
  },
  'kr2030-ost-ballad': {
    eraTag: '2020s Korean OST-style ballad',
    instrumentation: ['grand piano', 'sweeping string section entering at the chorus', 'soft brushed drums', 'warm sustained bass'],
    rhythmFeel: ['rubato verse settling into a slow steady chorus pulse', 'no swing, straight ballad time-feel'],
    harmonyTraits: ['suspended chords resolving into a lush chorus progression', 'late key-change lift into the final chorus'],
    productionTraits: ['cinematic OST-style room bloom', 'strings held back until the chorus'],
    vocalTraits: ['emotive Korean ballad lead', 'controlled power building into the final chorus'],
    dynamicRange: 'wide',
    structureTraits: ['piano-only verse opening into a fully-arranged chorus', 'final chorus modulates up for the emotional peak']
  },
  'kr2030-y2k-retro': {
    eraTag: '2000s Y2K Korean pop',
    instrumentation: ['punchy electric bass', 'crisp programmed drum kit', 'bright digital synth stab', 'clean electric guitar chops'],
    rhythmFeel: ['syncopated Y2K R&B-pop groove', 'crisp programmed backbeat'],
    harmonyTraits: ['bright major-key verse-to-chorus lift', 'catchy diatonic hook progression'],
    productionTraits: ['bright early-2000s digital polish', 'clean compressed pop mix'],
    vocalTraits: ['bright confident Korean pop lead', 'stacked unison hook vocals'],
    dynamicRange: 'medium',
    structureTraits: ['short direct verse-chorus form', 'hook repeats immediately after the first verse']
  },
  'kr2030-acoustic-folk': {
    eraTag: '2020s Korean acoustic folk pop',
    instrumentation: ['fingerpicked acoustic guitar', 'soft piano answers', 'light hand percussion', 'warm upright bass'],
    rhythmFeel: ['gentle acoustic strum-and-pick pulse', 'unhurried folk-pop tempo'],
    harmonyTraits: ['simple open-chord folk progression', 'gentle major-key resolution'],
    productionTraits: ['natural low-stimulus acoustic room tone', 'minimal reverb, close and dry'],
    vocalTraits: ['plainspoken warm Korean lead', 'soft close-mic delivery'],
    dynamicRange: 'low',
    structureTraits: ['simple verse-chorus form with no dramatic build', 'chorus stays close in dynamic to the verse']
  }
};

/**
 * Merges a genre's own existing (often sparse) rhythm/vocal/harmony/
 * production/instruments fields with this file's override map. Returns
 * undefined for any genre id not in GENRE_TRAIT_OVERRIDES — the matcher's
 * own fallback estimation path (styleCore/instruments/tempoRange) takes
 * over for those, per this task's explicit "don't populate all 320" scope.
 */
export function buildGenreTraits(genre: {
  id: string;
  eraTag?: string;
  instruments?: string[];
  rhythm?: string[];
  vocal?: string[];
  harmony?: string[];
  production?: string[];
}): GenreTraits | undefined {
  const override = GENRE_TRAIT_OVERRIDES[genre.id];
  if (!override) return undefined;
  // TASK A-4's own quality bar caps every axis at 5 items; the shared
  // notion-derived generator (genreLibrary/index.ts's mergeTraitArrays)
  // caps some axes at 6 for its own unrelated reasons, so re-cap to 5 here
  // rather than changing that shared function (used by 240+ other genres).
  const cap5 = (items: string[]) => items.slice(0, 5);
  return {
    eraTag: override.eraTag ?? genre.eraTag ?? 'timeless',
    instrumentation: cap5(override.instrumentation ?? genre.instruments ?? []),
    rhythmFeel: cap5(override.rhythmFeel ?? genre.rhythm ?? []),
    harmonyTraits: cap5(override.harmonyTraits ?? genre.harmony ?? []),
    productionTraits: cap5(override.productionTraits ?? genre.production ?? []),
    vocalTraits: cap5(override.vocalTraits ?? genre.vocal ?? []),
    dynamicRange: override.dynamicRange,
    structureTraits: override.structureTraits
  };
}
