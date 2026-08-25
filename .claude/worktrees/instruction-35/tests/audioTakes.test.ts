import { describe, expect, it } from 'vitest';
import { buildTakeDirectives } from '../src/core/audioTakes';
import { SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';

// TASK v3.74 (TASK A) — only buildTakeDirectives (pure) is unit tested here.
// recordTake/getTakes/setAdopted are thin IndexedDB wrappers (same shape as
// core/ratingLedger.ts's own untested-by-unit-test openDb/withStore pair),
// exercised indirectly through real browser use — see docs/v374-report.md.

describe('[v3.74 TASK A] buildTakeDirectives', () => {
  it('snapshots the measurable directive fields from a saved song + this channel\'s audience profile', () => {
    const song = { genreId: 'jazz-pop', killingPointId: 'KP-01', arcPhase: 'peak', vocalType: 'male' as const, bpm: 96 };
    const directives = buildTakeDirectives(song, SENIOR_AUDIENCE_PROFILE);
    expect(directives.genreId).toBe('jazz-pop');
    expect(directives.killingPointId).toBe('KP-01');
    expect(directives.arcPhase).toBe('peak');
    expect(directives.vocalType).toBe('male');
    expect(directives.targetBpm).toBe(96);
    expect(directives.targetDurationSec).toEqual(SENIOR_AUDIENCE_PROFILE.songLengthSecondsRange);
    expect(directives.instrumentAtoms).toEqual([]);
    expect(directives.introMode).toBeUndefined();
  });

  it('falls back to "unknown" rather than throwing for a song missing genreId/vocalType', () => {
    const directives = buildTakeDirectives({ bpm: 90 }, SENIOR_AUDIENCE_PROFILE);
    expect(directives.genreId).toBe('unknown');
    expect(directives.vocalType).toBe('unknown');
  });

  it('accepts optional instrumentAtoms/introMode overrides when the caller still has the original slot', () => {
    const song = { genreId: 'jazz-pop', vocalType: 'female' as const, bpm: 90 };
    const directives = buildTakeDirectives(song, SENIOR_AUDIENCE_PROFILE, { instrumentAtoms: ['piano', 'brushed drums'], introMode: 'instrumental' });
    expect(directives.instrumentAtoms).toEqual(['piano', 'brushed drums']);
    expect(directives.introMode).toBe('instrumental');
  });
});
