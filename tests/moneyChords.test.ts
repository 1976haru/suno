import { describe, expect, it } from 'vitest';
import { buildStylePrompt } from '../src/core/promptComposer';
import { compactMoneyChord } from '../src/core/soundSignature';
import { isPlausibleChordProgression, moneyChordPresets, moneyChordRotationPool, MONEY_CHORD_FEEL_SUFFIX, signatureMoneyChordId } from '../src/data/moneyChords';
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

  it('[v3.33 Part C] has the 5 new channel-signature presets (doowop/warmCycle for senior-morning, royalRoad/marusa/komuro for showa-cafe)', () => {
    const ids = Object.keys(moneyChordPresets);
    expect(ids).toEqual(expect.arrayContaining(['doowop', 'warmCycle', 'royalRoad', 'marusa', 'komuro']));
    expect(ids.length).toBeGreaterThanOrEqual(13);
  });

  it('[v3.33 Part C] every new preset has the exact progression named in the instruction', () => {
    expect(moneyChordPresets.doowop.progressions).toEqual(['I-vi-IV-V']);
    expect(moneyChordPresets.warmCycle.progressions).toEqual(['IV-I-V-vi']);
    expect(moneyChordPresets.royalRoad.progressions).toEqual(['IV-V-iii-vi']);
    expect(moneyChordPresets.marusa.progressions).toEqual(['IVM7-III7-vi-I7']);
    expect(moneyChordPresets.komuro.progressions).toEqual(['vi-IV-V-I']);
  });

  it('[v3.33 Part C] every new preset has a Korean labelKo and a one-line description', () => {
    for (const id of ['doowop', 'warmCycle', 'royalRoad', 'marusa', 'komuro']) {
      const preset = moneyChordPresets[id];
      expect(preset.labelKo.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });
});

describe('[v3.33 Part C] signatureMoneyChordId / moneyChordRotationPool', () => {
  it('senior-morning\'s signature is doowop', () => {
    expect(signatureMoneyChordId('senior-morning')).toBe('doowop');
  });

  it('showa-cafe\'s signature is royalRoad', () => {
    expect(signatureMoneyChordId('showa-cafe')).toBe('royalRoad');
  });

  it('any other archetype (or none) falls back to default, unchanged from pre-v3.33', () => {
    expect(signatureMoneyChordId('christmas')).toBe('default');
    expect(signatureMoneyChordId('lofi-study')).toBe('default');
    expect(signatureMoneyChordId('kids')).toBe('default');
    expect(signatureMoneyChordId(undefined)).toBe('default');
  });

  it('each archetype\'s rotation pool includes its own signature', () => {
    expect(moneyChordRotationPool('senior-morning')).toContain('doowop');
    expect(moneyChordRotationPool('showa-cafe')).toContain('royalRoad');
  });

  it('showa-cafe\'s rotation pool includes marusa and komuro', () => {
    const pool = moneyChordRotationPool('showa-cafe');
    expect(pool).toContain('marusa');
    expect(pool).toContain('komuro');
  });

  it('every id in every rotation pool resolves to a real preset', () => {
    for (const archetype of ['senior-morning', 'showa-cafe', 'christmas', undefined] as const) {
      for (const id of moneyChordRotationPool(archetype)) {
        expect(moneyChordPresets[id], `unknown preset id "${id}" in ${archetype} rotation pool`).toBeDefined();
      }
    }
  });
});

describe('[v3.33 Part C] compactMoneyChord — override + feel reinforcement', () => {
  it('includeFeelReinforcement appends MONEY_CHORD_FEEL_SUFFIX', () => {
    const opts = makeOptions({ moneyChordMode: 'default' });
    const withReinforcement = compactMoneyChord(opts, { includeFeelReinforcement: true });
    const without = compactMoneyChord(opts);
    expect(withReinforcement).toContain(MONEY_CHORD_FEEL_SUFFIX);
    expect(without).not.toContain(MONEY_CHORD_FEEL_SUFFIX);
    expect(withReinforcement).toContain(without); // base text preserved as a prefix
  });

  it('moneyChordIdOverride bypasses opts.moneyChordMode entirely', () => {
    const opts = makeOptions({ moneyChordMode: 'jazzColor' });
    expect(compactMoneyChord(opts, { moneyChordIdOverride: 'royalRoad' })).toBe(moneyChordPresets.royalRoad.compactProgression);
  });

  it('moneyChordIdOverride + includeFeelReinforcement compose together', () => {
    const opts = makeOptions({ moneyChordMode: 'default' });
    const result = compactMoneyChord(opts, { moneyChordIdOverride: 'marusa', includeFeelReinforcement: true });
    expect(result).toContain(moneyChordPresets.marusa.compactProgression);
    expect(result).toContain(MONEY_CHORD_FEEL_SUFFIX);
  });

  it('an unrecognized override id falls back to the default preset rather than crashing', () => {
    const opts = makeOptions();
    expect(() => compactMoneyChord(opts, { moneyChordIdOverride: 'not-a-real-id' })).not.toThrow();
    expect(compactMoneyChord(opts, { moneyChordIdOverride: 'not-a-real-id' })).toBe(moneyChordPresets.default.compactProgression);
  });
});
