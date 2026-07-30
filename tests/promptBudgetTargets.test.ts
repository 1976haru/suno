import { describe, expect, it } from 'vitest';
import { composeStylePrompt, STYLE_WORD_TARGET_MAX } from '../src/core/promptBudget';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

/**
 * TASK v3.58 (TASK 7) — regression tests for the prompt-budget/linter fixes:
 * STYLE_WORD_TARGET_MAX/GENRE_NARRATIVE_FLOOR_ATOMS lowered (7-2), the
 * silent-overage case now surfaces a warning instead of passing quietly
 * (7-3), and genreNarrative floor-reduction rotates which clauses survive
 * per track (7-4).
 */
describe('[v3.58 TASK 7-3] silent prompt-word overage now surfaces a warning', () => {
  it('a prompt whose essential/guaranteed-minimum atoms alone exceed STYLE_WORD_TARGET_MAX gets a warning, not a silent pass', () => {
    const longEssentialText = Array.from({ length: 20 }, (_, i) => `essential descriptor ${i}`).join(', ');
    const result = composeStylePrompt([
      { id: 'genre', text: 'warm acoustic pop' },
      { id: 'genreSignature', text: 'nostalgic acoustic pop' },
      { id: 'vocal', text: longEssentialText },
      { id: 'hook', text: 'strong repeated chorus hook' },
      { id: 'moneyChord', text: 'I-V-vi-IV progression' },
      { id: 'duration', text: '3:10-3:35' },
      { id: 'introTexture', text: 'fingerpicked acoustic guitar intro texture' },
      { id: 'tempo', text: '92 BPM' }
    ]);
    expect(result.wordCount).toBeGreaterThan(STYLE_WORD_TARGET_MAX);
    expect(result.warnings.some(w => w.includes(`목표 ${STYLE_WORD_TARGET_MAX}`))).toBe(true);
  });

  it('a prompt that comfortably fits under the target gets no such warning', () => {
    const result = composeStylePrompt([
      { id: 'genre', text: 'warm acoustic pop' },
      { id: 'vocal', text: 'soft male tenor' },
      { id: 'hook', text: 'chorus hook' },
      { id: 'moneyChord', text: 'I-V-vi-IV progression' },
      { id: 'duration', text: '3:10-3:35' },
      { id: 'tempo', text: '92 BPM' }
    ]);
    expect(result.wordCount).toBeLessThanOrEqual(STYLE_WORD_TARGET_MAX);
    expect(result.warnings.some(w => w.includes('목표'))).toBe(false);
  });
});

describe('[v3.58 TASK 7-5] no leftover Suno-illegible labels/directives in a real style prompt', () => {
  it('a real 18-song pack never contains "Money chords:" or the removed adherence directive', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 18 }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(song.stylePrompt).not.toContain('Money chords:');
      expect(song.stylePrompt).not.toContain('Keep this progression');
      expect(song.stylePrompt).not.toContain('Instruments:');
      expect(song.stylePrompt).not.toContain('Signature:');
      expect(song.stylePrompt).not.toContain('Arrangement detail:');
    }
  });
});

describe('[v3.58 TASK 7-4] genreNarrative floor-reduction rotates which clauses survive across a pack', () => {
  it('an 18-song single-genre pack does not floor-reduce every track to the exact same 2 narrative clauses', () => {
    // A single narrated lead genre with enough other atoms to push the
    // word count over STYLE_WORD_TARGET_MAX on every track (matching real
    // generation — see localGenerator.ts, which always calls
    // composeStylePrompt with limit=safeTarget=SUNO_COPY_LIMIT, so it's the
    // *word*-budget path, not the char one, that floor-reduces genreNarrative
    // in practice), so only rotation can make the surviving pair differ.
    const combos = new Set<string>();
    for (let trackIdx = 0; trackIdx < 18; trackIdx++) {
      const result = composeStylePrompt(
        [
          { id: 'vocal', text: 'mature soulful male tenor, soft slightly husky close-mic delivery, gentle and sincere, clear unhurried diction' },
          {
            id: 'genreNarrative',
            text: 'Verse begins close, pre-chorus widens harmony, chorus opens clearly, hook entry uses a pause, mix stays warm'
          },
          { id: 'moneyChord', text: 'I-V-vi-IV progression - chorus opens up warmly and resolves home, instantly familiar' },
          { id: 'instruments', text: 'strummed acoustic guitar, upright bass, light hand percussion' },
          { id: 'mood', text: 'nostalgic, warm, gentle' },
          { id: 'hook', text: 'strong repeated chorus hook, repeats chorus 4x' },
          { id: 'duration', text: '3:10-3:35' },
          { id: 'introTexture', text: 'fingerpicked acoustic guitar intro texture' },
          { id: 'tempo', text: '92 BPM' }
        ],
        1000,
        1000,
        undefined,
        trackIdx
      );
      expect(result.wordCount).toBeGreaterThan(35);
      const narrativeClauses = result.prompt
        .split(',')
        .map(clause => clause.trim())
        .filter(clause => /^(verse|pre-chorus|chorus opens clearly|hook entry|mix stays warm)\b/i.test(clause));
      combos.add(narrativeClauses.join('|'));
    }
    expect(combos.size).toBeGreaterThanOrEqual(4);
  });
});
