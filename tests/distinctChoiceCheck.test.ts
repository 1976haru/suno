import { describe, expect, it } from 'vitest';
import { checkDistinctChoices } from '../src/core/distinctChoiceCheck';

/**
 * v5.23 (TASK B §2-4) — coverage for the distinctChoice advisory checks.
 * SongIdea.distinctChoice didn't exist before this task (bridge instruction
 * had 68 prohibition spots and 1 line of creative encouragement, per §0-2's
 * own audit) — these checks are the "did it actually work" signal, but
 * deliberately never blocking (see checkDistinctChoices' own doc comment).
 */
function song(trackNo: number, distinctChoice?: string) {
  return { trackNo, distinctChoice };
}

describe('[v5.23 TASK B] checkDistinctChoices', () => {
  it('flags missing distinctChoice per track, blank strings included', () => {
    const songs = [song(1, 'Chorus once'), song(2, undefined), song(3, '   ')];
    const report = checkDistinctChoices(songs);
    expect(report.missingTrackNos).toEqual([2, 3]);
    expect(report.writtenCount).toBe(1);
  });

  it('flags 2+ tracks with the same (normalized) distinctChoice', () => {
    const songs = [song(1, 'Chorus sung once'), song(2, 'Chorus sung once'), song(3, 'A different choice')];
    const report = checkDistinctChoices(songs);
    expect(report.duplicateGroups).toHaveLength(1);
    expect(report.duplicateGroups[0].trackNos).toEqual([1, 2]);
  });

  it('normalizes case/whitespace before comparing for duplicates', () => {
    const songs = [song(1, 'Chorus Once'), song(2, '  chorus   once  ')];
    const report = checkDistinctChoices(songs);
    expect(report.duplicateGroups).toHaveLength(1);
  });

  it('no false positives when every choice is genuinely distinct', () => {
    const songs = Array.from({ length: 5 }, (_, i) => song(i + 1, `Choice number ${i + 1}`));
    const report = checkDistinctChoices(songs);
    expect(report.duplicateGroups).toEqual([]);
    expect(report.missingTrackNos).toEqual([]);
  });

  it('belowWrittenTarget: 18 songs, fewer than 12 written -> true (spec\'s own literal "18곡 중 12곡 미만")', () => {
    const songs = [
      ...Array.from({ length: 10 }, (_, i) => song(i + 1, `Choice ${i + 1}`)),
      ...Array.from({ length: 8 }, (_, i) => song(11 + i, undefined))
    ];
    const report = checkDistinctChoices(songs);
    expect(report.writtenCount).toBe(10);
    expect(report.belowWrittenTarget).toBe(true);
  });

  it('belowWrittenTarget: 18 songs, exactly 12 written -> false (at the target, not below it)', () => {
    const songs = [
      ...Array.from({ length: 12 }, (_, i) => song(i + 1, `Choice ${i + 1}`)),
      ...Array.from({ length: 6 }, (_, i) => song(13 + i, undefined))
    ];
    const report = checkDistinctChoices(songs);
    expect(report.belowWrittenTarget).toBe(false);
  });

  it('scales the ratio for a non-18-song set (6 songs, 4 written -> above target)', () => {
    const songs = [
      ...Array.from({ length: 4 }, (_, i) => song(i + 1, `Choice ${i + 1}`)),
      ...Array.from({ length: 2 }, (_, i) => song(5 + i, undefined))
    ];
    const report = checkDistinctChoices(songs);
    expect(report.belowWrittenTarget).toBe(false);
  });

  it('an empty song list never divides by zero', () => {
    const report = checkDistinctChoices([]);
    expect(report.belowWrittenTarget).toBe(false);
    expect(report.totalCount).toBe(0);
  });
});
