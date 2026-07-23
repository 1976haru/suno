import { describe, expect, it } from 'vitest';
import { buildProgressionPlan, usesMoneyChordQuota } from '../src/core/moneyChordPlan';
import { hashSeed } from '../src/core/lyricEngine';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { moneyChordPresets } from '../src/data/moneyChords';
import { makeOptions, channelPresets, genrePacks, moodPacks, seasonPacks } from './fixtures';

const seniorMorning = channelPresets.find(c => c.archetype === 'senior-morning')!;
const showaCafe = channelPresets.find(c => c.archetype === 'showa-cafe')!;

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
  it('pins cold-open (trackNo 1) and flagship (trackNo 2-3) to the archetype signature', () => {
    const roles = rolesFor(18);
    const seniorPlan = buildProgressionPlan('senior-morning', 1, roles);
    expect(seniorPlan[0]).toBe('doowop');
    expect(seniorPlan[1]).toBe('doowop');
    expect(seniorPlan[2]).toBe('doowop');

    const showaPlan = buildProgressionPlan('showa-cafe', 1, roles);
    expect(showaPlan[0]).toBe('royalRoad');
    expect(showaPlan[1]).toBe('royalRoad');
    expect(showaPlan[2]).toBe('royalRoad');
  });

  it('produces exactly songCount entries, one per track', () => {
    const roles = rolesFor(18);
    expect(buildProgressionPlan('senior-morning', 1, roles)).toHaveLength(18);
  });

  it('never assigns the same progression 3 tracks in a row among the rotation (non-opener) tracks, across many seeds', () => {
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
        for (let i = 5; i < plan.length; i++) {
          const threeInARow = plan[i] === plan[i - 1] && plan[i] === plan[i - 2];
          expect(threeInARow, `seed ${seed}, ${archetype}: 3-in-a-row at index ${i} (${JSON.stringify(plan)})`).toBe(false);
        }
      }
    }
  });

  it('the opener block (trackNo 1-3) is always exactly the signature, 3 in a row by design', () => {
    const roles = rolesFor(18);
    for (let seed = 0; seed < 10; seed++) {
      const plan = buildProgressionPlan('senior-morning', seed, roles);
      expect(plan.slice(0, 3)).toEqual(['doowop', 'doowop', 'doowop']);
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
    for (const song of bp.songs.slice(0, 3)) {
      expect(song.stylePrompt).toContain(moneyChordPresets.doowop.compactProgression);
    }
    for (const song of bp.songs) {
      expect(song.stylePrompt).toContain('bass on the root'); // MONEY_CHORD_FEEL_SUFFIX fragment
    }
    const assignedIds = bp.songs.map(song => progressionTagsPresentIn(song.stylePrompt)[0]);
    for (let i = 5; i < assignedIds.length; i++) {
      const threeInARow = assignedIds[i] === assignedIds[i - 1] && assignedIds[i] === assignedIds[i - 2];
      expect(threeInARow, `3-in-a-row at track ${i + 1}: ${JSON.stringify(assignedIds)}`).toBe(false);
    }
  });

  it('local generation: showa-cafe 18-song set — cold-open/flagship carry royalRoad, and marusa/komuro actually appear among the rest', () => {
    const showaGenres = genrePacks.filter(g => showaCafe.preferredGenres.includes(g.id));
    const showaMoods = moodPacks.filter(m => showaCafe.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel: showaCafe, songCount: 18, moneyChordMode: 'default', seasonId: season.id });
    const bp = generateLocalBlueprint(opts, showaGenres, showaMoods, season);

    for (const song of bp.songs.slice(0, 3)) {
      expect(song.stylePrompt).toContain(moneyChordPresets.royalRoad.compactProgression);
    }
    const assignedIds = new Set(bp.songs.flatMap(song => progressionTagsPresentIn(song.stylePrompt)));
    expect(assignedIds.has('marusa') || assignedIds.has('komuro')).toBe(true);
  });

  it('preallocateSongSlots (the Batch/realtime/bridge path) agrees with the local path on the same seed: identical moneyChordText per trackNo', () => {
    const seniorGenres = genrePacks.filter(g => seniorMorning.preferredGenres.includes(g.id));
    const opts = makeOptions({ channel: seniorMorning, songCount: 18, moneyChordMode: 'default', seasonId: season.id });
    const bp = generateLocalBlueprint(opts, seniorGenres, moodPacks.filter(m => seniorMorning.preferredMoods.includes(m.id)), season);
    const slots = preallocateSongSlots(opts, seniorGenres);

    for (const slot of slots) {
      const song = bp.songs.find(s => s.trackNo === slot.trackNo)!;
      expect(song.stylePrompt).toContain(slot.moneyChordText.split(',')[0]); // the bare progression tag, at minimum
    }
    // cold-open/flagship slots are always the signature, matching the local path's own pin.
    expect(slots[0].moneyChordText).toContain(moneyChordPresets.doowop.compactProgression);
    expect(slots[1].moneyChordText).toContain(moneyChordPresets.doowop.compactProgression);
    expect(slots[2].moneyChordText).toContain(moneyChordPresets.doowop.compactProgression);
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
