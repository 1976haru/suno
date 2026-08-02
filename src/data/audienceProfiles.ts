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
/**
 * v3.80 (TASK B-3) — real listening feedback: 'lead vocal sits forward in
 * the mix' was pushing every song toward the exact "dry and forward"/
 * "intimate close-mic" proximity that reads as generic modern-playlist
 * production (see PROXIMITY_POOL's own doc comment in data/vocalTraits.ts —
 * the one track 하루님 singled out as best had `soft plate ambience`, the
 * opposite of "forward"). The actual senior-audience need is intelligibility
 * (the vocal must stay clearly readable over the arrangement), not physical
 * mic distance — those are different constraints, and only the former was
 * ever the real requirement. Relaxed to name the intelligibility goal
 * directly so era-signature proximity values (plate/chamber/tape-slap/mono)
 * are no longer implicitly excluded. 'excessive reverb washing out the
 * vocal' (hardExclusions, below) is UNCHANGED — it still bans the failure
 * mode this constraint was actually guarding against.
 */
export const SENIOR_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'senior',
  labelKo: '시니어',
  constraints: [
    'clear unhurried diction',
    'lead vocal stays clearly audible above the arrangement',
    'warm midrange-centred mix',
    'comfortable mid vocal register',
    'acoustic instruments carry the arrangement',
    'melody moves in singable stepwise motion',
    'chorus sits in a comfortable singalong range',
    'arrangement leaves space between phrases'
  ],
  /**
   * v3.80 (TASK D-3) — "shouted or belted high notes" bans FORCED, pushed
   * chest-voice highs (loud belting). It does NOT ban falsetto or head
   * voice — those are a quieter, lower-effort register, not belting, and
   * MALE_HIGH_OR_FALSETTO_REGISTERS' falsetto/head-voice entries in
   * data/vocalTraits.ts are deliberately kept OUT of MALE_PEAK_ONLY_REGISTERS
   * for exactly this reason (see that file's own doc comment). This is the
   * key distinction this task's spec calls out ("이것이 핵심입니다").
   */
  exclusions: [
    'shouted or belted high notes',
    'aggressive distorted percussion',
    'heavy sub bass',
    'rapid syllable-dense phrasing',
    'harsh bright top end',
    'excessive reverb washing out the vocal',
    'dense syncopation that obscures the melody',
    'abrupt dynamic jumps',
    // v3.80 (TASK B-3) — 'excessive reverb washing out the vocal' bans a
    // vocal drowned by reverb; this separately bans a specific ambience
    // character (a huge hall/cathedral tail) regardless of whether it
    // drowns the vocal — the two are independent risks, so neither
    // replaces the other.
    'cavernous hall reverb'
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
  // v3.80 (TASK D-3) — 'shouted or belted high notes' bans forced, pushed
  // chest-voice highs only; falsetto and head voice are NOT belting (see
  // the `exclusions` array's own doc comment above for the full reasoning).
  hardExclusions: [
    'shouted or belted high notes',
    'aggressive distorted percussion',
    'heavy sub bass',
    'rapid syllable-dense phrasing',
    'harsh bright top end',
    'excessive reverb washing out the vocal',
    'dense syncopation that obscures the melody',
    // v3.80 (TASK B-3) — see `exclusions` array's own comment on why this
    // is independent of 'excessive reverb washing out the vocal'.
    'cavernous hall reverb'
  ],
  /** v4.2 (TASK A3) — the only profile fully wired end-to-end; see AudienceProfile's own doc comment for what these ids/sets do and don't do yet. */
  killingPointSetId: 'senior-oldpop-default',
  arcModelId: 'five-phase',
  structureTemplateSetId: 'adult-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: ['1960s-youth', '1970s-domestic', 'seasonal', 'emotional'],
  /**
   * v4.1 (TASK B) — real per-language lyric targets (core/lyricMetrics.ts's
   * measureLyrics). ESTIMATES, not yet calibrated against a real generated
   * set per language — this task's own spec gives these as starting points,
   * with actual calibration explicitly deferred to v4.2. English's
   * primaryRange narrows this profile's pre-existing lyricWordRange
   * ([200,250]) to the tighter 215-230 the spec names; syllableRange is
   * derived from that word range at ~1.3 syllables/word (not independently
   * measured). Korean/Japanese ranges are copied directly from the spec's
   * own table. bilingual has no real data yet, so it reuses English's
   * range rather than inventing one.
   */
  lyricMetricsByLanguage: {
    english: { primaryRange: [215, 230], syllableRange: [280, 300] },
    korean: { primaryRange: [150, 180], syllableRange: [350, 450] },
    japanese: { primaryRange: [400, 520], syllableRange: [400, 520] },
    bilingual: { primaryRange: [215, 230], syllableRange: [280, 300] }
  }
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
  hardExclusions: [],
  killingPointSetId: 'senior-oldpop-default',
  arcModelId: 'five-phase',
  structureTemplateSetId: 'adult-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: []
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
  hardExclusions: [],
  killingPointSetId: 'senior-oldpop-default',
  arcModelId: 'repetition-cycle',
  structureTemplateSetId: 'adult-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: []
};

