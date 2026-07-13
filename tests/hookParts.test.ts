import { describe, expect, it } from 'vitest';
import { defaultHookParts } from '../src/data/hookParts';
import { composeHook, HOOK_SHAPES, hookLength, isWithinHookLengthBounds, matchHookShape } from '../src/core/lyricEngine';
import type { LyricLanguage } from '../src/types';

const LANGUAGES: LyricLanguage[] = ['english', 'korean', 'japanese'];

function poolSize(language: LyricLanguage): number {
  const parts = defaultHookParts(language);
  const imperative = parts.imperativeVerbs.length * parts.imperativeObjects.length * parts.imperativeTails.length;
  const vocative = parts.vocativeLeads.length * parts.vocativeAddressees.length;
  const nounPhrase = parts.nounModifiers.length * parts.nounObjects.length;
  const declarative = parts.declarativeStems.length * parts.declarativeTails.length;
  return imperative + vocative + nounPhrase + declarative;
}

describe('hookParts combinatorial supply (TASK X2, v3.4)', () => {
  it.each(LANGUAGES)('the raw combinatorial cross product is at least 500 per language, in %s', language => {
    expect(poolSize(language)).toBeGreaterThanOrEqual(500);
  });

  it.each(LANGUAGES)('every combinatorial hook actually generated passes the HookSpec length bounds, in %s', language => {
    const used = new Set<string>();
    // Burn through premium (max ~12/shape) to force combinatorial draws.
    for (const shape of HOOK_SHAPES) {
      for (let i = 0; i < 30; i++) {
        const hook = composeHook(i * 6151 + 7, { language, shape, usedHooks: used });
        used.add(hook.phrase);
        expect(isWithinHookLengthBounds(hook.phrase, language), `"${hook.phrase}" (len=${hookLength(hook.phrase, language)}) is out of bounds`).toBe(true);
      }
    }
  });

  it('the premium bank is exhausted before combinatorial hooks appear', () => {
    // enHookImperative has ~12 entries; the 13th unique draw for that shape
    // must come from combinatorial (matchHookShape returns null for those).
    const used = new Set<string>();
    let sawCombinatorial = false;
    let firstCombinatorialIndex = -1;
    for (let i = 0; i < 20; i++) {
      const hook = composeHook(i * 733 + 11, { language: 'english', shape: 'imperative', usedHooks: used });
      used.add(hook.phrase);
      const shape = matchHookShape(hook.phrase, 'english');
      if (shape === null && !sawCombinatorial) {
        sawCombinatorial = true;
        firstCombinatorialIndex = i;
      }
    }
    expect(sawCombinatorial, 'expected to see at least one combinatorial-origin hook after exhausting premium').toBe(true);
    // Premium imperative bank has 12 entries — combinatorial shouldn't appear before that.
    expect(firstCombinatorialIndex).toBeGreaterThanOrEqual(12);
  });

  it.each(LANGUAGES)('no combinatorial declarative hook repeats its own object phrase twice (regression for the fixed stem/tail duplication bug), in %s', language => {
    // The original combinatorial declarative design paired stems that already
    // embedded an object ("I Found My Way" / "다시 찾았어요" / "道を見つけた")
    // with a separate tail, producing "I Found My Way You" / "그 길을 길을
    // 찾았어요" / "あの道を道を見つけた" — a literal duplicated object
    // fragment. All stems were rewritten to be object-free; this asserts the
    // specific broken substrings never reappear across a large combinatorial sample.
    const badFragments: Record<LyricLanguage, string[]> = {
      english: [],
      korean: ['길을 길을', '길을 그 길을'],
      japanese: ['道を道を', '道をあの道を']
    };
    const used = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const hook = composeHook(i * 4441 + 3, { language, shape: 'declarative', usedHooks: used });
      used.add(hook.phrase);
    }
    for (const phrase of used) {
      for (const bad of badFragments[language]) {
        expect(phrase.includes(bad), `combinatorial hook "${phrase}" contains the fixed duplicate-object bug "${bad}"`).toBe(false);
      }
    }
  });
});
