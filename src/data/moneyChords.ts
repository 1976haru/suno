import { isKidsArchetype } from '../utils/channelArchetype';

export interface MoneyChordPreset {
  id: string;
  label: string;
  labelKo: string;
  description: string;
  progressions: string[];
  prompt: string;
  /**
   * TASK H3 (v3.14) — hand-written, not derived from `prompt` by regex. The
   * old compactMoneyChord() extracted the first Roman-numeral run out of
   * `prompt` via `/[ivIV]+(?:-[ivIV]+){2,}/`: 'emotional' shares its literal
   * "I-V-vi-IV" substring with 'default' (matching the same numerals but
   * meaning something different — verse vs. chorus emphasis), so both
   * compacted identically; 'showaModern's "IVmaj7-iii7-vi7" contains digits
   * ("7") and "maj7" the regex's roman-numeral-only character class doesn't
   * accept, so it matched nothing and fell through to the content-free
   * "money chord progression" fallback — silently erasing this channel's one
   * real harmonic identity. Every preset gets one of these, curated by hand.
   */
  compactProgression: string;
  bestFor: string[];
  /**
   * TASK v3.42 Part B3 — real measurement: 15 songs generated with 15
   * different `compactProgression` roman-numeral tags still averaged 90.3%
   * pairwise style-prompt similarity, because Suno responds to *description*,
   * not chord notation — the roman numerals are largely decorative to the
   * model. Paired with compactProgression as "<progression> — <effect>" (see
   * core/soundSignature.ts's compactMoneyChord) so the same harmonic choice
   * also reads as an audible, distinguishing description.
   */
  audibleEffect: string;
  /**
   * v5.8 (TASK 1) — a terse, tag-style compression of `audibleEffect` (<=8
   * words, hand-written from that field's actual wording — never a
   * mechanical truncation), meant to be appended to `compactProgression`
   * when reinforcing an EXPLICIT user money-chord pick (see
   * core/soundSignature.ts's compactMoneyChord `includeFeelReinforcement`
   * option). `audibleEffect` itself stays a full descriptive sentence and is
   * deliberately NOT used for this — TASK A (v4.8) already established that
   * a 10-17-word grammatical sentence reads to Suno as decorative prose, not
   * a descriptor tag, and turning it back on wasted budget without helping
   * (see localGenerator.ts's own moneyChord PromptPart doc comment). This is
   * a DIFFERENT mechanism from two same-shaped-sounding names elsewhere in
   * this codebase: hookDevices.ts's `shortForm` (a hook-device's own terse
   * text) and promptBudget.ts's `PromptPart.shortForm` (a generic
   * compression-ladder fallback applied to an already-assembled prompt atom
   * under hard byte-budget pressure) — neither of those is preset-specific
   * "feel" wording, so this field gets its own distinct name instead of
   * overloading either.
   */
  audibleEffectTag: string;
  /**
   * TASK v5.7 (TASK B §2-4) — "함께 써도 어울리는 진행": the pool a set built
   * primarily around this progression can pull its remaining ~40-50% of
   * songs from (see core/moneyChordPlan.ts's buildUserChosenProgressionPlan)
   * instead of either 100% one progression or falling back to a
   * family/archetype-default rotation that ignores the chosen progression
   * entirely. Chosen by harmonic/emotional-register closeness (same
   * reasoning as data/paletteFamilies.ts's own compatibleWith), not by
   * shared literal Roman numerals — e.g. doowop (I-vi-IV-V) and 'default'
   * (I-V-vi-IV/vi-IV-I-V) share no numerals but are both simple, bright,
   * two-chord-alternation 50s-60s pop progressions that sit comfortably
   * back to back in one set.
   */
  compatibleWith: string[];
}

