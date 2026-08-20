import type { GenerationOptions, ScenePlanningMode } from '../types';

/**
 * Bridge-only context for concept-driven lyric scene generation. The fixed
 * theme pool still supplies fallback scenes, but a real custom concept plus
 * this context means the LLM owns the primary scene invention.
 */
export interface ConceptSceneContext {
  recentSituations: string[];
  recentLyricLines: string[];
  recentOpenings?: string[];
}

/**
 * Single source of truth for scene-planning mode.
 *
 * fixed-pool: the app's lyricTheme pool is the primary scene authority, so
 * pool exhaustion checks are meaningful.
 * concept-generated: the LLM derives scenes from the concept; lyricThemeText is
 * only fallback material, so fixed-pool capacity must not block generation.
 * same-story-comparison: intentionally compares perspectives on one story, so
 * fixed-pool uniqueness is not a validity requirement.
 */
export function resolveScenePlanningMode(
  opts: Pick<GenerationOptions, 'customConcept'> & { scenePlanningMode?: ScenePlanningMode },
  conceptSceneContext: ConceptSceneContext | undefined
): ScenePlanningMode {
  if (opts.scenePlanningMode) return opts.scenePlanningMode;
  return conceptSceneContext && opts.customConcept?.trim() ? 'concept-generated' : 'fixed-pool';
}
