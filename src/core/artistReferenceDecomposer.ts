import { ARTIST_REFERENCE_SEEDS, type ArtistReferenceSeed } from '../data/artistReferenceSeeds';

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
}

/** Scans `text` for any known artist/band alias — used both as the self-check decomposeArtistReferences' own callers run before writing anything to stylePrompt/excludePrompt, and by core/albumAudit.ts's per-song check. Independent of whether decomposeArtistReferences was ever called on this exact text (an LLM-authored concept response could reintroduce a name decomposeArtistReferences was never asked about). */
export function findArtistReferenceLeaks(text: string): ArtistReferenceLeak[] {
  const value = String(text || '');
  if (!value.trim()) return [];
  const leaks: ArtistReferenceLeak[] = [];
  for (const seed of ARTIST_REFERENCE_SEEDS) {
    const match = value.match(seedPattern(seed));
    if (match) leaks.push({ surface: match[0], seedAliasPattern: seed.aliasPattern });
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
