import { describe, expect, it } from 'vitest';
import { breakLongRuns, buildArcPlan, reorderByArcIntensity } from '../src/core/arcPlan';

/**
 * v3.67 (TASK C) — the 18-song arc (opening/rising/peak/easing/closing)
 * that replaces flat, same-intensity-everywhere pack generation.
 */

describe('[v3.67] buildArcPlan', () => {
  it('produces the 5 phases in order for an 18-song pack, summing to 18', () => {
    const arc = buildArcPlan(18);
    expect(arc).toHaveLength(18);
    expect(arc.map(p => p.phase)).toEqual([
      'opening', 'opening', 'opening',
      'rising', 'rising', 'rising', 'rising', 'rising',
      'peak', 'peak', 'peak',
      'easing', 'easing', 'easing', 'easing',
      'closing', 'closing', 'closing'
    ]);
  });

  it('peak is always intensity 5/strong and closing is always intensity 1', () => {
    const arc = buildArcPlan(18);
    for (const pos of arc.filter(p => p.phase === 'peak')) {
      expect(pos.intensity).toBe(5);
      expect(pos.peakStrength).toBe('strong');
    }
    for (const pos of arc.filter(p => p.phase === 'closing')) {
      expect(pos.intensity).toBe(1);
    }
  });

  it('exactly 4 tracks have peakStrength "none" — the completion target\'s "4곡은 완전히 잔잔하게" requirement', () => {
    const arc = buildArcPlan(18);
    expect(arc.filter(p => p.peakStrength === 'none')).toHaveLength(4);
    expect(arc.filter(p => p.peakStrength === 'strong')).toHaveLength(3);
    expect(arc.filter(p => p.peakStrength === 'subtle')).toHaveLength(11);
  });

  it('scales proportionally for a non-18 songCount and still returns exactly songCount entries', () => {
    for (const count of [1, 5, 9, 12, 24]) {
      const arc = buildArcPlan(count);
      expect(arc).toHaveLength(count);
    }
  });

  it('returns an empty array for songCount <= 0', () => {
    expect(buildArcPlan(0)).toEqual([]);
    expect(buildArcPlan(-3)).toEqual([]);
  });
});

describe('[v3.67] reorderByArcIntensity', () => {
  it('assigns the highest-ranked values to the highest-intensity positions', () => {
    const arc = buildArcPlan(18);
    const values = Array.from({ length: 18 }, (_, i) => i); // 0..17, rank = value itself
    const reordered = reorderByArcIntensity(values, arc, v => v);
    const peakValues = reordered.filter((_, i) => arc[i].phase === 'peak');
    const closingValues = reordered.filter((_, i) => arc[i].phase === 'closing');
    const peakAvg = peakValues.reduce((s, v) => s + v, 0) / peakValues.length;
    const closingAvg = closingValues.reduce((s, v) => s + v, 0) / closingValues.length;
    expect(peakAvg).toBeGreaterThan(closingAvg);
  });

  it('is a pure permutation — same multiset of values, just reordered', () => {
    const arc = buildArcPlan(18);
    const values = ['a', 'a', 'b', 'b', 'b', 'c', 'c', 'c', 'c', 'd', 'd', 'd', 'd', 'e', 'e', 'e', 'f', 'f'];
    const rank: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 };
    const reordered = reorderByArcIntensity(values, arc, v => rank[v]);
    expect(reordered.slice().sort()).toEqual(values.slice().sort());
  });

  it('falls back to a plain copy when lengths mismatch', () => {
    const arc = buildArcPlan(5);
    expect(reorderByArcIntensity([1, 2, 3], arc, v => v)).toEqual([1, 2, 3]);
  });
});

describe('[v3.67] breakLongRuns', () => {
  it('caps any run of an identical value at maxConsecutive', () => {
    const values = ['x', 'x', 'x', 'x', 'x', 'y', 'z'];
    const result = breakLongRuns(values, 2);
    let run = 1;
    for (let i = 1; i < result.length; i++) {
      run = result[i] === result[i - 1] ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(2);
    }
  });

  it('never drops or adds a value — only swaps positions', () => {
    const values = ['x', 'x', 'x', 'y', 'z'];
    const result = breakLongRuns(values, 2);
    expect(result.slice().sort()).toEqual(values.slice().sort());
  });

  it('leaves an already-compliant sequence untouched', () => {
    const values = ['x', 'y', 'x', 'y', 'z'];
    expect(breakLongRuns(values, 2)).toEqual(values);
  });

  // v4.16 (TASK B) — a forward-only donor search can never fix a run at the
  // very END of the array (no later position to swap with); this is the
  // real shape a real 18-song arrangementDensity plan hit (trailing 3x
  // 'sparse' from arc-intensity reordering's own "closing skews sparse"
  // clustering).
  it('fixes a run at the very end of the array (no later position to swap with)', () => {
    const values = ['a', 'b', 'a', 'b', 'x', 'x', 'x'];
    const result = breakLongRuns(values, 2);
    let run = 1;
    for (let i = 1; i < result.length; i++) {
      run = result[i] === result[i - 1] ? run + 1 : 1;
      expect(run, `run at index ${i}`).toBeLessThanOrEqual(2);
    }
    expect(result.slice().sort()).toEqual(values.slice().sort());
  });

  // v4.16 (TASK B) — a heavily-weighted value (here 8 of 18, matching
  // arrangementDensity's real medium:8 share) is more likely to produce a
  // run a naive single pass leaves unfixed.
  it('fixes runs even when one value dominates the sequence (8 of 18, matching arrangementDensity\'s real medium share)', () => {
    const values = ['m', 'm', 'm', 'm', 'm', 'm', 'm', 'm', 's', 's', 's', 's', 's', 's', 'f', 'f', 'f', 'f'];
    const result = breakLongRuns(values, 2);
    let run = 1;
    for (let i = 1; i < result.length; i++) {
      run = result[i] === result[i - 1] ? run + 1 : 1;
      expect(run, `run at index ${i}`).toBeLessThanOrEqual(2);
    }
    expect(result.slice().sort()).toEqual(values.slice().sort());
  });
});
