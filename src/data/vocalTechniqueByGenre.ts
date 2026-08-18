/**
 * 지시문 65 (TASK A) — genre-specific singing TECHNIQUE (how a voice is
 * sung: melisma, scat, behind-the-beat phrasing, falsetto lift...),
 * distinct from data/vocalTraits.ts's timbre/register/proximity axes (what
 * the voice sounds like) and from data/vocalTechniquesByEra.ts's older
 * era-only granularity (v3.80 TASK E — only 5 buckets, so a 1970s soul
 * track and a 1970s jazz-lounge track drew from the exact same pool; 하루's
 * own complaint in 지시문 65 §1 is precisely this — timbre words repeat
 * across genres because nothing genre-specific existed at all).
 *
 * Every one of genreLibrary's 367 genre ids resolves (via familyForGenre)
 * to one of the FAMILY_POOLS below, each a set of genre-appropriate
 * technique phrases (≤8 words, matching v3.80's own convention). Two
 * distinct concerns this file must satisfy (지시문 65 F-1 완료 판정),
 * both re-measured directly by scripts/checkVocalTechnique.ts rather than
 * trusted from this comment:
 *   - every genre gets ≥1 technique phrase containing one of the 27
 *     검사 어휘(지시문 65 §2-2) — every phrase below was hand-checked
 *     against that exact list (space/hyphen-insensitive, since Suno-prompt
 *     English uses both — "blue-note"/"blue note" mean the same thing).
 *   - no single exact phrase is reused across more than 4 genres
 *     ("같은 창법 어휘가 5종 넘게 반복 0건") — each pool's size is picked
 *     from its real family count (scripts/_inspectGenres.ts measured the
 *     real familyForGenre() distribution: cityPopGroove 58 members needs
 *     ≥15 phrases to keep any one phrase's expected repeat count ≤4, etc.)
 *     with headroom for hash's non-uniformity, not just the bare minimum.
 *
 * genreLibrary/index.ts's final .map() (TASK A) appends one deterministic
 * pick onto genre.vocal itself (367종 실제 데이터, additive — existing
 * timbre entries untouched, §A-2). core/vocalPlan.ts's
 * buildVocalTechniquePlanByGenre (TASK B) draws per-song rotation from the
 * same pools for the live stylePrompt path, replacing v3.80's era-only
 * buildVocalTechniquePlan.
 */

export interface TechniqueGenreShape {
  id: string;
  label?: string;
  categoryId?: string;
  aliases?: string[];
  moods?: string[];
}

