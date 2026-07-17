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
  }
};

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
