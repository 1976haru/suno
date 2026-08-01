import type { AgeGroup, AudienceProfile } from '../types';

/**
 * TASK v3.58 (지시문 v3.58 TASK 4) — see AudienceProfile's own doc comment
 * in types.ts. Values here are deliberately data (not inlined into
 * core/localGenerator.ts) so they're adjustable without touching the
 * generation pipeline itself, per the brief's "데이터로 분리해 조정 가능하게".
 */
/**
 * TASK v3.61 (TASK D) — "따뜻한 멜로디, 잔잔한 멜로디" (warm, gentle melody) is a
 * sound-quality request, not a genre. Before this task it lived nowhere as
 * explicit, adjustable data — a doo-wop track and a quiet-storm track would
 * only both read as "warm" by coincidence of whichever descriptive text
 * each genre pack happened to be given. This profile is the single place
 * that quality is now stated explicitly, so it applies uniformly across
 * every genre a senior-morning pack draws from (including all 28 oldpop-*
 * genres) instead of needing to be re-described inside each one. The 3 new
 * constraints/2 new exclusions below are additive documentation of intent
 * consolidated here per this task's own "코드 곳곳에 흩어져 있는 기준을 이 파일에
 * 모으십시오" instruction — deliberately NOT wired into new runtime
 * enforcement (localGenerator.ts's only actual usage is
 * `audienceProfile.constraints[0]`, unchanged by this addition), since that
 * would be new generation-pipeline behavior outside this task's stated P2
 * scope of documenting the policy, not changing what's already enforced.
 */
export const SENIOR_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'senior',
  labelKo: '시니어',
  constraints: [
    'clear unhurried diction',
    'lead vocal sits forward in the mix',
    'warm midrange-centred mix',
    'comfortable mid vocal register',
    'acoustic instruments carry the arrangement',
    'melody moves in singable stepwise motion',
    'chorus sits in a comfortable singalong range',
    'arrangement leaves space between phrases'
  ],
  exclusions: [
    'shouted or belted high notes',
    'aggressive distorted percussion',
    'heavy sub bass',
    'rapid syllable-dense phrasing',
    'harsh bright top end',
    'excessive reverb washing out the vocal',
    'dense syncopation that obscures the melody',
    'abrupt dynamic jumps'
  ],
  tempoFloor: 62,
  tempoCeiling: 112,
  lyricWordRange: [200, 250],
  /** v3.73 (TASK A) — 3:10-3:35, matching core/soundSignature.ts's own compactDuration() text for this archetype and the real-listening target TASK v3.71/v3.72 already measured against. */
  songLengthSecondsRange: [190, 215],
  /**
   * v3.67 (TASK B) — real killing points need permission to bend exactly
   * these, and only at their own song's own killing-point location: a
   * semitone final-chorus lift needs 'predictable diatonic phrase
   * structure' relaxed, a harmony swell or unison re-entry needs 'abrupt
   * dynamic jumps' relaxed, a long low/high vocal landing needs 'comfortable
   * mid vocal register' relaxed. 'abrupt dynamic jumps' is the one
   * `exclusions` entry in this list — buildExcludePrompt actually drops it
   * from that one song's Suno Exclude text when relaxed (see
   * core/promptComposer.ts); the rest were never mechanically enforced
   * outside documentation/the earworm atom, so "relaxing" them just means
   * the killing-point instruction is allowed to contradict them for that
   * one song, not that anything gets removed from an exclude field.
   */
  relaxableAtPeak: [
    'comfortable mid vocal register',
    'melody moves in singable stepwise motion',
    'chorus sits in a comfortable singalong range',
    'arrangement leaves space between phrases',
    'abrupt dynamic jumps',
    'predictable diatonic phrase structure'
  ],
  /**
   * v3.67 (TASK B) — never relaxed regardless of any killing point. Six of
   * these are this task's own explicit hardExclusions list; 'dense
   * syncopation that obscures the melody' is an `exclusions` entry the task
   * spec never assigned to either list — since nothing may silently drop
   * off this profile's real exclusion set, it stays hard rather than
   * becoming relaxable by omission (see docs/v367-report.md for this
   * reconciliation).
   */
  hardExclusions: [
    'shouted or belted high notes',
    'aggressive distorted percussion',
    'heavy sub bass',
    'rapid syllable-dense phrasing',
    'harsh bright top end',
    'excessive reverb washing out the vocal',
    'dense syncopation that obscures the melody'
  ]
};