export const moneyChordPresets: Record<string, MoneyChordPreset> = {
  default: {
    id: 'default',
    label: 'Default Pop Money Chords',
    labelKo: '기본 팝 머니코드',
    description: '가장 익숙하고 안전한 진행. 처음이라면 이걸 고르세요.',
    progressions: ['I-V-vi-IV', 'vi-IV-I-V'],
    prompt: 'major-key money chord progression with I-V-vi-IV and vi-IV-I-V movement, warm nostalgic pop harmony, emotional chorus lift, familiar radio-friendly melody, easy sing-along hook',
    compactProgression: 'I-V-vi-IV progression',
    audibleEffect: 'chorus opens up warmly and resolves home, instantly familiar',
    audibleEffectTag: 'warm chorus lift, familiar resolution',
    bestFor: ['처음 만드는 곡', '대부분의 플레이리스트 트랙'],
    compatibleWith: ['emotional', 'doowop', 'canon', 'popStandard']
  },
  emotional: {
    id: 'emotional',
    label: 'Emotional Lift',
    labelKo: '감성 고조',
    description: '후렴에서 감정이 확 올라오는 느낌을 원할 때.',
    progressions: ['I-V-vi-IV', 'vi-IV-I-V'],
    prompt: 'emotional major-key pop progression, I-V-vi-IV in verses and vi-IV-I-V in chorus, strong but gentle lift into the hook',
    compactProgression: 'I-V-vi-IV verses, vi-IV-I-V chorus lift',
    audibleEffect: 'chorus lifts noticeably higher than the verse and lands with a soft ache',
    audibleEffectTag: 'chorus lifts higher, lands with soft ache',
    bestFor: ['감정 절정 트랙', '늦은 밤 감성 곡'],
    compatibleWith: ['default', 'winterBallad', 'canon']
  },
  jazzColor: {
    id: 'jazzColor',
    label: 'Jazz Color',
    labelKo: '재즈 컬러',
    description: '재즈 카페 느낌의 세련된 색채가 필요할 때.',
    progressions: ['Imaj7-V-vi7-IVadd9', 'ii-V-I turnaround'],
    prompt: 'major-key money chord progression with gentle maj7 and add9 color chords, occasional ii-V-I cafe jazz turnaround, warm adult contemporary harmony',
    compactProgression: 'ii-V-I turnaround, maj7 add9 color',
    audibleEffect: 'smoky turnaround that lands softly on the resolution',
    audibleEffectTag: 'smoky turnaround, soft resolution',
    bestFor: ['재즈 카페 채널', '어른스러운 무드'],
    compatibleWith: ['emotional', 'royalRoad', 'cityPop']
  },
  cityPop: {
    id: 'cityPop',
    label: 'Soft City Pop',
    labelKo: '소프트 시티팝',
    description: '깔끔하고 세련된 도시적인 밤 분위기.',
    progressions: ['vi-IV-I-V', 'IVmaj7-iii7-vi7-ii7-V'],
    prompt: 'smooth city-pop friendly harmony, vi-IV-I-V movement, maj7 chords, gentle pre-chorus lift, nostalgic radio-friendly chorus',
    compactProgression: 'vi-IV-I-V movement, maj7 color',
    audibleEffect: 'glides forward smoothly then settles into a cool, polished landing',
    audibleEffectTag: 'smooth glide, polished landing',
    bestFor: ['일본 채널', '나이트 드라이브 무드'],
    compatibleWith: ['marusa', 'jazzColor', 'default']
  },
  canon: {
    id: 'canon',
    label: 'Canon Progression',
    labelKo: '캐논 진행',
    description: '감정이 최고조로 차오르는 캐논 진행. 연말·크리스마스 이브 곡에 잘 어울립니다.',
    progressions: ['I-V-vi-iii-IV-I-IV-V'],
    prompt: 'classic canon progression I-V-vi-iii-IV-I-IV-V, cinematic emotional build, orchestral-pop warmth, climactic chorus lift',
    compactProgression: 'I-V-vi-iii-IV-I-IV-V progression',
    audibleEffect: 'steadily rising, cinematic swell that keeps building toward the peak',
    audibleEffectTag: 'steadily rising, cinematic building swell',
    bestFor: ['연말/크리스마스 이브 곡', '감정 최고조 트랙'],
    compatibleWith: ['emotional', 'default', 'popStandard']
  },
  showaModern: {
    id: 'showaModern',
    label: 'Showa Modern',
    labelKo: '쇼와 모던',
    description: '일본 쇼와 모던 찻집(喫茶店) 분위기의 진행. 일본 채널 전용.',
    progressions: ['IVmaj7-iii7-vi7'],
    prompt: 'showa-modern kissaten harmony centered on IVmaj7-iii7-vi7 movement, warm mellow jazz-pop color, refined nostalgic Japanese cafe mood',
    compactProgression: 'IVmaj7-iii7-vi7 movement',
    audibleEffect: 'warm, wistful drift that never quite resolves until the very end',
    audibleEffectTag: 'wistful drift, late unresolved ache',
    bestFor: ['일본 채널', '쇼와 모던 카페 컨셉'],
    compatibleWith: ['royalRoad', 'marusa', 'doowop']
  },
  winterBallad: {
    id: 'winterBallad',
    label: 'Winter Ballad',
    labelKo: '겨울 발라드',
    description: '벌스는 차분하게, 후렴은 밝게, 마지막 후렴에서 반음 상승으로 마무리.',
    progressions: ['vi-IV-I-V (verse)', 'I-V-vi-IV (chorus)'],
    prompt: 'winter ballad harmony, vi-IV-I-V in verses building to I-V-vi-IV in chorus, gentle key-up half-step modulation on the final chorus only',
    compactProgression: 'vi-IV-I-V to I-V-vi-IV, final chorus key-up',
    audibleEffect: 'stays hushed through the verse then opens into a brighter, lifted chorus',
    audibleEffectTag: 'hushed verse, opening into a lifted chorus',
    bestFor: ['겨울 발라드', '마지막 트랙(클로저)'],
    // TASK v5.7 (TASK B §2-4) — 'emotional' (also verse/chorus vi-IV-I-V <->
    // I-V-vi-IV movement, same register just without the key-up), 'canon'
    // (same cinematic-build emotional territory), 'default' (the most
    // neutral/compatible progression in the whole pack, safe next to anything).
    compatibleWith: ['emotional', 'canon', 'default']
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    labelKo: '커스텀',
    description: '직접 코드 진행을 입력합니다.',
    progressions: [],
    prompt: 'use a familiar radio-friendly chord progression with a clear emotional chorus lift',
    // Never actually read — compactMoneyChord() special-cases 'custom' before
    // reaching this field (see below), using opts.customMoneyChord verbatim.
    compactProgression: 'familiar chord progression',
    audibleEffect: 'familiar chorus lift that resolves cleanly',
    audibleEffectTag: 'familiar chorus lift, clean resolve',
    bestFor: ['직접 코드 진행을 지정하고 싶을 때'],
    // TASK v5.7 (TASK B §2-4) — a hand-typed progression has no principled
    // "neighbor" this app can infer; left empty (never mixed with a
    // system-picked adjacent progression the user didn't type themselves).
    compatibleWith: []
  },
  // TASK v3.33 Part C — channel-signature progressions, added after real
  // listening feedback that money chords "felt weak" and that the Japanese
  // (showa-cafe) channel lacked a distinct harmonic identity. doowop/
  // royalRoad are each archetype's anchor progression (see
  // core/moneyChordPlan.ts's signatureMoneyChordId — pinned to cold-open/
  // flagship tracks); the rest widen the rotation pool non-opener tracks
  // draw from.
  doowop: {
    id: 'doowop',
    label: 'Doo-Wop 50s',
    labelKo: '두왑 진행',
    description: '50~60대 세대에게 깊이 각인된 두왑 진행. 시니어 채널의 시그니처로 적합합니다.',
    progressions: ['I-vi-IV-V'],
    prompt: '1950s doo-wop chord progression I-vi-IV-V, deeply familiar nostalgic feel for older listeners, warm vintage pop harmony, gentle emotional lift into the chorus',
    compactProgression: 'I-vi-IV-V doo-wop progression',
    audibleEffect: 'gentle rocking sway, deeply nostalgic and easy to hum along',
    audibleEffectTag: 'gentle rocking sway, easy to hum',
    bestFor: ['시니어 채널 시그니처', '아침 라디오 오프닝'],
    compatibleWith: ['default', 'canon', 'warmCycle']
  },
  warmCycle: {
    id: 'warmCycle',
    label: 'Warm Cycle',
    labelKo: '따뜻한 순환 진행',
    description: '포근하게 순환하는 코드 진행. 시니어 채널의 편안한 트랙에 잘 어울립니다.',
    progressions: ['IV-I-V-vi'],
    prompt: 'warm cyclical progression IV-I-V-vi, comforting circular movement, gentle unresolved lift each time it loops back',
    compactProgression: 'IV-I-V-vi warm cycle progression',
    audibleEffect: 'soft circular pull that never fully lands, comforting and unresolved',
    audibleEffectTag: 'soft circular pull, comforting and unresolved',
    bestFor: ['편안한 트랙', '오후 무드'],
    compatibleWith: ['doowop', 'default', 'jazzColor']
  },
  royalRoad: {
    id: 'royalRoad',
    label: 'Royal Road (王道進行)',
    labelKo: '왕도진행',
    description: 'J-pop의 표준 진행이자 쇼와 감성의 핵심. 일본 채널의 시그니처로 적합합니다.',
    progressions: ['IV-V-iii-vi'],
    prompt: 'royal road progression IV-V-iii-vi, the standard J-pop chorus movement, bittersweet nostalgic lift, instantly familiar to Japanese listeners',
    compactProgression: 'IV-V-iii-vi royal road progression',
    audibleEffect: 'bittersweet lift that leans forward then settles, classic J-pop ache',
    audibleEffectTag: 'bittersweet lift, classic J-pop ache',
    bestFor: ['일본 채널 시그니처', 'J-pop 정체성'],
    compatibleWith: ['marusa', 'komuro', 'showaModern']
  },
  marusa: {
    id: 'marusa',
    label: 'Marusa (丸サ進行)',
    labelKo: '마루사 진행',
    description: '시티팝의 시그니처 진행. 세련되고 도시적인 밤 분위기.',
    progressions: ['IVM7-III7-vi-I7'],
    prompt: 'marusa progression IVM7-III7-vi-I7, city-pop signature harmony, sophisticated jazzy night-drive color, smooth secondary-dominant lift',
    compactProgression: 'IVM7-III7-vi-I7 marusa progression',
    audibleEffect: 'slick, late-night glide with a smooth jazzy turn',
    audibleEffectTag: 'slick late-night glide, jazzy turn',
    bestFor: ['시티팝 트랙', '나이트 드라이브 무드'],
    compatibleWith: ['cityPop', 'royalRoad', 'komuro']
  },
  komuro: {
    id: 'komuro',
    label: 'Komuro Cycle (小室進行)',
    labelKo: '고무로 진행',
    description: '일본 90년대 팝 프로덕션의 시그니처 순환 진행. 업템포 트랙에 힘을 더합니다.',
    progressions: ['vi-IV-V-I'],
    prompt: 'komuro-cycle progression vi-IV-V-I, driving 90s J-pop production movement, confident forward momentum, punchy chorus arrival',
    compactProgression: 'vi-IV-V-I komuro-cycle progression',
    audibleEffect: 'driving cyclic climb that keeps pulling to the next bar',
    audibleEffectTag: 'driving cyclic climb, forward pull',
    bestFor: ['업템포 트랙', '일본 채널 변주'],
    compatibleWith: ['royalRoad', 'marusa', 'cityPop']
  },
  // TASK v3.38 Part B4 — kids-channel progressions. kidsSimple is pinned to
  // cold-open/flagship (see signatureMoneyChordId below); the other three
  // rotate through the rest of the pack (moneyChordRotationPool).
  kidsSimple: {
    id: 'kidsSimple',
    label: 'Kids Simple',
    labelKo: '동요 기본 진행',
    description: '가장 단순하고 따라 부르기 쉬운 진행. 동요 채널의 시그니처로 적합합니다.',
    progressions: ['I-IV-V-I'],
    prompt: 'simplest children\'s song progression I-IV-V-I, easy to sing along, bright and predictable, clear resolution every phrase',
    compactProgression: 'I-IV-V-I progression',
    audibleEffect: 'clear, predictable resolution every phrase, easy for little voices to follow',
    audibleEffectTag: 'clear, predictable resolution every phrase',
    bestFor: ['동요 채널 시그니처', '따라 부르기 쉬운 트랙'],
    compatibleWith: ['kidsBright', 'kidsMarch', 'kidsRound']
  },
  kidsBright: {
    id: 'kidsBright',
    label: 'Kids Bright',
    labelKo: '동요 밝은 진행',
    description: '밝고 친숙한 동요용 진행.',
    progressions: ['I-V-vi-IV'],
    prompt: 'bright familiar children\'s pop progression I-V-vi-IV, cheerful and warm, easy sing-along hook',
    // TASK v3.38 Part B4 — distinct from 'default's identical-progression
    // text ('I-V-vi-IV progression'); tests/diversityLinter.test.ts requires
    // every preset's compactProgression to be mutually distinct even when
    // two presets share the same underlying Roman-numeral progression.
    compactProgression: 'I-V-vi-IV bright kids progression',
    audibleEffect: 'bouncy and cheerful, lands happily on every downbeat',
    audibleEffectTag: 'bouncy and cheerful, happy downbeat',
    bestFor: ['밝은 동요 트랙', '놀이 활동곡'],
    compatibleWith: ['kidsSimple', 'kidsMarch', 'kidsRound']
  },
  kidsMarch: {
    id: 'kidsMarch',
    label: 'Kids March',
    labelKo: '동요 행진곡풍 진행',
    description: '행진곡풍 율동 동요에 어울리는 진행.',
    progressions: ['I-IV-I-V'],
    prompt: 'bouncy marching children\'s song progression I-IV-I-V, skip-along rhythm feel, simple and confident',
    compactProgression: 'I-IV-I-V progression',
    audibleEffect: 'skips forward playfully like a marching game',
    audibleEffectTag: 'playful marching skip',
    bestFor: ['행진곡풍 동요', '율동·놀이 동작곡'],
    compatibleWith: ['kidsSimple', 'kidsBright', 'kidsRound']
  },
  // P0 fix (정합성 점검 §1) — the kids rotation pool had only 3 progressions
  // (moneyChordRotationPool below), which is mathematically incapable of
  // clearing designGate.ts's moneychord-max gate (<=5 songs on the same
  // progression) for an 18-song pack: 18/3 = 6 per progression even under a
  // perfectly even rotation. Real measurement: every kr-kids/jp-kids channel
  // (and senior-oldpop's own kids channel) failed this gate unconditionally.
  // A 4th progression makes an even split 18/4 = 4.5, clearing the <=5 floor.
  kidsRound: {
    id: 'kidsRound',
    label: 'Kids Round',
    labelKo: '동요 돌림노래풍 진행',
    description: '차분하고 감싸는 듯한 동요용 진행. 자장가·마무리 곡에도 어울립니다.',
    progressions: ['I-IV-vi-V'],
    prompt: 'gentle rounded children\'s song progression I-IV-vi-V, warm and cradling, settles softly at phrase end',
    compactProgression: 'I-IV-vi-V rounded kids progression',
    audibleEffect: 'settles softly and cradles each phrase, gentle rather than bouncy',
    audibleEffectTag: 'gentle cradling settle',
    bestFor: ['차분한 동요 트랙', '마무리·자장가곡'],
    compatibleWith: ['kidsSimple', 'kidsBright', 'kidsMarch']
  },
  // TASK v4.14 (TASK B, §2-2) — the one progression this task's own
  // palette-family money-chord distribution table names that had no
  // existing preset: none of the other 17 progressions above use exactly
  // "I-vi-ii-V" (doowop's I-vi-IV-V and jazzColor's ii-V-I turnaround are
  // both close but distinct). basis: 'estimated' per this task's own §9 —
  // general harmonic-theory knowledge, not yet verified against real
  // listening feedback for this channel.
  popStandard: {
    id: 'popStandard',
    label: 'Pop Standard Cycle',
    labelKo: '팝 스탠더드 순환',
    description: '50~60년대 팝 스탠더드에 흔한 순환 진행. 클래식한 팝 느낌.',
    progressions: ['I-vi-ii-V'],
    prompt: 'classic 1950s-60s pop standard cycle I-vi-ii-V, timeless songbook harmony, gentle circular movement, warm familiar resolution',
    compactProgression: 'I-vi-ii-V progression',
    audibleEffect: 'cycles through familiar songbook changes and resolves cleanly home',
    audibleEffectTag: 'familiar songbook cycle, clean resolve',
    bestFor: ['클래식한 팝 트랙', '오케스트럴·크루너 계열'],
    compatibleWith: ['jazzColor', 'default', 'canon']
  }
};

