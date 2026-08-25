import { describe, expect, it } from 'vitest';
import { resolveKrKidsExpectedPhasePolicy } from '../src/core/krKidsPolicy';
import { resolveJpKidsExpectedPhasePolicy } from '../src/core/jpKidsPolicy';
import { kidsArcBundlePlanFor } from '../src/core/arcModels';

/**
 * codex 지시문 04 (§4/§5, required test file) — dedicated focus test for
 * the "terminal phase" (마지막 트랙의 아크 번들) check specifically, split
 * out from krKidsTierPolicy.test.ts's broader coverage per the spec's own
 * explicit required-file list. `terminalPhase` is real, direct exposure of
 * arcModels.ts's own bundle declaration order (its own doc comment:
 * "bundlesForAgeTier's declaration order always places its calmest bundle
 * last") — not a separate computation, so this test locks in that each
 * tier's own real last-declared bundle is what `terminalPhase` reports.
 */
describe('[codex 지시문 04 §4/§5] terminal phase — real per-tier closing bundle', () => {
  it('kids-t1 (3-bundle, 0-2세) terminates on kids-calm', () => {
    expect(resolveKrKidsExpectedPhasePolicy(18, 'kids-t1').terminalPhase).toBe('kids-calm');
  });

  it('kids-t2 (default, 4-bundle) terminates on kids-calm', () => {
    expect(resolveKrKidsExpectedPhasePolicy(18, 'kids-t2').terminalPhase).toBe('kids-calm');
  });

  it('kids-t3 (5-bundle, oldest tier) terminates on its own distinct closing bundle, not kids-calm', () => {
    const t3 = resolveKrKidsExpectedPhasePolicy(18, 'kids-t3');
    expect(t3.terminalPhase).toBe('kids-closing');
    expect(t3.terminalPhase).not.toBe('kids-calm');
  });

  it('terminalPhase always matches arcModels.ts\'s own real last surviving (count > 0) bundle, for every tier', () => {
    for (const tier of ['kids-t1', 'kids-t2', 'kids-t3'] as const) {
      const policy = resolveKrKidsExpectedPhasePolicy(18, tier);
      const real = kidsArcBundlePlanFor(18, tier).filter(e => e.count > 0);
      expect(policy.terminalPhase).toBe(real[real.length - 1].phase);
    }
  });

  it('jp-kids reuses the exact same real terminal-phase data as kr-kids (workspace-agnostic bundle system)', () => {
    expect(resolveJpKidsExpectedPhasePolicy(18, 'kids-t3').terminalPhase)
      .toBe(resolveKrKidsExpectedPhasePolicy(18, 'kids-t3').terminalPhase);
  });

  it('the terminal bundle is always the LOWEST-intensity bundle actually used (calm/quiet finish by construction)', () => {
    for (const tier of ['kids-t1', 'kids-t2', 'kids-t3'] as const) {
      const policy = resolveKrKidsExpectedPhasePolicy(18, tier);
      const terminalEntry = policy.intensityPolicy.find(p => p.phase === policy.terminalPhase)!;
      const minOtherIntensity = Math.min(...policy.intensityPolicy.filter(p => p.phase !== policy.terminalPhase).map(p => p.intensity));
      expect(terminalEntry.intensity).toBeLessThan(minOtherIntensity);
    }
  });
});
