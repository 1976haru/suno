import { describe, expect, it } from 'vitest';
import { directSetLocal } from '../src/core/setDirector';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { getLyricThemeById } from '../src/data/lyricThemes';
import { channelPresets, genrePacks, makeOptions } from './fixtures';
import type { GenerationOptions } from '../src/types';

/**
 * 지시문 68 TASK A §1.5 — 해시 두 개가 다르다는 것만 검증하던 기존
 * tests/lyricThemeSeedByConcept.test.ts는 실제 파이프라인이 그 시드를
 * 버리고 있어도 통과했다(§실측 그대로). 이 파일은 최종 lyricTheme ID
 * 배열을 실제 배분 경로(preallocateSongSlots)로 비교한다.
 */

const showaSeventies = channelPresets.find(c => c.id === 'showa-seventies')!;

function buildOpts(projectTitle: string, customConcept: string, allocations: GenerationOptions['diversityAllocations']): GenerationOptions {
  const genreAllocation = allocations?.find(a => a.axis === 'genre');
  const genreIds = genreAllocation ? Object.keys(genreAllocation.counts) : showaSeventies.preferredGenres;
  return {
    channel: showaSeventies,
    projectTitle,
    songCount: 15,
    lyricLanguage: showaSeventies.primaryLanguage,
    market: showaSeventies.market,
    audience: showaSeventies.audience,
    genreIds,
    moodIds: showaSeventies.preferredMoods,
    seasonId: 'spring-open',
    vocalTone: showaSeventies.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept,
    avoidWords: '',
    personaMode: false,
    diversityAllocations: allocations
  };
}

function genresFor(opts: GenerationOptions) {
  return opts.genreIds!.map(id => genrePacks.find(g => g.id === id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
}

describe('지시문 68 TASK A — 컨셉이 lyricTheme 선택에 도달하는가', () => {
  it('§1.5-1/2: projectTitle이 기본값("Set Plan")으로 고정되고 컨셉만 다른 두 세트는 lyricTheme 위치 일치가 5개 이하여야 한다 (실제 결함 조건)', () => {
    // 지시문 68 §1.2 ① — freeText가 비어 있을 때 실제로 관측된 조건: plan
    // preview 단계(freeText='')에서 만들어진 diversityAllocations를, 서로
    // 다른 customConcept를 가진 최종 GenerationOptions에 그대로 얹는다 —
    // 이것이 실측된 실제 파이프라인의 결함 조건이다(§1.2).
    const plan = directSetLocal('', showaSeventies, 15, { recentGenreIds: [], recentHooks: [] });
    const lyricThemeAxis = plan.allocations.find(a => a.axis === 'lyricTheme');
    expect(lyricThemeAxis?.mode).toBe('auto'); // 지시문 68 TASK A-1 — 사용자가 고르지 않았으므로 auto여야 한다

    const optsA = buildOpts('Set Plan', '친구와 즐거웠던 추억을 생각하며', plan.allocations);
    const optsB = buildOpts('Set Plan', '10월에 듣기좋은 노래', plan.allocations);
    const slotsA = preallocateSongSlots(optsA, genresFor(optsA), { usedTitles: [], usedHooks: [] });
    const slotsB = preallocateSongSlots(optsB, genresFor(optsB), { usedTitles: [], usedHooks: [] });

    const idsA = slotsA.map(s => s.lyricTheme);
    const idsB = slotsB.map(s => s.lyricTheme);
    const sameCount = idsA.filter((id, i) => id === idsB[i]).length;
    console.log(`[지시문68] 컨셉 A(projectTitle=Set Plan): ${JSON.stringify(idsA)}`);
    console.log(`[지시문68] 컨셉 B(projectTitle=Set Plan): ${JSON.stringify(idsB)}`);
    console.log(`[지시문68] 같은 위치 일치: ${sameCount}/15`);
    expect(sameCount).toBeLessThanOrEqual(5);
  });

  it('§1.5-3: v3.64 프레임 다양성 가드(solitary-object 독점 방지)가 계속 통과한다', () => {
    const seniorChannel = channelPresets.find(c => c.archetype === 'senior-morning')!;
    const plan = directSetLocal(
      '비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝',
      seniorChannel,
      18,
      { recentGenreIds: [], recentHooks: [] }
    );
    const opts = makeOptions({ channel: seniorChannel, songCount: 18 });
    const frameIds = plan.slots.map(slot => getLyricThemeById(slot.lyricTheme, opts)?.frameId ?? 'solitary-object');
    expect(new Set(frameIds).size).toBeGreaterThanOrEqual(6);
    const counts = new Map<string, number>();
    for (const frameId of frameIds) counts.set(frameId, (counts.get(frameId) ?? 0) + 1);
    expect(counts.get('solitary-object') ?? 0).toBeLessThanOrEqual(5);
  });
});
