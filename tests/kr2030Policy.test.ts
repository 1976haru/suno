import { describe, expect, it } from 'vitest';
import {
  checkKr2030OpeningClicheOveruse,
  checkKr2030ModernMotifQuotas,
  checkKr2030StructureVariety,
  findUnexpectedRapSections,
  checkKr2030Translationese,
  KR_2030_MIN_STRUCTURE_SHAPES
} from '../src/core/kr2030Policy';
import { resolveBilingualPair } from '../src/core/localGenerator';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from './fixtures';

/**
 * codex 지시문 04 (§2) — real, dedicated kr-2030 policy adapter. Real gap
 * this closes: core/lyricVocabularyRepetition.ts's own word-frequency
 * counter is ASCII-only and cannot see Korean opening-phrase repetition at
 * all — this is a genuinely new, position-scoped (opening line) check.
 */
describe('[codex 지시문 04 §2] checkKr2030OpeningClicheOveruse', () => {
  it('flags a pack where 3+ songs open with "오늘도"', () => {
    const songs = Array.from({ length: 3 }, (_, i) => ({ trackNo: i + 1, lyrics: `[verse 1]\n오늘도 하루가 시작돼\n\n[chorus]\nHook` }));
    const findings = checkKr2030OpeningClicheOveruse(songs);
    expect(findings.some(f => f.id === 'opening-oneuldo')).toBe(true);
  });

  it('does not flag when only 2 songs share the same opening phrase (within the cap)', () => {
    const songs = Array.from({ length: 2 }, (_, i) => ({ trackNo: i + 1, lyrics: `[verse 1]\n오늘도 하루가 시작돼\n\n[chorus]\nHook` }));
    expect(checkKr2030OpeningClicheOveruse(songs)).toHaveLength(0);
  });

  it('does not flag when the phrase appears mid-song, not as the real opening line', () => {
    const songs = [{ trackNo: 1, lyrics: `[verse 1]\n평범한 시작이야\n오늘도 계속되는 하루\n\n[chorus]\nHook` }];
    expect(checkKr2030OpeningClicheOveruse(songs)).toHaveLength(0);
  });

  it('flags a pack overusing "이 밤" as an opener', () => {
    const songs = Array.from({ length: 3 }, (_, i) => ({ trackNo: i + 1, lyrics: `[verse 1]\n이 밤 우리는 함께해\n\n[chorus]\nHook` }));
    expect(checkKr2030OpeningClicheOveruse(songs).some(f => f.id === 'opening-i-bam')).toBe(true);
  });
});

describe('[codex 지시문 04 §2] checkKr2030ModernMotifQuotas', () => {
  it('flags a real motif overuse (subway/last-train, cap 1)', () => {
    const songs = [
      { trackNo: 1, lyrics: 'x', listenerSituation: '막차 지하철 안에서' },
      { trackNo: 2, lyrics: 'x', listenerSituation: '지하철 창밖을 보며' }
    ];
    const findings = checkKr2030ModernMotifQuotas(songs);
    expect(findings.some(f => f.familyId === 'subway-last-train')).toBe(true);
  });

  it('records a real concept-is-subject override', () => {
    const songs = [
      { trackNo: 1, lyrics: 'x', listenerSituation: '막차 지하철 안에서' },
      { trackNo: 2, lyrics: 'x', listenerSituation: '지하철 창밖을 보며' }
    ];
    const findings = checkKr2030ModernMotifQuotas(songs, '지하철에서의 순간들 (subway concept album)');
    const finding = findings.find(f => f.familyId === 'subway-last-train');
    expect(finding?.overridden).toBe(true);
  });
});

describe('[codex 지시문 04 §2] checkKr2030StructureVariety', () => {
  it('flags a pack with fewer than 4 distinct structure shapes', () => {
    const songs = Array.from({ length: 18 }, () => ({ structureTemplate: 'T1' as const }));
    const result = checkKr2030StructureVariety(songs);
    expect(result.belowTarget).toBe(true);
    expect(result.distinctCount).toBe(1);
  });

  it('does not flag a pack with real structural variety', () => {
    const templates = ['T1', 'T2', 'T3', 'T4'] as const;
    const songs = Array.from({ length: 18 }, (_, i) => ({ structureTemplate: templates[i % 4] }));
    expect(checkKr2030StructureVariety(songs).belowTarget).toBe(false);
  });

  it('the policy requires the real 4-shape minimum this task names', () => {
    expect(KR_2030_MIN_STRUCTURE_SHAPES).toBe(4);
  });
});

describe('[codex 지시문 04 §2] findUnexpectedRapSections — regression guard', () => {
  it('is currently always empty for real kr-2030 generation (rap is structurally confined to kr-idol today)', () => {
    const channel = channelPresets.find(c => c.archetype === 'kr-2030-pop')!;
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel, songCount: 6 });
    const blueprint = generateLocalBlueprint(opts, genres, moods, seasonPacks[0]);
    expect(findUnexpectedRapSections(blueprint.songs)).toHaveLength(0);
  });

  it('detects a real [rap] section if one somehow appeared', () => {
    const songs = [{ trackNo: 1, lyrics: '[rap]\nspit some real bars here today' }];
    expect(findUnexpectedRapSections(songs)).toEqual([1]);
  });
});

describe('[codex 지시문 04 §2] checkKr2030Translationese — reuses 지시문 03 TASK J, not reimplemented', () => {
  it('flags a real 번역체 line', () => {
    const songs = [{ trackNo: 1, lyrics: '그 노래는 그대에 의해 만들어졌다' }];
    expect(checkKr2030Translationese(songs).length).toBeGreaterThan(0);
  });
});

describe('[codex 지시문 04 §2] bilingualPair defaults to en-ko (already real, 지시문 02 TASK F)', () => {
  it('kr-2030-pop resolves to en-ko', () => {
    const channel = channelPresets.find(c => c.archetype === 'kr-2030-pop')!;
    expect(resolveBilingualPair({ channel })).toBe('en-ko');
  });
});
