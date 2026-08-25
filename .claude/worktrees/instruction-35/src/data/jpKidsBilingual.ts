/**
 * TASK F1 §6 — Japanese-base/English-target bilingual content, reusing E1's
 * exact structure (data/krKidsBilingual.ts's own BilingualVersePair shape
 * and §6-1's "필드 정의를 수정하지 마십시오" instruction — nothing in
 * krKidsBilingual.ts is touched). Same insertion rules as E1 (§6-2, "영어
 * 단어 + 한국어 문장" reapplied as "英語 + 日本語文"): each line keeps
 * Japanese sentence structure and only swaps in one English noun/greeting
 * per line, always separated from surrounding Japanese by a space so
 * core/bilingualLint.ts's baseLanguage:'japanese' particle check passes,
 * and always in Latin script (never katakana — §6-4).
 */
import type { BilingualVersePair } from './krKidsBilingual';
import type { KrKidsBilingualConcept } from './krKidsBilingual';

export type JpKidsBilingualConcept = KrKidsBilingualConcept;

const BILINGUAL_CONTENT: Record<JpKidsBilingualConcept, BilingualVersePair> = {
  color: {
    hookLine: 'あかは red だよ',
    verse1: ['きいろは yellow だよ', 'また見ても yellow だよ'],
    verse2: ['あおは blue だよ', 'そらも blue だよ'],
    englishWords: ['red', 'yellow', 'blue']
  },
  number: {
    hookLine: 'いちは one だよ',
    verse1: ['にで two だよ', 'また数えても two だよ'],
    verse2: ['さんで three だよ', 'ゆびでも three だよ'],
    englishWords: ['one', 'two', 'three']
  },
  greeting: {
    hookLine: 'こんにちはは hello だよ',
    verse1: ['ばいばいは bye だよ', 'また会うのも bye だよ'],
    verse2: ['ともだちは friend だよ', 'みんなも friend だよ'],
    englishWords: ['hello', 'bye', 'friend']
  }
};

export function jpBilingualContentFor(concept: JpKidsBilingualConcept): BilingualVersePair {
  return BILINGUAL_CONTENT[concept];
}

const CONCEPT_BY_THEME_ID: Record<string, JpKidsBilingualConcept> = {
  'jpkids-color-in-english': 'color',
  'jpkids-number-in-english': 'number',
  'jpkids-greeting-in-english': 'greeting'
};

export function jpKidsBilingualConceptForThemeId(id: string | undefined): JpKidsBilingualConcept | undefined {
  return id ? CONCEPT_BY_THEME_ID[id] : undefined;
}
