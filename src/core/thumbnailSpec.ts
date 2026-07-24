import type { ChannelProfile, DisplayLanguage, GenerationOptions, PlaylistBlueprint, SeasonPack, ThumbnailSpec, ThumbnailVariant } from '../types';
import { paletteForSeason, type ThumbnailPalette } from '../data/thumbnailPalettes';
import { thumbnailArchetypeById, type ThumbnailArchetype, type ThumbnailArchetypeId } from '../data/thumbnailArchetypes';
import { seasonPacks } from '../data/presets';
import { getRecurringMotifPhrases, type SeasonFamily } from './localGenerator';
import { resolvePackagingLanguage } from './packagingLanguage';
import { FORBIDDEN_THUMBNAIL_REFERENCE_PATTERNS } from './thumbnailSafety';

export type { ThumbnailSpec, ThumbnailVariant };

/**
 * TASK v3.38 Part A6 — full replacement of the prior v3.38-draft English
 * minimal-editorial strategy. User-approved direction: three Korean-first
 * angles — A: 질문형 (curiosity/question, e.g. "그날, 기억나?"), B: 감성형
 * (emotional scene/season, e.g. "늦가을, 창가에서"), C: 공감형 (empathy/
 * situational, e.g. "혼자여도 괜찮은 밤") — each 6-10 characters including
 * punctuation, up to 2 lines. packagingLanguage can still route a channel to
 * English/Japanese (TASK D5, unchanged mechanism); those pools follow the
 * same three angles with a looser length bound since the 6-10 character rule
 * doesn't translate 1:1 across languages.
 */
const questionHeadlinePool: Record<DisplayLanguage, string[]> = {
  korean: ['그날, 기억나?', '이 노래, 알아?', '오늘 기분 어때?', '이 멜로디 기억나?', '왜 자꾸 생각나지?', '이 계절, 낯익지?'],
  english: ['Remember That Day?', 'Sounds Familiar?', 'Know This One?', 'Feel It Too?', 'Heard This Before?', 'Familiar Season?'],
  japanese: ['あの日、覚えてる?', 'この曲、知ってる?', '懐かしくない?', '聴いたことある?', 'この季節、懐かしい?', '覚えてますか?']
};

const emotionalHeadlinePool: Record<DisplayLanguage, string[]> = {
  korean: ['늦가을, 창가에서', '조용한 겨울 아침', '빗소리, 창밖에서', '노을 지는 창가에서', '첫눈 내리는 오후', '벚꽃 지는 계절에'],
  english: ['Late Autumn Window', 'Quiet Winter Morning', 'Rain on the Window', 'Golden Hour Glow', 'First Snow Falling', 'Cherry Blossom Season'],
  japanese: ['晩秋の窓辺で', '静かな冬の朝', '窓を打つ雨音', '黄昏どきの窓辺', '初雪の午後', '桜が舞う頃']
};

const empathyHeadlinePool: Record<DisplayLanguage, string[]> = {
  korean: ['혼자여도 괜찮은 밤', '지친 하루 끝에서', '다들 그런 하루죠', '오늘도 수고했어요', '괜찮아, 오늘도', '너도 그랬을까'],
  english: ['Okay to Be Alone', 'End of a Long Day', 'We All Have Days', 'Rest a While', "You're Doing Fine", 'A Quiet Night In'],
  japanese: ['一人でもいい夜', '長い一日の終わりに', '今日もお疲れ様', 'そんな日もあるよね', 'ゆっくり休んでね', '静かな夜に']
};

function buildQuestionHeadline(language: DisplayLanguage, seedIndex: number): string {
  const pool = questionHeadlinePool[language];
  return pool[Math.abs(seedIndex) % pool.length];
}

function buildEmotionalHeadline(language: DisplayLanguage, seedIndex: number): string {
  const pool = emotionalHeadlinePool[language];
  return pool[Math.abs(seedIndex) % pool.length];
}

function buildEmpathyHeadline(language: DisplayLanguage, seedIndex: number): string {
  const pool = empathyHeadlinePool[language];
  return pool[Math.abs(seedIndex) % pool.length];
}

