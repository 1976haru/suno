import { thumbnailArchetypeById } from '../data/thumbnailArchetypes';
import type {
  ThumbnailArchetype,
  ThumbnailArchetypeId,
  ThumbnailPeopleMode,
  ThumbnailTextSafeZone,
  ThumbnailTimeOfDay
} from '../data/thumbnailArchetypes';
import { FORBIDDEN_THUMBNAIL_REFERENCE_PATTERNS, thumbnailPromptSafetyIssues, uniqueThumbnailClauses } from './thumbnailSafety';

export type ThumbnailPromptVariantId = 'A' | 'B' | 'C';

/** TASK v3.37 (spec item D) — 'cover' is the 1:1 channel/album cover mode; 'thumbnail' (default) is the existing 16:9 mode. */
export type ThumbnailPromptMode = 'thumbnail' | 'cover';

export interface ThumbnailPromptComposerOptions {
  archetypeId: ThumbnailArchetypeId;
  seasonId?: string;
  timeOfDay?: ThumbnailTimeOfDay;
  peopleMode?: ThumbnailPeopleMode;
  textSafeZone?: ThumbnailTextSafeZone;
  seed?: number;
  resolution?: '1280x720' | '1920x1080' | '3000x3000';
  mode?: ThumbnailPromptMode;
  /** TASK v3.37-b (work item 1) — a free-text scene detail (GenerationOptions.customConcept or a multi-set's own concept); never alters which archetype pool items get picked (seed/axis logic is unaffected), only adds one extra descriptive clause. Empty/undefined is a full no-op. */
  concept?: string;
}

export interface ThumbnailPromptVariant {
  id: ThumbnailPromptVariantId;
  archetypeId: ThumbnailArchetypeId;
  subject: string;
  setting: string;
  composition: string;
  lighting: string;
  palette: string;
  props: string[];
  camera: string;
  textSafeZone: ThumbnailTextSafeZone;
  peoplePolicy: string;
  prompt: string;
  safetyIssues: string[];
}

export interface ThumbnailPromptSet {
  archetype: ThumbnailArchetype;
  variants: ThumbnailPromptVariant[];
}

const VARIANT_IDS: ThumbnailPromptVariantId[] = ['A', 'B', 'C'];

const SEASON_DESCRIPTORS: Record<string, string> = {
  'new-year': 'clean winter reset details',
  'late-winter': 'quiet late-winter indoor warmth',
  'spring-open': 'fresh early-spring air',
  'cherry-blossom': 'pale spring blossom season without landmark references',
  'may-cafe': 'clear May cafe brightness',
  'rainy-season': 'rainy-season comfort and window reflections',
  'summer-night': 'humid summer evening air',
  'late-summer-open': 'late-summer opening freshness',
  'early-autumn': 'early autumn calm',
  'autumn-rain': 'autumn rain and warm indoor contrast',
  'maple-autumn': 'golden autumn foliage mood without copied scenery',
  'late-autumn': 'late-autumn quietness and deeper tones',
  'early-winter': 'early-winter window mood',
  'first-snow': 'first snow softness',
  christmas: 'subtle holiday warmth without character imagery',
  'year-end': 'year-end reflection and gentle light'
};

const TIME_DESCRIPTORS: Record<ThumbnailTimeOfDay, string> = {
  morning: 'morning',
  afternoon: 'afternoon',
  'golden-hour': 'golden hour',
  evening: 'evening',
  night: 'night'
};

