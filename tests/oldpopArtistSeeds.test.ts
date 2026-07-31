import { describe, expect, it } from 'vitest';
import { recommendConceptLocal } from '../src/core/conceptAgent';
import { decomposeArtistReferences, decomposedReferenceDescriptors } from '../src/core/artistReferenceDecomposer';
import { genrePacks } from '../src/data/presets';
import { ARTIST_REFERENCE_SEEDS } from '../src/data/artistReferenceSeeds';
import { getCoreGenresForArchetype } from '../src/data/genreLibrary';

/**
 * TASK v3.61 (TASK C) — abba/carpenters seeds already existed (from v3.58
 * TASK 3) but suggestedGenreIds pointed at generic pre-oldpop genres
 * (adult-contemporary/piano-ballad) or, for abba/bee gees, at
 * 'disco-pop-2020s' — a modern-chill/city-night genre never in
 * senior-morning's core tier, so the suggestion was silently discarded
 * (recommendConceptLocal filters suggestedGenreIds through
 * coreGenreIds.has(id)) and "아바 같은" always fell back to a generic
 * recommendation. Updated to route to the new oldpop-* genres that
 * actually match each seed's own already-existing descriptive traits (the
 * traits themselves were untouched — only suggestedGenreIds changed).
 */
describe('[v3.61 TASK C] artist reference decomposition routes to oldpop-* genres', () => {
  it('"아바나 카펜터스 같은 노래" decomposes both references with no artist names leaked, and routes to oldpop-* genres', () => {
    const text = '아바나 카펜터스 같은 노래';
    const decomposed = decomposeArtistReferences(text);
    expect(decomposed.length).toBe(2);
    for (const ref of decomposed) {
      for (const descriptor of decomposedReferenceDescriptors(ref)) {
        expect(descriptor.toLowerCase()).not.toContain('abba');
        expect(descriptor.toLowerCase()).not.toContain('carpenters');
      }
      expect(ref.suggestedGenreIds.some(id => id.startsWith('oldpop-'))).toBe(true);
    }

    const result = recommendConceptLocal(text, 'senior-morning');
    const ids = result.recommendations[0]?.genreAllocation.map(slot => slot.genreId) ?? [];
    expect(ids.filter(id => id.startsWith('oldpop-')).length).toBeGreaterThanOrEqual(3);
  });

  it('billy joel/nat king cole/patti page are newly registered and route to oldpop-*', () => {
    for (const [text, expectedPrefix] of [
      ['빌리 조엘 같은 노래', 'oldpop-'],
      ['냇 킹 콜 같은 노래', 'oldpop-'],
      ['패티 페이지 같은 노래', 'oldpop-']
    ] as const) {
      const decomposed = decomposeArtistReferences(text);
      expect(decomposed.length, text).toBe(1);
      expect(decomposed[0].suggestedGenreIds.every(id => id.startsWith(expectedPrefix)), text).toBe(true);
    }
  });

  it('every artist reference seed\'s suggestedGenreIds resolve to a real genrePacks entry', () => {
    const allIds = new Set(genrePacks.map(g => g.id));
    for (const seed of ARTIST_REFERENCE_SEEDS) {
      for (const id of seed.suggestedGenreIds) {
        expect(allIds.has(id), `${seed.aliasPattern}: ${id}`).toBe(true);
      }
    }
  });

  // Only the Western/senior-morning-relevant seeds this task actually
  // touched need to resolve for senior-morning specifically — Japanese-artist
  // seeds (山口百恵, 松田聖子, ...) intentionally target showa-cafe/j2000s
  // instead, and eagles/fleetwood-mac's 'soft-rock' suggestion is a
  // pre-existing, unrelated case this task didn't touch.
  it('every seed this task edited/added now resolves to senior-morning\'s core tier', () => {
    const coreIds = new Set(getCoreGenresForArchetype('senior-morning').map(g => g.id));
    const editedAliasPatterns = [
      'carpenters', 'abba', 'simon and garfunkel', 'bee gees', 'stevie wonder', 'elton john', 'beach boys',
      'billy joel', 'nat king cole', 'patti page', 'beatles'
    ];
    for (const seed of ARTIST_REFERENCE_SEEDS) {
      if (!editedAliasPatterns.some(pattern => seed.aliasPattern.includes(pattern))) continue;
      expect(seed.suggestedGenreIds.some(id => coreIds.has(id)), seed.aliasPattern).toBe(true);
    }
  });

  /**
   * TASK v3.62 — v3.61 (TASK C) added oldpop-british-beat for exactly the
   * Beatles/"mid-1960s British beat pop" eraTag but never updated the
   * Beatles seed itself, so this exact concept (also v3.62's own mandatory
   * report scenario) never actually routed to it — see
   * data/artistReferenceSeeds.ts's Beatles entry.
   */
  it('"비틀즈 스타일로, 아침에 커피와 함께 듣고 싶은 올드팝" routes to oldpop-british-beat', () => {
    const text = '비틀즈 스타일로, 아침에 커피와 함께 듣고 싶은 올드팝';
    const decomposed = decomposeArtistReferences(text);
    expect(decomposed.length).toBe(1);
    expect(decomposed[0].suggestedGenreIds).toContain('oldpop-british-beat');

    const result = recommendConceptLocal(text, 'senior-morning');
    const ids = result.recommendations[0]?.genreAllocation.map(slot => slot.genreId) ?? [];
    expect(ids).toContain('oldpop-british-beat');
  });
});
