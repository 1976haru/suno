import { thumbnailArchetypeById } from '../data/thumbnailArchetypes';
import type {
  ThumbnailArchetype,
  ThumbnailArchetypeId,
  ThumbnailPeopleMode,
  ThumbnailTextSafeZone,
  ThumbnailTimeOfDay
} from '../data/thumbnailArchetypes';
import { thumbnailPromptSafetyIssues, uniqueThumbnailClauses } from './thumbnailSafety';

export type ThumbnailPromptVariantId = 'A' | 'B' | 'C';

export interface ThumbnailPromptComposerOptions {
  archetypeId: ThumbnailArchetypeId;
  seasonId?: string;
  timeOfDay?: ThumbnailTimeOfDay;
  peopleMode?: ThumbnailPeopleMode;
  textSafeZone?: ThumbnailTextSafeZone;
  seed?: number;
  resolution?: '1280x720' | '1920x1080';
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

function buildPrompt(archetype: ThumbnailArchetype, variant: Omit<ThumbnailPromptVariant, 'prompt' | 'safetyIssues'>, seasonId: string, timeOfDay: ThumbnailTimeOfDay, resolution: '1280x720' | '1920x1080'): string {
  const season = SEASON_DESCRIPTORS[seasonId] ?? 'seasonal visual details';
  const clauses = [
    `Original YouTube playlist thumbnail prompt, 16:9 landscape, ${resolution}.`,
    `Use an independent ${archetype.category} arrangement; do not recreate any single reference image.`,
    `Season and time: ${season}, ${TIME_DESCRIPTORS[timeOfDay]}.`,
    `Subject: ${variant.subject}.`,
    `Setting: ${variant.setting}.`,
    `Composition: ${variant.composition}; ${TEXT_SAFE_ZONE_COPY[variant.textSafeZone]}.`,
    `Lighting: ${variant.lighting}.`,
    `Color palette: ${variant.palette}.`,
    `Camera: ${variant.camera}.`,
    `Props: ${variant.props.join(', ')}.`,
    variant.peoplePolicy,
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
  const resolution = options.resolution ?? '1280x720';
  const baseSeed = hashString(`${archetype.id}:${seasonId}:${timeOfDay}:${options.seed ?? 0}`);

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
    const prompt = buildPrompt(archetype, draft, seasonId, timeOfDay, resolution);
    return {
      ...draft,
      prompt,
      safetyIssues: thumbnailPromptSafetyIssues(prompt)
    };
  });

  return { archetype, variants };
}
