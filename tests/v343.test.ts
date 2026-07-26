import { describe, expect, it } from 'vitest';
import { preallocateSongSlots, reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import { importSongsJson } from '../src/core/claudeCodeBridge';
import { scoreSong } from '../src/core/quality';
import { STRUCTURE_TEMPLATE_MARKER_TAG } from '../src/core/lyricEngine';
import { ARRANGEMENT_DENSITY_TEXT_BY_LEVEL } from '../src/core/promptComposer';
import { lintInPackStyleSimilarity } from '../src/core/diversityLinter';
import { genrePacks, makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

// TASK v3.43 — closes the gap real production output kept hitting even after
// v3.42's per-song differentiation: the moneyChordText/hookDeviceText/tempo
// instructions asked a remote agent to weave them in, but nothing checked the
// agent actually complied, and instrumentSet/arrangementDensity/
// structureTemplate never made it into the realtime/Batch/bridge slot at all
// (local-generation-only). Step 1 Parts A1/A2 add post-hoc repair for
// moneyChordText/hookDeviceText/tempo; Step 2 Part A3 promotes the missing
// instrument/density/structure fields (as structured data, not pre-composed
// text) and repairs the two stylePrompt-facing ones; Part A4 wires the
// existing in-pack similarity linter into import with an added average-error
// tier; Part A5 adds a quality-gate safety net for device/BPM.

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

const flatTagGenres = [genrePacks.find(genre => genre.id === 'lofi-cafe')!];

function makeFlatTagOptions(overrides: Parameters<typeof makeOptions>[0] = {}) {
  return makeOptions({ genreIds: flatTagGenres.map(genre => genre.id), ...overrides });
}

describe('[Step 2 Part A3] instrumentSet/arrangementDensity/structureTemplate are always present on every slot', () => {
  it('preallocateSongSlots sets all three for every trackNo, every archetype', () => {
    const opts = makeOptions({ songCount: 8 });
    const slots = preallocateSongSlots(opts, testGenres);
    expect(slots).toHaveLength(8);
    for (const slot of slots) {
      expect(slot.instrumentSet?.length).toBeGreaterThan(0);
      expect(['sparse', 'medium', 'full']).toContain(slot.arrangementDensity);
      expect(['T1', 'T2', 'T3', 'T4', 'T5']).toContain(slot.structureTemplate);
    }
  });

  it('track 1 always gets structureTemplate T1 (per buildStructureTemplatePlan)', () => {
    const opts = makeOptions({ songCount: 8 });
    const [firstSlot] = preallocateSongSlots(opts, testGenres);
    expect(firstSlot.structureTemplate).toBe('T1');
  });

  it('never repeats the same arrangementDensity on adjacent tracks (period-3 rotation)', () => {
    const opts = makeOptions({ songCount: 9 });
    const slots = preallocateSongSlots(opts, testGenres);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].arrangementDensity).not.toBe(slots[i - 1].arrangementDensity);
    }
  });

  it('is deterministic for the same seed-relevant opts', () => {
    const opts = makeOptions({ songCount: 6 });
    const first = preallocateSongSlots(opts, testGenres);
    const second = preallocateSongSlots(opts, testGenres);
    expect(first.map(s => s.instrumentSet)).toEqual(second.map(s => s.instrumentSet));
    expect(first.map(s => s.arrangementDensity)).toEqual(second.map(s => s.arrangementDensity));
    expect(first.map(s => s.structureTemplate)).toEqual(second.map(s => s.structureTemplate));
  });
});

