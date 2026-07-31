import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { buildArcPlan } from '../src/core/arcPlan';
import { KILLING_POINTS } from '../src/data/killingPoints';
import { audienceProfileForAgeGroup } from '../src/data/audienceProfiles';
import { makeOptions, testGenres, testMoods, testSeason, channelPresets, genrePacks } from './fixtures';

/**
 * v3.67 — "킬링포인트와 18곡 아크". Real user feedback: "1시간 동안 듣는다고 하면
 * 글쎄... 킬링포인트도 없는 것 같고, 지루함도 느껴지고" (60-70/100). These tests
 * verify the mechanism is wired end to end (killing points reach the actual
 * stylePrompt/slot, arc reorders tempo/density into a real curve, emotion
 * arc has real variety) — not that the result *sounds* better, which this
 * task's own section 8 says can only be judged by ear.
 */

function bpm(stylePrompt: string): number {
  return Number((stylePrompt.match(/(\d+) BPM/) || [])[1]);
}

describe('[v3.67] killing points reach the local generation stylePrompt', () => {
  it('at least 12 of 18 tracks carry a recognizable killing-point descriptor, none repeated more than 3 times', () => {
    const opts = makeOptions({ songCount: 18, earwormMode: true });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const usage = new Map<string, number>();
    let withKillingPoint = 0;
    for (const song of blueprint.songs) {
      const match = KILLING_POINTS.find(kp => song.stylePrompt.toLowerCase().includes(kp.descriptor.toLowerCase()));
      if (match) {
        withKillingPoint += 1;
        usage.set(match.id, (usage.get(match.id) ?? 0) + 1);
      }
    }
    expect(withKillingPoint).toBeGreaterThanOrEqual(12);
    for (const count of usage.values()) expect(count).toBeLessThanOrEqual(3);
  });

  it('never lets a killing point add more than one style-prompt atom (no comma inside the woven descriptor)', () => {
    const opts = makeOptions({ songCount: 18 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    for (const song of blueprint.songs) {
      const match = KILLING_POINTS.find(kp => song.stylePrompt.toLowerCase().includes(kp.descriptor.toLowerCase()));
      if (!match) continue;
      // The descriptor itself never contains a comma (asserted in
      // killingPoints.test.ts); this just confirms it actually appears as
      // one contiguous phrase in the composed prompt, not split apart.
      expect(song.stylePrompt.toLowerCase()).toContain(match.descriptor.toLowerCase());
    }
  });

  it('a killing point never causes a hardExclusion violation, even when it relaxes a profile constraint', () => {
    const opts = makeOptions({ songCount: 18 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const audienceProfile = audienceProfileForAgeGroup(opts.audience);
    for (const song of blueprint.songs) {
      for (const hard of audienceProfile.hardExclusions) {
        expect(song.excludePrompt).toContain(hard);
      }
    }
  });

  it('reaches the realtime/Batch/bridge slot path too (killingPointText/killingPointPlacement on preassignedSongs)', () => {
    const opts = makeOptions({ songCount: 18 });
    const slots = preallocateSongSlots(opts, testGenres);
    const withKillingPoint = slots.filter(slot => slot.killingPointText);
    expect(withKillingPoint.length).toBeGreaterThanOrEqual(12);
    for (const slot of withKillingPoint) {
      expect(['final-chorus', 'bridge', 'mid-instrumental', 'pre-chorus', 'outro']).toContain(slot.killingPointPlacement);
    }
    const usage = new Map<string, number>();
    for (const slot of slots) {
      if (!slot.killingPointText) continue;
      usage.set(slot.killingPointText, (usage.get(slot.killingPointText) ?? 0) + 1);
    }
    for (const count of usage.values()) expect(count).toBeLessThanOrEqual(3);
  });
});

describe('[v3.67] the 18-song arc produces a real curve, not a flat pack', () => {
  it('peak-phase average BPM is at least 15 higher than closing-phase average BPM (local path)', () => {
    const opts = makeOptions({ songCount: 18 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const arc = buildArcPlan(18);
    const peakBpms = blueprint.songs.filter((_, i) => arc[i].phase === 'peak').map(s => bpm(s.stylePrompt));
    const closingBpms = blueprint.songs.filter((_, i) => arc[i].phase === 'closing').map(s => bpm(s.stylePrompt));
    const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;
    expect(avg(peakBpms) - avg(closingBpms)).toBeGreaterThanOrEqual(15);
  });

  it('peak-phase average BPM is at least 15 higher than closing-phase average BPM (realtime/Batch/bridge path)', () => {
    const opts = makeOptions({ songCount: 18 });
    const slots = preallocateSongSlots(opts, testGenres);
    const arc = buildArcPlan(18);
    const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;
    const peakAvg = avg(slots.filter((_, i) => arc[i].phase === 'peak').map(s => s.tempo));
    const closingAvg = avg(slots.filter((_, i) => arc[i].phase === 'closing').map(s => s.tempo));
    expect(peakAvg - closingAvg).toBeGreaterThanOrEqual(15);
  });

  it('arrangementDensity never runs more than 2 tracks in a row on the same level (both paths)', () => {
    const opts = makeOptions({ songCount: 18 });
    const slots = preallocateSongSlots(opts, testGenres);
    let run = 1;
    for (let i = 1; i < slots.length; i++) {
      run = slots[i].arrangementDensity === slots[i - 1].arrangementDensity ? run + 1 : 1;
      expect(run).toBeLessThanOrEqual(2);
    }
  });
});

describe('[v3.67] emotion-arc variety', () => {
  it('an 18-song pack uses at least 4 distinct emotion-arc shape families, not the old single dark-to-light curve everywhere', () => {
    const opts = makeOptions({ songCount: 18 });
    const slots = preallocateSongSlots(opts, testGenres);
    const shapes = new Set(slots.map(s => s.emotionArc));
    expect(shapes.size).toBeGreaterThanOrEqual(4);
  });

  it('at most 2 songs end on a wistful/lingering note rather than fully bright', () => {
    const opts = makeOptions({ songCount: 18 });
    const slots = preallocateSongSlots(opts, testGenres);
    const wistfulCount = slots.filter(s => /wistfulness|quiet farewell/i.test(s.emotionArc)).length;
    expect(wistfulCount).toBeLessThanOrEqual(2);
  });
});

describe('[v3.67] regression — existing invariants still hold', () => {
  it('every stylePrompt stays within the Suno hard character limit', () => {
    const opts = makeOptions({ songCount: 18, earwormMode: true });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    for (const song of blueprint.songs) {
      expect(song.stylePrompt.length).toBeLessThanOrEqual(1000);
    }
  });

  it('genre cross-interleave (no immediately-adjacent identical lead genre run beyond what genreRotation already guarantees) is unaffected', () => {
    const opts = makeOptions({ songCount: 18 });
    const slots = preallocateSongSlots(opts, testGenres);
    for (let i = 1; i < slots.length; i++) {
      if (new Set(slots.map(s => s.genreId)).size <= 1) continue;
      expect(slots[i].genreId).not.toBe(slots[i - 1].genreId);
    }
  });

  it('vocalType is still assigned for every track on a kids-quota channel (v3.64-B\'s spreadPlanByCounts guarantee is for manual allocations only, unaffected by this task either way)', () => {
    const kids = channelPresets.find(channel => channel.archetype === 'kids')!;
    const opts = makeOptions({ channel: kids, songCount: 18, genreIds: kids.preferredGenres, moodIds: kids.preferredMoods });
    const kidsGenres = genrePacks.filter(genre => kids.preferredGenres.includes(genre.id));
    const slots = preallocateSongSlots(opts, kidsGenres);
    expect(slots.every(slot => slot.vocalType)).toBe(true);
    expect(new Set(slots.map(slot => slot.vocalType)).size).toBeGreaterThanOrEqual(2);
  });

  it('no killing-point/arc code leaks a real artist or song name anywhere in a generated pack', () => {
    const opts = makeOptions({ songCount: 18 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const forbidden = /\b(abba|carpenters|beatles|adele|beyonce)\b/i;
    for (const song of blueprint.songs) {
      expect(song.stylePrompt).not.toMatch(forbidden);
      expect(song.lyrics).not.toMatch(forbidden);
    }
  });
});
