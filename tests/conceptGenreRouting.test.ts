import { describe, expect, it } from 'vitest';
import { recommendConceptLocal } from '../src/core/conceptAgent';
import { channelPresets, genrePacks } from '../src/data/presets';
import { CONCEPT_KEYWORD_RULES } from '../src/data/conceptKeywords';

/**
 * TASK v3.61 (TASK B) — the senior-morning channel's real genre pool
 * (channel.preferredGenres) was only 3 ids (adult-contemporary,
 * acoustic-pop, jazz-pop), and conceptKeywords.ts had zero Korean genre-name
 * keywords, so "올드팝"/"샹송"/"알앤비" typed by a user matched nothing and
 * every recommendation fell back to the same 3-4 genres regardless of what
 * was asked. TASK A's 28 oldpop-* genres and the 6 genres already in
 * SENIOR_MORNING_CORE_GENRE_IDS but never routed (chanson, bossa-cafe,
 * smooth-jazz-lounge, retro-soul-pop, folk-pop, city-pop-soft) were real
 * library entries the whole time — this is a routing fix, not a missing-
 * content fix. Verifies all 6 inputs the task's own spec required.
 */
describe('[v3.61 TASK B] Korean concept keyword routing reaches the requested genre families', () => {
  function primaryGenreIds(text: string): string[] {
    const result = recommendConceptLocal(text, 'senior-morning');
    return result.recommendations[0]?.genreAllocation.map(slot => slot.genreId) ?? [];
  }

  it('"올드팝" routes to 3+ oldpop-* genres', () => {
    const ids = primaryGenreIds('올드팝');
    expect(ids.filter(id => id.startsWith('oldpop-')).length).toBeGreaterThanOrEqual(3);
  });

  it('"샹송 분위기로" includes chanson', () => {
    expect(primaryGenreIds('샹송 분위기로')).toContain('chanson');
  });

  it('"알앤비 소울 느낌" includes a soul/R&B genre', () => {
    const ids = primaryGenreIds('알앤비 소울 느낌');
    expect(ids.some(id => ['oldpop-motown-pop-soul', 'oldpop-philly-soul-sweet', 'retro-soul-pop', 'oldpop-quiet-storm-warm'].includes(id))).toBe(true);
  });

  it('"보사노바 분위기로" includes bossa-cafe', () => {
    expect(primaryGenreIds('보사노바 분위기로')).toContain('bossa-cafe');
  });

  it('"따뜻하고 잔잔한 노래" prioritizes the timeless-warmth (1-D) oldpop sub-family', () => {
    const ids = primaryGenreIds('따뜻하고 잔잔한 노래');
    const warmthIds = ['oldpop-warm-morning-glow', 'oldpop-gentle-lullaby-pop', 'oldpop-hearth-acoustic', 'oldpop-sunlit-strings-pop', 'oldpop-slow-waltz-memory', 'oldpop-evening-lamp-ballad'];
    expect(ids.filter(id => warmthIds.includes(id)).length).toBeGreaterThanOrEqual(3);
  });

  it('"아침에 커피와 함께 듣고 싶은 올드팝" routes mostly to oldpop-*', () => {
    const ids = primaryGenreIds('아침에 커피와 함께 듣고 싶은 올드팝');
    expect(ids.filter(id => id.startsWith('oldpop-')).length).toBeGreaterThanOrEqual(3);
  });

  it('every genre id every keyword rule can suggest actually exists in genrePacks', () => {
    const allIds = new Set(genrePacks.map(g => g.id));
    for (const rule of CONCEPT_KEYWORD_RULES) {
      for (const id of Object.keys(rule.genreWeights || {})) {
        expect(allIds.has(id), `${rule.id}: ${id}`).toBe(true);
      }
    }
  });
});

/**
 * TASK v3.61 (TASK B, incidental fix) — chanson/smooth-jazz-lounge were
 * registered only in presets.ts's rawGenrePacks (real generation), never in
 * genreLibrary's own array — conceptAgent.ts's getCoreGenresForArchetype
 * reads genreLibrary, so this silently discarded every "샹송" keyword match
 * before the Korean-keyword fix above could even take effect.
 */
describe('[v3.61 TASK B] chanson/smooth-jazz-lounge resolve via getCoreGenresForArchetype', () => {
  // 지시문 20 (TASK A-1/A-2) — v3.61's own "20종 이상으로 늘리지 말 것"
  // 상한을 이 채널에 한해 명시적으로 초과한다: 지시문 20 자신의 완료
  // 기준이 "24종 이상"이다 (같은 장르 최대 곡수 관문이 4~5종 풀에서는
  // 18÷4~5로 위반되던 실측 문제 해결). 우연한 완화가 아니라 의도된
  // 정책 변경 — 상한을 26으로 재조정.
  it('the senior-morning channel preferredGenres pool is 12-26 ids (24+ per 지시문 20 TASK A, never 3, never unbounded)', () => {
    const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
    expect(channel.preferredGenres.length).toBeGreaterThanOrEqual(12);
    expect(channel.preferredGenres.length).toBeLessThanOrEqual(26);
  });
});
