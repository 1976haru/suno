import type { ChannelProfile, GenerationPack, GenrePack, MoodPack, SeasonPack } from '../types';
import { CORE_LYRIC_FLAVOR_IMAGES, LEAD_ARRANGEMENT_NARRATIVES, eraGenrePacks, jp2030GenrePacks, jpkidsGenrePacks, kr2030GenrePacks, kridolMaleGenrePacks, krkidsGenrePacks, modernGenrePacks, notionDerivedGenrePacks, oldpopGenrePacks, withGenreVisibility } from './genreLibrary';

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
    // TASK v4.9 (TASK B) — real listening feedback, twice: "재즈 2곡 들어있는데
    // 전부 남자라 별로" and "재즈는 남자든 여자든 둘 다 약해". Korean 7080 팝송
    // canon has no smooth-jazz-lounge sub-genre at all (crooner acts, not
    // lounge jazz) — jazz-pop/smooth-jazz-lounge/bossa-cafe dropped from this
    // channel's own pool (NOT deleted from genreLibrary — other workspaces
    // still use them). canon-crooner-standard (data/eraCanonPalettes.ts,
    // Tom Jones/Engelbert-type) stays reachable via chanson/oldpop-piano-ballad-70s,
    // which is the actual 7080-canon member of that palette's fitsGenreIds.
    //
    // 지시문 20 (TASK A-1/A-2) — 8개 1950s-60s/챔버팝 oldpop-* 장르(전부
    // 이미 archetypes:['senior-morning']로 태그돼 있었으나 이 preferredGenres
    // 배열에는 배선되지 않았던 것)와 재즈 4종을 추가한다. 재즈 재도입은
    // 지시문 20 원문이 "이전에 뺀 이유는 장르 혼입(팔레트 계열)" 이라고
    // 서술했지만, 바로 위 TASK v4.9 주석이 밝히는 실제 사유는 보컬 품질
    // 불만(남성 편중·둘 다 약함)이다 — 다른 문제이므로 팔레트 계열 규칙만으로
    // 해소된다고 볼 수 없다. jazz-pop/smooth-jazz-lounge는 그 불만의 직접
    // 대상이었으므로 계속 제외하고, 그 불만이 향했던 적 없는 4개 신규 후보
    // (jazz-classic-vocal-lounge/jazz-swing-crooner-ballroom/
    // jazz-brush-ballad-jazz/bossa-cafe)만 추가한다. 청취 검증 대기 — 실제
    // 세트를 뽑아 들어보고 같은 불만(보컬 약함/성별 편중)이 재현되면 되돌린다.
    preferredGenres: [
      'adult-contemporary', 'acoustic-pop',
      'chanson', 'retro-soul-pop', 'folk-pop',
      'oldpop-warm-morning-glow', 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul',
      'oldpop-piano-ballad-70s', 'oldpop-adult-contemporary-80s', 'oldpop-close-harmony-duo',
      'oldpop-hearth-acoustic',
      'oldpop-doowop-harmony', 'oldpop-british-beat', 'oldpop-girl-group-wall',
      'oldpop-sunshine-pop', 'oldpop-brill-building',
      'oldpop-baroque-pop', 'oldpop-sunlit-strings-pop', 'oldpop-orchestral-easy',
      'jazz-classic-vocal-lounge', 'jazz-swing-crooner-ballroom', 'jazz-brush-ballad-jazz', 'bossa-cafe'
    ],
    preferredMoods: ['nostalgic', 'warm', 'hopeful'],
    forbiddenCliches: ['too old-fashioned trot mood', 'childish lyrics', 'dramatic power ballad shouting', 'famous artist imitation'],
    seoKeywords: ['아침 음악', '커피 음악', '추억 팝송', '50대 음악', '60대 음악', '감성 팝', '계절 플레이리스트'],
    archetype: 'senior-morning'
  },
  {
    // 지시문 20 (TASK A-3) — oldpop-lounge 아키타입은 이미
    // core/audienceProfiles.ts의 AUDIENCE_PROFILE_ID_BY_ARCHETYPE(지시문 12
    // TASK C)와 workspaces/index.ts의 senior-oldpop.archetypeIds에 등록돼
    // 있었지만, 실제 프리셋 채널이 0개라 사용자가 커스텀 채널로 직접
    // 만들어 쓰며 검증 설정이 유실되는 문제가 있었다. `audience`/`market`을
    // 다른 시니어 채널과 동일하게 명시적으로 지정 — 지시문 12 TASK C가
    // 다룬 함정(이 두 필드에 검증 설정이 묶여 있음)을 신설 채널도 그대로
    // 밟지 않도록.
    id: 'oldpop-lounge-main',
    name: '올드팝 라운지',
    englishName: 'Old Pop Lounge',
    market: 'korea',
    primaryLanguage: 'english',
    audience: 'seniors',
    promise: '60~80년대 서구 올드팝을 팝·소울·R&B·샹송·재즈까지 폭넓게 조합하는 라운지 플레이리스트',
    visualIdentity: 'dim evening lounge, warm amber light, vinyl record, velvet upholstery, refined retro typography',
    defaultVocal: 'warm mature male crooner tenor, close-mic intimate delivery, relaxed and elegant',
    // 지시문 20 (TASK A-3) — jazz-brush-ballad-jazz는 genreLibrary의
    // archetypes가 ['senior-morning', 'showa-cafe']뿐이라 (jazz-classic-
    // vocal-lounge/jazz-swing-crooner-ballroom과 달리 oldpop-lounge가
    // 없음) sanitizeGenreIdsForArchetype이 여기서는 걸러낸다 — 실측으로
    // 확인(tests/genreArchetypeSanitization.test.ts). senior-morning
    // 쪽에는 이미 포함돼 있으므로 이 채널에는 넣지 않는다.
    preferredGenres: [
      'adult-contemporary', 'chanson', 'bossa-cafe', 'smooth-jazz-lounge',
      'jazz-classic-vocal-lounge', 'jazz-swing-crooner-ballroom',
      'jazz-hotel-lounge-jazz', 'jazz-torch-vocal-jazz', 'jazz-soft-vocal-trio',
      'oldpop-standards-torch', 'oldpop-doowop-harmony', 'oldpop-piano-ballad-70s',
      'oldpop-quiet-storm-warm', 'oldpop-evening-lamp-ballad', 'oldpop-slow-waltz-memory',
      'retro-soul-pop', 'rnb-old-school-romance-rnb'
    ],
    preferredMoods: ['nostalgic', 'warm', 'hopeful'],
    forbiddenCliches: ['too old-fashioned trot mood', 'childish lyrics', 'dramatic power ballad shouting', 'famous artist imitation'],
    seoKeywords: ['올드팝 라운지', '저녁 음악', '재즈 팝송', '샹송 플레이리스트', '50대 음악', '60대 음악', '라운지 음악'],
    archetype: 'oldpop-lounge'
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
    // P2 fix (정합성 점검 §1) — showa-groove-70s (data/genreLibrary/index.ts)
    // was already tagged archetypes:['showa-70s'] but never added here, so
    // this channel's real candidate pool was only 3 genres — narrow enough
    // that an empty/unspecified concept's own genre-selection picked just 1,
    // forcing 18 consecutive same-genre songs (design gate's own
    // genre-consecutive/palette-variety both failed unconditionally). Adding
    // the genre this channel was already eligible for, not inventing a new one.
    preferredGenres: ['kayokyoku-70s', 'japanese-folk-70s', 'new-music-70s', 'showa-groove-70s'],
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
    // TASK D2 §6-3 (user decision) — "choir" wording dropped in favor of a
    // boy-and-girl mixed duet, matching VOCAL_DESCRIPTIONS.mixed's own update.
    defaultVocal: 'bright cheerful boy and girl duet singalong, youthful childlike voices, call-and-response singing',
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
  },
  // TASK B2 (§8-1) — kr-2030 workspace's 3 channel presets. Each sets
  // archetype: 'kr-2030-pop' explicitly — omitting it would route the
  // channel to senior-morning via presets.ts's own migrateArchetype (this
  // task's own §0-3 ④, a real measured leak path).
  {
    id: 'after-work-band-pop',
    name: '퇴근 후 감성 밴드팝',
    englishName: 'After-Work Band Pop',
    market: 'korea',
    primaryLanguage: 'korean',
    audience: 'twenties',
    promise: '퇴근길 지하철과 원룸으로 이어지는 하루의 끝, 감성 밴드팝과 R&B 중심의 위로 플레이리스트',
    visualIdentity: 'modern minimal city interior, warm desk lamp, subway window reflection, clean sans-serif typography',
    defaultVocal: 'confident modern Korean pop lead, emotionally direct delivery, close-mic warmth',
    preferredGenres: ['kr2030-emo-band-pop', 'kr2030-dawn-rnb', 'kr2030-acoustic-folk'],
    preferredMoods: ['bittersweet', 'warm', 'hopeful'],
    forbiddenCliches: [
      'too old-fashioned trot mood', 'childish lyrics', 'dramatic power ballad shouting', 'famous artist imitation',
      'excessive rap verses', 'soundalike vocal', 'overly nostalgic senior-radio imagery'
    ],
    seoKeywords: ['퇴근길 노래', '감성 밴드팝', '20대 플레이리스트', '30대 플레이리스트', '위로 노래', '한국 인디팝'],
    archetype: 'kr-2030-pop'
  },
  {
    id: 'thirty-night-walk',
    name: '서른의 밤, 다시 걷게 하는 노래',
    englishName: 'Thirty, Walking Again',
    market: 'korea',
    primaryLanguage: 'korean',
    audience: 'twenties',
    promise: '서른 즈음의 고민과 회복을 그리는 OST 발라드·어쿠스틱 포크 중심 플레이리스트',
    visualIdentity: 'quiet night street, warm streetlight glow, minimal editorial typography, no crowds',
    defaultVocal: 'emotive Korean ballad lead, controlled power building into the chorus, close-mic warmth',
    preferredGenres: ['kr2030-ost-ballad', 'kr2030-acoustic-folk', 'kr2030-emo-band-pop'],
    preferredMoods: ['bittersweet', 'hopeful', 'romantic'],
    forbiddenCliches: [
      'too old-fashioned trot mood', 'childish lyrics', 'dramatic power ballad shouting', 'famous artist imitation',
      'excessive rap verses', 'soundalike vocal', 'overly nostalgic senior-radio imagery'
    ],
    seoKeywords: ['서른 노래', '위로 발라드', '인생 노래', 'OST 감성', '30대 플레이리스트', '한국 발라드'],
    archetype: 'kr-2030-pop'
  },
  {
    id: 'rainy-seoul-nightscape',
    name: '비 오는 서울 야경 플레이리스트',
    englishName: 'Rainy Seoul Nightscape',
    market: 'korea',
    primaryLanguage: 'korean',
    audience: 'twenties',
    promise: '비 오는 밤 서울의 골목과 거리를 그리는 R&B·일렉트로팝 중심 야경 드라이브 플레이리스트',
    visualIdentity: 'rainy neon-lit Seoul alley, wet asphalt reflections, clean modern typography, no visible faces',
    defaultVocal: 'close intimate Korean R&B lead, airy ad-lib runs, confident female-led pop vocal',
    preferredGenres: ['kr2030-dawn-rnb', 'kr2030-electro-pop', 'kr2030-y2k-retro'],
    preferredMoods: ['rainy-comfort', 'romantic', 'fresh-start'],
    forbiddenCliches: [
      'too old-fashioned trot mood', 'childish lyrics', 'dramatic power ballad shouting', 'famous artist imitation',
      'excessive rap verses', 'soundalike vocal', 'overly nostalgic senior-radio imagery'
    ],
    seoKeywords: ['서울 야경 플레이리스트', '드라이브 노래', 'R&B 플레이리스트', '일렉트로팝', '비 오는 밤 노래', '한국 시티팝'],
    archetype: 'kr-2030-pop'
  },
  // TASK C2 (§9-1) — jp-2030 workspace's 3 channel presets, same reasoning
  // as kr-2030's own comment above: archetype: 'jp-2030-pop' is mandatory on
  // every entry (migrateArchetype would otherwise route to senior-morning).
  // artistName left unset, following B2's own kr-2030 presets above (none
  // of them set it either) — see this task's own §9-3/§13-4 "미결정".
  {
    id: 'reiwa-way-home-jpop',
    name: '帰り道に聴く令和J-POP',
    englishName: 'Reiwa J-Pop for the Way Home',
    market: 'japan',
    primaryLanguage: 'japanese',
    audience: 'twenties',
    promise: '放課後や帰り道の気持ちに寄り添う、令和メロディックJ-ロック・アニメ調ポップ中心のプレイリスト',
    visualIdentity: 'school path at dusk, soft seasonal light, clean minimal sans-serif typography, no visible faces',
    defaultVocal: 'bright melodic Japanese pop lead, wide open sabi range, emotionally direct delivery',
    preferredGenres: ['jp2030-melodic-jrock', 'jp2030-anime-cinematic', 'jp2030-heisei-nostalgia'],
    preferredMoods: ['bittersweet', 'hopeful', 'warm'],
    forbiddenCliches: [
      'showa-era kissaten imagery', 'senior-radio nostalgia', 'specific anime title or character reference',
      'famous artist imitation', 'soundalike vocal', 'childish lyrics'
    ],
    seoKeywords: ['帰り道 J-POP', '令和ポップス', 'アニメ風ポップ', '青春プレイリスト', '20代プレイリスト', 'メロディックJ-ロック'],
    archetype: 'jp-2030-pop'
  },
  {
    id: 'tokyo-night-melodic-pop',
    name: '夜の東京メロディックポップ',
    englishName: 'Tokyo Night Melodic Pop',
    market: 'japan',
    primaryLanguage: 'japanese',
    audience: 'twenties',
    promise: '夜の東京を舞台にしたネオシティポップ・チルネオソウル中心のドライブ&夜更かしプレイリスト',
    visualIdentity: 'quiet late-night city corner, muted wet-asphalt tones, one warm light source, no faces',
    defaultVocal: 'smooth intimate Japanese R&B-pop lead, airy ad-lib runs, close-mic warmth',
    preferredGenres: ['jp2030-neo-citypop', 'jp2030-chill-neosoul', 'jp2030-dance-vocal'],
    preferredMoods: ['romantic', 'bittersweet', 'rainy-comfort'],
    forbiddenCliches: [
      'generic neon Tokyo skyline cliche', 'showa-era kissaten imagery', 'senior-radio nostalgia',
      'famous artist imitation', 'soundalike vocal', 'excessive rap verses'
    ],
    seoKeywords: ['東京 シティポップ', 'ネオシティポップ', '夜のドライブ', 'チルポップ', '20代プレイリスト', 'メロディックポップ'],
    archetype: 'jp-2030-pop'
  },
  {
    id: 'want-to-cry-band-playlist',
    name: '少し泣きたい日のバンドプレイリスト',
    englishName: 'A Little Teary Band Playlist',
    market: 'japan',
    primaryLanguage: 'japanese',
    audience: 'twenties',
    promise: '少し泣きたい日にそっと寄り添う、メロディックJ-ロック・平成ノスタルジア中心のバンドプレイリスト',
    visualIdentity: 'empty classroom or clubroom at dusk, soft warm window light, minimal editorial typography',
    defaultVocal: 'emotionally direct Japanese band-pop lead, occasional falsetto lift, close-mic warmth',
    preferredGenres: ['jp2030-melodic-jrock', 'jp2030-heisei-nostalgia', 'jp2030-anime-cinematic'],
    preferredMoods: ['bittersweet', 'warm', 'hopeful'],
    forbiddenCliches: [
      'showa-era kissaten imagery', 'senior-radio nostalgia', 'dramatic power ballad shouting',
      'famous artist imitation', 'soundalike vocal', 'excessive rap verses'
    ],
    seoKeywords: ['泣ける歌', 'バンドプレイリスト', '青春ソング', 'J-ロック 感動', '20代プレイリスト', '平成ノスタルジー'],
    archetype: 'jp-2030-pop'
  },
  // TASK E1 §9-1 — kr-kids workspace's 3 channel presets, same
  // registered-in-both-arrays pattern as kr2030/jp2030 above.
  // archetype: 'kr-kids-song' is mandatory on every entry (migrateArchetype
  // would otherwise route to senior-morning). artistName left unset — §9-3
  // is a "하루 님 결정 필요" item (DistroKid distribution requirement),
  // reported not invented; see docs/e1-report.md §13-4[A].
  {
    id: 'follow-along-action-song',
    name: '따라 하는 율동 동요',
    englishName: 'Follow-Along Action Song',
    market: 'korea',
    primaryLanguage: 'korean',
    audience: 'kids',
    promise: '점프하고 손뼉 치며 따라 부르는 신나는 율동 동요 플레이리스트',
    visualIdentity: 'bright playground colors, simple shapes, cheerful daylight, no characters or mascots',
    defaultVocal: 'bright cheerful boy and girl duet singalong, youthful childlike voices, call-and-response singing',
    preferredGenres: ['krkids-action', 'krkids-animal-vehicle', 'krkids-counting-color'],
    preferredMoods: ['bright-playful'],
    forbiddenCliches: [
      'senior-radio nostalgia', 'adult romantic themes', 'scary or frightening themes',
      'reusing an existing nursery rhyme melody or lyrics', 'excessive rap verses', 'soundalike vocal'
    ],
    seoKeywords: ['율동 동요', '유치원 체조', '동요 플레이리스트', '어린이 액션송', '유아 음악', '신나는 동요'],
    archetype: 'kr-kids-song',
    // v5.13 (TASK: kidsAgeTierId wiring) — "점프하고 손뼉 치며 따라 부르는" 신나는
    // 율동(action/exercise) 콘텐츠: 지시문의 "학습·운동·스토리 동요 → kids-t3"
    // 버킷에 해당. preferredGenres의 krkids-action 자체도 T2/T3 모션 규칙
    // (data/kidsStructureTemplates.ts's KIDS_MOTION_CUE_RULES) 중 T3에서만
    // 허용되는 'spin'까지 포함한 더 활동적인 동작 범위와 맞습니다.
    kidsAgeTierId: 'kids-t3'
  },
  {
    id: 'daily-habit-learning-song',
    name: '생활습관 배우는 노래',
    englishName: 'Daily Habit Learning Song',
    market: 'korea',
    primaryLanguage: 'korean',
    audience: 'kids',
    promise: '양치, 손 씻기, 숫자와 색깔을 신나게 배우는 생활습관·학습 동요 플레이리스트',
    visualIdentity: 'bright playground colors, simple shapes, cheerful daylight, no characters or mascots',
    defaultVocal: 'bright cheerful boy and girl duet singalong, youthful childlike voices, call-and-response singing',
    preferredGenres: ['krkids-daily-habit', 'krkids-counting-color', 'krkids-bilingual'],
    preferredMoods: ['bright-playful'],
    forbiddenCliches: [
      'senior-radio nostalgia', 'adult romantic themes', 'scary or frightening themes',
      'reusing an existing nursery rhyme melody or lyrics', 'excessive rap verses', 'soundalike vocal'
    ],
    seoKeywords: ['생활습관 동요', '숫자 동요', '색깔 동요', '유아 학습 노래', '한영 이중언어 동요', '어린이 교육송'],
    archetype: 'kr-kids-song',
    // v5.13 (TASK: kidsAgeTierId wiring) — "양치, 손 씻기, 숫자와 색깔" 콘텐츠는
    // 지시문의 "일반 유아 동요·생활습관 → kids-t2" 버킷과 정확히 일치하고,
    // preferredGenres의 krkids-daily-habit/krkids-counting-color도
    // data/kidsVocabularyWhitelist.ts의 T2 화이트리스트("숫자 1~5/색깔/탈것")와
    // 그대로 겹칩니다.
    kidsAgeTierId: 'kids-t2'
  },
  {
    id: 'bedtime-lullaby-radio',
    name: '잠들기 전 자장가',
    englishName: 'Bedtime Lullaby Radio',
    market: 'korea',
    primaryLanguage: 'korean',
    audience: 'kids',
    promise: '하루를 마무리하며 편안하게 잠드는 부드러운 자장가·역할놀이 동요 플레이리스트',
    // v5.8 (audit follow-up) — was byte-identical to follow-along-action-song's
    // own visualIdentity ("bright playground colors...cheerful daylight"),
    // directly contradicting this channel's own "잠들기 전"/"편안하게 잠드는"
    // promise. Kept the shared brand constraint (simple shapes, no
    // characters/mascots) unchanged, only swapped the color/lighting
    // register from bright daytime to dim evening.
    visualIdentity: 'soft muted pastel colors, simple shapes, warm dim evening light, no characters or mascots',
    // v5.8 (audit follow-up, docs/v58-report.md §0-1) — was byte-identical to
    // follow-along-action-song's own defaultVocal ("bright cheerful...
    // call-and-response singing"), an energetic delivery this channel's own
    // forbiddenCliches list below already banned ("energetic", "hand claps")
    // — the vocal descriptor and the exclusion list directly contradicted
    // each other. Real 18-song generation confirmed the mismatch (see
    // report). Now matches the channel's own stated "부드러운 자장가" promise.
    defaultVocal: 'soft soothing solo lead vocal, gentle and unhurried delivery, quiet warm humming accents, no energetic call-and-response',
    // v5.8 — 'krkids-daily-habit' removed: it isn't named in this channel's
    // own promise ("자장가·역할놀이", lullaby + roleplay — no "daily habit"),
    // its own instrument list includes 'hand claps' (directly contradicting
    // this channel's forbiddenCliches below), and its 98-112 BPM tempo range
    // isn't lullaby-appropriate. The 2 remaining genres both match the
    // channel's own promise text; 'krkids-sleep-calm' (62-84 BPM) is the
    // only genuinely calm-tempo genre in the kr-kids catalog today —
    // 'krkids-roleplay-story' stays upbeat (105-122 BPM) since roleplay
    // itself is explicitly promised, not miscategorized; a calm-tempo
    // roleplay variant would be genre-catalog work, out of this preset-level
    // fix's scope.
    preferredGenres: ['krkids-sleep-calm', 'krkids-roleplay-story'],
    // v5.8 — was 'bright-playful' (identical to every energetic kr-kids
    // channel); 'calm-focus' is the only calm-register mood in the shared
    // catalog (data/presets.ts's own MOOD_PACKS — its lyricImages lean
    // "quiet desk/window light" rather than bedtime-specific, since no
    // dedicated lullaby mood exists yet, but it's a real, correct
    // improvement over the previous mismatch).
    preferredMoods: ['calm-focus'],
    forbiddenCliches: [
      'senior-radio nostalgia', 'adult romantic themes', 'scary or frightening themes',
      'reusing an existing nursery rhyme melody or lyrics', 'hand claps', 'energetic'
    ],
    seoKeywords: ['자장가', '낮잠 동요', '수면 동요', '역할놀이 동요', '어린이 잠자리 노래', '편안한 동요'],
    archetype: 'kr-kids-song',
    // v5.13 (TASK: kidsAgeTierId wiring) — 자장가 채널은 지시문의 "자장가·영아
    // 채널 → kids-t1" 버킷 그 자체. preferredGenres의 krkids-sleep-calm
    // (62-84 BPM)도 kidsAgeTiers.ts의 kids-t1 tempoRange([60,100])와 겹치는
    // 유일한 kr-kids 장르입니다.
    kidsAgeTierId: 'kids-t1'
  },
  // TASK F1 §9-2 — jp-kids workspace's 3 channel presets, same
  // registered-once pattern as E1's krkids block above. archetype:
  // 'jp-kids-song' is mandatory on every entry (migrateArchetype would
  // otherwise route to senior-morning). artistName left unset — §9-4 is a
  // "하루 님 결정 필요" item (DistroKid distribution requirement, separate
  // from kr-kids's own), reported not invented; see docs/f1-report.md §13-4[A].
  {
    id: 'teasobi-hiroba',
    name: 'てあそびうた ひろば',
    englishName: 'Hand-Play Song Plaza',
    market: 'japan',
    primaryLanguage: 'japanese',
    audience: 'kids',
    promise: '指遊びや手拍子であそぶ、オノマトペいっぱいの手遊び歌プレイリスト',
    visualIdentity: 'bright playground colors, simple shapes, cheerful daylight, no characters or mascots',
    defaultVocal: 'warm nursery-toned Japanese lead, echoing children\'s-voice response',
    preferredGenres: ['jpkids-teasobi', 'jpkids-onomatopoeia', 'jpkids-food-vehicle'],
    preferredMoods: ['bright-playful'],
    forbiddenCliches: [
      'showa-era kissaten imagery', 'senior-radio nostalgia', 'adult romantic themes', 'scary or frightening themes',
      'reusing an existing nursery rhyme melody or lyrics', 'excessive rap verses'
    ],
    seoKeywords: ['手遊び歌', 'てあそびうた', 'オノマトペソング', '幼児向け童謡', '保育園 手遊び', '親子で遊ぶ歌'],
    archetype: 'jp-kids-song',
    // v5.13 (TASK: kidsAgeTierId wiring) — 指遊び(손가락 놀이)·손뼉 중심의
    // 일반적인 놀이 콘텐츠로, 자장가(t1)도 운동/체조(t3)도 아닌 지시문의
    // "일반 유아 동요·생활습관 → kids-t2" 버킷에 해당 — kr-kids의
    // daily-habit-learning-song과 같은 자리(자장가/운동이 아닌 나머지)의
    // jp-kids 대응 채널.
    kidsAgeTierId: 'kids-t2'
  },
  {
    id: 'minna-de-taiso',
    name: 'みんなで たいそう',
    englishName: 'Exercise Together',
    market: 'japan',
    primaryLanguage: 'japanese',
    audience: 'kids',
    promise: '体操やダンスで体を動かす、元気いっぱいの体操・オノマトペソングプレイリスト',
    visualIdentity: 'bright playground colors, simple shapes, cheerful daylight, no characters or mascots',
    defaultVocal: 'spirited coach-style Japanese lead, group shout-back on the motion cue',
    preferredGenres: ['jpkids-taiso-dance', 'jpkids-onomatopoeia', 'jpkids-teasobi'],
    preferredMoods: ['bright-playful'],
    forbiddenCliches: [
      'showa-era kissaten imagery', 'senior-radio nostalgia', 'adult romantic themes', 'scary or frightening themes',
      'reusing an existing nursery rhyme melody or lyrics', 'dense percussion layers'
    ],
    seoKeywords: ['体操ソング', 'ダンスソング', '保育園 体操', '幼児向け童謡', '親子体操', '元気な歌'],
    archetype: 'jp-kids-song',
    // v5.13 (TASK: kidsAgeTierId wiring) — 体操・ダンス(체조·댄스) 콘텐츠는
    // 지시문의 "학습·운동·스토리 동요 → kids-t3" 버킷 그 자체 — kr-kids의
    // follow-along-action-song과 동일한 자리의 jp-kids 대응 채널.
    kidsAgeTierId: 'kids-t3'
  },
  {
    id: 'oyasumi-mae-no-uta',
    name: 'おやすみまえの うた',
    englishName: 'Before-Bedtime Song',
    market: 'japan',
    primaryLanguage: 'japanese',
    audience: 'kids',
    promise: '生活習慣や季節の歌でゆったり過ごす、寝る前にぴったりの落ち着いた童謡プレイリスト',
    // v5.8 (audit follow-up, docs/v58-report.md §0-1) — was byte-identical
    // to every energetic jp-kids channel's own visualIdentity ("bright
    // playground colors...cheerful daylight"), contradicting this channel's
    // own "寝る前にぴったりの落ち着いた" (calm, just right before bed)
    // promise. Same fix as kr-kids's bedtime-lullaby-radio channel.
    visualIdentity: 'soft muted pastel colors, simple shapes, warm dim evening light, no characters or mascots',
    defaultVocal: 'patient coaxing Japanese lead, children answering back the routine cue',
    preferredGenres: ['jpkids-daily-habit', 'jpkids-seasonal', 'jpkids-english-learning'],
    // v5.8 — was 'bright-playful' (identical to minna-de-taiso, the
    // energetic exercise channel). 'calm-focus' also now drives real theme
    // selection (data/lyricThemes.ts's lyricThemesForOptions), excluding
    // moodTag:'energetic' jp-kids themes for this channel specifically.
    preferredMoods: ['calm-focus'],
    forbiddenCliches: [
      'showa-era kissaten imagery', 'senior-radio nostalgia', 'adult romantic themes', 'scary or frightening themes',
      'reusing an existing nursery rhyme melody or lyrics', 'driving beat'
    ],
    seoKeywords: ['生活習慣ソング', '季節の歌', '寝る前の歌', '幼児向け童謡', '保育園 生活習慣', '落ち着く童謡'],
    archetype: 'jp-kids-song',
    // v5.13 (TASK: kidsAgeTierId wiring) — 콘텐츠 자체는 생활습관/계절 노래지만
    // 채널의 실제 약속("寝る前にぴったりの落ち着いた" — 자기 전에 딱 맞는
    // 차분한)은 명백히 취침 전 프레이밍 — 지시문의 "자장가·영아 채널 → kids-t1"
    // 버킷. kr-kids의 bedtime-lullaby-radio와 동일한 자리의 jp-kids 대응 채널.
    kidsAgeTierId: 'kids-t1'
  },
  // TASK K2 §10-2 — kr-idol-male workspace's 3 channel presets. Every entry
  // sets vocalQuotaOverride (§5-1: { male: 15, female: 0, mixed: 3 }, the
  // 3 non-zero mixed slots reserved for real-world featuring/duet tracks)
  // so this workspace never falls back to DEFAULT_ADULT_VOCAL_QUOTA's 6/6/6
  // split — the whole point of §5's own vocal-quota work.
  {
    id: 'stage-night',
    name: '무대 위의 밤',
    englishName: 'Night on Stage',
    market: 'korea',
    primaryLanguage: 'korean',
    audience: 'twenties',
    promise: '퍼포먼스 트랩과 밴드 크로스오버 중심, 무대 위의 확신과 폭발적인 에너지를 담은 남자 아이돌 플레이리스트',
    visualIdentity: 'dark stage backlight, sweeping spotlight beams, haze and rim light, bold sans-serif typography',
    defaultVocal: 'confident male idol lead, rap-sung verse into a stacked unison chorus',
    preferredGenres: ['kridol-performance-trap', 'kridol-band-crossover', 'kridol-synth-dance'],
    preferredMoods: ['confident', 'energetic'],
    vocalQuotaOverride: { male: 15, female: 0, mixed: 3 },
    forbiddenCliches: [
      'specific idol group imitation', 'named member vocal timbre', 'signature hook of an existing song',
      'senior-radio nostalgia imagery', 'childish lyrics', 'excessive rap verses without a sung hook'
    ],
    seoKeywords: ['남자 아이돌 노래', '퍼포먼스 트랩', '아이돌 무대곡', 'K-POP 남돌', '컴백 무대 노래', '남자 아이돌 플레이리스트'],
    archetype: 'kr-idol-male'
  },
  {
    id: 'drive-kpop-playlist',
    name: '드라이브 K-POP 플레이리스트',
    englishName: 'Drive K-Pop Playlist',
    market: 'korea',
    primaryLanguage: 'korean',
    audience: 'twenties',
    promise: '신스 댄스와 레트로 훵크 중심, 야간 도시를 달리며 듣기 좋은 신나는 남자 아이돌 드라이브 플레이리스트',
    visualIdentity: 'saturated neon city night, streaking headlights, skyline glow, bold sans-serif typography',
    defaultVocal: 'bright confident male idol lead, layered unison hook vocal',
    preferredGenres: ['kridol-synth-dance', 'kridol-retro-funk', 'kridol-latin-afro'],
    preferredMoods: ['bright', 'confident'],
    vocalQuotaOverride: { male: 15, female: 0, mixed: 3 },
    forbiddenCliches: [
      'specific idol group imitation', 'named member vocal timbre', 'signature hook of an existing song',
      'generic neon Tokyo skyline', 'sports car at night', 'senior-radio nostalgia imagery'
    ],
    seoKeywords: ['드라이브 K-POP', '남자 아이돌 댄스곡', '신나는 아이돌 노래', 'K-POP 드라이브 플레이리스트', '레트로 훵크 아이돌', '아이돌 댄스 플레이리스트'],
    archetype: 'kr-idol-male'
  },
  {
    id: 'dawn-confession',
    name: '새벽의 고백',
    englishName: 'Dawn Confession',
    market: 'korea',
    primaryLanguage: 'korean',
    audience: 'twenties',
    promise: '미드템포 R&B와 감성 발라드 중심, 새벽 감성과 갈망을 담은 남자 아이돌 발라드 플레이리스트',
    visualIdentity: 'monochrome close-up light and shadow, quiet negative space, restrained serif typography',
    defaultVocal: 'smooth restrained male idol lead, layered harmony stack on the chorus',
    preferredGenres: ['kridol-midtempo-rnb', 'kridol-emotional-ballad', 'kridol-band-crossover'],
    preferredMoods: ['intimate', 'emotional'],
    vocalQuotaOverride: { male: 15, female: 0, mixed: 3 },
    forbiddenCliches: [
      'specific idol group imitation', 'named member vocal timbre', 'signature hook of an existing song',
      'lo-fi study beat', 'dusty piano loop', 'senior-radio nostalgia imagery'
    ],
    seoKeywords: ['남자 아이돌 발라드', '새벽 감성 노래', 'K-POP R&B', '아이돌 감성 발라드', '갈망 노래', '남자 아이돌 R&B 플레이리스트'],
    archetype: 'kr-idol-male'
  },
  // TASK K3 §9-2 — kr-idol-female workspace's 3 channel presets. Every
  // entry sets vocalQuotaOverride (§4-4: { male: 0, female: 15, mixed: 3 },
  // symmetric with K2's own { male: 15, female: 0, mixed: 3 }) and
  // forbiddenCliches includes §7-1/§7-2's own banned-vocabulary families
  // (this is a UI-facing hint list, separate from core/idolExpressionLint.ts's
  // own hard-gate scan of real generated output). defaultVocal wording is
  // deliberately chosen to literally share words with
  // data/vocalTraits.ts's FEMALE_VOCAL_TRAIT_AXES pool ("bright forward
  // delivery" / "light rhythmic phrasing" / "warm rounded midrange" /
  // "restrained understated reading" are actual pool candidates) — see
  // core/vocalPlan.ts's channelFlavorWeight, the only safe lever available
  // to bias buildAdultVocalTraitPlan's shared axis pool toward idol-
  // appropriate register/timbre/delivery without touching the pool itself
  // (K3's own report explains why touching the shared pool directly was
  // judged out of scope).
  {
    id: 'daylight-city-kpop',
    name: '낮의 도시를 걷는 K-POP',
    englishName: 'Walking the Daylight City',
    market: 'korea',
    primaryLanguage: 'korean',
    audience: 'twenties',
    promise: '신스 댄스와 라틴 아프로비트 중심, 낮의 도시를 당당하게 걷는 여자 아이돌 플레이리스트',
    visualIdentity: 'bold saturated daylight color blocks, sharp midday shadow, bold sans-serif typography',
    defaultVocal: 'bright forward female idol lead, light rhythmic phrasing, confident delivery',
    preferredGenres: ['kridol-synth-dance', 'kridol-latin-afro', 'kridol-retro-funk'],
    preferredMoods: ['confident', 'bright'],
    vocalQuotaOverride: { male: 0, female: 15, mixed: 3 },
    forbiddenCliches: [
      'specific idol group imitation', 'named member vocal timbre', 'signature hook of an existing song',
      'sultry seductive framing', 'schoolgirl or teen coding', 'senior-radio nostalgia imagery'
    ],
    seoKeywords: ['여자 아이돌 노래', '낮의 도시 K-POP', '여돌 댄스곡', 'K-POP 걸그룹 플레이리스트', '자신감 노래', '여자 아이돌 신스댄스'],
    archetype: 'kr-idol-female'
  },
  {
    id: 'nonstop-playlist',
    name: '멈추지 않는 플레이리스트',
    englishName: 'The Playlist That Never Stops',
    market: 'korea',
    primaryLanguage: 'korean',
    audience: 'twenties',
    promise: '퍼포먼스 트랩과 밴드 크로스오버 중심, 끝까지 밀어붙이는 여자 아이돌 퍼포먼스 플레이리스트',
    visualIdentity: 'bright even backlight, matched silhouette line, bold sans-serif typography',
    defaultVocal: 'full chest female idol belt, bright rhythmic delivery, driving energy',
    preferredGenres: ['kridol-performance-trap', 'kridol-band-crossover', 'kridol-synth-dance'],
    preferredMoods: ['confident', 'energetic'],
    vocalQuotaOverride: { male: 0, female: 15, mixed: 3 },
    forbiddenCliches: [
      'specific idol group imitation', 'named member vocal timbre', 'signature hook of an existing song',
      'body or curves description', 'schoolgirl or teen coding', 'excessive rap verses without a sung hook'
    ],
    seoKeywords: ['여자 아이돌 퍼포먼스', '걸그룹 댄스곡', '여돌 트랩', 'K-POP 걸그룹 댄스', '통쾌한 노래', '여자 아이돌 밴드 크로스오버'],
    archetype: 'kr-idol-female'
  },
  {
    id: 'songs-for-after-its-over',
    name: '끝내고 나서 듣는 노래',
    englishName: 'Songs for After It\'s Over',
    market: 'korea',
    primaryLanguage: 'korean',
    audience: 'twenties',
    promise: '미드템포 R&B와 감성 발라드 중심, 관계를 정리한 뒤의 후련함을 담은 여자 아이돌 발라드 플레이리스트',
    visualIdentity: 'bold flat color-block graphic, small abstracted silhouette, restrained serif typography',
    defaultVocal: 'clear female idol lead, warm rounded midrange, restrained understated delivery',
    preferredGenres: ['kridol-midtempo-rnb', 'kridol-emotional-ballad', 'kridol-band-crossover'],
    preferredMoods: ['intimate', 'emotional'],
    vocalQuotaOverride: { male: 0, female: 15, mixed: 3 },
    forbiddenCliches: [
      'specific idol group imitation', 'named member vocal timbre', 'signature hook of an existing song',
      'sultry seductive framing', 'schoolgirl or teen coding', 'lo-fi study beat'
    ],
    seoKeywords: ['여자 아이돌 발라드', '후련한 노래', 'K-POP R&B', '여돌 감성 발라드', '이별 후 노래', '여자 아이돌 R&B 플레이리스트'],
    archetype: 'kr-idol-female'
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
  // TASK C1 — jp-2030 workspace's 7 genres, same registered-in-both pattern.
  ...jp2030GenrePacks,
  // TASK E1 — kr-kids workspace's 7 genres, same registered-in-both pattern.
  ...krkidsGenrePacks,
  // TASK F1 — jp-kids workspace's 7 genres, same registered-in-both pattern.
  ...jpkidsGenrePacks,
  // TASK K2 — kr-idol-male workspace's 7 genres, same registered-in-both pattern.
  ...kridolMaleGenrePacks,
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
  { id: 'bright-playful', label: 'Bright & Playful', emotionWords: ['bright', 'playful', 'curious', 'cheerful'], lyricImages: ['sunny playground', 'bouncing ball', 'giggling laughter', 'colorful balloons'] },
  // codex 지시문 07 (TASK C, real gap found by E2E testing) — every one of
  // TASK K2's own kr-idol-male/kr-idol-female channel presets (§10-2, this
  // file's own '무대 위의 밤' etc. entries) sets preferredMoods to one of
  // these 5 ids, but none of them were ever added to moodPacks — every
  // default idol channel failed validateChannelProfile out of the box
  // (both idol workspaces were unusable without the user manually
  // reconfiguring moods first). Adding the missing ids, not remapping the
  // presets, since these are real, distinct idol-context moods the presets
  // were clearly designed around (stage confidence vs. intimate ballad vs.
  // high-energy performance are meaningfully different lyric directions).
  { id: 'confident', label: 'Confident', emotionWords: ['confident', 'self-assured', 'unshakable'], lyricImages: ['spotlight', 'front row', 'raised chin', 'center stage'] },
  { id: 'energetic', label: 'Energetic', emotionWords: ['energetic', 'electric', 'high-voltage'], lyricImages: ['pounding bass', 'strobe light', 'packed floor', 'racing pulse'] },
  { id: 'bright', label: 'Bright', emotionWords: ['bright', 'vivid', 'radiant'], lyricImages: ['neon skyline', 'headlights streaking', 'open road at night', 'city glow'] },
  { id: 'intimate', label: 'Intimate', emotionWords: ['intimate', 'close', 'hushed'], lyricImages: ['low light', 'close whisper', 'quiet room', 'held hand'] },
  { id: 'emotional', label: 'Emotional', emotionWords: ['emotional', 'raw', 'heartfelt'], lyricImages: ['welling eyes', 'trembling voice', 'empty stage after the lights', 'last note fading'] }
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