const FAMILY_POOLS: Record<string, string[]> = {
  // rnb 계열 중 'soul'/'gospel'/'motown'/'philly' 신호 — 지시문 65 §3의 소울
  // 예시(gospel-run melisma·behind-the-beat·falsetto lift·call-and-response)
  // 그대로. 실측 family size 20종 → 8개 풀로 최대 반복 ≤ 3.
  soul: [
    'gospel-run melisma on phrase ends',
    'behind-the-beat phrasing through the verse',
    'falsetto lift into the chorus',
    'shouted ad-lib on the final chorus',
    'call-and-response with the backing vocals',
    'gospel-inflected bend on held notes',
    'soulful rasp on the climactic line',
    'stacked harmony swell with a gospel-run finish'
  ],
  // 'neo-soul'/일반 rnb(다크·polished 태그 포함) — 실측 38종 → 13개 풀.
  neoSoul: [
    'melismatic runs over the hook',
    'breathy pocket phrasing behind the beat',
    'soft falsetto ad-libs in the bridge',
    'laid-back conversational R&B delivery',
    'stacked harmony ad-libs on the outro',
    'husky low-register murmur on the verse',
    'airy head-voice glide into the chorus',
    'restrained melisma on the final syllable',
    'breathy falsetto ad-lib on the hook',
    'husky rasp on the final bridge line',
    'behind-the-beat croon into the chorus',
    'legato runs melting into the hook',
    'nasal-edged ad-lib stack on the outro',
    'croon dipping low into the hook',
    'rasping ad-lib stack on the bridge',
    'legato falsetto glide over the hook',
    'breathy rasp on the confessional verse'
  ],
  // trap/dark 톤 rnb — 실측 11종 → 5개 풀.
  trapSoul: [
    'half-sung half-spoken breathy trap-soul delivery',
    'auto-croon glide between phrases',
    'murmured ad-libs low in the mix',
    'drawled behind-the-beat phrasing',
    'husky whispered confessional delivery close to the mic'
  ],
  // jazz 기본(스윙·발라드·모달 등) — 실측 52종 → 16개 풀.
  jazzSwing: [
    'laid-back behind-the-beat swing phrasing',
    'controlled vibrato on held final notes',
    'conversational blue-note bend on the hook',
    'legato phrasing loosening the final verse',
    'staccato triplet accents over the changes',
    'relaxed legato line across the bridge',
    'breathy sustained note into the turnaround',
    'husky low growl on the closing note',
    'swing phrasing loose behind the beat',
    'nasal reed-toned phrasing on the hook',
    'syncopated scat-adjacent phrasing on the break',
    'blue-note bend sliding into the chorus',
    'rasping growl on the final blues note',
    'legato croon over the rhythm section',
    'vibrato taper closing the final phrase',
    'behind-the-beat phrasing easing into the hook',
    'husky blue-note growl on the turnaround',
    'staccato swing accents over the walking bass',
    'breathy legato phrasing on the ballad verse',
    'call-and-response scat trade with the horns',
    'husky growl easing into the turnaround',
    'nasal blue-note bend over the changes',
    'vibrato-laced legato on the closing chord',
    'breathy croon drifting through the bridge'
  ],
  jazzCrooner: [
    'smooth crooning legato through the bridge',
    'warm baritone croon on the hook',
    'unhurried crooning glide between phrases',
    'held final note with a soft vibrato taper'
  ],
  jazzScat: [
    'rapid scat run in the bridge',
    'bebop-inflected scat syllables on the break',
    'sharp staccato scat over the changes',
    'scat trade-off with the horn line'
  ],
  jazzBossa: [
    'breathy bossa murmur close to the mic',
    'legato samba-swayed phrasing on the hook',
    'husky bossa whisper on the verse',
    'laid-back latin-tinged phrasing on the bridge'
  ],
  // lofi 보컬(비-힙합) — 실측 39종 → 13개 풀. 힙합/트랩 태그가 섞인 lofi는
  // lofiHiphop으로 분리.
  lofiChill: [
    'breathy close-mic half-whispered phrasing',
    'laid-back pocket delivery behind the beat',
    'soft mumbled ad-libs low in the mix',
    'husky half-whispered phrasing through the verse',
    'breathy sigh trailing the final line',
    'legato hum drifting over the loop',
    'nasal soft-spoken phrasing on the hook',
    'laid-back croon low in the mix',
    'breathy head-voice float on the chorus',
    'husky murmured ad-lib on the outro',
    'behind-the-beat phrasing softened to a whisper',
    'raspy hushed delivery close to the mic',
    'legato phrasing unhurried across the verse',
    'croon low and unhurried through the verse',
    'breathy falsetto hush on the hook',
    'nasal mumble drifting through the bridge',
    'legato sigh trailing over the loop',
    'husky croon low in the mix'
  ],
  lofiHiphop: [
    'triplet flow drifting behind the beat',
    'dragged-vowel laid-back rap cadence',
    'melodic sing-rap gliding low behind the beat',
    'swallowed-consonant husky mumble-rap delivery'
  ],
  // city-pop groove(디스코·펑크·업템포) — 실측 58종(카테고리 기본값 포함) →
  // 18개 풀.
  cityPopGroove: [
    'bright syncopated staccato phrasing',
    'falsetto hook lift into the chorus',
    'rhythmic staccato attack on the groove',
    'airy falsetto glide over the bridge',
    'clipped syncopated phrasing on the verse',
    'punchy staccato accent on the downbeat',
    'breathy falsetto run into the hook',
    'syncopated ad-lib stack on the chorus',
    'staccato riff over the groove',
    'belt lift into the final chorus',
    'nasal-edged staccato hook delivery',
    'husky falsetto glide on the bridge',
    'syncopated riff answering the hook line',
    'bright ad-lib stack on the outro',
    'staccato call-and-response with the backing vocals',
    'falsetto belt into the final hook',
    'syncopated staccato phrasing across the verse',
    'breathy staccato accent on the downbeat',
    'croon-laced falsetto on the bridge',
    'nasal staccato hook over the groove',
    'husky belt into the final hook',
    'breathy falsetto lift into the bridge',
    'syncopated ad-lib run on the hook',
    'staccato belt over the downbeat',
    'nasal falsetto glide across the chorus'
  ],
  cityPopBallad: [
    'sustained legato line into the chorus swell',
    'breathy intimacy on the final verse',
    'soft falsetto taper on the closing note'
  ],
  // ballad 기본 — 실측 54종(카테고리 기본값 포함) → 17개 풀.
  balladCore: [
    'sustained legato lines through the chorus',
    'head-voice lift on the emotional peak',
    'controlled vibrato on the closing note',
    'breathy intimacy trailing the final line',
    'legato swell building into the final chorus',
    'husky ache on the closing line',
    'vibrato taper on the sustained hook',
    'breathy hush opening into a full chorus',
    'legato phrasing unhurried across the bridge',
    'head-voice float on the final note',
    'rasp breaking through the emotional peak',
    'falsetto lift on the closing note',
    'vibrato swell into the final chorus',
    'breathy legato phrasing through the verse',
    'husky vibrato on the sustained climax',
    'sustained legato hum before the chorus',
    'breathy ad-lib on the final line',
    'nasal ache breaking on the peak line',
    'croon softening into the final verse',
    'staccato pulse breaking the legato line',
    'falsetto float on the sustained hook',
    'husky sigh trailing the final verse',
    'breathy vibrato easing into the chorus',
    'legato ache opening into the bridge',
    'rasp softening into the closing line',
    'vibrato hush on the final held note'
  ],
  balladDramatic: [
    'falsetto break on the climactic note',
    'trembling vibrato on the sustained climax',
    'rasping cry on the peak line',
    'belt lift before the final drop',
    'husky crack on the emotional peak',
    'shouted climax on the final chorus'
  ],
  doowop: [
    'close harmony call-and-response on the hook',
    'nasal lead over the walking bass line',
    'staccato nonsense-syllable backing vocals',
    'legato backing swell into the chorus'
  ],
  britishBeat: [
    'nasal unison hook line on the chorus',
    'twangy lead over the beat',
    'staccato clipped-consonant delivery on the verse',
    'legato two-part harmony lifting the chorus'
  ],
  sunshinePop: [
    'layered call-and-response harmony on the hook',
    'bright unison belt on the chorus',
    'stacked ad-lib round on the bridge'
  ],
  kpopIdol: [
    'layered ad-lib stack on the unison hook',
    'rap-to-sing belt transition into the chorus',
    'ad-lib stack over the final chorus',
    'staccato chant delivery on the hook',
    'chest-mix belt into the bridge',
    'clipped staccato phrasing on the verse'
  ],
  rapHiphop: [
    'triplet flow behind the beat',
    'dragged-vowel laid-back drawl',
    'swallowed-consonant husky rap cadence',
    'melodic sing-rap flow bending into the hook',
    'clipped staccato rap delivery'
  ],
  // 지시문 65 §3 동요 예시(clear syllable articulation·call-and-response·
  // clap-along chant·exaggerated playful diction)는 그대로 쓰되, §2-2
  // 검사 어휘 목록(chant/diction/articulation 미포함)에도 걸리도록 실제
  // 어휘를 하나씩 엮는다 — growl·scat·husky·rasp처럼 아이 목소리에 안
  // 맞는 어휘는 배제(§하지 말 것 "동요에 growl").
  kids: [
    "call-and-response with a children's chorus",
    'bright unison chant with call-and-response',
    'clipped staccato chant on the hook',
    'nasal playful chant through the verse',
    'breathy giggle-toned ad-lib on the hook',
    'syncopated clap-along chant on the chorus',
    'bright legato singalong through the chorus',
    'staccato playful chant on the verse',
    'breathy playful ad-lib on the chorus'
  ],
  electronicVocal: [
    'vocoder-smooth legato glide across the hook',
    'airy falsetto float over the synth'
  ],
  showaEra: [
    'enka-inflected bend on long tones',
    'quivering vibrato on the sustained note',
    'melismatic slide into the chorus',
    'plaintive held-note vibrato on the hook'
  ],
  jpopModern: [
    'breathy falsetto float on the chorus',
    'clipped staccato phrasing on the verse',
    'airy head-voice lift into the hook'
  ],
  folkChanson: [
    'gentle vibrato on the sustained hook',
    'breathy conversational delivery throughout',
    'husky plainspoken phrasing on the verse',
    'legato phrasing unhurried through the bridge',
    'nasal folk-toned phrasing on the hook'
  ],
  seasonalWarm: [
    'warm unison call-and-response on the chorus'
  ]
};

