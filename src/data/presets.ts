import type { ChannelProfile, GenerationPack, GenrePack, MoodPack, SeasonPack } from '../types';
import { CORE_LYRIC_FLAVOR_IMAGES, LEAD_ARRANGEMENT_NARRATIVES, eraGenrePacks, kr2030GenrePacks, modernGenrePacks, notionDerivedGenrePacks, oldpopGenrePacks, withGenreVisibility } from './genreLibrary';

export const channelPresets: ChannelProfile[] = [
  {
    id: 'good-morning-memory-radio',
    name: '굿모닝 추억라디오',
    englishName: 'Good Morning Memory Radio',
    market: 'korea',
    primaryLanguage: 'english',
    audience: 'seniors',
    promise: '50~60대를 위한 아침 커피, 계절감, 편안한 회상 중심의 성인 팝 플레이리스트',
    visualIdentity: 'warm morning cafe, radio, coffee steam, refined serif typography, autumn and winter objects',
    defaultVocal: 'mature soulful male tenor, soft slightly husky close-mic delivery, gentle and sincere',
    // TASK v3.61 (TASK B) — this pool was only 3 ids (adult-contemporary,
    // acoustic-pop, jazz-pop), which cannot satisfy the "same genre max 5
    // songs" diversity rule across an 18-song pack and forced every real
    // pack toward the same 3-4 genres regardless of what the user asked
    // for. Expanded to 15: the original 3, the 5 senior-core genres already
    // registered in SENIOR_MORNING_CORE_GENRE_IDS but never actually routed
    // here (chanson, bossa-cafe, smooth-jazz-lounge, retro-soul-pop,
    // folk-pop), and 7 of the new oldpop-* family spanning every era
    // (1-A through 1-D) rather than clustering in one decade. Deliberately
    // NOT all 28 oldpop-* ids — see this task's own "preferredGenres를
    // 20종 이상으로 늘리지 말 것" constraint; this is the candidate POOL a
    // given pack draws a subset from, not every pack's actual genre list.
    preferredGenres: [
      'adult-contemporary', 'acoustic-pop', 'jazz-pop',
      'chanson', 'bossa-cafe', 'smooth-jazz-lounge', 'retro-soul-pop', 'folk-pop',
      'oldpop-warm-morning-glow', 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul',
      'oldpop-piano-ballad-70s', 'oldpop-adult-contemporary-80s', 'oldpop-close-harmony-duo',
      'oldpop-hearth-acoustic'
    ],
    preferredMoods: ['nostalgic', 'warm', 'hopeful'],
    forbiddenCliches: ['too old-fashioned trot mood', 'childish lyrics', 'dramatic power ballad shouting', 'famous artist imitation'],
    seoKeywords: ['아침 음악', '커피 음악', '추억 팝송', '50대 음악', '60대 음악', '감성 팝', '계절 플레이리스트'],
    archetype: 'senior-morning'
  },
  {
    id: 'morning-showa-cafe',
    name: '朝の昭和喫茶',
    englishName: 'Morning Showa Café',
    market: 'japan',
    primaryLanguage: 'english',
    audience: 'seniors',
    promise: '쇼와 모던 감성과 키사텐 분위기를 현대적으로 정리한 일본 시니어 플레이리스트',
    visualIdentity: 'showa-modern kissaten, muted gold, deep green, coffee, record player, refined retro typography',
    defaultVocal: 'mature soft male tenor, restrained emotional tone, warm close-mic delivery',
    preferredGenres: ['showa-modern', 'jazz-pop', 'city-pop-soft'],
    preferredMoods: ['nostalgic', 'elegant', 'bittersweet'],
    forbiddenCliches: ['cheap retro props', 'enka-like melodrama', 'overly cute anime tone', 'famous artist imitation'],
    seoKeywords: ['昭和カフェ', '朝の喫茶店', 'レトロBGM', '大人の音楽', '50代', '60代', '喫茶店BGM'],
    archetype: 'showa-cafe'
  },
  {
    id: 'showa-seventies',
    name: '昭和セブンティーズ',
    englishName: 'Showa Seventies',
    market: 'japan',
    primaryLanguage: 'japanese',
    audience: 'seniors',
    promise: '1970年代の日本歌謡、フォーク、ニューミュージック感性を軸にした日本語プレイリスト',
    visualIdentity: '1970s Showa film grain, warm color temperature, kissaten paper textures, station lights, restrained Japanese retro typography',
    defaultVocal: 'mature Japanese male tenor, intimate close-mic delivery, restrained vibrato, warm analog presence',
    preferredGenres: ['kayokyoku-70s', 'japanese-folk-70s', 'new-music-70s'],
    preferredMoods: ['nostalgic', 'elegant', 'bittersweet'],
    forbiddenCliches: [
      'modern EDM synths',
      'trap hi-hats',
      'hard autotune',
      'sidechain pumping',
      'ultra-wide modern mix',
      'famous artist imitation',
      'enka-like melodrama'
    ],
    seoKeywords: ['昭和歌謡', '70年代 日本の歌', '昭和 フォーク', 'ニューミュージック', '懐かしい日本語曲', '昭和プレイリスト'],
    archetype: 'showa-70s'
  },
  {
    id: 'millennium-jpop',
    name: 'ミレニアムJ-POP',
    englishName: 'Millennium J-POP',
    market: 'japan',
    primaryLanguage: 'japanese',
    audience: 'general',
    promise: '2000年代初頭のJ-POPとR&B影響期の明るいデジタル感を軸にした日本語プレイリスト',
    visualIdentity: 'early-2000s Japanese digital brightness, saturated clean color, station gates, flip-phone mail, CD-shop gloss',
    defaultVocal: 'clear Japanese pop vocal, polished emotional delivery, layered chorus harmonies, early-2000s digital presence',
    preferredGenres: ['jpop-2000s-ballad', 'jpop-2000s-rnb', 'jpop-2000s-band'],
    preferredMoods: ['hopeful', 'romantic', 'fresh-start'],
    forbiddenCliches: [
      'lo-fi vintage texture',
      'trap elements',
      'modern bedroom-pop texture',
      'smartphone-era slang',
      'famous artist imitation'
    ],
    seoKeywords: ['2000年代 J-POP', '平成 JPOP', 'ミレニアム J-POP', '懐かしい平成曲', '日本語ポップ', '青春プレイリスト'],
    archetype: 'j2000s'
  },
  {
    id: 'chill-hours',
    name: 'Chill Hours',
    englishName: 'Chill Hours',
    market: 'global',
    primaryLanguage: 'english',
    audience: 'twenties',
    promise: 'Modern late-night playlists built around alternative R&B, chill rap, lo-fi hip-hop, and soft neo-soul textures',
    visualIdentity: 'rainy window, muted neon, headphones, laptop glow, restrained modern typography, no artist likeness',
    defaultVocal: 'soft female voice just above a whisper, airy breath tone, slow intimate delivery',
    preferredGenres: ['alt-rnb', 'chill-rap', 'lofi-hiphop-study'],
    preferredMoods: ['rainy-comfort', 'calm-focus', 'warm'],
    forbiddenCliches: [
      'bright EDM supersaw',
      'festival drop',
      'aggressive battle-rap delivery',
      'hard autotune lead',
      'famous artist imitation'
    ],
    seoKeywords: ['chill R&B playlist', 'chill rap', 'lofi hip hop', 'late night playlist', 'rainy night music', 'study rap'],
    archetype: 'modern-chill'
  },
  {
    id: 'city-night-drive',
    name: 'City Night Drive',
    englishName: 'City Night Drive',
    market: 'korea',
    primaryLanguage: 'english',
    audience: 'thirtiesForties',
    promise: 'Korean and English night-drive playlists with modern city-pop, future funk, disco pop, and polished urban groove',
    visualIdentity: 'night drive dashboard, wet asphalt neon, saturated city reflections, clean modern title layout, no brand logos',
    defaultVocal: 'bright young female voice, clean modern pop delivery, fresh and open tone',
    preferredGenres: ['city-pop-modern', 'future-funk', 'disco-pop-2020s'],
    preferredMoods: ['fresh-start', 'romantic', 'rainy-comfort'],
    forbiddenCliches: [
      'cheap retro parody',
      'muddy lofi haze',
      'hard trap drums',
      'famous artist imitation',
      'soundalike vocal'
    ],
    seoKeywords: ['city pop playlist', 'night drive music', 'future funk', 'disco pop', 'Korean city pop', 'drive playlist'],
    archetype: 'city-night'
  },
  // TASK v3.38 Part B1 — kids/children's song channel.
  // TASK v3.39 Part G — primaryLanguage defaults to 'english' like the two
  // adult channels above (was 'korean'): the kids lyric engine already has
  // full korean/japanese/english pools (kidsLyricEngine.ts), so there was no
  // functional reason to default away from the channel's own market-neutral
  // baseline. Korean/Japanese stay one select away — see Step1Channel.tsx's
  // language select and applyArchetype's no-clobber fix.
  {
    id: 'little-singalong-radio',
    name: '꼬마 노래방송',
    englishName: 'Little Singalong Radio',
    market: 'korea',
    primaryLanguage: 'english',
    audience: 'kids',
    promise: '유아~초등 저학년과 보호자가 함께 듣는 밝고 안전한 창작 동요 플레이리스트',
    visualIdentity: 'bright playground colors, simple shapes, cheerful daylight, no characters or mascots',
    // TASK v3.39 — matches core/vocalPlan.ts's VOCAL_DESCRIPTIONS rewrite:
    // childlike/youthful tone throughout, no adult-coded wording.
    defaultVocal: "bright cheerful children's choir singalong, youthful childlike voices, call-and-response group singing",
    // TASK v3.38 Part B0 (correction) — kids songs are pop-style, not
    // traditional-nursery-rhyme-style; the 3 primary genres are all pop
    // variants, and kids-march (traditional/marching-song flavor) is kept
    // only as a secondary/auxiliary pack — see rawGenrePacks below.
    preferredGenres: ['kids-bright-pop', 'kids-acoustic-singalong', 'kids-upbeat-pop'],
    preferredMoods: ['bright-playful', 'warm', 'fresh-start'],
    forbiddenCliches: [
      'scary or frightening themes',
      'excessive sadness or crying',
      'difficult Sino-Korean vocabulary',
      'trendy slang or internet memes',
      'violence or death themes',
      'adult romantic heartbreak themes',
      'reusing an existing nursery rhyme melody or lyrics'
    ],
    seoKeywords: ['동요', '어린이 노래', '창작동요', '유아 음악', '어린이 플레이리스트', '신나는 동요'],
    archetype: 'kids'
  }
];

