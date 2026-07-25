import { describe, expect, it } from 'vitest';
import { preallocateSongSlots, reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import {
  detectVocalGender,
  ensureVocalMetaTag,
  enforceVocalTextInStylePrompt,
  resolveVocalMetaTag
} from '../src/core/vocalPlan';
import { scoreSong } from '../src/core/quality';
import { ARRANGEMENT_DENSITY_TEXT_BY_LEVEL } from '../src/core/promptComposer';
import { vocalPresets } from '../src/data/vocalPresets';
import { channelPresets, makeOptions } from './fixtures';
import type { SongIdea } from '../src/types';

// TASK v3.39 Part H — regression coverage for the real showa-cafe bug: a
// channel selected a male vocal preset, but a Codex-bridge-generated song
// came back female because nothing in the pipeline actually enforced the
// selection outside the kids-only per-song quota (Part C). These tests cover
// the fix across all four layers the spec called out: slot ownership,
// deterministic stylePrompt correction, lyric meta tags, and the quality
// gate warning — for a *non-kids* channel, since Part C already covers kids.

const showaCafe = channelPresets.find(c => c.archetype === 'showa-cafe')!;

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 2,
    title: 'Test Song',
    seasonMoment: '',
    listenerSituation: '',
    emotionArc: '',
    hookPhrase: 'Hold On',
    stylePrompt: 'showa-modern cafe mood, soft warm female alto, gentle breathy delivery, I-V-vi-IV progression, 96 BPM',
    lyrics: 'Hold On\nsome lyrics\nHold On',
    youtube: { title: 'Test', description: 'Test', tags: [] },
    qualityScore: 0,
    warnings: [],
    ...overrides
  };
}

describe('detectVocalGender', () => {
  it('detects male/female by whole word only, never a substring match', () => {
    expect(detectVocalGender('mature soulful male tenor')).toBe('male');
    expect(detectVocalGender('soft warm female alto')).toBe('female');
    expect(detectVocalGender('warm adult contemporary pop')).toBeNull();
  });

  it('never mistakes "female" for containing "male"', () => {
    expect(detectVocalGender('soft warm female alto, gentle breathy delivery')).toBe('female');
  });
});

describe('[Part H] preallocateSongSlots carries vocalText for every channel', () => {
  it('a non-kids channel slot carries vocalText from opts.vocalTone', () => {
    const opts = makeOptions({ channel: showaCafe, vocalTone: 'warm-mature-male preset text: mature soft male tenor, restrained emotional tone' });
    const slots = preallocateSongSlots(opts, []);
    expect(slots.every(slot => slot.vocalText === opts.vocalTone)).toBe(true);
    expect(slots.every(slot => slot.vocalType === undefined)).toBe(true);
  });

  it('falls back to channel.defaultVocal when vocalTone is blank', () => {
    const opts = makeOptions({ channel: showaCafe, vocalTone: '' });
    const slots = preallocateSongSlots(opts, []);
    expect(slots.every(slot => slot.vocalText === showaCafe.defaultVocal)).toBe(true);
  });
});

describe('[Part H] enforceVocalTextInStylePrompt — deterministic correction', () => {
  it('corrects a wrong-gender stylePrompt to match the selected vocal (the real showa-cafe repro)', () => {
    const wrongGenderPrompt = 'showa-modern cafe mood, soft warm female alto, gentle breathy delivery, I-V-vi-IV progression';
    const selectedMale = 'mature soft male tenor, restrained emotional tone, warm close-mic delivery';
    const { text, changed } = enforceVocalTextInStylePrompt(wrongGenderPrompt, selectedMale);
    expect(changed).toBe(true);
    expect(detectVocalGender(text)).toBe('male');
    expect(text.toLowerCase()).not.toContain('female');
    expect(text).toContain(selectedMale);
  });

  it('injects the vocal when the stylePrompt has no gender at all', () => {
    const noGenderPrompt = 'showa-modern cafe mood, I-V-vi-IV progression, 96 BPM';
    const selectedMale = 'mature soft male tenor, restrained emotional tone';
    const { text, changed } = enforceVocalTextInStylePrompt(noGenderPrompt, selectedMale);
    expect(changed).toBe(true);
    expect(text).toContain(selectedMale);
  });

  it('is a no-op when the stylePrompt already matches', () => {
    const matching = 'showa-modern cafe mood, mature soft male tenor, restrained emotional tone, I-V-vi-IV progression';
    const { text, changed } = enforceVocalTextInStylePrompt(matching, 'mature soft male tenor, restrained emotional tone');
    expect(changed).toBe(false);
    expect(text).toBe(matching);
  });

  it('is a no-op when vocalText has no detectable gender (e.g. a kids choir)', () => {
    const prompt = 'bright kids pop, some other stuff';
    const { text, changed } = enforceVocalTextInStylePrompt(prompt, "children's choir singing together");
    expect(changed).toBe(false);
    expect(text).toBe(prompt);
  });
});

