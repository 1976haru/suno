import type { AgeGroup, AudienceProfile } from '../types';

/**
 * TASK v3.58 (지시문 v3.58 TASK 4) — see AudienceProfile's own doc comment
 * in types.ts. Values here are deliberately data (not inlined into
 * core/localGenerator.ts) so they're adjustable without touching the
 * generation pipeline itself, per the brief's "데이터로 분리해 조정 가능하게".
 */
export const SENIOR_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'senior',
  labelKo: '시니어',
  constraints: [
    'clear unhurried diction',
    'lead vocal sits forward in the mix',
    'warm midrange-centred mix',
    'comfortable mid vocal register',
    'acoustic instruments carry the arrangement'
  ],
  exclusions: [
    'shouted or belted high notes',
    'aggressive distorted percussion',
    'heavy sub bass',
    'rapid syllable-dense phrasing',
    'harsh bright top end',
    'excessive reverb washing out the vocal'
  ],
  tempoFloor: 62,
  tempoCeiling: 112,
  lyricWordRange: [200, 250]
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
  lyricWordRange: [180, 260]
};

export const KIDS_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'kids',
  labelKo: '어린이',
  constraints: [],
  exclusions: [],
  tempoFloor: 92,
  tempoCeiling: 128,
  lyricWordRange: [120, 220]
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