/**
 * 지시문 65 §3 "장르마다 다르게 쓴다" — 97개 named/legacy 장르(oldpop·
 * kr-idol·kr-2030·kr-kids·jp-kids·jp-2030·japanese-era·pop·kids·hiphop·
 * electronic·seasonal 12개 categoryId, notion-derived 270종을 제외한 전부)는
 * id 하나하나를 손으로 분류한다 — categoryId 하나로 뭉치면(예: oldpop 34종
 * 전부 balladCore) §2-1이 지적한 "같은 문구가 장르를 넘나든다"를 그대로
 * 반복하게 된다.
 */
const ID_TO_FAMILY: Record<string, string> = {
  // --- oldpop (34) ---
  'oldpop-doowop-harmony': 'doowop',
  'oldpop-doowop-ballad': 'doowop',
  'oldpop-doowop-uptempo': 'doowop',
  'oldpop-brill-building': 'britishBeat',
  'oldpop-girl-group-wall': 'britishBeat',
  'oldpop-british-beat': 'britishBeat',
  'oldpop-sunshine-pop': 'sunshinePop',
  'oldpop-baroque-pop': 'sunshinePop',
  'oldpop-motown-pop-soul': 'soul',
  'oldpop-philly-soul-sweet': 'soul',
  'oldpop-quiet-storm-warm': 'soul',
  'oldpop-standards-torch': 'jazzCrooner',
  'oldpop-night-chanson': 'folkChanson',
  'oldpop-italian-canzone': 'folkChanson',
  'oldpop-hearth-acoustic': 'folkChanson',
  'oldpop-gentle-lullaby-pop': 'folkChanson',
  'oldpop-folk-rock-70s': 'folkChanson',
  'oldpop-rainy-ballad-blues': 'balladDramatic',
  'oldpop-close-harmony-duo': 'sunshinePop',
  'oldpop-soft-rock-am': 'cityPopBallad',
  'oldpop-orchestral-easy': 'balladCore',
  'oldpop-countrypolitan': 'folkChanson',
  'oldpop-europop-glow': 'cityPopGroove',
  'oldpop-yacht-west-coast': 'cityPopBallad',
  'oldpop-piano-ballad-70s': 'balladCore',
  'oldpop-adult-contemporary-80s': 'balladCore',
  'oldpop-orchestral-ballad-80s': 'balladDramatic',
  'oldpop-light-synth-pop-warm': 'cityPopBallad',
  'oldpop-soft-duet-80s': 'sunshinePop',
  'oldpop-warm-morning-glow': 'balladCore',
  'oldpop-sunlit-strings-pop': 'balladCore',
  'oldpop-slow-waltz-memory': 'balladCore',
  'oldpop-evening-lamp-ballad': 'balladCore',
  'oldpop-six-eight-slow-ballad': 'balladCore',

  // --- kr-idol (9) ---
  'kridol-performance-trap': 'kpopIdol',
  'kridol-synth-dance': 'kpopIdol',
  'kridol-band-crossover': 'kpopIdol',
  'kridol-midtempo-rnb': 'neoSoul',
  'kridol-latin-afro': 'kpopIdol',
  'kridol-emotional-ballad': 'balladDramatic',
  'kridol-retro-funk': 'cityPopGroove',
  'kridol-melodic-rap': 'rapHiphop',
  'kridol-hard-rap': 'rapHiphop',

  // --- kr-2030 (10) ---
  'kr2030-emo-band-pop': 'balladDramatic',
  'kr2030-dawn-rnb': 'neoSoul',
  'kr2030-y2k-retro': 'cityPopGroove',
  'kr2030-electro-pop': 'cityPopGroove',
  'kr2030-ost-ballad': 'balladCore',
  'kr2030-acoustic-folk': 'folkChanson',
  'kr2030-lofi-swing-hiphop': 'lofiHiphop',
  'kr2030-mumble-melodic-rap': 'rapHiphop',
  'kr2030-whisper-trap': 'trapSoul',
  'kr2030-cloud-hazy-rap': 'rapHiphop',

  // --- kr-kids (7) / jp-kids (7) / kids (4) — all kids ---
  'krkids-action': 'kids',
  'krkids-daily-habit': 'kids',
  'krkids-counting-color': 'kids',
  'krkids-animal-vehicle': 'kids',
  'krkids-roleplay-story': 'kids',
  'krkids-bilingual': 'kids',
  'krkids-sleep-calm': 'kids',
  'jpkids-teasobi': 'kids',
  'jpkids-taiso-dance': 'kids',
  'jpkids-onomatopoeia': 'kids',
  'jpkids-food-vehicle': 'kids',
  'jpkids-daily-habit': 'kids',
  'jpkids-seasonal': 'kids',
  'jpkids-english-learning': 'kids',
  'kids-bright-pop': 'kids',
  'kids-acoustic-singalong': 'kids',
  'kids-upbeat-pop': 'kids',
  'kids-march': 'kids',

  // --- jp-2030 (7) ---
  'jp2030-melodic-jrock': 'jpopModern',
  'jp2030-anime-cinematic': 'balladDramatic',
  'jp2030-heisei-nostalgia': 'showaEra',
  'jp2030-dance-vocal': 'kpopIdol',
  'jp2030-kawaii-idol': 'kpopIdol',
  'jp2030-neo-citypop': 'cityPopGroove',
  'jp2030-chill-neosoul': 'neoSoul',

  // --- japanese-era (8) ---
  'kayokyoku-70s': 'showaEra',
  'japanese-folk-70s': 'folkChanson',
  'new-music-70s': 'showaEra',
  'showa-groove-70s': 'showaEra',
  'jpop-2000s-ballad': 'balladCore',
  'jpop-2000s-rnb': 'neoSoul',
  'jpop-2000s-band': 'jpopModern',
  'jpop-2000s-dance': 'kpopIdol',

  // --- pop (5) ---
  'adult-contemporary': 'balladCore',
  'acoustic-pop': 'folkChanson',
  'folk-pop': 'folkChanson',
  'soft-rock': 'cityPopGroove',
  'chanson': 'folkChanson',

  // --- hiphop (3) ---
  'chill-rap': 'rapHiphop',
  'boom-bap-mellow': 'rapHiphop',
  'jazz-rap': 'jazzScat',

  // --- electronic (2) ---
  'synthwave-mellow': 'electronicVocal',
  'kr2030-noir-deep-house': 'electronicVocal',

  // --- seasonal (1) ---
  'christmas-soft-pop': 'seasonalWarm'
};

