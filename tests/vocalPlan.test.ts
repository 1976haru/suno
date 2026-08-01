import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADULT_VOCAL_QUOTA,
  DEFAULT_KIDS_VOCAL_QUOTA,
  applyDuetSectionVocalTags,
  buildAdultVocalTraitPlan,
  buildVocalPlan,
  scaleVocalQuota,
  summarizeVocalTraitDistribution,
  usesVocalQuota,
  vocalDescriptionFor,
  vocalDictionLanguage,
  type VocalType
} from '../src/core/vocalPlan';
import {
  MALE_VOCAL_TRAIT_AXES,
  FEMALE_VOCAL_TRAIT_AXES,
  MALE_PEAK_ONLY_REGISTERS,
  MALE_REGISTER_TIMBRE_CONTRADICTIONS,
  FEMALE_REGISTER_TIMBRE_CONTRADICTIONS
} from '../src/data/vocalTraits';

// TASK v3.38 Part B2 — permanent regression coverage for the kids-channel
// vocal-type quota system (replaces the throwaway scratch test used to
// verify this module during development).

describe('usesVocalQuota', () => {
  // TASK v3.72 (TASK A) — real regression: a senior channel with no manual
  // 8-axis allocation fell through to usesVocalQuota()===false, which made
  // batchPreallocation.ts/localGenerator.ts skip per-song vocal assignment
  // entirely — a real 18-song pack measured male 18 / female 0 / duet 0,
  // every song byte-identical. Now unconditional for every archetype; a
  // manual vocalType allocation still applies on top via applyAxisAllocation
  // (unchanged), it just no longer needs to also be what TURNS ON the quota.
  it('is unconditional for every archetype, with or without a manual vocalType allocation', () => {
    expect(usesVocalQuota({ channel: { archetype: 'kids' } as any })).toBe(true);
    expect(usesVocalQuota({ channel: { archetype: 'senior-morning' } as any })).toBe(true);
    expect(usesVocalQuota({ channel: { archetype: 'showa-cafe' } as any })).toBe(true);
    expect(usesVocalQuota({
      channel: { archetype: 'senior-morning' } as any,
      diversityAllocations: [{ axis: 'vocalType', mode: 'manual', counts: { male: 6, female: 6, mixed: 6 } }]
    })).toBe(true);
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

  // TASK v3.72 (TASK A) — tightened default from "no run of 4" to "no run of
  // 3" (maxConsecutive=2), matching diversityAllocation.ts's spreadPlanByCounts
  // (the manual-allocation path already enforced this) and the completion
  // table's "같은 보컬 타입 최대 연속 ≤ 2".
  it('never repeats the same vocal type 3 times in a row by default (maxConsecutive=2)', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 42, 1234, 99999]) {
      const plan = buildVocalPlan(DEFAULT_ADULT_VOCAL_QUOTA, 18, seed);
      let run = 1;
      for (let i = 1; i < plan.length; i++) {
        run = plan[i] === plan[i - 1] ? run + 1 : 1;
        expect(run, `seed=${seed} index=${i}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('an explicit maxConsecutive parameter is honored (e.g. 3 = the old pre-v3.72 default behavior)', () => {
    for (const seed of [1, 2, 3, 42, 1234]) {
      const plan = buildVocalPlan(DEFAULT_ADULT_VOCAL_QUOTA, 18, seed, 3);
      let run = 1;
      for (let i = 1; i < plan.length; i++) {
        run = plan[i] === plan[i - 1] ? run + 1 : 1;
        expect(run, `seed=${seed}`).toBeLessThanOrEqual(3);
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
  it('defaults to Korean diction and variant 0 when no language/variantIndex is given', () => {
    expect(vocalDescriptionFor('male')).toBe('bright childlike boy voice, playful and youthful, kindergarten-age tone, clear Korean diction, bright and friendly');
    expect(vocalDescriptionFor('female')).toBe('bright childlike girl voice, sweet and clear, kindergarten-age tone, clear Korean diction, bright and friendly');
    // TASK v3.41 Part A2/D — mixed is now a 5-variant array; variant 0 is this string.
    expect(vocalDescriptionFor('mixed')).toBe("children's choir singing together, cheerful call-and-response singalong, clear Korean diction, bright and friendly");
  });

  it('never describes any vocal type as an adult voice', () => {
    const types: VocalType[] = ['male', 'female', 'mixed'];
    for (const type of types) {
      expect(vocalDescriptionFor(type, 'korean').toLowerCase()).not.toContain('adult');
      expect(vocalDescriptionFor(type, 'japanese').toLowerCase()).not.toContain('adult');
      expect(vocalDescriptionFor(type, 'english').toLowerCase()).not.toContain('adult');
    }
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

  it('[v3.63] uses mature adult descriptions when non-kids SetDirector asks for vocalType variation', () => {
    expect(vocalDescriptionFor('mixed', 'english', 0, 'senior-morning')).toContain('male and female duet');
    expect(vocalDescriptionFor('mixed', 'english', 0, 'senior-morning')).not.toContain("children's choir");
    expect(vocalDescriptionFor('male', 'english', 0, 'senior-morning')).toContain('mature warm male');
  });
});

describe('[v3.70 TASK A] applyDuetSectionVocalTags', () => {
  const T1_LYRICS = [
    '[short intro]',
    '[verse 1]',
    'line one',
    '',
    '[pre-chorus]',
    'lead in',
    '',
    '[chorus]',
    'hook line',
    '',
    '[verse 2]',
    'line two',
    '',
    '[chorus]',
    'hook line',
    '',
    '[short bridge]',
    'bridge line',
    '',
    '[final chorus]',
    'hook line'
  ].join('\n');

  it('is a no-op for every gender except "duet"', () => {
    expect(applyDuetSectionVocalTags(T1_LYRICS, undefined)).toBe(T1_LYRICS);
    expect(applyDuetSectionVocalTags(T1_LYRICS, 'male')).toBe(T1_LYRICS);
    expect(applyDuetSectionVocalTags(T1_LYRICS, 'female')).toBe(T1_LYRICS);
    expect(applyDuetSectionVocalTags(T1_LYRICS, 'mixed')).toBe(T1_LYRICS);
  });

  it('tags every section of the default (T1-shaped) template for a duet', () => {
    const tagged = applyDuetSectionVocalTags(T1_LYRICS, 'duet');
    expect(tagged).toContain('[verse 1: male vocal]');
    expect(tagged).toContain('[verse 2: female vocal]');
    expect(tagged).toContain('[pre-chorus: female vocal]');
    expect(tagged).toContain('[chorus: male and female duet]');
    expect(tagged).toContain('[short bridge: male and female call and response]');
    expect(tagged).toContain('[final chorus: male and female duet harmony]');
    // Never touches the intro tag.
    expect(tagged).toContain('[short intro]');
  });

  it('never tags the intro, regardless of whether it is instrumental', () => {
    const tagged = applyDuetSectionVocalTags(T1_LYRICS, 'duet');
    expect(tagged).not.toMatch(/\[short intro:.*\]/i);
  });

  it('recognizes the non-default structureTemplate final-chorus markers (T3 "key-lift final chorus", T5 "chorus tag")', () => {
    const t3Lyrics = '[verse 1]\na\n\n[verse 2]\nb\n\n[key-lift final chorus]\nhook';
    const t5Lyrics = '[verse 1]\na\n\n[verse 2]\nb\n\n[chorus tag]\nhook';
    expect(applyDuetSectionVocalTags(t3Lyrics, 'duet')).toContain('[key-lift final chorus: male and female duet harmony]');
    expect(applyDuetSectionVocalTags(t5Lyrics, 'duet')).toContain('[chorus tag: male and female duet harmony]');
  });

  it('recognizes the T2 "breakdown" tag as a bridge-like call-and-response moment', () => {
    const t2Lyrics = '[verse 1]\na\n\n[breakdown]\nb\n\n[final chorus]\nhook';
    expect(applyDuetSectionVocalTags(t2Lyrics, 'duet')).toContain('[breakdown: male and female call and response]');
  });

  it('leaves non-matching lines completely untouched', () => {
    const tagged = applyDuetSectionVocalTags(T1_LYRICS, 'duet');
    expect(tagged).toContain('line one');
    expect(tagged).toContain('hook line');
    expect(tagged).toContain('bridge line');
  });
});

describe('[v3.72 TASK B] buildAdultVocalTraitPlan', () => {
  const plan18: VocalType[] = buildVocalPlan(DEFAULT_ADULT_VOCAL_QUOTA, 18, 42);

  it('produces at least 12 distinct strings across an 18-song 6/6/6 pack (spec target: >= 12)', () => {
    for (const seed of [1, 2, 3, 42, 1234, 99999]) {
      const plan = buildVocalPlan(DEFAULT_ADULT_VOCAL_QUOTA, 18, seed);
      const texts = buildAdultVocalTraitPlan(plan, seed, { isSenior: false, peakFlags: plan.map(() => false) });
      expect(texts, `seed=${seed}`).toHaveLength(18);
      expect(new Set(texts).size, `seed=${seed}`).toBeGreaterThanOrEqual(12);
    }
  });

  it('never exceeds 12 words per song', () => {
    const texts = buildAdultVocalTraitPlan(plan18, 42, { isSenior: false, peakFlags: plan18.map(() => false) });
    for (const text of texts) {
      expect(text.split(/\s+/).filter(Boolean).length, text).toBeLessThanOrEqual(12);
    }
  });

  it('every duet track\'s text contains the literal word "duet" (isDuetSlot fallback, bridgeInstruction.ts)', () => {
    const texts = buildAdultVocalTraitPlan(plan18, 42, { isSenior: false, peakFlags: plan18.map(() => false) });
    plan18.forEach((type, idx) => {
      if (type === 'mixed') expect(texts[idx]).toMatch(/\bduet\b/i);
    });
  });

  it('caps register/timbre at 2 and delivery/proximity at 3 occurrences pack-wide, across both genders combined', () => {
    for (const seed of [1, 2, 3, 42, 1234, 99999]) {
      const plan = buildVocalPlan(DEFAULT_ADULT_VOCAL_QUOTA, 18, seed);
      const texts = buildAdultVocalTraitPlan(plan, seed, { isSenior: false, peakFlags: plan.map(() => false) });
      const registerCounts = new Map<string, number>();
      const timbreCounts = new Map<string, number>();
      const deliveryCounts = new Map<string, number>();
      const proximityCounts = new Map<string, number>();
      plan.forEach((type, idx) => {
        if (type === 'mixed') return;
        const axes = type === 'male' ? MALE_VOCAL_TRAIT_AXES : FEMALE_VOCAL_TRAIT_AXES;
        const text = texts[idx];
        const reg = axes.register.find(v => text.startsWith(v));
        const timb = axes.timbre.find(v => text.includes(v));
        const deliv = axes.delivery.find(v => text.includes(v));
        const prox = axes.proximity.find(v => text.includes(v));
        if (reg) registerCounts.set(reg, (registerCounts.get(reg) ?? 0) + 1);
        if (timb) timbreCounts.set(timb, (timbreCounts.get(timb) ?? 0) + 1);
        if (deliv) deliveryCounts.set(deliv, (deliveryCounts.get(deliv) ?? 0) + 1);
        if (prox) proximityCounts.set(prox, (proximityCounts.get(prox) ?? 0) + 1);
      });
      for (const [value, count] of registerCounts) expect(count, `seed=${seed} register "${value}"`).toBeLessThanOrEqual(2);
      for (const [value, count] of timbreCounts) expect(count, `seed=${seed} timbre "${value}"`).toBeLessThanOrEqual(2);
      for (const [value, count] of deliveryCounts) expect(count, `seed=${seed} delivery "${value}"`).toBeLessThanOrEqual(3);
      for (const [value, count] of proximityCounts) expect(count, `seed=${seed} proximity "${value}"`).toBeLessThanOrEqual(3);
    }
  });

  it('never produces a register/timbre contradiction (e.g. "deep chest-register lead" + "airy breath-forward tone")', () => {
    for (const seed of [1, 2, 3, 42, 1234, 99999]) {
      const plan = buildVocalPlan(DEFAULT_ADULT_VOCAL_QUOTA, 18, seed);
      const texts = buildAdultVocalTraitPlan(plan, seed, { isSenior: false, peakFlags: plan.map(() => false) });
      plan.forEach((type, idx) => {
        if (type === 'mixed') return;
        const axes = type === 'male' ? MALE_VOCAL_TRAIT_AXES : FEMALE_VOCAL_TRAIT_AXES;
        const contradictions = type === 'male' ? MALE_REGISTER_TIMBRE_CONTRADICTIONS : FEMALE_REGISTER_TIMBRE_CONTRADICTIONS;
        const text = texts[idx];
        const reg = axes.register.find(v => text.startsWith(v));
        const timb = axes.timbre.find(v => text.includes(v));
        if (!reg || !timb) return;
        const isContradiction = contradictions.some(([r, t]) => r === reg && t === timb);
        expect(isContradiction, `seed=${seed} track ${idx + 1}: "${reg}" + "${timb}"`).toBe(false);
      });
    }
  });

  it('a senior-audience track only gets a peak-only register (e.g. "bright tenor lead") when its own killing point relaxes comfortable register', () => {
    const allMale: VocalType[] = Array(10).fill('male');
    const noPeak = buildAdultVocalTraitPlan(allMale, 5, { isSenior: true, peakFlags: allMale.map(() => false) });
    for (const text of noPeak) {
      for (const peakOnly of MALE_PEAK_ONLY_REGISTERS) expect(text.startsWith(peakOnly), text).toBe(false);
    }
  });

  it('a channel defaultVocal mentioning "husky" biases toward husky-flavored traits, but the repeat cap still wins (never a hard override)', () => {
    // 10, not 20 — the timbre pool (7 entries x cap 2 = 14 capacity) must
    // stay unsaturated, or pickTraitSequence's own documented "every
    // candidate already at cap" fallback kicks in and ignores the cap
    // entirely (correct behavior for a pack bigger than any axis's pool,
    // but not what this test means to exercise).
    const manyMale: VocalType[] = Array(10).fill('male');
    const texts = buildAdultVocalTraitPlan(manyMale, 3, { isSenior: false, peakFlags: manyMale.map(() => false), channelDefaultVocal: 'soft husky male tenor' });
    const huskyHits = texts.filter(text => text.includes('husky')).length;
    // The bias makes it likely to appear at all (weight, not a filter)...
    expect(huskyHits).toBeGreaterThan(0);
    // ...but AXIS_REPEAT_CAPS.timbre (2) still bounds it — weighting can never
    // defeat the cap that keeps a pack from repeating one phrase too often.
    expect(huskyHits).toBeLessThanOrEqual(2);
  });
});

describe('[v3.72 TASK D] summarizeVocalTraitDistribution', () => {
  it('counts quota + axis distribution from resolved slots', () => {
    const plan = buildVocalPlan(DEFAULT_ADULT_VOCAL_QUOTA, 18, 42);
    const texts = buildAdultVocalTraitPlan(plan, 42, { isSenior: false, peakFlags: plan.map(() => false) });
    const slots = plan.map((type, idx) => ({ vocalType: type, vocalText: texts[idx] }));
    const dist = summarizeVocalTraitDistribution(slots);
    expect(dist.quota).toEqual({ male: 6, female: 6, mixed: 6 });
    expect(Object.values(dist.register).reduce((a, b) => a + b, 0)).toBe(12); // 6 male + 6 female, duet excluded
    expect(Object.values(dist.timbre).reduce((a, b) => a + b, 0)).toBe(12);
  });

  it('returns empty axis breakdowns for a kids pack (vocalText never matches the adult trait pools)', () => {
    const dist = summarizeVocalTraitDistribution([
      { vocalType: 'male', vocalText: 'bright childlike boy voice, playful and youthful, kindergarten-age tone' },
      { vocalType: 'female', vocalText: 'bright childlike girl voice, sweet and clear, kindergarten-age tone' }
    ]);
    expect(dist.quota).toEqual({ male: 1, female: 1, mixed: 0 });
    expect(dist.register).toEqual({});
  });
});
