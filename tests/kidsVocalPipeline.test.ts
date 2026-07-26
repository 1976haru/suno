import { describe, expect, it } from 'vitest';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildBatchSystemNote, buildAnthropicUserPayload } from '../src/core/promptComposer';
import { buildClaudeCodeInstruction, buildMultiSetClaudeCodeInstructions } from '../src/core/claudeCodeBridge';
import { vocalDescriptionFor, type VocalType } from '../src/core/vocalPlan';
import { getGenreById, getVisibleGenresForArchetype } from '../src/data/genreLibrary';
import { makeOptions, channelPresets, genrePacks, moodPacks, seasonPacks } from './fixtures';
import type { BatchContext } from '../src/types';

// TASK v3.39 — end-to-end regression coverage for the v3.39 fixes:
// (C) per-song vocalType/vocalText actually wired into every generation
// path's preassignedSongs slot (previously only computed inside
// localGenerator.ts's own synchronous path, never reaching realtime/Batch/
// bridge); (B) kids vocal descriptions no longer read as adult voices;
// (A) the 4 kids genre packs resolve through genreLibrary's own
// getGenreById/getVisibleGenresForArchetype, not just presets.ts's genrePacks.

const kidsChannel = channelPresets.find(c => c.archetype === 'kids')!;
const seniorMorning = channelPresets.find(c => c.archetype === 'senior-morning')!;
const kidsGenres = genrePacks.filter(g => kidsChannel.preferredGenres.includes(g.id));
const kidsMoods = moodPacks.filter(m => kidsChannel.preferredMoods.includes(m.id));
const season = seasonPacks[0];

describe('[v3.39 Part C] preallocateSongSlots carries the kids vocal quota', () => {
  it('produces exactly a 5/5/5 vocalType distribution across 15 songs', () => {
    const opts = makeOptions({ channel: kidsChannel, songCount: 15, lyricLanguage: 'korean', seasonId: season.id });
    const slots = preallocateSongSlots(opts, kidsGenres);
    expect(slots).toHaveLength(15);
    const counts = { male: 0, female: 0, mixed: 0 };
    for (const slot of slots) {
      expect(slot.vocalType, `trackNo ${slot.trackNo}`).toBeDefined();
      counts[slot.vocalType!] += 1;
    }
    expect(counts).toEqual({ male: 5, female: 5, mixed: 5 });
  });

  it('every kids slot carries vocalText matching one of vocalDescriptionFor(vocalType, lyricLanguage)\'s rotating variants', () => {
    // TASK v3.41 Part A2/D — vocalText now rotates through 5 variants per
    // type (see vocalPlan.ts's buildVocalVariantPlan), so it's no longer
    // always variant 0; membership in the possible-variants set is the
    // correct check now (exact-value coverage lives in tests/v341.test.ts).
    const opts = makeOptions({ channel: kidsChannel, songCount: 15, lyricLanguage: 'korean', seasonId: season.id });
    const slots = preallocateSongSlots(opts, kidsGenres);
    for (const slot of slots) {
      const possibleVariants = new Set(Array.from({ length: 5 }, (_, i) => vocalDescriptionFor(slot.vocalType!, 'korean', i)));
      expect(possibleVariants.has(slot.vocalText!), `trackNo ${slot.trackNo}: ${slot.vocalText}`).toBe(true);
    }
  });

  it('non-kids channels never get vocalType, but do get vocalText from opts.vocalTone/defaultVocal (Part H)', () => {
    const seniorGenres = genrePacks.filter(g => seniorMorning.preferredGenres.includes(g.id));
    const opts = makeOptions({ channel: seniorMorning, songCount: 15, seasonId: season.id });
    const slots = preallocateSongSlots(opts, seniorGenres);
    for (const slot of slots) {
      expect(slot.vocalType).toBeUndefined();
      expect(slot.vocalText).toBe(opts.vocalTone?.trim() || seniorMorning.defaultVocal);
    }
  });

  it('agrees with the local generation path on the same opts: identical per-trackNo vocalType', () => {
    const opts = makeOptions({ channel: kidsChannel, songCount: 15, lyricLanguage: 'korean', seasonId: season.id });
    const bp = generateLocalBlueprint(opts, kidsGenres, kidsMoods, season);
    const slots = preallocateSongSlots(opts, kidsGenres);
    for (const slot of slots) {
      const song = bp.songs.find(s => s.trackNo === slot.trackNo)!;
      expect(song.vocalType, `trackNo ${slot.trackNo}`).toBe(slot.vocalType);
    }
  });
});

describe('[v3.39 Part B] no vocal description ever reads as an adult voice', () => {
  const types: VocalType[] = ['male', 'female', 'mixed'];
  const languages = ['korean', 'japanese', 'english'] as const;

  it('vocalDescriptionFor never contains "adult" for any type/language', () => {
    for (const type of types) {
      for (const language of languages) {
        expect(vocalDescriptionFor(type, language).toLowerCase()).not.toContain('adult');
      }
    }
  });

  it('actual preallocated slot vocalText for a 15-song kids pack never contains "adult"', () => {
    const opts = makeOptions({ channel: kidsChannel, songCount: 15, lyricLanguage: 'korean', seasonId: season.id });
    const slots = preallocateSongSlots(opts, kidsGenres);
    for (const slot of slots) {
      expect(slot.vocalText!.toLowerCase()).not.toContain('adult');
    }
  });
});

