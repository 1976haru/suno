import { describe, expect, it } from 'vitest';
import { preallocateSongSlots, reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import { importSongsJson } from '../src/core/claudeCodeBridge';
import { scoreSong } from '../src/core/quality';
import { STRUCTURE_TEMPLATE_SECTION_NOTES } from '../src/core/lyricEngine';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

// TASK v3.43 — closes the gap real production output kept hitting even after
// v3.42's per-song differentiation: the moneyChordText/hookDeviceText/tempo
// instructions asked a remote agent to weave them in, but nothing checked the
// agent actually complied, and instrumentText/arrangementDensityText/
// structureTemplate never made it into the realtime/Batch/bridge slot at all
// (local-generation-only). Parts A1/A2 add post-hoc repair; A3 promotes the
// missing fields; A4 wires the existing in-pack similarity linter into
// import; A5 adds a quality-gate safety net for the two fields that
// previously had none.

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Song',
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: 'Hold On',
    stylePrompt: 'warm pop, soft vocal',
    lyrics: '[verse 1]\nline one\nline two\n[chorus]\nHold On\nHold On\n[end]',
    youtube: { title: 'yt', description: 'desc', tags: ['tag'] },
    qualityScore: 0,
    warnings: [],
    ...overrides
  };
}

describe('[Part A3] instrumentText/arrangementDensityText/structureNote are always present on every slot', () => {
  it('preallocateSongSlots sets all three for every trackNo, every archetype', () => {
    const opts = makeOptions({ songCount: 8 });
    const slots = preallocateSongSlots(opts, testGenres);
    expect(slots).toHaveLength(8);
    for (const slot of slots) {
      expect(slot.instrumentText).toBeTruthy();
      expect(slot.arrangementDensityText).toBeTruthy();
      expect(slot.structureNote).toBeTruthy();
    }
  });

  it('structureNote matches the section-order note for track 1 (always T1, per buildStructureTemplatePlan)', () => {
    const opts = makeOptions({ songCount: 8 });
    const [firstSlot] = preallocateSongSlots(opts, testGenres);
    expect(firstSlot.structureNote).toBe(STRUCTURE_TEMPLATE_SECTION_NOTES.T1);
  });

  it('is deterministic for the same seed-relevant opts', () => {
    const opts = makeOptions({ songCount: 6 });
    const first = preallocateSongSlots(opts, testGenres);
    const second = preallocateSongSlots(opts, testGenres);
    expect(first.map(s => s.instrumentText)).toEqual(second.map(s => s.instrumentText));
    expect(first.map(s => s.arrangementDensityText)).toEqual(second.map(s => s.arrangementDensityText));
    expect(first.map(s => s.structureNote)).toEqual(second.map(s => s.structureNote));
  });
});

