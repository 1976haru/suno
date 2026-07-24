import { thumbnailArchetypeById } from '../data/thumbnailArchetypes';
import type {
  ThumbnailArchetype,
  ThumbnailArchetypeId,
  ThumbnailPeopleMode,
  ThumbnailTextSafeZone,
  ThumbnailTimeOfDay
} from '../data/thumbnailArchetypes';
import type { ThumbnailTypographyGuide } from '../types';
import { FORBIDDEN_THUMBNAIL_REFERENCE_PATTERNS, thumbnailPromptSafetyIssues, uniqueThumbnailClauses } from './thumbnailSafety';

// TASK v3.38 Part A5 — always appended, last, to every generated prompt so
// an external tool (ChatGPT, Midjourney, Stable Diffusion) defaults to the
// Korean-serif grammar's photographic look rather than an AI-plastic render.
const QUALITY_BOOSTER = 'editorial photography, photorealistic, natural available light, soft shadows, shallow depth of field, muted warm color grading, film-like texture, generous negative space on the left third, clean composition';

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
  /** TASK v3.38 — fixed per archetype (channel-brand consistency, not scene variety); never interpolated into `prompt`. */
  typography: ThumbnailTypographyGuide;
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

// TASK v3.38 Part A1 — the left-third-for-text layout is the fixed
// structural rule for the 6 seasonal (Korean-serif) archetypes, not a
// per-variant rotation. TASK v3.38 Part B5 — the 3 kids archetypes use a
// different, open/centered layout instead (see buildPrompt's isKidsGrammar
// branch below), so this copy is only ever used for seasonal archetypes.
const TEXT_SAFE_ZONE_COPY: Record<ThumbnailTextSafeZone, string> = {
  'left-third': 'left third of the frame reserved for a thin Korean serif headline, a thin divider line, and a small subtitle — keep this area calm, low-detail, and softly lit'
};

const KIDS_TEXT_ZONE_COPY = 'generous open, low-clutter space around the subject reserved for a bold rounded headline — keep this area bright and simple';

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

// TASK v3.38 Part A5 — every archetype in the new grammar applies the same
// people rule (backs/silhouette only, face never shown), so this no longer
// branches per archetype category the way the old golden-hour-backs special
// case did.
function peopleInstruction(peopleMode: ThumbnailPeopleMode): string {
  if (peopleMode === 'none') return 'People: no people; keep the image led by place, objects, light, and atmosphere.';
  return 'People: a single distant figure seen from behind or in silhouette only, small in frame, face never shown, no recognizable features.';
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
    'no letters',
    'no logo',
    'no watermark',
    'no identifiable person',
    'no celebrity',
    'no film character',
    'no face close-up',
    'no close-up faces',
    'no copied pose',
    'no creator-style imitation',
    'no branded IP',
    // TASK v3.38 Part A5 — Korean-serif grammar negative additions.
    'no glowing bokeh sparkles',
    'no excessive glow',
    'no oversaturation',
    'no HDR look',
    'no plastic CGI render',
    'no illustration',
    'no cartoon',
    'no famous painting',
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
  // TASK v3.38 Part B5 — kids archetypes (recommendedTypography.divider is
  // only true for the Korean-serif grammar) get their own open/centered
  // zone description instead of the "divider + subtitle" phrasing, which
  // would otherwise contradict their actual bold/bright typography.
  const isKidsGrammar = !archetype.recommendedTypography.divider;
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
    `Composition: ${variant.composition}; ${isKidsGrammar ? KIDS_TEXT_ZONE_COPY : TEXT_SAFE_ZONE_COPY[variant.textSafeZone]}.`,
    `Lighting: ${variant.lighting}.`,
    `Color palette: ${variant.palette}.`,
    `Camera: ${variant.camera}.`,
    `Props: ${variant.props.join(', ')}.`,
    variant.peoplePolicy,
    isCover ? 'Album cover aesthetic: iconic, simple, and readable at a small thumbnail size.' : '',
    forbiddenClause(archetype),
    QUALITY_BOOSTER
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
  // TASK v3.38 — defensive fallback matching thumbnailSpec.ts's pattern: a
  // SavedPack persisted before this archetype-id migration (or any other
  // stale/unrecognized id) must degrade to a valid default archetype
  // instead of crashing the whole panel with "Cannot read properties of
  // undefined".
  const archetype = thumbnailArchetypeById[options.archetypeId] || thumbnailArchetypeById['autumn-window-golden'];
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
    // TASK v3.38 Part A1 — every archetype's textSafeZone pool now contains
    // only 'left-third', so thumbnail and cover modes both resolve to the
    // same fixed zone; kept via pickZone rather than hardcoded so an explicit
    // caller override (there is currently only one valid value, but this
    // stays forward-compatible) still works.
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
      peoplePolicy: peopleInstruction(peopleMode),
      typography: archetype.recommendedTypography
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
