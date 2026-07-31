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

  it('never assigns the same killing point to more than 3 tracks in an 18-song pack', () => {
    const arc = buildArcPlan(18);
    const inputs = arc.map(pos => ({ peakStrength: pos.peakStrength }));
    const assigned = assignKillingPoints(inputs, 11);
    const usage = new Map<string, number>();
    for (const kp of assigned) {
      if (!kp) continue;
      usage.set(kp.id, (usage.get(kp.id) ?? 0) + 1);
    }
    for (const count of usage.values()) {
      expect(count).toBeLessThanOrEqual(3);
    }
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
