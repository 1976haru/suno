/**
 * TASK v3.72 (TASK B) — real listening feedback: adult vocal descriptions
 * only had 5 wordings per type, all converging on the same
 * warm/clear/gentle descriptor axis ("mature warm male lead vocal, clear
 * close-mic delivery, gentle and sincere" vs "clear mature male lead, steady
 * center pitch, conversational warmth" — different words, same voice). A
 * 10-set week (180 songs) repeated the same 5 sentences 36 times each.
 *
 * Same fix shape as v3.65's 5-axis genre decomposition: instead of one
 * pre-written sentence per type, four independent axes (register/delivery/
 * timbre/proximity — "what range", "how phrased", "what grain", "how close
 * the mic is") that combine per song. core/vocalPlan.ts's
 * buildAdultVocalTraitPlan does the actual per-song selection (repeat caps,
 * contradiction avoidance, senior-register gating); this file is pure data.
 *
 * Every entry is capped at 3 words (solo axes) / 4 words (duet axes) so a
 * combined register+delivery+timbre+proximity string stays well within the
 * v3.62 prompt-budget discipline this task explicitly must not regress (see
 * this task's own "보컬 서술을 12단어 넘게 만들지 말 것") — solo tracks stay at
 * the original ~12-13 words (v3.75 TASK C added the explicit gender-word
 * prefix). v3.80 (TASK A/B) raised the duet ceiling to ~17: duets now also
 * carry a proximity value (see DUET_TRAIT_AXES.proximity's own doc comment
 * for why), pushing a worst-case duet line to pairing(4)+blend(4)+
 * proximity(3)+"male and female duet"(4) — see tests/vocalPlan.test.ts's
 * own "never exceeds 17 words per song" for the enforced ceiling.
 *
 * Kids-channel vocal descriptions (core/vocalPlan.ts's VOCAL_DESCRIPTIONS)
 * are untouched — this file only ever feeds non-kids archetypes.
 */

export interface VocalTraitAxes {
  /** Voice range/type. */
  register: string[];
  /** Phrasing/delivery style. */
  delivery: string[];
  /** Tone/grain/texture. */
  timbre: string[];
  /** Mic distance/space (shared between genders). */
  proximity: string[];
}

/**
 * v3.80 (TASK B) — real listening feedback compared 4 male songs' prompts:
 * the one track 하루님 singled out as best had `soft plate ambience`
 * (era-signature studio reverb); the other three all had `dry and forward`
 * or `intimate close-mic` (today's standard "voice pinned to the mic"
 * playlist production). A real 18-song pack's proximity picks skewed
 * heavily toward those same two "modern" values. Adds 3 new era-signature
 * values (`chamber ambience`/`tape slap echo`/`narrow mono-leaning room`)
 * alongside the original 4, and classifies all 7 into MODERN vs ERA
 * buckets so vocalPlan.ts can cap modern picks and floor era-signature ones
 * (see MODERN_PROXIMITY_VALUES/ERA_PROXIMITY_VALUES below).
 */
export const PROXIMITY_POOL: string[] = [
  'intimate close-mic',
  'warm natural room',
  'dry and forward',
  'soft plate ambience',
  'chamber ambience',
  'tape slap echo',
  'narrow mono-leaning room'
];

/** "Today's standard playlist production" proximity — capped pack-wide (see PROXIMITY_POOL's own doc comment). */
export const MODERN_PROXIMITY_VALUES = new Set(['intimate close-mic', 'dry and forward']);
/** Era-signature proximity (everything in PROXIMITY_POOL that isn't MODERN_PROXIMITY_VALUES) — floored pack-wide. */
export const ERA_PROXIMITY_VALUES = new Set(PROXIMITY_POOL.filter(value => !MODERN_PROXIMITY_VALUES.has(value)));

