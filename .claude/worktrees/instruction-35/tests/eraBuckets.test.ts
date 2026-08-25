import { describe, expect, it } from 'vitest';
import { genreLibrary } from '../src/data/genreLibrary';
import { ERA_BUCKETS_BY_GENRE_ID, ERA_NOTE_KO_BY_GENRE_ID } from '../src/data/eraBuckets';
import { eraBucketForGenreId } from '../src/data/eraExclusions';
import { eraPrimaryShareOf, eraNeutralShareOf } from '../src/core/constraints';
import { eraIntentForWorkspace } from '../src/data/workspaceEraIntent';

/**
 * 지시문 12 (TASK A) — genreLibrary 354종 전수 eraBuckets/eraNoteKo 부여의
 * 완료 판정 테스트 + §A-4의 실측 정정(모타운 1960s 포함) 회귀 고정.
 */

describe('[지시문 12 TASK A] genreLibrary 354종 전수 eraBuckets/eraNoteKo 부여', () => {
  it('every genre in genreLibrary has a non-empty eraBuckets array', () => {
    const missing = genreLibrary.filter(g => !g.eraBuckets || g.eraBuckets.length === 0).map(g => g.id);
    expect(missing, `eraBuckets 없는 장르: ${missing.join(', ')}`).toEqual([]);
  });

  it('every genre in genreLibrary has an eraNoteKo (근거)', () => {
    const missing = genreLibrary.filter(g => !g.eraNoteKo).map(g => g.id);
    expect(missing, `eraNoteKo 없는 장르: ${missing.join(', ')}`).toEqual([]);
  });

  it('ERA_BUCKETS_BY_GENRE_ID and ERA_NOTE_KO_BY_GENRE_ID cover every real genreLibrary id (no stray/missing keys)', () => {
    const realIds = new Set(genreLibrary.map(g => g.id));
    const bucketKeys = new Set(Object.keys(ERA_BUCKETS_BY_GENRE_ID));
    const noteKeys = new Set(Object.keys(ERA_NOTE_KO_BY_GENRE_ID));
    for (const id of realIds) {
      expect(bucketKeys.has(id), `ERA_BUCKETS_BY_GENRE_ID missing "${id}"`).toBe(true);
      expect(noteKeys.has(id), `ERA_NOTE_KO_BY_GENRE_ID missing "${id}"`).toBe(true);
    }
  });

  it('no genre has both a real decade bucket and "era-neutral" in the same array (mutually exclusive by construction)', () => {
    const offenders = genreLibrary.filter(g => g.eraBuckets.length > 1 && g.eraBuckets.includes('era-neutral')).map(g => g.id);
    expect(offenders, `era-neutral이 다른 실제 버킷과 섞인 장르: ${offenders.join(', ')}`).toEqual([]);
  });
});

describe('[지시문 12 TASK A-4] 실측 정정 — oldpop-motown-pop-soul 1960s 포함', () => {
  it('oldpop-motown-pop-soul eraBuckets includes both 1960s and 1970s (Motown 전성기는 1960년대)', () => {
    const genre = genreLibrary.find(g => g.id === 'oldpop-motown-pop-soul')!;
    expect(genre.eraBuckets).toContain('1960s');
    expect(genre.eraBuckets).toContain('1970s');
  });

  it('oldpop-philly-soul-sweet stays 1970s-only (정정 대상 아님, 확인용)', () => {
    const genre = genreLibrary.find(g => g.id === 'oldpop-philly-soul-sweet')!;
    expect(genre.eraBuckets).toEqual(['1970s']);
  });

  it('eraBucketForGenreId(oldpop-motown-pop-soul) now resolves to the coarse 1950s-60s bucket first (priority-order adapter)', () => {
    expect(eraBucketForGenreId('oldpop-motown-pop-soul')).toBe('1950s-60s');
  });
});

