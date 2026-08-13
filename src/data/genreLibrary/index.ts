import type { ChannelArchetype, GenreLyricFlavorImage, GenrePack } from '../../types';
import type { GenreTier } from './types';
import { ERA_BUCKET_BY_GENRE_ID } from '../eraExclusions';
import { ERA_BUCKETS_BY_GENRE_ID, ERA_NOTE_KO_BY_GENRE_ID, type EraBucket as FineEraBucket } from '../eraBuckets';
import { buildGenreTraits } from '../genreTraits';

/**
 * TASK H2 (v3.13) — 3-5 short, genre-authentic images per core-tier genre id,
 * covering senior-morning's and showa-cafe's core genre lists (the two real
 * production archetypes). composeLyrics uses exactly one of these per song,
 * in the 'situation' slot only, so genre selection is audible in the lyrics
 * themselves rather than only in the style prompt. Deliberately archetype-
 * neutral (no modern IT vocabulary, nothing that reads as breakup/alcohol
 * imagery) so the handful of genres shared between both archetypes' core
 * lists (jazz-pop, bossa-cafe, lofi-cafe, piano-ballad, christmas-soft-pop)
 * stay safe for either one. Extended-tier genres without an entry here fall
 * back to the pre-v3.13 generic filler pool — this is additive, not a
 * requirement every genre must satisfy.
 */
export const CORE_LYRIC_FLAVOR_IMAGES: Partial<Record<string, GenreLyricFlavorImage[]>> = {
  // 정합성 점검 §7 결함8 fix — real ROOT CAUSE found (not the systemic
  // multi-pool drift the earlier partial fix targeted): core/localGenerator.ts's
  // genreFlavorImages is computed from `genres[0]` ONCE per pack, not per
  // track (that file's own TASK H2 (v3.13) comment — a deliberate "pack's
  // primary genre supplies shared imagery" design, not a bug in the
  // selection logic itself). For good-morning-memory-radio's own DEFAULT
  // state (createInitialOptions, no concept applied), genres[0] is always
  // 'adult-contemporary' — and every one of its 3 entries contained a
  // WORD_BLOCKING_THRESHOLD-busting word (soft/radio, warm/coffee,
  // quiet/window), so EVERY track in an 18-song pack — regardless of that
  // track's own actual assigned genre — drew its hook/motif imagery from
  // just these 3 phrases. A real measured pack traced literal repeated
  // "like a quiet window seat"/"soft radio dial" lines back to exactly this
  // array. Purely additive (5 new entries, existing 3 untouched, selection
  // mechanism untouched — no risk to the §7-validated pack-cohesion
  // behavior this design intentionally produces) — deliberately avoiding
  // quiet/soft/warm/radio/coffee/window/cup/seat/dial as each new entry's
  // own word, so pickFlavor()'s random draw (core/lyricEngine.ts) has real
  // alternatives instead of a 3-way coin flip between three near-identical
  // offenders.
  'adult-contemporary': [
    { english: 'soft radio dial', korean: '부드러운 라디오 다이얼', japanese: 'やわらかなラジオのダイヤル' },
    { english: 'warm coffee cup', korean: '따뜻한 커피잔', japanese: 'あたたかいコーヒーカップ' },
    { english: 'quiet window seat', korean: '조용한 창가 자리', japanese: '静かな窓辺の席' },
    { english: 'evening newspaper page', korean: '저녁 신문 한 장', japanese: '夕刊の一面' },
    { english: 'garden bench shade', korean: '정원 벤치의 그늘', japanese: '庭のベンチの木陰' },
    { english: 'faded concert ticket', korean: '빛바랜 콘서트 표', japanese: '色あせたコンサートチケット' },
    { english: 'worn leather journal', korean: '낡은 가죽 수첩', japanese: '使い込んだ革の手帳' },
    { english: 'amber table lamp', korean: '호박빛 테이블 램프', japanese: '琥珀色のテーブルランプ' }
  ],
  'acoustic-pop': [
    { english: 'worn guitar strings', korean: '낡은 기타 줄', japanese: '使い込んだギターの弦' },
    { english: 'porch step', korean: '현관 계단', japanese: '玄関の段差' },
    { english: 'quiet strum', korean: '조용한 기타 스트럼', japanese: '静かなストローク' }
  ],
  'jazz-pop': [
    { english: 'candlelight', korean: '촛불빛', japanese: 'キャンドルの灯り' },
    { english: 'brass hush', korean: '금관악기의 낮은 울림', japanese: '金管の静かな響き' },
    { english: 'velvet quiet', korean: '벨벳 같은 고요함', japanese: 'ビロードのような静けさ' }
  ],
  'lofi-cafe': [
    { english: 'rain on the glass', korean: '유리창에 내리는 비', japanese: 'ガラスに降る雨' },
    { english: 'vinyl crackle', korean: '레코드판의 잡음', japanese: 'レコードのノイズ' },
    { english: 'soft headphones', korean: '부드러운 헤드폰', japanese: 'やわらかなヘッドホン' }
  ],
  'healing-ballad': [
    { english: 'soft piano keys', korean: '부드러운 피아노 건반', japanese: 'やわらかなピアノの鍵盤' },
    { english: 'quiet tears drying', korean: '조용히 마르는 눈물', japanese: '静かに乾く涙' },
    { english: 'gentle held breath', korean: '가만히 참은 숨', japanese: 'そっと止めた息' }
  ],
  'piano-ballad': [
    { english: 'ivory keys', korean: '하얀 건반', japanese: '白い鍵盤' },
    { english: 'slow pedal hum', korean: '느린 페달의 울림', japanese: 'ゆっくりとしたペダルの響き' },
    { english: 'single spotlight', korean: '하나의 조명', japanese: '一筋のスポットライト' }
  ],
  'retro-soul-pop': [
    { english: 'warm vinyl groove', korean: '따뜻한 레코드의 홈', japanese: 'あたたかいレコードの溝' },
    { english: 'tape hiss', korean: '테이프의 잡음', japanese: 'テープのヒスノイズ' },
    { english: 'velvet stage light', korean: '벨벳 같은 무대 조명', japanese: 'ビロードのような舞台照明' }
  ],
  'bossa-cafe': [
    { english: 'sunlit patio', korean: '햇살 드는 테라스', japanese: '陽だまりのテラス' },
    { english: 'soft nylon strings', korean: '부드러운 나일론 줄', japanese: 'やわらかなナイロン弦' },
    { english: 'iced glass condensation', korean: '유리잔에 맺힌 물방울', japanese: 'グラスに浮かぶ水滴' }
  ],
  'christmas-soft-pop': [
    { english: 'string of warm lights', korean: '따뜻한 조명 줄', japanese: 'あたたかな灯りの連なり' },
    { english: 'wrapped paper', korean: '포장지', japanese: '包装紙' },
    { english: 'frosted window pane', korean: '서리 낀 창유리', japanese: '霜のついた窓ガラス' }
  ],
  'folk-pop': [
    { english: 'worn wooden bench', korean: '낡은 나무 벤치', japanese: '使い古した木のベンチ' },
    { english: 'open field breeze', korean: '들판의 바람', japanese: '野原を渡る風' },
    { english: 'hand-me-down scarf', korean: '물려받은 목도리', japanese: 'お下がりのマフラー' }
  ],
  'showa-modern': [
    { english: 'rotary phone', korean: '다이얼 전화기', japanese: 'ダイヤル電話' },
    { english: 'neon sign glow', korean: '네온사인 불빛', japanese: 'ネオンサインの灯り' },
    { english: 'jazz record spinning', korean: '돌아가는 재즈 레코드', japanese: '回るジャズレコード' }
  ],
  'city-pop-soft': [
    { english: 'wet city pavement', korean: '젖은 도시 보도', japanese: '濡れた街の舗道' },
    { english: 'neon reflection', korean: '네온 불빛의 반사', japanese: 'ネオンの反射' },
    { english: 'late train window', korean: '늦은 기차 창문', japanese: '終電の窓' }
  ],
  'jazz-classic-vocal-lounge': [
    { english: 'dim lounge light', korean: '어스름한 라운지 조명', japanese: '薄暗いラウンジの灯り' },
    { english: 'brass mute', korean: '약음기를 낀 금관악기', japanese: 'ミュートをつけた金管' },
    { english: 'velvet curtain', korean: '벨벳 커튼', japanese: 'ビロードのカーテン' }
  ],
  'jazz-soft-vocal-trio': [
    { english: 'upright bass hum', korean: '콘트라베이스의 울림', japanese: 'アップライトベースの響き' },
    { english: 'small stage light', korean: '작은 무대 조명', japanese: '小さな舞台照明' },
    { english: 'quiet applause', korean: '조용한 박수', japanese: '静かな拍手' }
  ],
  'city-pop-rainy-window-pop': [
    { english: 'rain-streaked window', korean: '빗물 흐르는 창문', japanese: '雨の伝う窓' },
    { english: 'city lights blur', korean: '흐려진 도시 불빛', japanese: 'にじむ街の灯り' },
    { english: 'wet umbrella', korean: '젖은 우산', japanese: '濡れた傘' }
  ]
};

export interface GenreCategory {
  id: string;
  label: string;
  description: string;
}

export interface StructuredGenrePack extends GenrePack {
  categoryId: string;
  archetypes: ChannelArchetype[];
  tier: GenreTier;
  rhythm: string[];
  vocal: string[];
  production: string[];
  harmony: string[];
  tempo: [number, number];
  moods: string[];
  audiences: string[];
  avoidTraits: string[];
  shortPrompt: string;
  productionGuidance: string;
  source: 'legacy-preset' | 'notion-analysis';
}

/**
 * 지시문 12 (TASK A) — genreLibrary(아래 최종 export)의 실제 타입. 개별
 * 팩토리(legacyGenrePack/makeProfile 등)가 만드는 중간 배열은 여전히
 * StructuredGenrePack[]로 남겨둔다(eraBuckets는 이 파일 하나의 최종 파생
 * 단계에서만 부여됨 — withGenreVisibility의 archetypes/tier와 같은
 * "T & {...}" 교차 타입 패턴, StructuredGenrePack 자체를 넓히지 않는다).
 * eraBuckets는 필수 — 354종 전수 부여가 이 타입으로 강제된다.
 */
export type EraTaggedGenrePack = StructuredGenrePack & {
  eraBuckets: FineEraBucket[];
  /** 이 장르에 그 eraBuckets를 부여한 근거 — 사람이 읽는 필드, 판정에 쓰지 않는다. */
  eraNoteKo?: string;
};

const GENRE_ERA_TAG_OVERRIDES: Record<string, string> = {
  'adult-contemporary': '1980s-present adult contemporary',
  'acoustic-pop': 'timeless acoustic pop',
  'jazz-pop': 'mid-century-to-modern jazz pop',
  'healing-ballad': 'timeless pop ballad',
  'piano-ballad': '1970s-present piano pop ballad',
  'lofi-cafe': 'modern lo-fi cafe pop',
  'retro-soul-pop': '1960s-70s soul pop',
  'bossa-cafe': '1960s-present bossa cafe pop',
  'christmas-soft-pop': 'timeless seasonal soft pop',
  'folk-pop': '1960s-present folk pop',
  chanson: 'mid-century French chanson',
  'smooth-jazz-lounge': '1980s-present smooth jazz lounge',
  'showa-modern': 'late-1970s to 1980s Showa cafe pop',
  'city-pop-soft': 'late-1970s to 1980s city pop',
  // TASK v5.7 follow-up (TASK C §3-4) — real music-history basis: Everly-
  // Brothers-era close harmony and Mantovani/Percy-Faith-era orchestral easy
  // listening both predate the 1970s; Sinatra-era torch-song phrasing
  // predates the 1980s. eraTag display/scoring text only — does NOT touch
  // eraExclusions.ts's ERA_BUCKET_BY_GENRE_ID hard quota bucket (still
  // '1970s'/'1980s' there, unchanged). A first attempt at exactly this
  // change was reverted after tests/oldpopGenreFamily.test.ts measured an
  // UNRELATED pair (oldpop-quiet-storm-warm vs oldpop-light-synth-pop-warm)
  // jumping to 0.467 similarity — root cause was core/diversityLinter.ts's
  // lintInPackStyleSimilarity requiring a clause be common to LITERALLY
  // every one of the 28 oldpop-* genres in the batch before excluding it as
  // shared boilerplate; changing this eraTag text reorders which
  // data/killingPoints.ts candidate an affected genre's song lands on (its
  // candidatesFor does era-substring matching), which flipped one clause's
  // "common to all 28" status and stopped it being excluded for every OTHER
  // pair too. diversityLinter.ts's commonClauses now tolerates near-common
  // (>=90% of the batch, not literally 100%) specifically so one outlier
  // entry's text can't swing the shared-boilerplate exclusion for the whole
  // batch — see its own doc comment. Re-measured after that fix: this
  // widening no longer perturbs the unrelated pair.
  'oldpop-close-harmony-duo': '1960s-70s',
  'oldpop-orchestral-easy': '1960s-70s',
  'oldpop-standards-torch': '1950s-80s'
};

interface GenreVariantSeed {
  slug: string;
  label: string;
  tags: string[];
  tempo?: [number, number];
}

interface CategoryBase {
  id: string;
  label: string;
  rhythm: string[];
  instruments: string[];
  vocal: string[];
  production: string[];
  harmony: string[];
  tempo: [number, number];
  moods: string[];
  audiences: string[];
  avoidTraits: string[];
}

const sharedAvoid = [
  'famous artist imitation',
  'copied melody',
  'copyrighted song reference',
  'soundalike vocal',
  'overlong intro'
];

export const genreCategories: GenreCategory[] = [
  { id: 'pop', label: 'Pop and Singer-Songwriter', description: 'Playlist-safe pop, acoustic pop, folk pop, and soft rock presets.' },
  { id: 'jazz', label: 'Jazz', description: 'Swing, trio, vocal jazz, lounge, fusion, bossa, and modern jazz-derived prompts.' },
  { id: 'city-pop', label: 'City Pop', description: 'Retro-modern urban pop, polished bass grooves, clean guitars, synth color, and night-drive moods.' },
  { id: 'rnb', label: 'R&B and Soul', description: 'Modern R&B, neo-soul, quiet storm, slow jam, and bass-forward vocal textures.' },
  { id: 'hiphop', label: 'Hip-Hop and Rap', description: 'Chill rap, mellow boom-bap, jazz-rap, and sample-textured modern rap presets.' },
  { id: 'lofi', label: 'Lo-fi and Study', description: 'Dusty drums, tape grain, warm keys, jazzhop, and focus-friendly cafe textures.' },
  { id: 'ballad', label: 'Ballad', description: 'Piano-led pop ballads, healing ballads, duet ballads, and cinematic emotional builds.' },
  { id: 'seasonal', label: 'Seasonal', description: 'Holiday and seasonal playlist presets.' },
  { id: 'electronic', label: 'Electronic', description: 'Soft synthwave and electronic retro-pop textures.' },
  { id: 'japanese-era', label: 'Japanese Era Pop', description: 'Japanese 1970s kayokyoku/folk/new-music and early-2000s J-pop/R&B/band/dance presets.' },
  // TASK v3.39 — kids channel category, exposed so Step1's genre chip picker
  // can group/label the kids-* packs registered below (see KIDS_CORE_GENRE_IDS).
  { id: 'kids', label: 'Kids and Family', description: 'Bright, safe children\'s pop and singalong presets for the kids channel.' },
  // TASK v3.61 — 60s-80s Western old-pop family (doo-wop through torch song),
  // exposed as its own category so Step1's genre chip picker can group the
  // oldpop-* packs (see SENIOR_MORNING_CORE_GENRE_IDS/oldpopGenrePacks).
  { id: 'oldpop', label: '60s-80s Old Pop', description: 'Doo-wop, Brill Building, sunshine pop, 70s soft rock/soul, and 80s adult-contemporary presets for a warm senior playlist.' },
  // TASK B1 — kr-2030 workspace genre category (see kr2030GenrePacks below).
  { id: 'kr-2030', label: 'Korean 20s-30s Pop', description: 'Modern Korean emotional band pop, electro pop, R&B, OST ballad, Y2K retro, and acoustic folk presets for the kr-2030 workspace.' },
  // TASK C1 — jp-2030 workspace genre category (see jp2030GenrePacks below).
  { id: 'jp-2030', label: 'Japanese 20s-30s Pop', description: 'Modern melodic J-rock, anime-cinematic pop, Heisei nostalgia, dance vocal, kawaii idol, neo city pop, and chill neo soul presets for the jp-2030 workspace.' }
];

export const SENIOR_MORNING_CORE_GENRE_IDS = [
  'adult-contemporary',
  'acoustic-pop',
  'jazz-pop',
  'healing-ballad',
  'piano-ballad',
  'lofi-cafe',
  'retro-soul-pop',
  'bossa-cafe',
  'christmas-soft-pop',
  'folk-pop',
  // TASK v3.56 Part 3 — chanson/smooth-jazz-lounge added as senior/cafe
  // channel genres (see presets.ts's rawGenrePacks for the pack definitions
  // and signatureOverrides for their full/short/minimal genre signatures).
  'chanson',
  'smooth-jazz-lounge',
  // TASK v3.61 — the 28-genre 60s-80s old-pop family (oldpopGenrePacks
  // above). Registered here (not just added to presets.ts's rawGenrePacks)
  // so conceptAgent.ts's rankFromRules/decomposeArtistReferences filtering
  // (`if (!coreGenreIds.has(id)) continue`) can actually route a Korean
  // keyword match or an artist-reference suggestion to these ids instead of
  // silently discarding them — this was the real routing gap TASK v3.61
  // TASK B fixed, not a missing-genre problem.
  'oldpop-doowop-harmony',
  'oldpop-brill-building',
  'oldpop-girl-group-wall',
  'oldpop-sunshine-pop',
  'oldpop-baroque-pop',
  'oldpop-british-beat',
  'oldpop-soft-rock-am',
  'oldpop-orchestral-easy',
  'oldpop-close-harmony-duo',
  'oldpop-folk-rock-70s',
  'oldpop-motown-pop-soul',
  'oldpop-philly-soul-sweet',
  'oldpop-countrypolitan',
  'oldpop-europop-glow',
  'oldpop-yacht-west-coast',
  'oldpop-piano-ballad-70s',
  'oldpop-adult-contemporary-80s',
  'oldpop-quiet-storm-warm',
  'oldpop-orchestral-ballad-80s',
  'oldpop-light-synth-pop-warm',
  'oldpop-soft-duet-80s',
  'oldpop-standards-torch',
  'oldpop-warm-morning-glow',
  'oldpop-gentle-lullaby-pop',
  'oldpop-hearth-acoustic',
  'oldpop-sunlit-strings-pop',
  'oldpop-slow-waltz-memory',
  'oldpop-evening-lamp-ballad',
  // 지시문 21 (TASK B) — 두왑 분화 2종·밤 샹송·발라드블루스, all tier: 'core'
  // and archetypes: ['senior-morning', 'oldpop-lounge']. Registered here too
  // (not just tagged on the pack literal) for the same reason as the block
  // above: getCoreGenreIdsForArchetype reads this static list directly, not
  // genre.tier/genre.archetypes, so omitting an id here would leave it
  // unreachable from conceptAgent.ts's keyword routing despite being tagged core.
  'oldpop-doowop-ballad',
  'oldpop-doowop-uptempo',
  'oldpop-night-chanson',
  'oldpop-rainy-ballad-blues',
  // 지시문 21 (TASK A) — 신규 4종 중 oldpop 계열 2종. 같은 이유로 여기 등록.
  'oldpop-six-eight-slow-ballad',
  'oldpop-italian-canzone'
] as const;

export const SHOWA_CAFE_CORE_GENRE_IDS = [
  'showa-modern',
  'city-pop-soft',
  'jazz-pop',
  'bossa-cafe',
  'lofi-cafe',
  'piano-ballad',
  'christmas-soft-pop',
  'jazz-classic-vocal-lounge',
  'jazz-soft-vocal-trio',
  'city-pop-rainy-window-pop',
  'chanson',
  'smooth-jazz-lounge'
] as const;

// TASK v3.38 Part B1/B6 — real kids genre ids (defined in data/presets.ts's
// rawGenrePacks, not this file's own legacyGenreProfiles/genreLibrary array
// — see the TASK H2 comment in presets.ts on that pre-existing split).
// getCoreGenreIdsForArchetype only needs the id *strings* (Step1Channel.tsx's
// applyArchetype assigns them straight to preferredGenres without resolving
// through getGenreById), so this is correct even though getVisibleGenresFor
// Archetype's chip picker (which does filter genreLibrary's own array) won't
// display these 3 as chips — a known, disclosed gap, not a silent one.
// TASK v3.38 Part B0 (correction) — kids songs are pop-style, not
// traditional-nursery-rhyme-style; kids-march (traditional/marching-song
// flavor) is intentionally excluded from the 3 primary/auto-applied ids —
// it remains a real, selectable genre pack (see presets.ts's rawGenrePacks),
// just a secondary/auxiliary one, not a default.
export const KIDS_CORE_GENRE_IDS = ['kids-bright-pop', 'kids-acoustic-singalong', 'kids-upbeat-pop'] as const;

export const SHOWA_70S_CORE_GENRE_IDS = [
  'kayokyoku-70s',
  'japanese-folk-70s',
  'new-music-70s',
  'showa-groove-70s'
] as const;

export const J2000S_CORE_GENRE_IDS = [
  'jpop-2000s-ballad',
  'jpop-2000s-rnb',
  'jpop-2000s-band',
  'jpop-2000s-dance'
] as const;

export const MODERN_CHILL_CORE_GENRE_IDS = [
  'alt-rnb',
  'neo-soul',
  'trap-soul',
  'rnb-ballad-2020s',
  'chill-rap',
  'lofi-hiphop-study',
  'boom-bap-mellow',
  'jazz-rap',
  // TASK v3.56 Part 3 — 2030-channel genre additions (see genreLibrary's
  // modernGenrePacks for the pack definitions).
  'contemporary-rnb',
  'lofi-soul'
] as const;

export const CITY_NIGHT_CORE_GENRE_IDS = [
  'city-pop-modern',
  'future-funk',
  'disco-pop-2020s',
  'bedroom-pop',
  'alt-rnb',
  'chill-rap',
  'city-pop-night',
  // 지시문 21 (TASK A) — kr2030-noir-deep-house는 archetypes에 city-night도
  // 명시(강사 원문)돼 있어 이 채널의 core pool에서도 실제로 닿도록 등록.
  'kr2030-noir-deep-house',
  // 지시문 51 (TASK A-1) — 실측(check:genre-utilization): city-night-drive
  // 채널(preferredGenres 11종)의 city-pop-* 변형 6종이 이 core 목록에
  // 없어 recommendConceptLocal의 후보 풀에 애초에 없었다 — lofi-study와
  // 같은 유형(코어 목록이 채널 확장을 따라가지 못함), 정도만 부분적.
  // 활용률 45%→? 재측정 대상.
  'city-pop-soft', 'city-pop-bright-female-groove', 'city-pop-coastal-disco-pop',
  'city-pop-funky-rhythm-pop', 'city-pop-airy-disco-pulse', 'city-pop-club-disco-pop'
] as const;

/**
 * TASK B1 — kr-2030 workspace's 6 genres (see kr2030GenrePacks below).
 * Order matters: getDefaultGenreIdsForArchetype() takes slice(0, 3), and the
 * market research's top-3 priority is emo-band-pop / dawn-rnb / y2k-retro
 * (ranks 1, 3, 5), not simple array order — hence 1, 3, 5, 2, 4, 6 here.
 */
/**
 * 지시문 51 (TASK A-1) — 실측(check:genre-utilization): after-work-band-pop
 * 채널(kr-2030-pop)의 preferredGenres 18종 중 14종(contemporary-rnb·
 * alt-rnb·chill-rap·trap-soul 등 R&B/힙합 계열)을 이 core 목록에 추가해
 * 봤으나, 그 14종 자신의 archetypes 필드는 애초에 'modern-chill'/
 * 'city-night'(senior-oldpop 워크스페이스)만 갖고 있었다 — kr-2030-pop이
 * 전혀 아니다. genreWorkspaceOwnership.ts의 워크스페이스 격리 검사
 * (tests/workspaceDataIsolation.test.ts L1)가 정확히 이걸 잡아냈다:
 * "외부 장르 7건 노출". 이 14종을 core에 넣으면 추천이 실제로 이
 * 채널의 컨셉과 안 맞는(모던칠/시티나이트용으로 설계된) 스타일을
 * kr-2030-pop 컨셉에 갖다 붙이는 것과 같다 — §하지 말 것 "컨셉 적합성이
 * 우선이다"를 어긴다. 되돌린다. 근본 원인은 채널 정의(after-work-band-pop.
 * preferredGenres)가 애초에 archetypes 불일치 장르 14종을 갖고 있는 것
 * 자체다 — 지시문20이 이 채널을 확장할 때 생긴 선행 데이터 불일치로
 * 보이며, TASK C/보고에 별도로 남긴다(이 지시문의 "추천 편중" 수정
 * 범위가 아니라 "채널 정의 자체의 정합성" 문제).
 */
export const KR_2030_CORE_GENRE_IDS = [
  'kr2030-emo-band-pop',
  'kr2030-dawn-rnb',
  'kr2030-y2k-retro',
  'kr2030-electro-pop',
  'kr2030-ost-ballad',
  'kr2030-acoustic-folk',
  // 지시문 21 (TASK A) — 신규 2종, 기존 6종의 우선순위 순서 뒤에 추가
  // (getDefaultGenreIdsForArchetype의 top-3는 그대로 유지).
  'kr2030-lofi-swing-hiphop',
  'kr2030-noir-deep-house'
] as const;

/**
 * TASK C1 — jp-2030 workspace's 7 genres (see jp2030GenrePacks below).
 * Order matters: getDefaultGenreIdsForArchetype() takes slice(0, 3); the
 * market research's top-3 priority is melodic-jrock / anime-cinematic /
 * heisei-nostalgia, which is already this array's literal order.
 */
export const JP_2030_CORE_GENRE_IDS = [
  'jp2030-melodic-jrock',
  'jp2030-anime-cinematic',
  'jp2030-heisei-nostalgia',
  'jp2030-dance-vocal',
  'jp2030-kawaii-idol',
  'jp2030-neo-citypop',
  'jp2030-chill-neosoul'
] as const;

/**
 * TASK E1 — kr-kids workspace's 7 genres (see krkidsGenrePacks above).
 * Order matters: getDefaultGenreIdsForArchetype() takes slice(0, 3); §2's
 * own "최우선 3종은 1·2·3번" is already this array's literal order.
 */
export const KR_KIDS_CORE_GENRE_IDS = [
  'krkids-action',
  'krkids-daily-habit',
  'krkids-counting-color',
  'krkids-animal-vehicle',
  'krkids-roleplay-story',
  'krkids-bilingual',
  'krkids-sleep-calm'
] as const;

/**
 * TASK F1 — jp-kids workspace's 7 genres (see jpkidsGenrePacks above).
 * Order matters: getDefaultGenreIdsForArchetype() takes slice(0, 3); §2's
 * own "최우선 3종은 1·2·3번" is already this array's literal order.
 */
export const JP_KIDS_CORE_GENRE_IDS = [
  'jpkids-teasobi',
  'jpkids-taiso-dance',
  'jpkids-onomatopoeia',
  'jpkids-food-vehicle',
  'jpkids-daily-habit',
  'jpkids-seasonal',
  'jpkids-english-learning'
] as const;

/**
 * TASK K2 — kr-idol-male workspace's 7 genres (see kridolMaleGenrePacks
 * below). Order matches §3's own numbered table — getDefaultGenreIdsForArchetype()
 * takes slice(0, 3), so performance-trap/synth-dance/band-crossover (the
 * three most "stage performance"-coded of the 7) are the top-3 default.
 */
export const KRIDOL_M_CORE_GENRE_IDS = [
  'kridol-performance-trap',
  'kridol-synth-dance',
  'kridol-band-crossover',
  'kridol-midtempo-rnb',
  'kridol-latin-afro',
  'kridol-emotional-ballad',
  'kridol-retro-funk'
] as const;

/**
 * TASK K3 §3-1/§3-2 — kr-idol-female reuses the exact same 7 kridol-* ids
 * as KRIDOL_M_CORE_GENRE_IDS above (§3-1's own explicit instruction: no
 * new genres without documented justification, none added here), just in a
 * different priority order — §3-2's own "댄스형·레트로형·크로스오버형 비중이
 * 높음" leads the top-3 default with synth-dance/latin-afro/retro-funk
 * instead of K2's performance-trap/synth-dance/band-crossover.
 */
export const KRIDOL_F_CORE_GENRE_IDS = [
  'kridol-synth-dance',
  'kridol-latin-afro',
  'kridol-retro-funk',
  'kridol-band-crossover',
  'kridol-performance-trap',
  'kridol-midtempo-rnb',
  'kridol-emotional-ballad'
] as const;

