import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { makeOptions, channelPresets, genrePacks, moodPacks, seasonPacks } from './fixtures';

const femaleChannel = channelPresets.find(c => c.archetype === 'kr-idol-female')!;
const maleChannel = channelPresets.find(c => c.archetype === 'kr-idol-male')!;
const nonIdolChannel = channelPresets.find(c => c.archetype !== 'kr-idol-female' && c.archetype !== 'kr-idol-male')!;

function instructionFor(channel = femaleChannel, songCount = 4) {
  const opts = makeOptions({ channel, songCount, genreIds: channel.preferredGenres, moodIds: channel.preferredMoods });
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
  const season = seasonPacks.find(s => s.id === 'christmas')!;
  const slots = preallocateSongSlots(opts, genres, { usedTitles: [], usedHooks: [] });
  return buildClaudeCodeInstruction(opts, genres, moods, season, undefined, slots);
}

describe('지시문 37 (TASK A-4) — [파트 배분] instruction is delivered verbatim from the app-computed partPlan', () => {
  it('kr-idol-female instruction names members, sections, and roles, and tells the agent to reflect them in lyric section tags', () => {
    const instruction = instructionFor(femaleChannel);
    expect(instruction).toContain('[파트 배분]');
    expect(instruction).toContain('Member A');
    expect(instruction).toContain('[Verse 1: Member A]');
    expect(instruction).toContain('Chorus: All');
  });

  it('kr-idol-male gets the same instruction shape', () => {
    const instruction = instructionFor(maleChannel);
    expect(instruction).toContain('[파트 배분]');
    expect(instruction).toContain('Member A');
  });

  it('a non-idol workspace gets no [파트 배분] block at all', () => {
    const instruction = instructionFor(nonIdolChannel);
    expect(instruction).not.toContain('[파트 배분]');
  });

  it('does not also emit the retired generic A/B/C idolPartPattern block (no two conflicting part-split instructions)', () => {
    const instruction = instructionFor(femaleChannel);
    // The old block's own fixed intro line — must not appear alongside the new one.
    expect(instruction).not.toContain('아래 트랙별 파트 패턴을 그대로 따르십시오');
  });
});
