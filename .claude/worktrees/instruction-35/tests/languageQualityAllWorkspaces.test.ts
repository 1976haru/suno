import { describe, expect, it } from 'vitest';
import {
  englishSyllableDensityWarning,
  englishConsonantClusterWarning,
  checkEnglishLyricLineQuality,
  koreanTranslationeseWarning,
  japaneseTranslationeseWarning,
  checkTranslationese
} from '../src/core/languageQuality';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from './fixtures';
import type { ChannelArchetype } from '../src/types';

/**
 * codex 지시문 03 (TASK J) — real gap this closes: core/englishLint.ts
 * already had grammar/forced-metaphor/abstract-noun checks (this adds the
 * 2 genuinely missing English checks — syllable density, consonant-cluster
 * pronounceability); Korean/Japanese had almost nothing (this adds a real,
 * bounded 번역체/直訳体 marker detector — see src/core/languageQuality.ts's
 * own doc comment for why a general grammar checker was explicitly scoped
 * out as unreliable to build without real morphological analysis).
 */
describe('[codex 지시문 03 TASK J] English — syllable density', () => {
  it('flags a real dense, multi-syllable line', () => {
    const finding = englishSyllableDensityWarning('Unbelievable extraordinary circumstances surrounding everything');
    expect(finding).toBeDefined();
    expect(finding?.kind).toBe('syllable-density');
  });

  it('does not flag a real short, punchy pop line', () => {
    expect(englishSyllableDensityWarning('Hold my hand tonight')).toBeUndefined();
  });

  it('is a no-op for a very short line (nothing meaningful to measure)', () => {
    expect(englishSyllableDensityWarning('I know')).toBeUndefined();
  });
});

describe('[codex 지시문 03 TASK J] English — consonant-cluster pronounceability', () => {
  it('flags a real word with a 4+ consonant cluster', () => {
    const finding = englishConsonantClusterWarning('I know my own strengths tonight');
    expect(finding).toBeDefined();
    expect(finding?.detail).toContain('strengths');
  });

  it('does not flag ordinary words with common, easily-sung clusters', () => {
    expect(englishConsonantClusterWarning('The street lights shine bright tonight')).toBeUndefined();
  });
});

describe('[codex 지시문 03 TASK J] checkEnglishLyricLineQuality — combined entry point', () => {
  it('returns findings from both sub-checks across multiple lines', () => {
    const findings = checkEnglishLyricLineQuality(['Hold my hand tonight', 'I know my own strengths tonight']);
    expect(findings.some(f => f.kind === 'consonant-cluster')).toBe(true);
  });
});

describe('[codex 지시문 03 TASK J] Korean — 번역체 detection', () => {
  it('flags a real passive-voice "~에 의해" construction', () => {
    expect(koreanTranslationeseWarning('그 노래는 그대에 의해 만들어졌다')).toBeDefined();
  });

  it('flags a reported-speech "~것으로 보인다" construction', () => {
    expect(koreanTranslationeseWarning('오늘 밤은 특별한 것으로 보인다')).toBeDefined();
  });

  it('flags a stiff sentence-opening "하지만," construction', () => {
    expect(koreanTranslationeseWarning('하지만, 나는 여전히 그대를 기다려요')).toBeDefined();
  });

  it('does not flag ordinary, natural sung Korean', () => {
    expect(koreanTranslationeseWarning('오늘도 좋은 하루였어요 사랑해요 내 마음을')).toBeUndefined();
  });
});

describe('[codex 지시문 03 TASK J] Japanese — 直訳体 detection', () => {
  it('flags a real passive-voice "〜によって" construction', () => {
    expect(japaneseTranslationeseWarning('この歌はあなたによって作られた')).toBeDefined();
  });

  it('does not flag ordinary, natural sung Japanese', () => {
    expect(japaneseTranslationeseWarning('こんにちは 今日もいい天気ですね')).toBeUndefined();
  });
});

describe('[codex 지시문 03 TASK J] checkTranslationese — language dispatch', () => {
  it('is a no-op for English (no translationese check defined for it — a different, unrelated concept from englishLint.ts\'s own checks)', () => {
    expect(checkTranslationese(['This is an English line by the way'], 'english')).toEqual([]);
  });

  it('dispatches to the Korean checker for korean', () => {
    expect(checkTranslationese(['그 노래는 그대에 의해 만들어졌다'], 'korean').length).toBeGreaterThan(0);
  });

  it('dispatches to the Japanese checker for japanese', () => {
    expect(checkTranslationese(['この歌はあなたによって作られた'], 'japanese').length).toBeGreaterThan(0);
  });
});

const WORKSPACE_ARCHETYPES: { archetype: ChannelArchetype; language: 'english' | 'korean' | 'japanese' }[] = [
  { archetype: 'senior-morning', language: 'english' },
  { archetype: 'kr-2030-pop', language: 'korean' },
  { archetype: 'jp-2030-pop', language: 'japanese' },
  { archetype: 'kr-kids-song', language: 'korean' },
  { archetype: 'jp-kids-song', language: 'japanese' },
  { archetype: 'kr-idol-male', language: 'korean' },
  { archetype: 'kr-idol-female', language: 'korean' }
];

describe('[codex 지시문 03 TASK J] real generated lyrics across all 7 workspaces — no translationese false positives', () => {
  it.each(WORKSPACE_ARCHETYPES)('%s: a real 6-song local-generation fixture never false-positives the translationese check', ({ archetype, language }) => {
    const channel = channelPresets.find(c => c.archetype === archetype);
    expect(channel, `no channel for ${archetype}`).toBeDefined();
    const genres = genrePacks.filter(g => channel!.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel!.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel: channel!, songCount: 6, lyricLanguage: language });
    const blueprint = generateLocalBlueprint(opts, genres, moods, seasonPacks[0]);
    for (const song of blueprint.songs) {
      const lines = song.lyrics.split('\n').filter(l => l.trim() && !/^\[[^\]]*\]$/.test(l.trim()));
      const findings = checkTranslationese(lines, language);
      expect(findings, `${archetype} track ${song.trackNo}: ${findings.join(' | ')}`).toHaveLength(0);
    }
  });
});