/**
 * TASK v3.38 Part A1/A6 — the small subtitle line beneath the divider
 * (e.g. "추억 감성 플레이리스트"), 8-14 characters for Korean. Replaces the
 * old songCount-derived subline ("12곡 플레이리스트") with content-relevant
 * copy; a shared pool (not per-angle) rotated with an offset so a spec's
 * three variants never repeat the same subtitle.
 */
const subtitlePool: Record<DisplayLanguage, string[]> = {
  korean: ['추억 감성 플레이리스트', '잔잔한 감성 플레이리스트', '혼자 듣기 좋은 노래', '계절 감성 플레이리스트', '마음이 편안해지는 노래', '조용히 듣기 좋은 밤'],
  english: ['A Nostalgic Playlist', 'Songs for Slow Days', 'Quiet Seasonal Mix', 'Music to Unwind To', 'A Gentle Playlist', 'For Quiet Moments'],
  japanese: ['懐かしい感性プレイリスト', '静かな季節の音楽', 'ゆったり聴ける選曲', '心が落ち着く音楽', 'そっと寄り添う音楽', '静かな夜の音楽']
};

function buildSubtitle(language: DisplayLanguage, seedIndex: number): string {
  const pool = subtitlePool[language];
  return pool[Math.abs(seedIndex) % pool.length];
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
 * TASK v3.38 (work item 2) — appended to the end of all three prompt
 * formats' positive text so an external tool (ChatGPT, Midjourney, Stable
 * Diffusion) defaults to the minimal-editorial photographic look instead of
 * an AI-plastic one. Kept as a single literal string (not derived) so the
 * exact wording the user approved never drifts.
 */
const QUALITY_BOOSTER = 'editorial photography, photorealistic, natural available light, soft shadows, shallow depth of field, muted warm color grading, film-like texture, generous negative space on the left third, clean composition';

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
  archetypeId: ThumbnailArchetypeId,
  seed: number,
  mode: ImagePromptMode = 'thumbnail',
  concept?: string
) {
  const archetype = thumbnailArchetypeById[archetypeId] || thumbnailArchetypeById['autumn-window-golden'];
  // TASK v3.38 Part A1 — the left-third-for-text layout is now fixed for
  // every seasonal archetype (no more left/right alternation by seed). The 3
  // kids archetypes (Part B5) use their own centered/open-space composition
  // instead — detected via recommendedTypography.divider, which is only
  // true for the Korean-serif grammar.
  const isKidsGrammar = !archetype.recommendedTypography.divider;
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
    `${subjectBase} toward the right of frame`,
    `${propA} and ${propB} used as small unbranded supporting details`
  ].join('; ');
  const lighting = `${lightingBase}, shaped toward the right side of the frame`;
  const cameraAndLens = `${cameraBase}, shallow depth of field, gentle bokeh`;
  const colorMood = `${palette.backgroundNameEn} background with ${palette.accentNameEn} accents, ${archetypePalette}, ${isKidsGrammar ? 'bright saturated color' : 'low saturation'}, ${palette.moodEn}`;
  const textureAndFilm = isKidsGrammar
    ? 'Clean crisp detail, bright natural color, no film grain'
    : 'Subtle film grain, analog warmth, slightly faded like an old photograph';
  // TASK v3.38 Part A1 — seasonal archetypes always reserve the left third
  // for the headline/divider/subtitle block; kids archetypes (B5) use their
  // own open-space composition instead (no divider/subtitle grammar there).
  const composition = isKidsGrammar
    ? `${isCover ? '1:1 square' : '16:9 landscape'} composition; ${compositionBase}`
    : isCover
      ? `1:1 square composition; ${compositionBase}; the subject stays centered with the left third softly lit and left uncluttered for a text overlay`
      : `16:9 landscape composition; ${compositionBase}; the left third of the frame is intentionally empty and softly lit, leaving clean space for a headline, divider, and subtitle`;
  const styleDirective = isCover ? COVER_STYLE_DIRECTIVE : '';
  const aspectRatio = isCover ? '1:1' : '16:9';
  // TASK v3.38 Part A5 — every seasonal archetype applies the same
  // backs/silhouette-only people rule (no more per-archetype special case).
  const peopleLimit = 'any human figure must stay small, distant, anonymous, seen from behind or in silhouette only, face never shown';
  // TASK v3.38 Part A5 — Korean-serif grammar negative additions (glow/HDR/
  // oversaturation/CGI/illustration), on top of the pre-existing base list.
  const safeNegatives = `no text, no letters, no logo, no logos, no watermark, no watermarks, no close-up faces, no identifiable person, no celebrity, no real celebrity or public figure, no film character, no cartoon characters, no cartoon, no branded IP, no copied pose, no glowing bokeh sparkles, no excessive glow, no oversaturation, no HDR look, no plastic CGI render, no illustration, no famous painting, ${peopleLimit}`;

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
  return `${positive} --ar ${parts.aspectRatio} --style raw --no text, logos, watermarks, close-up faces, identifiable people, cartoon characters, branded IP, illustration, oversaturation`;
}

