import type { AgeGroup, AudienceProfile, ChannelArchetype } from '../types';
import { workspaceForArchetype } from './workspaces';

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
  // v4.16 (TASK A) — 112 -> 100: real listening comparison against 10 real
  // 70s/80s standards (Carpenters/Simon & Garfunkel-era) found 8/10 at or
  // below 88 BPM, while this set's own median ran 96 — the ceiling itself
  // had no real basis (v3.58's own doc note: "근거 없이 넓게 잡음"). Range
  // width (62~100 = 38) still clears BREADTH_THRESHOLDS' stddevFloor/
  // rangeFloor bars — see SENIOR_TEMPO_BANDS below (also rebalanced).
  tempoFloor: 62,
  tempoCeiling: 100,
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
 * v4.2 (TASK A3, TASK E) — originally a skeleton per that task's own §6-2
 * "senior 외 프로파일의 실제 값을 채우지 말 것. 골격만." v5.7 (TASK B) fills
 * in the real values this was always meant to receive, per the v5.6 audit's
 * finding that `defaultAudienceProfileId` had zero real callers and every
 * non-senior adult workspace was silently generating against the generic
 * `general` profile. Tempo/constraints reasoned from this workspace's own
 * real channel presets (`after-work-band-pop`, `thirty-night-walk`,
 * `rainy-seoul-nightscape` — band-pop/R&B/city-night, not electro-heavy),
 * narrowed from `general`'s full 60-132 span rather than widened, since a
 * workspace-specific profile that's just as loose as the generic fallback
 * wouldn't be worth the resolution work. No real Suno-render calibration
 * yet — same "estimate, recalibrate after first real set" caveat as
 * `lyricMetricsByLanguage`'s own doc comment already states for senior.
 */
const KR_2030_EMOTIONAL_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'kr-2030-emotional',
  labelKo: '한국 2030 감성 팝록·R&B',
  constraints: [
    'contemporary Korean urban-pop production',
    'bass and drums carry the groove',
    'conversational present-day Korean vocal delivery',
    'clean modern vocal-forward mix',
    'melodic hooks written for a 20s-30s listener'
  ],
  exclusions: [
    'vintage tape saturation',
    '1970s AM-radio compression',
    'sparse acoustic-only arrangement with no rhythm section',
    'nostalgic senior-radio announcer tone'
  ],
  tempoFloor: 68,
  tempoCeiling: 120,
  lyricWordRange: [190, 260],
  songLengthSecondsRange: [180, 225],
  relaxableAtPeak: [],
  // No relaxableAtPeak split defined for this workspace yet (no real
  // killing-point set exists — killingPointSetId below is id-only, same as
  // every non-senior profile per AudienceProfile's own doc comment), so
  // this equals `exclusions` verbatim per that field's own convention.
  hardExclusions: [
    'vintage tape saturation',
    '1970s AM-radio compression',
    'sparse acoustic-only arrangement with no rhythm section',
    'nostalgic senior-radio announcer tone'
  ],
  killingPointSetId: 'kr-2030-emotional-default',
  arcModelId: 'five-phase',
  structureTemplateSetId: 'adult-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: [],
  lyricMetricsByLanguage: {
    korean: { primaryRange: [160, 200], syllableRange: [380, 480] }
  }
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

/**
 * v5.7 (TASK B) — real values, same rationale/reasoning as
 * KR_2030_EMOTIONAL_AUDIENCE_PROFILE's own doc comment above. Reasoned from
 * this workspace's own real channel presets (`reiwa-way-home-jpop`,
 * `tokyo-night-melodic-pop`, `want-to-cry-band-playlist` — melodic
 * guitar/piano J-pop, not anime-vocal or showa-era), deliberately excluding
 * the specific showa/vintage character `senior-oldpop` owns so the two
 * never converge even though both are Japanese-adjacent in places.
 */
