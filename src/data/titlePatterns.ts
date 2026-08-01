import type { WorkspaceId } from '../types';
// Type-only import of a core/ type — erased at build (no runtime edge), so
// this doesn't create an actual data/ -> core/ dependency; done instead of
// duplicating HookShape/HookSpec's shape here, which would drift the moment
// either definition changed. core/lyricEngine.ts imports TITLE_PATTERNS back
// (a real, runtime import) — the pair is safe only because this direction is
// type-only. See utils/prng.ts's own doc comment for the same pattern.
import type { HookSpec } from '../core/lyricEngine';
import type { EraBucket } from './eraExclusions';
import { shuffle } from '../utils/prng';

/**
 * v4.2 (TASK A3 / TASK C) — real measurement: a real 18-song "비틀즈 느낌의
 * 밝은 60년대 팝" pack came back 18/18 titles in the exact same
 * "[compressed image] & [mood word]" shape (Second Pour, Torn Corner, First
 * Sway, ...), because core/lyricEngine.ts's old titleFromHook() only ever
 * looked at hook.shape (and only for the nounPhrase case) — every other hook
 * shape fell straight into the same compressHookToImage() branch regardless
 * of era, concept, or workspace. This file is the data-driven replacement:
 * each pattern here declares which hook shape(s) it actually fits (via its
 * own build() returning null when the hook doesn't fit) and which eras/
 * workspaces it belongs to declaratively, so a 2030 or kids workspace (see
 * this task's own §11) can add its own patterns without touching
 * titleFromHook's selection logic at all — only this array grows.
 */
export interface TitleBuildContext {
  hook: HookSpec;
  seed: number;
  usedTitles: Set<string>;
  /** Narrows the image-pair mood-word pool to a bright/playful set instead of the adult mood pool — kept as a plain boolean (not ChannelArchetype) since that's the only distinction any pattern here actually needs. */
  kidsAudience: boolean;
}

export interface TitlePattern {
  id: string;
  labelKo: string;
  /** Eras this pattern is authentic for. Undefined/empty means "fits any era" (never filtered out by era). */
  fitsEras?: EraBucket[];
  /** Workspaces this pattern is available in. Undefined/empty means every workspace (today: senior-oldpop only actually calls this). */
  fitsWorkspaces?: WorkspaceId[];
  /** Returns a candidate title, or null if this hook doesn't fit this pattern (wrong shape, no compressible image, pool exhausted, ...) — never throws. */
  build: (ctx: TitleBuildContext) => string | null;
  exampleKo: string;
}

// ---------------------------------------------------------------------------
// Shared word pools/helpers (moved from core/lyricEngine.ts's old
// titleFromHook — same pools, same behavior, now data instead of inline
// probability branches).
// ---------------------------------------------------------------------------

const enHookStopwords = new Set([
  'i', "i'll", "i'm", 'we', "we'll", "won't", "don't", "you're", 'you', 'still',
  'the', 'a', 'an', 'to', 'for', 'of', 'with', 'on', 'in', 'at', 'by', 'me', 'my', 'your', 'it',
  'let', 'go', 'keep', 'hold', 'wait', 'come', 'back', 'stay', 'wrap', 'pour', 'be',
  'hush', 'rest', 'breathe', 'take', 'carry', 'save', 'remember', 'will', 'not',
  'know', 'found', 'way', 'made', 'through', 'believe', 'this', 'here', 'now',
  'again', 'close', 'near', 'tonight', 'softly', 'us'
]);

function compressHookToImage(phrase: string): string | null {
  const words = phrase.replace(/[,.]/g, '').split(/\s+/).filter(Boolean);
  const kept = words.filter(word => !enHookStopwords.has(word.toLowerCase()));
  if (!kept.length || kept.length === words.length) return null;
  return kept.slice(0, 2).join(' ');
}

function hasWordOverlap(...parts: (string | null)[]): boolean {
  const filtered = parts.filter((part): part is string => Boolean(part));
  const words = filtered.flatMap(part => part.toLowerCase().split(/\s+/).filter(Boolean));
  return new Set(words).size !== words.length;
}

const enTimeWords = ['Winter', 'Golden', 'Quiet', 'Old December', 'First Snow', 'Slow Sunday', 'Midnight', 'Soft Christmas', 'Rainy Afternoon', 'New Year'];
const enImagePairWords = ['Frost', 'Ember', 'Static', 'Velvet', 'Hollow', 'Glow', 'Echo', 'Dust'];
const kidsImagePairWords = ['Sunshine', 'Rainbow', 'Bubble', 'Giggle', 'Sparkle', 'Puddle', 'Kite', 'Cupcake'];

/**
 * TASK C — period-flavored question titles ("Do You Remember"-shape). Not
 * derived from the hook's own words (transforming an arbitrary declarative
 * hook into a grammatical question isn't reliable without real NLP) — a
 * small fixed pool in the same spirit as enTimeWords/enContrastWords, which
 * were already fixed pools independent of the literal hook text.
 */
