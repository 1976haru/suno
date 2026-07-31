import { describe, expect, it } from 'vitest';
import { GENRE_FAMILIES, familiesBlendWell, getGenreFamilyById, membersPerFamilyForSelection } from '../src/data/genreFamilies';
import { getGenreById } from '../src/data/genreLibrary';

describe('[v3.63 TASK B] genre families', () => {
  it('defines at least 8 families, each with a real, resolvable member list', () => {
    expect(GENRE_FAMILIES.length).toBeGreaterThanOrEqual(8);
    for (const family of GENRE_FAMILIES) {
      expect(family.memberGenreIds.length, family.id).toBeGreaterThan(0);
      for (const id of family.memberGenreIds) {
        expect(getGenreById(id), `${family.id}: ${id}`).toBeDefined();
      }
    }
  });

  it('every family id is unique', () => {
    const ids = GENRE_FAMILIES.map(family => family.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every blendsWellWith reference points at a real family id, and is never self-referential', () => {
    const ids = new Set(GENRE_FAMILIES.map(family => family.id));
    for (const family of GENRE_FAMILIES) {
      for (const target of family.blendsWellWith) {
        expect(ids.has(target), `${family.id} -> ${target}`).toBe(true);
        expect(target).not.toBe(family.id);
      }
    }
  });

  it('includes the two user-requested families by name (abba-carpenters, warm-melody)', () => {
    expect(getGenreFamilyById('abba-carpenters')?.labelKo).toBe('유로팝·소프트팝');
    expect(getGenreFamilyById('warm-melody')?.labelKo).toBe('따뜻한 멜로디');
  });

  it('membersPerFamilyForSelection matches the spec\'s per-family-count rule (5 / 4 / 3)', () => {
    expect(membersPerFamilyForSelection(1)).toBe(5);
    expect(membersPerFamilyForSelection(2)).toBe(4);
    expect(membersPerFamilyForSelection(3)).toBe(3);
    expect(membersPerFamilyForSelection(4)).toBe(3);
    // 1 and 2 families already keep the total within 4-9 on their own (5, 8);
    // 3+ families need the caller (setDirector.chooseGenreIdsFromFamilies) to
    // additionally cap the total selection at 9, since 3+ families * 3 each
    // can otherwise exceed it — covered by setDirector.test.ts, not this
    // pure per-family-count helper.
    expect(1 * membersPerFamilyForSelection(1)).toBeGreaterThanOrEqual(4);
    expect(2 * membersPerFamilyForSelection(2)).toBeLessThanOrEqual(9);
  });

  it('familiesBlendWell is symmetric and only true for a real listed pair', () => {
    expect(familiesBlendWell('abba-carpenters', 'warm-melody')).toBe(true);
    expect(familiesBlendWell('warm-melody', 'abba-carpenters')).toBe(true);
    expect(familiesBlendWell('chanson-continental', 'sixties-pop')).toBe(false);
  });
});
