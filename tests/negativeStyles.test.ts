import { describe, expect, it } from 'vitest';
import { joinNegativeStyleTerms, findDuplicateExcludeTerms, mergeNegativeStyleText } from '../src/data/negativeStyles';

/**
 * TASK v5.21 (TASK B-2) — real, measured duplicate pairs in a live 18-song
 * pack's excludePrompt (avg 1,041 chars, 15/18 over 900): "copied melody" /
 * "copied melodies", "copyrighted song reference" / "copyrighted song
 * references", "soundalike vocal" / "soundalike vocals" (plural pairs from
 * two different source lists — core/promptComposer.ts's own literal vs a
 * channel preset's forbiddenCliches), and "sub bass" / "heavy sub bass"
 * (a pure containment pair, never plural-related at all — data/channelSoundFloor.ts's
 * forbiddenAtoms vs data/audienceProfiles.ts's hardExclusions).
 */
describe('[v5.21 TASK B-2] joinNegativeStyleTerms — plural + containment dedup', () => {
  it('collapses a plain plural pair down to the singular form', () => {
    expect(joinNegativeStyleTerms(['copied melody', 'copied melodies'])).toBe('copied melody');
    expect(joinNegativeStyleTerms(['copyrighted song reference', 'copyrighted song references'])).toBe('copyrighted song reference');
    expect(joinNegativeStyleTerms(['soundalike vocal', 'soundalike vocals'])).toBe('soundalike vocal');
  });

  it('collapses a containment pair down to the more specific (longer) phrase', () => {
    expect(joinNegativeStyleTerms(['sub bass', 'heavy sub bass'])).toBe('heavy sub bass');
    expect(joinNegativeStyleTerms(['heavy sub bass', 'sub bass'])).toBe('heavy sub bass');
  });

  it('never corrupts a word that ends in -s but is not plural (bass, chorus)', () => {
    expect(joinNegativeStyleTerms(['double bass'])).toBe('double bass');
    expect(joinNegativeStyleTerms(['gated chorus'])).toBe('gated chorus');
  });

  it('never drops two genuinely distinct terms', () => {
    expect(joinNegativeStyleTerms(['muddy low-end mix', 'excessive reverb washing out the vocal'])).toBe(
      'muddy low-end mix, excessive reverb washing out the vocal'
    );
  });

  it('mergeNegativeStyleText (the real call path buildExcludePrompt/batchPreallocation.ts use) applies the same dedup across multiple source strings — first-seen form survives', () => {
    const merged = mergeNegativeStyleText(
      'famous artist imitation, copied melodies, copyrighted song references, soundalike vocals',
      'copied melody, copyrighted song reference, soundalike vocal, heavy sub bass',
      'sub bass'
    );
    expect(merged).toBe('famous artist imitation, copied melodies, copyrighted song references, soundalike vocals, heavy sub bass');
  });
});

describe('[v5.21 TASK B-4] findDuplicateExcludeTerms — reporting for compositionScorer\'s advisory check', () => {
  it('finds the real documented duplicate pairs in one raw excludePrompt string', () => {
    const raw = 'famous artist imitation, copied melody, copyrighted song reference, soundalike vocal, heavy sub bass, copied melodies, copyrighted song references, soundalike vocals, sub bass';
    const pairs = findDuplicateExcludeTerms(raw);
    const pairStrings = pairs.map(([a, b]) => `${a}|${b}`);
    expect(pairStrings).toContain('copied melody|copied melodies');
    expect(pairStrings).toContain('copyrighted song reference|copyrighted song references');
    expect(pairStrings).toContain('soundalike vocal|soundalike vocals');
    expect(pairStrings).toContain('sub bass|heavy sub bass');
  });

  it('returns [] for an already-clean list', () => {
    expect(findDuplicateExcludeTerms('famous artist imitation, muddy low-end mix, cavernous hall reverb')).toEqual([]);
  });

  it('returns [] for an empty string', () => {
    expect(findDuplicateExcludeTerms('')).toEqual([]);
  });
});
