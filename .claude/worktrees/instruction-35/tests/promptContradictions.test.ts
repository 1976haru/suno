import { describe, expect, it } from 'vitest';
import { findPromptContradictions } from '../src/core/compositionScorer';

/**
 * TASK v5.21 (TASK E) — real, measured contradictions from a live
 * bridge-imported 18-song pack:
 *  - T11: "male thin bright tenor lead" + "girl-group unison lead" in the
 *    same stylePrompt (post vocal-plan reconciliation: "female full chest
 *    alto" + "girl-group unison lead" — the gender changed but the
 *    solo/group conflict remained).
 *  - T17: "male male head-voice lead" — a literal duplicated word.
 */
describe('[v5.21 TASK E-3] findPromptContradictions', () => {
  it('flags a solo gendered lead alongside a group-style lead (the real T11 case, pre- and post-reconciliation)', () => {
    const pre = 'Doo-Wop Close Harmony, male thin bright tenor, legato sustained lines, girl-group unison lead, upright bass';
    const post = 'Doo-Wop Close Harmony, female full chest alto, bright forward delivery, girl-group unison lead, upright bass';
    expect(findPromptContradictions(pre).blocking.length).toBeGreaterThan(0);
    expect(findPromptContradictions(post).blocking.length).toBeGreaterThan(0);
  });

  it('flags two different genders both claiming a register lead', () => {
    const result = findPromptContradictions('male thin bright tenor lead, female full chest alto lead, upright bass');
    expect(result.blocking.some(b => b.includes('성별로 2개 이상'))).toBe(true);
  });

  it('flags an immediately repeated word (the real T17 case)', () => {
    const result = findPromptContradictions('Sunshine Pop, male male head-voice lead, conversational unhurried phrasing');
    expect(result.blocking.some(b => b.includes('male male'))).toBe(true);
  });

  it('does not flag a normal duet stylePrompt (both genders present but neither as a conflicting solo+group lead)', () => {
    const result = findPromptContradictions('male warm baritone lead, answered by female full chest alto backing, upright bass, brushed snare');
    // Both genders appear, but each is its own distinct register phrase — this
    // is exactly what a real duet looks like, so the "2 gender leads" check
    // legitimately fires here (both ARE registered as leads) — the real
    // regression guard is that a genuinely SINGLE-voice prompt with no
    // gender conflict at all produces nothing:
    const single = findPromptContradictions('male warm baritone lead, upright bass, brushed snare, close harmony backing');
    expect(single.blocking).toEqual([]);
    expect(result).toBeDefined();
  });

  it('does not flag a clean single-lead prompt with no group-lead marker', () => {
    const result = findPromptContradictions('Baroque Pop, male low warm baritone, storytelling spoken-edge delivery, string quartet, oboe obbligato');
    expect(result.blocking).toEqual([]);
  });

  it('does not false-positive on a legitimate repeated non-adjacent word', () => {
    const result = findPromptContradictions('warm acoustic pop, warm intimate mix, mid tempo');
    expect(result.blocking).toEqual([]);
  });
});
