import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { channelPresets, genrePacks } from '../src/data/presets';
import { makeOptions, testMoods, testSeason } from './fixtures';

const avoid = { usedTitles: [] as string[], usedHooks: [] as string[] };

/**
 * 지시문 35 (TASK D-3) — kr-2030-rap 전용 안전 브릿지 지시문이 실제
 * buildClaudeCodeInstruction 출력에 들어가는지, 그리고 다른 채널에는
 * 새지 않는지 고정한다.
 */
describe('[지시문 35 TASK D-3] kr-2030-rap safety bridge instruction', () => {
  it('includes the safety brief for kr-2030-rap', () => {
    const channel = channelPresets.find(c => c.id === 'kr-2030-rap')!;
    expect(channel).toBeTruthy();
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const opts = makeOptions({ channel, songCount: 3 });
    const slots = preallocateSongSlots(opts, genres, avoid);
    const instruction = buildClaudeCodeInstruction(opts, genres, testMoods, testSeason, avoid, slots, false);
    expect(instruction).toContain('유튜브 플레이리스트용입니다');
    expect(instruction).toContain('no weapons, violence, or crime narrative content');
    expect(instruction).toContain('no profanity or slurs');
    expect(instruction).toContain('no real celebrity, artist, or brand names');
  });

  it('does NOT leak into the other kr-2030-pop channels (after-work-band-pop)', () => {
    const channel = channelPresets.find(c => c.id === 'after-work-band-pop')!;
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const opts = makeOptions({ channel, songCount: 3 });
    const slots = preallocateSongSlots(opts, genres, avoid);
    const instruction = buildClaudeCodeInstruction(opts, genres, testMoods, testSeason, avoid, slots, false);
    expect(instruction).not.toContain('유튜브 플레이리스트용입니다');
  });
});
