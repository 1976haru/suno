/**
 * TASK v3.58 (지시문 v3.58 TASK 3) — a user naming a real artist ("비틀즈
 * 스타일로", "카펜터스 느낌") is describing a sound, not asking for a cover or
 * soundalike. core/artistReferenceDecomposer.ts uses this table's keys only
 * to DETECT the reference in free text; every value field below is a
 * generic musical/era descriptor, never the artist's own name, a song
 * title, or anything that would read as impersonation. These are the kind
 * of arrangement choices common across an entire era/scene, not a specific
 * recording — that's what makes them usable in a Suno style prompt at all
 * (Suno filters/ignores real artist names outright; see
 * core/artistReferenceDecomposer.ts's module comment for the full
 * reasoning, and excludePrompt's existing "famous artist imitation" rule
 * this table is careful never to contradict).
 */

export interface ArtistReferenceSeed {
  /** Detection key: lowercase name/alias variants, pipe-separated, matched as whole-word-ish substrings against normalized free text. Never surfaced to Suno — see decomposeArtistReferences's matchedSurface (UI-only). */
  aliasPattern: string;
  eraTag: string;
  instrumentation: string[];
  harmonyTraits: string[];
  rhythmTraits: string[];
  productionTraits: string[];
  vocalTraits: string[];
  /** Ids from src/data/genreLibrary + src/data/presets's genrePacks — closest existing library matches, not a claim of exact genre equivalence. */
  suggestedGenreIds: string[];
  excludeAdditions: string[];
}