/**
 * TASK v3.63 (TASK A) — a real user made a custom "oldpoplounge" channel and
 * found almost none of the 320-genre library reachable, because every
 * archetype's core-genre list (this Record) is what getVisibleGenresFor
 * Archetype actually filters against — a genre existing in genreLibrary
 * means nothing to a channel whose archetype doesn't list it here. Only
 * 'senior-morning' had ever been given the 28 oldpop-* ids (v3.61 TASK B);
 * a channel built with any other archetype (including no explicit pick,
 * which defaults through Step1Channel's card grid) saw zero of them.
 *
 * This list is 60s-80s Western old-pop broadened past the pure oldpop-*
 * family: the 5 general pop/chanson genres, the senior-appropriate slice of
 * the (much larger, mostly 2020s-production) rnb category, and the vocal/
 * standards/bossa/lounge slice of the jazz category — deliberately
 * excluding trap-soul/bedroom-pop/city-pop-modern/bebop/fusion/acid-jazz
 * flavored ids, which read as modern production choices this channel's
 * "warm 60s-80s" identity shouldn't blend into. See
 * getVisibleGenresForArchetype('oldpop-lounge').length >= 60 in
 * tests/genreLibrary.test.ts.
 *
 * codex 지시문 07 (TASK B) — real policy clarification, not a behavior
 * change: this comment used to also list "alt-R&B" among the excluded
 * styles, but 'alt-rnb'/'neo-soul' were both ALREADY real, deliberately
 * included/tested members of this list (tests/genreLibrary.test.ts's own
 * real "oldpop-lounge exposes 60+ genres" test asserts their presence,
 * and its own separate "deliberately excluded" list never named them) —
 * a stale comment claim, not the actual policy. Corrected here to match
 * the real, tested behavior: warmer/vocal-led R&B flavors (alt-rnb,
 * neo-soul, contemporary-rnb) are intentionally shared with
 * modern-chill's own broader R&B set (both archetypes draw on the same
 * real genre catalog for a mood that legitimately spans "senior warm" and
 * "2030s chill") — see tests/genreDifferentiation.test.ts's own real,
 * bounded overlap check across this channel's 3 sibling senior-oldpop
 * archetypes (modern-chill/city-night/oldpop-lounge) for the policy that
 * now measures and enforces this stays a MINORITY share of each list,
 * not a majority overlap.
 */
export const OLDPOP_LOUNGE_CORE_GENRE_IDS = [
  ...SENIOR_MORNING_CORE_GENRE_IDS.filter(id => id.startsWith('oldpop-')),
  // General 60s-80s-adjacent pop/chanson (genreLibrary's 'pop' category).
  'adult-contemporary',
  'acoustic-pop',
  'folk-pop',
  'soft-rock',
  'chanson',
  // Timeless ballad/jazz-lounge genres already in senior-morning's core tier.
  'healing-ballad',
  'piano-ballad',
  'jazz-pop',
  'bossa-cafe',
  'smooth-jazz-lounge',
  // Senior-appropriate R&B/soul — warm, vocal-led, pre-2020s-production flavored.
  'retro-soul-pop',
  'neo-soul',
  'alt-rnb',
  'contemporary-rnb',
  'rnb-old-school-romance-rnb',
  'rnb-soulful-gospel-warmth',
  'rnb-gospel-soul-lift',
  'rnb-quiet-storm-baritone',
  'rnb-velvet-baritone-rnb',
  'rnb-silky-studio-rnb',
  'rnb-soulful-male-rnb',
  'rnb-soul-infused-female',
  'rnb-romantic-rnb',
  'rnb-emotional-female-rnb',
  'rnb-smooth-clean-rnb',
  // Vocal jazz / standards / bossa / lounge — not bebop/fusion/acid-jazz/jazz-rap.
  'jazz-classic-vocal-lounge',
  'jazz-soft-vocal-trio',
  'jazz-jazz-ballad-vocal',
  'jazz-smooth-sax-vocal',
  'jazz-bossa-vocal-jazz',
  'jazz-torch-vocal-jazz',
  'jazz-swing-crooner-ballroom',
  'jazz-cabaret-jazz',
  'jazz-hotel-lounge-jazz',
  'jazz-contemporary-vocal-jazz'
] as const;

/**
 * 지시문 51 (TASK A-1) — 실측(check:genre-utilization): lofi-study가 이
 * 배열을 빈 채로 둔 탓에 getCoreGenreIdsForArchetype이 자기 폴백
 * (SENIOR_MORNING_CORE_GENRE_IDS)으로 떨어졌다 — "장르가 안 골고루
 * 쓰인다" 수준이 아니라 lofi-study-main 채널(preferredGenres 14종, 전부
 * lofi-*)의 장르가 추천 후보 풀에 단 하나도 없어 시니어 장르만 추천되는
 * 채널-불일치 결함이었다(실측: 활용률 0%). lofi-study-main의
 * preferredGenres를 그대로 core 목록으로 채택한다 — 이 아키타입은
 * 채널이 하나뿐이라(§data/presets.ts) preferredGenres 자체가 이미 그
 * 채널의 실제 장르 전부다.
 */
const LOFI_STUDY_CORE_GENRE_IDS = [
  'lofi-jazz-piano-lofi', 'lofi-coffee-shop-lofi', 'lofi-rainy-day-lofi',
  'lofi-minimal-focus-lofi', 'lofi-late-study-lofi', 'lofi-ambient-lofi',
  'lofi-twilight-lofi', 'lofi-hazy-guitar-lofi', 'lofi-vinyl-soft-lofi',
  'lofi-instrumental-jazz-lofi', 'lofi-jazz-lounge-lofi', 'lofi-minimal-beats-lofi',
  'lofi-rainy-cafe-lofi', 'lofi-jazz-bass-lofi'
] as const;

export const CORE_GENRE_IDS_BY_ARCHETYPE: Record<ChannelArchetype, readonly string[]> = {
  'senior-morning': SENIOR_MORNING_CORE_GENRE_IDS,
  'showa-cafe': SHOWA_CAFE_CORE_GENRE_IDS,
  christmas: [],
  'lofi-study': LOFI_STUDY_CORE_GENRE_IDS,
  kids: KIDS_CORE_GENRE_IDS,
  'showa-70s': SHOWA_70S_CORE_GENRE_IDS,
  j2000s: J2000S_CORE_GENRE_IDS,
  'modern-chill': MODERN_CHILL_CORE_GENRE_IDS,
  'city-night': CITY_NIGHT_CORE_GENRE_IDS,
  'oldpop-lounge': OLDPOP_LOUNGE_CORE_GENRE_IDS,
  'kr-2030-pop': KR_2030_CORE_GENRE_IDS,
  'jp-2030-pop': JP_2030_CORE_GENRE_IDS,
  // TASK D1 §3-2/§7 — kr-kids/jp-kids archetypes exist structurally now (Approach A).
  // TASK E1 — kr-kids's genre layer filled in (krkidsGenrePacks, 7 genres).
  // TASK F1 — jp-kids's genre layer filled in (jpkidsGenrePacks, 7 genres).
  'kr-kids-song': KR_KIDS_CORE_GENRE_IDS,
  'jp-kids-song': JP_KIDS_CORE_GENRE_IDS,
  // TASK K2 — kr-idol-male's genre layer filled in (kridolMaleGenrePacks, 7
  // genres, shared with kr-idol-female per §3-3). 'kr-idol-female' stays []
  // like christmas/lofi-study above — K3's own workspace/genre-visibility
  // wiring, not K2's.
  'kr-idol-male': KRIDOL_M_CORE_GENRE_IDS,
  'kr-idol-female': KRIDOL_F_CORE_GENRE_IDS
};

const allCoreGenreIds = new Set<string>([
  ...SENIOR_MORNING_CORE_GENRE_IDS,
  ...SHOWA_CAFE_CORE_GENRE_IDS,
  ...SHOWA_70S_CORE_GENRE_IDS,
  ...J2000S_CORE_GENRE_IDS,
  ...MODERN_CHILL_CORE_GENRE_IDS,
  ...CITY_NIGHT_CORE_GENRE_IDS,
  ...KR_2030_CORE_GENRE_IDS,
  ...JP_2030_CORE_GENRE_IDS,
  ...KR_KIDS_CORE_GENRE_IDS,
  ...JP_KIDS_CORE_GENRE_IDS,
  ...KRIDOL_M_CORE_GENRE_IDS
]);

const quietCafeSignals = [
  'acoustic',
  'ballad',
  'baritone',
  'bossa',
  'cafe',
  'classic',
  'comfort',
  'dinner',
  'healing',
  'intimate',
  'lounge',
  'mellow',
  'minimal',
  'night',
  'piano',
  'rain',
  'retro',
  'slow',
  'soft',
  'trio',
  'vocal',
  'warm'
];

const aggressiveOrWrongChannelSignals = [
  'acid',
  'bebop',
  'big band',
  'boom bap',
  'cabaret',
  'club',
  'disco',
  'experimental',
  'free',
  'funky',
  'hard bop',
  'hiphop',
  'new orleans',
  'nu jazz',
  'rap',
  'scat',
  'trap',
  'uptempo'
];

function textForGenreSignals(input: {
  id: string;
  label: string;
  categoryId?: string;
  aliases?: string[];
  goodFor?: string[];
  moods?: string[];
  audiences?: string[];
}) {
  return [
    input.id,
    input.label,
    input.categoryId,
    ...(input.aliases || []),
    ...(input.goodFor || []),
    ...(input.moods || []),
    ...(input.audiences || [])
  ].join(' ').toLowerCase();
}

function containsAny(haystack: string, needles: string[]) {
  return needles.some(needle => haystack.includes(needle));
}

function inferArchetypes(input: {
  id: string;
  label: string;
  categoryId?: string;
  aliases?: string[];
  goodFor?: string[];
  moods?: string[];
  audiences?: string[];
}): ChannelArchetype[] {
  const text = textForGenreSignals(input);
  const archetypes = new Set<ChannelArchetype>();
  for (const [archetype, ids] of Object.entries(CORE_GENRE_IDS_BY_ARCHETYPE) as [ChannelArchetype, readonly string[]][]) {
    if (ids.includes(input.id)) archetypes.add(archetype);
  }

  const quietEnough = containsAny(text, quietCafeSignals) && !containsAny(text, aggressiveOrWrongChannelSignals);
  if (quietEnough && ['pop', 'jazz', 'city-pop', 'lofi', 'ballad', 'seasonal'].includes(input.categoryId || '')) {
    archetypes.add('senior-morning');
  }
  if (quietEnough && ['jazz', 'city-pop', 'lofi', 'seasonal'].includes(input.categoryId || '')) {
    archetypes.add('showa-cafe');
  }
  if (text.includes('christmas') || text.includes('holiday') || text.includes('winter')) {
    archetypes.add('christmas');
  }
  if ((input.categoryId === 'lofi' || text.includes('study') || text.includes('focus')) && !containsAny(text, ['rap', 'trap'])) {
    archetypes.add('lofi-study');
  }
  if (input.categoryId === 'pop' && containsAny(text, ['family', 'folk', 'bright', 'upbeat'])) {
    archetypes.add('kids');
  }
  if (
    ['rnb', 'lofi', 'hiphop'].includes(input.categoryId || '') ||
    containsAny(text, ['r&b', 'rnb', 'neo soul', 'neo-soul', 'trap soul', 'trap-soul', 'chill rap', 'jazz rap', 'boom bap', 'hiphop', 'hip-hop'])
  ) {
    archetypes.add('modern-chill');
  }
  if (
    input.categoryId === 'city-pop' ||
    containsAny(text, ['city pop', 'city-pop', 'future funk', 'future-funk', 'disco pop', 'disco-pop', 'bedroom pop', 'bedroom-pop', 'night drive'])
  ) {
    archetypes.add('city-night');
  }

  return Array.from(archetypes);
}

export function genreTierForId(id: string): GenreTier {
  return allCoreGenreIds.has(id) ? 'core' : 'extended';
}

export function withGenreVisibility<T extends GenrePack>(genre: T): T & { archetypes: ChannelArchetype[]; tier: GenreTier } {
  const eraTag = genre.eraTag ?? GENRE_ERA_TAG_OVERRIDES[genre.id] ?? ERA_BUCKET_BY_GENRE_ID[genre.id];
  return {
    ...genre,
    ...(eraTag ? { eraTag } : {}),
    archetypes: genre.archetypes?.length
      ? genre.archetypes
      : inferArchetypes({
        id: genre.id,
        label: genre.label,
        categoryId: genre.categoryId,
        aliases: genre.aliases,
        goodFor: genre.goodFor,
        moods: genre.moods,
        audiences: genre.audiences
      }),
    tier: genre.tier || genreTierForId(genre.id)
  };
}

const categoryBases: Record<string, CategoryBase> = {
  jazz: {
    id: 'jazz',
    label: 'Jazz',
    rhythm: ['relaxed swing pocket', 'brushed kit motion'],
    instruments: ['upright bass', 'brushed drums', 'piano'],
    vocal: ['mature natural vocal or instrumental lead'],
    production: ['warm live-room mix', 'close club ambience'],
    harmony: ['extended jazz chords', 'maj7 and 9th color'],
    tempo: [82, 128],
    moods: ['elegant', 'late-night', 'refined'],
    audiences: ['adult cafe listeners', 'jazz lounge playlists'],
    avoidTraits: ['harsh brass peaks', 'showy solo clutter']
  },
  'city-pop': {
    id: 'city-pop',
    label: 'City Pop',
    rhythm: ['smooth four-on-the-floor-adjacent groove', 'syncopated bass movement'],
    instruments: ['clean electric guitar', 'electric piano', 'analog synth pad', 'round bass'],
    vocal: ['silky adult pop vocal'],
    production: ['polished retro-modern sheen', 'clean stereo mix'],
    harmony: ['jazz-colored pop chords', 'bright chorus lift'],
    tempo: [96, 118],
    moods: ['urban', 'nostalgic', 'night-drive'],
    audiences: ['city pop listeners', 'drive and cafe playlists'],
    avoidTraits: ['thin synthetic drums', 'cartoon retro tone']
  },
  rnb: {
    id: 'rnb',
    label: 'R&B and Soul',
    rhythm: ['laid-back pocket groove', 'soft backbeat'],
    instruments: ['electric piano', 'deep bass', 'minimal drums', 'synth pad'],
    vocal: ['smooth close-mic R&B vocal'],
    production: ['polished low-end focus', 'intimate studio space'],
    harmony: ['lush seventh chords', 'stacked background harmony'],
    tempo: [70, 100],
    moods: ['intimate', 'late-night', 'soulful'],
    audiences: ['R&B playlists', 'night listening'],
    avoidTraits: ['explicit sensuality', 'aggressive trap density']
  },
  lofi: {
    id: 'lofi',
    label: 'Lo-fi and Study',
    rhythm: ['slow head-nod beat', 'soft muted drums'],
    instruments: ['dusty piano', 'warm bass', 'mellow guitar', 'Rhodes'],
    vocal: ['optional soft close vocal'],
    production: ['tape-soft texture', 'subtle vinyl grain'],
    harmony: ['simple jazzy loop harmony', 'soft minor-to-major color'],
    tempo: [72, 94],
    moods: ['cozy', 'rainy', 'focused'],
    audiences: ['study playlists', 'coffee shop background'],
    avoidTraits: ['muddy mix', 'loud crackle', 'busy vocals']
  },
  ballad: {
    id: 'ballad',
    label: 'Ballad',
    rhythm: ['slow steady pulse', 'restrained build'],
    instruments: ['piano', 'soft strings', 'warm bass'],
    vocal: ['emotional close-mic vocal'],
    production: ['clear vocal-front mix', 'gentle cinematic space'],
    harmony: ['emotional money-chord lift', 'subtle suspended chords'],
    tempo: [68, 92],
    moods: ['tender', 'reflective', 'hopeful'],
    audiences: ['ballad listeners', 'comfort playlists'],
    avoidTraits: ['shouting climax', 'melodramatic excess']
  }
};

const tagTraits: Record<string, Partial<Omit<StructuredGenrePack, 'id' | 'label' | 'styleCore' | 'goodFor' | 'categoryId' | 'source' | 'shortPrompt' | 'productionGuidance' | 'aliases'>>> = {
  acoustic: { instruments: ['fingerpicked acoustic guitar'], production: ['natural room detail'], moods: ['organic'] },
  ambient: { production: ['wide ambient tail'], rhythm: ['very sparse pulse'], moods: ['meditative'] },
  analog: { production: ['analog warmth'], instruments: ['vintage synth'], moods: ['retro'] },
  ballad: { rhythm: ['slow ballad pacing'], harmony: ['wide chorus cadence'], moods: ['emotional'] },
  bass: { instruments: ['featured bassline'], production: ['bass-forward balance'], rhythm: ['low-end-led groove'] },
  bossa: { rhythm: ['soft bossa syncopation'], instruments: ['nylon guitar', 'light shaker'], moods: ['breezy'] },
  brass: { instruments: ['muted brass section'], production: ['rounded brass accents'], moods: ['vintage'] },
  bright: { production: ['bright top-end polish'], moods: ['optimistic'] },
  chamber: { instruments: ['light chamber strings'], production: ['small ensemble space'], harmony: ['chamber-pop voicings'] },
  cinematic: { production: ['cinematic room bloom'], instruments: ['soft orchestral swell'], moods: ['sweeping'] },
  crooner: { vocal: ['smooth mature male croon'], moods: ['old-radio romance'] },
  dark: { production: ['shadowed low-mid texture'], harmony: ['minor-key tension'], moods: ['nocturnal'] },
  disco: { rhythm: ['gentle disco pulse'], instruments: ['tight rhythm guitar'], moods: ['danceable'] },
  duet: { vocal: ['male and female duet', 'balanced call-and-response phrasing'], harmony: ['two-part chorus harmony'] },
  dreamy: { production: ['soft reverb haze'], instruments: ['washed synth pad'], moods: ['dreamy'] },
  drums: { rhythm: ['active drum pocket'], production: ['crisp kit detail'] },
  electric: { instruments: ['electric bass', 'electric piano'], production: ['sleek studio tone'] },
  experimental: { rhythm: ['loose exploratory pulse'], harmony: ['open nonstandard voicings'], avoidTraits: ['random noise bursts'] },
  female: { vocal: ['airy female vocal', 'delicate close phrasing'] },
  focus: { moods: ['calm focus'], production: ['low-distraction arrangement'], avoidTraits: ['attention-grabbing fills'] },
  folk: { instruments: ['acoustic guitar'], production: ['hand-played intimacy'], moods: ['plainspoken'] },
  funk: { rhythm: ['syncopated funk pocket'], instruments: ['muted rhythm guitar', 'organ stabs'], moods: ['groovy'] },
  fusion: { rhythm: ['tight fusion groove'], instruments: ['electric bass', 'Rhodes'], harmony: ['advanced jazz-pop harmony'] },
  gospel: { vocal: ['soulful gospel-colored vocal'], instruments: ['organ touches'], harmony: ['uplifting stacked harmony'] },
  guitar: { instruments: ['mellow electric guitar'], production: ['guitar-led warmth'] },
  hiphop: { rhythm: ['laid-back hip-hop beat'], production: ['soft sample-like texture'] },
  instrumental: { vocal: ['no lead vocal'], production: ['instrumental focus'], avoidTraits: ['vocal ad-libs'] },
  intimate: { production: ['close-mic intimacy'], moods: ['personal'] },
  latin: { rhythm: ['light Latin syncopation'], instruments: ['hand percussion'], moods: ['vibrant'] },
  lounge: { production: ['velvet lounge ambience'], moods: ['classy'] },
  male: { vocal: ['warm male vocal', 'low-register emotional delivery'] },
  mellow: { rhythm: ['mellow mid-tempo flow'], production: ['soft transient control'], moods: ['relaxed'] },
  modern: { production: ['current clean mix'], moods: ['modern'] },
  noir: { instruments: ['muted trumpet'], production: ['rainy cinematic ambience'], moods: ['noir'] },
  organ: { instruments: ['warm organ'], harmony: ['soul-jazz chord color'] },
  piano: { instruments: ['piano-led arrangement'], harmony: ['piano chord suspensions'] },
  polished: { production: ['radio-ready polish'], avoidTraits: ['rough demo tone'] },
  rain: { production: ['soft rainy-window ambience'], moods: ['rainy', 'reflective'] },
  rap: { vocal: ['low conversational vocal'], rhythm: ['spoken pocket over groove'], avoidTraits: ['aggressive rap delivery'] },
  retro: { production: ['restrained vintage color'], moods: ['nostalgic'] },
  rhodes: { instruments: ['Rhodes piano'], harmony: ['warm electric-piano voicings'] },
  sax: { instruments: ['mellow saxophone lead'], production: ['rounded reed tone'] },
  seaside: { production: ['open-air coastal brightness'], moods: ['summer breeze'] },
  slow: { rhythm: ['slow tempo restraint'], moods: ['quiet'] },
  soul: { vocal: ['soulful phrasing'], rhythm: ['warm soul groove'], harmony: ['gospel-adjacent passing chords'] },
  spacious: { production: ['wide spacious mix'], harmony: ['open voicings'] },
  strings: { instruments: ['soft strings'], production: ['controlled string swell'] },
  summer: { moods: ['summer nostalgia'], production: ['sunlit mix color'] },
  swing: { rhythm: ['walking swing feel'], instruments: ['ride cymbal detail'] },
  synth: { instruments: ['analog synth pad'], production: ['glossy synth layer'] },
  tape: { production: ['tape flutter softness'], moods: ['faded memory'] },
  trap: { rhythm: ['minimal trap-soul pulse'], instruments: ['sub bass'], production: ['clean 808 low-end'], avoidTraits: ['hard trap aggression'] },
  trio: { instruments: ['piano trio setup'], production: ['small ensemble realism'] },
  trumpet: { instruments: ['muted trumpet'], production: ['breathy brass lead'] },
  upbeat: { rhythm: ['upbeat pop pulse'], moods: ['cheerful'] },
  vocal: { vocal: ['front-and-center vocal'], production: ['clear lyric intelligibility'] },
  waltz: { rhythm: ['graceful 3/4 motion'], moods: ['graceful'] }
};

