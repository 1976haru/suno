import type { ChannelProfile, GenerationOptions } from '../types';

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

export function joinNegativeStyleTerms(terms: readonly string[]): string {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const term of terms) {
    const clean = term.trim();
    if (!clean) continue;
    const key = normalizeTerm(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result.join(', ');
}

export function buildDefaultNegativeStyle(channel: ChannelProfile): string {
  return joinNegativeStyleTerms([
    ...GLOBAL_NEGATIVE_STYLE_TERMS,
    ...(channel.forbiddenCliches ?? [])
  ]);
}

export function mergeNegativeStyleText(...texts: Array<string | undefined | null>): string {
  return joinNegativeStyleTerms(texts.flatMap(parseNegativeStyleTerms));
}

export function resolveNegativeStyleText(opts: Pick<GenerationOptions, 'channel' | 'negativeStyle'>): string {
  if (opts.negativeStyle !== undefined) return joinNegativeStyleTerms(parseNegativeStyleTerms(opts.negativeStyle));
  return buildDefaultNegativeStyle(opts.channel);
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
