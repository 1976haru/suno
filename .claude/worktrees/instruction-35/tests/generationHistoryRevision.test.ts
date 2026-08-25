import { describe, expect, it, beforeEach } from 'vitest';
import {
  generationHistoryRevision,
  bumpGenerationHistoryRevision,
  subscribeGenerationHistoryRevision,
  resetGenerationHistoryRevisionForTests
} from '../src/core/generationHistoryRevision';

/**
 * codex 지시문 01 (TASK H) — coverage for generationHistoryRevision.ts's own
 * plain counter/subscribe API. This module is deliberately NOT IndexedDB-
 * backed (a same-session liveness signal only — see its own doc comment),
 * so it's fully unit-testable without the fake-indexeddb-style
 * infrastructure this codebase's other ledgers don't have.
 */
describe('[codex 지시문 01 TASK H] generationHistoryRevision', () => {
  beforeEach(() => {
    resetGenerationHistoryRevisionForTests();
  });

  it('starts at 0', () => {
    expect(generationHistoryRevision()).toBe(0);
  });

  it('bumping increments the counter by exactly 1', () => {
    bumpGenerationHistoryRevision();
    expect(generationHistoryRevision()).toBe(1);
    bumpGenerationHistoryRevision();
    expect(generationHistoryRevision()).toBe(2);
  });

  it('accepts an optional HistoryKind with no effect on the counter shape', () => {
    bumpGenerationHistoryRevision('title');
    bumpGenerationHistoryRevision('hook');
    bumpGenerationHistoryRevision('situation');
    bumpGenerationHistoryRevision('lyricLine');
    bumpGenerationHistoryRevision('all');
    expect(generationHistoryRevision()).toBe(5);
  });

  it('every subscriber is notified with the new revision number on bump', () => {
    const seenA: number[] = [];
    const seenB: number[] = [];
    subscribeGenerationHistoryRevision(rev => seenA.push(rev));
    subscribeGenerationHistoryRevision(rev => seenB.push(rev));

    bumpGenerationHistoryRevision();
    bumpGenerationHistoryRevision();

    expect(seenA).toEqual([1, 2]);
    expect(seenB).toEqual([1, 2]);
  });

  it('unsubscribing stops further notifications, without affecting other subscribers', () => {
    const seen: number[] = [];
    const unsubscribe = subscribeGenerationHistoryRevision(rev => seen.push(rev));
    const stillSubscribedSeen: number[] = [];
    subscribeGenerationHistoryRevision(rev => stillSubscribedSeen.push(rev));

    bumpGenerationHistoryRevision();
    unsubscribe();
    bumpGenerationHistoryRevision();

    expect(seen).toEqual([1]); // never saw the second bump
    expect(stillSubscribedSeen).toEqual([1, 2]); // unaffected by the other subscriber's unsubscribe
  });

  it('calling unsubscribe twice is a harmless no-op', () => {
    const unsubscribe = subscribeGenerationHistoryRevision(() => {});
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
  });
});