/**
 * Deliberately light-touch: general/kids channels (teens, twenties,
 * thirties-forties, all-ages, general audiences) already have their own
 * per-genre tempo ranges and forbiddenCliches working well (this task's
 * measured regressions were all on senior channels) — this profile exists
 * so audienceProfileFor() always returns something, not to change today's
 * behavior for those channels. tempoFloor/tempoCeiling span this app's
 * widest real genre tempo range (see data/presets.ts's rawGenrePacks) so it
 * never clamps a genre's own range.
 */
export const GENERAL_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'general',
  labelKo: '일반',
  constraints: [],
  exclusions: [],
  tempoFloor: 60,
  tempoCeiling: 132,
  lyricWordRange: [180, 260],
  /** v3.73 (TASK A) — a loose default (this profile spans teens/twenties/thirtiesForties/allAges/general on purpose, see this const's own doc comment) rather than a tight per-archetype target. */
  songLengthSecondsRange: [150, 250],
  relaxableAtPeak: [],
  hardExclusions: []
};

export const KIDS_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'kids',
  labelKo: '어린이',
  constraints: [],
  exclusions: [],
  tempoFloor: 92,
  tempoCeiling: 128,
  lyricWordRange: [120, 220],
  /** v3.73 (TASK A) — 1:30-2:30, per this task's own spec. */
  songLengthSecondsRange: [90, 150],
  relaxableAtPeak: [],
  hardExclusions: []
};

const AUDIENCE_PROFILE_BY_AGE_GROUP: Record<AgeGroup, AudienceProfile> = {
  seniors: SENIOR_AUDIENCE_PROFILE,
  kids: KIDS_AUDIENCE_PROFILE,
  teens: GENERAL_AUDIENCE_PROFILE,
  twenties: GENERAL_AUDIENCE_PROFILE,
  thirtiesForties: GENERAL_AUDIENCE_PROFILE,
  allAges: GENERAL_AUDIENCE_PROFILE,
  general: GENERAL_AUDIENCE_PROFILE
};

export function audienceProfileForAgeGroup(audience: AgeGroup | undefined): AudienceProfile {
  return (audience && AUDIENCE_PROFILE_BY_AGE_GROUP[audience]) || GENERAL_AUDIENCE_PROFILE;
}

/**
 * TASK v3.58 — the tempo-band quota this profile's tempoFloor/tempoCeiling
 * range is split into for an 18-song senior pack (62-78:3, 80-92:5,
 * 94-104:6, 106-112:4 — real measurement found BPM clustered into an 8-step
 * range around 92-100). Scaled proportionally for other songCounts by
 * buildTempoBandPlan (core/tempoPlan.ts); kept here, next to the profile
 * it belongs to, so it stays adjustable as data.
 */
export interface TempoBand {
  low: number;
  high: number;
  /** Proportional share of an 18-song pack, e.g. 3/18. */
  shareOf18: number;
}

export const SENIOR_TEMPO_BANDS: TempoBand[] = [
  { low: 62, high: 78, shareOf18: 3 },
  { low: 80, high: 92, shareOf18: 5 },
  { low: 94, high: 104, shareOf18: 6 },
  { low: 106, high: 112, shareOf18: 4 }
];

/**
 * TASK v3.58 — only the senior profile has a deliberate tempo-band
 * distribution defined; general/kids channels keep core/localGenerator.ts's
 * pre-existing genre-only tempo computation unchanged (this task's measured
 * regression was specifically on senior channels). Returns undefined for
 * any profile without an explicit entry, which callers treat as "no band
 * plan" (see core/tempoPlan.ts's resolveTempoWithBand fallback).
 */
export function tempoBandsForProfile(profile: AudienceProfile): TempoBand[] | undefined {
  if (profile.id === 'senior') return SENIOR_TEMPO_BANDS;
  return undefined;
}