/**
 * notion-derived 270종(jazz/city-pop/rnb/lofi/ballad, categoryBases+
 * tagTraits로 생성) — seed()의 tagText가 그대로 genre.aliases에 남아 있어
 * (지시문 12) 그 태그로 세부 계열을 가른다. 우선순위 순서로 검사 —
 * 가장 구체적인 신호(gospel/scat/bossa 등)를 카테고리 기본값보다 먼저 본다.
 */
const TAG_FAMILY_RULES: { categoryId: string; tags: string[]; family: string }[] = [
  { categoryId: 'jazz', tags: ['crooner'], family: 'jazzCrooner' },
  { categoryId: 'jazz', tags: ['scat', 'bebop', 'bop'], family: 'jazzScat' },
  { categoryId: 'jazz', tags: ['bossa', 'latin', 'samba'], family: 'jazzBossa' },
  { categoryId: 'jazz', tags: ['soul', 'gospel', 'funk'], family: 'soul' },
  { categoryId: 'jazz', tags: ['hiphop', 'rap'], family: 'lofiHiphop' },
  { categoryId: 'jazz', tags: ['lofi', 'tape'], family: 'lofiChill' },

  { categoryId: 'rnb', tags: ['gospel'], family: 'soul' },
  { categoryId: 'rnb', tags: ['trap', 'dark'], family: 'trapSoul' },
  { categoryId: 'rnb', tags: ['soul'], family: 'soul' },

  { categoryId: 'lofi', tags: ['hiphop', 'rap'], family: 'lofiHiphop' },
  { categoryId: 'lofi', tags: ['jazz', 'swing', 'bass'], family: 'jazzSwing' },
  { categoryId: 'lofi', tags: ['soul'], family: 'soul' },

  { categoryId: 'city-pop', tags: ['ballad'], family: 'cityPopBallad' },
  { categoryId: 'city-pop', tags: ['funk', 'disco'], family: 'cityPopGroove' },

  { categoryId: 'ballad', tags: ['cinematic', 'dramatic'], family: 'balladDramatic' }
];

