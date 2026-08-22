/**
 * TASK H1 (v3.10) — local (no-API) keyword sceenario -> genre/mood/season
 * mapping for the concept agent (core/conceptAgent.ts). Pattern lists cover
 * Korean, English, and (partially) Japanese synonyms for the same everyday
 * scenario, since users describe songs in whichever language they think in.
 *
 * 지시문 69 — 이 파일은 한동안 "일본어까지 다 커버한다"고 주장했지만
 * 실측(scripts/checkConceptLanguageCoverage.ts) 결과 그렇지 않았다(당시
 * axis:'genre' 규칙의 일본어 보유율 0%). 일본어는 부분 커버이며, 현재
 * 커버리지는 `npm run check:concept-language`로 확인한다 — 이 주석을
 * 다시 "100% 다 된다"는 단언으로 되돌리지 말 것.
 *
 * Weights point at genre/mood/season ids from src/data/presets.ts. A genre
 * id that isn't in the requesting channel's core tier for its archetype is
 * simply ignored at scoring time (see conceptAgent.ts) — these rules are
 * shared across archetypes on purpose, so a single rule set doesn't need a
 * per-archetype copy.
 */

import type { ChannelArchetype } from '../types';

export interface KeywordRule {
  id: string;
  patterns: RegExp[];
  genreWeights?: Record<string, number>;
  moodWeights?: Record<string, number>;
  seasonWeights?: Record<string, number>;
  /**
   * 지시문 64 (TASK A-2) — genreWeights는 이미 워크스페이스별 장르 id
   * 네임스페이스(kr2030-, krkids-, kridol- 접두어 등)와 core tier 필터
   * (conceptAgent.ts의 rankFromRules — `if (!coreGenreIds.has(id)) continue`)
   * 로 사실상 워크스페이스별로 갈라져 있다(정합성 확인 결과 — 이 지시문
   * 자신의 §A-3 "구조 변경 범위 확인" 요구에 대한 답, 보고서 참고). 다만
   * moodWeights/seasonWeights는 그 필터를 안 거치므로(§B2 §7-2 자기
   * 주석 — 아키타입에 상관없이 그대로 누적) 그 둘까지 워크스페이스를
   * 벗어나지 않게 막으려면 별도 장치가 필요하다 — 특히 "동요에 성인
   * 상황 키워드를 매칭하지 말 것"을 정규식 설계에만 기대지 않고 구조로
   * 보장한다. 없으면 전체 워크스페이스에 유효(기존 75종 전부가 이 값이
   * 없다 — 하위 호환, 매칭 결과 불변).
   */
  archetypeScope?: ChannelArchetype[];
  /**
   * 지시문 67 (TASK A) — 'genre'는 이 규칙이 명시적 장르 정체성 키워드(예:
   * 재즈/소울/샹송)임을 표시한다. core/conceptAgent.ts의 rankFromRules가
   * genreWeights를 축('genre' vs 그 외 — 시대/장소/상황/무드 규칙은 전부
   * "그 외")으로 나눠 따로 랭킹하고, buildAxisAwareGenreAllocation이 axis:
   * 'genre' 매칭이 있을 때 그 장르군에 최소 배분(GENRE_AXIS_MIN_SHARE)을
   * 먼저 준다 — "70년대 재즈 감성"처럼 시대 키워드(oldpop-70s, weight 6)가
   * 장르 키워드(jazz, weight 3)보다 높아 같은 후보 풀에서 재즈를 완전히
   * 밀어내던 실측 결함(§1-3)의 구조적 수정. 없으면(대다수 규칙) 이
   * 규칙의 genreWeights는 전부 "인접" 축으로 취급된다 — 기존 동작과
   * 동일(§하지 말 것 "장르 키워드 매칭 없음 → 현재 동작 유지").
   */
  axis?: 'genre';
}

/**
 * 지시문 64 (TASK B-3/하지 말 것) — "동요에 성인 상황 키워드를 매칭하지
 * 말 것"을 구조로 보장한다. 'kids'/'kr-kids-song'/'jp-kids-song' 3종을
 * 제외한 나머지 전부.
 */
