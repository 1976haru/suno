import { describe, expect, it } from 'vitest';
import { extractQualifyingLines, LYRIC_LINE_MIN_LENGTH } from '../src/core/lyricLineLedger';

/**
 * v5.22 (AXIS 1) — extractQualifyingLines is the one pure function in
 * lyricLineLedger.ts; the rest is IndexedDB CRUD, untestable in this
 * project's Node vitest environment (same established limitation
 * hookLedger.ts's own real store functions have — see
 * tests/workspaceTransfer.test.ts's own doc comment on why hooks/ratings/
 * videos/takes/usage aren't round-trip-tested here, only packs are, via
 * library.ts's memory fallback).
 */
describe('[v5.22 AXIS 1] extractQualifyingLines', () => {
  it('keeps only lines at or above the 25-char minimum', () => {
    const lyrics = [
      '[verse]',
      'short line',
      'a chair scraped back for my brother in the kitchen',
      '[chorus]',
      'Hold on tight'
    ].join('\n');
    const lines = extractQualifyingLines(lyrics, 'Hold on tight');
    expect(lines).toEqual(['a chair scraped back for my brother in the kitchen']);
    expect(lines[0].length).toBeGreaterThanOrEqual(LYRIC_LINE_MIN_LENGTH);
  });

  it('excludes section tags and a leading Title: line', () => {
    const lyrics = ['Title: Some Song', '[verse]', 'a dish went sailing hand to hand across the table', '[chorus]'].join('\n');
    const lines = extractQualifyingLines(lyrics, '');
    expect(lines).toEqual(['a dish went sailing hand to hand across the table']);
  });

  it('excludes the hookPhrase itself (case-insensitive) — a repeated chorus is by design, not a collision', () => {
    const lyrics = ['[chorus]', 'Hold on tight through the storm tonight', '[chorus]', 'HOLD ON TIGHT THROUGH THE STORM TONIGHT'].join('\n');
    const lines = extractQualifyingLines(lyrics, 'Hold on tight through the storm tonight');
    expect(lines).toEqual([]);
  });

  it('an empty lyrics block yields no lines', () => {
    expect(extractQualifyingLines('', 'Hook')).toEqual([]);
  });

  it('trims whitespace before measuring length', () => {
    const shortPadded = '   short   ';
    expect(extractQualifyingLines(shortPadded, '')).toEqual([]);
    const longLine = 'a taxi splashed the curb with color as it passed';
    expect(extractQualifyingLines(`   ${longLine}   `, '')).toEqual([longLine]);
  });
});