/**
 * v4.2 (TASK A3, TASK E) — skeletons only, per this task's own §6-2 "senior
 * 외 프로파일의 실제 값을 채우지 말 것. 골격만." Real
 * constraints/exclusions/tempo/vocabulary/killing-points are B1 (kr-2030)/
 * C1 (jp-2030)/D1+E1 (kr-kids)/F1 (jp-kids)'s job — these exist now only so
 * WorkspaceDefinition.defaultAudienceProfileId has real ids to eventually
 * point at (see data/workspaces/index.ts's own "A3 fills in
 * defaultAudienceProfileId properly" comment) and so AudienceProfile's
 * per-workspace field shape is proven out against more than one real
 * profile before those tasks build on it. Placeholder values below borrow
 * the closest existing profile's numbers (general for the 20s/30s pair,
 * kids for the three age bands) rather than inventing untested ranges.
 */
const KR_2030_EMOTIONAL_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'kr-2030-emotional',
  labelKo: '한국 2030 감성 팝록·R&B',
  constraints: [],
  exclusions: [],
  tempoFloor: 60,
  tempoCeiling: 132,
  lyricWordRange: [180, 260],
  songLengthSecondsRange: [150, 250],
  relaxableAtPeak: [],
  hardExclusions: [],
  killingPointSetId: 'kr-2030-emotional-default',
  arcModelId: 'five-phase',
  structureTemplateSetId: 'adult-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: []
};

const KR_2030_ELECTRO_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'kr-2030-electro',
  labelKo: '한국 2030 일렉트로팝',
  constraints: [],
  exclusions: [],
  tempoFloor: 60,
  tempoCeiling: 132,
  lyricWordRange: [180, 260],
  songLengthSecondsRange: [150, 250],
  relaxableAtPeak: [],
  hardExclusions: [],
  killingPointSetId: 'kr-2030-electro-default',
  arcModelId: 'five-phase',
  structureTemplateSetId: 'adult-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: []
};

const JP_2030_MELODIC_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'jp-2030-melodic',
  labelKo: '일본 2030 J-pop/J-rock',
  constraints: [],
  exclusions: [],
  tempoFloor: 60,
  tempoCeiling: 132,
  lyricWordRange: [180, 260],
  songLengthSecondsRange: [150, 250],
  relaxableAtPeak: [],
  hardExclusions: [],
  killingPointSetId: 'jp-2030-melodic-default',
  arcModelId: 'five-phase',
  structureTemplateSetId: 'adult-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: []
};

const JP_2030_ANIME_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'jp-2030-anime',
  labelKo: '일본 2030 애니송',
  constraints: [],
  exclusions: [],
  tempoFloor: 60,
  tempoCeiling: 132,
  lyricWordRange: [180, 260],
  songLengthSecondsRange: [150, 250],
  relaxableAtPeak: [],
  hardExclusions: [],
  killingPointSetId: 'jp-2030-anime-default',
  arcModelId: 'five-phase',
  structureTemplateSetId: 'adult-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: []
};

const KIDS_0_TO_2_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'kids-0to2',
  labelKo: '동요 0~2세',
  constraints: [],
  exclusions: [],
  tempoFloor: 60,
  tempoCeiling: 100,
  lyricWordRange: [20, 60],
  songLengthSecondsRange: [60, 120],
  relaxableAtPeak: [],
  hardExclusions: [],
  killingPointSetId: 'kids-default',
  arcModelId: 'repetition-cycle',
  structureTemplateSetId: 'kids-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: [],
  safetyPolicyId: 'kids-safety-default'
};

const KIDS_2_TO_4_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'kids-2to4',
  labelKo: '동요 2~4세',
  constraints: [],
  exclusions: [],
  tempoFloor: 100,
  tempoCeiling: 130,
  lyricWordRange: [40, 90],
  songLengthSecondsRange: [90, 150],
  relaxableAtPeak: [],
  hardExclusions: [],
  killingPointSetId: 'kids-default',
  arcModelId: 'repetition-cycle',
  structureTemplateSetId: 'kids-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: [],
  safetyPolicyId: 'kids-safety-default'
};

