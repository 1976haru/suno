import type { ChannelArchetype, GenerationOptions, LyricLanguage, ScenePlanningMode } from '../types';
import { isKidsArchetype } from '../utils/channelArchetype';

export type KidsLyricThemeHint = 'animal' | 'season' | 'family' | 'friend' | 'play' | 'school' | 'counting' | 'hangul';

export interface LyricTheme {
  id: string;
  labelKo: string;
  scene: string;
  emotionalArc: string;
  suitedArchetypes?: ChannelArchetype[];
  languages?: ('korean' | 'japanese' | 'english')[];
  /**
   * TASK v3.64 (TASK A) — real measurement: 18/18 songs in a real pack used
   * the identical "senior alone at home, gazing at an object" frame (only
   * the object changed). Every existing entry below predates this field and
   * is treated as 'solitary-object' by convention (see
   * core/lyricDiversityPlan.ts's themeFrameId) — none of them needed
   * editing to keep working. Only newly-added entries (a different scene
   * shape entirely — first love, a Saturday dance, a train reunion, ...)
   * set this explicitly, which is also what activates frame-capped
   * allocation for the whole pool (a pool with zero explicit frameId values
   * falls back to the pre-v3.64 stride behavior unchanged — see
   * lyricDiversityPlan.ts's poolHasExplicitFrames).
   */
  frameId?: string;
  /** v3.64 (TASK A) — Korean-language axis metadata for allocation diversity checks/reporting, not used in lyric generation itself. */
  eraSettingKo?: string;
  castKo?: string;
  motionKo?: string;
  /** TASK E1 §4-3 — D1's age tier this theme targets. Optional; existing themes (predating D1) have none. */
  ageTier?: 'kids-t1' | 'kids-t2' | 'kids-t3';
  /** TASK E1 §4-4 — exactly one education concept per theme ("한 곡에 개념 하나"); never contains "and". Optional; only krkids-* themes set this — F1 §4-3 deliberately keeps jpkids-* themes off this axis (onomatopoeiaGroup below is jp-kids's own). */
  educationConcept?: string;
  /** TASK F1 §4-3/§5 — which data/onomatopoeia.ts entry this theme's motion/mood centers on. jp-kids's own axis — deliberately NOT educationConcept (that field stays kr-kids-only, see its own doc comment). */
  onomatopoeiaGroup?: string;
  /**
   * TASK E1 §6-3 — which language pair this theme inserts learning words in
   * (base = the song's main lyric language, target = the language whose
   * words get woven in). Deliberately NOT a new LyricLanguage union member
   * (E1 §6-1/§12 item 6 — widening that union would affect 3+ existing call
   * sites using `Exclude<LyricLanguage, 'bilingual'>`); F1 reuses this same
   * field with `{ base: 'japanese', target: 'english' }`.
   */
  learningLanguagePair?: { base: LyricLanguage; target: LyricLanguage };
  /**
   * v5.8 (audit follow-up, docs/v58-report.md) — real measurement found a
   * "bedtime lullaby" concept on kr-kids/jp-kids produced energetic
   * play/counting content, because the 8-topic-bucket theme system
   * (data/lyricThemes.ts's own suitedArchetypes scoping) has no mood axis
   * at all — a channel's own `preferredMoods: ['calm-focus']` signal
   * (data/presets.ts) had nothing to bias theme selection with. Optional;
   * only set on kr-kids-song/jp-kids-song themes whose own `emotionalArc`
   * text is unambiguously one or the other (most themes are mood-neutral
   * routine/education content and stay unset — core/lyricDiversityPlan.ts's
   * own filtering only ever EXCLUDES 'energetic' for a calm-signaling
   * channel, never requires 'calm', so neutral themes stay in the pool).
   */
  moodTag?: 'calm' | 'energetic';
}

function adultTheme(
  id: string,
  labelKo: string,
  scene: string,
  emotionalArc: string,
  suitedArchetypes: ChannelArchetype[],
  frameId: string,
  eraSettingKo: string,
  castKo: string,
  motionKo: string
): LyricTheme {
  return { id, labelKo, scene, emotionalArc, suitedArchetypes, frameId, eraSettingKo, castKo, motionKo };
}

const SENIOR_OLDPOP_SCENE_EXPANSION_THEMES: LyricTheme[] = [
  adultTheme('senioroldpop-town-theater-matinee', '시내 극장 낮공연', 'stepping out of a small town theater after a matinee while lobby lights still glow', 'quiet nostalgia brightening into renewed wonder', ['senior-morning', 'oldpop-lounge'], 'town-matinee', '젊은 날과 현재', '여럿', '이동 중'),
  adultTheme('senioroldpop-county-fair-carousel', '카운티 페어 회전목마', 'walking past a county fair carousel after sunset while brass music circles through warm air', 'playful memory lifting into open-hearted joy', ['senior-morning', 'oldpop-lounge'], 'fairground-night', '젊은 날 여름', '여럿', '이동 중'),
  adultTheme('senioroldpop-soda-fountain-jukebox', '소다 파운틴 주크박스', 'choosing a jukebox number at a soda fountain while two straws wait in one glass', 'shy anticipation blooming into sweet certainty', ['senior-morning', 'oldpop-lounge'], 'jukebox-date', '젊은 날', '둘', '정적'),
  adultTheme('senioroldpop-bowling-league-trophy', '볼링장 리그 트로피', 'holding a small bowling league trophy beside polished lanes after the final frame is scored', 'friendly rivalry turning into proud laughter', ['senior-morning', 'oldpop-lounge'], 'local-sport-night', '젊은 날', '여럿', '활동 중'),
  adultTheme('senioroldpop-reunion-nametag-table', '동창회 이름표 테이블', 'pinning on a high school reunion nametag before recognizing an old smile across the hall', 'nervous distance melting into familiar warmth', ['senior-morning', 'oldpop-lounge'], 'reunion-hall', '현재와 과거', '여럿', '이동 중'),
  adultTheme('senioroldpop-ferris-wheel-last-ride', '마지막 관람차 탑승', 'riding the last ferris wheel car while fair lights shrink beneath dangling shoes', 'childlike thrill softening into tender reflection', ['senior-morning', 'oldpop-lounge'], 'fairground-night', '젊은 날 여름', '둘', '이동 중'),
  adultTheme('senioroldpop-steamboat-deck-band', '유람선 갑판 밴드', 'leaning on a riverboat deck rail while a small band plays near the stern', 'restless longing settling into rolling calm', ['senior-morning', 'oldpop-lounge'], 'waterfront-band', '젊은 날 여행', '여럿', '이동 중'),
  adultTheme('senioroldpop-gym-record-hop', '체육관 레코드 홉', 'crossing a polished gym floor at a record hop while paper streamers sway overhead', 'awkward courage breaking into bright delight', ['senior-morning', 'oldpop-lounge'], 'dance-saturday', '젊은 날', '여럿', '춤'),
  adultTheme('senioroldpop-drive-in-speaker', '드라이브인 극장 스피커', 'hooking a drive-in movie speaker onto the car window as dusk covers the lot', 'ordinary evening becoming secret shared excitement', ['senior-morning', 'oldpop-lounge'], 'drive-in-memory', '젊은 날 밤', '둘', '정적'),
  adultTheme('senioroldpop-baseball-bleachers-moon', '달빛 야구장 관중석', 'sitting on empty baseball bleachers after the game while field lights click off one by one', 'leftover excitement easing into quiet closeness', ['senior-morning', 'oldpop-lounge'], 'ballpark-night', '젊은 날 여름', '둘', '정적'),
  adultTheme('senioroldpop-shared-umbrella-bus-stop', '버스정류장 나눠 쓴 우산', 'sharing one small umbrella at a bus stop while headlights smear across wet pavement', 'caught-off-guard awkwardness becoming gentle connection', ['senior-morning', 'oldpop-lounge'], 'rain-transit', '젊은 날', '둘', '정적'),
  adultTheme('senioroldpop-campus-bench-autumn', '가을 캠퍼스 벤치', 'sitting on a campus bench under turning leaves with textbooks closed between two hands', 'uncertain future warming into brave promise', ['senior-morning', 'oldpop-lounge'], 'campus-memory', '젊은 날 가을', '둘', '정적'),
  adultTheme('senioroldpop-homecoming-bus-station', '귀향 버스터미널', 'waiting inside a busy bus station until a uniformed figure steps down carrying one duffel bag', 'held breath releasing into relieved joy', ['senior-morning', 'oldpop-lounge'], 'homecoming-terminal', '젊은 날', '둘', '이동 중'),
  adultTheme('senioroldpop-wedding-band-request', '결혼식 밴드 신청곡', 'asking the wedding band for one slow number while relatives clear space on the floor', 'formal celebration turning into intimate devotion', ['senior-morning', 'oldpop-lounge'], 'wedding-floor', '젊은 날', '여럿', '춤'),
  adultTheme('senioroldpop-roller-rink-handhold', '롤러장 첫 손잡기', 'circling a roller rink under colored lights while two unsteady hands finally meet', 'wobbly nerves spinning into laughter', ['senior-morning', 'oldpop-lounge'], 'roller-rink', '젊은 날', '둘', '활동 중'),
  adultTheme('senioroldpop-small-town-parade', '작은 마을 퍼레이드', 'watching a small town parade pass the courthouse while a marching drum echoes down the street', 'ordinary pride swelling into communal joy', ['senior-morning', 'oldpop-lounge'], 'town-parade', '젊은 날과 현재', '여럿', '정적'),
  adultTheme('senioroldpop-first-paycheck-escalator', '첫 월급날 백화점 에스컬레이터', 'riding a department store escalator on first payday with a gift box held carefully', 'new independence glowing into generous love', ['senior-morning', 'oldpop-lounge'], 'first-paycheck', '젊은 날 도시', '혼자', '이동 중'),
  adultTheme('senioroldpop-seaside-pier-photo', '해변 부두 즉석사진', 'waiting for a seaside pier photograph to develop while wind keeps lifting the corner', 'playful vanity becoming a keepsake glow', ['senior-morning', 'oldpop-lounge'], 'seaside-keepsake', '젊은 날 여행', '둘', '정적'),
  adultTheme('senioroldpop-harbor-ferry-farewell', '항구 페리 작별', 'standing near a harbor ferry gate as ropes are thrown and a promise is shouted back', 'sharp parting steadied by loyal hope', ['senior-morning', 'oldpop-lounge'], 'harbor-parting', '젊은 날', '둘', '이동 중'),
  adultTheme('senioroldpop-motel-ice-machine-corridor', '모텔 복도 제빙기', 'walking a motel corridor with an ice bucket while distant music leaks through thin doors', 'road weariness turning into private adventure', ['senior-morning', 'oldpop-lounge'], 'roadside-motel', '젊은 날 여행', '혼자', '이동 중'),
  adultTheme('senioroldpop-postcard-rack-roadside', '길가 엽서 진열대', 'turning a postcard rack outside a roadside shop and choosing the view that feels closest', 'homesick uncertainty becoming affectionate resolve', ['senior-morning', 'oldpop-lounge'], 'roadside-keepsake', '젊은 날 여행', '혼자', '정적'),
  adultTheme('senioroldpop-lake-dock-swimming', '호숫가 수영 선착장', 'sitting on a lake dock after swimming while wet footprints dry in the afternoon sun', 'summer fatigue glowing into easy happiness', ['senior-morning', 'oldpop-lounge'], 'lake-summer', '젊은 날 여름', '여럿', '정적'),
  adultTheme('senioroldpop-roadside-diner-counter', '국도변 식당 카운터', 'turning a sugar packet at a roadside diner counter while truck lights pass outside', 'travel loneliness easing into quiet resilience', ['senior-morning', 'oldpop-lounge'], 'roadside-diner', '젊은 날 여행', '혼자', '정적'),
  adultTheme('senioroldpop-park-bandstand-waltz', '공원 야외무대 왈츠', 'watching couples waltz beside a park bandstand as evening insects hum in the grass', 'wistful watching turning into a small brave step', ['senior-morning', 'oldpop-lounge'], 'park-bandstand', '젊은 날', '여럿', '춤'),
  adultTheme('senioroldpop-housewarming-record-stack', '신혼집 레코드 더미', 'stacking records beside a borrowed turntable in a first apartment still smelling of fresh paint', 'bare-room worry becoming hopeful belonging', ['senior-morning', 'oldpop-lounge'], 'first-apartment', '젊은 날', '둘', '정적'),
  adultTheme('senioroldpop-grocery-aisle-meeting', '식료품점 통로의 재회', 'meeting an old friend in a grocery aisle and forgetting the shopping list completely', 'routine surprise opening into grateful laughter', ['senior-morning', 'oldpop-lounge'], 'chance-meeting', '현재', '둘', '정적'),
  adultTheme('senioroldpop-laundromat-quarter-spin', '동전 세탁소 회전문', 'feeding quarters into a laundromat machine while a favorite coat turns behind the glass', 'tedious waiting becoming reflective calm', ['senior-morning', 'oldpop-lounge'], 'laundromat-wait', '젊은 날 도시', '혼자', '정적'),
  adultTheme('senioroldpop-courthouse-license-steps', '혼인신고 뒤 법원 계단', 'standing on courthouse steps with a marriage license folder held between two trembling hands', 'formal nervousness opening into lifelong promise', ['senior-morning', 'oldpop-lounge'], 'courthouse-steps', '젊은 날', '둘', '정적'),
  adultTheme('senioroldpop-newborn-waiting-room', '첫 손주 병원 대기실', 'waiting outside a hospital nursery until a nurse lifts one tiny bundled hand', 'anxious pacing breaking into wordless gratitude', ['senior-morning', 'oldpop-lounge'], 'family-arrival', '현재', '가족', '정적'),
  adultTheme('senioroldpop-bingo-community-center', '복지관 빙고의 밤', 'marking a bingo card at the community center while neighbors argue over lucky seats', 'small competition warming into shared delight', ['senior-morning', 'oldpop-lounge'], 'community-game', '현재', '여럿', '정적'),
  adultTheme('senioroldpop-school-auditorium-talent', '학교 강당 장기자랑', 'standing backstage at a school auditorium talent show while curtains rustle and friends whisper', 'stage fright turning into shining confidence', ['senior-morning', 'oldpop-lounge'], 'school-stage', '젊은 날', '여럿', '정적'),
  adultTheme('senioroldpop-orchard-moon-lane', '달빛 과수원 길', 'walking a moonlit orchard lane after harvest while crates sit stacked beside the barn', 'hard work settling into tender quiet', ['senior-morning', 'oldpop-lounge'], 'rural-evening', '젊은 날 가을', '둘', '이동 중'),
  adultTheme('senioroldpop-snowbound-motel-lobby', '눈 갇힌 모텔 로비', 'waiting out a snowstorm in a motel lobby while strangers share vending machine snacks', 'stranded worry softening into temporary family', ['senior-morning', 'oldpop-lounge'], 'snowbound-lobby', '겨울 여행', '여럿', '정적'),
  adultTheme('senioroldpop-football-radio-porch', '미식축구 중계 듣는 현관', 'listening to a championship game on a portable radio from the porch steps', 'restless cheering settling into neighborhood warmth', ['senior-morning', 'oldpop-lounge'], 'neighborhood-game', '젊은 날 가을', '여럿', '정적'),
  adultTheme('senioroldpop-tailor-wedding-jacket', '결혼식 재킷 치수', 'standing still while a tailor measures a wedding jacket and chalks bright marks on dark cloth', 'self-conscious nerves straightening into dignity', ['senior-morning', 'oldpop-lounge'], 'tailor-occasion', '젊은 날', '혼자', '정적'),
  adultTheme('senioroldpop-basement-party-slow-song', '지하실 파티의 느린 곡', 'waiting near the basement stairs until a slow song gives everyone permission to ask', 'teenage hesitation blooming into remembered sweetness', ['senior-morning', 'oldpop-lounge'], 'basement-party', '젊은 날', '여럿', '춤'),
  adultTheme('senioroldpop-fire-escape-summer', '여름밤 비상계단', 'sitting on a fire escape above a warm alley while distant laughter rises from below', 'private loneliness opening into city tenderness', ['senior-morning', 'oldpop-lounge'], 'city-balcony', '젊은 날 도시', '둘', '정적'),
  adultTheme('senioroldpop-boat-rental-sunrise', '보트 대여소 새벽', 'unlocking a rented rowboat at sunrise while mist pulls away from the lake surface', 'sleepy uncertainty becoming gentle adventure', ['senior-morning', 'oldpop-lounge'], 'lake-summer', '젊은 날 여행', '둘', '이동 중'),
  adultTheme('senioroldpop-neighborhood-pool-whistle', '동네 수영장 호루라기', 'hearing the lifeguard whistle at the neighborhood pool while towels line the chain fence', 'summer noise turning into carefree memory', ['senior-morning', 'oldpop-lounge'], 'neighborhood-summer', '젊은 날 여름', '여럿', '활동 중'),
  adultTheme('senioroldpop-corner-florist-bouquet', '모퉁이 꽃집 꽃다발', 'choosing one modest bouquet at a corner florist before walking to an anniversary dinner', 'careful affection deepening into devoted gratitude', ['senior-morning', 'oldpop-lounge'], 'anniversary-errand', '현재', '혼자', '이동 중')
];

const OLDPOP_LOUNGE_SCENE_EXPANSION_THEMES: LyricTheme[] = [
  adultTheme('oldpoplounge-velvet-booth-candle', '벨벳 부스 촛불', 'sitting in a velvet lounge booth while a candle trembles beside untouched glasses', 'cool restraint softening into intimate confession', ['oldpop-lounge'], 'lounge-booth', '도시의 밤', '둘', '정적'),
  adultTheme('oldpoplounge-martini-olive-glass', '마티니 잔의 올리브', 'watching one olive circle inside a martini glass as the house band changes keys', 'polished boredom turning into sly anticipation', ['oldpop-lounge'], 'cocktail-lounge', '도시의 밤', '혼자', '정적'),
  adultTheme('oldpoplounge-supper-club-reservation', '서퍼클럽 예약석', 'arriving at a supper club reservation table just as the singer clears the first line', 'composed arrival warming into cinematic romance', ['oldpop-lounge'], 'supper-club', '도시의 밤', '둘', '이동 중'),
  adultTheme('oldpoplounge-ballroom-chandelier', '호텔 볼룸 샹들리에', 'crossing a hotel ballroom under chandeliers while waiters weave between silver trays', 'formal distance opening into glittering release', ['oldpop-lounge'], 'hotel-ballroom', '도시의 밤', '여럿', '이동 중'),
  adultTheme('oldpoplounge-brass-rehearsal-empty-room', '빈 무대 브라스 리허설', 'listening to a brass section rehearse in an empty room before the doors open', 'private tension building into showtime electricity', ['oldpop-lounge'], 'backstage-rehearsal', '공연 전', '여럿', '정적'),
  adultTheme('oldpoplounge-backstage-bulb-mirror', '백스테이지 전구 거울', 'touching up makeup at a bulb-lit backstage mirror while the audience murmurs beyond the curtain', 'controlled nerves sharpening into bold presence', ['oldpop-lounge'], 'backstage-mirror', '공연 전', '혼자', '정적'),
  adultTheme('oldpoplounge-midnight-taxi-receipt', '자정 택시 영수증', 'folding a midnight taxi receipt into a coat pocket after crossing half the city', 'urban fatigue turning into secret purpose', ['oldpop-lounge'], 'night-taxi', '도시의 밤', '혼자', '이동 중'),
  adultTheme('oldpoplounge-penthouse-record-shelf', '펜트하우스 레코드 선반', 'choosing a record from a penthouse shelf while traffic glows far below the balcony', 'restless luxury cooling into private longing', ['oldpop-lounge'], 'penthouse-night', '도시의 밤', '둘', '정적'),
  adultTheme('oldpoplounge-cruise-promenade-orchestra', '크루즈 산책로 오케스트라', 'walking the cruise ship promenade while an orchestra tune carries over black water', 'travel glamour deepening into moonlit wonder', ['oldpop-lounge'], 'ship-promenade', '밤바다 여행', '여럿', '이동 중'),
  adultTheme('oldpoplounge-dining-car-linen', '식당칸 흰 린넨', 'sliding into a train dining car booth as white linen trembles with the rails', 'motion and elegance blending into wistful escape', ['oldpop-lounge'], 'train-dining-car', '여행 중', '둘', '정적'),
  adultTheme('oldpoplounge-airport-observation-deck', '공항 전망대', 'watching propeller lights from an airport observation deck while announcements echo behind glass', 'departure sadness lifting into faraway hope', ['oldpop-lounge'], 'airport-night', '여행 전', '혼자', '정적'),
  adultTheme('oldpoplounge-vacancy-sign-rain', '빗속 빈방 네온사인', 'pulling into a motel lot where the vacancy sign blinks red through steady rain', 'road loneliness turning into noir-tinted resolve', ['oldpop-lounge'], 'roadside-motel', '밤 여행', '혼자', '이동 중'),
  adultTheme('oldpoplounge-desert-radio-tower', '사막 라디오 송신탑', 'driving past a desert radio tower at night while static fades into a clear chorus', 'empty distance becoming sudden connection', ['oldpop-lounge'], 'desert-highway', '밤 여행', '혼자', '이동 중'),
  adultTheme('oldpoplounge-jukebox-repair-shop', '주크박스 수리점', 'watching a repairman test a glowing jukebox in a narrow shop after closing time', 'mechanical patience sparking into remembered rhythm', ['oldpop-lounge'], 'jukebox-backroom', '도시의 밤', '둘', '정적'),
  adultTheme('oldpoplounge-pawnshop-saxophone-case', '전당포 색소폰 케이스', 'opening a pawnshop saxophone case and smelling dust from a dozen forgotten stages', 'faded glamour reviving into smoky confidence', ['oldpop-lounge'], 'instrument-keepsake', '도시의 밤', '혼자', '정적'),
  adultTheme('oldpoplounge-velvet-rope-queue', '벨벳 로프 대기줄', 'waiting behind a velvet rope while laughter spills from the club door each time it opens', 'impatient envy transforming into chosen confidence', ['oldpop-lounge'], 'club-threshold', '도시의 밤', '여럿', '정적'),
  adultTheme('oldpoplounge-cocktail-napkin-number', '칵테일 냅킨 전화번호', 'turning over a cocktail napkin with a phone number written in blue ink', 'playful risk sharpening into midnight decision', ['oldpop-lounge'], 'cocktail-lounge', '도시의 밤', '혼자', '정적'),
  adultTheme('oldpoplounge-gold-curtain-encore', '금빛 커튼 앙코르', 'standing before a gold curtain as applause keeps rising after the final encore', 'exhausted poise breaking into grateful triumph', ['oldpop-lounge'], 'stage-encore', '공연 후', '혼자', '정적'),
  adultTheme('oldpoplounge-basement-jazz-stairs', '지하 재즈클럽 계단', 'descending narrow basement stairs toward a jazz club where cymbals shimmer below street level', 'street solitude opening into underground warmth', ['oldpop-lounge'], 'basement-jazz', '도시의 밤', '혼자', '이동 중'),
  adultTheme('oldpoplounge-casino-carpet-lounge', '카지노 라운지 카펫', 'crossing a casino lounge carpet while coins rattle and a crooner bends the room quiet', 'restless chance cooling into elegant detachment', ['oldpop-lounge'], 'casino-lounge', '도시의 밤', '여럿', '이동 중'),
  adultTheme('oldpoplounge-black-car-curbside', '검은 차와 클럽 앞 curb', 'stepping from a black car at the curb while camera bulbs flash near the club entrance', 'public glamour hiding private vulnerability', ['oldpop-lounge'], 'club-arrival', '도시의 밤', '여럿', '이동 중'),
  adultTheme('oldpoplounge-boulevard-after-rain', '비 갠 대로', 'walking a rain-slick boulevard after midnight while streetlamps double themselves on the pavement', 'cool loneliness brightening into silver reflection', ['oldpop-lounge'], 'rain-boulevard', '도시의 밤', '혼자', '이동 중'),
  adultTheme('oldpoplounge-elevator-operator-smile', '엘리베이터 안내원의 미소', 'riding with a uniformed elevator operator who knows exactly which floor holds the music', 'formal silence turning into conspiratorial charm', ['oldpop-lounge'], 'hotel-elevator', '도시의 밤', '둘', '정적'),
  adultTheme('oldpoplounge-rooftop-antenna-adjusting', '옥상 안테나 조정', 'adjusting a rooftop antenna in evening wind until a distant station suddenly comes clear', 'static frustration resolving into bright discovery', ['oldpop-lounge'], 'rooftop-radio', '도시의 밤', '혼자', '활동 중'),
  adultTheme('oldpoplounge-florist-closing-neon', '닫는 꽃집 네온', 'passing a florist closing under neon light while unsold roses lean in silver buckets', 'detached walking softening into sudden tenderness', ['oldpop-lounge'], 'late-florist', '도시의 밤', '혼자', '이동 중'),
  adultTheme('oldpoplounge-photo-booth-strip', '즉석사진 부스 사진띠', 'waiting outside a photo booth while four wet pictures slide from the metal slot', 'teasing laughter becoming a lasting secret', ['oldpop-lounge'], 'photo-booth', '도시의 밤', '둘', '정적'),
  adultTheme('oldpoplounge-bowling-alley-afterhours', '영업 끝난 볼링장', 'standing in an after-hours bowling alley while pin machines clatter behind dark lanes', 'empty-space melancholy turning into playful defiance', ['oldpop-lounge'], 'afterhours-lanes', '도시의 밤', '여럿', '정적'),
  adultTheme('oldpoplounge-pool-vending-machine', '모텔 수영장 자판기', 'buying a soda from a motel pool vending machine while blue water glows behind the fence', 'roadside boredom shifting into lazy summer glamour', ['oldpop-lounge'], 'motel-pool', '밤 여행', '혼자', '정적'),
  adultTheme('oldpoplounge-barbershop-quartet-room', '이발소 콰르텟 연습실', 'hearing a barbershop quartet rehearse behind a closed door while shaving cream scents the hall', 'comic surprise blooming into harmony-soaked warmth', ['oldpop-lounge'], 'harmony-room', '도시의 밤', '여럿', '정적'),
  adultTheme('oldpoplounge-midnight-pie-counter', '자정 파이 카운터', 'ordering one slice of pie at midnight while the waitress refills cups without asking', 'late fatigue easing into familiar comfort', ['oldpop-lounge'], 'midnight-counter', '도시의 밤', '혼자', '정적'),
  adultTheme('oldpoplounge-streetcar-last-stop', '전차 종점', 'staying aboard a streetcar to the last stop while empty seats shine under yellow bulbs', 'aimless motion finding a tender destination', ['oldpop-lounge'], 'night-transit', '도시의 밤', '혼자', '이동 중'),
  adultTheme('oldpoplounge-record-label-hallway', '레코드 회사 복도', 'waiting in a record label hallway with a demo reel held tightly under one arm', 'ambition and doubt tightening into brave resolve', ['oldpop-lounge'], 'music-business', '도시의 낮', '혼자', '정적'),
  adultTheme('oldpoplounge-radio-station-audition', '라디오 방송국 오디션', 'singing into a radio station microphone while an engineer watches through the glass', 'shaky first notes growing into fearless projection', ['oldpop-lounge'], 'studio-audition', '도시의 낮', '혼자', '정적'),
  adultTheme('oldpoplounge-mannequin-department-store', '백화점 마네킹 쇼윈도', 'pausing before department store mannequins dressed for evening while buses hiss at the curb', 'consumer sparkle turning into self-invention', ['oldpop-lounge'], 'storefront-night', '도시의 밤', '혼자', '정적'),
  adultTheme('oldpoplounge-harbor-foghorn-suite', '항구 호텔의 안개horn', 'hearing a harbor foghorn from a hotel suite while curtains breathe in salt air', 'luxury loneliness deepening into ocean-sized longing', ['oldpop-lounge'], 'harbor-hotel', '밤바다', '혼자', '정적'),
  adultTheme('oldpoplounge-grand-hotel-staircase', '그랜드 호텔 계단', 'descending a grand hotel staircase while a small orchestra waits for the downbeat', 'poised hesitation blossoming into entrance-moment glamour', ['oldpop-lounge'], 'hotel-ballroom', '도시의 밤', '혼자', '이동 중'),
  adultTheme('oldpoplounge-mirrored-dance-studio', '거울 댄스스튜디오', 'repeating steps in a mirrored dance studio until city lights replace daylight outside', 'disciplined fatigue turning into polished confidence', ['oldpop-lounge'], 'dance-rehearsal', '도시의 밤', '혼자', '춤'),
  adultTheme('oldpoplounge-office-holiday-party', '사무실 홀리데이 파티', 'holding punch at an office holiday party while the quiet accountant starts the best dance', 'stiff politeness loosening into communal delight', ['oldpop-lounge'], 'office-party', '겨울 도시', '여럿', '춤'),
  adultTheme('oldpoplounge-beach-bonfire-harmony', '해변 모닥불 하모니', 'singing around a beach bonfire after dark while sparks climb into the ocean wind', 'group laughter settling into glowing harmony', ['oldpop-lounge'], 'beach-bonfire', '여름 밤', '여럿', '정적'),
  adultTheme('oldpoplounge-pharmacy-neon-midnight', '자정 약국 네온', 'standing under a midnight pharmacy sign while a saxophone phrase floats from the next block', 'practical errand becoming lonely city poetry', ['oldpop-lounge'], 'late-pharmacy', '도시의 밤', '혼자', '정적'),
  adultTheme('oldpoplounge-school-cafeteria-jukebox', '학교 식당 주크박스', 'dropping a coin into the cafeteria jukebox after class while friends claim a corner table', 'teenage boredom sparking into shared excitement', ['oldpop-lounge'], 'school-jukebox', '젊은 날', '여럿', '정적'),
  adultTheme('oldpoplounge-cloakroom-raincoat-claim', '클록룸 레인코트 번호표', 'handing over a cloakroom ticket for a raincoat while the encore still rings down the hall', 'showtime glow cooling into rainy tenderness', ['oldpop-lounge'], 'cloakroom-exit', '도시의 밤', '둘', '정적'),
  adultTheme('oldpoplounge-press-room-night-edition', '신문사 야간판 인쇄실', 'watching a night edition roll through the press room while ink smell fills the stairs', 'deadline tension turning into citywide pulse', ['oldpop-lounge'], 'press-room', '도시의 밤', '여럿', '활동 중'),
  adultTheme('oldpoplounge-night-train-sleeper', '야간열차 침대칸', 'lying awake in a night train sleeper car while blue stations slide past the curtain', 'private ache rocking into drifting acceptance', ['oldpop-lounge'], 'night-train', '여행 중', '혼자', '정적'),
  adultTheme('oldpoplounge-suburban-block-party', '교외 블록파티', 'carrying a folding chair to a suburban block party as porch lights switch on together', 'neighborly small talk growing into easy celebration', ['oldpop-lounge'], 'block-party', '여름 저녁', '여럿', '이동 중'),
  adultTheme('oldpoplounge-tavern-dartboard', '선술집 다트판', 'aiming at a tavern dartboard while old jokes fly louder than the jukebox', 'competitive swagger melting into friendly belonging', ['oldpop-lounge'], 'corner-tavern', '도시의 밤', '여럿', '활동 중'),
  adultTheme('oldpoplounge-shoe-shine-stand', '도심 구두닦이 의자', 'sitting at a downtown shoe shine stand while polished traffic moves in the reflection', 'careworn routine sharpening into renewed poise', ['oldpop-lounge'], 'street-service', '도시의 낮', '혼자', '정적'),
  adultTheme('oldpoplounge-hotel-key-mail-slot', '호텔 키 보관함', 'watching a brass hotel key slide into a mail slot behind the front desk', 'arrival uncertainty turning into temporary belonging', ['oldpop-lounge'], 'hotel-front-desk', '도시의 밤', '혼자', '정적'),
  adultTheme('oldpoplounge-ballroom-coat-check', '볼룸 코트체크 번호표', 'pinching a ballroom coat check ticket while strings tune behind the closed doors', 'anticipation tightening into elegant motion', ['oldpop-lounge'], 'ballroom-threshold', '도시의 밤', '둘', '정적'),
  adultTheme('oldpoplounge-soda-delivery-truck-dawn', '새벽 소다 배달 트럭', 'watching a soda delivery truck unload crates at dawn behind a silent club', 'night glamour fading into hardworking tenderness', ['oldpop-lounge'], 'club-back-alley', '도시의 새벽', '여럿', '활동 중'),
  adultTheme('oldpoplounge-neon-laundromat-dry-cycle', '네온 세탁소 건조기', 'waiting for a neon laundromat dry cycle while a slow song leaks from a pocket radio', 'restless waiting settling into blue-lit calm', ['oldpop-lounge'], 'laundromat-wait', '도시의 밤', '혼자', '정적'),
  adultTheme('oldpoplounge-ticket-stub-suit-pocket', '정장 주머니 티켓 반쪽', 'finding a torn ticket stub in a suit pocket before stepping into another late show', 'private memory folding into present-tense resolve', ['oldpop-lounge'], 'show-keepsake', '도시의 밤', '혼자', '정적')
];

