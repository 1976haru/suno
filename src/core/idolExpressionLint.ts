/**
 * TASK K3 §7 — the idol workspaces' own hard constraint, not a warning.
 * §7-3's own reasoning: "프롬프트 지시만으로는 일관되게 지켜지지 않습니다" — this
 * is a real scan of actually-generated content (title/hook/lyrics/style
 * prompt), checked against two banned-word lists, reported per field/word
 * so a caller knows exactly what tripped and where. §7-3's own explicit
 * instruction: "이 린터는 K2에도 적용하십시오" — this file has no
 * kr-idol-female-only logic in it; it's called identically against
 * kr-idol-male's own real output in K3's own report (see docs/k3-report.md
 * §13-1[1]), never against K2's data files themselves (which stay
 * untouched per §11-2/§0-1).
 */

export type IdolExpressionCategory = 'sexual-objectification' | 'minor-coding';
export type IdolExpressionField = 'title' | 'hookPhrase' | 'lyrics' | 'stylePrompt';

export interface IdolExpressionViolation {
  field: IdolExpressionField;
  category: IdolExpressionCategory;
  word: string;
}

/**
 * §7-1 — sexual-objectification vocabulary: body-part/exposure descriptions,
 * seduction/possession framing. English words that risk colliding with
 * innocuous text ("body" inside "everybody"/"anybody") are matched with a
 * word-boundary regex rather than plain substring, unlike the Korean list
 * (Korean has no equivalent \b tokenization convention in this codebase —
 * see D1's own kidsVocabularyWhitelist.ts for the same established choice).
 */
const SEXUAL_OBJECTIFICATION_EN = ['sultry', 'seductive', 'body', 'curves', 'curvy', 'tease', 'teasing', 'cleavage', 'provocative', 'skin-tight', 'bare skin', 'exposed skin', 'sensual body'];
const SEXUAL_OBJECTIFICATION_KO = ['몸매', '유혹', '노출', '섹시', '관능적인', '소유욕', '몸을'];

/**
 * §7-2 — minor-coding vocabulary, the doc's own explicit measurement list
 * (§10's own code snippet) plus natural extensions ('kindergarten' — the
 * exact word §0-2 found leaking through vocalDescriptionFor's kids branch
 * when an archetype argument is omitted; the rest fill out the same age-
 * coding family the doc names but doesn't spell out in full).
 */
// TASK K3 §7-2 — 'minor' was in an earlier draft and removed after a real
// false-positive hit: style prompts routinely say "minor verse opening into
// a major final chorus" (music-theory key vocabulary), which has nothing to
// do with age-coding but would trip on 'minor' as a bare word. 'underage'
// carries no such collision risk and stays.
const MINOR_CODING_EN = ['kindergarten', 'childlike', 'teen', 'schoolgirl', 'young girl', 'baby', 'girlish', 'underage'];
const MINOR_CODING_KO = ['교복', '학생', '소녀', '어린', '초등학생', '중학생', '고등학생', '미성년'];

function wordBoundaryIncludes(haystackLower: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(haystackLower);
}

function scanField(field: IdolExpressionField, text: string): IdolExpressionViolation[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const violations: IdolExpressionViolation[] = [];
  for (const word of SEXUAL_OBJECTIFICATION_EN) {
    if (wordBoundaryIncludes(lower, word)) violations.push({ field, category: 'sexual-objectification', word });
  }
  for (const word of SEXUAL_OBJECTIFICATION_KO) {
    if (text.includes(word)) violations.push({ field, category: 'sexual-objectification', word });
  }
  for (const word of MINOR_CODING_EN) {
    if (wordBoundaryIncludes(lower, word)) violations.push({ field, category: 'minor-coding', word });
  }
  for (const word of MINOR_CODING_KO) {
    if (text.includes(word)) violations.push({ field, category: 'minor-coding', word });
  }
  return violations;
}

/**
 * Scans every field §13-1[1] requires (title/hook/lyrics/style prompt).
 * Empty array means clean — this is the hard-gate condition §10 items 7-8
 * require (0 violations, not "report and continue").
 */
export function lintIdolExpression(song: { title: string; hookPhrase?: string; lyrics: string; stylePrompt: string }): IdolExpressionViolation[] {
  return [
    ...scanField('title', song.title),
    ...scanField('hookPhrase', song.hookPhrase ?? ''),
    ...scanField('lyrics', song.lyrics),
    ...scanField('stylePrompt', song.stylePrompt)
  ];
}
