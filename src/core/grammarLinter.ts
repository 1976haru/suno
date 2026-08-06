/**
 * TASK v5.21 (TASK G) — real, measured error from a live bridge-imported
 * pack's lyrics: T14 sang "I said that suited you and I" (should be "you
 * and me" — "suited" governs both "you" and the first person pronoun as
 * its object, so the objective case "me" is required, not the nominative
 * "I"). This module is deliberately narrow: only the well-specified,
 * low-false-positive checks the task doc itself asked for (§7-2's own
 * "문법" list) are implemented; contorted-metaphor/imagery quality (§7-2's
 * own "자연스러움") is explicitly NOT something this module attempts — the
 * task doc's own reasoning is that it's not reliably automatable and
 * belongs in the bridge instruction's own guidance text instead (see
 * core/bridgeInstruction.ts's own LYRIC_IMAGERY_GUIDANCE block).
 */

export interface GrammarFinding {
  /** The exact matched text, for display/dedup. */
  match: string;
  /** Human-readable Korean explanation, ready to push into a blocking/advisory list. */
  messageKo: string;
}

/**
 * "you and I" (or any noun/pronoun + "and I") used as an OBJECT instead of
 * a subject — the real T14 error. Two patterns:
 *  1. Preposition-anchored ("for you and I", "between him and I") — always
 *     wrong regardless of what follows, since a preposition always takes
 *     the objective case.
 *  2. Clause-final "X and I" (followed by punctuation, a line break, or
 *     the end of the string, never a verb) — covers the real T14 case
 *     ("...suited you and I" ends the clause) without flagging a
 *     legitimate compound SUBJECT like "You and I are happy" (where a verb
 *     follows "I", not a clause boundary).
 */
const PREPOSITION_AND_I_PATTERN = /\b(for|between|with|to|of|about|from|near|behind|beside|toward|against)\s+\w+\s+and\s+I\b/gi;
const CLAUSE_FINAL_AND_I_PATTERN = /\b\w+\s+and\s+I\b(?=[.,!?;]|\s*\n|\s*$)/gm;

function findObjectiveCaseErrors(text: string): GrammarFinding[] {
  const findings: GrammarFinding[] = [];
  const seen = new Set<string>();
  for (const pattern of [PREPOSITION_AND_I_PATTERN, CLAUSE_FINAL_AND_I_PATTERN]) {
    for (const match of text.matchAll(pattern)) {
      const key = match[0].toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        match: match[0],
        messageKo: `목적격 오류로 보입니다: "${match[0]}" — 전치사·동사의 목적어 자리이므로 "I"가 아니라 "me"를 써야 합니다.`
      });
    }
  }
  return findings;
}

/**
 * "a apple", "a hour" — 'a' before a vowel SOUND needs 'an'. Deliberately
 * narrow: only checks 'a'/'an' immediately before a word starting with a
 * vowel LETTER (a/e/i/o/u), which is right far more often than wrong in
 * plain English lyrics (real exceptions like "a university"/"an honest"
 * are rare enough in this app's own generated lyric style that a stricter
 * phonetic ruleset isn't worth the added complexity for an advisory-only
 * check).
 */
const ARTICLE_A_BEFORE_VOWEL_PATTERN = /\ba\s+([aeiouAEIOU]\w*)\b/g;
const ARTICLE_AN_BEFORE_CONSONANT_PATTERN = /\ban\s+([^aeiouAEIOU\s]\w*)\b/g;

function findArticleErrors(text: string): GrammarFinding[] {
  const findings: GrammarFinding[] = [];
  for (const match of text.matchAll(ARTICLE_A_BEFORE_VOWEL_PATTERN)) {
    findings.push({ match: match[0], messageKo: `관사 오류로 보입니다: "${match[0]}" — 모음으로 시작하는 단어 앞에는 "an"을 씁니다.` });
  }
  for (const match of text.matchAll(ARTICLE_AN_BEFORE_CONSONANT_PATTERN)) {
    // 'an hour'/'an honest' (silent h) are real, common exceptions —
    // excluded outright rather than risk a wrong flag on a correct lyric.
    if (/^h(our|onest|onor|eir)/i.test(match[1])) continue;
    findings.push({ match: match[0], messageKo: `관사 오류로 보입니다: "${match[0]}" — 자음으로 시작하는 단어 앞에는 "a"를 씁니다.` });
  }
  return findings;
}

/**
 * Narrow, high-confidence subject-verb agreement check: a definite plural
 * quantifier/determiner ("the", "these", "those", "two", "three", ... "ten",
 * "many", "several") immediately followed by a plural noun (ends in -s,
 * excluding common false-plural words) immediately followed by a singular
 * verb ("was"/"is"/"has"). Deliberately does NOT attempt the general case
 * (a bare plural noun with no determiner, e.g. "years was") — too many
 * legitimate ways to open a lyric line with an implied subject for that to
 * stay low-false-positive.
 */
const PLURAL_DETERMINERS = /\b(the|these|those|two|three|four|five|six|seven|eight|nine|ten|many|several|all|both)\b/i;
const SUBJECT_VERB_PATTERN = /\b(the|these|those|two|three|four|five|six|seven|eight|nine|ten|many|several|all|both)\s+(\w+s)\s+(was|is|has)\b/gi;
const FALSE_PLURAL_NOUNS = new Set(['always', 'news', 'focus', 'bus', 'across', 'this', 'his', 'yes', 'gas', 'plus']);

function findSubjectVerbErrors(text: string): GrammarFinding[] {
  const findings: GrammarFinding[] = [];
  for (const match of text.matchAll(SUBJECT_VERB_PATTERN)) {
    const noun = match[2].toLowerCase();
    if (FALSE_PLURAL_NOUNS.has(noun) || !PLURAL_DETERMINERS.test(match[1])) continue;
    findings.push({
      match: match[0],
      messageKo: `주어-동사 불일치로 보입니다: "${match[0]}" — 복수 주어에는 "were/are/have"를 씁니다.`
    });
  }
  return findings;
}

export interface GrammarLintResult {
  /** Objective-case errors ("you and I" as an object) — unambiguous enough to block. */
  blocking: GrammarFinding[];
  /** Article/subject-verb findings — real but narrower rules with more edge cases, kept advisory. */
  advisory: GrammarFinding[];
}

/**
 * TASK v5.21 (TASK G) — scans lyrics text (never stylePrompt — a style
 * prompt is app-assembled keyword fragments, not English prose, so these
 * grammar rules don't apply there) for the checks above. Never throws;
 * empty input returns empty results.
 */
export function lintGrammar(lyrics: string): GrammarLintResult {
  const text = String(lyrics || '');
  if (!text.trim()) return { blocking: [], advisory: [] };
  return {
    blocking: findObjectiveCaseErrors(text),
    advisory: [...findArticleErrors(text), ...findSubjectVerbErrors(text)]
  };
}
