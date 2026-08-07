import { type TextMotifOverrideResult, checkTextMotifQuotasWithConceptOverride } from './textMotifQuota';
import { modern2030PolicyFor } from './modern2030Policy';
import { japaneseTranslationeseWarning } from './languageQuality';

/**
 * codex 지시문 04 (§3) — real, dedicated jp-2030 policy adapter. Kana
 * minimum(JAPANESE_KANA_RATIO_MIN)/순수 중국어 차단은 core/lyricMetrics.ts's
 * checkLyricLanguageMatch에 이미 실제로 존재한다 (재구현하지 않음). 직역체
 * 차단은 core/languageQuality.ts's japaneseTranslationeseWarning(지시문 03
 * TASK J)을 그대로 재사용한다. bilingualPair(en-ja) 기본값은
 * core/localGenerator.ts's resolveBilingualPair(지시문 02 TASK F)에서 이미
 * 처리된다.
 */

const KATAKANA_ONLY_PATTERN = /[゠-ヿ]/g;
const HIRAGANA_ONLY_PATTERN = /[぀-ゟ]/g;

/**
 * "katakana 영어 과다 제한" — real gap: confirmed by investigation that
 * core/bilingualLint.ts's own katakana check is scoped to BILINGUAL
 * English-word-learning content only (a fixed KATAKANA_TARGET_WORDS list),
 * never applied to standalone Japanese lyrics. This measures the real
 * katakana-vs-hiragana BALANCE (katakana / (katakana + hiragana)) — a
 * genuinely high katakana share relative to hiragana is the honest signal
 * for "reads as excessive Anglicism/loanword-heavy," since katakana in
 * real Japanese lyrics is legitimately used for emphasis/foreign loanwords
 * in moderation, and kanji-heavy vs. hiragana-heavy is an unrelated axis
 * (formality, not Anglicism) this ratio deliberately excludes.
 */
export const JP_2030_KATAKANA_OVERUSE_THRESHOLD = 0.5;

export function katakanaShareOfKana(lyrics: string): number {
  const katakana = (lyrics.match(KATAKANA_ONLY_PATTERN) ?? []).length;
  const hiragana = (lyrics.match(HIRAGANA_ONLY_PATTERN) ?? []).length;
  const total = katakana + hiragana;
  return total ? katakana / total : 0;
}

export function findKatakanaOveruse(songs: { trackNo: number; lyrics: string }[]): number[] {
  return songs
    .filter(song => {
      const share = katakanaShareOfKana(song.lyrics);
      // Only meaningful once there's real kana content to measure a ratio
      // over — a near-empty/kanji-only line shouldn't false-positive.
      const kanaCount = (song.lyrics.match(KATAKANA_ONLY_PATTERN) ?? []).length + (song.lyrics.match(HIRAGANA_ONLY_PATTERN) ?? []).length;
      return kanaCount >= 20 && share > JP_2030_KATAKANA_OVERUSE_THRESHOLD;
    })
    .map(song => song.trackNo);
}

export function checkJp2030ModernMotifQuotas(
  songs: { trackNo: number; lyrics: string; listenerSituation?: string }[],
  conceptLabel?: string
): TextMotifOverrideResult[] {
  const policy = modern2030PolicyFor('jp-2030');
  if (!policy) return [];
  return checkTextMotifQuotasWithConceptOverride(songs, policy.modernSceneFamilies, conceptLabel);
}

/**
 * "같은 `〜の夜`, `〜の帰り道` 과다 감지" — real gap: confirmed by
 * investigation that data/titlePatterns.ts's own pattern system only ever
 * applies when language === 'english' (core/lyricEngine.ts's titleFromHook
 * falls back to the hook phrase verbatim for every other language) — the
 * Japanese-language title path this task cares about isn't even in that
 * system's reach. Applied directly to TITLES (not lyric body text).
 */
export function checkJp2030TitleSuffixOveruse(songs: { trackNo: number; title: string }[]): TextMotifOverrideResult[] {
  const policy = modern2030PolicyFor('jp-2030');
  if (!policy) return [];
  const asTextMotifSongs = songs.map(s => ({ trackNo: s.trackNo, lyrics: s.title }));
  return checkTextMotifQuotasWithConceptOverride(asTextMotifSongs, policy.staleClicheFamilies, undefined);
}

export function checkJp2030Translationese(songs: { trackNo: number; lyrics: string }[]): string[] {
  const warnings: string[] = [];
  for (const song of songs) {
    for (const rawLine of song.lyrics.split('\n')) {
      const line = rawLine.trim();
      if (!line || /^\[[^\]]*\]$/.test(line)) continue;
      const warning = japaneseTranslationeseWarning(line);
      if (warning) warnings.push(`Track ${song.trackNo}: ${warning}`);
    }
  }
  return warnings;
}