describe('[v3.39 Part C] promptComposer weaves vocalText into the batch instruction', () => {
  it('buildBatchSystemNote instructs verbatim vocalText use when the kids quota is active', () => {
    const opts = makeOptions({ channel: kidsChannel, songCount: 15, lyricLanguage: 'korean', seasonId: season.id });
    const slots = preallocateSongSlots(opts, kidsGenres);
    const batch: BatchContext = { trackNoOffset: 0, totalSongCount: 15, usedTitles: [], usedHooks: [], lockedIdentity: null, preassignedSongs: slots };
    const note = buildBatchSystemNote(opts, batch);
    expect(note).toContain('"vocalText"');
    expect(slots.every(slot => slot.hookDeviceText)).toBe(true);
    // TASK v3.48.1 — kids-bright-pop is a narrative genre, but it still
    // carries an auxiliary non-overlapping hook device for a real hook moment.
    // TASK v3.43 Part A2, Step 2 Part A3 — tempo/instrumentSet/
    // arrangementDensity/structureTemplate joined the same always-present,
    // always-forced set.
    expect(note).toContain('Do NOT invent a different trackNo, emotionArc, moneyChordText, tempo, genreText, hookDeviceText, introTextureText, negativeStyleText, instrumentSet, arrangementDensity, structureTemplate, or vocalText');
  });

  it('buildBatchSystemNote also instructs verbatim vocalText use for a non-kids channel (Part H)', () => {
    const seniorGenres = genrePacks.filter(g => seniorMorning.preferredGenres.includes(g.id));
    const opts = makeOptions({ channel: seniorMorning, songCount: 12, seasonId: season.id });
    const slots = preallocateSongSlots(opts, seniorGenres);
    const batch: BatchContext = { trackNoOffset: 0, totalSongCount: 12, usedTitles: [], usedHooks: [], lockedIdentity: null, preassignedSongs: slots };
    const note = buildBatchSystemNote(opts, batch);
    expect(note).toContain('"vocalText"');
  });

  it('buildAnthropicUserPayload forwards the full slot (including vocalText) to the real API payload', () => {
    const opts = makeOptions({ channel: kidsChannel, songCount: 15, lyricLanguage: 'korean', seasonId: season.id });
    const slots = preallocateSongSlots(opts, kidsGenres);
    const batch: BatchContext = { trackNoOffset: 0, totalSongCount: 15, usedTitles: [], usedHooks: [], lockedIdentity: null, preassignedSongs: slots };
    const payload = buildAnthropicUserPayload(opts, batch);
    expect(payload.preassignedSongs).toHaveLength(15);
    expect(payload.preassignedSongs.every(slot => typeof slot.vocalText === 'string')).toBe(true);
  });
});

describe('[v3.39 Part C] Claude Code bridge carries per-song vocal instructions', () => {
  it('buildClaudeCodeInstruction includes a verbatim vocalText instruction and the actual per-song vocalText values', () => {
    const opts = makeOptions({ channel: kidsChannel, songCount: 15, lyricLanguage: 'korean', seasonId: season.id });
    const slots = preallocateSongSlots(opts, kidsGenres);
    const instruction = buildClaudeCodeInstruction(opts, kidsGenres, kidsMoods, season, undefined, slots);
    expect(instruction).toContain('"vocalText"');
    expect(instruction).toContain('weave that exact phrase into that song\'s stylePrompt as the vocal description, verbatim');
    for (const slot of slots) {
      expect(instruction).toContain(slot.vocalText);
    }
  });

  it('also emits a vocalText instruction for a non-kids channel bridge instruction (Part H)', () => {
    const seniorGenres = genrePacks.filter(g => seniorMorning.preferredGenres.includes(g.id));
    const seniorMoods = moodPacks.filter(m => seniorMorning.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel: seniorMorning, songCount: 12, seasonId: season.id });
    const slots = preallocateSongSlots(opts, seniorGenres);
    const instruction = buildClaudeCodeInstruction(opts, seniorGenres, seniorMoods, season, undefined, slots);
    expect(instruction).toContain('"vocalText"');
    expect(instruction).toContain(seniorMorning.defaultVocal);
  });

  it('the set-planning table\'s vocal quota summary always matches the real per-slot vocalType counts', () => {
    const opts = makeOptions({ channel: kidsChannel, songCount: 15, lyricLanguage: 'korean', seasonId: season.id });
    const [set] = buildMultiSetClaudeCodeInstructions(opts, 1, 15, kidsGenres, kidsMoods, season, undefined);
    const counts = { male: 0, female: 0, mixed: 0 };
    for (const slot of set.preassignedSongs) counts[slot.vocalType!] += 1;
    expect(set.instruction).toContain(`male ${counts.male}, female ${counts.female}, mixed ${counts.mixed}`);
  });
});

describe('[v3.39 Part A] kids genre packs resolve through genreLibrary', () => {
  it('getGenreById resolves all 3 primary kids genre ids plus the secondary kids-march', () => {
    for (const id of ['kids-bright-pop', 'kids-acoustic-singalong', 'kids-upbeat-pop', 'kids-march']) {
      const genre = getGenreById(id);
      expect(genre, id).toBeDefined();
      expect(genre!.archetypes).toContain('kids');
    }
  });

  it('getVisibleGenresForArchetype("kids") returns the 3 core kids chips, not an empty list', () => {
    const visible = getVisibleGenresForArchetype('kids');
    const visibleIds = visible.map(g => g.id);
    expect(visibleIds).toContain('kids-bright-pop');
    expect(visibleIds).toContain('kids-acoustic-singalong');
    expect(visibleIds).toContain('kids-upbeat-pop');
    expect(visible.length).toBeGreaterThan(0);
  });
});
