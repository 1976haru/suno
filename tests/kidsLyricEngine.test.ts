import { describe, expect, it } from 'vitest';
import {
  KIDS_LYRIC_THEMES,
  composeKidsLyrics,
  isKidsLyricSafe,
  kidsLyricSafetyIssues,
  referencesExistingKidsSong,
  themeForSeed
} from '../src/core/kidsLyricEngine';

// TASK v3.38 Part B3 — permanent regression coverage for the kids lyric
// content engine and its forbidden-content / existing-song safety
// validators (replaces the throwaway scratch test used during development).

describe('composeKidsLyrics', () => {
  it('produces Korean lyrics with the full 9-section structure and a hook repeated exactly 4 times', () => {
    const { lyrics, hookPhrase } = composeKidsLyrics({ language: 'korean', title: '즐거운 노래', hook: '친구야 놀자', seed: 11 });
    for (const tag of ['[short intro]', '[verse 1]', '[chorus]', '[verse 2]', '[short bridge]', '[final chorus]', '[end]']) {
      expect(lyrics).toContain(tag);
    }
    // [chorus] appears 3 times mid-song plus 1 [final chorus] = 4 total repeats of the hook block.
    const chorusOccurrences = lyrics.split('[chorus]').length - 1;
    expect(chorusOccurrences).toBe(3);
    expect(lyrics.match(/\[final chorus\]/g)?.length).toBe(1);
    const hookOccurrences = lyrics.split(hookPhrase).length - 1;
    expect(hookOccurrences).toBe(4);
  });

  it('is deterministic for a given seed', () => {
    const a = composeKidsLyrics({ language: 'korean', title: '숫자놀이', hook: '숫자놀이 해봐요', seed: 21 });
    const b = composeKidsLyrics({ language: 'korean', title: '숫자놀이', hook: '숫자놀이 해봐요', seed: 21 });
    expect(a).toEqual(b);
  });

  it('produces safe, non-empty full-structure content for english and japanese lyricLanguage overrides', () => {
    const en = composeKidsLyrics({ language: 'english', title: 'Sunny Day', hook: "Let's play all day", seed: 3 });
    const ja = composeKidsLyrics({ language: 'japanese', title: 'たのしいうた', hook: 'たのしいな', seed: 5 });
    expect(isKidsLyricSafe(en.lyrics)).toBe(true);
    expect(isKidsLyricSafe(ja.lyrics)).toBe(true);
    expect(en.lyrics.length).toBeGreaterThan(20);
    expect(ja.lyrics.length).toBeGreaterThan(20);
    for (const tag of ['[short intro]', '[verse 1]', '[chorus]', '[verse 2]', '[short bridge]', '[final chorus]', '[end]']) {
      expect(en.lyrics, `english missing ${tag}`).toContain(tag);
      expect(ja.lyrics, `japanese missing ${tag}`).toContain(tag);
    }
  });

  // TASK v3.38 Part B (language follow-up) — english/japanese now use the
  // same full per-theme pool structure as korean (previously a single
  // flat fallback pool regardless of theme); confirm the body text actually
  // varies by theme instead of being the same regardless of seed's theme.
  it('varies verse content by theme for english and japanese, not just korean', () => {
    for (const language of ['english', 'japanese'] as const) {
      const bodies = KIDS_LYRIC_THEMES.map((_, i) => {
        // seeds chosen to land on each theme in turn (themeForSeed cycles the 8 themes).
        const { lyrics } = composeKidsLyrics({ language, title: 'T', hook: 'Hook', seed: i });
        return lyrics.split('[verse 1]')[1]?.split('[chorus]')[0]?.trim();
      });
      expect(new Set(bodies).size, language).toBeGreaterThan(1);
    }
  });

  it('generates safe content across every theme, language, and a spread of seeds, with no forbidden topics', () => {
    for (const language of ['korean', 'japanese', 'english'] as const) {
      for (let seed = 0; seed < KIDS_LYRIC_THEMES.length * 3; seed++) {
        const { lyrics } = composeKidsLyrics({ language, title: '노래', hook: 'Hook', seed });
        expect(kidsLyricSafetyIssues(lyrics), `language=${language} seed=${seed} theme=${themeForSeed(seed)}`).toEqual([]);
        expect(referencesExistingKidsSong(lyrics), `language=${language} seed=${seed} theme=${themeForSeed(seed)}`).toBe(false);
      }
    }
  });
});

describe('themeForSeed', () => {
  it('always returns one of the 8 defined kids lyric themes', () => {
    for (let seed = 0; seed < 40; seed++) {
      expect(KIDS_LYRIC_THEMES).toContain(themeForSeed(seed));
    }
  });
});

describe('kidsLyricSafetyIssues / isKidsLyricSafe', () => {
  it('flags fear/violence/death content', () => {
    expect(isKidsLyricSafe('무서운 귀신이 나타났어요')).toBe(false);
    expect(isKidsLyricSafe('There was a scary monster in the dark')).toBe(false);
  });

  it('flags adult romance-pain / excessive sadness content', () => {
    expect(isKidsLyricSafe('우리는 결국 헤어지고 말았어요')).toBe(false);
    expect(isKidsLyricSafe('My heart is broken after the breakup')).toBe(false);
  });

  it('flags appearance judgment and competition-encouragement content', () => {
    expect(isKidsLyricSafe('1등만 최고야 꼴찌는 안돼')).toBe(false);
  });

  it('flags trendy slang', () => {
    expect(isKidsLyricSafe('완전 인싸 되는 법 ㅋㅋ')).toBe(false);
  });

  it('flags brand/commercial references', () => {
    expect(isKidsLyricSafe('This song has a sponsor and a brand')).toBe(false);
  });

  it('finds no issues in ordinary safe kids content', () => {
    const safe = '봄에는 꽃들이 활짝 피어요\n나비가 훨훨 날아다녀요\n친구야 같이 놀자';
    expect(kidsLyricSafetyIssues(safe)).toEqual([]);
    expect(isKidsLyricSafe(safe)).toBe(true);
  });
});

describe('referencesExistingKidsSong', () => {
  it('detects well-known existing nursery rhyme titles, including "곰 세 마리"', () => {
    expect(referencesExistingKidsSong('곰 세 마리가 한 집에 있어')).toBe(true);
    expect(referencesExistingKidsSong('아기상어 뚜루루뚜루')).toBe(true);
    expect(referencesExistingKidsSong('Baby Shark doo doo')).toBe(true);
    expect(referencesExistingKidsSong('학교종이 땡땡땡')).toBe(true);
    expect(referencesExistingKidsSong('반짝반짝 작은 별')).toBe(true);
    expect(referencesExistingKidsSong('Twinkle Twinkle Little Star')).toBe(true);
    expect(referencesExistingKidsSong('뽀롱뽀롱 뽀로로')).toBe(true);
    expect(referencesExistingKidsSong('핑크퐁이랑 놀자')).toBe(true);
    expect(referencesExistingKidsSong('cocomelon adventure')).toBe(true);
  });

  it('does not flag original, unrelated kids content', () => {
    expect(referencesExistingKidsSong('친구야 같이 놀자 손잡고 뛰어가자')).toBe(false);
    expect(referencesExistingKidsSong("Let's sing a happy song together")).toBe(false);
  });
});
