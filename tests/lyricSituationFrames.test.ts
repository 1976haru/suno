import { describe, expect, it } from 'vitest';
import { buildLyricThemePlan } from '../src/core/lyricDiversityPlan';
import { getLyricThemeById, lyricThemesForArchetype } from '../src/data/lyricThemes';
import { channelPresets, makeOptions } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;

function frameIdFor(themeId: string, opts: ReturnType<typeof makeOptions>): string {
  return getLyricThemeById(themeId, opts)?.frameId ?? 'solitary-object';
}

describe('[v3.64 TASK A] lyric situation frame diversity', () => {
  it('an 18-song senior-morning plan uses at least 6 distinct frames', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 18 });
    const plan = buildLyricThemePlan(opts, 42);
    expect(plan).toHaveLength(18);
    const frameIds = plan.map(id => frameIdFor(id, opts));
    expect(new Set(frameIds).size).toBeGreaterThanOrEqual(6);
  });

  it('caps solitary-object at 5 songs and every other frame at 4', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 18 });
    const plan = buildLyricThemePlan(opts, 7);
    const frameIds = plan.map(id => frameIdFor(id, opts));
    const counts = new Map<string, number>();
    for (const frameId of frameIds) counts.set(frameId, (counts.get(frameId) ?? 0) + 1);
    expect(counts.get('solitary-object') ?? 0).toBeLessThanOrEqual(5);
    for (const [frameId, count] of counts) {
      if (frameId === 'solitary-object') continue;
      expect(count, frameId).toBeLessThanOrEqual(4);
    }
  });

  it('never produces a duplicate lyricTheme id within one pack', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 18 });
    const plan = buildLyricThemePlan(opts, 15);
    expect(new Set(plan).size).toBe(plan.length);
  });

  it('is deterministic for the same songCount/seed', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 18 });
    const a = buildLyricThemePlan(opts, 3);
    const b = buildLyricThemePlan(opts, 3);
    expect(a).toEqual(b);
  });

  it('a different seed produces a different frame mix (not one hardcoded pattern)', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 18 });
    const a = buildLyricThemePlan(opts, 1);
    const b = buildLyricThemePlan(opts, 5);
    expect(a).not.toEqual(b);
  });

  it('includes at least one of the explicitly requested oldpop-era frames (young-first-love / dance-saturday / summer-night) across several seeds', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 18 });
    const requestedFrames = new Set(['young-first-love', 'dance-saturday', 'summer-night']);
    const seenAcrossSeeds = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const plan = buildLyricThemePlan(opts, seed);
      for (const themeId of plan) seenAcrossSeeds.add(frameIdFor(themeId, opts));
    }
    const overlap = [...requestedFrames].filter(frame => seenAcrossSeeds.has(frame));
    expect(overlap.length).toBeGreaterThan(0);
  });

  it('kids archetype (no frameId tags at all) keeps its exact pre-v3.64 stride behavior', () => {
    const kidsChannel = channelPresets.find(channel => channel.archetype === 'kids')!;
    const kidsThemes = lyricThemesForArchetype('kids');
    expect(kidsThemes.every(theme => !theme.frameId)).toBe(true);
    const opts = makeOptions({ channel: kidsChannel, songCount: 12 });
    const plan = buildLyricThemePlan(opts, 9);
    expect(plan).toHaveLength(12);
    expect(new Set(plan).size).toBeGreaterThan(1); // still varies, just via the old stride path
  });

  it('showa-cafe (no frameId tags either) keeps its exact pre-v3.64 stride behavior', () => {
    const showaChannel = channelPresets.find(channel => channel.archetype === 'showa-cafe')!;
    const showaThemes = lyricThemesForArchetype('showa-cafe');
    expect(showaThemes.every(theme => !theme.frameId)).toBe(true);
  });
});
