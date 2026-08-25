import { describe, expect, it } from 'vitest';
import { findAdultPhaseLeaks } from '../src/core/krKidsPolicy';
import { findJpKidsAdultPhaseLeaks } from '../src/core/jpKidsPolicy';
import { KIDS_ARC_PHASE_VALUES } from '../src/core/arcModels';

/**
 * codex 지시문 04 (§4/§5, required test file) — dedicated focus test for
 * the "invalid adult phase" hard-block (아크 번들에 비-kids 구간 값 혼입),
 * split out from krKidsTierPolicy.test.ts's broader coverage per the
 * spec's own explicit required-file list. Direct reuse of arcModels.ts's
 * own real KIDS_ARC_PHASE_VALUES membership set (not a second copy of the
 * list) — see this function's own doc comment in krKidsPolicy.ts.
 */
describe('[codex 지시문 04 §4/§5] findAdultPhaseLeaks / findJpKidsAdultPhaseLeaks — real adult-phase hard block', () => {
  it('flags every real five-phase (adult) value leaking into a kids pack', () => {
    const observed = ['kids-familiar', 'opening', 'kids-learning', 'peak', 'kids-calm'];
    expect(findAdultPhaseLeaks(observed)).toEqual(['opening', 'peak']);
  });

  it('flags a completely undefined/garbage value the same way', () => {
    expect(findAdultPhaseLeaks(['kids-familiar', 'unknown-phase-xyz'])).toEqual(['unknown-phase-xyz']);
  });

  it('reports zero leaks for a real, fully-valid all-kids sequence', () => {
    expect(findAdultPhaseLeaks(['kids-familiar', 'kids-learning', 'kids-moving', 'kids-calm'])).toEqual([]);
  });

  it('every real adult ArcPhase value (opening/rising/peak/easing/closing) is rejected', () => {
    const adultPhases = ['opening', 'rising', 'peak', 'easing', 'closing'];
    expect(findAdultPhaseLeaks(adultPhases)).toEqual(adultPhases);
  });

  it('every real kids-* phase value actually defined in arcModels.ts is accepted (never a false positive)', () => {
    expect(findAdultPhaseLeaks([...KIDS_ARC_PHASE_VALUES])).toEqual([]);
  });

  it('jp-kids uses the identical check (workspace-agnostic reuse, not a second implementation)', () => {
    const observed = ['kids-familiar', 'closing'];
    expect(findJpKidsAdultPhaseLeaks(observed)).toEqual(findAdultPhaseLeaks(observed));
  });
});
