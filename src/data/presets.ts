import type { ChannelProfile, GenerationPack, GenrePack, MoodPack, SeasonPack } from '../types';
import { notionDerivedGenrePacks } from './genreLibrary';

export const channelPresets: ChannelProfile[] = [
  {
    id: 'good-morning-memory-radio',
    name: '굿모닝 추억라디오',
    englishName: 'Good Morning Memory Radio',
    market: 'korea',
    primaryLanguage: 'english',
    audience: 'seniors',
    promise: '50~60대를 위한 아침 커피, 계절감, 편안한 회상 중심의 성인 팝 플레이리스트',
    visualIdentity: 'warm morning cafe, radio, coffee steam, refined serif typography, autumn and winter objects',
    defaultVocal: 'mature soulful male tenor, soft slightly husky close-mic delivery, gentle and sincere',
    preferredGenres: ['adult-contemporary', 'acoustic-pop', 'jazz-pop'],
    preferredMoods: ['nostalgic', 'warm', 'hopeful'],
    forbiddenCliches: ['too old-fashioned trot mood', 'childish lyrics', 'dramatic power ballad shouting', 'famous artist imitation'],
    seoKeywords: ['아침 음악', '커피 음악', '추억 팝송', '50대 음악', '60대 음악', '감성 팝', '계절 플레이리스트'],
    archetype: 'senior-morning'
  },
  {
    id: 'morning-showa-cafe',
    name: '朝の昭和喫茶',
    englishName: 'Morning Showa Café',
    market: 'japan',
    primaryLanguage: 'english',
    audience: 'seniors',
    promise: '쇼와 모던 감성과 키사텐 분위기를 현대적으로 정리한 일본 시니어 플레이리스트',
    visualIdentity: 'showa-modern kissaten, muted gold, deep green, coffee, record player, refined retro typography',
    defaultVocal: 'mature soft male tenor, restrained emotional tone, warm close-mic delivery',
    preferredGenres: ['showa-modern', 'jazz-pop', 'city-pop-soft'],
    preferredMoods: ['nostalgic', 'elegant', 'bittersweet'],
    forbiddenCliches: ['cheap retro props', 'enka-like melodrama', 'overly cute anime tone', 'famous artist imitation'],
    seoKeywords: ['昭和カフェ', '朝の喫茶店', 'レトロBGM', '大人の音楽', '50代', '60代', '喫茶店BGM'],
    archetype: 'showa-cafe'
  }
];

/** v3.4 — saved channels from before archetypes existed have no `archetype` field; they fall back to 'senior-morning' rather than an unscoped/empty hook bank. */
export function migrateArchetype(channel: ChannelProfile): ChannelProfile {
  return channel.archetype ? channel : { ...channel, archetype: 'senior-morning' };
}

export const generationPacks: GenerationPack[] = [
  {
    id: 'kids',
    label: 'Kids / Family',
    audienceNote: 'bright, safe, family-friendly, easy words',
    lyricGuidance: ['short phrases', 'clear images', 'no romance-heavy lines', 'positive resolution'],
    tempoBias: 'medium tempo, clean rhythm, playful but not childish if the channel is adult-facing',
    youtubeAngle: 'family-safe background music and gentle seasonal songs'
  },
  {
    id: 'teens',
    label: 'Teens',
    audienceNote: 'direct emotion, school-day scenes, hopeful social language',
    lyricGuidance: ['simple hook', 'clear point of view', 'avoid heavy nostalgia', 'modern but timeless slang-free wording'],
    tempoBias: 'medium to upbeat tempo with a memorable chorus',
    youtubeAngle: 'study, commute, diary, and first-love playlist angles'
  },
  {
    id: 'twenties',
    label: '20s',
    audienceNote: 'city life, workday reset, new relationships, late-night reflection',
    lyricGuidance: ['conversational verses', 'modern emotional detail', 'compact hook', 'playlist-friendly English works well'],
    tempoBias: 'medium groove, lofi or city-pop accents allowed',
    youtubeAngle: 'cafe, work, night drive, study, and chill playlist angles'
  },
  {
    id: 'thirtiesForties',
    label: '30s-40s',
    audienceNote: 'work, family, memory, understated romance, mature pop tone',
    lyricGuidance: ['balanced nostalgia', 'adult everyday images', 'not overly dramatic', 'clear chorus lift'],
    tempoBias: 'medium tempo with polished adult contemporary structure',
    youtubeAngle: 'workday comfort, home cafe, evening drive, and seasonal healing angles'
  },
  {
    id: 'seniors',
    label: '50s-60s',
    audienceNote: 'warm memory, radio mood, gentle vocal, readable emotional arc',
    lyricGuidance: ['plain but elegant words', 'nostalgia without sadness overload', 'avoid childish wording', 'strong singable hook'],
    tempoBias: 'steady medium tempo, no aggressive drums, clear vocal front',
    youtubeAngle: 'morning coffee, old radio, seasonal memory, and comfortable listening angles'
  },
  {
    id: 'allAges',
    label: 'All Ages',
    audienceNote: 'universal scene, safe wording, broad playlist usability',
    lyricGuidance: ['broad emotional images', 'no niche slang', 'clear hook', 'gentle positive finish'],
    tempoBias: 'playlist-safe medium tempo with clean arrangement',
    youtubeAngle: 'seasonal background music, cafe, walk, and daily comfort angles'
  }
];

