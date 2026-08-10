import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { makeOptions, channelPresets, genrePacks, moodPacks, seasonPacks } from './fixtures';
import { buildKpopSectionStyleShiftPlan } from '../src/core/kpopSectionStyleShiftPlan';
import {
  SECTION_STYLE_SHIFT_PRESETS,
  SECTION_STYLE_SHIFT_MAX_TRANSITIONS,
  SECTION_STYLE_SHIFT_MIN_TRANSITIONS,
  sectionStyleShiftInstructionText
} from '../src/data/sectionStyleShifts';

const femaleChannel = channelPresets.find(c => c.archetype === 'kr-idol-female')!;
const nonIdolChannel = channelPresets.find(c => c.archetype !== 'kr-idol-female' && c.archetype !== 'kr-idol-male')!;

function instructionFor(channel = femaleChannel, songCount = 4) {
  const opts = makeOptions({ channel, songCount, genreIds: channel.preferredGenres, moodIds: channel.preferredMoods });
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
  const season = seasonPacks.find(s => s.id === 'christmas')!;
  const slots = preallocateSongSlots(opts, genres, { usedTitles: [], usedHooks: [] });
  return { instruction: buildClaudeCodeInstruction(opts, genres, moods, season, undefined, slots), slots };
}

describe('지시문 37 (TASK B) — SectionStyleShift', () => {
  it('every preset has 2-3 shifts (§B-3 정책 상한)', () => {
    for (const preset of SECTION_STYLE_SHIFT_PRESETS) {
      expect(preset.shifts.length).toBeGreaterThanOrEqual(SECTION_STYLE_SHIFT_MIN_TRANSITIONS);
      expect(preset.shifts.length).toBeLessThanOrEqual(SECTION_STYLE_SHIFT_MAX_TRANSITIONS);
    }
  });

  it('instruction text keeps "Section:" labels intact, one per shift', () => {
    const preset = SECTION_STYLE_SHIFT_PRESETS[1]; // 3-shift preset
    const text = sectionStyleShiftInstructionText(preset);
    expect(text).toContain('Verse:');
    expect(text).toContain('Chorus:');
    expect(text).toContain('Bridge:');
  });

  it('buildKpopSectionStyleShiftPlan returns one preset id per track, deterministic for the same seed', () => {
    const a = buildKpopSectionStyleShiftPlan(18, 5);
    const b = buildKpopSectionStyleShiftPlan(18, 5);
    expect(a).toHaveLength(18);
    expect(a).toEqual(b);
  });

  it('kr-idol-female slots get sectionStyleShifts with 2-3 entries each', () => {
    const { slots } = instructionFor(femaleChannel);
    expect(slots.every(s => s.sectionStyleShifts)).toBe(true);
    for (const slot of slots) {
      expect(slot.sectionStyleShifts!.length).toBeGreaterThanOrEqual(2);
      expect(slot.sectionStyleShifts!.length).toBeLessThanOrEqual(3);
    }
  });

  it('bridge instruction weaves sectionStyleShiftText verbatim with "Section:" labels preserved', () => {
    const { instruction } = instructionFor(femaleChannel);
    expect(instruction).toContain('sectionStyleShiftText');
    expect(instruction).toContain('Verse:');
    expect(instruction).toContain('do not merge sections together');
  });

  it('a non-idol workspace gets no sectionStyleShiftText instruction at all', () => {
    const { instruction, slots } = instructionFor(nonIdolChannel);
    expect(slots.every(s => !s.sectionStyleShifts)).toBe(true);
    expect(instruction).not.toContain('sectionStyleShiftText');
  });
});