function seed(slug: string, label: string, tagText: string, tempo?: [number, number]): GenreVariantSeed {
  return { slug, label, tags: tagText.split(/\s+/).filter(Boolean), tempo };
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function mergeTraitArrays(base: string[], tags: string[], key: keyof Pick<StructuredGenrePack, 'rhythm' | 'instruments' | 'vocal' | 'production' | 'harmony' | 'moods' | 'audiences' | 'avoidTraits'>) {
  return unique([
    ...base,
    ...tags.flatMap(tag => (tagTraits[tag]?.[key] as string[] | undefined) || [])
  ]).slice(0, 6);
}

function makeShortPrompt(profile: Pick<StructuredGenrePack, 'label' | 'rhythm' | 'instruments' | 'vocal' | 'production' | 'harmony' | 'tempo' | 'moods'>) {
  return [
    profile.label,
    profile.rhythm[0],
    profile.vocal[0],
    profile.instruments.slice(0, 2).join(' + '),
    profile.production[0],
    `${profile.tempo[0]}-${profile.tempo[1]} BPM`
  ].filter(Boolean).join(', ');
}

function makeProductionGuidance(profile: Pick<StructuredGenrePack, 'label' | 'rhythm' | 'instruments' | 'vocal' | 'production' | 'harmony' | 'avoidTraits'>) {
  return `${profile.label}: build around ${profile.rhythm.slice(0, 2).join(' and ')}, keep ${profile.vocal[0]}, feature ${profile.instruments.slice(0, 4).join(', ')}, use ${profile.harmony[0]}, mix with ${profile.production.slice(0, 2).join(' and ')}, avoid ${profile.avoidTraits.slice(0, 3).join(', ')}.`;
}

function makeProfile(categoryId: keyof typeof categoryBases, variant: GenreVariantSeed): StructuredGenrePack {
  const base = categoryBases[categoryId];
  const rhythm = mergeTraitArrays(base.rhythm, variant.tags, 'rhythm');
  const instruments = mergeTraitArrays(base.instruments, variant.tags, 'instruments');
  const vocal = mergeTraitArrays(base.vocal, variant.tags, 'vocal');
  const production = mergeTraitArrays(base.production, variant.tags, 'production');
  const harmony = mergeTraitArrays(base.harmony, variant.tags, 'harmony');
  const moods = mergeTraitArrays(base.moods, variant.tags, 'moods');
  const audiences = mergeTraitArrays(base.audiences, variant.tags, 'audiences');
  const avoidTraits = unique([...sharedAvoid, ...mergeTraitArrays(base.avoidTraits, variant.tags, 'avoidTraits')]).slice(0, 8);
  const tempo = variant.tempo || base.tempo;
  const id = `${categoryId}-${variant.slug}`;
  const shape = { label: variant.label, rhythm, instruments, vocal, production, harmony, tempo, moods, avoidTraits };
  const visibility = withGenreVisibility({
    id,
    label: variant.label,
    styleCore: '',
    instruments,
    tempoRange: tempo,
    goodFor: audiences,
    categoryId,
    aliases: variant.tags,
    moods,
    audiences
  });

  return {
    id,
    label: variant.label,
    categoryId,
    archetypes: visibility.archetypes,
    tier: visibility.tier,
    source: 'notion-analysis',
    aliases: variant.tags,
    rhythm,
    instruments,
    vocal,
    production,
    harmony,
    tempo,
    tempoRange: tempo,
    moods,
    audiences,
    avoidTraits,
    goodFor: audiences,
    shortPrompt: makeShortPrompt(shape),
    styleCore: `${variant.label}, ${rhythm.slice(0, 2).join(', ')}, ${harmony[0]}, ${production[0]}`,
    signatureSound: `${rhythm[0]}, ${instruments.slice(0, 3).join(', ')}, ${production[0]}, ${harmony[0]}`,
    productionGuidance: makeProductionGuidance(shape)
  };
}

function legacyGenrePack(
  pack: GenrePack,
  categoryId: string,
  structured: Pick<StructuredGenrePack, 'rhythm' | 'vocal' | 'production' | 'harmony' | 'moods' | 'audiences' | 'avoidTraits'>
): StructuredGenrePack {
  const tempo = pack.tempoRange;
  const profile = {
    label: pack.label,
    rhythm: structured.rhythm,
    instruments: pack.instruments,
    vocal: structured.vocal,
    production: structured.production,
    signatureSound: `${structured.rhythm[0]}, ${pack.instruments.slice(0, 3).join(', ')}, ${structured.production[0]}, ${structured.harmony[0]}`,
    harmony: structured.harmony,
    tempo,
    moods: structured.moods,
    avoidTraits: unique([...sharedAvoid, ...structured.avoidTraits])
  };

  const visibility = withGenreVisibility({
    ...pack,
    categoryId,
    moods: structured.moods,
    audiences: structured.audiences
  });

  return {
    ...pack,
    categoryId,
    archetypes: visibility.archetypes,
    tier: visibility.tier,
    source: 'legacy-preset',
    rhythm: structured.rhythm,
    vocal: structured.vocal,
    production: structured.production,
    harmony: structured.harmony,
    tempo,
    moods: structured.moods,
    audiences: structured.audiences,
    avoidTraits: profile.avoidTraits,
    shortPrompt: makeShortPrompt(profile),
    productionGuidance: makeProductionGuidance(profile)
  };
}

export const LEAD_ARRANGEMENT_NARRATIVES = {
  'adult-contemporary': 'BPM 96-106; Verse stays in a straight 4/4 pop feel with sustained piano pads and clean strummed acoustic, pre-chorus adds simple diatonic lift without swing or solo, chorus uses a smooth radio lift, hook entry lands cleanly on the downbeat, mix is warm and direct',
  'acoustic-pop': 'BPM 92-104; Verse begins with fingerpicked guitar and dry room vocal, pre-chorus adds soft piano answers and a gentle upper-harmony lift, chorus widens into hand-played acoustic strums with a clear singalong center, hook entry uses a rising strum into a one-beat pause, mix feels natural close and unforced',
  'jazz-pop': 'BPM 82-96; Verse sits in a light swing feel with walking upright bass and ii-V-I turnarounds, pre-chorus leans into maj7/9/13 extended voicings, chorus opens with brushed snare and ride cymbal comping, hook entry uses a small jazz pickup before the downbeat, bridge includes a short improvised piano or saxophone solo, mix has warm analog room tone',
  'showa-modern': 'BPM 92-104; Verse sits in restrained kissaten swing with Rhodes and mellow guitar answering the vocal, pre-chorus opens soft strings and a rising bass step, chorus lands bittersweet but refined with brighter chord color, hook entry uses a two-bar dropout into the chorus downbeat, mix has analog tape warmth and close male-vocal presence',
  'city-pop-soft': 'BPM 98-114; Verse rides a smooth electric-piano groove with clean guitar flickers, pre-chorus filters the synth pad open and nudges the bass upward, chorus becomes wider and silkier without turning flashy, hook entry uses a glossy rising sweep into a tight drum pickup, mix is clean late-night polish with soft analog edges',
  'kids-bright-pop': 'BPM 104-120; Verse starts simple and bouncy with ukulele claps and childlike call lines, pre-chorus briefly thins the backing so the children can breathe before the hook, chorus opens with one clear handclap on the first beat and bright group singing with answer-back space, hook entry adds a tiny stop-and-go clap pickup, final chorus lets a few children echo the hook one octave higher, mix is clean sunny and never noisy',
  'kayokyoku-70s': 'BPM 78-94; Verse begins with close Japanese vocal over brushed kit and electric piano, pre-chorus opens live strings and a brass answer phrase, chorus lifts with a graceful kayokyoku cadence, hook entry uses a short drum-bass dropout before the downbeat, mix keeps analog tape saturation, spring reverb, and narrow stereo warmth',
  'new-music-70s': 'BPM 86-102; Verse stays plainspoken with acoustic guitar and piano, pre-chorus adds band drums and a bass climb, chorus turns wider with refined add9 color without modern gloss, hook entry uses an upward guitar strum into a one-beat breath, mix feels live, close-mic, and lightly tape-worn',
  'jpop-2000s-ballad': 'BPM 72-88; Verse opens with piano and intimate Japanese vocal, pre-chorus adds string lift and stacked harmony shadows, chorus expands into a big early-2000s pop-ballad refrain, hook entry uses a cymbal swell and brief vocal breath, mix is bright digital polish with firm compression and clean high-end detail',
  'alt-rnb': 'BPM 68-86; Verse stays close and weightless over a slow 16th-note pocket, filtered pads, and dry whispered ad-libs, pre-chorus widens the reverb tail and lets the sub bass answer the vocal, chorus lands with doubled harmonies but keeps space between hits, hook entry uses a filter sweep into a half-beat drum dropout, mix is deep, glossy, and nocturnal',
  'neo-soul': 'BPM 78-96; Verse sits in a live pocket with Rhodes voicings, brushed ghost notes, and bass slides around the vocal, pre-chorus opens stacked background answers and suspended chords, chorus warms into richer harmony without shouting, hook entry uses a short drum fill and bass walk-up, mix feels close-mic, hand-played, and low-end rounded',
  'trap-soul': 'BPM 62-82; Verse is sparse with dark pads, 808 slides, and clipped hi-hat rolls under doubled vocal shadows, pre-chorus cuts the kick for two bars while the pad rises, chorus drops into a heavier sub-bass hook with tight ad-lib echoes, hook entry uses a breathy vocal gap before the 808 returns, mix is dark, modern, and bass-forward',
  'chill-rap': 'BPM 70-85; Verse keeps an unhurried conversational flow over lofi drums and a soft sample-texture loop, pre-chorus lets a sung response or humming pad widen the space, chorus stays melodic and easy rather than aggressive, hook entry uses a one-bar drum mute with a vinyl-stop feel, mix is relaxed, dusty, and vocal-forward',
  'city-pop-modern': 'BPM 105-118; Verse rides clean chorus guitar, slap bass, and electric-piano sparkle with restrained vocal motion, pre-chorus opens analog synth lead and a rising bass push, chorus turns bright and wider with stacked pop harmonies, hook entry uses a glossy riser into a tight drum pickup, mix is clear night-drive polish with retro color kept modern',
  'disco-pop-2020s': 'BPM 112-124; Verse locks to a dry four-on-the-floor kick and muted guitar chop, pre-chorus filters the strings and synth bass upward, chorus pops open with bright stacked vocals and tight string stabs, hook entry uses a short kick dropout before the first chorus word, mix is crisp, wide, compressed, and dance-floor clean'
} as const satisfies Partial<Record<string, string>>;

const legacyGenreProfiles: StructuredGenrePack[] = [
  legacyGenrePack({ id: 'adult-contemporary', label: 'Adult Contemporary Pop', styleCore: 'warm adult contemporary pop, radio-friendly, gentle emotional chorus lift', arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['adult-contemporary'], instruments: ['sustained piano pads', 'clean strummed acoustic guitar', 'straight-pop drum kit', 'rounded electric bass'], tempoRange: [96, 106], goodFor: ['senior playlist', 'morning coffee', 'year-end'] }, 'pop', { rhythm: ['straight 4/4 pop feel'], vocal: ['mature clear vocal'], production: ['radio-friendly polish'], harmony: ['simple diatonic harmony'], moods: ['warm', 'familiar'], audiences: ['senior playlist', 'morning coffee'], avoidTraits: ['swing', 'solo'] }),
  legacyGenrePack({ id: 'acoustic-pop', label: 'Acoustic Pop', styleCore: 'nostalgic acoustic pop, clear vocal, intimate warm arrangement', arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['acoustic-pop'], instruments: ['fingerpicked acoustic guitar', 'soft piano', 'light percussion'], tempoRange: [92, 104], goodFor: ['home listening', 'walks', 'coffee'] }, 'pop', { rhythm: ['light acoustic pulse'], vocal: ['clear intimate vocal'], production: ['natural acoustic room'], harmony: ['simple pop lift'], moods: ['nostalgic', 'gentle'], audiences: ['home listening', 'walking playlists'], avoidTraits: ['campfire cliche'] }),
  legacyGenrePack({ id: 'jazz-pop', label: 'Acoustic Jazz Pop', styleCore: 'nostalgic acoustic jazz-pop, elegant cafe mood, gentle maj7 and add9 colors', arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['jazz-pop'], instruments: ['Rhodes comping piano', 'walking upright bass', 'brushed snare with ride comping', 'mellow jazz guitar'], tempoRange: [82, 96], goodFor: ['kissaten', 'night cafe', 'winter'], vocalPreference: { male: 0.15, female: 0.7, mixed: 0.15 } }, 'jazz', { rhythm: ['light swing feel', 'walking bass'], vocal: ['warm cafe vocal'], production: ['warm analog room tone'], harmony: ['ii-V-I turnarounds', 'maj7/9/13 extended voicings'], moods: ['elegant', 'nostalgic'], audiences: ['cafe playlists', 'winter listening'], avoidTraits: ['flat straight pop', 'showy solo clutter'] }),
  legacyGenrePack({ id: 'showa-modern', label: 'Showa Modern Cafe', styleCore: 'showa-modern cafe mood, nostalgic but refined, subtle retro Japanese kissaten warmth', arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['showa-modern'], instruments: ['Rhodes', 'mellow jazz guitar', 'upright bass', 'soft strings'], tempoRange: [92, 104], goodFor: ['Japan channel', 'retro cafe', 'autumn'] }, 'jazz', { rhythm: ['restrained cafe swing'], vocal: ['mature soft lead vocal'], production: ['subtle retro warmth'], harmony: ['jazz-colored cafe chords'], moods: ['refined', 'bittersweet'], audiences: ['Japan channel', 'retro cafe'], avoidTraits: ['cheap retro props'] }),
  legacyGenrePack({ id: 'city-pop-soft', label: 'Soft City Pop', styleCore: 'soft city-pop inspired adult pop, smooth groove, clean late-night city mood', arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['city-pop-soft'], instruments: ['electric piano', 'clean guitar', 'soft synth pad', 'smooth bass'], tempoRange: [98, 114], goodFor: ['Japan', 'night city', 'stylish senior'] }, 'city-pop', { rhythm: ['smooth city-pop groove'], vocal: ['silky adult pop vocal'], production: ['clean late-night polish'], harmony: ['jazzy pop chords'], moods: ['urban', 'nostalgic'], audiences: ['night city playlists', 'Japan channel'], avoidTraits: ['overbright synth brass'] }),
  legacyGenrePack({ id: 'lofi-cafe', label: 'Lo-fi Cafe Pop', styleCore: 'warm lo-fi cafe pop, relaxed groove, soft vinyl texture', instruments: ['lo-fi drums', 'electric piano', 'warm bass', 'soft guitar'], tempoRange: [82, 96], goodFor: ['study', 'coffee', 'background'] }, 'lofi', { rhythm: ['relaxed lo-fi groove'], vocal: ['optional soft vocal'], production: ['soft vinyl texture'], harmony: ['simple jazzy loop'], moods: ['cozy', 'focused'], audiences: ['study', 'coffee'], avoidTraits: ['loud crackle'] }),
  legacyGenrePack({ id: 'christmas-soft-pop', label: 'Soft Christmas Pop', styleCore: 'nostalgic Christmas acoustic pop, warm and not childish, subtle bells only in chorus', instruments: ['Rhodes', 'acoustic guitar', 'light sleigh bells', 'soft bass'], tempoRange: [96, 106], goodFor: ['Christmas', 'winter morning', 'year-end'] }, 'seasonal', { rhythm: ['gentle seasonal pop pulse'], vocal: ['warm clear vocal'], production: ['subtle holiday sparkle'], harmony: ['hopeful chorus lift'], moods: ['year-end warmth', 'nostalgic'], audiences: ['Christmas playlists', 'winter morning'], avoidTraits: ['childish novelty bells'] }),
  legacyGenrePack({ id: 'healing-ballad', label: 'Healing Ballad', styleCore: 'warm healing ballad, restrained emotion, hopeful ending', instruments: ['piano', 'acoustic guitar', 'soft strings', 'brushes'], tempoRange: [84, 98], goodFor: ['comfort', 'senior', 'night'] }, 'ballad', { rhythm: ['slow restrained pulse'], vocal: ['gentle emotional vocal'], production: ['soft comfort mix'], harmony: ['hopeful resolution'], moods: ['healing', 'reflective'], audiences: ['comfort', 'senior'], avoidTraits: ['dramatic belting'] }),
  legacyGenrePack({ id: 'folk-pop', label: 'Folk Pop', styleCore: 'clean folk-pop storytelling, acoustic warmth, natural sing-along chorus', instruments: ['strummed acoustic guitar', 'light mandolin texture', 'soft piano', 'upright bass'], tempoRange: [92, 108], goodFor: ['family', 'walking', 'spring'] }, 'pop', { rhythm: ['strummed folk-pop pulse'], vocal: ['plainspoken storyteller vocal'], production: ['natural acoustic warmth'], harmony: ['sing-along chorus lift'], moods: ['fresh', 'friendly'], audiences: ['family', 'walking'], avoidTraits: ['rustic parody'] }),
  legacyGenrePack({ id: 'bossa-cafe', label: 'Bossa Cafe Pop', styleCore: 'soft bossa cafe pop, relaxed syncopation, elegant warm vocal', instruments: ['nylon guitar', 'Rhodes', 'brush kit', 'upright bass', 'light shaker'], tempoRange: [88, 102], goodFor: ['summer cafe', 'morning', 'Japan and Korea'], vocalPreference: { male: 0.15, female: 0.7, mixed: 0.15 } }, 'jazz', { rhythm: ['soft bossa syncopation'], vocal: ['elegant warm vocal'], production: ['sunlit cafe mix'], harmony: ['bossa jazz chord color'], moods: ['breezy', 'romantic'], audiences: ['summer cafe', 'morning'], avoidTraits: ['tourist-lounge cliche'] }),
  legacyGenrePack({ id: 'soft-rock', label: 'Soft Rock Radio', styleCore: 'polished soft rock radio arrangement, warm guitars, restrained chorus lift', instruments: ['clean electric guitar', 'acoustic guitar', 'piano', 'steady soft drums'], tempoRange: [96, 112], goodFor: ['drive', 'memory', 'all ages'] }, 'pop', { rhythm: ['steady soft rock pulse'], vocal: ['clear adult vocal'], production: ['polished radio arrangement'], harmony: ['restrained chorus lift'], moods: ['road memory', 'hopeful'], audiences: ['drive', 'all ages'], avoidTraits: ['arena rock excess'] }),
  legacyGenrePack({ id: 'piano-ballad', label: 'Piano Pop Ballad', styleCore: 'piano-led pop ballad, intimate verse, gentle cinematic chorus', instruments: ['felt piano', 'soft strings', 'subtle cymbal swells', 'warm bass'], tempoRange: [78, 92], goodFor: ['night', 'comfort', 'winter'] }, 'ballad', { rhythm: ['slow piano-led pulse'], vocal: ['intimate verse vocal'], production: ['gentle cinematic chorus space'], harmony: ['piano suspended chords'], moods: ['night', 'comfort'], audiences: ['winter', 'night'], avoidTraits: ['oversized climax'] }),
  legacyGenrePack({ id: 'retro-soul-pop', label: 'Retro Soul Pop', styleCore: 'soft retro soul pop, warm groove, hand-played feel, tasteful backing vocals', instruments: ['Wurlitzer', 'muted guitar', 'smooth bass', 'light soul drums'], tempoRange: [88, 104], goodFor: ['radio', 'coffee', 'hopeful mood'] }, 'rnb', { rhythm: ['warm soul-pop groove'], vocal: ['soulful lead with tasteful backing vocals'], production: ['hand-played retro warmth'], harmony: ['soul seventh chords'], moods: ['hopeful', 'warm'], audiences: ['radio', 'coffee'], avoidTraits: ['overdone retro filter'] }),
  legacyGenrePack({ id: 'synthwave-mellow', label: 'Mellow Synthwave Pop', styleCore: 'mellow synthwave pop, nostalgic neon pads, clean modern mix, not aggressive', instruments: ['soft analog synth pad', 'electric piano', 'clean guitar', 'warm electronic drums'], tempoRange: [92, 108], goodFor: ['night drive', 'retro channel', 'twenties'] }, 'electronic', { rhythm: ['mellow electronic pulse'], vocal: ['clean pop vocal'], production: ['nostalgic neon pads', 'modern mix control'], harmony: ['minor-to-major synth-pop lift'], moods: ['night drive', 'retro'], audiences: ['twenties', 'retro channel'], avoidTraits: ['aggressive synthwave edge'] }),
  // TASK v3.61 (TASK B-2) — chanson/smooth-jazz-lounge (TASK v3.56 Part 3)
  // were registered only in presets.ts's rawGenrePacks, never in this
  // file's own legacyGenreProfiles array — a disclosed UI-only gap when it
  // was made (see the kids-* precedent above), but it turned out to also
  // silently break conceptAgent.ts's keyword routing: getCoreGenresForArchetype
  // reads genreLibrary (this array), so `coreGenreIds.has('chanson')` was
  // always false and rankFromRules discarded every "샹송" keyword match
  // before it could reach genreAllocation. Mirrors presets.ts's own
  // definitions exactly (same instruments/tempoRange/styleCore) so both
  // stay in sync.
  legacyGenrePack({ id: 'chanson', label: 'Chanson Cafe', styleCore: 'French chanson cafe pop, musette accordion tremolo, intimate close-mic vocal, minor-key melancholy', instruments: ['musette accordion', 'nylon guitar', 'upright bass', 'brushed drums'], tempoRange: [84, 100], goodFor: ['Parisian cafe', 'evening listening', 'Europe-inspired senior playlist'] }, 'pop', { rhythm: ['slow waltz or 4/4 cafe pulse'], vocal: ['intimate close-mic vocal'], production: ['Parisian cafe room tone'], harmony: ['minor-key melancholy'], moods: ['melancholic', 'elegant'], audiences: ['Parisian cafe', 'evening listening'], avoidTraits: ['upbeat cabaret parody'] }),
  legacyGenrePack({ id: 'smooth-jazz-lounge', label: 'Smooth Jazz Lounge', styleCore: 'smooth jazz lounge, cocktail-lounge shuffle swing, vibraphone comping, saxophone bridge solo', instruments: ['vibraphone', 'walking upright bass', 'brushed ride cymbal', 'mellow saxophone'], tempoRange: [86, 104], goodFor: ['evening lounge', 'dinner cafe', 'refined senior playlist'], vocalPreference: { male: 0.15, female: 0.7, mixed: 0.15 } }, 'jazz', { rhythm: ['cocktail-lounge shuffle swing'], vocal: ['optional mellow lounge vocal'], production: ['dim analog lounge room tone'], harmony: ['ii-V-I turnarounds'], moods: ['refined', 'relaxed'], audiences: ['evening lounge', 'dinner cafe'], avoidTraits: ['bebop-fast tempo', 'harsh saxophone tone'] })
];

/**
 * TASK v3.39 — kids channel genres, registered directly into this file's own
 * genreLibrary array (previously only in data/presets.ts's rawGenrePacks —
 * see the TASK H2 comment above on that pre-existing legacy/genreLibrary
 * split). Without an entry here, getVisibleGenresForArchetype('kids')'s chip
 * picker and getGenreById always came back empty/undefined for these 3 ids
 * even though real generation (which reads presets.ts's genrePacks, not this
 * file's) worked correctly — a known, disclosed UI-only gap this closes.
 * `tier: 'core'` is set explicitly (these ids aren't in allCoreGenreIds,
 * which only tracks the senior-morning/showa-cafe lists) so
 * isCoreGenreForArchetype treats them as core for the kids archetype, same
 * as KIDS_CORE_GENRE_IDS already intends.
 */
const kidsGenreProfiles: StructuredGenrePack[] = [
  legacyGenrePack({ id: 'kids-bright-pop', label: 'Bright Kids Pop', styleCore: 'bright cheerful children\'s pop, simple catchy melody, clean upbeat production', arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['kids-bright-pop'], instruments: ['ukulele', 'glockenspiel', 'clean acoustic guitar', 'light hand percussion'], tempoRange: [104, 120], goodFor: ['kids playlist', 'daytime play', 'singalong'], archetypes: ['kids'], tier: 'core' }, 'kids', { rhythm: ['bouncy pop pulse'], vocal: ['bright childlike vocal'], production: ['clean upbeat mix'], harmony: ['simple major-key pop lift'], moods: ['bright', 'playful'], audiences: ['kids playlist', 'daytime play'], avoidTraits: ['scary or frightening themes', 'adult romantic themes'] }),
  legacyGenrePack({ id: 'kids-acoustic-singalong', label: 'Kids Acoustic Singalong Pop', styleCore: 'warm acoustic singalong pop for children, gentle strum, easy call-and-response chorus', instruments: ['acoustic guitar', 'soft hand claps', 'light shaker', 'warm ukulele'], tempoRange: [92, 108], goodFor: ['kids playlist', 'calm play', 'family singalong'], archetypes: ['kids'], tier: 'core' }, 'kids', { rhythm: ['gentle acoustic strum pulse'], vocal: ['warm childlike singalong vocal'], production: ['natural acoustic warmth'], harmony: ['easy sing-along chorus lift'], moods: ['warm', 'friendly'], audiences: ['kids playlist', 'family singalong'], avoidTraits: ['scary or frightening themes', 'adult romantic themes'] }),
  legacyGenrePack({ id: 'kids-upbeat-pop', label: 'Upbeat Kids Pop', styleCore: 'high-energy upbeat children\'s pop, driving clean beat, bright synth-pop hooks, dance-along energy', instruments: ['clean synth lead', 'punchy clean bass', 'bright pop drums', 'glockenspiel'], tempoRange: [112, 128], goodFor: ['kids playlist', 'dance-along', 'high-energy play'], archetypes: ['kids'], tier: 'core' }, 'kids', { rhythm: ['driving dance-along pulse'], vocal: ['energetic childlike vocal'], production: ['bright clean pop mix'], harmony: ['upbeat major-key hook'], moods: ['energetic', 'playful'], audiences: ['kids playlist', 'dance-along'], avoidTraits: ['scary or frightening themes', 'adult romantic themes'] }),
  // Secondary/auxiliary only — matches presets.ts's rawGenrePacks: not one of
  // the 3 primary kids ids (KIDS_CORE_GENRE_IDS), so it stays selectable but
  // isn't auto-applied/shown as a default core chip.
  legacyGenrePack({ id: 'kids-march', label: 'Kids Marching Pop', styleCore: 'simple marching pop for children, bouncy skip-along rhythm, bright brass-toy color', instruments: ['toy piano', 'snare-like light percussion', 'glockenspiel', 'clean bass'], tempoRange: [108, 126], goodFor: ['kids playlist', 'movement and dance', 'group activity'], archetypes: ['kids'] }, 'kids', { rhythm: ['bouncy marching skip'], vocal: ['bright childlike vocal'], production: ['clean toy-bright mix'], harmony: ['simple major-key march lift'], moods: ['playful', 'energetic'], audiences: ['kids playlist', 'group activity'], avoidTraits: ['scary or frightening themes', 'adult romantic themes'] })
];

/**
 * TASK v3.61 — 60s-80s Western "old pop" family (ABBA/Carpenters-adjacent
 * territory), added because the senior-morning channel's real genre pool
 * (SENIOR_MORNING_CORE_GENRE_IDS, 12 ids at the time this was written) was
 * dominated by only 4 genres actually in that tempo/warmth range
 * (soft-rock, adult-contemporary, acoustic-pop, retro-soul-pop) — real
 * measured 18-song packs kept landing on the same 3-4 genres regardless of
 * what the user asked for, because nothing else in the library fit a warm,
 * unhurried, acoustic-forward, 62-112 BPM senior brief. This does NOT touch
 * city-pop/jazz/lofi/rnb/ballad (already 50+ entries each, already oversized
 * for this channel) — every entry below is a genuinely new sub-style with
 * its own instrumentation/rhythm/harmony/production, not a rename of an
 * existing one. "Warmth" itself is deliberately NOT a descriptor duplicated
 * across all 28 — that's audienceProfiles.ts's SENIOR_AUDIENCE_PROFILE's
 * job (see TASK v3.61 TASK D), so a doo-wop track and a quiet-storm track
 * stay genre-distinct instead of both just saying "warm."
 */
export const oldpopGenrePacks: StructuredGenrePack[] = [
  // --- 1-A: 1950s-60s (6) ---
  legacyGenrePack({ id: 'oldpop-doowop-harmony', label: 'Doo-Wop Close Harmony', styleCore: 'classic doo-wop pop, triplet shuffle groove, four-part close harmony backing', instruments: ['upright bass', 'brushed snare', 'close-harmony backing vocals', 'muted electric guitar'], tempoRange: [72, 88], goodFor: ['sock-hop nostalgia', 'radio', 'slow dance memory'], vocalPreference: { male: 0.15, female: 0.7, mixed: 0.15 } }, 'oldpop', { rhythm: ['12/8 triplet shuffle groove', 'walking upright bass on the downbeat'], vocal: ['lead voice answered by four-part close harmony', 'nonsense-syllable backing vocal figures'], production: ['narrow warm mono-leaning mix', 'tube-amp coloration'], harmony: ['I-vi-IV-V doo-wop turnaround'], moods: ['sweetly nostalgic', 'youthful'], audiences: ['senior playlist', 'radio nostalgia'], avoidTraits: ['modern trap hi-hats', 'aggressive distortion'] }),
  // v4.16 (TASK A) — tempoRange upper bound 112 -> 100: the senior audience
  // profile's own tempoCeiling dropped to 100 (§1-1), and a genre range
  // extending past the audience ceiling is dead data (resolveTempoWithBand
  // already clamps the final assigned tempo to the audience's own floor/
  // ceiling regardless — see tests/tempoPlan.test.ts's own "never exceeds
  // the audience profile's absolute floor/ceiling" case). Shifted down to
  // [95, 100] (not collapsed to a single value) to keep landing in the new
  // brightest SENIOR_TEMPO_BANDS tier, preserving this genre's own
  // "bright/youthful" identity.
  legacyGenrePack({ id: 'oldpop-brill-building', label: 'Brill Building Pop', styleCore: 'early-1960s Brill Building pop, upright piano lead, bright compact single arrangement', instruments: ['upright piano', 'castanets', 'tambourine', 'light upright bass'], tempoRange: [88, 100], goodFor: ['bright morning drive', 'radio single', 'youthful nostalgia'], vocalPreference: { male: 0.15, female: 0.7, mixed: 0.15 } }, 'oldpop', { rhythm: ['bouncy two-beat pop pulse'], vocal: ['clear youthful lead vocal'], production: ['bright compact 1960s single mix'], harmony: ['simple diatonic I-IV-V hook'], moods: ['bright', 'youthful'], audiences: ['radio', 'bright morning'], avoidTraits: ['dense modern layering', 'heavy sub bass'] }),
  legacyGenrePack({ id: 'oldpop-girl-group-wall', label: 'Girl Group Wall of Sound', styleCore: 'early-1960s girl-group pop, layered wall-of-sound percussion, unison female lead with call-and-response backing', instruments: ['layered hand percussion', 'crash cymbal swells', 'unison female backing vocals', 'upright bass'], tempoRange: [90, 100], goodFor: ['bright nostalgia', 'radio', 'uplifting morning'], vocalPreference: { male: 0.15, female: 0.7, mixed: 0.15 } }, 'oldpop', { rhythm: ['driving eighth-note backbeat'], vocal: ['unison female lead answered by a backing chorus, lead kept forward in the mix'], production: ['layered wall-of-sound reverb with the lead vocal never buried'], harmony: ['bright major-key call and response'], moods: ['bright', 'uplifting'], audiences: ['radio nostalgia', 'morning playlist'], avoidTraits: ['reverb washing out the vocal', 'harsh cymbal wash'] }),
  legacyGenrePack({ id: 'oldpop-sunshine-pop', label: 'Sunshine Pop', styleCore: 'late-1960s sunshine pop, bright parallel harmony, harpsichord and woodwind color', instruments: ['harpsichord', 'glockenspiel', 'woodwind obbligato', 'light acoustic guitar'], tempoRange: [88, 100], goodFor: ['bright afternoon', 'spring morning', 'gentle uplift'] }, 'oldpop', { rhythm: ['bright bouncing 4/4 pop pulse'], vocal: ['blended bright harmony vocals in parallel thirds and sixths'], production: ['crisp bright chamber-pop mix'], harmony: ['parallel-thirds and sixths vocal harmony', 'bright major-key chord color'], moods: ['bright', 'gently joyful'], audiences: ['spring morning', 'bright afternoon'], avoidTraits: ['psychedelic distortion', 'harsh bright top end'] }),
  legacyGenrePack({ id: 'oldpop-baroque-pop', label: 'Baroque Pop', styleCore: 'mid-1960s baroque pop, string-quartet chamber texture, refined obbligato color', instruments: ['string quartet', 'oboe obbligato', 'flugelhorn', 'nylon guitar'], tempoRange: [78, 92], goodFor: ['refined evening', 'reflective afternoon', 'elegant nostalgia'] }, 'oldpop', { rhythm: ['gentle chamber-pop pulse'], vocal: ['restrained, classically-inflected lead vocal'], production: ['intimate chamber-music room tone'], harmony: ['chromatic descending bass line under refined chamber harmony'], moods: ['refined', 'reflective'], audiences: ['reflective evening', 'elegant nostalgia'], avoidTraits: ['orchestral bombast', 'harsh string tone'] }),
  legacyGenrePack({ id: 'oldpop-british-beat', label: 'British Beat Pop', styleCore: 'early-1960s British beat pop, jangly 12-string guitar, melodic walking bass', instruments: ['12-string electric guitar', 'melodic walking bass', 'tambourine backbeat', 'brushed drum kit'], tempoRange: [92, 100], goodFor: ['bright nostalgia', 'radio', 'youthful energy'] }, 'oldpop', { rhythm: ['jangly eighth-note beat pulse'], vocal: ['clear youthful group harmony'], production: ['bright British-beat studio mix'], harmony: ['mid-song key-change lift'], moods: ['bright', 'youthful'], audiences: ['radio nostalgia', 'youthful energy'], avoidTraits: ['fuzz distortion', 'aggressive stage volume'] }),
  // --- 1-B: 1970s (10) ---
  legacyGenrePack({ id: 'oldpop-soft-rock-am', label: '70s Soft Rock AM Gold', styleCore: '1970s AM-gold soft rock, clean electric arpeggios, warm radio compression', instruments: ['clean electric guitar arpeggios', 'soft kick drum', 'brushed snare', 'rounded bass'], tempoRange: [88, 100], goodFor: ['drive', 'AM radio nostalgia', 'memory'] }, 'oldpop', { rhythm: ['relaxed soft-rock eighth-note pulse'], vocal: ['smooth adult lead vocal'], production: ['warm AM-radio compression'], harmony: ['warm major-seventh chord color'], moods: ['warm', 'wistful'], audiences: ['drive', 'AM radio nostalgia'], avoidTraits: ['arena-rock distortion', 'modern loudness'] }),
  legacyGenrePack({ id: 'oldpop-orchestral-easy', label: 'Orchestral Easy Listening', styleCore: '1970s orchestral easy listening, strings carrying the melody, MOR lounge polish', instruments: ['string section', 'concert harp', 'soft vibraphone', 'light rhythm section'], tempoRange: [68, 82], goodFor: ['relaxed evening', 'MOR radio', 'reflective afternoon'] }, 'oldpop', { rhythm: ['slow rubato easing into a gentle 4/4'], vocal: ['warm orchestral-backed lead vocal'], production: ['polished middle-of-the-road easy-listening mix'], harmony: ['lush orchestral resolution', 'harp glissando transitions'], moods: ['relaxed', 'polished'], audiences: ['MOR radio', 'relaxed evening'], avoidTraits: ['big-band brashness', 'uptempo swing'] }),
  legacyGenrePack({ id: 'oldpop-close-harmony-duo', label: '70s Close Harmony Duo', styleCore: '1970s close-harmony duo pop, intimate two-voice blend, restrained acoustic backing', instruments: ['acoustic guitar', 'electric piano', 'restrained brushed drums', 'upright bass'], tempoRange: [84, 96], goodFor: ['intimate duet', 'gentle folk-pop', 'quiet morning'], vocalPreference: { male: 0.5, female: 0.2, mixed: 0.3 } }, 'oldpop', { rhythm: ['gentle folk-pop duet pulse'], vocal: ['two-voice close-harmony duet'], production: ['intimate duo studio warmth'], harmony: ['two-part close vocal harmony'], moods: ['intimate', 'gentle'], audiences: ['quiet morning', 'intimate duet'], avoidTraits: ['oversized production', 'competing lead vocals'] }),
  legacyGenrePack({ id: 'oldpop-folk-rock-70s', label: '70s Folk Rock', styleCore: '1970s folk-rock storytelling, 12-string acoustic texture, unhurried walking tempo', instruments: ['12-string acoustic guitar', 'mandolin', 'harmonica', 'light bass'], tempoRange: [86, 100], goodFor: ['storytelling', 'open road', 'reflective walk'], vocalPreference: { male: 0.5, female: 0.2, mixed: 0.3 } }, 'oldpop', { rhythm: ['unhurried walking folk-rock tempo'], vocal: ['plainspoken storytelling lead vocal'], production: ['natural unvarnished folk-rock room tone'], harmony: ['open-string folk chord voicings'], moods: ['reflective', 'plainspoken'], audiences: ['storytelling', 'reflective walk'], avoidTraits: ['electric rock distortion', 'stadium drums'] }),
  legacyGenrePack({ id: 'oldpop-motown-pop-soul', label: 'Motown Pop Soul', styleCore: 'Motown-style pop soul, driving four-beat tambourine, melodic bassline, gospel-toned backing', instruments: ['tambourine on all four beats', 'melodic electric bass', 'horn section stabs', 'gospel-toned backing vocals'], tempoRange: [88, 100], goodFor: ['uplifting soul', 'radio', 'dance-along memory'] }, 'oldpop', { rhythm: ['driving four-on-the-floor soul pulse'], vocal: ['soulful lead with call-and-response backing'], production: ['tight punchy soul-pop mix'], harmony: ['gospel-tinged pop-soul chord color'], moods: ['uplifting', 'soulful'], audiences: ['radio', 'uplifting soul'], avoidTraits: ['harsh distorted horns', 'aggressive modern trap elements'] }),
  legacyGenrePack({ id: 'oldpop-philly-soul-sweet', label: 'Philly Sweet Soul', styleCore: '1970s Philadelphia sweet soul, sweeping strings, velvet romantic lead', instruments: ['sweeping string section', 'vibraphone', 'soft sixteenth-note hi-hat', 'smooth electric bass'], tempoRange: [88, 100], goodFor: ['romantic evening', 'radio soul', 'slow dance'] }, 'oldpop', { rhythm: ['lush sixteenth-note soul groove'], vocal: ['velvet-toned romantic lead vocal'], production: ['velvet Philadelphia-style orchestral soul mix'], harmony: ['sweet extended soul-pop chords'], moods: ['romantic', 'velvet-smooth'], audiences: ['romantic evening', 'radio soul'], avoidTraits: ['harsh string tone', 'aggressive percussion'] }),
  legacyGenrePack({ id: 'oldpop-countrypolitan', label: 'Countrypolitan Pop', styleCore: '1970s countrypolitan pop, pedal steel color, Nashville-number chord progression', instruments: ['pedal steel guitar', 'brushed drums', 'string pads', 'upright bass'], tempoRange: [86, 98], goodFor: ['gentle country-pop', 'reflective drive', 'senior playlist'] }, 'oldpop', { rhythm: ['gentle countrypolitan two-step'], vocal: ['warm plainspoken country-pop lead'], production: ['polished countrypolitan studio sheen'], harmony: ['Nashville-style pop-country progression'], moods: ['warm', 'plainspoken'], audiences: ['reflective drive', 'senior playlist'], avoidTraits: ['twangy novelty tone', 'honky-tonk rowdiness'] }),
  legacyGenrePack({ id: 'oldpop-europop-glow', label: '70s Europop Glow', styleCore: 'mid-1970s Scandinavian europop, layered female harmony, bright unison chorus lift', instruments: ['arpeggiated synth', 'acoustic piano', 'layered female harmony vocals', 'clean electric bass'], tempoRange: [90, 100], goodFor: ['bright europop nostalgia', 'radio', 'uplifting morning'], vocalPreference: { male: 0.15, female: 0.7, mixed: 0.15 } }, 'oldpop', { rhythm: ['bright driving four-on-the-floor europop pulse'], vocal: ['layered female harmony lead'], production: ['polished bright 1970s Scandinavian studio mix'], harmony: ['bright unison chorus lift', 'minor-verse-to-major-chorus turn'], moods: ['bright', 'anthemic-but-warm'], audiences: ['radio', 'uplifting morning'], avoidTraits: ['modern EDM synths', 'harsh digital brightness'] }),
  legacyGenrePack({ id: 'oldpop-yacht-west-coast', label: 'Yacht Rock West Coast', styleCore: 'late-1970s West Coast yacht pop, extended jazz-pop chords, glossy studio polish', instruments: ['clean comping electric guitar', 'soft saxophone obbligato', 'electric piano', 'fretless bass'], tempoRange: [88, 100], goodFor: ['breezy afternoon', 'smooth drive', 'relaxed evening'] }, 'oldpop', { rhythm: ['smooth laid-back west-coast groove'], vocal: ['smooth breezy adult-pop lead'], production: ['glossy polished studio mix'], harmony: ['extended jazz-pop chord voicings'], moods: ['breezy', 'smooth'], audiences: ['smooth drive', 'breezy afternoon'], avoidTraits: ['harsh saxophone tone', 'aggressive fusion soloing'] }),
  legacyGenrePack({ id: 'oldpop-piano-ballad-70s', label: '70s Piano Pop Ballad', styleCore: '1970s piano-led pop ballad, rubato verse opening into an orchestral chorus', instruments: ['grand piano', 'string section entering at the chorus', 'restrained brushed drums', 'warm bass'], tempoRange: [72, 86], goodFor: ['emotional evening', 'reflective night', 'comfort'] }, 'oldpop', { rhythm: ['rubato verse settling into a slow 4/4 chorus'], vocal: ['emotive piano-ballad lead vocal'], production: ['intimate piano-forward room tone widening at the chorus'], harmony: ['cinematic piano-ballad chord movement'], moods: ['emotive', 'cinematic-but-restrained'], audiences: ['reflective night', 'comfort'], avoidTraits: ['oversized power-ballad belting', 'arena drums'] }),
  // --- 1-C: 1980s (6) ---
  legacyGenrePack({ id: 'oldpop-adult-contemporary-80s', label: '80s Warm Adult Contemporary', styleCore: '1980s warm adult contemporary pop, ungated soft drums, sustained synth pads', instruments: ['warm electric piano', 'gateless soft drum kit', 'sustained synth pad', 'rounded bass'], tempoRange: [88, 100], goodFor: ['warm radio', 'gentle morning', 'senior playlist'] }, 'oldpop', { rhythm: ['smooth 1980s adult-contemporary pulse'], vocal: ['warm mature adult-contemporary lead'], production: ['polished but ungated 1980s soft mix'], harmony: ['warm sustained pad harmony'], moods: ['warm', 'polished'], audiences: ['warm radio', 'gentle morning'], avoidTraits: ['gated reverb snare', 'aggressive 80s drum machine'] }),
  legacyGenrePack({ id: 'oldpop-quiet-storm-warm', label: 'Quiet Storm Soul', styleCore: '1980s quiet-storm soul, slow fretless-bass groove, close low vocal', instruments: ['fretless bass', 'alto saxophone', 'electric piano', 'soft brushed drums'], tempoRange: [68, 80], goodFor: ['late night', 'intimate soul', 'comfort'] }, 'oldpop', { rhythm: ['slow quiet-storm groove'], vocal: ['low close-mic quiet-storm lead'], production: ['intimate late-night close mix'], harmony: ['smooth minor-seventh quiet-storm chords'], moods: ['intimate', 'smoldering-but-soft'], audiences: ['late night', 'intimate soul'], avoidTraits: ['aggressive saxophone runs', 'heavy sub bass'] }),
  legacyGenrePack({ id: 'oldpop-orchestral-ballad-80s', label: '80s Orchestral Ballad', styleCore: '1980s orchestral pop ballad, wide strings, late key-change lift', instruments: ['wide string section', 'timpani swells', 'grand piano', 'soft bass'], tempoRange: [66, 80], goodFor: ['grand emotional evening', 'reflective night', 'comfort'] }, 'oldpop', { rhythm: ['grand rubato-to-4/4 ballad pulse'], vocal: ['powerful-but-controlled ballad lead'], production: ['expansive 1980s orchestral ballad mix'], harmony: ['late key-change ballad lift'], moods: ['grand-but-restrained', 'emotional'], audiences: ['reflective night', 'grand emotional evening'], avoidTraits: ['shouted climax', 'harsh cymbal crashes'] }),
  legacyGenrePack({ id: 'oldpop-light-synth-pop-warm', label: 'Light Warm Synth Pop', styleCore: '1980s light synth pop, analog pad and acoustic guitar blend, bright but quiet', instruments: ['analog synth pad', 'acoustic guitar', 'soft arpeggiator', 'clean electric bass'], tempoRange: [88, 100], goodFor: ['gentle nostalgia', 'soft radio', 'morning'] }, 'oldpop', { rhythm: ['gentle mid-tempo synth-pop pulse'], vocal: ['clear light pop lead'], production: ['warm analog-digital hybrid mix'], harmony: ['bright-but-soft synth-pop chords'], moods: ['bright-but-quiet', 'gentle'], audiences: ['soft radio', 'gentle nostalgia'], avoidTraits: ['aggressive arpeggiator gating', 'harsh digital brightness'] }),
  legacyGenrePack({ id: 'oldpop-soft-duet-80s', label: '80s Soft Pop Duet', styleCore: '1980s soft pop duet, alternating verse leads, chorus harmony in thirds', instruments: ['electric piano', 'string pads', 'soft bass', 'brushed drums'], tempoRange: [78, 92], goodFor: ['romantic duet', 'gentle evening', 'comfort'] }, 'oldpop', { rhythm: ['gentle 1980s duet ballad pulse'], vocal: ['alternating male and female verse leads'], production: ['warm intimate duet studio mix'], harmony: ['chorus harmony in thirds'], moods: ['romantic', 'gentle'], audiences: ['romantic duet', 'gentle evening'], avoidTraits: ['competing over-sung vocals', 'oversized ballad drums'] }),
  legacyGenrePack({ id: 'oldpop-standards-torch', label: 'Standards Torch Song', styleCore: 'jazz-standard torch song, brushed swing, crooner delivery', instruments: ['double bass', 'brushed drums', 'piano', 'muted trumpet'], tempoRange: [70, 84], goodFor: ['dim lounge', 'reflective evening', 'elegant nostalgia'], vocalPreference: { male: 0.7, female: 0.15, mixed: 0.15 } }, 'oldpop', { rhythm: ['relaxed jazz-standard swing'], vocal: ['crooning torch-song lead vocal'], production: ['dim intimate torch-song lounge mix'], harmony: ['jazz-standard extended chord changes'], moods: ['dim-and-elegant', 'reflective'], audiences: ['dim lounge', 'elegant nostalgia'], avoidTraits: ['bebop-fast tempo', 'scat improvisation clutter'] }),
  // --- 1-D: timeless warmth (6) ---
  // 지시문 08 (TASK E) — real leak: styleCore/rhythm/vocal/production all
  // carried the literal word "morning" (this genre's own id/label keep
  // "morning" — id changes are out of scope, see this task's own doc
  // comment at ERA_BUCKET_BY_GENRE_ID and genreTraits.ts/genreFamilies.ts/
  // eraCanonPalettes.ts's real references to this exact id), so an evening/
  // night/train scene still got "morning" injected into its own stylePrompt
  // text regardless of the concept's real time-of-day. Replaced with
  // "glow" (already the genre's own real identity word, per its id/label)
  // in every PROMPT-TEXT-bearing field; goodFor/audiences (categorization
  // metadata used to match this genre to a channel/mood, never injected
  // into a generated stylePrompt) are unchanged.
  legacyGenrePack({ id: 'oldpop-warm-morning-glow', label: 'Warm Morning Glow Pop', styleCore: 'timeless warm glow pop, acoustic arpeggio over gentle electric piano, minimal percussion', instruments: ['acoustic guitar arpeggio', 'warm electric piano', 'minimal light percussion', 'soft bass'], tempoRange: [68, 78], goodFor: ['morning coffee', 'gentle wake-up', 'senior playlist'] }, 'oldpop', { rhythm: ['unhurried warm-glow pulse'], vocal: ['gentle unhurried glow lead'], production: ['soft close warm-room mix'], harmony: ['warm open major-key harmony'], moods: ['warm', 'unhurried'], audiences: ['morning coffee', 'senior playlist'], avoidTraits: ['busy percussion', 'bright harsh top end'] }),
  legacyGenrePack({ id: 'oldpop-gentle-lullaby-pop', label: 'Gentle Lullaby Pop', styleCore: 'timeless gentle lullaby-pop, celesta and music-box color, whispered lead', instruments: ['celesta', 'music-box texture', 'soft acoustic guitar', 'light brushed percussion'], tempoRange: [64, 76], goodFor: ['bedtime comfort', 'quiet evening', 'gentle memory'] }, 'oldpop', { rhythm: ['gentle 6/8 lullaby sway'], vocal: ['whispered gentle lead vocal'], production: ['hushed intimate lullaby mix'], harmony: ['simple lullaby-like major harmony'], moods: ['hushed', 'tender'], audiences: ['quiet evening', 'gentle memory'], avoidTraits: ['loud dynamic swells', 'busy arrangement'] }),
  legacyGenrePack({ id: 'oldpop-hearth-acoustic', label: 'Hearth Acoustic Pop', styleCore: 'timeless hearth-side acoustic pop, nylon guitar with cello counterline, minimal room ambience', instruments: ['nylon guitar', 'cello counterline', 'soft brushed percussion', 'warm bass'], tempoRange: [72, 84], goodFor: ['fireside comfort', 'quiet home listening', 'senior playlist'] }, 'oldpop', { rhythm: ['gentle fireside acoustic pulse'], vocal: ['close warm fireside lead vocal'], production: ['minimal room ambience, close intimate vocal'], harmony: ['warm nylon-guitar harmony'], moods: ['cozy', 'intimate'], audiences: ['fireside comfort', 'quiet home listening'], avoidTraits: ['excessive reverb', 'busy percussion'] }),
  legacyGenrePack({ id: 'oldpop-sunlit-strings-pop', label: 'Sunlit Strings Pop', styleCore: 'timeless sunlit chamber-strings pop, mid-tempo gentle uplift', instruments: ['chamber string section', 'acoustic rhythm guitar', 'light brushed drums', 'warm bass'], tempoRange: [86, 98], goodFor: ['bright gentle afternoon', 'hopeful memory', 'senior playlist'] }, 'oldpop', { rhythm: ['mid-tempo sunlit lift pulse'], vocal: ['bright gentle lead vocal'], production: ['warm sunlit chamber-pop mix'], harmony: ['bright gentle major-key rise'], moods: ['bright', 'gentle'], audiences: ['bright gentle afternoon', 'hopeful memory'], avoidTraits: ['harsh string tone', 'busy syncopation'] }),
  legacyGenrePack({ id: 'oldpop-slow-waltz-memory', label: 'Slow Waltz Memory Pop', styleCore: 'timeless slow-waltz memory pop, accordion or vibraphone color, reflective 3/4 sway', instruments: ['accordion', 'vibraphone', 'soft upright bass', 'light brushed drums'], tempoRange: [66, 78], goodFor: ['reflective memory', 'quiet evening', 'senior playlist'] }, 'oldpop', { rhythm: ['slow 3/4 memory waltz'], vocal: ['reflective waltz-tempo lead vocal'], production: ['warm reflective waltz-hall room tone'], harmony: ['reflective minor-to-major waltz progression'], moods: ['reflective', 'wistful'], audiences: ['reflective memory', 'quiet evening'], avoidTraits: ['rushed tempo', 'harsh accordion tone'] }),
  legacyGenrePack({ id: 'oldpop-evening-lamp-ballad', label: 'Evening Lamp Ballad', styleCore: 'timeless low-dynamic evening ballad, piano and brushed drums, strings reserved for the final chorus', instruments: ['piano', 'brushed drums', 'strings entering only in the final chorus', 'soft bass'], tempoRange: [68, 80], goodFor: ['quiet evening', 'unhurried comfort', 'senior playlist'] }, 'oldpop', { rhythm: ['low-dynamic evening ballad pulse'], vocal: ['restrained close evening lead vocal'], production: ['low-dynamic close evening mix, strings held back for the final chorus'], harmony: ['restrained evening-ballad chord movement'], moods: ['restrained', 'quietly warm'], audiences: ['quiet evening', 'unhurried comfort'], avoidTraits: ['early dynamic climax', 'abrupt dynamic jumps'] }),
  // --- 지시문 21 (TASK B) — 기존 3종 보강: 두왑 분화 2종, 밤 샹송 1종,
  // 발라드블루스 1종. 기존 oldpop-doowop-harmony/chanson은 이 지시문의
  // 명시적 "하지 말 것"에 따라 단 한 줄도 수정하지 않는다 — 두 신규 두왑
  // 장르는 oldpop-doowop-harmony를 참조 템플릿으로 삼되 별도 id로
  // 완전히 분리한다.
  legacyGenrePack({ id: 'oldpop-doowop-ballad', label: 'Doo-Wop Ballad', styleCore: 'slow doo-wop ballad, standup bass foundation, tremolo guitar shimmer, tender close harmony', instruments: ['upright bass', 'tremolo electric guitar', 'brushed drums', 'close-harmony backing vocals'], tempoRange: [62, 74], goodFor: ['slow dance memory', 'late-night radio', 'nostalgic ballad'], vocalPreference: { male: 0.15, female: 0.7, mixed: 0.15 }, archetypes: ['senior-morning', 'oldpop-lounge'], tier: 'core', eraTag: '1950s-60s doo-wop ballad' }, 'oldpop', { rhythm: ['slow 12/8 doo-wop ballad sway', 'standup bass walking under a slow pulse'], vocal: ['tender lead voice cradled by close harmony', 'nonsense-syllable backing figures held long'], production: ['warm tremolo-guitar shimmer', 'narrow mono-leaning ballad mix'], harmony: ['I-vi-IV-V doo-wop turnaround at half speed'], moods: ['tender', 'wistful'], audiences: ['senior playlist', 'slow dance memory'], avoidTraits: [] }),
  legacyGenrePack({ id: 'oldpop-doowop-uptempo', label: 'Doo-Wop Uptempo', styleCore: 'upbeat doo-wop pop, handclap backbeat, bright saxophone break, sock-hop energy', instruments: ['upright bass', 'handclap percussion', 'saxophone', 'close-harmony backing vocals'], tempoRange: [84, 96], goodFor: ['sock-hop dance', 'bright nostalgia', 'radio'], vocalPreference: { male: 0.15, female: 0.7, mixed: 0.15 }, archetypes: ['senior-morning', 'oldpop-lounge'], tier: 'core', eraTag: '1950s-60s uptempo doo-wop' }, 'oldpop', { rhythm: ['bouncy triplet shuffle at dance tempo', 'handclap accents on the backbeat'], vocal: ['bright lead voice trading lines with the group', 'call-and-response hook'], production: ['punchy sock-hop mix', 'saxophone break lifting the bridge'], harmony: ['I-vi-IV-V doo-wop turnaround at dance tempo'], moods: ['bright', 'youthful'], audiences: ['sock-hop nostalgia', 'radio'], avoidTraits: [] }),
  // 밤 샹송 — 기존 chanson(아코디언 중심·로맨틱·보컬 성별 중립)과의 차이:
  // 기타/피아노 중심·멜랑콜릭·남성 인티메이트. id/스타일 모두 완전히 분리.
  legacyGenrePack({ id: 'oldpop-night-chanson', label: 'Night Chanson', styleCore: 'vintage French night chanson, Paris café-after-dark atmosphere, intimate male vocal, melancholic elegance', instruments: ['gentle acoustic guitar', 'subtle piano', 'soft upright bass', 'light brushed drums'], tempoRange: [62, 74], goodFor: ['late-night reflection', 'Paris café mood', 'melancholic elegance'], vocalPreference: { male: 0.75, female: 0.15, mixed: 0.10 }, archetypes: ['senior-morning', 'oldpop-lounge'], tier: 'extended', eraTag: '1950s-70s night chanson' }, 'oldpop', { rhythm: ['slow rubato easing into a gentle waltz-adjacent pulse'], vocal: ['intimate close-mic male lead', 'restrained spoken-sung delivery'], production: ['dim late-night café room tone', 'gentle acoustic guitar and piano interplay'], harmony: ['minor-key chanson progression with a wistful resolve'], moods: ['melancholic', 'elegant', 'nostalgic'], audiences: ['late-night reflection', 'Paris café mood'], avoidTraits: [] }),
  // 발라드블루스 — 강사 원문 네거티브 4종(no humming/ooh/aah/mmm)을
  // avoidTraits에 그대로 반영. 기존 jazz-jazz-blues-club(클럽 재즈 블루스)
  // 과는 성격이 달라 별도 장르로 분리.
  legacyGenrePack({ id: 'oldpop-rainy-ballad-blues', label: 'Rainy Ballad Blues', styleCore: 'rainy-night ballad blues, clean hollow-body electric guitar, subtle tremolo bar warble, spring reverb, dark minor chord-melody instrumental intro', instruments: ['clean hollow-body electric guitar', 'upright bass', 'brushed drums', 'spring reverb tank'], tempoRange: [62, 72], goodFor: ['rainy night reflection', 'late-night blues', 'male-led ballad'], vocalPreference: { male: 0.8, female: 0.1, mixed: 0.1 }, archetypes: ['senior-morning', 'oldpop-lounge'], tier: 'extended', eraTag: '1960s-70s ballad blues' }, 'oldpop', { rhythm: ['slow blues ballad pulse with a dark minor instrumental intro'], vocal: ['restrained sung baritone lead, no ad-lib filler'], production: ['subtle tremolo bar warble', 'spring reverb wash on the guitar'], harmony: ['dark minor chord-melody guitar intro before the vocal enters'], moods: ['melancholic', 'rain-soaked', 'intimate'], audiences: ['rainy night reflection', 'late-night blues'], avoidTraits: ['humming', 'ooh', 'aah', 'mmm'] }),
  // --- 지시문 21 (TASK A) — 신규 4종 중 2종(oldpop 계열). 강사 원문의
  // "no disco beat, no uptempo, no fast dance groove, no four-on-the-floor"
  // 네거티브는 docs/BENCHMARK_PROMPT_PRACTICE.md에 기록된 관행 차이에 따라
  // styleCore 문장에 섞지 않고 avoidTraits로 분리해 반영한다(하루 앱의
  // 기존 구조, excludePrompt 분리 원칙 유지).
  legacyGenrePack({ id: 'oldpop-six-eight-slow-ballad', label: '6/8 Slow Ballad', styleCore: '1970s-80s slow 6/8 ballad, gentle rocking triplet feel, warm strings entering at the chorus', instruments: ['piano', 'warm strings entering at the chorus', 'brushed drums in a slow triplet feel', 'soft bass'], tempoRange: [64, 76], goodFor: ['slow dance memory', 'reflective evening', 'senior playlist'], archetypes: ['senior-morning', 'oldpop-lounge'], tier: 'core', eraTag: '1970s-80s 6/8 slow ballad' }, 'oldpop', { rhythm: ['gentle 6/8 rocking triplet ballad sway', 'brushed triplet drums under a slow pulse'], vocal: ['tender restrained ballad lead', 'held long notes across the triplet feel'], production: ['warm ballad room tone', 'strings held back until the chorus'], harmony: ['slow major-to-relative-minor ballad movement'], moods: ['tender', 'wistful'], audiences: ['senior playlist', 'slow dance memory'], avoidTraits: ['disco beat', 'uptempo', 'fast dance groove', 'four-on-the-floor'] }),
  // 이탈리안 칸초네 — 기존 chanson(프랑스)과 구별되는 별도 유럽 올드팝
  // 계열. 오페라풍 남성 리드·현악 스윕이 정체성 핵심.
  legacyGenrePack({ id: 'oldpop-italian-canzone', label: 'Italian Canzone', styleCore: 'vintage Italian canzone pop, sweeping strings, passionate operatic-tinged male lead, romantic melodic sweep', instruments: ['sweeping string section', 'grand piano', 'soft brushed drums', 'warm upright bass'], tempoRange: [62, 78], goodFor: ['romantic Italian nostalgia', 'reflective evening', 'senior playlist'], vocalPreference: { male: 0.75, female: 0.15, mixed: 0.10 }, archetypes: ['senior-morning', 'oldpop-lounge'], tier: 'extended', eraTag: '1950s-70s Italian canzone' }, 'oldpop', { rhythm: ['slow rubato easing into a sweeping romantic pulse'], vocal: ['passionate operatic-tinged male lead', 'expressive sustained melodic phrasing'], production: ['lush romantic string-forward mix'], harmony: ['sweeping melodic canzone progression with a passionate climax'], moods: ['passionate', 'romantic', 'nostalgic'], audiences: ['romantic Italian nostalgia', 'reflective evening'], avoidTraits: [] })
];

/**
 * TASK B1 — kr-2030 workspace's 6 genres. `archetypes: ['kr-2030-pop']` is
 * set explicitly on every single one (never left empty) — withGenreVisibility
 * only calls inferArchetypes() when `genre.archetypes` is empty, and a real
 * measurement during this task found that leaving it empty routes these
 * straight into 'modern-chill'/'city-night' (senior-oldpop workspace
 * archetypes) purely from styleCore words like "R&B"/"night drive". Do not
 * remove this field from any entry below — see tests/genreLibrary.test.ts's
 * "kr2030-* genres never leak into a senior-oldpop archetype" coverage.
 *
 * Korean-axis differentiation (this task's own §3-1, the future contrast
 * point for C1's Japanese-axis genres): at least 4/6 lead with bass/drum
 * vocabulary in instrumentation's first 2 items, at least 4/6 carry a
 * short-repeated-chorus structureTraits entry (see genreTraits.ts's own
 * GENRE_TRAIT_OVERRIDES entries for these 6 ids), and none of the 6 use
 * A-melo/B-melo/sabi structural vocabulary.
 */
export const kr2030GenrePacks: StructuredGenrePack[] = [
  legacyGenrePack({
    id: 'kr2030-emo-band-pop',
    label: 'Korean Emotional Band Pop',
    styleCore: 'warm Korean emotional band-pop, live rock band interplay, direct short chorus hook',
    instruments: ['driving electric bass', 'live rock drum kit', 'clean-to-crunch electric guitar', 'piano countermelody'],
    tempoRange: [95, 118],
    goodFor: ['퇴근 후 감성 밴드팝', 'drive', 'emotional singalong'],
    archetypes: ['kr-2030-pop'],
    tier: 'core'
  }, 'kr-2030', { rhythm: ['driving straight-eighth band pulse', 'tom-heavy prechorus build'], vocal: ['emotionally direct Korean lead vocal', 'occasional falsetto lift on the hook'], production: ['modern clean band mix', 'tight punchy low end'], harmony: ['minor-to-major prechorus lift', 'anthemic diatonic chorus'], moods: ['emotional', 'direct', 'youthful'], audiences: ['퇴근 후 감성 밴드팝', '2030 감성 플레이리스트'], avoidTraits: [] }),
  legacyGenrePack({
    id: 'kr2030-dawn-rnb',
    label: 'Seoul Dawn R&B',
    styleCore: 'intimate Seoul dawn R&B, restrained groove, late-night vocal closeness',
    instruments: ['deep round bass', 'soft brushed trap drum programming', 'muted electric piano', 'airy synth pad'],
    tempoRange: [78, 98],
    goodFor: ['새벽 감성 R&B', 'late-night', 'intimate'],
    archetypes: ['kr-2030-pop'],
    tier: 'core'
  }, 'kr-2030', { rhythm: ['slow half-time R&B pocket', 'loose behind-the-beat swing'], vocal: ['close intimate Korean R&B lead', 'airy ad-lib runs'], production: ['dark intimate late-night mix', 'sparse negative space between hits'], harmony: ['extended minor-seventh chord color', 'smooth ii-V neo-soul movement'], moods: ['intimate', 'late-night', 'restrained'], audiences: ['새벽 감성 R&B', '인디팝 무드'], avoidTraits: [] }),
  legacyGenrePack({
    id: 'kr2030-y2k-retro',
    label: 'Y2K Korean Drive Pop',
    styleCore: 'Y2K-era Korean drive pop, syncopated bass groove, nostalgic 2000s digital sheen',
    instruments: ['punchy electric bass', 'crisp programmed drum kit', 'bright digital synth stab', 'clean electric guitar chops'],
    tempoRange: [100, 120],
    goodFor: ['Y2K 레트로팝', 'night drive', 'nostalgic 2000s mood'],
    archetypes: ['kr-2030-pop'],
    tier: 'core'
  }, 'kr-2030', { rhythm: ['syncopated Y2K R&B-pop groove', 'crisp programmed backbeat'], vocal: ['bright confident Korean pop lead', 'stacked unison hook vocals'], production: ['bright early-2000s digital polish', 'clean compressed pop mix'], harmony: ['bright major-key verse-to-chorus lift', 'catchy diatonic hook progression'], moods: ['nostalgic', 'bright', 'confident'], audiences: ['Y2K 레트로팝', '드라이브'], avoidTraits: [] }),
  legacyGenrePack({
    id: 'kr2030-electro-pop',
    label: 'Modern K-Pop Electro Pop',
    styleCore: 'sleek modern K-pop electro pop, minimal punchy bass, short addictive hook',
    instruments: ['punchy synth bass', 'four-on-the-floor electronic kick', 'bright pluck synth', 'filtered synth pad'],
    tempoRange: [105, 128],
    goodFor: ['모던 일렉트로팝', 'night drive', 'confident pop'],
    archetypes: ['kr-2030-pop'],
    tier: 'core'
  }, 'kr-2030', {
    rhythm: ['four-on-the-floor pulse with offbeat accents', 'UK garage-influenced syncopation'],
    vocal: ['confident female-led pop vocal', 'short clipped phrasing on the verse'],
    production: ['clean digital pop mix', 'sidechain-pumped low end'],
    harmony: ['simple repeated verse-chorus progression', 'minimal chord substitution, direct diatonic movement'],
    moods: ['confident', 'sleek', 'modern'],
    audiences: ['모던 일렉트로팝', '나이트 드라이브'],
    // TASK B1 (§3-3) — the market research's own electro-pop-only caveats:
    // no rap verse, no complex chord substitutions, no extended high
    // belting. Song length (2:30-3:10) is deliberately NOT encoded here —
    // that's AudienceProfile.songLengthSecondsRange, A3's territory (see
    // this task's own §2/§10 "compactDuration()를 고치지 말 것").
    avoidTraits: ['rap verse', 'complex chord substitutions', 'extended high belting']
  }),
  legacyGenrePack({
    id: 'kr2030-ost-ballad',
    label: 'Korean OST Ballad Pop',
    styleCore: 'cinematic Korean OST-style ballad pop, piano-led verse opening into a string-lifted chorus',
    instruments: ['grand piano', 'sweeping string section entering at the chorus', 'soft brushed drums', 'warm sustained bass'],
    tempoRange: [68, 86],
    goodFor: ['발라드·OST형 팝', 'drama soundtrack mood', 'emotional finale'],
    archetypes: ['kr-2030-pop'],
    tier: 'core'
  }, 'kr-2030', { rhythm: ['rubato verse settling into a slow steady chorus pulse', 'no swing, straight ballad time-feel'], vocal: ['emotive Korean ballad lead', 'controlled power building into the final chorus'], production: ['cinematic OST-style room bloom', 'strings held back until the chorus'], harmony: ['suspended chords resolving into a lush chorus progression', 'late key-change lift into the final chorus'], moods: ['cinematic', 'emotional', 'bittersweet'], audiences: ['발라드·OST형 팝', '드라마 삽입곡 무드'], avoidTraits: [] }),
  legacyGenrePack({
    id: 'kr2030-acoustic-folk',
    label: 'Melodic Acoustic Folk Pop',
    styleCore: 'melodic Korean acoustic folk pop, warm fingerpicked guitar, gentle understated arrangement',
    instruments: ['fingerpicked acoustic guitar', 'soft piano answers', 'light hand percussion', 'warm upright bass'],
    tempoRange: [82, 100],
    goodFor: ['멜로 어쿠스틱·포크팝', 'quiet afternoon', 'gentle singalong'],
    archetypes: ['kr-2030-pop'],
    tier: 'core'
  }, 'kr-2030', { rhythm: ['gentle acoustic strum-and-pick pulse', 'unhurried folk-pop tempo'], vocal: ['plainspoken warm Korean lead', 'soft close-mic delivery'], production: ['natural low-stimulus acoustic room tone', 'minimal reverb, close and dry'], harmony: ['simple open-chord folk progression', 'gentle major-key resolution'], moods: ['gentle', 'understated', 'warm'], audiences: ['멜로 어쿠스틱·포크팝', '조용한 오후'], avoidTraits: [] }),
  // 지시문 21 (TASK A) — 신규 4종 중 나머지 2종(kr2030 계열). categoryId는
  // 'hiphop'이 아니라 'kr-2030'으로 지정(지시문 명시) — 하루 앱의 hiphop
  // 카테고리는 별개 워크스페이스 소속이라 혼동 방지.
  legacyGenrePack({
    id: 'kr2030-lofi-swing-hiphop',
    label: 'Korean Lofi Swing Hip-Hop Pop',
    styleCore: 'Korean lofi swing hip-hop pop, dusty swung boom-bap groove, half-spoken rap-sung verse opening into a melodic pre-chorus',
    instruments: ['dusty swung boom-bap drums', 'warm upright bass', 'lofi electric piano', 'vinyl-textured sample pad'],
    tempoRange: [78, 92],
    goodFor: ['로파이 스윙 힙합팝', 'chill study', 'late-afternoon mood'],
    vocalPreference: { male: 0.7, female: 0.15, mixed: 0.15 },
    archetypes: ['kr-2030-pop'],
    tier: 'core',
    eraTag: '2010s-2020s Korean lofi swing hip-hop'
  }, 'kr-2030', { rhythm: ['swung boom-bap pocket', 'dusty lofi-textured backbeat'], vocal: ['half-spoken rap-sung phrasing verse opening into a melodic pre-chorus', 'relaxed conversational Korean delivery'], production: ['warm dusty lofi mix', 'vinyl-crackle texture kept subtle'], harmony: ['jazzy ii-V lofi chord loop'], moods: ['relaxed', 'warm', 'contemplative'], audiences: ['로파이 스윙 힙합팝', '인디팝 무드'], avoidTraits: [] }),
  // 누아르 딥하우스 — 110-122 BPM 원안 중 상한을 kr-2030-emotional 프로필의
  // 실측 tempoCeiling(120)에 맞춰 120으로 조정(지시문 원문 122는 실제
  // 시스템 상한을 2 BPM 초과 — TASK D에 결함으로 보고). senior 계열
  // archetypes는 절대 포함하지 않음(시니어 tempoCeiling 100 위반 방지).
  legacyGenrePack({
    id: 'kr2030-noir-deep-house',
    label: 'Noir Deep House',
    styleCore: 'noir deep house, hypnotic four-on-the-floor pulse, dark warm sub bass, minimal moody synth stabs',
    instruments: ['four-on-the-floor electronic kick', 'deep warm sub bass', 'moody minimal synth stab', 'filtered hi-hat groove'],
    tempoRange: [110, 120],
    goodFor: ['나이트 딥하우스', 'late-night city drive', 'moody dance mood'],
    archetypes: ['kr-2030-pop', 'city-night'],
    tier: 'extended',
    eraTag: '2010s-2020s noir deep house'
  }, 'electronic', { rhythm: ['hypnotic four-on-the-floor deep-house pulse', 'off-beat open hi-hat groove'], vocal: ['sparse atmospheric vocal hook', 'processed vocal chops used sparingly'], production: ['dark warm nightclub mix', 'sub bass carrying the low end'], harmony: ['minor-key moody chord stab loop'], moods: ['moody', 'nocturnal', 'hypnotic'], audiences: ['나이트 딥하우스', '레이트나잇 드라이브'], avoidTraits: ['bright major-key pop hook', 'aggressive EDM drop'] })
];

/**
 * TASK E1 — kr-kids workspace's 7 genres. `archetypes: ['kr-kids-song']` and
 * `tier: 'core'` set explicitly on every entry, same isolation pattern as
 * kr2030GenrePacks/jp2030GenrePacks above (see this file's own
 * tests/genreLibrary.test.ts coverage note on that pattern).
 *
 * Order matters: getDefaultGenreIdsForArchetype() takes slice(0, 3), and the
 * research material's own top-3 priority is action/daily-habit/counting-
 * color (§2's own "최우선 3종은 1·2·3번"), already this array's literal order.
 *
 * dynamicRange stays 'low'/'medium' for every entry (E1 §3-2 — "급격한
 * 다이내믹 금지"), and instrumentation is drawn only from D1's own per-tier
 * instrument constraints (soft bell/piano/ukulele for T1; +marimba/xylophone/
 * hand claps/bright synth for T2-T3) — krkids-sleep-calm (0-4세, spans down
 * into T1) draws from the T1 list only, per E1 §3-3's explicit instruction.
 */
export const krkidsGenrePacks: StructuredGenrePack[] = [
  legacyGenrePack({
    id: 'krkids-action',
    label: 'Korean Preschool Action Song',
    styleCore: 'bright Korean preschool action song, jump-along energy, clear movement cues in every line',
    instruments: ['ukulele', 'hand claps', 'xylophone', 'bright synth pad'],
    tempoRange: [112, 128],
    goodFor: ['율동 동요', 'action song', 'group activity'],
    archetypes: ['kr-kids-song'],
    tier: 'core'
  }, 'kr-kids', {
    rhythm: ['bouncy jump-along pulse', 'clap-driven call-and-response beat'],
    vocal: ['energetic childlike lead vocal', 'group chant on the chorus'],
    production: ["bright clean children's mix", 'punchy but gentle low end'],
    harmony: ['simple major-key singalong lift', 'repeated diatonic hook progression'],
    moods: ['energetic', 'playful'],
    audiences: ['율동 동요', '유치원 단체 활동'],
    avoidTraits: ['dense percussion layers', 'sudden dynamic jumps', 'piercing high register', 'distorted guitar', 'heavy sub bass']
  }),
  legacyGenrePack({
    id: 'krkids-daily-habit',
    label: 'Korean Daily Routine Song',
    styleCore: 'warm Korean daily-routine song, one clear habit instruction repeated as the hook',
    instruments: ['ukulele', 'xylophone', 'hand claps', 'marimba'],
    tempoRange: [98, 112],
    goodFor: ['생활습관 동요', 'daily routine', 'toddler learning'],
    archetypes: ['kr-kids-song'],
    tier: 'core'
  }, 'kr-kids', {
    rhythm: ['steady walking routine pulse', 'gentle two-step groove'],
    vocal: ['clear instructive childlike vocal', 'warm encouraging delivery'],
    production: ["clean close-mic children's mix", 'natural unforced warmth'],
    harmony: ['simple I-IV-V routine-song lift', 'warm major-key resolution'],
    moods: ['warm', 'encouraging'],
    audiences: ['생활습관 동요', '유아 학습'],
    avoidTraits: ['dense percussion layers', 'sudden dynamic jumps', 'piercing high register', 'distorted guitar', 'heavy sub bass']
  }),
  legacyGenrePack({
    id: 'krkids-counting-color',
    label: 'Korean Counting and Color Song',
    styleCore: 'bright Korean counting-and-color song, bell-tone counting motif, question-and-answer chorus',
    instruments: ['xylophone', 'marimba', 'ukulele', 'bright synth pad'],
    tempoRange: [100, 118],
    goodFor: ['숫자·색깔 동요', 'counting song', 'shape and color learning'],
    archetypes: ['kr-kids-song'],
    tier: 'core'
  }, 'kr-kids', {
    rhythm: ['bright bell-tone counting pulse', 'skip-along light beat'],
    vocal: ['clear enunciated childlike vocal', 'playful question-and-answer delivery'],
    production: ['clean bell-forward mix', 'light and airy production'],
    harmony: ['simple ascending counting motif', 'bright major-key color-naming lift'],
    moods: ['bright', 'curious'],
    audiences: ['숫자·색깔 동요', '유아 학습'],
    avoidTraits: ['dense percussion layers', 'sudden dynamic jumps', 'piercing high register', 'distorted guitar', 'heavy sub bass']
  }),
  legacyGenrePack({
    id: 'krkids-animal-vehicle',
    label: 'Korean Animal and Vehicle Song',
    styleCore: 'playful Korean animal-and-vehicle song, sound-imitation hook, one creature or vehicle per verse',
    instruments: ['ukulele', 'bright synth pad', 'hand claps', 'xylophone'],
    tempoRange: [108, 126],
    goodFor: ['동물·탈것 동요', 'sound imitation play', 'group activity'],
    archetypes: ['kr-kids-song'],
    tier: 'core'
  }, 'kr-kids', {
    rhythm: ['playful trotting pulse', 'engine-chug bounce groove'],
    vocal: ['playful childlike lead vocal', 'sound-imitation ad-libs'],
    production: ["bright clean children's mix", 'punchy but gentle low end'],
    harmony: ['simple major-key playful lift', 'repeated diatonic hook progression'],
    moods: ['playful', 'curious'],
    audiences: ['동물·탈것 동요', '유치원 단체 활동'],
    avoidTraits: ['dense percussion layers', 'sudden dynamic jumps', 'piercing high register', 'distorted guitar', 'heavy sub bass']
  }),
  legacyGenrePack({
    id: 'krkids-roleplay-story',
    label: 'Korean Roleplay Story Song',
    styleCore: 'warm Korean roleplay story song, short scene-setting verse into a repeated role-name chorus',
    instruments: ['marimba', 'ukulele', 'xylophone', 'bright synth pad'],
    tempoRange: [105, 122],
    goodFor: ['역할놀이 동요', 'roleplay story', 'imaginative play'],
    archetypes: ['kr-kids-song'],
    tier: 'core'
  }, 'kr-kids', {
    rhythm: ['gentle storytelling pulse', 'light skip-along groove'],
    vocal: ['expressive storytelling childlike vocal', 'character-voice call-and-response'],
    production: ["clean warm children's mix", 'natural unforced warmth'],
    harmony: ['simple narrative major-key progression', 'warm resolving chorus lift'],
    moods: ['warm', 'imaginative'],
    audiences: ['역할놀이 동요', '상상 놀이'],
    avoidTraits: ['dense percussion layers', 'sudden dynamic jumps', 'piercing high register', 'distorted guitar', 'heavy sub bass']
  }),
  legacyGenrePack({
    id: 'krkids-bilingual',
    label: 'Korean-English Learning Song',
    styleCore: 'clear Korean-English learning song, one Korean-English word pair repeated as the hook',
    instruments: ['ukulele', 'xylophone', 'marimba', 'hand claps'],
    tempoRange: [100, 116],
    goodFor: ['한영 이중언어 동요', 'bilingual learning', 'word learning'],
    archetypes: ['kr-kids-song'],
    tier: 'core'
  }, 'kr-kids', {
    rhythm: ['steady learning pulse', 'clean two-step groove'],
    vocal: ['clear enunciated bilingual childlike vocal', 'call-and-response between languages'],
    production: ["clean close-mic children's mix", 'light and airy production'],
    harmony: ['simple repeated learning-hook progression', 'bright major-key resolution'],
    moods: ['bright', 'curious'],
    audiences: ['한영 이중언어 동요', '유아 학습'],
    avoidTraits: ['dense percussion layers', 'sudden dynamic jumps', 'piercing high register', 'distorted guitar', 'heavy sub bass']
  }),
  legacyGenrePack({
    id: 'krkids-sleep-calm',
    label: 'Korean Lullaby and Calm Song',
    styleCore: 'soft Korean lullaby, short repeated phrase, never building to a loud peak',
    instruments: ['soft bell', 'piano', 'ukulele'],
    tempoRange: [62, 84],
    goodFor: ['자장가', 'nap time', 'calm down time'],
    archetypes: ['kr-kids-song'],
    tier: 'core'
  }, 'kr-kids', {
    rhythm: ['slow gentle lullaby sway', 'unhurried rocking pulse'],
    vocal: ['soft breathy childlike lullaby vocal', 'gentle unhurried phrasing'],
    production: ['soft close intimate mix', 'minimal sparse arrangement'],
    harmony: ['simple warm major-key lullaby progression', 'soft resolving cadence'],
    moods: ['soft', 'calm'],
    audiences: ['자장가', '낮잠 시간'],
    avoidTraits: ['dense percussion layers', 'sudden dynamic jumps', 'piercing high register', 'distorted guitar', 'heavy sub bass', 'hand claps', 'call and response', 'energetic', 'four-on-the-floor']
  })
];

/**
 * TASK F1 — jp-kids workspace's 7 genres. `archetypes: ['jp-kids-song']` and
 * `tier: 'core'` set explicitly on every entry, same isolation pattern as
 * krkidsGenrePacks above. Order matters: getDefaultGenreIdsForArchetype()
 * takes slice(0, 3); §2's own top-3 priority (teasobi/taiso-dance/
 * onomatopoeia) is already this array's literal order.
 *
 * §2-1's own measured contrast axis against krkidsGenrePacks (E1): every
 * entry below names onomatopoeia/hand-motion in styleCore or goodFor (7/7,
 * exceeds the ≥5/7 bar) and every entry's structureTraits below describes a
 * question-and-answer shape (7/7, exceeds the ≥5/7 bar) — the opposite
 * profile from krkids's educationConcept-driven instruction sentences.
 * dynamicRange stays 'low'/'medium' throughout (same "급격한 다이내믹 금지"
 * rule as E1); jpkids-taiso-dance's avoidTraits explicitly names
 * 'dense percussion layers'/'driving four-on-the-floor kick' per §3-2's own
 * warning that exercise/dance genres drift toward "타악 과다" easiest.
 */
export const jpkidsGenrePacks: StructuredGenrePack[] = [
  legacyGenrePack({
    id: 'jpkids-teasobi',
    label: 'Japanese Hand-Play Song',
    styleCore: 'cheerful Japanese hand-play song (手遊び歌), simple onomatopoeia, finger and clapping motions',
    instruments: ['ukulele', 'hand claps', 'xylophone', 'marimba'],
    tempoRange: [108, 122],
    goodFor: ['手遊び', 'てあそび', 'finger-play song'],
    archetypes: ['jp-kids-song'],
    tier: 'core'
  }, 'jp-kids', {
    rhythm: ['delicate finger-tapping pulse', 'soft clap-marked echo timing'],
    vocal: ['warm nursery-toned Japanese lead', "echoing children's-voice response"],
    production: ['intimate near-mic warmth', 'unhurried room presence'],
    harmony: ['gentle pentatonic-tinged nursery melody', 'soft resolution on each echo'],
    moods: ['playful', 'warm'],
    audiences: ['手遊び', 'てあそび'],
    avoidTraits: ['dense percussion layers', 'sudden dynamic jumps', 'piercing high register', 'distorted guitar', 'heavy sub bass']
  }),
  legacyGenrePack({
    id: 'jpkids-taiso-dance',
    label: 'Japanese Kids Exercise Dance',
    styleCore: 'energetic Japanese kids exercise dance (体操・ダンス), easy two-step motions, onomatopoeia movement cues',
    instruments: ['bright synth pad', 'hand claps', 'ukulele', 'xylophone'],
    tempoRange: [116, 132],
    goodFor: ['体操', '体操・ダンス', 'kids exercise dance'],
    archetypes: ['jp-kids-song'],
    tier: 'core'
  }, 'jp-kids', {
    rhythm: ['springy marching two-step', 'clap-cued motion-change timing'],
    vocal: ['spirited coach-style Japanese lead', 'group shout-back on the motion cue'],
    production: ['punchy daytime-bright energy', 'open-room live-class presence'],
    harmony: ['upbeat marching-band lift', 'bouncy diatonic call-out hook'],
    moods: ['energetic', 'playful'],
    audiences: ['体操', '体操・ダンス'],
    // §3-2's own explicit warning — exercise/dance drifts toward "타악 과다" easiest.
    avoidTraits: ['dense percussion layers', 'driving four-on-the-floor kick', 'sudden dynamic jumps', 'piercing high register', 'distorted guitar']
  }),
  legacyGenrePack({
    id: 'jpkids-onomatopoeia',
    label: 'Japanese Onomatopoeia Song',
    styleCore: 'bright Japanese onomatopoeia song (オノマトペソング), playful sound-word hooks like ぴょんぴょん and ぐるぐる',
    instruments: ['xylophone', 'marimba', 'ukulele', 'hand claps'],
    tempoRange: [104, 120],
    goodFor: ['オノマトペ', '擬音語・擬態語', 'onomatopoeia song'],
    archetypes: ['jp-kids-song'],
    tier: 'core'
  }, 'jp-kids', {
    rhythm: ['bouncing xylophone-bell pulse', 'giggly skip-step timing'],
    vocal: ['giggly sound-word Japanese lead', 'children echoing the sound word back'],
    production: ['sparkling bell-forward glow', 'uncluttered open space'],
    harmony: ['playful ascending sound-motif', 'bright pentatonic sparkle'],
    moods: ['playful', 'curious'],
    audiences: ['オノマトペ', '擬音語・擬態語'],
    avoidTraits: ['dense percussion layers', 'sudden dynamic jumps', 'piercing high register', 'distorted guitar', 'heavy sub bass']
  }),
  legacyGenrePack({
    id: 'jpkids-food-vehicle',
    label: 'Japanese Food and Vehicle Song',
    styleCore: 'playful Japanese food-and-vehicle song (食べ物・乗り物), sound-imitation hook, one food or vehicle per verse',
    instruments: ['ukulele', 'bright synth pad', 'xylophone', 'hand claps'],
    tempoRange: [106, 124],
    goodFor: ['食べ物', '乗り物', 'food and vehicle song'],
    archetypes: ['jp-kids-song'],
    tier: 'core'
  }, 'jp-kids', {
    rhythm: ['chugging toy-engine groove', 'trotting bite-sized bounce'],
    vocal: ['animated character-voice Japanese lead', 'kids shouting the naming answer back'],
    production: ['punchy toy-bright clarity', 'clean daytime snap'],
    harmony: ['cheerful naming-hook motif', 'bouncy major-key turn'],
    moods: ['playful', 'curious'],
    audiences: ['食べ物', '乗り物'],
    avoidTraits: ['dense percussion layers', 'sudden dynamic jumps', 'piercing high register', 'distorted guitar', 'heavy sub bass']
  }),
  legacyGenrePack({
    id: 'jpkids-daily-habit',
    label: 'Japanese Daily Routine Song',
    styleCore: 'warm Japanese daily-routine song (生活習慣), onomatopoeia-marked routine cue repeated as the hook',
    instruments: ['ukulele', 'xylophone', 'marimba', 'hand claps'],
    tempoRange: [98, 112],
    goodFor: ['生活習慣', 'daily routine song'],
    archetypes: ['jp-kids-song'],
    tier: 'core'
  }, 'jp-kids', {
    rhythm: ['unhurried morning-routine sway', 'soft stepwise walking gait'],
    vocal: ['patient coaxing Japanese lead', 'children answering back the routine cue'],
    production: ['tidy domestic hush', 'close near-mic gentleness'],
    harmony: ['reassuring stepwise resolution', 'soft routine-song turn'],
    moods: ['warm', 'encouraging'],
    audiences: ['生活習慣'],
    avoidTraits: ['dense percussion layers', 'sudden dynamic jumps', 'piercing high register', 'distorted guitar', 'heavy sub bass']
  }),
  legacyGenrePack({
    id: 'jpkids-seasonal',
    label: 'Japanese Seasonal Event Song',
    styleCore: 'cheerful Japanese seasonal-event song (季節の歌), bright onomatopoeia tied to cherry blossoms, festivals, snow',
    instruments: ['marimba', 'xylophone', 'ukulele', 'bright synth pad'],
    tempoRange: [96, 118],
    goodFor: ['季節の歌', 'seasonal event song'],
    archetypes: ['jp-kids-song'],
    tier: 'core'
  }, 'jp-kids', {
    rhythm: ['drifting seasonal sway', 'unhurried strolling gait'],
    vocal: ['bright open-air Japanese lead', 'children calling out the season name'],
    production: ['natural outdoor glow', 'airy seasonal breadth'],
    harmony: ['gentle seasonal melodic turn', 'warm resolving seasonal motif'],
    moods: ['bright', 'cheerful'],
    audiences: ['季節の歌'],
    avoidTraits: ['dense percussion layers', 'sudden dynamic jumps', 'piercing high register', 'distorted guitar', 'heavy sub bass']
  }),
  legacyGenrePack({
    id: 'jpkids-english-learning',
    label: 'Japanese-English Learning Song',
    styleCore: 'clear Japanese-English learning song (英語知育ソング), one Japanese-English word pair repeated as the hook',
    instruments: ['ukulele', 'xylophone', 'marimba', 'hand claps'],
    tempoRange: [100, 116],
    goodFor: ['英語知育', 'bilingual learning song'],
    archetypes: ['jp-kids-song'],
    tier: 'core'
  }, 'jp-kids', {
    rhythm: ['patient teaching-pace beat', 'crisp call-and-answer timing'],
    vocal: ['crisp bilingual schoolroom lead', 'children answering back in the target word'],
    production: ['tidy schoolroom clarity', 'light uncluttered focus'],
    harmony: ['repeating word-pair teaching motif', 'bright resolving answer-hook'],
    moods: ['bright', 'curious'],
    audiences: ['英語知育'],
    avoidTraits: ['dense percussion layers', 'sudden dynamic jumps', 'piercing high register', 'distorted guitar', 'heavy sub bass']
  })
];

/**
 * TASK K2 — kr-idol-male workspace's 7 genres, shared with K3's future
 * kr-idol-female workspace from the start (§3-3's own explicit warning:
 * `archetypes` carries BOTH 'kr-idol-male' and 'kr-idol-female' on every
 * entry below so K3 never has to edit this array later — doing so after
 * the fact would violate this track's own additive-only rule). K3 splits
 * on vocal/lyrics/hooks/thumbnails, not genre.
 *
 * §3-1's own "구간 역할" column is this workspace's real design intent:
 * these 7 are built to be combined via K1's core/sectionGenrePlan.ts
 * (composeSectionGenres), not just used standalone — K1 §6-1's 6 section-
 * genre-plan presets (see krIdolSectionPlans.ts) draw from exactly these
 * ids. §4-2's own instruction keeps every axis entry short (≤5 words) since
 * K1's per-section prompt budget is far tighter than a normal single-genre
 * song's.
 *
 * dynamicRange follows §4-1's table — chorus-role genres (synth-dance,
 * band-crossover, emotional-ballad) get 'wide' since K1's composeSectionGenres
 * takes the WIDEST value among a plan's genres for the spine, and K-pop's
 * whole point is a bigger verse-to-chorus contrast than any of the other
 * workspaces built so far.
 */
export const kridolMaleGenrePacks: StructuredGenrePack[] = [
  legacyGenrePack({
    id: 'kridol-performance-trap',
    label: 'Performance Trap Pop',
    styleCore: 'high-energy Korean idol performance trap pop, sharp hi-hat rolls, sung-rap verse driving into a stacked hook',
    instruments: ['808 sub bass', 'trap hi-hat rolls', 'punchy synth stab', 'clean electric guitar'],
    tempoRange: [130, 150],
    goodFor: ['무대 위의 밤', '퍼포먼스', '컴백 무대'],
    archetypes: ['kr-idol-male', 'kr-idol-female'],
    tier: 'core'
  }, 'kr-idol', {
    rhythm: ['triplet trap hi-hat rolls', 'hard-hitting 808 pulse'],
    // v5.7 (TASK H) — real audit finding: this genre pack is shared by
    // `archetypes: ['kr-idol-male', 'kr-idol-female']` (see this array's own
    // K2 §3-1 note), but `vocal` used to say "male" explicitly — since
    // core/sectionGenrePlan.ts reads GenreTraits.vocalTraits straight into
    // the real style prompt (via buildGenreTraits's genre.vocal fallback,
    // data/genreTraits.ts's own kridol overrides deliberately omit
    // vocalTraits to reuse this field), a real kr-idol-female generation
    // measured "male" leaking into 5/18 songs' style prompts. Gender itself
    // is handled correctly elsewhere (this workspace's own per-song
    // vocalType/vocalPlan assignment) — this field should describe delivery
    // STYLE, not gender, so wording is now gender-neutral across all 7
    // kridol-* genres below.
    vocal: ['confident rap-sung lead', 'unison chorus stack'],
    production: ['punchy modern trap mix', 'tight low-end clarity'],
    harmony: ['minor-key tension riff', 'sparse dark chord stabs'],
    moods: ['confident', 'intense', 'declarative'],
    audiences: ['무대 위의 밤', '퍼포먼스'],
    avoidTraits: ['specific idol group imitation', 'named member vocal timbre', 'signature hook of an existing song']
  }),
  legacyGenrePack({
    id: 'kridol-synth-dance',
    label: 'Synth Dance Pop',
    styleCore: 'sleek Korean idol synth dance pop, driving four-on-the-floor pulse opening into a bright unison hook',
    instruments: ['four-on-the-floor kick', 'bright pluck synth', 'filtered synth bass', 'clap layer'],
    tempoRange: [118, 132],
    goodFor: ['드라이브 K-POP 플레이리스트', '댄스', '컴백 무대'],
    archetypes: ['kr-idol-male', 'kr-idol-female'],
    tier: 'core'
  }, 'kr-idol', {
    rhythm: ['driving four-on-the-floor pulse', 'syncopated pre-chorus lift'],
    vocal: ['bright confident lead', 'layered unison hook vocal'],
    production: ['sleek club-ready polish', 'sidechain-pumped low end'],
    harmony: ['bright major-key hook', 'simple diatonic drop'],
    moods: ['bright', 'confident', 'energetic'],
    audiences: ['드라이브 K-POP 플레이리스트', '댄스'],
    avoidTraits: ['specific idol group imitation', 'named member vocal timbre', 'signature hook of an existing song']
  }),
  legacyGenrePack({
    id: 'kridol-band-crossover',
    label: 'Idol Band Crossover',
    styleCore: 'anthemic Korean idol band crossover, live rock drive building into a soaring unison chorus',
    instruments: ['live rock drum kit', 'distorted electric guitar', 'driving electric bass', 'soaring synth lead'],
    tempoRange: [128, 150],
    goodFor: ['무대 위의 밤', '퍼포먼스', '록 크로스오버'],
    archetypes: ['kr-idol-male', 'kr-idol-female'],
    tier: 'core'
  }, 'kr-idol', {
    rhythm: ['driving rock backbeat', 'double-time chorus lift'],
    vocal: ['powerful belted lead', 'full unison chorus stack'],
    production: ['big arena-ready mix', 'wide layered stereo image'],
    harmony: ['anthemic power-chord chorus', 'key-lift final hook'],
    moods: ['powerful', 'anthemic', 'confident'],
    audiences: ['무대 위의 밤', '록 크로스오버'],
    avoidTraits: ['specific idol group imitation', 'named member vocal timbre', 'signature hook of an existing song']
  }),
  legacyGenrePack({
    id: 'kridol-midtempo-rnb',
    label: 'Midtempo R&B',
    styleCore: 'Korean idol trap-soul crossover, hushed vocal-chop textures, a hushed lower-register voice handling the rap-adjacent verse',
    instruments: ['808-influenced sub pulse', 'plucked nylon guitar figure', 'chopped vocal-sample stab', 'muted finger-snap layer'],
    tempoRange: [88, 104],
    goodFor: ['새벽의 고백', 'R&B', '갈망'],
    archetypes: ['kr-idol-male', 'kr-idol-female'],
    tier: 'core'
  }, 'kr-idol', {
    rhythm: ['finger-snap trap-soul pocket', 'triplet hi-hat murmur under the verse'],
    vocal: ['hushed lower-register verse delivery', 'breathy pitched-up ad-lib texture'],
    production: ['muted vocal-chop atmosphere', 'wide negative-space stereo field'],
    harmony: ['suspended fourth color held over the hook', 'chromatic passing tone into the drop'],
    moods: ['hushed', 'restrained', 'late-night'],
    audiences: ['새벽의 고백', 'R&B'],
    // TASK K2 (§3-2) — modern-chill's own r&b/neo-soul/trap-soul keyword
    // triggers would swallow this genre if `archetypes` were ever left
    // empty; kept explicit and non-negotiable, matching B1's own kr2030
    // precedent for the identical risk.
    avoidTraits: ['specific idol group imitation', 'named member vocal timbre', 'signature hook of an existing song', 'lo-fi study beat', 'dusty piano loop', 'bedroom tape hiss']
  }),
  legacyGenrePack({
    id: 'kridol-latin-afro',
    label: 'Latin Afrobeat Crossover',
    styleCore: 'playful Korean idol latin-afrobeat crossover, dembow-influenced groove, bright call-and-response hook',
    instruments: ['reggaeton-influenced percussion', 'warm synth bass', 'guitar skank pattern', 'afrobeat log drum'],
    tempoRange: [96, 110],
    goodFor: ['드라이브 K-POP 플레이리스트', '라틴', '댄스'],
    archetypes: ['kr-idol-male', 'kr-idol-female'],
    tier: 'core'
  }, 'kr-idol', {
    rhythm: ['dembow-influenced groove', 'syncopated afrobeat pulse'],
    vocal: ['playful confident lead', 'call-and-response backing'],
    production: ['warm summery mix', 'bright percussive clarity'],
    harmony: ['bright minor-to-major turn', 'simple repeating hook motif'],
    moods: ['playful', 'bright', 'confident'],
    audiences: ['드라이브 K-POP 플레이리스트', '라틴'],
    avoidTraits: ['specific idol group imitation', 'named member vocal timbre', 'signature hook of an existing song']
  }),
  legacyGenrePack({
    id: 'kridol-emotional-ballad',
    label: 'Idol Emotional Ballad',
    styleCore: 'Korean idol unison-harmony ballad, layered group vocal stack carrying the melody more than any single instrument',
    instruments: ['felt-muted upright piano', 'low cello drone', 'soft mallet percussion', 'distant choir pad'],
    tempoRange: [68, 86],
    goodFor: ['새벽의 고백', '발라드', '갈망'],
    archetypes: ['kr-idol-male', 'kr-idol-female'],
    tier: 'core'
  }, 'kr-idol', {
    rhythm: ['loose rubato opening, no fixed pulse', 'gentle 6/8 lift into the final hook'],
    vocal: ['layered harmony stack carrying the melody', 'one voice breaking off into a solo ad-lib'],
    production: ['close-mic layered choir bloom', 'reverb tail held back until the final hook'],
    harmony: ['stacked open-fifth harmony under the verse', 'modal borrowed chord into the final lift'],
    moods: ['emotional', 'yearning', 'unified'],
    audiences: ['새벽의 고백', '발라드'],
    avoidTraits: ['specific idol group imitation', 'named member vocal timbre', 'signature hook of an existing song']
  }),
  legacyGenrePack({
    id: 'kridol-retro-funk',
    label: 'Retro Funk Disco Pop',
    styleCore: 'punchy Korean idol retro funk disco pop, syncopated slap-bass groove, horn-forward unison hook',
    instruments: ['slap electric bass', 'wah-wah rhythm guitar', 'bright horn stabs', 'four-on-the-floor kick'],
    tempoRange: [108, 122],
    goodFor: ['드라이브 K-POP 플레이리스트', '레트로', '훵크'],
    archetypes: ['kr-idol-male', 'kr-idol-female'],
    tier: 'core'
  }, 'kr-idol', {
    rhythm: ['syncopated funk groove', 'driving disco backbeat'],
    vocal: ['playful confident lead', 'unison group hook vocal'],
    production: ['warm retro analog-style groove', 'punchy horn-forward mix'],
    harmony: ['funky dominant-seventh vamp', 'bright disco chorus lift'],
    moods: ['playful', 'punchy', 'retro'],
    audiences: ['드라이브 K-POP 플레이리스트', '레트로'],
    // TASK K2 (§3-2) — city-night's own disco/city-pop/night-drive keyword
    // triggers would swallow this genre the same way modern-chill would
    // swallow kridol-midtempo-rnb; kept explicit for the same reason.
    avoidTraits: ['specific idol group imitation', 'named member vocal timbre', 'signature hook of an existing song', 'generic neon Tokyo skyline', 'sports car at night']
  })
];

/**
 * TASK C1 — jp-2030 workspace's 7 genres. `archetypes: ['jp-2030-pop']` and
 * `tier: 'core'` are set explicitly on every single one — this task's own
 * §0-2 measured that jp2030-neo-citypop/jp2030-chill-neosoul leak straight
 * into city-night/modern-chill (senior-oldpop workspace archetypes) purely
 * from styleCore words like "night drive"/"neo soul" when archetypes is
 * left empty, and jp2030-anime-cinematic/jp2030-heisei-nostalgia land in NO
 * archetype at all (tier falls to 'extended') for the same reason. Do not
 * remove this field from any entry below. categoryId is 'jp-2030', never
 * 'city-pop' or 'jazz' — either of those also auto-qualifies for
 * showa-cafe's own inferArchetypes() branch (see this task's own §0-2).
 *
 * Korean-axis CONTRAST (this task's own §3-1, the direct counterpart to
 * kr2030's bass/drum-led, short-repeated-chorus genres from B1): 5/7 lead
 * with guitar/piano vocabulary in instrumentation's first 2 items (only
 * jp2030-neo-citypop and jp2030-chill-neosoul are bass/drum-led, matching
 * their own genre conventions), 6/7 carry explicit A-melo/B-melo/sabi
 * structureTraits vocabulary, and dynamicRange is 'wide' on 4/7 — see
 * genreTraits.ts's own GENRE_TRAIT_OVERRIDES entries for these 7 ids.
 */
export const jp2030GenrePacks: StructuredGenrePack[] = [
  legacyGenrePack({
    id: 'jp2030-melodic-jrock',
    label: 'Reiwa Melodic J-Rock',
    styleCore: 'modern melodic J-rock, bright guitar-and-piano interplay, wide-open sabi vocal range',
    instruments: ['bright clean-picked electric guitar', 'shimmering upright piano runs', 'melodic fretted bass line', 'energetic live drum kit'],
    tempoRange: [100, 138],
    goodFor: ['모던 멜로딕 J-pop·J-rock', 'anime opening energy', 'band-driven singalong'],
    archetypes: ['jp-2030-pop'],
    tier: 'core'
  }, 'jp-2030', { rhythm: ['brisk uplifting rock momentum', 'rising fill-driven lead-in to the sabi'], vocal: ['warm, open-throated Japanese lead', 'belted high note at the sabi entrance'], production: ['crisp modern rock mix with headroom for the sabi', 'punchy low end that never overwhelms the vocal'], harmony: ['B-melo tension resolving into a wide-open sabi', 'bright triadic lift at the hook'], moods: ['driving', 'emotional', 'anthemic'], audiences: ['모던 멜로딕 J-rock', 'anime opening energy'], avoidTraits: [] }),
  legacyGenrePack({
    id: 'jp2030-anime-cinematic',
    label: 'Anime Cinematic Pop',
    styleCore: 'original anime-opening-style cinematic pop, sweeping orchestral-band hybrid, dramatic sabi entrance',
    instruments: ['orchestral piano', 'melodic electric guitar', 'sweeping string ensemble', 'driving rock drum kit'],
    tempoRange: [120, 155],
    goodFor: ['애니송풍 시네마틱 팝', 'opening-theme energy', 'dramatic set-piece track'],
    archetypes: ['jp-2030-pop'],
    tier: 'core'
  }, 'jp-2030', {
    rhythm: ['propulsive sixteenth-note rock-orchestral pulse', 'timpani-driven buildup into the sabi'],
    vocal: ['powerful cinematic Japanese lead', 'soaring high-register sabi delivery'],
    production: ['wide cinematic full-band mix', 'orchestral layers stacked under the band'],
    harmony: ['dramatic key-adjacent modulation into the sabi', 'suspended orchestral tension resolving at the hook'],
    moods: ['dramatic', 'soaring', 'cinematic'],
    audiences: ['애니송풍 시네마틱 팝', '오프닝 테마 에너지'],
    // TASK C1 (§3-4) — market research's own IP-avoidance requirement: no
    // named anime title, character, studio, or song reference, ever.
    avoidTraits: ['specific anime title reference', 'named character reference', 'named studio reference']
  }),
  legacyGenrePack({
    id: 'jp2030-heisei-nostalgia',
    label: 'Heisei Nostalgia Pop',
    styleCore: 'Heisei-era-nostalgic band pop, warm guitar-and-piano interplay, drama-theme-song emotional arc',
    instruments: ['warm mellow-toned guitar', 'gentle grand piano', 'melodic fretless bass', 'gently brushed drum kit'],
    tempoRange: [88, 118],
    goodFor: ['헤이세이 노스탤지어', 'drama theme-song mood', '2000년대 감성'],
    archetypes: ['jp-2030-pop'],
    tier: 'core'
  }, 'jp-2030', { rhythm: ['unhurried Heisei-pop ballad pulse', 'gentle build through the B-melo'], vocal: ['warm nostalgic Japanese lead', 'emotive sabi lift'], production: ['warm 2000s-style radio mix', 'live-band room warmth'], harmony: ['nostalgic major-seventh verse color opening into the sabi', 'gentle key-adjacent lift at the final chorus'], moods: ['nostalgic', 'warm', 'emotional'], audiences: ['헤이세이 노스탤지어', '드라마 주제가 무드'], avoidTraits: [] }),
  legacyGenrePack({
    id: 'jp2030-dance-vocal',
    label: 'Dance Vocal Crossover',
    styleCore: 'dance-vocal crossover pop, clean guitar chop and bright piano stabs over a performance-ready beat',
    instruments: ['clean rhythm guitar chop', 'bright piano stabs', 'programmed dance-pop beat', 'synth bass underlay'],
    tempoRange: [108, 128],
    goodFor: ['댄스보컬·크로스오버', 'performance-ready energy', 'group vocal choreo'],
    archetypes: ['jp-2030-pop'],
    tier: 'core'
  }, 'jp-2030', { rhythm: ['four-on-the-floor dance-pop pulse with syncopated rhythmic chops', 'tight choreography-ready beat grid'], vocal: ['crisp unison group vocal', 'confident lead breaking from the group in the sabi'], production: ['bright performance-pop mix', 'tight rhythmic low end'], harmony: ['simple bright diatonic movement', 'sabi widens into stacked group harmony'], moods: ['confident', 'bright', 'performance-ready'], audiences: ['댄스보컬·크로스오버', '퍼포먼스 에너지'], avoidTraits: [] }),
  legacyGenrePack({
    id: 'jp2030-kawaii-idol',
    label: 'Kawaii Idol Pop',
    styleCore: 'kawaii idol pop, bright piano-and-guitar hook stacked over an energetic beat, easy-to-follow sabi',
    instruments: ['chirpy synth-piano hook stabs', 'strummed acoustic-leaning guitar chop', 'energetic pop drum kit', 'bubbly plucked bassline'],
    tempoRange: [118, 145],
    goodFor: ['카와이 아이돌팝', 'call-and-response chant', 'high-energy singalong'],
    archetypes: ['jp-2030-pop'],
    tier: 'core'
  }, 'jp-2030', { rhythm: ['bouncy eighth-note idol-pop pulse', 'call-and-response chant break'], vocal: ['bright youthful group vocal', 'high, easy-to-follow sabi melody'], production: ['bright clean idol-pop mix', 'punchy compressed pop drums'], harmony: ['simple bright major-key hook progression', 'sabi opens wide and high above the verse'], moods: ['bright', 'energetic', 'playful'], audiences: ['카와이 아이돌팝', '하이 에너지 싱어롱'], avoidTraits: ['adult romantic themes'] }),
  legacyGenrePack({
    id: 'jp2030-neo-citypop',
    label: 'Neo City Pop',
    styleCore: 'bedroom-produced neo city pop, minimal digital synth bass and one clean guitar line, sparser than the genre\'s glossy 80s-revival mainstream',
    instruments: ['minimal digital synth bass', 'programmed lo-fi-leaning drum kit', 'single clean chorus guitar line', 'sparse electric piano touches'],
    tempoRange: [96, 116],
    goodFor: ['시티팝·네오시티팝', 'bedroom-producer revival', 'minimal night mix'],
    archetypes: ['jp-2030-pop'],
    tier: 'core'
  }, 'jp-2030', {
    rhythm: ['understated syncopated groove, sparser than mainstream city pop', 'loose, unquantized-feeling pocket'],
    vocal: ['close, unpolished Japanese lead', 'restrained delivery, no belted climax'],
    production: ['minimal bedroom-DAW mix, deliberately less glossy than mainstream city pop', 'slightly uneven, hand-mixed transitions'],
    harmony: ['simple ii-V movement without dense extended-chord stacking', 'unresolved suspended tones left hanging'],
    moods: ['minimal', 'understated', 'nocturnal'],
    audiences: ['시티팝·네오시티팝', '베드룸 프로듀서 리바이벌'],
    // TASK C1 (§1-1/§3-3) — 54 city-pop/future-funk ids already exist in
    // this library; these are the exact generic clichés that would make a
    // 55th indistinguishable from them.
    avoidTraits: ['generic neon Tokyo skyline', 'sports car at night', 'palm trees and sunset boulevard']
  }),
  legacyGenrePack({
    id: 'jp2030-chill-neosoul',
    label: 'Chill Neo Soul J-Pop',
    styleCore: 'chill neo-soul-adjacent J-pop, warm fretless-leaning bass and mellow Rhodes-style keys, soft-focus low-lit intimacy',
    instruments: ['warm fretless-leaning bass', 'soft programmed rim-click loop', 'mellow Rhodes-style keys', 'hazy ambient pad'],
    tempoRange: [74, 94],
    goodFor: ['칠 R&B·네오소울', 'late-night wind-down', 'intimate vocal focus'],
    archetypes: ['jp-2030-pop'],
    tier: 'core'
  }, 'jp-2030', { rhythm: ['unhurried unforced J-pop tempo', 'soft syncopation that never rushes the phrase'], vocal: ['soft breathy Japanese delivery', 'unhurried melodic phrasing with gentle drop-offs'], production: ['soft-focus low-lit room tone', 'breathy vocal placed intimately upfront'], harmony: ['soft major-leaning progression with unresolved suspensions', 'gentle chromatic passing tones between phrases'], moods: ['intimate', 'late-night', 'restrained'], audiences: ['칠 R&B·네오소울', '밤 시간대 무드'], avoidTraits: ['four-on-the-floor', 'idol call-and-response chant', 'sidechained pump'] })
];

export const eraGenrePacks: StructuredGenrePack[] = [
  legacyGenrePack({
    id: 'kayokyoku-70s',
    label: '1970s Kayokyoku',
    styleCore: '1970s Japanese kayokyoku, live brass section, sweeping strings, wet spring and plate reverb, analog tape saturation, narrow stereo image, soft top-end rolloff',
    arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['kayokyoku-70s'],
    instruments: ['electric piano', 'live brass section', 'live strings', 'brushed drums', 'round electric bass'],
    tempoRange: [78, 94],
    goodFor: ['Showa seventies channel', 'Japanese senior playlist', 'station farewell scenes'],
    archetypes: ['showa-70s'],
    tier: 'core'
  }, 'japanese-era', { rhythm: ['restrained kayokyoku ballad pulse'], vocal: ['mature Japanese lead vocal'], production: ['analog tape saturation', 'spring and plate reverb', 'narrow stereo image'], harmony: ['graceful minor-to-major chorus cadence'], moods: ['nostalgic', 'cinematic'], audiences: ['Japanese seniors', 'Showa playlist listeners'], avoidTraits: ['modern EDM synths', 'trap hi-hats', 'hard autotune'] }),
  legacyGenrePack({
    id: 'japanese-folk-70s',
    label: '1970s Japanese Folk',
    styleCore: '1970s Japanese folk, acoustic guitar centered, modest live ensemble, close-mic vocal, dry room intimacy, analog tape softness, no modern polish',
    instruments: ['fingerpicked acoustic guitar', 'light upright piano', 'soft hand percussion', 'simple bass'],
    tempoRange: [82, 100],
    goodFor: ['Showa seventies channel', 'handwritten letter scenes', 'night train scenes'],
    archetypes: ['showa-70s'],
    tier: 'core'
  }, 'japanese-era', { rhythm: ['plain acoustic folk pulse'], vocal: ['unforced close Japanese vocal'], production: ['close-mic intimacy', 'soft analog tape hiss', 'small room realism'], harmony: ['simple folk-pop movement'], moods: ['plainspoken', 'wistful'], audiences: ['Japanese folk listeners', 'Showa playlist listeners'], avoidTraits: ['stadium folk-rock excess', 'modern bedroom-pop haze', 'hard autotune'] }),
  legacyGenrePack({
    id: 'new-music-70s',
    label: '1970s New Music',
    styleCore: '1970s Japanese new music, acoustic guitar plus live band, sophisticated chords, lyrical adult pop, analog tape warmth, live rhythm section, soft top-end rolloff',
    arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['new-music-70s'],
    instruments: ['acoustic guitar', 'upright piano', 'clean electric guitar', 'live drums', 'warm bass'],
    tempoRange: [86, 102],
    goodFor: ['Showa seventies channel', 'window seasons', 'radio memory scenes'],
    archetypes: ['showa-70s'],
    tier: 'core'
  }, 'japanese-era', { rhythm: ['hand-played singer-songwriter band pulse'], vocal: ['lyrical adult Japanese vocal'], production: ['live band warmth', 'analog tape color', 'restrained stereo width'], harmony: ['sophisticated add9 and maj7 colors'], moods: ['lyrical', 'refined'], audiences: ['Japanese new-music listeners', 'Showa playlist listeners'], avoidTraits: ['ultra-wide modern mix', 'sidechain pumping', 'trap hi-hats'] }),
  legacyGenrePack({
    id: 'showa-groove-70s',
    label: '1970s Showa Groove',
    styleCore: '1970s funk and soul influenced Japanese kayokyoku, clavinet, wah guitar, brass stabs, live bass pocket, tape saturation, spring reverb, narrow stereo',
    instruments: ['clavinet', 'wah electric guitar', 'brass stabs', 'live bass', 'tight drum kit'],
    tempoRange: [96, 114],
    goodFor: ['Showa seventies channel', 'neon alley scenes', 'danceable retro sets'],
    archetypes: ['showa-70s'],
    tier: 'core'
  }, 'japanese-era', { rhythm: ['syncopated live funk-soul pocket'], vocal: ['confident Japanese pop vocal'], production: ['tape-saturated live groove', 'spring reverb', 'narrow vintage stereo'], harmony: ['soul-colored dominant and minor seventh chords'], moods: ['groovy', 'retro-cinematic'], audiences: ['Showa groove listeners', 'retro Japanese playlists'], avoidTraits: ['modern EDM synths', 'trap hi-hats', 'sidechain pumping'] }),
  legacyGenrePack({
    id: 'jpop-2000s-ballad',
    label: 'Early 2000s J-Pop Ballad',
    styleCore: 'early-2000s Japanese pop ballad, piano and strings, big chorus, stacked harmonies, bright wide digital mix, strong compression, crisp high-end',
    arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['jpop-2000s-ballad'],
    instruments: ['bright piano', 'large string pad', 'clean electric guitar', 'compressed pop drums', 'layered backing vocals'],
    tempoRange: [72, 88],
    goodFor: ['Millennium J-pop channel', 'graduation scenes', 'first train scenes'],
    archetypes: ['j2000s'],
    tier: 'core'
  }, 'japanese-era', { rhythm: ['slow pop-ballad build'], vocal: ['clear emotive Japanese lead vocal with harmonies'], production: ['bright wide digital mix', 'firm compression', 'stacked chorus vocals'], harmony: ['big pop-ballad chorus lift'], moods: ['emotional', 'anthemic'], audiences: ['early-2000s J-pop listeners', 'general Japanese playlist listeners'], avoidTraits: ['lo-fi vintage haze', 'trap hi-hats', 'modern bedroom-pop texture'] }),
  legacyGenrePack({
    id: 'jpop-2000s-rnb',
    label: 'Early 2000s J-Pop R&B',
    styleCore: 'early-2000s Japanese pop R&B, 16th-note groove, synth bass, melismatic vocal lines, stacked chorus, bright digital sheen, crisp hi-hats',
    instruments: ['synth bass', 'electric piano', 'crisp hi-hats', 'digital drum kit', 'silky synth pad'],
    tempoRange: [86, 104],
    goodFor: ['Millennium J-pop channel', 'late-night call scenes', 'station waiting scenes'],
    archetypes: ['j2000s'],
    tier: 'core'
  }, 'japanese-era', { rhythm: ['16th-note R&B pocket'], vocal: ['smooth Japanese vocal with tasteful melisma'], production: ['bright digital sheen', 'compressed low end', 'stacked chorus layers'], harmony: ['R&B seventh-chord movement'], moods: ['sleek', 'yearning'], audiences: ['early-2000s J-pop R&B listeners', 'night playlist listeners'], avoidTraits: ['trap hi-hats', 'lo-fi vintage texture', 'modern bedroom-pop haze'] }),
  legacyGenrePack({
    id: 'jpop-2000s-band',
    label: 'Early 2000s J-Pop Band',
    styleCore: 'early-2000s Japanese band pop, distortion guitars, straight 8th-note drive, big melodic chorus, bright digital mix, compressed drums',
    instruments: ['distortion electric guitar', 'clean arpeggio guitar', 'electric bass', 'compressed rock drums', 'synth pad layer'],
    tempoRange: [118, 138],
    goodFor: ['Millennium J-pop channel', 'bicycle school route scenes', 'graduation energy'],
    archetypes: ['j2000s'],
    tier: 'core'
  }, 'japanese-era', { rhythm: ['straight 8th-note band drive'], vocal: ['open Japanese pop-rock vocal'], production: ['bright compressed band mix', 'wide rhythm guitars', 'clear hi-hat detail'], harmony: ['major-key chorus lift'], moods: ['youthful', 'forward'], audiences: ['early-2000s band-pop listeners', 'general Japanese playlist listeners'], avoidTraits: ['modern trap elements', 'lo-fi demo texture', 'screamo aggression'] }),
  legacyGenrePack({
    id: 'jpop-2000s-dance',
    label: 'Early 2000s J-Pop Dance',
    styleCore: 'early-2000s Japanese dance-pop, four-on-the-floor pulse, bright digital synth layers, clean chorus stacks, crisp hi-hats, wide polished mix',
    instruments: ['digital synth lead', 'four-on-the-floor kick', 'synth pad layer', 'crisp hi-hats', 'stacked backing vocals'],
    tempoRange: [120, 132],
    goodFor: ['Millennium J-pop channel', 'summer festival scenes', 'bright early-2000s sets'],
    archetypes: ['j2000s'],
    tier: 'core'
  }, 'japanese-era', { rhythm: ['clean 4/4 dance-pop pulse'], vocal: ['bright Japanese pop vocal with chorus stacks'], production: ['wide polished digital mix', 'strong compression', 'clear high-frequency detail'], harmony: ['uplifting pop chorus movement'], moods: ['bright', 'energetic'], audiences: ['early-2000s dance-pop listeners', 'general Japanese playlist listeners'], avoidTraits: ['modern EDM drop', 'trap hi-hats', 'lo-fi vintage haze'] })
];

export const modernGenrePacks: StructuredGenrePack[] = [
  legacyGenrePack({
    id: 'alt-rnb',
    label: 'Alternative R&B',
    styleCore: 'alternative R&B, slow 16th-note pocket, filtered synth pads, spacious reverb, whispered ad-libs, deep sub bass, nocturnal modern mix',
    arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['alt-rnb'],
    instruments: ['filtered synth pad', 'minimal R&B drums', 'deep sub bass', 'electric piano', 'vocal ad-lib layers'],
    tempoRange: [68, 86],
    goodFor: ['Chill Hours', 'late-night R&B', 'rainy city playlist'],
    archetypes: ['modern-chill', 'city-night'],
    tier: 'core'
  }, 'rnb', { rhythm: ['slow 16th-note R&B pocket', 'laid-back half-time sway'], vocal: ['soft close R&B vocal with whispered ad-libs'], production: ['spacious reverb', 'filtered synth pad haze', 'deep sub-bass focus'], harmony: ['dark seventh chords', 'minor add9 color'], moods: ['nocturnal', 'intimate', 'rainy'], audiences: ['20s chill playlists', 'late-night R&B listeners'], avoidTraits: ['bright EDM supersaw', 'hard autotune lead', 'busy acoustic cafe strumming'] }),
  legacyGenrePack({
    id: 'neo-soul',
    label: 'Neo-Soul',
    styleCore: 'neo-soul, live drum groove, Rhodes electric piano extended chords, bass slides, hand-played pocket, close stacked harmonies',
    arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['neo-soul'],
    instruments: ['Rhodes electric piano', 'live drums', 'sliding electric bass', 'clean rhythm guitar', 'stacked background vocals'],
    tempoRange: [78, 96],
    goodFor: ['Chill Hours', 'soulful evening', 'warm studio playlist'],
    archetypes: ['modern-chill'],
    tier: 'core'
  }, 'rnb', { rhythm: ['hand-played neo-soul pocket', 'laid-back live drum groove'], vocal: ['soulful controlled R&B vocal'], production: ['close-mic studio warmth', 'rounded low end', 'natural live-room detail'], harmony: ['extended seventh and ninth chords', 'Rhodes voicing movement'], moods: ['soulful', 'warm', 'late-evening'], audiences: ['neo-soul listeners', 'adult modern R&B playlists'], avoidTraits: ['excess hard-tuned autotune', 'trap hi-hat clutter', 'karaoke soul backing'] }),
  legacyGenrePack({
    id: 'trap-soul',
    label: 'Trap-Soul',
    styleCore: 'trap-soul, 808 slides, tight hi-hat rolls, dark synth pad, doubled vocal shadows, sparse nocturnal drums',
    arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['trap-soul'],
    instruments: ['808 slide bass', 'tight hi-hat rolls', 'dark synth pad', 'minimal snare', 'doubled vocal ad-libs'],
    tempoRange: [62, 82],
    goodFor: ['Chill Hours', 'late-night drive', 'dark R&B playlist'],
    archetypes: ['modern-chill'],
    tier: 'core'
  }, 'rnb', { rhythm: ['sparse trap-soul pulse', 'slow rolling hi-hat grid'], vocal: ['doubled intimate vocal with ad-lib shadows'], production: ['dark pad ambience', 'clean 808 low end', 'wide vocal delay throws'], harmony: ['minor-key R&B movement', 'suspended dark pad harmony'], moods: ['dark', 'late-night', 'brooding'], audiences: ['modern R&B listeners', 'night-drive playlists'], avoidTraits: ['aggressive drill energy', 'festival EDM drop', 'overly bright pop-rock guitars'] }),
  legacyGenrePack({
    id: 'rnb-ballad-2020s',
    label: '2020s R&B Ballad',
    styleCore: 'modern R&B ballad, piano and sub bass, large dynamic contrast, close lead vocal, airy backing stack, cinematic chorus space',
    instruments: ['felt piano', 'sub bass', 'minimal electronic drums', 'airy backing vocals', 'soft string pad'],
    tempoRange: [64, 78],
    goodFor: ['Chill Hours', 'emotional R&B', 'late-night ballad'],
    archetypes: ['modern-chill'],
    tier: 'core'
  }, 'rnb', { rhythm: ['slow modern R&B ballad pulse', 'minimal kick-and-snap support'], vocal: ['emotional close R&B vocal'], production: ['wide dynamic contrast', 'piano plus sub-bass space', 'airy chorus stacks'], harmony: ['minor-to-major emotional lift', 'suspended piano chords'], moods: ['tender', 'nocturnal', 'cinematic'], audiences: ['modern ballad listeners', 'late-night vocal playlists'], avoidTraits: ['power ballad shouting', 'cheap karaoke strings', 'overly wet reverb wash'] }),
  legacyGenrePack({
    id: 'chill-rap',
    label: 'Chill Rap',
    styleCore: 'chill rap, relaxed conversational flow, lofi drums, jazz sample texture, mellow sub bass, soft melodic hook',
    arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['chill-rap'],
    instruments: ['lofi drum kit', 'jazz sample texture', 'mellow sub bass', 'soft electric piano loop', 'melodic hook vocal'],
    tempoRange: [70, 85],
    goodFor: ['Chill Hours', 'study rap', 'rainy commute playlist'],
    archetypes: ['modern-chill', 'city-night'],
    tier: 'core'
  }, 'hiphop', { rhythm: ['relaxed rap pocket', 'loose lofi drum swing'], vocal: ['calm conversational rap flow with melodic hook'], production: ['dusty sample texture', 'soft vinyl grain', 'vocal-forward low volume mix'], harmony: ['simple jazzy loop harmony', 'warm minor seventh color'], moods: ['relaxed', 'focused', 'rainy'], audiences: ['chill rap listeners', 'study and commute playlists'], avoidTraits: ['aggressive battle-rap delivery', 'bright EDM synths', 'heavy club trap drop'] }),
  legacyGenrePack({
    id: 'lofi-hiphop-study',
    label: 'Lo-fi Hip-Hop Study',
    styleCore: 'lo-fi hip-hop study beat, vinyl noise, loose swing, short dusty loop, mellow keys, low-distraction vocal optional',
    instruments: ['dusty piano loop', 'vinyl crackle', 'loose swing drums', 'warm bass', 'soft Rhodes'],
    tempoRange: [72, 88],
    goodFor: ['Chill Hours', 'study playlist', 'focus background'],
    archetypes: ['modern-chill'],
    tier: 'core'
  }, 'lofi', { rhythm: ['loose head-nod swing', 'short loop-based beat'], vocal: ['optional soft hook vocal kept low'], production: ['vinyl noise', 'tape-soft transients', 'dusty loop texture'], harmony: ['short jazzy two-chord loop', 'warm key color'], moods: ['focused', 'cozy', 'rainy'], audiences: ['study playlists', 'lo-fi hip-hop listeners'], avoidTraits: ['busy rap verses', 'loud vinyl crackle', 'bright EDM synths'] }),
  legacyGenrePack({
    id: 'boom-bap-mellow',
    label: 'Mellow Boom-Bap',
    styleCore: 'mellow boom-bap, dusty drums, filtered bass, soul sample color, relaxed pocket, warm hook vocal',
    instruments: ['dusty boom-bap drums', 'filtered bass', 'soul sample texture', 'Rhodes chop', 'warm hook vocal'],
    tempoRange: [78, 92],
    goodFor: ['Chill Hours', 'mellow rap set', 'evening walk playlist'],
    archetypes: ['modern-chill'],
    tier: 'core'
  }, 'hiphop', { rhythm: ['mellow boom-bap backbeat', 'lazy head-nod pocket'], vocal: ['relaxed low-pressure rap or sung hook'], production: ['dusty drum breaks', 'filtered bass warmth', 'sample-like soul color'], harmony: ['minor soul loop harmony', 'warm dominant chord touch'], moods: ['mellow', 'nostalgic', 'streetlight'], audiences: ['mellow rap listeners', 'night walk playlists'], avoidTraits: ['hard battle-rap tone', 'glossy EDM drums', 'overcrowded percussion'] }),
  legacyGenrePack({
    id: 'jazz-rap',
    label: 'Jazz Rap',
    styleCore: 'jazz rap, walking bass, brush drums, horn stabs, relaxed spoken flow, smoky room texture',
    instruments: ['walking upright bass', 'brush drums', 'muted horn stabs', 'jazz piano loop', 'spoken rap vocal'],
    tempoRange: [82, 98],
    goodFor: ['Chill Hours', 'late jazz rap', 'study and night cafe'],
    archetypes: ['modern-chill'],
    tier: 'core'
  }, 'hiphop', { rhythm: ['laid-back jazz-rap swing', 'brush-drum hip-hop pocket'], vocal: ['relaxed articulate rap flow'], production: ['smoky room texture', 'sample-like jazz warmth', 'rounded low end'], harmony: ['jazz turnaround loops', 'minor seventh horn color'], moods: ['smoky', 'thoughtful', 'late-night'], audiences: ['jazz rap listeners', 'night study playlists'], avoidTraits: ['fast technical rap display', 'busy bebop solo clutter', 'trap hi-hat rolls'] }),
  legacyGenrePack({
    id: 'city-pop-modern',
    label: 'Modern City Pop',
    styleCore: 'modern city pop, bright chorus guitar, slap bass, analog synth lead, polished night-drive groove, glossy chorus lift',
    arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['city-pop-modern'],
    instruments: ['bright chorus guitar', 'slap bass', 'analog synth lead', 'electric piano', 'tight pop drums'],
    tempoRange: [105, 118],
    goodFor: ['City Night Drive', 'urban night playlist', 'modern city-pop set'],
    archetypes: ['city-night', 'modern-chill'],
    tier: 'core'
  }, 'city-pop', { rhythm: ['tight modern city-pop groove', 'syncopated bass-forward pulse'], vocal: ['clean modern pop vocal with airy backing'], production: ['glossy night-drive polish', 'analog synth color', 'bright stereo guitars'], harmony: ['maj7 city-pop lift', 'smooth pre-chorus climb'], moods: ['urban', 'bright', 'night-drive'], audiences: ['city-pop listeners', 'drive playlists'], avoidTraits: ['cheap retro parody', 'overly vintage tape wobble', 'festival EDM drop'] }),
  legacyGenrePack({
    id: 'future-funk',
    label: 'Future Funk',
    styleCore: 'future funk, filter-house cuts, sample-treated disco color, fast groove, sidechain bounce, bright bass movement',
    instruments: ['filtered disco guitar chop', 'sidechain synth pad', 'bright slap bass', 'house kick', 'sample-treated vocal chop'],
    tempoRange: [118, 128],
    goodFor: ['City Night Drive', 'upbeat city playlist', 'retro-modern dance set'],
    archetypes: ['city-night'],
    tier: 'core'
  }, 'city-pop', { rhythm: ['fast filter-house groove', 'bouncy four-on-the-floor pulse'], vocal: ['short hook vocal chops or bright pop refrain'], production: ['filter sweeps', 'sidechain bounce', 'sample-treated disco color'], harmony: ['uplifting disco loop harmony', 'bright major-seventh shimmer'], moods: ['energetic', 'neon', 'weekend'], audiences: ['future funk listeners', 'city drive playlists'], avoidTraits: ['muddy lofi haze', 'hard trap drums', 'overlong club intro'] }),
  legacyGenrePack({
    id: 'bedroom-pop',
    label: 'Bedroom Pop',
    styleCore: 'bedroom pop, lo-fi guitar, soft vocal, tape wobble, intimate room tone, small synth pad, understated hook',
    instruments: ['lo-fi electric guitar', 'small synth pad', 'soft drum machine', 'warm bass', 'tape wobble texture'],
    tempoRange: [78, 98],
    goodFor: ['City Night Drive', 'late room playlist', 'soft modern pop'],
    archetypes: ['city-night', 'modern-chill'],
    tier: 'extended'
  }, 'lofi', { rhythm: ['understated bedroom-pop pulse', 'soft drum-machine groove'], vocal: ['soft intimate vocal, close and unforced'], production: ['tape wobble', 'small room tone', 'lo-fi guitar softness'], harmony: ['plain minor-major pop chords', 'gentle synth-pad support'], moods: ['intimate', 'hazy', 'late-room'], audiences: ['bedroom-pop listeners', 'quiet night playlists'], avoidTraits: ['overpolished arena pop', 'trap hi-hat clutter', 'wide EDM synths'] }),
  legacyGenrePack({
    id: 'disco-pop-2020s',
    label: '2020s Disco Pop',
    styleCore: '2020s disco pop, four-on-the-floor kick, string stabs, bright chorus, tight funk guitar, crisp compressed dance-pop mix',
    arrangementNarrative: LEAD_ARRANGEMENT_NARRATIVES['disco-pop-2020s'],
    instruments: ['four-on-the-floor kick', 'string stabs', 'tight funk guitar', 'synth bass', 'stacked pop vocals'],
    tempoRange: [112, 124],
    goodFor: ['City Night Drive', 'bright commute', 'upbeat modern pop'],
    archetypes: ['city-night'],
    tier: 'core'
  }, 'city-pop', { rhythm: ['clean four-on-the-floor disco-pop pulse', 'tight funk guitar chop'], vocal: ['bright modern pop vocal with stacked chorus'], production: ['crisp compression', 'wide dance-pop stereo', 'clear hi-hat sparkle'], harmony: ['major-key disco lift', 'bright pre-chorus climb'], moods: ['bright', 'confident', 'city-night'], audiences: ['modern pop listeners', 'drive and workout-light playlists'], avoidTraits: ['dark trap mood', 'muddy vintage mix', 'overlong instrumental disco break'] }),
  // TASK v3.56 Part 3 — popular-genre additions for the 2030 channels
  // (Chill Hours / City Night Drive). signatureSound/shortSignatureSound/
  // minimalSignatureSound are set directly on the pack literal (legacyGenrePack
  // spreads `...pack` into its return value) so these three genres get
  // authored full/short/minimal genre-signature text instead of the
  // auto-derived fallback formula presets.ts's genrePacks mapper uses for
  // packs that don't set signatureSound themselves.
  legacyGenrePack({
    id: 'contemporary-rnb',
    label: 'Contemporary R&B',
    styleCore: 'contemporary R&B, swung 16th-note groove, extended modern chords, layered vocal runs, sub-bass warmth',
    signatureSound: 'laid-back swung 16th-note groove, extended 9th and 11th chord color, electric piano and muted rhythm guitar, deep sub bass, layered vocal runs with call-and-response ad-libs, tight pocket drums',
    shortSignatureSound: 'swung 16th-note groove, extended 9th/11th chords, layered vocal runs with ad-libs',
    minimalSignatureSound: 'swung 16th-note groove, layered vocal runs',
    instruments: ['electric piano', 'muted rhythm guitar', 'sub bass', 'tight pocket drums'],
    tempoRange: [78, 96],
    goodFor: ['Chill Hours', 'contemporary R&B set', 'late-night vocal playlist'],
    archetypes: ['modern-chill'],
    tier: 'core'
  }, 'rnb', { rhythm: ['swung 16th-note R&B pocket', 'tight pocket groove'], vocal: ['layered R&B vocal with runs and call-and-response ad-libs'], production: ['warm sub-bass focus', 'intimate modern studio space'], harmony: ['extended 9th and 11th chord color', 'stacked modern seventh-chord movement'], moods: ['smooth', 'contemporary', 'intimate'], audiences: ['contemporary R&B listeners', 'late-night vocal playlists'], avoidTraits: ['aggressive trap density', 'explicit sensuality', 'thin drum-machine tone'] }),
  legacyGenrePack({
    id: 'city-pop-night',
    label: 'City Pop Night Drive',
    styleCore: 'city pop night drive, fretless-style bass glides, FM synth bell stabs, gated snare pop, cassette-warm groove',
    signatureSound: 'fretless-style bass glides, gated snare pop hits, FM synth bell stabs, wide chorus-drenched rhythm guitar, cassette-warm night-drive mix, no vocal solo break',
    shortSignatureSound: 'fretless bass glides, FM synth bell stabs, gated snare pop hits',
    minimalSignatureSound: 'fretless bass glides, FM synth bells',
    instruments: ['fretless-style bass', 'FM synth bell lead', 'chorus rhythm guitar', 'gated snare drums'],
    tempoRange: [100, 116],
    goodFor: ['City Night Drive', 'late-night urban set', 'nostalgic-modern city pop'],
    archetypes: ['city-night'],
    tier: 'core'
  }, 'city-pop', { rhythm: ['fretless bass glide groove', 'syncopated night-drive pulse'], vocal: ['bright modern pop vocal, airy backing'], production: ['cassette-warm night-drive mix', 'gated snare pop punch', 'FM bell shimmer'], harmony: ['maj7 city-pop lift', 'glossy pre-chorus climb'], moods: ['nostalgic-modern', 'night-drive', 'glossy'], audiences: ['city pop listeners', 'night drive playlists'], avoidTraits: ['cheap retro parody', 'muddy vintage tape wobble', 'festival EDM drop'] }),
  legacyGenrePack({
    id: 'lofi-soul',
    label: 'Lo-fi Soul',
    styleCore: 'lo-fi soul, boom-bap drums, vinyl crackle, filtered Rhodes, warm sub bass, tape wobble',
    signatureSound: 'boom-bap drums, vinyl crackle, filtered Rhodes chords, warm sub bass, vocal phrasing laid behind the beat, tape wobble',
    shortSignatureSound: 'boom-bap drums, filtered Rhodes chords, vocal laid behind the beat',
    minimalSignatureSound: 'boom-bap drums, vinyl crackle',
    instruments: ['boom-bap drums', 'filtered Rhodes', 'warm sub bass', 'tape wobble texture'],
    tempoRange: [78, 92],
    goodFor: ['Chill Hours', 'lo-fi soul set', 'late-night study soul'],
    archetypes: ['modern-chill'],
    tier: 'core'
  }, 'lofi', { rhythm: ['boom-bap soul pocket', 'behind-the-beat phrasing'], vocal: ['soulful vocal laid behind the beat'], production: ['vinyl crackle texture', 'tape wobble softness', 'warm sub-bass rounding'], harmony: ['soulful minor seventh loop', 'warm Rhodes voicing movement'], moods: ['dusty', 'soulful', 'nostalgic'], audiences: ['lo-fi soul listeners', 'study and focus playlists'], avoidTraits: ['bright EDM synths', 'aggressive trap hi-hats', 'clean digital polish'] })
];

const jazzVariants = [
  seed('bass-feature-trio', 'Bass Feature Jazz Trio', 'bass trio swing intimate'),
  seed('classic-vocal-lounge', 'Classic Vocal Jazz Lounge', 'male crooner swing retro lounge'),
  seed('soft-vocal-trio', 'Soft Vocal Jazz Trio', 'female vocal trio swing lounge intimate'),
  seed('bebop-sax-drive', 'Bebop Sax Drive', 'sax upbeat drums swing'),
  seed('cool-muted-trumpet', 'Cool Muted Trumpet Jazz', 'trumpet mellow spacious'),
  seed('modal-night-sketch', 'Modal Night Jazz', 'trumpet spacious slow dark'),
  seed('jazz-ballad-vocal', 'Jazz Ballad Vocal', 'male ballad piano intimate slow'),
  seed('smooth-sax-vocal', 'Smooth Sax Vocal Jazz', 'female sax polished mellow'),
  seed('big-band-swing', 'Big Band Swing', 'brass swing upbeat retro'),
  seed('bossa-vocal-jazz', 'Bossa Vocal Jazz', 'bossa female guitar latin'),
  seed('electric-fusion', 'Electric Jazz Fusion', 'fusion electric rhodes drums'),
  seed('late-night-lounge', 'Late Night Jazz Lounge', 'female lounge guitar intimate'),
  seed('rain-noir-jazz', 'Rain Noir Jazz', 'noir trumpet rain dark'),
  seed('organ-soul-jazz', 'Organ Soul Jazz', 'organ soul funk male'),
  seed('hard-bop-club', 'Hard Bop Club Jazz', 'sax drums upbeat swing'),
  seed('minimal-trio', 'Minimal Jazz Trio', 'trio bass piano intimate'),
  seed('torch-vocal-jazz', 'Torch Vocal Jazz', 'female vocal slow lounge'),
  seed('spiritual-open-jazz', 'Spiritual Open Jazz', 'sax spacious latin mellow'),
  seed('spacious-chamber-jazz', 'Spacious Chamber Jazz', 'trumpet spacious piano'),
  seed('gypsy-cafe-swing', 'Gypsy Cafe Swing', 'guitar swing male retro'),
  seed('jazz-waltz-vocal', 'Jazz Waltz Vocal', 'female waltz piano'),
  seed('latin-club-jazz', 'Latin Club Jazz', 'latin trumpet upbeat'),
  seed('samba-jazz-vocal', 'Samba Jazz Vocal', 'latin bossa female guitar'),
  seed('post-bop-urban', 'Post-Bop Urban Jazz', 'sax drums spacious'),
  seed('bass-piano-duo', 'Bass and Piano Duo Jazz', 'bass piano instrumental intimate'),
  seed('baritone-vocal-jazz', 'Baritone Vocal Jazz', 'male crooner piano swing'),
  seed('alto-candlelight-jazz', 'Alto Candlelight Jazz', 'female slow lounge intimate'),
  seed('new-orleans-brass', 'New Orleans Brass Jazz', 'brass upbeat swing'),
  seed('cool-baritone-jazz', 'Cool Baritone Jazz', 'male trumpet mellow'),
  seed('alto-sax-trio', 'Alto Sax Trio Jazz', 'sax trio swing intimate'),
  seed('vibraphone-dream-jazz', 'Vibraphone Dream Jazz', 'female dreamy trio'),
  seed('guitar-trio-dinner', 'Guitar Trio Dinner Jazz', 'guitar trio mellow lounge'),
  seed('flugelhorn-ballad', 'Flugelhorn Ballad Jazz', 'trumpet ballad slow cinematic'),
  seed('duet-conversation-jazz', 'Duet Conversation Jazz', 'duet swing lounge'),
  seed('contemporary-vocal-jazz', 'Contemporary Vocal Jazz', 'female modern spacious polished'),
  seed('double-bass-intro-jazz', 'Double Bass Intro Jazz', 'bass trio swing intimate'),
  seed('brush-ballad-jazz', 'Brush Ballad Jazz', 'female piano slow intimate'),
  seed('free-organic-jazz', 'Free Organic Jazz', 'experimental sax drums spacious'),
  seed('fusion-night-drive', 'Fusion Night Drive Jazz', 'fusion electric rhodes synth'),
  seed('acid-jazz-groove', 'Acid Jazz Groove', 'funk organ drums male'),
  seed('nu-jazz-metropolitan', 'Nu Jazz Metropolitan', 'female hiphop bass modern'),
  seed('lofi-vocal-jazz', 'Lo-fi Vocal Jazz', 'lofi female piano tape'),
  seed('jazz-rap-late-night', 'Jazz Rap Late Night', 'rap hiphop piano bass'),
  seed('swing-crooner-ballroom', 'Swing Crooner Ballroom', 'male crooner brass swing'),
  seed('bebop-vocal-scat', 'Bebop Vocal Scat', 'female vocal upbeat swing'),
  seed('hotel-lounge-jazz', 'Hotel Lounge Jazz', 'male lounge electric polished'),
  seed('mellow-flugelhorn-vocal', 'Mellow Flugelhorn Vocal Jazz', 'male trumpet mellow romantic'),
  seed('jazz-blues-club', 'Jazz Blues Club', 'male soul piano swing'),
  seed('cabaret-jazz', 'Cabaret Jazz', 'female lounge piano theatrical'),
  seed('chamber-vocal-jazz', 'Chamber Vocal Jazz', 'female chamber strings intimate')
];

const cityPopVariants = [
  seed('bright-female-groove', 'Bright Female City Pop', 'female bright bass guitar synth'),
  seed('sunset-male-groove', 'Sunset Male City Pop', 'male mellow bass guitar synth'),
  seed('urban-duet', 'Urban Duet City Pop', 'duet guitar synth romantic'),
  seed('summer-bass-slap', 'Summer Bass City Pop', 'female summer bass bright'),
  seed('mellow-night-drive', 'Mellow Night Drive City Pop', 'male mellow synth night'),
  seed('coastal-disco-pop', 'Coastal Disco City Pop', 'female disco upbeat seaside'),
  seed('metropolitan-smooth', 'Metropolitan Smooth City Pop', 'male polished electric'),
  seed('dreamy-pastel-night', 'Dreamy Pastel City Pop', 'female dreamy guitar synth'),
  seed('yacht-marina-pop', 'Marina Yacht City Pop', 'male mellow seaside polished'),
  seed('bittersweet-summer-pop', 'Bittersweet Summer City Pop', 'female summer synth romantic'),
  seed('funky-rhythm-pop', 'Funky Rhythm City Pop', 'male funk guitar brass'),
  seed('night-skyline-ballad', 'Night Skyline City Pop Ballad', 'female ballad strings electric'),
  seed('analog-camera-pop', 'Analog Camera City Pop', 'male analog synth retro'),
  seed('open-window-summer', 'Open Window Summer City Pop', 'female summer guitar bright'),
  seed('moonlit-avenue-pop', 'Moonlit Avenue City Pop', 'female night synth mellow'),
  seed('clean-arpeggio-groove', 'Clean Arpeggio City Pop', 'male guitar electric polished'),
  seed('romantic-duet-glow', 'Romantic Duet City Pop', 'duet romantic synth guitar'),
  seed('luxury-lounge-pop', 'Luxury Lounge City Pop', 'female lounge electric polished'),
  seed('uptempo-80s-bounce', 'Uptempo City Pop Bounce', 'male upbeat funk synth'),
  seed('airy-disco-pulse', 'Airy Disco City Pop', 'female disco synth bright'),
  seed('sax-night-city', 'Sax Night City Pop', 'female sax electric polished'),
  seed('coastal-twilight-pop', 'Coastal Twilight City Pop', 'male seaside mellow synth'),
  seed('glossy-skyline-pop', 'Glossy Skyline City Pop', 'female synth disco polished'),
  seed('urban-romance-pop', 'Urban Romance City Pop', 'male romantic dreamy'),
  seed('analog-tokyo-night', 'Analog Night City Pop', 'female analog synth night'),
  seed('shopping-district-groove', 'Shopping District City Pop', 'male funk guitar electric'),
  seed('rainy-window-pop', 'Rainy Window City Pop', 'female rain mellow'),
  seed('sea-breeze-duet', 'Sea Breeze Duet City Pop', 'duet seaside guitar synth'),
  seed('stylish-low-register', 'Stylish Low Register City Pop', 'male mellow polished bass'),
  seed('sentimental-summer-ballad', 'Sentimental Summer City Pop Ballad', 'female ballad summer strings'),
  seed('sunset-optimist-pop', 'Sunset Optimist City Pop', 'female guitar synth bright'),
  seed('jazzy-luxury-pop', 'Jazzy Luxury City Pop', 'male polished electric'),
  seed('soft-pastel-pop', 'Soft Pastel City Pop', 'female dreamy mellow'),
  seed('open-road-drive', 'Open Road City Pop Drive', 'male upbeat bright synth'),
  seed('duet-ballad', 'Duet City Pop Ballad', 'duet ballad romantic strings'),
  seed('club-disco-pop', 'Club Disco City Pop', 'female disco funk bright'),
  seed('mature-bass-pop', 'Mature Bass City Pop', 'male bass mellow electric'),
  seed('strings-city-pop', 'Strings City Pop', 'female strings cinematic'),
  seed('playful-guitar-pop', 'Playful Guitar City Pop', 'male upbeat guitar bright'),
  seed('midnight-sax-pop', 'Midnight Sax City Pop', 'female sax night polished'),
  seed('seaside-postcard-pop', 'Seaside Postcard City Pop', 'duet seaside guitar'),
  seed('neon-metropolitan-pop', 'Neon Metropolitan City Pop', 'male synth night bass'),
  seed('heartbreak-rain-pop', 'Heartbreak Rain City Pop', 'female rain romantic'),
  seed('retro-dance-romance', 'Retro Dance Romance City Pop', 'male disco synth retro'),
  seed('luxury-coastal-pop', 'Luxury Coastal City Pop', 'female seaside polished'),
  seed('weekend-drive-pop', 'Weekend Drive City Pop', 'male guitar bass mellow'),
  seed('rooftop-lounge-pop', 'Rooftop Lounge City Pop', 'female lounge rhodes'),
  seed('cinematic-duet-skyline', 'Cinematic Duet City Pop', 'duet cinematic synth'),
  seed('modern-retro-pop', 'Modern Retro City Pop', 'female modern synth guitar'),
  seed('classic-sunlit-pop', 'Classic Sunlit City Pop', 'male retro guitar synth')
];

const rnbVariants = [
  seed('modern-soft-male', 'Modern Soft Male R&B', 'male modern mellow bass'),
  seed('contemporary-airy-female', 'Contemporary Airy R&B', 'female polished intimate'),
  seed('neo-soul-pocket', 'Neo-Soul Pocket', 'female soul rhodes bass'),
  seed('nineties-slow-jam', '90s Slow Jam R&B', 'male slow romantic polished'),
  seed('quiet-storm-baritone', 'Quiet Storm Baritone R&B', 'male slow lounge intimate'),
  seed('alternative-night', 'Alternative Night R&B', 'male dark synth'),
  seed('trap-soul-confession', 'Trap Soul Confession', 'female trap intimate'),
  seed('midnight-slow-jam', 'Midnight Slow Jam', 'male slow electric romantic'),
  seed('soulful-gospel-warmth', 'Soulful Gospel R&B', 'female gospel soul'),
  seed('modern-duet', 'Modern Duet R&B', 'duet synth intimate'),
  seed('silky-studio-rnb', 'Silky Studio R&B', 'female polished mellow'),
  seed('bedroom-rnb', 'Bedroom R&B', 'male intimate dark'),
  seed('neo-soul-groove', 'Neo-Soul Groove', 'female soul rhodes drums'),
  seed('two-thousands-rnb', '2000s R&B Pop', 'male polished bright'),
  seed('intimate-rnb-ballad', 'Intimate R&B Ballad', 'female ballad piano intimate'),
  seed('moody-alt-rnb', 'Moody Alt R&B', 'male dark trap'),
  seed('clean-sensual-rnb', 'Clean Sensual R&B', 'female intimate mellow'),
  seed('baritone-slow-groove', 'Baritone Slow Groove R&B', 'male slow polished'),
  seed('dreamy-night-rnb', 'Dreamy Night R&B', 'female dreamy synth'),
  seed('gospel-soul-lift', 'Gospel Soul R&B Lift', 'male gospel soul organ'),
  seed('old-school-romance-rnb', 'Old School Romance R&B', 'female retro soul'),
  seed('alt-duet-tension', 'Alt Duet R&B Tension', 'duet dark synth'),
  seed('late-night-neo-soul', 'Late Night Neo-Soul', 'male rhodes soul lounge'),
  seed('polished-rnb-pop', 'Polished R&B Pop', 'female polished bright'),
  seed('low-key-rnb', 'Low-Key R&B', 'male mellow intimate'),
  seed('bass-forward-slow-jam', 'Bass Forward Slow Jam', 'female bass slow'),
  seed('confessional-male-rnb', 'Confessional Male R&B', 'male intimate slow'),
  seed('soul-infused-female', 'Soul Infused Female R&B', 'female soul polished'),
  seed('modern-quiet-storm', 'Modern Quiet Storm', 'male slow synth lounge'),
  seed('trap-rnb-night', 'Trap R&B Night', 'female trap dark'),
  seed('soft-duet-rnb', 'Soft Duet R&B', 'duet mellow intimate'),
  seed('atmospheric-rnb', 'Atmospheric R&B', 'male dreamy synth spacious'),
  seed('elegant-neo-soul', 'Elegant Neo-Soul', 'female soul rhodes polished'),
  seed('glossy-nineties-rnb', 'Glossy 90s R&B', 'male polished retro'),
  seed('whisper-alt-rnb', 'Whisper Alt R&B', 'female dark intimate'),
  seed('soulful-male-rnb', 'Soulful Male R&B', 'male soul electric'),
  seed('emotional-female-rnb', 'Emotional Female R&B', 'female intimate polished'),
  seed('minimalist-rnb', 'Minimalist R&B', 'male slow bass'),
  seed('city-night-rnb', 'City Night R&B', 'female night synth polished'),
  seed('neo-soul-duet', 'Neo-Soul Duet', 'duet soul rhodes'),
  seed('heartbreak-rnb', 'Heartbreak R&B', 'male slow dark'),
  seed('romantic-rnb', 'Romantic R&B', 'female romantic electric'),
  seed('moody-baritone-rnb', 'Moody Baritone R&B', 'male dark bass'),
  seed('female-neo-soul-harmony', 'Female Neo-Soul Harmony', 'female soul gospel'),
  seed('smooth-clean-rnb', 'Smooth Clean R&B', 'male polished mellow'),
  seed('airy-alt-rnb', 'Airy Alt R&B', 'female dark synth'),
  seed('gospel-colored-rnb', 'Gospel Colored R&B', 'male gospel organ'),
  seed('luxury-duet-slow-jam', 'Luxury Duet Slow Jam', 'duet slow polished'),
  seed('late-night-confession', 'Late Night Confession R&B', 'female intimate slow'),
  seed('velvet-baritone-rnb', 'Velvet Baritone R&B', 'male bass lounge')
];

const lofiVariants = [
  seed('dusty-study-hop', 'Dusty Study Lo-fi', 'hiphop piano focus tape'),
  seed('rainy-jazzhop', 'Rainy Jazzhop', 'rain bass piano swing'),
  seed('soft-vocal-bedroom', 'Soft Vocal Bedroom Lo-fi', 'female vocal intimate tape'),
  seed('male-chill-reflection', 'Male Chill Lo-fi', 'male guitar mellow'),
  seed('sleepy-instrumental', 'Sleepy Instrumental Lo-fi', 'instrumental rhodes slow focus'),
  seed('lofi-jazz-vocal', 'Lo-fi Jazz Vocal', 'female swing tape'),
  seed('nostalgic-male-lofi', 'Nostalgic Male Lo-fi', 'male tape piano mellow'),
  seed('city-night-lofi', 'City Night Lo-fi', 'female synth dreamy'),
  seed('warm-guitar-loop', 'Warm Guitar Loop Lo-fi', 'instrumental guitar tape'),
  seed('study-beats-piano', 'Piano Study Beats', 'instrumental piano focus'),
  seed('rain-vocal-lofi', 'Rain Vocal Lo-fi', 'female rain rhodes'),
  // TASK v3.56 Part 3 — 'lofi-soul' promoted to a fully authored genre pack
  // in modernGenrePacks below (with real signatureSound/short/minimal
  // forms), replacing this auto-generated seed to avoid a duplicate id.
  seed('cassette-pop-lofi', 'Cassette Pop Lo-fi', 'female guitar tape'),
  seed('jazz-piano-lofi', 'Jazz Piano Lo-fi', 'instrumental piano swing'),
  seed('dreamy-pop-lofi', 'Dreamy Pop Lo-fi', 'female dreamy synth'),
  seed('mellow-rnb-lofi', 'Mellow R&B Lo-fi', 'male bass rhodes'),
  seed('lofi-folk', 'Lo-fi Folk', 'female folk acoustic'),
  seed('city-rain-baritone', 'City Rain Baritone Lo-fi', 'male rain piano'),
  seed('sleepy-duet-lofi', 'Sleepy Duet Lo-fi', 'duet mellow intimate'),
  seed('minimal-focus-lofi', 'Minimal Focus Lo-fi', 'instrumental focus piano'),
  seed('jazz-bass-lofi', 'Jazz Bass Lo-fi', 'bass piano swing'),
  seed('neon-night-lofi', 'Neon Night Lo-fi', 'female synth night'),
  seed('hazy-guitar-lofi', 'Hazy Guitar Lo-fi', 'male guitar tape'),
  seed('coffee-shop-lofi', 'Coffee Shop Lo-fi', 'instrumental guitar swing'),
  seed('heartbreak-lofi', 'Heartbreak Lo-fi', 'female piano slow'),
  seed('soul-ballad-lofi', 'Soul Ballad Lo-fi', 'male soul slow'),
  seed('vinyl-soft-lofi', 'Vinyl Soft Lo-fi', 'female tape dreamy'),
  seed('minimal-beats-lofi', 'Minimal Beats Lo-fi', 'instrumental rhodes focus'),
  seed('jazz-lounge-lofi', 'Jazz Lounge Lo-fi', 'female lounge swing'),
  seed('soft-pop-lofi', 'Soft Pop Lo-fi', 'male synth mellow'),
  seed('rainy-day-lofi', 'Rainy Day Lo-fi', 'female rain guitar'),
  seed('rooftop-night-lofi', 'Rooftop Night Lo-fi', 'male synth night'),
  seed('instrumental-jazz-lofi', 'Instrumental Jazz Lo-fi', 'instrumental trio swing'),
  seed('late-autumn-lofi', 'Late Autumn Lo-fi', 'female piano tape'),
  seed('mellow-duet-lofi', 'Mellow Duet Lo-fi', 'duet rhodes intimate'),
  seed('late-study-lofi', 'Late Study Lo-fi', 'instrumental focus piano'),
  seed('dream-pop-lofi', 'Dream Pop Lo-fi', 'female dreamy synth'),
  seed('close-confession-lofi', 'Close Confession Lo-fi', 'male intimate piano'),
  seed('soft-jazzy-lofi', 'Soft Jazzy Lo-fi', 'female swing bass'),
  seed('dusk-guitar-lofi', 'Dusk Guitar Lo-fi', 'instrumental guitar tape'),
  seed('moonlight-lofi', 'Moonlight Lo-fi', 'female rhodes slow'),
  seed('boom-bap-lofi', 'Boom Bap Lo-fi', 'male hiphop piano'),
  seed('cozy-soul-lofi', 'Cozy Soul Lo-fi', 'female soul intimate'),
  seed('bass-focus-lofi', 'Bass Focus Lo-fi', 'bass focus piano'),
  seed('faded-memory-lofi', 'Faded Memory Lo-fi', 'male guitar tape'),
  seed('ambient-lofi', 'Ambient Lo-fi', 'instrumental ambient piano'),
  seed('twilight-lofi', 'Twilight Lo-fi', 'female rhodes dreamy'),
  seed('rainy-cafe-lofi', 'Rainy Cafe Lo-fi', 'instrumental rain guitar swing'),
  seed('melancholy-lofi', 'Melancholy Lo-fi', 'male piano slow'),
  seed('bedroom-grain-lofi', 'Bedroom Grain Lo-fi', 'female intimate tape')
];

const balladVariants = [
  seed('emotional-baritone', 'Emotional Baritone Ballad', 'male piano strings slow'),
  seed('airy-korean-ballad', 'Airy Korean Ballad', 'female piano strings slow'),
  seed('romantic-low-register', 'Romantic Low Register Ballad', 'male romantic piano'),
  seed('breakup-husky', 'Hushed Breakup Ballad', 'female piano strings rain'),
  seed('cinematic-duet', 'Cinematic Duet Ballad', 'duet strings cinematic'),
  seed('sparse-piano-male', 'Sparse Piano Male Ballad', 'male piano intimate'),
  seed('sentimental-acoustic', 'Sentimental Acoustic Ballad', 'female acoustic piano'),
  seed('grand-slow-build', 'Grand Slow Build Ballad', 'male strings cinematic'),
  seed('late-night-confession', 'Late Night Confession Ballad', 'female piano intimate'),
  seed('soft-pop-ballad', 'Soft Pop Ballad', 'male guitar piano polished'),
  seed('polished-korean-ballad', 'Polished Korean Ballad', 'female piano strings polished'),
  seed('cinematic-baritone', 'Cinematic Baritone Ballad', 'male piano cinematic'),
  seed('fragile-tender-ballad', 'Fragile Tender Ballad', 'female piano slow'),
  seed('rain-heartbreak-ballad', 'Rain Heartbreak Ballad', 'male rain piano'),
  seed('duet-breakup-ballad', 'Duet Breakup Ballad', 'duet piano strings'),
  seed('acoustic-male-ballad', 'Acoustic Male Ballad', 'male acoustic piano'),
  seed('emotional-piano-female', 'Emotional Female Piano Ballad', 'female piano intimate'),
  seed('dramatic-cinematic-ballad', 'Dramatic Cinematic Ballad', 'male strings cinematic'),
  seed('dim-light-ballad', 'Dim Light Ballad', 'female piano slow'),
  seed('understated-male-ballad', 'Understated Male Ballad', 'male slow intimate'),
  seed('ost-piano-ballad', 'OST Piano Ballad', 'female piano strings cinematic'),
  seed('healing-piano-ballad', 'Healing Piano Ballad', 'male piano hopeful'),
  seed('nostalgic-female-ballad', 'Nostalgic Female Ballad', 'female piano strings'),
  seed('soft-duet-ballad', 'Soft Duet Ballad', 'duet piano romantic'),
  seed('cello-confession-ballad', 'Cello Confession Ballad', 'male piano strings intimate'),
  seed('rainy-day-ballad', 'Rainy Day Ballad', 'female rain piano'),
  seed('classic-pop-ballad', 'Classic Pop Ballad', 'male piano polished'),
  seed('dramatic-female-ballad', 'Dramatic Female Ballad', 'female strings cinematic'),
  seed('lullaby-comfort-ballad', 'Lullaby Comfort Ballad', 'male acoustic piano'),
  seed('piano-strings-delicate', 'Delicate Piano Strings Ballad', 'female piano strings'),
  seed('longing-male-ballad', 'Longing Male Ballad', 'male piano slow'),
  seed('winter-female-ballad', 'Winter Female Ballad', 'female piano slow'),
  seed('romantic-confession-ballad', 'Romantic Confession Ballad', 'male romantic piano'),
  seed('aftermath-ballad', 'Breakup Aftermath Ballad', 'female piano intimate'),
  seed('cinematic-duet-rise', 'Cinematic Duet Rise Ballad', 'duet strings cinematic'),
  seed('acoustic-pop-ballad', 'Acoustic Pop Ballad', 'male acoustic piano'),
  seed('moonlight-ballad', 'Moonlight Ballad', 'female piano slow'),
  seed('power-controlled-ballad', 'Controlled Power Ballad', 'male piano strings'),
  seed('wistful-cello-ballad', 'Wistful Cello Ballad', 'female piano strings'),
  seed('sparse-heartbreak-ballad', 'Sparse Heartbreak Ballad', 'male piano intimate'),
  seed('emotional-ost-ballad', 'Emotional OST Ballad', 'female strings cinematic'),
  seed('soft-healing-ballad', 'Soft Healing Ballad', 'male acoustic piano hopeful'),
  seed('sentimental-duet-ballad', 'Sentimental Duet Ballad', 'duet piano strings'),
  seed('dark-toned-ballad', 'Dark Toned Ballad', 'male dark piano'),
  seed('fragile-whisper-ballad', 'Fragile Whisper Ballad', 'female piano intimate'),
  seed('reflective-falsetto-ballad', 'Reflective Falsetto Ballad', 'male piano slow'),
  seed('elegant-female-ballad', 'Elegant Female Ballad', 'female piano polished'),
  seed('midnight-male-ballad', 'Midnight Male Ballad', 'male piano intimate'),
  seed('acoustic-duet-ballad', 'Acoustic Duet Ballad', 'duet acoustic piano'),
  seed('finale-ballad', 'Finale Ballad', 'female strings cinematic')
];

export const notionDerivedGenrePacks: StructuredGenrePack[] = [
  ...jazzVariants.map(variant => makeProfile('jazz', variant)),
  ...cityPopVariants.map(variant => makeProfile('city-pop', variant)),
  ...rnbVariants.map(variant => makeProfile('rnb', variant)),
  ...lofiVariants.map(variant => makeProfile('lofi', variant)),
  ...balladVariants.map(variant => makeProfile('ballad', variant))
];

const SIGNATURE_SOUND_OVERRIDES: Record<string, string> = {
  'adult-contemporary': 'straight 4/4 pop feel, sustained piano pads, clean strummed acoustic, simple diatonic harmony, no swing, no solo',
  'acoustic-pop': 'fingerpicked acoustic guitar, soft piano answers, light hand percussion, natural close room, simple singalong harmony',
  'jazz-pop': 'light swing feel, walking upright bass, ii-V-I turnarounds, maj7/9/13 extended voicings, brushed snare with ride cymbal comping, short improvised piano or saxophone solo in the bridge, warm analog room tone',
  'bossa-cafe': 'bossa nova clave, nylon-string guitar comping on offbeats, soft surdo-less percussion, gentle syncopation, Portuguese-jazz harmony',
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

/**
 * 지시문 46 (TASK C-2) — 시니어 채널 39종 실측(good-morning-memory-radio +
 * oldpop-lounge-main preferredGenres 교집합) 중 vocalPreference가 없던
 * 27종 가운데, 하루가 지적한 재즈 6종(§C-2)만 우선 채운다 — makeProfile로
 * 생성되는 notionDerivedGenrePacks는 vocalPreference 필드 자체가 없어서
 * (§makeProfile 정의 참고), SIGNATURE_SOUND_OVERRIDES와 같은 사후 오버라이드
 * 패턴을 그대로 재사용한다. 장르 관행(크루너/토치송/보컬 트리오 등 실제
 * 스타일 관행)에 근거한 값이다 — verified: false, 하루의 청취 확인 대기.
 * 나머지 senior 21종(adult-contemporary/oldpop-* 다수/rnb-old-school-
 * romance-rnb 등)은 이 지시문에서 채우지 않았다 — 부분구현으로 보고.
 */
// 지시문 50 (TASK A-3) — 하루: "재즈는 남자보다 여자 목소리가 좋아. 재즈
// 장르는 여성 강제가 필요할 것 같아." 재즈 계열(jazz-* 52종) 전체에
// female >= 0.60 하한을 기본으로 둔다 — 지시문46이 채운 6종 중 미달이던
// 4종(classic-vocal-lounge/brush-ballad-jazz/hotel-lounge-jazz/soft-vocal-
// trio)을 이 지시문에서 올리고, vocalPreference가 아예 없던 45종을 새로
// 채운다(§실측: 45종 중 43종은 이 기본값 {male:0.20, female:0.65,
// mixed:0.15}, 2종은 아래 예외 참고). 지시문46이 채운 6종을 되돌리지
// 않는다 — 여기서 올리는 것은 "되돌리기"가 아니라 새 하한 적용이다.
//
// 예외 ① jazz-swing-crooner-ballroom — 크루너(프랭크 시나트라 계열)는
// 남성이 장르 정의다. 여성으로 바꾸면 그 장르가 아니게 된다 — A-4에서
// 세 선택지를 제시하고 하루의 판단을 받는다. 이 지시문에서는 임의로
// 정하지 않고 원래 값(male 0.7)을 유지한다.
//
// 예외 ② jazz-baritone-vocal-jazz · jazz-cool-baritone-jazz — "baritone"은
// (크루너와 마찬가지로) 남성 음역을 직접 지칭하는 장르 정의다. 이
// 지시문이 명시적으로 이름 붙인 예외는 크루너뿐이지만, 같은 논리(정의
// 자체가 성별을 특정한다)가 이 2종에도 그대로 적용돼 female 하한을
// 강제하면 장르 정체성과 충돌한다 — 크루너와 같은 male-lean 값을 주되,
// 크루너와 달리 세 선택지 절차를 거치지 않았다는 점을 보고에 밝힌다
// (§E-2, 추가 확인 필요 항목으로 표시).
export const VOCAL_PREFERENCE_OVERRIDES: Partial<Record<string, { male: number; female: number; mixed: number }>> = {
  // 지시문46이 채운 6종 — 4종은 이 지시문에서 female >= 0.60으로 상향.
  'jazz-classic-vocal-lounge': { male: 0.3, female: 0.6, mixed: 0.1 },
  'jazz-swing-crooner-ballroom': { male: 0.7, female: 0.2, mixed: 0.1 },
  'jazz-torch-vocal-jazz': { male: 0.15, female: 0.75, mixed: 0.1 },
  'jazz-brush-ballad-jazz': { male: 0.3, female: 0.6, mixed: 0.1 },
  'jazz-hotel-lounge-jazz': { male: 0.3, female: 0.6, mixed: 0.1 },
  // 보컬 트리오(냇 킹 콜 트리오류)는 그룹 화음이 정체성이라 mixed 비중을
  // 완전히 낮추지 않되, female 리드 우세로 재배분한다.
  'jazz-soft-vocal-trio': { male: 0.15, female: 0.6, mixed: 0.25 },
  // 신규 45종 — 기본값 (female 0.65, 하한 0.60 초과 여유)
  'jazz-rap': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-bass-feature-trio': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-bebop-sax-drive': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-cool-muted-trumpet': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-modal-night-sketch': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-jazz-ballad-vocal': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-smooth-sax-vocal': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-big-band-swing': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-bossa-vocal-jazz': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-electric-fusion': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-late-night-lounge': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-rain-noir-jazz': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-organ-soul-jazz': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-hard-bop-club': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-minimal-trio': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-spiritual-open-jazz': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-spacious-chamber-jazz': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-gypsy-cafe-swing': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-jazz-waltz-vocal': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-latin-club-jazz': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-samba-jazz-vocal': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-post-bop-urban': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-bass-piano-duo': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-alto-candlelight-jazz': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-new-orleans-brass': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-alto-sax-trio': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-vibraphone-dream-jazz': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-guitar-trio-dinner': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-flugelhorn-ballad': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-duet-conversation-jazz': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-contemporary-vocal-jazz': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-double-bass-intro-jazz': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-free-organic-jazz': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-fusion-night-drive': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-acid-jazz-groove': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-nu-jazz-metropolitan': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-lofi-vocal-jazz': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-jazz-rap-late-night': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-bebop-vocal-scat': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-mellow-flugelhorn-vocal': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-jazz-blues-club': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-cabaret-jazz': { male: 0.2, female: 0.65, mixed: 0.15 },
  'jazz-chamber-vocal-jazz': { male: 0.2, female: 0.65, mixed: 0.15 },
  // 예외 ② — 음역 자체가 장르 정의인 2종 (위 doc comment 참고)
  'jazz-baritone-vocal-jazz': { male: 0.65, female: 0.2, mixed: 0.15 },
  'jazz-cool-baritone-jazz': { male: 0.65, female: 0.2, mixed: 0.15 }
};

// 지시문 20 (TASK B-1) — real gap found: R&B/흑인 감성힙합/랩/트랩힙합
// 벤치마크 14종은 이미 genreLibrary에 있었지만 archetypes가 modern-chill/
// city-night뿐이었다 — 이 둘은 senior-oldpop 워크스페이스 소속이라
// kr-2030 워크스페이스의 kr-2030-pop 채널에서는 워크스페이스 경계 때문에
// 애초에 도달 불가능했다(단순 채널 배선으로 해결 불가). 새 장르를 만들지
// 않고 기존 장르의 워크스페이스 경계만 넓힌다 — 하루 확인 후 진행.
const KR_2030_POP_CROSS_ARCHETYPE_GENRE_IDS: ReadonlySet<string> = new Set([
  'contemporary-rnb', 'rnb-ballad-2020s', 'rnb-contemporary-airy-female', 'rnb-modern-soft-male',
  'alt-rnb', 'rnb-moody-alt-rnb', 'rnb-whisper-alt-rnb', 'rnb-alternative-night',
  'chill-rap', 'boom-bap-mellow', 'jazz-rap',
  'trap-soul', 'rnb-trap-soul-confession', 'rnb-trap-rnb-night'
]);
// 지시문 20 (TASK B-3) — jazz-lofi-vocal-jazz도 같은 이유(archetypes가
// senior-morning/showa-cafe뿐 — modern-chill/kr-2030-pop 둘 다 없어
// lofi-focus-main/kr-2030-pop 어느 쪽에서도 도달 불가)로 확장.
const CROSS_ARCHETYPE_ADDITIONS: Readonly<Record<string, ChannelArchetype[]>> = {
  'jazz-lofi-vocal-jazz': ['modern-chill', 'kr-2030-pop']
};

export const genreLibrary: EraTaggedGenrePack[] = [...legacyGenreProfiles, ...kidsGenreProfiles, ...oldpopGenrePacks, ...kr2030GenrePacks, ...jp2030GenrePacks, ...krkidsGenrePacks, ...jpkidsGenrePacks, ...kridolMaleGenrePacks, ...eraGenrePacks, ...modernGenrePacks, ...notionDerivedGenrePacks].map(genre => {
  const eraTag = GENRE_ERA_TAG_OVERRIDES[genre.id] ?? ERA_BUCKET_BY_GENRE_ID[genre.id];
  const withEra = eraTag ? { ...genre, eraTag } : genre;
  const enriched = SIGNATURE_SOUND_OVERRIDES[genre.id] ? { ...withEra, signatureSound: SIGNATURE_SOUND_OVERRIDES[genre.id] } : withEra;
  const withFlavor = CORE_LYRIC_FLAVOR_IMAGES[genre.id] ? { ...enriched, lyricFlavorImages: CORE_LYRIC_FLAVOR_IMAGES[genre.id] } : enriched;
  // v3.65 (TASK A) — additive only; a genre with no entry in
  // GENRE_TRAIT_OVERRIDES gets `traits: undefined` (unchanged shape).
  const traits = buildGenreTraits(withFlavor);
  const withTraits = traits ? { ...withFlavor, traits } : withFlavor;
  // 지시문 12 (TASK A) — eraBuckets는 354종 전수 부여된 필수 필드다.
  // ERA_BUCKETS_BY_GENRE_ID에 없는 id는 있을 수 없다(제너레이터가 그 시점의
  // genreLibrary 전체를 순회해 만들었다) — 방어적으로만 ['era-neutral'] 폴백.
  const eraBuckets: FineEraBucket[] = ERA_BUCKETS_BY_GENRE_ID[genre.id] ?? ['era-neutral'];
  const eraNoteKo = ERA_NOTE_KO_BY_GENRE_ID[genre.id];
  const withKr2030 = KR_2030_POP_CROSS_ARCHETYPE_GENRE_IDS.has(genre.id) && !withTraits.archetypes?.includes('kr-2030-pop')
    ? { ...withTraits, archetypes: [...(withTraits.archetypes ?? []), 'kr-2030-pop' as const] }
    : withTraits;
  const extraArchetypes = CROSS_ARCHETYPE_ADDITIONS[genre.id];
  const withExtra = extraArchetypes
    ? { ...withKr2030, archetypes: [...new Set([...(withKr2030.archetypes ?? []), ...extraArchetypes])] }
    : withKr2030;
  // 지시문 46 (TASK C-2) — 기존 vocalPreference(legacyGenrePack 등에서
  // 이미 설정된 값)를 덮어쓰지 않는다 — 이 오버라이드 표에 있는 재즈 6종은
  // 원래 vocalPreference가 없었으므로(§실측) 실제로는 항상 신규 부여다.
  const vocalPreference = withExtra.vocalPreference ?? VOCAL_PREFERENCE_OVERRIDES[genre.id];
  const withVocalPreference = vocalPreference ? { ...withExtra, vocalPreference } : withExtra;
  return { ...withVocalPreference, eraBuckets, ...(eraNoteKo ? { eraNoteKo } : {}) };
});
export const genrePacks: GenrePack[] = genreLibrary;
export const importedGenreCount = notionDerivedGenrePacks.length;
export const totalGenreCount = genreLibrary.length;

// 지시문 33 (§3) — measure:checks 실측(scripts/measureCheckCost.ts)이 S4/DV1
// 예측 총시간의 상당 부분을 generateLocalBlueprint 반복 호출로 지목했다.
// getGenreById는 genreLibrary(354종, 런타임에 절대 변경되지 않는 정적
// 배열)를 매 호출마다 선형 탐색(.find)했다 — 실제 생성 경로 하나에서도
// 여러 번 불리는 함수라 O(n) 탐색이 그대로 곱해진다. genreLibrary 자체는
// 모듈 로드 시 한 번만 만들어지므로, id→genre Map도 그때 한 번만 만들면
// 결과는 완전히 동일하고(같은 배열을 감쌀 뿐, 값 변경 없음) 조회만
// O(1)이 된다 — 캐시 대상이지 계산 로직 변경이 아니다.
const genreById = new Map(genreLibrary.map(genre => [genre.id, genre]));

export function getGenreById(id: string) {
  return genreById.get(id);
}

export function getGenresByCategory(categoryId: string) {
  return genreLibrary.filter(genre => genre.categoryId === categoryId);
}

export function getCoreGenreIdsForArchetype(archetype: ChannelArchetype = 'senior-morning') {
  const ids = CORE_GENRE_IDS_BY_ARCHETYPE[archetype] || [];
  return ids.length ? [...ids] : [...SENIOR_MORNING_CORE_GENRE_IDS];
}

export function getCoreGenresForArchetype(archetype: ChannelArchetype = 'senior-morning') {
  const ids = getCoreGenreIdsForArchetype(archetype);
  return ids.map(id => getGenreById(id)).filter(Boolean) as StructuredGenrePack[];
}

export function getDefaultGenreIdsForArchetype(archetype: ChannelArchetype = 'senior-morning') {
  return getCoreGenreIdsForArchetype(archetype).slice(0, 3);
}

export function isCoreGenreForArchetype(genre: GenrePack, archetype: ChannelArchetype = 'senior-morning') {
  return genre.tier === 'core' && getCoreGenreIdsForArchetype(archetype).includes(genre.id);
}

// TASK (genre-archetype sanitization) — same senior-morning-only heuristic
// fallback core/setDirector.ts's genreMatchesChannel already used (a legacy
// pop/jazz/city-pop/lofi/ballad/seasonal genre with no explicit `archetypes`
// tag still counts as senior-morning-eligible when its own text reads as
// quiet/cafe-appropriate and not aggressive/wrong-channel). Kept as its own
// small list here rather than reusing quietCafeSignals/
// aggressiveOrWrongChannelSignals above — those two feed inferArchetypes'
// broader multi-archetype tagging pass; these two are the narrower set
// genreMatchesChannel always used for its own single-archetype runtime check.
const SENIOR_MORNING_ELIGIBILITY_SIGNALS = ['senior', 'morning', 'coffee', 'warm', 'nostalgic', 'old', 'cafe', 'comfort'];
const SENIOR_MORNING_ELIGIBILITY_EXCLUDE_SIGNALS = ['trap', 'rap', 'club', 'hard bop', 'bebop', 'big band', 'aggressive'];

/**
 * TASK (genre-archetype sanitization) — extracted from
 * core/setDirector.ts's genreMatchesChannel (this is the exact predicate
 * every real generation-time genre candidate filter in that file already
 * runs through — see its own updated doc comment), so
 * core/genreSelection.ts's sanitizeGenreIdsForArchetype can reuse the same
 * "is this genre actually valid for this archetype" rule that generation
 * itself uses, instead of inventing a second one. genreMatchesChannel now
 * delegates to this function unchanged (pure refactor — no behavior change
 * for any of its existing callers).
 */
export function isGenreEligibleForArchetype(genre: GenrePack, archetype: ChannelArchetype): boolean {
  if (genre.archetypes?.includes(archetype)) return true;
  if (archetype !== 'senior-morning') return false;
  const text = [
    genre.id,
    genre.label,
    genre.categoryId,
    ...(genre.goodFor || []),
    ...(genre.audiences || []),
    ...(genre.moods || [])
  ].join(' ').toLowerCase();
  if (!containsAny(text, SENIOR_MORNING_ELIGIBILITY_SIGNALS)) return false;
  return !containsAny(text, SENIOR_MORNING_ELIGIBILITY_EXCLUDE_SIGNALS);
}

export function getVisibleGenresForArchetype(
  archetype: ChannelArchetype = 'senior-morning',
  selectedIds: string[] = [],
  recentIds: string[] = []
) {
  const visibleIds = new Set([...getCoreGenreIdsForArchetype(archetype), ...selectedIds, ...recentIds]);
  return genreLibrary.filter(genre => visibleIds.has(genre.id));
}

export interface ExtendedGenreSearchResult {
  genre: GenrePack;
  eligibleForArchetype: boolean;
}

/**
 * 지시문 Fable5-1단계 TASK C — archetype is now required so the search
 * result can flag genres the caller's own channel can't actually use
 * (e.g. K-pop turning up for a senior channel). Results still include
 * ineligible genres (Policy B from the instruction: show + explain, don't
 * silently hide) — eligibleForArchetype tells the caller which ones to
 * disable and why, instead of letting a pick get silently sanitized away
 * later at generation time.
 */
export function searchExtendedGenres(query: string, categoryId = 'all', archetype: ChannelArchetype = 'senior-morning'): ExtendedGenreSearchResult[] {
  const normalized = query.trim().toLowerCase();
  return genreLibrary
    .filter(genre => {
      if (genre.tier !== 'extended') return false;
      if (categoryId !== 'all' && genre.categoryId !== categoryId) return false;
      if (!normalized) return true;
      const haystack = [
        genre.label,
        genre.styleCore,
        genre.shortPrompt,
        genre.productionGuidance,
        ...(genre.aliases || []),
        ...(genre.instruments || []),
        ...(genre.moods || []),
        ...(genre.audiences || [])
      ].join(' ').toLowerCase();
      return haystack.includes(normalized);
    })
    .map(genre => ({ genre, eligibleForArchetype: isGenreEligibleForArchetype(genre, archetype) }));
}

export function searchHiddenGenresForArchetype(
  archetype: ChannelArchetype = 'senior-morning',
  query: string,
  categoryId = 'all'
) {
  const normalized = query.trim().toLowerCase();
  const coreIds = new Set(getCoreGenreIdsForArchetype(archetype));
  return genreLibrary.filter(genre => {
    if (coreIds.has(genre.id)) return false;
    if (categoryId !== 'all' && genre.categoryId !== categoryId) return false;
    if (!normalized) return true;
    const haystack = [
      genre.label,
      genre.styleCore,
      genre.shortPrompt,
      genre.productionGuidance,
      ...(genre.aliases || []),
      ...(genre.instruments || []),
      ...(genre.moods || []),
      ...(genre.audiences || [])
    ].join(' ').toLowerCase();
    return haystack.includes(normalized);
  });
}

const genrePlainDescriptionsKo: Record<string, string> = {
  'adult-contemporary': '따뜻한 성인 팝. 라디오에서 흘러나오는 편안한 느낌.',
  'acoustic-pop': '기타와 피아노가 중심인 담백한 팝. 아침이나 산책에 잘 맞습니다.',
  'jazz-pop': '카페에 어울리는 부드러운 재즈 감성의 팝.',
  'showa-modern': '오래된 찻집처럼 차분하고 세련된 복고 감성.',
  'city-pop-soft': '밤거리보다 조용한 실내에 가까운 부드러운 시티팝.',
  'lofi-cafe': '편안한 카페 배경처럼 낮게 깔리는 포근한 질감.',
  'christmas-soft-pop': '아이들 캐럴보다 성숙한 12월용 따뜻한 팝.',
  'healing-ballad': '감정을 크게 터뜨리지 않고 위로해 주는 발라드.',
  'folk-pop': '일상 이야기가 잘 들리는 소박하고 친근한 팝.',
  'bossa-cafe': '여름 카페처럼 가볍고 우아한 휴식감.',
  'soft-rock': '운전이나 추억 장면에 어울리는 부드러운 라디오 록.',
  'piano-ballad': '피아노가 중심이 되는 조용하고 감정적인 팝 발라드.',
  'retro-soul-pop': '손으로 연주한 듯한 따뜻한 리듬과 성숙한 온기.',
  'synthwave-mellow': '강하지 않은 복고 신스 무드. 밤 드라이브에 가깝습니다.',
  'jazz-classic-vocal-lounge': '조용한 라운지에서 들리는 성숙한 보컬 재즈.',
  'jazz-soft-vocal-trio': '작은 연주 공간처럼 부드럽고 절제된 재즈.',
  'city-pop-rainy-window-pop': '비 오는 창가에 어울리는 차분한 시티팝 색감.'
};

export function describeGenreForUserKo(genre: GenrePack) {
  if (genrePlainDescriptionsKo[genre.id]) return genrePlainDescriptionsKo[genre.id];
  const mood = genre.moods?.[0] || genre.goodFor?.[0] || '편안한 분위기';
  const setting = genre.audiences?.[0] || genre.goodFor?.[1] || '플레이리스트';
  return `${genre.label}의 색깔을 가볍게 더합니다. ${mood} 느낌의 ${setting}에 어울립니다.`;
}

export function compactGenreTechnicalLine(genre: GenrePack) {
  const tempo = genre.tempo || genre.tempoRange;
  const instruments = genre.instruments.slice(0, 2).join(', ');
  return `${tempo[0]}-${tempo[1]} BPM · ${instruments} 중심`;
}
