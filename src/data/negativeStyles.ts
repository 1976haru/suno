import type { ChannelProfile, GenerationOptions, GenrePack } from '../types';

export const GLOBAL_NEGATIVE_STYLE_TERMS = [
  'flat chorus with no lift',
  'monotonous melody contour',
  'generic AI demo-band sound',
  'overly glossy karaoke backing track',
  'muddy low-end mix',
  'excessive reverb washing out the vocal',
  'thin placeholder hook',
  'stock loop arrangement with no song development'
] as const;

export const NEGATIVE_STYLE_TOGGLES = [
  {
    id: 'no_humming',
    labelKo: '허밍 제거',
    phrase: 'wordless humming or la-la filler'
  },
  {
    id: 'dry_reverb',
    labelKo: '과한 리버브 제거',
    phrase: 'long washy reverb tails masking the lead vocal'
  },
  {
    id: 'no_autotune',
    labelKo: '과한 오토튠 제거',
    phrase: 'obvious hard-tuned autotune effect'
  },
  {
    id: 'soft_drums',
    labelKo: '강한 드럼 제거',
    phrase: 'aggressive heavy drums overpowering the song'
  }
] as const;

export function parseNegativeStyleTerms(text: string | undefined | null): string[] {
  if (!text) return [];
  return text
    .split(/[;,]/)
    .map(term => term.trim())
    .filter(Boolean);
}

function normalizeTerm(term: string): string {
  return term.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * TASK v5.21 (TASK B-2) — real, measured duplicate pairs in a live pack's
 * excludePrompt: "copied melody" / "copied melodies", "copyrighted song
 * reference" / "copyrighted song references", "soundalike vocal" /
 * "soundalike vocals" — every one a plain plural of the OTHER survivor,
 * surviving because normalizeTerm only lowercases/collapses whitespace, so
 * "vocal" and "vocals" hash to different keys. Only the LAST word of a term
 * ever needs de-pluralizing here (every real duplicate pair found was a
 * plural on the term's final noun, never a mid-phrase word) — collapsing
 * every word would risk corrupting genuinely different terms that happen to
 * share an early word.
 */
function singularizeLastWord(term: string): string {
  const words = term.split(' ');
  const last = words[words.length - 1];
  if (last.length > 3 && last.endsWith('ies')) {
    words[words.length - 1] = `${last.slice(0, -3)}y`;
  } else if (last.length > 3 && last.endsWith('s') && !last.endsWith('ss') && !last.endsWith('us')) {
    // Guards against corrupting words that end in 's' but aren't plural
    // (bass, chorus) — a real duplicate pair never hit this branch
    // incorrectly in this codebase's actual term lists.
    words[words.length - 1] = last.slice(0, -1);
  }
  return words.join(' ');
}

function dedupeKey(term: string): string {
  return singularizeLastWord(normalizeTerm(term));
}

/**
 * TASK v5.21 (TASK B-2, perf follow-up) — this is on the hot path
 * (buildExcludePrompt runs once per song, and joinNegativeStyleTerms itself
 * gets called several times per buildExcludePrompt call via the various
 * mergeNegativeStyleText/resolveNegativeStyleText layers it composes
 * through). A first version recomputed dedupeKey and re-split every term
 * inside the O(n^2) containment loop below, which measurably regressed the
 * existing tests/promptLength-*.test.ts suite (each exercises thousands of
 * full-pack generations, one buildExcludePrompt call per song) past its
 * 30s budget. Precomputing each term's key/word-set exactly once up front
 * keeps the same O(n^2) comparison count but removes the repeated string
 * work from inside the loop — for the typical <20-term lists this function
 * actually sees, that's the entire cost difference.
 */
export function joinNegativeStyleTerms(terms: readonly string[]): string {
  const cleaned = terms.map(term => term.trim()).filter(Boolean);
  const seen = new Set<string>();
  const deduped: { term: string; key: string }[] = [];
  for (const term of cleaned) {
    const key = dedupeKey(term);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ term, key });
  }
  // TASK v5.21 (TASK B-2) — "포함 관계인 항목도 하나만 남기십시오": a real pack
  // carried both 'sub bass' (data/channelSoundFloor.ts's forbiddenAtoms) and
  // 'heavy sub bass' (data/audienceProfiles.ts's hardExclusions) — two
  // different source lists, so the exact-match dedup above never catches
  // them. Word-boundary containment (not raw substring — "bass" alone must
  // never eat "double bass") drops the shorter phrase whenever every one of
  // its words also appears in a longer surviving phrase; the longer phrase
  // already conveys the shorter one's restriction, so nothing is lost.
  const withWords = deduped.map(entry => ({ ...entry, words: entry.key.split(' ') }));
  const result: string[] = [];
  for (const entry of withWords) {
    const subsumedByAnother = withWords.some(other => {
      if (other === entry) return false;
      if (other.key.length <= entry.key.length) return false;
      return entry.words.every(w => other.words.includes(w));
    });
    if (!subsumedByAnother) result.push(entry.term);
  }
  return result.join(', ');
}