const ADULT_ARCHETYPES: ChannelArchetype[] = [
  'senior-morning', 'showa-cafe', 'christmas', 'lofi-study', 'showa-70s',
  'j2000s', 'modern-chill', 'city-night', 'oldpop-lounge',
  'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'kr-idol-female'
];

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
    patterns: [/샹송/, /chanson/i, /프랑스\s*음악/, /파리(지앵)?\s*감성/, /シャンソン/],
    genreWeights: { chanson: 4 },
    moodWeights: { elegant: 1, bittersweet: 1 },
    axis: 'genre'
  },
  {
    id: 'rnb-soul',
    patterns: [/알\s*앤\s*비/, /알앤비/, /r\s*&\s*n?b/i, /rhythm\s*and\s*blues/i, /리듬\s*앤\s*블루스/, /리듬앤블루스/, /소울\s*음악/, /\bsoul\b/i, /소울/, /ソウル/],
    genreWeights: {
      'oldpop-motown-pop-soul': 4, 'oldpop-philly-soul-sweet': 3, 'retro-soul-pop': 3, 'oldpop-quiet-storm-warm': 2
    },
    moodWeights: { warm: 1, romantic: 1 },
    axis: 'genre'
  },
  {
    id: 'bossa-nova',
    patterns: [/보사\s*노바/, /보사노바/, /\bbossa\b/i, /\b보사\b/, /ボサノヴァ/, /ボサノバ/],
    genreWeights: { 'bossa-cafe': 4 },
    moodWeights: { warm: 1 },
    axis: 'genre'
  },
  {
    // 지시문 53 (TASK C-4) — 실측: 이 룰이 향하는 jazz-pop/smooth-jazz-lounge는
    // good-morning-memory-radio 채널 자신의 preferredGenres에 없다(TASK v4.9가
    // 보컬 품질 불만으로 뺐다 — 위 채널 정의 주석 참고). 지시문20이 그
    // 자리에 넣은 실제 4종(jazz-classic-vocal-lounge·jazz-swing-crooner-
    // ballroom·jazz-brush-ballad-jazz·bossa-cafe) 중 3종이 이 룰에서 가중치
    // 0이었다 — "재즈" 컨셉을 넣어도 이 채널에서 쓰이는 재즈 장르는 하나도
    // 추천되지 않았다. 기존 3개(다른 채널이 쓸 수 있으니 유지)에 3종을
    // 더한다.
    id: 'jazz',
    patterns: [/재즈/, /\bjazz\b/i, /스무스\s*재즈/, /smooth\s*jazz/i, /ジャズ/],
    genreWeights: {
      'jazz-pop': 3, 'smooth-jazz-lounge': 3, 'oldpop-standards-torch': 2,
      'jazz-classic-vocal-lounge': 3, 'jazz-swing-crooner-ballroom': 2, 'jazz-brush-ballad-jazz': 2
    },
    moodWeights: { elegant: 1 },
    axis: 'genre'
  },
  {
    id: 'city-pop',
    patterns: [/시티\s*팝/, /시티팝/, /city\s*pop/i, /シティポップ/],
    genreWeights: { 'city-pop-soft': 4 },
    moodWeights: { nostalgic: 1 },
    axis: 'genre'
  },
  {
    id: 'folk',
    patterns: [/포크(\s*송)?/, /\bfolk\b/i, /folk\s*song/i, /フォーク/],
    genreWeights: { 'folk-pop': 4, 'oldpop-folk-rock-70s': 3 },
    moodWeights: { warm: 1 },
    axis: 'genre'
  },
  {
    id: 'ballad',
    patterns: [/발라드/, /\bballad\b/i, /バラード/],
    genreWeights: { 'piano-ballad': 3, 'healing-ballad': 3, 'oldpop-piano-ballad-70s': 3, 'oldpop-orchestral-ballad-80s': 2 },
    moodWeights: { bittersweet: 1 },
    axis: 'genre'
  },
  {
    id: 'disco',
    patterns: [/디스코/, /\bdisco\b/i, /ディスコ/],
    genreWeights: { 'oldpop-europop-glow': 3, 'oldpop-motown-pop-soul': 3 },
    moodWeights: { hopeful: 1 },
    axis: 'genre'
  },
  {
    id: 'country',
    patterns: [/컨트리/, /\bcountry\b/i, /カントリー/],
    genreWeights: { 'oldpop-countrypolitan': 4 },
    moodWeights: { warm: 1 },
    axis: 'genre'
  },
  {
    id: 'doo-wop',
    patterns: [/두\s*왑/, /두왑/, /doo[\s-]?wop/i, /ドゥーワップ/, /ドゥワップ/],
    genreWeights: { 'oldpop-doowop-harmony': 4 },
    moodWeights: { nostalgic: 1 },
    axis: 'genre'
  },
  {
    id: 'easy-listening',
    patterns: [/이지\s*리스닝/, /easy\s*listening/i, /イージーリスニング/],
    genreWeights: { 'oldpop-orchestral-easy': 4, 'smooth-jazz-lounge': 2 },
    moodWeights: { warm: 1 },
    axis: 'genre'
  },
  // 지시문 67 (TASK D) — check:concept-coverage 장르 표본 20개가 요구하는
  // 6개 장르 정체성 키워드에 매칭되는 규칙이 하나도 없었다(전수 확인) —
  // "모타운 사운드"/"필리 소울"/"60년대 브리티시 비트"/"70년대 소프트록"/
  // "가스펠 소울"/"올드스쿨 R&B" 전부 위 규칙들의 패턴에 걸리지 않는다.
  // 대상 id는 모두 senior-morning/oldpop-lounge 코어 티어에 실재한다
  // (getCoreGenreIdsForArchetype 실측 확인).
  {
    id: 'motown',
    patterns: [/모타운/, /motown/i, /モータウン/],
    genreWeights: { 'oldpop-motown-pop-soul': 4 },
    moodWeights: { warm: 1 },
    axis: 'genre'
  },
  {
    id: 'philly-soul',
    patterns: [/필리\s*소울/, /필라델피아\s*소울/, /philly\s*soul/i, /philadelphia\s*soul/i, /フィリーソウル/, /フィラデルフィアソウル/],
    genreWeights: { 'oldpop-philly-soul-sweet': 4 },
    moodWeights: { warm: 1, romantic: 1 },
    axis: 'genre'
  },
  {
    id: 'british-beat',
    patterns: [/브리티시\s*비트/, /영국\s*비트/, /british\s*beat/i, /british\s*invasion/i, /ブリティッシュビート/, /ブリティッシュインベイジョン/],
    genreWeights: { 'oldpop-british-beat': 4 },
    moodWeights: { hopeful: 1 },
    axis: 'genre'
  },
  {
    id: 'soft-rock',
    patterns: [/소프트\s*록/, /soft\s*rock/i, /ソフトロック/],
    genreWeights: { 'oldpop-soft-rock-am': 3, 'soft-rock': 3 },
    moodWeights: { warm: 1 },
    axis: 'genre'
  },
  {
    id: 'gospel-soul',
    patterns: [/가스펠/, /gospel/i, /ゴスペル/],
    genreWeights: { 'rnb-soulful-gospel-warmth': 3, 'rnb-gospel-soul-lift': 3 },
    moodWeights: { hopeful: 1, warm: 1 },
    axis: 'genre'
  },
  {
    id: 'old-school-rnb',
    patterns: [/올드스쿨\s*(r\s*&?\s*n?b|알앤비)/i, /old[\s-]?school\s*r\s*&?\s*n?b/i, /オールドスクール\s*r\s*&?\s*n?b/i],
    genreWeights: { 'rnb-old-school-romance-rnb': 4 },
    moodWeights: { nostalgic: 1, warm: 1 },
    axis: 'genre'
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
  /**
   * 지시문 53 (TASK C) — 실측: "아침"이라는 단어를 매칭하는 규칙이 이
   * 파일 전체에 하나도 없었다(§C-1 원인 특정 — 무드 매칭도 시대 바닥도
   * 아니라 컨셉 키워드 자체의 공백이었다). good-morning-memory-radio
   * 채널 자신의 정체성이 "아침 커피"인데 그 채널 컨셉 표본의 "아침"이
   * warm-gentle 룰의 "따뜻한 멜로디" 같은 복합구에도 안 걸려
   * oldpop-warm-morning-glow(하루의 95점 조합 4종 중 하나)가 0회였다.
   * warm-gentle은 "복합구만 매칭"을 의도적으로 유지한 룰(§주석 참고)이라
   * 그대로 두고, "아침" 전용 룰을 새로 추가한다.
   */
  {
    // 지시문 53 (TASK C) 재조정 — 최초안(4개 장르 가중치)이 acoustic-pop·
    // folk-pop을 통해 oldpop-lounge의 활용률을 50%->38%로 떨어뜨렸다
    // (OLDPOP_LOUNGE_CORE_GENRE_IDS가 senior-morning의 oldpop-* 전부와
    // acoustic-pop/folk-pop을 그대로 상속 — 같은 후보 풀 경쟁, §하지
    // 말 것 "지시문 51의 활용률 개선을 되돌리지 말 것" 위반). 목표
    // 자체(warm-morning-glow 최소 1회)에 필요한 건 이 한 장르뿐이므로
    // 나머지를 빼 풀 경쟁을 최소화한다.
    id: 'morning',
    patterns: [/아침/, /모닝/, /출근길/, /기상(?!청)/, /눈\s*뜨/, /morning/i, /wake[- ]?up/i, /朝/],
    genreWeights: { 'oldpop-warm-morning-glow': 5 },
    moodWeights: { warm: 1, hopeful: 1 }
  },
  // TASK B2 (§7) — kr-2030 workspace rules. genreWeights only, per this
  // task's own §7-2 constraint: seasonWeights/moodWeights aren't gated by a
  // channel's core-genre tier the way genreWeights is (see this file's own
  // module doc comment on that filtering), so adding those here would leak
  // into senior-morning scoring for the same input text. A kr2030-* genre id
  // is simply ignored at scoring time for any channel whose archetype's core
  // tier doesn't include it — see conceptAgent.ts.
  // 지시문 64 (TASK B) — 실측: matchConceptRules 자체는 genre id 필터 덕에
  // 항상 안전했지만, 그 사실과 무관하게 이 규칙들이 archetypeScope 없이
  // "매칭됐다"는 사실 자체는 남아 ConceptAgentPanel.tsx의 "해석: ..." 표시가
  // 동요 화면에 "퇴근"류 성인 상황 문구를 그대로 보여주는 실제 결함으로
  // 이어졌다. 이제 archetypeScope를 명시해 매칭 단계에서부터 막는다.
  {
    id: 'kr2030-after-work',
    patterns: [/퇴근/, /야근/, /회사원/, /월요일/, /after\s*work/i],
    genreWeights: { 'kr2030-emo-band-pop': 4, 'kr2030-dawn-rnb': 1 },
    archetypeScope: ['kr-2030-pop']
  },
  {
    id: 'kr2030-dawn-night',
    patterns: [/새벽/, /막차/, /지하철/, /밤거리/, /late\s*night/i],
    genreWeights: { 'kr2030-dawn-rnb': 4, 'kr2030-electro-pop': 1 },
    archetypeScope: ['kr-2030-pop']
  },
  {
    id: 'kr2030-thirty-something',
    patterns: [/서른/, /스물아홉/, /삼십대/, /이십대\s*후반/, /turning\s*thirty/i],
    genreWeights: { 'kr2030-ost-ballad': 4, 'kr2030-acoustic-folk': 2 },
    archetypeScope: ['kr-2030-pop']
  },
  {
    id: 'kr2030-studio-seoul',
    patterns: [/원룸/, /자취/, /골목/, /서울/, /studio\s*apartment/i],
    genreWeights: { 'kr2030-acoustic-folk': 3, 'kr2030-dawn-rnb': 2 },
    archetypeScope: ['kr-2030-pop']
  },
  {
    id: 'kr2030-y2k-nostalgia',
    patterns: [/싸이월드/, /엠피쓰리/, /\bmp3\b/i, /y2k/i, /2000년대/, /이천년대/],
    genreWeights: { 'kr2030-y2k-retro': 4 },
    archetypeScope: ['kr-2030-pop']
  },
  {
    id: 'kr2030-summer-drive',
    patterns: [/드라이브/, /여름\s*밤/, /summer\s*night\s*drive/i],
    genreWeights: { 'kr2030-y2k-retro': 2, 'kr2030-emo-band-pop': 2 },
    archetypeScope: ['kr-2030-pop']
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
    genreWeights: { 'jp2030-melodic-jrock': 2, 'jp2030-heisei-nostalgia': 2 },
    archetypeScope: ['jp-2030-pop']
  },
  {
    id: 'jp2030-graduation-school',
    patterns: [/卒業/, /졸업/, /教室/, /교실/, /制服/, /교복/, /graduation/i],
    genreWeights: { 'jp2030-heisei-nostalgia': 4 },
    archetypeScope: ['jp-2030-pop']
  },
  {
    id: 'jp2030-summer-festival',
    patterns: [/夏祭り/, /여름\s*축제/, /花火/, /불꽃놀이/, /summer\s*festival/i, /fireworks/i],
    genreWeights: { 'jp2030-dance-vocal': 3, 'jp2030-kawaii-idol': 1 },
    archetypeScope: ['jp-2030-pop']
  },
  {
    id: 'jp2030-seasonal-bloom',
    patterns: [/桜/, /벚꽃/, /紅葉/, /단풍/],
    genreWeights: { 'jp2030-heisei-nostalgia': 2, 'jp2030-melodic-jrock': 1 },
    archetypeScope: ['jp-2030-pop']
  },
  {
    id: 'jp2030-reiwa-youth',
    patterns: [/令和/, /레이와/, /平成/, /헤이세이/, /青春/, /청춘/, /reiwa/i, /heisei/i],
    genreWeights: { 'jp2030-melodic-jrock': 3, 'jp2030-heisei-nostalgia': 2 },
    archetypeScope: ['jp-2030-pop']
  },
  // Format only, no specific title/studio/character name — see C1's own IP
  // avoidance principle, carried over here per this task's own §7-2 note.
  {
    id: 'jp2030-anime-opening',
    patterns: [/アニメ/, /애니(메이션)?/, /オープニング/, /오프닝/, /\banime\b/i, /opening\s*theme/i],
    genreWeights: { 'jp2030-anime-cinematic': 4 },
    archetypeScope: ['jp-2030-pop']
  },
  {
    id: 'jp2030-citypop',
    patterns: [/シティポップ/, /시티팝/, /ネオシティポップ/, /네오시티팝/, /city\s*pop/i, /東京/, /도쿄/, /\btokyo\b/i],
    genreWeights: { 'jp2030-neo-citypop': 4, 'jp2030-chill-neosoul': 1 },
    archetypeScope: ['jp-2030-pop']
  },
  {
    id: 'jp2030-convenience-transit',
    patterns: [/コンビニ/, /편의점/, /改札/, /개찰구/, /ホーム/, /플랫폼/i, /convenience\s*store/i],
    genreWeights: { 'jp2030-chill-neosoul': 2, 'jp2030-neo-citypop': 2 },
    archetypeScope: ['jp-2030-pop']
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
    genreWeights: { 'jp2030-melodic-jrock': 3, 'jp2030-heisei-nostalgia': 1 },
    archetypeScope: ['jp-2030-pop']
  },
  // TASK E1 §8 — kr-kids workspace's concept keywords. genreWeights only
  // (§8-1: no season/mood weights — these rules are about daily-life
  // scenarios, not calendar seasons), pointing only at krkids-* ids so a
  // match never affects senior/2030 scoring for the same input text.
  {
    id: 'krkids-daily-habit',
    // 지시문 64 (TASK C) — 실측: "손 씻고 이 닦는 시간"이 하나도 안 걸렸다
    // ("이\s*닦기"/"손\s*씻기"는 활용형(닦는/씻고)까지 포함하지 못했다).
    // 어간만 잡고 어미는 열어 둔다.
    patterns: [/양치/, /이\s*닦/, /손\s*씻/, /정리/, /밥\s*먹기/, /배변/, /brush(ing)?\s*teeth/i, /wash(ing)?\s*hands/i],
    genreWeights: { 'krkids-daily-habit': 4 },
    archetypeScope: ['kids', 'kr-kids-song']
  },
  {
    id: 'krkids-counting-color',
    patterns: [/숫자/, /세기/, /색깔/, /모양/, /도형/, /counting\s*song/i, /color(s)?\s*song/i],
    genreWeights: { 'krkids-counting-color': 4 },
    archetypeScope: ['kids', 'kr-kids-song']
  },
  {
    id: 'krkids-animal-vehicle',
    patterns: [/동물/, /공룡/, /버스/, /기차/, /굴착기/, /dinosaur/i, /excavator/i],
    genreWeights: { 'krkids-animal-vehicle': 4 },
    archetypeScope: ['kids', 'kr-kids-song']
  },
  {
    id: 'krkids-roleplay-story',
    patterns: [/역할\s*놀이/, /병원/, /소방서/, /마트/, /유치원/, /roleplay/i, /pretend\s*play/i],
    genreWeights: { 'krkids-roleplay-story': 4 },
    archetypeScope: ['kids', 'kr-kids-song']
  },
  {
    id: 'krkids-bilingual',
    patterns: [/영어/, /알파벳/, /이중\s*언어/, /bilingual\s*song/i, /english\s*learning\s*song/i],
    genreWeights: { 'krkids-bilingual': 4 },
    archetypeScope: ['kids', 'kr-kids-song']
  },
  {
    id: 'krkids-sleep-calm',
    patterns: [/자장가/, /낮잠/, /잠자기/, /마음\s*안정/, /lullaby/i, /nap\s*time/i],
    genreWeights: { 'krkids-sleep-calm': 4 },
    archetypeScope: ['kids', 'kr-kids-song']
  },
  {
    id: 'krkids-action',
    patterns: [/율동/, /체조/, /따라\s*하기/, /action\s*song/i, /clapping\s*game/i],
    genreWeights: { 'krkids-action': 4 },
    archetypeScope: ['kids', 'kr-kids-song']
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
    genreWeights: { 'jpkids-teasobi': 4 },
    archetypeScope: ['kids', 'jp-kids-song']
  },
  {
    id: 'jpkids-taiso-dance',
    patterns: [/体操/, /たいそう/, /체조/, /kids\s*exercise\s*dance/i],
    genreWeights: { 'jpkids-taiso-dance': 4 },
    archetypeScope: ['kids', 'jp-kids-song']
  },
  {
    id: 'jpkids-onomatopoeia',
    patterns: [/オノマトペ/, /의성어/, /擬音語/, /擬態語/],
    genreWeights: { 'jpkids-onomatopoeia': 4 },
    archetypeScope: ['kids', 'jp-kids-song']
  },
  {
    id: 'jpkids-food-vehicle',
    patterns: [/たこやき/, /타코야키/, /食べ物/, /음식/, /バス/, /電車/, /버스/, /乗り物/],
    genreWeights: { 'jpkids-food-vehicle': 4 },
    archetypeScope: ['kids', 'jp-kids-song']
  },
  {
    id: 'jpkids-daily-habit',
    patterns: [/生活習慣/, /생활습관/, /잠옷/, /パジャマ/],
    genreWeights: { 'jpkids-daily-habit': 4 },
    archetypeScope: ['kids', 'jp-kids-song']
  },
  {
    // TASK F1 §9-1 — bare 눈(snow) excludes 첫눈("first snow") specifically:
    // G1's own L7 senior-concept regression check (scripts/isolationAudit.ts's
    // L7_SENIOR_CONCEPTS) uses "첫눈" as a real senior test string expected
    // to match only ['winter'] — a bare /눈/ pattern here would have added
    // this rule to that result, a genuine cross-workspace match G1 caught.
    id: 'jpkids-seasonal',
    patterns: [/夏祭り/, /여름\s*축제/, /桜/, /벚꽃/, /雪/, /(?<!첫)눈(?!치)/],
    genreWeights: { 'jpkids-seasonal': 4 },
    archetypeScope: ['kids', 'jp-kids-song']
  },
  {
    id: 'jpkids-english-learning',
    patterns: [/英語/, /영어/, /知育/, /bilingual\s*learning\s*song/i],
    genreWeights: { 'jpkids-english-learning': 4 },
    archetypeScope: ['kids', 'jp-kids-song']
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
    genreWeights: { 'kridol-performance-trap': 3, 'kridol-band-crossover': 3 },
    archetypeScope: ['kr-idol-male', 'kr-idol-female']
  },
  {
    id: 'kridol-comeback-debut',
    patterns: [/컴백/, /데뷔/, /comeback/i, /\bdebut\b/i],
    genreWeights: { 'kridol-synth-dance': 3, 'kridol-band-crossover': 2 },
    archetypeScope: ['kr-idol-male', 'kr-idol-female']
  },
  {
    id: 'kridol-confidence-challenge',
    patterns: [/자신감/, /확신/, /도전/, /한계/, /confidence/i],
    genreWeights: { 'kridol-performance-trap': 3, 'kridol-band-crossover': 2 },
    archetypeScope: ['kr-idol-male', 'kr-idol-female']
  },
  {
    id: 'kridol-night-drive',
    patterns: [/야간\s*도시/, /드라이브/, /밤거리/, /night\s*drive/i],
    genreWeights: { 'kridol-synth-dance': 3, 'kridol-retro-funk': 2 },
    archetypeScope: ['kr-idol-male', 'kr-idol-female']
  },
  {
    id: 'kridol-practice-room',
    patterns: [/연습실/, /연습생/, /practice\s*room/i],
    genreWeights: { 'kridol-midtempo-rnb': 2, 'kridol-emotional-ballad': 2 },
    archetypeScope: ['kr-idol-male', 'kr-idol-female']
  },
  {
    id: 'kridol-rap-hiphop',
    patterns: [/랩/, /힙합/, /\brap\b/i, /hip-?hop/i],
    genreWeights: { 'kridol-performance-trap': 4 },
    archetypeScope: ['kr-idol-male', 'kr-idol-female']
  },
  {
    id: 'kridol-dance-genre',
    patterns: [/댄스/, /\bdance\b/i],
    genreWeights: { 'kridol-synth-dance': 4 },
    archetypeScope: ['kr-idol-male', 'kr-idol-female']
  },
  {
    id: 'kridol-ballad-genre',
    patterns: [/발라드/, /\bballad\b/i],
    genreWeights: { 'kridol-emotional-ballad': 4 },
    archetypeScope: ['kr-idol-male', 'kr-idol-female']
  },
  {
    id: 'kridol-retro-funk-genre',
    patterns: [/레트로/, /훵크/, /\bretro\b/i, /\bfunk\b/i],
    genreWeights: { 'kridol-retro-funk': 4 },
    archetypeScope: ['kr-idol-male', 'kr-idol-female']
  },
  {
    id: 'kridol-latin-genre',
    patterns: [/라틴/, /\blatin\b/i],
    genreWeights: { 'kridol-latin-afro': 4 },
    archetypeScope: ['kr-idol-male', 'kr-idol-female']
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
    genreWeights: { 'kridol-synth-dance': 3, 'kridol-band-crossover': 2 },
    archetypeScope: ['kr-idol-female']
  },
  {
    id: 'krkidolf-friends-solidarity',
    patterns: [/나란히/, /연대/, /친구들과/, /friends\s*together/i],
    genreWeights: { 'kridol-latin-afro': 3, 'kridol-synth-dance': 2 },
    archetypeScope: ['kr-idol-female']
  },
  {
    id: 'krkidolf-daylight-rooftop',
    patterns: [/낮의\s*도시/, /옥상/, /daylight/i, /rooftop/i],
    genreWeights: { 'kridol-retro-funk': 3, 'kridol-latin-afro': 2 },
    archetypeScope: ['kr-idol-female']
  },
  {
    id: 'krkidolf-after-party',
    patterns: [/파티/, /애프터파티/, /\bparty\b/i],
    genreWeights: { 'kridol-retro-funk': 3, 'kridol-band-crossover': 2 },
    archetypeScope: ['kr-idol-female']
  },
  {
    id: 'krkidolf-season-turning',
    patterns: [/계절\s*전환/, /계절이\s*바뀌/, /season\s*turning/i],
    genreWeights: { 'kridol-emotional-ballad': 2, 'kridol-midtempo-rnb': 2 },
    archetypeScope: ['kr-idol-female']
  },

  // ===========================================================================
  // 지시문 64 (TASK A) — 자연어 컨셉 -> 장르 매칭 100%. §1-3 실측: 시니어는
  // 계절·장르명 위주 키워드만 있고 장소·상황·시간 키워드가 거의 없었다
  // (75종 중 시니어·공통 31종은 대부분 계절/장르명, 2030·동요·K-pop
  // 44종은 그 워크스페이스 전용). 아래 네 축(장소·시간·상황·정서)을
  // 더한다. moodWeights/seasonWeights는 archetypeScope로 걸러지지 않으므로
  // (§KeywordRule.archetypeScope 자기 doc comment) 성인 전용 상황
  // 키워드에는 ADULT_ARCHETYPES를 명시해 동요에 새지 않게 한다.
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // 장소 (A-4) — 42종
  // ---------------------------------------------------------------------------
  {
    id: 'place-bus',
    patterns: [/버스/, /시내버스/, /좌석버스/, /\bbus\b/i],
    genreWeights: { 'oldpop-evening-lamp-ballad': 3, 'smooth-jazz-lounge': 2, 'oldpop-quiet-storm-warm': 2 }
  },
  // 지시문 64 (TASK D-1) — "퇴근길 버스에서 창밖" 인수 기준: 같은 문장이
  // 워크스페이스마다 다른 장르로 갈라져야 한다. place-bus(위, 시니어
  // 이디어 이미 포함)에 이어 2030·아이돌 전용 자매 규칙을 archetypeScope로
  // 명시해 절대 다른 워크스페이스로 새지 않게 한다.
  {
    id: 'place-bus-kr2030',
    patterns: [/버스/, /\bbus\b/i],
    genreWeights: { 'kr2030-dawn-rnb': 3, 'kr2030-lofi-swing-hiphop': 2 },
    archetypeScope: ['kr-2030-pop']
  },
  {
    id: 'place-bus-kridol',
    patterns: [/버스/, /\bbus\b/i],
    genreWeights: { 'kridol-emotional-ballad': 3, 'kridol-midtempo-rnb': 2 },
    archetypeScope: ['kr-idol-male', 'kr-idol-female']
  },
  {
    id: 'place-subway',
    patterns: [/지하철/, /전철/, /지하철역/, /\bsubway\b/i],
    genreWeights: { 'oldpop-quiet-storm-warm': 3, 'jazz-classic-vocal-lounge': 2 }
  },
  {
    id: 'place-train',
    patterns: [/기차/, /열차/, /\btrain\b/i],
    genreWeights: { 'oldpop-countrypolitan': 3, 'oldpop-folk-rock-70s': 2 }
  },
  {
    id: 'place-station',
    patterns: [/정류장/, /플랫폼/, /station/i, /(기차|지하철|버스)\s*역/],
    genreWeights: { 'smooth-jazz-lounge': 2, 'oldpop-evening-lamp-ballad': 2 }
  },
  {
    id: 'place-alley',
    patterns: [/골목길/, /골목/, /\balley\b/i],
    genreWeights: { 'oldpop-hearth-acoustic': 3, 'folk-pop': 2 }
  },
  {
    id: 'place-market',
    patterns: [/재래시장/, /시장/, /\bmarket\b/i],
    genreWeights: { 'oldpop-motown-pop-soul': 2, 'retro-soul-pop': 2 }
  },
  {
    id: 'place-theater',
    patterns: [/영화관/, /극장/, /\btheater\b/i, /\btheatre\b/i],
    genreWeights: { 'oldpop-standards-torch': 3, 'jazz-swing-crooner-ballroom': 2 }
  },
  {
    id: 'place-park',
    patterns: [/공원/, /\bpark\b/i],
    genreWeights: { 'oldpop-sunlit-strings-pop': 3, 'acoustic-pop': 2 }
  },
  {
    id: 'place-beach',
    patterns: [/바닷가/, /해변/, /\bbeach\b/i],
    genreWeights: { 'bossa-cafe': 3, 'oldpop-yacht-west-coast': 2 }
  },
  {
    id: 'place-riverside',
    patterns: [/강변/, /강가/, /한강/, /riverside/i],
    genreWeights: { 'oldpop-sunlit-strings-pop': 2, 'folk-pop': 2 }
  },
  {
    id: 'place-rooftop',
    patterns: [/옥상/, /\brooftop\b/i],
    genreWeights: { 'city-pop-soft': 2, 'oldpop-light-synth-pop-warm': 2 }
  },
  {
    id: 'place-bridge',
    patterns: [/다리\s*위/, /다리\s*아래/, /\bbridge\b/i],
    genreWeights: { chanson: 2, 'oldpop-night-chanson': 2 }
  },
  {
    id: 'place-kitchen',
    patterns: [/부엌/, /주방/, /\bkitchen\b/i],
    genreWeights: { 'oldpop-hearth-acoustic': 3, 'oldpop-warm-morning-glow': 2 }
  },
  {
    id: 'place-living-room',
    patterns: [/거실/, /living\s*room/i],
    genreWeights: { 'oldpop-gentle-lullaby-pop': 2, 'healing-ballad': 2 }
  },
  {
    id: 'place-bedroom',
    patterns: [/침실/, /\bbedroom\b/i],
    genreWeights: { 'oldpop-slow-waltz-memory': 2, 'piano-ballad': 2 }
  },
  // 지시문 64 (TASK A-4) — "창밖은 이동 중의 시선이고, 창가는 머무는
  // 자리다" — cafe 룰의 "창가"와 의도적으로 다른 단어를 쓴다.
  {
    id: 'place-window-outside',
    patterns: [/창밖/, /차창\s*밖/, /window\s*outside/i],
    genreWeights: { 'oldpop-evening-lamp-ballad': 3, 'smooth-jazz-lounge': 2, 'oldpop-quiet-storm-warm': 1 }
  },
  {
    id: 'place-veranda',
    patterns: [/베란다/, /발코니/, /\bveranda\b/i, /\bbalcony\b/i],
    genreWeights: { 'oldpop-sunlit-strings-pop': 2, 'acoustic-pop': 1 }
  },
  {
    id: 'place-stairs',
    patterns: [/계단/, /\bstairs\b/i],
    genreWeights: { 'oldpop-hearth-acoustic': 2, 'folk-pop': 1 }
  },
  {
    id: 'place-hospital',
    patterns: [/병원/, /\bhospital\b/i],
    genreWeights: { 'healing-ballad': 3, 'piano-ballad': 2 }
  },
  {
    id: 'place-school',
    patterns: [/교정/, /학교/, /\bschool\b/i],
    genreWeights: { 'oldpop-sunshine-pop': 2, 'folk-pop': 2 }
  },
  {
    id: 'place-bookstore',
    patterns: [/서점/, /책방/, /bookstore/i],
    genreWeights: { chanson: 2, 'oldpop-standards-torch': 2 }
  },
  {
    id: 'place-library',
    patterns: [/도서관/, /\blibrary\b/i],
    genreWeights: { 'jazz-classic-vocal-lounge': 2, 'smooth-jazz-lounge': 1 }
  },
  {
    id: 'place-playground',
    patterns: [/놀이터/, /playground/i],
    genreWeights: { 'oldpop-sunshine-pop': 2, 'folk-pop': 1 }
  },
  {
    id: 'place-post-office',
    patterns: [/우체국/, /post\s*office/i],
    genreWeights: { chanson: 2, 'oldpop-close-harmony-duo': 1 }
  },
  {
    id: 'place-bathhouse',
    patterns: [/대중목욕탕/, /목욕탕/, /찜질방/],
    genreWeights: { 'oldpop-warm-morning-glow': 2, 'oldpop-hearth-acoustic': 1 }
  },
  {
    id: 'place-barbershop',
    patterns: [/이발소/, /미용실/, /barbershop/i],
    genreWeights: { 'oldpop-motown-pop-soul': 2, 'retro-soul-pop': 1 }
  },
  {
    id: 'place-teahouse',
    patterns: [/다방/],
    genreWeights: { chanson: 3, 'oldpop-night-chanson': 2, 'jazz-classic-vocal-lounge': 1 }
  },
  {
    id: 'place-inn',
    patterns: [/여관/, /\bmotel\b/i],
    genreWeights: { 'oldpop-rainy-ballad-blues': 2, 'oldpop-night-chanson': 2 }
  },
  {
    id: 'place-dormitory',
    patterns: [/기숙사/, /dormitory/i],
    genreWeights: { 'folk-pop': 2, 'acoustic-pop': 1 }
  },
  {
    id: 'place-office',
    patterns: [/사무실/, /\boffice\b/i],
    genreWeights: { 'smooth-jazz-lounge': 2, 'oldpop-quiet-storm-warm': 1 }
  },
  {
    id: 'place-factory',
    patterns: [/공장/, /\bfactory\b/i],
    genreWeights: { 'oldpop-motown-pop-soul': 2, 'retro-soul-pop': 1 }
  },
  {
    id: 'place-harbor',
    patterns: [/항구/, /부두/, /\bharbor\b/i],
    genreWeights: { 'bossa-cafe': 2, 'oldpop-yacht-west-coast': 2 }
  },
  {
    id: 'place-lighthouse',
    patterns: [/등대/, /lighthouse/i],
    genreWeights: { chanson: 2, 'oldpop-night-chanson': 1 }
  },
  {
    id: 'place-mountain-trail',
    patterns: [/등산로/, /산길/, /산책로/],
    genreWeights: { 'folk-pop': 2, 'oldpop-countrypolitan': 1 }
  },
  {
    id: 'place-amusement-park',
    patterns: [/놀이공원/, /amusement\s*park/i],
    genreWeights: { 'oldpop-sunshine-pop': 2, 'oldpop-europop-glow': 1 }
  },
  {
    id: 'place-temple',
    patterns: [/절에\s*가/, /사찰/, /\btemple\b/i],
    genreWeights: { 'oldpop-hearth-acoustic': 2, 'folk-pop': 1 }
  },
  {
    id: 'place-church',
    patterns: [/교회/, /성당/, /\bchurch\b/i],
    genreWeights: { 'piano-ballad': 2, 'healing-ballad': 1 }
  },
  {
    id: 'place-hometown-house',
    patterns: [/고향집/, /시골집/, /옛집/],
    genreWeights: { 'oldpop-warm-morning-glow': 3, 'folk-pop': 2, 'oldpop-hearth-acoustic': 1 },
    moodWeights: { nostalgic: 1 }
  },
  {
    id: 'place-neighborhood',
    patterns: [/동네/, /neighborhood/i],
    genreWeights: { 'oldpop-hearth-acoustic': 2, 'folk-pop': 1 }
  },
  {
    id: 'place-garden-yard',
    patterns: [/마당/, /\bgarden\b/i, /\byard\b/i],
    genreWeights: { 'oldpop-warm-morning-glow': 2, 'acoustic-pop': 1 }
  },

  // ---------------------------------------------------------------------------
  // 시간 (A-4) — 30종. seasonWeights를 절대 쓰지 않는다(§B-3, §하지 말 것
  // "시간 키워드를 계절로 해석하지 말 것") — 계절 오배정의 실제 원인은
  // regex 오매칭이 아니라 core/conceptAgent.ts의 폴백이었고(§보고서 원인
  // 분석), 이 축 자체는 애초에 계절과 무관하게 설계한다.
  // ---------------------------------------------------------------------------
  {
    id: 'time-dawn',
    patterns: [/새벽/, /동틀\s*무렵/, /\bdawn\b/i],
    genreWeights: { 'oldpop-quiet-storm-warm': 2, 'smooth-jazz-lounge': 1 }
  },
  {
    id: 'time-early-morning',
    patterns: [/이른\s*아침/],
    genreWeights: { 'oldpop-warm-morning-glow': 2 }
  },
  {
    id: 'time-noon',
    patterns: [/정오/, /한낮/, /\bnoon\b/i],
    genreWeights: { 'folk-pop': 1, 'acoustic-pop': 1 }
  },
  {
    id: 'time-afternoon',
    patterns: [/오후/, /\bafternoon\b/i],
    genreWeights: { 'oldpop-sunlit-strings-pop': 2, 'acoustic-pop': 1 }
  },
  {
    id: 'time-dusk',
    patterns: [/해질녘/, /노을/, /황혼/, /땅거미/, /\bdusk\b/i, /sunset/i],
    genreWeights: { 'oldpop-evening-lamp-ballad': 3, chanson: 1 }
  },
  {
    id: 'time-evening',
    patterns: [/저녁/, /\bevening\b/i],
    genreWeights: { 'oldpop-evening-lamp-ballad': 2, 'smooth-jazz-lounge': 2 }
  },
  // 지시문 64 (TASK D-3) — "'밤'이 계절로 해석됐다"는 §1-2의 실측 원인이
  // 정규식 충돌이 아니라 계절 폴백 자체였음을 확인했다(보고서 §원인
  // 분석). 이 룰은 순수 시간 축이고 seasonWeights가 없다.
  {
    id: 'time-night',
    patterns: [/밤/, /\bnight\b/i],
    genreWeights: { 'oldpop-quiet-storm-warm': 2, 'oldpop-night-chanson': 2, 'smooth-jazz-lounge': 1 }
  },
  {
    id: 'time-midnight',
    patterns: [/한밤중/, /한밤/, /자정/, /\bmidnight\b/i],
    genreWeights: { 'oldpop-night-chanson': 2, 'oldpop-rainy-ballad-blues': 1 }
  },
  {
    id: 'time-weekend',
    patterns: [/주말/, /\bweekend\b/i],
    genreWeights: { 'folk-pop': 1, 'acoustic-pop': 1 }
  },
  {
    id: 'time-monday',
    patterns: [/월요일/, /\bmonday\b/i],
    genreWeights: { 'oldpop-quiet-storm-warm': 1 }
  },
  {
    id: 'time-tuesday',
    patterns: [/화요일/, /\btuesday\b/i],
    genreWeights: { 'folk-pop': 1 }
  },
  {
    id: 'time-wednesday',
    patterns: [/수요일/, /\bwednesday\b/i],
    genreWeights: { 'folk-pop': 1 }
  },
  {
    id: 'time-thursday',
    patterns: [/목요일/, /\bthursday\b/i],
    genreWeights: { 'folk-pop': 1 }
  },
  {
    id: 'time-friday',
    patterns: [/금요일/, /\bfriday\b/i],
    genreWeights: { 'city-pop-soft': 1, 'oldpop-europop-glow': 1 }
  },
  {
    id: 'time-saturday',
    patterns: [/토요일/, /\bsaturday\b/i],
    genreWeights: { 'folk-pop': 1 }
  },
  {
    id: 'time-sunday',
    patterns: [/일요일/, /\bsunday\b/i],
    genreWeights: { 'healing-ballad': 1, 'piano-ballad': 1 }
  },
  {
    id: 'time-first-day',
    patterns: [/첫날/, /시작하는\s*날/],
    genreWeights: { 'oldpop-sunshine-pop': 2 }
  },
  {
    id: 'time-birthday',
    patterns: [/생일/, /\bbirthday\b/i],
    genreWeights: { 'oldpop-sunshine-pop': 1, 'folk-pop': 1 }
  },
  {
    id: 'time-lunch-time',
    patterns: [/점심시간/, /점심때/, /lunch\s*time/i],
    genreWeights: { 'acoustic-pop': 1 }
  },
  {
    id: 'time-rush-hour',
    patterns: [/출퇴근\s*시간/, /러시아워/, /rush\s*hour/i],
    genreWeights: { 'oldpop-quiet-storm-warm': 1 }
  },
  {
    id: 'time-teatime',
    patterns: [/티타임/, /차\s*마시는\s*시간/, /tea\s*time/i],
    genreWeights: { chanson: 2, 'jazz-classic-vocal-lounge': 1 }
  },
  {
    id: 'time-all-night',
    patterns: [/밤새/, /밤을\s*새/],
    genreWeights: { 'oldpop-rainy-ballad-blues': 2 }
  },
  {
    id: 'time-pre-dawn',
    patterns: [/새벽녘/, /동트기\s*전/],
    genreWeights: { 'oldpop-quiet-storm-warm': 1 }
  },
  {
    id: 'time-late-afternoon',
    patterns: [/늦은\s*오후/],
    genreWeights: { 'oldpop-sunlit-strings-pop': 1 }
  },
  {
    id: 'time-late-night',
    patterns: [/늦은\s*밤/],
    genreWeights: { 'oldpop-night-chanson': 1 }
  },
  {
    id: 'time-weekday',
    patterns: [/평일/],
    genreWeights: { 'folk-pop': 1 }
  },
  {
    id: 'time-holiday-off',
    patterns: [/공휴일/, /휴일/],
    genreWeights: { 'folk-pop': 1, 'acoustic-pop': 1 }
  },
  {
    id: 'time-long-weekend',
    patterns: [/연휴/],
    genreWeights: { 'oldpop-sunshine-pop': 1 }
  },
  {
    id: 'time-new-semester',
    patterns: [/새\s*학기/, /new\s*semester/i],
    genreWeights: { 'folk-pop': 1, 'oldpop-sunshine-pop': 1 }
  },
  {
    id: 'time-late-evening',
    patterns: [/늦은\s*저녁/],
    genreWeights: { 'oldpop-evening-lamp-ballad': 2, 'oldpop-night-chanson': 1 }
  },

  // ---------------------------------------------------------------------------
  // 상황 (A-4) — 45종. 성인 전용 상황(퇴근·야근·이별·고백 등)에는
  // ADULT_ARCHETYPES를 명시해 동요에 새지 않게 구조적으로 막는다
  // (§하지 말 것 "동요에 성인 상황 키워드를 매칭하지 말 것").
  // ---------------------------------------------------------------------------
  {
    id: 'situ-off-work-senior',
    patterns: [/퇴근길/, /퇴근하고/, /퇴근/],
    genreWeights: { 'oldpop-evening-lamp-ballad': 3, 'smooth-jazz-lounge': 2, 'oldpop-quiet-storm-warm': 2, 'oldpop-piano-ballad-70s': 1 },
    archetypeScope: ADULT_ARCHETYPES
  },
  {
    id: 'situ-off-work-idol',
    patterns: [/퇴근길/, /퇴근하고/, /퇴근/],
    genreWeights: { 'kridol-emotional-ballad': 3, 'kridol-midtempo-rnb': 2 },
    archetypeScope: ['kr-idol-male', 'kr-idol-female']
  },
  {
    id: 'situ-commute-general',
    patterns: [/통근/, /\bcommut(e|ing)\b/i],
    genreWeights: { 'oldpop-quiet-storm-warm': 2, 'smooth-jazz-lounge': 1 },
    archetypeScope: ADULT_ARCHETYPES
  },
  {
    id: 'situ-overtime-senior',
    patterns: [/야근/],
    genreWeights: { 'oldpop-evening-lamp-ballad': 2, 'oldpop-night-chanson': 2 },
    archetypeScope: ADULT_ARCHETYPES
  },
  {
    id: 'situ-overtime-idol',
    patterns: [/야근/],
    genreWeights: { 'kridol-emotional-ballad': 2, 'kridol-midtempo-rnb': 2 },
    archetypeScope: ['kr-idol-male', 'kr-idol-female']
  },
  {
    id: 'situ-walk-evening',
    patterns: [/저녁\s*산책/],
    genreWeights: { 'folk-pop': 2, 'oldpop-hearth-acoustic': 1 }
  },
  {
    id: 'situ-drive-evening-senior',
    patterns: [/저녁\s*드라이브/],
    genreWeights: { 'oldpop-yacht-west-coast': 2, 'city-pop-soft': 1 }
  },
  {
    id: 'situ-waiting',
    patterns: [/기다림/, /기다리는\s*중/, /누군가를\s*기다리며/, /\bwaiting\b/i],
    genreWeights: { 'healing-ballad': 2, 'piano-ballad': 2 },
    moodWeights: { bittersweet: 1 }
  },
  {
    id: 'situ-moving-house',
    patterns: [/이삿날/, /이사/, /moving\s*house/i],
    genreWeights: { 'folk-pop': 2, 'oldpop-sunshine-pop': 1 }
  },
  {
    id: 'situ-graduation-senior',
    patterns: [/졸업식/, /졸업/, /\bgraduation\b/i],
    genreWeights: { 'oldpop-sunshine-pop': 2, 'folk-pop': 2 },
    archetypeScope: ADULT_ARCHETYPES
  },
  {
    id: 'situ-enrollment',
    patterns: [/입학식/, /입학/],
    genreWeights: { 'oldpop-sunshine-pop': 2, 'folk-pop': 1 },
    archetypeScope: ADULT_ARCHETYPES
  },
  {
    id: 'situ-reunion',
    patterns: [/재회/, /다시\s*만난/],
    genreWeights: { 'oldpop-close-harmony-duo': 2, 'retro-soul-pop': 2 },
    moodWeights: { nostalgic: 1 },
    archetypeScope: ADULT_ARCHETYPES
  },
  {
    id: 'situ-breakup-senior',
    patterns: [/이별/, /헤어지고/, /헤어진\s*후/, /\bbreakup\b/i],
    genreWeights: { 'oldpop-rainy-ballad-blues': 3, 'piano-ballad': 2 },
    archetypeScope: ADULT_ARCHETYPES
  },
  {
    id: 'situ-confession',
    patterns: [/고백하는/, /고백/, /\bconfession\b/i],
    genreWeights: { 'oldpop-soft-duet-80s': 2, chanson: 1 },
    archetypeScope: ADULT_ARCHETYPES
  },
  {
    id: 'situ-eating-alone',
    patterns: [/혼밥/, /혼자\s*먹는\s*밥/],
    genreWeights: { 'lofi-cafe': 2, 'jazz-pop': 1, 'kr2030-acoustic-folk': 2 }
  },
  {
    id: 'situ-dishwashing',
    patterns: [/설거지/],
    genreWeights: { 'oldpop-hearth-acoustic': 2, 'folk-pop': 1 }
  },
  {
    id: 'situ-cleaning',
    patterns: [/청소/],
    genreWeights: { 'folk-pop': 2, 'acoustic-pop': 1 }
  },
  {
    id: 'situ-laundry',
    patterns: [/빨래/],
    genreWeights: { 'oldpop-warm-morning-glow': 2, 'folk-pop': 1 }
  },
  {
    id: 'situ-exercise',
    patterns: [/운동/, /\bexercise\b/i, /\bworkout\b/i],
    genreWeights: { 'folk-pop': 1, 'oldpop-sunshine-pop': 1 }
  },
  {
    id: 'situ-bath',
    patterns: [/목욕/],
    genreWeights: { 'healing-ballad': 2, 'oldpop-hearth-acoustic': 1 }
  },
  {
    id: 'situ-before-sleep',
    patterns: [/잠들기\s*전/, /자기\s*전/, /before\s*(sleep|bed)/i],
    genreWeights: { 'oldpop-gentle-lullaby-pop': 3, 'healing-ballad': 2, 'piano-ballad': 1 }
  },
  {
    id: 'situ-waking-up',
    patterns: [/일어나서/, /눈을?\s*떴을\s*때/],
    genreWeights: { 'oldpop-warm-morning-glow': 2 }
  },
  {
    id: 'situ-vacation',
    patterns: [/휴가/, /\bvacation\b/i],
    genreWeights: { 'bossa-cafe': 2, 'city-pop-soft': 1 }
  },
  {
    id: 'situ-travel',
    patterns: [/여행/, /\btravel\b/i, /\btrip\b/i],
    genreWeights: { 'bossa-cafe': 2, 'folk-pop': 2, 'oldpop-yacht-west-coast': 1 }
  },
  {
    id: 'situ-homecoming',
    patterns: [/귀향/, /고향\s*가는\s*길/, /homecoming/i],
    genreWeights: { 'oldpop-warm-morning-glow': 2, 'folk-pop': 2 },
    moodWeights: { nostalgic: 1 }
  },
  {
    id: 'situ-retirement',
    patterns: [/은퇴하고/, /은퇴/, /\bretirement\b/i],
    genreWeights: { 'oldpop-quiet-storm-warm': 3, 'smooth-jazz-lounge': 2, 'healing-ballad': 1 }
  },
  {
    id: 'situ-grandchildren',
    patterns: [/손주/, /손자/, /손녀/],
    genreWeights: { 'oldpop-warm-morning-glow': 2, 'folk-pop': 2 },
    moodWeights: { warm: 2 }
  },
  {
    id: 'situ-class-reunion',
    patterns: [/동창회/, /동창\s*모임/],
    genreWeights: { 'retro-soul-pop': 2, 'oldpop-motown-pop-soul': 2 },
    moodWeights: { nostalgic: 1 }
  },
  {
    id: 'situ-wedding-anniversary',
    patterns: [/결혼기념일/, /wedding\s*anniversary/i],
    genreWeights: { chanson: 2, 'oldpop-soft-duet-80s': 2 },
    moodWeights: { romantic: 1 }
  },
  {
    id: 'situ-grocery-shopping',
    patterns: [/장보기/, /장\s*보러/],
    genreWeights: { 'folk-pop': 1, 'acoustic-pop': 1 }
  },
  {
    id: 'situ-gardening',
    patterns: [/텃밭\s*가꾸기/, /화초\s*가꾸기/, /정원\s*가꾸기/],
    genreWeights: { 'oldpop-warm-morning-glow': 2, 'folk-pop': 1 }
  },
  {
    id: 'situ-letter-writing',
    patterns: [/편지\s*쓰기/, /편지를\s*쓰며/],
    genreWeights: { chanson: 2, 'oldpop-standards-torch': 1 }
  },
  {
    id: 'situ-listening-radio',
    patterns: [/라디오\s*듣기/, /라디오를\s*들으며/, /라디오\s*듣던/],
    genreWeights: { 'oldpop-warm-morning-glow': 2, 'retro-soul-pop': 2 },
    moodWeights: { nostalgic: 2 }
  },
  {
    id: 'situ-old-photo-album',
    patterns: [/사진첩/, /앨범을\s*넘기며/, /옛\s*사진/],
    genreWeights: { 'oldpop-close-harmony-duo': 2, chanson: 1 },
    moodWeights: { nostalgic: 1 }
  },
  {
    id: 'situ-first-job',
    patterns: [/첫\s*출근/, /첫\s*직장/],
    genreWeights: { 'oldpop-sunshine-pop': 2, 'folk-pop': 1 },
    archetypeScope: ADULT_ARCHETYPES
  },
  {
    id: 'situ-job-change',
    patterns: [/이직/, /job\s*change/i],
    genreWeights: { 'kr2030-ost-ballad': 2, 'kr2030-acoustic-folk': 1 },
    archetypeScope: ['kr-2030-pop']
  },
  {
    id: 'situ-propose-marriage',
    patterns: [/프로포즈/, /청혼/, /\bpropose\b/i],
    genreWeights: { chanson: 2, 'oldpop-soft-duet-80s': 2 },
    moodWeights: { romantic: 2 },
    archetypeScope: ADULT_ARCHETYPES
  },
  {
    id: 'situ-newlywed',
    patterns: [/신혼/],
    genreWeights: { chanson: 1, 'oldpop-soft-duet-80s': 1 },
    moodWeights: { warm: 1 },
    archetypeScope: ADULT_ARCHETYPES
  },
  {
    id: 'situ-first-meeting',
    patterns: [/첫\s*만남/],
    genreWeights: { 'oldpop-sunshine-pop': 1 },
    moodWeights: { romantic: 1 },
    archetypeScope: ADULT_ARCHETYPES
  },
  {
    id: 'situ-farewell',
    patterns: [/배웅/, /마지막\s*인사/, /작별/, /\bfarewell\b/i],
    genreWeights: { 'oldpop-rainy-ballad-blues': 2, 'piano-ballad': 1 },
    moodWeights: { bittersweet: 1 },
    archetypeScope: ADULT_ARCHETYPES
  },
  {
    id: 'situ-greeting-arrival',
    patterns: [/마중\s*나가/, /마중하며/],
    genreWeights: { 'oldpop-warm-morning-glow': 1, 'folk-pop': 1 }
  },
  {
    id: 'situ-packing',
    patterns: [/짐을\s*정리하며/, /짐\s*정리/],
    genreWeights: { 'folk-pop': 1 }
  },
  {
    id: 'situ-daily-routine-senior',
    patterns: [/하루\s*일과를\s*마치고/, /하루를\s*마무리하며/],
    genreWeights: { 'oldpop-evening-lamp-ballad': 2, 'healing-ballad': 1 }
  },
  {
    id: 'situ-window-seat-transit',
    patterns: [/차창\s*밖/, /창밖\s*풍경/],
    genreWeights: { 'oldpop-evening-lamp-ballad': 2, 'smooth-jazz-lounge': 1 }
  },
  {
    id: 'situ-cooking',
    patterns: [/요리하며/, /음식을?\s*만들며/],
    genreWeights: { 'oldpop-hearth-acoustic': 2, 'folk-pop': 1 }
  },

  // ---------------------------------------------------------------------------
  // 정서 (A-4) — 30종. moodPacks.ts에 실제 존재하는 id로만 매핑한다
  // (nostalgic/warm/bittersweet/hopeful/romantic/calm-focus/fresh-start/
  // elegant/emotional/confident — 새 mood id를 만들지 않는다).
  // ---------------------------------------------------------------------------
  {
    id: 'emo-regret',
    patterns: [/후회/, /\bregret\b/i],
    moodWeights: { bittersweet: 2 },
    genreWeights: { 'piano-ballad': 2, 'oldpop-rainy-ballad-blues': 1 }
  },
  {
    id: 'emo-gratitude',
    patterns: [/감사한/, /감사/, /고맙다/, /\bgrateful\b/i],
    moodWeights: { warm: 2, hopeful: 1 },
    genreWeights: { 'healing-ballad': 2 }
  },
  {
    id: 'emo-overwhelmed',
    patterns: [/벅찬/, /벅참/, /뭉클/],
    moodWeights: { emotional: 2, hopeful: 1 },
    genreWeights: { 'oldpop-orchestral-ballad-80s': 2 }
  },
  {
    id: 'emo-languid',
    patterns: [/나른한/, /나른함/],
    moodWeights: { 'calm-focus': 2 },
    genreWeights: { 'bossa-cafe': 2, 'smooth-jazz-lounge': 1 }
  },
  {
    id: 'emo-comfortable',
    patterns: [/편안한/, /편안함/],
    moodWeights: { warm: 2, 'calm-focus': 1 },
    genreWeights: { 'healing-ballad': 2, 'folk-pop': 1 }
  },
  {
    id: 'emo-wistful',
    patterns: [/아련한/, /아련함/],
    moodWeights: { bittersweet: 2, nostalgic: 1 },
    genreWeights: { chanson: 2, 'oldpop-slow-waltz-memory': 1 }
  },
  {
    id: 'emo-fulfilled',
    patterns: [/뿌듯한/, /뿌듯함/],
    moodWeights: { hopeful: 2, confident: 1 },
    genreWeights: { 'oldpop-sunshine-pop': 2 }
  },
  {
    id: 'emo-composed',
    patterns: [/담담한/, /담담함/],
    moodWeights: { 'calm-focus': 2, elegant: 1 },
    genreWeights: { 'jazz-classic-vocal-lounge': 2 }
  },
  {
    id: 'emo-tender-longing',
    patterns: [/애틋한/, /애틋함/],
    moodWeights: { romantic: 2, bittersweet: 1 },
    genreWeights: { chanson: 2 }
  },
  {
    id: 'emo-emptiness',
    patterns: [/허전한/, /허전함/],
    moodWeights: { bittersweet: 2 },
    genreWeights: { 'piano-ballad': 2, 'oldpop-rainy-ballad-blues': 1 }
  },
  {
    id: 'emo-bittersweet-taste',
    patterns: [/씁쓸한/, /씁쓸함/],
    moodWeights: { bittersweet: 3 },
    genreWeights: { 'oldpop-rainy-ballad-blues': 2 }
  },
  {
    id: 'emo-heart-pounding',
    patterns: [/두근거리는/, /두근거림/, /두근두근/],
    moodWeights: { romantic: 2, hopeful: 1 }
  },
  {
    id: 'emo-relief',
    patterns: [/안도감/, /안도하며/],
    moodWeights: { hopeful: 2, 'calm-focus': 1 }
  },
  {
    id: 'emo-lost-helpless',
    patterns: [/막막한/, /막막함/],
    moodWeights: { bittersweet: 2 },
    genreWeights: { 'piano-ballad': 1 }
  },
  {
    id: 'emo-poignant',
    patterns: [/애잔한/, /애잔함/],
    moodWeights: { bittersweet: 2, nostalgic: 1 },
    genreWeights: { chanson: 1 }
  },
  {
    id: 'emo-mournful',
    patterns: [/처연한/, /처연함/],
    moodWeights: { bittersweet: 2 },
    genreWeights: { 'oldpop-rainy-ballad-blues': 2 }
  },
  {
    id: 'emo-affectionate-warmth',
    patterns: [/정겨운/, /정겨움/],
    moodWeights: { warm: 3 },
    genreWeights: { 'folk-pop': 2 }
  },
  {
    id: 'emo-pathos',
    patterns: [/애수/],
    moodWeights: { bittersweet: 2, nostalgic: 1 },
    genreWeights: { chanson: 2 }
  },
  {
    id: 'emo-touched',
    patterns: [/감동적인/, /감동/],
    moodWeights: { emotional: 2, hopeful: 1 },
    genreWeights: { 'oldpop-orchestral-ballad-80s': 2 }
  },
  {
    id: 'emo-warm-fuzzy',
    patterns: [/몽글몽글한/, /몽글몽글/],
    moodWeights: { warm: 2, hopeful: 1 }
  },
  {
    id: 'emo-choked-up',
    patterns: [/울컥하는/, /울컥/],
    moodWeights: { emotional: 2, bittersweet: 1 }
  },
  {
    id: 'emo-bittersweet-relief',
    patterns: [/시원섭섭한/, /시원섭섭함/],
    moodWeights: { bittersweet: 2, hopeful: 1 }
  },
  {
    id: 'emo-lighthearted-relief',
    patterns: [/홀가분한/, /홀가분함/],
    moodWeights: { hopeful: 2, 'fresh-start': 1 }
  },
  {
    id: 'emo-restless-impatience',
    patterns: [/조바심/],
    moodWeights: { bittersweet: 1 }
  },
  {
    id: 'emo-tranquility',
    patterns: [/평온한/, /평온함/],
    moodWeights: { 'calm-focus': 3 },
    genreWeights: { 'smooth-jazz-lounge': 1 }
  },
  {
    id: 'emo-yearning',
    patterns: [/애타는/, /애타게/],
    moodWeights: { romantic: 2, bittersweet: 1 }
  },
  {
    id: 'emo-lethargy',
    patterns: [/무기력한/, /무기력함/],
    moodWeights: { bittersweet: 2, 'calm-focus': 1 }
  },
  {
    id: 'emo-sorrow-grief',
    patterns: [/서러운/, /설움/],
    moodWeights: { bittersweet: 2 },
    genreWeights: { 'oldpop-rainy-ballad-blues': 2 }
  },
  {
    id: 'emo-proud-of-life',
    patterns: [/자랑스러운/, /자랑스러움/],
    moodWeights: { confident: 1, hopeful: 1 }
  },
  {
    id: 'emo-fresh-determination',
    patterns: [/새로운\s*다짐/, /각오를\s*다지며/],
    moodWeights: { 'fresh-start': 2, hopeful: 1 }
  },

  // 지시문 64 (TASK C) — check:concept-coverage 실측 결과 워크스페이스
  // 자체 장르가 하나도 안 걸린 3건을 보완한다(장소/시간 축 새 룰이
  // 시니어 id 위주라 2030·동요 쪽 자매 규칙이 없던 자리).
  {
    id: 'kr2030-solo-drink',
    patterns: [/혼자\s*마시는/, /맥주\s*한잔/, /술\s*한잔/],
    genreWeights: { 'kr2030-dawn-rnb': 2, 'kr2030-lofi-swing-hiphop': 2 },
    archetypeScope: ['kr-2030-pop']
  },
  {
    id: 'kr2030-trip-vacation',
    patterns: [/공항/, /여행/, /휴가/],
    genreWeights: { 'kr2030-ost-ballad': 2, 'kr2030-acoustic-folk': 2 },
    archetypeScope: ['kr-2030-pop']
  },
  {
    id: 'krkids-playground',
    patterns: [/놀이터/, /뛰노는/, /신나게\s*뛰노는/],
    genreWeights: { 'krkids-action': 3, 'krkids-animal-vehicle': 1 },
    archetypeScope: ['kids', 'kr-kids-song', 'jp-kids-song']
  }
];

/**
 * 지시문 64 (TASK A-2) — `archetype`은 옵션이다: 기존 호출부(promiseAudit.ts
 * 등 아키타입을 모르는/상관없는 자리)는 그대로 undefined로 호출해 이전과
 * 완전히 같은 결과를 받는다(archetypeScope가 없는 규칙은 항상 매칭되고,
 * archetypeScope가 있는 규칙도 archetype 인자가 없으면 걸러지지 않는다 —
 * "모른다"를 "맞다"로 취급하지, "아니다"로 취급하지 않는다). archetype을
 * 아는 호출부(conceptAgent.ts/setDirector.ts)만 실제로 좁혀진 결과를 받는다.
 */
export function matchConceptRules(freeText: string, archetype?: ChannelArchetype): KeywordRule[] {
  const text = freeText.trim();
  if (!text) return [];
  return CONCEPT_KEYWORD_RULES.filter(rule =>
    (!archetype || !rule.archetypeScope || rule.archetypeScope.includes(archetype)) &&
    rule.patterns.some(pattern => pattern.test(text))
  );
}
