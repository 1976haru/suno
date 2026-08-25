import { ARTIST_REFERENCE_SEEDS, type ArtistReferenceSeed } from '../data/artistReferenceSeeds';

/**
 * TASK v5.19 (P0 emergency fix) — real incident: an 18-song import got
 * hard-blocked because a lyric said "breaking bread at the table" and the
 * `bread` seed's aliasPattern (`\bbread\b`) matches the food word too. The
 * seed table's own commonWordRisk marks which aliases collide with ordinary
 * English words (bread/eagles/carpenters and similar plural-noun band
 * names); for those, a bare lowercase substring match in free-flowing
 * title/lyrics text is NOT enough — this module now requires one of:
 *  - the non-Latin variant (브레드밴드/ブレッド etc.) — never a generic word
 *  - an explicit comparison/reference trigger nearby ("sounds like Bread")
 *  - the English surface capitalized somewhere OTHER than the very start of
 *    a sentence/line (title-case first words and sentence-initial capitals
 *    are just grammar, not a proper-noun signal)
 * stylePrompt scope is deliberately exempt from all of this — a style
 * prompt is app-generated, not natural language, so a common word landing
 * there by chance is vanishingly unlikely and there's zero reason to relax
 * the one field Suno actually reads (see this module's own top-of-file
 * comment on why names must never reach it).
 */
const ARTIST_CONTEXT_TRIGGER_PATTERN = /\b(sounds?\s+like|like|style|feat(?:uring)?|inspired\s+by|in\s+the\s+style\s+of|tribute\s+to|cover\s+of|imitation\s+of)\b|스타일|느낌|커버|버전|처럼|따라|풍으로/iu;

/** Hangul, Hiragana/Katakana, or CJK ideograph — never a coincidental English common-word collision. */
function containsNonLatinScript(text: string): boolean {
  return /[가-힣぀-ヿ一-鿿]/.test(text);
}

export type ArtistReferenceScope = 'stylePrompt' | 'title' | 'lyrics';

/**
 * Decides whether a commonWordRisk !== 'none' match in title/lyrics scope
 * has enough corroborating context to count as a real artist reference
 * rather than the ordinary word. stylePrompt scope never calls this — every
 * match there is already treated as a leak (see findArtistReferenceLeaks).
 */
function hasArtistContextSignal(scope: ArtistReferenceScope, text: string, matchIndex: number, matchedSurface: string): boolean {
  if (containsNonLatinScript(matchedSurface)) return true;
  const before = text.slice(Math.max(0, matchIndex - 40), matchIndex);
  if (ARTIST_CONTEXT_TRIGGER_PATTERN.test(before)) return true;
  // Capitalization only carries signal in free-flowing lyrics — titles are
  // conventionally title-cased throughout ("Bread and Butter" is a normal,
  // innocent title), so relying on it there would over-block real titles.
  if (scope !== 'lyrics') return false;
  if (!/^[A-Z]/.test(matchedSurface)) return false;
  const precedingContext = text.slice(0, matchIndex);
  const isSentenceOrLineStart = /(^\s*|[.!?\n]\s*)$/.test(precedingContext);
  return !isSentenceOrLineStart;
}

/**
 * TASK v3.58 (지시문 v3.58 TASK 3) — "비틀즈 스타일로" is a completely normal
 * way for a user to describe a sound, so the input side never blocks or
 * rejects it. But the artist name itself must never reach Suno's style
 * field:
 *
 * 1. Suno filters/ignores real artist names in the style field outright —
 *    putting one there does nothing useful.
 * 2. It's a real risk at the distribution/monetization stage (DistroKid,
 *    YouTube channel monetization) — "famous artist imitation" is exactly
 *    what this app's own excludePrompt already tells Suno to avoid (see
 *    core/promptComposer.ts's buildExcludePrompt); putting the name in the
 *    style field would directly contradict that.
 *
 * So decomposeArtistReferences() converts a detected reference into
 * concrete, generic musical descriptors (era, instrumentation, harmony,
 * rhythm, production, vocal character) that describe the SCENE/ERA a whole
 * genre shares, never a specific recording — and deliberately drops the
 * name. Every field on DecomposedReference except matchedSurface is safe to
 * splice directly into a style prompt; matchedSurface exists only so the
 * concept UI can show the user "here's what we detected", and callers must
 * never place it in stylePrompt/excludePrompt (see assertNoArtistReferenceLeak).
 */
export interface DecomposedReference {
  /** The literal text detected in the user's free-form input (e.g. "비틀즈 스타일로"). UI-display only — never place this in a style prompt. */
  matchedSurface: string;
  eraTag: string;
  instrumentation: string[];
  harmonyTraits: string[];
  rhythmTraits: string[];
  productionTraits: string[];
  vocalTraits: string[];
  suggestedGenreIds: string[];
  excludeAdditions: string[];
}

function seedPattern(seed: ArtistReferenceSeed): RegExp {
  return new RegExp(seed.aliasPattern, 'iu');
}

