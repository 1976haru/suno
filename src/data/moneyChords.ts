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
    bestFor: ['처음 만드는 곡', '대부분의 플레이리스트 트랙']
  },
  emotional: {
    id: 'emotional',
    label: 'Emotional Lift',
    labelKo: '감성 고조',
    description: '후렴에서 감정이 확 올라오는 느낌을 원할 때.',
    progressions: ['I-V-vi-IV', 'vi-IV-I-V'],
    prompt: 'emotional major-key pop progression, I-V-vi-IV in verses and vi-IV-I-V in chorus, strong but gentle lift into the hook',
    compactProgression: 'I-V-vi-IV verses, vi-IV-I-V chorus lift',
    bestFor: ['감정 절정 트랙', '늦은 밤 감성 곡']
  },
  jazzColor: {
    id: 'jazzColor',
    label: 'Jazz Color',
    labelKo: '재즈 컬러',
    description: '재즈 카페 느낌의 세련된 색채가 필요할 때.',
    progressions: ['Imaj7-V-vi7-IVadd9', 'ii-V-I turnaround'],
    prompt: 'major-key money chord progression with gentle maj7 and add9 color chords, occasional ii-V-I cafe jazz turnaround, warm adult contemporary harmony',
    compactProgression: 'ii-V-I turnaround, maj7 add9 color',
    bestFor: ['재즈 카페 채널', '어른스러운 무드']
  },
  cityPop: {
    id: 'cityPop',
    label: 'Soft City Pop',
    labelKo: '소프트 시티팝',
    description: '깔끔하고 세련된 도시적인 밤 분위기.',
    progressions: ['vi-IV-I-V', 'IVmaj7-iii7-vi7-ii7-V'],
    prompt: 'smooth city-pop friendly harmony, vi-IV-I-V movement, maj7 chords, gentle pre-chorus lift, nostalgic radio-friendly chorus',
    compactProgression: 'vi-IV-I-V movement, maj7 color',
    bestFor: ['일본 채널', '나이트 드라이브 무드']
  },
  canon: {
    id: 'canon',
    label: 'Canon Progression',
    labelKo: '캐논 진행',
    description: '감정이 최고조로 차오르는 캐논 진행. 연말·크리스마스 이브 곡에 잘 어울립니다.',
    progressions: ['I-V-vi-iii-IV-I-IV-V'],
    prompt: 'classic canon progression I-V-vi-iii-IV-I-IV-V, cinematic emotional build, orchestral-pop warmth, climactic chorus lift',
    compactProgression: 'I-V-vi-iii-IV-I-IV-V progression',
    bestFor: ['연말/크리스마스 이브 곡', '감정 최고조 트랙']
  },
  showaModern: {
    id: 'showaModern',
    label: 'Showa Modern',
    labelKo: '쇼와 모던',
    description: '일본 쇼와 모던 찻집(喫茶店) 분위기의 진행. 일본 채널 전용.',
    progressions: ['IVmaj7-iii7-vi7'],
    prompt: 'showa-modern kissaten harmony centered on IVmaj7-iii7-vi7 movement, warm mellow jazz-pop color, refined nostalgic Japanese cafe mood',
    compactProgression: 'IVmaj7-iii7-vi7 movement',
    bestFor: ['일본 채널', '쇼와 모던 카페 컨셉']
  },
  winterBallad: {
    id: 'winterBallad',
    label: 'Winter Ballad',
    labelKo: '겨울 발라드',
    description: '벌스는 차분하게, 후렴은 밝게, 마지막 후렴에서 반음 상승으로 마무리.',
    progressions: ['vi-IV-I-V (verse)', 'I-V-vi-IV (chorus)'],
    prompt: 'winter ballad harmony, vi-IV-I-V in verses building to I-V-vi-IV in chorus, gentle key-up half-step modulation on the final chorus only',
    compactProgression: 'vi-IV-I-V to I-V-vi-IV, final chorus key-up',
    bestFor: ['겨울 발라드', '마지막 트랙(클로저)']
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
    bestFor: ['직접 코드 진행을 지정하고 싶을 때']
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
    bestFor: ['시니어 채널 시그니처', '아침 라디오 오프닝']
  },
  warmCycle: {
    id: 'warmCycle',
    label: 'Warm Cycle',
    labelKo: '따뜻한 순환 진행',
    description: '포근하게 순환하는 코드 진행. 시니어 채널의 편안한 트랙에 잘 어울립니다.',
    progressions: ['IV-I-V-vi'],
    prompt: 'warm cyclical progression IV-I-V-vi, comforting circular movement, gentle unresolved lift each time it loops back',
    compactProgression: 'IV-I-V-vi warm cycle progression',
    bestFor: ['편안한 트랙', '오후 무드']
  },
  royalRoad: {
    id: 'royalRoad',
    label: 'Royal Road (王道進行)',
    labelKo: '왕도진행',
    description: 'J-pop의 표준 진행이자 쇼와 감성의 핵심. 일본 채널의 시그니처로 적합합니다.',
    progressions: ['IV-V-iii-vi'],
    prompt: 'royal road progression IV-V-iii-vi, the standard J-pop chorus movement, bittersweet nostalgic lift, instantly familiar to Japanese listeners',
    compactProgression: 'IV-V-iii-vi royal road progression',
    bestFor: ['일본 채널 시그니처', 'J-pop 정체성']
  },
  marusa: {
    id: 'marusa',
    label: 'Marusa (丸サ進行)',
    labelKo: '마루사 진행',
    description: '시티팝의 시그니처 진행. 세련되고 도시적인 밤 분위기.',
    progressions: ['IVM7-III7-vi-I7'],
    prompt: 'marusa progression IVM7-III7-vi-I7, city-pop signature harmony, sophisticated jazzy night-drive color, smooth secondary-dominant lift',
    compactProgression: 'IVM7-III7-vi-I7 marusa progression',
    bestFor: ['시티팝 트랙', '나이트 드라이브 무드']
  },
  komuro: {
    id: 'komuro',
    label: 'Komuro Cycle (小室進行)',
    labelKo: '고무로 진행',
    description: '일본 90년대 팝 프로덕션의 시그니처 순환 진행. 업템포 트랙에 힘을 더합니다.',
    progressions: ['vi-IV-V-I'],
    prompt: 'komuro-cycle progression vi-IV-V-I, driving 90s J-pop production movement, confident forward momentum, punchy chorus arrival',
    compactProgression: 'vi-IV-V-I komuro-cycle progression',
    bestFor: ['업템포 트랙', '일본 채널 변주']
  },
  // TASK v3.38 Part B4 — kids-channel progressions. kidsSimple is pinned to
  // cold-open/flagship (see signatureMoneyChordId below); the other two
  // rotate through the rest of the pack (moneyChordRotationPool).
  kidsSimple: {
    id: 'kidsSimple',
    label: 'Kids Simple',
    labelKo: '동요 기본 진행',
    description: '가장 단순하고 따라 부르기 쉬운 진행. 동요 채널의 시그니처로 적합합니다.',
    progressions: ['I-IV-V-I'],
    prompt: 'simplest children\'s song progression I-IV-V-I, easy to sing along, bright and predictable, clear resolution every phrase',
    compactProgression: 'I-IV-V-I progression',
    bestFor: ['동요 채널 시그니처', '따라 부르기 쉬운 트랙']
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
    bestFor: ['밝은 동요 트랙', '놀이 활동곡']
  },
  kidsMarch: {
    id: 'kidsMarch',
    label: 'Kids March',
    labelKo: '동요 행진곡풍 진행',
    description: '행진곡풍 율동 동요에 어울리는 진행.',
    progressions: ['I-IV-I-V'],
    prompt: 'bouncy marching children\'s song progression I-IV-I-V, skip-along rhythm feel, simple and confident',
    compactProgression: 'I-IV-I-V progression',
    bestFor: ['행진곡풍 동요', '율동·놀이 동작곡']
  }
};

