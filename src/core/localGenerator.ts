import type { ChannelArchetype, GenerationOptions, GenrePack, LyricLanguage, MoodPack, OpeningStyle, PlaylistBlueprint, SeasonPack, SongIdea, YoutubeMetadata } from '../types';
import { generationPacks } from '../data/presets';
import { hookDevices } from '../data/hookDevices';
import { introTexturesForArchetype } from '../data/introTextures';
import { ARRANGEMENT_DENSITY_TEXT_BY_LEVEL, arrangementDensityLevel, arrangementNarrativeForGenres, buildChannelPromptParts, buildExcludePrompt, hookStyleDirectives, rotatingArrangementNarrativeForGenres, rotatingGenreSignatureText, rotatingGenreText, rotatingInstrumentText } from './promptComposer';
import { composeStylePrompt, countWords, STYLE_PROMPT_OVER_LIMIT_WARNING, STYLE_WORD_TARGET_MAX, SUNO_COPY_LIMIT, type PromptPart } from './promptBudget';
import { resolvePackagingLanguage } from './packagingLanguage';
import { buildPersonaStylePrompt, buildSoundSignature, compactMoneyChord, openingDurationText, PERSONA_STYLE_LIMIT } from './soundSignature';
import { buildProgressionPlan, usesMoneyChordQuota } from './moneyChordPlan';
import { applyDuetSectionVocalTags, buildVocalPlan, buildVocalVariantPlan, DEFAULT_KIDS_VOCAL_QUOTA, ensureVocalMetaTag, resolveVocalMetaTag, usesVocalQuota, vocalDescriptionFor } from './vocalPlan';
import { scoreSongs } from './quality';
import { AI_DISCLOSURE_LINE, sanitizePublicYoutubeTags } from './exportCompliance';
import { matchVocalPreset } from '../data/vocalPresets';
import { buildHookDevicePlan, hookDeviceIdsForNarrative } from './hookDevicePlan';
import { getHookDeviceById } from '../data/hookDevices';
import { buildIntroTexturePlan, introTextureTagForId } from './introTexturePlan';
import { buildTempoBandPlan, resolveTempoWithBand } from './tempoPlan';
import { audienceProfileForAgeGroup, tempoBandsForProfile } from '../data/audienceProfiles';
import { enforceSingleBpmText } from './bpmDedupe';
import { composeKidsLyrics, type KidsLyricTheme } from './kidsLyricEngine';
import { runOpeningContest, type OpeningPackContext, type OpeningRole } from './openingContest';
import {
  ADULT_STRUCTURE_TEMPLATE_IDS,
  applyAxisAllocation,
  ARRANGEMENT_DENSITY_IDS,
  KIDS_STRUCTURE_TEMPLATE_IDS,
  VOCAL_TYPE_IDS
} from './diversityAllocation';
import { buildLyricThemePlan, buildPovPlan, buildSectionStylePlan, kidsEngineThemeForLyricSlot, lyricThemeForSlot } from './lyricDiversityPlan';
import { buildGenreRotationPlan, genresForTrack } from './genreRotation';
import { conceptLyricImages, conceptStyleText, promptPriorityForTrack, resolveConceptInfluence, variedVocalText } from './conceptDiversity';
import {
  buildStructureTemplatePlan,
  composeLyrics,
  createLyricBatchPools,
  createTitleGenerator,
  hashSeed,
  HOOK_SHAPES,
  seedForBlueprint,
  seasonWordFor,
  shuffle,
  targetHookEmotionalWeight,
  titleFromHook,
  UniquePool,
  wantsFinalChorusModulation,
  type HookContext,
  type TitleGenerator,
  type TitleResult
} from './lyricEngine';
import { findArtistReferenceLeaks } from './artistReferenceDecomposer';

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
  { english: 'first light of evening', korean: '하나둘 켜지는 불빛', japanese: 'ひとつずつ灯る明かり' }
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

