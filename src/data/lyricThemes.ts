import type { ChannelArchetype, GenerationOptions, LyricLanguage } from '../types';
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

function normalizeCustomScene(scene: string | undefined): string {
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
export function lyricThemesForOptions(opts: Pick<GenerationOptions, 'channel' | 'customLyricThemeScene' | 'lyricLanguage'>): LyricTheme[] {
  const base = lyricThemesForArchetype(opts.channel.archetype, opts.customLyricThemeScene, opts.lyricLanguage);
  if (isKidsArchetype(opts.channel.archetype) && opts.channel.preferredMoods?.includes('calm-focus')) {
    const calmFiltered = base.filter(theme => theme.moodTag !== 'energetic');
    if (calmFiltered.length >= 12) return calmFiltered;
  }
  return base;
}

export function getLyricThemeById(id: string | undefined, opts: Pick<GenerationOptions, 'channel' | 'customLyricThemeScene' | 'lyricLanguage'>): LyricTheme | undefined {
  if (!id) return undefined;
  return lyricThemesForOptions(opts).find(theme => theme.id === id);
}

export function getLyricThemeLabel(id: string | undefined, archetype?: ChannelArchetype, customScene?: string, language?: LyricLanguage): string {
  if (!id) return '-';
  return lyricThemesForArchetype(archetype, customScene, language).find(theme => theme.id === id)?.labelKo || id;
}

export function getLyricThemeScene(id: string | undefined, opts: Pick<GenerationOptions, 'channel' | 'customLyricThemeScene' | 'lyricLanguage'>): string {
  return getLyricThemeById(id, opts)?.scene || '';
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

export const SITUATION_FRAME_RULES: SituationFrameRule[] = [
  { frameId: 'dance-saturday', labelKo: '토요일 밤 댄스', pattern: /춤추|댄스|무도회|dance/i },
  { frameId: 'young-first-love', labelKo: '첫사랑', pattern: /첫사랑|풋사랑|설렘|고백|첫\s*만남|first\s*love/i },
  { frameId: 'summer-night', labelKo: '여름밤 외출', pattern: /여름\s*밤|무더운\s*밤|summer\s*night/i },
  { frameId: 'reunion-parting', labelKo: '재회·이별', pattern: /재회|이별|헤어짐|기차역|플랫폼|reunion|parting/i },
  { frameId: 'letter-sending', labelKo: '편지', pattern: /편지|엽서|letter/i },
  { frameId: 'city-lights', labelKo: '도시의 밤', pattern: /도시의\s*밤|번화가|네온|city\s*light/i },
  { frameId: 'travel-window', labelKo: '이동·여행', pattern: /퇴근길|출근길|여행|기차\s*창가|차창|드라이브|travel|drive/i },
  { frameId: 'shared-table', labelKo: '식탁·모임', pattern: /식탁|모임|친구들과|다\s*같이|저녁\s*자리|table/i },
  { frameId: 'season-turning', labelKo: '계절이 바뀌는 순간', pattern: /계절이\s*바뀌|환절기|season\s*turn/i }
];

/** Returns the first matching frameId a concept names, or undefined for a concept with no detectable situation (never forced — mirrors this app's own era-detection "억지로 정하지 말 것" convention). */
export function frameIdForConceptText(conceptLabel: string | undefined): string | undefined {
  if (!conceptLabel) return undefined;
  return SITUATION_FRAME_RULES.find(rule => rule.pattern.test(conceptLabel))?.frameId;
}