describe('[지시문 12 TASK A-2] eraBucketForGenreId 커버리지 확장 — 이전에 null이었던 장르들', () => {
  it.each([
    ['showa-modern', '1970s'],
    ['city-pop-soft', '1970s'],
    ['kayokyoku-70s', '1970s'],
    ['japanese-folk-70s', '1970s'],
    ['new-music-70s', '1970s'],
    ['showa-groove-70s', '1970s'],
    ['jpop-2000s-ballad', '2000s'],
    ['adult-contemporary', '1980s'],
    ['chanson', '1950s-60s'],
    ['folk-pop', '1950s-60s'],
    ['bossa-cafe', '1950s-60s'],
    ['piano-ballad', '1970s'],
    ['retro-soul-pop', '1950s-60s'],
    ['smooth-jazz-lounge', '1980s']
  ])('%s now resolves to %s (was null before TASK A)', (id, expected) => {
    expect(eraBucketForGenreId(id)).toBe(expected);
  });

  it('a genuinely era-neutral genre (no historical claim, not legacy-timeless) still resolves to null', () => {
    expect(eraBucketForGenreId('jazz-pop')).toBeNull();
    expect(eraBucketForGenreId('lofi-cafe')).toBeNull();
  });

  it('the 6 legacy oldpop-* "timeless" genres still resolve to \'timeless\' (not null) — backward-compat contract', () => {
    for (const id of ['oldpop-warm-morning-glow', 'oldpop-gentle-lullaby-pop', 'oldpop-hearth-acoustic', 'oldpop-sunlit-strings-pop', 'oldpop-slow-waltz-memory', 'oldpop-evening-lamp-ballad']) {
      expect(eraBucketForGenreId(id)).toBe('timeless');
    }
  });
});

describe('[지시문 12 TASK A-3] era-neutral 분모 제외 + 워크스페이스 정책 상한', () => {
  it('eraPrimaryShareOf excludes era-neutral genres from the denominator entirely', () => {
    // 6곡 1950s-60s + 4곡 era-neutral(timeless) → 분모는 6곡뿐, 100%
    const counts = { 'oldpop-doowop-harmony': 6, 'oldpop-warm-morning-glow': 4 };
    expect(eraPrimaryShareOf(counts, '1950s-60s')).toBe(1);
  });

  it('eraPrimaryShareOf returns a lower share when non-neutral competing-bucket genres are mixed in (denominator still excludes only era-neutral)', () => {
    // 5곡 1950s-60s + 5곡 1970s(비-neutral) + 8곡 era-neutral → 분모 10곡, 1950s-60s 50%
    const counts = { 'oldpop-doowop-harmony': 5, 'oldpop-soft-rock-am': 5, 'oldpop-warm-morning-glow': 8 };
    expect(eraPrimaryShareOf(counts, '1950s-60s')).toBe(0.5);
  });

  it('eraNeutralShareOf denominator is the full song count (no exclusion)', () => {
    const counts = { 'oldpop-doowop-harmony': 6, 'oldpop-warm-morning-glow': 4 };
    expect(eraNeutralShareOf(counts)).toBeCloseTo(4 / 10);
  });

  it('an unmapped/unknown genre id is conservatively treated as era-neutral (fails toward being counted, matching the old generic-catch-all safety net)', () => {
    const counts = { 'oldpop-doowop-harmony': 5, 'totally-made-up-genre-id': 5 };
    expect(eraNeutralShareOf(counts)).toBe(0.5);
    expect(eraPrimaryShareOf(counts, '1950s-60s')).toBe(1); // denominator excludes the unmapped id too
  });

  it('senior-oldpop has an eraNeutralPolicy (min 3 / max 6 of 18, documented as an estimate); other workspaces have none (unlimited)', () => {
    expect(eraIntentForWorkspace('senior-oldpop').eraNeutralPolicy?.maxTracks).toBe(6);
    expect(eraIntentForWorkspace('senior-oldpop').eraNeutralPolicy?.minTracks).toBe(3);
    expect(eraIntentForWorkspace('senior-oldpop').eraNeutralPolicy?.verified).toBe(false);
    expect(eraIntentForWorkspace('kr-2030').eraNeutralPolicy).toBeUndefined();
    expect(eraIntentForWorkspace('kr-kids').eraNeutralPolicy).toBeUndefined();
  });
});