export const recurringMotifs: LocalizedPhrase[] = [
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

/**
 * TASK I1 (v3.11) — track 1 is always 'cold-open' and tracks 2-3 are always
 * 'flagship', replacing whatever songRoles[idx] would otherwise have said
 * ('clear opener' / 'gentle early lift' / 'first nostalgic turn'). The
 * songRoles array itself is untouched — every other position still reads
 * from it exactly as before — so the existing emotional-curve design for
 * tracks 4+ is unaffected.
 */
export function resolveSongRole(trackNo: number, idx: number): string {
  if (trackNo === 1) return 'cold-open';
  if (trackNo === 2 || trackNo === 3) return 'flagship';
  return songRoles[Math.min(idx, songRoles.length - 1)];
}

/** TASK I1 (v3.11) — per-archetype recommendation table from the brief; every archetype resolves to a concrete choice, 'lofi-study' being the only one whose recommendation is 'hum-intro'. */
export function defaultOpeningStyleForArchetype(archetype?: ChannelArchetype): 'hook-forward' | 'hum-intro' {
  return archetype === 'lofi-study' ? 'hum-intro' : 'hook-forward';
}

/** 'auto' (or unset) resolves per-archetype; an explicit user choice always wins. */
export function resolveOpeningStyle(requested: OpeningStyle | undefined, archetype?: ChannelArchetype): 'hook-forward' | 'hum-intro' {
  if (requested === 'hook-forward' || requested === 'hum-intro') return requested;
  return defaultOpeningStyleForArchetype(archetype);
}

/** Re-exported for existing callers/tests that import this from localGenerator.ts (TASK I1, v3.11) — the real definition lives in soundSignature.ts so both the plain and Persona-mode style builders share one implementation. */
export { openingDurationText } from './soundSignature';

/**
 * TASK I2 (v3.11) — the cold-open (track 1) / flagship (tracks 2-3) path
 * through the same `gen` (createTitleGenerator's TitleGenerator) state
 * nextTitle() itself uses, except the single composeHook() call is replaced
 * with a k=3 local contest (see core/openingContest.ts). Mutates gen's
 * usedHooks/usedTitles/index exactly like calling gen(role) would — callers
 * must use this *instead of* calling gen(role) for the same slot, never both.
 */
export function nextContestedTitle(
  gen: TitleGenerator,
  language: LyricLanguage,
  archetype: ChannelArchetype | undefined,
  role: string,
  openingRole: OpeningRole,
  packContext: OpeningPackContext,
  k = 3,
  /** v3.15 — see types.ts's GenerationOptions.earwormMode; threaded straight into runOpeningContest's scoring weight. */
  earwormMode = false
): TitleResult {
  const idx = gen.index;
  const shape = gen.shapeSequence[idx % gen.shapeSequence.length] ?? HOOK_SHAPES[idx % HOOK_SHAPES.length];
  const ctx: HookContext = {
    language,
    shape,
    usedHooks: gen.usedHooks,
    archetype,
    targetSyllables: gen.rhythmTarget,
    emotionalWeight: targetHookEmotionalWeight(role)
  };
  const { winner } = runOpeningContest(gen.seed + 41 + idx * 97, ctx, openingRole, packContext, k, earwormMode);
  gen.usedHooks.add(winner.hook.phrase);
  const title = titleFromHook(winner.hook, gen.seed + 53 + idx * 131, language, gen.usedTitles, archetype);
  gen.usedTitles.add(title);
  gen.index += 1;
  return { title, hook: winner.hook.phrase };
}

/**
 * TASK v3.58 (TASK 4) — `band`, when given, pulls the result toward a
 * genre-independent tempo-band target (core/tempoPlan.ts) instead of the
 * fixed [-4,-2,0,2,3,1,-1,4,2,0] offset cycle, clamped to the audience
 * profile's absolute floor/ceiling — see resolveTempoWithBand. Optional and
 * appended last so every existing caller (e.g. core/batchPreallocation.ts's
 * realtime/Batch/bridge preallocation path) keeps its exact current
 * behavior unless it opts in.
 *
 * The band path maps into genres[0]'s own individual tempoRange (the
 * track's actual lead genre, post core/genreRotation.ts's TASK 1 fix) —
 * NOT the multi-genre blended low/high the no-band fallback below still
 * uses. Measured: blending up to 3 genres' ranges together (this
 * function's original behavior) narrows the effective range every time
 * (e.g. 3 senior genres spanning 82-106 individually blend down to a
 * ~90-102 average), which flattened BPM variety regardless of how wide a
 * spread the band plan asked for — real measurement found stddev stuck at
 * ~3 even with a 4-band plan feeding it. Using the lead genre's own full
 * range instead lets each track's authentic genre range absorb the band
 * spread that genre can actually support.
 */
export function averageTempo(genres: GenrePack[], trackNo: number, band?: { low: number; high: number }, audienceFloor?: number, audienceCeiling?: number) {
  const ranges = genres.length ? genres.map(genre => genre.tempoRange) : ([[92, 104]] as [number, number][]);
  const low = Math.round(ranges.reduce((sum, range) => sum + range[0], 0) / ranges.length);
  const high = Math.round(ranges.reduce((sum, range) => sum + range[1], 0) / ranges.length);
  const center = Math.round((low + high) / 2);
  const offset = [-4, -2, 0, 2, 3, 1, -1, 4, 2, 0][trackNo % 10];
  const fallbackCenter = Math.min(high, Math.max(low, center + offset));
  if (!band) return fallbackCenter;
  const [leadLow, leadHigh] = genres[0]?.tempoRange ?? [low, high];
  return resolveTempoWithBand(leadLow, leadHigh, band, audienceFloor ?? leadLow, audienceCeiling ?? leadHigh, fallbackCenter);
}

function resolveSunoStyleLimit(styleLimit: number | undefined) {
  return styleLimit && styleLimit > 0 ? Math.min(styleLimit, SUNO_COPY_LIMIT) : SUNO_COPY_LIMIT;
}

function resolvePersonaTrackLimit(styleLimit: number | undefined, trackNo: number) {
  const base = resolveSunoStyleLimit(styleLimit);
  return trackNo === 1 ? base : Math.min(base, PERSONA_STYLE_LIMIT);
}

function stylePromptOverLimitWarning(limit: number) {
  return limit === SUNO_COPY_LIMIT
    ? STYLE_PROMPT_OVER_LIMIT_WARNING
    : `스타일 프롬프트가 ${limit}자를 초과합니다 - 수동 확인 필요`;
}

function mergeWarnings(...groups: Array<readonly string[] | undefined>): string[] {
  const warnings: string[] = [];
  for (const group of groups) {
    for (const warning of group || []) {
      if (!warnings.includes(warning)) warnings.push(warning);
    }
  }
  return warnings;
}

function warningsForComposedPrompt(composed: { withinLimit: boolean; warnings?: string[] }, limit: number) {
  return composed.withinLimit
    ? mergeWarnings(composed.warnings)
    : mergeWarnings(composed.warnings, [stylePromptOverLimitWarning(limit)]);
}

/** TASK v3.24 — exported for claudeCodeBridge.ts's importSongsJson: an imported song list still needs the same pack-level identity (oneLineConcept/sonicSignature/vocalSignature/lyricRules/harmonyRules/visualRules) any other blueprint has, computed the same deterministic (no-API-call) way local generation already does. */
export function buildSignatureBlueprint(
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
  const seed = hashSeed(seedForBlueprint(opts));
  const genrePool = Array.from(new Set((opts.genreIds ?? genres.map(genre => genre.id)).filter(Boolean)));
  const autoGenrePlan = buildGenreRotationPlan(genrePool, blueprint.songs.length, seed);
  const genrePlan = applyAxisAllocation(autoGenrePlan, opts.diversityAllocations, 'genre', genrePool);
  const autoIntroTexturePlan = buildIntroTexturePlan(opts.channel.archetype, blueprint.songs.length, seed, opts.introUniqueness);
  const introTexturePool = introTexturesForArchetype(opts.channel.archetype).map(texture => texture.id);
  const introTexturePlan = applyAxisAllocation(autoIntroTexturePlan, opts.diversityAllocations, 'introTexture', introTexturePool);
  const songs = blueprint.songs.map((song, idx) => {
    const trackNo = song.trackNo;
    const genreId = genrePlan[idx];
    const trackGenres = genresForTrack(genres, genreId, opts.genreBlendWeights);
    const tempo = averageTempo(trackGenres, trackNo);
    // TASK I1 (v3.11) — prefer the role actually assigned at generation time
    // (including any manual promotion via core/openingOverride.ts) over
    // recomputing from idx; only legacy packs saved before songRole existed
    // fall back to the idx-based lookup.
    const role = song.songRole || resolveSongRole(trackNo, idx);
    const openingStyle = role === 'cold-open' ? (song.openingStyle || resolveOpeningStyle(opts.openingStyle, opts.channel.archetype)) : undefined;
    const introTextureText = introTextureTagForId(introTexturePlan[idx]);
    const trackNarrativeText = rotatingArrangementNarrativeForGenres(trackGenres, idx);
    const excludePrompt = buildExcludePrompt(opts, trackGenres);
    const composed = opts.personaMode
      ? composePersonaSongStylePrompt({
        blueprint: signatureBlueprint,
        opts,
        genres,
        hookPhrase: song.hookPhrase,
        trackNo,
        role,
        tempo,
        openingStyle,
        styleLimitValue: resolvePersonaTrackLimit(styleLimit, trackNo)
      })
      : composeStylePrompt([
        ...channelParts.filter(part =>
          !(role === 'cold-open' && part.id === 'duration')
          && part.id !== 'genre'
          && part.id !== 'genreNarrative'
          && part.id !== 'genreSignature'
          && part.id !== 'instruments'
        ),
        { id: 'genre' as const, text: rotatingGenreText(trackGenres, seed, idx) },
        ...(trackGenres[0]?.signatureSound ? [{ id: 'genreSignature' as const, text: rotatingGenreSignatureText(trackGenres, seed, idx), shortForm: trackGenres[0].shortSignatureSound, minimalForm: trackGenres[0].minimalSignatureSound }] : []),
        ...(trackNarrativeText ? [{ id: 'genreNarrative' as const, text: trackNarrativeText }] : []),
        ...(role === 'cold-open' ? [{ id: 'duration' as const, text: openingDurationText(role, openingStyle, opts.durationTarget) }] : []),
        ...(introTextureText ? [{ id: 'introTexture' as const, text: introTextureText }] : []),
        { id: 'instruments' as const, text: rotatingInstrumentText(trackGenres, seed, idx) },
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
      ], styleLimitValue, styleLimitValue, undefined, idx);
    const stylePrompt = enforceSingleBpmText(composed.prompt, tempo);
    const promptWarnings = warningsForComposedPrompt(composed, styleLimitValue);
    return {
      ...song,
      stylePrompt,
      excludePrompt,
      ...(genreId ? { genreId } : {}),
      genreText: rotatingGenreText(trackGenres, seed, idx),
      songRole: role,
      openingStyle,
      warnings: mergeWarnings(song.warnings, promptWarnings),
      promptLength: stylePrompt.length,
      promptWithinLimit: stylePrompt.length <= styleLimitValue,
      promptDroppedTerms: composed.droppedTerms,
      promptWordCount: countWords(stylePrompt),
      promptWithinWordTarget: countWords(stylePrompt) <= STYLE_WORD_TARGET_MAX
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
  openingStyle?: 'hook-forward' | 'hum-intro';
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
    limit: input.styleLimitValue,
    openingStyle: input.openingStyle
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
  const tags = sanitizePublicYoutubeTags(Array.from(new Set(baseTags.map(tag => tag.trim()).filter(Boolean)))).slice(0, 18);
  const title = `${song.title} - ${season.label} ${channelName} Playlist`;
  // TASK v3.39.1 Part C2 — real exported output showed
  // "Suno style prompt and lyrics are generated as original material for
  // <channel name>" going straight into the public description field: an
  // internal/dev-facing sentence, not copy meant to be posted. Replaced with
  // AI_DISCLOSURE_LINE (core/exportCompliance.ts) — the actual policy-facing
  // disclosure YouTube's Studio "Altered or synthetic content" flow expects
  // creators to also state in their own words, not an internal note about
  // how this app works.
  const description = [
    `${song.title} is track ${song.trackNo} from ${opts.projectTitle}.`,
    `Concept: ${opts.customConcept || opts.channel.promise}`,
    `Mood: ${song.listenerSituation}, ${song.seasonMoment}.`,
    AI_DISCLOSURE_LINE,
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

/**
 * TASK v3.58 TASK 3 — picks a small, per-song-varying subset of an
 * artist-reference-derived descriptor pool (era tag always first/anchored,
 * then 2 shuffled traits), mirroring promptComposer.ts's rotatingInstrumentText/
 * rotatingGenreSignatureText anchor+shuffle pattern so this new atom source
 * doesn't become yet another clause identical across every song in the pack.
 */
function rotatingArtistStyleAtoms(pool: string[], seed: number, index: number): string[] {
  if (!pool.length) return [];
  const [anchor, ...rest] = pool;
  if (!rest.length) return [anchor];
  const shuffled = shuffle(rest, seed + index * 173);
  return [anchor, ...shuffled.slice(0, 2)];
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
  const conceptInfluence = resolveConceptInfluence(opts.customConcept);
  const conceptImages = conceptLyricImages(opts.customConcept);
  // TASK v3.58 TASK 3 — every atom here is already name-free (built by
  // core/artistReferenceDecomposer.ts and re-checked here as defense in
  // depth — see findArtistReferenceLeaks), but they're still just one flat
  // list shared by the whole pack; rotatingArtistStyleAtoms below picks a
  // different small subset per song so 18 songs don't all carry the exact
  // same extra clause.
  const artistStyleAtomPool = (opts.artistReferenceStyleAtoms || []).filter(atom => findArtistReferenceLeaks(atom).length === 0);
  const channelParts = buildChannelPromptParts(opts, genres, moods, season);
  const styleLimitValue = resolveSunoStyleLimit(styleLimit);
  const signatureBlueprint = buildSignatureBlueprint(opts, genres, moods, season, concept);

  const seedBase = seedForBlueprint(opts);
  const seed = hashSeed(seedBase);
  // TASK v3.58 (TASK 4) — genre-independent tempo-band distribution (see
  // core/tempoPlan.ts), so BPM variety comes from a deliberate, data-driven
  // spread across the audience profile's own tempo range instead of only
  // from which genre happened to be assigned per track.
  const audienceProfile = audienceProfileForAgeGroup(opts.audience);
  const tempoBands = tempoBandsForProfile(audienceProfile);
  const tempoBandPlan = tempoBands ? buildTempoBandPlan(tempoBands, opts.songCount, seed) : [];
  const genrePool = Array.from(new Set((opts.genreIds ?? genres.map(genre => genre.id)).filter(Boolean)));
  const autoGenrePlan = buildGenreRotationPlan(genrePool, opts.songCount, seed);
  const genrePlan = applyAxisAllocation(autoGenrePlan, opts.diversityAllocations, 'genre', genrePool);
  const situationPool = new UniquePool(listenerSituations, seed + 21);
  const emotionArcPool = new UniquePool(emotionArcs, seed + 22);
  const motifPool = new UniquePool(recurringMotifs, seed + 23);
  // TASK H2 (v3.13) — the primary selected genre's own lyric imagery (see
  // GenrePack.lyricFlavorImages), resolved to this pack's lyricLanguage once
  // up front. Undefined for genres without an entry — composeLyrics falls
  // back to the generic filler pool in that case, unchanged from before v3.13.
  const genreFlavorImages = genres[0]?.lyricFlavorImages?.map(image => phraseFor(image, opts.lyricLanguage));
  const nextTitle = createTitleGenerator(opts.lyricLanguage, seedBase, opts.songCount, avoid, opts.channel.archetype);
  const lyricPools = createLyricBatchPools(opts.lyricLanguage, seedBase);
  const packMotif = recurringMotifs[seed % recurringMotifs.length];
  // TASK I2 (v3.11) — "팩에서 고른 moodIds/genreIds" per the brief: the plain
  // set of ids the user selected for the whole pack, not a derived/weighted
  // statistic.
  const openingPackContext: OpeningPackContext = { dominantGenreIds: opts.genreIds, dominantMoodIds: opts.moodIds };

  // TASK v3.33 Part C — per-song money-chord progression quota (opt-in via
  // usesMoneyChordQuota: only when the channel hasn't picked a specific
  // moneyChordMode, and only for archetypes with a real signature
  // progression). roles is computed as its own pre-pass since
  // buildProgressionPlan needs every trackNo's role before the main loop
  // below assigns anything else.
  const songRoles = Array.from({ length: opts.songCount }, (_, idx) => resolveSongRole(idx + 1, idx));
  const progressionPlan = usesMoneyChordQuota(opts) ? buildProgressionPlan(opts.channel.archetype, seed, songRoles) : null;
  // TASK v3.38 Part B2 — per-song male/female/mixed vocal-type quota, active
  // only for the 'kids' channel archetype. Mirrors progressionPlan's
  // pre-pass shape; vocalQuota falls back to the 6/6/6 default when the
  // channel/opts didn't set one explicitly.
  const autoVocalPlan = usesVocalQuota(opts) ? buildVocalPlan(opts.vocalQuota ?? DEFAULT_KIDS_VOCAL_QUOTA, opts.songCount, seed) : null;
  const vocalPlan = autoVocalPlan
    ? applyAxisAllocation(autoVocalPlan, opts.diversityAllocations, 'vocalType', VOCAL_TYPE_IDS)
    : null;
  // TASK v3.41 Part A2/D — mirrors batchPreallocation.ts's own
  // buildVocalVariantPlan call (same seed) so the local and realtime/Batch/
  // bridge paths rotate through the same per-song wording for the same opts.
  const vocalVariantPlan = vocalPlan ? buildVocalVariantPlan(vocalPlan, seed) : null;
  // TASK v3.39.1 Part H4 — matches batchPreallocation.ts's own fallback so
  // the local path's lyric meta tag agrees with what the realtime/Batch/
  // bridge paths would tag the same opts with.
  const fallbackVocalText = opts.vocalTone?.trim() || opts.channel.defaultVocal;
  // TASK v3.41 Part A1 — mirrors batchPreallocation.ts's fallbackVocalGender.
  const fallbackVocalGender = matchVocalPreset(fallbackVocalText)?.gender;
  // TASK v3.42 Part B2 — mirrors batchPreallocation.ts's own hookDevicePlan
  // (same seed), applied unconditionally (every archetype).
  const narrativeText = arrangementNarrativeForGenres(genres);
  const hookDevicePlan = applyAxisAllocation(
    buildHookDevicePlan(opts.songCount, seed, hookDeviceIdsForNarrative(narrativeText)),
    opts.diversityAllocations,
    'hookDevice',
    hookDevices.map(device => device.id)
  );
  const introTexturePlan = applyAxisAllocation(
    buildIntroTexturePlan(opts.channel.archetype, opts.songCount, seed, opts.introUniqueness),
    opts.diversityAllocations,
    'introTexture',
    introTexturesForArchetype(opts.channel.archetype).map(texture => texture.id)
  );
  // TASK v3.42 Part C — per-song lyric section-tag shape (see
  // lyricEngine.ts's buildStructureTemplatePlan); track 1 always resolves to
  // 'T1' inside composeLyrics regardless of what this plan assigns it.
  const structureTemplatePlan = applyAxisAllocation(
    buildStructureTemplatePlan(opts.songCount, seed, opts.channel.archetype),
    opts.diversityAllocations,
    'structureTemplate',
    opts.channel.archetype === 'kids' ? KIDS_STRUCTURE_TEMPLATE_IDS : ADULT_STRUCTURE_TEMPLATE_IDS
  );
  if (structureTemplatePlan.length) structureTemplatePlan[0] = 'T1';
  const arrangementDensityPlan = applyAxisAllocation(
    Array.from({ length: opts.songCount }, (_, idx) => arrangementDensityLevel(seed, idx)),
    opts.diversityAllocations,
    'arrangementDensity',
    ARRANGEMENT_DENSITY_IDS
  );
  const lyricThemePlan = buildLyricThemePlan(opts, seed);
  const povPlan = buildPovPlan(opts, seed);
  const sectionStylePlan = buildSectionStylePlan(opts.songCount, seed, structureTemplatePlan);

  const songs: SongIdea[] = Array.from({ length: opts.songCount }, (_, idx) => {
    const trackNo = idx + 1;
    const role = songRoles[idx];
    // TASK I1/I2 (v3.11) — tracks 1-3 run a local k=3 hook contest instead of
    // taking the first composeHook() candidate; every other track is
    // unchanged. nextContestedTitle mutates the exact same nextTitle
    // state (usedHooks/usedTitles/index) nextTitle(role) would have, so
    // later tracks can never collide with a contest-picked hook.
    const { title, hook } = trackNo <= 3
      ? nextContestedTitle(nextTitle, opts.lyricLanguage, opts.channel.archetype, role, role === 'cold-open' ? 'cold-open' : 'flagship', openingPackContext, 3, opts.earwormMode)
      : nextTitle(role);
    const openingStyle = role === 'cold-open' ? resolveOpeningStyle(opts.openingStyle, opts.channel.archetype) : undefined;
    const situationOption = situationPool.take();
    const situation = situationOption.english;
    const emotionArc = emotionArcPool.take();
    const genreId = genrePlan[idx];
    const trackGenres = genresForTrack(genres, genreId, opts.genreBlendWeights);
    const tempo = averageTempo(trackGenres, trackNo, tempoBandPlan[idx], audienceProfile.tempoFloor, audienceProfile.tempoCeiling);
    const lyricThemeId = lyricThemePlan[idx];
    const lyricTheme = lyricThemeForSlot(lyricThemeId, opts);
    const lyricThemeText = lyricTheme?.scene;
    const lyricThemeArc = lyricTheme?.emotionalArc;
    const listenerScene = lyricThemeText || situation;
    const trackMotifOption = motifPool.take();
    const manualKidsTheme = kidsEngineThemeForLyricSlot(lyricThemeId) as KidsLyricTheme | undefined;
    const sectionStyle = sectionStylePlan[idx];
    // TASK v3.38 Part B3 — the 'kids' channel archetype uses a dedicated,
    // self-contained lyric body composer instead of the adult engine's
    // situation/motif pools (coffee, commute, quiet longing — unsafe for
    // children's content). Title/hook (above) are unaffected: they already
    // come from the kid-safe hookBanks/kids.ts vocabulary via
    // opts.channel.archetype, independent of this branch.
    const { lyrics: composedLyrics, hookPhrase } = opts.channel.archetype === 'kids'
      ? composeKidsLyrics({ language: opts.lyricLanguage, title, hook, seed: seed + trackNo * 13, theme: manualKidsTheme })
      : composeLyrics({
        language: opts.lyricLanguage,
        season,
        title,
        hook,
        situation: phraseFor(situationOption, opts.lyricLanguage),
        motif: phraseFor(trackMotifOption, opts.lyricLanguage),
        role,
        pools: lyricPools,
        openingStyle,
        genreFlavorImages,
        conceptImages,
        structureTemplate: structureTemplatePlan[idx]
      });
    // TASK A1/A2 (v3.5): every fragment is tagged with its priority id and
    // handed to composeStylePrompt, which dedupes and — if the combined
    // length would cross the Suno-safe budget — drops the lowest-priority
    // ids first (never truncating mid-phrase). See promptComposer.ts.
    const vocalType = vocalPlan ? vocalPlan[idx] : undefined;
    // TASK v3.41 Part A2/D — same rotation index batchPreallocation.ts's
    // preallocateSongSlots uses for the same opts/trackNo.
    const vocalDescriptionText = vocalType
      ? vocalDescriptionFor(vocalType, opts.lyricLanguage, vocalVariantPlan ? vocalVariantPlan[idx] : 0)
      : variedVocalText(fallbackVocalText, idx, trackGenres[0], opts.channel.archetype);
    // TASK v3.41 Part A1 — vocalType already IS the explicit gender for a
    // kids-quota song; otherwise falls back to the matched preset's own
    // gender (mirrors batchPreallocation.ts's fallbackVocalGender) so a
    // locally generated non-kids pack also gets a correct duet/group tag
    // instead of relying on prose sniffing alone.
    const vocalGender = vocalType ?? fallbackVocalGender;
    // TASK v3.39.1 Part H4 — realtime/Batch/bridge output all get a
    // [male vocal]/[female vocal]/[children's choir] lyric meta tag via
    // batchPreallocation.ts's reconcileWithPreassignedSlot, but a local-only
    // generated pack never passes through that function, so its lyrics
    // always started with the section tag ([short intro], etc.) and no
    // vocal tag at all. Same tag resolution, applied directly here instead.
    const lyrics = ensureVocalMetaTag(applyDuetSectionVocalTags(composedLyrics, vocalGender), resolveVocalMetaTag(vocalType, vocalGender, vocalDescriptionText));
    // TASK v3.48.1 — narrative genres still get one auxiliary hook device,
    // but the auto plan filters out devices already described by the
    // arrangement narrative so the two cues do not fight each other.
    const hookDeviceText = getHookDeviceById(hookDevicePlan[idx])?.prompt;
    const introTextureText = introTextureTagForId(introTexturePlan[idx]);
    const trackNarrativeText = rotatingArrangementNarrativeForGenres(trackGenres, idx);
    const genreText = rotatingGenreText(trackGenres, seed, idx);
    const excludePrompt = buildExcludePrompt(opts, trackGenres);
    const songParts: PromptPart[] = [
      ...channelParts.filter(part =>
        !(role === 'cold-open' && part.id === 'duration')
        && !(progressionPlan && part.id === 'moneyChord')
        && part.id !== 'vocal'
        && part.id !== 'genreNarrative'
        && part.id !== 'genreSignature'
        && part.id !== 'instruments'
        && part.id !== 'genre'
      ),
      // TASK v3.42 Part D follow-up — always overrides channelParts' flat
      // whole-pack genre atom with a per-song rotated anchor+2-3 combination;
      // see promptComposer.ts's rotatingGenreText.
      { id: 'genre' as const, text: genreText },
      ...(trackGenres[0]?.signatureSound ? [{ id: 'genreSignature' as const, text: rotatingGenreSignatureText(trackGenres, seed, idx), shortForm: trackGenres[0].shortSignatureSound, minimalForm: trackGenres[0].minimalSignatureSound }] : []),
      ...(trackNarrativeText ? [{ id: 'genreNarrative' as const, text: trackNarrativeText }] : []),
      ...(conceptInfluence
        ? [{
          id: 'concept' as const,
          // TASK v3.58 TASK 3 — artist-derived descriptors listed first: the
          // soft word-budget stage's concept floor-reduction (see
          // promptBudget.ts's CONCEPT_FLOOR_ATOMS) keeps only the first N
          // atoms of this joined group, and a concrete, authentic descriptor
          // ("jangly 12-string electric guitar") is worth protecting ahead
          // of conceptStyleText's own generic fallback filler ("concept cue:
          // custom concept focus") when a long customConcept forces a choice
          // between them.
          text: [...rotatingArtistStyleAtoms(artistStyleAtomPool, seed, idx), conceptStyleText(opts.customConcept, idx)].filter(Boolean).join(', ')
        }]
        : []),
      ...(role === 'cold-open' ? [{ id: 'duration' as const, text: openingDurationText(role, openingStyle, opts.durationTarget) }] : []),
      // TASK v3.33 Part C — per-song progression override when the quota plan
      // is active; channelParts' flat whole-pack moneyChord atom is filtered
      // out above for exactly this case, so there's never a duplicate.
      ...(progressionPlan
        ? [{ id: 'moneyChord' as const, text: compactMoneyChord(opts, { moneyChordIdOverride: progressionPlan[idx], includeFeelReinforcement: true }) }]
        : channelParts.some(part => part.id === 'moneyChord')
          ? []
          : [{ id: 'moneyChord' as const, text: compactMoneyChord(opts, { includeFeelReinforcement: true }) }]),
      // TASK v3.38 Part B2 — per-song vocal-type override when the kids
      // quota plan is active; this 'vocal' id is in promptBudget.ts's
      // ESSENTIAL_TERM_IDS, so it's never trimmed away like the whole-pack
      // vocal atom it replaces.
      //
      // TASK v3.58 (TASK 4) — a single audience-profile constraint (vocal
      // register/diction/mix character, see types.ts's AudienceProfile) is
      // appended here rather than left in the non-essential 'mood' atom it
      // was first tried in: 'mood' sits at a low priority position and
      // measured as low as 6/18 songs actually keeping it under real budget
      // pressure — the exact opposite of "applies unconditionally to every
      // song" this profile exists to guarantee. 'vocal' is essential and
      // never dropped, so this is a reliable home. Only the single most
      // load-bearing constraint (constraints[0]) is added here, not the
      // whole list — appending all of them measurably raised cross-genre
      // style similarity (shared essential text is identical regardless of
      // genre) past this app's own 0.35 jazz-vs-adult-contemporary
      // regression threshold, and squeezed out earwormMode's/genreNarrative's
      // own budget. The rest of the profile's constraints still apply via
      // excludePrompt's exclusions (see promptComposer.ts's
      // buildExcludePrompt) even though only one constraint phrase makes it
      // into the Style field itself. vocalDescriptionText itself
      // (unmodified) still drives the lyrics' vocal-meta-tag/gender
      // resolution above — only this style-prompt-facing copy gets the
      // extra atom.
      { id: 'vocal' as const, text: [vocalDescriptionText, audienceProfile.constraints[0]].filter(Boolean).join(', ') },
      ...(hookDeviceText ? [{ id: 'hookDevice' as const, text: hookDeviceText }] : []),
      ...(introTextureText ? [{ id: 'introTexture' as const, text: introTextureText }] : []),
      // TASK v3.42 Part A1 — always overrides channelParts' flat whole-pack
      // instruments atom (filtered out above) with a per-song rotated
      // anchor+1-2 combination; see promptComposer.ts's rotatingInstrumentText.
      { id: 'instruments' as const, text: rotatingInstrumentText(trackGenres, seed, idx) },
      // TASK v3.42 Part A3 — sparse/medium/full rotation.
      { id: 'arrangementDensity' as const, text: ARRANGEMENT_DENSITY_TEXT_BY_LEVEL[arrangementDensityPlan[idx]] },
      { id: 'hook', text: hookStyleDirectives(hookPhrase, opts.lyricDepth) },
      { id: 'tempo', text: `${tempo} BPM` },
      { id: 'songRole', text: `track ${trackNo} role: ${role}` },
      { id: 'motif', text: lyricThemeText ? `lyric scene: ${lyricThemeText}` : `use recurring playlist motif: ${packMotif.english}` },
      { id: 'listenerScene', text: lyricThemeText ? `listener scene: ${lyricThemeText}; supporting detail: ${situation}` : `listener scene: ${situation}` },
      {
        id: 'mixNotes',
        text: [
          generationPack?.tempoBias,
          sectionStyle ? `verse style: ${sectionStyle.verseStyleText}; chorus style: ${sectionStyle.chorusStyleText}` : null,
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
        openingStyle,
        styleLimitValue: resolvePersonaTrackLimit(styleLimit, trackNo)
      })
      : composeStylePrompt(
        songParts,
        styleLimitValue,
        styleLimitValue,
        promptPriorityForTrack(idx),
        idx
      );
    const stylePrompt = enforceSingleBpmText(composed.prompt, tempo);
    const promptWarnings = warningsForComposedPrompt(composed, opts.personaMode ? resolvePersonaTrackLimit(styleLimit, trackNo) : styleLimitValue);
    const partialSong = {
      trackNo,
      title,
      seasonMoment: season.label,
      listenerSituation: listenerScene,
      emotionArc: lyricThemeArc || emotionArc,
      hookPhrase
    };
    const youtube = buildYoutubeMetadata(opts, partialSong, genres, moods, season);

    return {
      ...partialSong,
      stylePrompt,
      excludePrompt,
      songRole: role,
      openingStyle,
      lyrics,
      thumbnailText: youtube.thumbnailText,
      youtube,
      youtubeTitleKo: `${title} | ${season.label} ${opts.channel.name} 플레이리스트`,
      youtubeTitleJa: `${title} | ${season.label} ${opts.channel.name} プレイリスト`,
      qualityScore: 0,
      warnings: promptWarnings,
      promptLength: stylePrompt.length,
      promptWithinLimit: stylePrompt.length <= styleLimitValue,
      promptDroppedTerms: composed.droppedTerms,
      promptWordCount: countWords(stylePrompt),
      promptWithinWordTarget: countWords(stylePrompt) <= STYLE_WORD_TARGET_MAX,
      lyricTheme: lyricThemeId,
      ...(genreId ? { genreId } : {}),
      ...(genreText ? { genreText } : {}),
      ...(lyricThemeText ? { lyricThemeText } : {}),
      ...(lyricThemeArc ? { lyricThemeArc } : {}),
      pov: povPlan[idx],
      ...(sectionStyle ? sectionStyle : {}),
      vocalType
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
    // TASK v3.39.1 Part H5 — scoreSongs previously only ran on the
    // realtime/Batch API/bridge paths (each wired it in separately at their
    // own call sites), so a purely local-generation pack always shipped with
    // qualityScore: 0 and warnings: [] — not because it was flawless, but
    // because nothing had actually checked it. Same gate every other path
    // already runs through.
    songs: scoreSongs(songs, opts.channel, opts.lyricLanguage)
  };
}
