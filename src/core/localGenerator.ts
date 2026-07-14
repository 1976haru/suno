import type { GenerationOptions, GenrePack, MoodPack, PlaylistBlueprint, SeasonPack, SongIdea, YoutubeMetadata } from '../types';
import { generationPacks } from '../data/presets';
import { buildChannelPromptParts, buildExcludePrompt, hookStyleDirectives } from './promptComposer';
import { composeStylePrompt, SUNO_COPY_LIMIT, type PromptPart } from './promptBudget';
import { resolvePackagingLanguage } from './packagingLanguage';
import { buildPersonaStylePrompt, buildSoundSignature, PERSONA_STYLE_LIMIT } from './soundSignature';
import {
  composeLyrics,
  createLyricBatchPools,
  createTitleGenerator,
  hashSeed,
  seedForBlueprint,
  seasonWordFor,
  UniquePool,
  wantsFinalChorusModulation
} from './lyricEngine';

/**
 * Suno-facing text (style prompt, YouTube metadata) stays English regardless
 * of lyricLanguage, but the same "situation" also gets interpolated straight
 * into the lyrics themselves — so it needs a real Korean/Japanese phrase for
 * those languages instead of the English string leaking into the lyrics.
 */
export type SeasonFamily = 'spring' | 'summer' | 'autumn' | 'winter';

export interface LocalizedPhrase {
  english: string;
  korean: string;
  japanese: string;
  /** TASK B2 (v3.5) — which season families this image reads as natural in. Omitted = season-neutral (fine any time of year). Only used by thumbnailSpec.ts's object picker; lyric generation still draws from the full pool regardless of season. */
  seasons?: SeasonFamily[];
}

function phraseFor(phrase: LocalizedPhrase, language: GenerationOptions['lyricLanguage']): string {
  if (language === 'korean') return phrase.korean;
  if (language === 'japanese') return phrase.japanese;
  return phrase.english;
}

/**
 * TASK X5-1 (v3.4) — every enSituation/enPreChorus template plugs this value
 * into a noun slot ("In this X", "Caught up in this X", "Framed by this X",
 * ...); most of those prepositions grammatically require a true noun
 * phrase and can't be rescued by an alternate "while X-ing" wrapper (e.g.
 * "Held here by this watching..." doesn't parse regardless of preposition).
 * Four entries were originally gerund phrases ("writing a letter...",
 * "standing near...", "folding...", "watching...") and broke every
 * template they landed in ("Set inside this watching the first lights come
 * on"). All entries are now noun phrases — the same fix shape as
 * likeMotif()'s article handling: check the grammatical type a slot
 * expects before a value gets plugged into it, and keep the pool
 * type-consistent so it can't recur when new entries are added. Korean/
 * Japanese translations were already independently nominalized and needed
 * no change.
 */
const listenerSituations: LocalizedPhrase[] = [
  { english: 'morning coffee before the day begins', korean: '하루를 여는 아침 커피', japanese: '一日を開く朝のコーヒー' },
  { english: 'quiet walk under seasonal trees', korean: '계절 나무 아래의 조용한 산책', japanese: '季節の木々の下の静かな散歩' },
  { english: 'late cafe seat beside the window', korean: '창가 옆 늦은 카페 자리', japanese: '窓辺の遅い喫茶店の席' },
  { english: 'small kitchen with the radio on', korean: '라디오가 흐르는 작은 부엌', japanese: 'ラジオが流れる小さな台所' },
  { english: 'evening drive through familiar streets', korean: '익숙한 거리를 지나는 저녁 드라이브', japanese: '見慣れた通りを走る夕方のドライブ' },
  { english: 'a letter written after dinner', korean: '저녁 식사 후 편지 쓰는 시간', japanese: '夕食後に手紙を書く時間' },
  { english: 'a warm shop window at dusk', korean: '따뜻한 가게 창가', japanese: '暖かい店の窓辺' },
  { english: 'slow train ride home', korean: '느린 기차를 타고 가는 귀갓길', japanese: 'ゆっくりな列車で帰る道' },
  { english: 'an old sweater folded in a quiet room', korean: '조용한 방에서 개는 오래된 스웨터', japanese: '静かな部屋で畳む古いセーター' },
  { english: 'the first lights of evening', korean: '하나둘 켜지는 불빛', japanese: 'ひとつずつ灯る明かり' }
];

