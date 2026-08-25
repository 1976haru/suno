import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction } from '../src/core/bridgeInstruction';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from './fixtures';

/**
 * v5.23 (TASK F §7, widened pass) — coverage for the 2 genuine 스타일(권고)
 * items the wider audit found (see bridgeInstruction.ts's own
 * buildFinalAvoidSection doc comment for the full reasoning): both are
 * cross-pack variety nudges, tagged [스타일 경향] and reworded from a flat
 * "Never/Do not" ban to "there's a real tendency... worth watching for" —
 * softened in place, not relocated (mirrors TASK A's own scope decision
 * for the other ~30 field-specific caveats).
 */
function buildRealInstruction() {
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio') ?? channelPresets[0];
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
  const season = seasonPacks[0];
  const opts = makeOptions({ channel, songCount: 18, lyricLanguage: 'english', genreIds: genres.map(g => g.id), moodIds: moods.map(m => m.id), seasonId: season.id });
  const slots = preallocateSongSlots(opts, genres);
  return buildClaudeCodeInstruction(opts, genres, moods, season, { usedTitles: [], usedHooks: [] }, slots, false, {});
}

describe('[v5.23 TASK F §7] genuine 스타일 items are tagged and softened, not banned', () => {
  it('the title image-pair-shape clause is tagged [스타일 경향] and no longer says "Never default to"', () => {
    const instruction = buildRealInstruction();
    expect(instruction).toContain('[스타일 경향]');
    expect(instruction).toContain('real tendency to fall into the same');
    expect(instruction).not.toContain('Never default to the same "[adjective] [noun]"');
  });

  it('the section-style variety clause no longer says "Do not let every song start"', () => {
    const instruction = buildRealInstruction();
    expect(instruction).not.toContain('Do not let every song start with the same first-line shape');
    expect(instruction).toContain('real tendency for every song to start with the same first-line shape');
  });

  it('genuine quality/safety items in the same instruction are unaffected (still firm, not softened)', () => {
    const instruction = buildRealInstruction();
    // era-authenticity guardrail (safety/correctness-tier) must still read as a hard rule.
    expect(instruction).toContain('CRITICAL');
    // the hookPhrase/chorus-hook match rule (app-planned determinism) stays a hard "must".
    expect(instruction).toContain('the final "hookPhrase" must exactly match the hook line');
  });
});