const enQuestionTitles = [
  'Do You Remember', 'Will You Still Be There', 'Where Did the Summer Go',
  'Have You Seen Her', 'Do You Recall That Night', 'Will You Wait for Me',
  'Whatever Happened to Us', 'Where Are You Tonight'
];

/** Used by titleFromHook's own non-English branch and as every pattern's collision fallback. */
export function uniqueTitle(base: string, usedTitles: Set<string>): string {
  if (!usedTitles.has(base)) return base;
  let n = 2;
  while (usedTitles.has(`${base} #${n}`)) n += 1;
  return `${base} #${n}`;
}

// ---------------------------------------------------------------------------
// Patterns — see this task's own §4-3 for the source list (성인 팝 기준, 최소 8종).
// ---------------------------------------------------------------------------

function sentenceFragmentBuild(ctx: TitleBuildContext): string | null {
  if (ctx.hook.shape === 'declarative') return ctx.hook.phrase;
  // "All My Loving"-style: a nounPhrase hook that already opens with a
  // possessive reads as a sentence fragment, not a bare noun-noun pair.
  if (ctx.hook.shape === 'nounPhrase' && /^(my|your|our|his|her|their)\b/i.test(ctx.hook.phrase)) return ctx.hook.phrase;
  return null;
}

function hookVerbatimBuild(ctx: TitleBuildContext): string | null {
  return ctx.hook.phrase;
}

function singleWordBuild(ctx: TitleBuildContext): string | null {
  const image = compressHookToImage(ctx.hook.phrase);
  if (!image) return null;
  const [first] = image.split(/\s+/);
  return first || null;
}

function nameAddressBuild(ctx: TitleBuildContext): string | null {
  // Vocative hooks already address someone ("Hold On, My Friend") — exactly
  // the "Sweet Caroline" / "Oh, Donna" shape, no transformation needed.
  return ctx.hook.shape === 'vocative' ? ctx.hook.phrase : null;
}

function imagePairBuild(ctx: TitleBuildContext): string | null {
  const image = compressHookToImage(ctx.hook.phrase);
  if (!image) return null;
  const pool = shuffle(ctx.kidsAudience ? kidsImagePairWords : enImagePairWords, ctx.seed + 1313);
  for (const pair of pool) {
    if (hasWordOverlap(image, pair)) continue;
    const candidate = `${image} & ${pair}`;
    if (!ctx.usedTitles.has(candidate)) return candidate;
  }
  return null;
}

function timePrefixBuild(ctx: TitleBuildContext): string | null {
  if (ctx.hook.shape !== 'nounPhrase') return null;
  const pool = shuffle(enTimeWords, ctx.seed + 777);
  for (const prefix of pool) {
    if (hasWordOverlap(prefix, ctx.hook.phrase)) continue;
    const candidate = `${prefix} ${ctx.hook.phrase}`;
    if (!ctx.usedTitles.has(candidate)) return candidate;
  }
  return null;
}

function questionBuild(ctx: TitleBuildContext): string | null {
  if (ctx.hook.shape !== 'declarative') return null;
  const pool = shuffle(enQuestionTitles, ctx.seed + 551);
  return pool.find(candidate => !ctx.usedTitles.has(candidate)) ?? null;
}

function exclamationBuild(ctx: TitleBuildContext): string | null {
  // Imperative hooks already read as a command/exclamation ("Hold On",
  // "Come Back Home") — verbatim is the exclamation-shaped title.
  return ctx.hook.shape === 'imperative' ? ctx.hook.phrase : null;
}

export const TITLE_PATTERNS: TitlePattern[] = [
  {
    id: 'sentence-fragment',
    labelKo: '문장 조각',
    fitsEras: ['1950s-60s', '1970s'],
    build: sentenceFragmentBuild,
    exampleKo: 'All My Loving / She Loves You'
  },
  {
    id: 'hook-verbatim',
    labelKo: '훅 그대로',
    build: hookVerbatimBuild,
    exampleKo: 'Stay a While'
  },
  {
    id: 'single-word',
    labelKo: '한 단어',
    build: singleWordBuild,
    exampleKo: 'Yesterday / Michelle'
  },
  {
    id: 'name-address',
    labelKo: '호명형',
    fitsEras: ['1950s-60s'],
    build: nameAddressBuild,
    exampleKo: 'Sweet Caroline / Oh, Donna'
  },
  {
    id: 'image-pair',
    labelKo: '이미지 조합',
    build: imagePairBuild,
    exampleKo: 'Fogged Window & Frost'
  },
  {
    id: 'time-prefix',
    labelKo: '시간 수식',
    build: timePrefixBuild,
    exampleKo: 'Late Summer Letter'
  },
  {
    id: 'question',
    labelKo: '질문형',
    fitsEras: ['1950s-60s', '1970s'],
    build: questionBuild,
    exampleKo: 'Do You Remember'
  },
  {
    id: 'exclamation',
    labelKo: '감탄·명령',
    fitsEras: ['1950s-60s', '1970s'],
    build: exclamationBuild,
    exampleKo: 'Hold On / Come Back Home'
  }
];

export function titlePatternById(id: string): TitlePattern | undefined {
  return TITLE_PATTERNS.find(pattern => pattern.id === id);
}
