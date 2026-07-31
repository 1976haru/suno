import { describe, expect, it } from 'vitest';
import { directSetLocal } from '../src/core/setDirector';
import { DIVERSITY_AXIS_IDS } from '../src/core/diversityAllocation';
import { channelPresets } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;

function allocation(plan: ReturnType<typeof directSetLocal>, axis: string) {
  const found = plan.allocations.find(item => item.axis === axis);
  expect(found, axis).toBeDefined();
  return found!;
}

function slotCounts<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

describe('[v3.63] directSetLocal', () => {
  it('fills all 8 diversity axes and produces an 18-slot senior oldpop plan', () => {
    const plan = directSetLocal(
      '비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝',
      seniorChannel,
      18,
      { recentGenreIds: [], recentHooks: [] }
    );

    expect(plan.allocations.map(item => item.axis)).toEqual(DIVERSITY_AXIS_IDS);
    expect(plan.slots).toHaveLength(18);
    expect(plan.interpretation.reasoningKo.length).toBeGreaterThanOrEqual(3);
    expect(plan.interpretation.reasoningKo.join('\n')).toContain('core/extended');

    const genreCounts = allocation(plan, 'genre').counts;
    expect(Object.keys(genreCounts).length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...Object.values(genreCounts))).toBeLessThanOrEqual(5);
    expect(Object.keys(genreCounts)).toContain('oldpop-british-beat');
    expect(Object.keys(genreCounts).filter(id => id.startsWith('oldpop-')).length).toBeGreaterThanOrEqual(2);

    const vocalCounts = allocation(plan, 'vocalType').counts;
    expect(vocalCounts).toEqual({ male: 6, female: 6, mixed: 6 });

    const structureIds = Object.keys(allocation(plan, 'structureTemplate').counts);
    expect(structureIds.length).toBeGreaterThanOrEqual(3);

    const lyricThemeCounts = allocation(plan, 'lyricTheme').counts;
    expect(Object.keys(lyricThemeCounts)).toHaveLength(18);
    expect(new Set(Object.values(lyricThemeCounts))).toEqual(new Set([1]));

    expect(Math.max(...Object.values(allocation(plan, 'introTexture').counts))).toBeLessThanOrEqual(4);
    expect(Math.max(...Object.values(allocation(plan, 'hookDevice').counts))).toBeLessThanOrEqual(4);

    const povCounts = allocation(plan, 'pov').counts;
    expect(povCounts.firstPerson).toBeGreaterThan(povCounts.secondPerson || 0);
    expect((povCounts.secondPerson || 0) + (povCounts.thirdPerson || 0)).toBeGreaterThanOrEqual(2);
  });

  it('wires the allocation results into actual preassigned slots', () => {
    const plan = directSetLocal(
      '아바나 카펜터스 같은 따뜻한 노래',
      seniorChannel,
      18,
      { recentGenreIds: [], recentHooks: [] }
    );

    const vocalSlotCounts = slotCounts(plan.slots.map(slot => slot.vocalType || 'missing'));
    expect(vocalSlotCounts.male).toBeGreaterThanOrEqual(4);
    expect(vocalSlotCounts.female).toBeGreaterThanOrEqual(4);
    expect(vocalSlotCounts.mixed).toBeGreaterThanOrEqual(4);
    expect(plan.slots.every(slot => slot.vocalGender === 'duet' || slot.vocalGender === 'male' || slot.vocalGender === 'female')).toBe(true);

    const structureSlotCounts = slotCounts(plan.slots.map(slot => slot.structureTemplate || 'missing'));
    expect(Object.keys(structureSlotCounts).length).toBeGreaterThanOrEqual(3);

    const lyricThemes = plan.slots.map(slot => slot.lyricTheme);
    expect(new Set(lyricThemes).size).toBe(18);
  });

  it('can route chanson plus jazz without an API call', () => {
    const plan = directSetLocal(
      '샹송이랑 재즈 섞어서 잔잔하게',
      seniorChannel,
      18,
      { recentGenreIds: [], recentHooks: [] }
    );
    const genreIds = Object.keys(allocation(plan, 'genre').counts);
    expect(genreIds.some(id => id.includes('chanson'))).toBe(true);
    expect(genreIds.some(id => id.includes('jazz'))).toBe(true);
  });
});

describe('[v3.63 TASK B] directSetLocal with a genre-family selection', () => {
  it('a single family selection uses that family\'s own members for the genre axis', () => {
    const plan = directSetLocal('', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, ['abba-carpenters']);
    expect(plan.interpretation.familyIds).toEqual(['abba-carpenters']);
    const genreIds = Object.keys(allocation(plan, 'genre').counts);
    expect(genreIds.length).toBeGreaterThanOrEqual(4);
    expect(genreIds.length).toBeLessThanOrEqual(9);
    for (const id of genreIds) {
      expect(['oldpop-europop-glow', 'oldpop-baroque-pop', 'oldpop-close-harmony-duo', 'oldpop-soft-rock-am', 'oldpop-sunshine-pop']).toContain(id);
    }
  });

  it('two families selected blend genres from both, keeping total variety within 4-9', () => {
    const plan = directSetLocal('', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, ['abba-carpenters', 'warm-melody']);
    const genreIds = Object.keys(allocation(plan, 'genre').counts);
    expect(genreIds.length).toBeGreaterThanOrEqual(4);
    expect(genreIds.length).toBeLessThanOrEqual(9);
    const abbaMembers = ['oldpop-europop-glow', 'oldpop-baroque-pop', 'oldpop-close-harmony-duo', 'oldpop-soft-rock-am', 'oldpop-sunshine-pop'];
    const warmMembers = ['oldpop-warm-morning-glow', 'oldpop-hearth-acoustic', 'oldpop-sunlit-strings-pop', 'oldpop-gentle-lullaby-pop', 'oldpop-piano-ballad-70s'];
    expect(genreIds.some(id => abbaMembers.includes(id))).toBe(true);
    expect(genreIds.some(id => warmMembers.includes(id))).toBe(true);
  });

  it('three or more families still keep total genre variety at or under 9', () => {
    const plan = directSetLocal('', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, ['chanson-continental', 'rnb-soul', 'abba-carpenters', 'vocal-jazz']);
    const genreIds = Object.keys(allocation(plan, 'genre').counts);
    expect(genreIds.length).toBeLessThanOrEqual(9);
    expect(genreIds.length).toBeGreaterThanOrEqual(4);
  });

  it('an empty family selection falls back to free-text keyword routing exactly as before', () => {
    const plan = directSetLocal('비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, []);
    expect(plan.interpretation.familyIds).toEqual([]);
    const genreIds = Object.keys(allocation(plan, 'genre').counts);
    expect(genreIds).toContain('oldpop-british-beat');
  });

  it('an unrecognized family id is ignored rather than throwing', () => {
    expect(() => directSetLocal('', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, ['not-a-real-family'])).not.toThrow();
  });
});
