import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, SeasonPack, SongIdea, YoutubeMetadata } from '../types';
import { generationPacks } from '../data/presets';
import { buildStylePrompt } from './promptComposer';
import {
  composeLyrics,
  createLyricBatchPools,
  createTitleGenerator,
  hashSeed,
  seedForBlueprint,
  UniquePool
} from './lyricEngine';

/**
 * Suno-facing text (style prompt, YouTube metadata) stays English regardless
 * of lyricLanguage, but the same "situation" also gets interpolated straight
 * into the lyrics themselves — so it needs a real Korean/Japanese phrase for
 * those languages instead of the English string leaking into the lyrics.
 */
interface LocalizedPhrase {
  english: string;
  korean: string;
  japanese: string;
}

function phraseFor(phrase: LocalizedPhrase, language: GenerationOptions['lyricLanguage']): string {
  if (language === 'korean') return phrase.korean;
  if (language === 'japanese') return phrase.japanese;
  return phrase.english;
}

const listenerSituations: LocalizedPhrase[] = [
  { english: 'morning coffee before the day begins', korean: '하루를 여는 아침 커피', japanese: '一日を開く朝のコーヒー' },
  { english: 'quiet walk under seasonal trees', korean: '계절 나무 아래의 조용한 산책', japanese: '季節の木々の下の静かな散歩' },
  { english: 'late cafe seat beside the window', korean: '창가 옆 늦은 카페 자리', japanese: '窓辺の遅い喫茶店の席' },
  { english: 'small kitchen with the radio on', korean: '라디오가 흐르는 작은 부엌', japanese: 'ラジオが流れる小さな台所' },
  { english: 'evening drive through familiar streets', korean: '익숙한 거리를 지나는 저녁 드라이브', japanese: '見慣れた通りを走る夕方のドライブ' },
  { english: 'writing a letter after dinner', korean: '저녁 식사 후 편지 쓰는 시간', japanese: '夕食後に手紙を書く時間' },
  { english: 'standing near a warm shop window', korean: '따뜻한 가게 창가', japanese: '暖かい店の窓辺' },
  { english: 'slow train ride home', korean: '느린 기차를 타고 가는 귀갓길', japanese: 'ゆっくりな列車で帰る道' },
  { english: 'folding an old sweater in a quiet room', korean: '조용한 방에서 개는 오래된 스웨터', japanese: '静かな部屋で畳む古いセーター' },
  { english: 'watching the first lights come on', korean: '하나둘 켜지는 불빛', japanese: 'ひとつずつ灯る明かり' }
];

const emotionArcs = [
  'lonely memory to warm acceptance',
  'soft nostalgia to renewed hope',
  'quiet longing to calm gratitude',
  'bittersweet reflection to gentle lift',
  'small sadness to steady comfort',
  'old regret to peaceful closure'
];

const recurringMotifs: LocalizedPhrase[] = [
  { english: 'coffee steam', korean: '커피 김', japanese: 'コーヒーの湯気' },
  { english: 'old radio light', korean: '오래된 라디오 불빛', japanese: '古いラジオの灯り' },
  { english: 'window rain', korean: '창가의 빗물', japanese: '窓辺の雨音' },
  { english: 'folded letter', korean: '접힌 편지', japanese: '畳んだ手紙' },
  { english: 'street lamp', korean: '가로등', japanese: '街灯' },
  { english: 'wool sweater', korean: '털 스웨터', japanese: 'ウールのセーター' },
  { english: 'paper calendar', korean: '종이 달력', japanese: '紙のカレンダー' },
  { english: 'warm cafe window', korean: '카페의 창', japanese: 'カフェの窓' },
  { english: 'candle flame', korean: '촛불의 빛', japanese: 'キャンドルの炎' },
  { english: 'faded photograph', korean: '빛바랜 사진', japanese: '色あせた写真' },
  { english: 'train ticket', korean: '기차표', japanese: '電車の切符' },
  { english: 'quiet doorway', korean: '조용한 문', japanese: '静かな戸口' },
  { english: 'porcelain cup', korean: '도자기 잔', japanese: '陶器のカップ' },
  { english: 'evening train', korean: '저녁 기차', japanese: '夕方の電車' },
  { english: 'small notebook', korean: '작은 수첩', japanese: '小さなノート' }
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

function averageTempo(genres: GenrePack[], trackNo: number) {
  const ranges = genres.length ? genres.map(genre => genre.tempoRange) : ([[92, 104]] as [number, number][]);
  const low = Math.round(ranges.reduce((sum, range) => sum + range[0], 0) / ranges.length);
  const high = Math.round(ranges.reduce((sum, range) => sum + range[1], 0) / ranges.length);
  const center = Math.round((low + high) / 2);
  const offset = [-4, -2, 0, 2, 3, 1, -1, 4, 2, 0][trackNo % 10];
  return Math.min(high, Math.max(low, center + offset));
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

/** Exposed for tests that need to check how often the real recurring motif appears in generated lyrics. */
export function getRecurringMotifWords(language: GenerationOptions['lyricLanguage']): string[] {
  return recurringMotifs.map(phrase => phraseFor(phrase, language));
}

export function generateLocalBlueprint(opts: GenerationOptions, genres: GenrePack[], moods: MoodPack[], season: SeasonPack): PlaylistBlueprint {
  const baseStyle = buildStylePrompt(opts, genres, moods, season);
  const generationPack = generationPacks.find(pack => pack.id === opts.audience);
  const concept = opts.customConcept || `${opts.channel.name} ${season.label} playlist with ${genres.map(g => g.label).join(' + ')}`;

  const seedBase = seedForBlueprint(opts);
  const seed = hashSeed(seedBase);
  const situationPool = new UniquePool(listenerSituations, seed + 21);
  const emotionArcPool = new UniquePool(emotionArcs, seed + 22);
  const motifPool = new UniquePool(recurringMotifs, seed + 23);
  const nextTitle = createTitleGenerator(opts.lyricLanguage, seedBase);
  const lyricPools = createLyricBatchPools(opts.lyricLanguage, seedBase);
  const packMotif = recurringMotifs[seed % recurringMotifs.length];

  const songs: SongIdea[] = Array.from({ length: opts.songCount }, (_, idx) => {
    const trackNo = idx + 1;
    const { title, hook } = nextTitle();
    const situationOption = situationPool.take();
    const situation = situationOption.english;
    const emotionArc = emotionArcPool.take();
    const tempo = averageTempo(genres, trackNo);
    const role = songRoles[Math.min(idx, songRoles.length - 1)];
    const trackMotifOption = motifPool.take();
    const { lyrics, hookPhrase } = composeLyrics({
      language: opts.lyricLanguage,
      season,
      title,
      hook,
      situation: phraseFor(situationOption, opts.lyricLanguage),
      motif: phraseFor(trackMotifOption, opts.lyricLanguage),
      role,
      pools: lyricPools
    });
    const stylePrompt = [
      baseStyle,
      `track ${trackNo} role: ${role}`,
      `${tempo} BPM`,
      `distinct hook phrase: "${hookPhrase}"`,
      `listener scene: ${situation}`,
      `use recurring playlist motif: ${packMotif.english}`,
      generationPack?.tempoBias,
      'same channel vocal signature and mix balance across the full playlist set'
    ].filter(Boolean).join(', ');
    const partialSong = {
      trackNo,
      title,
      seasonMoment: season.label,
      listenerSituation: situation,
      emotionArc,
      hookPhrase
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
    songs
  };
}
