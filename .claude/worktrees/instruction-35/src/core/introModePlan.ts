import type { IntroMode } from '../types';
import type { StructureTemplateId } from './lyricEngine';
import { buildGenreCountRotationPlan } from './genreRotation';

export const INTRO_MODE_IDS: readonly IntroMode[] = ['instrumental', 'vocal-immediate', 'vocal-after-texture'];

/**
 * TASK v3.64 (TASK B) — spec's own reference distribution for an 18-song
 * pack: instrumental 8, vocal-immediate 4 (including the cold-open track),
 * vocal-after-texture 6. Scaled proportionally for other song counts.
 */
function introModeCounts(songCount: number): Record<IntroMode, number> {
  if (songCount <= 0) return { instrumental: 0, 'vocal-immediate': 0, 'vocal-after-texture': 0 };
  const vocalImmediate = Math.max(1, Math.round((songCount * 4) / 18));
  const instrumental = Math.max(0, Math.round((songCount * 8) / 18));
  const vocalAfterTexture = Math.max(0, songCount - vocalImmediate - instrumental);
  return { instrumental, 'vocal-immediate': vocalImmediate, 'vocal-after-texture': vocalAfterTexture };
}

/**
 * Track 1 (cold-open) is always 'vocal-immediate' — no [intro] tag, the hook
 * is heard immediately (mirrors lyricEngine.ts's own cold-open convention).
 * The remaining tracks rotate across all 3 modes via the same generic
 * count-based rotation genreRotation.ts already uses for the genre axis —
 * reused rather than reimplemented.
 */
export function buildIntroModePlan(songCount: number, seed: number): IntroMode[] {
  if (songCount <= 0) return [];
  if (songCount === 1) return ['vocal-immediate'];
  const counts = introModeCounts(songCount);
  const remaining = { ...counts, 'vocal-immediate': Math.max(0, counts['vocal-immediate'] - 1) };
  const rest = buildGenreCountRotationPlan(remaining, INTRO_MODE_IDS, songCount - 1, seed) as IntroMode[];
  return ['vocal-immediate', ...rest];
}

/**
 * v3.75 (TASK A) — real regression, found by tracing why real Suno songs
 * came back with almost no instrumental intro despite introModePlan
 * assigning ~8/18 tracks 'instrumental': structureTemplate (core/
 * lyricEngine.ts's STRUCTURE_TEMPLATE_SECTION_NOTES) and introModePlan are
 * two independently-seeded plans (built in different tasks, v3.43 and
 * v3.64) that were never cross-checked. T2's own template text says "no
 * instrumental lead-in" and T5's says "a cappella hook intro" — both
 * structurally forbid an instrumental intro — but a track could still land
 * introMode:'instrumental' from the other plan, handing the composing
 * agent two contradictory instructions for the same track in the same
 * table (bridgeInstruction.ts's per-track plan). The agent very plausibly
 * resolved the contradiction by dropping the instrumental cue (the more
 * specific, template-embedded wording likely won), silently losing most of
 * the pack's planned instrumental time.
 *
 * Swaps each conflicting track's introMode with a compatible donor track's
 * (a track whose OWN structureTemplate can carry an instrumental intro and
 * that wasn't already 'instrumental') so the total instrumental-track COUNT
 * this function was asked to hit is preserved exactly — no track loses its
 * planned instrumental moment, it just changes hands to a track that can
 * actually carry it. When no donor exists (pathological: every other track
 * already instrumental, or every remaining track is also T2/T5), falls back
 * to downgrading that one track to its template's own compatible mode.
 */
const TEMPLATE_INCOMPATIBLE_INTRO_MODE: Partial<Record<StructureTemplateId, IntroMode>> = {
  T2: 'vocal-immediate',
  T5: 'vocal-after-texture'
};

export function reconcileIntroModeWithStructureTemplate(
  introModePlan: readonly IntroMode[],
  structureTemplatePlan: readonly StructureTemplateId[]
): IntroMode[] {
  const plan = [...introModePlan];
  const conflictIndexes: number[] = [];
  for (let i = 0; i < plan.length; i++) {
    if (plan[i] === 'instrumental' && TEMPLATE_INCOMPATIBLE_INTRO_MODE[structureTemplatePlan[i]]) {
      conflictIndexes.push(i);
    }
  }
  for (const i of conflictIndexes) {
    // Track 1 (index 0) is never a donor: buildIntroModePlan/
    // buildStructureTemplatePlan both hardcode it to vocal-immediate/T1 for
    // the cold-open track's own dedicated opening logic — swapping its
    // introMode away (even to hand it a valid 'instrumental' donation)
    // would silently break that guarantee for the one track callers
    // (openingDurationText, composeLyrics's cold-open branch) trust never
    // to have an instrumental intro.
    const donorIndex = plan.findIndex((mode, idx) =>
      idx !== i
      && idx !== 0
      && mode !== 'instrumental'
      && !TEMPLATE_INCOMPATIBLE_INTRO_MODE[structureTemplatePlan[idx]]
      && !conflictIndexes.includes(idx)
    );
    if (donorIndex === -1) {
      plan[i] = TEMPLATE_INCOMPATIBLE_INTRO_MODE[structureTemplatePlan[i]]!;
      continue;
    }
    const tmp = plan[i];
    plan[i] = plan[donorIndex];
    plan[donorIndex] = tmp;
  }
  return plan;
}