describe('[Part A1/A2/A3] reconcileWithPreassignedSlot repairs verbatim-weave fields the agent dropped', () => {
  it('appends moneyChordText, hookDeviceText, instrumentText, and arrangementDensityText when all are missing from stylePrompt', () => {
    const opts = makeOptions({ songCount: 4 });
    const [slot] = preallocateSongSlots(opts, testGenres);
    const bareSong = baseSong({ trackNo: slot.trackNo, stylePrompt: 'warm pop, soft vocal' });
    const fixed = reconcileWithPreassignedSlot(bareSong, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.stylePrompt).toContain(slot.moneyChordText);
    expect(fixed.stylePrompt).toContain(slot.hookDeviceText!);
    expect(fixed.stylePrompt).toContain(slot.instrumentText!);
    expect(fixed.stylePrompt).toContain(slot.arrangementDensityText!);
  });

  it('does not duplicate a field that is already present verbatim', () => {
    const opts = makeOptions({ songCount: 4 });
    const [slot] = preallocateSongSlots(opts, testGenres);
    const alreadyThere = baseSong({ trackNo: slot.trackNo, stylePrompt: `warm pop, soft vocal, ${slot.moneyChordText}` });
    const fixed = reconcileWithPreassignedSlot(alreadyThere, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    const occurrences = fixed.stylePrompt.split(slot.moneyChordText).length - 1;
    expect(occurrences).toBe(1);
  });

  it('appends the correct BPM when the stylePrompt carries none', () => {
    const opts = makeOptions({ songCount: 4 });
    const [slot] = preallocateSongSlots(opts, testGenres);
    const noBpm = baseSong({ trackNo: slot.trackNo, stylePrompt: 'warm pop, soft vocal' });
    const fixed = reconcileWithPreassignedSlot(noBpm, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.stylePrompt).toContain(`${slot.tempo} BPM`);
  });

  it('replaces a wrong BPM figure with the slot\'s planned tempo, in place', () => {
    const opts = makeOptions({ songCount: 4 });
    const [slot] = preallocateSongSlots(opts, testGenres);
    const wrongTempo = slot.tempo + 40;
    const wrongBpm = baseSong({ trackNo: slot.trackNo, stylePrompt: `warm pop, soft vocal, ${wrongTempo} BPM, extra detail` });
    const fixed = reconcileWithPreassignedSlot(wrongBpm, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.stylePrompt).toContain(`${slot.tempo} BPM`);
    expect(fixed.stylePrompt).not.toContain(`${wrongTempo} BPM`);
    expect(fixed.stylePrompt).toContain('extra detail');
  });

  it('leaves an already-correct stylePrompt (every field verbatim, including BPM) fully untouched', () => {
    const opts = makeOptions({ songCount: 4 });
    const [slot] = preallocateSongSlots(opts, testGenres);
    const correctPrompt = `warm pop, ${slot.vocalText}, ${slot.moneyChordText}, ${slot.hookDeviceText}, ${slot.instrumentText}, ${slot.arrangementDensityText}, ${slot.tempo} BPM`;
    const correctSong = baseSong({ trackNo: slot.trackNo, stylePrompt: correctPrompt });
    const fixed = reconcileWithPreassignedSlot(correctSong, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.stylePrompt).toBe(correctPrompt);
  });

  it('is a no-op (as before) when there is no matching slot', () => {
    const song = baseSong({ trackNo: 999 });
    expect(reconcileWithPreassignedSlot(song, undefined)).toBe(song);
  });
});

describe('[Part A5] quality gate warns when a stylePrompt is missing a hook device or BPM figure', () => {
  it('warns when both are missing', () => {
    const scored = scoreSong(baseSong({ stylePrompt: 'warm pop, soft vocal, I-V-vi-IV progression, hook repeats chorus 4x' }));
    expect(scored.warnings).toContain('Missing prompt term: hook device (arrangement-contrast detail)');
    expect(scored.warnings).toContain('Missing prompt term: tempo (BPM)');
  });

  it('does not warn when both are present', () => {
    const scored = scoreSong(baseSong({
      stylePrompt: 'warm pop, soft vocal, I-V-vi-IV progression, hook repeats chorus 4x, stop-time accent on the chorus, 96 BPM'
    }));
    expect(scored.warnings).not.toContain('Missing prompt term: hook device (arrangement-contrast detail)');
    expect(scored.warnings).not.toContain('Missing prompt term: tempo (BPM)');
  });
});

describe('[Part A4] bridge import runs the in-pack similarity linter and surfaces its warnings', () => {
  it('warns when every imported song shares the exact same stylePrompt', () => {
    const opts = makeOptions({ songCount: 3, titleMode: 'ai-creative', hookMode: 'ai-creative' });
    const duplicatePrompt = 'nostalgic acoustic jazz-pop, elegant cafe mood, gentle maj7 colors, mature soft male tenor, I-V-vi-IV progression, stop-time accent, 96 BPM';
    const songs = Array.from({ length: 3 }, (_, i) => ({
      trackNo: i + 1,
      title: `Song ${i + 1}`,
      hookPhrase: `Hook ${i + 1}`,
      stylePrompt: duplicatePrompt,
      lyrics: `[verse 1]\nline a ${i}\nline b ${i}\n[chorus]\nHook ${i + 1}\nHook ${i + 1}\n[end]`,
      seasonMoment: 'x',
      listenerSituation: 'x',
      emotionArc: 'x',
      youtube: { title: 'yt', description: 'desc', tags: ['tag'] }
    }));
    const raw = JSON.stringify({ songs });
    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason, [], [], []);
    expect(report.blueprint).not.toBeNull();
    expect(report.warnings.some(w => w.includes('similar'))).toBe(true);
  });

  it('does not warn on a genuinely varied import', () => {
    const opts = makeOptions({ songCount: 3, titleMode: 'ai-creative', hookMode: 'ai-creative' });
    const songs = Array.from({ length: 3 }, (_, i) => ({
      trackNo: i + 1,
      title: `Song ${i + 1}`,
      hookPhrase: `Hook ${i + 1}`,
      stylePrompt: `genre ${i}, mood ${i}, instrument ${i}, vocal ${i}, hook device ${i}, tempo ${90 + i * 10} BPM`,
      lyrics: `[verse 1]\nline a ${i}\nline b ${i}\n[chorus]\nHook ${i + 1}\nHook ${i + 1}\n[end]`,
      seasonMoment: 'x',
      listenerSituation: 'x',
      emotionArc: 'x',
      youtube: { title: 'yt', description: 'desc', tags: ['tag'] }
    }));
    const raw = JSON.stringify({ songs });
    const report = importSongsJson(raw, opts, testGenres, testMoods, testSeason, [], [], []);
    expect(report.blueprint).not.toBeNull();
    expect(report.warnings.some(w => w.includes('similar'))).toBe(false);
  });
});
