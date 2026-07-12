import type { BatchContext, GenerationOptions, GenrePack, MoodPack, SeasonPack } from '../types';
import { generationPacks } from '../data/presets';
import { moneyChordPresets } from '../data/moneyChords';
import { safeLyricRules } from '../data/lyrics';

export function buildDurationControl(target: GenerationOptions['durationTarget']) {
  if (target === 'under3m30') {
    return 'concise radio edit, very short intro, no long instrumental break, no extended outro, no unnecessary repetition, complete song around 3 minutes 10 seconds, never exceed 3 minutes 35 seconds';
  }
  if (target === 'under4m') {
    return 'short radio edit, short intro, short bridge, no long instrumental break, no extended outro, complete song under 4 minutes';
  }
  return 'playlist-friendly short song, quick intro, compact structure, no long instrumental break, complete song around 2 minutes 50 seconds to 3 minutes 20 seconds';
}

export function resolveMoneyChordText(opts: GenerationOptions) {
  return opts.moneyChordMode === 'custom' && opts.customMoneyChord.trim()
    ? `custom chord progression: ${opts.customMoneyChord.trim()}, with a clear emotional chorus lift`
    : moneyChordPresets[opts.moneyChordMode]?.prompt ?? moneyChordPresets.default.prompt;
}

export function buildStylePrompt(opts: GenerationOptions, genres: GenrePack[], moods: MoodPack[], season: SeasonPack) {
  const genreText = genres.map(g => g.styleCore).join(', ');
  const instrumentText = Array.from(new Set(genres.flatMap(g => g.instruments))).join(', ');
  const moodText = moods.flatMap(m => m.emotionWords).join(', ');
  const money = resolveMoneyChordText(opts);
  const duration = buildDurationControl(opts.durationTarget);
  const generationPack = generationPacks.find(pack => pack.id === opts.audience);
  const avoid = opts.avoidWords.trim()
    ? `avoid: ${opts.avoidWords}; avoid famous artist imitation, copied melodies, copyrighted song references, soundalike vocals`
    : 'avoid famous artist imitation, copied melodies, copyrighted song references, soundalike vocals';

  return [
    genreText,
    `${season.keywords.join(', ')} mood`,
    opts.vocalTone || opts.channel.defaultVocal,
    instrumentText,
    moodText,
    generationPack?.audienceNote,
    opts.channel.visualIdentity,
    `money chord foundation: ${money}`,
    'clear pronunciation, emotionally warm but restrained, polished commercial playlist quality',
    duration,
    avoid
  ].filter(Boolean).join(', ');
}

export function buildSystemInstruction(opts: GenerationOptions, batch?: BatchContext) {
  const batchNote = batch
    ? `\n\nBatch mode:\n- This request only covers tracks ${batch.trackNoOffset + 1} to ${batch.trackNoOffset + opts.songCount} out of ${batch.totalSongCount} total songs in the pack.\n- Number "trackNo" starting at ${batch.trackNoOffset + 1}, not 1.\n- Never reuse any title or hook phrase already listed in "alreadyUsedTitles" / "alreadyUsedHooks" in the user payload.\n- If "lockedIdentity" is present in the user payload, reuse its sonicSignature, vocalSignature, lyricRules, harmonyRules, and visualRules verbatim so the whole pack stays consistent across batches.`
    : '';

  return `You are Suno Weaver Studio, a commercial playlist song planner. Generate original Suno-ready style prompts, lyrics, and YouTube metadata.

Rules:
- Never imitate a specific artist, singer, band, producer, existing song, melody, lyric, hook, or copyrighted work.
- Do not use "in the style of", "sounds like", "as sung by", or similar imitation language.
- Money chords are mandatory, but the output must still feel original.
- Generate exactly ${opts.songCount} songs as one coherent playlist set.
- Keep a stable sonic/vocal identity across all tracks while varying situations, hooks, titles, and lyrical images.
- Sequence the songs naturally: opener, early lift, middle depth, late-set highlight, warm closer.
- Lyrics must use Suno section tags and must be ready to paste separately from the style prompt.
- Keep song length controlled for ${opts.durationTarget}.
- Include YouTube title, description, tags, and thumbnail text for every song.
- Return valid JSON only, matching the requested PlaylistBlueprint shape.

Safety rules:
${safeLyricRules.map(rule => `- ${rule}`).join('\n')}${batchNote}`;
}

export function buildUserInstruction(opts: GenerationOptions, genres: GenrePack[], moods: MoodPack[], season: SeasonPack, batch?: BatchContext) {
  const generationPack = generationPacks.find(pack => pack.id === opts.audience);

  return {
    channel: opts.channel,
    projectTitle: opts.projectTitle,
    songCount: opts.songCount,
    lyricLanguage: opts.lyricLanguage,
    market: opts.market,
    audience: opts.audience,
    generationPack,
    genrePacks: genres,
    moodPacks: moods,
    season,
    vocalTone: opts.vocalTone || opts.channel.defaultVocal,
    perspective: opts.perspective,
    lyricDepth: opts.lyricDepth,
    moneyChordMode: opts.moneyChordMode,
    customMoneyChord: opts.moneyChordMode === 'custom' ? opts.customMoneyChord : undefined,
    customConcept: opts.customConcept,
    avoidWords: opts.avoidWords,
    trackNoOffset: batch?.trackNoOffset ?? 0,
    totalSongCount: batch?.totalSongCount ?? opts.songCount,
    alreadyUsedTitles: batch?.usedTitles ?? [],
    alreadyUsedHooks: batch?.usedHooks ?? [],
    lockedIdentity: batch?.lockedIdentity ?? null,
    batchPlanning: [
      'Use one recurring visual motif across the pack, but do not repeat the same lyric line.',
      'Track 1 should introduce the playlist identity clearly.',
      'Tracks 2-5 should establish variety without breaking the channel promise.',
      'Middle tracks should add emotional depth and different listener situations.',
      'Final tracks should resolve warmly and feel like a natural closer.',
      'Avoid repeating the same opening image, chorus first line, or thumbnail phrase.',
      'Never repeat any title or hook phrase from alreadyUsedTitles / alreadyUsedHooks.'
    ],
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
          lyrics: 'string with [intro], [verse 1], [chorus], [verse 2], [short bridge], [final chorus], [end]',
          thumbnailText: 'string',
          youtube: {
            title: 'string',
            description: 'string',
            tags: ['string'],
            thumbnailText: 'string'
          },
          youtubeTitleKo: 'string optional',
          youtubeTitleJa: 'string optional',
          qualityScore: 0,
          warnings: []
        }
      ]
    }
  };
}
