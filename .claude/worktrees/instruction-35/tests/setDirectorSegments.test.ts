import { describe, expect, it } from 'vitest';
import { directSet, directSetLocal, parseQuantityPhrase } from '../src/core/setDirector';
import { channelPresets } from './fixtures';
import type { ProviderSettings } from '../src/types';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;

/**
 * v3.63 재작성 (TASK B) — segments, blending, listening-context, and
 * unknown-term coverage for directSetLocal's new branches, plus directSet's
 * remote-call/fallback contract.
 */

describe('[v3.63 재작성] parseQuantityPhrase', () => {
  it('parses "9곡씩" into an even per-segment count', () => {
    expect(parseQuantityPhrase('카펜터스와 아바 느낌나는 노래 9곡씩 총 18곡', 2, 18)).toEqual([9, 9]);
  });

  it('parses "각각 10곡"', () => {
    expect(parseQuantityPhrase('각각 10곡씩 부탁해', 2, 20)).toEqual([10, 10]);
  });

  it('falls back to an even split with no quantity phrase', () => {
    expect(parseQuantityPhrase('카펜터스와 아바 느낌나는 노래', 2, 18)).toEqual([9, 9]);
    expect(parseQuantityPhrase('세 명 섞어서', 3, 18)).toEqual([6, 6, 6]);
  });

  it('a single segment always gets the whole songCount regardless of phrase', () => {
    expect(parseQuantityPhrase('아무 말이나', 1, 18)).toEqual([18]);
  });
});