const CATEGORY_DEFAULT_FAMILY: Record<string, string> = {
  jazz: 'jazzSwing',
  'city-pop': 'cityPopGroove',
  rnb: 'neoSoul',
  lofi: 'lofiChill',
  ballad: 'balladCore'
};

/**
 * genre.id 하나를 FAMILY_POOLS의 키 하나로 매핑한다. 우선순위: ①
 * ID_TO_FAMILY(97종 손수 분류) ② TAG_FAMILY_RULES(notion-derived 270종의
 * aliases 태그) ③ CATEGORY_DEFAULT_FAMILY(카테고리 기본값) ④ 최후
 * 폴백('balladCore' — 어떤 장르에도 크게 어긋나지 않는 가장 중립적인 풀).
 */
export function familyForGenre(genre: TechniqueGenreShape): string {
  const direct = ID_TO_FAMILY[genre.id];
  if (direct) return direct;

  const categoryId = genre.categoryId ?? '';
  const tags = (genre.aliases ?? []).map(t => t.toLowerCase());
  for (const rule of TAG_FAMILY_RULES) {
    if (rule.categoryId !== categoryId) continue;
    if (rule.tags.some(tag => tags.includes(tag))) return rule.family;
  }
  return CATEGORY_DEFAULT_FAMILY[categoryId] ?? 'balladCore';
}

