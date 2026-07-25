import { describe, expect, it } from 'vitest';
import { containsBlockedStyleToken, sanitizeSunoStyleText, SUNO_BLOCKED_STYLE_TOKENS } from '../src/core/sunoSafety';

// TASK v3.39 Part F — a real production style prompt got silently rejected
// by Suno's artist-name filter because a fragment inside it matched a
// blocked token ("wayo"). This is the last-line net that masks any known
// blocked token out of a final style prompt, regardless of which generation
// path produced the text.

describe('containsBlockedStyleToken', () => {
  it('detects a known blocked token case-insensitively', () => {
    expect(containsBlockedStyleToken('some text with WaYo inside')).toBe(true);
    expect(containsBlockedStyleToken('some text with wayo inside')).toBe(true);
  });

  it('does not false-positive on unrelated text', () => {
    expect(containsBlockedStyleToken('warm adult contemporary pop, I-V-vi-IV progression')).toBe(false);
  });

  it('only matches whole tokens, never a substring inside a longer word', () => {
    expect(containsBlockedStyleToken('waywayoward')).toBe(false);
  });
});

describe('sanitizeSunoStyleText', () => {
  it('removes a blocked token and leaves clean surrounding text', () => {
    const cleaned = sanitizeSunoStyleText('warm pop, wayo, I-V-vi-IV progression, 97 BPM');
    expect(containsBlockedStyleToken(cleaned)).toBe(false);
    expect(cleaned).not.toContain(',,');
    expect(cleaned.startsWith(' ')).toBe(false);
    expect(cleaned.endsWith(',')).toBe(false);
  });

  it('is a no-op when no blocked token is present', () => {
    const text = 'warm pop, strong repeated chorus hook, repeats chorus 4x, I-V-vi-IV progression';
    expect(sanitizeSunoStyleText(text)).toBe(text);
  });

  it('every known blocked token is actually removed', () => {
    for (const token of SUNO_BLOCKED_STYLE_TOKENS) {
      const cleaned = sanitizeSunoStyleText(`prefix ${token} suffix`);
      expect(cleaned.toLowerCase()).not.toContain(token.toLowerCase());
    }
  });
});