/** TASK B4 (v3.5) — Stable Diffusion UIs (Automatic1111, ComfyUI, etc.) take separate positive/negative prompt fields. */
function buildStableDiffusionPrompt(parts: ReturnType<typeof buildSceneParts>): string {
  const positive = [parts.sceneDescription, parts.subject, parts.lighting, parts.cameraAndLens, parts.colorMood, parts.textureAndFilm, parts.composition, parts.styleDirective, QUALITY_BOOSTER]
    .filter(Boolean)
    .join(', ');
  return `Positive: ${positive}\nNegative: text, letters, logo, watermark, close-up face, identifiable person, celebrity, cartoon character, branded IP, illustration, oversaturation, HDR look, plastic CGI render, low quality, blurry`;
}

function buildImagePromptVariants(
  season: SeasonPack,
  palette: ThumbnailPalette,
  archetypeId: ThumbnailArchetypeId,
  seed: number,
  mode: ImagePromptMode = 'thumbnail',
  concept?: string
): ThumbnailSpec['imagePromptVariants'] {
  const parts = buildSceneParts(season, palette, archetypeId, seed, mode, concept);
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
  return buildImagePromptVariants(season, palette, archetypeId, seed, 'cover', concept);
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
  archetypeId: ThumbnailArchetypeId = 'autumn-window-golden'
): ThumbnailSpec {
  const language = resolvePackagingLanguage(opts);
  const palette = paletteForSeason(season.id);
  // variant lets "다른 문구 제안" cycle to a different headline
  // without touching colors/objects/composition — regenerating the whole
  // spec on a text-only request would defeat the point of a stable,
  // channel-consistent visual template.
  const seedIndex = blueprint.songs.length + channel.name.length + variant;
  const { display: objects } = pickObjects(blueprint, language, season.id);
  const archetype = thumbnailArchetypeById[archetypeId] || thumbnailArchetypeById['autumn-window-golden'];
  const isKidsGrammar = !archetype.recommendedTypography.divider;

  // TASK v3.38 Part A6 — A: 질문형(호기심), B: 감성형, C: 공감형. Subtitle
  // offsets by +1/+2 so a spec's three variants never repeat the same
  // subtitle pool entry.
  const variants: ThumbnailVariant[] = [
    { id: 'A', headline: buildQuestionHeadline(language, seedIndex), subline: buildSubtitle(language, seedIndex), angle: '질문형' },
    { id: 'B', headline: buildEmotionalHeadline(language, seedIndex), subline: buildSubtitle(language, seedIndex + 1), angle: '감성형' },
    { id: 'C', headline: buildEmpathyHeadline(language, seedIndex), subline: buildSubtitle(language, seedIndex + 2), angle: '공감형' }
  ];

  const imagePromptVariants = buildImagePromptVariants(season, palette, archetypeId, seedIndex, 'thumbnail', opts.customConcept);

  return {
    variants,
    selected: 'A',
    colorScheme: {
      background: palette.background,
      accent: palette.accent,
      text: palette.text
    },
    objects,
    // TASK v3.38 Part A1 — the left-third text zone is now fixed for every
    // seasonal archetype, so this description no longer varies by seed; the
    // 3 kids archetypes (Part B5) use their own open/centered composition.
    composition: isKidsGrammar
      ? '중앙에 피사체를 배치하고, 문구를 얹을 여백을 주변에 확보하세요.'
      : '왼쪽 1/3에 문구·구분선·부제를 배치하고, 오른쪽 2/3에 장면을 배치하세요.',
    forbidden: [...FORBIDDEN_ELEMENTS],
    imagePrompt: imagePromptVariants.generic,
    imagePromptVariants,
    typography: archetype.recommendedTypography
  };
}
