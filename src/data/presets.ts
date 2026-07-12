import type { ChannelProfile, GenrePack, MoodPack, SeasonPack } from '../types';

export const channelPresets: ChannelProfile[] = [
  {
    id: 'good-morning-memory-radio',
    name: '굿모닝 추억라디오',
    englishName: 'Good Morning Memory Radio',
    market: 'korea',
    primaryLanguage: 'english',
    audience: 'seniors',
    promise: '50~60대가 아침 커피와 함께 편안하게 듣는 세련된 추억 팝송 라디오',
    visualIdentity: 'warm beige, champagne gold, coffee brown, morning light, radio, coffee, autumn and winter objects',
    defaultVocal: 'mature soulful male tenor, soft slightly husky close-mic delivery, gentle and sincere',
    preferredGenres: ['adult-contemporary', 'acoustic-pop', 'jazz-pop'],
    preferredMoods: ['nostalgic', 'warm', 'hopeful'],
    forbiddenCliches: ['too old-fashioned trot mood', 'childish lyrics', 'dramatic power ballad shouting', 'famous artist imitation'],
    seoKeywords: ['아침 음악', '커피 음악', '추억 팝송', '50대 음악', '60대 음악', '가을 팝송', '크리스마스 음악']
  },
  {
    id: 'morning-showa-cafe',
    name: '朝の昭和喫茶',
    englishName: 'Morning Showa Café',
    market: 'japan',
    primaryLanguage: 'english',
    audience: 'seniors',
    promise: '昭和モダン喫茶で聴く、懐かしい洋楽風メロディ',
    visualIdentity: 'showa-modern kissaten, muted gold, deep green, coffee, record player, refined retro typography',
    defaultVocal: 'mature soft male tenor, restrained emotional tone, warm close-mic delivery',
    preferredGenres: ['showa-modern', 'jazz-pop', 'city-pop-soft'],
    preferredMoods: ['nostalgic', 'elegant', 'bittersweet'],
    forbiddenCliches: ['cheap retro props', 'enka-like melodrama', 'overly cute anime tone', 'famous artist imitation'],
    seoKeywords: ['昭和モダン', '朝カフェ', '喫茶店 BGM', '懐かしい洋楽風', '50代', '60代', '秋 BGM', 'クリスマス喫茶']
  }
];

export const genrePacks: GenrePack[] = [
  { id: 'adult-contemporary', label: 'Adult Contemporary Pop', styleCore: 'warm adult contemporary pop, radio-friendly, gentle emotional chorus lift', instruments: ['Rhodes piano', 'acoustic guitar', 'light brushed drums', 'smooth bass'], tempoRange: [96, 106], goodFor: ['senior playlist', 'morning coffee', 'year-end'] },
  { id: 'acoustic-pop', label: 'Acoustic Pop', styleCore: 'nostalgic acoustic pop, clear vocal, intimate warm arrangement', instruments: ['fingerpicked acoustic guitar', 'soft piano', 'light percussion'], tempoRange: [94, 104], goodFor: ['home listening', 'walks', 'coffee'] },
  { id: 'jazz-pop', label: 'Acoustic Jazz Pop', styleCore: 'nostalgic acoustic jazz-pop, elegant cafe mood, gentle maj7 and add9 colors', instruments: ['Rhodes', 'upright bass', 'brushed drums', 'mellow jazz guitar'], tempoRange: [92, 104], goodFor: ['kissaten', 'night cafe', 'winter'] },
  { id: 'showa-modern', label: 'Showa Modern Café', styleCore: 'showa-modern cafe mood, nostalgic but refined, subtle retro Japanese kissaten warmth', instruments: ['Rhodes', 'mellow jazz guitar', 'upright bass', 'soft strings'], tempoRange: [94, 104], goodFor: ['Japan channel', 'retro cafe', 'autumn'] },
  { id: 'city-pop-soft', label: 'Soft City Pop', styleCore: 'soft city-pop inspired adult pop, smooth groove, clean late-night city mood', instruments: ['electric piano', 'clean guitar', 'soft synth pad', 'smooth bass'], tempoRange: [100, 112], goodFor: ['Japan', 'night city', 'stylish senior'] },
  { id: 'lofi-cafe', label: 'Lo-fi Café Pop', styleCore: 'warm lo-fi cafe pop, relaxed groove, soft vinyl texture', instruments: ['lo-fi drums', 'electric piano', 'warm bass', 'soft guitar'], tempoRange: [82, 96], goodFor: ['study', 'coffee', 'background'] },
  { id: 'christmas-soft-pop', label: 'Soft Christmas Pop', styleCore: 'nostalgic Christmas acoustic pop, warm and not childish, subtle bells only in chorus', instruments: ['Rhodes', 'acoustic guitar', 'light sleigh bells', 'soft bass'], tempoRange: [98, 106], goodFor: ['Christmas', 'winter morning', 'year-end'] },
  { id: 'healing-ballad', label: 'Healing Ballad', styleCore: 'warm healing ballad, restrained emotion, hopeful ending', instruments: ['piano', 'acoustic guitar', 'soft strings', 'brushes'], tempoRange: [86, 98], goodFor: ['comfort', 'senior', 'night'] }
];

