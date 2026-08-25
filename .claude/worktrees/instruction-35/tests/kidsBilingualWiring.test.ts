import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { isKidsLyricSafe, kidsLyricSafetyIssues } from '../src/core/kidsLyricEngine';
import { checkLyricLanguageMatch } from '../src/core/lyricMetrics';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import type { ChannelProfile, GenerationOptions, LyricLanguage } from '../src/types';

/**
 * v5.14 (bilingual wiring follow-up) — real, end-to-end evidence that
 * TASK E1/F1's kids bilingual mechanism (data/krKidsBilingual.ts /
 * data/jpKidsBilingual.ts hand-authored color/number/greeting content,
 * krKidsBilingualConceptForThemeId / jpKidsBilingualConceptForThemeId theme
 * lookups, and kidsLyricEngine.ts's bilingualConcept branch) is now actually
 * reachable through a real generateLocalBlueprint call, not just through
 * composeKidsLyrics called directly. localGenerator.ts's kids branch now
 * derives bilingualConcept from the track's selected lyric theme id
 * whenever a "*-in-english" theme is picked — this file forces that theme
 * selection via a manual lyricTheme diversityAllocation (the same mechanism
 * Step2Plan.tsx's manual axis controls use) so the bilingual branch is
 * guaranteed to fire, rather than depending on the theme's own random-plan
 * share.
 *
 * This is NOT about the kids channel's primary-language picker (which still
 * deliberately excludes 'bilingual' as a LyricLanguage value — see
 * Step1Channel.tsx's TASK v3.38 Part B1 comment and TASK E1's own commit
 * message: "deliberately not a new LyricLanguage member"). The bilingual
 * overlay here rides on top of a normal `korean`/`japanese` lyricLanguage
 * pack, triggered by theme selection, exactly as E1/F1 designed it.
 */

const KR_KIDS_CHANNEL = channelPresets.find(c => c.id === 'follow-along-action-song')!;
const JP_KIDS_CHANNEL = channelPresets.find(c => c.id === 'teasobi-hiroba')!;
const SEASON = seasonPacks.find(s => s.id === 'spring-open') ?? seasonPacks[0];

function packForcedOnTheme(channel: ChannelProfile, lyricLanguage: LyricLanguage, themeId: string, songCount = 6) {
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
  const opts: GenerationOptions = {
    channel,
    projectTitle: 'Kids Bilingual Wiring Test Pack',
    songCount,
    lyricLanguage,
    market: channel.market,
    audience: channel.audience,
    genreIds: channel.preferredGenres,
    moodIds: channel.preferredMoods,
    seasonId: SEASON.id,
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: '',
    avoidWords: '',
    personaMode: false,
    diversityAllocations: [
      { axis: 'lyricTheme', mode: 'manual', counts: { [themeId]: songCount } }
    ]
  } as GenerationOptions;
  return generateLocalBlueprint(opts, genres, moods, SEASON);
}

// v5.14 — data/krKidsBilingual.ts's own doc comment: each concept keeps
// Korean/Japanese SENTENCE structure and only swaps in ONE English noun per
// line ("영어 단어 + 한국어 문장", not English lyrics), so lyricMetrics.ts's
// checkLyricLanguageMatch(lyrics, 'bilingual') — built for a full separate
// LyricLanguage where each language gets its OWN multi-word lines — doesn't
// fit this content's shape (every line mixes both languages by design, so
// its ">1 English token per line" real-line counter reads 0). The right
// validation for THIS content shape is: (a) the base-language ratio check
// (checkLyricLanguageMatch with the pack's actual korean/japanese language)
// still passes, confirming English words stay a minority as intended, and
// (b) each of the concept's 3 real English words actually appears at least
// twice (once in the hook via chorus/finalChorus repeats, once each in
// verse1/verse2 per krKidsBilingual.ts's own "같은 단어를 최소 2회 반복" rule).
function englishWordOccurrences(lyrics: string, word: string): number {
  return (lyrics.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
}

describe('[v5.14] kids bilingual wiring — real generateLocalBlueprint output', () => {
  it('kr-kids-song: forcing the krkids-color-in-english theme produces real Korean-English bilingual lyrics, not the plain hangul-fallback pool', () => {
    const pack = packForcedOnTheme(KR_KIDS_CHANNEL, 'korean', 'krkids-color-in-english');
    expect(pack.songs.length).toBeGreaterThan(0);
    for (const song of pack.songs) {
      expect(song.lyrics).toMatch(/노랑은 yellow|파랑은 blue|빨강은 red/);
      for (const word of ['red', 'yellow', 'blue']) {
        expect(englishWordOccurrences(song.lyrics, word), `"${word}" in:\n${song.lyrics}`).toBeGreaterThanOrEqual(2);
      }
      const check = checkLyricLanguageMatch(song.lyrics, 'korean');
      expect(check, 'expected a language check result').toBeTruthy();
      expect(check!.ok, `korean ratio check failed: ${JSON.stringify(check!.ratios)}`).toBe(true);
      expect(isKidsLyricSafe(song.lyrics)).toBe(true);
      expect(kidsLyricSafetyIssues(song.lyrics)).toEqual([]);
    }
  });

  it('kr-kids-song: krkids-number-in-english and krkids-greeting-in-english also produce their own real bilingual content', () => {
    const numberPack = packForcedOnTheme(KR_KIDS_CHANNEL, 'korean', 'krkids-number-in-english', 3);
    for (const song of numberPack.songs) {
      expect(song.lyrics).toMatch(/둘은 two|셋은 three|하나는 one/);
      for (const word of ['one', 'two', 'three']) {
        expect(englishWordOccurrences(song.lyrics, word)).toBeGreaterThanOrEqual(2);
      }
    }
    const greetingPack = packForcedOnTheme(KR_KIDS_CHANNEL, 'korean', 'krkids-greeting-in-english', 3);
    for (const song of greetingPack.songs) {
      expect(song.lyrics).toMatch(/안녕은 hello|잘 가는 bye|친구는 friend/);
      for (const word of ['hello', 'bye', 'friend']) {
        expect(englishWordOccurrences(song.lyrics, word)).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('jp-kids-song: forcing the jpkids-number-in-english theme produces real Japanese-English bilingual lyrics', () => {
    const pack = packForcedOnTheme(JP_KIDS_CHANNEL, 'japanese', 'jpkids-number-in-english');
    expect(pack.songs.length).toBeGreaterThan(0);
    for (const song of pack.songs) {
      expect(song.lyrics).toMatch(/にで two|さんで three|いちは one/);
      for (const word of ['one', 'two', 'three']) {
        expect(englishWordOccurrences(song.lyrics, word), `"${word}" in:\n${song.lyrics}`).toBeGreaterThanOrEqual(2);
      }
      const check = checkLyricLanguageMatch(song.lyrics, 'japanese');
      expect(check, 'expected a language check result').toBeTruthy();
      expect(check!.ok, `japanese ratio check failed: ${JSON.stringify(check!.ratios)}`).toBe(true);
      expect(isKidsLyricSafe(song.lyrics)).toBe(true);
      expect(kidsLyricSafetyIssues(song.lyrics)).toEqual([]);
    }
  });

  it('a normal (non "*-in-english") kids theme is unaffected — no accidental bilingual leak into ordinary kids packs', () => {
    const pack = packForcedOnTheme(KR_KIDS_CHANNEL, 'korean', 'krkids-lullaby-goodnight', 3);
    for (const song of pack.songs) {
      expect(song.lyrics).not.toMatch(/노랑은 yellow|파랑은 blue|빨강은 red|둘은 two|셋은 three|안녕은 hello/);
    }
  });
});