/** v3.4 — saved channels from before archetypes existed have no `archetype` field; they fall back to 'senior-morning' rather than an unscoped/empty hook bank. */
export function migrateArchetype(channel: ChannelProfile): ChannelProfile {
  return channel.archetype ? channel : { ...channel, archetype: 'senior-morning' };
}

export const generationPacks: GenerationPack[] = [
  {
    id: 'kids',
    label: 'Kids / Family',
    audienceNote: 'bright, safe, family-friendly, easy words',
    lyricGuidance: ['short phrases', 'clear images', 'no romance-heavy lines', 'positive resolution'],
    tempoBias: 'medium tempo, clean rhythm, playful but not childish if the channel is adult-facing',
    youtubeAngle: 'family-safe background music and gentle seasonal songs'
  },
  {
    id: 'teens',
    label: 'Teens',
    audienceNote: 'direct emotion, school-day scenes, hopeful social language',
    lyricGuidance: ['simple hook', 'clear point of view', 'avoid heavy nostalgia', 'modern but timeless slang-free wording'],
    tempoBias: 'medium to upbeat tempo with a memorable chorus',
    youtubeAngle: 'study, commute, diary, and first-love playlist angles'
  },
  {
    id: 'twenties',
    label: '20s',
    audienceNote: 'city life, workday reset, new relationships, late-night reflection',
    lyricGuidance: ['conversational verses', 'modern emotional detail', 'compact hook', 'playlist-friendly English works well'],
    tempoBias: 'medium groove, lofi or city-pop accents allowed',
    youtubeAngle: 'cafe, work, night drive, study, and chill playlist angles'
  },
  {
    id: 'thirtiesForties',
    label: '30s-40s',
    audienceNote: 'work, family, memory, understated romance, mature pop tone',
    lyricGuidance: ['balanced nostalgia', 'adult everyday images', 'not overly dramatic', 'clear chorus lift'],
    tempoBias: 'medium tempo with polished adult contemporary structure',
    youtubeAngle: 'workday comfort, home cafe, evening drive, and seasonal healing angles'
  },
  {
    id: 'seniors',
    label: '50s-60s',
    audienceNote: 'warm memory, radio mood, gentle vocal, readable emotional arc',
    lyricGuidance: ['plain but elegant words', 'nostalgia without sadness overload', 'avoid childish wording', 'strong singable hook'],
    tempoBias: 'steady medium tempo, no aggressive drums, clear vocal front',
    youtubeAngle: 'morning coffee, old radio, seasonal memory, and comfortable listening angles'
  },
  {
    id: 'allAges',
    label: 'All Ages',
    audienceNote: 'universal scene, safe wording, broad playlist usability',
    lyricGuidance: ['broad emotional images', 'no niche slang', 'clear hook', 'gentle positive finish'],
    tempoBias: 'playlist-safe medium tempo with clean arrangement',
    youtubeAngle: 'seasonal background music, cafe, walk, and daily comfort angles'
  },
  {
    id: 'general',
    label: 'General',
    audienceNote: 'broad Japanese pop audience, emotionally direct but not age-locked',
    lyricGuidance: ['concrete everyday scenes', 'clean conversational wording', 'strong chorus image', 'no famous-artist imitation'],
    tempoBias: 'polished medium tempo or clean upbeat pop depending on genre',
    youtubeAngle: 'nostalgic J-pop, commute, school-days, night-call, and seasonal playlist angles'
  }
];

