import { extractQualifyingLines } from './lyricLineLedger';

/**
 * v5.22 (AXIS 3) — real, verified gap this module fixes: this codebase had
 * no English grammar/style linter at all (bilingualLint.ts/diversityLinter.ts/
 * idolExpressionLint.ts/idolTitleLint.ts cover language-mix ratio, pack
 * diversity, and idol-specific phrasing — none of them check grammar). A
 * real audit found case-pronoun errors ("for you and I"), missing -ly
 * adverbs ("rose gentle"), and in-song sentence repetition in generated
 * lyrics with nothing catching them before they reached Suno.
 *
 * Deliberately regex/wordlist-based, not a full NLP parser — this codebase
 * has no NLP dependency and adding one for this alone isn't justified. Each
 * check is documented with its own precision tradeoff; blocking checks are
 * kept to patterns with LOW false-positive risk (the wordlists below are
 * curated, not exhaustive), and forced-metaphor detection (abstract-noun
 * chains) is advisory-only per the task spec's own "억지 비유는 지시문으로
 * 다루십시오" — that one is a prompt-engineering problem, not a linting one.
 */

export type EnglishLintSeverity = 'blocking' | 'advisory';

export interface EnglishLintIssue {
  id: string;
  severity: EnglishLintSeverity;
  labelKo: string;
  /** The exact matched substring, for display. */
  excerpt: string;
}

// ---------------------------------------------------------------------------
// Blocking — case pronoun after a preposition or as a verb's object
// ---------------------------------------------------------------------------
// "for you and I" / "between he and I" / "told she and I" — a subject-form
// pronoun (I/he/she/we/they) used where object form (me/him/her/us/them) is
// grammatically required. Scoped to the real, common "X and <pronoun>"
// coordination shape (by far the most common real occurrence of this error
// — a lone case error, "for I", is rare enough in generated lyrics that a
// narrower pattern avoids chasing rarer shapes at higher false-positive
// risk) after either a preposition or one of a short list of ditransitive
// verbs (told, gave, showed, asked, let, sent, brought, left).
const SUBJECT_PRONOUNS = ['I', 'he', 'she', 'we', 'they'];
const PREPOSITIONS = ['for', 'between', 'with', 'to', 'from', 'about', 'against', 'near', 'besides', 'without', 'beside'];
// v5.22 — 'suited' added after a real observed error ("I said that suited
// you and I") confirmed the same case-pronoun-as-object shape extends past
// strictly ditransitive verbs; kept to verbs that plausibly take a person
// (or "you/him/her ... and I") as a direct object, not widened generally.
const DITRANSITIVE_VERBS = ['told', 'gave', 'showed', 'asked', 'let', 'sent', 'brought', 'left', 'taught', 'promised', 'suited', 'matched', 'joined'];

function buildCasePronounPattern(leadWords: string[]): RegExp {
  const leads = leadWords.join('|');
  const pronouns = SUBJECT_PRONOUNS.join('|');
  // "<lead> ... and <PRONOUN>" — up to 2 words of "X" between lead and "and", covering "for you and I" / "between he and I".
  return new RegExp(`\\b(${leads})\\s+(?:\\w+\\s+){0,2}and\\s+(${pronouns})\\b`, 'gi');
}

const CASE_PRONOUN_PATTERNS = [buildCasePronounPattern(PREPOSITIONS), buildCasePronounPattern(DITRANSITIVE_VERBS)];