describe('[Part H] resolveVocalMetaTag / ensureVocalMetaTag', () => {
  it('resolves [male vocal] / [female vocal] / [children\'s choir] correctly', () => {
    expect(resolveVocalMetaTag(undefined, undefined, 'mature soft male tenor')).toBe('[male vocal]');
    expect(resolveVocalMetaTag(undefined, undefined, 'soft warm female alto')).toBe('[female vocal]');
    expect(resolveVocalMetaTag('mixed', undefined, undefined)).toBe("[children's choir]");
    expect(resolveVocalMetaTag('male', undefined, undefined)).toBe('[male vocal]');
  });

  it('[Part v3.41] resolves the explicit gender axis, including duet and adult mixed/group', () => {
    expect(resolveVocalMetaTag(undefined, 'duet', 'male and female duet, alternating verses')).toBe('[duet vocal]');
    expect(resolveVocalMetaTag(undefined, 'mixed', 'small mixed vocal group, close three-part harmony')).toBe('[group vocal]');
    expect(resolveVocalMetaTag(undefined, 'mixed', "children's choir singing in simple unison")).toBe("[children's choir]");
  });

  it('prepends the tag once and never double-tags', () => {
    const once = ensureVocalMetaTag('[verse 1]\nsome lyrics', '[male vocal]');
    expect(once).toBe('[male vocal]\n[verse 1]\nsome lyrics');
    const alreadyTagged = ensureVocalMetaTag('[male vocal]\n[verse 1]\nsome lyrics', '[male vocal]');
    expect(alreadyTagged).toBe('[male vocal]\n[verse 1]\nsome lyrics');
  });
});

describe('[Part H] reconcileWithPreassignedSlot enforces gender end-to-end (realtime/Batch/bridge choke point)', () => {
  it('corrects a female stylePrompt back to the channel\'s selected male vocal, and tags the lyrics', () => {
    const opts = makeOptions({ channel: showaCafe, vocalTone: showaCafe.defaultVocal });
    const [slot] = preallocateSongSlots(opts, []);
    const wrongSong = baseSong({ trackNo: slot.trackNo });
    const fixed = reconcileWithPreassignedSlot(wrongSong, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(detectVocalGender(fixed.stylePrompt)).toBe('male');
    expect(fixed.lyrics.startsWith('[male vocal]')).toBe(true);
  });

  it('is a no-op on an already-correct stylePrompt/lyrics pair', () => {
    const opts = makeOptions({ channel: showaCafe, vocalTone: showaCafe.defaultVocal });
    const [slot] = preallocateSongSlots(opts, []);
    // TASK v3.43 Part A1/A2, Step 2 Part A3 — reconcileWithPreassignedSlot
    // now also verbatim-enforces moneyChordText/hookDeviceText/instrumentSet/
    // arrangementDensity/tempo (previously only vocalText was checked), so a
    // true "already correct" fixture must include all of them verbatim, not
    // just the bare progression tag, for this to stay a real no-op.
    const correctSong = baseSong({
      trackNo: slot.trackNo,
      stylePrompt: `showa-modern cafe mood, ${showaCafe.defaultVocal}, ${slot.moneyChordText}, ${slot.hookDeviceText}, ${(slot.instrumentSet ?? []).join(', ')}, ${ARRANGEMENT_DENSITY_TEXT_BY_LEVEL[slot.arrangementDensity!]}, ${slot.tempo} BPM`,
      lyrics: '[male vocal]\nHold On\nsome lyrics\nHold On'
    });
    const result = reconcileWithPreassignedSlot(correctSong, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(result.stylePrompt).toBe(correctSong.stylePrompt);
    expect(result.lyrics).toBe(correctSong.lyrics);
  });
});

describe('[Part H] quality gate warns on a gender mismatch', () => {
  it('scoreSong pushes a warning when stylePrompt gender contradicts the channel default', () => {
    const song = baseSong();
    const scored = scoreSong(song, showaCafe, 'english');
    expect(scored.warnings.some(w => w.toLowerCase().includes('vocal gender'))).toBe(true);
  });

  it('scoreSong does not warn when the stylePrompt already matches', () => {
    const song = baseSong({ stylePrompt: `showa-modern cafe mood, ${showaCafe.defaultVocal}, I-V-vi-IV progression` });
    const scored = scoreSong(song, showaCafe, 'english');
    expect(scored.warnings.some(w => w.toLowerCase().includes('vocal gender'))).toBe(false);
  });
});

describe('[Part G] kids channel defaults to english lyrics', () => {
  it('the little-singalong-radio preset\'s primaryLanguage is english, not korean', () => {
    const kidsChannel = channelPresets.find(c => c.archetype === 'kids')!;
    expect(kidsChannel.primaryLanguage).toBe('english');
  });
});

describe('[Part D] kid vocal presets are registered and mutually distinct', () => {
  it('kid-boy/kid-girl/kid-choir exist and are flagged forKids', () => {
    for (const id of ['kid-boy', 'kid-girl', 'kid-choir']) {
      const preset = vocalPresets.find(p => p.id === id);
      expect(preset, id).toBeDefined();
      expect(preset!.forKids).toBe(true);
      expect(preset!.prompt.toLowerCase()).not.toContain('adult');
    }
  });

  it('[Part v3.41 C] exactly 10 presets are flagged forKids', () => {
    expect(vocalPresets.filter(p => p.forKids).length).toBe(10);
  });

  it('[Part v3.41 B] exactly 16 presets are not flagged forKids', () => {
    expect(vocalPresets.filter(p => !p.forKids).length).toBe(16);
  });
});
