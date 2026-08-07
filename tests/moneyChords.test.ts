import { describe, expect, it } from 'vitest';
import { buildStylePrompt } from '../src/core/promptComposer';
import { compactMoneyChord } from '../src/core/soundSignature';
import { detectMoneyChordPreset, isPlausibleChordProgression, moneyChordPresets, moneyChordRotationPool, signatureMoneyChordId } from '../src/data/moneyChords';
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

  it('[v3.42 Part B3] every preset has a non-empty, mutually distinct audibleEffect', () => {
    const effects = Object.values(moneyChordPresets).map(p => p.audibleEffect);
    for (const effect of effects) expect(effect.length).toBeGreaterThan(0);
    expect(new Set(effects).size).toBe(effects.length);
  });

  // v5.8 (TASK 1) — audibleEffectTag is a hand-written, <=8-word, tag-style
  // compression of audibleEffect (not a mechanical truncation), so every
  // preset needs its own non-empty, mutually distinct, real value.
  it('[v5.8 TASK 1] every preset has a non-empty, mutually distinct, <=8-word audibleEffectTag', () => {
    const tags = Object.values(moneyChordPresets).map(p => p.audibleEffectTag);
    expect(tags.length).toBe(18);
    for (const tag of tags) {
      expect(tag.length).toBeGreaterThan(0);
      expect(tag.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(8);
    }
    expect(new Set(tags).size).toBe(tags.length);
  });
});

