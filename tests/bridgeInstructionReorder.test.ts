import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction } from '../src/core/bridgeInstruction';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from './fixtures';

/**
 * v5.23 (TASK A) — real, verified problem this task fixes: the bridge
 * instruction used to open with plan tables/constraints and only ever
 * accumulate "never"/"do not" bullets, with the one universal
 * safety-critical prohibition duplicated 2-3x across the file (§0-2's own
 * audit: 68 prohibition spots, 1 line of creative encouragement). These
 * tests verify the instruction now (a) opens with intent, before any
 * plan/constraint content, (b) ends with one consolidated avoid-section
 * instead of scattering the same 2 universal prohibitions across the
 * middle of the array, and (c) the intent section is never itself framed
 * as a new constraint.
 */
function buildRealInstruction(overrides: Partial<Parameters<typeof makeOptions>[0]> = {}) {
  const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio') ?? channelPresets[0];
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
  const season = seasonPacks[0];
  const opts = makeOptions({
    channel, songCount: 18, lyricLanguage: 'english', genreIds: genres.map(g => g.id),
    moodIds: moods.map(m => m.id), seasonId: season.id, customConcept: '70년대 비틀즈와 카펜터스의 만남', ...overrides
  });
  const slots = preallocateSongSlots(opts, genres);
  const instruction = buildClaudeCodeInstruction(opts, genres, moods, season, { usedTitles: ['Old Title'], usedHooks: ['Old Hook'] }, slots, false, {});
  return { instruction, opts };
}

describe('[v5.23 TASK A] intent section is the first real content', () => {
  it('appears before any plan table / constraint / rules content', () => {
    const { instruction } = buildRealInstruction();
    const intentIdx = instruction.indexOf('[이 세트가 하려는 것]');
    expect(intentIdx).toBeGreaterThan(-1);

    // Everything that used to come first (plan tables, rules, JSON payload) must appear AFTER the intent section.
    const setPlanIdx = instruction.indexOf('[SetPlan handoff]');
    const rulesIdx = instruction.indexOf('Rules:');
    const payloadIdx = instruction.indexOf('Request payload for this pack');
    expect(setPlanIdx).toBeGreaterThan(intentIdx);
    expect(rulesIdx).toBeGreaterThan(intentIdx);
    expect(payloadIdx).toBeGreaterThan(intentIdx);

    // Only the build marker and the composer framing sentence may precede it.
    const before = instruction.slice(0, intentIdx);
    expect(before).toContain('experienced music composer/producer');
    // Only the build marker + composer framing sentence precede it (~430 chars measured) — nowhere near the old ~1000+ chars of plan tables/rules that used to come first.
    expect(before.length).toBeLessThan(500);
  });

  it('carries the real concept text and songCount, not placeholder text', () => {
    const { instruction, opts } = buildRealInstruction();
    expect(instruction).toContain(opts.customConcept);
    expect(instruction).toContain(`${opts.songCount}곡을 이어 들었을 때`);
  });

  it('explicitly states constraints are not the goal itself (never reframed as a new checklist)', () => {
    const { instruction } = buildRealInstruction();
    expect(instruction).toContain('제약을 지키는 것 자체가 목표가 아닙니다');
  });

  it('falls back to a real (non-empty) label when customConcept is blank', () => {
    const { instruction, opts } = buildRealInstruction({ customConcept: '' });
    const section = instruction.slice(instruction.indexOf('[이 세트가 하려는 것]'), instruction.indexOf('[이 세트가 하려는 것]') + 200);
    expect(section).toContain(opts.channel.name);
  });
});

describe('[v5.23 TASK A] universal prohibitions are consolidated into one final section', () => {
  it('the already-used-titles/hooks warning appears exactly once in bridgeInstruction.ts\'s own assembly (not counting promptComposer.ts\'s separate rules block)', () => {
    const { instruction } = buildRealInstruction();
    const finalSectionIdx = instruction.indexOf('[마지막으로, 이것만은 피하십시오]');
    expect(finalSectionIdx).toBeGreaterThan(-1);
    const occurrences = instruction.split('FORBIDDEN for this pack').length - 1 + instruction.split('전부 금지입니다').length - 1;
    expect(occurrences).toBe(1);
  });

  it('the arrangement-vocabulary-in-lyrics prohibition appears exactly once in the final section, not also mid-array', () => {
    const { instruction } = buildRealInstruction();
    const finalSectionIdx = instruction.indexOf('[마지막으로, 이것만은 피하십시오]');
    const midArrayHit = instruction.slice(0, finalSectionIdx).includes('the guitar keeps walking');
    const finalSectionHit = instruction.slice(finalSectionIdx).includes('the guitar keeps walking');
    expect(midArrayHit).toBe(false);
    expect(finalSectionHit).toBe(true);
  });

  it('the final avoid section is the true last content section, before only the mechanical output-format bullets', () => {
    const { instruction } = buildRealInstruction();
    const finalSectionIdx = instruction.indexOf('[마지막으로, 이것만은 피하십시오]');
    const afterFinalSection = instruction.slice(finalSectionIdx);
    // Only mechanical file-write bullets should follow — no other creative/style instruction functions.
    expect(afterFinalSection).toContain('Do NOT prefix "title" with a track number');
    expect(afterFinalSection).toContain('tell me the file\'s path');
    expect(afterFinalSection).not.toContain('[SetPlan handoff]');
    expect(afterFinalSection).not.toContain('Rules:');
  });

  it('the real forbidden count reflects the actual avoid list passed in', () => {
    const { instruction } = buildRealInstruction();
    expect(instruction).toContain('"alreadyUsedTitles"의 1개');
    expect(instruction).toContain('"alreadyUsedHooks"의 1개');
  });
});

describe('[v5.23 TASK A] real instruction is well-formed end to end', () => {
  it('produces a non-empty, syntactically sane instruction for a real 18-song request', () => {
    const { instruction } = buildRealInstruction();
    expect(instruction.length).toBeGreaterThan(1000);
    expect(instruction).toContain('```json');
    expect(instruction).toContain('outputShape');
  });
});
