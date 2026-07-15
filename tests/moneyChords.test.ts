import { describe, expect, it } from 'vitest';
import { buildStylePrompt } from '../src/core/promptComposer';
import { compactMoneyChord } from '../src/core/soundSignature';
import { isPlausibleChordProgression, moneyChordPresets } from '../src/data/moneyChords';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { GenerationOptions } from '../src/types';

describe('money chord presets', () => {
  // TASK G1 (v3.10) — buildStylePrompt now carries the compact
  // ('I-V-vi-IV progression') form of each preset, not the full long-form
  // preset.prompt text — that full text alone cost ~15-20 words for no
  // benefit the compact roman-numeral tag didn't already give. Each
  // preset's own progression, as compactMoneyChord would render it, must
  // still show up somewhere in the composed prompt.
  it('every non-custom preset\'s compact progression is reflected in buildStylePrompt()', () => {
    for (const preset of Object.values(moneyChordPresets)) {
      if (preset.id === 'custom') continue;
      const opts = makeOptions({ moneyChordMode: preset.id as GenerationOptions['moneyChordMode'] });
      const prompt = buildStylePrompt(opts, testGenres, testMoods, testSeason);
      expect(prompt).toContain(compactMoneyChord(opts));
    }
  });

  it('custom mode + customMoneyChord input is included in the prompt (M1 regression)', () => {
    const opts = makeOptions({ moneyChordMode: 'custom', customMoneyChord: 'I-V-vi-IV / vi-IV-I-V' });
    const prompt = buildStylePrompt(opts, testGenres, testMoods, testSeason);
    expect(prompt).toContain('I-V-vi-IV / vi-IV-I-V');
  });

  it('custom mode without input falls back to the custom preset\'s own compactProgression (TASK H3, v3.14)', () => {
    const opts = makeOptions({ moneyChordMode: 'custom', customMoneyChord: '' });
    const prompt = buildStylePrompt(opts, testGenres, testMoods, testSeason);
    // Pre-v3.14, compactMoneyChord regex-extracted a roman-numeral run out of
    // moneyChordPresets.custom.prompt, found none, and fell back to the
    // content-free 'money chord progression' string. It now reads
    // compactProgression directly instead of parsing free text.
    expect(prompt).toContain(moneyChordPresets.custom.compactProgression);
  });

  it('accepts well-formed Roman numeral progressions', () => {
    expect(isPlausibleChordProgression('I-V-vi-IV')).toBe(true);
    expect(isPlausibleChordProgression('IVmaj7-iii7-vi7')).toBe(true);
    expect(isPlausibleChordProgression('vii°-i-IV')).toBe(true);
  });

  it('flags malformed custom input as implausible but generation is never blocked by it', () => {
    expect(isPlausibleChordProgression('banana')).toBe(false);
    expect(isPlausibleChordProgression('')).toBe(false);
    const opts = makeOptions({ moneyChordMode: 'custom', customMoneyChord: 'banana' });
    expect(() => buildStylePrompt(opts, testGenres, testMoods, testSeason)).not.toThrow();
    expect(buildStylePrompt(opts, testGenres, testMoods, testSeason)).toContain('banana');
  });

  it('has at least 7 presets including canon, showaModern, and winterBallad', () => {
    const ids = Object.keys(moneyChordPresets);
    expect(ids.length).toBeGreaterThanOrEqual(7);
    expect(ids).toEqual(expect.arrayContaining(['canon', 'showaModern', 'winterBallad']));
  });
});
