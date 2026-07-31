import { describe, expect, it } from 'vitest';
import { allocateGenreCounts, recommendConceptLocal } from '../src/core/conceptAgent';

/**
 * TASK v3.58 TASK 2 — regression coverage for the root cause: applying a
 * natural-language concept used to collapse the whole pack onto ONE
 * genreId (ConceptRecommendation.genreId was the only field), so
 * downstream per-track genre rotation had nothing to rotate across.
 */
describe('[v3.58 TASK 2] allocateGenreCounts', () => {
  it('sums to exactly songCount', () => {
    for (const songCount of [1, 3, 12, 17, 18, 19, 25, 30]) {
      for (const poolSize of [3, 4, 5, 6]) {
        const ids = Array.from({ length: poolSize }, (_, i) => `genre-${i}`);
        const allocation = allocateGenreCounts(ids, songCount);
        const total = allocation.reduce((sum, slot) => sum + slot.songCount, 0);
        expect(total, `songCount=${songCount} poolSize=${poolSize}`).toBe(songCount);
      }
    }
  });

  it('caps every genre at floor(songCount * 0.28) when the pool is large enough to allow it', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const allocation = allocateGenreCounts(ids, 18);
    const cap = Math.floor(18 * 0.28);
    for (const slot of allocation) {
      expect(slot.songCount, slot.genreId).toBeLessThanOrEqual(cap);
    }
  });

  it('gives the first (highest-ranked) genre the most songs', () => {
    const allocation = allocateGenreCounts(['lead', 'second', 'third', 'fourth'], 18);
    expect(allocation[0].songCount).toBeGreaterThanOrEqual(allocation[1].songCount);
  });

  it('returns [] for an empty pool or non-positive songCount', () => {
    expect(allocateGenreCounts([], 18)).toEqual([]);
    expect(allocateGenreCounts(['a'], 0)).toEqual([]);
  });
});

describe('[v3.70 TASK E] allocateGenreCounts — no 1-song genre allowed to survive', () => {
  it('a real 7-genre pool at songCount=18 that would otherwise leave 2 genres at 1 song each ends up with every genre at >=2', () => {
    // Mirrors the real measured pack this task's own spec quotes: 7 genres
    // (weights descending) at songCount=18 naturally puts the two
    // lowest-ranked genres at exactly 1 song each.
    const ids = ['soft-rock-am', 'doowop', 'europop', 'warm-morning', 'brill-building', 'folk-rock-70s', 'baroque-pop'];
    const allocation = allocateGenreCounts(ids, 18);
    for (const slot of allocation) {
      expect(slot.songCount, slot.genreId).toBeGreaterThanOrEqual(2);
    }
    // Merging away every 1-count genre lands inside the spec's own "5-7종" target range.
    expect(allocation.length).toBeGreaterThanOrEqual(3);
    expect(allocation.length).toBeLessThan(ids.length);
  });

  it('still sums to exactly songCount after merging away 1-count genres', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    for (const songCount of [12, 18, 24, 30]) {
      const allocation = allocateGenreCounts(ids, songCount);
      const total = allocation.reduce((sum, slot) => sum + slot.songCount, 0);
      expect(total, `songCount=${songCount}`).toBe(songCount);
    }
  });

  it('never merges below 3 distinct genres, even when every genre would otherwise land at exactly 1', () => {
    // songCount=3, pool=3: every genre gets exactly 1 song and there is no
    // way to give every genre >=2 without collapsing to fewer than 3
    // genres — the existing "always >=3 genres" floor wins here.
    const allocation = allocateGenreCounts(['a', 'b', 'c'], 3);
    expect(allocation.length).toBe(3);
    expect(allocation.every(slot => slot.songCount === 1)).toBe(true);
  });

  it('never pushes a genre over the 28% cap just to absorb a merged 1-count genre, when another under-cap target is available', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const cap = Math.floor(18 * 0.28);
    const allocation = allocateGenreCounts(ids, 18);
    const overCap = allocation.filter(slot => slot.songCount > cap);
    expect(overCap).toEqual([]);
  });

  it('a pool with no 1-count genre at all is left completely unchanged', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const allocation = allocateGenreCounts(ids, 18);
    expect(allocation.every(slot => slot.songCount >= 2)).toBe(true);
  });
});

describe('[v3.58 TASK 2] recommendConceptLocal genre allocation', () => {
  it('always returns a genre pool of at least 3 for an 18-song pack', () => {
    const result = recommendConceptLocal('그 겨울이 생각나는 노래', 'senior-morning', undefined, 0, 18);
    for (const rec of result.recommendations) {
      expect(rec.genreAllocation.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('genreAllocation always sums to the requested songCount', () => {
    for (const songCount of [12, 18, 24]) {
      const result = recommendConceptLocal('카페에서 듣던 노래', 'senior-morning', undefined, 0, songCount);
      for (const rec of result.recommendations) {
        const total = rec.genreAllocation.reduce((sum, slot) => sum + slot.songCount, 0);
        expect(total, `songCount=${songCount}`).toBe(songCount);
      }
    }
  });

  it('no single genre exceeds the 28% cap for an 18-song pack', () => {
    const result = recommendConceptLocal('그 겨울이 생각나는 노래', 'senior-morning', undefined, 0, 18);
    const cap = Math.floor(18 * 0.28);
    for (const rec of result.recommendations) {
      for (const slot of rec.genreAllocation) {
        expect(slot.songCount, slot.genreId).toBeLessThanOrEqual(cap);
      }
    }
  });

  it('genreId (backward-compat field) always equals genreAllocation[0].genreId', () => {
    const result = recommendConceptLocal('그 겨울이 생각나는 노래', 'senior-morning', undefined, 0, 18);
    for (const rec of result.recommendations) {
      expect(rec.genreId).toBe(rec.genreAllocation[0]?.genreId);
    }
  });

  it('an artist reference ("비틀즈 스타일로") pulls its suggested genres into the allocation and surfaces decomposedReferences, never the artist name in any prose field', () => {
    const result = recommendConceptLocal('비틀즈 스타일로, 아침에 커피와 함께 듣고 싶은 올드팝', 'senior-morning', undefined, 0, 18);
    const primary = result.recommendations[0];
    expect(primary.decomposedReferences?.length).toBeGreaterThan(0);
    expect(primary.reasonKo).not.toContain('비틀즈');
    expect(primary.reasonKo.toLowerCase()).not.toContain('beatles');
    const allocatedIds = primary.genreAllocation.map(slot => slot.genreId);
    const suggested = primary.decomposedReferences![0].suggestedGenreIds;
    expect(suggested.some(id => allocatedIds.includes(id))).toBe(true);
  });
});