function findCasePronounErrors(text: string): EnglishLintIssue[] {
  const issues: EnglishLintIssue[] = [];
  for (const pattern of CASE_PRONOUN_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      issues.push({ id: 'case-pronoun', severity: 'blocking', labelKo: '전치사/동사 뒤 주격 대명사 오류', excerpt: match[0] });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Blocking — adjective used where an adverb is required (missing -ly)
// ---------------------------------------------------------------------------
// "rose gentle" / "moved quiet" / "sang soft" — a curated verb list (common
// past-tense lyric verbs describing manner of motion/speech/emotion) each
// immediately followed by a curated adjective/adverb pair's BARE adjective
// form. Curated (not a general "any adjective after any verb" rule) to keep
// false-positive risk low — a bare adjective can be correct after many
// verbs ("felt gentle", "grew quiet", "stayed soft" are all fine as
// predicate adjectives), so this only fires for MANNER verbs where the
// adjective form is essentially never correct.
const MANNER_VERBS = ['rose', 'moved', 'sang', 'walked', 'spoke', 'smiled', 'whispered', 'drifted', 'danced', 'ran', 'cried', 'called', 'answered', 'laughed', 'breathed', 'turned', 'reached', 'pulled', 'pushed', 'closed', 'opened', 'fell', 'landed', 'settled', 'arrived', 'left', 'passed'];
const ADJECTIVE_ADVERB_PAIRS: [string, string][] = [
  ['gentle', 'gently'], ['quiet', 'quietly'], ['soft', 'softly'], ['slow', 'slowly'], ['sudden', 'suddenly'],
  ['careful', 'carefully'], ['easy', 'easily'], ['warm', 'warmly'], ['bright', 'brightly'], ['calm', 'calmly'],
  ['steady', 'steadily'], ['tender', 'tenderly'], ['sweet', 'sweetly'], ['light', 'lightly'], ['heavy', 'heavily'],
  ['quick', 'quickly'], ['low', 'lowly'], ['smooth', 'smoothly'], ['deep', 'deeply']
];

function findAdjectiveForAdverbErrors(text: string): EnglishLintIssue[] {
  const issues: EnglishLintIssue[] = [];
  const verbs = MANNER_VERBS.join('|');
  for (const [adjective] of ADJECTIVE_ADVERB_PAIRS) {
    const pattern = new RegExp(`\\b(${verbs})\\s+(${adjective})\\b`, 'gi');
    for (const match of text.matchAll(pattern)) {
      issues.push({ id: 'adjective-for-adverb', severity: 'blocking', labelKo: '부사 자리에 형용사 사용 (-ly 누락)', excerpt: match[0] });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Blocking — article errors ("a apple", "a hour", "like a stars")
// ---------------------------------------------------------------------------
// Vowel-SOUND exceptions (not vowel-LETTER): "a university"/"a European"/"a
// one-time" start with a vowel letter but a consonant sound, so "a" is
// correct there — excluded explicitly rather than producing a false block.
// Silent-h exceptions ("an hour", "an honest", "an heir") get the reverse
// treatment for the "an + consonant" check.
const A_BEFORE_VOWEL_EXCEPTIONS = ['university', 'universe', 'unique', 'union', 'united', 'user', 'usual', 'european', 'one', 'once'];
const AN_BEFORE_CONSONANT_EXCEPTIONS = ['hour', 'honest', 'heir', 'honor'];
// Common plural nouns real lyrics use after "a/an" by mistake — deliberately
// NOT a general "any word ending in s" rule (that would false-positive on
// "a bus", "a class", "a glass", "a mess" — all correct singular nouns
// ending in s) — only words this list actually names are ever flagged.
const COMMON_PLURAL_AFTER_ARTICLE = ['stars', 'years', 'days', 'nights', 'hands', 'eyes', 'dreams', 'memories', 'moments', 'flowers', 'clouds', 'waves', 'leaves', 'roads', 'streets', 'lights', 'skies', 'hearts', 'tears', 'songs', 'voices', 'faces'];

function findArticleErrors(text: string): EnglishLintIssue[] {
  const issues: EnglishLintIssue[] = [];
  for (const match of text.matchAll(/\ba\s+([aeiouAEIOU]\w*)\b/g)) {
    const word = match[1].toLowerCase();
    if (A_BEFORE_VOWEL_EXCEPTIONS.some(exception => word.startsWith(exception))) continue;
    issues.push({ id: 'article-a-before-vowel', severity: 'blocking', labelKo: '관사 오류 (a + 모음 발음 -> an 필요)', excerpt: match[0] });
  }
  for (const match of text.matchAll(/\ban\s+([b-df-hj-np-tv-zB-DF-HJ-NP-TV-Z]\w*)\b/g)) {
    const word = match[1].toLowerCase();
    if (AN_BEFORE_CONSONANT_EXCEPTIONS.some(exception => word.startsWith(exception))) continue;
    issues.push({ id: 'article-an-before-consonant', severity: 'blocking', labelKo: '관사 오류 (an + 자음 발음 -> a 필요)', excerpt: match[0] });
  }
  // "a hour"/"a honest" — the reverse of the silent-h exception just above:
  // "hour" starts with a consonant LETTER (so the first loop's vowel-letter
  // pattern never even sees it), but has a vowel SOUND, so "a" is wrong here.
  const aBeforeSilentHPattern = new RegExp(`\\ba\\s+(${AN_BEFORE_CONSONANT_EXCEPTIONS.join('|')})\\w*\\b`, 'gi');
  for (const match of text.matchAll(aBeforeSilentHPattern)) {
    issues.push({ id: 'article-a-before-silent-h', severity: 'blocking', labelKo: '관사 오류 (a + 묵음 h -> an 필요)', excerpt: match[0] });
  }
  const pluralPattern = new RegExp(`\\ba\\s+(${COMMON_PLURAL_AFTER_ARTICLE.join('|')})\\b`, 'gi');
  for (const match of text.matchAll(pluralPattern)) {
    issues.push({ id: 'article-a-before-plural', severity: 'blocking', labelKo: '관사 오류 (a + 복수명사)', excerpt: match[0] });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Blocking — subject-verb agreement ("the years was", "they was")
// ---------------------------------------------------------------------------
const PLURAL_SUBJECT_PRONOUNS = ['they', 'we', 'you'];
// Common plural nouns real lyrics pair with "the"/possessives + "was" by
// mistake — same curated-not-general approach as COMMON_PLURAL_AFTER_ARTICLE
// above, for the same false-positive reason ("the news was" is correct;
// "news" stays off this list).
const COMMON_PLURAL_SUBJECT_NOUNS = ['years', 'days', 'nights', 'hours', 'minutes', 'times', 'moments', 'seasons', 'dreams', 'memories', 'promises', 'words', 'streets', 'lights', 'stars', 'waves', 'leaves', 'hands', 'eyes', 'faces', 'voices', 'hearts', 'songs', 'tears', 'roads'];

function findSubjectVerbAgreementErrors(text: string): EnglishLintIssue[] {
  const issues: EnglishLintIssue[] = [];
  const pronounPattern = new RegExp(`\\b(${PLURAL_SUBJECT_PRONOUNS.join('|')})\\s+was\\b`, 'gi');
  for (const match of text.matchAll(pronounPattern)) {
    issues.push({ id: 'subject-verb-agreement', severity: 'blocking', labelKo: '주어-동사 불일치', excerpt: match[0] });
  }
  const nounPattern = new RegExp(`\\b(the|those|these|my|her|his|our|your|their)\\s+(${COMMON_PLURAL_SUBJECT_NOUNS.join('|')})\\s+was\\b`, 'gi');
  for (const match of text.matchAll(nounPattern)) {
    issues.push({ id: 'subject-verb-agreement', severity: 'blocking', labelKo: '주어-동사 불일치', excerpt: match[0] });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Blocking — the same sentence repeated within one song (excluding the hook)
// ---------------------------------------------------------------------------
// Reuses lyricLineLedger.ts's own extractQualifyingLines (same >=25-char/
// section-tag/hook-exclusion rules that module's cross-set duplicate check
// already uses) so "what counts as a real line" is defined in exactly one
// place, never two silently-drifting copies.
function findInSongLineRepetition(lyrics: string, hookPhrase: string): EnglishLintIssue[] {
  const lines = extractQualifyingLines(lyrics, hookPhrase);
  const seen = new Map<string, string>();
  const issues: EnglishLintIssue[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) {
      issues.push({ id: 'in-song-line-repetition', severity: 'blocking', labelKo: '한 곡 내 문장 반복', excerpt: line });
    } else {
      seen.set(key, line);
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Advisory — forced metaphor smell (concrete noun + "of" + abstract noun)
// ---------------------------------------------------------------------------
// "coin of common sense" / "laughter lifting flame" style constructions —
// genuinely hard to catch precisely (this task spec's own §3-4 explicitly
// routes the real fix to bridge-instruction guidance, not automated
// detection), so this is advisory-only, a narrow proxy (concrete-noun "of"
// abstract-noun), never blocking.
const ABSTRACT_NOUNS = [
  'sense', 'wisdom', 'hope', 'faith', 'truth', 'courage', 'patience', 'comfort', 'destiny', 'fate', 'peace',
  'chaos', 'wonder', 'grace', 'mercy', 'doubt', 'trust', 'pride', 'shame', 'guilt', 'kindness', 'honesty',
  'loyalty', 'passion', 'desire', 'longing', 'nostalgia', 'melancholy', 'serenity', 'freedom', 'happiness',
  'sorrow', 'joy', 'love', 'memory', 'dream', 'silence', 'time', 'life', 'death', 'youth', 'innocence'
];
const CONCRETE_NOUNS = [
  'coin', 'flame', 'stone', 'river', 'door', 'window', 'road', 'bridge', 'candle', 'mirror', 'key', 'thread',
  'anchor', 'shell', 'leaf', 'branch', 'flower', 'ember', 'spark', 'shore', 'wave', 'star', 'moon', 'light'
];

function findForcedMetaphors(text: string): EnglishLintIssue[] {
  const issues: EnglishLintIssue[] = [];
  const pattern = new RegExp(`\\b(${CONCRETE_NOUNS.join('|')})\\s+of\\s+(?:\\w+\\s+)?(${ABSTRACT_NOUNS.join('|')})\\b`, 'gi');
  for (const match of text.matchAll(pattern)) {
    issues.push({ id: 'forced-metaphor', severity: 'advisory', labelKo: '억지 비유 의심 (구체명사 + of + 추상명사)', excerpt: match[0] });
  }
  return issues;
}

/** Advisory — 3+ abstract nouns in one line (from ABSTRACT_NOUNS above) — a real, not exhaustive, smell for over-abstracted lyric writing. */
function findAbstractNounOverload(text: string): EnglishLintIssue[] {
  const issues: EnglishLintIssue[] = [];
  const wordPattern = new RegExp(`\\b(${ABSTRACT_NOUNS.join('|')})\\b`, 'gi');
  for (const line of text.split('\n')) {
    const matches = [...line.matchAll(wordPattern)];
    if (matches.length >= 3) {
      issues.push({ id: 'abstract-noun-overload', severity: 'advisory', labelKo: '한 문장에 추상명사 3개 이상', excerpt: line.trim() });
    }
  }
  return issues;
}

export interface EnglishLintResult {
  issues: EnglishLintIssue[];
  blocking: boolean;
}

/**
 * The one real entry point every generation path should call (bridge
 * import, Batch result, realtime API response, local generation, per-song
 * regen — see this task spec's own §3-5). Operates on ENGLISH text only —
 * callers are responsible for only invoking this when lyricLanguage is
 * 'english' (or the English half of a 'bilingual' pack); running English
 * grammar checks against Korean/Japanese lyrics would be meaningless.
 */
export function lintEnglishLyrics(lyrics: string, hookPhrase: string): EnglishLintResult {
  const issues: EnglishLintIssue[] = [
    ...findCasePronounErrors(lyrics),
    ...findAdjectiveForAdverbErrors(lyrics),
    ...findArticleErrors(lyrics),
    ...findSubjectVerbAgreementErrors(lyrics),
    ...findInSongLineRepetition(lyrics, hookPhrase),
    ...findForcedMetaphors(lyrics),
    ...findAbstractNounOverload(lyrics)
  ];
  return { issues, blocking: issues.some(issue => issue.severity === 'blocking') };
}