export const moodPacks: MoodPack[] = [
  { id: 'nostalgic', label: '추억/懐かしい', emotionWords: ['nostalgic', 'familiar', 'old-radio warmth'], lyricImages: ['old radio', 'faded photograph', 'coffee steam', 'quiet street'] },
  { id: 'warm', label: '따뜻함/温もり', emotionWords: ['warm', 'comforting', 'gentle'], lyricImages: ['morning light', 'wool sweater', 'candle', 'small kitchen'] },
  { id: 'bittersweet', label: '쓸쓸하지만 따뜻함', emotionWords: ['bittersweet', 'lonely but hopeful', 'restrained'], lyricImages: ['empty chair', 'late train', 'rain on glass', 'old letter'] },
  { id: 'hopeful', label: '희망/希望', emotionWords: ['hopeful', 'quietly uplifting', 'renewed'], lyricImages: ['sunrise', 'first light', 'open road', 'clear sky'] },
  { id: 'romantic', label: '로맨틱/恋', emotionWords: ['romantic', 'tender', 'soft longing'], lyricImages: ['corner cafe', 'passing footsteps', 'shared umbrella', 'distant song'] },
  { id: 'elegant', label: '세련됨/上品', emotionWords: ['elegant', 'refined', 'modern nostalgia'], lyricImages: ['polished coffee cup', 'soft lamp', 'quiet record player', 'gold typography'] },
  { id: 'christmas', label: '크리스마스/クリスマス', emotionWords: ['peaceful Christmas', 'year-end warmth', 'soft bells'], lyricImages: ['ribbons', 'cards', 'tree lights', 'snow'] }
];

export const seasonPacks: SeasonPack[] = [
  { id: 'late-summer-open', label: '8월 오픈 준비', period: 'August launch', keywords: ['channel opening', 'morning coffee', 'first hello'], visualDirection: 'clean brand intro, coffee table, warm sunrise' },
  { id: 'early-autumn', label: '초가을', period: 'September', keywords: ['September', 'early autumn', 'coffee', 'wind'], visualDirection: 'light beige, early autumn leaves, cafe morning' },
  { id: 'autumn-rain', label: '비 오는 가을', period: 'September rain', keywords: ['rain', 'window', 'cafe', 'old song'], visualDirection: 'rainy cafe, warm window glow, no gloomy darkness' },
  { id: 'maple-autumn', label: '단풍/紅葉', period: 'October', keywords: ['maple', 'golden leaves', 'walk', 'memory'], visualDirection: 'golden foliage, coffee, refined typography' },
  { id: 'late-autumn', label: '늦가을/晩秋', period: 'late October', keywords: ['last autumn', 'November coming', 'letter'], visualDirection: 'deep gold, brown, soft street lamps' },
  { id: 'early-winter', label: '초겨울', period: 'November', keywords: ['November', 'first cold', 'winter window'], visualDirection: 'navy, cream, warm cafe lights' },
  { id: 'first-snow', label: '첫눈/初雪', period: 'late November', keywords: ['first snow', 'silver night', 'quiet city'], visualDirection: 'soft snow, blue-white, warm interior lights' },
  { id: 'christmas', label: '크리스마스', period: 'December', keywords: ['Christmas', 'bells', 'cards', 'coffee', 'radio'], visualDirection: 'champagne gold, warm ivory, subtle red, no childish Santa focus' },
  { id: 'year-end', label: '연말/年末', period: 'late December', keywords: ['year-end', 'last letter', 'old year', 'new light'], visualDirection: 'quiet room, candlelight, winter morning' }
];