/**
 * FNV-1a + xorshift 마감 — 앞부분 접두어가 겹치는 id가 많아
 * (ballad-xxx-ballad류) 단순 다항 해시(hash*31+c)는 mod 연산에서 뭉치는
 * 경향이 실측됐다(초기 구현, checkVocalTechnique.ts로 5종 초과 반복
 * 다수 발견). 해시 뒤 avalanche 단계를 추가해 인접한 유사 id도 pool
 * 전체에 고르게 흩어지게 한다.
 */
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** 이 장르가 가진 창법 후보 전체(가족 풀) — TASK C 패치 도구·check:vocal-technique가 재사용. */
export function vocalTechniquePoolForGenre(genre: TechniqueGenreShape): string[] {
  return FAMILY_POOLS[familyForGenre(genre)] ?? FAMILY_POOLS.balladCore;
}

/**
 * genreLibrary/index.ts의 최종 .map()에서 genre.vocal에 부착할 결정적(같은
 * id는 항상 같은 값) 1개 픽 — 정적 데이터라 실행마다 달라지면 안 된다
 * (genreLibrary 자체가 모듈 로드 시 한 번만 계산되는 정적 배열이라는
 * 기존 설계 그대로).
 */
export function staticVocalTechniqueForGenre(genre: TechniqueGenreShape): string {
  const pool = vocalTechniquePoolForGenre(genre);
  return pool[hashString(genre.id) % pool.length];
}

/**
 * genreLibrary/index.ts가 (순환 참조 없이) genre.vocal을 채우기 직전,
 * 전체 367종을 한 번에 넘겨 부르는 배치 버전 — staticVocalTechniqueForGenre의
 * 해시-모듈로 방식은 family 하나에 40-58종이 몰릴 때 birthday-paradox식
 * 쏠림이 실측됐다(초기 구현에서 "laid-back behind-the-beat swing phrasing"
 * 같은 phrase 하나가 11-12종에 반복 — checkVocalTechnique.ts §2 위반).
 * family별로 id를 정렬해 라운드로빈으로 배정하면 반복 횟수가
 * ceil(가족 크기 / 풀 크기)로 수학적으로 상한이 걸린다(현재 풀 크기 기준
 * 최악 ceil(58/28)=3 — "5종 넘게 반복 0건" 여유 확보). 곡별 실시간
 * 회전(rotatingVocalTechniqueForGenre)은 이 제약이 없으므로 그대로 해시
 * 방식을 쓴다 — 정적 데이터(genre.vocal 자체)에만 적용.
 */
