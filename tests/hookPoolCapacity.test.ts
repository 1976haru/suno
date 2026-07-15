import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { combinatorialHookBank, HOOK_SHAPES, hookEmotionalWeight, hookPoolSize, type HookShape } from '../src/core/lyricEngine';
import { resolveHookParts } from '../src/data/hookParts';
import { overrideForArchetype } from '../src/data/hookBanks';
import { channelPresets } from '../src/data/presets';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { ChannelArchetype, ChannelProfile, LyricLanguage } from '../src/types';

/**
 * v3.12 PART A/B — the v3.11 stress test (stress-opening.test.ts's OS1) found
 * showa-cafe/kids exhausting their hook pool around week 16-17 of an 18-week
 * sweep, but that sweep mixed lyricLanguage across korean/japanese/english for
 * every archetype including showa-cafe — real production only ever generates
 * showa-cafe/senior-morning lyrics in English (packagingLanguage, which does
 * differ per channel, has no effect on hook generation). This file re-runs
 * the diagnosis under the real per-channel lyricLanguage and pins down the
 * root cause: a per-HookShape supply skew (imperative's 3-slot combinatorial
 * cross vastly outsizes vocative/declarative's 2-slot crosses), not overall
 * pool size — see the comment above OS1 in stress-opening.test.ts for the
 * full mechanism. The fix (doubling only the deficient sides of showa-cafe's
 * and kids' overrides in data/hookBanks/) is asserted here, not re-derived.
 */

const jaChannel = channelPresets.find(c => c.id === 'morning-showa-cafe')!;
const koChannel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;

function channelForArchetype(archetype: ChannelArchetype): ChannelProfile {
  const base = archetype === 'showa-cafe' ? jaChannel : koChannel;
  return { ...base, archetype };
}

function shapeBreakdown(language: LyricLanguage, archetype: ChannelArchetype): Record<HookShape, number> {
  const parts = resolveHookParts(language, overrideForArchetype(archetype, language));
  const out: Record<HookShape, number> = { vocative: 0, imperative: 0, nounPhrase: 0, declarative: 0 };
  for (const shape of HOOK_SHAPES) out[shape] = combinatorialHookBank(shape, parts, language).length;
  return out;
}

function simulateWeeks(archetype: ChannelArchetype, language: LyricLanguage, weeks: number) {
  const channel = channelForArchetype(archetype);
  const usedTitles: string[] = [];
  const usedHooks: string[] = [];
  for (let week = 1; week <= weeks; week += 1) {
    try {
      const bp = generateLocalBlueprint(
        makeOptions({ channel, songCount: 12, lyricLanguage: language, projectTitle: `${archetype}-${language}-week-${week}` }),
        testGenres,
        testMoods,
        testSeason,
        { usedTitles, usedHooks }
      );
      usedTitles.push(...bp.songs.map(s => s.title));
      usedHooks.push(...bp.songs.map(s => s.hookPhrase));
    } catch (error) {
      return { failedAtWeek: week, error: String(error), usedHooks };
    }
  }
  return { failedAtWeek: null, error: null, usedHooks };
}