export const genrePacks: GenrePack[] = [
  {
    id: 'adult-contemporary',
    label: 'Adult Contemporary Pop',
    styleCore: 'warm adult contemporary pop, radio-friendly, gentle emotional chorus lift',
    instruments: ['Rhodes piano', 'acoustic guitar', 'light brushed drums', 'smooth bass'],
    tempoRange: [96, 106],
    goodFor: ['senior playlist', 'morning coffee', 'year-end']
  },
  {
    id: 'acoustic-pop',
    label: 'Acoustic Pop',
    styleCore: 'nostalgic acoustic pop, clear vocal, intimate warm arrangement',
    instruments: ['fingerpicked acoustic guitar', 'soft piano', 'light percussion'],
    tempoRange: [92, 104],
    goodFor: ['home listening', 'walks', 'coffee']
  },
  {
    id: 'jazz-pop',
    label: 'Acoustic Jazz Pop',
    styleCore: 'nostalgic acoustic jazz-pop, elegant cafe mood, gentle maj7 and add9 colors',
    instruments: ['Rhodes', 'upright bass', 'brushed drums', 'mellow jazz guitar'],
    tempoRange: [90, 104],
    goodFor: ['kissaten', 'night cafe', 'winter']
  },
  {
    id: 'showa-modern',
    label: 'Showa Modern Cafe',
    styleCore: 'showa-modern cafe mood, nostalgic but refined, subtle retro Japanese kissaten warmth',
    instruments: ['Rhodes', 'mellow jazz guitar', 'upright bass', 'soft strings'],
    tempoRange: [92, 104],
    goodFor: ['Japan channel', 'retro cafe', 'autumn']
  },
  {
    id: 'city-pop-soft',
    label: 'Soft City Pop',
    styleCore: 'soft city-pop inspired adult pop, smooth groove, clean late-night city mood',
    instruments: ['electric piano', 'clean guitar', 'soft synth pad', 'smooth bass'],
    tempoRange: [98, 114],
    goodFor: ['Japan', 'night city', 'stylish senior']
  },
  {
    id: 'lofi-cafe',
    label: 'Lo-fi Cafe Pop',
    styleCore: 'warm lo-fi cafe pop, relaxed groove, soft vinyl texture',
    instruments: ['lo-fi drums', 'electric piano', 'warm bass', 'soft guitar'],
    tempoRange: [82, 96],
    goodFor: ['study', 'coffee', 'background']
  },
  {
    id: 'christmas-soft-pop',
    label: 'Soft Christmas Pop',
    styleCore: 'nostalgic Christmas acoustic pop, warm and not childish, subtle bells only in chorus',
    instruments: ['Rhodes', 'acoustic guitar', 'light sleigh bells', 'soft bass'],
    tempoRange: [96, 106],
    goodFor: ['Christmas', 'winter morning', 'year-end']
  },
  {
    id: 'healing-ballad',
    label: 'Healing Ballad',
    styleCore: 'warm healing ballad, restrained emotion, hopeful ending',
    instruments: ['piano', 'acoustic guitar', 'soft strings', 'brushes'],
    tempoRange: [84, 98],
    goodFor: ['comfort', 'senior', 'night']
  },
  {
    id: 'folk-pop',
    label: 'Folk Pop',
    styleCore: 'clean folk-pop storytelling, acoustic warmth, natural sing-along chorus',
    instruments: ['strummed acoustic guitar', 'light mandolin texture', 'soft piano', 'upright bass'],
    tempoRange: [92, 108],
    goodFor: ['family', 'walking', 'spring']
  },
  {
    id: 'bossa-cafe',
    label: 'Bossa Cafe Pop',
    styleCore: 'soft bossa cafe pop, relaxed syncopation, elegant warm vocal',
    instruments: ['nylon guitar', 'Rhodes', 'brush kit', 'upright bass', 'light shaker'],
    tempoRange: [88, 102],
    goodFor: ['summer cafe', 'morning', 'Japan and Korea']
  },
  {
    id: 'soft-rock',
    label: 'Soft Rock Radio',
    styleCore: 'polished soft rock radio arrangement, warm guitars, restrained chorus lift',
    instruments: ['clean electric guitar', 'acoustic guitar', 'piano', 'steady soft drums'],
    tempoRange: [96, 112],
    goodFor: ['drive', 'memory', 'all ages']
  },
  {
    id: 'piano-ballad',
    label: 'Piano Pop Ballad',
    styleCore: 'piano-led pop ballad, intimate verse, gentle cinematic chorus',
    instruments: ['felt piano', 'soft strings', 'subtle cymbal swells', 'warm bass'],
    tempoRange: [78, 92],
    goodFor: ['night', 'comfort', 'winter']
  },
  {
    id: 'retro-soul-pop',
    label: 'Retro Soul Pop',
    styleCore: 'soft retro soul pop, warm groove, hand-played feel, tasteful backing vocals',
    instruments: ['Wurlitzer', 'muted guitar', 'smooth bass', 'light soul drums'],
    tempoRange: [88, 104],
    goodFor: ['radio', 'coffee', 'hopeful mood']
  },
  {
    id: 'synthwave-mellow',
    label: 'Mellow Synthwave Pop',
    styleCore: 'mellow synthwave pop, nostalgic neon pads, clean modern mix, not aggressive',
    instruments: ['soft analog synth pad', 'electric piano', 'clean guitar', 'warm electronic drums'],
    tempoRange: [92, 108],
    goodFor: ['night drive', 'retro channel', 'twenties']
  },
  ...notionDerivedGenrePacks
];

