import type { SongIdea } from '../types';

/**
 * v5.23 (TASK B §2-4) — advisory-only checks for SongIdea.distinctChoice
 * (see that field's own doc comment for the real problem it closes).
 * Deliberately never blocking, and never folded into ImportStatus/
 * ImportCheckLine's 'blocked' bucket — this task's own explicit "blocking
 *으로 만들지 마십시오. 강제하면 형식적인 답이 나옵니다": forcing a creative
 * field to unblock a save just produces a rubber-stamp non-answer, which
 * defeats the field's whole purpose.
 */

export interface DistinctChoiceReport {
  /** trackNos with no distinctChoice at all (undefined or blank). */
  missingTrackNos: number[];
  /** Groups of 2+ trackNos that wrote the same (normalized) distinctChoice — the real "다른 척만 하는" case this task's own §2-2 warns about. */
  duplicateGroups: { value: string; trackNos: number[] }[];
  /** How many songs actually wrote a non-blank distinctChoice. */
  writtenCount: number;
  totalCount: number;
  /** Spec's own "18곡 중 12곡 미만 작성" — scaled to whatever totalCount actually is (12/18 ≈ 2/3). */
  belowWrittenTarget: boolean;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Pure — same "no IndexedDB, no side effects" convention as core/duplicationGate.ts's own checks. */
export function checkDistinctChoices(songs: Pick<SongIdea, 'trackNo' | 'distinctChoice'>[]): DistinctChoiceReport {
  const missingTrackNos: number[] = [];
  const byValue = new Map<string, number[]>();

  for (const song of songs) {
    const value = song.distinctChoice?.trim();
    if (!value) {
      missingTrackNos.push(song.trackNo);
      continue;
    }
    const key = normalize(value);
    const trackNos = byValue.get(key) ?? [];
    trackNos.push(song.trackNo);
    byValue.set(key, trackNos);
  }

  const duplicateGroups = Array.from(byValue.entries())
    .filter(([, trackNos]) => trackNos.length > 1)
    .map(([value, trackNos]) => ({ value, trackNos: trackNos.sort((a, b) => a - b) }));

  const writtenCount = songs.length - missingTrackNos.length;
  // Spec's own literal "18곡 중 12곡 미만" ratio, scaled to the real songCount (12/18 = 2/3).
  const belowWrittenTarget = songs.length > 0 && writtenCount / songs.length < 12 / 18;

  return { missingTrackNos, duplicateGroups, writtenCount, totalCount: songs.length, belowWrittenTarget };
}
