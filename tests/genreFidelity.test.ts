import { describe, expect, it } from 'vitest';
import {
  stylePromptOpensWithGenre,
  stylePromptKeepsGenreVocabulary,
  checkGenreDistribution,
  runGenreFidelityCheck
} from '../src/core/genreFidelity';

/**
 * 지시문 58 (TASK D) — core/genreFidelity.ts는 npm run audit(genre_opens_prompt/
 * genre_core_vocabulary)과 scripts/checkGenreFidelity.ts(npm run
 * check:genre-fidelity) 둘 다의 판정 로직을 공유하는 단일 소스. 실측
 * 재현(8/14 굿모닝추억라디오 팩, 8/10 비틀즈 팩)까지 포함한다.
 */
describe('지시문 58 TASK D — stylePromptOpensWithGenre', () => {
  it('8/14 회귀 재현: 시대로 시작하면 false', () => {
    expect(stylePromptOpensWithGenre('1970s Motown Pop Soul, soulful female voice, 63 BPM')).toBe(false);
  });

  it('8/10 정상 사례: 장르로 시작하면 true', () => {
    expect(stylePromptOpensWithGenre('British Beat Pop, 1950s-60s old-pop lounge, 67 BPM')).toBe(true);
  });
});

describe('지시문 58 TASK D — stylePromptKeepsGenreVocabulary', () => {
  it('genreId가 없으면 null(판정 불가) — 위반으로 세지 않는다', () => {
    expect(stylePromptKeepsGenreVocabulary(undefined, 'anything')).toBeNull();
  });

  it('알 수 없는 genreId도 null', () => {
    expect(stylePromptKeepsGenreVocabulary('not-a-real-genre-id', 'anything')).toBeNull();
  });

  it('실측(motown-pop-soul): 악기는 있지만 rhythm 문구가 없으면 false', () => {
    const stylePrompt = '1970s Motown Pop Soul, soulful female voice, tambourine on all four beats, melodic electric bass, horn section stabs, gospel-toned backing vocals';
    expect(stylePromptKeepsGenreVocabulary('oldpop-motown-pop-soul', stylePrompt)).toBe(false);
  });

  it('악기·리듬 문구가 모두 있으면 true', () => {
    const stylePrompt = 'Motown Pop Soul, driving four-on-the-floor soul pulse, tambourine on all four beats, melodic electric bass, horn section stabs, gospel-toned backing vocals';
    expect(stylePromptKeepsGenreVocabulary('oldpop-motown-pop-soul', stylePrompt)).toBe(true);
  });
});

describe('지시문 58 TASK D — checkGenreDistribution', () => {
  it('실측(8/14 _02 팩): 5/4/4/1/1 — 1곡짜리 2개, 최대 곡수는 40% 이하(6곡) 안에 든다', () => {
    const songs = [
      ...Array.from({ length: 5 }, (_, i) => ({ trackNo: i + 1, genreId: 'a', stylePrompt: '' })),
      ...Array.from({ length: 4 }, (_, i) => ({ trackNo: i + 6, genreId: 'b', stylePrompt: '' })),
      ...Array.from({ length: 4 }, (_, i) => ({ trackNo: i + 10, genreId: 'c', stylePrompt: '' })),
      { trackNo: 14, genreId: 'd', stylePrompt: '' },
      { trackNo: 15, genreId: 'e', stylePrompt: '' }
    ];
    const report = checkGenreDistribution(songs);
    expect(report.maxCount).toBe(5);
    expect(report.withinMax).toBe(true);
    expect(report.singletons.sort()).toEqual(['d', 'e']);
    expect(report.noSingletons).toBe(false);
  });

  it('4종 균등(4·4·4·3): 1곡짜리 없음, 최대 곡수 안에 든다', () => {
    const songs = [
      ...Array.from({ length: 4 }, (_, i) => ({ trackNo: i + 1, genreId: 'a', stylePrompt: '' })),
      ...Array.from({ length: 4 }, (_, i) => ({ trackNo: i + 5, genreId: 'b', stylePrompt: '' })),
      ...Array.from({ length: 4 }, (_, i) => ({ trackNo: i + 9, genreId: 'c', stylePrompt: '' })),
      ...Array.from({ length: 3 }, (_, i) => ({ trackNo: i + 13, genreId: 'd', stylePrompt: '' }))
    ];
    const report = checkGenreDistribution(songs);
    expect(report.noSingletons).toBe(true);
    expect(report.withinMax).toBe(true);
  });

  it('genreId 없는 곡은 집계에서 제외된다', () => {
    const songs = [{ trackNo: 1, stylePrompt: '' }, { trackNo: 2, genreId: 'a', stylePrompt: '' }];
    const report = checkGenreDistribution(songs);
    expect(report.counts).toEqual({ a: 1 });
  });
});

describe('지시문 58 TASK D — runGenreFidelityCheck (통합)', () => {
  it('8/14 스타일 회귀 팩: ①③ 전부 미달, distribution에 singleton 반영', () => {
    const songs = [
      { trackNo: 1, genreId: 'oldpop-motown-pop-soul', stylePrompt: '1970s Motown Pop Soul, soulful female voice, tambourine on all four beats, melodic electric bass' },
      { trackNo: 2, genreId: 'oldpop-motown-pop-soul', stylePrompt: '1970s Motown Pop Soul, soulful female voice, tambourine on all four beats' },
      { trackNo: 3, genreId: 'healing-ballad', stylePrompt: '1980s healing memory, piano' }
    ];
    const report = runGenreFidelityCheck(songs);
    expect(report.opensWithGenre.pass).toBe(0);
    expect(report.opensWithGenre.failedTrackNos).toEqual([1, 2, 3]);
    expect(report.distribution.singletons).toContain('healing-ballad');
  });

  it('genre-first 정상 팩: ①은 전부 통과', () => {
    const songs = [
      { trackNo: 1, genreId: 'oldpop-british-beat', stylePrompt: 'British Beat Pop, 1950s-60s old-pop lounge, 67 BPM' },
      { trackNo: 2, genreId: 'oldpop-british-beat', stylePrompt: 'British Beat Pop, jangly guitar, 1950s-60s' }
    ];
    const report = runGenreFidelityCheck(songs);
    expect(report.opensWithGenre.pass).toBe(2);
    expect(report.opensWithGenre.failedTrackNos).toEqual([]);
  });
});