describe('[v3.63 재작성] directSetLocal — 2+ known-artist segments', () => {
  it('"카펜터스와 아바 느낌나는 노래 9곡씩 총 18곡" produces 2 segments of 9 songs each with genuinely different genres', () => {
    const plan = directSetLocal('카펜터스와 아바 느낌나는 노래 9곡씩 총 18곡 만들어줘', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    expect(plan.segments).toHaveLength(2);
    expect(plan.segments.map(segment => segment.songCount)).toEqual([9, 9]);
    expect(plan.slots).toHaveLength(18);
    const [first, second] = plan.segments;
    expect(first.genreIds.length).toBeGreaterThan(0);
    expect(second.genreIds.length).toBeGreaterThan(0);
    // Genuinely different genre sets per segment — not the same ids twice.
    expect(first.genreIds.some(id => second.genreIds.includes(id))).toBe(false);
  });

  it('the genre axis manual counts sum to exactly 9+9, not an approximation', () => {
    const plan = directSetLocal('카펜터스와 아바 느낌나는 노래 9곡씩 총 18곡 만들어줘', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    const genreAllocation = plan.allocations.find(item => item.axis === 'genre')!;
    const [firstSegment, secondSegment] = plan.segments;
    const firstTotal = firstSegment.genreIds.reduce((sum, id) => sum + (genreAllocation.counts[id] ?? 0), 0);
    const secondTotal = secondSegment.genreIds.reduce((sum, id) => sum + (genreAllocation.counts[id] ?? 0), 0);
    expect(firstTotal).toBe(9);
    expect(secondTotal).toBe(9);
  });

  it('all 8 diversity axes are still filled for a segmented plan', () => {
    const plan = directSetLocal('카펜터스와 아바 느낌나는 노래 9곡씩 총 18곡 만들어줘', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    const axes = plan.allocations.map(item => item.axis);
    expect(axes).toEqual(['genre', 'vocalType', 'introTexture', 'hookDevice', 'arrangementDensity', 'structureTemplate', 'lyricTheme', 'pov']);
    expect(plan.allocations.find(item => item.axis === 'vocalType')!.counts).toEqual({ male: 6, female: 6, mixed: 6 });
  });

  it('artist names never leak into any segment descriptor', () => {
    const plan = directSetLocal('카펜터스와 아바 느낌나는 노래', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    const allDescriptors = plan.segments.flatMap(segment => segment.descriptors).join(' ').toLowerCase();
    expect(allDescriptors).not.toMatch(/carpenter|abba|카펜터스|아바/);
  });

  it('[v3.63 재작성 TASK B fix] segments interleave in the final slot order — no more than 2 consecutive tracks from the same segment', () => {
    const plan = directSetLocal('카펜터스와 아바 느낌나는 노래 9곡씩 총 18곡 만들어줘', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    const [first, second] = plan.segments;
    const firstIds = new Set(first.genreIds);
    const secondIds = new Set(second.genreIds);
    const labels = plan.slots.map(slot => (firstIds.has(slot.genreId || '') ? 'A' : secondIds.has(slot.genreId || '') ? 'B' : '?'));
    expect(labels).not.toContain('?');
    let run = 1;
    let maxRun = 1;
    for (let i = 1; i < labels.length; i++) {
      run = labels[i] === labels[i - 1] ? run + 1 : 1;
      maxRun = Math.max(maxRun, run);
    }
    expect(maxRun).toBeLessThanOrEqual(2);
  });

  it('a single artist reference does NOT trigger the segment path (backward compatible with the old single-segment behavior)', () => {
    const plan = directSetLocal('비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    expect(plan.segments).toHaveLength(1);
    expect(plan.segments[0].label).toBe('전체');
  });
});

describe('[v3.63 재작성] directSetLocal — genre blend hint', () => {
  it('"샹송 느낌이 나는 올드팝" blends chanson traits onto an oldpop anchor', () => {
    const plan = directSetLocal('7080 올드팝 채널에 샹송 느낌이 나는 올드팝 만들어줘', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    expect(plan.segments).toHaveLength(1);
    const [segment] = plan.segments;
    expect(segment.blendedTraits).toBeDefined();
    expect(segment.genreIds).toContain('chanson');
    expect(segment.genreIds.some(id => id.startsWith('oldpop-') || id === 'soft-rock' || id === 'adult-contemporary')).toBe(true);
    // Accordion (chanson flavor) should show up somewhere in the blended instrumentation.
    expect(segment.blendedTraits!.instrumentation.some(item => item.toLowerCase().includes('accordion'))).toBe(true);
  });
});

describe('[v3.63 재작성] listening-context and unknown-term detection', () => {
  it('"커피숍에서"/"잔잔한" tighten the dynamic ceiling and add a tempo hint', () => {
    const plan = directSetLocal('커피숍에서 잔잔한 올드팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    expect(plan.interpretation.listeningContext.dynamicCeiling).toBe('low');
    expect(plan.interpretation.listeningContext.tempoHint).toBeDefined();
    expect(plan.interpretation.listeningContext.settingKo).not.toBe('특별한 청취 상황 지정 없음');
  });

  it('"오늘 같은 날씨에" is flagged as an unknown term, not silently ignored', () => {
    const plan = directSetLocal('오늘 같은 날씨에 신나는 노래', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    expect(plan.interpretation.unknownTermsKo.length).toBeGreaterThan(0);
    expect(plan.interpretation.unknownTermsKo[0]).toContain('날씨');
    // Still produces a full, non-empty plan — never an empty screen.
    expect(plan.slots).toHaveLength(18);
  });

  it('"요즘 인기 있는" is flagged as an unknown (real-time trend) term, not silently ignored', () => {
    const plan = directSetLocal('요즘 인기 있는 샹송풍으로', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    expect(plan.interpretation.unknownTermsKo.length).toBeGreaterThan(0);
    expect(plan.interpretation.unknownTermsKo[0]).toContain('인기');
    expect(plan.slots).toHaveLength(18);
  });

  it('an input with no special context returns the neutral default, not a false positive', () => {
    const plan = directSetLocal('비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    // "커피" alone (not "커피숍") should not trigger the cafe-setting cue.
    expect(plan.interpretation.unknownTermsKo).toEqual([]);
  });
});

describe('[v3.63 재작성] directSet — remote path with fallback', () => {
  const fakeSettings: ProviderSettings = {
    provider: 'anthropic',
    temperature: 0.6,
    proxyEndpoint: 'http://127.0.0.1:1/nonexistent-endpoint-for-test'
  };

  it('falls back to directSetLocal (a real, complete plan) when the remote call fails', async () => {
    const plan = await directSet('비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, fakeSettings);
    expect(plan.slots).toHaveLength(18);
    expect(plan.allocations.map(item => item.axis)).toEqual(['genre', 'vocalType', 'introTexture', 'hookDevice', 'arrangementDensity', 'structureTemplate', 'lyricTheme', 'pov']);
  });

  it('never throws even when the remote endpoint is completely unreachable', async () => {
    await expect(
      directSet('아무 입력', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, fakeSettings)
    ).resolves.toBeDefined();
  });
});
