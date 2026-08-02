import { describe, expect, it } from 'vitest';
import { assignSetCode, buildSetCode, buildSongCode, buildTakeCode, nextDailySetSequence, parseSetCode } from '../src/core/setCode';

// v3.79 (TASK D) — code-format tests: the exact literal shapes the spec
// requires (S20260802-01 / S20260802-01-T07 / S20260802-01-T07-A), plus the
// daily-sequence derivation savePack (core/library.ts) relies on.

describe('[v3.79 TASK D] setCode format', () => {
  it('builds a set code as S<YYYYMMDD>-<2-digit sequence>', () => {
    expect(buildSetCode(new Date(2026, 7, 2), 1)).toBe('S20260802-01');
    expect(buildSetCode(new Date(2026, 7, 2), 12)).toBe('S20260802-12');
  });

  it('pads a single-digit month/day into the date segment', () => {
    expect(buildSetCode(new Date(2026, 0, 5), 1)).toBe('S20260105-01');
  });

  it('builds a song code as <setCode>-T<2-digit trackNo>', () => {
    expect(buildSongCode('S20260802-01', 7)).toBe('S20260802-01-T07');
    expect(buildSongCode('S20260802-01', 18)).toBe('S20260802-01-T18');
  });

  it('builds a take code as <songCode>-<versionLabel>, versionLabel used as-is', () => {
    expect(buildTakeCode('S20260802-01-T07', 'A')).toBe('S20260802-01-T07-A');
    expect(buildTakeCode('S20260802-01-T07', 'B')).toBe('S20260802-01-T07-B');
  });

  it('parseSetCode is the inverse of buildSetCode for well-formed codes', () => {
    expect(parseSetCode('S20260802-01')).toEqual({ dateCode: '20260802', sequence: 1 });
    expect(parseSetCode('S20260802-12')).toEqual({ dateCode: '20260802', sequence: 12 });
  });

  it('parseSetCode returns null for anything malformed, missing, or pre-scheme', () => {
    expect(parseSetCode(undefined)).toBeNull();
    expect(parseSetCode(null)).toBeNull();
    expect(parseSetCode('')).toBeNull();
    expect(parseSetCode('not-a-code')).toBeNull();
    expect(parseSetCode('S2026080-01')).toBeNull(); // 7-digit date
    expect(parseSetCode('S20260802-1')).toBeNull(); // 1-digit sequence
  });
});

describe('[v3.79 TASK D] daily sequence increment', () => {
  it('two sets generated the same day get -01 then -02', () => {
    const today = new Date(2026, 7, 2);
    const first = assignSetCode(today, []);
    expect(first).toBe('S20260802-01');
    const second = assignSetCode(today, [first]);
    expect(second).toBe('S20260802-02');
    const third = assignSetCode(today, [first, second]);
    expect(third).toBe('S20260802-03');
  });

  it('a different day starts its own sequence at -01, independent of other days\' codes', () => {
    const day1 = new Date(2026, 7, 2);
    const day2 = new Date(2026, 7, 3);
    const existing = ['S20260802-01', 'S20260802-02', 'S20260802-03'];
    expect(assignSetCode(day2, existing)).toBe('S20260803-01');
  });

  it('ignores undefined/malformed entries (e.g. packs saved before this task existed) when counting', () => {
    const today = new Date(2026, 7, 2);
    const existing = [undefined, null, '', 'garbage', 'S20260802-01'] as (string | undefined | null)[];
    expect(nextDailySetSequence(today, existing)).toBe(2);
  });
});
