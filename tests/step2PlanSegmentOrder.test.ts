import { describe, expect, it } from 'vitest';
import { reorderSlotsBySegment } from '../src/components/steps/Step2Plan';
import type { PreassignedSongSlot } from '../src/types';
import type { SetSegment } from '../src/core/setDirector';

/**
 * v3.63 재작성 (TASK C) — the Step2.5 "전반부·후반부로 나누기" preview toggle
 * groups each segment's tracks together instead of the engine's real
 * interleaved order. This is a display-only reorder (never touches the
 * actual SetPlan/diversityAllocations used for generation).
 */

function slot(trackNo: number, genreId: string): PreassignedSongSlot {
  return {
    trackNo,
    title: `t${trackNo}`,
    hookPhrase: '',
    songRole: 'body',
    tempo: 100,
    emotionArc: '',
    moneyChordText: '',
    genreId
  };
}

describe('[v3.63 재작성] reorderSlotsBySegment', () => {
  it('groups interleaved slots back into contiguous per-segment blocks, in segment order', () => {
    // Interleaved input: carpenters(a) / abba(b) alternating.
    const slots = [slot(1, 'a'), slot(2, 'b'), slot(3, 'a'), slot(4, 'b')];
    const segments: SetSegment[] = [
      { label: '카펜터스풍', songCount: 2, genreIds: ['a'], eraTag: 'mixed', descriptors: [] },
      { label: '아바풍', songCount: 2, genreIds: ['b'], eraTag: 'mixed', descriptors: [] }
    ];
    const result = reorderSlotsBySegment(slots, segments);
    expect(result.map(s => s.genreId)).toEqual(['a', 'a', 'b', 'b']);
    // trackNo is renumbered sequentially after reordering.
    expect(result.map(s => s.trackNo)).toEqual([1, 2, 3, 4]);
  });

  it('appends any slot whose genreId matches no segment at the end, without dropping it', () => {
    const slots = [slot(1, 'a'), slot(2, 'x'), slot(3, 'a')];
    const segments: SetSegment[] = [
      { label: '카펜터스풍', songCount: 2, genreIds: ['a'], eraTag: 'mixed', descriptors: [] }
    ];
    const result = reorderSlotsBySegment(slots, segments);
    expect(result).toHaveLength(3);
    expect(result[result.length - 1].genreId).toBe('x');
  });
});
