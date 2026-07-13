import type { ChannelProfile, DisplayLanguage, GenerationOptions, PlaylistBlueprint, SeasonPack, ThumbnailSpec, ThumbnailVariant } from '../types';
import { paletteForSeason, type ThumbnailPalette } from '../data/thumbnailPalettes';
import { seasonWordFor } from './lyricEngine';
import { getRecurringMotifPhrases, type SeasonFamily } from './localGenerator';
import { resolvePackagingLanguage } from './packagingLanguage';

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

function buildSeasonHeadline(season: SeasonPack, language: DisplayLanguage, seedIndex: number): string {
  const seasonWord = shortSeasonWord(season, language);
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

/**
 * TASK B1 (v3.5) — a flat list of nouns ("window rain, wool sweater,
 * porcelain cup") tells an image model *what* to include but not *how it
 * looks*; models respond far more reliably to an actual scene description
 * (placement, lighting, camera language) than to a comma-dumped object list.
 * TASK B3: color names, never hex — most image models can't parse "#F3E3D3".
 */
function buildSceneParts(season: SeasonPack, palette: ThumbnailPalette, objectsEnglish: string[], textSide: 'left' | 'right') {
  const [primary, secondary, tertiary] = objectsEnglish;
  const objectSide = textSide === 'left' ? 'right' : 'left';

  const sceneDescription = `A quiet cafe window on a ${season.label.toLowerCase()} day, seen from inside`;
  const subject = [
    primary ? `${primary} sits in the foreground on a worn wooden table, toward the ${objectSide} of frame` : 'a warm seasonal still life sits in the foreground',
    secondary ? `${secondary} rests softly out of focus in the background` : null,
    tertiary ? `${tertiary} sits nearby at the table's edge` : null
  ].filter(Boolean).join('; ');
  const lighting = `Soft warm morning light falls from the ${objectSide === 'left' ? 'right' : 'left'} through the window glass, catching gentle highlights`;
  const cameraAndLens = 'Shot on a 50mm lens, shallow depth of field, eye-level framing, gentle bokeh';
  const colorMood = `${palette.backgroundNameEn} background with ${palette.accentNameEn} accents, low saturation, ${palette.moodEn}`;
  const textureAndFilm = 'Subtle film grain, analog warmth, slightly faded like an old photograph';
  const composition = `16:9 landscape composition; the ${textSide} third of the frame is intentionally empty and softly lit, leaving clean space for a text overlay`;
  const negatives = 'no text, no letters, no logos, no watermarks, no close-up faces, no identifiable person, no real celebrity or public figure, no cartoon characters, no branded IP — distant elegant silhouettes are welcome (backs turned, soft focus, small in frame)';

  return { sceneDescription, subject, lighting, cameraAndLens, colorMood, textureAndFilm, composition, negatives };
}

function buildGenericImagePrompt(parts: ReturnType<typeof buildSceneParts>): string {
  return [parts.sceneDescription, parts.subject, parts.lighting, parts.cameraAndLens, parts.colorMood, parts.textureAndFilm, parts.composition, `Negative: ${parts.negatives}`]
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
 */
function buildMidjourneyPrompt(parts: ReturnType<typeof buildSceneParts>): string {
  const positive = [parts.sceneDescription, parts.subject, parts.lighting, parts.cameraAndLens, parts.colorMood, parts.textureAndFilm, parts.composition]
    .filter(Boolean)
    .join(', ');
  return `${positive} --ar 16:9 --style raw --no text, logos, watermarks, close-up faces, identifiable people, cartoon characters, branded IP`;
}

/** TASK B4 (v3.5) — Stable Diffusion UIs (Automatic1111, ComfyUI, etc.) take separate positive/negative prompt fields. */
function buildStableDiffusionPrompt(parts: ReturnType<typeof buildSceneParts>): string {
  const positive = [parts.sceneDescription, parts.subject, parts.lighting, parts.cameraAndLens, parts.colorMood, parts.textureAndFilm, parts.composition]
    .filter(Boolean)
    .join(', ');
  return `Positive: ${positive}\nNegative: text, letters, logo, watermark, close-up face, identifiable person, celebrity, cartoon character, branded IP, low quality, blurry`;
}

function buildImagePromptVariants(season: SeasonPack, palette: ThumbnailPalette, objectsEnglish: string[], textSide: 'left' | 'right'): ThumbnailSpec['imagePromptVariants'] {
  const parts = buildSceneParts(season, palette, objectsEnglish, textSide);
  return {
    generic: buildGenericImagePrompt(parts),
    midjourney: buildMidjourneyPrompt(parts),
    stableDiffusion: buildStableDiffusionPrompt(parts)
  };
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
  variant = 0
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
  const { display: objects, english: objectsEnglish } = pickObjects(blueprint, language, season.id);
  const subline = buildSubline(blueprint.songs.length, language);

  const variants: ThumbnailVariant[] = [
    { id: 'A', headline: buildSeasonHeadline(season, language, seedIndex), subline, angle: '계절 강조' },
    { id: 'B', headline: buildEmotionHeadline(language, seedIndex), subline, angle: '감정 강조' },
    { id: 'C', headline: buildAudienceHeadline(language), subline, angle: '타겟 명시' }
  ];

  const imagePromptVariants = buildImagePromptVariants(season, palette, objectsEnglish, textSide);

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