const rawGenrePacks: GenrePack[] = [
  {
    id: 'adult-contemporary',
    label: 'Adult Contemporary Pop',
    styleCore: 'warm adult contemporary pop, radio-friendly, gentle emotional chorus lift',
    arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['adult-contemporary'],
    instruments: ['sustained piano pads', 'clean strummed acoustic guitar', 'straight-pop drum kit', 'rounded electric bass'],
    tempoRange: [96, 106],
    goodFor: ['senior playlist', 'morning coffee', 'year-end']
  },
  {
    id: 'acoustic-pop',
    label: 'Acoustic Pop',
    styleCore: 'nostalgic acoustic pop, clear vocal, intimate warm arrangement',
    arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['acoustic-pop'],
    instruments: ['fingerpicked acoustic guitar', 'soft piano', 'light percussion'],
    tempoRange: [92, 104],
    goodFor: ['home listening', 'walks', 'coffee']
  },
  {
    id: 'jazz-pop',
    label: 'Acoustic Jazz Pop',
    styleCore: 'nostalgic acoustic jazz-pop, elegant cafe mood, gentle maj7 and add9 colors',
    arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['jazz-pop'],
    instruments: ['Rhodes comping piano', 'walking upright bass', 'brushed snare with ride comping', 'mellow jazz guitar'],
    tempoRange: [82, 96],
    goodFor: ['kissaten', 'night cafe', 'winter']
  },
  {
    id: 'showa-modern',
    label: 'Showa Modern Cafe',
    styleCore: 'showa-modern cafe mood, nostalgic but refined, subtle retro Japanese kissaten warmth',
    arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['showa-modern'],
    instruments: ['Rhodes', 'mellow jazz guitar', 'upright bass', 'soft strings'],
    tempoRange: [92, 104],
    goodFor: ['Japan channel', 'retro cafe', 'autumn']
  },
  {
    id: 'city-pop-soft',
    label: 'Soft City Pop',
    styleCore: 'soft city-pop inspired adult pop, smooth groove, clean late-night city mood',
    arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['city-pop-soft'],
    instruments: ['electric piano', 'clean guitar', 'soft synth pad', 'smooth bass'],
    tempoRange: [98, 114],
    goodFor: ['Japan', 'night city', 'stylish senior']
  },
  {
    id: 'lofi-cafe',
    label: 'Lo-fi Cafe Pop',
    styleCore: 'warm lo-fi cafe pop, relaxed groove, soft vinyl texture',
    instruments: ['lo-fi drums', 'electric piano', 'warm bass', 'soft guitar'],
    tempoRange: [82, 96],
    goodFor: ['study', 'coffee', 'background']
  },
  {
    id: 'christmas-soft-pop',
    label: 'Soft Christmas Pop',
    styleCore: 'nostalgic Christmas acoustic pop, warm and not childish, subtle bells only in chorus',
    instruments: ['Rhodes', 'acoustic guitar', 'light sleigh bells', 'soft bass'],
    tempoRange: [96, 106],
    goodFor: ['Christmas', 'winter morning', 'year-end']
  },
  {
    id: 'healing-ballad',
    label: 'Healing Ballad',
    styleCore: 'warm healing ballad, restrained emotion, hopeful ending',
    instruments: ['piano', 'acoustic guitar', 'soft strings', 'brushes'],
    tempoRange: [84, 98],
    goodFor: ['comfort', 'senior', 'night']
  },
  {
    id: 'folk-pop',
    label: 'Folk Pop',
    styleCore: 'clean folk-pop storytelling, acoustic warmth, natural sing-along chorus',
    instruments: ['strummed acoustic guitar', 'light mandolin texture', 'soft piano', 'upright bass'],
    tempoRange: [92, 108],
    goodFor: ['family', 'walking', 'spring']
  },
  {
    id: 'bossa-cafe',
    label: 'Bossa Cafe Pop',
    styleCore: 'soft bossa cafe pop, relaxed syncopation, elegant warm vocal',
    instruments: ['nylon guitar', 'Rhodes', 'brush kit', 'upright bass', 'light shaker'],
    tempoRange: [88, 102],
    goodFor: ['summer cafe', 'morning', 'Japan and Korea']
  },
  // TASK v3.56 Part 3 — chanson/smooth-jazz-lounge added for the senior/cafe
  // channels (see genreLibrary/index.ts's SENIOR_MORNING_CORE_GENRE_IDS and
  // SHOWA_CAFE_CORE_GENRE_IDS). Full/short/minimal genre-signature text lives
  // in this file's own signatureOverrides/shortSignatureOverrides/
  // minimalSignatureOverrides dicts below, mirroring bossa-cafe/jazz-pop.
  {
    id: 'chanson',
    label: 'Chanson Cafe',
    styleCore: 'French chanson cafe pop, musette accordion tremolo, intimate close-mic vocal, minor-key melancholy',
    instruments: ['musette accordion', 'nylon guitar', 'upright bass', 'brushed drums'],
    tempoRange: [84, 100],
    goodFor: ['Parisian cafe', 'evening listening', 'Europe-inspired senior playlist']
  },
  {
    id: 'smooth-jazz-lounge',
    label: 'Smooth Jazz Lounge',
    styleCore: 'smooth jazz lounge, cocktail-lounge shuffle swing, vibraphone comping, saxophone bridge solo',
    instruments: ['vibraphone', 'walking upright bass', 'brushed ride cymbal', 'mellow saxophone'],
    tempoRange: [86, 104],
    goodFor: ['evening lounge', 'dinner cafe', 'refined senior playlist']
  },
  {
    id: 'soft-rock',
    label: 'Soft Rock Radio',
    styleCore: 'polished soft rock radio arrangement, warm guitars, restrained chorus lift',
    instruments: ['clean electric guitar', 'acoustic guitar', 'piano', 'steady soft drums'],
    tempoRange: [96, 112],
    goodFor: ['drive', 'memory', 'all ages']
  },
  {
    id: 'piano-ballad',
    label: 'Piano Pop Ballad',
    styleCore: 'piano-led pop ballad, intimate verse, gentle cinematic chorus',
    instruments: ['felt piano', 'soft strings', 'subtle cymbal swells', 'warm bass'],
    tempoRange: [78, 92],
    goodFor: ['night', 'comfort', 'winter']
  },
  {
    id: 'retro-soul-pop',
    label: 'Retro Soul Pop',
    styleCore: 'soft retro soul pop, warm groove, hand-played feel, tasteful backing vocals',
    instruments: ['Wurlitzer', 'muted guitar', 'smooth bass', 'light soul drums'],
    tempoRange: [88, 104],
    goodFor: ['radio', 'coffee', 'hopeful mood']
  },
  {
    id: 'synthwave-mellow',
    label: 'Mellow Synthwave Pop',
    styleCore: 'mellow synthwave pop, nostalgic neon pads, clean modern mix, not aggressive',
    instruments: ['soft analog synth pad', 'electric piano', 'clean guitar', 'warm electronic drums'],
    tempoRange: [92, 108],
    goodFor: ['night drive', 'retro channel', 'twenties']
  },
  // TASK v3.38 Part B1/B0 — kids-channel genres, explicitly tagged
  // archetypes: ['kids'] so withGenreVisibility (below) uses this directly
  // instead of its heuristic inferArchetypes() classifier. B0 (correction):
  // kids songs are pop-style, not traditional-nursery-rhyme-style — the 3
  // pop packs below are primary (see KIDS_CORE_GENRE_IDS in
  // genreLibrary/index.ts); kids-march stays available as a secondary/
  // auxiliary pack only, not one of the 3 auto-applied core genres.
  {
    id: 'kids-bright-pop',
    label: 'Bright Kids Pop',
    styleCore: 'bright cheerful children\'s pop, simple catchy melody, clean upbeat production',
    arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['kids-bright-pop'],
    instruments: ['ukulele', 'glockenspiel', 'clean acoustic guitar', 'light hand percussion'],
    tempoRange: [104, 120],
    goodFor: ['kids playlist', 'daytime play', 'singalong'],
    archetypes: ['kids']
  },
  {
    id: 'kids-acoustic-singalong',
    label: 'Kids Acoustic Singalong Pop',
    styleCore: 'warm acoustic singalong pop for children, gentle strum, easy call-and-response chorus',
    instruments: ['acoustic guitar', 'soft hand claps', 'light shaker', 'warm ukulele'],
    tempoRange: [92, 108],
    goodFor: ['kids playlist', 'calm play', 'family singalong'],
    archetypes: ['kids']
  },
  {
    id: 'kids-upbeat-pop',
    label: 'Upbeat Kids Pop',
    styleCore: 'high-energy upbeat children\'s pop, driving clean beat, bright synth-pop hooks, dance-along energy',
    instruments: ['clean synth lead', 'punchy clean bass', 'bright pop drums', 'glockenspiel'],
    tempoRange: [112, 128],
    goodFor: ['kids playlist', 'dance-along', 'high-energy play'],
    archetypes: ['kids']
  },
  // Secondary/auxiliary only — not one of the 3 primary kids genres (B0 correction).
  {
    id: 'kids-march',
    label: 'Kids Marching Pop',
    styleCore: 'simple marching pop for children, bouncy skip-along rhythm, bright brass-toy color',
    instruments: ['toy piano', 'snare-like light percussion', 'glockenspiel', 'clean bass'],
    tempoRange: [108, 126],
    goodFor: ['kids playlist', 'movement and dance', 'group activity'],
    archetypes: ['kids']
  },
  ...oldpopGenrePacks,
  // TASK B1 — kr-2030 workspace's 6 genres (see genreLibrary/index.ts's own
  // kr2030GenrePacks doc comment). Spread here the same way oldpopGenrePacks
  // is, above — this array (not genreLibrary/index.ts's own genrePacks
  // export) is what generateLocalBlueprint actually receives genres from
  // (see this file's own comment on the genrePacks export just below).
  ...kr2030GenrePacks,
  ...modernGenrePacks,
  ...eraGenrePacks,
  ...notionDerivedGenrePacks
];

