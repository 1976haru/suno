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
    // 정합성 점검 §2 결함3 fix — explicit "60년대"/"60s" routes to the six
    // real 1950s-60s-bucket genres (data/genreLibrary/index.ts's oldpopGenrePacks
    // "1-A" group), at weights (6-4) that beat the generic 'oldpop' rule's
    // own max (5) so a decade word actually changes the recommendation
    // instead of being drowned out by it. Declared BEFORE the generic
    // 'oldpop' rule below (not just weighted higher) so rankFromRules'
    // stable sort also breaks any remaining weight ties in this rule's
    // favor — conceptAgent.ts's rankFromRules inserts matched rules' weights
    // into a Map in CONCEPT_KEYWORD_RULES declaration order, and its final
    // sort-by-score is stable, so declaration order alone decides ties.
    // Weight gap kept small (6 vs 5), not large, since a large
    // weight-gradient spread was measured to push a low-priority genre into
    // chooseGenreIds' real pool at exactly 1 song (see
    // tests/genreSingletonRootCause.test.ts's own doc comment on this exact
    // failure class; CONCEPT_KEYWORD_RULES feeds both conceptAgent.ts's
    // recommendation ranking AND setDirector.ts's real genre selection). The
    // "60\s*[-~]\s*70" pattern keeps firing this rule for the compound
    // "60~70년대" form too (a bare "60(s|년대)" pattern wouldn't match
    // "60~70년대" — "60" isn't directly followed by "s"/"년대" there) so this
    // rule and oldpop-70s both fire on that already-validated co-primary
    // compound input, same as before.
    id: 'oldpop-60s',
    patterns: [/60(s|년대)/i, /1960s/i, /60\s*[-~]\s*70/],
    genreWeights: {
      'oldpop-doowop-harmony': 6, 'oldpop-brill-building': 6, 'oldpop-girl-group-wall': 5,
      'oldpop-sunshine-pop': 5, 'oldpop-baroque-pop': 4, 'oldpop-british-beat': 4
    },
    moodWeights: { nostalgic: 2, warm: 1 }
  },
  {
    // 정합성 점검 §2 결함3 fix — same pattern as oldpop-60s, for the ten real
    // 1970s-bucket genres ("1-B" group). "70\s*[-~]\s*80" mirrors the 60~70
    // compound handling above, for a "70~80년대" style request.
    id: 'oldpop-70s',
    patterns: [/70(s|년대)/i, /1970s/i, /70\s*[-~]\s*80/],
    genreWeights: {
      'oldpop-soft-rock-am': 6, 'oldpop-motown-pop-soul': 6, 'oldpop-piano-ballad-70s': 5,
      'oldpop-philly-soul-sweet': 5, 'oldpop-close-harmony-duo': 4, 'oldpop-folk-rock-70s': 4,
      'oldpop-countrypolitan': 3, 'oldpop-yacht-west-coast': 3, 'oldpop-europop-glow': 2,
      'oldpop-orchestral-easy': 2
    },
    moodWeights: { nostalgic: 2, warm: 1 }
  },
  {
    // 정합성 점검 §2 결함3 fix — same pattern as oldpop-60s/70s, for the six
    // real 1980s-bucket genres ("1-C" group).
    id: 'oldpop-80s',
    patterns: [/80(s|년대)/i, /1980s/i],
    genreWeights: {
      'oldpop-adult-contemporary-80s': 6, 'oldpop-light-synth-pop-warm': 6, 'oldpop-quiet-storm-warm': 5,
      'oldpop-soft-duet-80s': 5, 'oldpop-orchestral-ballad-80s': 4, 'oldpop-standards-torch': 4
    },
    moodWeights: { nostalgic: 2, warm: 1 }
  },
  {
    // 정합성 점검 §2 결함3 fix — this rule used to also match any bare decade
    // word (60/70/80 + s/년대) and hand out this SAME fixed weight bundle no
    // matter which decade fired the match, so "60년대 올드팝" and "70년대
    // 올드팝" recommended byte-identical genres, and the 1950s-60s genres in
    // this bundle (weight 3) always lost buildGenrePool's targetSize-4
    // truncation to the 1970s/1980s entries (weight 4-5) — the real cause of
    // a "60년대" concept getting mostly 1970s genres. Decade words now route
    // to the three sibling rules above (oldpop-60s/70s/80s) instead. This
    // rule is now the decade-UNSPECIFIED fallback only — patterns and
    // weights otherwise unchanged from before this fix, so a bare
    // "올드팝"/"7080" request (no decade named) still resolves exactly as it
    // did.
    id: 'oldpop',
    patterns: [
      /올드\s*팝/, /옛날\s*팝/, /추억의\s*팝송/, /7080/, /칠공팔공/,
      /old\s*pop/i, /oldies/i
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
  },
  // TASK C2 (§7) — jp-2030 workspace rules. Same genreWeights-only
  // constraint as kr-2030 above (§7-1: no seasonWeights/moodWeights — those
  // aren't gated by a channel's core-genre tier, so they'd leak into
  // senior-morning scoring for the same Japanese/Korean input text). Both
  // Korean and Japanese script forms on every rule per this task's own
  // §7-2 "한국어·일본어 표기를 모두 넣으십시오" — 하루 may type either.
  {
    id: 'jp2030-way-home',
    patterns: [/帰り道/, /하교길/, /귀갓길/i, /放課後/, /방과\s*후/i, /after\s*school/i],
    genreWeights: { 'jp2030-melodic-jrock': 2, 'jp2030-heisei-nostalgia': 2 }
  },
  {
    id: 'jp2030-graduation-school',
    patterns: [/卒業/, /졸업/, /教室/, /교실/, /制服/, /교복/, /graduation/i],
    genreWeights: { 'jp2030-heisei-nostalgia': 4 }
  },
  {
    id: 'jp2030-summer-festival',
    patterns: [/夏祭り/, /여름\s*축제/, /花火/, /불꽃놀이/, /summer\s*festival/i, /fireworks/i],
    genreWeights: { 'jp2030-dance-vocal': 3, 'jp2030-kawaii-idol': 1 }
  },
  {
    id: 'jp2030-seasonal-bloom',
    patterns: [/桜/, /벚꽃/, /紅葉/, /단풍/],
    genreWeights: { 'jp2030-heisei-nostalgia': 2, 'jp2030-melodic-jrock': 1 }
  },
  {
    id: 'jp2030-reiwa-youth',
    patterns: [/令和/, /레이와/, /平成/, /헤이세이/, /青春/, /청춘/, /reiwa/i, /heisei/i],
    genreWeights: { 'jp2030-melodic-jrock': 3, 'jp2030-heisei-nostalgia': 2 }
  },
  // Format only, no specific title/studio/character name — see C1's own IP
  // avoidance principle, carried over here per this task's own §7-2 note.
  {
    id: 'jp2030-anime-opening',
    patterns: [/アニメ/, /애니(메이션)?/, /オープニング/, /오프닝/, /\banime\b/i, /opening\s*theme/i],
    genreWeights: { 'jp2030-anime-cinematic': 4 }
  },
  {
    id: 'jp2030-citypop',
    patterns: [/シティポップ/, /시티팝/, /ネオシティポップ/, /네오시티팝/, /city\s*pop/i, /東京/, /도쿄/, /\btokyo\b/i],
    genreWeights: { 'jp2030-neo-citypop': 4, 'jp2030-chill-neosoul': 1 }
  },
  {
    id: 'jp2030-convenience-transit',
    patterns: [/コンビニ/, /편의점/, /改札/, /개찰구/, /ホーム/, /플랫폼/i, /convenience\s*store/i],
    genreWeights: { 'jp2030-chill-neosoul': 2, 'jp2030-neo-citypop': 2 }
  },
  // v4.5-band(バンド)/'band' are deliberately narrower than a bare Korean
  // "밴드" would be — real check found "밴드" alone collides with B2's own
  // kr2030-after-work concept text ("퇴근 후 감성 밴드팝"), which would add
  // this rule to that concept's match set (a real cross-workspace concept-
  // matching regression, not just a genreWeights no-op). Japanese script
  // and the "泣きたい" (want to cry) phrase are specific enough on their own.
  {
    id: 'jp2030-band-emotional',
    patterns: [/バンド/, /泣きたい/, /울고\s*싶은\s*날/],
    genreWeights: { 'jp2030-melodic-jrock': 3, 'jp2030-heisei-nostalgia': 1 }
  },
  // TASK E1 §8 — kr-kids workspace's concept keywords. genreWeights only
  // (§8-1: no season/mood weights — these rules are about daily-life
  // scenarios, not calendar seasons), pointing only at krkids-* ids so a
  // match never affects senior/2030 scoring for the same input text.
  {
    id: 'krkids-daily-habit',
    patterns: [/양치/, /이\s*닦기/, /손\s*씻기/, /정리/, /밥\s*먹기/, /배변/, /brush(ing)?\s*teeth/i, /wash(ing)?\s*hands/i],
    genreWeights: { 'krkids-daily-habit': 4 }
  },
  {
    id: 'krkids-counting-color',
    patterns: [/숫자/, /세기/, /색깔/, /모양/, /도형/, /counting\s*song/i, /color(s)?\s*song/i],
    genreWeights: { 'krkids-counting-color': 4 }
  },
  {
    id: 'krkids-animal-vehicle',
    patterns: [/동물/, /공룡/, /버스/, /기차/, /굴착기/, /dinosaur/i, /excavator/i],
    genreWeights: { 'krkids-animal-vehicle': 4 }
  },
  {
    id: 'krkids-roleplay-story',
    patterns: [/역할\s*놀이/, /병원/, /소방서/, /마트/, /유치원/, /roleplay/i, /pretend\s*play/i],
    genreWeights: { 'krkids-roleplay-story': 4 }
  },
  {
    id: 'krkids-bilingual',
    patterns: [/영어/, /알파벳/, /이중\s*언어/, /bilingual\s*song/i, /english\s*learning\s*song/i],
    genreWeights: { 'krkids-bilingual': 4 }
  },
  {
    id: 'krkids-sleep-calm',
    patterns: [/자장가/, /낮잠/, /잠자기/, /마음\s*안정/, /lullaby/i, /nap\s*time/i],
    genreWeights: { 'krkids-sleep-calm': 4 }
  },
  {
    id: 'krkids-action',
    patterns: [/율동/, /체조/, /따라\s*하기/, /action\s*song/i, /clapping\s*game/i],
    genreWeights: { 'krkids-action': 4 }
  },
  // TASK F1 §9-1 — jp-kids workspace's concept keywords. genreWeights only,
  // pointing only at jpkids-* ids. §9-1's own explicit requirement: Korean
  // AND Japanese script forms on every rule (하루 may type either). A few
  // bare words below (체조/桜/雪/夏祭り) intentionally overlap with existing
  // krkids-action/jp2030-seasonal-bloom/winter/jp2030-summer-festival
  // patterns — expected multi-match, not a collision (genreWeights are
  // archetype-scoped at consumption; see docs/f1-report.md §13-1[11] for
  // the before/after comparison this task's own §9-1 asks for).
  {
    id: 'jpkids-teasobi',
    patterns: [/手遊び/, /てあそび/, /손\s*놀이/, /hand[- ]?play\s*song/i],
    genreWeights: { 'jpkids-teasobi': 4 }
  },
  {
    id: 'jpkids-taiso-dance',
    patterns: [/体操/, /たいそう/, /체조/, /kids\s*exercise\s*dance/i],
    genreWeights: { 'jpkids-taiso-dance': 4 }
  },
  {
    id: 'jpkids-onomatopoeia',
    patterns: [/オノマトペ/, /의성어/, /擬音語/, /擬態語/],
    genreWeights: { 'jpkids-onomatopoeia': 4 }
  },
  {
    id: 'jpkids-food-vehicle',
    patterns: [/たこやき/, /타코야키/, /食べ物/, /음식/, /バス/, /電車/, /버스/, /乗り物/],
    genreWeights: { 'jpkids-food-vehicle': 4 }
  },
  {
    id: 'jpkids-daily-habit',
    patterns: [/生活習慣/, /생활습관/, /잠옷/, /パジャマ/],
    genreWeights: { 'jpkids-daily-habit': 4 }
  },
  {
    // TASK F1 §9-1 — bare 눈(snow) excludes 첫눈("first snow") specifically:
    // G1's own L7 senior-concept regression check (scripts/isolationAudit.ts's
    // L7_SENIOR_CONCEPTS) uses "첫눈" as a real senior test string expected
    // to match only ['winter'] — a bare /눈/ pattern here would have added
    // this rule to that result, a genuine cross-workspace match G1 caught.
    id: 'jpkids-seasonal',
    patterns: [/夏祭り/, /여름\s*축제/, /桜/, /벚꽃/, /雪/, /(?<!첫)눈(?!치)/],
    genreWeights: { 'jpkids-seasonal': 4 }
  },
  {
    id: 'jpkids-english-learning',
    patterns: [/英語/, /영어/, /知育/, /bilingual\s*learning\s*song/i],
    genreWeights: { 'jpkids-english-learning': 4 }
  },
  // TASK K2 (§10-1) — kr-idol-male workspace rules. Same genreWeights-only
  // constraint as every other adult workspace above. "야간 도시"/"드라이브"
  // deliberately overlap with kr2030-dawn-night/kr2030-summer-drive's own
  // pattern words — safe by the same archetype-scoped-tier design those
  // rules already rely on (a kridol-* genre id is ignored for any channel
  // whose core tier doesn't include it, and vice versa); see K2's own report
  // for the required before/after concept-matching comparison this overlap
  // calls for (§10-1's own instruction).
  {
    id: 'kridol-stage-performance',
    patterns: [/무대/, /퍼포먼스/, /공연/, /stage/i, /performance/i],
    genreWeights: { 'kridol-performance-trap': 3, 'kridol-band-crossover': 3 }
  },
  {
    id: 'kridol-comeback-debut',
    patterns: [/컴백/, /데뷔/, /comeback/i, /\bdebut\b/i],
    genreWeights: { 'kridol-synth-dance': 3, 'kridol-band-crossover': 2 }
  },
  {
    id: 'kridol-confidence-challenge',
    patterns: [/자신감/, /확신/, /도전/, /한계/, /confidence/i],
    genreWeights: { 'kridol-performance-trap': 3, 'kridol-band-crossover': 2 }
  },
  {
    id: 'kridol-night-drive',
    patterns: [/야간\s*도시/, /드라이브/, /밤거리/, /night\s*drive/i],
    genreWeights: { 'kridol-synth-dance': 3, 'kridol-retro-funk': 2 }
  },
  {
    id: 'kridol-practice-room',
    patterns: [/연습실/, /연습생/, /practice\s*room/i],
    genreWeights: { 'kridol-midtempo-rnb': 2, 'kridol-emotional-ballad': 2 }
  },
  {
    id: 'kridol-rap-hiphop',
    patterns: [/랩/, /힙합/, /\brap\b/i, /hip-?hop/i],
    genreWeights: { 'kridol-performance-trap': 4 }
  },
  {
    id: 'kridol-dance-genre',
    patterns: [/댄스/, /\bdance\b/i],
    genreWeights: { 'kridol-synth-dance': 4 }
  },
  {
    id: 'kridol-ballad-genre',
    patterns: [/발라드/, /\bballad\b/i],
    genreWeights: { 'kridol-emotional-ballad': 4 }
  },
  {
    id: 'kridol-retro-funk-genre',
    patterns: [/레트로/, /훵크/, /\bretro\b/i, /\bfunk\b/i],
    genreWeights: { 'kridol-retro-funk': 4 }
  },
  {
    id: 'kridol-latin-genre',
    patterns: [/라틴/, /\blatin\b/i],
    genreWeights: { 'kridol-latin-afro': 4 }
  },
  // TASK K3 (§9-1) — kr-idol-female workspace rules. Genre-name patterns
  // (댄스/레트로/라틴/훵크) already have rules above from K2 — genres are
  // shared (§3-1), so those existing rules already serve kr-idol-female too
  // via the archetype-scoped-tier design; only K3's own axis (자신감·주도·
  // 선택·통쾌 / 친구·연대·나란히 / 낮의 도시·옥상·파티·계절 전환) needs new rules,
  // deliberately not reusing K2's own "무대·퍼포먼스·컴백" words.
  {
    id: 'krkidolf-confidence-choice',
    patterns: [/자신감/, /주도/, /통쾌/, /confidence/i],
    genreWeights: { 'kridol-synth-dance': 3, 'kridol-band-crossover': 2 }
  },
  {
    id: 'krkidolf-friends-solidarity',
    patterns: [/나란히/, /연대/, /친구들과/, /friends\s*together/i],
    genreWeights: { 'kridol-latin-afro': 3, 'kridol-synth-dance': 2 }
  },
  {
    id: 'krkidolf-daylight-rooftop',
    patterns: [/낮의\s*도시/, /옥상/, /daylight/i, /rooftop/i],
    genreWeights: { 'kridol-retro-funk': 3, 'kridol-latin-afro': 2 }
  },
  {
    id: 'krkidolf-after-party',
    patterns: [/파티/, /애프터파티/, /\bparty\b/i],
    genreWeights: { 'kridol-retro-funk': 3, 'kridol-band-crossover': 2 }
  },
  {
    id: 'krkidolf-season-turning',
    patterns: [/계절\s*전환/, /계절이\s*바뀌/, /season\s*turning/i],
    genreWeights: { 'kridol-emotional-ballad': 2, 'kridol-midtempo-rnb': 2 }
  }
];

export function matchConceptRules(freeText: string): KeywordRule[] {
  const text = freeText.trim();
  if (!text) return [];
  return CONCEPT_KEYWORD_RULES.filter(rule => rule.patterns.some(pattern => pattern.test(text)));
}