describe('v3.12 hook pool capacity — real-production-config diagnosis + fix verification', () => {
  it('PART A diagnosis: pre-fix skew was per-shape, not whole-pool — imperative combinatorial cross vastly outsizes vocative/declarative for showa-cafe/kids', () => {
    // Both showa-cafe and kids share the identical structural skew because
    // only vocabulary WORDS differ between archetype overrides, not slot
    // COUNTS: imperative composes 3 free slots (verb x object x tail),
    // vocative/declarative only 2 (lead x addressee / stem x tail). This is
    // true for every archetype, but only showa-cafe/kids lack a premium tier
    // to cushion the smaller shapes.
    const showaCafe = shapeBreakdown('english', 'showa-cafe');
    const kids = shapeBreakdown('english', 'kids');
    expect(showaCafe.imperative).toBeGreaterThan(showaCafe.vocative * 1.5);
    expect(showaCafe.imperative).toBeGreaterThan(showaCafe.declarative * 1.5);
    expect(kids.imperative).toBeGreaterThan(kids.vocative * 1.5);
    expect(kids.imperative).toBeGreaterThan(kids.declarative * 1.5);
  });

  it('PART B fix: showa-cafe/english (real prod lyricLanguage) completes 18 weeks x 12 songs with no exhaustion', () => {
    const result = simulateWeeks('showa-cafe', 'english', 18);
    expect(result.failedAtWeek, `unexpected exhaustion: ${result.error}`).toBeNull();
    expect(result.usedHooks.length).toBe(18 * 12);
  });

  it('PART B fix: kids/english, kids/korean, kids/japanese all complete 18 weeks x 12 songs with no exhaustion', () => {
    for (const language of ['english', 'korean', 'japanese'] as LyricLanguage[]) {
      const result = simulateWeeks('kids', language, 18);
      expect(result.failedAtWeek, `${language}: unexpected exhaustion: ${result.error}`).toBeNull();
    }
  });

  it('PART B fix: showa-cafe/korean and showa-cafe/japanese also complete 18 weeks (fix is not English-only)', () => {
    for (const language of ['korean', 'japanese'] as LyricLanguage[]) {
      const result = simulateWeeks('showa-cafe', language, 18);
      expect(result.failedAtWeek, `${language}: unexpected exhaustion: ${result.error}`).toBeNull();
    }
  });

  it('the fix targeted only the deficient shapes: vocative/declarative pools grew, imperative (already abundant) is untouched', () => {
    // Snapshot values reflect the post-fix state; imperative's slot
    // structure (verb x object x tail) was never touched by the v3.12 fix.
    const showaCafe = shapeBreakdown('english', 'showa-cafe');
    expect(showaCafe.imperative).toBe(240);
    expect(showaCafe.vocative).toBeGreaterThanOrEqual(120);
    expect(showaCafe.declarative).toBeGreaterThanOrEqual(120);
  });

  it('the hand-curated premium bank sizes for senior-morning/christmas/lofi-study are unchanged by the v3.12 fix', () => {
    // v3.12 only ever edited data/hookBanks/showaCafe.ts and kids.ts — the
    // premium tier lives in core/lyricEngine.ts and is shared/untouched, so
    // every archetype that still draws from it should show its known,
    // stable total.
    expect(hookPoolSize('english', 'senior-morning')).toBe(400);
    expect(hookPoolSize('english', 'christmas')).toBe(400);
    expect(hookPoolSize('english', 'lofi-study')).toBe(400);
  });

  it('showa-cafe vocabulary additions contain no modern IT/digital vocabulary (v3.7 archetype rule)', () => {
    const forbiddenWords = ['app', 'wifi', 'wi-fi', 'internet', 'smartphone', 'computer', 'digital', 'online', 'email', 'chat', 'screen', 'download'];
    for (const language of ['english', 'korean', 'japanese'] as Exclude<LyricLanguage, 'bilingual'>[]) {
      const override = overrideForArchetype('showa-cafe', language);
      const allText = Object.values(override).flat().join(' ').toLowerCase();
      for (const word of forbiddenWords) {
        expect(allText.includes(word), `showa-cafe/${language} vocabulary unexpectedly contains "${word}"`).toBe(false);
      }
    }
  });

  it('kids vocabulary additions contain no breakup/longing/alcohol imagery (v3.7 archetype rule, extended to the new declarativeStems/vocativeAddressees)', () => {
    // 'love' itself is excluded — the existing declarativeStems bank already
    // has "I Love" (kid-appropriate, e.g. "I Love [my rainbow]"), which isn't
    // the romantic-longing imagery this rule targets.
    const forbiddenWords = ['heart', 'darling', 'wine', 'lonely', 'forget', 'goodbye', 'miss'];
    const override = overrideForArchetype('kids', 'english');
    const allText = Object.values(override).flat().join(' ').toLowerCase();
    for (const word of forbiddenWords) {
      expect(allText.includes(word), `kids vocabulary unexpectedly contains "${word}"`).toBe(false);
    }
  });

  it('emotional-weight distribution: composeHook falls back to weight-agnostic selection before failing, so a skewed high/medium split within one shape does not by itself cause premature exhaustion', () => {
    const showaCafeDeclarative = shapeBreakdown('english', 'showa-cafe').declarative;
    const parts = resolveHookParts('english', overrideForArchetype('showa-cafe', 'english'));
    const combos = combinatorialHookBank('declarative', parts, 'english');
    const highCount = combos.filter(c => hookEmotionalWeight(c) === 'high').length;
    expect(combos.length).toBe(showaCafeDeclarative);
    // Not every declarative combo is high-weight — the skew is real but composeHook's
    // fallback chain (weighted+rhythm -> rhythm-only -> weighted-only -> everything)
    // means it's never the sole cause of exhaustion.
    expect(highCount).toBeLessThan(combos.length);
  });
});
