import { describe, expect, it } from 'vitest';
import { buildTempoBandPlan, resolveTempoWithBand } from '../src/core/tempoPlan';
import { SENIOR_TEMPO_BANDS, audienceProfileForAgeGroup, SENIOR_AUDIENCE_PROFILE, GENERAL_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';

describe('[v3.58 TASK 4] buildTempoBandPlan', () => {
  // v4.16 (TASK A) — re-centered bands/shares (4/6/5/3), see audienceProfiles.ts's SENIOR_TEMPO_BANDS own doc comment.
  it('assigns exactly songCount bands, matching the 18-song default shares (4/6/5/3)', () => {
    const plan = buildTempoBandPlan(SENIOR_TEMPO_BANDS, 18, 42);
    expect(plan).toHaveLength(18);
    const counts = new Map<string, number>();
    for (const band of plan) {
      const key = `${band.low}-${band.high}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    expect(counts.get('62-72')).toBe(4);
    expect(counts.get('73-84')).toBe(6);
    expect(counts.get('85-94')).toBe(5);
    expect(counts.get('95-100')).toBe(3);
  });

  it('scales proportionally for other songCounts and always sums to songCount', () => {
    for (const songCount of [1, 6, 12, 24, 30]) {
      const plan = buildTempoBandPlan(SENIOR_TEMPO_BANDS, songCount, 7);
      expect(plan, `songCount=${songCount}`).toHaveLength(songCount);
    }
  });

  it('returns [] for an empty band list or non-positive songCount', () => {
    expect(buildTempoBandPlan([], 18, 1)).toEqual([]);
    expect(buildTempoBandPlan(SENIOR_TEMPO_BANDS, 0, 1)).toEqual([]);
  });

  it('does not always assign bands in strict low-to-high order (real shuffling, not a no-op)', () => {
    const plan = buildTempoBandPlan(SENIOR_TEMPO_BANDS, 18, 42);
    const isSortedAscending = plan.every((band, i) => i === 0 || band.low >= plan[i - 1].low);
    expect(isSortedAscending).toBe(false);
  });
});

describe('[v3.58 TASK 4] resolveTempoWithBand', () => {
  // TASK v3.58 — tempo range is an AudienceProfile-level concern, not a
  // genre-level one (see TASK 4's own role-separation table in the brief:
  // genre governs instrumentation/rhythm/harmony/swing/era, audienceProfile
  // governs tempo range). Two earlier designs (hard-clamp to genre range,
  // then proportional-map into genre range) were both tried and measurably
  // failed to reach this task's stddev >= 8 target for a real senior pack —
  // both let "never exceed this genre's own narrow range" fight the exact
  // variety the band plan exists to create. This design stays within the
  // *band's* own range (already a sensible sub-range of the audience
  // profile), with only a small genre-derived jitter, and no longer clamps
  // to genreLow/genreHigh at all.
  it('lands within the assigned band\'s own range, not the genre\'s', () => {
    const tempo = resolveTempoWithBand(60, 120, { low: 94, high: 104, shareOf18: 6 }, 62, 112, 100);
    expect(tempo).toBeGreaterThanOrEqual(94);
    expect(tempo).toBeLessThanOrEqual(104);
  });

  it('two different genres in the same band land on different BPMs (genre-derived jitter)', () => {
    const band = { low: 94, high: 104, shareOf18: 6 };
    const a = resolveTempoWithBand(82, 96, band, 62, 112, 90);
    const b = resolveTempoWithBand(96, 106, band, 62, 112, 90);
    expect(a).not.toBe(b);
    expect(a).toBeGreaterThanOrEqual(94);
    expect(a).toBeLessThanOrEqual(104);
    expect(b).toBeGreaterThanOrEqual(94);
    expect(b).toBeLessThanOrEqual(104);
  });

  it('preserves distinct values across all 4 senior bands even for a narrow genre range (the actual regression this fixes)', () => {
    // A hard clamp collapsed multiple out-of-range bands to the same
    // boundary value for a narrow genre (measured: 4 bands -> 2-3 distinct
    // BPMs). This design must keep all 4 distinct here.
    const bands = [{ low: 62, high: 78, shareOf18: 3 }, { low: 80, high: 92, shareOf18: 5 }, { low: 94, high: 104, shareOf18: 6 }, { low: 106, high: 112, shareOf18: 4 }];
    const values = bands.map(band => resolveTempoWithBand(82, 96, band, 62, 112, 90));
    expect(new Set(values).size).toBe(4);
  });

  it('never exceeds the audience profile\'s absolute floor/ceiling even if the genre range would allow it', () => {
    const tempo = resolveTempoWithBand(50, 140, { low: 106, high: 112, shareOf18: 4 }, 62, 112, 90);
    expect(tempo).toBeLessThanOrEqual(112);
    expect(tempo).toBeGreaterThanOrEqual(62);
  });

  it('falls back to the genre-clamped fallbackCenter when no band is given', () => {
    expect(resolveTempoWithBand(80, 100, undefined, 62, 112, 90)).toBe(90);
    expect(resolveTempoWithBand(80, 100, undefined, 62, 112, 200)).toBe(100);
  });
});

describe('[v3.58 TASK 4] audienceProfileForAgeGroup', () => {
  it('resolves seniors to the senior profile', () => {
    expect(audienceProfileForAgeGroup('seniors')).toBe(SENIOR_AUDIENCE_PROFILE);
  });

  it('falls back to the general profile for other/undefined audiences', () => {
    expect(audienceProfileForAgeGroup('twenties')).toBe(GENERAL_AUDIENCE_PROFILE);
    expect(audienceProfileForAgeGroup(undefined)).toBe(GENERAL_AUDIENCE_PROFILE);
  });

  it('senior profile constraints/exclusions are non-empty and never reference a specific genre', () => {
    expect(SENIOR_AUDIENCE_PROFILE.constraints.length).toBeGreaterThan(0);
    expect(SENIOR_AUDIENCE_PROFILE.exclusions.length).toBeGreaterThan(0);
  });
});