/**
 * TASK v3.33 Part C — each archetype's anchor progression: pinned to that
 * pack/set's cold-open + flagship tracks (core/moneyChordPlan.ts's
 * buildProgressionPlan) so the channel's harmonic identity is always
 * present on the tracks most likely to be heard first. 'default' for any
 * archetype without a dedicated signature (christmas/lofi-study/kids, or no
 * archetype at all) — unchanged behavior for those channels.
 */
export function signatureMoneyChordId(archetype: string | undefined): string {
  if (archetype === 'senior-morning') return 'doowop';
  if (archetype === 'showa-cafe') return 'royalRoad';
  if (archetype === 'showa-70s') return 'showaModern';
  if (archetype === 'j2000s') return 'komuro';
  if (archetype === 'modern-chill') return 'jazzColor';
  if (archetype === 'city-night') return 'cityPop';
  if (isKidsArchetype(archetype)) return 'kidsSimple';
  return 'default';
}

/**
 * TASK v3.33 Part C — the pool non-opener tracks rotate through (see
 * core/moneyChordPlan.ts's buildProgressionPlan), always including the
 * archetype's own signature so it isn't exclusively confined to the opener.
 * Archetypes without a dedicated signature don't get quota rotation at all
 * (see moneyChordPlan.ts's usesMoneyChordQuota) — this pool is only ever
 * consulted for senior-morning/showa-cafe.
 */
