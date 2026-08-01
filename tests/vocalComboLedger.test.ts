import { describe, expect, it } from 'vitest';
import { dominantRegisterSignature } from '../src/core/vocalComboLedger';

// TASK v3.72 (TASK E) — only the pure signature-computation function is unit
// tested here; recordVocalCombo/getRecentVocalCombos are thin IndexedDB
// wrappers (same shape as core/ratingLedger.ts's own untested-by-unit-test
// openDb/withStore pair) exercised indirectly through core/library.ts's
// savePack in real browser use, not under jsdom/vitest.

describe('[v3.72 TASK E] dominantRegisterSignature', () => {
  it('picks the most-used register per gender from a pack\'s stylePrompts', () => {
    const songs = [
      { vocalType: 'male' as const, stylePrompt: 'x, mid baritone-tenor lead, y' },
      { vocalType: 'male' as const, stylePrompt: 'x, mid baritone-tenor lead, y' },
      { vocalType: 'male' as const, stylePrompt: 'x, low warm baritone, y' },
      { vocalType: 'female' as const, stylePrompt: 'x, clear mezzo lead, y' }
    ];
    expect(dominantRegisterSignature(songs)).toBe('M:mid baritone-tenor lead|F:clear mezzo lead');
  });

  it('omits a gender with no songs (e.g. an all-duet pack)', () => {
    const songs = [{ vocalType: 'mixed' as const, stylePrompt: 'male and female duet' }];
    expect(dominantRegisterSignature(songs)).toBe('');
  });

  it('returns empty for a kids pack (childlike wording never matches the adult register pools)', () => {
    const songs = [{ vocalType: 'male' as const, stylePrompt: 'bright childlike boy voice, playful and youthful' }];
    expect(dominantRegisterSignature(songs)).toBe('');
  });
});