const KIDS_4_TO_7_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'kids-4to7',
  labelKo: '동요 4~7세',
  constraints: [],
  exclusions: [],
  tempoFloor: 105,
  tempoCeiling: 140,
  lyricWordRange: [60, 120],
  songLengthSecondsRange: [90, 150],
  relaxableAtPeak: [],
  hardExclusions: [],
  killingPointSetId: 'kids-default',
  arcModelId: 'repetition-cycle',
  structureTemplateSetId: 'kids-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: [],
  safetyPolicyId: 'kids-safety-default'
};

/** v4.2 (TASK A3) — every provisional/skeleton profile, for lookup by id (data/workspaces/index.ts's defaultAudienceProfileId, once B1/C1/D1/E1/F1 point at these instead of 'general'/'kids'). */
export const PROVISIONAL_AUDIENCE_PROFILES: AudienceProfile[] = [
  KR_2030_EMOTIONAL_AUDIENCE_PROFILE,
  KR_2030_ELECTRO_AUDIENCE_PROFILE,
  JP_2030_MELODIC_AUDIENCE_PROFILE,
  JP_2030_ANIME_AUDIENCE_PROFILE,
  KIDS_0_TO_2_AUDIENCE_PROFILE,
  KIDS_2_TO_4_AUDIENCE_PROFILE,
  KIDS_4_TO_7_AUDIENCE_PROFILE
];

export const ALL_AUDIENCE_PROFILES: AudienceProfile[] = [
  SENIOR_AUDIENCE_PROFILE,
  ...PROVISIONAL_AUDIENCE_PROFILES
];

export function audienceProfileById(id: string): AudienceProfile | undefined {
  return ALL_AUDIENCE_PROFILES.find(profile => profile.id === id) ?? [GENERAL_AUDIENCE_PROFILE, KIDS_AUDIENCE_PROFILE].find(profile => profile.id === id);
}

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
 * v3.77 (TASK B) — real measurement: this returned `undefined` for every
 * profile except the literal id `'senior'` — general/twenties/thirtiesForties/
 * kids/undefined audience all fell through to `undefined`, which
 * core/batchPreallocation.ts's/localGenerator.ts's own `tempoBands ? ... : []`
 * turned into an EMPTY band plan, which core/localGenerator.ts's
 * averageTempo() then silently treated as "no band" and fell back to a
 * narrow genre-tempoRange average (`fallbackCenter`) — measured BPM stddev
 * 2.4 on a real non-senior custom channel. This is the 4th time this exact
 * class of bug was fixed (v3.58/v3.60/v3.64/v3.75 all "fixed" a narrow-BPM
 * symptom without ever touching this root cause) — see this task's own §10
 * "특정 조건에서만 켜지는 구조" principle for why: a real generation always
 * had SOME AudienceProfile, but only one profile id's worth of code path
 * was ever exercised by a default/manual test.
 *
 * Every profile now gets real bands: senior keeps its hand-tuned
 * SENIOR_TEMPO_BANDS (unique real-listening-calibrated shape, untouched);
 * every other profile gets 4 auto-generated equal-width bands spanning its
 * own tempoFloor..tempoCeiling (generateTempoBands below) — never
 * `undefined`, so no caller can silently collapse to a no-band fallback
 * again.
 */
export function tempoBandsForProfile(profile: AudienceProfile): TempoBand[] {
  if (profile.id === 'senior') return SENIOR_TEMPO_BANDS;
  return generateTempoBands(profile.tempoFloor, profile.tempoCeiling);
}

/**
 * v3.77 (TASK B) — 4 equal-width, non-overlapping bands spanning
 * [tempoFloor, tempoCeiling]. Equal `shareOf18` weights (the field just
 * means "relative share", not literally out of 18 — see core/tempoPlan.ts's
 * buildTempoBandPlan, which normalizes by the SUM of shareOf18 across the
 * given bands, at any songCount) — a flat split is the right default for a
 * profile with no hand-tuned real-listening distribution of its own.
 */
export function generateTempoBands(tempoFloor: number, tempoCeiling: number, count = 4): TempoBand[] {
  if (!(tempoCeiling > tempoFloor) || count <= 0) {
    return [{ low: tempoFloor, high: Math.max(tempoFloor, tempoCeiling), shareOf18: 1 }];
  }
  const width = (tempoCeiling - tempoFloor) / count;
  return Array.from({ length: count }, (_, i) => {
    const low = Math.round(tempoFloor + width * i);
    const high = i === count - 1 ? tempoCeiling : Math.round(tempoFloor + width * (i + 1)) - 1;
    return { low, high: Math.max(low, high), shareOf18: 1 };
  });
}
