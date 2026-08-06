import { describe, expect, it } from 'vitest';
import { assignKillingPoints, KILLING_POINTS, killingPointById } from '../src/data/killingPoints';
import { buildArcPlan } from '../src/core/arcPlan';

/**
 * v3.67 (TASK A) — the killing-point dictionary and assignment logic that
 * exists because the senior audience profile's constraints/exclusions
 * (data/audienceProfiles.ts) previously banned every device a memorable
 * reference song's standout moment relies on.
 */

describe('[v3.67] KILLING_POINTS dictionary', () => {
  it('has at least 12 entries with unique ids', () => {
    expect(KILLING_POINTS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(KILLING_POINTS.map(kp => kp.id)).size).toBe(KILLING_POINTS.length);
  });

  it('every descriptor is a single short phrase, never a multi-clause sentence', () => {
    // Copied verbatim from the task spec's own dictionary (section 2-2); a
    // couple of its own descriptors run to 10-11 words, past the spec's own
    // "8단어 이내" guideline for the *concept* — this checks the real intent
    // (one short atom, no comma-joined multi-phrase, no period/semicolon),
    // not a strict word ceiling the spec's own examples don't all satisfy.
    for (const kp of KILLING_POINTS) {
      expect(kp.descriptor).not.toMatch(/[.;]|,/);
      expect(kp.descriptor.split(/\s+/).length).toBeLessThanOrEqual(12);
    }
  });

  it('killingPointById resolves a known id and returns undefined for an unknown one', () => {
    expect(killingPointById('KP-01')?.descriptor).toBeTruthy();
    expect(killingPointById('KP-does-not-exist')).toBeUndefined();
  });
});

describe('[v3.67] assignKillingPoints', () => {
  it('never assigns a killing point to a peakStrength "none" track', () => {
    const inputs = [{ peakStrength: 'none' as const }, { peakStrength: 'none' as const }];
    const assigned = assignKillingPoints(inputs, 1);
    expect(assigned).toEqual([undefined, undefined]);
  });

  it('always assigns a killing point to a "subtle" or "strong" track', () => {
    const inputs = Array.from({ length: 14 }, () => ({ peakStrength: 'subtle' as const }));
    const assigned = assignKillingPoints(inputs, 3);
    expect(assigned.every(Boolean)).toBe(true);
  });

  // TASK v5.21 (TASK C-3) — cap raised 3 -> 4 ("같은 킬링포인트 최대 4곡 (기존
  // 3곡에서 완화 가능)"), alongside STRUCTURAL_BIAS's own always-applied
  // down-weighting of KP-01 (the real over-selected killing point a live
  // pack measured at 11/18 tracks sharing "final chorus lifts a
  // semitone"-style language, combined with the winterBallad money-chord
  // preset's own identical wording — see this file's own doc comment).
  it('never assigns the same killing point to more than 4 tracks in an 18-song pack', () => {
    const arc = buildArcPlan(18);
    const inputs = arc.map(pos => ({ peakStrength: pos.peakStrength }));
    const assigned = assignKillingPoints(inputs, 11);
    const usage = new Map<string, number>();
    for (const kp of assigned) {
      if (!kp) continue;
      usage.set(kp.id, (usage.get(kp.id) ?? 0) + 1);
    }
    for (const count of usage.values()) {
      expect(count).toBeLessThanOrEqual(4);
    }
  });

  it('KP-01 (the modulation-family killing point real packs over-selected) never exceeds the "전조 계열 합계는 6곡" ceiling across a run of 18-song packs at different seeds', () => {
    const arc = buildArcPlan(18);
    const inputs = arc.map(pos => ({ peakStrength: pos.peakStrength }));
    for (let seed = 0; seed < 10; seed += 1) {
      const assigned = assignKillingPoints(inputs, seed);
      const kp01Count = assigned.filter(kp => kp?.id === 'KP-01').length;
      expect(kp01Count).toBeLessThanOrEqual(6);
    }
  });

  it('STRUCTURAL_BIAS measurably reduces KP-01\'s aggregate share without collapsing overall variety down to a new narrow subset', () => {
    // A track with no eraTag draws from the full KILLING_POINTS pool
    // unfiltered — the scenario where STRUCTURAL_BIAS is the only thing
    // deciding ties, since candidatesFor has no era-match preference to
    // apply first. Deliberately down-weights ONLY KP-01 (see this file's
    // own doc comment on why up-weighting specific alternatives instead
    // collapsed the pre-existing killing-point-variety design-gate check,
    // core/designGate.ts, down to exactly those alternatives) — KP-01's
    // lost ties spread across all 11 other ids via the existing seeded
    // rotation, so the real assertion here is "KP-01 stops dominating",
    // not "these 4 specific ids now dominate instead".
    const inputs = Array.from({ length: 40 }, () => ({ peakStrength: 'strong' as const }));
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 8; seed += 1) {
      const assigned = assignKillingPoints(inputs, seed * 997);
      for (const kp of assigned) {
        if (!kp) continue;
        counts.set(kp.id, (counts.get(kp.id) ?? 0) + 1);
      }
    }
    const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
    const kp01Share = (counts.get('KP-01') ?? 0) / total;
    // An unbiased 12-way rotation would land KP-01 near 1/12 (~8.3%); this
    // just confirms the bias keeps it well under an even share, not at some
    // exact target (the seeded rotation's own era/offset mechanics are out
    // of this test's scope).
    expect(kp01Share).toBeLessThan(1 / 12);
    // Real diversity preserved: at least 6 distinct ids actually got used
    // across this run (mirrors the design-gate's own ≥6-per-18-song-pack bar).
    expect(counts.size).toBeGreaterThanOrEqual(6);
  });

  it('prefers a killing point whose fitsEraTags matches the track\'s own eraTag', () => {
    const inputs = [{ peakStrength: 'strong' as const, eraTag: 'late-1970s European disco pop' }];
    const [assigned] = assignKillingPoints(inputs, 0);
    expect(assigned).toBeDefined();
    expect(assigned!.fitsEraTags?.some(tag => 'late-1970s European disco pop'.toLowerCase().includes(tag.toLowerCase()))).toBe(true);
  });

  it('still assigns some killing point when no genre matches any fitsEraTags (never leaves a subtle/strong track without one)', () => {
    const inputs = [{ peakStrength: 'strong' as const, eraTag: 'a wholly invented genre bucket with no matches' }];
    const [assigned] = assignKillingPoints(inputs, 0);
    expect(assigned).toBeDefined();
  });

  it('is deterministic for the same seed', () => {
    const arc = buildArcPlan(18);
    const inputs = arc.map(pos => ({ peakStrength: pos.peakStrength, eraTag: '1970s AM-gold soft rock' }));
    const first = assignKillingPoints(inputs, 42).map(kp => kp?.id);
    const second = assignKillingPoints(inputs, 42).map(kp => kp?.id);
    expect(first).toEqual(second);
  });
});