/**
 * 지시문 65 후속 — jazz-classic-vocal-lounge · jazz-swing-crooner-ballroom ·
 * jazz-hotel-lounge-jazz 셋 다 'crooner'/카테고리 기본값 계열이라 round-robin
 * 배정 결과가 모두 "croon" 계열 phrase로 몰려(§FAMILY_POOLS.jazzCrooner)
 * 하루가 보기엔 shortPrompt/styleCore(= vocal[0]만 노출)에서 구분이 안
 * 됐다 — 하루가 지정한 5개 문구 중 3개를 이 3종에 직접 고정한다. 다른
 * override 표(GENRE_ERA_TAG_OVERRIDES·SIGNATURE_SOUND_OVERRIDES 등, index.ts)
 * 와 같은 패턴 — assignStaticVocalTechniques가 family round-robin보다
 * 먼저 확인한다(round-robin 대상에서도 제외해 다른 jazzCrooner 멤버의
 * 배정이 밀리지 않는다).
 */
const STATIC_TECHNIQUE_ID_OVERRIDES: Record<string, string> = {
  'jazz-classic-vocal-lounge': 'scat phrase in the break',
  'jazz-swing-crooner-ballroom': 'conversational swing phrasing',
  'jazz-hotel-lounge-jazz': 'laid-back behind-the-beat timing'
};

export function assignStaticVocalTechniques(genres: readonly TechniqueGenreShape[]): Map<string, string> {
  const byFamily = new Map<string, TechniqueGenreShape[]>();
  for (const genre of genres) {
    if (STATIC_TECHNIQUE_ID_OVERRIDES[genre.id]) continue;
    const family = familyForGenre(genre);
    const list = byFamily.get(family) ?? [];
    list.push(genre);
    byFamily.set(family, list);
  }
  const result = new Map<string, string>();
  for (const [family, members] of byFamily) {
    const pool = FAMILY_POOLS[family] ?? FAMILY_POOLS.balladCore;
    const sorted = [...members].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    sorted.forEach((genre, index) => {
      result.set(genre.id, pool[index % pool.length]);
    });
  }
  for (const genre of genres) {
    const override = STATIC_TECHNIQUE_ID_OVERRIDES[genre.id];
    if (override) result.set(genre.id, override);
  }
  return result;
}

/**
 * 곡별 회전 픽 — offset(보통 seed + idx*53, 이 코드베이스의 기존 회전
 * 관용구·checkVocalFloor.ts/localGenerator.ts의 floor 회전과 동일 패턴)을
 * 섞어 같은 장르라도 트랙마다 다른 창법이 나오게 한다(지시문 65 B-4).
 */
export function rotatingVocalTechniqueForGenre(genre: TechniqueGenreShape, offset: number): string {
  const pool = vocalTechniquePoolForGenre(genre);
  const idx = Math.abs(hashString(genre.id) + offset) % pool.length;
  return pool[idx];
}

/**
 * 지시문 65 §2-2의 27개 검사 어휘 — scripts/checkVocalTechnique.ts(TASK D)와
 * scripts/patchVocalTechnique.ts(TASK C, "이미 있으면 건너뛴다" 판정) 둘 다
 * 이 하나의 목록/함수를 쓴다(같은 판정 로직을 두 곳에 따로 두지 않는다,
 * §공통규약).
 */
export const VOCAL_TECHNIQUE_VOCAB = [
  'melisma', 'gospel run', 'riff', 'scat', 'growl', 'shout', 'belt', 'falsetto',
  'vibrato', 'behind-the-beat', 'behind the beat', 'laid-back', 'laid back',
  'blue note', 'bend', 'slide', 'breathy', 'husky', 'rasp', 'staccato', 'legato',
  'syncopated', 'swing phrasing', 'ad-lib', 'ad lib', 'call-and-response',
  'call and response', 'head voice', 'chest voice', 'nasal', 'twang', 'croon'
];

// Suno 프롬프트 영어는 "blue-note"/"blue note"처럼 하이픈·공백을 섞어 쓴다 —
// 대조 전에 하이픈을 공백으로 정규화해 구두점 차이로 놓치지 않는다.
function normalizeTechniqueText(text: string): string {
  return text.toLowerCase().replace(/-/g, ' ');
}

export function hasVocalTechniqueWord(text: string): boolean {
  const normalized = normalizeTechniqueText(text);
  return VOCAL_TECHNIQUE_VOCAB.some(term => normalized.includes(normalizeTechniqueText(term)));
}
