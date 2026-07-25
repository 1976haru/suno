/**
 * TASK v3.39 Part F — Suno's own artist-name filter can silently reject (or
 * otherwise mangle) a style prompt if a substring inside it happens to match
 * a token Suno treats as an artist/brand name — even when that substring
 * only exists because a hook or title fragment happened to spell it out.
 * Real production output showed an AI-creative hook landing a fragment that
 * matched this exact way ("wayo"); soundSignature.ts's compactHook stopped
 * embedding literal hook lyrics in the style prompt for the same reason
 * (that was the biggest single source of this risk), but this module is the
 * last-line net: scoreSong (core/quality.ts) runs on every generation path
 * — local, realtime, Batch API, and Claude Code bridge import — so masking
 * here is the one place that reliably covers all of them regardless of which
 * path produced the text.
 *
 * Extend SUNO_BLOCKED_STYLE_TOKENS as more real blocked tokens are found;
 * this is a denylist of observed false-positive triggers, not a general
 * profanity/artist-name filter (famous artist *names* are already handled
 * separately by quality.ts's famousArtistNames check).
 */
export const SUNO_BLOCKED_STYLE_TOKENS = ['wayo'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function blockedTokenPattern(token: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(token)}\\b`, 'gi');
}

/** True if any known-blocked token appears (case-insensitive, whole-token) in the given text. */
export function containsBlockedStyleToken(text: string): boolean {
  return SUNO_BLOCKED_STYLE_TOKENS.some(token => blockedTokenPattern(token).test(text));
}

/**
 * Removes every known-blocked token from the text (case-insensitive,
 * whole-token match only — never touches a token embedded inside a longer
 * word) and collapses the whitespace/punctuation left behind, so the result
 * still reads as a clean, comma-joined style prompt.
 */
export function sanitizeSunoStyleText(text: string): string {
  if (!containsBlockedStyleToken(text)) return text;
  let result = text;
  for (const token of SUNO_BLOCKED_STYLE_TOKENS) {
    result = result.replace(blockedTokenPattern(token), '');
  }
  return result
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/, '')
    .trim();
}