export function buildGenreNegativeStyle(genres: readonly GenrePack[] | undefined): string {
  return joinNegativeStyleTerms((genres || []).flatMap(genre => genre.avoidTraits || []));
}

export function buildDefaultNegativeStyle(channel: ChannelProfile, genres?: readonly GenrePack[]): string {
  return joinNegativeStyleTerms([
    ...GLOBAL_NEGATIVE_STYLE_TERMS,
    ...(channel.forbiddenCliches ?? []),
    ...parseNegativeStyleTerms(buildGenreNegativeStyle(genres))
  ]);
}

export function mergeNegativeStyleText(...texts: Array<string | undefined | null>): string {
  return joinNegativeStyleTerms(texts.flatMap(parseNegativeStyleTerms));
}

export function resolveNegativeStyleText(opts: Pick<GenerationOptions, 'channel' | 'negativeStyle'>, genres?: readonly GenrePack[]): string {
  const baseTerms = opts.negativeStyle !== undefined
    ? parseNegativeStyleTerms(opts.negativeStyle)
    : parseNegativeStyleTerms(buildDefaultNegativeStyle(opts.channel));
  return joinNegativeStyleTerms([
    ...baseTerms,
    ...parseNegativeStyleTerms(buildGenreNegativeStyle(genres))
  ]);
}

/**
 * TASK v5.21 (TASK B-4) — reporting-only counterpart to joinNegativeStyleTerms'
 * own dedup: given a RAW exclude-prompt string that may never have passed
 * through joinNegativeStyleTerms at all (a bridge-imported song's
 * excludePrompt is Codex's own verbatim text — see core/bridgeImport.ts's
 * own doc comment on why buildExcludePrompt is never called for that path),
 * returns each duplicate/contained pair found, for
 * core/compositionScorer.ts's advisory check. Never mutates or drops
 * anything — a caller decides what (if anything) to do about a finding.
 */
export function findDuplicateExcludeTerms(excludePromptText: string): Array<[string, string]> {
  const terms = parseNegativeStyleTerms(excludePromptText);
  const entries = terms.map(term => {
    const key = dedupeKey(term);
    return { term, key, words: key.split(' ') };
  });
  const pairs: Array<[string, string]> = [];
  const seenKeys = new Map<string, string>();
  for (const entry of entries) {
    const prior = seenKeys.get(entry.key);
    if (prior && prior !== entry.term) pairs.push([prior, entry.term]);
    else if (!prior) seenKeys.set(entry.key, entry.term);
  }
  for (const a of entries) {
    for (const b of entries) {
      if (a === b || b.key.length <= a.key.length) continue;
      if (a.words.every(w => b.words.includes(w))) pairs.push([a.term, b.term]);
    }
  }
  return pairs;
}

export function withoutNegativeStyleTerm(current: string, term: string): string {
  const removeKey = normalizeTerm(term);
  return joinNegativeStyleTerms(parseNegativeStyleTerms(current).filter(item => normalizeTerm(item) !== removeKey));
}

export function withNegativeStyleTerm(current: string, term: string): string {
  return mergeNegativeStyleText(current, term);
}

export function stripNegativeStyleFromStylePrompt(stylePrompt: string, negativeStyleText: string | undefined): string {
  const negativeKeys = new Set(parseNegativeStyleTerms(negativeStyleText).map(normalizeTerm));
  if (!negativeKeys.size) return stylePrompt;
  return stylePrompt
    .split(/[;,]/)
    .map(atom => atom.trim())
    .filter(atom => atom && !negativeKeys.has(normalizeTerm(atom)))
    .join(', ');
}
