import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, SeasonPack, SongIdea, YoutubeMetadata } from '../types';
import { generationPacks } from '../data/presets';
import { buildStylePrompt } from './promptComposer';
import { scoreSongs } from './quality';

const englishTitleSeeds = [
  'Morning Coffee Letter',
  'Radio Under the Leaves',
  'Rain on the Window',
  'Old Sweater Sunday',
  'Maple Street Memory',
  'November Light',
  'First Snow Cafe',
  'Winter Moon Road',
  'Candle by the Radio',
  'Christmas Coffee',
  'Soft Bells Tonight',
  'Last Letter of the Year',
  'Home by the Winter Moon',
  'Golden Lights Again',
  'Goodnight Old Year',
  'One More Morning Light',
  'Quiet Christmas Street',
  'Midnight Snow Cafe',
  'Silver Ribbon Night',
  'Christmas Eve Radio'
];

const koreanTitleSeeds = [
  '아침 커피 편지',
  '낙엽 아래 라디오',
  '비 오는 창가',
  '오래된 스웨터의 일요일',
  '단풍길의 기억',
  '11월의 빛',
  '첫눈 카페',
  '겨울 달빛길',
  '라디오 옆 촛불',
  '크리스마스 커피',
  '오늘 밤 작은 종소리',
  '올해의 마지막 편지',
  '겨울 달 아래 집으로',
  '다시 켜진 금빛 불빛',
  '잘 자요 오래된 한 해',
  '한 번 더 아침빛',
  '조용한 크리스마스 거리',
  '자정의 눈 내리는 카페',
  '은빛 리본의 밤',
  '크리스마스 이브 라디오'
];

const japaneseTitleSeeds = [
  '朝のコーヒー便り',
  '落ち葉の下のラジオ',
  '雨の窓辺',
  '古いセーターの日曜日',
  '楓通りの記憶',
  '十一月の光',
  '初雪のカフェ',
  '冬月の帰り道',
  'ラジオのそばの灯り',
  'クリスマスコーヒー',
  '今夜の小さなベル',
  '今年最後の手紙',
  '冬の月の下で',
  'もう一度灯る金色',
  'おやすみ古い一年',
  'もう一つの朝の光',
  '静かなクリスマス通り',
  '真夜中の雪カフェ',
  '銀色リボンの夜',
  'イブのラジオ'
];

const listenerSituations = [
  'morning coffee before the day begins',
  'quiet walk under seasonal trees',
  'late cafe seat beside the window',
  'small kitchen with the radio on',
  'evening drive through familiar streets',
  'writing a letter after dinner',
  'standing near a warm shop window',
  'slow train ride home',
  'folding an old sweater in a quiet room',
  'watching the first lights come on'
];

const emotionArcs = [
  'lonely memory to warm acceptance',
  'soft nostalgia to renewed hope',
  'quiet longing to calm gratitude',
  'bittersweet reflection to gentle lift',
  'small sadness to steady comfort',
  'old regret to peaceful closure'
];

const recurringMotifs = [
  'coffee steam',
  'old radio light',
  'window rain',
  'folded letter',
  'street lamp',
  'wool sweater',
  'paper calendar',
  'warm cafe window'
];

const songRoles = [
  'clear opener',
  'gentle early lift',
  'first nostalgic turn',
  'brighter sing-along track',
  'quiet middle scene',
  'romantic shade without melodrama',
  'seasonal detail track',
  'late-set emotional center',
  'warm radio-friendly highlight',
  'soft reset before the closing run',
  'memory-focused late track',
  'comforting closer'
];

function pick<T>(items: T[], index: number) {
  return items[index % items.length];
}

function averageTempo(genres: GenrePack[], trackNo: number) {
  const ranges = genres.length ? genres.map(genre => genre.tempoRange) : ([[92, 104]] as [number, number][]);
  const low = Math.round(ranges.reduce((sum, range) => sum + range[0], 0) / ranges.length);
  const high = Math.round(ranges.reduce((sum, range) => sum + range[1], 0) / ranges.length);
  const center = Math.round((low + high) / 2);
  const offset = [-4, -2, 0, 2, 3, 1, -1, 4, 2, 0][trackNo % 10];
  return Math.min(high, Math.max(low, center + offset));
}

function titleFor(index: number, opts: GenerationOptions) {
  if (opts.lyricLanguage === 'korean') return pick(koreanTitleSeeds, index);
  if (opts.lyricLanguage === 'japanese') return pick(japaneseTitleSeeds, index);
  return pick(englishTitleSeeds, index);
}