/**
 * TASK v3.33 Part C — real listening feedback: the progression name alone
 * ("I-V-vi-IV progression") reaches Suno as a bare label, which the model
 * renders vaguely. Always paired with the compact progression tag (see
 * core/soundSignature.ts's compactMoneyChord), never trimmed away (the
 * moneyChord atom is ESSENTIAL — see core/promptComposer.ts/promptBudget.ts —
 * so appending it here inherits that never-dropped guarantee for free
 * instead of needing a new atom/priority-list entry). Deliberately compact
 * (~14 words) — the brief's longer example sentence was compressed the same
 * way v3.15's EARWORM_STYLE_ATOMS was: composeStylePrompt's real budget is a
 * soft 50-word cap across every essential atom combined, and the full
 * verbose form would eat into that on every single song.
 */
export const MONEY_CHORD_FEEL_SUFFIX = 'hook lands on the downbeat, clear on-beat chord changes, bass on the root, strong chorus lift';

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
  if (archetype === 'kids') return 'kidsSimple';
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
  if (archetype === 'kids') return ['kidsSimple', 'kidsBright', 'kidsMarch'];
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
export function resolveEarwormMoneyChordMode(mode: MoneyChordMode, earwormMode: boolean | undefined): MoneyChordMode {
  if (!earwormMode || mode === 'custom' || mode === 'default' || mode === 'canon') return mode;
  return 'default';
}
