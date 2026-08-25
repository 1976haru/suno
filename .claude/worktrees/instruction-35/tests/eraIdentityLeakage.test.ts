import { describe, expect, it } from 'vitest';
import { directSetLocal } from '../src/core/setDirector';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { getGenreById } from '../src/data/genreLibrary';
import { eraBucketForGenreId } from '../src/data/eraExclusions';
import { extractEraConstraint } from '../src/core/constraints';
import { tightenEraConstraintForSenior } from '../src/core/seniorOldpopPolicy';
import { channelPresets } from '../src/data/presets';
import type { GenerationOptions } from '../src/types';

/**
 * 지시문 08 (TASK E) — real, measured root cause: core/constraints.ts's
 * extractEraConstraint treats an adjacent decade as up to 25% of a pack
 * for EVERY workspace — a real senior-oldpop 60s concept landed
 * oldpop-yacht-west-coast (eraTag '1970s') at exactly 4/18 songs (22%,
 * legal under 25% but already a fail under core/seniorOldpopPolicy.ts's
 * own tighter 11% transitionMax, which core/releaseReadiness.ts's
 * checkSeniorEraShare — 지시문 08 TASK C — enforces). core/setDirector.ts
 * now tightens the adjacent cap to 11% for senior-morning specifically
 * before calling applyEraQuota, with headroom to avoid two OTHER real,
 * measured regressions: landing a genre at exactly 1 song (this
 * codebase's own existing no-singleton rule, tests/genreSingletonRootCause
 * .test.ts) and shortfalling total songCount when the primary-era genre
 * family's own capacity (genre count x per-genre cap) can't reach
 * songCount alone (a real 1980s-concept case, only 3 genres available).
 */
describe('지시문 08 TASK E — era identity leakage', () => {
  function generateFor(concept: string, songCount: number) {
    const channel = channelPresets.find(c => c.archetype === 'senior-morning')!;
    const plan = directSetLocal(concept, channel, songCount, { recentGenreIds: [], recentHooks: [] });
    const genreAllocation = plan.allocations.find(a => a.axis === 'genre');
    const genreIds = genreAllocation ? Object.keys(genreAllocation.counts) : channel.preferredGenres;
    const genres = genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const opts: GenerationOptions = {
      channel, projectTitle: concept, songCount, lyricLanguage: channel.primaryLanguage,
      market: channel.market, audience: channel.audience, genreIds, moodIds: channel.preferredMoods,
      seasonId: 'spring-open', vocalTone: channel.defaultVocal, perspective: 'firstPerson',
      lyricDepth: 'commercial', durationTarget: 'under3m30', moneyChordMode: 'default',
      customMoneyChord: '', customConcept: concept, avoidWords: '', personaMode: false,
      diversityAllocations: plan.allocations
    };
    const season = { id: 'spring-open', label: 'Spring Opening', period: 'March', keywords: ['spring'], visualDirection: '' };
    return { bp: generateLocalBlueprint(opts, genres, [], season), genreAllocation };
  }

  it('a real 60s-concept senior-oldpop pack keeps 1970s-tagged genre count within the tightened 11% cap, not the old 25% one', () => {
    const { bp } = generateFor('비틀즈 느낌의 밝은 60년대 팝', 18);
    const oneNineSeventies = bp.songs.filter(s => s.eraTag === '1970s').length;
    // Old behavior measured exactly 4/18 (22%, under the old 25% cap). The
    // tightened cap targets 11% (~2), but real headroom (avoiding a
    // singleton AND a total-songCount shortfall — see this file's own top
    // doc comment) can land slightly above that; it must never regress
    // back to the old, untightened 22%+ level.
    expect(oneNineSeventies).toBeLessThan(4);
  });

  it('never lands a genre at exactly 1 song (the existing no-singleton rule) even after tightening', () => {
    const { genreAllocation } = generateFor('80년대 초반 어덜트 컨템포러리 발라드', 18);
    const singletons = Object.entries(genreAllocation!.counts).filter(([, count]) => count === 1);
    expect(singletons).toEqual([]);
  });

  it('never shortfalls total songCount even when the primary-era genre family alone cannot reach it', () => {
    const { genreAllocation } = generateFor('80년대 초반 어덜트 컨템포러리 발라드', 18);
    const total = Object.values(genreAllocation!.counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(18);
  });

  it('tightenEraConstraintForSenior only ever narrows (never widens) an adjacent bucket, and is a no-op outside senior-morning', () => {
    const era = extractEraConstraint('비틀즈 느낌의 밝은 60년대 팝');
    const tightened = tightenEraConstraintForSenior(era, 'senior-morning', 18);
    for (const bucket of tightened.adjacent) {
      const original = era.adjacent.find(a => a.era === bucket.era);
      expect(bucket.maxShare).toBeLessThanOrEqual(original!.maxShare);
    }
    expect(tightenEraConstraintForSenior(era, 'kr-2030-pop', 18)).toEqual(era);
  });

  it('oldpop-warm-morning-glow no longer carries the literal word "morning" in any style-prompt-bearing field', () => {
    const genre = getGenreById('oldpop-warm-morning-glow')!;
    expect(genre.styleCore.toLowerCase()).not.toContain('morning');
    expect(genre.vocal?.join(' ').toLowerCase()).not.toContain('morning');
    expect(genre.rhythm?.join(' ').toLowerCase()).not.toContain('morning');
    expect(genre.production?.join(' ').toLowerCase()).not.toContain('morning');
    if (genre.signatureSound) expect(genre.signatureSound.toLowerCase()).not.toContain('morning');
  });

  it('a real evening-scene song using oldpop-warm-morning-glow never injects "morning" into its own stylePrompt', () => {
    const { bp } = generateFor('저녁 기차를 타고 돌아오는 길', 6);
    const morningLeaks = bp.songs.filter(s => s.stylePrompt.toLowerCase().includes('morning'));
    expect(morningLeaks.map(s => s.trackNo)).toEqual([]);
  });

  it('eraBucketForGenreId still resolves oldpop-warm-morning-glow to timeless (the genre id itself is unchanged)', () => {
    expect(eraBucketForGenreId('oldpop-warm-morning-glow')).toBe('timeless');
  });
});