function hookFor(title: string, opts: GenerationOptions) {
  if (opts.lyricLanguage === 'korean') return `${title}, 다시 마음이 따뜻해져`;
  if (opts.lyricLanguage === 'japanese') return `${title}、また心があたたまる`;
  if (opts.lyricLanguage === 'bilingual') return `${title}, stay with me tonight`;
  return `${title}, keep a little light for me`;
}

function englishLyric(title: string, season: SeasonPack, hook: string, situation: string, motif: string) {
  const seasonWord = season.keywords[0] ?? 'season';
  return `Title: ${title}

[short intro]
Soft Rhodes, acoustic guitar, close warm vocal.

[verse 1]
The ${seasonWord} light is resting
on the table by the door
I hear a quiet radio
like I have heard before

In this ${situation}
I breathe and let it be
The ${motif} keeps shining
like a small old memory

[chorus]
${hook}
softly through the day
Every lonely shadow
slowly fades away
If the cold wind finds me
I will still believe
There is one small song
waiting here with me

[verse 2]
There were roads behind me
I could not understand
Now they feel like music
resting in my hand
Every simple morning
every cup of rain
turns the page so gently
and calls me home again

[short bridge]
Some dreams become silence
Some tears turn to light
But a gentle melody
can carry us through night

[final chorus]
${hook}
softly through the day
Every lonely shadow
slowly fades away
If the cold wind finds me
I will still believe
There is one small song
waiting here with me

[end]`;
}

function koreanLyric(title: string, season: SeasonPack, hook: string, situation: string, motif: string) {
  const seasonWord = season.keywords[0] ?? '계절';
  return `Title: ${title}

[short intro]
따뜻한 로즈 피아노, 어쿠스틱 기타, 가까운 목소리.

[verse 1]
${seasonWord} 빛이 문가에 내려
오래된 잔 위에 머물고
작은 라디오 소리 하나
아침을 천천히 깨워요

${situation} 속에서
나는 숨을 고르고
${motif} 같은 기억 하나
조용히 다시 빛나요

[chorus]
${hook}
오늘도 천천히 걸어요
외로운 그림자도
조금씩 옅어져요
차가운 바람이 불어도
나는 잊지 않아요
작은 노래 하나가
마음을 데워 준다는 걸

[verse 2]
지나온 길들은 모두
이제는 음악이 되고
말하지 못한 마음까지
창가에 내려앉아요
매일의 작은 커피와
비에 젖은 거리도
다시 돌아갈 곳처럼
따뜻하게 불러요

[short bridge]
어떤 꿈은 조용해지고
어떤 눈물은 빛이 되죠
부드러운 멜로디 하나
밤을 지나가게 해요

[final chorus]
${hook}
오늘도 천천히 걸어요
외로운 그림자도
조금씩 옅어져요
차가운 바람이 불어도
나는 잊지 않아요
작은 노래 하나가
마음을 데워 준다는 걸

[end]`;
}

function japaneseLyric(title: string, season: SeasonPack, hook: string, situation: string, motif: string) {
  const seasonWord = season.keywords[0] ?? '季節';
  return `Title: ${title}

[short intro]
やわらかなローズピアノ、アコースティックギター、近い歌声。

[verse 1]
${seasonWord}の光がそっと
古いカップに落ちて
小さなラジオの音が
朝をゆっくり起こす

${situation}の中で
息をひとつ整え
${motif}みたいな記憶が
静かにまた灯る

[chorus]
${hook}
今日もゆっくり歩こう
さみしい影さえ
少しずつほどけてく
冷たい風が来ても
忘れずにいたい
小さな歌ひとつが
心をあたためる

[verse 2]
通り過ぎた道も
今は音楽になり
言えなかった気持ちまで
窓辺にそっと座る
毎日のコーヒーと
雨に濡れた街が
帰る場所のように
やさしく呼んでいる

[short bridge]
夢は静けさになり
涙は光になる
やわらかなメロディが
夜を越えさせてくれる

[final chorus]
${hook}
今日もゆっくり歩こう
さみしい影さえ
少しずつほどけてく
冷たい風が来ても
忘れずにいたい
小さな歌ひとつが
心をあたためる

[end]`;
}

function buildLyrics(opts: GenerationOptions, title: string, season: SeasonPack, hook: string, situation: string, motif: string) {
  if (opts.lyricLanguage === 'korean') return koreanLyric(title, season, hook, situation, motif);
  if (opts.lyricLanguage === 'japanese') return japaneseLyric(title, season, hook, situation, motif);
  return englishLyric(title, season, hook, situation, motif);
}