export const ARTIST_REFERENCE_SEEDS: ArtistReferenceSeed[] = [
  {
    aliasPattern: 'beatles|비틀즈|비틀스|ザ・ビートルズ|ビートルズ',
    eraTag: 'mid-1960s British beat pop',
    instrumentation: [
      'jangly 12-string electric guitar',
      'melodic bass playing countermelody',
      'bright compact drum kit with tambourine on the backbeat',
      'upright piano doubling the rhythm guitar'
    ],
    harmonyTraits: [
      'major-key verses with an unexpected borrowed chord',
      'abrupt key shift into the middle section',
      'parallel thirds and sixths in the backing harmony'
    ],
    rhythmTraits: ['driving eighth-note strum', 'handclaps on the chorus'],
    productionTraits: ['narrow warm 1960s mono-leaning mix', 'natural room reverb', 'tape compression on the drums'],
    vocalTraits: ['two-part male harmony singing in close intervals', 'bright forward diction', 'unison shout on the hook'],
    suggestedGenreIds: ['folk-pop', 'acoustic-pop'],
    excludeAdditions: ['famous band imitation', 'soundalike vocals', 'copied melodies']
  },
  {
    aliasPattern: 'carpenters|카펜터스|カーペンターズ',
    eraTag: 'early-1970s soft adult-contemporary pop',
    instrumentation: ['lush orchestral strings', 'soft electric piano', 'warm upright bass', 'brushed drum kit'],
    harmonyTraits: ['rich extended major-seventh chords', 'gentle key change into the final chorus'],
    rhythmTraits: ['unhurried mid-tempo ballad pulse', 'no syncopation, straight quarter-note feel'],
    productionTraits: ['warm close-mic vocal-forward mix', 'smooth analog tape warmth', 'gentle string swell under the chorus'],
    vocalTraits: ['low warm contralto female lead', 'soft breath control', 'close vocal stacked harmonies'],
    // TASK v3.61 (TASK C) — was ['adult-contemporary', 'piano-ballad'], both
    // real but generic (they existed before oldpop-* did); oldpop-baroque-pop's
    // string-quartet/oboe-obbligato chamber texture and oldpop-soft-rock-am's
    // warm AM pulse are much closer real matches to the traits already
    // described above, and oldpop-close-harmony-duo covers the stacked
    // close-harmony vocal trait.
    suggestedGenreIds: ['oldpop-baroque-pop', 'oldpop-soft-rock-am', 'oldpop-close-harmony-duo'],
    excludeAdditions: ['famous duo imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'abba|아바|アバ',
    eraTag: 'late-1970s European disco pop',
    instrumentation: ['bright analog synth pad', 'four-on-the-floor bass', 'strummed acoustic guitar layered under synths', 'orchestral string stabs'],
    harmonyTraits: ['major-key anthemic chorus lift', 'minor-to-major verse-to-chorus shift'],
    rhythmTraits: ['steady four-on-the-floor disco pulse', 'syncopated bass movement'],
    productionTraits: ['bright polished stereo-wide mix', 'layered vocal doubling'],
    vocalTraits: ['male and female vocals in close harmony', 'bright open female lead', 'stacked chorus harmony'],
    // TASK v3.61 (TASK C) — was ['disco-pop-2020s'], a modern-chill/city-night
    // genre never in senior-morning's core tier, so this suggestion was
    // silently discarded every time (recommendConceptLocal filters
    // suggestedGenreIds through coreGenreIds.has(id)) and every "아바 같은"
    // request fell back to a generic adult-contemporary recommendation.
    // oldpop-europop-glow (layered female harmony, bright unison chorus
    // lift) is the direct real match for the traits already described
    // above; oldpop-close-harmony-duo and oldpop-orchestral-easy cover the
    // harmony/string-arrangement side.
    suggestedGenreIds: ['oldpop-europop-glow', 'oldpop-close-harmony-duo', 'oldpop-orchestral-easy'],
    excludeAdditions: ['famous group imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'simon and garfunkel|simon & garfunkel|사이먼 앤 가펑클|サイモン&ガーファンクル',
    eraTag: 'mid-1960s American folk pop',
    instrumentation: ['fingerpicked acoustic guitar', 'soft upright bass', 'light orchestral string arrangement'],
    harmonyTraits: ['plain diatonic folk harmony', 'modal touches in the verse'],
    rhythmTraits: ['gentle unhurried folk strum', 'minimal percussion'],
    productionTraits: ['intimate close-mic acoustic mix', 'natural room ambience'],
    vocalTraits: ['two-part male close vocal harmony', 'soft breathy delivery'],
    // TASK v3.61 (TASK C) — oldpop-folk-rock-70s (12-string acoustic,
    // mandolin/harmonica, unhurried walking tempo) and oldpop-close-harmony-duo
    // are closer real matches to the fingerpicked-acoustic/two-part-harmony
    // traits above than the pre-existing generic folk-pop/acoustic-pop.
    suggestedGenreIds: ['oldpop-folk-rock-70s', 'oldpop-close-harmony-duo'],
    excludeAdditions: ['famous duo imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'frank sinatra|프랭크 시나트라|프랭크시나트라|フランク・シナトラ',
    eraTag: 'mid-20th-century vocal jazz standards',
    instrumentation: ['full big-band horn section', 'walking upright bass', 'brushed swing drums', 'lush string pad'],
    harmonyTraits: ['ii-V-I jazz turnarounds', 'extended maj7/9 chord color'],
    rhythmTraits: ['relaxed behind-the-beat swing phrasing'],
    productionTraits: ['warm analog room tone', 'close vocal-forward mix'],
    vocalTraits: ['smooth confident male baritone', 'behind-the-beat phrasing', 'crisp diction'],
    suggestedGenreIds: ['smooth-jazz-lounge', 'jazz-pop'],
    excludeAdditions: ['famous crooner imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'ella fitzgerald|엘라 피츠제럴드|エラ・フィッツジェラルド',
    eraTag: 'mid-20th-century vocal jazz',
    instrumentation: ['piano trio comping', 'walking upright bass', 'brushed ride cymbal swing'],
    harmonyTraits: ['ii-V-I turnarounds', 'maj7/9/13 extended voicings'],
    rhythmTraits: ['light swing feel', 'scat-friendly rhythmic phrasing'],
    productionTraits: ['warm intimate club room tone'],
    vocalTraits: ['agile clear female jazz vocal', 'confident swing phrasing'],
    suggestedGenreIds: ['jazz-pop', 'smooth-jazz-lounge'],
    excludeAdditions: ['famous vocalist imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'eagles|이글스|イーグルス',
    eraTag: 'mid-1970s American soft rock',
    instrumentation: ['twin clean electric guitars', 'steady acoustic rhythm guitar', 'warm bass', 'restrained drum kit'],
    harmonyTraits: ['open major-key country-tinged harmony', 'close vocal harmony stacks'],
    rhythmTraits: ['mid-tempo straight rock pulse'],
    productionTraits: ['polished warm 1970s rock mix', 'wide stereo guitar layering'],
    vocalTraits: ['warm male lead with layered harmony backing'],
    suggestedGenreIds: ['soft-rock'],
    excludeAdditions: ['famous band imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'fleetwood mac|플리트우드 맥|フリートウッド・マック',
    eraTag: 'late-1970s soft rock',
    instrumentation: ['clean electric guitar arpeggios', 'melodic bass', 'warm keyboard pads', 'tambourine accents'],
    harmonyTraits: ['bittersweet major-to-minor shifts'],
    rhythmTraits: ['mid-tempo rock ballad pulse'],
    productionTraits: ['warm polished 1970s studio mix'],
    vocalTraits: ['breathy female lead with male harmony answer'],
    suggestedGenreIds: ['soft-rock'],
    excludeAdditions: ['famous band imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'bee gees|비지스|ビージーズ',
    eraTag: 'late-1970s falsetto disco pop',
    instrumentation: ['funky rhythm guitar chop', 'four-on-the-floor bass', 'string section stabs'],
    harmonyTraits: ['bright major-key disco chorus lift'],
    rhythmTraits: ['four-on-the-floor disco pulse', 'syncopated funk guitar chop'],
    productionTraits: ['bright polished disco-era mix'],
    vocalTraits: ['high falsetto male lead', 'close brotherly harmony stacks'],
    // TASK v3.61 (TASK C) — was ['disco-pop-2020s'], same non-senior-core
    // gap as the abba seed above; oldpop-europop-glow and
    // oldpop-philly-soul-sweet are real senior-morning-core matches.
    suggestedGenreIds: ['oldpop-europop-glow', 'oldpop-philly-soul-sweet'],
    excludeAdditions: ['famous group imitation', 'soundalike vocals', 'falsetto imitation of a specific singer']
  },
  {
    aliasPattern: 'stevie wonder|스티비 원더|スティービー・ワンダー',
    eraTag: '1970s soul and funk-pop',
    instrumentation: ['clavinet', 'funky electric bass', 'warm horn section', 'Rhodes electric piano'],
    harmonyTraits: ['soul-jazz seventh and ninth chord color'],
    rhythmTraits: ['syncopated funk pocket'],
    productionTraits: ['warm analog soul-era mix'],
    vocalTraits: ['soulful expressive male lead with melisma'],
    // TASK v3.61 (TASK C) — oldpop-motown-pop-soul (driving four-beat
    // tambourine, melodic bassline, gospel-toned backing) is a closer real
    // match to the funk/soul traits above than retro-soul-pop alone.
    suggestedGenreIds: ['oldpop-motown-pop-soul', 'retro-soul-pop'],
    excludeAdditions: ['famous artist imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'carole king|캐롤 킹|キャロル・キング',
    eraTag: 'early-1970s singer-songwriter pop',
    instrumentation: ['piano-led arrangement', 'warm acoustic guitar', 'soft rhythm section'],
    harmonyTraits: ['warm soul-tinged pop chords'],
    rhythmTraits: ['relaxed mid-tempo singer-songwriter pulse'],
    productionTraits: ['intimate warm piano-forward mix'],
    vocalTraits: ['warm conversational female lead'],
    suggestedGenreIds: ['piano-ballad', 'acoustic-pop'],
    excludeAdditions: ['famous artist imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'elton john|엘튼 존|エルトン・ジョン',
    eraTag: 'early-1970s piano-driven pop rock',
    instrumentation: ['grand piano lead', 'orchestral string arrangement', 'steady rock rhythm section'],
    harmonyTraits: ['dramatic major-key piano chord movement'],
    rhythmTraits: ['building mid-tempo piano-rock pulse'],
    productionTraits: ['warm 1970s orchestral-rock mix'],
    vocalTraits: ['expressive theatrical male lead'],
    // TASK v3.61 (TASK C) — oldpop-piano-ballad-70s (grand piano lead,
    // rubato verse opening into an orchestral chorus) is the direct real
    // match for the piano-driven traits already described above.
    suggestedGenreIds: ['oldpop-piano-ballad-70s', 'piano-ballad'],
    excludeAdditions: ['famous artist imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'beach boys|비치 보이스|ビーチ・ボーイズ',
    eraTag: 'mid-1960s American harmony pop',
    instrumentation: ['bright strummed guitars', 'melodic bass', 'light percussion'],
    harmonyTraits: ['dense stacked vocal-harmony chords', 'unexpected chromatic passing chords'],
    rhythmTraits: ['bright surf-adjacent mid-tempo pulse'],
    productionTraits: ['warm layered 1960s studio mix'],
    vocalTraits: ['dense multi-part male vocal harmony stack'],
    // TASK v3.61 (TASK C) — oldpop-sunshine-pop (bright parallel-thirds/
    // sixths harmony, harpsichord/glockenspiel/woodwind color) is a much
    // closer real match to the dense stacked-harmony traits above than
    // folk-pop.
    suggestedGenreIds: ['oldpop-sunshine-pop', 'folk-pop'],
    excludeAdditions: ['famous group imitation', 'soundalike vocals']
  },
  {
    aliasPattern: '\\bbread\\b|브레드밴드|ブレッド',
    eraTag: 'early-1970s soft rock ballad',
    instrumentation: ['clean acoustic and electric guitar blend', 'warm bass', 'restrained strings'],
    harmonyTraits: ['gentle major-key ballad chords'],
    rhythmTraits: ['slow soft-rock ballad pulse'],
    productionTraits: ['warm intimate 1970s ballad mix'],
    vocalTraits: ['soft warm male lead'],
    suggestedGenreIds: ['soft-rock', 'piano-ballad'],
    excludeAdditions: ['famous band imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'air supply|에어 서플라이|エア・サプライ',
    eraTag: 'early-1980s adult-contemporary power ballad',
    instrumentation: ['soaring electric guitar', 'lush synth strings', 'steady soft-rock rhythm section'],
    harmonyTraits: ['sweeping major-key ballad build'],
    rhythmTraits: ['slow building ballad pulse into a fuller chorus'],
    productionTraits: ['polished early-1980s adult-contemporary mix'],
    vocalTraits: ['soaring emotional male lead'],
    suggestedGenreIds: ['adult-contemporary'],
    excludeAdditions: ['famous duo imitation', 'soundalike vocals']
  },
  {
    aliasPattern: '유재하',
    eraTag: '1980s Korean piano ballad',
    instrumentation: ['piano-led arrangement', 'soft strings', 'restrained rhythm section'],
    harmonyTraits: ['warm jazz-tinged ballad chords'],
    rhythmTraits: ['slow rubato-leaning ballad pulse'],
    productionTraits: ['warm intimate 1980s Korean ballad mix'],
    vocalTraits: ['gentle restrained male lead'],
    suggestedGenreIds: ['piano-ballad', 'adult-contemporary'],
    excludeAdditions: ['famous artist imitation', 'soundalike vocals']
  },
  {
    aliasPattern: '이문세',
    eraTag: 'late-1980s Korean adult-contemporary pop',
    instrumentation: ['warm synth pad', 'acoustic guitar', 'soft rhythm section'],
    harmonyTraits: ['warm nostalgic pop chord movement'],
    rhythmTraits: ['mid-tempo Korean pop-ballad pulse'],
    productionTraits: ['warm late-1980s Korean radio mix'],
    vocalTraits: ['warm expressive male lead'],
    suggestedGenreIds: ['adult-contemporary', 'piano-ballad'],
    excludeAdditions: ['famous artist imitation', 'soundalike vocals']
  },
  {
    aliasPattern: '山口百恵|야마구치 모모에|yamaguchi momoe',
    eraTag: 'late-1970s Japanese kayokyoku',
    instrumentation: ['live string section', 'electric piano', 'brushed drums'],
    harmonyTraits: ['graceful kayokyoku minor-to-major cadence'],
    rhythmTraits: ['restrained ballad pulse'],
    productionTraits: ['analog tape warmth, narrow stereo image'],
    vocalTraits: ['mature expressive female lead'],
    suggestedGenreIds: ['kayokyoku-70s', 'showa-modern'],
    excludeAdditions: ['famous artist imitation', 'soundalike vocals']
  },
  {
    aliasPattern: '松田聖子|마츠다 세이코|matsuda seiko',
    eraTag: 'early-1980s Japanese idol pop',
    instrumentation: ['bright synth pad', 'clean guitar', 'four-on-the-floor-adjacent pop rhythm'],
    harmonyTraits: ['bright major-key idol-pop chorus lift'],
    rhythmTraits: ['upbeat 1980s Japanese pop pulse'],
    productionTraits: ['bright polished early-1980s Japanese pop mix'],
    vocalTraits: ['bright youthful female lead'],
    suggestedGenreIds: ['city-pop-soft', 'showa-modern'],
    excludeAdditions: ['famous artist imitation', 'soundalike vocals']
  },
  {
    aliasPattern: '竹内まりや|타케우치 마리야|takeuchi mariya',
    eraTag: '1980s Japanese city pop',
    instrumentation: ['clean chorus-effect guitar', 'slap electric bass', 'electric piano stabs'],
    harmonyTraits: ['jazz-colored city-pop chord movement'],
    rhythmTraits: ['syncopated 16th-note city-pop groove'],
    productionTraits: ['polished glossy 1980s Japanese city-pop mix'],
    vocalTraits: ['warm silky female lead'],
    suggestedGenreIds: ['city-pop-soft', 'city-pop-night'],
    excludeAdditions: ['famous artist imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'yoasobi|요아소비|ヨアソビ',
    eraTag: 'late-2010s/2020s uptempo Japanese pop',
    instrumentation: ['bright digital synth lead', 'fast piano runs', 'crisp modern pop drums'],
    harmonyTraits: ['fast-moving pop chord changes'],
    rhythmTraits: ['fast uptempo modern J-pop pulse'],
    productionTraits: ['bright modern digital pop mix'],
    vocalTraits: ['bright agile female lead with rapid syllable delivery'],
    suggestedGenreIds: ['jpop-2000s-dance'],
    excludeAdditions: ['famous duo imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'norah jones|노라 존스|ノラ・ジョーンズ',
    eraTag: '2000s jazz-tinged singer-songwriter pop',
    instrumentation: ['soft piano and Rhodes blend', 'brushed drums', 'warm upright bass'],
    harmonyTraits: ['relaxed jazz-pop chord color'],
    rhythmTraits: ['laid-back mid-tempo pulse'],
    productionTraits: ['warm intimate close-mic mix'],
    vocalTraits: ['smoky relaxed female lead'],
    suggestedGenreIds: ['jazz-pop', 'smooth-jazz-lounge'],
    excludeAdditions: ['famous artist imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'adele|아델|アデル',
    eraTag: '2010s soulful piano pop ballad',
    instrumentation: ['piano-led arrangement', 'building string section', 'restrained rhythm section'],
    harmonyTraits: ['emotional minor-to-major ballad build'],
    rhythmTraits: ['slow building ballad pulse'],
    productionTraits: ['warm modern ballad production with dynamic build'],
    vocalTraits: ['powerful soulful female lead with controlled belt'],
    suggestedGenreIds: ['piano-ballad', 'healing-ballad'],
    excludeAdditions: ['famous artist imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'ed sheeran|에드 시런|エド・シーラン',
    eraTag: '2010s acoustic-pop singer-songwriter',
    instrumentation: ['looped acoustic guitar', 'light programmed percussion', 'warm bass'],
    harmonyTraits: ['simple diatonic pop-folk chords'],
    rhythmTraits: ['gentle mid-tempo acoustic pulse'],
    productionTraits: ['warm modern acoustic-pop mix'],
    vocalTraits: ['conversational intimate male lead'],
    suggestedGenreIds: ['acoustic-pop', 'folk-pop'],
    excludeAdditions: ['famous artist imitation', 'soundalike vocals']
  },
  // TASK v3.61 (TASK C) — 3 explicitly-requested additions for the
  // senior/oldpop channel: a piano-ballad singer-songwriter, a jazz-standard
  // crooner, and an orchestral-easy-listening vocalist, each routed to the
  // new oldpop-* genres that now actually fit them.
  {
    aliasPattern: 'billy joel|빌리 조엘|ビリー・ジョエル',
    eraTag: 'mid-1970s piano-driven singer-songwriter pop',
    instrumentation: ['grand piano lead', 'restrained rock rhythm section', 'occasional string counterline'],
    harmonyTraits: ['storytelling major-key piano chord movement'],
    rhythmTraits: ['mid-tempo piano-pop pulse'],
    productionTraits: ['warm 1970s piano-forward studio mix'],
    vocalTraits: ['conversational expressive male lead'],
    suggestedGenreIds: ['oldpop-piano-ballad-70s', 'oldpop-standards-torch'],
    excludeAdditions: ['famous artist imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'nat king cole|냇 킹 콜|냇킹콜|ナット・キング・コール',
    eraTag: 'mid-20th-century vocal jazz standards',
    instrumentation: ['piano trio', 'muted trumpet', 'brushed drums', 'double bass'],
    harmonyTraits: ['jazz-standard extended chord changes'],
    rhythmTraits: ['relaxed jazz-standard swing'],
    productionTraits: ['dim intimate lounge room tone'],
    vocalTraits: ['warm smooth male crooner lead'],
    suggestedGenreIds: ['oldpop-standards-torch'],
    excludeAdditions: ['famous crooner imitation', 'soundalike vocals']
  },
  {
    aliasPattern: 'patti page|패티 페이지|パティ・ペイジ',
    eraTag: '1950s orchestral easy-listening pop',
    instrumentation: ['string section', 'soft vibraphone', 'light rhythm section'],
    harmonyTraits: ['lush orchestral resolution'],
    rhythmTraits: ['slow rubato easing into a gentle 4/4'],
    productionTraits: ['polished middle-of-the-road easy-listening mix'],
    vocalTraits: ['warm orchestral-backed female lead'],
    suggestedGenreIds: ['oldpop-orchestral-easy'],
    excludeAdditions: ['famous vocalist imitation', 'soundalike vocals']
  }
];
