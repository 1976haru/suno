import type { SceneSignature } from './situationLedger';
import { tokenOverlap } from './traitMatcher';

/**
 * codex 지시문 02 (TASK B) — real gap: core/duplicationGate.ts's own
 * checkSceneOverlap is deliberately EXACT-match only (see its own doc
 * comment — a false-positive block over a merely-similar scene was judged
 * worse than missing a genuine near-duplicate), so a near-miss scene
 * ("sitting with morning coffee before the day begins" vs "having coffee
 * as the morning begins") sails through both the exact-match blocking gate
 * AND the app's own "don't force an era/scene" instruction-time guardrails
 * completely unflagged. This is a NEW, separate, advisory-tier signal —
 * checkSceneOverlap stays exactly as-is (still the one exact-match BLOCKING
 * gate) — following traitMatcher.ts's own weighted multi-axis Jaccard
 * pattern (tokenOverlap, dynamic per-candidate weight total for whichever
 * axes actually have data on both sides, same as matchGenresByTraits).
 *
 * Two thresholds, matching this task's own two severities:
 *  - >= SCENE_SIMILARITY_BLOCKING_THRESHOLD (0.72): near-verbatim enough
 *    that it likely reads as the same idea reused — treated as blocking by
 *    checkSceneSimilarity below (the one real place this gets consumed).
 *  - >= SCENE_SIMILARITY_ADVISORY_THRESHOLD (0.55): similar enough to flag
 *    for a human to glance at, not similar enough to force a rewrite over.
 */

export interface SceneAxisWeights {
  situation: number;
  frameId: number;
  motionKo: number;
  castKo: number;
  eraSettingKo: number;
}

export const DEFAULT_SCENE_AXIS_WEIGHTS: SceneAxisWeights = {
  situation: 0.4,
  frameId: 0.25,
  motionKo: 0.15,
  castKo: 0.1,
  eraSettingKo: 0.1
};

export const SCENE_SIMILARITY_BLOCKING_THRESHOLD = 0.72;
export const SCENE_SIMILARITY_ADVISORY_THRESHOLD = 0.55;

/**
 * Short Korean labels (frameId/motionKo/castKo/eraSettingKo) are categorical
 * IDs/axis tags, not free prose — data/lyricThemes.ts's own SCENE_AXIS_LABEL_EN
 * map (core/bridgeInstruction.ts) treats them the same way, as a fixed small
 * vocabulary to look up, not text to tokenize. traitMatcher.ts's tokenOverlap
 * also can't help here anyway: its tokenizer pattern (`[^a-z0-9]+`) strips
 * every non-ASCII character, so it would silently score any two Korean
 * strings 0/0 -> 0 regardless of whether they actually match. An exact
 * (trimmed, case-insensitive) match is the honest signal for these axes.
 */
function exactAxisScore(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return 0;
  return a.trim().toLowerCase() === b.trim().toLowerCase() ? 1 : 0;
}

/**
 * Weighted similarity in [0, 1]. Axes where EITHER side has no data are
 * excluded from both the numerator and the weight total (mirrors
 * traitMatcher.ts's matchGenresByTraits — a candidate isn't penalized for
 * missing data neither side can supply); returns 0 only when there is
 * nothing at all in common to compare (situation is the one axis every real
 * SceneSignature has, so this is 0 only when situation text itself shares no
 * tokens AND every other axis is empty/absent on at least one side).
 */
export function sceneSimilarity(a: SceneSignature, b: SceneSignature, weights: SceneAxisWeights = DEFAULT_SCENE_AXIS_WEIGHTS): number {
  let weightedSum = 0;
  let weightTotal = 0;

  if (a.situation && b.situation) {
    weightedSum += tokenOverlap([a.situation], [b.situation]) * weights.situation;
    weightTotal += weights.situation;
  }
  for (const axis of ['frameId', 'motionKo', 'castKo', 'eraSettingKo'] as const) {
    if (a[axis] && b[axis]) {
      weightedSum += exactAxisScore(a[axis], b[axis]) * weights[axis];
      weightTotal += weights[axis];
    }
  }

  return weightTotal ? weightedSum / weightTotal : 0;
}
