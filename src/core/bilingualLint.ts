/**
 * TASK E1 §6-4 — enforces the research material's insertion rules for a
 * learning-language-pair song (Korean base + English target words):
 * exactly 3-5 distinct target-language words, each repeated at least
 * twice (the whole point being repetition for learning), no English verb
 * conjugation (nouns/greetings only), and — the rule real generation
 * doesn't reliably follow from a prompt alone (E1 §6-4's own note: "이건
 * 이 프로젝트에서 여러 번 확인된 사실") — no base-language particle glued
 * directly onto an English token with no space.
 *
 * TASK E1 §6-3/§12 item 12 — Korean-particle-glue detection only for now.
 * F1's own handoff (§12) is to add the equivalent check for Japanese
 * particles (を/に/が/...) when it reuses this same function for a
 * Japanese-base pair.
 */
const KOREAN_GLUE_PATTERN = /[A-Za-z]+[가-힣]/g;
const ENGLISH_TOKEN_PATTERN = /\b[A-Za-z]+\b/g;

export interface BilingualLintOptions {
  minWords?: number;
  maxWords?: number;
  minRepeats?: number;
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
  const { minWords = 3, maxWords = 5, minRepeats = 2 } = opts;
  const issues: string[] = [];
  const lyricOnly = stripStructuralTags(text);

  const glued = lyricOnly.match(KOREAN_GLUE_PATTERN);
  if (glued) issues.push(`target-language token has a base-language particle glued directly on with no space: ${[...new Set(glued)].join(', ')}`);

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