function toDecomposedReference(seed: ArtistReferenceSeed, matchedSurface: string): DecomposedReference {
  return {
    matchedSurface,
    eraTag: seed.eraTag,
    instrumentation: [...seed.instrumentation],
    harmonyTraits: [...seed.harmonyTraits],
    rhythmTraits: [...seed.rhythmTraits],
    productionTraits: [...seed.productionTraits],
    vocalTraits: [...seed.vocalTraits],
    suggestedGenreIds: [...seed.suggestedGenreIds],
    excludeAdditions: [...seed.excludeAdditions]
  };
}

/**
 * Detects every artist/band reference in freeText (a user can name more
 * than one — "비틀즈랑 카펜터스 느낌 섞어서") and returns one decomposed entry
 * per match, in the order the seeds table lists them. Never throws; an
 * input with no recognizable reference just returns [].
 */
export function decomposeArtistReferences(freeText: string): DecomposedReference[] {
  const text = String(freeText || '');
  if (!text.trim()) return [];
  const results: DecomposedReference[] = [];
  for (const seed of ARTIST_REFERENCE_SEEDS) {
    const match = text.match(seedPattern(seed));
    if (match) results.push(toDecomposedReference(seed, match[0]));
  }
  return results;
}

/** Every musical-descriptor field of a DecomposedReference, flattened into one array — the exact set of strings that should end up in a style prompt/exclude list, and the exact set assertNoArtistReferenceLeak scans. */
export function decomposedReferenceDescriptors(ref: DecomposedReference): string[] {
  return [ref.eraTag, ...ref.instrumentation, ...ref.harmonyTraits, ...ref.rhythmTraits, ...ref.productionTraits, ...ref.vocalTraits];
}

export interface ArtistReferenceLeak {
  surface: string;
  seedAliasPattern: string;
  /** TASK v5.19 — surfaced so a caller's false-positive UI (see importInspection.ts/App.tsx) can tell a genuinely risky hit apart from a 'none'-risk proper noun; 'none' here means hasArtistContextSignal was never even consulted for this leak. */
  commonWordRisk: ArtistReferenceSeed['commonWordRisk'];
}

/**
 * Scans `text` for any known artist/band alias — used both as the self-check
 * decomposeArtistReferences' own callers run before writing anything to
 * stylePrompt/excludePrompt, and by core/albumAudit.ts's per-song check.
 * Independent of whether decomposeArtistReferences was ever called on this
 * exact text (an LLM-authored concept response could reintroduce a name
 * decomposeArtistReferences was never asked about).
 *
 * TASK v5.19 (P0 emergency fix) — `scope` defaults to 'stylePrompt' so every
 * pre-existing caller keeps its exact old (strict, context-free) behavior
 * with zero code changes required. Callers scanning a song's title or
 * lyrics should now pass the matching scope explicitly so a
 * commonWordRisk !== 'none' seed only counts as a leak with real
 * corroborating context (see hasArtistContextSignal) — see
 * importInspection.ts/compositionScorer.ts/albumAudit.ts for the updated
 * call sites.
 */
export function findArtistReferenceLeaks(text: string, scope: ArtistReferenceScope = 'stylePrompt'): ArtistReferenceLeak[] {
  const value = String(text || '');
  if (!value.trim()) return [];
  const leaks: ArtistReferenceLeak[] = [];
  for (const seed of ARTIST_REFERENCE_SEEDS) {
    const match = value.match(seedPattern(seed));
    if (!match) continue;
    const requiresContext = scope !== 'stylePrompt' && seed.commonWordRisk !== 'none';
    if (requiresContext && !hasArtistContextSignal(scope, value, match.index ?? 0, match[0])) continue;
    leaks.push({ surface: match[0], seedAliasPattern: seed.aliasPattern, commonWordRisk: seed.commonWordRisk });
  }
  return leaks;
}

/**
 * TASK v3.58 — "출력 가드를 통과시킵니다: 감지된 이름 문자열이 stylePrompt에
 * 남아 있으면 빌드 실패로 처리". Throws (rather than silently stripping) so a
 * caller assembling a style prompt from decomposed traits fails loudly the
 * moment a name leaks in, instead of shipping it. Callers that need a
 * softer/reporting-only check (e.g. an album-wide audit that wants to list
 * every violation rather than stop at the first) should use
 * findArtistReferenceLeaks directly instead.
 */
export function assertNoArtistReferenceLeak(text: string, context = 'style prompt'): void {
  const leaks = findArtistReferenceLeaks(text);
  if (leaks.length) {
    throw new Error(`${context} leaked a real artist/band reference: ${leaks.map(leak => `"${leak.surface}"`).join(', ')}. Names must never reach Suno's style field.`);
  }
}

/**
 * Validates an LLM-produced decomposition (the recommendConceptViaApi path
 * may ask an API to do this decomposition instead of using the local seed
 * table) against the same never-leak-a-name rule this whole module exists
 * to enforce. Returns false (discard -> caller should fall back to the
 * local seed table) if any field other than matchedSurface contains a
 * recognizable artist/band name.
 */
export function isSafeDecomposedReference(ref: DecomposedReference): boolean {
  return decomposedReferenceDescriptors(ref).every(descriptor => findArtistReferenceLeaks(descriptor).length === 0);
}
