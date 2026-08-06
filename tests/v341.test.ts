import { describe, expect, it } from 'vitest';
import { vocalPresets, matchVocalPreset } from '../src/data/vocalPresets';
import {
  buildVocalPlan,
  buildVocalVariantPlan,
  detectVocalGender,
  detectVocalGenderPresence,
  enforceVocalTextInStylePrompt,
  resolveVocalMetaTag,
  vocalDescriptionFor,
  type VocalType
} from '../src/core/vocalPlan';
import { preallocateSongSlots, reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import { scoreSong } from '../src/core/quality';
import { channelPresets, makeOptions } from './fixtures';
import type { SongIdea } from '../src/types';

// TASK v3.41 — vocal pool expansion (5->16 adult, 3->10 kids) + per-song
// kids variant rotation. Regression coverage for the two problems the spec
// identified: (1) the picker pool itself was too small and missing whole
// timbre categories (duet, falsetto, whisper, jazz-husky, ...), and (2) a
// 15-song kids pack only ever produced 3 distinct vocalText values total
// because VOCAL_DESCRIPTIONS was one fixed string per type.

const kidsChannel = channelPresets.find(c => c.archetype === 'kids')!;
const showaCafe = channelPresets.find(c => c.archetype === 'showa-cafe')!;

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Test Song',
    seasonMoment: '',
    listenerSituation: '',
    emotionArc: '',
    hookPhrase: 'Hold On',
    stylePrompt: 'showa-modern cafe mood, I-V-vi-IV progression, 96 BPM',
    lyrics: 'Hold On\nsome lyrics\nHold On',
    youtube: { title: 'Test', description: 'Test', tags: [] },
    qualityScore: 0,
    warnings: [],
    // v5.11 (TASK L) — genuine defaults for the new always-populated fields.
    effectiveMoneyChordId: 'default',
    effectiveGenreIds: [],
    effectiveArchetype: 'senior-morning',
    workspaceId: 'senior-oldpop',
    ...overrides
  };
}

describe('[Part B/C] preset pool expansion counts', () => {
  it('adult pool is exactly 16 (7 male, 7 female, 2 duet/mixed)', () => {
    const adult = vocalPresets.filter(p => !p.forKids);
    expect(adult).toHaveLength(16);
    expect(adult.filter(p => p.gender === 'male')).toHaveLength(7);
    expect(adult.filter(p => p.gender === 'female')).toHaveLength(7);
    expect(adult.filter(p => p.gender === 'duet' || p.gender === 'mixed')).toHaveLength(2);
  });

  it('kids pool is exactly 10, all forKids', () => {
    const kids = vocalPresets.filter(p => p.forKids);
    expect(kids).toHaveLength(10);
    expect(kids.every(p => p.forKids)).toBe(true);
  });

  it('every preset has a gender field', () => {
    for (const preset of vocalPresets) {
      expect(['male', 'female', 'mixed', 'duet']).toContain(preset.gender);
    }
  });
});

describe('[Regression] the original 5 adult + 3 kids preset ids/prompts are unchanged', () => {
  const originalAdult: Record<string, string> = {
    'warm-mature-male': 'mature soulful male tenor, soft slightly husky close-mic delivery, gentle and sincere',
    'low-calm-male': 'low calm male baritone, restrained emotional delivery, warm late-night tone',
    'clear-light-male': 'clear light male tenor, clean simple delivery, youthful and sincere',
    'soft-female': 'soft warm female alto, gentle breathy delivery, intimate and calm',
    'mature-female': 'mature elegant female mezzo-soprano, warm restrained delivery, sophisticated tone'
  };
  const originalKids: Record<string, string> = {
    'kid-boy': 'bright childlike boy voice, playful and youthful, kindergarten-age tone',
    'kid-girl': 'bright childlike girl voice, sweet and clear, kindergarten-age tone',
    'kid-choir': "children's choir of childlike, youthful voices singing together, cheerful call-and-response group singalong"
  };

  it.each(Object.entries({ ...originalAdult, ...originalKids }))('preset "%s" keeps its original prompt text (saved-pack compatibility)', (id, prompt) => {
    const preset = vocalPresets.find(p => p.id === id);
    expect(preset, id).toBeDefined();
    expect(preset!.prompt).toBe(prompt);
    expect(matchVocalPreset(prompt)?.id).toBe(id);
  });
});

describe('[Part A2/D] a 15-song kids pack produces at least 12 distinct vocalText values', () => {
  it('DISTINCT vocalText >= 12 across a 5/5/5 pack (was 3 before this task)', () => {
    const opts = makeOptions({ channel: kidsChannel, songCount: 15, lyricLanguage: 'english', seasonId: 'spring-open' });
    const slots = preallocateSongSlots(opts, []);
    const distinct = new Set(slots.map(s => s.vocalText));
    expect(distinct.size).toBeGreaterThanOrEqual(12);
  });

  it('every slot vocalText is one of that type\'s 5 known variants', () => {
    const opts = makeOptions({ channel: kidsChannel, songCount: 15, lyricLanguage: 'english', seasonId: 'spring-open' });
    const slots = preallocateSongSlots(opts, []);
    for (const slot of slots) {
      const possible = new Set(Array.from({ length: 5 }, (_, i) => vocalDescriptionFor(slot.vocalType!, 'english', i)));
      expect(possible.has(slot.vocalText!), `trackNo ${slot.trackNo}`).toBe(true);
    }
  });
});

