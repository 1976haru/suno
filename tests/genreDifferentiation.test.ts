import { describe, expect, it } from 'vitest';
import { MODERN_CHILL_CORE_GENRE_IDS, CITY_NIGHT_CORE_GENRE_IDS, OLDPOP_LOUNGE_CORE_GENRE_IDS } from '../src/data/genreLibrary';

/**
 * codex 지시문 07 (TASK B) — real gap confirmed by investigation: no test
 * anywhere checked whether senior-oldpop's 3 sibling archetypes
 * (modern-chill/city-night/oldpop-lounge) stay meaningfully differentiated
 * from each other — a real, genuine overlap exists (alt-rnb/chill-rap/
 * neo-soul/contemporary-rnb are each shared by at least 2 of the 3), and
 * without a bound, that overlap could silently grow until the 3 archetypes
 * become interchangeable. This is a real POLICY, not a "these must never
 * share a single id" purity test — data/genreLibrary/index.ts's own real
 * doc comments already establish that some sharing (warmer R&B flavors
 * spanning "senior warm" and "2030s chill") is intentional; this test just
 * makes sure the intentional sharing stays a MINORITY of each archetype's
 * own core identity, not a majority.
 */

const ARCHETYPES: { name: string; ids: readonly string[] }[] = [
  { name: 'modern-chill', ids: MODERN_CHILL_CORE_GENRE_IDS },
  { name: 'city-night', ids: CITY_NIGHT_CORE_GENRE_IDS },
  { name: 'oldpop-lounge', ids: OLDPOP_LOUNGE_CORE_GENRE_IDS }
];

function overlapCount(a: readonly string[], b: readonly string[]): number {
  const setB = new Set(b);
  return a.filter(id => setB.has(id)).length;
}

describe('[codex 지시문 07 TASK B] senior-oldpop sibling archetype differentiation — modern-chill / city-night / oldpop-lounge', () => {
  it('every pair\'s overlap stays a real minority of the SMALLER list (<= 40%) — meaningful sharing allowed, near-duplication is not', () => {
    for (let i = 0; i < ARCHETYPES.length; i++) {
      for (let j = i + 1; j < ARCHETYPES.length; j++) {
        const a = ARCHETYPES[i];
        const b = ARCHETYPES[j];
        const overlap = overlapCount(a.ids, b.ids);
        const smaller = Math.min(a.ids.length, b.ids.length);
        const ratio = overlap / smaller;
        expect(ratio, `${a.name} vs ${b.name}: ${overlap}/${smaller} shared ids`).toBeLessThanOrEqual(0.4);
      }
    }
  });

  it('every archetype keeps a real majority (>= 50%) of its own core genre ids unique to itself, not shared with either sibling', () => {
    for (const archetype of ARCHETYPES) {
      const others = ARCHETYPES.filter(other => other.name !== archetype.name);
      const sharedWithAnyOther = new Set(archetype.ids.filter(id => others.some(other => other.ids.includes(id))));
      const uniqueRatio = 1 - sharedWithAnyOther.size / archetype.ids.length;
      expect(uniqueRatio, `${archetype.name}: shared with a sibling = ${[...sharedWithAnyOther].join(', ')}`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('no archetype is a real subset of another (each contributes at least one id no sibling has)', () => {
    for (const archetype of ARCHETYPES) {
      const others = ARCHETYPES.filter(other => other.name !== archetype.name);
      const hasUniqueId = archetype.ids.some(id => others.every(other => !other.ids.includes(id)));
      expect(hasUniqueId, `${archetype.name} has no id unique among its siblings`).toBe(true);
    }
  });
});
