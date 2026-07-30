import { describe, expect, it } from 'vitest';
import { composeStylePrompt } from '../src/core/promptBudget';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

/**
 * TASK v3.59 (TASK C-8) — atom *count* was never the real problem;
 * individual atom *length* is (e.g. a real genreNarrative clause measured
 * 15 words in one atom). Purely diagnostic: composeStylePrompt now warns
 * when an atom exceeds 8 words and has no authored shortForm to fall back
 * to, so the actual fix (shortening that atom's source text, or authoring
 * a shortForm) is visible instead of silently contributing to prompt bloat.
 * Never drops or rewrites content, never blocks generation.
 */
describe('[v3.59 TASK C-8] long-atom-without-shortForm diagnostic', () => {
  it('warns when a part\'s atom exceeds 8 words and has no shortForm', () => {
    const result = composeStylePrompt([
      { id: 'genre', text: 'warm acoustic pop' },
      { id: 'vocal', text: 'soft male tenor' },
      { id: 'hook', text: 'chorus hook' },
      { id: 'moneyChord', text: 'I-V-vi-IV progression' },
      { id: 'duration', text: '3:10-3:35' },
      { id: 'tempo', text: '92 BPM' },
      { id: 'genreNarrative', text: 'Verse stays in a straight 4/4 pop feel with sustained piano pads and clean strummed acoustic' }
    ]);
    expect(result.warnings.some(w => w.includes('shortForm 미작성') && w.includes('genreNarrative'))).toBe(true);
  });

  it('does not warn when a long atom already has an authored shortForm', () => {
    const longText = 'a very long descriptive phrase that runs well past eight words in total';
    const result = composeStylePrompt([
      { id: 'genre', text: 'warm acoustic pop' },
      { id: 'vocal', text: 'soft male tenor' },
      { id: 'hook', text: 'chorus hook' },
      { id: 'moneyChord', text: 'I-V-vi-IV progression' },
      { id: 'duration', text: '3:10-3:35' },
      { id: 'tempo', text: '92 BPM' },
      { id: 'genreSignature', text: longText, shortForm: 'short cue' }
    ]);
    expect(result.warnings.some(w => w.includes('shortForm 미작성'))).toBe(false);
  });

  it('does not warn on short atoms', () => {
    const result = composeStylePrompt([
      { id: 'genre', text: 'warm acoustic pop' },
      { id: 'vocal', text: 'soft male tenor' },
      { id: 'hook', text: 'chorus hook' }
    ]);
    expect(result.warnings.some(w => w.includes('shortForm 미작성'))).toBe(false);
  });

  it('a real generated pack surfaces at least one long-atom diagnostic warning (confirms it is reachable in practice, not just synthetic)', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 3 }), testGenres, testMoods, testSeason);
    const anyWarned = bp.songs.some(song => song.warnings.some(w => w.includes('shortForm 미작성')));
    expect(anyWarned).toBe(true);
  });
});
