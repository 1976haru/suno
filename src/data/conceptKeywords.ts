/**
 * TASK H1 (v3.10) — local (no-API) keyword sceenario -> genre/mood/season
 * mapping for the concept agent (core/conceptAgent.ts). Every pattern list
 * covers Korean, English, and Japanese synonyms for the same everyday
 * scenario, since users describe songs in whichever language they think in.
 *
 * Weights point at genre/mood/season ids from src/data/presets.ts. A genre
 * id that isn't in the requesting channel's core tier for its archetype is
 * simply ignored at scoring time (see conceptAgent.ts) — these rules are
 * shared across archetypes on purpose, so a single rule set doesn't need a
 * per-archetype copy.
 */

export interface KeywordRule {
  id: string;
  patterns: RegExp[];
  genreWeights?: Record<string, number>;
  moodWeights?: Record<string, number>;
  seasonWeights?: Record<string, number>;
}

export const CONCEPT_KEYWORD_RULES: KeywordRule[] = [
  {
    id: 'winter',
    patterns: [/겨울/, /눈(?!치)/, /winter/i, /\bsnow/i, /冬/, /雪/],
    seasonWeights: { 'early-winter': 3, 'first-snow': 2, 'late-winter': 1 }
  },
  {
    id: 'christmas',
    patterns: [/크리스마스/, /성탄/, /christmas/i, /クリスマス/],
    seasonWeights: { christmas: 4 },
    genreWeights: { 'christmas-soft-pop': 2 }
  },
  {
    id: 'year-end',
    patterns: [/연말/, /한해가\s*저물/, /year[- ]?end/i, /年末/],
    seasonWeights: { 'year-end': 3 }
  },
  {
    id: 'autumn',
    patterns: [/가을/, /낙엽/, /단풍/, /쓸쓸/, /autumn/i, /\bfall\b/i, /秋/, /紅葉/],
    seasonWeights: { 'early-autumn': 2, 'maple-autumn': 3, 'autumn-rain': 1 },
    moodWeights: { bittersweet: 2 }
  },
  {
    id: 'spring',
    patterns: [/봄/, /벚꽃/, /spring/i, /cherry\s*blossom/i, /春/, /桜/],
    seasonWeights: { 'spring-open': 2, 'cherry-blossom': 3 },
    moodWeights: { hopeful: 1 }
  },
  {
    id: 'summer',
    patterns: [/여름/, /장마/, /summer/i, /rainy\s*season/i, /夏/, /梅雨/],
    seasonWeights: { 'summer-night': 2, 'rainy-season': 2 }
  },
  {
    id: 'new-year',
    patterns: [/새해/, /신년/, /new\s*year/i, /新年/],
    seasonWeights: { 'new-year': 3 }
  },
  {
    id: 'nostalgic-familiar',
    patterns: [
      /어디선가\s*들어본/, /들어본\s*적/, /익숙한/, /옛날\s*노래/, /그리(움|워)/, /보고\s*싶/, /옛\s*친구/,
      /heard\s*(it\s*)?before/i, /familiar/i, /nostalgi/i, /miss(ing)?\s*(you|someone)/i, /old\s*friend/i,
      /どこかで聞いた/, /聞き覚え/, /懐かし/, /会いたい/
    ],
    moodWeights: { nostalgic: 3, hopeful: 1 },
    genreWeights: { 'adult-contemporary': 2, 'retro-soul-pop': 1 }
  },
  {
    id: 'cafe',
    patterns: [/카페/, /커피/, /창가/, /찻집/, /\bcafe\b/i, /coffee/i, /window\s*seat/i, /カフェ/, /コーヒー/, /喫茶店/, /窓辺/],
    genreWeights: { 'lofi-cafe': 3, 'bossa-cafe': 2, 'jazz-pop': 1 }
  },
  {
    id: 'alone-drive-walk',
    patterns: [/혼자/, /운전/, /드라이브/, /산책/, /\balone\b/i, /driving/i, /\bdrive\b/i, /walk(ing)?/i, /一人/, /運転/, /ドライブ/, /散歩/],
    moodWeights: { 'calm-focus': 2, warm: 1 }
  },
  {
    id: 'comfort-healing',
    patterns: [
      /위로/, /힘들\s*때/, /지칠\s*때/, /토닥/, /괜찮다고/,
      /comfort/i, /when\s*(i'?m\s*)?tired/i, /hard\s*time/i, /healing/i,
      /癒し/, /疲れた/, /大丈夫/
    ],
    moodWeights: { warm: 2, bittersweet: 1 },
    genreWeights: { 'healing-ballad': 3, 'piano-ballad': 2 }
  },
  {
    id: 'bright-upbeat',
    patterns: [/밝은/, /경쾌한/, /기분\s*좋은/, /신나는/, /bright/i, /upbeat/i, /cheerful/i, /明るい/, /軽快/],
    moodWeights: { hopeful: 2, warm: 1 },
    genreWeights: { 'folk-pop': 2, 'acoustic-pop': 2, 'city-pop-soft': 1 }
  },
  {
    id: 'rain',
    patterns: [/비\s*오는/, /빗소리/, /rain(y)?/i, /雨/],
    seasonWeights: { 'rainy-season': 2, 'autumn-rain': 2 },
    moodWeights: { 'rainy-comfort': 3 }
  },
  {
    id: 'romantic',
    patterns: [/설레(는|임)/, /사랑/, /romantic/i, /love\s*song/i, /恋/, /愛/],
    moodWeights: { romantic: 3 }
  },
  // TASK v3.61 (TASK B-2) — a real senior-morning pack's genre allocation
  // kept landing on adult-contemporary/acoustic-pop/jazz-pop/retro-soul-pop
  // no matter what the user typed, because this whole file had zero Korean
  // genre-name keywords — "올드팝", "샹송", "알앤비" simply matched nothing.
  // The requested genres were never missing from the library (see
  // genreLibrary/index.ts); nothing routed a Korean genre word to them.
  // Each rule maps to a *bundle* of 4+ related genre ids (never a single
  // genre) so buildGenrePool (conceptAgent.ts) doesn't need to pad the
  // allocation from the generic core-genre order, which would dilute the
  // match with adult-contemporary/acoustic-pop appearing first there.
  {
    id: 'oldpop',
    patterns: [
      /올드\s*팝/, /옛날\s*팝/, /추억의\s*팝송/, /7080/, /칠공팔공/,
      /old\s*pop/i, /oldies/i, /\b(60|70|80)(s|년대)/i,
      /60년대/, /70년대/, /80년대/
    ],
    genreWeights: {
      'oldpop-warm-morning-glow': 5, 'oldpop-soft-rock-am': 5, 'oldpop-motown-pop-soul': 4,
      'oldpop-piano-ballad-70s': 4, 'oldpop-adult-contemporary-80s': 4, 'oldpop-close-harmony-duo': 3,
      'oldpop-doowop-harmony': 3, 'oldpop-sunshine-pop': 3
    },
    moodWeights: { nostalgic: 2, warm: 1 }
  },
  {
    id: 'chanson',
    patterns: [/샹송/, /chanson/i, /프랑스\s*음악/, /파리(지앵)?\s*감성/],
    genreWeights: { chanson: 4 },
    moodWeights: { elegant: 1, bittersweet: 1 }
  },
  {
    id: 'rnb-soul',
    patterns: [/알\s*앤\s*비/, /알앤비/, /r\s*&\s*n?b/i, /rhythm\s*and\s*blues/i, /리듬\s*앤\s*블루스/, /리듬앤블루스/, /소울\s*음악/, /\bsoul\b/i, /소울/],
    genreWeights: {
      'oldpop-motown-pop-soul': 4, 'oldpop-philly-soul-sweet': 3, 'retro-soul-pop': 3, 'oldpop-quiet-storm-warm': 2
    },
    moodWeights: { warm: 1, romantic: 1 }
  },
  {
    id: 'bossa-nova',
    patterns: [/보사\s*노바/, /보사노바/, /\bbossa\b/i, /\b보사\b/],
    genreWeights: { 'bossa-cafe': 4 },
    moodWeights: { warm: 1 }
  },
  {
    id: 'jazz',
    patterns: [/재즈/, /\bjazz\b/i, /스무스\s*재즈/, /smooth\s*jazz/i],
    genreWeights: { 'jazz-pop': 3, 'smooth-jazz-lounge': 3, 'oldpop-standards-torch': 2 },
    moodWeights: { elegant: 1 }
  },
  {
    id: 'city-pop',
    patterns: [/시티\s*팝/, /시티팝/, /city\s*pop/i],
    genreWeights: { 'city-pop-soft': 4 },
    moodWeights: { nostalgic: 1 }
  },
  {
    id: 'folk',
    patterns: [/포크(\s*송)?/, /\bfolk\b/i, /folk\s*song/i],
    genreWeights: { 'folk-pop': 4, 'oldpop-folk-rock-70s': 3 },
    moodWeights: { warm: 1 }
  },
  {
    id: 'ballad',
    patterns: [/발라드/, /\bballad\b/i],
    genreWeights: { 'piano-ballad': 3, 'healing-ballad': 3, 'oldpop-piano-ballad-70s': 3, 'oldpop-orchestral-ballad-80s': 2 },
    moodWeights: { bittersweet: 1 }
  },
  {
    id: 'disco',
    patterns: [/디스코/, /\bdisco\b/i],
    genreWeights: { 'oldpop-europop-glow': 3, 'oldpop-motown-pop-soul': 3 },
    moodWeights: { hopeful: 1 }
  },
  {
    id: 'country',
    patterns: [/컨트리/, /\bcountry\b/i],
    genreWeights: { 'oldpop-countrypolitan': 4 },
    moodWeights: { warm: 1 }
  },
  {
    id: 'doo-wop',
    patterns: [/두\s*왑/, /두왑/, /doo[\s-]?wop/i],
    genreWeights: { 'oldpop-doowop-harmony': 4 },
    moodWeights: { nostalgic: 1 }
  },
  {
    id: 'easy-listening',
    patterns: [/이지\s*리스닝/, /easy\s*listening/i],
    genreWeights: { 'oldpop-orchestral-easy': 4, 'smooth-jazz-lounge': 2 },
    moodWeights: { warm: 1 }
  },
  // TASK v3.61 (TASK B-3, test 5) — "따뜻하고 잔잔한 노래" must reach TASK A's
  // 1-D "timeless warmth" sub-family first, since the request is about a
  // sound quality (warm, unhurried), not any specific era or instrument.
  {
    id: 'warm-gentle',
    patterns: [
      /따뜻하고\s*잔잔/, /따뜻한\s*멜로디/, /잔잔한\s*멜로디/, /포근한/, /따스한/,
      /warm\s*and\s*gentle/i, /gentle\s*melody/i, /soft\s*and\s*warm/i
    ],
    genreWeights: {
      'oldpop-warm-morning-glow': 4, 'oldpop-hearth-acoustic': 4, 'oldpop-sunlit-strings-pop': 3,
      'oldpop-gentle-lullaby-pop': 3, 'oldpop-evening-lamp-ballad': 3, 'oldpop-slow-waltz-memory': 2
    },
    moodWeights: { warm: 3 }
  },
  // TASK B2 (§7) — kr-2030 workspace rules. genreWeights only, per this
  // task's own §7-2 constraint: seasonWeights/moodWeights aren't gated by a
  // channel's core-genre tier the way genreWeights is (see this file's own
  // module doc comment on that filtering), so adding those here would leak
  // into senior-morning scoring for the same input text. A kr2030-* genre id
  // is simply ignored at scoring time for any channel whose archetype's core
  // tier doesn't include it — see conceptAgent.ts.
  {
    id: 'kr2030-after-work',
    patterns: [/퇴근/, /야근/, /회사원/, /월요일/, /after\s*work/i],
    genreWeights: { 'kr2030-emo-band-pop': 4, 'kr2030-dawn-rnb': 1 }
  },
  {
    id: 'kr2030-dawn-night',
    patterns: [/새벽/, /막차/, /지하철/, /밤거리/, /late\s*night/i],
    genreWeights: { 'kr2030-dawn-rnb': 4, 'kr2030-electro-pop': 1 }
  },
  {
    id: 'kr2030-thirty-something',
    patterns: [/서른/, /스물아홉/, /삼십대/, /이십대\s*후반/, /turning\s*thirty/i],
    genreWeights: { 'kr2030-ost-ballad': 4, 'kr2030-acoustic-folk': 2 }
  },
  {
    id: 'kr2030-studio-seoul',
    patterns: [/원룸/, /자취/, /골목/, /서울/, /studio\s*apartment/i],
    genreWeights: { 'kr2030-acoustic-folk': 3, 'kr2030-dawn-rnb': 2 }
  },
  {
    id: 'kr2030-y2k-nostalgia',
    patterns: [/싸이월드/, /엠피쓰리/, /\bmp3\b/i, /y2k/i, /2000년대/, /이천년대/],
    genreWeights: { 'kr2030-y2k-retro': 4 }
  },
  {
    id: 'kr2030-summer-drive',
    patterns: [/드라이브/, /여름\s*밤/, /summer\s*night\s*drive/i],
    genreWeights: { 'kr2030-y2k-retro': 2, 'kr2030-emo-band-pop': 2 }
  }
];

export function matchConceptRules(freeText: string): KeywordRule[] {
  const text = freeText.trim();
  if (!text) return [];
  return CONCEPT_KEYWORD_RULES.filter(rule => rule.patterns.some(pattern => pattern.test(text)));
}
