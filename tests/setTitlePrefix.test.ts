import { describe, expect, it } from 'vitest';
import { applySetTitlePrefix, stripSetTitlePrefix } from '../src/utils/generation';

describe('[v3.35] applySetTitlePrefix / stripSetTitlePrefix', () => {
  it('prefixes with the 2-digit trackNo and a ". " separator', () => {
    expect(applySetTitlePrefix(3, 'Winterglass')).toBe('03. Winterglass');
    expect(applySetTitlePrefix(18, 'Hold On Tonight')).toBe('18. Hold On Tonight');
  });

  it('does not zero-pad past 2 digits for trackNo >= 100 (still just the number as-is)', () => {
    expect(applySetTitlePrefix(100, 'X')).toBe('100. X');
  });

  it('strips a leading "NN. " prefix back to the bare creative title', () => {
    expect(stripSetTitlePrefix('03. Winterglass')).toBe('Winterglass');
    expect(stripSetTitlePrefix('18. Hold On Tonight')).toBe('Hold On Tonight');
  });

  it('is a no-op on a title with no prefix', () => {
    expect(stripSetTitlePrefix('Winterglass')).toBe('Winterglass');
  });

  it('round-trips: strip(apply(n, title)) === title', () => {
    for (const [n, title] of [[1, 'Coffee Steam'], [9, 'Winterglass'], [18, 'Hold On Tonight']] as [number, string][]) {
      expect(stripSetTitlePrefix(applySetTitlePrefix(n, title))).toBe(title);
    }
  });

  it('the same core title with different set prefixes strips to the identical string (the whole point — prevents "01. X" vs "05. X" false-negative dedup)', () => {
    const a = stripSetTitlePrefix(applySetTitlePrefix(1, 'Winterglass'));
    const b = stripSetTitlePrefix(applySetTitlePrefix(5, 'Winterglass'));
    expect(a).toBe(b);
  });

  it('never strips a number that is not immediately followed by ". " (a legitimate title starting with digits is left alone)', () => {
    expect(stripSetTitlePrefix('24 Hours of Rain')).toBe('24 Hours of Rain');
    expect(stripSetTitlePrefix('1989 Was A Good Year')).toBe('1989 Was A Good Year');
  });
});
