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
 * combined register+delivery+timbre+proximity string never exceeds 12 words
 * — the v3.62 prompt-budget discipline this task explicitly must not
 * regress (see this task's own "보컬 서술을 12단어 넘게 만들지 말 것").
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
 * Registers reserved for a track that actually has a killing point relaxing
 * SENIOR_AUDIENCE_PROFILE's 'comfortable mid vocal register' constraint (see
 * data/audienceProfiles.ts/data/killingPoints.ts) — every other axis stays
 * fully open for a senior-audience track; only the brightest/highest
 * registers are gated, per this task's own "음역만이 아니라 timbre·delivery·
 * proximity 로도 충분히 구분됩니다" guidance (register is the ONE axis this
 * task restricts for comfort; the other three stay open even on a quiet
 * track).
 */
export const MALE_PEAK_ONLY_REGISTERS = new Set(['bright tenor lead', 'light high tenor']);
export const FEMALE_PEAK_ONLY_REGISTERS = new Set(['bright soprano lead']);

export const MALE_VOCAL_TRAIT_AXES: VocalTraitAxes = {
  register: [
    'low warm baritone',
    'mid baritone-tenor lead',
    'bright tenor lead',
    'light high tenor',
    'deep chest-register lead',
    'relaxed mid-range lead',
    'narrow crooner tone'
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
  proximity: ['intimate close-mic', 'warm natural room', 'dry and forward', 'soft plate ambience']
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
  proximity: ['intimate close-mic', 'warm natural room', 'dry and forward', 'soft plate ambience']
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
}

export const DUET_TRAIT_AXES: DuetTraitAxes = {
  pairing: [
    'alternating verses, joined chorus',
    'call and answer',
    'female lead, male harmony',
    'male lead, female harmony',
    'unison splitting to thirds',
    'trading lines mid-phrase',
    'narration answered wordlessly'
  ],
  blend: ['close third harmony', 'wide octave harmony', 'tight unison, light detune', 'loose lines meeting hook']
};