/**
 * v3.80 (TASK B-2-3) — soft per-era preference (a weight, not a hard
 * filter — a hard filter risks the exact "genre-singleton"-class starvation
 * bug this app has already hit twice: a candidate pool too narrow for a
 * specific era/gender/cap combination silently can't be filled). 'timeless'
 * genres get no preference list (candidatesFor's own caller passes undefined
 * era in that case, and every value stays equally weighted).
 */
export const PROXIMITY_ERA_PREFERENCE: Partial<Record<'1950s-60s' | '1970s' | '1980s', string[]>> = {
  '1950s-60s': ['tape slap echo', 'narrow mono-leaning room', 'soft plate ambience'],
  '1970s': ['soft plate ambience', 'warm natural room', 'chamber ambience'],
  '1980s': ['soft plate ambience', 'chamber ambience', 'warm natural room']
};

/**
 * Registers reserved for a track that actually has a killing point relaxing
 * SENIOR_AUDIENCE_PROFILE's 'comfortable mid vocal register' constraint (see
 * data/audienceProfiles.ts/data/killingPoints.ts) — every other axis stays
 * fully open for a senior-audience track; only the brightest/highest
 * registers are gated, per this task's own "음역만이 아니라 timbre·delivery·
 * proximity 로도 충분히 구분됩니다" guidance (register is the ONE axis this
 * task restricts for comfort; the other three stay open even on a quiet
 * track).
 */
/**
 * v3.80 (TASK D) — real listening feedback: all 6 male register picks in a
 * real 18-song pack landed low~mid (baritone/chest/crooner/mid-tenor); the
 * female pool already spans head-voice through full chest, but the male
 * pool never reached a bright/falsetto character at all — 0 of 6 songs.
 * Root cause: MALE_PEAK_ONLY_REGISTERS previously gated 'bright tenor lead'
 * and 'light high tenor' behind a killing-point peak flag (the SAME
 * treatment belting gets), conflating "loud, pushed high notes" with
 * "soft falsetto/head voice" — two unrelated techniques. Falsetto is a
 * *quieter*, lower-effort register, not a belted one; it doesn't need
 * peak-only gating. 'bright tenor lead'/'light high tenor' keep their
 * existing peak-only gate (they ARE a brighter, more effortful register,
 * consistent with the original v3.72 intent), but the 4 new
 * falsetto/head-voice entries below are NOT peak-gated — they're always
 * reachable, exactly because falsetto is not belting (see
 * data/audienceProfiles.ts's hardExclusions doc comment for the same
 * belting-vs-falsetto distinction on the exclusion side).
 */
export const MALE_PEAK_ONLY_REGISTERS = new Set(['bright tenor lead', 'light high tenor']);
export const FEMALE_PEAK_ONLY_REGISTERS = new Set(['bright soprano lead']);

/** v3.80 (TASK D) — the male high/falsetto registers a senior-safe pack can always reach (never peak-gated — see MALE_PEAK_ONLY_REGISTERS' own doc comment on why falsetto isn't belting). Used by vocalPlan.ts's buildAdultVocalTraitPlan to enforce "at least 1 of 6 male songs in this band". */
export const MALE_HIGH_OR_FALSETTO_REGISTERS = new Set(['bright tenor lead', 'light high tenor', 'falsetto-leaning tenor', 'male head-voice lead', 'thin bright tenor', 'chest-to-falsetto shifting lead']);
/** v3.80 (TASK D) — the male low registers a pack should cap at 3-of-6 (see MALE_HIGH_OR_FALSETTO_REGISTERS' own doc comment). */
export const MALE_LOW_REGISTERS = new Set(['low warm baritone', 'deep chest-register lead', 'narrow crooner tone']);

