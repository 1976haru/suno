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
