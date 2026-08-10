import { describe, expect, it } from 'vitest';
import { classifyClause, introSubcategory, REQUIRED_AXES_BY_POSITION, SINGLE_DECLARATION_AXES } from '../src/data/promptAxisLexicon';

/**
 * 지시문 16 (TASK B-4/B-5) — real fixture regression lock. Every clause
 * string below is copied verbatim from a real generated pack's stylePrompt
 * (20260808_oldpoplounge_60년대가생각하는올드팝명곡.json / tests/fixtures/
 * historical/20260807-60s.json), not hand-invented — this is what the axis lexicon
 * actually has to classify correctly to catch the real §1-2/§1-3 violations
 * (7 intro contradictions, 5 duplicate lead-vocal declarations).
 */
describe('[지시문 16 TASK B-4] classifyClause — real fixture clauses', () => {
  it('classifies the first clause as genre regardless of content', () => {
    expect(classifyClause('Sunshine Pop', true)).toBe('genre');
    expect(classifyClause('timeless warm morning pop', true)).toBe('genre');
  });

  it('classifies era clauses', () => {
    expect(classifyClause('late-1960s', false)).toBe('era');
    expect(classifyClause('early-1960s old-pop gentleness', false)).toBe('era');
  });

  it('classifies tempo clauses', () => {
    expect(classifyClause('69 BPM', false)).toBe('tempo');
    expect(classifyClause('65 BPM', false)).toBe('tempo');
  });

  it('classifies duration clauses', () => {
    expect(classifyClause('3:10-3:35', false)).toBe('duration');
  });

  it('classifies real lead-vocal clauses, including the T2/T6/T7 duplicate-lead bug (지시문 16 §1-3)', () => {
    expect(classifyClause('female soft head-voice lead', false)).toBe('leadVocal');
    expect(classifyClause('male and female duet', false)).toBe('leadVocal');
    // "girl-group unison lead" contains "lead" AND a backing marker — this is
    // the real duplicate-declaration bug (§1-3): a second leadVocal-shaped
    // clause alongside the real lead. Backing markers win so this classifies
    // as backingVocal, not a second leadVocal — the real fix mergeAtom (TASK
    // B-3) needs: convert to backing role rather than leaving two leads.
    expect(classifyClause('girl-group unison lead', false)).toBe('backingVocal');
  });

  it('classifies intro clauses into the right subcategory, including the exact §1-2 contradiction pair', () => {
    expect(classifyClause('cold open straight into the hook', false)).toBe('intro');
    expect(introSubcategory('cold open straight into the hook')).toBe('immediate');
    expect(classifyClause('short intro', false)).toBe('intro');
    expect(introSubcategory('short intro')).toBe('has-intro');
    expect(classifyClause('warm string ensemble swell intro texture', false)).toBe('intro');
    expect(introSubcategory('warm string ensemble swell intro texture')).toBe('has-intro');
    expect(classifyClause('no quiet fade-in — already at full level from the start', false)).toBe('intro');
    expect(introSubcategory('no quiet fade-in — already at full level from the start')).toBe('immediate');
    expect(classifyClause('no intro tag', false)).toBe('intro');
    expect(introSubcategory('no intro tag')).toBe('immediate');
  });

  it('does NOT classify an outro/hook clause as intro just because it happens to contain "a cappella" (real regression, tests/v343.test.ts)', () => {
    expect(classifyClause('final repeat of the hook sung almost a cappella as the outro tag', false)).toBe('hookDevice');
  });

  it('classifies duplicate token clauses (지시문 16 §1-4 "male male head-voice lead") as leadVocal', () => {
    expect(classifyClause('male male head-voice lead', false)).toBe('leadVocal');
  });

  it('classifies instrument clauses', () => {
    expect(classifyClause('harpsichord', false)).toBe('instrument');
    expect(classifyClause('acoustic guitar arpeggio', false)).toBe('instrument');
    expect(classifyClause('warm electric piano', false)).toBe('instrument');
  });

  it('classifies harmony/chord-progression clauses', () => {
    expect(classifyClause('I-vi-IV-V doo-wop progression', false)).toBe('harmony');
    expect(classifyClause('vi-IV-I-V to I-V-vi-IV', false)).toBe('harmony');
  });

  it('classifies arrangementDensity clauses, including a real duplicate pair ("medium arrangement" + "full arrangement, not a short cut")', () => {
    expect(classifyClause('full arrangement, not a short cut', false)).toBe('arrangementDensity');
    expect(classifyClause('medium arrangement', false)).toBe('arrangementDensity');
    expect(classifyClause('full layered arrangement with strings', false)).toBe('arrangementDensity');
  });

  it('does NOT classify a structural narrative clause that merely mentions "arrangement" in passing as arrangementDensity (real regression, tests/v343.test.ts — a multi-clause hookDeviceText value got shredded and its second half destroyed by the density replace-in-place)', () => {
    expect(classifyClause('then the full arrangement returns for the final chorus', false)).not.toBe('arrangementDensity');
    expect(classifyClause('instruments drop out completely in the bridge then return for the final chorus', false)).not.toBe('arrangementDensity');
  });

  it('classifies mix/ambience clauses', () => {
    expect(classifyClause('soft plate ambience', false)).toBe('mix');
    expect(classifyClause('narrow mono-leaning room', false)).toBe('mix');
  });

  it('classifies hook-device clauses', () => {
    expect(classifyClause('hook line double-tracked with a harmony a third above wider on every repeat', false)).toBe('hookDevice');
  });

  it('classifies structure clauses', () => {
    expect(classifyClause('short instrumental turn before the final chorus', false)).toBe('structure');
  });

  it('leaves genuinely unclassifiable decorative adjectives undefined (the "장식적 형용사" reduction target)', () => {
    expect(classifyClause('tender glow', false)).toBeUndefined();
    expect(classifyClause('sweetly nostalgic', false)).toBeUndefined();
  });
});

describe('[지시문 16 TASK B-2] axis category lists', () => {
  it('single-declaration axes match §B-2 exactly', () => {
    expect([...SINGLE_DECLARATION_AXES].sort()).toEqual(['arrangementDensity', 'duration', 'era', 'intro', 'leadVocal', 'tempo'].sort());
  });

  it('the 6 position-decidable required axes are all single-declaration axes (never genre/instrument/harmony, which need first-occurrence-by-position logic instead)', () => {
    for (const axis of REQUIRED_AXES_BY_POSITION) {
      if (axis === 'genre') continue; // multi-allowed, but always required by position (first clause)
      expect(SINGLE_DECLARATION_AXES).toContain(axis);
    }
  });
});