const JP_2030_MELODIC_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'jp-2030-melodic',
  labelKo: '일본 2030 J-pop/J-rock',
  constraints: [
    'contemporary Japanese melodic pop/rock production',
    'guitar and piano-led arrangement',
    'clean modern J-pop mix',
    'introspective present-day Japanese vocal delivery',
    'melodic hooks written for a 20s-30s listener'
  ],
  exclusions: [
    'vintage tape saturation',
    'showa-era AM-radio compression',
    'sparse acoustic-only arrangement with no rhythm section',
    'nostalgic senior-radio announcer tone'
  ],
  tempoFloor: 65,
  tempoCeiling: 125,
  lyricWordRange: [185, 255],
  songLengthSecondsRange: [180, 225],
  relaxableAtPeak: [],
  // No relaxableAtPeak split defined yet — equals `exclusions` verbatim,
  // same convention as KR_2030_EMOTIONAL_AUDIENCE_PROFILE above.
  hardExclusions: [
    'vintage tape saturation',
    'showa-era AM-radio compression',
    'sparse acoustic-only arrangement with no rhythm section',
    'nostalgic senior-radio announcer tone'
  ],
  killingPointSetId: 'jp-2030-melodic-default',
  arcModelId: 'five-phase',
  structureTemplateSetId: 'adult-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: [],
  lyricMetricsByLanguage: {
    // v5.7 estimate: narrowed slightly from senior's own japanese row
    // ([400,520]) — senior's figures were themselves never calibrated
    // against a real Japanese set either, so this is a starting point, not
    // a measurement; same "recalibrate after first real set" caveat as
    // senior's own lyricMetricsByLanguage doc comment states.
    japanese: { primaryRange: [380, 480], syllableRange: [380, 480] }
  }
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

/**
 * v5.7 (TASK B) — no AudienceProfile existed at all for kr-idol-male/
 * kr-idol-female before this (the v5.6 audit's finding: both silently
 * resolved to `general`). Reasoned from these workspaces' own real channel
 * presets (`stage-night`/`drive-kpop-playlist`/`dawn-confession` for male,
 * `daylight-city-kpop`/`nonstop-playlist`/`songs-for-after-its-over` for
 * female — all short-hook, choreography-ready K-pop, uptempo relative to
 * kr-2030's band-pop register). Deliberately near-identical between the two
 * profiles: idol energy/tempo/structure is a workspace-genre trait, not a
 * gendered one — any gendered vocal-register difference belongs in the
 * per-genre GenreTraits/idolExpressionLint layer (v5.7-H/I, not yet done),
 * not invented here as a new distinction. The one wording difference
 * ('anthemic' vs 'bright') mirrors each workspace's own promise text, not a
 * musical constraint.
 */
const KR_IDOL_MALE_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'kr-idol-male',
  labelKo: '한국 아이돌 남성',
  constraints: [
    'confident anthemic K-pop stage delivery',
    'punchy contemporary production built for choreography',
    'driving rhythm section with a strong beat',
    'short repeated hook-forward structure',
    'high-energy performance-ready mix'
  ],
  exclusions: [
    'slow ballad pacing',
    'vintage tape saturation',
    'nostalgic senior-radio announcer tone',
    'understated subdued vocal delivery'
  ],
  tempoFloor: 92,
  tempoCeiling: 138,
  lyricWordRange: [140, 210],
  songLengthSecondsRange: [165, 205],
  relaxableAtPeak: [],
  hardExclusions: [
    'slow ballad pacing',
    'vintage tape saturation',
    'nostalgic senior-radio announcer tone',
    'understated subdued vocal delivery'
  ],
  killingPointSetId: 'kr-idol-male-default',
  arcModelId: 'five-phase',
  structureTemplateSetId: 'adult-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: [],
  lyricMetricsByLanguage: {
    // v5.7 estimate: shorter/more repetitive than kr-2030's own korean row
    // ([160,200]) — hook-forward idol structure repeats a shorter core
    // lyric more times rather than covering more distinct ground. Not yet
    // calibrated against a real generated set.
    korean: { primaryRange: [120, 160], syllableRange: [280, 380] }
  }
};

const KR_IDOL_FEMALE_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'kr-idol-female',
  labelKo: '한국 아이돌 여성',
  constraints: [
    'bright confident K-pop stage delivery',
    'punchy contemporary production built for choreography',
    'driving rhythm section with a strong beat',
    'short repeated hook-forward structure',
    'high-energy performance-ready mix'
  ],
  exclusions: [
    'slow ballad pacing',
    'vintage tape saturation',
    'nostalgic senior-radio announcer tone',
    'understated subdued vocal delivery'
  ],
  tempoFloor: 92,
  tempoCeiling: 138,
  lyricWordRange: [140, 210],
  songLengthSecondsRange: [165, 205],
  relaxableAtPeak: [],
  hardExclusions: [
    'slow ballad pacing',
    'vintage tape saturation',
    'nostalgic senior-radio announcer tone',
    'understated subdued vocal delivery'
  ],
  killingPointSetId: 'kr-idol-female-default',
  arcModelId: 'five-phase',
  structureTemplateSetId: 'adult-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: [],
  lyricMetricsByLanguage: {
    korean: { primaryRange: [120, 160], syllableRange: [280, 380] }
  }
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