export function moneyChordRotationPool(archetype: string | undefined): string[] {
  if (archetype === 'senior-morning') return ['doowop', 'warmCycle', 'emotional', 'default', 'canon'];
  if (archetype === 'showa-cafe') return ['royalRoad', 'marusa', 'komuro', 'cityPop', 'showaModern'];
  if (archetype === 'showa-70s') return ['showaModern', 'royalRoad', 'marusa', 'doowop', 'emotional'];
  if (archetype === 'j2000s') return ['komuro', 'cityPop', 'default', 'canon', 'emotional'];
  if (archetype === 'modern-chill') return ['jazzColor', 'emotional', 'cityPop', 'default', 'canon'];
  if (archetype === 'city-night') return ['cityPop', 'marusa', 'jazzColor', 'komuro', 'default'];
  if (isKidsArchetype(archetype)) return ['kidsSimple', 'kidsBright', 'kidsMarch', 'kidsRound'];
  return ['default'];
}

const ROMAN_CHORD_TOKEN = /^(b|#)?(I|II|III|IV|V|VI|VII|i|ii|iii|iv|v|vi|vii)(°|\+)?(maj7|add9|sus2|sus4|dim7|dim|aug|m7|7|6|9)?$/;

export function isPlausibleChordProgression(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  const tokens = trimmed.split(/[\s/\-–>]+/).filter(Boolean);
  if (!tokens.length) return false;
  return tokens.every(token => ROMAN_CHORD_TOKEN.test(token));
}

export type MoneyChordMode = keyof typeof moneyChordPresets;

/**
 * v3.15 — "earworm" mode nudges the money chord toward whichever preset is
 * built on the most widely-shared pop progressions ('default': I-V-vi-IV /
 * vi-IV-I-V, or 'canon': the canon progression) — these are the least
 * preset-specific, most broadly-used progressions in the whole list, which is
 * exactly why they read as "familiar" rather than distinctive. A 'custom'
 * progression the user typed by hand, or an already-default/canon choice, is
 * left untouched — this only ever redirects an *unrelated* preset (e.g.
 * showaModern) when the mode is on, never overrides an explicit user choice
 * of their own custom text.
 */
/**
 * v5.7 (TASK v5.7, TASK A §1-3/§1-4) — added `isExplicitUserChoice` (default
 * false, so every pre-existing 2-arg call site — including
 * tests/earwormMode.test.ts's own locked-in "showaModern -> default"
 * expectation for the non-explicit case — keeps its exact prior behavior).
 * Real gap this closes: this function's own doc comment above already says
 * it "never overrides an explicit user choice of their own custom text", but
 * the code only ever exempted mode==='custom' — a user who explicitly picked
 * 'winterBallad' (or any other named preset) in Step2Concept's picker, with
 * earwormMode also checked, still got silently redirected to 'default',
 * contradicting the documented intent and reproducing this task's own §0-2
 * "① 사용자가 고른 머니코드가 0곡" symptom whenever earwormMode happened to be
 * on. A caller now opts into "this really is an explicit pick" via
 * GenerationOptions.moneyChordModeIsExplicitChoice (see that field's own doc
 * comment) rather than this function guessing from the mode value alone.
 */
export function resolveEarwormMoneyChordMode(mode: MoneyChordMode, earwormMode: boolean | undefined, isExplicitUserChoice = false): MoneyChordMode {
  if (!earwormMode || mode === 'custom' || mode === 'default' || mode === 'canon' || isExplicitUserChoice) return mode;
  return 'default';
}

/**
 * v5.8 (TASK 3) — exact/whole-text preset detection from a rendered style
 * prompt, formalizing the pattern tests/userChoicePreservation.test.ts's own
 * (inline, non-exported) classifyMoneyChord already used, so it's reusable
 * and directly tested here against the real overlap this task asked to
 * verify from the actual strings above (not a transcription):
 *
 * - the literal substring "vi-IV-I-V" appears inside cityPop's
 *   ('vi-IV-I-V movement, maj7 color'), emotional's ('I-V-vi-IV verses,
 *   vi-IV-I-V chorus lift'), AND winterBallad's ('vi-IV-I-V to I-V-vi-IV,
 *   final chorus key-up') own compactProgression text.
 * - the literal substring "I-V-vi-IV" appears inside default's
 *   ('I-V-vi-IV progression'), emotional's, winterBallad's, AND kidsBright's
 *   ('I-V-vi-IV bright kids progression') own compactProgression text.
 *
 * A detector that only checked for one of those bare numeral runs (the
 * pre-v3.14 approach this file's own MoneyChordPreset.compactProgression doc
 * comment describes — regex-extracting a Roman-numeral run out of `prompt`)
 * would misattribute any of these presets to each other. This instead checks
 * each preset's own FULL compactProgression text (never the bare numerals
 * alone) as a whole substring of the prompt, longest text first — so a
 * longer, more specific match (e.g. winterBallad's 44-character text) is
 * always preferred over a shorter preset whose text is one of its own
 * fragments, and is checked before it. 'custom' is excluded (never a fixed
 * compactProgression — compactMoneyChord embeds the user's own typed text
 * instead, see that function's own custom branch) and callers wanting to
 * detect a custom pick should check for the literal "custom progression"
 * prefix compactMoneyChord's custom branch emits.
 */
export function detectMoneyChordPreset(stylePrompt: string): MoneyChordMode | null {
  const entries = Object.entries(moneyChordPresets)
    .filter(([id]) => id !== 'custom')
    .sort((a, b) => b[1].compactProgression.length - a[1].compactProgression.length);
  for (const [id, preset] of entries) {
    if (stylePrompt.includes(preset.compactProgression)) return id as MoneyChordMode;
  }
  return null;
}
