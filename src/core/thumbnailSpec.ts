import type { ChannelProfile, DisplayLanguage, GenerationOptions, PlaylistBlueprint, SeasonPack, ThumbnailSpec, ThumbnailVariant } from '../types';
import { paletteForSeason, type ThumbnailPalette } from '../data/thumbnailPalettes';
import { thumbnailArchetypeById, type ThumbnailArchetype, type ThumbnailArchetypeId } from '../data/thumbnailArchetypes';
import { seasonPacks } from '../data/presets';
import { seasonWordFor } from './lyricEngine';
import { getRecurringMotifPhrases, type SeasonFamily } from './localGenerator';
import { resolvePackagingLanguage } from './packagingLanguage';
import { FORBIDDEN_THUMBNAIL_REFERENCE_PATTERNS } from './thumbnailSafety';

export type { ThumbnailSpec, ThumbnailVariant };

// TASK B1 (v3.4): three genuinely different strategies, not the same
// headline reworded — A leads with the season, B leads with a feeling, C
// names the audience outright (a common, effective convention on Korean/
// Japanese senior-audience YouTube, softened to a lifestyle framing in
// English since literal age callouts read oddly there).
const seasonHeadlineSecondLine: Record<DisplayLanguage, string[]> = {
  english: ['Morning', 'Memories', 'Warmth', 'Quietly', 'Gently', 'Evening'],
  korean: ['그 노래', '그 하루', '그 시간', '작은 행복', '오늘의 위로', '우리 계절'],
  japanese: ['その歌', 'あの日々', '静かな朝', 'やさしい時間', '小さな幸せ', 'いつもの朝']
};

const emotionHeadlineFirstLine: Record<DisplayLanguage, string[]> = {
  english: ['Warm', 'Quiet', 'Gentle', 'Soft'],
  korean: ['따뜻한', '조용한', '포근한', '잔잔한'],
  japanese: ['あたたかい', '静かな', 'やさしい', '穏やかな']
};

const emotionHeadlineSecondLine: Record<DisplayLanguage, string[]> = {
  english: ['Memories', 'Comfort', 'Moments', 'Feelings'],
  korean: ['기억', '위로', '하루', '시간'],
  japanese: ['記憶', '時間', 'ひととき', '思い出']
};

const audienceHeadline: Record<DisplayLanguage, [string, string]> = {
  english: ['For Slow', 'Mornings'],
  korean: ['5060세대가', '듣는 팝송'],
  japanese: ['50代60代が', '聴く歌']
};

// seasonWordFor()'s Korean/Japanese entries are already short (<=5 chars),
// but its English branch falls back to season.keywords[0], which can be a
// multi-word phrase well over the 8-char headline budget ("late winter",
// "cherry blossom"). Headline line 1 needs a guaranteed-short word instead.
const shortSeasonWordEnglish: Record<string, string> = {
  'new-year': 'New Year',
  'late-winter': 'Winter',
  'spring-open': 'Spring',
  'cherry-blossom': 'Blossom',
  'may-cafe': 'May Cafe',
  'rainy-season': 'Rainy',
  'summer-night': 'Summer',
  'late-summer-open': 'Summer',
  'early-autumn': 'Autumn',
  'autumn-rain': 'Autumn',
  'maple-autumn': 'Maple',
  'late-autumn': 'Autumn',
  'early-winter': 'Winter',
  'first-snow': 'Snow Day',
  christmas: 'Holiday',
  'year-end': 'Year End'
};

function shortSeasonWord(season: SeasonPack, language: DisplayLanguage): string {
  if (language === 'english') return shortSeasonWordEnglish[season.id] ?? 'Season';
  return seasonWordFor(season, language);
}

/**
 * TASK I4 (v3.11, PART D-1) — variant A (the default-selected recommendation)
 * now prefers track 1's own hook as its second line instead of a generic
 * pool pick, so the thumbnail's headline actually matches what a viewer
 * hears in the first few seconds of the video (track 1 is always the
 * cold-open song — see resolveSongRole). Falls back to the old pool-based
 * pick when no lead hook is available (e.g. an empty pack).
 */
function buildSeasonHeadline(season: SeasonPack, language: DisplayLanguage, seedIndex: number, leadHook?: string): string {
  const seasonWord = shortSeasonWord(season, language);
  if (leadHook?.trim()) {
    return `${seasonWord}\n${leadHook.trim().replace(/,\s*$/, '')}`;
  }
  const pool = seasonHeadlineSecondLine[language];
  return `${seasonWord}\n${pool[seedIndex % pool.length]}`;
}

