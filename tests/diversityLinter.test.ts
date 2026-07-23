import { describe, expect, it } from 'vitest';
import { lintPresetDiversity } from '../src/core/diversityLinter';

/**
 * v3.14 PART C — the regression guard for the whole "changed the preset but
 * the Suno-facing compact text is identical (or content-free) to another
 * preset" bug class. If this test file had existed before v3.14, the
 * moneyChord regex bug (emotional === default, showaModern -> generic
 * fallback) would have failed CI at the exact commit that introduced it,
 * rather than shipping silently across multiple releases.
 */
describe('v3.14 diversity linter — moneyChord', () => {
  it('all moneyChord presets produce mutually distinct compactProgression text (duplicates: 0)', () => {
    const report = lintPresetDiversity('moneyChord');
    expect(report.duplicateGroups, `duplicate groups found: ${JSON.stringify(report.duplicateGroups)}`).toEqual([]);
  });

  it('no moneyChord preset falls back to a content-free generic string', () => {
    const report = lintPresetDiversity('moneyChord');
    expect(report.genericFallbackCount).toBe(0);
  });

  it('reports passed=true and covers all 13 known presets (8 original + 5 v3.33 Part C channel-signature presets)', () => {
    const report = lintPresetDiversity('moneyChord');
    expect(report.passed).toBe(true);
    expect(report.totalPresets).toBeGreaterThanOrEqual(13);
  });
});

describe('v3.14 diversity linter — vocal', () => {
  it('all vocal presets produce mutually distinct compact vocal text (duplicates: 0) — regression guard, confirmed safe pre-v3.14 but now locked in', () => {
    const report = lintPresetDiversity('vocal');
    expect(report.duplicateGroups, `duplicate groups found: ${JSON.stringify(report.duplicateGroups)}`).toEqual([]);
    expect(report.passed).toBe(true);
  });
});

describe('v3.14 diversity linter — genre (bonus coverage, same bug class as v3.13)', () => {
  it('every core-tier genre (both real archetypes) produces a distinct compact genre keyword', () => {
    const report = lintPresetDiversity('genre');
    expect(report.duplicateGroups, `duplicate groups found: ${JSON.stringify(report.duplicateGroups)}`).toEqual([]);
    expect(report.passed).toBe(true);
  });
});