/**
 * v5.8 (audit follow-up, docs/v58-report.md) — real measurement found
 * kr-kids/jp-kids both still pointed `defaultAudienceProfileId` at the
 * generic `KIDS_AUDIENCE_PROFILE` (tempoFloor 92/tempoCeiling 128,
 * lyricWordRange [120,220]) — the exact same "no real per-workspace
 * profile" gap v5.7 fixed for the 4 adult workspaces, just never extended
 * to kids. lyricWordRange below is a real measurement (18-song generation,
 * `[title]`/`[section]` tags stripped): kr-kids Korean whitespace-token
 * count 39-52 (avg 44.8) — nowhere near the generic profile's 120 floor;
 * jp-kids Japanese character count 152-211 (avg 183.8) — an entirely
 * different unit than kr-kids's own Korean token count, same units
 * distinction v5.7's own lyricMetricsByLanguage entries already established
 * for kr-2030 vs jp-2030.
 *
 * tempoFloor/tempoCeiling did NOT get the same "widen to match real genre
 * range" treatment the 4 adult workspaces got in v5.7, and that was a
 * deliberate reversal after real measurement, not an oversight: kr-kids's
 * own `krkids-sleep-calm` genre (data/genreLibrary/index.ts tempoRange
 * [62,84]) never actually renders calm today because
 * core/tempoPlan.ts's `resolveTempoWithBand` clamps every song's BPM
 * against the AUDIENCE PROFILE's tempoFloor/tempoCeiling, not the selected
 * genre's own tempoRange (the genre only affects a small deterministic
 * jitter). Widening tempoFloor to 62 to "unlock" sleep-calm was tried and
 * measured: it did let sleep-calm reach as low as 72, but it ALSO let
 * krkids-action (spec 112-128) drop as low as 64 BPM in the same real
 * generation run, because tempo bands are carved from the whole
 * [tempoFloor,tempoCeiling] span and assigned across tracks independent of
 * which genre that track actually uses — an architecture that assumes one
 * workspace has one roughly-coherent tempo character (true for
 * senior-oldpop/kr-2030/jp-2030/kr-idol, false for kr-kids, which
 * legitimately spans a genuinely calm genre and a genuinely energetic one
 * in the same workspace). Fixing this properly means changing
 * `resolveTempoWithBand`/the tempo-band-to-track assignment itself — shared
 * code every other workspace (including senior-oldpop) also depends on —
 * which is a bigger, riskier change than an AudienceProfile data edit and
 * was not made here without checking scope first. tempoFloor/tempoCeiling
 * below are therefore kept at the same value as the generic
 * KIDS_AUDIENCE_PROFILE (92-128) — real, measured-safe for kr-kids's own
 * upbeat majority (5 of 7 genres), but sleep-calm's own calm character
 * still won't reach the real output yet. jp-kids's own genre spread (96-132
 * across all 7 genres, no bimodal calm/energetic split) doesn't hit this
 * problem, so its tempoCeiling is safely widened to 132 below to stop
 * jpkids-taiso-dance's own real 132 ceiling being clipped to 128.
 */
const KR_KIDS_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'kr-kids',
  labelKo: '한국 동요',
  constraints: [],
  exclusions: [],
  tempoFloor: 92,
  tempoCeiling: 128,
  // v5.8 (audit follow-up) — see this profile's own doc comment above and
  // core/tempoPlan.ts's resolveTempoWithBand doc comment for the full
  // reasoning: lets krkids-sleep-calm/krkids-action each land within their
  // own real genre tempoRange instead of both being clamped to this
  // workspace-wide 92-128 span regardless of genre.
  genreBoundedTempo: true,
  lyricWordRange: [35, 60],
  songLengthSecondsRange: [90, 150],
  relaxableAtPeak: [],
  hardExclusions: [],
  killingPointSetId: 'kr-kids-default',
  arcModelId: 'repetition-cycle',
  structureTemplateSetId: 'kids-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: [],
  safetyPolicyId: 'kids-safety-default',
  lyricMetricsByLanguage: {
    korean: { primaryRange: [35, 60], syllableRange: [80, 140] }
  }
};