export const moodPacks: MoodPack[] = [
  { id: 'nostalgic', label: 'Nostalgic', emotionWords: ['nostalgic', 'familiar', 'old-radio warmth'], lyricImages: ['old radio', 'faded photograph', 'coffee steam', 'quiet street'] },
  { id: 'warm', label: 'Warm', emotionWords: ['warm', 'comforting', 'gentle'], lyricImages: ['morning light', 'wool sweater', 'candle', 'small kitchen'] },
  { id: 'bittersweet', label: 'Bittersweet', emotionWords: ['bittersweet', 'lonely but hopeful', 'restrained'], lyricImages: ['empty chair', 'late train', 'rain on glass', 'old letter'] },
  { id: 'hopeful', label: 'Hopeful', emotionWords: ['hopeful', 'quietly uplifting', 'renewed'], lyricImages: ['sunrise', 'first light', 'open road', 'clear sky'] },
  { id: 'romantic', label: 'Romantic', emotionWords: ['romantic', 'tender', 'soft longing'], lyricImages: ['corner cafe', 'passing footsteps', 'shared umbrella', 'distant song'] },
  { id: 'christmas', label: 'Christmas Warmth', emotionWords: ['peaceful Christmas', 'year-end warmth', 'soft bells'], lyricImages: ['ribbons', 'cards', 'tree lights', 'snow'] },
  { id: 'calm-focus', label: 'Calm Focus', emotionWords: ['calm', 'steady', 'light concentration'], lyricImages: ['open notebook', 'quiet desk', 'window light', 'slow clock'] },
  { id: 'fresh-start', label: 'Fresh Start', emotionWords: ['fresh', 'clean', 'new beginning'], lyricImages: ['washed sky', 'new shoes', 'morning train', 'open calendar'] },
  { id: 'rainy-comfort', label: 'Rainy Comfort', emotionWords: ['rainy', 'safe inside', 'softly reflective'], lyricImages: ['rain on glass', 'umbrella stand', 'warm lamp', 'wet street'] },
  { id: 'elegant', label: 'Elegant', emotionWords: ['elegant', 'reserved', 'polished'], lyricImages: ['porcelain cup', 'old record', 'tailored coat', 'quiet lobby'] }
];