function buildYoutubeMetadata(
  opts: GenerationOptions,
  song: Pick<SongIdea, 'trackNo' | 'title' | 'seasonMoment' | 'listenerSituation' | 'hookPhrase'>,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack
): YoutubeMetadata {
  const channelName = opts.channel.englishName || opts.channel.name;
  const genreTags = genres.map(genre => genre.label);
  const moodTags = moods.map(mood => mood.label);
  const baseTags = [
    channelName,
    opts.channel.name,
    song.title,
    season.label,
    ...season.keywords,
    ...genreTags,
    ...moodTags,
    ...opts.channel.seoKeywords
  ];
  const tags = Array.from(new Set(baseTags.map(tag => tag.trim()).filter(Boolean))).slice(0, 18);
  const title = `${song.title} - ${season.label} ${channelName} Playlist`;
  const description = [
    `${song.title} is track ${song.trackNo} from ${opts.projectTitle}.`,
    `Concept: ${opts.customConcept || opts.channel.promise}`,
    `Mood: ${song.listenerSituation}, ${song.seasonMoment}.`,
    `Suno style prompt and lyrics are generated as original material for ${opts.channel.name}.`,
    `Tags: ${tags.slice(0, 10).join(', ')}`
  ].join('\n');
  const thumbnailText = opts.market === 'japan'
    ? `${season.label}\n${song.title}`
    : opts.market === 'korea'
      ? `${season.label}\n${song.title}`
      : `${season.label}\n${song.title}`;

  return { title, description, tags, thumbnailText };
}

export function generateLocalBlueprint(opts: GenerationOptions, genres: GenrePack[], moods: MoodPack[], season: SeasonPack): PlaylistBlueprint {
  const baseStyle = buildStylePrompt(opts, genres, moods, season);
  const generationPack = generationPacks.find(pack => pack.id === opts.audience);
  const motif = pick(recurringMotifs, Math.abs(opts.projectTitle.length + opts.channel.id.length));
  const concept = opts.customConcept || `${opts.channel.name} ${season.label} playlist with ${genres.map(g => g.label).join(' + ')}`;

  const songs: SongIdea[] = Array.from({ length: opts.songCount }, (_, idx) => {
    const trackNo = idx + 1;
    const title = titleFor(idx, opts);
    const hook = hookFor(title, opts);
    const situation = pick(listenerSituations, idx);
    const emotionArc = pick(emotionArcs, idx);
    const tempo = averageTempo(genres, trackNo);
    const role = pick(songRoles, Math.min(idx, songRoles.length - 1));
    const trackMotif = idx % 3 === 0 ? motif : pick(recurringMotifs, idx + 2);
    const stylePrompt = [
      baseStyle,
      `track ${trackNo} role: ${role}`,
      `${tempo} BPM`,
      `distinct hook phrase: "${hook}"`,
      `listener scene: ${situation}`,
      `use recurring playlist motif: ${motif}`,
      generationPack?.tempoBias,
      'same channel vocal signature and mix balance across the full playlist set'
    ].filter(Boolean).join(', ');
    const lyrics = buildLyrics(opts, title, season, hook, situation, trackMotif);
    const partialSong = {
      trackNo,
      title,
      seasonMoment: season.label,
      listenerSituation: situation,
      emotionArc,
      hookPhrase: hook
    };
    const youtube = buildYoutubeMetadata(opts, partialSong, genres, moods, season);

    return {
      ...partialSong,
      stylePrompt,
      lyrics,
      thumbnailText: youtube.thumbnailText,
      youtube,
      youtubeTitleKo: `${title} | ${season.label} ${opts.channel.name} 플레이리스트`,
      youtubeTitleJa: `${title} | ${season.label} ${opts.channel.name} プレイリスト`,
      qualityScore: 0,
      warnings: []
    };
  });

  return {
    projectTitle: opts.projectTitle,
    channelName: opts.channel.name,
    oneLineConcept: concept,
    sonicSignature: `${genres.map(g => g.label).join(' + ')} / ${moods.map(m => m.label).join(' + ')}`,
    vocalSignature: opts.vocalTone || opts.channel.defaultVocal,
    lyricRules: [
      'original lyrics only',
      'simple memorable hook',
      'consistent recurring motif without repeated lines',
      'Suno section tags included',
      generationPack?.audienceNote || 'audience-safe language'
    ],
    harmonyRules: [
      'money chords enabled by default',
      'emotional chorus lift',
      'gentle maj7/add9 color when appropriate',
      'no direct reference to existing songs'
    ],
    visualRules: [
      season.visualDirection,
      opts.channel.visualIdentity,
      generationPack?.youtubeAngle || 'playlist-friendly thumbnail angle',
      'large readable title typography'
    ],
    songs: scoreSongs(songs, opts.channel)
  };
}