// TASK H2 (v3.13) — rawGenrePacks above duplicates genreLibrary/index.ts's
// legacyGenreProfiles as plain objects rather than importing them (a
// pre-existing split, not something this fix restructures), so
// CORE_LYRIC_FLAVOR_IMAGES has to be re-applied here too — this is the array
// generateLocalBlueprint actually receives genres from, not genreLibrary's
// own genrePacks export.
export const genrePacks: GenrePack[] = rawGenrePacks.map(genre => {
  const withVisibility = withGenreVisibility(genre);
  const flavorImages = CORE_LYRIC_FLAVOR_IMAGES[withVisibility.id];
  const signatureOverrides: Record<string, string> = {
    'adult-contemporary': 'straight 4/4 pop feel, sustained piano pads, clean strummed acoustic, simple diatonic harmony, no swing, no solo',
    'acoustic-pop': 'fingerpicked acoustic guitar, soft piano answers, light hand percussion, natural close room, simple singalong harmony',
    'jazz-pop': 'light swing feel, walking upright bass, ii-V-I turnarounds, maj7/9/13 extended voicings, brushed snare with ride cymbal comping, short improvised piano or saxophone solo in the bridge, warm analog room tone',
    'bossa-cafe': 'bossa nova clave, nylon-string guitar comping on offbeats, soft surdo-less percussion, gentle syncopation, whispered syncopated vocal phrasing, Portuguese-jazz harmony',
    'chanson': 'waltz or slow 4/4 cafe pulse, musette tremolo accordion, nylon-string guitar, upright bass, intimate close-mic vocal, minor-key melancholy, Parisian cafe room tone',
    'smooth-jazz-lounge': 'cocktail-lounge shuffle swing, walking upright bass, ii-V-I turnarounds, vibraphone comping, saxophone solo across the bridge, brushed ride cymbal, dim analog lounge room tone',
    'retro-soul-pop': 'sixteenth-note hi-hat groove, tight horn section stabs, electric bass with ghost notes, gospel-tinged backing vocals, tape saturation',
    'city-pop-soft': 'slap/round electric bass, electric piano and clean chorus guitar, syncopated 16th groove, bright polished chorus, gated reverb touches',
    'showa-modern': 'restrained kissaten swing, Rhodes comping, walking upright bass, muted jazz guitar fills, IVmaj7-iii7 color, tape-warm close-room mix',
    'lofi-cafe': 'lazy behind-the-beat lo-fi pocket, dusty electric piano, soft muted drums, rounded bass loop, restrained vinyl room texture',
    'christmas-soft-pop': 'straight seasonal pop pulse, acoustic guitar and Rhodes pads, restrained sleigh bells only in chorus, warm choral lift, clean radio mix',
    'healing-ballad': 'slow 4/4 pulse, felt piano arpeggios, suspended add9 harmony, soft string swells, intimate dry verse, no rhythmic drive',
    'folk-pop': 'steady strummed folk pulse, fingerpicked acoustic answers, light mandolin texture, plainspoken harmony, natural room recording',
    'soft-rock': 'straight eighth-note rock pulse, clean electric guitar layers, live snare backbeat, rounded bass, wide radio guitars, restrained solo',
    'piano-ballad': 'slow rubato-to-4/4 piano pulse, suspended piano voicings, soft string counterlines, minimal drums, cinematic room bloom',
    'synthwave-mellow': 'steady electronic four-on-the-floor pulse, analog pad arpeggios, chorus guitar, gated drum ambience, neon stereo width',
    'kids-march': 'bouncy marching two-step, toy piano, light snare cadence, glockenspiel answers, clean group-chant production'
  };
  const signatureSound = signatureOverrides[withVisibility.id] || withVisibility.signatureSound || (
    withVisibility.id === 'showa-modern'
      ? 'gentle IVmaj7-iii7 color, Rhodes, mellow jazz guitar, tape-warm production'
    : `${withVisibility.instruments.slice(0, 3).join(', ')}, ${withVisibility.arrangementNarrative?.split(',')[0] || withVisibility.styleCore.split(',')[0]}`);
  // TASK v3.56 Part 1-2 — stage-2/3 abbreviated forms of signatureSound, used
  // by promptBudget.ts's composeStylePrompt only once dropping non-essential
  // atoms alone isn't enough to fit the hard character budget. Genres not
  // listed here (or without their own shortSignatureSound/minimalSignatureSound
  // set directly on the pack, e.g. the modernGenrePacks additions) fall back
  // to composeStylePrompt's own auto-slice of the full signatureSound.
  const shortSignatureOverrides: Record<string, string> = {
    'adult-contemporary': 'straight 4/4 pop feel, sustained piano pads, clean strummed acoustic',
    'jazz-pop': 'swing feel, walking upright bass, ii-V-I turnarounds',
    'bossa-cafe': 'bossa clave, offbeat nylon guitar comping, whispered syncopated vocal',
    'chanson': 'musette accordion, nylon guitar, intimate close-mic vocal',
    'smooth-jazz-lounge': 'lounge shuffle swing, vibraphone comping, saxophone bridge solo'
  };
  const minimalSignatureOverrides: Record<string, string> = {
    'adult-contemporary': 'straight 4/4 pop feel',
    'jazz-pop': 'swing feel, walking bass',
    'bossa-cafe': 'bossa clave, nylon guitar',
    'chanson': 'musette accordion, minor-key melancholy',
    'smooth-jazz-lounge': 'lounge swing, vibraphone'
  };
  const shortSignatureSound = shortSignatureOverrides[withVisibility.id] || withVisibility.shortSignatureSound;
  const minimalSignatureSound = minimalSignatureOverrides[withVisibility.id] || withVisibility.minimalSignatureSound;
  const enriched = {
    ...withVisibility,
    signatureSound,
    ...(shortSignatureSound ? { shortSignatureSound } : {}),
    ...(minimalSignatureSound ? { minimalSignatureSound } : {})
  };
  return flavorImages ? { ...enriched, lyricFlavorImages: flavorImages } : enriched;
});