export const adultLyricThemes: LyricTheme[] = [
  {
    id: 'senior-morning-coffee-first-light',
    labelKo: '아침 커피 첫 빛',
    scene: 'sitting with morning coffee before the day begins, watching first light move across the table',
    emotionalArc: 'sleepy heaviness opening into steady comfort',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-old-letter-after-breakfast',
    labelKo: '아침 식사 뒤 오래된 편지',
    scene: 'finding an old folded letter after breakfast and reading it beside a quiet window',
    emotionalArc: 'private ache softening into gratitude',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-kitchen-radio-tea',
    labelKo: '부엌 라디오와 따뜻한 차',
    scene: 'making tea in a small kitchen while an old radio plays low in the corner',
    emotionalArc: 'ordinary routine becoming a warm companion',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-garden-dew-walk',
    labelKo: '이슬 맺힌 정원 산책',
    scene: 'walking slowly through a small garden with dew on the leaves and slippers on the path',
    emotionalArc: 'quiet worry settling into a clear breath',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-market-bus-window',
    labelKo: '시장 다녀오는 버스 창가',
    scene: 'riding the bus home from the morning market with a paper bag resting on the knees',
    emotionalArc: 'tired body finding a small lift',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-family-photo-album',
    labelKo: '가족 사진 앨범 정리',
    scene: 'sorting a family photo album on the floor while afternoon dust shines in the room',
    emotionalArc: 'bittersweet remembering turning into a gentle smile',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-wool-cardigan-chair',
    labelKo: '낡은 카디건과 빈 의자',
    scene: 'folding a worn wool cardigan over a familiar chair before opening the window',
    emotionalArc: 'small loneliness becoming practical tenderness',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-porch-tea-sunset',
    labelKo: '해질녘 현관 차 한 잔',
    scene: 'drinking tea on the porch at sunset while neighbors close their gates one by one',
    emotionalArc: 'day-end fatigue resolving into calm acceptance',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-train-platform-reunion',
    labelKo: '기차역에서 기다리는 오후',
    scene: 'waiting on a small train platform with a scarf in hand and a paper ticket in the pocket',
    emotionalArc: 'nervous anticipation becoming open warmth',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-handwritten-recipe',
    labelKo: '손글씨 레시피 노트',
    scene: 'following a handwritten recipe card with faded ink while soup starts to simmer',
    emotionalArc: 'missing someone through a practical ritual, then feeling them near',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-paper-calendar-date',
    labelKo: '종이 달력에 표시한 날',
    scene: 'marking a date on a paper calendar and noticing older circles from years before',
    emotionalArc: 'time passing into a gentle promise to continue',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-riverside-bench',
    labelKo: '강가 벤치의 작은 휴식',
    scene: 'resting on a riverside bench with a thermos while cyclists pass quietly behind',
    emotionalArc: 'restless thoughts easing into steady breathing',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-bookshop-rain',
    labelKo: '비 오는 헌책방 앞',
    scene: 'standing under the awning of a used bookshop while rain taps a paper shopping bag',
    emotionalArc: 'unexpected pause becoming a small gift',
    suitedArchetypes: ['senior-morning', 'showa-cafe']
  },
  {
    id: 'senior-laundry-sunline',
    labelKo: '햇빛 아래 빨래줄',
    scene: 'pinning laundry on a sunlit line and hearing a distant radio through an open door',
    emotionalArc: 'plain chores turning into a peaceful morning',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-old-radio-request',
    labelKo: '라디오 신청곡 엽서',
    scene: 'writing a radio request postcard at the table while the kettle clicks off',
    emotionalArc: 'hesitation becoming a quiet wish sent outward',
    suitedArchetypes: ['senior-morning', 'showa-cafe']
  },
  {
    id: 'senior-window-plant-new-leaf',
    labelKo: '창가 화분의 새잎',
    scene: 'noticing a new leaf on the window plant while watering it before breakfast',
    emotionalArc: 'small surprise turning into renewed hope',
    suitedArchetypes: ['senior-morning']
  },
  // TASK v3.58 — the senior-morning-suited pool above topped out at 16
  // themes, one short of covering an 18-song set without at least one
  // forced repeat (buildStridePlan in core/lyricDiversityPlan.ts can only
  // spread repeats out, not eliminate them, once songCount exceeds the
  // pool). Real measurement found exactly 2 duplicate pairs in an 18-song
  // pack for this reason. These 6 additions give real headroom above 18,
  // not just the bare minimum, so a slightly larger set (or a manual
  // allocation override) still gets zero repeats too.
  {
    id: 'senior-post-office-parcel',
    labelKo: '우체국에서 부치는 소포',
    scene: 'wrapping a small parcel with brown paper and string before walking it to the post office counter',
    emotionalArc: 'quiet effort turning into a warm sense of reaching someone far away',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-evening-newspaper-lamp',
    labelKo: '저녁 신문과 스탠드 불빛',
    scene: 'reading the evening newspaper under a warm desk lamp while the house settles into quiet',
    emotionalArc: 'the day\'s noise fading into an unhurried, contented stillness',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-shoe-repair-corner',
    labelKo: '골목 구두 수선집',
    scene: 'waiting at a small corner shoe-repair stall while an old pair gets a new heel',
    emotionalArc: 'a small practical wait becoming an unexpected moment of patience and care',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-winter-scarf-knitting',
    labelKo: '겨울 목도리 뜨개질',
    scene: 'knitting a scarf by the window as the first cold wind rattles the glass',
    emotionalArc: 'repetitive quiet work settling restless hands into calm',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-alley-cat-feeding',
    labelKo: '골목 고양이 밥 주기',
    scene: 'setting out a small bowl for the neighborhood cat in the early alley light',
    emotionalArc: 'a small daily kindness turning into unexpected companionship',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-clock-tower-evening-walk',
    labelKo: '저녁 종탑 아래 산책',
    scene: 'walking past the old neighborhood clock tower as its evening chime rolls over the rooftops',
    emotionalArc: 'the day\'s weight easing with each familiar, unhurried step',
    suitedArchetypes: ['senior-morning']
  },
  // TASK v3.64 (TASK A) — 9 new frames (2 scenes each) so a 60s-80s
  // Western-oldpop channel (senior-morning, oldpop-lounge) can actually
  // reach the core subject matter of that era's music — young romance,
  // dances, reunions, travel, city nights — instead of only ever landing
  // on the pre-existing "solitary senior with an object" frame. See
  // core/lyricDiversityPlan.ts's frame-capped allocation.
  {
    id: 'senior-first-dance-memory',
    labelKo: '첫 춤의 기억',
    scene: 'remembering the first slow dance at a summer social, hand shy on a shoulder for the first time',
    emotionalArc: 'nervous shyness blooming into certainty',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'young-first-love',
    eraSettingKo: '젊은 날',
    castKo: '둘',
    motionKo: '정적(춤)'
  },
  {
    id: 'senior-porch-swing-courtship',
    labelKo: '현관 그네에서의 구애',
    scene: 'sitting close on a porch swing on a warm evening, working up the courage to hold a hand for the first time',
    emotionalArc: 'quiet nervousness settling into warm certainty',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'young-first-love',
    eraSettingKo: '젊은 날',
    castKo: '둘',
    motionKo: '정적'
  },
  {
    id: 'senior-convertible-radio-night',
    labelKo: '여름밤 오픈카 드라이브',
    scene: 'driving with the windows down on a warm summer night, the radio playing low and the road stretching ahead',
    emotionalArc: 'restlessness turning into free-wheeling joy',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'summer-night',
    eraSettingKo: '젊은 날 여름',
    castKo: '둘',
    motionKo: '이동 중(드라이브)'
  },
  {
    id: 'senior-boardwalk-summer-lights',
    labelKo: '해변 보드워크의 여름 불빛',
    scene: 'walking the boardwalk lights on a humid summer night, salt air mixing with music from an open doorway',
    emotionalArc: 'sticky-hot restlessness melting into carefree delight',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'summer-night',
    eraSettingKo: '젊은 날 여름',
    castKo: '여럿',
    motionKo: '이동 중'
  },
  {
    id: 'senior-saturday-dance-hall',
    labelKo: '토요일 밤 댄스홀',
    scene: 'spinning across a crowded dance hall floor on a Saturday night as the band swings into a favorite number',
    emotionalArc: 'nervous energy exploding into pure joy',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'dance-saturday',
    eraSettingKo: '젊은 날',
    castKo: '여럿',
    motionKo: '춤'
  },
  {
    id: 'senior-getting-ready-saturday',
    labelKo: '토요일 외출 준비',
    scene: 'curling hair and pressing a good shirt before a Saturday dance, the whole week narrowing down to this one night',
    emotionalArc: 'anticipation building toward giddy readiness',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'dance-saturday',
    eraSettingKo: '젊은 날',
    castKo: '혼자(준비)',
    motionKo: '정적(준비)'
  },
  {
    id: 'senior-platform-goodbye-whistle',
    labelKo: '기적소리와 플랫폼의 이별',
    scene: 'standing on a train platform as the whistle blows, a hand still raised long after the train pulls away',
    emotionalArc: 'sharp ache softening into quiet hope',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'reunion-parting',
    eraSettingKo: '젊은 날',
    castKo: '둘',
    motionKo: '이동(이별)'
  },
  {
    id: 'senior-unexpected-street-reunion',
    labelKo: '거리에서의 우연한 재회',
    scene: 'spotting an old sweetheart across a crowded street corner after years apart, both stopping mid-step at the same moment',
    emotionalArc: 'startled disbelief opening into warm recognition',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'reunion-parting',
    eraSettingKo: '오래전과 지금',
    castKo: '둘',
    motionKo: '이동 중'
  },
  {
    id: 'senior-mailbox-love-letter',
    labelKo: '우체통에 넣은 연애편지',
    scene: 'sealing a letter with a shaking hand and walking it to the corner mailbox before losing the nerve',
    emotionalArc: 'nervous risk settling into relieved hope',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'letter-sending',
    eraSettingKo: '젊은 날',
    castKo: '혼자(편지를 보내는)',
    motionKo: '이동 중'
  },
  {
    id: 'senior-waiting-mail-truck',
    labelKo: '우편 마차를 기다리며',
    scene: 'watching for the mail truck from the porch every afternoon, hoping today brings the letter that was promised',
    emotionalArc: 'restless hope tipping into quiet joy',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'letter-sending',
    eraSettingKo: '젊은 날',
    castKo: '혼자(기다리는)',
    motionKo: '정적'
  },
  {
    id: 'senior-neon-downtown-friday',
    labelKo: '금요일 밤 네온사인 거리',
    scene: 'walking under neon signs downtown on a Friday night, music drifting out of every open doorway',
    emotionalArc: 'ordinary tiredness lighting up into electric excitement',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'city-lights',
    eraSettingKo: '젊은 날 도시',
    castKo: '여럿',
    motionKo: '이동 중'
  },
  {
    id: 'senior-rooftop-city-view',
    labelKo: '옥상에서 바라본 도시 불빛',
    scene: 'watching the city lights switch on one by one from a rooftop lounge as evening traffic hums below',
    emotionalArc: 'quiet awe settling into calm belonging',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'city-lights',
    eraSettingKo: '젊은 날 도시',
    castKo: '둘',
    motionKo: '정적'
  },
  {
    id: 'senior-train-window-towns',
    labelKo: '기차 창밖의 낯선 마을들',
    scene: 'watching unfamiliar towns roll past a train window, a suitcase resting against the knees',
    emotionalArc: 'homesick uncertainty opening into curious wonder',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'travel-window',
    eraSettingKo: '젊은 날 여행',
    castKo: '혼자(여행)',
    motionKo: '이동 중(기차)'
  },
  {
    id: 'senior-highway-sunset-map',
    labelKo: '해질녘 고속도로의 지도',
    scene: 'driving down an open highway at sunset with a road map open on the dashboard and no fixed hour to arrive',
    emotionalArc: 'aimless freedom deepening into calm wonder',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'travel-window',
    eraSettingKo: '젊은 날 여행',
    castKo: '둘',
    motionKo: '이동 중(차)'
  },
  {
    id: 'senior-big-family-dinner',
    labelKo: '북적이는 가족 저녁 식탁',
    scene: 'passing dishes around a packed family dinner table while three conversations happen at once',
    emotionalArc: 'chaotic noise settling into full-hearted belonging',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'shared-table',
    eraSettingKo: '현재',
    castKo: '여럿',
    motionKo: '정적(식탁)'
  },
  {
    id: 'senior-diner-booth-old-friends',
    labelKo: '단골 식당 부스의 옛 친구들',
    scene: 'sliding into a familiar diner booth with old friends, the same stories somehow funnier every single time',
    emotionalArc: 'ordinary routine warming into easy laughter',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'shared-table',
    eraSettingKo: '현재',
    castKo: '여럿',
    motionKo: '정적'
  },
  {
    id: 'senior-first-cold-morning',
    labelKo: '첫 추위가 찾아온 아침',
    scene: 'stepping outside on the first cold morning of autumn to find the whole street suddenly turned to color',
    emotionalArc: 'mild surprise settling into grateful stillness',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'season-turning',
    eraSettingKo: '계절이 바뀌는 순간',
    castKo: '혼자',
    motionKo: '정적'
  },
  {
    id: 'senior-first-warm-afternoon',
    labelKo: '봄의 첫 따뜻한 오후',
    scene: 'throwing open every window on the first warm afternoon of spring and letting the whole house breathe again',
    emotionalArc: 'long winter heaviness lifting into open relief',
    suitedArchetypes: ['senior-morning', 'oldpop-lounge'],
    frameId: 'season-turning',
    eraSettingKo: '계절이 바뀌는 순간',
    castKo: '혼자',
    motionKo: '정적'
  },
  // 지시문 14 (Phase 2 TASK B) — 30 new entries, 40 -> 70. This is the one
  // archetype with REAL registered usage (Phase 1 TASK D's backfill of 3
  // real packs measured only 18/40 candidate themes actually used, but all
  // 3 packs drew from the same narrow slice — 지시문 14 §1-1/§1-3). Strictly
  // avoids every family §B-3 flags as already-covered here: letter/mail
  // (x3: old-letter/mailbox-love-letter/waiting-mail-truck), coffee/tea/
  // breakfast (x3), window/plant (x2), train/platform (x3), porch (x2),
  // diner (x1) — plus radio/bookshop/newspaper/dance/boardwalk/calendar/
  // laundry/riverside/highway/rooftop/neon-downtown, all already present.
  {
    id: 'senior-tomato-garden-harvest',
    labelKo: '텃밭 토마토 수확',
    scene: 'kneeling in a small backyard garden to pick the first ripe tomato of the season',
    emotionalArc: 'patient waiting rewarded with quiet pride',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-church-choir-practice',
    labelKo: '성가대 연습',
    scene: 'holding a worn hymn book during a quiet weekday choir practice in an empty sanctuary',
    emotionalArc: 'tired voice finding unexpected strength in harmony',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-fishing-pier-morning',
    labelKo: '아침 낚시터',
    scene: 'casting a line off a quiet pier before the town wakes up, coffee steam long gone cold',
    emotionalArc: 'restless thoughts settling into patient stillness',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-bakery-bread-cooling-rack',
    labelKo: '빵집 식힘망',
    scene: 'watching fresh loaves cool on a rack through a neighborhood bakery window',
    emotionalArc: 'ordinary errand becoming a small warm comfort',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-grandchild-video-call',
    labelKo: '손주와의 영상통화',
    scene: "fumbling with a tablet screen to answer a grandchild's video call and laughing at the shaky frame",
    emotionalArc: 'clumsy technology giving way to pure delight',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-barbershop-old-friend-chat',
    labelKo: '이발소 옛 친구와의 대화',
    scene: 'settling into a familiar barbershop chair while an old friend across the room picks up an old argument',
    emotionalArc: 'routine visit deepening into easy companionship',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-park-bench-chess-game',
    labelKo: '공원 벤치 체스',
    scene: 'moving a worn chess piece across a park bench board while pigeons wait for crumbs nearby',
    emotionalArc: 'quiet rivalry settling into comfortable friendship',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-sewing-machine-mending',
    labelKo: '재봉틀로 옷 수선',
    scene: 'guiding fabric under an old sewing machine needle to mend a favorite worn shirt',
    emotionalArc: 'careful repair becoming quiet satisfaction',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-greenhouse-orchid-care',
    labelKo: '온실 난초 돌보기',
    scene: 'misting a stubborn orchid in a small greenhouse and waiting patiently for one new bloom',
    emotionalArc: 'quiet devotion rewarded with delicate beauty',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-farmers-market-stall',
    labelKo: '농산물 직판장',
    scene: 'choosing the ripest peaches at a weekend farmers market stall while vendors call out prices',
    emotionalArc: 'simple errand blooming into cheerful conversation',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-piano-dust-cover-lifting',
    labelKo: '피아노 덮개를 걷다',
    scene: 'lifting a dusty cover off an old piano and pressing one hesitant key for the first time in years',
    emotionalArc: 'rusty hesitation opening into rediscovered joy',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-wedding-anniversary-toast',
    labelKo: '결혼기념일 건배',
    scene: 'raising a quiet toast at a small anniversary dinner after all these years together',
    emotionalArc: 'familiar routine deepening into renewed devotion',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-attic-trunk-keepsakes',
    labelKo: '다락방 오래된 트렁크',
    scene: 'opening a dusty attic trunk and finding keepsakes nobody has touched in decades',
    emotionalArc: 'surprised memory softening into grateful reflection',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-museum-quiet-gallery-walk',
    labelKo: '한적한 미술관 산책',
    scene: 'wandering a quiet museum gallery on a weekday afternoon with no one else in the room',
    emotionalArc: 'restless mind settling into calm appreciation',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-bicycle-basket-errand',
    labelKo: '자전거 바구니 심부름',
    scene: 'pedaling a bicycle with a small front basket to run one unhurried errand downtown',
    emotionalArc: 'ordinary task becoming a small joyful outing',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-grandchildren-backyard-visit',
    labelKo: '손주들 마당 방문',
    scene: 'watching grandchildren chase each other across the backyard on a rare full-house Sunday',
    emotionalArc: 'quiet house filling with unexpected joyful noise',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-library-return-desk',
    labelKo: '도서관 반납대',
    scene: 'returning a stack of well-loved books to a familiar library desk and choosing three more',
    emotionalArc: 'quiet routine becoming a small private pleasure',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-seaside-chair-umbrella',
    labelKo: '해변 접이의자 파라솔',
    scene: 'settling into a folding beach chair under a striped umbrella with a book left unopened',
    emotionalArc: 'restless urgency dissolving into unhurried rest',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-potluck-church-hall',
    labelKo: '교회 친목 포트럭',
    scene: 'setting a homemade dish on a long church hall table before old friends arrive for the potluck',
    emotionalArc: 'quiet effort rewarded with warm shared belonging',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-mountain-cabin-fireplace',
    labelKo: '산장 벽난로',
    scene: 'stacking one more log onto a mountain cabin fireplace as evening settles over quiet hills',
    emotionalArc: 'travel fatigue melting into cozy contentment',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-tailor-shop-old-suit',
    labelKo: '양복점 오래된 정장',
    scene: 'trying on an old suit at a tailor shop for an event that suddenly feels important again',
    emotionalArc: 'faded self-doubt straightening into quiet dignity',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-music-box-winding',
    labelKo: '오르골 태엽 감기',
    scene: 'winding a small music box on a shelf and listening to the same melody it has always played',
    emotionalArc: 'sudden memory arriving gently, without ache',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-orchard-apple-picking',
    labelKo: '과수원 사과 따기',
    scene: 'reaching for a high apple branch in a quiet orchard row on a crisp autumn morning',
    emotionalArc: 'simple labor rewarded with a satisfying harvest',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-card-game-evening-table',
    labelKo: '저녁 카드놀이',
    scene: "shuffling a worn deck of cards at the kitchen table for the evening's usual friendly game",
    emotionalArc: 'quiet evening warming into familiar laughter',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-lighthouse-keeper-memory',
    labelKo: '등대지기의 기억',
    scene: 'climbing the spiral stairs of an old lighthouse and remembering years spent keeping its light',
    emotionalArc: 'faded duty softening into proud quiet nostalgia',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-swimming-pool-morning-laps',
    labelKo: '아침 수영장',
    scene: 'pushing off the wall for one more slow morning lap in an almost-empty community pool',
    emotionalArc: 'stiff resistance easing into steady rhythm',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-antique-clock-repair',
    labelKo: '골동품 시계 수리',
    scene: 'opening the back panel of an old mantel clock to coax its ticking back to life',
    emotionalArc: 'stubborn silence resolving into a satisfying tick',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-watercolor-painting-easel',
    labelKo: '이젤 앞 수채화',
    scene: 'mixing one more shade of blue at an easel set up near a sunlit window',
    emotionalArc: 'restless hands finding calm through quiet color',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-harmonica-backstep-evening',
    labelKo: '뒷계단 하모니카',
    scene: 'playing a slow half-remembered tune on a harmonica from the back steps at dusk',
    emotionalArc: 'quiet solitude softening into gentle nostalgia',
    suitedArchetypes: ['senior-morning']
  },
  {
    id: 'senior-campfire-grandchildren-story',
    labelKo: '캠프파이어 손주 이야기',
    scene: 'telling an old family story around a small backyard campfire while grandchildren lean in close',
    emotionalArc: 'quiet memory passed on becoming shared warmth',
    suitedArchetypes: ['senior-morning']
  },
  ...SENIOR_OLDPOP_SCENE_EXPANSION_THEMES,
  ...OLDPOP_LOUNGE_SCENE_EXPANSION_THEMES,
  {
    id: 'showa-late-night-drive',
    labelKo: '늦은 밤 드라이브',
    scene: 'driving through familiar streets after midnight with dashboard lights on the hands',
    emotionalArc: 'restless loneliness shifting into a private thrill',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-rain-cafe-window',
    labelKo: '비 오는 카페 창가',
    scene: 'sitting by a rain-streaked cafe window with one untouched cup and passing headlights outside',
    emotionalArc: 'held-back longing opening into a brave exhale',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-faded-photo-drawer',
    labelKo: '서랍 속 빛바랜 사진',
    scene: 'finding a faded photograph in a drawer while cleaning the room before evening',
    emotionalArc: 'sudden memory becoming graceful release',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-record-player-after-close',
    labelKo: '마감 뒤 레코드 한 장',
    scene: 'playing one record after closing the cafe, with chairs stacked and the counter lights low',
    emotionalArc: 'empty-room ache turning into elegant resolve',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-neon-side-street',
    labelKo: '네온 골목의 우산',
    scene: 'walking under a small umbrella through a neon side street after the last train',
    emotionalArc: 'urban solitude becoming cinematic momentum',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-last-train-platform',
    labelKo: '막차 플랫폼',
    scene: 'waiting for the last train on a tiled platform while a vending machine hums nearby',
    emotionalArc: 'late-night uncertainty turning into forward motion',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-payphone-lobby',
    labelKo: '로비의 공중전화',
    scene: 'holding a payphone receiver in a quiet hotel lobby without dialing the last number',
    emotionalArc: 'hesitation rising into a chorus of confession',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-lipstick-coffee-cup',
    labelKo: '립스틱 묻은 커피잔',
    scene: 'noticing a lipstick mark on a coffee cup left at the counter after closing time',
    emotionalArc: 'tiny trace becoming a full remembered scene',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-jazz-bar-after-hours',
    labelKo: '재즈바 애프터아워',
    scene: 'standing in an after-hours jazz bar while the brass cases are latched shut',
    emotionalArc: 'cool restraint breaking into warm vulnerability',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-cassette-glovebox',
    labelKo: '글로브박스 카세트',
    scene: 'finding a cassette in the glovebox during a roadside stop before dawn',
    emotionalArc: 'old pulse returning as a bright chorus lift',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-arcade-umbrella',
    labelKo: '아케이드 거리의 빗소리',
    scene: 'standing in a covered arcade street as rain drums overhead and shop shutters come down',
    emotionalArc: 'crowded nostalgia clearing into a direct goodbye',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-hotel-lamp-letter',
    labelKo: '호텔 램프 아래 편지',
    scene: 'writing a letter under a hotel lamp with the city reflected in the window',
    emotionalArc: 'polished composure giving way to honest tenderness',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-seaside-motel-sunrise',
    labelKo: '해변 모텔의 새벽',
    scene: 'watching sunrise from a seaside motel balcony with salt on the railing',
    emotionalArc: 'nightlong ache resolving into a clean horizon',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-vinyl-store-afternoon',
    labelKo: '오후의 바이닐 가게',
    scene: 'flipping through vinyl sleeves in a narrow shop while afternoon light hits the dust',
    emotionalArc: 'playful searching becoming a precise memory',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-elevator-mirror',
    labelKo: '엘리베이터 거울 앞',
    scene: 'checking a reflection in an elevator mirror before stepping into a quiet lobby',
    emotionalArc: 'self-control loosening into a bold refrain',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-cafe-counter-last-cup',
    labelKo: '카운터의 마지막 잔',
    scene: 'washing the last cup behind the cafe counter while streetlights flicker outside',
    emotionalArc: 'routine ending with a small spark of longing',
    suitedArchetypes: ['showa-cafe']
  },
  // 지시문 14 (Phase 2 TASK B) — 28 new entries, 18 -> 46 (16 exclusive above
  // + 2 shared with senior-morning). Avoids every already-covered family
  // (night-drive/rain-window/faded-photo/record-player/neon-street/
  // last-train/payphone/lipstick-cup/jazz-bar/cassette-glovebox/
  // arcade-umbrella/hotel-letter/seaside-motel/vinyl-store/elevator-mirror/
  // cafe-counter).
  {
    id: 'showa-rooftop-bar-city-view',
    labelKo: '옥상바 도시 전망',
    scene: 'nursing a slow drink at a rooftop bar while the city grid glitters below in silence',
    emotionalArc: 'quiet isolation opening into cool reflective calm',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-late-bakery-closing-shift',
    labelKo: '늦은 베이커리 마감',
    scene: 'wiping down flour-dusted counters as the last bakery light dims for the night',
    emotionalArc: 'tired routine closing into a small private satisfaction',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-taxi-stand-queue-midnight',
    labelKo: '자정 택시승강장 줄',
    scene: 'waiting in a long taxi line past midnight while neon signs buzz overhead',
    emotionalArc: 'restless impatience settling into people-watching calm',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-piano-bar-request-song',
    labelKo: '피아노바 신청곡',
    scene: 'passing a folded note with a song request across a dim piano bar',
    emotionalArc: 'shy hesitation opening into a shared quiet smile',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-hotel-pool-night-swim',
    labelKo: '호텔 옥상수영장 야간 수영',
    scene: 'slipping into a quiet hotel rooftop pool after midnight with the skyline reflected on the water',
    emotionalArc: 'restless overthinking dissolving into weightless calm',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-subway-mural-night-walk',
    labelKo: '심야 지하철 벽화 거리',
    scene: 'walking past a colorful underground mural on an empty late subway platform',
    emotionalArc: 'flat exhaustion lifting into unexpected wonder',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-bookstore-cafe-late-reading',
    labelKo: '늦은 밤 서점카페',
    scene: 'losing track of time over one more chapter in a nearly empty bookstore cafe',
    emotionalArc: 'restless week quieting into absorbed calm',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-wine-bar-tasting-alone',
    labelKo: '혼자 즐기는 와인바',
    scene: 'swirling a glass alone at a quiet wine bar counter, in no hurry to be anywhere else',
    emotionalArc: 'solitary evening becoming unexpectedly rich company',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-night-market-food-stall',
    labelKo: '심야 포장마차',
    scene: 'ordering one more skewer from a steaming night-market stall as the crowd thins out',
    emotionalArc: 'hungry loneliness warming into simple contentment',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-observation-deck-city-lights',
    labelKo: '전망대 야경',
    scene: 'standing at an observation deck railing while the whole city glitters silently below',
    emotionalArc: 'small personal worries shrinking into wide perspective',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-allnight-diner-booth',
    labelKo: '24시간 다이너 부스석',
    scene: 'sliding into a quiet diner booth long after midnight and ordering the only thing that sounds right',
    emotionalArc: 'aimless night settling into simple grounded comfort',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-art-gallery-late-opening',
    labelKo: '늦은 갤러리 오프닝',
    scene: 'wandering a nearly-empty gallery opening after the crowd has thinned to a few last guests',
    emotionalArc: 'polite formality loosening into genuine connection',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-late-night-sento-spa',
    labelKo: '늦은 밤 대중탕',
    scene: 'soaking quietly in a near-empty late-night bathhouse pool with steam rising into silence',
    emotionalArc: 'accumulated tension melting into total release',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-midnight-bakery-bread-pickup',
    labelKo: '자정 빵집 픽업',
    scene: "picking up warm bread from a bakery's overnight window on the walk home",
    emotionalArc: 'tired errand becoming an unexpectedly warm comfort',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-street-musician-corner',
    labelKo: '길거리 뮤지션의 코너',
    scene: "stopping to listen to a street musician's quiet set on an empty late-night corner",
    emotionalArc: 'hurried indifference slowing into genuine appreciation',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-hotel-bar-last-call',
    labelKo: '호텔바 라스트콜',
    scene: 'ordering one last round at a hotel bar as the bartender starts stacking chairs',
    emotionalArc: 'lingering hesitation resolving into an honest goodbye',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-night-ferry-skyline',
    labelKo: '야간 페리에서 본 스카이라인',
    scene: 'watching the city skyline recede from the deck of a late-night ferry crossing',
    emotionalArc: 'departure ache softening into calm anticipation',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-late-tailor-shop-fitting',
    labelKo: '늦은 양장점 가봉',
    scene: 'standing still for a late tailor shop fitting under one warm lamp after the shop has closed to others',
    emotionalArc: 'tired stillness becoming quiet unexpected intimacy',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-night-bus-depot-waiting',
    labelKo: '심야 버스터미널 대기',
    scene: 'waiting on a hard depot bench for the last overnight bus with a bag at the feet',
    emotionalArc: 'restless departure settling into resigned patience',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-midnight-flower-shop-delivery',
    labelKo: '자정 꽃집 배달',
    scene: 'carrying a wrapped bouquet through empty streets for one very late delivery',
    emotionalArc: 'quiet obligation transforming into unexpected warmth',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-karaoke-bar-solo-mic',
    labelKo: '노래방 혼자 마이크',
    scene: 'taking a private karaoke room alone and finally singing one song all the way through',
    emotionalArc: 'held-back emotion finally breaking into full voice',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-night-jogger-city-bridge',
    labelKo: '야간 조깅 도시 다리',
    scene: 'crossing a quiet city bridge on a late run with the river lights streaking below',
    emotionalArc: 'restless static clearing into steady rhythm',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-antique-shop-closing-hour',
    labelKo: '마감 시간 골동품점',
    scene: 'browsing dusty antique shelves in the last minutes before a shop finally closes',
    emotionalArc: 'idle curiosity narrowing into one meaningful find',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-hotel-lobby-piano-late',
    labelKo: '호텔 로비 늦은 피아노',
    scene: 'listening to a lone lobby pianist finish the last set while the front desk dims the lights',
    emotionalArc: 'travel fatigue softening into unexpected peace',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-darkroom-photo-developing',
    labelKo: '암실 사진 현상',
    scene: 'watching an image slowly surface in a darkroom developing tray under red light',
    emotionalArc: 'anxious waiting resolving into quiet revelation',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-midnight-noodle-shop-steam',
    labelKo: '자정 국수집 김',
    scene: 'blowing on a steaming bowl at a narrow midnight noodle counter after a long day',
    emotionalArc: 'bone-deep tiredness melting into simple warmth',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-underground-jazz-club-entrance',
    labelKo: '지하 재즈클럽 입구',
    scene: 'ducking down a narrow stairway toward the muffled sound of a live jazz set below',
    emotionalArc: 'curious hesitation opening into immersive discovery',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa-skyline-observatory-closing-time',
    labelKo: '마감 시간 전망대',
    scene: 'lingering at an observatory railing as staff begin quietly announcing closing time',
    emotionalArc: 'reluctant ending softening into one last shared look',
    suitedArchetypes: ['showa-cafe']
  },
  {
    id: 'showa70s-night-train-ticket',
    labelKo: '70년대 야간열차 표',
    scene: 'boarding a night train with a paper ticket in the coat pocket while station lamps blur through the window',
    emotionalArc: 'quiet departure turning into a brave private promise',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-port-umbrella',
    labelKo: '항구와 우산',
    scene: 'standing by a harbor warehouse under a dark umbrella while a ferry horn fades into the rain',
    emotionalArc: 'lonely waiting becoming calm resolve',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-kissaten-letter',
    labelKo: '다방의 손편지',
    scene: 'folding a handwritten letter at a small kissaten table while the last cup cools beside it',
    emotionalArc: 'held-back words opening into honest tenderness',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-station-farewell',
    labelKo: '역의 이별',
    scene: 'saying goodbye at a tiled station platform with a shared umbrella dripping near the shoes',
    emotionalArc: 'farewell ache turning into a graceful chorus lift',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-faded-photo-drawer',
    labelKo: '서랍 속 사진',
    scene: 'finding a faded photograph in a wooden drawer on an evening when the season changes at the window',
    emotionalArc: 'sudden memory softening into gratitude',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-alley-streetlamp',
    labelKo: '골목의 가로등',
    scene: 'walking under an alley streetlamp after the shops close while rain gathers along the curb',
    emotionalArc: 'urban solitude becoming a steady forward step',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-record-shop',
    labelKo: '작은 레코드 가게',
    scene: 'turning through record sleeves in a narrow shop while afternoon dust shines in the light',
    emotionalArc: 'playful searching becoming a precise remembered face',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-phone-booth-rain',
    labelKo: '비 오는 공중전화',
    scene: 'holding a public phone receiver after rain without dialing the final number',
    emotionalArc: 'hesitation rising into a confession',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-ferry-terminal',
    labelKo: '새벽 페리 터미널',
    scene: 'waiting at a ferry terminal before dawn with salt wind on the sleeves and a small bag at the feet',
    emotionalArc: 'nightlong ache resolving into a clean horizon',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-department-rooftop',
    labelKo: '백화점 옥상',
    scene: 'watching the sunset from a department store rooftop while coin rides sit silent behind the railing',
    emotionalArc: 'ordinary city fatigue turning into a warm refrain',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-curtain-season',
    labelKo: '창가의 계절',
    scene: 'noticing the season change through thin curtains while a paper calendar bends on the wall',
    emotionalArc: 'time passing into a gentle decision to keep going',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-coffee-counter',
    labelKo: '카운터의 마지막 잔',
    scene: 'washing the final cup behind a quiet coffee counter while streetlights flicker outside',
    emotionalArc: 'routine ending with a small spark of longing',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  // 지시문 14 (Phase 2 TASK B) — 24 new entries, 12 -> 36, each a distinct
  // material family from the original 12 above (no repeat of night-train/
  // harbor/kissaten/station/photo-drawer/alley/record-shop/phone-booth/
  // ferry/rooftop/curtain/coffee-counter) — this archetype could not even
  // reach one 18-song set before this task (real measured gap, 지시문 14 §2-2).
  {
    id: 'showa70s-onsen-lantern-town',
    labelKo: '온천마을 등불',
    scene: 'walking a hot spring town lane in wooden sandals while paper lanterns sway above steaming gutters',
    emotionalArc: 'travel-worn tiredness dissolving into warm belonging',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-matsuri-fireworks-riverside',
    labelKo: '강변 여름 불꽃축제',
    scene: 'watching summer fireworks bloom over the river in a borrowed yukata sleeve brushing against a sleeve nearby',
    emotionalArc: 'crowded noise narrowing into one quiet held hand',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-cassette-mixtape-desk',
    labelKo: '데스크 위 카세트 믹스테이프',
    scene: 'rewinding a homemade cassette mixtape with a pencil while the label ink still smells fresh',
    emotionalArc: 'private effort becoming a hopeful gift',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-bicycle-shop-repair',
    labelKo: '자전거포 수리',
    scene: 'waiting on a wooden stool while a bicycle shop owner patches a tire under a bare bulb',
    emotionalArc: 'small delay becoming unexpected companionship',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-night-bus-window',
    labelKo: '심야버스 창가',
    scene: 'resting a forehead against a night bus window while distant town lights blur past like static',
    emotionalArc: 'restless departure settling into drowsy peace',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-back-alley-izakaya',
    labelKo: '뒷골목 이자카야',
    scene: 'ducking under a red lantern into a narrow back-alley izakaya still fogged with evening steam',
    emotionalArc: 'tired workday shedding into easy laughter',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-rooftop-laundry-line',
    labelKo: '옥상 빨랫줄',
    scene: 'pinning damp laundry to a rooftop rope while the whole neighborhood hums below in the afternoon heat',
    emotionalArc: 'ordinary chore opening into a wide unexpected view',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-newspaper-delivery-dawn',
    labelKo: '새벽 신문 배달',
    scene: 'pedaling a delivery bicycle through a still-dark street and tossing the last folded newspaper onto a step',
    emotionalArc: 'solitary dark labor meeting the first pale light',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-tobacco-stand-candy',
    labelKo: '담배가게 사탕',
    scene: 'counting small coins at a corner tobacco stand for one square of wrapped candy',
    emotionalArc: 'careful counting becoming a small sweet victory',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-bookstore-rain-browsing',
    labelKo: '비 오는 서점',
    scene: 'sheltering from rain inside a narrow bookstore and turning pages slower than necessary',
    emotionalArc: 'accidental shelter becoming unhurried discovery',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-streetcar-tram-bell',
    labelKo: '노면전차 종소리',
    scene: 'gripping a tram strap as the streetcar bell rings through a quiet crossing at dusk',
    emotionalArc: 'swaying fatigue settling into rhythmic comfort',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-riverside-bench-evening',
    labelKo: '저녁 강변 벤치',
    scene: 'sitting on a riverside bench as paper lanterns from a distant boat drift past in the current',
    emotionalArc: 'heavy silence loosening into gentle conversation',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-temple-bell-new-year',
    labelKo: '새해 제야의 종',
    scene: 'standing in a temple courtyard queue to ring the New Year bell once under a cold clear sky',
    emotionalArc: 'weary old year lifting into quiet renewed hope',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-paper-fan-summer-heat',
    labelKo: '여름 부채질',
    scene: 'fanning slow air with a paper fan on a porch step while cicadas roar through the heavy afternoon',
    emotionalArc: 'sluggish heat easing into unhurried closeness',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-schoolyard-reunion',
    labelKo: '옛 교정 재회',
    scene: 'walking back into an old schoolyard at dusk and recognizing a familiar silhouette by the gate',
    emotionalArc: 'nervous distance closing into easy familiarity',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-barber-shop-mirror',
    labelKo: '이발소 거울',
    scene: 'watching a barber shop mirror fog slightly while warm towels steam over tired shoulders',
    emotionalArc: 'quiet routine becoming an unexpected moment of care',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-bathhouse-sento-towel',
    labelKo: '대중목욕탕 수건',
    scene: 'carrying a small folded towel down a tiled sento hallway as steam curls beneath low lanterns',
    emotionalArc: 'weary body loosening into simple comfort',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-cherry-blossom-bench',
    labelKo: '벚꽃 아래 벤치',
    scene: 'sitting under falling cherry blossoms on a park bench while petals gather quietly on a shared bag',
    emotionalArc: 'fleeting bloom softening into unspoken affection',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-typewriter-office-late',
    labelKo: '늦은 사무실 타자기',
    scene: 'typing the final sentence on an office typewriter under one remaining desk lamp after everyone else has gone',
    emotionalArc: 'lonely overtime settling into quiet resolve',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-radio-dial-tuning',
    labelKo: '라디오 다이얼 맞추기',
    scene: 'turning a static-filled radio dial slowly to find one familiar late-night program',
    emotionalArc: 'searching frustration resolving into a comforting voice',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-countryside-grandmother-visit',
    labelKo: '시골 할머니댁 방문',
    scene: 'stepping off a rural bus toward a quiet family home in the countryside with cicadas loud in the summer trees',
    emotionalArc: 'travel fatigue melting into unconditional welcome',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-lantern-paper-boat-river',
    labelKo: '강물 위 종이등',
    scene: 'setting a small paper lantern boat onto a dark river and watching it drift with dozens of others',
    emotionalArc: 'quiet grief releasing into gentle collective hope',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-rice-field-harvest-dusk',
    labelKo: '해질녘 벼 수확',
    scene: 'walking home along a rice field path at dusk while cut stalks lean in gold evening light',
    emotionalArc: 'tired labor settling into grounded satisfaction',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'showa70s-moving-day-boxes',
    labelKo: '이사하는 날 상자들',
    scene: 'taping the last cardboard box shut in an empty apartment room while afternoon light crosses the bare floor',
    emotionalArc: 'chapter-closing sadness turning into forward-looking resolve',
    suitedArchetypes: ['showa-70s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-keitai-mail-platform',
    labelKo: '역 앞 폴더폰 메일',
    scene: 'waiting by the station ticket gates with a flip phone open to an unsent keitai mail',
    emotionalArc: 'nervous hesitation becoming a clear chorus confession',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-bicycle-school-road',
    labelKo: '자전거 등굣길',
    scene: 'riding a bicycle to morning class while a uniform tie flutters and the city is still half asleep',
    emotionalArc: 'sleepy routine lifting into bright momentum',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-summer-festival-mail',
    labelKo: '여름 축제 문자',
    scene: 'checking a flip phone message under summer festival lanterns while geta footsteps pass nearby',
    emotionalArc: 'crowded excitement narrowing into one brave reply',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-graduation-classroom',
    labelKo: '졸업 교실',
    scene: 'standing in an empty graduation classroom after the last homeroom with chalk dust in the sunlight',
    emotionalArc: 'farewell sadness opening into a hopeful future',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-first-train-call',
    labelKo: '첫차와 밤샘 통화',
    scene: 'catching the first train after talking all night on a flip phone until the battery warning flashes',
    emotionalArc: 'tired secret joy turning into a wide chorus',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-cd-shop-listening',
    labelKo: 'CD숍 청음기',
    scene: 'sharing a listening booth at a CD shop and pretending not to notice the same favorite chorus',
    emotionalArc: 'shy coincidence becoming mutual certainty',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-rain-bus-stop',
    labelKo: '비 오는 버스정류장',
    scene: 'waiting at a rainy bus stop with wired earphones tucked under a school blazer',
    emotionalArc: 'damp silence becoming a small shared warmth',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-rooftop-club',
    labelKo: '부활동 뒤 옥상',
    scene: 'standing on the school rooftop after club practice while the evening broadcast echoes below',
    emotionalArc: 'restless youth settling into a direct promise',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-purikura-sticker',
    labelKo: '프리쿠라 스티커',
    scene: 'finding a purikura sticker inside a notebook and smiling at the oversized handwritten date',
    emotionalArc: 'embarrassed memory becoming bright affection',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-convenience-umbrella',
    labelKo: '편의점 우산',
    scene: 'buying one clear convenience-store umbrella and walking slowly so two shoulders can fit beneath it',
    emotionalArc: 'awkward closeness becoming quiet courage',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-exam-night-desk',
    labelKo: '시험 전날 책상',
    scene: 'studying beside a desk lamp the night before exams while a flip phone mail waits unread',
    emotionalArc: 'pressure turning into a small message of support',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-station-front-wait',
    labelKo: '역 앞 기다림',
    scene: 'waiting under the station clock after school while the same melody leaks from wired earphones',
    emotionalArc: 'impatience turning into a sparkling arrival',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  // 지시문 14 (Phase 2 TASK B) — 24 new entries, 12 -> 36, each a distinct
  // material family from the original 12 above (no repeat of keitai-mail/
  // bicycle-school/festival-mail/graduation/first-train/CD-shop/rain-bus/
  // rooftop-club/purikura/convenience-umbrella/exam-desk/station-wait) —
  // this archetype could not even reach one 18-song set before this task
  // (real measured gap, 지시문 14 §2-2).
  {
    id: 'j2000s-karaoke-box-duet',
    labelKo: '노래방 듀엣',
    scene: 'sharing one microphone in a small karaoke box booth and missing the same high note on purpose',
    emotionalArc: 'nervous laughter turning into a bold shared chorus',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-ufo-catcher-arcade',
    labelKo: '아케이드 인형뽑기',
    scene: 'feeding coins into a UFO catcher machine and cheering when the claw finally holds',
    emotionalArc: 'stubborn failed attempts turning into triumphant celebration',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-juku-late-cram-school',
    labelKo: '늦은 학원 하굣길',
    scene: 'walking home from late cram school under vending-machine light with a heavy bag on one shoulder',
    emotionalArc: 'exhausted routine lifting into unexpected company',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-summer-homework-diary',
    labelKo: '여름방학 숙제 일기',
    scene: 'filling in the last blank page of a summer homework diary the night before it is due',
    emotionalArc: 'guilty procrastination turning into relieved laughter',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-two-seater-bicycle',
    labelKo: '이인승 자전거 하굣길',
    scene: 'balancing on the back rack of a bicycle with arms looped loosely around a shoulder ahead',
    emotionalArc: 'careful holding on becoming easy trust',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-vending-machine-warm-can',
    labelKo: '자판기 따뜻한 캔',
    scene: 'buying two warm cans from a roadside vending machine and pressing one into cold hands',
    emotionalArc: 'small quiet gesture becoming a clear unspoken care',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-food-court-mall-meetup',
    labelKo: '쇼핑몰 푸드코트 약속',
    scene: 'scanning a crowded mall food court for one familiar face over a tray of shared fries',
    emotionalArc: 'searching worry dissolving into relieved welcome',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-class-trip-bus-seat',
    labelKo: '수학여행 버스 옆자리',
    scene: 'sharing one earphone split down the middle on a school trip bus while the aisle fills with other chatter',
    emotionalArc: 'awkward closeness settling into comfortable silence',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-goldfish-scooping-festival',
    labelKo: '축제 금붕어 잡기',
    scene: 'kneeling at a festival goldfish-scooping stall while a paper scoop softens in the water',
    emotionalArc: 'competitive focus dissolving into shared laughter at failure',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-shared-scarf-winter',
    labelKo: '겨울 함께 쓴 목도리',
    scene: 'looping one long scarf around two necks while waiting at a freezing crosswalk after school',
    emotionalArc: 'shivering discomfort turning into warm closeness',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-new-semester-seat-assignment',
    labelKo: '새 학기 자리 배정',
    scene: 'checking a new seating chart on the first day of term and hiding a small hopeful smile',
    emotionalArc: 'anxious scanning turning into quiet delight',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-rooftop-lunch-bento',
    labelKo: '옥상 도시락 점심',
    scene: 'trading bento side dishes on the school rooftop during a short lunch break',
    emotionalArc: 'ordinary sharing becoming an easy private ritual',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-after-school-library-desk',
    labelKo: '방과후 도서관 책상',
    scene: 'sitting across a library desk pretending to study while stealing quick glances over a textbook',
    emotionalArc: 'quiet pretending giving way to an honest smile',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-train-delay-text-wait',
    labelKo: '전철 지연 문자 기다림',
    scene: 'checking a flip phone again for a reply while an announcement apologizes for the delayed train',
    emotionalArc: 'anxious checking settling into patient relief',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-birthday-surprise-classroom',
    labelKo: '교실 깜짝 생일파티',
    scene: 'walking into a decorated classroom to a chorus of surprised birthday voices and paper streamers',
    emotionalArc: 'stunned confusion melting into overwhelmed gratitude',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-sports-day-relay-baton',
    labelKo: '체육대회 계주 바통',
    scene: 'gripping a relay baton at the sports day starting line with the whole class shouting from the field',
    emotionalArc: 'racing nerves exploding into shared victory',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-culture-festival-poster-prep',
    labelKo: '문화제 포스터 준비',
    scene: 'painting a hand-lettered festival poster late in an empty classroom with paint on both sleeves',
    emotionalArc: 'tired teamwork becoming proud shared ownership',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-snow-day-cancelled-class',
    labelKo: '눈으로 휴교한 날',
    scene: 'staring out at unexpected snow piling on the school gate as morning classes get cancelled',
    emotionalArc: 'routine disruption turning into spontaneous joy',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-valentine-chocolate-handoff',
    labelKo: '발렌타인 초콜릿 전달',
    scene: 'holding a small wrapped chocolate behind a school shoe locker and rehearsing one short sentence',
    emotionalArc: 'terrified rehearsal resolving into brave delivery',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-convenience-store-part-time-job',
    labelKo: '편의점 아르바이트',
    scene: 'restocking a convenience store shelf during a slow late shift while rain streaks the front window',
    emotionalArc: 'lonely shift work broken by a familiar visitor',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-summer-pool-class-whistle',
    labelKo: '여름 수영수업 호루라기',
    scene: "lining up at the pool edge at a whistle's signal with chlorine sharp in the summer air",
    emotionalArc: 'nervous competition softening into shared exhaustion',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-graduation-photo-booth',
    labelKo: '졸업 즉석사진 부스',
    scene: 'squeezing into a cramped photo booth after graduation to fit one more face into the frame',
    emotionalArc: 'crowded rush becoming a treasured captured instant',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-locker-shoe-change-note',
    labelKo: '신발장 쪽지',
    scene: 'finding a folded note tucked inside an indoor shoe at the entrance locker before first period',
    emotionalArc: 'ordinary morning routine interrupted by a racing heart',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  {
    id: 'j2000s-summer-break-postcard',
    labelKo: '여름방학 엽서',
    scene: 'writing a short postcard from a hometown visit and wondering if a flip phone address is still the same',
    emotionalArc: 'distant longing folding into a hopeful mailed word',
    suitedArchetypes: ['j2000s'],
    languages: ['japanese']
  },
  // TASK B2 — kr-2030 workspace's 18 lyric scenes. Deliberately urban-30s
  // life (commute, studio apartment, work, dating, old friends), never the
  // senior vocabulary/sentiment above (no record player, kettle, photo
  // album, folded letter, radio in the kitchen, grandchildren, decades ago,
  // at my age). suitedArchetypes is 'kr-2030-pop' ONLY on every entry — see
  // this task's own §0-3 ① for why fewer than 12 of these would silently
  // fall back to the 80-entry senior/showa/j2000s pool above
  // (lyricThemesForArchetype's own suited.length >= 12 threshold).
  // frameId spans 8 distinct scene shapes (commute-transit x3, solitary-room
  // x4, threshold-decision x3, two-people-talk x3, night-drive x1,
  // reunion-passing x2, screen-memory x1, crowd-alone x1) so no single frame
  // dominates the pool the way v3.64's "senior alone gazing at an object"
  // regression did.
  {
    id: 'kr2030-commute-earbuds-relief',
    labelKo: '퇴근길 이어폰 위로',
    scene: 'riding the subway home from work with earbuds in, phone screen dim, letting the tired day drain out of the shoulders',
    emotionalArc: 'flat exhaustion softening into small relief',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'commute-transit',
    motionKo: '이동 중(지하철)',
    castKo: '혼자'
  },
  {
    id: 'kr2030-rainy-night-window',
    labelKo: '비 오는 밤 창밖',
    scene: 'watching rain slide down a studio apartment window at night, city lights blurred through the glass',
    emotionalArc: 'quiet loneliness settling into calm acceptance',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'solitary-room',
    motionKo: '정적',
    castKo: '혼자'
  },
  {
    id: 'kr2030-thirty-crossroads',
    labelKo: '서른 즈음의 고민',
    scene: 'turning thirty and quietly wondering whether this is the life that was supposed to happen by now',
    emotionalArc: 'anxious self-doubt opening into cautious hope',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'threshold-decision',
    castKo: '혼자'
  },
  {
    id: 'kr2030-old-friend-table',
    labelKo: '오래된 친구와의 술자리',
    scene: 'sitting across an old friend at a late-night table, catching up on everything that changed since school',
    emotionalArc: 'initial awkwardness warming into easy familiarity',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'two-people-talk',
    castKo: '둘'
  },
  {
    id: 'kr2030-fresh-start-morning',
    labelKo: '다시 시작하는 아침',
    scene: 'packing a bag for a fresh start, leaving an old apartment behind on a bright ordinary morning',
    emotionalArc: 'nervous uncertainty turning into determined hope',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'threshold-decision',
    castKo: '혼자'
  },
  {
    id: 'kr2030-summer-night-drive',
    labelKo: '여름밤 드라이브',
    scene: 'driving along the river at night in summer with the windows cracked, city lights streaming past',
    emotionalArc: 'restless energy easing into open-hearted calm',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'night-drive',
    motionKo: '이동 중(드라이브)',
    castKo: '둘'
  },
  {
    id: 'kr2030-ordinary-hard-day',
    labelKo: '힘들지만 버티는 하루',
    scene: "coming home after a hard, ordinary day at work and just sitting on the floor for a while before doing anything else",
    emotionalArc: 'numb fatigue giving way to quiet self-compassion',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'solitary-room',
    castKo: '혼자'
  },
  {
    id: 'kr2030-dawn-cafe-alone',
    labelKo: '새벽 카페, 혼자',
    scene: 'sitting alone in a 24-hour cafe before dawn, laptop closed, watching the street slowly wake up outside',
    emotionalArc: 'restless insomnia settling into unexpected peace',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'solitary-room',
    castKo: '혼자'
  },
  {
    id: 'kr2030-last-subway-thoughts',
    labelKo: '지하철 막차 생각',
    scene: "catching the last subway train home, the car nearly empty, replaying the day's conversations in silence",
    emotionalArc: 'replayed regret loosening into forward-looking resolve',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'commute-transit',
    motionKo: '이동 중(지하철)',
    castKo: '혼자'
  },
  {
    id: 'kr2030-studio-apartment-glow',
    labelKo: '원룸 조명 아래',
    scene: 'sitting under the one warm lamp in a small studio apartment on an ordinary weeknight, takeout containers on the table',
    emotionalArc: 'isolation softening into contented independence',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'solitary-room',
    castKo: '혼자'
  },
  {
    id: 'kr2030-alley-neon-walk',
    labelKo: '서울 골목 네온',
    scene: 'walking a narrow Seoul alley at night past convenience-store light and stacked delivery bikes, heading nowhere in particular',
    emotionalArc: 'aimless drifting opening into unexpected clarity',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'commute-transit',
    motionKo: '이동 중',
    castKo: '혼자'
  },
  {
    id: 'kr2030-subtle-almost-love',
    labelKo: '애매한 썸의 감정',
    scene: "texting back and forth with someone late at night, both circling a feeling neither has said out loud yet",
    emotionalArc: 'cautious hesitation building into nervous excitement',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'two-people-talk',
    castKo: '둘'
  },
  {
    id: 'kr2030-breakup-recovery',
    labelKo: '이별 후 회복',
    scene: 'deleting old photos from a phone one by one, months after a breakup, in a room that finally feels like just yours again',
    emotionalArc: 'lingering grief resolving into steady self-respect',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'reunion-passing',
    castKo: '혼자'
  },
  {
    id: 'kr2030-old-digital-diary-nostalgia',
    labelKo: '싸이월드·MP3 시절 회상',
    scene: 'opening an old personal web diary and a downloaded mp3 playlist saved from teenage years, a private photo mood board nobody else ever saw',
    emotionalArc: 'surprised nostalgia softening into fond amusement',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'screen-memory',
    castKo: '혼자'
  },
  {
    id: 'kr2030-face-to-face-confession',
    labelKo: '마주앉아 고백하는 순간',
    scene: "sitting face to face with someone and finally saying the thing that's been held back for weeks",
    emotionalArc: 'nervous tension releasing into relieved honesty',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'two-people-talk',
    castKo: '둘'
  },
  {
    id: 'kr2030-crowded-dinner-alone',
    labelKo: '회식 자리에서 혼자인 느낌',
    scene: 'sitting at a loud company dinner table full of coworkers, smiling along while feeling completely apart from the noise',
    emotionalArc: 'social isolation easing into quiet self-possession',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'crowd-alone',
    castKo: '여럿'
  },
  {
    id: 'kr2030-passing-glance-stranger',
    labelKo: '스쳐 지나간 그 사람',
    scene: 'catching eyes for a second with a stranger on a crowded crosswalk, then losing them in the crowd before either can react',
    emotionalArc: 'fleeting curiosity fading into wistful what-if',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'reunion-passing',
    castKo: '둘'
  },
  {
    id: 'kr2030-quitting-job-decision',
    labelKo: '퇴사를 고민하는 밤',
    scene: "staying late at an empty office, cursor hovering over a resignation email that still isn't sent",
    emotionalArc: 'paralyzed indecision tipping into quiet resolve',
    suitedArchetypes: ['kr-2030-pop'],
    frameId: 'threshold-decision',
    castKo: '혼자'
  },
  // 지시문 14 (Phase 2 TASK B) — 28 new entries, 18 -> 46. Deliberately
  // avoids the 6 families §B-3 names as already-covered in the existing 18
  // above (phone/message x2, rain/umbrella x2, subway/last-train x1,
  // cafe-alone x1, rooftop/city-light x1, social-media-memory x1) — new
  // material only (gym, moving, market, hospital, reunion, ...).
  {
    id: 'kr2030-gym-after-work',
    labelKo: '퇴근 후 헬스장',
    scene: 'lacing up gym shoes after a long workday and forcing one more set before the lights dim',
    emotionalArc: 'drained resistance turning into hard-earned relief',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-grocery-run-solo-cart',
    labelKo: '혼자 장보는 저녁',
    scene: 'pushing a half-empty cart through a late-night grocery aisle while deciding on dinner for one',
    emotionalArc: 'quiet loneliness settling into simple self-care',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-moving-boxes-new-apartment',
    labelKo: '새 자취방 이삿짐',
    scene: 'unpacking the last taped box in an empty new apartment as evening light crosses the bare floor',
    emotionalArc: 'overwhelmed exhaustion turning into proud independence',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-elevator-neighbor-small-talk',
    labelKo: '엘리베이터 이웃 인사',
    scene: 'trading a brief nod with a neighbor in a slow elevator ride up to a familiar floor',
    emotionalArc: 'awkward silence softening into small comfort',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-laundromat-spin-cycle-wait',
    labelKo: '빨래방 건조기 기다림',
    scene: 'watching a laundromat dryer spin through the window while scrolling through nothing in particular',
    emotionalArc: 'idle boredom settling into unexpected peace',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-bookstore-corner-reading',
    labelKo: '서점 구석 독서',
    scene: 'sitting on the floor of a bookstore corner finishing one more chapter before closing time',
    emotionalArc: 'restless week quieting into absorbed calm',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-flea-market-weekend-stall',
    labelKo: '주말 플리마켓',
    scene: 'arranging secondhand finds on a folding table at a weekend flea market under uncertain skies',
    emotionalArc: 'nervous first-timer energy becoming proud ownership',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-terrace-summer-grill-friends',
    labelKo: '여름 테라스 바비큐',
    scene: 'flipping skewers on a small terrace grill while friends laugh around a folding table',
    emotionalArc: 'work fatigue melting into easy belonging',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-carwash-waiting-bench',
    labelKo: '세차장 대기 벤치',
    scene: 'sitting on a car wash waiting bench watching foam slide down the windshield in slow arcs',
    emotionalArc: 'restless waiting settling into unplanned stillness',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-new-gym-membership-day',
    labelKo: '헬스장 첫 등록',
    scene: 'signing a gym membership form with a mix of resolve and quiet doubt about keeping the promise',
    emotionalArc: 'hesitant resolve steadying into determined intent',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-coworker-lunch-vent',
    labelKo: '점심시간 동료와 하소연',
    scene: 'stirring a bowl of noodles across from a coworker trading quiet complaints about the same manager',
    emotionalArc: 'shared frustration turning into relieved laughter',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-hiking-trail-sunrise',
    labelKo: '새벽 등산 일출',
    scene: 'catching a breath at a trail overlook just as the sunrise clears the ridge line',
    emotionalArc: 'burning legs forgotten in a wide grateful view',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-balcony-plant-watering',
    labelKo: '발코니 화분 물주기',
    scene: 'watering a small balcony plant before work and noticing one new leaf has finally opened',
    emotionalArc: 'routine chore becoming quiet unexpected pride',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-karaoke-solo-stress-release',
    labelKo: '혼자 코인노래방',
    scene: 'stepping into an empty coin karaoke booth alone to sing out one whole bad week',
    emotionalArc: 'bottled tension breaking into cathartic release',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-job-interview-waiting-room',
    labelKo: '면접 대기실',
    scene: 'straightening a blazer in a company waiting room while rehearsing one answer one more time',
    emotionalArc: 'sharp nerves steadying into quiet self-belief',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-moving-truck-goodbye',
    labelKo: '이사트럭 앞 작별',
    scene: 'waving off a moving truck outside an old building as a chapter of the neighborhood closes',
    emotionalArc: 'nostalgic ache opening into hopeful anticipation',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-close-friend-wedding',
    labelKo: '친한 친구의 결혼식',
    scene: "catching a bouquet toss at a close friend's wedding and laughing through unexpected tears",
    emotionalArc: 'bittersweet joy resolving into full-hearted happiness',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-hospital-waiting-room-worry',
    labelKo: '병원 대기실',
    scene: "sitting stiffly in a hospital waiting room chair, refreshing a phone for news that hasn't come yet",
    emotionalArc: 'anxious stillness easing at the sound of good news',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-neighborhood-cat-feeding',
    labelKo: '동네 고양이 밥 주기',
    scene: 'setting out a small bowl for a neighborhood cat that waits by the same wall every evening',
    emotionalArc: 'lonely routine turning into quiet companionship',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-gym-locker-pep-talk',
    labelKo: '헬스장 락커룸 다짐',
    scene: 'catching a tired reflection in a gym locker mirror and deciding to stay five more minutes',
    emotionalArc: 'low motivation flickering back into stubborn resolve',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-potted-plant-new-home',
    labelKo: '새집의 첫 화분',
    scene: 'setting one small potted plant on an empty new windowsill to make the space finally feel like home',
    emotionalArc: 'bare unfamiliarity softening into a sense of home',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-early-bus-stop-coffee',
    labelKo: '이른 버스정류장 커피',
    scene: 'holding a paper coffee cup at an empty bus stop before the first commuters arrive',
    emotionalArc: 'sleepy dread easing into a quiet private moment',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-secondhand-furniture-pickup',
    labelKo: '중고가구 픽업',
    scene: 'loading a secondhand desk into the trunk of a borrowed car for a first real apartment',
    emotionalArc: 'clumsy effort turning into satisfied accomplishment',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-class-reunion-nerves',
    labelKo: '동창회 앞 긴장',
    scene: 'straightening an outfit in a car mirror outside a class reunion, unsure how much has really changed',
    emotionalArc: 'anxious comparison dissolving into easy old familiarity',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-solo-movie-theater-seat',
    labelKo: '혼자 보는 심야영화',
    scene: 'settling into an empty midweek theater row alone with popcorn and no one to explain the plot to',
    emotionalArc: 'self-conscious solitude becoming guilt-free enjoyment',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-credit-card-bill-kitchen-table',
    labelKo: '식탁 위 카드값',
    scene: 'staring at a credit card statement at the kitchen table and doing quiet math with a tired sigh',
    emotionalArc: 'financial dread settling into practical resolve',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-new-year-resolution-list',
    labelKo: '새해 다짐 목록',
    scene: 'writing a new year resolution list at a kitchen table with a candle burned down to its last hour',
    emotionalArc: 'familiar self-doubt opening into fresh determination',
    suitedArchetypes: ['kr-2030-pop']
  },
  {
    id: 'kr2030-office-after-hours-empty-desk',
    labelKo: '야근 후 텅 빈 사무실',
    scene: 'turning off the last desk lamp in an empty office after a long overtime stretch',
    emotionalArc: 'draining exhaustion settling into quiet self-respect',
    suitedArchetypes: ['kr-2030-pop']
  },
  // TASK C2 — jp-2030 workspace's 18 lyric scenes. Deliberately Reiwa-era
  // 20s/30s life (seasonal turning points, inner monologue, a narrative arc
  // toward something, school/graduation memory, idol-pop self-affirmation,
  // late-night city-pop solitude), never the senior/showa vocabulary above
  // (this workspace's own doc's §0-3 ⑤ whitelist check: no record player,
  // kettle, photo album, folded letter, candle, calendar, wool cardigan,
  // kitchen radio from the senior dictionary; no vintage stereo console,
  // rotary telephone, neon sign, street lamp, typewriter, film camera,
  // sepia tone, vinyl-era, showa-era kissaten, old Tokyo from the showa-cafe
  // dictionary; no grandchildren/long marriage/decades ago). suitedArchetypes
  // is 'jp-2030-pop' ONLY on every entry — fewer than 12 of these would
  // silently fall back to the 80-entry senior/showa/j2000s pool above (same
  // lyricThemesForArchetype threshold kr-2030's own comment explains).
  // frameId spans 9 distinct shapes (seasonal-marker x3, inner-monologue x3,
  // narrative-arc x3, self-affirmation x3, parallel-world x2, school-memory
  // x1, festival-crowd x1, solitary-room x1, night-drive x1) — only
  // solitary-room and night-drive overlap kr-2030's own 8 frames above (2 of
  // 4 allowed), so the Korean/Japanese frame axis genuinely diverges per
  // this workspace's own §3-3 contrast requirement.
  {
    id: 'jp2030-graduation-farewell',
    labelKo: '졸업식 이별',
    scene: 'standing in a school gymnasium during a graduation ceremony, classmates crying and laughing at the same time, the future suddenly feeling real',
    emotionalArc: 'bittersweet farewell opening into hopeful resolve',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'school-memory',
    castKo: '여럿'
  },
  {
    id: 'jp2030-summer-festival-crowd',
    labelKo: '여름 축제의 인파',
    scene: 'walking through a summer festival crowd in a yukata, fireworks bursting overhead, losing a friend in the crowd for just a second',
    emotionalArc: 'excited anticipation building into pure joy',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'festival-crowd',
    castKo: '여럿'
  },
  {
    id: 'jp2030-cherry-blossom-goodbye',
    labelKo: '벚꽃 아래의 작별',
    scene: 'walking beneath falling cherry blossoms on the last day before moving to a new city, a close friend walking silently alongside',
    emotionalArc: 'quiet sadness softening into grateful hope',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'seasonal-marker',
    castKo: '둘'
  },
  {
    id: 'jp2030-autumn-leaves-solo-walk',
    labelKo: '단풍길 혼자 걷기',
    scene: 'walking alone down a path lined with turning autumn leaves after a long week, breath visible in the cool evening air',
    emotionalArc: 'tired numbness easing into calm clarity',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'seasonal-marker',
    castKo: '혼자'
  },
  {
    id: 'jp2030-first-snow-wish',
    labelKo: '첫눈에 비는 소원',
    scene: 'watching the first snow of the year fall outside a train window, making a small private wish before the doors open',
    emotionalArc: 'quiet longing lifting into fragile hope',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'seasonal-marker',
    castKo: '혼자'
  },
  {
    id: 'jp2030-unreachable-voice',
    labelKo: '닿지 않는 목소리',
    scene: 'trying to call out to someone who is already walking away across a crowded platform, the words never quite reaching',
    emotionalArc: 'helpless longing tightening into determined resolve',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'parallel-world',
    castKo: '둘'
  },
  {
    id: 'jp2030-parallel-life-what-if',
    labelKo: '평행세계의 나',
    scene: 'imagining a parallel version of life where a different choice was made at a fork in the road years ago',
    emotionalArc: 'wistful regret settling into acceptance of the chosen path',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'parallel-world',
    castKo: '혼자'
  },
  {
    id: 'jp2030-inner-monologue-midnight',
    labelKo: '한밤의 혼잣말',
    scene: 'lying awake at midnight, quietly talking through unresolved feelings that were never said out loud to anyone',
    emotionalArc: 'restless overthinking settling into honest self-understanding',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'inner-monologue',
    castKo: '혼자'
  },
  {
    id: 'jp2030-confession-to-the-mirror',
    labelKo: '거울 앞의 고백 연습',
    scene: 'standing in front of a mirror rehearsing words that need to be said to someone tomorrow, voice barely above a whisper',
    emotionalArc: 'nervous hesitation firming into quiet courage',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'inner-monologue',
    castKo: '혼자'
  },
  {
    id: 'jp2030-diary-page-unsent',
    labelKo: '부치지 못한 마음의 페이지',
    scene: 'writing feelings into a personal notebook that will never actually be shown to the person they are about',
    emotionalArc: 'private longing accepted with gentle resignation',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'inner-monologue',
    castKo: '혼자'
  },
  {
    id: 'jp2030-determined-stage-entrance',
    labelKo: '무대로 향하는 결심',
    scene: 'standing backstage moments before stepping into the spotlight, heart pounding, deciding to give everything this one time',
    emotionalArc: 'nervous fear transforming into fierce determination',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'narrative-arc',
    castKo: '혼자'
  },
  {
    id: 'jp2030-getting-back-up',
    labelKo: '다시 일어서는 순간',
    scene: 'picking yourself back up after a public failure, lacing up shoes again the next morning despite everyone watching',
    emotionalArc: 'humiliated defeat rebuilding into stubborn resolve',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'narrative-arc',
    castKo: '혼자'
  },
  {
    id: 'jp2030-forward-to-tomorrow',
    labelKo: '내일을 향해 걷기',
    scene: 'walking toward a train station at sunrise with a suitcase, leaving a familiar town behind to chase something uncertain',
    emotionalArc: 'anxious uncertainty steadying into forward-looking courage',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'narrative-arc',
    motionKo: '이동 중(도보)',
    castKo: '혼자'
  },
  {
    id: 'jp2030-just-as-i-am',
    labelKo: '있는 그대로의 나',
    scene: 'deciding to stop hiding an awkward laugh or a strange hobby in front of new classmates, and finding it actually goes fine',
    emotionalArc: 'anxious self-consciousness relaxing into easy confidence',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'self-affirmation',
    castKo: '여럿'
  },
  {
    id: 'jp2030-okay-to-mess-up',
    labelKo: '실수해도 괜찮아',
    scene: 'tripping over the words during a class presentation and laughing it off with classmates instead of shrinking away',
    emotionalArc: 'embarrassed panic dissolving into shared laughter and relief',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'self-affirmation',
    castKo: '여럿'
  },
  {
    id: 'jp2030-todays-main-character',
    labelKo: '오늘은 내가 주인공',
    scene: 'getting ready for an ordinary Saturday and deciding, just for today, to walk through it like the main character of the story',
    emotionalArc: 'small self-doubt flipping into playful self-belief',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'self-affirmation',
    castKo: '혼자'
  },
  {
    id: 'jp2030-late-night-convenience-store',
    labelKo: '새벽 편의점',
    scene: 'standing under the fluorescent lights of an all-night convenience store at 3am, the town outside completely silent',
    emotionalArc: 'quiet isolation settling into a strange, comfortable peace',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'solitary-room',
    castKo: '혼자'
  },
  {
    id: 'jp2030-coastal-highway-drive',
    labelKo: '바닷가 국도 드라이브',
    scene: 'driving an empty coastal highway before dawn with the windows down, the sea just barely visible in the dark',
    emotionalArc: 'restless energy opening into wide, unhurried freedom',
    suitedArchetypes: ['jp-2030-pop'],
    frameId: 'night-drive',
    motionKo: '이동 중(드라이브)',
    castKo: '둘'
  },
  // 지시문 14 (Phase 2 TASK B) — 28 new entries, 18 -> 46. Avoids the same 6
  // shared "2030" families §B-3 names (phone/message, rain/umbrella,
  // subway/last-train, cafe-alone, rooftop/city-light, social-media-memory)
  // AND every already-covered jp2030 family above (graduation/festival/
  // cherry-blossom/autumn-leaves/first-snow/mirror-confession/diary/
  // stage-entrance/convenience-store/highway-drive).
  {
    id: 'jp2030-new-job-first-day',
    labelKo: '입사 첫날',
    scene: 'straightening a new work badge in an elevator mirror on the first morning at a new company',
    emotionalArc: 'stiff nervous formality loosening into a private hopeful smile',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-moving-to-city-alone',
    labelKo: '상경 첫날',
    scene: 'unlocking a tiny first apartment door alone in an unfamiliar city and setting one box down',
    emotionalArc: 'overwhelming unfamiliarity settling into quiet resolve',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-new-year-shrine-wish',
    labelKo: '새해 소원 신사참배',
    scene: 'writing a wish on a small wooden ema plaque at a crowded New Year shrine visit',
    emotionalArc: 'crowded noise narrowing into one private hope',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-summer-pool-friends-splash',
    labelKo: '여름 수영장 친구들',
    scene: 'splashing through a public pool with old friends on the one free weekend all summer',
    emotionalArc: 'work-weary stiffness melting into carefree laughter',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-izakaya-after-work-toast',
    labelKo: '퇴근 후 이자카야 건배',
    scene: 'clinking a small glass with coworkers at a crowded izakaya table after a hard week',
    emotionalArc: 'bottled exhaustion breaking into warm relief',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-morning-jog-riverside',
    labelKo: '아침 강변 조깅',
    scene: 'running along a quiet riverside path before sunrise with breath fogging in the cool air',
    emotionalArc: 'restless anxiety burning off into clear-headed calm',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-department-store-gift-wrap',
    labelKo: '백화점 선물포장',
    scene: 'watching a department store clerk fold careful gift wrap corners for a birthday present',
    emotionalArc: 'rushed errand slowing into thoughtful anticipation',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-old-classmate-chance-meeting',
    labelKo: '우연히 만난 동창',
    scene: 'recognizing an old classmate across a crowded crosswalk and hesitating before calling out',
    emotionalArc: 'startled hesitation opening into warm recognition',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-solo-ramen-counter-seat',
    labelKo: '혼밥 라멘집 카운터',
    scene: 'slurping a late bowl of ramen alone at a counter seat after a long shift',
    emotionalArc: 'tired solitude softening into simple contentment',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-summer-yukata-friends-walk',
    labelKo: '여름 유카타 산책',
    scene: 'walking in a borrowed yukata with friends toward distant festival drums',
    emotionalArc: 'giddy anticipation building into shared excitement',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-resignation-letter-desk',
    labelKo: '사직서 앞에서',
    scene: 'folding a handwritten resignation letter at an empty desk after the office lights go down',
    emotionalArc: 'anxious uncertainty steadying into brave resolve',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-mountain-cable-car-view',
    labelKo: '케이블카에서 본 풍경',
    scene: 'riding a mountain cable car above the clouds on a rare day off from work',
    emotionalArc: 'flat routine lifting into wide-eyed wonder',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-cooking-class-first-attempt',
    labelKo: '첫 요리교실',
    scene: 'burning the first attempt at a recipe in a beginner cooking class and laughing it off with a stranger nearby',
    emotionalArc: 'embarrassed fumbling turning into easy new friendship',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-summer-obon-hometown-return',
    labelKo: '오봉 고향 방문',
    scene: 'stepping off a crowded obon-season train back to a quiet hometown platform',
    emotionalArc: 'big-city fatigue dissolving into familiar warmth',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-night-shift-vending-machine-break',
    labelKo: '야간근무 자판기 휴식',
    scene: 'leaning against a vending machine during a short night-shift break with the city silent outside',
    emotionalArc: 'grinding fatigue softening into a private steady moment',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-matchmaking-park-bench-nerves',
    labelKo: '소개팅 공원 벤치',
    scene: 'sitting stiffly on a park bench for a first arranged meeting, unsure where to look',
    emotionalArc: 'stiff formality relaxing into an easy real conversation',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-company-trip-hot-spring',
    labelKo: '회사여행 온천',
    scene: 'soaking in an outdoor hot spring during a company retreat, finally letting the whole week go',
    emotionalArc: 'tense professional posture dissolving into total relaxation',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-apartment-hunting-empty-room',
    labelKo: '빈 방 부동산 투어',
    scene: 'standing in an empty rental room during a real estate viewing, imagining furniture that isn\'t there yet',
    emotionalArc: 'blank uncertainty filling with quiet hopeful possibility',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-bicycle-commute-crossing',
    labelKo: '자전거 출근길',
    scene: 'pedaling a commuter bicycle through a familiar intersection just as the morning light turns gold',
    emotionalArc: 'sluggish morning waking into a bright steady rhythm',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-desk-lunch-bento-break',
    labelKo: '사무실 도시락 점심',
    scene: 'unwrapping a homemade bento at a desk during a short lunch break between meetings',
    emotionalArc: 'busy pressure pausing into a small grounding comfort',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-morning-market-fish-stall',
    labelKo: '아침 어시장',
    scene: 'wandering an early morning fish market with steam rising off fresh catch stalls',
    emotionalArc: 'sleepy disorientation waking into vivid sensory delight',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-typing-cover-letter-midnight',
    labelKo: '자소서 쓰는 밤',
    scene: 'typing and deleting the same cover letter line past midnight before a job application deadline',
    emotionalArc: 'circling self-doubt narrowing into one honest sentence',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-city-bike-share-return',
    labelKo: '공유자전거 반납',
    scene: 'docking a shared city bicycle at a station just as the evening crowd starts to thin',
    emotionalArc: 'rushed commute settling into an unhurried walk home',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-summer-internship-last-day',
    labelKo: '인턴 마지막 날',
    scene: 'clearing out a small desk on the last day of a summer internship, business cards tucked carefully away',
    emotionalArc: 'temporary belonging closing into hopeful ambition',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-birthday-solo-candle-apartment',
    labelKo: '혼자 보내는 생일',
    scene: 'lighting one candle on a small store-bought cake alone in a quiet apartment on a birthday',
    emotionalArc: 'quiet loneliness turning into deliberate self-celebration',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-team-project-deadline-office',
    labelKo: '팀 프로젝트 마감',
    scene: 'stapling the final page of a team project together minutes before a deadline with coworkers cheering quietly',
    emotionalArc: 'frantic pressure collapsing into relieved teamwork',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-summer-beach-trip-friends',
    labelKo: '여름 바다 여행',
    scene: 'kicking off sandals to run into cold morning waves on a spontaneous beach trip with old friends',
    emotionalArc: 'stale routine breaking wide open into pure joy',
    suitedArchetypes: ['jp-2030-pop']
  },
  {
    id: 'jp2030-winter-illumination-street-walk',
    labelKo: '겨울 일루미네이션 거리',
    scene: 'walking slowly under a winter illumination display, breath visible in the cold bright air',
    emotionalArc: 'quiet solitary chill warming into wide-eyed wonder',
    suitedArchetypes: ['jp-2030-pop']
  },
  // TASK K2 §7 — kr-idol-male's 18 lyric scenes. §7-2's own explicit
  // prohibitions: no senior-register imagery (회상/그리움/쓸쓸함/오래된 사물),
  // no kids vocabulary, and no reuse of kr2030's own scenes (퇴근길/서른/
  // 원룸/막차) — the whole point of a separate idol scene set is that this
  // workspace reads as stage/performance/declarative, not "생활인의 하루"
  // the way kr2030 does. frameId vocabulary is deliberately idol-specific
  // (stage-declaration/backstage-before/chase-focus/crew-together/
  // night-city-move/turning-point/rehearsal-grind/comeback-countdown/
  // crossed-paths/promise-made per §7-3's own example list) — 0 overlap
  // with kr2030's own 18 frameIds, well under the "≤4" ceiling.
  {
    id: 'kridol-stage-confidence',
    labelKo: '무대 위의 확신',
    scene: 'standing center stage under bright lights just before the beat drops, feeling every hour of rehearsal pay off in this one moment',
    emotionalArc: 'nervous anticipation snapping into full confidence',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'stage-declaration',
    castKo: '혼자'
  },
  {
    id: 'kridol-limit-break',
    labelKo: '한계를 넘는 순간',
    scene: 'pushing through the final chorus of a brutal dance break, body exhausted but the voice getting louder instead of weaker',
    emotionalArc: 'physical limit turning into a surge of defiant strength',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'turning-point',
    castKo: '혼자'
  },
  {
    id: 'kridol-our-own-path',
    labelKo: '우리가 만든 길',
    scene: 'standing together backstage after a hard-won win, realizing no one handed this path to them, they built it themselves',
    emotionalArc: 'quiet disbelief settling into shared pride',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'crew-together',
    castKo: '여럿'
  },
  {
    id: 'kridol-comeback-countdown',
    labelKo: '컴백 직전의 긴장',
    scene: 'standing backstage in the dark seconds before the curtain rises on a comeback stage, the crowd noise building on the other side',
    emotionalArc: 'tight nervous tension resolving into ready focus',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'backstage-before',
    castKo: '여럿'
  },
  {
    id: 'kridol-only-you-in-the-room',
    labelKo: '한 사람만 보이는 상태',
    scene: 'scanning a crowded room and somehow only seeing one face clearly, everything else blurring into the background',
    emotionalArc: 'scattered distraction narrowing into single-minded focus',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'chase-focus',
    castKo: '혼자'
  },
  {
    id: 'kridol-late-night-thought',
    labelKo: '밤새 붙잡은 생각',
    scene: 'lying awake in a tour-bus bunk long after everyone else has gone quiet, unable to stop replaying one conversation',
    emotionalArc: 'restless overthinking settling into quiet resolve',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'night-city-move',
    motionKo: '이동 중(투어버스)',
    castKo: '혼자'
  },
  {
    id: 'kridol-practice-room-mirror',
    labelKo: '연습실 거울 앞에서',
    scene: 'staring into a practice-room mirror well after midnight, running the same eight-count over and over until it finally clicks',
    emotionalArc: 'stubborn frustration turning into hard-won satisfaction',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'rehearsal-grind',
    castKo: '혼자'
  },
  {
    id: 'kridol-trainee-then-now',
    labelKo: '연습생 시절과 지금',
    scene: 'passing the same practice-room door years later and remembering exactly how nervous that very first day felt',
    emotionalArc: 'nostalgic vulnerability turning into grounded confidence',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'turning-point',
    castKo: '혼자'
  },
  {
    id: 'kridol-first-fan-letter',
    labelKo: '첫 팬레터를 읽은 순간',
    scene: 'reading a handwritten letter from the very first fan before a show, remembering exactly why any of this started',
    emotionalArc: 'private doubt melting into quiet gratitude',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'promise-made',
    castKo: '혼자'
  },
  {
    id: 'kridol-almost-said-it',
    labelKo: '고백 직전',
    scene: 'standing at a doorway with the right words finally ready, and losing the nerve in the very last second before saying them',
    emotionalArc: 'building courage collapsing into hesitant silence',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'chase-focus',
    castKo: '둘'
  },
  {
    id: 'kridol-crossed-signals',
    labelKo: '엇갈림',
    scene: 'waving from opposite platforms as two trains pull out in different directions at exactly the same moment',
    emotionalArc: 'sudden ache settling into wistful acceptance',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'crossed-paths',
    motionKo: '이동 중(플랫폼)',
    castKo: '둘'
  },
  {
    id: 'kridol-wish-i-could-take-it-back',
    labelKo: '되돌리고 싶은 말',
    scene: 'replaying one careless sentence from a fight on a loop, wishing there were any way to unsay it',
    emotionalArc: 'sharp regret softening into the resolve to make it right',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'crossed-paths',
    castKo: '둘'
  },
  {
    id: 'kridol-airport-goodbye',
    labelKo: '공항에서의 인사',
    scene: 'waving through a departure-gate glass wall, mouthing a promise to call the second the plane lands',
    emotionalArc: 'reluctant goodbye turning into determined anticipation',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'crossed-paths',
    motionKo: '이동 중(공항)',
    castKo: '둘'
  },
  {
    id: 'kridol-tour-bus-window',
    labelKo: '차 안에서 보는 도시',
    scene: 'watching an unfamiliar city skyline blur past a tour-van window at 3am, half the group already asleep',
    emotionalArc: 'quiet exhaustion opening into wide-eyed wonder',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'night-city-move',
    motionKo: '이동 중(투어버스)',
    castKo: '여럿'
  },
  {
    id: 'kridol-rooftop-before-dawn',
    labelKo: '새벽 옥상',
    scene: 'standing on a rooftop before sunrise after a long show, the whole city finally quiet below',
    emotionalArc: 'drained adrenaline settling into peaceful stillness',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'backstage-before',
    castKo: '혼자'
  },
  {
    id: 'kridol-crew-in-formation',
    labelKo: '함께 맞춘 동작',
    scene: 'locking into the exact same movement as the rest of the line during a full run-through, feeling the sync click into place',
    emotionalArc: 'individual effort dissolving into collective momentum',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'crew-together',
    castKo: '여럿'
  },
  {
    id: 'kridol-debut-day-nerves',
    labelKo: '데뷔 무대 앞에서',
    scene: 'standing in the wings on debut night, hearing the crowd for the very first time and feeling the ground shift underfoot',
    emotionalArc: 'overwhelming nerves crystallizing into pure resolve',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'stage-declaration',
    castKo: '여럿'
  },
  {
    id: 'kridol-promise-to-the-crowd',
    labelKo: '관객에게 하는 약속',
    scene: 'pointing out at the crowd during the final chorus, mouthing a promise to come back to this exact stage',
    emotionalArc: 'triumphant energy settling into a sincere vow',
    suitedArchetypes: ['kr-idol-male'],
    frameId: 'promise-made',
    castKo: '혼자'
  },
  // 지시문 14 (Phase 2 TASK B) — 28 new entries, 18 -> 46. Avoids the 6
  // K-pop families §B-3 names as already-covered (spotlight-stage,
  // mirror-self-image, fire-rise, crown-throne, night-city-neon,
  // run-fly-break-wall) and every already-covered concept from the 18
  // above (limit-break/comeback/trainee/fan-letter/crossed-signals/
  // regret/airport/tour-bus/rooftop/formation/debut/promise).
  {
    id: 'kridol-dance-battle-rehearsal',
    labelKo: '연습실 댄스 배틀',
    scene: 'trading turns in a friendly dance battle during a late rehearsal, laughing between competitive rounds',
    emotionalArc: 'playful rivalry deepening into real mutual respect',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-recording-booth-vocal-take',
    labelKo: '녹음부스 마지막 테이크',
    scene: 'nailing the exact right take in a recording booth after a dozen close misses',
    emotionalArc: 'frustrated repetition breaking into pure satisfaction',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-fan-meeting-handshake-line',
    labelKo: '팬미팅 악수줄',
    scene: "holding a fan's hand for one brief second at a meeting line and remembering every face after",
    emotionalArc: 'routine greeting deepening into genuine connection',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-mv-set-waiting-between-takes',
    labelKo: '뮤비 촬영 대기',
    scene: 'sitting under a heat lamp between music video takes while the crew resets the same shot again',
    emotionalArc: 'restless waiting settling into focused readiness',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-award-show-backstage-nerves',
    labelKo: '시상식 백스테이지 긴장',
    scene: 'straightening a jacket backstage at an award show while a category winner is announced through the wall',
    emotionalArc: 'held-breath tension releasing into stunned gratitude',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-group-chat-late-night-support',
    labelKo: '새벽 단톡방 응원',
    scene: "reading encouraging messages from the members' group chat at 3am before a hard day",
    emotionalArc: 'isolated worry dissolving into felt solidarity',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-hometown-visit-after-fame',
    labelKo: '데뷔 후 고향 방문',
    scene: 'walking the same childhood street now recognized by neighbors who used to just wave',
    emotionalArc: 'strange new fame settling into grounded gratitude',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-injury-recovery-determination',
    labelKo: '부상 재활 훈련',
    scene: 'pushing through a slow physical therapy session, counting down the days back to the stage',
    emotionalArc: 'frustrated setback hardening into stubborn determination',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-songwriting-studio-3am',
    labelKo: '새벽 3시 작업실',
    scene: 'scribbling one more lyric line alone in a small studio long after everyone else has gone home',
    emotionalArc: 'creative frustration breaking open into a real breakthrough',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-photo-shoot-between-takes',
    labelKo: '화보 촬영 사이',
    scene: 'catching a breath between wardrobe changes at a photo shoot, joking quietly with the stylist',
    emotionalArc: 'stiff posing tension loosening into an easy natural smile',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-tour-bus-card-games',
    labelKo: '투어버스 카드게임',
    scene: 'losing badly at cards on a long overnight tour bus ride while everyone else laughs',
    emotionalArc: 'travel fatigue turning into warm shared laughter',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-member-birthday-surprise',
    labelKo: '멤버 생일 서프라이즈',
    scene: 'sneaking a small cake into the dorm kitchen to surprise a member right at midnight',
    emotionalArc: 'quiet planning bursting into a loud shared celebration',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-overseas-interview-lost-in-translation',
    labelKo: '해외 인터뷰 통역',
    scene: 'fumbling through an overseas interview question before a translator steps in with a laugh',
    emotionalArc: 'flustered embarrassment turning into good-natured relief',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-contract-signing-day',
    labelKo: '계약서 서명하는 날',
    scene: 'signing a new contract page by page at a long table, hand steadier than expected',
    emotionalArc: 'quiet nerves settling into serious, grounded commitment',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-childhood-bedroom-poster',
    labelKo: '어릴 적 방 안 포스터',
    scene: 'finding an old poster of a favorite idol still taped inside a childhood bedroom closet',
    emotionalArc: 'nostalgic distance collapsing into full-circle disbelief',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-sold-out-arena-empty-morning',
    labelKo: '매진된 경기장의 아침',
    scene: 'standing alone on an empty arena stage the morning before a sold-out show that night',
    emotionalArc: 'quiet solitary awe steadying into focused calm',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-costume-fitting-room',
    labelKo: '무대 의상 가봉실',
    scene: 'standing still for pins and measurements in a costume fitting room before a comeback',
    emotionalArc: 'restless impatience settling into anticipatory excitement',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-radio-interview-booth',
    labelKo: '라디오 부스 인터뷰',
    scene: 'leaning into a radio booth microphone to answer a question live, hearing the callback in real time',
    emotionalArc: 'careful composure loosening into an honest laugh',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-fansign-event-nerves',
    labelKo: '팬사인회 앞 긴장',
    scene: 'practicing one signature over and over backstage before a long fan-sign line begins',
    emotionalArc: 'repetitive nerves settling into warm readiness',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-group-huddle-before-entrance',
    labelKo: '입장 전 그룹 허들',
    scene: 'pulling into a tight huddle with the whole group seconds before walking out to the stage',
    emotionalArc: 'scattered individual nerves fusing into one shared pulse',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-late-night-convenience-run',
    labelKo: '늦은 밤 편의점 습격',
    scene: 'raiding a convenience store together at 2am still in stage makeup after a long show',
    emotionalArc: 'post-show adrenaline settling into easy off-duty joy',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-dorm-late-night-talk',
    labelKo: '숙소 밤샘 대화',
    scene: 'talking quietly on a dorm room floor long after lights-out about where this path might lead',
    emotionalArc: 'private uncertainty easing into trusted companionship',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-broken-shoe-stage-recovery',
    labelKo: '무대 위 신발 사고 수습',
    scene: 'catching a stumble mid-performance when a shoe strap snaps, recovering the choreography without missing a beat',
    emotionalArc: 'sudden panic mastered into unshaken professionalism',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-hate-comments-scroll-doubt',
    labelKo: '악플 스크롤',
    scene: 'scrolling past one cruel comment too many late at night before closing the phone for good',
    emotionalArc: 'creeping self-doubt hardening into deliberate self-protection',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-training-center-hallway-walk',
    labelKo: '연습생 시절 복도',
    scene: 'walking the same training center hallway years later, nodding to a new class of hopeful trainees',
    emotionalArc: 'quiet nostalgia turning into a sense of full-circle purpose',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-new-single-release-countdown',
    labelKo: '신곡 발매 카운트다운',
    scene: "watching the release countdown timer hit zero together on every member's phone at once",
    emotionalArc: 'anxious anticipation exploding into shared relief',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-choreo-video-call-practice',
    labelKo: '화상통화 안무 연습',
    scene: "running through new choreography over a shaky video call while members correct each other's counts",
    emotionalArc: 'clumsy distance practice tightening into real synchronization',
    suitedArchetypes: ['kr-idol-male']
  },
  {
    id: 'kridol-member-farewell-retirement',
    labelKo: '멤버와의 작별',
    scene: 'standing in a final group photo line as one member prepares to step away from the stage for good',
    emotionalArc: 'heavy unspoken sadness resolving into grateful support',
    suitedArchetypes: ['kr-idol-male']
  },
  // TASK K3 §5 — kr-idol-female's 18 lyric scenes, entirely separate from
  // K2's own 18 (§5-1's own explicit instruction: reusing K2's scenes with
  // only the gender swapped would still pass §10-9's cross-similarity check
  // while being the same world underneath). §5-2's axes: self-direction/
  // choice, leading a relationship rather than following, friendship as
  // mutual support, facing emotion directly (anger/relief/triumph, not
  // dwelling in sadness), and daylight/rooftop/after-party/season-turning
  // atmosphere — the deliberate contrast to K2's stage/limit/longing axes.
  // frameId vocabulary (self-direction/gaze-passed/leading-the-approach/
  // clean-break/unshaken-ground/friends-line/direct-release/daylight-city/
  // after-party/season-turning) has 0 overlap with both kr2030's 18 frames
  // and K2's own 9, well under the "≤4 combined" ceiling. None of the
  // scenes below use kr2030's banned words (퇴근길/서른/원룸/막차) or K2's own
  // (무대/컴백/연습실).
  {
    id: 'krkidolf-my-own-direction',
    labelKo: '내가 정한 방향',
    scene: 'standing at a crossroads and choosing her own path, deliberately ignoring what everyone else expected',
    emotionalArc: 'hesitant doubt hardening into calm certainty',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'self-direction',
    castKo: '혼자'
  },
  {
    id: 'krkidolf-walking-past-the-stares',
    labelKo: '시선을 지나침',
    scene: 'walking through a crowded street and letting every stare slide off without slowing her pace',
    emotionalArc: 'self-conscious tension dissolving into easy confidence',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'gaze-passed',
    castKo: '혼자'
  },
  {
    id: 'krkidolf-doing-it-my-way',
    labelKo: '하고 싶은 대로',
    scene: 'rearranging a room exactly the way she wants it, ignoring every unsolicited opinion',
    emotionalArc: 'quiet defiance settling into satisfied ease',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'self-direction',
    castKo: '혼자'
  },
  {
    id: 'krkidolf-first-to-speak',
    labelKo: '먼저 말 거는 쪽',
    scene: 'crossing a crowded room to speak first, before anyone else gets the chance',
    emotionalArc: 'nervous energy sharpening into bold initiative',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'leading-the-approach',
    castKo: '둘'
  },
  {
    id: 'krkidolf-the-one-who-ends-it',
    labelKo: '끝내는 쪽',
    scene: 'closing the door calmly on a relationship that stopped working, no drama, no looking back',
    emotionalArc: 'lingering hesitation resolving into clean resolve',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'clean-break',
    castKo: '둘'
  },
  {
    id: 'krkidolf-unshaken',
    labelKo: '흔들리지 않는 쪽',
    scene: 'standing steady while someone tries to provoke a reaction, refusing to flinch',
    emotionalArc: 'rising provocation met with calm steadiness',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'unshaken-ground',
    castKo: '둘'
  },
  {
    id: 'krkidolf-friends-side-by-side',
    labelKo: '같이 가는 사람들',
    scene: 'walking in a line with friends down a bright street, matching pace without a word',
    emotionalArc: 'separate energies syncing into one shared rhythm',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'friends-line',
    castKo: '여럿'
  },
  {
    id: 'krkidolf-lifting-each-other',
    labelKo: '서로를 세워주는 관계',
    scene: 'catching a friend\'s hand right as she stumbles, pulling her back up without breaking stride',
    emotionalArc: 'momentary wobble steadied into renewed momentum',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'friends-line',
    castKo: '둘'
  },
  {
    id: 'krkidolf-crew-victory-lap',
    labelKo: '함께 이룬 순간',
    scene: 'throwing an arm around a friend\'s shoulder after a win, laughing about how close it almost didn\'t happen',
    emotionalArc: 'built-up tension breaking into shared relief',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'friends-line',
    castKo: '여럿'
  },
  {
    id: 'krkidolf-finally-said-it',
    labelKo: '화가 풀리는 순간',
    scene: 'finally saying the thing she\'d swallowed for weeks, and watching the weight actually lift',
    emotionalArc: 'pent-up frustration snapping into open relief',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'direct-release',
    castKo: '혼자'
  },
  {
    id: 'krkidolf-clean-getaway',
    labelKo: '후련함',
    scene: 'walking out of a place that stopped feeling right, the door closing behind her, shoulders finally dropping',
    emotionalArc: 'built-up pressure releasing into lightness',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'clean-break',
    castKo: '혼자'
  },
  {
    id: 'krkidolf-the-last-laugh',
    labelKo: '통쾌함',
    scene: 'hearing news that proves every doubter wrong, and letting herself enjoy it openly',
    emotionalArc: 'quiet vindication opening into bright triumph',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'direct-release',
    castKo: '혼자'
  },
  {
    id: 'krkidolf-daylight-rooftop',
    labelKo: '옥상에서 보는 낮',
    scene: 'standing on a rooftop at midday, the city spread out bright and loud below',
    emotionalArc: 'restless energy opening into wide-open freedom',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'daylight-city',
    castKo: '혼자'
  },
  {
    id: 'krkidolf-after-the-party',
    labelKo: '파티가 끝난 뒤',
    scene: 'sitting on a curb after a party winds down, streetlights just starting to flicker on',
    emotionalArc: 'winding-down energy settling into satisfied calm',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'after-party',
    castKo: '여럿'
  },
  {
    id: 'krkidolf-season-turning-color',
    labelKo: '계절이 바뀌는 색',
    scene: 'noticing the light change color on a familiar street as one season tips into the next',
    emotionalArc: 'quiet noticing opening into anticipation',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'season-turning',
    castKo: '혼자'
  },
  {
    id: 'krkidolf-strut-through-the-alley',
    labelKo: '동네 골목을 활보하는 오후',
    scene: 'strutting confidently through a familiar neighborhood alley in the middle of a bright afternoon',
    emotionalArc: 'ordinary errand energy tipping into playful confidence',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'daylight-city',
    castKo: '혼자'
  },
  {
    id: 'krkidolf-leading-the-dance-floor',
    labelKo: '먼저 나서는 순간',
    scene: 'pulling a friend onto the dance floor first, setting the pace before anyone else moves',
    emotionalArc: 'shy hesitation flipping into magnetic confidence',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'leading-the-approach',
    castKo: '둘'
  },
  {
    id: 'krkidolf-choosing-to-stay-close',
    labelKo: '내 뜻대로 가까워지기',
    scene: 'deciding, on her own terms, to stay close to someone rather than play it cool and pull away',
    emotionalArc: 'guarded distance softening into deliberate closeness',
    suitedArchetypes: ['kr-idol-female'],
    frameId: 'self-direction',
    castKo: '둘'
  },
  // 지시문 14 (Phase 2 TASK B) — 28 new entries, 18 -> 46. Avoids the 6
  // K-pop families §B-3 names as already-covered (spotlight-stage,
  // mirror-self-image, fire-rise, crown-throne, night-city-neon,
  // run-fly-break-wall) and every already-covered concept from the 18
  // above (direction/stares/first-to-speak/ending-it/unshaken/friends/
  // lifting-up/victory-lap/finally-said-it/getaway/last-laugh/
  // daylight-rooftop/after-party/season-color/alley-strut/dance-floor/
  // stay-close).
  {
    id: 'krkidolf-recording-booth-final-take',
    labelKo: '녹음부스 완벽한 테이크',
    scene: 'nailing a vocal run in one clean take after pushing through a dozen imperfect ones',
    emotionalArc: 'stubborn perfectionism resolving into quiet pride',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-fan-letter-backstage',
    labelKo: '백스테이지 팬레터',
    scene: 'reading a handwritten letter from a young fan minutes before walking on stage',
    emotionalArc: 'private doubt melting into renewed purpose',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-injury-recovery-comeback',
    labelKo: '부상 재활 컴백 준비',
    scene: 'stretching a healing ankle carefully before the first full rehearsal back',
    emotionalArc: 'cautious fear firming into determined readiness',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-songwriting-credit-first-time',
    labelKo: '첫 작사 크레딧',
    scene: 'seeing her own name in the songwriting credits for the very first time on a released track',
    emotionalArc: 'quiet disbelief blooming into fierce ownership',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-award-show-nomination-nerves',
    labelKo: '시상식 후보 발표 긴장',
    scene: "gripping a friend's hand as a nominee category is read aloud at an award show",
    emotionalArc: 'held-breath tension breaking into overwhelmed joy',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-solo-stage-debut-nerves',
    labelKo: '솔로 무대 데뷔',
    scene: 'standing alone in the wings for a first solo stage without the rest of the group beside her',
    emotionalArc: 'isolating fear steadying into fierce self-reliance',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-hair-makeup-chair-transformation',
    labelKo: '헤어메이크업 체어',
    scene: 'watching a mirror slowly transform an ordinary morning face into a stage-ready one',
    emotionalArc: 'sleepy blankness sharpening into confident anticipation',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-childhood-dance-video-rewatch',
    labelKo: '어릴 적 춤 영상 다시보기',
    scene: 'rewatching an old childhood dance recital video and recognizing the same stubborn determination',
    emotionalArc: 'nostalgic distance collapsing into grounded continuity',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-negotiating-her-own-contract',
    labelKo: '스스로 협상하는 계약',
    scene: 'reading contract terms line by line and asking for exactly what she knows she deserves',
    emotionalArc: 'quiet intimidation replaced by calm assertiveness',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-fan-project-lightstick-sea',
    labelKo: '팬 프로젝트 응원봉 바다',
    scene: 'looking out at a sea of lightsticks perfectly timed to a song she wrote alone',
    emotionalArc: 'private effort suddenly visible as collective love',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-overseas-tour-jet-lag',
    labelKo: '해외투어 시차 적응',
    scene: 'blinking awake in an unfamiliar hotel room, momentarily forgetting which country holds the next show',
    emotionalArc: 'disoriented exhaustion steadying into professional focus',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-choreography-she-created',
    labelKo: '직접 만든 안무',
    scene: 'teaching her own choreography to the rest of the group for the first time, nervous about every count',
    emotionalArc: 'anxious authorship settling into proud ownership',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-childhood-friend-still-there',
    labelKo: '여전히 곁에 있는 오랜 친구',
    scene: 'meeting a childhood friend backstage who never once treated her differently after fame',
    emotionalArc: 'quiet gratitude anchoring into steady loyalty',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-magazine-cover-shoot-confidence',
    labelKo: '매거진 커버 촬영',
    scene: 'holding a still pose for a magazine cover shot, finding real confidence past the initial stiffness',
    emotionalArc: 'self-conscious posing loosening into natural power',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-late-night-vocal-practice-alone',
    labelKo: '늦은 밤 혼자 발성 연습',
    scene: 'running scales alone in an empty practice room long after the rest of the group has gone to sleep',
    emotionalArc: 'quiet solitary discipline hardening into private resolve',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-online-hate-turned-off',
    labelKo: '악플 알림 끄기',
    scene: 'turning off comment notifications for the night and choosing peace over one more scroll',
    emotionalArc: 'creeping anxiety replaced by deliberate self-protection',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-hometown-fan-signing-full-circle',
    labelKo: '고향 팬사인회',
    scene: 'signing autographs in the same town square she used to walk through as an unknown trainee',
    emotionalArc: 'quiet nostalgia deepening into full-circle pride',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-stylist-team-trust',
    labelKo: '스타일리스트 팀과의 신뢰',
    scene: "trusting a longtime stylist's instinct on a risky new look minutes before showtime",
    emotionalArc: 'nervous uncertainty settling into confident trust',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-first-billboard-chart-entry',
    labelKo: '첫 빌보드 차트 진입',
    scene: "refreshing a chart page late at night and seeing her group's name climb higher than expected",
    emotionalArc: 'anxious refreshing bursting into disbelieving joy',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-airport-fan-crowd-wave',
    labelKo: '공항 팬들에게 손 흔들기',
    scene: 'waving through an airport crowd barrier at fans who arrived before dawn just to see her pass',
    emotionalArc: 'travel exhaustion melting into warm gratitude',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-choosing-her-own-stage-outfit',
    labelKo: '직접 고른 무대 의상',
    scene: "overruling a stylist's safe suggestion to wear the bolder outfit she actually wants",
    emotionalArc: 'quiet hesitation firming into self-assured choice',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-group-dinner-after-hard-week',
    labelKo: '힘든 한 주 뒤 회식',
    scene: 'laughing over a late group dinner after a brutally hard promotional week finally ends',
    emotionalArc: 'accumulated exhaustion dissolving into warm relief',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-mentoring-a-younger-trainee',
    labelKo: '후배 연습생 멘토링',
    scene: "correcting a nervous young trainee's posture gently, remembering exactly how that felt once",
    emotionalArc: 'authoritative distance softening into genuine care',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-rainstorm-outdoor-stage-finish',
    labelKo: '폭우 속 야외무대 완주',
    scene: 'finishing a full outdoor set through sudden pouring rain without missing a single count',
    emotionalArc: 'physical struggle transformed into fierce triumph',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-fan-fund-charity-project',
    labelKo: '팬들과 함께한 기부',
    scene: 'reading a thank-you letter from a charity her fanbase quietly funded in her name',
    emotionalArc: 'private humility deepening into proud collective purpose',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-choosing-rest-over-schedule',
    labelKo: '스케줄보다 휴식을 선택',
    scene: 'canceling one nonessential schedule to finally get real sleep, without apologizing for it',
    emotionalArc: 'guilty hesitation replaced by self-respecting clarity',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-first-time-writing-english-verse',
    labelKo: '첫 영어 가사 작사',
    scene: 'drafting her first English verse late at night, checking every word against a well-worn dictionary',
    emotionalArc: 'careful uncertainty growing into confident expression',
    suitedArchetypes: ['kr-idol-female']
  },
  {
    id: 'krkidolf-ten-year-anniversary-stage',
    labelKo: '데뷔 10주년 무대',
    scene: 'standing on the same stage a decade after debut, recognizing faces that have been there from the start',
    emotionalArc: 'accumulated years distilling into overwhelming gratitude',
    suitedArchetypes: ['kr-idol-female']
  },
  // 지시문 71 (TASK C) — en-chillhop workspace's 46 lyric scenes. 영어권
  // 도시 야간·일상 맥락(§4.2) — 기존 한국/일본 장면(喫茶店·波止場·골목
  // 가로등)을 번역하지 않고 새로 썼다. frameId는 기존 체계(12종, 새 프레임
  // 없음)를 재사용하며 4~4~3으로 고르게 분산해 한 프레임이 10개를 넘지
  // 않는다(§4.2 "고르게 할 것"). 특정 장르 전용(클럽 플로어 등) 장면이
  // 절반을 넘지 않도록 칠랩·힙합·딥하우스 셋 다에 얹을 수 있는 장면
  // 위주로 썼다(§4.2 마지막 항).
  {
    id: 'enchillhop-subway-headphones-static',
    labelKo: '지하철 이어폰 정적',
    scene: 'riding a late subway car with headphones on, city lights strobing past the window in silence',
    emotionalArc: 'flat exhaustion easing into a private, unbothered calm',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'commute-transit',
    motionKo: '이동 중(지하철)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-night-bus-window-glow',
    labelKo: '심야버스 창밖 불빛',
    scene: 'catching the last night bus home, streetlights sliding across a tired reflection in the glass',
    emotionalArc: 'drifting fatigue settling into quiet gratitude for the ride home',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'commute-transit',
    motionKo: '이동 중(버스)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-rideshare-backseat-playlist',
    labelKo: '라이드셰어 뒷좌석 플레이리스트',
    scene: 'sitting in the backseat of a rideshare at 1am, running a personal playlist low through one earbud',
    emotionalArc: 'restless overthinking softening into a small, private peace',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'commute-transit',
    motionKo: '이동 중(차량)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-walking-block-earbuds-in',
    labelKo: '동네 산책 이어버즈',
    scene: 'walking the same six blocks home with earbuds in, timing footsteps to a half-remembered beat',
    emotionalArc: 'aimless wandering resolving into a steady, grounded rhythm',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'commute-transit',
    motionKo: '이동 중(도보)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-bedroom-studio-setup',
    labelKo: '방 안 홈스튜디오',
    scene: 'sitting at a small bedroom studio desk past midnight, one lamp on, headphones half off one ear',
    emotionalArc: 'scattered self-doubt narrowing into focused, patient work',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'solitary-room',
    motionKo: '정적',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-apartment-window-rain-static',
    labelKo: '아파트 창밖 빗소리',
    scene: 'watching rain streak down an apartment window at night, city noise reduced to a low, steady hum',
    emotionalArc: 'quiet loneliness easing into calm acceptance',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'solitary-room',
    motionKo: '정적',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-laundromat-late-wait',
    labelKo: '심야 빨래방 대기',
    scene: 'waiting out a laundromat cycle after midnight, fluorescent light humming over an empty row of machines',
    emotionalArc: 'dull boredom drifting into unexpected, low-key comfort',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'solitary-room',
    motionKo: '정적',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-kitchen-counter-late-snack',
    labelKo: '주방 카운터 심야 간식',
    scene: 'standing at the kitchen counter at 2am eating cereal straight from the box, the only light from the fridge',
    emotionalArc: 'restless insomnia settling into small, ordinary contentment',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'solitary-room',
    motionKo: '정적',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-highway-loop-no-destination',
    labelKo: '목적지 없는 순환도로',
    scene: 'driving the same highway loop with no real destination, windows cracked, bass humming low under the tires',
    emotionalArc: 'restless energy unwinding into open-hearted calm',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'night-drive',
    motionKo: '이동 중(드라이브)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-overlook-parking-lot-view',
    labelKo: '전망대 주차장 야경',
    scene: 'parked at a hillside overlook with the engine off, the whole skyline laid out low and glittering',
    emotionalArc: 'quiet awe settling into grounded perspective',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'night-drive',
    motionKo: '정적(정차)',
    castKo: '둘'
  },
  {
    id: 'enchillhop-drive-through-neon-order',
    labelKo: '네온 드라이브스루',
    scene: 'pulling up to a neon-lit drive-through at 3am, ordering just to have somewhere to be for five minutes',
    emotionalArc: 'aimless drifting turning into small, self-aware amusement',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'night-drive',
    motionKo: '이동 중(드라이브)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-bridge-crossing-city-hum',
    labelKo: '다리 위 도시의 소음',
    scene: 'crossing a bridge at night with the city humming on both sides, radio low, hands loose on the wheel',
    emotionalArc: 'tangled thoughts unspooling into clear-headed resolve',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'night-drive',
    motionKo: '이동 중(드라이브)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-studio-session-with-a-friend',
    labelKo: '친구와의 스튜디오 세션',
    scene: 'trading verses back and forth with a close friend in a cramped home studio, laughing between takes',
    emotionalArc: 'nervous first attempts loosening into easy, trusting collaboration',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'two-people-talk',
    castKo: '둘'
  },
  {
    id: 'enchillhop-rooftop-conversation-city-below',
    labelKo: '옥상 대화, 발밑의 도시',
    scene: 'sitting on a rooftop ledge with someone, the city spread out below, saying the thing that’s been hard to say',
    emotionalArc: 'guarded hesitation opening into honest connection',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'two-people-talk',
    castKo: '둘'
  },
  {
    id: 'enchillhop-diner-booth-catch-up',
    labelKo: '다이너 부스 근황 토크',
    scene: 'sliding into a diner booth with an old friend at midnight, catching up over cold fries and refilled coffee',
    emotionalArc: 'initial distance warming into familiar, easy comfort',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'two-people-talk',
    castKo: '둘'
  },
  {
    id: 'enchillhop-phone-call-walking-home',
    labelKo: '집에 걸어가며 통화',
    scene: 'talking on the phone while walking home alone, the conversation stretching out longer than either of them planned',
    emotionalArc: 'quiet loneliness dissolving into unexpected warmth',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'two-people-talk',
    motionKo: '이동 중(도보)',
    castKo: '둘'
  },
  {
    id: 'enchillhop-quitting-the-day-job',
    labelKo: '퇴사를 결심하는 밤',
    scene: 'staring at a resignation email draft at 1am, cursor blinking, finally deciding whether to hit send',
    emotionalArc: 'anxious uncertainty crystallizing into determined resolve',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'threshold-decision',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-moving-to-a-new-city',
    labelKo: '새 도시로의 이사',
    scene: 'taping the last box shut before a move to a new city, looking around an empty apartment one last time',
    emotionalArc: 'nervous uncertainty opening into cautious hope',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'threshold-decision',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-releasing-the-first-track',
    labelKo: '첫 트랙 발매',
    scene: 'hovering a finger over the upload button on a first real track, months of late nights compressed into one click',
    emotionalArc: 'paralyzing self-doubt breaking into a leap of faith',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'threshold-decision',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-walking-away-for-good',
    labelKo: '완전히 등을 돌리는 순간',
    scene: 'standing at a doorway deciding, for the last time, whether to turn back or keep walking',
    emotionalArc: 'aching hesitation hardening into clear-eyed release',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'threshold-decision',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-rooftop-skyline-golden-hour',
    labelKo: '옥상에서 보는 골든아워 스카이라인',
    scene: 'watching the skyline turn gold from a rooftop right before the streetlights flicker on',
    emotionalArc: 'quiet stillness swelling into open-hearted wonder',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'city-lights',
    motionKo: '정적',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-downtown-after-work-walk',
    labelKo: '퇴근 후 다운타운 산책',
    scene: 'walking through downtown right after work, city lights just starting to outshine the fading daylight',
    emotionalArc: 'flat exhaustion lifting into small, renewed energy',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'city-lights',
    motionKo: '이동 중(도보)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-crosswalk-waiting-neon',
    labelKo: '네온 아래 횡단보도 대기',
    scene: 'standing at a crosswalk under a neon sign, waiting for the light with a hundred strangers moving around',
    emotionalArc: 'restless impatience settling into observant calm',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'city-lights',
    motionKo: '정적',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-elevator-ride-up-highrise',
    labelKo: '고층빌딩 엘리베이터',
    scene: 'riding an elevator up a high-rise alone, city lights dropping away through the glass with every floor',
    emotionalArc: 'quiet nerves rising into clear, steady focus',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'city-lights',
    motionKo: '이동 중(엘리베이터)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-party-edge-not-dancing',
    labelKo: '파티 가장자리, 춤추지 않는',
    scene: 'standing at the edge of a crowded party with a drink going warm, watching everyone else move',
    emotionalArc: 'isolated self-consciousness easing into comfortable detachment',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'crowd-alone',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-platform-rush-hour-alone',
    labelKo: '러시아워 플랫폼, 혼자',
    scene: 'standing on a packed subway platform at rush hour, completely alone inside the noise',
    emotionalArc: 'overwhelmed anonymity settling into a strange, private calm',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'crowd-alone',
    motionKo: '정적',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-show-not-dancing-watching',
    labelKo: '공연장, 춤추지 않고 지켜보는',
    scene: 'standing near the back of a small show, arms crossed, watching the set instead of losing themselves in it',
    emotionalArc: 'guarded distance loosening into quiet appreciation',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'crowd-alone',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-grocery-store-late-night-run',
    labelKo: '심야 마트 나홀로 장보기',
    scene: 'wandering an all-night grocery store at 2am with an empty basket, in no hurry to leave',
    emotionalArc: 'restless insomnia unwinding into unhurried, private ease',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'crowd-alone',
    motionKo: '이동 중(도보)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-running-into-an-ex-at-a-bar',
    labelKo: '바에서 우연히 마주친 전 연인',
    scene: 'spotting an ex across a dim bar and deciding, in the space of a breath, whether to say hello',
    emotionalArc: 'sudden tension resolving into unexpected, calm closure',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'reunion-passing',
    castKo: '둘'
  },
  {
    id: 'enchillhop-old-crew-after-years',
    labelKo: '몇 년 만에 만난 옛 크루',
    scene: 'reuniting with the old crew after years apart, everyone a little older but falling back into old rhythms fast',
    emotionalArc: 'awkward distance dissolving into easy familiarity',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'reunion-passing',
    castKo: '여럿'
  },
  {
    id: 'enchillhop-text-left-on-read-then-answered',
    labelKo: '읽씹 후 뒤늦게 온 답장',
    scene: 'watching a text sit read-but-unanswered for days, then finally getting a reply late one night',
    emotionalArc: 'simmering frustration softening into cautious relief',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'reunion-passing',
    castKo: '둘'
  },
  {
    id: 'enchillhop-passing-the-old-block',
    labelKo: '옛 동네를 지나며',
    scene: 'driving past the old block where everything started, every corner holding a different memory',
    emotionalArc: 'wistful nostalgia settling into grounded gratitude',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'reunion-passing',
    motionKo: '이동 중(드라이브)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-leaving-the-party-at-3am',
    labelKo: '새벽 3시, 파티를 나서며',
    scene: 'stepping out of a party at 3am into cold, quiet air, ears still ringing from the speakers',
    emotionalArc: 'buzzing overstimulation settling into peaceful stillness',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'after-party',
    motionKo: '이동 중(도보)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-afterparty-wind-down-couch',
    labelKo: '애프터파티 후 소파에서',
    scene: 'sitting on a couch with a few close friends as an afterparty winds down, the music turned low',
    emotionalArc: 'high energy mellowing into warm, contented quiet',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'after-party',
    castKo: '여럿'
  },
  {
    id: 'enchillhop-walking-home-from-a-set',
    labelKo: '세트 끝나고 걸어서 귀가',
    scene: 'walking home from a late DJ set with the bassline still echoing faintly in the ears',
    emotionalArc: 'electric exhilaration settling into a slow, satisfied glow',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'after-party',
    motionKo: '이동 중(도보)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-sunrise-after-a-night-out',
    labelKo: '외출 후 맞이하는 새벽',
    scene: 'watching the sky lighten from a fire escape after a night that ran straight into morning',
    emotionalArc: 'giddy exhaustion softening into quiet, grateful clarity',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'after-party',
    motionKo: '정적',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-scrolling-old-photos-late',
    labelKo: '늦은 밤 옛 사진 넘겨보기',
    scene: 'scrolling through old photos alone at night, pausing too long on one from a year that already feels far away',
    emotionalArc: 'bittersweet nostalgia settling into calm acceptance',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'screen-memory',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-rewatching-a-voice-memo',
    labelKo: '오래된 음성메모 다시 듣기',
    scene: 'replaying an old voice memo from a friend who moved away, hearing a laugh that time has softened',
    emotionalArc: 'quiet longing warming into grateful remembrance',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'screen-memory',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-video-call-friend-abroad',
    labelKo: '해외에 있는 친구와 화상통화',
    scene: 'video-calling a friend who moved abroad, the time zones making the call feel like it’s from another life',
    emotionalArc: 'distant ache warming into steady, reassured connection',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'screen-memory',
    castKo: '둘'
  },
  {
    id: 'enchillhop-deleting-an-old-playlist',
    labelKo: '오래된 플레이리스트 삭제',
    scene: 'scrolling to the bottom of an old playlist built for someone who’s not around anymore, finger hovering over delete',
    emotionalArc: 'reluctant grief resolving into clean, deliberate release',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'screen-memory',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-morning-coffee-run-before-work',
    labelKo: '출근 전 아침 커피런',
    scene: 'grabbing coffee from a corner cart before work, city just waking up around a still-quiet sidewalk',
    emotionalArc: 'sleepy sluggishness lifting into a small, hopeful start',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'daylight-city',
    motionKo: '이동 중(도보)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-saturday-farmers-market',
    labelKo: '토요일 파머스마켓',
    scene: 'wandering a Saturday farmers market with nowhere to be, sunlight cutting through the stalls',
    emotionalArc: 'low-grade weekday tension unwinding into easy weekend calm',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'daylight-city',
    motionKo: '이동 중(도보)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-laundry-day-errands-loop',
    labelKo: '빨래하는 날의 소소한 심부름',
    scene: 'running a loop of small Sunday errands with a laundry bag over one shoulder, no real plan for the day',
    emotionalArc: 'quiet restlessness settling into simple contentment',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'daylight-city',
    motionKo: '이동 중(도보)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-dancing-alone-in-the-kitchen',
    labelKo: '주방에서 혼자 춤추기',
    scene: 'dancing alone in the kitchen at midnight while something simmers on the stove, no one watching',
    emotionalArc: 'quiet loneliness turning into unguarded, private joy',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'night-city-move',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-night-walk-headphones-on',
    labelKo: '헤드폰 쓰고 밤 산책',
    scene: 'taking a long, unplanned night walk with headphones on, letting the block count double before turning back',
    emotionalArc: 'restless static thoughts smoothing into clear-headed calm',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'night-city-move',
    motionKo: '이동 중(도보)',
    castKo: '혼자'
  },
  {
    id: 'enchillhop-biking-home-late-empty-streets',
    labelKo: '텅 빈 거리를 자전거로 귀가',
    scene: 'biking home late through empty streets, the whole city briefly feeling like it belongs to no one else',
    emotionalArc: 'wired late-night energy settling into free, weightless ease',
    suitedArchetypes: ['en-chillhop'],
    languages: ['english'],
    frameId: 'night-city-move',
    motionKo: '이동 중(자전거)',
    castKo: '혼자'
  }
];

export const kidsLyricThemes: LyricTheme[] = [
  {
    id: 'kids-playground-slide-after-school',
    labelKo: '하교 뒤 놀이터 미끄럼틀',
    scene: 'running to the playground slide after school with a backpack bouncing on the shoulders',
    emotionalArc: 'shy start turning into shared laughter',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-rain-boots-puddles',
    labelKo: '장화 신고 물웅덩이',
    scene: 'jumping into small puddles with bright rain boots while a parent holds an umbrella nearby',
    emotionalArc: 'careful steps becoming playful confidence',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-first-snow-mittens',
    labelKo: '첫눈과 벙어리장갑',
    scene: 'catching the first snow with mitten hands on the way to the front gate',
    emotionalArc: 'quiet wonder growing into a sparkling chorus',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-lunchbox-note',
    labelKo: '도시락 속 작은 쪽지',
    scene: 'opening a lunchbox and finding a small note tucked beside the fruit',
    emotionalArc: 'missing home turning into a brave smile',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-bubble-yard',
    labelKo: '마당의 비눗방울',
    scene: 'blowing soap bubbles in the yard and chasing the biggest one toward the fence',
    emotionalArc: 'curiosity turning into giggly teamwork',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-crayon-rainbow-table',
    labelKo: '식탁 위 크레용 무지개',
    scene: 'drawing a rainbow with crayons at the kitchen table while sleeves get smudged with color',
    emotionalArc: 'messy focus becoming proud sharing',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-school-gate-high-five',
    labelKo: '교문 앞 하이파이브',
    scene: 'meeting a friend at the school gate and trading a high-five before class',
    emotionalArc: 'morning nerves turning into friendly energy',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-picture-book-blanket',
    labelKo: '담요 속 그림책',
    scene: 'reading a picture book under a blanket while rain taps the window',
    emotionalArc: 'cozy quiet building into imagination',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-toy-train-carpet',
    labelKo: '카펫 위 장난감 기차',
    scene: 'pushing a toy train around a carpet track and calling out each pretend station',
    emotionalArc: 'solo play becoming a shared adventure',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-counting-stairs',
    labelKo: '계단 세며 올라가기',
    scene: 'counting each stair on the way upstairs, clapping after the last step',
    emotionalArc: 'small challenge becoming happy mastery',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-animal-sticker-parade',
    labelKo: '동물 스티커 행진',
    scene: 'lining up animal stickers across a notebook like a tiny parade',
    emotionalArc: 'orderly play turning into cheerful make-believe',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-music-class-bells',
    labelKo: '음악 시간 작은 종',
    scene: 'ringing small classroom bells one by one and waiting for the next color cue',
    emotionalArc: 'listening carefully becoming bright participation',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-garden-butterfly',
    labelKo: '화단 앞 나비 관찰',
    scene: 'watching a butterfly land near the flower bed and whispering so it will stay',
    emotionalArc: 'excited energy settling into gentle wonder',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-pajama-moon-window',
    labelKo: '잠옷 입고 보는 달',
    scene: 'standing at the window in pajamas and waving goodnight to the moon',
    emotionalArc: 'busy day ending in safe calm',
    suitedArchetypes: ['kids']
  },
  // 지시문 14 (Phase 2 TASK B) — 28 new entries, 14 -> 42, each a distinct
  // material family from the original 14 above (no repeat of slide/puddle/
  // snow/lunchbox/bubbles/crayon/gate/book/train/stairs/stickers/bells/
  // butterfly/moon) — this archetype could not fill even one 18-song set
  // before this task (real measured gap, 지시문 14 §2-2).
  {
    id: 'kids-kite-park-flying',
    labelKo: '공원에서 연날리기',
    scene: 'running across an open park to launch a kite while the string tugs against small hands',
    emotionalArc: 'nervous first pull steadying into proud control',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-sandbox-digging',
    labelKo: '모래놀이터 파기',
    scene: 'digging a small tunnel in the sandbox and cheering when two hands finally meet in the middle',
    emotionalArc: 'patient digging turning into triumphant discovery',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-hide-seek-backyard',
    labelKo: '마당 숨바꼭질',
    scene: 'crouching behind a garden bush during hide and seek while muffled counting drifts from the porch',
    emotionalArc: 'held-breath excitement bursting into laughter when found',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-chalk-sidewalk-drawing',
    labelKo: '보도블록 분필 그림',
    scene: 'drawing a giant chalk sun across the sidewalk with knees pressed to warm concrete',
    emotionalArc: 'quiet concentration opening into colorful pride',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-bicycle-training-wheels',
    labelKo: '보조바퀴 자전거',
    scene: 'pedaling a bicycle with training wheels down a driveway while a parent jogs alongside',
    emotionalArc: 'wobbly nerves settling into steady balance',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-balloon-string-let-go',
    labelKo: '놓친 풍선',
    scene: 'watching a balloon slip from small fingers and drift above the rooftops',
    emotionalArc: 'sudden loss softening into wide-eyed wonder',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-puzzle-pieces-living-room',
    labelKo: '거실 퍼즐 조각',
    scene: 'spreading puzzle pieces across the living room floor and searching for one stubborn corner',
    emotionalArc: 'frustrated searching resolving into satisfied completion',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-treehouse-ladder-climb',
    labelKo: '나무집 사다리',
    scene: 'climbing a wooden ladder to a small treehouse with leaves brushing against bare arms',
    emotionalArc: 'careful climbing turning into a proud lookout view',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-sprinkler-summer-yard',
    labelKo: '여름 마당 스프링클러',
    scene: 'running through a backyard sprinkler in bare feet while sunlight scatters through the water',
    emotionalArc: 'squealing surprise settling into carefree joy',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-blanket-fort-living-room',
    labelKo: '거실 담요 요새',
    scene: 'building a blanket fort between two chairs and whispering secret rules inside',
    emotionalArc: 'busy building becoming a cozy shared hideout',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-leaf-pile-autumn-jump',
    labelKo: '낙엽 더미 점프',
    scene: 'raking a pile of autumn leaves taller than small knees before jumping straight into the middle',
    emotionalArc: 'careful raking exploding into gleeful chaos',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-birthday-candle-wish',
    labelKo: '생일 초 소원',
    scene: 'leaning close to a birthday cake to blow out one small candle before anyone can peek',
    emotionalArc: 'shy anticipation blooming into a bright cheer',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-grocery-cart-ride',
    labelKo: '장바구니 카트 타기',
    scene: 'riding on the end of a grocery cart down a quiet aisle while the wheels squeak on the tile',
    emotionalArc: 'restless waiting turning into a giggling ride',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-family-pet-walk',
    labelKo: '강아지와 산책',
    scene: 'holding a leash a little too tight on a first walk with the family dog around the block',
    emotionalArc: 'careful caution loosening into happy trotting',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-storytime-circle-library',
    labelKo: '도서관 이야기 시간',
    scene: 'sitting cross-legged in a library storytime circle and leaning forward at the best part',
    emotionalArc: 'shy quiet opening into wide-eyed listening',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-puppet-show-cardboard-box',
    labelKo: '상자 인형극',
    scene: 'poking two sock puppets over the edge of a cardboard box stage for a living room audience',
    emotionalArc: 'nervous first line turning into confident performance',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-snow-angel-backyard',
    labelKo: '마당 눈천사',
    scene: 'lying back in fresh snow to sweep out a wobbly snow angel before hopping carefully away',
    emotionalArc: 'cold hesitation melting into delighted pride',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-tent-camping-backyard',
    labelKo: '마당 텐트 캠핑',
    scene: 'unzipping a small backyard tent with a flashlight in hand while crickets start their evening song',
    emotionalArc: 'nervous dark turning into brave adventure',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-seesaw-playground-balance',
    labelKo: '놀이터 시소',
    scene: 'balancing on one end of a playground seesaw and calling out to bounce a little higher',
    emotionalArc: 'wobbly balance turning into rhythmic teamwork',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-bath-bubble-boat',
    labelKo: '목욕탕 비누거품 배',
    scene: 'floating a small toy boat through bathtub bubbles and steering it past a washcloth island',
    emotionalArc: 'splashy play settling into calm bedtime quiet',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-sticker-book-collecting',
    labelKo: '스티커북 모으기',
    scene: 'peeling a new sticker into an almost-full sticker book and deciding exactly where it belongs',
    emotionalArc: 'careful choosing becoming proud completion',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-balloon-animal-fair',
    labelKo: '축제 풍선 동물',
    scene: 'watching a fair vendor twist a balloon into an animal shape and reaching up for the finished tail',
    emotionalArc: 'patient waiting turning into delighted surprise',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-face-painting-fair',
    labelKo: '축제 페이스페인팅',
    scene: 'sitting very still for a face-painting brush at a fair booth and peeking in a small mirror after',
    emotionalArc: 'ticklish stillness turning into proud grinning',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-swing-set-push',
    labelKo: '그네 밀어주기',
    scene: 'kicking bare feet toward the sky on a playground swing while someone gives one more gentle push',
    emotionalArc: 'timid swinging opening into fearless flying',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-sandcastle-beach-tide',
    labelKo: '해변 모래성',
    scene: 'patting a small sandcastle taller near the shoreline before the tide creeps in to visit it',
    emotionalArc: 'proud building meeting a gentle acceptance of change',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-paper-airplane-classroom',
    labelKo: '교실 종이비행기',
    scene: 'folding a paper airplane at a classroom desk and testing one careful launch across the room',
    emotionalArc: 'quiet focus lifting into surprised delight',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-new-shoes-first-day',
    labelKo: '새 신발 첫날',
    scene: 'lacing up brand new shoes on the first day of school and taking one careful bouncing step outside',
    emotionalArc: 'nervous newness turning into confident stride',
    suitedArchetypes: ['kids']
  },
  {
    id: 'kids-goodnight-story-bedtime-hug',
    labelKo: '잠자리 이야기와 포옹',
    scene: 'listening to one more bedtime story with a stuffed animal tucked under one arm before the light goes low',
    emotionalArc: 'wide-awake energy settling into safe sleepy comfort',
    suitedArchetypes: ['kids']
  },
  // TASK E1 §4 — kr-kids workspace's 22 education-concept themes (doc's own
  // §4-2 breakdown lists 22 concrete concepts, above the stated "18" summary
  // total — a real internal inconsistency in the source doc; built the full
  // 22-item list rather than truncating, since more coverage only helps stay
  // clear of the 12-item fallback threshold, see lyricThemesForArchetype).
  // Appended here (not a separate array) since lyricThemesForArchetype's own
  // `source` selection doesn't distinguish 'kids' from 'kr-kids-song' —
  // suitedArchetypes filtering is what keeps these two pools apart; the
  // existing 14 above are untouched.
  {
    id: 'krkids-jump-along',
    labelKo: '동그랗게 모여 콩콩 뛰기',
    scene: 'jumping in place to the beat during circle time',
    emotionalArc: 'shy hesitation turning into bouncy group energy',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'energetic',
    educationConcept: 'jumping along with the beat',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-clap-follow-along',
    labelKo: '선생님 따라 손뼉 치기',
    scene: "clapping hands and following the leader's simple moves",
    emotionalArc: 'careful watching becoming confident copying',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    moodTag: 'energetic',
    educationConcept: 'following a clapping pattern',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-brushing-teeth',
    labelKo: '거울 보며 이 닦기',
    scene: 'brushing teeth carefully in front of the bathroom mirror before bed',
    emotionalArc: 'sleepy reluctance turning into proud completion',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'calm',
    educationConcept: 'brushing teeth thoroughly',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-washing-hands',
    labelKo: '밥 먹기 전 손 씻기',
    scene: 'washing hands with soap and warm water before a meal',
    emotionalArc: 'distraction settling into careful habit',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'washing hands before eating',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-tidying-toys',
    labelKo: '놀이 끝나고 장난감 정리',
    scene: 'putting toys back in the basket after playtime ends',
    emotionalArc: 'reluctant pause turning into satisfied order',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'tidying up toys after playing',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-mealtime-manners',
    labelKo: '식탁에 앉아 밥 먹기',
    scene: 'sitting at the table and eating a meal without fuss',
    emotionalArc: 'wandering attention settling into happy focus',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'eating a meal at the table',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-count-to-five',
    labelKo: '손가락으로 다섯까지 세기',
    scene: 'counting fingers one by one up to five during a game',
    emotionalArc: 'careful concentration becoming proud counting',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'counting from one to five',
    frameId: 'count-invite'
  },
  {
    id: 'krkids-find-the-color',
    labelKo: '방 안에서 색깔 찾기',
    scene: 'pointing at toys around the room to find each color',
    emotionalArc: 'curious searching turning into cheerful discovery',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'naming basic colors',
    frameId: 'list-question'
  },
  {
    id: 'krkids-shape-hunt',
    labelKo: '동그라미 세모 네모 찾기',
    scene: 'finding circles, triangles, and squares hidden around the room',
    emotionalArc: 'puzzled looking turning into excited recognition',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    moodTag: 'energetic',
    educationConcept: 'naming basic shapes',
    frameId: 'list-question'
  },
  {
    id: 'krkids-animal-sounds',
    labelKo: '동물 소리 흉내내기',
    scene: 'imitating farm animal sounds one after another in a picture book',
    emotionalArc: 'quiet looking turning into giggly imitation',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'imitating animal sounds',
    frameId: 'list-question'
  },
  {
    id: 'krkids-dinosaur-parade',
    labelKo: '공룡 흉내내며 걷기',
    scene: 'marching like different dinosaurs across the living room floor',
    emotionalArc: 'shy first steps turning into roaring confidence',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    moodTag: 'energetic',
    educationConcept: 'naming dinosaur types',
    frameId: 'list-question'
  },
  {
    id: 'krkids-bus-and-train',
    labelKo: '창밖으로 버스와 기차 보기',
    scene: 'watching a bus and a train pass by from a window seat',
    emotionalArc: 'quiet watching turning into excited pointing',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'naming vehicles by sound',
    frameId: 'list-question'
  },
  {
    id: 'krkids-hospital-checkup',
    labelKo: '인형 청진기로 진찰 놀이',
    scene: "pretending to be a doctor checking a stuffed animal's heartbeat",
    emotionalArc: 'careful worry turning into gentle confidence',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    educationConcept: 'roleplaying a doctor visit',
    frameId: 'list-question'
  },
  {
    id: 'krkids-firefighter-rescue',
    labelKo: '소방차 타고 구조하러 가기',
    scene: 'pretending to drive a fire truck to rescue a toy cat from a tree',
    emotionalArc: 'urgent excitement turning into proud rescue',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    moodTag: 'energetic',
    educationConcept: 'roleplaying a firefighter rescue',
    frameId: 'list-question'
  },
  {
    id: 'krkids-market-shopping',
    labelKo: '장난감 시장에서 장보기',
    scene: 'pretending to shop for fruit at a small toy market stand',
    emotionalArc: 'careful choosing turning into cheerful sharing',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    educationConcept: 'roleplaying grocery shopping',
    frameId: 'list-question'
  },
  {
    id: 'krkids-kindergarten-morning',
    labelKo: '유치원 아침 인사 시간',
    scene: 'lining up for morning greeting time at kindergarten',
    emotionalArc: 'morning nerves turning into friendly belonging',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    educationConcept: 'roleplaying kindergarten routine',
    frameId: 'list-question'
  },
  {
    id: 'krkids-color-in-english',
    labelKo: '색깔 한 개씩 영어로 배우기',
    scene: 'naming a color in Korean and then again in English',
    emotionalArc: 'careful repeating turning into proud recall',
    suitedArchetypes: ['kr-kids-song'],
    languages: ['korean'],
    ageTier: 'kids-t3',
    educationConcept: 'learning a color word in English',
    frameId: 'list-question',
    learningLanguagePair: { base: 'korean', target: 'english' }
  },
  {
    id: 'krkids-number-in-english',
    labelKo: '숫자 한 개씩 영어로 배우기',
    scene: 'counting a number in Korean and then again in English',
    emotionalArc: 'careful repeating turning into proud recall',
    suitedArchetypes: ['kr-kids-song'],
    languages: ['korean'],
    ageTier: 'kids-t3',
    educationConcept: 'learning a number word in English',
    frameId: 'count-invite',
    learningLanguagePair: { base: 'korean', target: 'english' }
  },
  {
    id: 'krkids-greeting-in-english',
    labelKo: '인사말 한 개씩 영어로 배우기',
    scene: 'waving hello and saying a greeting in Korean and English',
    emotionalArc: 'shy waving turning into cheerful greeting',
    suitedArchetypes: ['kr-kids-song'],
    languages: ['korean'],
    ageTier: 'kids-t3',
    educationConcept: 'learning a greeting word in English',
    frameId: 'list-question',
    learningLanguagePair: { base: 'korean', target: 'english' }
  },
  {
    id: 'krkids-lullaby-goodnight',
    labelKo: '자장가 들으며 잠들기',
    scene: 'being tucked into bed while a soft lullaby plays',
    emotionalArc: 'restless energy settling into peaceful sleep',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t1',
    moodTag: 'calm',
    educationConcept: 'settling down for a lullaby',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-naptime-blanket',
    labelKo: '이불 덮고 낮잠 자기',
    scene: 'curling up under a small blanket for afternoon nap time',
    emotionalArc: 'busy morning winding down into quiet rest',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'calm',
    educationConcept: 'settling down for a nap',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-calm-breathing',
    labelKo: '천천히 숨 쉬며 마음 가라앉히기',
    scene: 'taking slow deep breaths to feel calm after playtime',
    emotionalArc: 'excited fluster settling into steady calm',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'calm',
    educationConcept: 'calming down with slow breathing',
    frameId: 'instruct-repeat'
  },
  // 지시문 14 (Phase 2 TASK B) — 28 new entries, 22 -> 50, each a new
  // educationConcept ("한 곡에 개념 하나" — see LyricTheme.educationConcept's
  // own doc comment) not yet covered above.
  {
    id: 'krkids-count-six-to-ten',
    labelKo: '6부터 10까지 세기',
    scene: 'stacking one more block on a tower and counting all the way up past five to ten',
    emotionalArc: 'careful counting building into a proud finished tower',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'counting from six to ten',
    frameId: 'count-invite'
  },
  {
    id: 'krkids-days-of-week-song',
    labelKo: '요일 노래',
    scene: 'flipping a calendar page each morning and singing the name of the new day',
    emotionalArc: 'sleepy morning waking into a cheerful routine',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    educationConcept: 'naming the days of the week',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-seasons-of-year',
    labelKo: '사계절 노래',
    scene: 'holding up four pictures of falling snow, blooming flowers, bright sun, and red leaves in turn',
    emotionalArc: 'curious sorting becoming confident recognition',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    educationConcept: 'naming the four seasons',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-weather-naming',
    labelKo: '오늘의 날씨',
    scene: 'looking out the window each morning and deciding whether it is sunny, rainy, or snowy outside',
    emotionalArc: 'uncertain guessing turning into confident naming',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'naming basic weather types',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-body-parts-song',
    labelKo: '몸 부분 이름',
    scene: 'touching head, shoulders, knees, and toes one at a time in a simple call-and-response song',
    emotionalArc: 'shy first touches turning into energetic full-body play',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t1',
    moodTag: 'energetic',
    educationConcept: 'naming basic body parts',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-family-members-song',
    labelKo: '가족 이름 부르기',
    scene: 'pointing to each person in a family photo and naming who they are one by one',
    emotionalArc: 'quiet pointing warming into proud recitation',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'naming family members',
    frameId: 'list-question'
  },
  {
    id: 'krkids-opposites-big-small',
    labelKo: '크다 작다 반대말',
    scene: 'holding up a big ball and a small ball side by side and calling out which is which',
    emotionalArc: 'careful comparing becoming playful certainty',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'learning opposite words like big and small',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-sharing-taking-turns',
    labelKo: '순서대로 나누기',
    scene: 'passing one favorite toy back and forth with a friend, waiting patiently for a turn',
    emotionalArc: 'reluctant waiting softening into generous sharing',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    moodTag: 'calm',
    educationConcept: 'sharing and taking turns',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-saying-sorry',
    labelKo: '미안하다고 말하기',
    scene: 'bumping into a friend by accident and learning to say sorry before hugging it out',
    emotionalArc: 'awkward guilt resolving into warm forgiveness',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    moodTag: 'calm',
    educationConcept: 'saying sorry and making up',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-tying-shoelaces',
    labelKo: '신발끈 묶기',
    scene: 'looping two shoelace ends slowly into a bow, trying again after it comes undone',
    emotionalArc: 'frustrated fumbling turning into proud mastery',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    educationConcept: 'tying shoelaces',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-crossing-street-safely',
    labelKo: '안전하게 길 건너기',
    scene: 'stopping at a curb to look left and right before crossing at the crosswalk with a grown-up',
    emotionalArc: 'careful caution becoming confident safe steps',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'crossing the street safely',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-recycling-sorting',
    labelKo: '분리수거 하기',
    scene: 'sorting bottles, paper, and cans into three different colored bins at home',
    emotionalArc: 'confusing choices turning into satisfying order',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    educationConcept: 'sorting recycling correctly',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-planting-seed-growing',
    labelKo: '씨앗 심고 키우기',
    scene: 'pressing a small seed into a paper cup of soil and watering it every day to watch it grow',
    emotionalArc: 'impatient waiting rewarded with delighted discovery',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'planting a seed and watching it grow',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-getting-dressed-independently',
    labelKo: '혼자 옷 입기',
    scene: 'buttoning a shirt slowly without help and feeling proud of every button done alone',
    emotionalArc: 'clumsy struggle turning into independent pride',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'getting dressed independently',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-table-setting-roleplay',
    labelKo: '식탁 차리기 놀이',
    scene: 'placing a plate, cup, and spoon carefully at each seat before pretend dinner begins',
    emotionalArc: 'careful placing becoming proud helpful contribution',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'roleplaying setting the table',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-postal-worker-roleplay',
    labelKo: '우체부 놀이',
    scene: 'delivering pretend letters door to door in a cardboard mail bag around the living room',
    emotionalArc: 'busy pretend errand becoming joyful purpose',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    moodTag: 'energetic',
    educationConcept: 'roleplaying a postal worker',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-farmer-roleplay',
    labelKo: '농부 놀이',
    scene: 'pretending to plant, water, and harvest a toy vegetable patch in the backyard',
    emotionalArc: 'imaginative labor turning into proud harvest pride',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    educationConcept: 'roleplaying a farmer',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-teacher-roleplay',
    labelKo: '선생님 놀이',
    scene: 'standing at a small chalkboard and teaching stuffed animals their letters for the day',
    emotionalArc: 'shy first lesson growing into confident teaching',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    educationConcept: 'roleplaying a teacher',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-baker-roleplay',
    labelKo: '빵집 아저씨 놀이',
    scene: 'shaping pretend dough into little loaves and lining them up on a toy bakery tray',
    emotionalArc: 'messy play becoming a proud finished display',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'roleplaying a baker',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-english-animal-word',
    labelKo: '영어 동물 단어',
    scene: 'pointing at a picture book animal and repeating its English name slowly together',
    emotionalArc: 'careful repetition turning into confident recall',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    learningLanguagePair: { base: 'korean', target: 'english' },
    educationConcept: 'learning an animal word in English',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-english-family-word',
    labelKo: '영어 가족 단어',
    scene: 'pointing to mom and dad in a photo and practicing the English words for each',
    emotionalArc: 'shy mispronunciation turning into proud correct recall',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    learningLanguagePair: { base: 'korean', target: 'english' },
    educationConcept: 'learning a family word in English',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-english-body-part-word',
    labelKo: '영어 신체 단어',
    scene: 'touching a nose and an ear while practicing their English names in a simple song',
    emotionalArc: 'giggly mixing up turning into confident naming',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    learningLanguagePair: { base: 'korean', target: 'english' },
    educationConcept: 'learning a body-part word in English',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-rhyming-word-game',
    labelKo: '라임 말놀이',
    scene: 'trading silly rhyming words back and forth until one makes everybody laugh',
    emotionalArc: 'careful listening turning into playful wordplay',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t3',
    moodTag: 'energetic',
    educationConcept: 'playing a rhyming word game',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-singing-pitch-high-low',
    labelKo: '높은음 낮은음 노래',
    scene: 'raising a hand high for a high note and low for a low note while singing along',
    emotionalArc: 'uncertain guessing becoming confident musical play',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'recognizing high and low pitch',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-musical-instrument-naming',
    labelKo: '악기 이름 맞히기',
    scene: 'shaking a tambourine and tapping a drum, naming each instrument by its sound',
    emotionalArc: 'curious listening turning into confident naming',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'naming musical instruments by sound',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-traffic-light-rule',
    labelKo: '신호등 규칙',
    scene: 'watching a toy traffic light change from red to green before walking a pretend crosswalk',
    emotionalArc: 'careful watching becoming confident rule-following',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    educationConcept: 'learning the traffic light rule',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-washing-face-morning',
    labelKo: '아침 세수하기',
    scene: 'splashing cool water on a sleepy face at the bathroom sink to wake up for the day',
    emotionalArc: 'groggy reluctance turning into refreshed readiness',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t1',
    educationConcept: 'washing your face in the morning',
    frameId: 'instruct-repeat'
  },
  {
    id: 'krkids-cleaning-up-spilled-milk',
    labelKo: '흘린 우유 닦기',
    scene: 'wiping up a spilled cup of milk with a cloth without any fuss and trying again carefully',
    emotionalArc: 'startled worry settling into calm capable cleanup',
    suitedArchetypes: ['kr-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'calm',
    educationConcept: 'cleaning up a small spill calmly',
    frameId: 'instruct-repeat'
  },
  // TASK F1 §4 — jp-kids workspace's 23 themes (doc's own §4-1 breakdown
  // lists 23 concrete scenes, above the stated "18" floor — same
  // over-delivery choice E1 made for the same reason: more coverage only
  // helps stay clear of the 12-item fallback threshold). Appended here (not
  // a separate array), same reasoning as E1's krkids-* block above —
  // suitedArchetypes is what keeps jp-kids's pool apart from kr-kids's.
  // NONE of these set educationConcept (§4-3/§12 item 3) — onomatopoeiaGroup
  // is jp-kids's own axis instead, referencing data/onomatopoeia.ts ids.
  {
    id: 'jpkids-teasobi-fingerplay',
    labelKo: '손가락 놀이',
    scene: 'wiggling fingers one by one in a simple finger-play rhyme',
    emotionalArc: 'careful watching turning into giggly copying',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t1',
    onomatopoeiaGroup: 'motion-wave',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-teasobi-clap-play',
    labelKo: '박수 놀이',
    scene: 'clapping hands together in a simple call-and-response rhythm',
    emotionalArc: 'shy first claps turning into confident group clapping',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t1',
    moodTag: 'energetic',
    onomatopoeiaGroup: 'motion-clap',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-teasobi-face-to-face',
    labelKo: '두 사람이 마주 보고',
    scene: 'sitting face to face with a partner, trading a simple hand-play pattern',
    emotionalArc: 'careful timing turning into shared laughter',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    onomatopoeiaGroup: 'motion-wave',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-taiso-morning',
    labelKo: '아침 체조',
    scene: 'stretching arms and legs together during morning exercise time',
    emotionalArc: 'sleepy stillness waking into bright energy',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'energetic',
    onomatopoeiaGroup: 'motion-stomp',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-taiso-two-step-dance',
    labelKo: '두 걸음 춤',
    scene: 'following a simple two-step dance move in a circle with friends',
    emotionalArc: 'watching from the side turning into joining the circle',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'energetic',
    onomatopoeiaGroup: 'motion-jump',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-onomatopoeia-jumping-sound',
    labelKo: '뛰는 소리',
    scene: 'hopping across the room and naming the jumping sound out loud',
    emotionalArc: 'quiet stillness bursting into bouncy energy',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t1',
    moodTag: 'energetic',
    onomatopoeiaGroup: 'motion-jump',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-onomatopoeia-spinning-sound',
    labelKo: '도는 소리',
    scene: 'spinning slowly in place and naming the spinning sound out loud',
    emotionalArc: 'careful balance turning into dizzy giggles',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'energetic',
    onomatopoeiaGroup: 'motion-spin',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-onomatopoeia-eating-sound',
    labelKo: '먹는 소리',
    scene: 'sharing a snack and naming the eating sound out loud together',
    emotionalArc: 'quiet nibbling turning into cheerful sound-play',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t1',
    onomatopoeiaGroup: 'eat-chew',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-takoyaki-sizzle',
    labelKo: '타코야키 지글지글',
    scene: 'watching takoyaki batter sizzle and turn at a small festival stall',
    emotionalArc: 'hungry watching turning into excited anticipation',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    onomatopoeiaGroup: 'eat-sizzle',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-bus-ride',
    labelKo: '버스 타고 붕붕',
    scene: 'riding a bus and waving out the window as it rolls along',
    emotionalArc: 'quiet sitting turning into excited window-waving',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'energetic',
    onomatopoeiaGroup: 'vehicle-bus',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-train-ride',
    labelKo: '기차 타고 덜컹덜컹',
    scene: 'riding a train and rocking gently along with its rhythm',
    emotionalArc: 'quiet curiosity turning into rhythmic delight',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t1',
    onomatopoeiaGroup: 'vehicle-train',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-animal-parade',
    labelKo: '동물 흉내 행진',
    scene: 'hopping and waddling like different animals in a line at the zoo',
    emotionalArc: 'shy first hop turning into a joyful animal parade',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'energetic',
    onomatopoeiaGroup: 'motion-jump',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-pajama-change',
    labelKo: '잠옷 갈아입기',
    scene: 'changing into soft pajamas and getting ready for bed',
    emotionalArc: 'busy wiggling settling into cozy readiness',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t1',
    moodTag: 'calm',
    onomatopoeiaGroup: 'emotion-sleepy',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-teeth-brushing',
    labelKo: '이 닦기',
    scene: 'brushing teeth carefully in front of the bathroom mirror',
    emotionalArc: 'sleepy reluctance turning into proud completion',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'calm',
    onomatopoeiaGroup: 'motion-scrub',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-tidying-up',
    labelKo: '장난감 정리',
    scene: 'wiping the table and putting toys back after playtime',
    emotionalArc: 'reluctant pause turning into satisfied order',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    onomatopoeiaGroup: 'motion-wipe',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-greeting-habit',
    labelKo: '인사 연습',
    scene: 'bowing and greeting a friend cheerfully at the door',
    emotionalArc: 'shy hesitation turning into a bright greeting',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    onomatopoeiaGroup: 'emotion-smile',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-cherry-blossom',
    labelKo: '벚꽃 흩날리기',
    scene: 'watching pink cherry blossom petals spin and drift down in the park',
    emotionalArc: 'quiet wonder turning into a sparkling chorus',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    onomatopoeiaGroup: 'motion-spin',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-summer-festival',
    labelKo: '여름 축제',
    scene: 'stomping along to festival drums with a paper fan in hand',
    emotionalArc: 'wide-eyed excitement turning into joyful dancing',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'energetic',
    onomatopoeiaGroup: 'motion-stomp',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-autumn-leaves',
    labelKo: '단풍잎 흔들기',
    scene: 'waving a bright red maple leaf overhead while walking through the park',
    emotionalArc: 'curious collecting turning into a cheerful wave',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    onomatopoeiaGroup: 'motion-wave',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-snow-play',
    labelKo: '눈밭에서 놀기',
    scene: 'hopping through fresh snow and catching snowflakes with open hands',
    emotionalArc: 'careful first steps turning into excited snow-play',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t1',
    moodTag: 'energetic',
    onomatopoeiaGroup: 'emotion-excited',
    frameId: 'list-question'
  },
  {
    id: 'jpkids-color-in-english',
    labelKo: '색깔 한 개씩 영어로 배우기',
    scene: 'naming a color in Japanese and then again in English',
    emotionalArc: 'careful repeating turning into proud recall',
    suitedArchetypes: ['jp-kids-song'],
    languages: ['japanese'],
    ageTier: 'kids-t3',
    frameId: 'list-question',
    learningLanguagePair: { base: 'japanese', target: 'english' }
  },
  {
    id: 'jpkids-number-in-english',
    labelKo: '숫자 한 개씩 영어로 배우기',
    scene: 'counting a number in Japanese and then again in English',
    emotionalArc: 'careful repeating turning into proud recall',
    suitedArchetypes: ['jp-kids-song'],
    languages: ['japanese'],
    ageTier: 'kids-t3',
    frameId: 'count-invite',
    learningLanguagePair: { base: 'japanese', target: 'english' }
  },
  {
    id: 'jpkids-greeting-in-english',
    labelKo: '인사말 한 개씩 영어로 배우기',
    scene: 'waving hello and saying a greeting in Japanese and English',
    emotionalArc: 'shy waving turning into a cheerful greeting',
    suitedArchetypes: ['jp-kids-song'],
    languages: ['japanese'],
    ageTier: 'kids-t3',
    frameId: 'list-question',
    learningLanguagePair: { base: 'japanese', target: 'english' }
  },
  // v5.8 (audit follow-up, docs/v58-report.md) — real measurement found
  // jp-kids had only 2 moodTag:'calm' themes (jpkids-pajama-change/
  // jpkids-teeth-brushing) against kr-kids's own 4, so oyasumi-mae-no-uta
  // (jp-kids's own "before bedtime" channel) had noticeably less genuinely
  // calm content to draw from even after core/lyricDiversityPlan.ts's
  // preferCalm weighting landed. These 3 mirror kr-kids's own
  // krkids-lullaby-goodnight/krkids-naptime-blanket/krkids-calm-breathing
  // scene shapes directly (same frameId 'instruct-repeat' so they join the
  // same frame-share reservation those two calm themes already benefit
  // from), translated to a genuinely Japanese setting (futon, not a
  // Western-style bed) rather than a literal translation of the Korean
  // scene text.
  {
    id: 'jpkids-lullaby-goodnight',
    labelKo: '자장가 들으며 잠들기',
    scene: 'being tucked into a futon while a soft lullaby hums nearby',
    emotionalArc: 'restless energy settling into peaceful sleep',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t1',
    moodTag: 'calm',
    onomatopoeiaGroup: 'emotion-sleepy',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-naptime-blanket',
    labelKo: '이불 덮고 낮잠 자기',
    scene: 'curling up under a soft blanket for afternoon nap time',
    emotionalArc: 'busy morning winding down into quiet rest',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'calm',
    onomatopoeiaGroup: 'emotion-sleepy',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-calm-breathing',
    labelKo: '천천히 숨 쉬며 마음 가라앉히기',
    scene: 'taking slow deep breaths together to feel calm after playtime',
    emotionalArc: 'excited fluster settling into steady calm',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'calm',
    frameId: 'instruct-repeat'
  },
  // 지시문 14 (Phase 2 TASK B) — 24 new entries, 25 -> 49, each a distinct
  // scene family from the 25 above. Prioritizes onomatopoeiaGroup ids
  // (data/onomatopoeia.ts) not yet used by any existing jp-kids entry
  // (motion-tiptoe, eat-bite/slurp/crunch/lick, vehicle-car/boat/plane/bike,
  // emotion-nervous/happy/proud) before reusing an already-represented group
  // on a genuinely new scene.
  {
    id: 'jpkids-mochi-pounding-play',
    labelKo: '떡메치기 놀이',
    scene: 'taking a gentle turn with a small wooden mallet during a New Year mochi-pounding celebration',
    emotionalArc: 'nervous first swing turning into joyful rhythm',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t3',
    moodTag: 'energetic',
    onomatopoeiaGroup: 'motion-stomp',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-furoshiki-wrapping-game',
    labelKo: '후로시키 보자기 놀이',
    scene: 'folding a colorful cloth furoshiki around a small gift and tying the corners into a neat knot',
    emotionalArc: 'careful folding becoming proud presentation',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t3',
    onomatopoeiaGroup: 'motion-wipe',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-tanabata-wish-star',
    labelKo: '칠석 소원 별',
    scene: 'writing a small wish on a colorful strip of paper and tying it to a tanabata bamboo branch',
    emotionalArc: 'quiet hoping opening into bright wonder',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t3',
    onomatopoeiaGroup: 'emotion-excited',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-newyear-kite-flying',
    labelKo: '새해 연날리기',
    scene: 'running across an open field to launch a New Year kite into a cold clear sky',
    emotionalArc: 'nervous first pull steadying into proud control',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'energetic',
    onomatopoeiaGroup: 'vehicle-plane',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-bathtime-rubber-duck',
    labelKo: '목욕 시간 오리 인형',
    scene: 'floating a small rubber duck through bathtub bubbles and steering it past a washcloth island',
    emotionalArc: 'splashy play settling into calm bedtime quiet',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t1',
    moodTag: 'calm',
    onomatopoeiaGroup: 'vehicle-boat',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-shrine-hatsumode-clap',
    labelKo: '신사 참배 손뼉',
    scene: 'clapping twice softly at a small shrine visit and bowing before making a quiet wish',
    emotionalArc: 'shy unfamiliar ritual becoming proud participation',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t3',
    onomatopoeiaGroup: 'motion-clap',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-bubble-blowing-shabon',
    labelKo: '비눗방울 놀이',
    scene: 'blowing soap bubbles into the yard and chasing the biggest one toward the fence',
    emotionalArc: 'curious blowing turning into giggly chasing',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t1',
    onomatopoeiaGroup: 'motion-wave',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-taiko-drum-practice',
    labelKo: '타이코 북 연습',
    scene: 'striking a small taiko drum in a simple rhythm during a group music lesson',
    emotionalArc: 'hesitant first hit growing into confident rhythm',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t3',
    moodTag: 'energetic',
    onomatopoeiaGroup: 'motion-stomp',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-onigiri-making',
    labelKo: '주먹밥 만들기',
    scene: 'shaping warm rice into a small triangle onigiri with careful little hands',
    emotionalArc: 'messy first attempt becoming a proud homemade snack',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    onomatopoeiaGroup: 'eat-chew',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-tsuyu-puddle-jumping',
    labelKo: '장마철 물웅덩이 점프',
    scene: 'jumping into small puddles in bright rain boots during the early summer rainy season',
    emotionalArc: 'careful steps becoming playful splashing confidence',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t1',
    moodTag: 'energetic',
    onomatopoeiaGroup: 'motion-jump',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-origami-crane-folding',
    labelKo: '종이학 접기',
    scene: 'folding careful creases into a small paper crane at the kitchen table',
    emotionalArc: 'frustrated folding resolving into a proud finished shape',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t3',
    moodTag: 'calm',
    onomatopoeiaGroup: 'motion-wipe',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-airplane-pretend-flying',
    labelKo: '비행기 놀이',
    scene: 'stretching both arms out like wings and running across the yard pretending to be an airplane',
    emotionalArc: 'wobbly wing-arms steadying into soaring joy',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'energetic',
    onomatopoeiaGroup: 'emotion-happy',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-bicycle-training-wheels',
    labelKo: '보조바퀴 자전거',
    scene: 'pedaling a bicycle with training wheels down a quiet street while a parent jogs alongside',
    emotionalArc: 'wobbly nerves settling into steady balance',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    onomatopoeiaGroup: 'vehicle-bike',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-toy-car-driving-pretend',
    labelKo: '장난감 자동차 운전 놀이',
    scene: 'gripping a toy steering wheel and making engine sounds while driving around the living room',
    emotionalArc: 'quiet solo play becoming an imaginative adventure',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t1',
    onomatopoeiaGroup: 'vehicle-car',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-apple-slice-biting',
    labelKo: '사과 조각 베어먹기',
    scene: 'biting into a crisp apple slice at snack time and grinning at the loud crunch',
    emotionalArc: 'shy first bite turning into delighted crunching',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t1',
    onomatopoeiaGroup: 'eat-bite',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-udon-noodle-slurping',
    labelKo: '우동 후루룩 먹기',
    scene: 'slurping a long noodle from a warm bowl of udon and laughing when it splashes back',
    emotionalArc: 'messy first slurp becoming happy giggling',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    onomatopoeiaGroup: 'eat-slurp',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-senbei-cracker-crunching',
    labelKo: '센베이 과자 아삭아삭',
    scene: 'crunching through a rice cracker one careful bite at a time during snack time',
    emotionalArc: 'careful nibbling becoming satisfied munching',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    onomatopoeiaGroup: 'eat-crunch',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-icecream-cone-licking',
    labelKo: '아이스크림 콘 핥아먹기',
    scene: 'licking around the edge of a melting ice cream cone before it drips onto small fingers',
    emotionalArc: 'urgent rushing turning into slow happy enjoyment',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t1',
    onomatopoeiaGroup: 'eat-lick',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-first-day-school-nerves',
    labelKo: '입학 첫날 긴장',
    scene: 'standing at the school gate on the very first day, gripping a new backpack strap tightly',
    emotionalArc: 'nervous stillness opening into brave first steps',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t3',
    onomatopoeiaGroup: 'emotion-nervous',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-skipping-to-grandmas-house',
    labelKo: '할머니댁 가는 길 콩콩 걷기',
    scene: "skipping happily down a familiar path on the way to visit grandma's house",
    emotionalArc: 'restless energy turning into bright anticipation',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'energetic',
    onomatopoeiaGroup: 'emotion-happy',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-proud-drawing-showing',
    labelKo: '그림 자랑하기',
    scene: 'holding up a finished crayon drawing proudly to show a parent right after the last stroke',
    emotionalArc: 'quiet concentration bursting into proud display',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    onomatopoeiaGroup: 'emotion-proud',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-tiptoe-quiet-game',
    labelKo: '살금살금 걷기 놀이',
    scene: 'tiptoeing carefully past a sleeping pet so as not to wake it up',
    emotionalArc: 'careful stillness becoming a fun secret mission',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'calm',
    onomatopoeiaGroup: 'motion-tiptoe',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-lantern-festival-walk',
    labelKo: '등불 축제 산책',
    scene: "walking slowly under paper lanterns at an evening festival, holding a grown-up's hand tightly",
    emotionalArc: 'wide-eyed wonder settling into cozy closeness',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    moodTag: 'calm',
    onomatopoeiaGroup: 'emotion-excited',
    frameId: 'instruct-repeat'
  },
  {
    id: 'jpkids-morning-greeting-bow',
    labelKo: '아침 인사 허리숙이기',
    scene: 'bowing politely and calling out a bright morning greeting to a teacher at the school gate',
    emotionalArc: 'shy quiet morning opening into cheerful connection',
    suitedArchetypes: ['jp-kids-song'],
    ageTier: 'kids-t2',
    onomatopoeiaGroup: 'emotion-smile',
    frameId: 'instruct-repeat'
  }
];

const KIDS_ENGINE_THEME_BY_ID: Record<string, KidsLyricThemeHint> = {
  'kids-playground-slide-after-school': 'play',
  'kids-rain-boots-puddles': 'season',
  'kids-first-snow-mittens': 'season',
  'kids-lunchbox-note': 'family',
  'kids-bubble-yard': 'play',
  'kids-crayon-rainbow-table': 'hangul',
  'kids-school-gate-high-five': 'school',
  'kids-picture-book-blanket': 'friend',
  'kids-toy-train-carpet': 'play',
  'kids-counting-stairs': 'counting',
  'kids-animal-sticker-parade': 'animal',
  'kids-music-class-bells': 'school',
  'kids-garden-butterfly': 'animal',
  'kids-pajama-moon-window': 'family',
  // TASK E1 §4 — kr-kids's 22 new themes, mapped to the closest of D1's
  // fixed 8 KidsLyricThemeHint values (not extended — see that type's own
  // doc comment; 'hangul' is the pre-existing "letters/language learning"
  // hint, reused here for the 3 bilingual-English themes).
  'krkids-jump-along': 'play',
  'krkids-clap-follow-along': 'play',
  'krkids-brushing-teeth': 'family',
  'krkids-washing-hands': 'family',
  'krkids-tidying-toys': 'family',
  'krkids-mealtime-manners': 'family',
  'krkids-count-to-five': 'counting',
  'krkids-find-the-color': 'counting',
  'krkids-shape-hunt': 'counting',
  'krkids-animal-sounds': 'animal',
  'krkids-dinosaur-parade': 'animal',
  'krkids-bus-and-train': 'play',
  'krkids-hospital-checkup': 'friend',
  'krkids-firefighter-rescue': 'friend',
  'krkids-market-shopping': 'friend',
  'krkids-kindergarten-morning': 'school',
  'krkids-color-in-english': 'hangul',
  'krkids-number-in-english': 'hangul',
  'krkids-greeting-in-english': 'hangul',
  'krkids-lullaby-goodnight': 'family',
  'krkids-naptime-blanket': 'family',
  'krkids-calm-breathing': 'family',
  // TASK F1 §4 — jp-kids's 23 new themes, same closest-of-8-hints mapping E1 used.
  'jpkids-teasobi-fingerplay': 'play',
  'jpkids-teasobi-clap-play': 'play',
  'jpkids-teasobi-face-to-face': 'friend',
  'jpkids-taiso-morning': 'play',
  'jpkids-taiso-two-step-dance': 'play',
  'jpkids-onomatopoeia-jumping-sound': 'play',
  'jpkids-onomatopoeia-spinning-sound': 'play',
  'jpkids-onomatopoeia-eating-sound': 'family',
  'jpkids-takoyaki-sizzle': 'family',
  'jpkids-bus-ride': 'play',
  'jpkids-train-ride': 'play',
  'jpkids-animal-parade': 'animal',
  'jpkids-pajama-change': 'family',
  'jpkids-teeth-brushing': 'family',
  'jpkids-tidying-up': 'family',
  'jpkids-greeting-habit': 'friend',
  'jpkids-cherry-blossom': 'season',
  'jpkids-summer-festival': 'season',
  'jpkids-autumn-leaves': 'season',
  'jpkids-snow-play': 'season',
  'jpkids-color-in-english': 'hangul',
  'jpkids-number-in-english': 'hangul',
  'jpkids-greeting-in-english': 'hangul',
  // v5.8 (audit follow-up) — same 'family' mapping kr-kids's own 3 calm
  // themes already use (krkids-lullaby-goodnight/naptime-blanket/
  // calm-breathing, above) — composeKidsLyrics has no dedicated
  // sleep/calm KidsLyricTheme bucket (only animal/season/family/friend/
  // play/school/counting/hangul exist), so 'family' is the closest
  // available real content pool, not a new one invented here.
  'jpkids-lullaby-goodnight': 'family',
  'jpkids-naptime-blanket': 'family',
  'jpkids-calm-breathing': 'family'
};

export function normalizeCustomScene(scene: string | undefined): string {
  return (scene || '').replace(/\s+/g, ' ').trim();
}

function customThemeFromScene(scene: string | undefined, archetype?: ChannelArchetype): LyricTheme | undefined {
  const normalized = normalizeCustomScene(scene);
  if (!normalized) return undefined;
  return {
    id: 'custom-lyric-scene',
    labelKo: '직접 입력',
    scene: normalized,
    emotionalArc: 'follow the user-provided scene with a concrete beginning, turn, and chorus release',
    suitedArchetypes: archetype ? [archetype] : undefined
  };
}

function languageAllows(theme: LyricTheme, language: LyricLanguage | undefined): boolean {
  if (!theme.languages?.length || !language || language === 'bilingual') return true;
  return theme.languages.includes(language);
}

export function lyricThemesForArchetype(archetype: ChannelArchetype | undefined, customScene?: string, language?: LyricLanguage): LyricTheme[] {
  const custom = customThemeFromScene(customScene, archetype);
  const source = isKidsArchetype(archetype) ? kidsLyricThemes : adultLyricThemes;
  const suited = source.filter(theme => (!archetype || theme.suitedArchetypes?.includes(archetype)) && languageAllows(theme, language));
  const fallback = source.filter(theme => languageAllows(theme, language));
  const base = suited.length >= 12 ? suited : fallback;
  return custom ? [custom, ...base] : base;
}

/**
 * v5.8 (audit follow-up, docs/v58-report.md) — real measurement found a
 * channel promising calm content (`preferredMoods: ['calm-focus']`, e.g.
 * kr-kids's bedtime-lullaby-radio) still drew energetic-arc kids themes
 * (jump-along, dinosaur-parade, ...) just as often as any other, since
 * theme selection never read that signal at all — `moodTag` (this file's
 * own LyricTheme field) exists specifically to fix that. Excludes only
 * explicit `moodTag: 'energetic'` entries (most kids themes are
 * mood-neutral routine/education content and stay available); never
 * requires `moodTag: 'calm'`, so this can't collapse the pool down to just
 * the handful of explicitly-calm entries and lose variety. Guarded by the
 * same "≥12 or fall back" threshold `lyricThemesForArchetype` already uses
 * for its own suited/fallback split, so a future workspace whose calm-
 * filtered pool got too small would safely keep full variety rather than
 * silently starving.
 */
/**
 * 지시문 08 (TASK D) — `scenePlanningMode` (types.ts, already used by the
 * bridge path's own core/bridgeInstruction.ts#resolveScenePlanningMode) is
 * accepted here for the same real-root-cause reason described in that
 * module: two concepts sharing a channel/archetype used to draw from the
 * exact same fixed theme pool regardless of customConcept text. A first
 * attempt at this task widened 'concept-generated' mode to the FULL
 * unfiltered theme pool (152 themes, not just the ~40 archetype-suited
 * ones) — real measurement showed that did shrink cross-concept scene
 * collision, but at a real regression cost: most of that wider pool has no
 * frameId assigned (only the archetype-curated subsets are frame-tagged),
 * so allocateThemesByFrame's frame-diversity guarantee collapsed toward
 * the shared 'solitary-object' fallback frame — the EXACT "18/18 solitary-
 * object themes" failure tests/setDirector.test.ts's own v3.64 regression
 * guard exists to catch, now reached through a different path. Reverted
 * to the archetype-suited pool unconditionally (scenePlanningMode
 * currently has no behavioral effect here) — the real, verified,
 * non-regressing fix for cross-concept duplication lives in
 * core/lyricEngine.ts's lyricThemeSeedFor (지시문 68 TASK A-2 — NOT
 * seedForBlueprint, which deliberately still reads only channel.id/
 * projectTitle; see that function's own doc comment for why widening it
 * directly broke ~20 tests) and core/lyricDiversityPlan.ts's
 * allocateThemesByFrame (the within-frame starting index is now
 * seed-derived instead of always 0), both of which make two different
 * concepts draw a genuinely different SUBSET of the SAME frame-safe
 * archetype pool rather than widening the pool itself. (지시문 68 —
 * this comment previously claimed seedForBlueprint itself carried
 * customConcept; it never did. That false claim let setDirector.ts's
 * makeAllocations keep computing a concept-blind 'manual' lyricTheme
 * axis that silently overrode this real fix at generation time for
 * ~8 months — see 지시문 68 §1.2 for the full chain.)
 *
 * 지시문 10 (TASK B-4-1) — `customConcept` added to this Pick formally
 * (every real call site — core/lyricDiversityPlan.ts:296,
 * components/DiversityAllocationPanel.tsx:132, getLyricThemeById below —
 * already spreads a full `opts` that carries it; TypeScript's own Pick was
 * just silently dropping it from what this function's signature admits it
 * reads). Still not read by the pool-selection logic below, for the exact
 * regression-measured reason this doc comment already gives above — this is
 * the same "real, tested, honestly-labeled hook, not fabricated ahead of a
 * real trigger" status resolveLocalScenePlanningMode below already has.
 *
 * 지시문 14 (Phase 2 TASK A-1) — `avoid` is a SEPARATE, additive second
 * parameter, deliberately not folded into the widening/regression-prone
 * `scenePlanningMode` mechanism this doc comment already warns about above.
 * It only ever REMOVES ids/scenes from the already-archetype-suited,
 * already-frame-tagged pool `lyricThemesForArchetype` returns — it never
 * changes which SOURCE array is used or adds untagged themes, so it cannot
 * reproduce that regression (frame-diversity comes from the pool's own
 * frameId tags, which this filter never touches, only shrinks). This is the
 * real fix for 지시문 14 §2-1's own measured gap: "회피 목록이 배정에 쓰이지
 * 않는다" — batchPreallocation.ts's own buildLyricThemePlan call is the one
 * real caller that threads a caller-pre-fetched cross-pack avoid list
 * through here (see that file's own preallocateSongSlots `avoid` param doc
 * comment). Returns the filtered pool AS-IS, however small — this function
 * never decides whether that's "enough" (core/generationPreflight.ts's own
 * new hard-block condition does, so a caller can surface an actionable
 * Korean reason instead of this module silently degrading to duplicates).
 */
export function lyricThemesForOptions(
  opts: Pick<GenerationOptions, 'channel' | 'customLyricThemeScene' | 'lyricLanguage' | 'customConcept'> & { scenePlanningMode?: ScenePlanningMode },
  avoid?: { recentThemeIds?: string[]; recentSituations?: string[] }
): LyricTheme[] {
  const base = lyricThemesForArchetype(opts.channel.archetype, opts.customLyricThemeScene, opts.lyricLanguage);
  const moodFiltered = isKidsArchetype(opts.channel.archetype) && opts.channel.preferredMoods?.includes('calm-focus')
    ? (base.filter(theme => theme.moodTag !== 'energetic').length >= 12 ? base.filter(theme => theme.moodTag !== 'energetic') : base)
    : base;
  const avoidIds = avoid?.recentThemeIds?.length ? new Set(avoid.recentThemeIds) : undefined;
  const avoidScenes = avoid?.recentSituations?.length ? new Set(avoid.recentSituations.map(s => s.trim().toLowerCase())) : undefined;
  if (!avoidIds && !avoidScenes) return moodFiltered;
  return moodFiltered.filter(theme => !avoidIds?.has(theme.id) && !avoidScenes?.has(theme.scene.trim().toLowerCase()));
}

/** Real, local-generation equivalent of core/bridgeInstruction.ts's own resolveScenePlanningMode — same "a real customConcept means the fixed theme pool is no longer a hard, exclusive contract" intent, minus that function's bridge-only ConceptSceneContext requirement. Currently informational only (see lyricThemesForOptions's own doc comment on why widening the pool itself was reverted) — kept as a real, tested, honestly-labeled hook for a future, more targeted concept-aware pool strategy rather than deleted. */
export function resolveLocalScenePlanningMode(opts: Pick<GenerationOptions, 'customConcept'>): ScenePlanningMode {
  return opts.customConcept?.trim() ? 'concept-generated' : 'fixed-pool';
}

export function getLyricThemeById(
  id: string | undefined,
  opts: Pick<GenerationOptions, 'channel' | 'customLyricThemeScene' | 'lyricLanguage' | 'customConcept'> & { scenePlanningMode?: ScenePlanningMode }
): LyricTheme | undefined {
  if (!id) return undefined;
  return lyricThemesForOptions(opts).find(theme => theme.id === id);
}

export function getLyricThemeLabel(id: string | undefined, archetype?: ChannelArchetype, customScene?: string, language?: LyricLanguage): string {
  if (!id) return '-';
  return lyricThemesForArchetype(archetype, customScene, language).find(theme => theme.id === id)?.labelKo || id;
}

export function getLyricThemeScene(id: string | undefined, opts: Pick<GenerationOptions, 'channel' | 'customLyricThemeScene' | 'lyricLanguage' | 'customConcept'>): string {
  return getLyricThemeById(id, { ...opts, scenePlanningMode: resolveLocalScenePlanningMode(opts) })?.scene || '';
}

export function kidsLyricEngineThemeForLyricTheme(id: string | undefined): KidsLyricThemeHint | undefined {
  return id ? KIDS_ENGINE_THEME_BY_ID[id] : undefined;
}

/**
 * v4.5 (TASK D, 4-2) — shared with core/promiseAudit.ts's own situation-
 * promise detection (SITUATION_KEYWORD_RULES there mirrors this list
 * exactly) AND core/lyricDiversityPlan.ts's buildLyricThemePlan (which uses
 * this to bias frame allocation toward whatever situation the concept
 * actually named — see that file's own preferredFrameId doc comment). One
 * shared table instead of two independently-drifting copies. Deliberately
 * excludes 'solitary-object', this app's own default/no-signal frame,
 * which a concept never explicitly "promises" the way naming a dance or a
 * reunion does.
 */
export interface SituationFrameRule {
  frameId: string;
  labelKo: string;
  pattern: RegExp;
}

// 지시문 69 (TASK D) — 9개 규칙 전부 한국어/영어 패턴만 있어 컨셉500_
// 일본시니어.md 500항목 중 0개가 매칭됐다. dance-saturday/young-first-
// love/reunion-parting/letter-sending은 그 파일에서 실제로 확인한 표기
// (盆踊り의 踊, 初恋, 再会/別れ/駅のホーム, 手紙)를 그대로 쓴다. 나머지
// 5개(summer-night/city-lights/travel-window/shared-table/season-
// turning)는 이 표본에 해당 상황이 없어 표준 일본어 대역어를 추가했다
// (완료 보고에 명시 — "확인됨"과 "표준 번역"을 구분한다).
export const SITUATION_FRAME_RULES: SituationFrameRule[] = [
  { frameId: 'dance-saturday', labelKo: '토요일 밤 댄스', pattern: /춤추|댄스|무도회|dance|踊|舞踏会/i },
  { frameId: 'young-first-love', labelKo: '첫사랑', pattern: /첫사랑|풋사랑|설렘|고백|첫\s*만남|first\s*love|初恋|片思い|片想い/i },
  { frameId: 'summer-night', labelKo: '여름밤 외출', pattern: /여름\s*밤|무더운\s*밤|summer\s*night|夏の夜|夏の宵/i },
  { frameId: 'reunion-parting', labelKo: '재회·이별', pattern: /재회|이별|헤어짐|기차역|플랫폼|reunion|parting|再会|別れ|駅のホーム|プラットホーム/i },
  { frameId: 'letter-sending', labelKo: '편지', pattern: /편지|엽서|letter|手紙|葉書|はがき/i },
  { frameId: 'city-lights', labelKo: '도시의 밤', pattern: /도시의\s*밤|번화가|네온|city\s*light|街の灯|繁華街|ネオン/i },
  { frameId: 'travel-window', labelKo: '이동·여행', pattern: /퇴근길|출근길|여행|기차\s*창가|차창|드라이브|travel|drive|車窓|帰り道|旅行/i },
  { frameId: 'shared-table', labelKo: '식탁·모임', pattern: /식탁|모임|친구들과|다\s*같이|저녁\s*자리|table|食卓|集まり|団らん/i },
  { frameId: 'season-turning', labelKo: '계절이 바뀌는 순간', pattern: /계절이\s*바뀌|환절기|season\s*turn|季節の変わり目|季節の境目/i }
];

/** Returns the first matching frameId a concept names, or undefined for a concept with no detectable situation (never forced — mirrors this app's own era-detection "억지로 정하지 말 것" convention). */
export function frameIdForConceptText(conceptLabel: string | undefined): string | undefined {
  if (!conceptLabel) return undefined;
  return SITUATION_FRAME_RULES.find(rule => rule.pattern.test(conceptLabel))?.frameId;
}
