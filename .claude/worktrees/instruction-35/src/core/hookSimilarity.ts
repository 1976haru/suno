/**
 * TASK v3.64 (TASK D) — real measurement: "I Won't Forget" vs "I Can't
 * Forget" are different strings (so the existing exact-match
 * flagHookCollisions/normalizedHookKey check in claudeCodeBridge.ts never
 * catches them) but read as the same hook to a listener. Jaccard word
 * overlap over meaningful words (stopwords/contractions-stub words
 * excluded) catches this: {i, forget} shared out of {i, wont, forget,
 * cant} = 0.5.
 */
const HOOK_STOPWORDS = new Set(['i', 'you', 'me', 'my', 'your', 'the', 'a', 'an', 'and', 'to', 'of', 'in', 'on', 'is', 'it', 'this', 'that']);

function hookWordSet(hook: string): Set<string> {
  const words = hook
    .toLowerCase()
    .replace(/['']/g, '')
    .match(/[a-z]+/g) ?? [];
  return new Set(words.filter(word => word.length > 1 && !HOOK_STOPWORDS.has(word)));
}

export function hookWordOverlap(a: string, b: string): number {
  const setA = hookWordSet(a);
  const setB = hookWordSet(b);
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const word of setA) if (setB.has(word)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * "I Won't Forget" vs "I Can't Forget" -> meaningful-word sets {wont,
 * forget} / {cant, forget} -> Jaccard 1/3. Real short hooks (this app's own
 * guidance is 2-5 words) carry most of their identity in 1-2 content
 * words, so this is deliberately lower than a general-purpose text-
 * similarity threshold would use — tightened by also requiring near-equal
 * word count, so a long hook that merely shares one common word with a
 * short one doesn't false-positive.
 */
export const NEAR_DUPLICATE_HOOK_THRESHOLD = 1 / 3;

export interface NearDuplicateHookMatch {
  hook: string;
  matchedAgainst: string;
  similarity: number;
}

/** Finds the closest near-duplicate (if any) for `hook` among `candidates`, excluding an exact match (already handled elsewhere by claudeCodeBridge.ts's own exact-match collision check). */
export function findNearDuplicateHook(hook: string, candidates: readonly string[]): NearDuplicateHookMatch | undefined {
  const trimmed = hook.trim();
  if (!trimmed) return undefined;
  const trimmedWords = hookWordSet(trimmed);
  let best: NearDuplicateHookMatch | undefined;
  for (const candidate of candidates) {
    if (!candidate || candidate.trim().toLowerCase() === trimmed.toLowerCase()) continue;
    const candidateWords = hookWordSet(candidate);
    if (Math.abs(trimmedWords.size - candidateWords.size) > 1) continue;
    const similarity = hookWordOverlap(trimmed, candidate);
    if (similarity >= NEAR_DUPLICATE_HOOK_THRESHOLD && (!best || similarity > best.similarity)) {
      best = { hook: trimmed, matchedAgainst: candidate, similarity };
    }
  }
  return best;
}