function buildEmotionHeadline(language: DisplayLanguage, seedIndex: number): string {
  const firstPool = emotionHeadlineFirstLine[language];
  const secondPool = emotionHeadlineSecondLine[language];
  return `${firstPool[seedIndex % firstPool.length]}\n${secondPool[(seedIndex + 1) % secondPool.length]}`;
}

function buildAudienceHeadline(language: DisplayLanguage): string {
  const [line1, line2] = audienceHeadline[language];
  return `${line1}\n${line2}`;
}

const SUBLINE_MAX_CHARS = 12;

function buildSubline(songCount: number, language: DisplayLanguage): string {
  const raw = language === 'korean'
    ? `${songCount}곡 플레이리스트`
    : language === 'japanese'
      ? `${songCount}曲プレイリスト`
      : `${songCount} Songs`;
  return raw.length > SUBLINE_MAX_CHARS ? raw.slice(0, SUBLINE_MAX_CHARS) : raw;
}

// TASK B2 (v3.5) — season id -> broad family, so the object picker can tell
// "wool sweater" (autumn/winter) apart from "cherry blossom" season without
// needing every motif tagged against all 16 individual season ids.
const SEASON_FAMILY: Record<string, SeasonFamily> = {
  'new-year': 'winter',
  'late-winter': 'winter',
  'spring-open': 'spring',
  'cherry-blossom': 'spring',
  'may-cafe': 'spring',
  'rainy-season': 'summer',
  'summer-night': 'summer',
  'late-summer-open': 'summer',
  'early-autumn': 'autumn',
  'autumn-rain': 'autumn',
  'maple-autumn': 'autumn',
  'late-autumn': 'autumn',
  'early-winter': 'winter',
  'first-snow': 'winter',
  christmas: 'winter',
  'year-end': 'winter'
};

function seasonFamilyFor(seasonId: string): SeasonFamily {
  return SEASON_FAMILY[seasonId] ?? 'winter';
}

/**
 * Objects that actually appear in this pack's generated lyrics, restricted
 * to ones that make sense for the current season (TASK B2, v3.5 — a fix
 * report caught "pale blossom street" (spring) and "wool sweater" (winter)
 * landing in the same thumbnail prompt, because the motif pool had no
 * season awareness at all). Falls back to all season-compatible motifs if
 * none matched, e.g. for remotely-generated packs whose lyrics don't reuse
 * the local motif bank.
 */
function pickObjects(blueprint: PlaylistBlueprint, language: DisplayLanguage, seasonId: string): { display: string[]; english: string[] } {
  const family = seasonFamilyFor(seasonId);
  const motifs = getRecurringMotifPhrases().filter(motif => !motif.seasons || motif.seasons.includes(family));
  const matched = motifs.filter(motif => blueprint.songs.some(song => song.lyrics.includes(motif[language])));
  const chosen = (matched.length ? matched : motifs).slice(0, 3);
  return {
    display: chosen.map(motif => motif[language]),
    english: chosen.map(motif => motif.english)
  };
}

// TASK B2 (v3.4): a blanket "no people" was too strict — distant, faceless
// silhouettes (a back turned to camera at a cafe window, two people walking
// a snowy street) genuinely raise emotional pull for this kind of playlist
// thumbnail. What must stay banned is anything that identifies a real
// person: closeups, recognizable faces, real public figures.
const FORBIDDEN_ELEMENTS = [
  '실존 인물 사진 (저작권·초상권)',
  '유명 캐릭터 (디즈니, 산타 캐릭터 IP 등) — 일반적인 산타 모자·트리는 OK',
  '얼굴 클로즈업 (시니어 채널은 오브제 중심이 CTR이 높다)',
  '식별 가능한 인물 (뒷모습·원경 실루엣은 OK)',
  '저작권 있는 사진·일러스트',
  '작은 글씨 (최소 폰트 크기 대비 확보)'
];

export type ImageToolId = 'generic' | 'midjourney' | 'stableDiffusion';

export type ImagePromptMode = 'thumbnail' | 'cover';

/**
 * TASK v3.37-b (work item 3) — appended to the end of all three prompt
 * formats' positive text so an external tool (ChatGPT, Midjourney, Stable
 * Diffusion) defaults to a photographic look instead of an AI-plastic one.
 * Kept as a single literal string (not derived) so the exact wording the
 * user approved never drifts.
 */