const TEXT_SAFE_ZONE_COPY: Record<ThumbnailTextSafeZone, string> = {
  left: 'left text safe zone with uncluttered negative space',
  right: 'right text safe zone with uncluttered negative space',
  top: 'top text safe zone with uncluttered negative space'
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function pick(pool: string[], seed: number): string {
  return pool[Math.abs(seed) % pool.length];
}

function pickZone(archetype: ThumbnailArchetype, requested: ThumbnailTextSafeZone | undefined, variantIndex: number, seed: number): ThumbnailTextSafeZone {
  if (requested) return requested;
  return archetype.textSafeZone[(seed + variantIndex) % archetype.textSafeZone.length];
}

function peopleInstruction(archetype: ThumbnailArchetype, peopleMode: ThumbnailPeopleMode): string {
  if (peopleMode === 'none') return 'People: no people; keep the image led by place, objects, light, and atmosphere.';
  if (archetype.category === 'cinematic-human-moment') {
    return 'People: a single distant anonymous silhouette is allowed, under 20% of the frame, face hidden, no copied pose.';
  }
  return 'People: a distant faceless silhouette may appear only in the background, small in frame, no recognizable features.';
}

function normalizeConceptForPrompt(concept: string | undefined): string {
  return (concept || '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

/**
 * TASK v3.37-b (work item 1) — a distinct "Concept detail:" clause rather
 * than blending into Subject/Setting, so it never overwrites an
 * archetype-pool pick; empty input drops out entirely via
 * uniqueThumbnailClauses' filter(Boolean). Reuses the composer's own
 * existing forbidden-reference guard so a concept can't smuggle in a
 * style-imitation phrase the rest of this file already blocks.
 */
function conceptClause(concept: string | undefined): string {
  const trimmed = normalizeConceptForPrompt(concept);
  if (!trimmed) return '';
  if (FORBIDDEN_THUMBNAIL_REFERENCE_PATTERNS.some(pattern => pattern.test(trimmed))) return '';
  return `Concept detail: ${trimmed}.`;
}

function forbiddenClause(archetype: ThumbnailArchetype): string {
  const base = [
    'no text',
    'no logo',
    'no watermark',
    'no identifiable person',
    'no celebrity',
    'no film character',
    'no face close-up',
    'no copied pose',
    'no creator-style imitation',
    'no branded IP',
    ...archetype.forbiddenElements.map(item => `no ${item}`)
  ];
  return `Negative: ${uniqueThumbnailClauses(base).join(', ')}.`;
}

// TASK v3.37 (spec item D) — cover mode swaps the frame/aspect clause and
// appends an album-cover style directive; everything else (subject/setting/
// lighting/forbidden clause) is identical to the thumbnail path so the same
// archetype reads consistently across both output sizes.
function buildPrompt(
  archetype: ThumbnailArchetype,
  variant: Omit<ThumbnailPromptVariant, 'prompt' | 'safetyIssues'>,
  seasonId: string,
  timeOfDay: ThumbnailTimeOfDay,
  resolution: '1280x720' | '1920x1080' | '3000x3000',
  mode: ThumbnailPromptMode,
  concept?: string
): string {
  const season = SEASON_DESCRIPTORS[seasonId] ?? 'seasonal visual details';
  const isCover = mode === 'cover';
  // Deliberately avoids the literal phrase "YouTube channel" — it collides
  // with FORBIDDEN_THUMBNAIL_REFERENCE_PATTERNS' /\byoutube channel\b/i guard
  // (meant to block "in the style of [some] youtube channel"-type prompts),
  // which would flag every cover-mode prompt as unsafe purely from this
  // structural clause. See tests/thumbnailPromptSafety.test.ts.
  const frameClause = isCover
    ? `Original 1:1 square album cover art prompt, ${resolution}.`
    : `Original YouTube playlist thumbnail prompt, 16:9 landscape, ${resolution}.`;
  const clauses = [
    frameClause,
    `Use an independent ${archetype.category} arrangement; do not recreate any single reference image.`,
    `Season and time: ${season}, ${TIME_DESCRIPTORS[timeOfDay]}.`,
    `Subject: ${variant.subject}.`,
    `Setting: ${variant.setting}.`,
    conceptClause(concept),
    `Composition: ${variant.composition}; ${TEXT_SAFE_ZONE_COPY[variant.textSafeZone]}.`,
    `Lighting: ${variant.lighting}.`,
    `Color palette: ${variant.palette}.`,
    `Camera: ${variant.camera}.`,
    `Props: ${variant.props.join(', ')}.`,
    variant.peoplePolicy,
    isCover ? 'Album cover aesthetic: iconic, simple, and readable at a small thumbnail size.' : '',
    forbiddenClause(archetype)
  ];
  return uniqueThumbnailClauses(clauses).join(' ');
}

export function countThumbnailAxisDifferences(a: ThumbnailPromptVariant, b: ThumbnailPromptVariant): number {
  const comparisons = [
    a.subject !== b.subject,
    a.setting !== b.setting,
    a.composition !== b.composition,
    a.lighting !== b.lighting,
    a.palette !== b.palette,
    a.props.join('|') !== b.props.join('|'),
    a.camera !== b.camera,
    a.textSafeZone !== b.textSafeZone,
    a.peoplePolicy !== b.peoplePolicy
  ];
  return comparisons.filter(Boolean).length;
}

export function composeThumbnailPromptSet(options: ThumbnailPromptComposerOptions): ThumbnailPromptSet {
  const archetype = thumbnailArchetypeById[options.archetypeId];
  const seasonId = options.seasonId ?? 'may-cafe';
  const timeOfDay = options.timeOfDay ?? 'morning';
  const peopleMode = options.peopleMode ?? 'none';
  const mode = options.mode ?? 'thumbnail';
  const resolution = options.resolution ?? (mode === 'cover' ? '3000x3000' : '1280x720');
  const baseSeed = hashString(`${archetype.id}:${seasonId}:${timeOfDay}:${mode}:${options.seed ?? 0}`);

  const variants = VARIANT_IDS.map((id, variantIndex) => {
    const axisSeed = baseSeed + variantIndex;
    const props = uniqueThumbnailClauses([
      pick(archetype.propPool, axisSeed + 31),
      pick(archetype.propPool, axisSeed + 44)
    ]);
    const textSafeZone = pickZone(archetype, options.textSafeZone, variantIndex, baseSeed);
    const draft: Omit<ThumbnailPromptVariant, 'prompt' | 'safetyIssues'> = {
      id,
      archetypeId: archetype.id,
      subject: pick(archetype.subjectPool, axisSeed + 3),
      setting: pick(archetype.settingPool, axisSeed + 7),
      composition: pick(archetype.compositionPool, axisSeed + 11),
      lighting: pick(archetype.lightingPool, axisSeed + 13),
      palette: pick(archetype.palettePool, axisSeed + 17),
      props,
      camera: pick(archetype.cameraPool, axisSeed + 19),
      textSafeZone,
      peoplePolicy: peopleInstruction(archetype, peopleMode)
    };
    const prompt = buildPrompt(archetype, draft, seasonId, timeOfDay, resolution, mode, options.concept);
    return {
      ...draft,
      prompt,
      safetyIssues: thumbnailPromptSafetyIssues(prompt)
    };
  });

  return { archetype, variants };
}