export const MALE_VOCAL_TRAIT_AXES: VocalTraitAxes = {
  register: [
    'low warm baritone',
    'mid baritone-tenor lead',
    'bright tenor lead',
    'light high tenor',
    'deep chest-register lead',
    'relaxed mid-range lead',
    'narrow crooner tone',
    // v3.80 (TASK D) — falsetto/head-voice additions, never peak-gated
    // (see MALE_PEAK_ONLY_REGISTERS' own doc comment above).
    'falsetto-leaning tenor',
    'male head-voice lead',
    'thin bright tenor',
    'chest-to-falsetto shifting lead'
  ],
  delivery: [
    'conversational unhurried phrasing',
    'legato sustained lines',
    'clipped rhythmic phrasing',
    'storytelling spoken-edge delivery',
    'gentle swung phrasing',
    'earnest forward delivery',
    'restrained understated reading'
  ],
  timbre: [
    'soft husky grain',
    'clean rounded tone',
    'slight nasal brightness',
    'smoky low resonance',
    'airy breath-forward tone',
    'warm woody midrange',
    'worn weathered edge'
  ],
  proximity: PROXIMITY_POOL
};

export const FEMALE_VOCAL_TRAIT_AXES: VocalTraitAxes = {
  register: [
    'low warm contralto',
    'mid clear alto',
    'clear mezzo lead',
    'bright soprano lead',
    'soft head-voice lead',
    'full chest alto',
    'narrow intimate lead'
  ],
  delivery: [
    'conversational unhurried phrasing',
    'legato sustained lines',
    'light rhythmic phrasing',
    'tender confiding delivery',
    'gentle swung phrasing',
    'bright forward delivery',
    'restrained understated reading'
  ],
  timbre: [
    'soft breathy grain',
    'clean bell tone',
    'warm rounded midrange',
    'slight smoky depth',
    'clear glassy brightness',
    'velvety low resonance',
    'faint vibrato shimmer'
  ],
  proximity: PROXIMITY_POOL
};

/**
 * Register/timbre pairs that read as physically contradictory (a "deep
 * chest-register" voice cannot simultaneously be "airy breath-forward"; a
 * "bright soprano" voice cannot simultaneously be "velvety low resonance").
 * Checked one direction only — register is always chosen before timbre (see
 * buildAdultVocalTraitPlan), so timbre candidates are filtered against the
 * song's already-chosen register.
 */
export const MALE_REGISTER_TIMBRE_CONTRADICTIONS: ReadonlyArray<readonly [string, string]> = [
  ['deep chest-register lead', 'airy breath-forward tone'],
  ['bright tenor lead', 'smoky low resonance'],
  ['light high tenor', 'smoky low resonance']
];

export const FEMALE_REGISTER_TIMBRE_CONTRADICTIONS: ReadonlyArray<readonly [string, string]> = [
  ['bright soprano lead', 'velvety low resonance'],
  ['low warm contralto', 'clear glassy brightness'],
  ['soft head-voice lead', 'velvety low resonance']
];

export interface DuetTraitAxes {
  /** Who sings what, structurally. */
  pairing: string[];
  /** How the two voices sit together harmonically. */
  blend: string[];
  /** v3.80 (TASK A/B) — duets previously had no proximity value at all, so a flagship slot that happened to land on 'mixed' (duet) couldn't be forced to plate/chamber ambience the way a solo slot could. Shares PROXIMITY_POOL with the solo axes. */
  proximity: string[];
}

export const DUET_TRAIT_AXES: DuetTraitAxes = {
  pairing: [
    // TASK v4.8 (TASK A, §1-2) — merged into single no-comma phrases so each
    // pairing value contributes ONE stylePrompt atom instead of two; the
    // information conveyed is unchanged, only the internal comma is gone.
    'alternating verses into joined chorus',
    'call and answer',
    'female lead with male harmony',
    'male lead with female harmony',
    'unison splitting to thirds',
    'trading lines mid-phrase',
    'narration answered wordlessly'
  ],
  blend: ['close third harmony', 'wide octave harmony', 'tight unison with light detune', 'loose lines meeting hook'],
  proximity: PROXIMITY_POOL
};
