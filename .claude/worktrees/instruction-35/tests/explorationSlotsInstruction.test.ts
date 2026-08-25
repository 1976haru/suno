import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction } from '../src/core/bridgeInstruction';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { selectExplorationTrackNos } from '../src/core/explorationSlots';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from './fixtures';

/**
 * v5.23 (TASK C) — end-to-end coverage: a real generated instruction, with
 * a real explorationPlan wired through buildClaudeCodeInstruction's own
 * `explorationPlan` param (see that function's own doc comment). Confirms
 * the exploration section actually reaches the LLM-facing text, and that
 * omitting the plan (every pre-v5.23 caller) changes nothing.
 */
function buildInstructionWithPlan(explorationPlan?: ReturnType<typeof selectExplorationTrackNos>) {
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio') ?? channelPresets[0];
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
  const season = seasonPacks[0];
  const opts = makeOptions({ channel, songCount: 18, lyricLanguage: 'english', genreIds: genres.map(g => g.id), moodIds: moods.map(m => m.id), seasonId: season.id });
  const slots = preallocateSongSlots(opts, genres);
  return buildClaudeCodeInstruction(opts, genres, moods, season, { usedTitles: [], usedHooks: [] }, slots, false, {}, undefined, explorationPlan);
}

describe('[v5.23 TASK C] exploration slots reach the real bridge instruction', () => {
  it('a senior-oldpop plan produces real exploration text in the instruction', () => {
    const plan = selectExplorationTrackNos(18, 'senior-oldpop', 2); // sequence 2 -> 'vocal'
    const instruction = buildInstructionWithPlan(plan);
    expect(instruction).toContain('[탐색 슬롯');
    expect(instruction).toContain('실패해도 됩니다');
    for (const trackNo of plan.trackNos) expect(instruction).toContain(`T${trackNo}`);
  });

  it('omitting explorationPlan (every pre-v5.23 caller) produces zero exploration text', () => {
    const instruction = buildInstructionWithPlan(undefined);
    expect(instruction).not.toContain('[탐색 슬롯');
    expect(instruction).not.toContain('실패해도 됩니다');
  });

  it('a disabled plan (kr-2030) also produces zero exploration text', () => {
    const plan = selectExplorationTrackNos(18, 'kr-2030', 0);
    const instruction = buildInstructionWithPlan(plan);
    expect(instruction).not.toContain('[탐색 슬롯');
  });
});
