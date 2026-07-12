import type { GenerationOptions, GenrePack, MoodPack, SeasonPack } from '../types';
import { moneyChordPresets } from '../data/moneyChords';

export function buildDurationControl(target: GenerationOptions['durationTarget']) {
  if (target === 'under3m30') {
    return 'concise radio edit, very short intro, no long instrumental break, no extended outro, no unnecessary repetition, complete song around 3 minutes 10 seconds, never exceed 3 minutes 35 seconds';
  }
  if (target === 'under4m') {
    return 'short radio edit, short intro, short bridge, no long instrumental break, no extended outro, complete song under 4 minutes';
  }
  return 'playlist-friendly short song, quick intro, compact structure, complete song around 2 minutes 50 seconds to 3 minutes 20 seconds';
}

export function buildStylePrompt(opts: GenerationOptions, genres: GenrePack[], moods: MoodPack[], season: SeasonPack) {
  const genreText = genres.map(g => g.styleCore).join(', ');
  const instrumentText = Array.from(new Set(genres.flatMap(g => g.instruments))).join(', ');
  const moodText = moods.flatMap(m => m.emotionWords).join(', ');
  const money = moneyChordPresets[opts.moneyChordMode]?.prompt ?? moneyChordPresets.default.prompt;
  const duration = buildDurationControl(opts.durationTarget);
  const avoid = opts.avoidWords.trim() ? `avoid: ${opts.avoidWords}` : 'avoid famous artist imitation, avoid copied melodies, avoid copyrighted song references';

  return [
    genreText,
    `${season.keywords.join(', ')} mood`,
    opts.vocalTone || opts.channel.defaultVocal,
    instrumentText,
    moodText,
    opts.channel.visualIdentity,
    money,
    'clear pronunciation, emotionally warm but restrained, senior-friendly if applicable, polished commercial playlist quality',
    duration,
    avoid
  ].filter(Boolean).join(', ');
}

export function buildSystemInstruction(opts: GenerationOptions) {
  return `You are Suno Weaver Studio, a commercial playlist song planner. Generate original Suno-ready style prompts and lyrics.\n\nRules:\n- Never imitate a specific living artist or existing song.\n- Money chords are mandatory.\n- Keep each song coherent with the channel identity.\n- Generate ${opts.songCount} songs as a consistent set, but each song must have a distinct situation and hook.\n- Lyrics must use Suno section tags.\n- Keep song length controlled for ${opts.durationTarget}.\n- Return valid JSON matching the PlaylistBlueprint shape.`;
}

export function buildUserInstruction(opts: GenerationOptions, genres: GenrePack[], moods: MoodPack[], season: SeasonPack) {
  return {
    channel: opts.channel,
    projectTitle: opts.projectTitle,
    songCount: opts.songCount,
    lyricLanguage: opts.lyricLanguage,
    market: opts.market,
    audience: opts.audience,
    genrePacks: genres,
    moodPacks: moods,
    season,
    vocalTone: opts.vocalTone || opts.channel.defaultVocal,
    perspective: opts.perspective,
    lyricDepth: opts.lyricDepth,
    moneyChordMode: opts.moneyChordMode,
    customConcept: opts.customConcept,
    outputShape: {
      projectTitle: 'string',
      channelName: 'string',
      oneLineConcept: 'string',
      sonicSignature: 'string',
      vocalSignature: 'string',
      lyricRules: ['string'],
      harmonyRules: ['string'],
      visualRules: ['string'],
      songs: [
        {
          trackNo: 1,
          title: 'string',
          seasonMoment: 'string',
          listenerSituation: 'string',
          emotionArc: 'string',
          hookPhrase: 'string',
          stylePrompt: 'string',
          lyrics: 'string with [verse], [chorus], [short bridge], [end]',
          thumbnailText: 'string',
          youtubeTitleKo: 'string optional',
          youtubeTitleJa: 'string optional'
        }
      ]
    }
  };
}