export const moodPacks: MoodPack[] = [
  { id: 'nostalgic', label: 'Nostalgic', emotionWords: ['nostalgic', 'familiar', 'old-radio warmth'], lyricImages: ['old radio', 'faded photograph', 'coffee steam', 'quiet street'] },
  { id: 'warm', label: 'Warm', emotionWords: ['warm', 'comforting', 'gentle'], lyricImages: ['morning light', 'wool sweater', 'candle', 'small kitchen'] },
  { id: 'bittersweet', label: 'Bittersweet', emotionWords: ['bittersweet', 'lonely but hopeful', 'restrained'], lyricImages: ['empty chair', 'late train', 'rain on glass', 'old letter'] },
  { id: 'hopeful', label: 'Hopeful', emotionWords: ['hopeful', 'quietly uplifting', 'renewed'], lyricImages: ['sunrise', 'first light', 'open road', 'clear sky'] },
  { id: 'romantic', label: 'Romantic', emotionWords: ['romantic', 'tender', 'soft longing'], lyricImages: ['corner cafe', 'passing footsteps', 'shared umbrella', 'distant song'] },
  { id: 'christmas', label: 'Christmas Warmth', emotionWords: ['peaceful Christmas', 'year-end warmth', 'soft bells'], lyricImages: ['ribbons', 'cards', 'tree lights', 'snow'] },
  { id: 'calm-focus', label: 'Calm Focus', emotionWords: ['calm', 'steady', 'light concentration'], lyricImages: ['open notebook', 'quiet desk', 'window light', 'slow clock'] },
  { id: 'fresh-start', label: 'Fresh Start', emotionWords: ['fresh', 'clean', 'new beginning'], lyricImages: ['washed sky', 'new shoes', 'morning train', 'open calendar'] },
  { id: 'rainy-comfort', label: 'Rainy Comfort', emotionWords: ['rainy', 'safe inside', 'softly reflective'], lyricImages: ['rain on glass', 'umbrella stand', 'warm lamp', 'wet street'] },
  { id: 'elegant', label: 'Elegant', emotionWords: ['elegant', 'reserved', 'polished'], lyricImages: ['porcelain cup', 'old record', 'tailored coat', 'quiet lobby'] },
  // TASK v3.38 Part B1 — kids-channel mood.
  { id: 'bright-playful', label: 'Bright & Playful', emotionWords: ['bright', 'playful', 'curious', 'cheerful'], lyricImages: ['sunny playground', 'bouncing ball', 'giggling laughter', 'colorful balloons'] }
];

