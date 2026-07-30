import type { ChannelArchetype, GenerationOptions, LyricLanguage } from '../types';

export type KidsLyricThemeHint = 'animal' | 'season' | 'family' | 'friend' | 'play' | 'school' | 'counting' | 'hangul';

export interface LyricTheme {
  id: string;
  labelKo: string;
  scene: string;
  emotionalArc: string;
  suitedArchetypes?: ChannelArchetype[];
  languages?: ('korean' | 'japanese' | 'english')[];
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
  'kids-pajama-moon-window': 'family'
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
  const source = archetype === 'kids' ? kidsLyricThemes : adultLyricThemes;
  const suited = source.filter(theme => (!archetype || theme.suitedArchetypes?.includes(archetype)) && languageAllows(theme, language));
  const fallback = source.filter(theme => languageAllows(theme, language));
  const base = suited.length >= 12 ? suited : fallback;
  return custom ? [custom, ...base] : base;
}

export function lyricThemesForOptions(opts: Pick<GenerationOptions, 'channel' | 'customLyricThemeScene' | 'lyricLanguage'>): LyricTheme[] {
  return lyricThemesForArchetype(opts.channel.archetype, opts.customLyricThemeScene, opts.lyricLanguage);
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
