import { describe, expect, it } from 'vitest';
import { getGenreById } from '../src/data/genreLibrary';
import { blendGenreTraits, eraDriftWarning } from '../src/core/genreBlend';

/**
 * v3.65 (TASK C-5) — the 4 validation combinations the task spec itself
 * specifies, plus focused unit tests on the axis-assignment rules and the
 * era-safety filter.
 */

describe('[v3.65 TASK C] blendGenreTraits axis assignment', () => {
  it('structureTraits, rhythmFeel (non-strong), vocalTraits, and eraTag come from the anchor', () => {
    const anchor = getGenreById('oldpop-soft-rock-am')!;
    const flavor = getGenreById('chanson')!;
    const result = blendGenreTraits(anchor, flavor, 'medium');
    expect(result.eraTag).toBe(anchor.traits!.eraTag);
    expect(result.structureTraits).toEqual(anchor.traits!.structureTraits);
    expect(result.rhythmFeel).toEqual(anchor.traits!.rhythmFeel);
    expect(result.vocalTraits).toEqual(anchor.traits!.vocalTraits);
  });

  it('harmonyTraits comes from the flavor', () => {
    const anchor = getGenreById('oldpop-soft-rock-am')!;
    const flavor = getGenreById('chanson')!;
    const result = blendGenreTraits(anchor, flavor, 'medium');
    expect(result.harmonyTraits).toEqual(flavor.traits!.harmonyTraits);
  });

  it('instrumentation is flavor-first: light=1, medium=2, strong=3 flavor items, backfilled with anchor', () => {
    const anchor = getGenreById('oldpop-soft-rock-am')!;
    const flavor = getGenreById('chanson')!;
    const light = blendGenreTraits(anchor, flavor, 'light');
    const medium = blendGenreTraits(anchor, flavor, 'medium');
    const strong = blendGenreTraits(anchor, flavor, 'strong');
    const flavorCountIn = (instrumentation: string[]) => instrumentation.filter(item => flavor.traits!.instrumentation.includes(item)).length;
    expect(flavorCountIn(light.instrumentation)).toBe(1);
    expect(flavorCountIn(medium.instrumentation)).toBe(2);
    expect(flavorCountIn(strong.instrumentation)).toBe(3);
  });

  it('rhythmFeel only mixes in one flavor item at strong strength', () => {
    const anchor = getGenreById('oldpop-soft-rock-am')!;
    const flavor = getGenreById('chanson')!;
    const light = blendGenreTraits(anchor, flavor, 'light');
    const strong = blendGenreTraits(anchor, flavor, 'strong');
    expect(light.rhythmFeel).toEqual(anchor.traits!.rhythmFeel);
    expect(strong.rhythmFeel).toContain(flavor.traits!.rhythmFeel[0]);
  });

  it('productionTraits stays anchor at light/medium, switches to flavor at strong', () => {
    const anchor = getGenreById('oldpop-soft-rock-am')!;
    const flavor = getGenreById('chanson')!;
    expect(blendGenreTraits(anchor, flavor, 'light').productionTraits).toEqual(anchor.traits!.productionTraits);
    expect(blendGenreTraits(anchor, flavor, 'medium').productionTraits).toEqual(anchor.traits!.productionTraits);
    expect(blendGenreTraits(anchor, flavor, 'strong').productionTraits).toEqual(flavor.traits!.productionTraits);
  });

  it('dynamicRange takes whichever of the two genres is calmer', () => {
    const low = getGenreById('chanson')!; // dynamicRange: 'low'
    const wide = getGenreById('oldpop-piano-ballad-70s')!; // dynamicRange: 'wide'
    expect(blendGenreTraits(low, wide, 'medium').dynamicRange).toBe('low');
    expect(blendGenreTraits(wide, low, 'medium').dynamicRange).toBe('low');
  });

  it('throws if either genre has no .traits', () => {
    const withTraits = getGenreById('chanson')!;
    const withoutTraits = { ...withTraits, id: 'no-traits-genre', traits: undefined };
    expect(() => blendGenreTraits(withoutTraits as any, withTraits, 'medium')).toThrow();
    expect(() => blendGenreTraits(withTraits, withoutTraits as any, 'medium')).toThrow();
  });
});

describe('[v3.65 TASK C-4] era-safety filter and drift warning', () => {
  it('drops a flavor instrument that is anachronistic for the anchor era, backfilling from the anchor', () => {
    const anchor = getGenreById('oldpop-doowop-harmony')!; // 1950s-60s
    const flavor = getGenreById('oldpop-light-synth-pop-warm')!; // 1980s, has "analog synth pad"
    const result = blendGenreTraits(anchor, flavor, 'medium');
    expect(result.instrumentation.some(item => item.toLowerCase().includes('synth pad'))).toBe(false);
  });

  it('eraDriftWarning fires for a 20+ year gap and is silent for a small gap', () => {
    expect(eraDriftWarning('1950s-60s doo-wop', '1980s light synth pop')).toBeDefined();
    expect(eraDriftWarning('1970s AM-gold soft rock', 'mid-20th-century French cafe pop')).toBeUndefined();
  });

  it('eraDriftWarning is silent when either era has no extractable year (e.g. "timeless")', () => {
    expect(eraDriftWarning('timeless', '1980s light synth pop')).toBeUndefined();
  });
});

describe('[v3.65 TASK C-5] validation combinations', () => {
  it('1. anchor=oldpop-soft-rock-am, flavor=chanson, medium — no era warning, accordion present', () => {
    const anchor = getGenreById('oldpop-soft-rock-am')!;
    const flavor = getGenreById('chanson')!;
    expect(eraDriftWarning(anchor.traits!.eraTag, flavor.traits!.eraTag)).toBeUndefined();
    const result = blendGenreTraits(anchor, flavor, 'medium');
    expect(result.instrumentation.some(item => item.includes('accordion'))).toBe(true);
  });

  it('2. anchor=oldpop-british-beat, flavor=bossa-cafe, light — one bossa instrument present', () => {
    const anchor = getGenreById('oldpop-british-beat')!;
    const flavor = getGenreById('bossa-cafe')!;
    const result = blendGenreTraits(anchor, flavor, 'light');
    expect(result.instrumentation.some(item => flavor.traits!.instrumentation.includes(item))).toBe(true);
  });

  it('3. anchor=oldpop-europop-glow, flavor=oldpop-motown-pop-soul, strong — production/rhythm pick up Motown flavor', () => {
    const anchor = getGenreById('oldpop-europop-glow')!;
    const flavor = getGenreById('oldpop-motown-pop-soul')!;
    const result = blendGenreTraits(anchor, flavor, 'strong');
    expect(result.productionTraits).toEqual(flavor.traits!.productionTraits);
    expect(result.rhythmFeel.some(item => flavor.traits!.rhythmFeel.includes(item))).toBe(true);
  });

  it('4. anchor=oldpop-doowop-harmony (1950s-60s), flavor=oldpop-light-synth-pop-warm (1980s), medium — era warning fires', () => {
    const anchor = getGenreById('oldpop-doowop-harmony')!;
    const flavor = getGenreById('oldpop-light-synth-pop-warm')!;
    const warning = eraDriftWarning(anchor.traits!.eraTag, flavor.traits!.eraTag);
    expect(warning).toBeDefined();
    expect(warning).toContain('시대 충돌');
  });
});
