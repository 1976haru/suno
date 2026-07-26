import { describe, expect, it } from 'vitest';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { allocationStatus, DIVERSITY_AXIS_IDS, hasAllocationOverflow } from '../src/core/diversityAllocation';
import { normalizeDiversityAllocationTemplate } from '../src/core/diversityAllocationStore';
import { buildClaudeCodeInstruction } from '../src/core/claudeCodeBridge';
import { hookDevices } from '../src/data/hookDevices';
import { introTexturesForArchetype } from '../src/data/introTextures';
import { lyricThemesForArchetype } from '../src/data/lyricThemes';
import { channelPresets, genrePacks, makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { AxisAllocation } from '../src/types';

const kidsChannel = channelPresets.find(channel => channel.archetype === 'kids')!;
const showaChannel = channelPresets.find(channel => channel.archetype === 'showa-cafe')!;

function channelGenres(channelId: string) {
  const channel = channelPresets.find(item => item.id === channelId)!;
  return genrePacks.filter(genre => channel.preferredGenres.includes(genre.id));
}

describe('[v3.47 Step 3] diversity allocation core', () => {
  it('defines the seven user-visible diversity axes', () => {
    expect(DIVERSITY_AXIS_IDS).toEqual([
      'vocalType',
      'introTexture',
      'hookDevice',
      'arrangementDensity',
      'structureTemplate',
      'lyricTheme',
      'pov'
    ]);
  });

  it('explicit auto allocations preserve the existing preallocation result', () => {
    const opts = makeOptions({ songCount: 12 });
    const autoAllocations: AxisAllocation[] = DIVERSITY_AXIS_IDS.map(axis => ({ axis, mode: 'auto', counts: {} }));
    const baseline = preallocateSongSlots(opts, testGenres);
    const explicitAuto = preallocateSongSlots({ ...opts, diversityAllocations: autoAllocations }, testGenres);
    expect(explicitAuto).toEqual(baseline);
  });

  it('manual intro and density counts are reflected in slots, with shortfall filled by auto', () => {
    const introId = introTexturesForArchetype(showaChannel.archetype)[0].id;
    const opts = makeOptions({
      channel: showaChannel,
      genreIds: showaChannel.preferredGenres,
      moodIds: showaChannel.preferredMoods,
      songCount: 5,
      diversityAllocations: [
        { axis: 'introTexture', mode: 'manual', counts: { [introId]: 2 } },
        { axis: 'arrangementDensity', mode: 'manual', counts: { full: 3 } }
      ]
    });
    const slots = preallocateSongSlots(opts, channelGenres(showaChannel.id));
    expect(slots.slice(0, 2).every(slot => slot.introTextureId === introId)).toBe(true);
    expect(slots).toHaveLength(5);
    expect(slots.slice(0, 3).map(slot => slot.arrangementDensity)).toEqual(['full', 'full', 'full']);
  });

  it('manual kids vocal counts replace the old internal-only quota path', () => {
    const opts = makeOptions({
      channel: kidsChannel,
      genreIds: kidsChannel.preferredGenres,
      moodIds: kidsChannel.preferredMoods,
      songCount: 6,
      diversityAllocations: [
        { axis: 'vocalType', mode: 'manual', counts: { male: 4, female: 1, mixed: 1 } }
      ]
    });
    const slots = preallocateSongSlots(opts, channelGenres(kidsChannel.id));
    const counts = slots.reduce((acc, slot) => {
      if (slot.vocalType) acc[slot.vocalType] += 1;
      return acc;
    }, { male: 0, female: 0, mixed: 0 });
    expect(counts).toEqual({ male: 4, female: 1, mixed: 1 });
  });

  it('manual hook devices can be used as an auxiliary choice on narrative genres', () => {
    const hookId = hookDevices[0].id;
    const opts = makeOptions({
      channel: showaChannel,
      genreIds: showaChannel.preferredGenres,
      moodIds: showaChannel.preferredMoods,
      songCount: 2,
      diversityAllocations: [
        { axis: 'hookDevice', mode: 'manual', counts: { [hookId]: 2 } }
      ]
    });
    const slots = preallocateSongSlots(opts, channelGenres(showaChannel.id));
    expect(slots.map(slot => slot.hookDeviceId)).toEqual([hookId, hookId]);
    expect(slots.every(slot => slot.hookDeviceText)).toBe(true);
  });

  it('validates under/exact/over totals and blocks overflow templates', () => {
    const under: AxisAllocation = { axis: 'introTexture', mode: 'manual', counts: { a: 2 } };
    const exact: AxisAllocation = { axis: 'introTexture', mode: 'manual', counts: { a: 3 } };
    const over: AxisAllocation = { axis: 'introTexture', mode: 'manual', counts: { a: 4 } };
    expect(allocationStatus(under, 3).state).toBe('under');
    expect(allocationStatus(exact, 3).state).toBe('exact');
    expect(allocationStatus(over, 3).state).toBe('over');
    expect(hasAllocationOverflow([over], 3)).toBe(true);
  });
});

describe('[v3.47 Step 3] bridge and preset compatibility', () => {
  it('bridge payload exposes lyricTheme and pov from preassigned slots', () => {
    const themeId = lyricThemesForArchetype(showaChannel.archetype)[0].id;
    const opts = makeOptions({
      channel: showaChannel,
      genreIds: showaChannel.preferredGenres,
      moodIds: showaChannel.preferredMoods,
      songCount: 2,
      diversityAllocations: [
        { axis: 'lyricTheme', mode: 'manual', counts: { [themeId]: 2 } },
        { axis: 'pov', mode: 'manual', counts: { radioHost: 2 } }
      ]
    });
    const slots = preallocateSongSlots(opts, channelGenres(showaChannel.id));
    const instruction = buildClaudeCodeInstruction(opts, channelGenres(showaChannel.id), testMoods, testSeason, undefined, slots, false);
    expect(instruction).toContain('lyricTheme');
    expect(instruction).toContain('pov');
    const payloadMatch = instruction.match(/```json\n([\s\S]*?)\n```/);
    const payload = JSON.parse(payloadMatch![1]);
    expect(payload.preassignedSongs[0].lyricTheme).toBe(themeId);
    expect(payload.preassignedSongs[0].pov).toBe('radioHost');
  });

  it('normalizes saved allocation presets and opens old empty saved shapes', () => {
    const normalized = normalizeDiversityAllocationTemplate({
      channelId: 'channel-a',
      allocations: [
        { axis: 'introTexture', mode: 'manual', counts: { ag_finger: 2.4, bad: -1 } },
        { axis: 'pov', mode: 'auto', counts: { firstPerson: 2 } }
      ],
      updatedAt: ''
    });
    expect(normalized?.allocations[0]).toEqual({ axis: 'introTexture', mode: 'manual', counts: { ag_finger: 2 } });
    expect(normalized?.allocations[1]).toEqual({ axis: 'pov', mode: 'auto', counts: { firstPerson: 2 } });

    const legacy = normalizeDiversityAllocationTemplate({ channelId: 'old-channel', allocations: undefined as unknown as AxisAllocation[], updatedAt: '' });
    expect(legacy?.allocations).toEqual([]);
  });
});
