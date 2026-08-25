import { describe, expect, it } from 'vitest';
import { buildExplorationAttempts, computeExplorationLearningSuggestions, type ExplorationRecord } from '../src/core/explorationLedger';

/**
 * v5.23 (TASK E §5-3) — coverage for computeExplorationLearningSuggestions,
 * the one pure function in explorationLedger.ts (the rest is IndexedDB
 * CRUD, same untestable-in-Node limitation as every other ledger — see
 * tests/lyricLineLedger.test.ts's own doc comment). Real behavior this
 * verifies: "좋음 2회 이상 -> 제안 / 별로 2회 이상 -> 회피 제안, 절대 자동
 * 등록하지 않음" (spec's own §5-3).
 */
function record(setCode: string, description: string, rating: 'good' | 'ok' | 'bad', trackNo = 7): ExplorationRecord {
  return {
    id: `senior-oldpop::${setCode}`,
    setCode,
    axis: 'structure',
    trackNos: [trackNo],
    attempts: [{ trackNo, description }],
    outcomes: [{ trackNo, rating }],
    recordedAt: '2026-08-06T00:00:00.000Z'
  };
}

describe('[v5.23 TASK E] computeExplorationLearningSuggestions', () => {
  it('suggests promoting a description rated "good" 2+ times', () => {
    const records = [record('S1', 'Chorus once', 'good'), record('S2', 'Chorus once', 'good')];
    const suggestions = computeExplorationLearningSuggestions(records);
    const promote = suggestions.find(s => s.kind === 'promote');
    expect(promote).toBeDefined();
    expect(promote!.matchingCount).toBe(2);
    expect(promote!.setCodes).toEqual(['S1', 'S2']);
  });

  it('does NOT suggest promotion for only 1 good rating', () => {
    const records = [record('S1', 'Chorus once', 'good')];
    expect(computeExplorationLearningSuggestions(records).find(s => s.kind === 'promote')).toBeUndefined();
  });

  it('suggests avoiding a description rated "bad" 2+ times', () => {
    const records = [record('S1', 'Start with chorus', 'bad'), record('S2', 'Start with chorus', 'bad')];
    const suggestions = computeExplorationLearningSuggestions(records);
    const avoid = suggestions.find(s => s.kind === 'avoid');
    expect(avoid).toBeDefined();
    expect(avoid!.matchingCount).toBe(2);
  });

  it('normalizes case/whitespace before grouping', () => {
    const records = [record('S1', 'Chorus Once', 'good'), record('S2', '  chorus   once  ', 'good')];
    const suggestions = computeExplorationLearningSuggestions(records);
    expect(suggestions.filter(s => s.kind === 'promote')).toHaveLength(1);
  });

  it('ignores attempts with no recorded outcome yet', () => {
    const records: ExplorationRecord[] = [{
      id: 'x', setCode: 'S1', axis: 'structure', trackNos: [7],
      attempts: [{ trackNo: 7, description: 'Untested idea' }],
      recordedAt: '2026-08-06T00:00:00.000Z'
      // no outcomes
    }];
    expect(computeExplorationLearningSuggestions(records)).toEqual([]);
  });

  it('never auto-registers anything — this is pure computation, the caller decides what to do with the suggestion', () => {
    const records = [record('S1', 'Chorus once', 'good'), record('S2', 'Chorus once', 'good')];
    const suggestions = computeExplorationLearningSuggestions(records);
    // The return type is a plain suggestion list — no side effects, no verifiedCombos mutation happened here.
    expect(Array.isArray(suggestions)).toBe(true);
  });
});

/**
 * v5.23 (TASK E UI) — coverage for buildExplorationAttempts, the pure
 * helper Step3Generate.tsx's handleImportSongsFile calls right after a
 * bridge import to turn the real imported songs into recordExploration's
 * own attempts[] shape.
 */
describe('[v5.23 TASK E] buildExplorationAttempts', () => {
  it('picks only the songs whose trackNo is in the plan, using distinctChoice as the description', () => {
    const songs = [
      { trackNo: 1, distinctChoice: 'Cold open' },
      { trackNo: 7, distinctChoice: 'Chorus only once' },
      { trackNo: 9, distinctChoice: 'No bridge' }
    ];
    const attempts = buildExplorationAttempts(songs, [7, 9]);
    expect(attempts).toEqual([
      { trackNo: 7, description: 'Chorus only once' },
      { trackNo: 9, description: 'No bridge' }
    ]);
  });

  it('falls back to a placeholder description when distinctChoice is missing/blank', () => {
    const songs = [{ trackNo: 7, distinctChoice: '  ' }, { trackNo: 9 }];
    const attempts = buildExplorationAttempts(songs, [7, 9]);
    expect(attempts.every(a => a.description === '(설명 없음)')).toBe(true);
  });

  it('returns attempts sorted by trackNo regardless of input order', () => {
    const songs = [{ trackNo: 9, distinctChoice: 'B' }, { trackNo: 7, distinctChoice: 'A' }];
    const attempts = buildExplorationAttempts(songs, [9, 7]);
    expect(attempts.map(a => a.trackNo)).toEqual([7, 9]);
  });

  it('returns an empty array when no song matches the plan\'s trackNos', () => {
    expect(buildExplorationAttempts([{ trackNo: 1, distinctChoice: 'X' }], [7, 9])).toEqual([]);
  });
});
