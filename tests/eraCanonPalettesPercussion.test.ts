import { describe, expect, it } from 'vitest';
import { ERA_CANON_PALETTES } from '../src/data/eraCanonPalettes';

/**
 * TASK v4.16 (TASK C) — real listening: tambourine appeared in 8/18 songs
 * (44%), because it's canon-british-beat's own signature instrument and
 * that palette's genres got selected often. percussionStyle tags each
 * palette's own character (brushed/light/driving) so a future palette
 * addition/edit can't silently reintroduce tambourine outside the one
 * category it's meant to signature (driving).
 */
describe('[v4.16 TASK C] eraCanonPalettes percussionStyle', () => {
  it('every palette has a percussionStyle tag', () => {
    for (const palette of ERA_CANON_PALETTES) {
      expect(['brushed', 'light', 'driving'], palette.id).toContain(palette.percussionStyle);
    }
  });

  it('tambourine only ever appears in a driving-tagged palette (§3-4 "탬버린은 driving 에만 두십시오")', () => {
    for (const palette of ERA_CANON_PALETTES) {
      const hasTambourine = palette.instrumentation.some(text => /tambourine/i.test(text));
      if (hasTambourine) expect(palette.percussionStyle, palette.id).toBe('driving');
    }
  });

  it('brushed is the largest group, driving stays the smallest (§3-2\'s own weighting: calm mostly, bright rarely)', () => {
    const counts = { brushed: 0, light: 0, driving: 0 };
    for (const palette of ERA_CANON_PALETTES) counts[palette.percussionStyle] += 1;
    expect(counts.brushed).toBeGreaterThan(counts.light);
    expect(counts.brushed).toBeGreaterThan(counts.driving);
    expect(counts.driving).toBeLessThanOrEqual(counts.light);
  });

  it('the spec\'s own §3-2 explicit mapping is respected for every palette it names', () => {
    const expected: Record<string, 'brushed' | 'light' | 'driving'> = {
      'canon-folk-duo': 'brushed',
      'canon-soft-pop-duo': 'brushed',
      'canon-country-folk': 'brushed',
      'canon-crooner-standard': 'brushed',
      'canon-piano-orchestral-ballad': 'brushed',
      'canon-warm-gentle-acoustic': 'brushed',
      'canon-soft-rock-band': 'light',
      'canon-europop-glow': 'light',
      'canon-doowop-girlgroup': 'light',
      'canon-british-beat': 'driving',
      'canon-motown-soul': 'driving',
      'canon-soulful-rnb': 'driving'
    };
    for (const [id, style] of Object.entries(expected)) {
      const palette = ERA_CANON_PALETTES.find(p => p.id === id);
      expect(palette, id).toBeDefined();
      expect(palette!.percussionStyle, id).toBe(style);
    }
  });

  it('canon-british-beat is never deleted (§7 do-not-list: "canon-british-beat 을 삭제하지 말 것")', () => {
    expect(ERA_CANON_PALETTES.some(p => p.id === 'canon-british-beat')).toBe(true);
  });
});
