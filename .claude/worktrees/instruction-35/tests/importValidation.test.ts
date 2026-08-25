import { describe, expect, it } from 'vitest';
import { describeTrackSetValidation, resolveEffectiveTrackNo, validateProviderTrackSet } from '../src/core/importValidation';

/**
 * TASK (structural trackNo rejection, third-party audit follow-up) — unit
 * coverage for the shared diagnostic every real entry point
 * (providers/index.ts, core/batchStitcher.ts, core/bridgeImport.ts) now runs
 * BEFORE core/batchPreallocation.ts's claimSlotsByTrackNo/reconciliation, to
 * hard-reject a structurally broken response outright instead of letting it
 * degrade gracefully per-track. See src/core/importValidation.ts's own doc
 * comment for the full reasoning; the real end-to-end "does this actually
 * block the response" coverage lives at each call site's own test file
 * (tests/providerResponseFixtures.test.ts, tests/batchApi.test.ts,
 * tests/truncationSplitRetry.test.ts).
 */
describe('[importValidation] validateProviderTrackSet', () => {
  it('a clean 1..N set is valid with nothing flagged', () => {
    const songs = [{ trackNo: 1 }, { trackNo: 2 }, { trackNo: 3 }];
    const result = validateProviderTrackSet(songs, 3);
    expect(result).toEqual({ invalid: [], duplicates: [], missing: [], valid: true });
  });

  it('a decimal trackNo is invalid', () => {
    const songs = [{ trackNo: 1 }, { trackNo: 2.5 }, { trackNo: 3 }];
    const result = validateProviderTrackSet(songs, 3);
    expect(result.invalid).toEqual([2]); // reported as its 1-based array position — no trustworthy number to name
    expect(result.valid).toBe(false);
  });

  it('a non-numeric string trackNo is invalid', () => {
    const songs = [{ trackNo: 1 }, { trackNo: 'abc' }, { trackNo: 3 }];
    const result = validateProviderTrackSet(songs, 3);
    expect(result.invalid).toEqual([2]);
    expect(result.valid).toBe(false);
  });

  it('a numeric STRING trackNo ("3") parses cleanly and is treated as valid', () => {
    const songs = [{ trackNo: 1 }, { trackNo: '2' }, { trackNo: 3 }];
    const result = validateProviderTrackSet(songs, 3);
    expect(result).toEqual({ invalid: [], duplicates: [], missing: [], valid: true });
  });

  it('a boolean/object trackNo is invalid', () => {
    const songs = [{ trackNo: true }, { trackNo: { nested: 1 } }, { trackNo: 3 }];
    const result = validateProviderTrackSet(songs, 3);
    expect(result.invalid).toEqual([1, 2]);
    expect(result.valid).toBe(false);
  });

  it('trackNo < 1 is invalid, reported by its own (out-of-range) value', () => {
    const songs = [{ trackNo: 0 }, { trackNo: -1 }, { trackNo: 2 }];
    const result = validateProviderTrackSet(songs, 3);
    expect(result.invalid).toEqual([0, -1]);
  });

  it('trackNo > requestedCount is invalid, reported by its own (out-of-range) value', () => {
    const songs = [{ trackNo: 1 }, { trackNo: 42 }];
    const result = validateProviderTrackSet(songs, 5);
    expect(result.invalid).toEqual([42]);
    expect(result.valid).toBe(false);
  });

  it('duplicates: two entries claiming the same in-range trackNo', () => {
    const songs = [{ trackNo: 1 }, { trackNo: 2 }, { trackNo: 2 }, { trackNo: 4 }];
    const result = validateProviderTrackSet(songs, 4);
    expect(result.duplicates).toEqual([2]);
    expect(result.valid).toBe(false);
    // duplicated trackNo does NOT also count as "missing" — it was claimed, just twice.
    expect(result.missing).toEqual([3]);
  });

  it('three-way duplicate is reported once, not three times', () => {
    const songs = [{ trackNo: 1 }, { trackNo: 1 }, { trackNo: 1 }];
    const result = validateProviderTrackSet(songs, 3);
    expect(result.duplicates).toEqual([1]);
  });

  it('missing: requested 18, only 17 delivered, no duplicates/no out-of-range — valid stays true (soft/repairable case)', () => {
    const songs = Array.from({ length: 17 }, (_, i) => ({ trackNo: i + 1 }));
    const result = validateProviderTrackSet(songs, 18);
    expect(result.missing).toEqual([18]);
    expect(result.invalid).toEqual([]);
    expect(result.duplicates).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('an absent trackNo field (undefined/null) is not flagged as invalid — resolved to its own array position instead, same as the real normalizer (TASK E, v5.17)', () => {
    const songs = [{ trackNo: 1 }, { trackNo: undefined }, { trackNo: null }, { trackNo: 4 }];
    const result = validateProviderTrackSet(songs, 4);
    expect(result.invalid).toEqual([]);
    // v5.17 (TASK E) — an absent entry now effectively claims its own 1-based
    // array position (index 1 -> 2, index 2 -> 3), the same fallback
    // core/bridgeImport.ts's claimedTrackNoFor already applies when it
    // actually resolves a slot — so nothing is "missing" here at all.
    expect(result.missing).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('an empty-string trackNo is treated the same as absent, not invalid — also resolved by position (TASK E, v5.17)', () => {
    const songs = [{ trackNo: 1 }, { trackNo: '  ' }, { trackNo: 3 }];
    const result = validateProviderTrackSet(songs, 3);
    expect(result.invalid).toEqual([]);
    expect(result.missing).toEqual([]);
  });

  it('TASK E (v5.17) — an absent trackNo whose fallback position collides with another entry\'s EXPLICIT trackNo is a real duplicate, not silently invisible', () => {
    // The exact repro from the v5.17 audit: index 0 is absent (falls back to
    // position 1), index 1 explicitly claims trackNo 1 too — both would
    // resolve to the SAME slot downstream (core/batchPreallocation.ts's
    // claimSlotsByTrackNo), so this must be caught here, not silently pass
    // as "no duplicates" the way the pre-fix checker (which excluded absent
    // entries from duplicate detection entirely) used to let it through.
    const songs = [{ trackNo: null }, { trackNo: 1 }];
    const result = validateProviderTrackSet(songs, 2);
    expect(result.duplicates).toEqual([1]);
    expect(result.valid).toBe(false);
  });

  it('TASK E (v5.17) — a genuinely all-absent, positionally-sequential set (a legacy-shaped file) is fully valid, not "every track missing"', () => {
    const songs = Array.from({ length: 18 }, () => ({ trackNo: undefined }));
    const result = validateProviderTrackSet(songs, 18);
    expect(result.invalid).toEqual([]);
    expect(result.duplicates).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('TASK E (v5.17) — a mix of explicit and absent trackNo (5 of 18 omitted, no collisions) resolves cleanly with nothing missing', () => {
    const songs = Array.from({ length: 18 }, (_, i) => (
      [2, 5, 9, 13, 17].includes(i) ? { trackNo: undefined } : { trackNo: i + 1 }
    ));
    const result = validateProviderTrackSet(songs, 18);
    expect(result.invalid).toEqual([]);
    expect(result.duplicates).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('duplicate AND out-of-range together — both surfaced, valid is false', () => {
    const songs = [{ trackNo: 1 }, { trackNo: 2 }, { trackNo: 2 }, { trackNo: 99 }];
    const result = validateProviderTrackSet(songs, 4);
    expect(result.duplicates).toEqual([2]);
    expect(result.invalid).toEqual([99]);
    expect(result.valid).toBe(false);
  });

  it('TASK E (v5.17) — resolveEffectiveTrackNo is the same fallback core/bridgeImport.ts\'s claimedTrackNoFor delegates to: explicit value when trustworthy, else array position', () => {
    expect(resolveEffectiveTrackNo(5, 0)).toBe(5);
    expect(resolveEffectiveTrackNo(undefined, 2)).toBe(3);
    expect(resolveEffectiveTrackNo(null, 4)).toBe(5);
    expect(resolveEffectiveTrackNo('  ', 7)).toBe(8);
    expect(resolveEffectiveTrackNo('3', 9)).toBe(3);
  });

  it('describeTrackSetValidation names both categories in a stable, readable form', () => {
    const validation = validateProviderTrackSet([{ trackNo: 2 }, { trackNo: 2 }, { trackNo: 99 }], 4);
    const text = describeTrackSetValidation(validation);
    expect(text).toContain('중복 trackNo: 2');
    expect(text).toContain('99');
  });

  it('describeTrackSetValidation on a valid set returns an empty string', () => {
    const validation = validateProviderTrackSet([{ trackNo: 1 }], 1);
    expect(describeTrackSetValidation(validation)).toBe('');
  });
});