export const seasonPacks: SeasonPack[] = [
  { id: 'new-year', label: 'New Year Reset', period: 'January', keywords: ['new year', 'first morning', 'fresh calendar'], visualDirection: 'clean white desk, warm sunlight, simple calendar, no party clutter' },
  { id: 'late-winter', label: 'Late Winter', period: 'February', keywords: ['late winter', 'quiet room', 'warm tea'], visualDirection: 'soft gray-blue light, warm indoor lamp, winter window' },
  { id: 'spring-open', label: 'Spring Opening', period: 'March', keywords: ['spring', 'new road', 'soft wind'], visualDirection: 'fresh green accent, open window, light jacket, clean typography' },
  { id: 'cherry-blossom', label: 'Cherry Blossom Walk', period: 'March-April', keywords: ['cherry blossom', 'walk', 'soft pink light'], visualDirection: 'pale blossom street, coffee cup, gentle morning, not overly cute' },
  { id: 'may-cafe', label: 'May Cafe', period: 'May', keywords: ['May', 'cafe terrace', 'clear sky'], visualDirection: 'terrace cafe, bright green, clean table setting' },
  { id: 'rainy-season', label: 'Rainy Season', period: 'June', keywords: ['rain', 'window', 'umbrella', 'old song'], visualDirection: 'rainy cafe, warm window glow, no gloomy darkness' },
  { id: 'summer-night', label: 'Summer Night', period: 'July', keywords: ['summer night', 'city breeze', 'late cafe'], visualDirection: 'cool night street, soft neon, cafe window, readable title text' },
  { id: 'late-summer-open', label: 'Late Summer Opening', period: 'August launch', keywords: ['channel opening', 'morning coffee', 'first hello'], visualDirection: 'clean brand intro, coffee table, warm sunrise' },
  { id: 'early-autumn', label: 'Early Autumn', period: 'September', keywords: ['September', 'early autumn', 'coffee', 'wind'], visualDirection: 'light olive and ivory, early autumn leaves, cafe morning' },
  { id: 'autumn-rain', label: 'Autumn Rain', period: 'September rain', keywords: ['rain', 'window', 'cafe', 'old song'], visualDirection: 'rainy cafe, warm window glow, no gloomy darkness' },
  { id: 'maple-autumn', label: 'Maple Autumn', period: 'October', keywords: ['maple', 'golden leaves', 'walk', 'memory'], visualDirection: 'golden foliage, coffee, refined typography' },
  { id: 'late-autumn', label: 'Late Autumn Letter', period: 'late October', keywords: ['last autumn', 'November coming', 'letter'], visualDirection: 'deep green, brass accent, soft street lamps' },
  { id: 'early-winter', label: 'Early Winter Window', period: 'November', keywords: ['November', 'first cold', 'winter window'], visualDirection: 'deep blue, warm cafe lights, winter coat detail' },
  { id: 'first-snow', label: 'First Snow', period: 'late November', keywords: ['first snow', 'silver night', 'quiet city'], visualDirection: 'soft snow, blue-white, warm interior lights' },
  { id: 'christmas', label: 'Christmas Cafe', period: 'December', keywords: ['Christmas', 'bells', 'cards', 'coffee', 'radio'], visualDirection: 'champagne gold, warm ivory, subtle red, no childish Santa focus' },
  { id: 'year-end', label: 'Year-End Letter', period: 'late December', keywords: ['year-end', 'last letter', 'old year', 'new light'], visualDirection: 'quiet room, candlelight, winter morning' }
];
