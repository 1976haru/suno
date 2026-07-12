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
    const title = nextTitle();
    const situation = situationPool.take();
    const emotionArc = emotionArcPool.take();
    const tempo = averageTempo(genres, trackNo);
    const role = songRoles[Math.min(idx, songRoles.length - 1)];
    const trackMotif = motifPool.take();
    const { lyrics, hookPhrase } = composeLyrics({
      language: opts.lyricLanguage,
      season,
      title,
      situation,
      motif: trackMotif,
      role,
      pools: lyricPools
    });
    const stylePrompt = [
      baseStyle,
      `track ${trackNo} role: ${role}`,
      `${tempo} BPM`,
      `distinct hook phrase: "${hookPhrase}"`,
      `listener scene: ${situation}`,
      `use recurring playlist motif: ${packMotif}`,
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
