import { describe, expect, it } from 'vitest';
import { buildStylePrompt } from '../src/core/promptComposer';
import { isPlausibleChordProgression, moneyChordPresets } from '../src/data/moneyChords';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { GenerationOptions } from '../src/types';

describe('money chord presets', () => {
  it('every non-custom preset is reflected verbatim in buildStylePrompt()', () => {
    for (const preset of Object.values(moneyChordPresets)) {
      if (preset.id === 'custom') continue;
      const opts = makeOptions({ moneyChordMode: preset.id as GenerationOptions['moneyChordMode'] });
      const prompt = buildStylePrompt(opts, testGenres, testMoods, testSeason);
      expect(prompt).toContain(preset.prompt);
    }
  });

  it('custom mode + customMoneyChord input is included in the prompt (M1 regression)', () => {
    const opts = makeOptions({ moneyChordMode: 'custom', customMoneyChord: 'I-V-vi-IV / vi-IV-I-V' });
    const prompt = buildStylePrompt(opts, testGenres, testMoods, testSeason);
    expect(prompt).toContain('I-V-vi-IV / vi-IV-I-V');
  });

  it('custom mode without input falls back to the generic custom preset prompt', () => {
    const opts = makeOptions({ moneyChordMode: 'custom', customMoneyChord: '' });
    const prompt = buildStylePrompt(opts, testGenres, testMoods, testSeason);
    expect(prompt).toContain(moneyChordPresets.custom.prompt);
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