const JP_KIDS_AUDIENCE_PROFILE: AudienceProfile = {
  id: 'jp-kids',
  labelKo: '일본 동요',
  constraints: [],
  exclusions: [],
  tempoFloor: 96,
  tempoCeiling: 132,
  // v5.8 (audit follow-up) — same mechanism as KR_KIDS_AUDIENCE_PROFILE
  // above; jp-kids's own 7 genres don't have as extreme a split, but this
  // still makes each track's tempo genuinely reflect its own genre.
  genreBoundedTempo: true,
  lyricWordRange: [145, 215],
  songLengthSecondsRange: [90, 150],
  relaxableAtPeak: [],
  hardExclusions: [],
  killingPointSetId: 'jp-kids-default',
  arcModelId: 'repetition-cycle',
  structureTemplateSetId: 'kids-t1-t5',
  titlePatternSetId: 'adult-en-v1',
  vocabularyBankIds: [],
  safetyPolicyId: 'kids-safety-default',
  lyricMetricsByLanguage: {
    japanese: { primaryRange: [145, 215], syllableRange: [145, 215] }
  }
};

/**
 * v4.2 (TASK A3) — every provisional/skeleton/workspace profile, for lookup
 * by id (data/workspaces/index.ts's defaultAudienceProfileId). v5.7 (TASK B)
 * added the two new kr-idol-* profiles here (not a separate array) since
 * `audienceProfileById`/`ALL_AUDIENCE_PROFILES` already iterate this one
 * list — no new plumbing needed for a real, non-skeleton profile to join it.
 * v5.8 added KR_KIDS/JP_KIDS the same way.
 */
export const PROVISIONAL_AUDIENCE_PROFILES: AudienceProfile[] = [
  KR_2030_EMOTIONAL_AUDIENCE_PROFILE,
  KR_2030_ELECTRO_AUDIENCE_PROFILE,
  JP_2030_MELODIC_AUDIENCE_PROFILE,
  JP_2030_ANIME_AUDIENCE_PROFILE,
  KR_IDOL_MALE_AUDIENCE_PROFILE,
  KR_IDOL_FEMALE_AUDIENCE_PROFILE,
  KR_KIDS_AUDIENCE_PROFILE,
  JP_KIDS_AUDIENCE_PROFILE,
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
 * v5.7 (TASK B) — the real, workspace-aware resolver. Prefers the calling
 * channel's own workspace's `defaultAudienceProfileId` (real per-workspace
 * tempo/word-range/exclusions, not the generic age-bucketed fallback);
 * falls back to `audienceProfileForAgeGroup(audience)` when the channel's
 * archetype doesn't resolve to a workspace at all, that workspace's own
 * profile id doesn't resolve, OR the workspace is senior-oldpop.
 *
 * senior-oldpop is deliberately excluded from the workspace-override path,
 * not merely a no-op: unlike the 4 target workspaces (one archetype, one
 * audience each), senior-oldpop bundles 10 archetypes that were never all
 * "senior audience" — 'modern-chill'/'city-night'/'lofi-study' etc. carry
 * their own per-channel `audience` field for deliberate sub-targeting
 * within the workspace (see tests/audienceProfile.test.ts's own "does not
 * force senior-specific exclusions onto a non-senior channel", which
 * caught this: routing senior-oldpop through its single workspace default
 * would have force-applied SENIOR_AUDIENCE_PROFILE's exclusions onto e.g.
 * chill-hours, a real regression this fix must not introduce). Excluding
 * senior-oldpop here preserves that pre-existing, already-tested per-channel
 * resolution exactly — see tests/audienceProfileForWorkspace.test.ts for
 * the senior-morning channel's own strict-no-op confirmation.
 */
export function audienceProfileForChannelArchetype(archetype: ChannelArchetype | undefined, audienceFallback: AgeGroup | undefined): AudienceProfile {
  const workspace = workspaceForArchetype(archetype);
  const resolved = workspace && workspace.id !== 'senior-oldpop' && audienceProfileById(workspace.defaultAudienceProfileId);
  return resolved || audienceProfileForAgeGroup(audienceFallback);
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

// v4.16 (TASK A, §1-2) — re-centered from a 92-100-heavy shape (median 96)
// toward the 7080-standard-referenced range (10 real Carpenters/Simon &
// Garfunkel-era standards averaged 83 BPM, median 82) — median target 78-86
// (§4-2 completion table). Range width (62~100 = 38) still clears the
// BREADTH_THRESHOLDS stddev/range floor, so §2-3's "표준편차 기준을 낮추지
// 말 것" holds without any threshold change.
export const SENIOR_TEMPO_BANDS: TempoBand[] = [
  { low: 62, high: 72, shareOf18: 4 },
  { low: 73, high: 84, shareOf18: 6 },
  { low: 85, high: 94, shareOf18: 5 },
  { low: 95, high: 100, shareOf18: 3 }
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
