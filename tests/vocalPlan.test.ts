import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KIDS_VOCAL_QUOTA,
  buildVocalPlan,
  scaleVocalQuota,
  usesVocalQuota,
  vocalDescriptionFor,
  vocalDictionLanguage,
  type VocalType
} from '../src/core/vocalPlan';

// TASK v3.38 Part B2 — permanent regression coverage for the kids-channel
// vocal-type quota system (replaces the throwaway scratch test used to
// verify this module during development).

describe('usesVocalQuota', () => {
  it('only activates for the kids channel archetype', () => {
    expect(usesVocalQuota({ channel: { archetype: 'kids' } as any })).toBe(true);
    expect(usesVocalQuota({ channel: { archetype: 'senior-morning' } as any })).toBe(false);
    expect(usesVocalQuota({ channel: { archetype: 'showa-cafe' } as any })).toBe(false);
  });
});

describe('scaleVocalQuota', () => {
  it('keeps the 6/6/6 default exact at songCount=18', () => {
    expect(scaleVocalQuota(DEFAULT_KIDS_VOCAL_QUOTA, 18)).toEqual({ male: 6, female: 6, mixed: 6 });
  });

  it('scales proportionally to a smaller songCount (9 -> 3/3/3)', () => {
    expect(scaleVocalQuota(DEFAULT_KIDS_VOCAL_QUOTA, 9)).toEqual({ male: 3, female: 3, mixed: 3 });
  });

  it('always sums to exactly songCount, even when it does not divide evenly', () => {
    for (const songCount of [1, 2, 5, 7, 10, 13, 20, 25]) {
      const quota = scaleVocalQuota(DEFAULT_KIDS_VOCAL_QUOTA, songCount);
      expect(quota.male + quota.female + quota.mixed, `songCount=${songCount}`).toBe(songCount);
      expect(quota.male, `songCount=${songCount}`).toBeGreaterThanOrEqual(0);
      expect(quota.female, `songCount=${songCount}`).toBeGreaterThanOrEqual(0);
      expect(quota.mixed, `songCount=${songCount}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('respects a non-default (adjustable-in-UI) quota ratio', () => {
    const quota = scaleVocalQuota({ male: 1, female: 1, mixed: 2 }, 8);
    expect(quota).toEqual({ male: 2, female: 2, mixed: 4 });
  });
});

describe('buildVocalPlan', () => {
  it('produces exactly 6/6/6 across 18 songs for several different seeds', () => {
    for (const seed of [1, 2, 3, 42, 1234, 99999]) {
      const plan = buildVocalPlan(DEFAULT_KIDS_VOCAL_QUOTA, 18, seed);
      const counts = { male: 0, female: 0, mixed: 0 };
      for (const type of plan) counts[type] += 1;
      expect(counts, `seed=${seed}`).toEqual({ male: 6, female: 6, mixed: 6 });
      expect(plan.length, `seed=${seed}`).toBe(18);
    }
  });

  it('never repeats the same vocal type 4 times in a row', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 42, 1234, 99999]) {
      const plan = buildVocalPlan(DEFAULT_KIDS_VOCAL_QUOTA, 18, seed);
      let run = 1;
      for (let i = 1; i < plan.length; i++) {
        run = plan[i] === plan[i - 1] ? run + 1 : 1;
        expect(run, `seed=${seed} index=${i}`).toBeLessThan(4);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const a = buildVocalPlan(DEFAULT_KIDS_VOCAL_QUOTA, 18, 7);
    const b = buildVocalPlan(DEFAULT_KIDS_VOCAL_QUOTA, 18, 7);
    expect(a).toEqual(b);
  });

  it('scales correctly at a non-18 songCount and still respects the no-4-in-a-row rule', () => {
    const plan = buildVocalPlan(DEFAULT_KIDS_VOCAL_QUOTA, 9, 5);
    const counts = { male: 0, female: 0, mixed: 0 };
    for (const type of plan) counts[type] += 1;
    expect(counts).toEqual({ male: 3, female: 3, mixed: 3 });
    let run = 1;
    for (let i = 1; i < plan.length; i++) {
      run = plan[i] === plan[i - 1] ? run + 1 : 1;
      expect(run).toBeLessThan(4);
    }
  });
});

describe('vocalDescriptionFor', () => {
  it('defaults to Korean diction when no language is given', () => {
    expect(vocalDescriptionFor('male')).toBe('bright friendly young male voice, warm and playful, clear Korean diction, bright and friendly');
    expect(vocalDescriptionFor('female')).toBe('bright cheerful female voice, gentle and clear, nursery-friendly, clear Korean diction, bright and friendly');
    expect(vocalDescriptionFor('mixed')).toBe("children's choir with a warm adult lead, call-and-response, singalong, clear Korean diction, bright and friendly");
  });

  it('adjusts the diction clause per language (korean/japanese/english)', () => {
    const expectedDiction: Record<'korean' | 'japanese' | 'english', string> = {
      korean: 'clear Korean diction, bright and friendly',
      japanese: 'clear Japanese diction, bright and friendly',
      english: 'clear English diction, bright and friendly'
    };
    const types: VocalType[] = ['male', 'female', 'mixed'];
    for (const language of Object.keys(expectedDiction) as (keyof typeof expectedDiction)[]) {
      for (const type of types) {
        expect(vocalDescriptionFor(type, language), `${type}/${language}`).toContain(expectedDiction[language]);
        expect(vocalDescriptionFor(type, language), `${type}/${language}`).toMatch(new RegExp(`, ${expectedDiction[language]}$`));
      }
    }
  });

  it('falls back to Korean diction for a language the kids channel does not offer (e.g. bilingual)', () => {
    expect(vocalDictionLanguage('bilingual')).toBe('korean');
    expect(vocalDescriptionFor('male', 'bilingual')).toBe(vocalDescriptionFor('male', 'korean'));
  });
});
