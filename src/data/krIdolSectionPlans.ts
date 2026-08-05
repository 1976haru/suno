import type { SectionGenrePlan } from '../types';

/**
 * TASK K2 §6-1 — 6 SectionGenrePlan presets built on kr-idol-male's own 7
 * genres (genreLibrary/index.ts's kridolMaleGenrePacks), consumed via K1's
 * core/sectionGenrePlan.ts (composeSectionGenres) — never blendGenreTraits.
 * §3's own "구간 역할" table is the design intent behind which genre plays
 * which section: kridol-performance-trap → verse/bridge,
 * kridol-synth-dance → pre-chorus/chorus, kridol-band-crossover → chorus,
 * kridol-midtempo-rnb → verse, kridol-latin-afro → pre-chorus/chorus,
 * kridol-emotional-ballad → bridge/standalone, kridol-retro-funk →
 * chorus/standalone.
 *
 * §6-1's own P3 draft deliberately violated K1's "no 3 consecutive same
 * genre" rule (verse/pre-chorus/chorus all kridol-band-crossover) as a
 * planted mistake ("그대로 복사하지 마십시오") — fixed below by giving P3's
 * pre-chorus its own genre. A SECOND, unflagged instance of the identical
 * violation exists in P5 as literally written (chorus/bridge/outno all
 * kridol-emotional-ballad, 3 consecutive) — also fixed below, by giving P5's
 * bridge its own genre instead of reusing the ballad twice in a row.
 * Every preset below is verified against K1's validateSectionGenrePlan
 * (see the K2 report) and returns no issues.
 */

const T = 'kridol-performance-trap';
const S = 'kridol-synth-dance';
const B = 'kridol-band-crossover';
const R = 'kridol-midtempo-rnb';
const L = 'kridol-latin-afro';
const E = 'kridol-emotional-ballad';
const F = 'kridol-retro-funk';

export const KRIDOL_P1_PERFORMANCE: SectionGenrePlan = {
  transition: 'shared-spine',
  sections: [
    { sectionId: 'verse', genreId: T, presence: 'primary' },
    { sectionId: 'pre-chorus', genreId: S, presence: 'accent' },
    { sectionId: 'chorus', genreId: B, presence: 'primary' },
    { sectionId: 'bridge', genreId: T, presence: 'primary' },
    { sectionId: 'outro', genreId: B, presence: 'accent' }
  ]
};

/** §6-1 own note: bridge trades trap for a full stop into the drop rather than reusing verse's genre, so the plan actually earns 4 distinct genres instead of 3. */
export const KRIDOL_P2_DANCE: SectionGenrePlan = {
  transition: 'shared-spine',
  sections: [
    { sectionId: 'verse', genreId: R, presence: 'primary' },
    { sectionId: 'pre-chorus', genreId: L, presence: 'accent' },
    { sectionId: 'chorus', genreId: S, presence: 'primary' },
    { sectionId: 'bridge', genreId: T, presence: 'primary' },
    { sectionId: 'outro', genreId: S, presence: 'accent' }
  ]
};

/**
 * §6-1's own P3 draft: verse/pre-chorus/chorus all kridol-band-crossover —
 * 3 consecutive same genre, a K1 §4-2 violation. Fixed by giving pre-chorus
 * its own genre (kridol-retro-funk) instead.
 */
export const KRIDOL_P3_BAND: SectionGenrePlan = {
  transition: 'shared-spine',
  sections: [
    { sectionId: 'verse', genreId: B, presence: 'primary' },
    { sectionId: 'pre-chorus', genreId: F, presence: 'accent' },
    { sectionId: 'chorus', genreId: B, presence: 'primary' },
    { sectionId: 'bridge', genreId: E, presence: 'primary' },
    { sectionId: 'outro', genreId: B, presence: 'accent' }
  ]
};

export const KRIDOL_P4_RETRO: SectionGenrePlan = {
  transition: 'ramp',
  sections: [
    { sectionId: 'verse', genreId: F, presence: 'primary' },
    { sectionId: 'pre-chorus', genreId: S, presence: 'accent' },
    { sectionId: 'chorus', genreId: B, presence: 'primary' },
    { sectionId: 'bridge', genreId: R, presence: 'primary' },
    { sectionId: 'outro', genreId: F, presence: 'accent' }
  ]
};

