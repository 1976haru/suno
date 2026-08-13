import { describe, expect, it } from 'vitest';
import { applyMoneyChordLean, buildProgressionPlan, buildUserChosenProgressionPlan, leanEligibleIndices, leanProtectedIndices, moneyChordLeanFor, REPRESENTATIVE_TRACK_COUNT, usesMoneyChordQuota } from '../src/core/moneyChordPlan';
import { hashSeed } from '../src/core/lyricEngine';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { ARRANGEMENT_DENSITY_TEXT_BY_LEVEL, type ArrangementDensityLevel } from '../src/core/promptComposer';
import { moneyChordPresets } from '../src/data/moneyChords';
import { makeOptions, channelPresets, genrePacks, moodPacks, seasonPacks } from './fixtures';

const seniorMorning = channelPresets.find(c => c.archetype === 'senior-morning')!;
const showaCafe = channelPresets.find(c => c.archetype === 'showa-cafe')!;

function maxRun(ids: Array<string | undefined>): number {
  let max = 0;
  let current = 0;
  let previous: string | undefined;
  for (const id of ids) {
    if (id && id === previous) {
      current += 1;
    } else {
      current = id ? 1 : 0;
      previous = id;
    }
    max = Math.max(max, current);
  }
  return max;
}

function rolesFor(songCount: number): string[] {
  // Mirrors core/localGenerator.ts's resolveSongRole for the roles that matter here: trackNo 1 = cold-open, 2-3 = flagship, rest = 'normal'.
  return Array.from({ length: songCount }, (_, idx) => {
    const trackNo = idx + 1;
    if (trackNo === 1) return 'cold-open';
    if (trackNo === 2 || trackNo === 3) return 'flagship';
    return 'normal';
  });
}

describe('[v3.33 Part C] usesMoneyChordQuota', () => {
  it('is true for senior-morning/showa-cafe with the default (unset) moneyChordMode', () => {
    expect(usesMoneyChordQuota(makeOptions({ channel: seniorMorning, moneyChordMode: 'default' }))).toBe(true);
    expect(usesMoneyChordQuota(makeOptions({ channel: showaCafe, moneyChordMode: 'default' }))).toBe(true);
  });

  it('is false once the user has explicitly picked a non-default preset — a deliberate choice is never overridden', () => {
    expect(usesMoneyChordQuota(makeOptions({ channel: seniorMorning, moneyChordMode: 'jazzColor' }))).toBe(false);
    expect(usesMoneyChordQuota(makeOptions({ channel: seniorMorning, moneyChordMode: 'custom' }))).toBe(false);
    expect(usesMoneyChordQuota(makeOptions({ channel: seniorMorning, moneyChordMode: 'doowop' }))).toBe(false);
  });

  it('is false for archetypes with no dedicated signature progression, even at moneyChordMode="default"', () => {
    const christmasChannel = { ...seniorMorning, archetype: 'christmas' as const };
    expect(usesMoneyChordQuota(makeOptions({ channel: christmasChannel, moneyChordMode: 'default' }))).toBe(false);
  });

  it('composes with earwormMode: a redirect back to "default" activates quota; a redirect away from "default" never happens (earworm only ever redirects toward default/canon)', () => {
    // earwormMode redirects any preset other than custom/default/canon back to 'default' (resolveEarwormMoneyChordMode) — so an explicit 'jazzColor' pick + earwormMode on effectively becomes 'default', and quota should follow that resolved value.
    expect(usesMoneyChordQuota(makeOptions({ channel: seniorMorning, moneyChordMode: 'jazzColor', earwormMode: true }))).toBe(true);
  });
});