describe('[Part A1/A2, Step 2 A3] reconcileWithPreassignedSlot repairs verbatim-weave fields the agent dropped', () => {
  it('appends moneyChordText, hookDeviceText, and every instrumentSet name when all are missing from stylePrompt', () => {
    const opts = makeFlatTagOptions({ songCount: 4 });
    const [slot] = preallocateSongSlots(opts, flatTagGenres);
    const bareSong = baseSong({ trackNo: slot.trackNo, stylePrompt: 'warm pop, soft vocal' });
    const fixed = reconcileWithPreassignedSlot(bareSong, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.stylePrompt).toContain(slot.moneyChordText);
    expect(fixed.stylePrompt).toContain(slot.hookDeviceText!);
    for (const instrument of slot.instrumentSet!) {
      expect(fixed.stylePrompt.toLowerCase()).toContain(instrument.toLowerCase());
    }
  });

  it('only injects the missing instrument names, leaving already-present ones alone', () => {
    const opts = makeOptions({ songCount: 4 });
    const [slot] = preallocateSongSlots(opts, testGenres);
    if (!slot.instrumentSet || slot.instrumentSet.length < 2) return;
    const [firstInstrument] = slot.instrumentSet;
    const partial = baseSong({ trackNo: slot.trackNo, stylePrompt: `warm pop, ${firstInstrument}` });
    const fixed = reconcileWithPreassignedSlot(partial, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    // the first instrument should not be duplicated
    const firstOccurrences = fixed.stylePrompt.toLowerCase().split(firstInstrument.toLowerCase()).length - 1;
    expect(firstOccurrences).toBe(1);
    for (const instrument of slot.instrumentSet) {
      expect(fixed.stylePrompt.toLowerCase()).toContain(instrument.toLowerCase());
    }
  });

  it('injects the canonical arrangementDensity phrase when missing', () => {
    const opts = makeOptions({ songCount: 4 });
    const [slot] = preallocateSongSlots(opts, testGenres);
    const bareSong = baseSong({ trackNo: slot.trackNo, stylePrompt: 'warm pop, soft vocal' });
    const fixed = reconcileWithPreassignedSlot(bareSong, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.stylePrompt).toContain(ARRANGEMENT_DENSITY_TEXT_BY_LEVEL[slot.arrangementDensity!]);
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
    const opts = makeFlatTagOptions({ songCount: 4 });
    const [slot] = preallocateSongSlots(opts, flatTagGenres);
    const correctPrompt = `warm pop, ${slot.vocalText}, ${slot.moneyChordText}, ${slot.hookDeviceText}, ${slot.introTextureText}, ${slot.instrumentSet!.join(', ')}, ${ARRANGEMENT_DENSITY_TEXT_BY_LEVEL[slot.arrangementDensity!]}, ${slot.tempo} BPM`;
    const correctSong = baseSong({ trackNo: slot.trackNo, stylePrompt: correctPrompt });
    const fixed = reconcileWithPreassignedSlot(correctSong, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.stylePrompt).toBe(correctPrompt);
  });

  it('is a no-op (as before) when there is no matching slot', () => {
    const song = baseSong({ trackNo: 999 });
    expect(reconcileWithPreassignedSlot(song, undefined)).toBe(song);
  });
});

describe('[Step 2 Part A3] structureTemplate warns (never errors/rewrites) when the lyrics don\'t show the assigned template', () => {
  it('warns when a T3-assigned song\'s lyrics never show the key-lift final chorus marker', () => {
    const opts = makeOptions({ songCount: 4 });
    const slots = preallocateSongSlots(opts, testGenres);
    const t3Slot = slots.find(s => s.structureTemplate === 'T3') ?? { ...slots[1], structureTemplate: 'T3' as const };
    const defaultShapeSong = baseSong({ trackNo: t3Slot.trackNo, stylePrompt: 'warm pop, soft vocal' });
    const fixed = reconcileWithPreassignedSlot(defaultShapeSong, t3Slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.warnings.some(w => w.includes('structureTemplate T3'))).toBe(true);
  });

  it('does not warn when the assigned template\'s marker is present', () => {
    const opts = makeOptions({ songCount: 4 });
    const slots = preallocateSongSlots(opts, testGenres);
    const t3Slot = slots.find(s => s.structureTemplate === 'T3') ?? { ...slots[1], structureTemplate: 'T3' as const };
    const marker = STRUCTURE_TEMPLATE_MARKER_TAG.T3!;
    const matchingSong = baseSong({
      trackNo: t3Slot.trackNo,
      lyrics: `[verse 1]\nline one\n[chorus]\nHold On\nHold On\n${marker}\nHold On\nHold On\n[end]`
    });
    const fixed = reconcileWithPreassignedSlot(matchingSong, t3Slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.warnings.some(w => w.includes('structureTemplate'))).toBe(false);
  });

  it('never warns for T1 (the unmarked default template)', () => {
    const opts = makeOptions({ songCount: 4 });
    const slots = preallocateSongSlots(opts, testGenres);
    const t1Slot = { ...slots[0], structureTemplate: 'T1' as const };
    const song = baseSong({ trackNo: t1Slot.trackNo, stylePrompt: 'warm pop, soft vocal' });
    const fixed = reconcileWithPreassignedSlot(song, t1Slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.warnings.some(w => w.includes('structureTemplate'))).toBe(false);
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
  it('errors (not just warns) when every imported song shares the exact same stylePrompt', () => {
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
    expect(report.warnings.some(w => w.includes('similar') || w.includes('indistinguishable'))).toBe(true);
    // TASK v3.43 Step 2 (Part A4) — "무엇이 고정돼 있는지 보이게": the common
    // clauses across every song are surfaced alongside the warning/error.
    expect(report.warnings.some(w => w.startsWith('Clauses common to every song'))).toBe(true);
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
    expect(report.warnings.some(w => w.includes('similar') || w.includes('indistinguishable'))).toBe(false);
  });
});

describe('[Completion criteria] a 10-song bridge pack meets the measured targets even in the worst case (agent wrote nothing extra)', () => {
  // Simulates the worst-case coding-agent compliance: every song's
  // stylePrompt/lyrics carry only the bare required fields, nothing the
  // instructions asked for. reconcileWithPreassignedSlot (Step 1 A1/A2, Step
  // 2 A3) is the only thing filling in BPM/hook-device/instruments/density —
  // this proves the repair mechanism alone (not agent goodwill) reaches the
  // spec's numbers for every field that's actually stylePrompt-injectable.
  const opts = makeFlatTagOptions({ songCount: 10 });
  const slots = preallocateSongSlots(opts, flatTagGenres);

  function reconciledPack() {
    return slots.map(slot => reconcileWithPreassignedSlot(
      {
        trackNo: slot.trackNo,
        title: slot.title,
        seasonMoment: 'x',
        listenerSituation: 'x',
        emotionArc: 'x',
        hookPhrase: slot.hookPhrase,
        stylePrompt: 'plain generic pop',
        lyrics: `[verse 1]\nline\n[chorus]\n${slot.hookPhrase}\n${slot.hookPhrase}\n[end]`,
        youtube: { title: 'yt', description: 'desc', tags: ['tag'] },
        qualityScore: 0,
        warnings: []
      },
      slot,
      'ai-creative',
      { keepHook: true, keepEmotionArc: true }
    ));
  }

  it('BPM 10/10', () => {
    const pack = reconciledPack();
    for (const song of pack) {
      expect(song.stylePrompt).toMatch(/\b\d{2,3}\s*bpm\b/i);
    }
  });

  it('10 distinct hook devices used (hookDevices pool is exactly 10)', () => {
    const pack = reconciledPack();
    const usedDeviceTexts = new Set(slots.map(s => s.hookDeviceText).filter(Boolean));
    expect(usedDeviceTexts.size).toBe(10);
    for (let i = 0; i < pack.length; i++) {
      expect(pack[i].stylePrompt).toContain(slots[i].hookDeviceText);
    }
  });

  it('6+ distinct instrument combinations', () => {
    const combos = new Set(slots.map(s => (s.instrumentSet ?? []).join(', ')));
    expect(combos.size).toBeGreaterThanOrEqual(6);
  });

  it('average pairwise style-prompt similarity <=70%, zero identical pairs', () => {
    const pack = reconciledPack();
    const report = lintInPackStyleSimilarity(pack.map(s => ({ trackNo: s.trackNo, stylePrompt: s.stylePrompt })));
    expect(report.averageSimilarity).toBeLessThanOrEqual(0.70);
    expect(report.maxSimilarity).toBeLessThan(1);
    expect(report.errors).toHaveLength(0);
  });
});