/**
 * §6-1's own P5 draft: chorus/bridge/outro all kridol-emotional-ballad — 3
 * consecutive same genre, the same K1 §4-2 violation as the flagged P3, just
 * not called out explicitly. Fixed the same way: bridge gets its own genre
 * (kridol-band-crossover, for one big string-and-guitar swell) instead of
 * repeating the ballad a third time in a row.
 */
export const KRIDOL_P5_BALLAD: SectionGenrePlan = {
  transition: 'shared-spine',
  sections: [
    { sectionId: 'verse', genreId: E, presence: 'primary' },
    { sectionId: 'pre-chorus', genreId: R, presence: 'accent' },
    { sectionId: 'chorus', genreId: E, presence: 'primary' },
    { sectionId: 'bridge', genreId: B, presence: 'primary' },
    { sectionId: 'outro', genreId: E, presence: 'accent' }
  ]
};

export const KRIDOL_P6_CROSSOVER: SectionGenrePlan = {
  transition: 'ramp',
  sections: [
    { sectionId: 'verse', genreId: L, presence: 'primary' },
    { sectionId: 'pre-chorus', genreId: T, presence: 'accent' },
    { sectionId: 'chorus', genreId: S, presence: 'primary' },
    { sectionId: 'bridge', genreId: B, presence: 'primary' },
    { sectionId: 'outro', genreId: S, presence: 'accent' }
  ]
};

export const KRIDOL_SECTION_PLAN_PRESETS = {
  P1: KRIDOL_P1_PERFORMANCE,
  P2: KRIDOL_P2_DANCE,
  P3: KRIDOL_P3_BAND,
  P4: KRIDOL_P4_RETRO,
  P5: KRIDOL_P5_BALLAD,
  P6: KRIDOL_P6_CROSSOVER
} as const;

/**
 * §6-2 — an 18-song allocation across the 6 presets satisfying every stated
 * rule at once: 6/6 presets used (≥4 required), no preset over 6 songs,
 * P5 at exactly 3 (within the 2-3 range), and — the binding constraint —
 * average distinct-genres-per-song ≥3.5, which is only reachable if at
 * least half the presets carry 4 distinct genres rather than 3 (see the K2
 * report for the arithmetic: 3 presets at 3 distinct + 3 at 4 distinct,
 * weighted equally, lands at exactly 3.5). §6-3's transition bounds
 * (shared-spine ≥10, ramp ≤4, hard-cut ≤4) are satisfied per-song below,
 * not by the preset's own default `transition` field (a preset's default is
 * just its typical case — an actual 18-song set can override per instance,
 * same as any other preset system).
 */
export const KRIDOL_18_SONG_SET_PLAN: Array<{ preset: keyof typeof KRIDOL_SECTION_PLAN_PRESETS; transition: SectionGenrePlan['transition'] }> = [
  { preset: 'P1', transition: 'hard-cut' },
  { preset: 'P1', transition: 'hard-cut' },
  { preset: 'P1', transition: 'shared-spine' },
  { preset: 'P2', transition: 'shared-spine' },
  { preset: 'P2', transition: 'shared-spine' },
  { preset: 'P2', transition: 'shared-spine' },
  { preset: 'P3', transition: 'shared-spine' },
  { preset: 'P3', transition: 'shared-spine' },
  { preset: 'P3', transition: 'shared-spine' },
  { preset: 'P4', transition: 'ramp' },
  { preset: 'P4', transition: 'shared-spine' },
  { preset: 'P4', transition: 'shared-spine' },
  { preset: 'P5', transition: 'shared-spine' },
  { preset: 'P5', transition: 'shared-spine' },
  { preset: 'P5', transition: 'shared-spine' },
  { preset: 'P6', transition: 'ramp' },
  { preset: 'P6', transition: 'ramp' },
  { preset: 'P6', transition: 'shared-spine' }
];
