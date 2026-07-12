import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, SeasonPack, SongIdea } from '../types';
import { buildStylePrompt } from './promptComposer';
import { scoreSongs } from './quality';

const titleSeeds = [
  'Morning Coffee Letter', 'Radio Under the Leaves', 'Rainy Window Café', 'Old Sweater Sunday', 'Maple Street Memory',
  'November Light', 'First Snow Café', 'Winter Moon Road', 'Candle by the Radio', 'Christmas Coffee',
  'Soft Bells Tonight', 'Last Letter of the Year', 'Home by the Winter Moon', 'Golden Lights Again', 'Goodnight Old Year',
  'One More Morning Light', 'Quiet Christmas Street', 'Midnight Snow Café', 'Silver Ribbon Night', 'Christmas Eve Radio'
];

const jpTitleSeeds = [
  '秋の朝カフェ', '珈琲と秋風', '雨の喫茶店', '昭和モダンレコード', '紅葉と珈琲',
  '11月の窓辺', '初雪の前に', '冬の喫茶BGM', '年末の手紙', 'クリスマス喫茶',
  'やわらかな鐘の夜', '最後の手紙', '冬の月に帰る道', '黄金色の灯り', '年の終わりの朝'
];

function titleFor(i: number, opts: GenerationOptions) {
  if (opts.market === 'japan' && opts.lyricLanguage === 'japanese') return jpTitleSeeds[i % jpTitleSeeds.length];
  return titleSeeds[i % titleSeeds.length];
}

function englishLyric(title: string, season: SeasonPack, hook: string) {
  const seasonWord = season.keywords[0] ?? 'season';
  return `Title: ${title}\n\n[very short Rhodes and acoustic guitar intro]\n\n[verse 1]\n${seasonWord} light is falling\nsoft across the street\nCoffee in the morning\nwarms the empty seat\n\nAn old familiar radio\nplays behind the door\nAnd every little memory\ncomes back once more\n\n[chorus]\n${hook}\nsoftly through the day\nEvery lonely shadow\nslowly fades away\n\nIf the cold wind calls me\nI will not lose sight\nI keep one small song\nburning warm tonight\n\n[verse 2]\nFootsteps by the window\nletters on the chair\nI can feel the seasons\nturning in the air\n\nThere were roads behind me\nI could not understand\nNow they feel like music\nresting in my hand\n\n[chorus]\n${hook}\nsoftly through the day\nEvery lonely shadow\nslowly fades away\n\nIf the cold wind calls me\nI will not lose sight\nI keep one small song\nburning warm tonight\n\n[short bridge]\nSome dreams become silence\nSome tears turn to light\nBut a gentle melody\ncan carry us through night\n\n[final chorus]\n${hook}\nsoftly through the day\nEvery lonely shadow\nslowly fades away\n\nIf the cold wind calls me\nI will not lose sight\nI keep one small song\nburning warm tonight\n\n[short outro]\nOne small song\nsoft and clear\nA little hope\nis waiting here\n\n[end]`;
}

function koreanLyric(title: string, season: SeasonPack, hook: string) {
  return `Title: ${title}\n\n[짧은 피아노와 어쿠스틱 기타 인트로]\n\n[verse 1]\n커피 향이 조용히\n아침을 깨우고\n오래된 라디오가\n마음을 불러요\n\n${season.label} 빛 사이로\n추억이 내려와\n잊은 줄 알았던 노래가\n다시 피어나요\n\n[chorus]\n${hook}\n따뜻하게 들려요\n외로운 계절도\n조금씩 지나가요\n\n차가운 바람 속에도\n작은 불빛 하나\n오늘의 내 마음을\n부드럽게 감싸요\n\n[verse 2]\n창가에 남겨둔\n편지 한 장처럼\n지난 날의 이름들이\n조용히 앉아요\n\n[final chorus]\n${hook}\n따뜻하게 들려요\n외로운 계절도\n조금씩 지나가요\n\n차가운 바람 속에도\n작은 불빛 하나\n오늘의 내 마음을\n부드럽게 감싸요\n\n[end]`;
}

function japaneseLyric(title: string, season: SeasonPack, hook: string) {
  return `Title: ${title}\n\n[短いピアノとアコースティックギターのイントロ]\n\n[verse 1]\n朝の珈琲が\n静かに香る\n古いラジオから\nやさしい歌が流れる\n\n${season.label}の光に\n思い出がゆれて\n忘れたはずの気持ちが\nそっと戻ってくる\n\n[chorus]\n${hook}\n心に灯る\nさみしい季節も\n少しずつほどける\n\n冷たい風の中で\n小さな明かりを\n今日の胸に抱いて\n歩いてゆく\n\n[verse 2]\n窓辺に残した\n手紙のように\n過ぎた日の名前が\n静かに座っている\n\n[final chorus]\n${hook}\n心に灯る\nさみしい季節も\n少しずつほどける\n\n冷たい風の中で\n小さな明かりを\n今日の胸に抱いて\n歩いてゆく\n\n[end]`;
}

export function generateLocalBlueprint(opts: GenerationOptions, genres: GenrePack[], moods: MoodPack[], season: SeasonPack): PlaylistBlueprint {
  const baseStyle = buildStylePrompt(opts, genres, moods, season);
  const oneLineConcept = opts.customConcept || `${opts.channel.name}를 위한 ${season.label} ${genres.map(g => g.label).join(' + ')} 곡세트`;
  const songs: SongIdea[] = Array.from({ length: opts.songCount }, (_, idx) => {
    const title = titleFor(idx, opts);
    const hook = opts.lyricLanguage === 'japanese' ? `${title}が` : opts.lyricLanguage === 'korean' ? `${title}이` : title;
    const lyrics = opts.lyricLanguage === 'korean'
      ? koreanLyric(title, season, hook)
      : opts.lyricLanguage === 'japanese'
        ? japaneseLyric(title, season, hook)
        : englishLyric(title, season, hook);
    const stylePrompt = `${baseStyle}, track ${idx + 1} has distinct hook phrase '${title}', same channel vocal signature, coherent playlist set`;
    return {
      trackNo: idx + 1,
      title,
      seasonMoment: season.label,
      listenerSituation: idx % 3 === 0 ? 'morning coffee' : idx % 3 === 1 ? 'quiet walk' : 'night cafe',
      emotionArc: idx % 2 === 0 ? 'nostalgic to hopeful' : 'bittersweet to comforting',
      hookPhrase: hook,
      stylePrompt,
      lyrics,
      thumbnailText: opts.market === 'japan' ? `${season.label}｜懐かしいメロディ` : `${season.label} | 추억 팝송`,
      youtubeTitleKo: `${season.label}에 듣기 좋은 추억 팝송 ☕ ${opts.channel.name}`,
      youtubeTitleJa: `${season.label}に聴きたい懐かしい洋楽風メロディ ☕ ${opts.channel.name}`,
      qualityScore: 0,
      warnings: []
    };
  });

  return {
    projectTitle: opts.projectTitle,
    channelName: opts.channel.name,
    oneLineConcept,
    sonicSignature: `${genres.map(g => g.label).join(' + ')} / ${moods.map(m => m.label).join(' + ')}`,
    vocalSignature: opts.vocalTone || opts.channel.defaultVocal,
    lyricRules: ['simple memorable hook', 'original lyrics', 'seasonal images', 'clear Suno tags'],
    harmonyRules: ['money chords enabled by default', 'emotional chorus lift', 'gentle maj7/add9 color when appropriate'],
    visualRules: [season.visualDirection, opts.channel.visualIdentity, 'large readable title typography'],
    songs: scoreSongs(songs)
  };
}
