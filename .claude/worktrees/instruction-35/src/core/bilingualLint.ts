/**
 * TASK E1 §6-4 — enforces the research material's insertion rules for a
 * learning-language-pair song (base language + English target words):
 * exactly 3-5 distinct target-language words, each repeated at least
 * twice (the whole point being repetition for learning), no English verb
 * conjugation (nouns/greetings only), and — the rule real generation
 * doesn't reliably follow from a prompt alone (E1 §6-4's own note: "이건
 * 이 프로젝트에서 여러 번 확인된 사실") — no base-language particle
 * attaching to an English token instead of the base-language word.
 *
 * TASK F1 §6-3 — `baseLanguage` defaults to 'korean', reproducing E1's
 * exact original behavior (Korean glue check only) for every existing
 * caller. Passing 'japanese' additionally checks Japanese case particles
 * (を/に/が/は/の/と/で/へ) — F1's own measurement found the violation
 * doesn't require the particle to be glued with no space the way Korean's
 * does ("red を さがそう" is still wrong even with a space, because を is
 * grammatically marking "red" as its own host) — and adds a katakana check
 * (§6-4: writing the target word in katakana instead of Latin script
 * defeats the point of English word-learning).
 */
const KOREAN_GLUE_PATTERN = /[A-Za-z]+[가-힣]/g;
const JAPANESE_PARTICLE_AFTER_ENGLISH_PATTERN = /\b[A-Za-z]+\s*(を|に|が|は|の|と|で|へ)/g;
const ENGLISH_TOKEN_PATTERN = /\b[A-Za-z]+\b/g;

/**
 * TASK F1 §6-4 — a small known set covering the vocabulary this workspace's
 * own bilingual content (data/jpKidsBilingual.ts) actually uses. Katakana-
 * loanword detection in general is a much larger NLP problem than this
 * task's scope; extend this list alongside any new target words.
 */
const KATAKANA_TARGET_WORDS: Record<string, string> = {
  レッド: 'red', イエロー: 'yellow', ブルー: 'blue',
  ワン: 'one', トゥー: 'two', スリー: 'three',
  ハロー: 'hello', バイ: 'bye', フレンド: 'friend'
};

export interface BilingualLintOptions {
  minWords?: number;
  maxWords?: number;
  minRepeats?: number;
  baseLanguage?: 'korean' | 'japanese';
}

/** [short intro] / [chorus] / ... structural tags are English words but not lyric content — never count as target-language vocabulary. */
function stripStructuralTags(text: string): string {
  return text
    .split('\n')
    .filter(line => !/^\s*\[.*\]\s*$/.test(line))
    .join('\n');
}

/** "red"/"bye" end in "ed"/"ing"-like letters purely by coincidence — only flag plausible conjugated verbs (a real stem left after stripping the suffix). */
function looksConjugated(word: string): boolean {
  if (/ing$/i.test(word) && word.length > 5) return true;
  if (/ed$/i.test(word) && word.length > 4) return true;
  return false;
}

export function bilingualLint(text: string, opts: BilingualLintOptions = {}): string[] {
  const { minWords = 3, maxWords = 5, minRepeats = 2, baseLanguage = 'korean' } = opts;
  const issues: string[] = [];
  const lyricOnly = stripStructuralTags(text);

  if (baseLanguage === 'japanese') {
    const particleMatches = [...lyricOnly.matchAll(JAPANESE_PARTICLE_AFTER_ENGLISH_PATTERN)].map(m => m[0].trim());
    if (particleMatches.length) issues.push(`target-language token takes a Japanese case particle directly, even with a space before it: ${[...new Set(particleMatches)].join(', ')}`);

    const katakanaHits = Object.keys(KATAKANA_TARGET_WORDS).filter(k => lyricOnly.includes(k));
    if (katakanaHits.length) issues.push(`target word written in katakana instead of Latin script: ${katakanaHits.map(k => `${k}(${KATAKANA_TARGET_WORDS[k]})`).join(', ')}`);
  } else {
    const glued = lyricOnly.match(KOREAN_GLUE_PATTERN);
    if (glued) issues.push(`target-language token has a base-language particle glued directly on with no space: ${[...new Set(glued)].join(', ')}`);
  }

  const tokens = lyricOnly.match(ENGLISH_TOKEN_PATTERN) ?? [];
  const counts = new Map<string, number>();
  for (const token of tokens) {
    const lower = token.toLowerCase();
    counts.set(lower, (counts.get(lower) ?? 0) + 1);
  }

  const uniqueWords = [...counts.keys()];
  if (uniqueWords.length < minWords || uniqueWords.length > maxWords) {
    issues.push(`target-language word count ${uniqueWords.length} outside ${minWords}-${maxWords}: ${uniqueWords.join(', ')}`);
  }

  const underRepeated = uniqueWords.filter(word => (counts.get(word) ?? 0) < minRepeats);
  if (underRepeated.length) issues.push(`target-language words repeated fewer than ${minRepeats} times: ${underRepeated.join(', ')}`);

  const conjugated = uniqueWords.filter(looksConjugated);
  if (conjugated.length) issues.push(`target-language word looks like a conjugated verb, not a noun/greeting: ${conjugated.join(', ')}`);

  return issues;
}

export function isBilingualLintClean(text: string, opts?: BilingualLintOptions): boolean {
  return bilingualLint(text, opts).length === 0;
}