const QUALITY_BOOSTER = 'professional photography, photorealistic, cinematic lighting, natural color grading, soft depth of field, crisp detail, no oversaturation, no plastic CGI';

/** TASK v3.37-b (work item 2) — cover-mode-only style directive; empty/unused in thumbnail mode. */
const COVER_STYLE_DIRECTIVE = 'album cover aesthetic, iconic and simple, centered subject, readable at small size';

function normalizeConceptForPrompt(concept: string | undefined): string {
  return (concept || '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

/**
 * TASK v3.37-b (work item 1) — only ever adds one concrete scene detail to
 * `sceneDescription`; composition/lighting/camera/color stay entirely
 * archetype-driven (drawn from the archetype's own pools), so a channel's
 * established visual identity never shifts pack to pack just because the
 * user typed a concept. Empty/whitespace-only input is a full no-op — see
 * tests/thumbnailSpecConcept.test.ts's byte-for-byte regression check.
 * Reuses thumbnailSafety.ts's existing style-imitation guard (rather than a
 * new pattern list) so a concept like "in the style of Ghibli" never reaches
 * the prompt.
 */
function conceptClause(concept: string | undefined): string {
  const trimmed = normalizeConceptForPrompt(concept);
  if (!trimmed) return '';
  if (FORBIDDEN_THUMBNAIL_REFERENCE_PATTERNS.some(pattern => pattern.test(trimmed))) return '';
  return `, with a specific scene detail evoking: ${trimmed}`;
}

/**
 * TASK B1 (v3.5) — a flat list of nouns ("window rain, wool sweater,
 * porcelain cup") tells an image model *what* to include but not *how it
 * looks*; models respond far more reliably to an actual scene description
 * (placement, lighting, camera language) than to a comma-dumped object list.
 * TASK B3: color names, never hex — most image models can't parse "#F3E3D3".
 */
function pickFromPool(pool: string[], seed: number) {
  return pool[Math.abs(seed) % pool.length];
}

/**
 * TASK v3.37-b (work item 2) — every archetype's `promptTemplate` (e.g.
 * refinedCafe.ts: "original 16:9 cafe thumbnail using abstracted still-life
 * traits") hardcodes "16:9 ... thumbnail" as descriptive flavor text, not
 * just a resolution hint — used verbatim, a cover-mode prompt would flatly
 * contradict its own "1:1 square" framing stated a few words later. This is
 * a code-side text transform only; the archetype data files (and their
 * pools) are untouched.
 */
function archetypeHeaderFor(archetype: ThumbnailArchetype, mode: ImagePromptMode): string {
  if (mode !== 'cover') return archetype.promptTemplate;
  return archetype.promptTemplate
    .replace(/\b16:9\s+/i, '')
    .replace(/\bthumbnail\b/i, 'cover art');
}

function buildSceneParts(
  season: SeasonPack,
  palette: ThumbnailPalette,
  textSide: 'left' | 'right',
  archetypeId: ThumbnailArchetypeId,
  seed: number,
  mode: ImagePromptMode = 'thumbnail',
  concept?: string
) {
  const archetype = thumbnailArchetypeById[archetypeId] || thumbnailArchetypeById['refined-cafe'];
  const objectSide = textSide === 'left' ? 'right' : 'left';
  const subjectBase = pickFromPool(archetype.subjectPool, seed + 3);
  const setting = pickFromPool(archetype.settingPool, seed + 5);
  const propA = pickFromPool(archetype.propPool, seed + 7);
  const propB = pickFromPool(archetype.propPool, seed + 11);
  const lightingBase = pickFromPool(archetype.lightingPool, seed + 13);
  const cameraBase = pickFromPool(archetype.cameraPool, seed + 17);
  const compositionBase = pickFromPool(archetype.compositionPool, seed + 19);
  const archetypePalette = pickFromPool(archetype.palettePool, seed + 23);
  const isCover = mode === 'cover';

  const sceneDescription = `${archetypeHeaderFor(archetype, mode)} for a ${season.label.toLowerCase()} playlist, set in ${setting}${conceptClause(concept)}`;
  const subject = [
    `${subjectBase} toward the ${objectSide} of frame`,
    `${propA} and ${propB} used as small unbranded supporting details`
  ].join('; ');
  const lighting = `${lightingBase}, shaped toward the ${objectSide === 'left' ? 'right' : 'left'} side of the frame`;
  const cameraAndLens = `${cameraBase}, shallow depth of field, gentle bokeh`;
  const colorMood = `${palette.backgroundNameEn} background with ${palette.accentNameEn} accents, ${archetypePalette}, low saturation, ${palette.moodEn}`;
  const textureAndFilm = 'Subtle film grain, analog warmth, slightly faded like an old photograph';
  // TASK v3.37-b (work item 2) — cover's safe margin is centered/bottom
  // (album-art convention), not the left/right third the 16:9 thumbnail
  // reserves for a title overlay.
  const composition = isCover
    ? `1:1 square composition; ${compositionBase}; the subject stays centered with the bottom third softly lit and left uncluttered for a text overlay`
    : `16:9 landscape composition; ${compositionBase}; the ${textSide} third of the frame is intentionally empty and softly lit, leaving clean space for a text overlay`;
  const styleDirective = isCover ? COVER_STYLE_DIRECTIVE : '';
  const aspectRatio = isCover ? '1:1' : '16:9';
  const peopleLimit = archetype.category === 'cinematic-human-moment'
    ? 'any human figure must stay distant, anonymous, face hidden, under 20% of the frame'
    : 'distant elegant silhouettes are allowed only if small, face-hidden, soft focus, and secondary to the scene';
  const safeNegatives = `no text, no letters, no logo, no logos, no watermark, no watermarks, no close-up faces, no identifiable person, no celebrity, no real celebrity or public figure, no film character, no cartoon characters, no branded IP, no copied pose, ${peopleLimit}`;
  const negatives = 'no text, no letters, no logos, no watermarks, no close-up faces, no identifiable person, no real celebrity or public figure, no cartoon characters, no branded IP — distant elegant silhouettes are welcome (backs turned, soft focus, small in frame)';

  void negatives;
  return { sceneDescription, subject, lighting, cameraAndLens, colorMood, textureAndFilm, composition, styleDirective, aspectRatio, negatives: safeNegatives };
}

function buildGenericImagePrompt(parts: ReturnType<typeof buildSceneParts>): string {
  return [parts.sceneDescription, parts.subject, parts.lighting, parts.cameraAndLens, parts.colorMood, parts.textureAndFilm, parts.composition, parts.styleDirective, `Negative: ${parts.negatives}`, QUALITY_BOOSTER]
    .filter(Boolean)
    .join('. ') + '.';
}

/**
 * TASK B4 (v3.5) — Midjourney reads plain prose plus trailing `--`
 * parameters; it does not use a separate negative-prompt field, so the ban
 * list is folded into `--no`.
 * TASK D4 (v3.6) — this was missing `parts.composition` (the "leave the
 * right/left third empty for text" instruction), which every other variant
 * includes. Without it, Midjourney had no reason not to center the subject,
 * leaving no clean space for a title overlay.
 * TASK v3.37-b — the quality booster is appended to the *positive* text
 * (not after `--no ...`), since Midjourney would otherwise parse trailing
 * prose as more `--no` terms; `--ar` now reflects thumbnail vs cover mode.
 */
function buildMidjourneyPrompt(parts: ReturnType<typeof buildSceneParts>): string {
  const positive = [parts.sceneDescription, parts.subject, parts.lighting, parts.cameraAndLens, parts.colorMood, parts.textureAndFilm, parts.composition, parts.styleDirective, QUALITY_BOOSTER]
    .filter(Boolean)
    .join(', ');
  return `${positive} --ar ${parts.aspectRatio} --style raw --no text, logos, watermarks, close-up faces, identifiable people, cartoon characters, branded IP`;
}

/** TASK B4 (v3.5) — Stable Diffusion UIs (Automatic1111, ComfyUI, etc.) take separate positive/negative prompt fields. */
function buildStableDiffusionPrompt(parts: ReturnType<typeof buildSceneParts>): string {
  const positive = [parts.sceneDescription, parts.subject, parts.lighting, parts.cameraAndLens, parts.colorMood, parts.textureAndFilm, parts.composition, parts.styleDirective, QUALITY_BOOSTER]
    .filter(Boolean)
    .join(', ');
  return `Positive: ${positive}\nNegative: text, letters, logo, watermark, close-up face, identifiable person, celebrity, cartoon character, branded IP, low quality, blurry`;
}

function buildImagePromptVariants(
  season: SeasonPack,
  palette: ThumbnailPalette,
  textSide: 'left' | 'right',
  archetypeId: ThumbnailArchetypeId,
  seed: number,
  mode: ImagePromptMode = 'thumbnail',
  concept?: string
): ThumbnailSpec['imagePromptVariants'] {
  const parts = buildSceneParts(season, palette, textSide, archetypeId, seed, mode, concept);
  return {
    generic: buildGenericImagePrompt(parts),
    midjourney: buildMidjourneyPrompt(parts),
    stableDiffusion: buildStableDiffusionPrompt(parts)
  };
}

/**
 * TASK v3.37-b (work item 2) — standalone cover (1:1) prompt builder, usable
 * independently of a full blueprint/channel (unlike buildThumbnailSpec) so
 * the panel can regenerate a cover with its own seed without touching the
 * pack-bound 16:9 thumbnail prompts. Season/archetype/concept mirror
 * whatever the thumbnail side is currently using.
 */
export function buildCoverImagePromptVariants(
  seasonId: string,
  archetypeId: ThumbnailArchetypeId,
  seed: number,
  concept?: string
): ThumbnailSpec['imagePromptVariants'] {
  const season = seasonPacks.find(s => s.id === seasonId) ?? seasonPacks[0];
  const palette = paletteForSeason(season.id);
  return buildImagePromptVariants(season, palette, 'left', archetypeId, seed, 'cover', concept);
}

/**
 * TASK B1 (v3.3): this app deliberately does NOT call an image-generation
 * API — a weekly-upload senior channel needs maybe 18 thumbnails across a
 * whole season, and reused backgrounds with swapped text (the real
 * workflow: a Canva template) keep the channel grid visually consistent in
 * a way regenerated-per-song AI images can't. This produces a spec a human
 * (or Canva) can act on, not a finished image.
 */
export function buildThumbnailSpec(
  blueprint: PlaylistBlueprint,
  opts: GenerationOptions,
  season: SeasonPack,
  channel: ChannelProfile,
  variant = 0,
  archetypeId: ThumbnailArchetypeId = 'refined-cafe'
): ThumbnailSpec {
  const language = resolvePackagingLanguage(opts);
  const palette = paletteForSeason(season.id);
  // variant lets "다른 문구 제안" cycle to a different headline second-line
  // without touching colors/objects/composition — regenerating the whole
  // spec on a text-only request would defeat the point of a stable,
  // channel-consistent visual template.
  const seedIndex = blueprint.songs.length + channel.name.length + variant;
  // layoutSeed deliberately excludes `variant` — object/text placement must
  // stay identical across headline regeneration, same as colors/objects.
  const layoutSeed = blueprint.songs.length + channel.name.length;
  const textSide: 'left' | 'right' = layoutSeed % 2 === 0 ? 'right' : 'left';
  const objectSide = textSide === 'left' ? 'right' : 'left';
  const { display: objects } = pickObjects(blueprint, language, season.id);
  const subline = buildSubline(blueprint.songs.length, language);
  // TASK I4 (v3.11) — the cold-open song is track 1 by default, but a manual
  // promotion (core/openingOverride.ts) can move that role elsewhere without
  // changing trackNo, so this looks up the role rather than assuming trackNo 1.
  const coldOpenSong = blueprint.songs.find(song => song.songRole === 'cold-open') || blueprint.songs[0];

  const variants: ThumbnailVariant[] = [
    { id: 'A', headline: buildSeasonHeadline(season, language, seedIndex, coldOpenSong?.hookPhrase), subline, angle: '계절 강조' },
    { id: 'B', headline: buildEmotionHeadline(language, seedIndex), subline, angle: '감정 강조' },
    { id: 'C', headline: buildAudienceHeadline(language), subline, angle: '타겟 명시' }
  ];

  const imagePromptVariants = buildImagePromptVariants(season, palette, textSide, archetypeId, seedIndex, 'thumbnail', opts.customConcept);

  return {
    variants,
    selected: 'A',
    colorScheme: {
      background: palette.background,
      accent: palette.accent,
      text: palette.text
    },
    objects,
    composition: `${objectSide === 'left' ? '좌측' : '우측'}에 오브제를 배치하고, ${textSide === 'left' ? '좌측' : '우측'} 1/3 여백에 문구를 배치하세요.`,
    forbidden: [...FORBIDDEN_ELEMENTS],
    imagePrompt: imagePromptVariants.generic,
    imagePromptVariants
  };
}