/** Exported for batchPreallocation.ts (TASK B2, v3.6) — pre-allocating songRole/emotionArc/tempo locally, before a batch job is submitted, needs the exact same pools the local generator itself draws from. */
export const emotionArcs = [
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
  { english: 'window rain', korean: '창가의 빗물', japanese: '窓辺の雨音', seasons: ['summer', 'autumn'] },
  { english: 'folded letter', korean: '접힌 편지', japanese: '畳んだ手紙' },
  { english: 'street lamp', korean: '가로등', japanese: '街灯' },
  { english: 'wool sweater', korean: '털 스웨터', japanese: 'ウールのセーター', seasons: ['autumn', 'winter'] },
  { english: 'paper calendar', korean: '종이 달력', japanese: '紙のカレンダー' },
  { english: 'warm cafe window', korean: '카페의 창', japanese: 'カフェの窓' },
  { english: 'candle flame', korean: '촛불의 빛', japanese: 'キャンドルの炎', seasons: ['autumn', 'winter'] },
  { english: 'faded photograph', korean: '빛바랜 사진', japanese: '色あせた写真' },
  { english: 'train ticket', korean: '기차표', japanese: '電車の切符' },
  { english: 'quiet doorway', korean: '조용한 문', japanese: '静かな戸口' },
  { english: 'porcelain cup', korean: '도자기 잔', japanese: '陶器のカップ' },
  { english: 'evening train', korean: '저녁 기차', japanese: '夕方の電車' },
  { english: 'small notebook', korean: '작은 수첩', japanese: '小さなノート' }
];