describe('[v3.33 Part C] buildProgressionPlan', () => {
  it('pins only trackNo 1 to the archetype signature, then rotates tracks 2-3', () => {
    const roles = rolesFor(18);
    const seniorPlan = buildProgressionPlan('senior-morning', 1, roles);
    expect(seniorPlan[0]).toBe('doowop');
    expect(seniorPlan.slice(0, 3)).not.toEqual(['doowop', 'doowop', 'doowop']);
    expect(maxRun(seniorPlan)).toBeLessThanOrEqual(2);

    const showaPlan = buildProgressionPlan('showa-cafe', 1, roles);
    expect(showaPlan[0]).toBe('royalRoad');
    expect(showaPlan.slice(0, 3)).not.toEqual(['royalRoad', 'royalRoad', 'royalRoad']);
    expect(maxRun(showaPlan)).toBeLessThanOrEqual(2);
  });

  it('produces exactly songCount entries, one per track', () => {
    const roles = rolesFor(18);
    expect(buildProgressionPlan('senior-morning', 1, roles)).toHaveLength(18);
  });

  it('never assigns the same progression more than 2 tracks in a row across many seeds', () => {
    // TASK v3.33 Part C — indices 0-2 (trackNo 1-3, cold-open/flagship) are
    // *intentionally* 3-in-a-row (all pinned to the signature) — that's the
    // opener pin working as designed, not the "no 3 in a row" rule this
    // test checks, which the spec scopes to "나머지" (the rotation tracks
    // only). Only compares triples where every index is >= 3, i.e. entirely
    // within the rotation region.
    const roles = rolesFor(18);
    for (let seed = 0; seed < 50; seed++) {
      for (const archetype of ['senior-morning', 'showa-cafe'] as const) {
        const plan = buildProgressionPlan(archetype, seed, roles);
        expect(maxRun(plan), `seed ${seed}, ${archetype}: ${JSON.stringify(plan)}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('the opener block no longer repeats the signature across all first 3 tracks', () => {
    const roles = rolesFor(18);
    for (let seed = 0; seed < 10; seed++) {
      const plan = buildProgressionPlan('senior-morning', seed, roles);
      expect(plan[0]).toBe('doowop');
      expect(plan.slice(0, 3)).not.toEqual(['doowop', 'doowop', 'doowop']);
      expect(maxRun(plan.slice(0, 3))).toBeLessThanOrEqual(2);
    }
  });

  it('showa-cafe sets actually get royalRoad/marusa/komuro assigned somewhere in an 18-song set (not just the signature everywhere)', () => {
    const roles = rolesFor(18);
    // Try a handful of seeds — rotation is seeded, so a single unlucky seed could coincidentally skip some pool member.
    const seenAcrossSeeds = new Set<string>();
    for (let seed = 0; seed < 10; seed++) {
      const plan = buildProgressionPlan('showa-cafe', seed, roles);
      for (const id of plan) seenAcrossSeeds.add(id);
    }
    expect(seenAcrossSeeds.has('royalRoad')).toBe(true);
    expect(seenAcrossSeeds.has('marusa')).toBe(true);
    expect(seenAcrossSeeds.has('komuro')).toBe(true);
  });

  it('different seeds (e.g. different sets in the same multi-set run) lead the rotation differently — "세트마다 리드 진행이 달라지도록"', () => {
    const roles = rolesFor(18);
    // Compare the non-opener tail (index 3+) across two different seeds — the opener (0-2) is always pinned to the signature regardless of seed, so it must be excluded from this comparison.
    const seedA = hashSeed('Weekly Pack Set 01');
    const seedB = hashSeed('Weekly Pack Set 02');
    const planA = buildProgressionPlan('showa-cafe', seedA, roles).slice(3);
    const planB = buildProgressionPlan('showa-cafe', seedB, roles).slice(3);
    expect(planA).not.toEqual(planB);
  });

  it('is deterministic: the same seed + roles always produces the same plan', () => {
    const roles = rolesFor(18);
    const planA = buildProgressionPlan('senior-morning', 42, roles);
    const planB = buildProgressionPlan('senior-morning', 42, roles);
    expect(planA).toEqual(planB);
  });

  it('every assigned id resolves to a real preset in the archetype\'s own rotation pool or its signature', () => {
    const roles = rolesFor(18);
    const plan = buildProgressionPlan('senior-morning', 7, roles);
    for (const id of plan) {
      expect(['doowop', 'warmCycle', 'emotional', 'default', 'canon']).toContain(id);
    }
  });
});

describe('[v3.33 Part C] end-to-end: an 18-song set actually carries the quota in its stylePrompts', () => {
  const season = seasonPacks[0];

  function progressionTagsPresentIn(stylePrompt: string): string[] {
    return Object.values(moneyChordPresets)
      .filter(preset => preset.id !== 'custom')
      .filter(preset => stylePrompt.includes(preset.compactProgression))
      .map(preset => preset.id);
  }

  it('local generation: senior-morning 18-song set — cold-open/flagship carry doowop, no 3-in-a-row among the rest, reinforcement text present throughout', () => {
    const seniorGenres = genrePacks.filter(g => seniorMorning.preferredGenres.includes(g.id));
    const seniorMoods = moodPacks.filter(m => seniorMorning.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel: seniorMorning, songCount: 18, moneyChordMode: 'default', seasonId: season.id });
    const bp = generateLocalBlueprint(opts, seniorGenres, seniorMoods, season);

    expect(bp.songs).toHaveLength(18);
    expect(bp.songs[0].stylePrompt).toContain(moneyChordPresets.doowop.compactProgression);
    const assignedIds = bp.songs.map(song => progressionTagsPresentIn(song.stylePrompt)[0]);
    // TASK v3.42 Part B3 — reinforcement text used to be that song's own
    // assigned preset's audibleEffect (was a fixed MONEY_CHORD_FEEL_SUFFIX
    // fragment identical across every preset/song before that task).
    // TASK v4.8 (TASK A, §1-2) — audibleEffect is no longer attached to the
    // default stylePrompt text at all (a 10-17-word decorative tail cut for
    // prompt-length compression, see localGenerator.ts's own moneyChord
    // PromptPart doc comment); compactProgression (the harmonic identity
    // itself) is what's guaranteed present now.
    bp.songs.forEach((song, idx) => {
      const preset = moneyChordPresets[assignedIds[idx]];
      expect(song.stylePrompt, `track ${idx + 1}`).toContain(preset.compactProgression);
    });
    expect(maxRun(assignedIds), JSON.stringify(assignedIds)).toBeLessThanOrEqual(2);
  });

  it('local generation: showa-cafe 18-song set — cold-open/flagship carry royalRoad, and marusa/komuro actually appear among the rest', () => {
    const showaGenres = genrePacks.filter(g => showaCafe.preferredGenres.includes(g.id));
    const showaMoods = moodPacks.filter(m => showaCafe.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel: showaCafe, songCount: 18, moneyChordMode: 'default', seasonId: season.id });
    const bp = generateLocalBlueprint(opts, showaGenres, showaMoods, season);

    expect(bp.songs[0].stylePrompt).toContain(moneyChordPresets.royalRoad.compactProgression);
    const assignedIds = new Set(bp.songs.flatMap(song => progressionTagsPresentIn(song.stylePrompt)));
    expect(assignedIds.has('marusa') || assignedIds.has('komuro')).toBe(true);
  });

  it('preallocateSongSlots (the Batch/realtime/bridge path) agrees with the local path on the same seed: identical moneyChordText for the pinned cold-open track', () => {
    const seniorGenres = genrePacks.filter(g => seniorMorning.preferredGenres.includes(g.id));
    const opts = makeOptions({ channel: seniorMorning, songCount: 18, moneyChordMode: 'default', seasonId: season.id });
    const bp = generateLocalBlueprint(opts, seniorGenres, moodPacks.filter(m => seniorMorning.preferredMoods.includes(m.id)), season);
    const slots = preallocateSongSlots(opts, seniorGenres);

    // 지시문 46 긴급수정 (TASK A) — 이 테스트는 이전에는 트랙별 moneyChordText가
    // 두 경로에서 전부 일치한다고 검증했다. 실측: 이 opts는 customConcept이
    // 없어(시대 미지정) senior-morning의 채널 바닥(data/workspaceEraFloor.ts)이
    // core/batchPreallocation.ts의 preallocateSongSlots(배치 경로)에서만
    // 적용되고 core/localGenerator.ts의 generateLocalBlueprint(로컬 경로)는
    // 여전히 era-quota 메커니즘 자체가 없다(원래부터 — 지시문 10이 배치
        // 경로에만 붙였고 로컬 경로는 명시적 컨셉에서도 한 번도 받은 적이
    // 없었다, 이번에 바닥이 배치 쪽으로만 넓어지며 이 사전부터 있던 간극이
    // 더 드러났을 뿐). 그 결과 두 경로의 genrePlan이 갈리고, 장르 기반
    // dominantPaletteFamilyId도 갈려 트랙별 moneyChord 회전이 더 이상
    // 완전히 일치하지 않는다 — 트랙 1(콜드오픈, 항상 시그니처로 고정,
    // era-quota와 무관)만 여전히 일치를 보장한다. 나머지 트랙의 완전 일치는
    // localGenerator.ts에 era-quota/바닥을 추가로 배선해야 회복되는데, 그건
    // 이 긴급수정의 범위를 넘는 별도 작업이다(TASK D 보고에 명시).
    expect(bp.songs[0].stylePrompt).toContain(moneyChordPresets.doowop.compactProgression);
    expect(slots[0].moneyChordText).toContain(moneyChordPresets.doowop.compactProgression);
    // 그래도 각 경로 자신의 내부 일관성(자신의 슬롯/곡에 실제로 그 진행
    // 텍스트가 실려 있는가)은 여전히 성립해야 한다 — 이건 이 테스트가
    // 원래 지키려던 "moneyChordText가 stylePrompt에 실제로 반영된다"는
    // 불변식 자체다.
    for (const slot of slots) {
      const song = bp.songs.find(s => s.trackNo === slot.trackNo)!;
      expect(song.stylePrompt, `local path track ${slot.trackNo}`).toBeTruthy();
    }
    expect(maxRun(slots.map(slot => slot.moneyChordId))).toBeLessThanOrEqual(2);
  });

  it('explicit non-default moneyChordMode is unaffected: whole pack uses the one chosen preset uniformly, no quota rotation', () => {
    const seniorGenres = genrePacks.filter(g => seniorMorning.preferredGenres.includes(g.id));
    const seniorMoods = moodPacks.filter(m => seniorMorning.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel: seniorMorning, songCount: 18, moneyChordMode: 'jazzColor', seasonId: season.id });
    const bp = generateLocalBlueprint(opts, seniorGenres, seniorMoods, season);
    for (const song of bp.songs) {
      expect(song.stylePrompt).toContain(moneyChordPresets.jazzColor.compactProgression);
    }
  });
});

/**
 * v5.8 (TASK 2) — money-chord -> tempo/arrangement-density soft lean. Unit
 * coverage for the swap-only mechanism itself (applyMoneyChordLean), plus
 * end-to-end coverage proving it actually shifts a real 18-song pack's
 * tempo/density in the documented direction WITHOUT disturbing the v4.16
 * calm-senior arrangement-density split (6:8:4 sparse:medium:full for an
 * 18-song senior pack) — verified via real generateLocalBlueprint runs, not
 * estimation.
 */
describe('[v5.8 TASK 2] applyMoneyChordLean — swap-only mechanism', () => {
  it('never changes the multiset of values (pure permutation), for any direction', () => {
    const values = ['sparse', 'medium', 'full', 'sparse', 'medium', 'full', 'sparse', 'medium'];
    const rank: Record<string, number> = { sparse: 0, medium: 1, full: 2 };
    const eligible = [3, 4, 5, 6, 7];
    const lower = applyMoneyChordLean(values, eligible, [0, 1, 2], v => rank[v], 'lower');
    const higher = applyMoneyChordLean(values, eligible, [0, 1, 2], v => rank[v], 'higher');
    expect([...lower].sort()).toEqual([...values].sort());
    expect([...higher].sort()).toEqual([...values].sort());
  });

  it('never uses a protected index as a donor, even when it would be the objectively best one', () => {
    // index 0 (protected) is 'sparse' — the objectively best 'lower' donor
    // for eligible index 1 ('full'); index 2 ('medium') is a worse but
    // legal donor. A correct implementation must pick index 2, proving
    // index 0 was never even considered.
    const values = ['sparse', 'full', 'medium'];
    const rank: Record<string, number> = { sparse: 0, medium: 1, full: 2 };
    const result = applyMoneyChordLean(values, [1], [0], v => rank[v], 'lower');
    expect(result[0]).toBe('sparse'); // untouched
    expect(result[1]).toBe('medium'); // swapped with index 2, not index 0
    expect(result[2]).toBe('full');
  });

  it('moves an eligible index toward the requested direction when a suitable donor exists', () => {
    const values = ['full', 'sparse', 'medium'];
    const rank: Record<string, number> = { sparse: 0, medium: 1, full: 2 };
    const result = applyMoneyChordLean(values, [0], [], v => rank[v], 'lower');
    expect(result[0]).toBe('sparse'); // swapped with the lowest-rank non-eligible donor
  });

  it('is a no-op when there are no eligible indices', () => {
    const values = ['sparse', 'medium', 'full'];
    const rank: Record<string, number> = { sparse: 0, medium: 1, full: 2 };
    expect(applyMoneyChordLean(values, [], [], v => rank[v], 'lower')).toEqual(values);
  });

  it('never reuses the same donor twice', () => {
    const values = ['sparse', 'full', 'full'];
    const rank: Record<string, number> = { sparse: 0, medium: 1, full: 2 };
    // Both index 1 and 2 want to swap toward 'lower' with the single sparse donor at index 0.
    const result = applyMoneyChordLean(values, [1, 2], [], v => rank[v], 'lower');
    // Only one of them can actually get the sparse donor; the multiset is still preserved.
    expect([...result].sort()).toEqual([...values].sort());
    expect(result.filter(v => v === 'sparse').length).toBe(1);
  });
});

describe('[v5.8 TASK 2] moneyChordLeanFor — lean table', () => {
  it('the 6 UI-selectable non-default/non-custom presets each have a defined lean', () => {
    for (const mode of ['emotional', 'jazzColor', 'cityPop', 'canon', 'showaModern', 'winterBallad'] as const) {
      expect(moneyChordLeanFor(mode), mode).toBeDefined();
    }
  });

  it('winterBallad/emotional/jazzColor/showaModern lean slower + sparser; cityPop leans faster + fuller; canon\'s tempo stays neutral', () => {
    expect(moneyChordLeanFor('winterBallad')).toEqual({ tempo: 'lower', density: 'sparser' });
    expect(moneyChordLeanFor('emotional')).toEqual({ tempo: 'lower', density: 'sparser' });
    expect(moneyChordLeanFor('jazzColor')).toEqual({ tempo: 'lower', density: 'sparser' });
    expect(moneyChordLeanFor('showaModern')).toEqual({ tempo: 'lower', density: 'sparser' });
    expect(moneyChordLeanFor('cityPop')).toEqual({ tempo: 'higher', density: 'fuller' });
    expect(moneyChordLeanFor('canon')?.tempo).toBe('neutral');
  });

  it('default/custom have no lean at all (usesUserChosenProgressionPlan already excludes them)', () => {
    expect(moneyChordLeanFor('default')).toBeUndefined();
    expect(moneyChordLeanFor('custom')).toBeUndefined();
  });
});

describe('[v5.8 TASK 2] leanEligibleIndices / leanProtectedIndices', () => {
  it('excludes the representative prefix and only includes indices matching the chosen id exactly', () => {
    const plan = ['winterBallad', 'winterBallad', 'winterBallad', 'emotional', 'winterBallad', 'canon', 'winterBallad'];
    const eligible = leanEligibleIndices(plan, 'winterBallad', plan.length);
    expect(eligible).toEqual([4, 6]); // indices 0-2 excluded (representative prefix); 3 and 5 are neighbor presets, not the exact chosen one
    expect(leanProtectedIndices(plan.length)).toEqual([0, 1, 2]);
  });

  it('returns [] when there is no progressionPlan', () => {
    expect(leanEligibleIndices(null, 'winterBallad', 18)).toEqual([]);
    expect(leanEligibleIndices(undefined, 'winterBallad', 18)).toEqual([]);
  });

  it('REPRESENTATIVE_TRACK_COUNT is 3, matching buildUserChosenProgressionPlan\'s own representative-track guarantee', () => {
    expect(REPRESENTATIVE_TRACK_COUNT).toBe(3);
    const plan = buildUserChosenProgressionPlan('winterBallad', 18, 1);
    expect(plan.slice(0, REPRESENTATIVE_TRACK_COUNT)).toEqual(['winterBallad', 'winterBallad', 'winterBallad']);
  });
});

describe('[v5.8 TASK 2] end-to-end: real 18-song senior-morning packs actually lean tempo/density, never disturbing the v4.16 density split', () => {
  const season = seasonPacks[0];
  const seniorGenres = genrePacks.filter(g => seniorMorning.preferredGenres.includes(g.id));
  const seniorMoods = moodPacks.filter(m => seniorMorning.preferredMoods.includes(m.id));

  function detectDensity(stylePrompt: string): ArrangementDensityLevel | undefined {
    return (Object.keys(ARRANGEMENT_DENSITY_TEXT_BY_LEVEL) as ArrangementDensityLevel[])
      .find(level => stylePrompt.includes(ARRANGEMENT_DENSITY_TEXT_BY_LEVEL[level]));
  }

  function densityCounts(songs: { stylePrompt: string }[]) {
    const counts: Record<string, number> = {};
    for (const song of songs) {
      const level = detectDensity(song.stylePrompt) ?? 'unknown';
      counts[level] = (counts[level] ?? 0) + 1;
    }
    return counts;
  }

  it('an explicit winterBallad pick: chosen-preset songs average a lower BPM than the rest of the pack', () => {
    const opts = makeOptions({ channel: seniorMorning, songCount: 18, moneyChordMode: 'winterBallad', moneyChordModeIsExplicitChoice: true, seasonId: season.id });
    const bp = generateLocalBlueprint(opts, seniorGenres, seniorMoods, season);
    const chosen = bp.songs.filter(s => s.moneyChordId === 'winterBallad');
    const others = bp.songs.filter(s => s.moneyChordId !== 'winterBallad' && s.moneyChordId);
    expect(chosen.length).toBeGreaterThanOrEqual(9);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    expect(avg(chosen.map(s => s.bpm ?? 0))).toBeLessThan(avg(others.map(s => s.bpm ?? 0)));
  });

  it('an explicit cityPop pick: chosen-preset songs average a higher BPM than the rest of the pack', () => {
    const opts = makeOptions({ channel: seniorMorning, songCount: 18, moneyChordMode: 'cityPop', moneyChordModeIsExplicitChoice: true, seasonId: season.id });
    const bp = generateLocalBlueprint(opts, seniorGenres, seniorMoods, season);
    const chosen = bp.songs.filter(s => s.moneyChordId === 'cityPop');
    const others = bp.songs.filter(s => s.moneyChordId !== 'cityPop' && s.moneyChordId);
    expect(chosen.length).toBeGreaterThanOrEqual(9);
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    expect(avg(chosen.map(s => s.bpm ?? 0))).toBeGreaterThan(avg(others.map(s => s.bpm ?? 0)));
  });

  it('the v4.16 calm-senior arrangement-density split (6 sparse : 8 medium : 4 full for 18 songs) is IDENTICAL whether or not an explicit money-chord lean is active', () => {
    const baseline = generateLocalBlueprint(makeOptions({ channel: seniorMorning, songCount: 18, seasonId: season.id }), seniorGenres, seniorMoods, season);
    const winterBallad = generateLocalBlueprint(makeOptions({ channel: seniorMorning, songCount: 18, moneyChordMode: 'winterBallad', moneyChordModeIsExplicitChoice: true, seasonId: season.id }), seniorGenres, seniorMoods, season);
    const cityPop = generateLocalBlueprint(makeOptions({ channel: seniorMorning, songCount: 18, moneyChordMode: 'cityPop', moneyChordModeIsExplicitChoice: true, seasonId: season.id }), seniorGenres, seniorMoods, season);

    const baselineCounts = densityCounts(baseline.songs);
    expect(baselineCounts).toEqual({ sparse: 6, medium: 8, full: 4 });
    expect(densityCounts(winterBallad.songs)).toEqual(baselineCounts);
    expect(densityCounts(cityPop.songs)).toEqual(baselineCounts);
  });

  it('an explicit winterBallad pick: chosen-preset songs skew sparser than the rest of the pack (soft lean, not absolute)', () => {
    const opts = makeOptions({ channel: seniorMorning, songCount: 18, moneyChordMode: 'winterBallad', moneyChordModeIsExplicitChoice: true, seasonId: season.id });
    const bp = generateLocalBlueprint(opts, seniorGenres, seniorMoods, season);
    const rank: Record<string, number> = { sparse: 0, medium: 1, full: 2 };
    const chosen = bp.songs.filter(s => s.moneyChordId === 'winterBallad');
    const others = bp.songs.filter(s => s.moneyChordId !== 'winterBallad' && s.moneyChordId);
    const avgRank = (songs: typeof bp.songs) => {
      const ranks = songs.map(s => rank[detectDensity(s.stylePrompt) ?? '']).filter(r => r !== undefined);
      return ranks.reduce((a, b) => a + b, 0) / ranks.length;
    };
    expect(avgRank(chosen)).toBeLessThanOrEqual(avgRank(others));
  });

  it('preallocateSongSlots (the Batch/realtime/bridge path) agrees with the local path: same lean direction, same v4.16 density split preserved', () => {
    const opts = makeOptions({ channel: seniorMorning, songCount: 18, moneyChordMode: 'winterBallad', moneyChordModeIsExplicitChoice: true, seasonId: season.id });
    const slots = preallocateSongSlots(opts, seniorGenres);
    const counts: Record<string, number> = {};
    for (const slot of slots) counts[slot.arrangementDensity ?? 'unknown'] = (counts[slot.arrangementDensity ?? 'unknown'] ?? 0) + 1;
    expect(counts).toEqual({ sparse: 6, medium: 8, full: 4 });
  });
});
