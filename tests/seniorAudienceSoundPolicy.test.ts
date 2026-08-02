import { describe, expect, it } from 'vitest';
import { SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';

/**
 * TASK v3.61 (TASK D) — "따뜻하고 잔잔한" (warm, gentle) is a sound-quality
 * request that belongs to the audience profile, not to any one genre —
 * otherwise every oldpop-* genre (TASK A) would need its own copy of
 * "warm" in its descriptors, which is exactly the kind of duplication the
 * task's own "장르에 따뜻함을 넣지 말 것" instruction warns against.
 */
describe('[v3.61 TASK D] SENIOR_AUDIENCE_PROFILE documents warmth/gentleness as audience-level policy', () => {
  it('adds the 3 new constraints without removing any existing one', () => {
    // v3.80 (TASK B-3) — 'lead vocal sits forward in the mix' relaxed to
    // 'lead vocal stays clearly audible above the arrangement' (see
    // data/audienceProfiles.ts's own doc comment on that constraint).
    for (const existing of ['clear unhurried diction', 'lead vocal stays clearly audible above the arrangement', 'warm midrange-centred mix', 'comfortable mid vocal register', 'acoustic instruments carry the arrangement']) {
      expect(SENIOR_AUDIENCE_PROFILE.constraints, existing).toContain(existing);
    }
    for (const added of ['melody moves in singable stepwise motion', 'chorus sits in a comfortable singalong range', 'arrangement leaves space between phrases']) {
      expect(SENIOR_AUDIENCE_PROFILE.constraints, added).toContain(added);
    }
  });

  it('adds the 2 new exclusions without removing any existing one', () => {
    for (const existing of ['shouted or belted high notes', 'aggressive distorted percussion', 'heavy sub bass', 'rapid syllable-dense phrasing', 'harsh bright top end', 'excessive reverb washing out the vocal']) {
      expect(SENIOR_AUDIENCE_PROFILE.exclusions, existing).toContain(existing);
    }
    for (const added of ['dense syncopation that obscures the melody', 'abrupt dynamic jumps']) {
      expect(SENIOR_AUDIENCE_PROFILE.exclusions, added).toContain(added);
    }
  });

  it('keeps tempoFloor/tempoCeiling/lyricWordRange unchanged', () => {
    expect(SENIOR_AUDIENCE_PROFILE.tempoFloor).toBe(62);
    expect(SENIOR_AUDIENCE_PROFILE.tempoCeiling).toBe(112);
    expect(SENIOR_AUDIENCE_PROFILE.lyricWordRange).toEqual([200, 250]);
  });
});
