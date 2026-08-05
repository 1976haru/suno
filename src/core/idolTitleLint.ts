/**
 * TASK K2 §9-2 item 5 / §9-3 — a real-song-title collision guard specific to
 * the idol workspace: K1 §12's own "실존 그룹 모방" warning names title
 * collision as a real risk this project hasn't built defenses for yet
 * (unlike D1's own KNOWN_EXISTING_KIDS_SONGS pattern for kids content — see
 * §9-5, deliberately left unbuilt here since K-pop's own existing-song
 * catalog is far too large to list, a decision left to §13-4).
 *
 * §9-3's own reasoning: a short English-only title is exactly the shape
 * most likely to already exist as a real K-pop song's title ("Fire",
 * "Dynamite", "Next Level", ...), so this is a narrow, cheap check that
 * catches the highest-risk shape without needing an actual song-title
 * database. Warning-only (same weak-signal convention as
 * core/quality.ts's own titleHookOverlapWarning) — never blocks generation.
 */
export function idolSingleEnglishWordTitleWarning(title: string): string | null {
  const trimmed = (title || '').trim();
  if (!trimmed) return null;
  // A lone Latin-script token, no spaces, no Hangul/Kana/Han content —
  // exactly the "위험: 한 단어 영어 제목" shape §9-3 calls out. A title
  // with any Korean content, or two-or-more words, is "안전" per §9-3 and
  // never warns.
  const isSingleToken = !/\s/.test(trimmed);
  const isLatinOnly = /^[A-Za-z][A-Za-z'-]*$/.test(trimmed);
  if (isSingleToken && isLatinOnly) {
    return `Title "${trimmed}" is a single bare English word — high collision risk with an existing K-pop song title (§9-3). Prefer a Korean+English combination or two or more words.`;
  }
  return null;
}