describe('[v3.33 Part C] signatureMoneyChordId / moneyChordRotationPool', () => {
  it('senior-morning\'s signature is doowop', () => {
    expect(signatureMoneyChordId('senior-morning')).toBe('doowop');
  });

  it('showa-cafe\'s signature is royalRoad', () => {
    expect(signatureMoneyChordId('showa-cafe')).toBe('royalRoad');
  });

  it('christmas/lofi-study/undefined still fall back to default, unchanged from pre-v3.33', () => {
    expect(signatureMoneyChordId('christmas')).toBe('default');
    expect(signatureMoneyChordId('lofi-study')).toBe('default');
    expect(signatureMoneyChordId(undefined)).toBe('default');
  });

  // TASK v3.38 Part B4 — 'kids' now has a real signature progression too.
  it('kids\'s signature is kidsSimple', () => {
    expect(signatureMoneyChordId('kids')).toBe('kidsSimple');
  });

  it('each archetype\'s rotation pool includes its own signature', () => {
    expect(moneyChordRotationPool('senior-morning')).toContain('doowop');
    expect(moneyChordRotationPool('showa-cafe')).toContain('royalRoad');
    expect(moneyChordRotationPool('kids')).toContain('kidsSimple');
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
  // v5.8 (TASK 1) — includeFeelReinforcement now appends the terse
  // audibleEffectTag (<=8 words), not the long-form audibleEffect sentence:
  // TASK A (v4.8) found the full sentence read as decorative prose to Suno
  // and cost budget without helping (see soundSignature.ts's own
  // CompactMoneyChordOptions doc comment).
  it('[v5.8 TASK 1] includeFeelReinforcement appends that preset\'s own audibleEffectTag, not the long-form audibleEffect sentence', () => {
    const opts = makeOptions({ moneyChordMode: 'default' });
    const withReinforcement = compactMoneyChord(opts, { includeFeelReinforcement: true });
    const without = compactMoneyChord(opts);
    expect(withReinforcement).toContain(moneyChordPresets.default.audibleEffectTag);
    expect(withReinforcement).not.toContain(moneyChordPresets.default.audibleEffect);
    expect(without).not.toContain(moneyChordPresets.default.audibleEffectTag);
    expect(withReinforcement).toContain(without); // base text preserved as a prefix
  });

  it('[v5.8 TASK 1] different presets get different audibleEffectTag reinforcement text (no shared boilerplate)', () => {
    const jazz = compactMoneyChord(makeOptions({ moneyChordMode: 'default' }), { moneyChordIdOverride: 'jazzColor', includeFeelReinforcement: true });
    const komuro = compactMoneyChord(makeOptions({ moneyChordMode: 'default' }), { moneyChordIdOverride: 'komuro', includeFeelReinforcement: true });
    expect(jazz).not.toBe(komuro);
    expect(jazz).toContain(moneyChordPresets.jazzColor.audibleEffectTag);
    expect(komuro).toContain(moneyChordPresets.komuro.audibleEffectTag);
  });

  it('moneyChordIdOverride bypasses opts.moneyChordMode entirely', () => {
    const opts = makeOptions({ moneyChordMode: 'jazzColor' });
    expect(compactMoneyChord(opts, { moneyChordIdOverride: 'royalRoad' })).toBe(moneyChordPresets.royalRoad.compactProgression);
  });

  it('moneyChordIdOverride + includeFeelReinforcement compose together', () => {
    const opts = makeOptions({ moneyChordMode: 'default' });
    const result = compactMoneyChord(opts, { moneyChordIdOverride: 'marusa', includeFeelReinforcement: true });
    expect(result).toContain(moneyChordPresets.marusa.compactProgression);
    expect(result).toContain(moneyChordPresets.marusa.audibleEffectTag);
  });

  it('an unrecognized override id falls back to the default preset rather than crashing', () => {
    const opts = makeOptions();
    expect(() => compactMoneyChord(opts, { moneyChordIdOverride: 'not-a-real-id' })).not.toThrow();
    expect(compactMoneyChord(opts, { moneyChordIdOverride: 'not-a-real-id' })).toBe(moneyChordPresets.default.compactProgression);
  });
});

/**
 * v5.8 (TASK 3) — detectMoneyChordPreset must disambiguate presets whose
 * compactProgression strings share a literal substring, verified directly
 * against data/moneyChords.ts's real current strings (re-read from the file
 * itself, not assumed): "vi-IV-I-V" is a substring shared by cityPop's,
 * emotional's, and winterBallad's own compactProgression text; "I-V-vi-IV"
 * is shared by default's, emotional's, winterBallad's, and kidsBright's.
 */
describe('[v5.8 TASK 3] detectMoneyChordPreset — exact match, not naive substring', () => {
  it('detects each of the 4 presets sharing the "I-V-vi-IV" substring correctly from their own full text', () => {
    expect(detectMoneyChordPreset(`some genre text, ${moneyChordPresets.default.compactProgression}, more atoms`)).toBe('default');
    expect(detectMoneyChordPreset(`some genre text, ${moneyChordPresets.emotional.compactProgression}, more atoms`)).toBe('emotional');
    expect(detectMoneyChordPreset(`some genre text, ${moneyChordPresets.winterBallad.compactProgression}, more atoms`)).toBe('winterBallad');
    expect(detectMoneyChordPreset(`some genre text, ${moneyChordPresets.kidsBright.compactProgression}, more atoms`)).toBe('kidsBright');
  });

  it('detects each of the 3 presets sharing the "vi-IV-I-V" substring correctly from their own full text', () => {
    expect(detectMoneyChordPreset(`some genre text, ${moneyChordPresets.cityPop.compactProgression}, more atoms`)).toBe('cityPop');
    expect(detectMoneyChordPreset(`some genre text, ${moneyChordPresets.emotional.compactProgression}, more atoms`)).toBe('emotional');
    expect(detectMoneyChordPreset(`some genre text, ${moneyChordPresets.winterBallad.compactProgression}, more atoms`)).toBe('winterBallad');
  });

  it('a prompt with ONLY the bare shared numeral run, none of any preset\'s full compactProgression text, returns null rather than guessing', () => {
    expect(detectMoneyChordPreset('some genre text, vi-IV-I-V, more atoms')).toBeNull();
    expect(detectMoneyChordPreset('some genre text, I-V-vi-IV, more atoms')).toBeNull();
  });

  it('detects a preset embedded inside a real, longer style-prompt-shaped string, not just in isolation', () => {
    const prompt = `warm nostalgic pop, soft acoustic guitar, ${moneyChordPresets.winterBallad.compactProgression}, 92 BPM, short intro`;
    expect(detectMoneyChordPreset(prompt)).toBe('winterBallad');
  });

  it('returns null for text containing no recognizable money-chord progression at all', () => {
    expect(detectMoneyChordPreset('warm nostalgic pop, soft acoustic guitar, 92 BPM')).toBeNull();
  });

  it('never matches "custom" — custom has no fixed compactProgression to detect', () => {
    expect(detectMoneyChordPreset(`custom progression ${moneyChordPresets.custom.compactProgression}`)).not.toBe('custom');
  });

  it('every real preset id (except custom) is independently detectable from its own compactProgression alone', () => {
    for (const [id, preset] of Object.entries(moneyChordPresets)) {
      if (id === 'custom') continue;
      expect(detectMoneyChordPreset(preset.compactProgression), `preset ${id}`).toBe(id);
    }
  });
});