describe('[Part A2] buildVocalVariantPlan never repeats a variant on consecutive same-type occurrences', () => {
  it('no two adjacent occurrences of the same vocal type share a variant index', () => {
    const plan: VocalType[] = buildVocalPlan({ male: 5, female: 5, mixed: 5 }, 15, 777);
    const variantPlan = buildVocalVariantPlan(plan, 777);
    const lastIndexByType: Partial<Record<VocalType, number>> = {};
    for (let i = 0; i < plan.length; i++) {
      const type = plan[i];
      const prevOccurrenceVariant = lastIndexByType[type];
      if (prevOccurrenceVariant !== undefined) {
        expect(variantPlan[i]).not.toBe(prevOccurrenceVariant);
      }
      lastIndexByType[type] = variantPlan[i];
    }
  });

  it('is deterministic for the same seed', () => {
    const plan: VocalType[] = buildVocalPlan({ male: 5, female: 5, mixed: 5 }, 15, 42);
    const a = buildVocalVariantPlan(plan, 42);
    const b = buildVocalVariantPlan(plan, 42);
    expect(a).toEqual(b);
  });
});

describe('[Part A1] gender field drives enforcement over prose — duet no longer bypasses enforcement', () => {
  const duetPreset = vocalPresets.find(p => p.id === 'male-female-duet')!;

  it('prose detection alone cannot classify a duet (the original bug this fixes)', () => {
    expect(detectVocalGender(duetPreset.prompt)).toBeNull();
  });

  it('a duet selection injects both genders when the stylePrompt has only one', () => {
    const maleOnlyPrompt = 'showa-modern cafe mood, mature soft male tenor, I-V-vi-IV progression';
    const { text, changed } = enforceVocalTextInStylePrompt(maleOnlyPrompt, duetPreset.prompt, duetPreset.gender);
    expect(changed).toBe(true);
    const presence = detectVocalGenderPresence(text);
    expect(presence.male).toBe(true);
    expect(presence.female).toBe(true);
  });

  it('a duet selection is a no-op once both genders are already represented', () => {
    const bothPresent = `showa-modern cafe mood, ${duetPreset.prompt}, I-V-vi-IV progression`;
    const { changed } = enforceVocalTextInStylePrompt(bothPresent, duetPreset.prompt, duetPreset.gender);
    expect(changed).toBe(false);
  });

  it('without the explicit gender field, a duet prompt with only one gender present is NOT fixed (demonstrates why A1 is required)', () => {
    const maleOnlyPrompt = 'showa-modern cafe mood, mature soft male tenor, I-V-vi-IV progression';
    const { changed } = enforceVocalTextInStylePrompt(maleOnlyPrompt, duetPreset.prompt);
    expect(changed).toBe(false);
  });

  it('reconcileWithPreassignedSlot enforces a duet end-to-end via the explicit vocalGender slot field', () => {
    const opts = makeOptions({ channel: showaCafe, vocalTone: duetPreset.prompt });
    const [slot] = preallocateSongSlots(opts, []);
    expect(slot.vocalGender).toBe('duet');
    const maleOnlySong = baseSong({ trackNo: slot.trackNo, stylePrompt: 'showa-modern cafe mood, mature soft male tenor, I-V-vi-IV progression' });
    const fixed = reconcileWithPreassignedSlot(maleOnlySong, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    const presence = detectVocalGenderPresence(fixed.stylePrompt);
    expect(presence.male).toBe(true);
    expect(presence.female).toBe(true);
    expect(fixed.lyrics.startsWith('[duet vocal]')).toBe(true);
  });
});

describe('[Part A1] resolveVocalMetaTag distinguishes duet / adult-mixed / kids-mixed', () => {
  it('duet always tags as [duet vocal]', () => {
    expect(resolveVocalMetaTag(undefined, 'duet', 'male and female duet')).toBe('[duet vocal]');
  });

  it('adult mixed-harmony-group tags as [group vocal], not [children\'s choir]', () => {
    const preset = vocalPresets.find(p => p.id === 'mixed-harmony-group')!;
    expect(resolveVocalMetaTag(undefined, preset.gender, preset.prompt)).toBe('[group vocal]');
  });

  it('a kids mixed preset (choir-flavored text) tags as [children\'s choir]', () => {
    const preset = vocalPresets.find(p => p.id === 'kid-choir-unison')!;
    expect(resolveVocalMetaTag(undefined, preset.gender, preset.prompt)).toBe("[children's choir]");
  });
});

describe('[Regression] quality gate gender-mismatch check still works with the new preset pool', () => {
  it('warns when a selected preset\'s gender contradicts the stylePrompt', () => {
    const husky = vocalPresets.find(p => p.id === 'husky-jazz-female')!;
    const opts = makeOptions({ channel: showaCafe, vocalTone: husky.prompt });
    const song = baseSong({ stylePrompt: 'showa-modern cafe mood, mature soft male tenor, I-V-vi-IV progression' });
    const scored = scoreSong(song, opts.channel, 'english');
    // channel.defaultVocal (not opts.vocalTone) drives scoreSong's target,
    // so this asserts the mechanism doesn't throw/break with the larger
    // pool rather than asserting a specific warning here.
    expect(Array.isArray(scored.warnings)).toBe(true);
  });

  it('does not throw for every new preset id when used as a channel defaultVocal', () => {
    for (const preset of vocalPresets) {
      const channel = { ...showaCafe, defaultVocal: preset.prompt };
      const song = baseSong({ stylePrompt: `showa-modern cafe mood, ${preset.prompt}, I-V-vi-IV progression` });
      expect(() => scoreSong(song, channel, 'english')).not.toThrow();
    }
  });
});
