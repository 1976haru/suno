import { describe, expect, it } from 'vitest';
import {
  isReservationExpired,
  filterActiveReservations,
  mergeReservedAvoidLists,
  type GenerationReservation
} from '../src/core/generationReservationLedger';

/**
 * codex 지시문 01 (TASK I) — coverage for generationReservationLedger.ts's
 * own pure functions (the rest is IndexedDB CRUD, same untestable-in-Node
 * limitation as every other ledger — see tests/lyricLineLedger.test.ts's
 * own doc comment). Real behavior this verifies: "같은 runId 재시도는 자신의
 * 예약과 충돌하지 않음" and "24시간 후 만료."
 */
function reservation(overrides: Partial<GenerationReservation> = {}): GenerationReservation {
  return {
    runId: 'run-a',
    workspaceId: 'senior-oldpop',
    channelId: 'channel-1',
    language: 'english',
    titles: ['Title A'],
    hooks: ['Hook A'],
    sceneSignatures: [],
    createdAt: '2026-08-06T00:00:00.000Z',
    expiresAt: '2026-08-07T00:00:00.000Z',
    ...overrides
  };
}

describe('[codex 지시문 01 TASK I] isReservationExpired', () => {
  it('is not expired before its own expiresAt', () => {
    const r = reservation({ expiresAt: '2026-08-07T00:00:00.000Z' });
    expect(isReservationExpired(r, new Date('2026-08-06T12:00:00.000Z').getTime())).toBe(false);
  });

  it('is expired exactly at and past its own expiresAt', () => {
    const r = reservation({ expiresAt: '2026-08-07T00:00:00.000Z' });
    expect(isReservationExpired(r, new Date('2026-08-07T00:00:00.000Z').getTime())).toBe(true);
    expect(isReservationExpired(r, new Date('2026-08-08T00:00:00.000Z').getTime())).toBe(true);
  });
});

describe('[codex 지시문 01 TASK I] filterActiveReservations', () => {
  const now = new Date('2026-08-06T12:00:00.000Z').getTime();

  it('includes a reservation matching channelId+language, not expired, different runId', () => {
    const all = [reservation({ runId: 'run-b' })];
    const active = filterActiveReservations(all, { channelId: 'channel-1', language: 'english', excludeRunId: 'run-a' }, now);
    expect(active).toHaveLength(1);
  });

  it('excludes a reservation for a different channel', () => {
    const all = [reservation({ channelId: 'channel-2' })];
    const active = filterActiveReservations(all, { channelId: 'channel-1', language: 'english' }, now);
    expect(active).toHaveLength(0);
  });

  it('excludes a reservation for a different language', () => {
    const all = [reservation({ language: 'korean' })];
    const active = filterActiveReservations(all, { channelId: 'channel-1', language: 'english' }, now);
    expect(active).toHaveLength(0);
  });

  it('excludes an expired reservation', () => {
    const all = [reservation({ expiresAt: '2026-08-01T00:00:00.000Z' })];
    const active = filterActiveReservations(all, { channelId: 'channel-1', language: 'english' }, now);
    expect(active).toHaveLength(0);
  });

  it('a runId\'s own retry never conflicts with its own reservation — excludeRunId filters it out', () => {
    const all = [reservation({ runId: 'run-a' })];
    const active = filterActiveReservations(all, { channelId: 'channel-1', language: 'english', excludeRunId: 'run-a' }, now);
    expect(active).toHaveLength(0);
  });

  it('without excludeRunId, every matching non-expired reservation is included (including what would be "its own")', () => {
    const all = [reservation({ runId: 'run-a' })];
    const active = filterActiveReservations(all, { channelId: 'channel-1', language: 'english' }, now);
    expect(active).toHaveLength(1);
  });
});

describe('[codex 지시문 01 TASK I] mergeReservedAvoidLists', () => {
  it('flattens titles/hooks/sceneSignatures across every reservation', () => {
    const reservations = [
      reservation({ runId: 'run-a', titles: ['A1', 'A2'], hooks: ['HA'] }),
      reservation({ runId: 'run-b', titles: ['B1'], hooks: ['HB1', 'HB2'] })
    ];
    const merged = mergeReservedAvoidLists(reservations);
    expect(merged.titles).toEqual(['A1', 'A2', 'B1']);
    expect(merged.hooks).toEqual(['HA', 'HB1', 'HB2']);
  });

  it('returns empty arrays for an empty reservation list', () => {
    const merged = mergeReservedAvoidLists([]);
    expect(merged).toEqual({ titles: [], hooks: [], sceneSignatures: [] });
  });
});
