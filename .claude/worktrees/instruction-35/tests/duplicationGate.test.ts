import { describe, expect, it } from 'vitest';
import { checkLyricLineOverlap, checkSceneOverlap, checkTitleHistoryCollision } from '../src/core/duplicationGate';
import type { SongIdea } from '../src/types';

/**
 * v5.22 (AXIS 1 §1-7) — pure-function coverage for the two blocking gates
 * the task spec asks for: Gate 1 (scene/title vs. cross-set history) and
 * Gate 2 (3+ exact lyric lines vs. recent history). These are the same
 * functions core/importInspection.ts's inspectImportReport wires in as its
 * `duplicationHistory` param — tested standalone here so the detection
 * logic itself is verified independent of the classifier's status/checks
 * plumbing (already covered by tests/importInspection.test.ts).
 */
function song(overrides: Partial<SongIdea> = {}): Pick<SongIdea, 'trackNo' | 'listenerSituation' | 'title' | 'lyrics' | 'hookPhrase'> {
  return {
    trackNo: 1,
    listenerSituation: '',
    title: 'Track',
    lyrics: '',
    hookPhrase: '',
    ...overrides
  };
}

describe('[v5.22 AXIS 1] checkSceneOverlap (Gate 1 — scene vs. recent-set history)', () => {
  it('flags an exact (normalized) match against recent history', () => {
    const songs = [song({ trackNo: 1, listenerSituation: 'a quiet morning at the kitchen table' })];
    const result = checkSceneOverlap(songs, ['A Quiet Morning At The Kitchen Table']);
    expect(result.blocking).toBe(true);
    expect(result.collisions).toEqual([{ trackNo: 1, situation: 'a quiet morning at the kitchen table', matchedHistoryEntry: 'A Quiet Morning At The Kitchen Table' }]);
  });

  it('does not flag a genuinely different scene', () => {
    const songs = [song({ trackNo: 1, listenerSituation: 'a rainy afternoon at the bus stop' })];
    const result = checkSceneOverlap(songs, ['a quiet morning at the kitchen table']);
    expect(result.blocking).toBe(false);
    expect(result.collisions).toEqual([]);
  });

  it('an empty listenerSituation never contributes a collision', () => {
    const songs = [song({ trackNo: 1, listenerSituation: '' })];
    const result = checkSceneOverlap(songs, ['']);
    expect(result.blocking).toBe(false);
  });

  it('flags multiple colliding tracks independently', () => {
    const songs = [
      song({ trackNo: 1, listenerSituation: 'scene one' }),
      song({ trackNo: 2, listenerSituation: 'scene two' }),
      song({ trackNo: 3, listenerSituation: 'a genuinely new scene' })
    ];
    const result = checkSceneOverlap(songs, ['scene one', 'scene two']);
    expect(result.collisions.map(c => c.trackNo)).toEqual([1, 2]);
  });
});

describe('[v5.22 AXIS 1] checkTitleHistoryCollision (Gate 1 — title vs. full history)', () => {
  it('flags an exact (normalized) title match against the channel\'s full history', () => {
    const songs = [song({ trackNo: 5, title: 'Windows Down' })];
    const result = checkTitleHistoryCollision(songs, new Set(['windows down', 'No Fixed Hour']));
    expect(result.blocking).toBe(true);
    expect(result.collisions).toEqual([{ trackNo: 5, title: 'Windows Down' }]);
  });

  it('does not flag a genuinely new title', () => {
    const songs = [song({ trackNo: 1, title: 'A Brand New Title' })];
    const result = checkTitleHistoryCollision(songs, new Set(['Windows Down', 'No Fixed Hour']));
    expect(result.blocking).toBe(false);
  });

  it('an empty history set never blocks', () => {
    const songs = [song({ trackNo: 1, title: 'Anything' })];
    expect(checkTitleHistoryCollision(songs, new Set()).blocking).toBe(false);
  });
});

describe('[v5.22 AXIS 1] checkLyricLineOverlap (Gate 2 — 3+ exact lines blocks the whole import)', () => {
  const longLine = (n: number) => `this is a sufficiently long lyric line number ${n} for testing`;

  it('1-2 matches are recorded but NOT blocking', () => {
    const songs = [song({ trackNo: 1, lyrics: `[verse]\n${longLine(1)}\n[chorus]\nHook`, hookPhrase: 'Hook' })];
    const result = checkLyricLineOverlap(songs, [longLine(1)]);
    expect(result.matches).toHaveLength(1);
    expect(result.blocking).toBe(false);
  });

  it('3+ matches across the set ARE blocking', () => {
    const songs = [
      song({ trackNo: 1, lyrics: `[verse]\n${longLine(1)}\n[chorus]\nHook`, hookPhrase: 'Hook' }),
      song({ trackNo: 2, lyrics: `[verse]\n${longLine(2)}\n[chorus]\nHook`, hookPhrase: 'Hook' }),
      song({ trackNo: 3, lyrics: `[verse]\n${longLine(3)}\n[chorus]\nHook`, hookPhrase: 'Hook' })
    ];
    const result = checkLyricLineOverlap(songs, [longLine(1), longLine(2), longLine(3)]);
    expect(result.matches).toHaveLength(3);
    expect(result.blocking).toBe(true);
  });

  it('never flags the repeated chorus hook line itself', () => {
    const hook = 'this exact hook line repeats through every single chorus tonight';
    const songs = [song({ trackNo: 1, lyrics: `[chorus]\n${hook}\n[chorus]\n${hook}`, hookPhrase: hook })];
    const result = checkLyricLineOverlap(songs, [hook]);
    expect(result.matches).toEqual([]);
  });

  it('short lines (<25 chars) never contribute, even if they match history verbatim', () => {
    const songs = [song({ trackNo: 1, lyrics: '[verse]\nshort line\n[chorus]\nHook', hookPhrase: 'Hook' })];
    const result = checkLyricLineOverlap(songs, ['short line']);
    expect(result.matches).toEqual([]);
  });
});
