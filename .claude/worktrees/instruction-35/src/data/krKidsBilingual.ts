/**
 * TASK E1 §6 — hand-authored Korean-base/English-target bilingual content
 * for the krkids-bilingual genre's 3 themes (color/number/greeting). §6-2's
 * own reading of the research material: "영어 단어 + 한국어 문장", not
 * English lyrics — every line below keeps Korean sentence structure and
 * only swaps in one English noun/greeting per line, always separated from
 * the following Korean copula/particle by a space (§6-4's "영어가 조사에
 * 붙지 않게" rule) so core/bilingualLint.ts's glue check passes.
 *
 * Each concept uses exactly 3 distinct English words (within §6-4's 3-5
 * range): one carried by the hook (repeats automatically via the chorus
 * structure) and one each introduced twice within verse1/verse2 — satisfying
 * the "같은 단어를 최소 2회 반복" rule without relying on chorus repetition
 * alone. Verified end-to-end against bilingualLint in docs/e1-report.md
 * §13-1[7].
 */
export type KrKidsBilingualConcept = 'color' | 'number' | 'greeting';

export interface BilingualVersePair {
  hookLine: string;
  verse1: [string, string];
  verse2: [string, string];
  englishWords: [string, string, string];
}

const BILINGUAL_CONTENT: Record<KrKidsBilingualConcept, BilingualVersePair> = {
  color: {
    hookLine: '빨강은 red 예요',
    verse1: ['노랑은 yellow 예요', '다시 봐도 yellow 예요'],
    verse2: ['파랑은 blue 예요', '하늘도 blue 예요'],
    englishWords: ['red', 'yellow', 'blue']
  },
  number: {
    hookLine: '하나는 one 이에요',
    verse1: ['둘은 two 예요', '다시 세도 two 예요'],
    verse2: ['셋은 three 예요', '손가락도 three 예요'],
    englishWords: ['one', 'two', 'three']
  },
  greeting: {
    hookLine: '안녕은 hello 예요',
    verse1: ['잘 가는 bye 예요', '다시 만나도 bye 예요'],
    verse2: ['친구는 friend 예요', '우리는 friend 예요'],
    englishWords: ['hello', 'bye', 'friend']
  }
};

export function bilingualContentFor(concept: KrKidsBilingualConcept): BilingualVersePair {
  return BILINGUAL_CONTENT[concept];
}

const CONCEPT_BY_THEME_ID: Record<string, KrKidsBilingualConcept> = {
  'krkids-color-in-english': 'color',
  'krkids-number-in-english': 'number',
  'krkids-greeting-in-english': 'greeting'
};

export function krKidsBilingualConceptForThemeId(id: string | undefined): KrKidsBilingualConcept | undefined {
  return id ? CONCEPT_BY_THEME_ID[id] : undefined;
}