export const songRoles = [
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

export function averageTempo(genres: GenrePack[], trackNo: number) {
  const ranges = genres.length ? genres.map(genre => genre.tempoRange) : ([[92, 104]] as [number, number][]);
  const low = Math.round(ranges.reduce((sum, range) => sum + range[0], 0) / ranges.length);
  const high = Math.round(ranges.reduce((sum, range) => sum + range[1], 0) / ranges.length);
  const center = Math.round((low + high) / 2);
  const offset = [-4, -2, 0, 2, 3, 1, -1, 4, 2, 0][trackNo % 10];
  return Math.min(high, Math.max(low, center + offset));
}

function resolveSunoStyleLimit(styleLimit: number | undefined) {
  return styleLimit && styleLimit > 0 ? Math.min(styleLimit, SUNO_COPY_LIMIT) : SUNO_COPY_LIMIT;
}

function resolvePersonaTrackLimit(styleLimit: number | undefined, trackNo: number) {
  const base = resolveSunoStyleLimit(styleLimit);
  return trackNo === 1 ? base : Math.min(base, PERSONA_STYLE_LIMIT);
}

function buildSignatureBlueprint(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  concept: string,
  songs: SongIdea[] = []
): PlaylistBlueprint {
  return {
    projectTitle: opts.projectTitle,
    channelName: opts.channel.name,
    oneLineConcept: concept,
    sonicSignature: `${genres.map(g => g.label).join(' + ')} / ${moods.map(m => m.label).join(' + ')}`,
    vocalSignature: opts.vocalTone || opts.channel.defaultVocal,
    lyricRules: [],
    harmonyRules: [],
    visualRules: [season.visualDirection, opts.channel.visualIdentity],
    songs
  };
}

export function rebuildStylePromptsForPersonaMode(
  blueprint: PlaylistBlueprint,
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  styleLimit?: number
): PlaylistBlueprint {
  const channelParts = buildChannelPromptParts(opts, genres, moods, season);
  const styleLimitValue = resolveSunoStyleLimit(styleLimit);
  const signatureBlueprint = buildSignatureBlueprint(opts, genres, moods, season, blueprint.oneLineConcept, blueprint.songs);
  const generationPack = generationPacks.find(pack => pack.id === opts.audience);
  const excludePrompt = buildExcludePrompt(opts);
  const songs = blueprint.songs.map((song, idx) => {
    const trackNo = song.trackNo;
    const tempo = averageTempo(genres, trackNo);
    const role = songRoles[Math.min(idx, songRoles.length - 1)];
    const composed = opts.personaMode
      ? composePersonaSongStylePrompt({
        blueprint: signatureBlueprint,
        opts,
        genres,
        hookPhrase: song.hookPhrase,
        trackNo,
        role,
        tempo,
        styleLimitValue: resolvePersonaTrackLimit(styleLimit, trackNo)
      })
      : composeStylePrompt([
        ...channelParts,
        { id: 'hook', text: hookStyleDirectives(song.hookPhrase, opts.lyricDepth) },
        { id: 'tempo', text: `${tempo} BPM` },
        { id: 'songRole', text: `track ${trackNo} role: ${role}` },
        { id: 'listenerScene', text: `listener scene: ${song.listenerSituation}` },
        {
          id: 'mixNotes',
          text: [
            generationPack?.tempoBias,
            wantsFinalChorusModulation(role) ? 'modulate up a half step for the final chorus' : null,
            'same channel vocal signature and mix balance across the full playlist set'
          ].filter(Boolean).join(', ')
        }
      ], styleLimitValue, styleLimitValue);
    return {
      ...song,
      stylePrompt: composed.prompt,
      excludePrompt,
      promptLength: composed.length,
      promptWithinLimit: composed.withinLimit,
      promptDroppedTerms: composed.droppedTerms,
      promptWordCount: composed.wordCount,
      promptWithinWordTarget: composed.withinWordTarget
    };
  });
  return { ...blueprint, songs };
}

function composePersonaSongStylePrompt(input: {
  blueprint: PlaylistBlueprint;
  opts: GenerationOptions;
  genres: GenrePack[];
  hookPhrase: string;
  trackNo: number;
  role: string;
  tempo: number;
  styleLimitValue: number;
}) {
  const signature = buildSoundSignature(input.blueprint, input.opts, input.opts.channel);
  return buildPersonaStylePrompt({
    signature,
    opts: input.opts,
    genres: input.genres,
    hookPhrase: input.hookPhrase,
    trackNo: input.trackNo,
    role: input.role,
    tempo: input.tempo,
    isSeed: input.trackNo === 1,
    limit: input.styleLimitValue
  });
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
  // TASK D5 (v3.6) — packagingLanguage (market-derived, independently
  // overridable from lyricLanguage) decides the thumbnail's own language;
  // previously all three market branches here produced identical English
  // text, so a Korean or Japanese channel got an English thumbnail whenever
  // its lyrics happened to be in English.
  const packagingLanguage = resolvePackagingLanguage(opts);
  const localizedSeasonWord = packagingLanguage === 'english' ? season.label : seasonWordFor(season, packagingLanguage);
  const thumbnailText = `${localizedSeasonWord}\n${song.title}`;

  return { title, description, tags, thumbnailText };
}

/** Exposed for tests that need to check how often the real recurring motif appears in generated lyrics. */
export function getRecurringMotifWords(language: GenerationOptions['lyricLanguage']): string[] {
  return recurringMotifs.map(phrase => phraseFor(phrase, language));
}

/** All three language forms of every motif, positionally aligned — used by thumbnailSpec.ts to derive display objects and their English equivalent in one pass. */
export function getRecurringMotifPhrases(): LocalizedPhrase[] {
  return recurringMotifs;
}

export function generateLocalBlueprint(
  opts: GenerationOptions,
  genres: GenrePack[],
  moods: MoodPack[],
  season: SeasonPack,
  avoid?: { usedTitles?: string[]; usedHooks?: string[] },
  /** TASK A5 (v3.5) — Suno's own limit may change; the user can raise/lower it in Settings (default SUNO_STYLE_LIMIT). */
  styleLimit?: number
): PlaylistBlueprint {
  const generationPack = generationPacks.find(pack => pack.id === opts.audience);
  const concept = opts.customConcept || `${opts.channel.name} ${season.label} playlist with ${genres.map(g => g.label).join(' + ')}`;
  const channelParts = buildChannelPromptParts(opts, genres, moods, season);
  const styleLimitValue = resolveSunoStyleLimit(styleLimit);
  const signatureBlueprint = buildSignatureBlueprint(opts, genres, moods, season, concept);
  const excludePrompt = buildExcludePrompt(opts);

  const seedBase = seedForBlueprint(opts);
  const seed = hashSeed(seedBase);
  const situationPool = new UniquePool(listenerSituations, seed + 21);
  const emotionArcPool = new UniquePool(emotionArcs, seed + 22);
  const motifPool = new UniquePool(recurringMotifs, seed + 23);
  const nextTitle = createTitleGenerator(opts.lyricLanguage, seedBase, opts.songCount, avoid, opts.channel.archetype);
  const lyricPools = createLyricBatchPools(opts.lyricLanguage, seedBase);
  const packMotif = recurringMotifs[seed % recurringMotifs.length];

  const songs: SongIdea[] = Array.from({ length: opts.songCount }, (_, idx) => {
    const trackNo = idx + 1;
    const role = songRoles[Math.min(idx, songRoles.length - 1)];
    const { title, hook } = nextTitle(role);
    const situationOption = situationPool.take();
    const situation = situationOption.english;
    const emotionArc = emotionArcPool.take();
    const tempo = averageTempo(genres, trackNo);
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
    // TASK A1/A2 (v3.5): every fragment is tagged with its priority id and
    // handed to composeStylePrompt, which dedupes and — if the combined
    // length would cross the Suno-safe budget — drops the lowest-priority
    // ids first (never truncating mid-phrase). See promptComposer.ts.
    const songParts: PromptPart[] = [
      ...channelParts,
      { id: 'hook', text: hookStyleDirectives(hookPhrase, opts.lyricDepth) },
      { id: 'tempo', text: `${tempo} BPM` },
      { id: 'songRole', text: `track ${trackNo} role: ${role}` },
      { id: 'motif', text: `use recurring playlist motif: ${packMotif.english}` },
      { id: 'listenerScene', text: `listener scene: ${situation}` },
      {
        id: 'mixNotes',
        text: [
          generationPack?.tempoBias,
          wantsFinalChorusModulation(role) ? 'modulate up a half step for the final chorus' : null,
          'same channel vocal signature and mix balance across the full playlist set'
        ].filter(Boolean).join(', ')
      }
    ];
    const composed = opts.personaMode
      ? composePersonaSongStylePrompt({
        blueprint: signatureBlueprint,
        opts,
        genres,
        hookPhrase,
        trackNo,
        role,
        tempo,
        styleLimitValue: resolvePersonaTrackLimit(styleLimit, trackNo)
      })
      : composeStylePrompt(
        songParts,
        styleLimitValue,
        styleLimitValue
      );
    const stylePrompt = composed.prompt;
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
      excludePrompt,
      lyrics,
      thumbnailText: youtube.thumbnailText,
      youtube,
      youtubeTitleKo: `${title} | ${season.label} ${opts.channel.name} 플레이리스트`,
      youtubeTitleJa: `${title} | ${season.label} ${opts.channel.name} プレイリスト`,
      qualityScore: 0,
      warnings: [],
      promptLength: composed.length,
      promptWithinLimit: composed.withinLimit,
      promptDroppedTerms: composed.droppedTerms,
      promptWordCount: composed.wordCount,
      promptWithinWordTarget: composed.withinWordTarget
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
      'short 2-5 word hook that bookends and repeats through every chorus',
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