export const seasonPacks: SeasonPack[] = [
  { id: 'new-year', label: 'New Year Reset', period: 'January', keywords: ['new year', 'first morning', 'fresh calendar'], visualDirection: 'clean white desk, warm sunlight, simple calendar, no party clutter' },
  { id: 'late-winter', label: 'Late Winter', period: 'February', keywords: ['late winter', 'quiet room', 'warm tea'], visualDirection: 'soft gray-blue light, warm indoor lamp, winter window' },
  { id: 'spring-open', label: 'Spring Opening', period: 'March', keywords: ['spring', 'new road', 'soft wind'], visualDirection: 'fresh green accent, open window, light jacket, clean typography' },
  { id: 'cherry-blossom', label: 'Cherry Blossom Walk', period: 'March-April', keywords: ['cherry blossom', 'walk', 'soft pink light'], visualDirection: 'pale blossom street, coffee cup, gentle morning, not overly cute' },
  { id: 'may-cafe', label: 'May Cafe', period: 'May', keywords: ['May', 'cafe terrace', 'clear sky'], visualDirection: 'terrace cafe, bright green, clean table setting' },
  { id: 'rainy-season', label: 'Rainy Season', period: 'June', keywords: ['rain', 'window', 'umbrella', 'old song'], visualDirection: 'rainy cafe, warm window glow, no gloomy darkness' },
  { id: 'summer-night', label: 'Summer Night', period: 'July', keywords: ['summer night', 'city breeze', 'late cafe'], visualDirection: 'cool night street, soft neon, cafe window, readable title text' },
  { id: 'late-summer-open', label: 'Late Summer Opening', period: 'August launch', keywords: ['channel opening', 'morning coffee', 'first hello'], visualDirection: 'clean brand intro, coffee table, warm sunrise' },
  { id: 'early-autumn', label: 'Early Autumn', period: 'September', keywords: ['September', 'early autumn', 'coffee', 'wind'], visualDirection: 'light olive and ivory, early autumn leaves, cafe morning' },
  { id: 'autumn-rain', label: 'Autumn Rain', period: 'September rain', keywords: ['rain', 'window', 'cafe', 'old song'], visualDirection: 'rainy cafe, warm window glow, no gloomy darkness' },
  { id: 'maple-autumn', label: 'Maple Autumn', period: 'October', keywords: ['maple', 'golden leaves', 'walk', 'memory'], visualDirection: 'golden foliage, coffee, refined typography' },
  { id: 'late-autumn', label: 'Late Autumn Letter', period: 'late October', keywords: ['last autumn', 'November coming', 'letter'], visualDirection: 'deep green, brass accent, soft street lamps' },
  { id: 'early-winter', label: 'Early Winter Window', period: 'November', keywords: ['November', 'first cold', 'winter window'], visualDirection: 'deep blue, warm cafe lights, winter coat detail' },
  { id: 'first-snow', label: 'First Snow', period: 'late November', keywords: ['first snow', 'silver night', 'quiet city'], visualDirection: 'soft snow, blue-white, warm interior lights' },
  { id: 'christmas', label: 'Christmas Cafe', period: 'December', keywords: ['Christmas', 'bells', 'cards', 'coffee', 'radio'], visualDirection: 'champagne gold, warm ivory, subtle red, no childish Santa focus' },
  { id: 'year-end', label: 'Year-End Letter', period: 'late December', keywords: ['year-end', 'last letter', 'old year', 'new light'], visualDirection: 'quiet room, candlelight, winter morning' }
];
