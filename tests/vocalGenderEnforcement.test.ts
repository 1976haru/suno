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
    // v5.11 (TASK L) — genuine defaults for the new always-populated fields.
    effectiveMoneyChordId: 'default',
    effectiveGenreIds: [],
    effectiveArchetype: 'senior-morning',
    workspaceId: 'senior-oldpop',
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
  // v3.77 (TASK A) — was "carries vocalText from opts.vocalTone" verbatim on
  // every slot, with usesVocalQuota() OFF (vocalType always undefined) —
  // that verbatim-copy-to-every-song behavior is the real bug this task
  // fixes (see vocalPlan.ts's leaningGenderFor doc comment: an 18-song real
  // pack came back byte-identical on every track). The auto quota now
  // always runs; a picked vocalTone LEANS the mix toward its detected
  // gender instead of replacing per-song variety with one fixed string.
  it('a non-kids channel leans vocalText toward the picked vocalTone\'s gender, but keeps per-song variety instead of one fixed string', () => {
    const opts = makeOptions({ channel: showaCafe, vocalTone: 'warm-mature-male preset text: mature soft male tenor, restrained emotional tone', songCount: 12 });
    const slots = preallocateSongSlots(opts, []);
    expect(slots.every(slot => slot.vocalType !== undefined)).toBe(true);
    expect(new Set(slots.map(slot => slot.vocalText)).size).toBeGreaterThan(1);
    const maleCount = slots.filter(slot => slot.vocalType === 'male').length;
    expect(maleCount).toBeGreaterThan(slots.length / 2);
    // Leaning male must not zero out the other genders (this task's own
    // "최소 각 3곡" — scaled here for a 12-song pack, min 2 per leaningAdultVocalQuota).
    expect(slots.some(slot => slot.vocalType === 'female')).toBe(true);
    expect(slots.some(slot => slot.vocalType === 'mixed')).toBe(true);
  });

  // TASK v3.72 (TASK A) — real regression: a blank/untouched vocalTone
  // (App.tsx initializes it to channel.defaultVocal on channel select, so
  // "blank" and "still equal to defaultVocal" are the same real-world case)
  // used to fall through to usesVocalQuota()===false and give every song the
  // exact same defaultVocal string — the actual bug a real 18-song pack
  // measured (male 18 / female 0 / duet 0, byte-identical). The auto quota
  // now engages here instead, so vocalText varies per song.
  it('applies the auto male/female/duet quota (varied vocalText) when vocalTone is blank, instead of one fixed defaultVocal string for every song', () => {
    const opts = makeOptions({ channel: showaCafe, vocalTone: '', songCount: 18 });
    const slots = preallocateSongSlots(opts, []);
    expect(slots.every(slot => slot.vocalType !== undefined)).toBe(true);
    expect(new Set(slots.map(slot => slot.vocalText)).size).toBeGreaterThan(1);
    expect(slots.some(slot => slot.vocalText === showaCafe.defaultVocal)).toBe(false);
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
  // TASK D2 §6-3 (user decision) — the automatic kids 'mixed' vocalType now tags as [mixed vocal], not [children's choir].
  it('resolves [male vocal] / [female vocal] / [mixed vocal] correctly', () => {
    expect(resolveVocalMetaTag(undefined, undefined, 'mature soft male tenor')).toBe('[male vocal]');
    expect(resolveVocalMetaTag(undefined, undefined, 'soft warm female alto')).toBe('[female vocal]');
    expect(resolveVocalMetaTag('mixed', undefined, undefined)).toBe('[mixed vocal]');
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

  // TASK (vocalPlan gap fix) — ensureVocalMetaTag used to only check "is ANY
  // vocal meta tag present", never that it MATCHES `tag`; a wrong tag from a
  // provider response survived untouched (tests/providerResponseFixtures.test.ts's
  // wrongVocalMetaTag.json fixture). Fixed: a present-but-wrong tag is now
  // REPLACED with the correct one, in place, preserving everything after it.
  it('replaces an existing WRONG vocal meta tag with the correct one, across male/female/mixed/duet/group/choir', () => {
    expect(ensureVocalMetaTag('[female vocal]\n[verse 1]\nsome lyrics', '[male vocal]'))
      .toBe('[male vocal]\n[verse 1]\nsome lyrics');
    expect(ensureVocalMetaTag('[male vocal]\n[verse 1]\nsome lyrics', '[female vocal]'))
      .toBe('[female vocal]\n[verse 1]\nsome lyrics');
    expect(ensureVocalMetaTag('[female vocal]\n[verse 1]\nsome lyrics', '[mixed vocal]'))
      .toBe('[mixed vocal]\n[verse 1]\nsome lyrics');
    expect(ensureVocalMetaTag('[male vocal]\n[verse 1]\nsome lyrics', '[duet vocal]'))
      .toBe('[duet vocal]\n[verse 1]\nsome lyrics');
    expect(ensureVocalMetaTag('[group vocal]\n[verse 1]\nsome lyrics', "[children's choir]"))
      .toBe("[children's choir]\n[verse 1]\nsome lyrics");
    // Case-insensitive match on the existing tag, but the replacement is
    // always emitted verbatim as `tag`.
    expect(ensureVocalMetaTag('[FEMALE VOCAL]\n[verse 1]\nsome lyrics', '[male vocal]'))
      .toBe('[male vocal]\n[verse 1]\nsome lyrics');
  });

  it('does not disturb per-section duet retagging — only the single top-of-lyrics tag is checked/replaced', () => {
    // applyDuetSectionVocalTags runs BEFORE ensureVocalMetaTag at every real
    // call site (batchPreallocation.ts/localGenerator.ts) and only rewrites
    // section tags like "[verse 1]" -> "[verse 1: male vocal]" further down
    // in the lyrics body — those never match VOCAL_META_TAG_PATTERN, so a
    // wrong top-level tag is still replaced independent of them.
    const afterDuetSectionRetag =
      '[female vocal]\n[verse 1: male vocal]\nline one\n\n[chorus: male and female duet]\nline two\n\n[verse 2: female vocal]\nline three';
    const fixed = ensureVocalMetaTag(afterDuetSectionRetag, '[duet vocal]');
    expect(fixed).toBe(
      '[duet vocal]\n[verse 1: male vocal]\nline one\n\n[chorus: male and female duet]\nline two\n\n[verse 2: female vocal]\nline three'
    );
  });
});

describe('[Part H] reconcileWithPreassignedSlot enforces gender end-to-end (realtime/Batch/bridge choke point)', () => {
  // TASK v3.72 (TASK A) — vocalTone here must be an explicit preset text
  // DIFFERENT from showaCafe.defaultVocal, not equal to it: usesVocalQuota
  // now treats "vocalTone === channel.defaultVocal" as untouched/default and
  // engages the auto male/female/duet quota there (the real regression this
  // task fixes), which would make `slot` not deterministically male anymore.
  // A distinct explicit single-preset pick (low-calm-male) keeps this test's
  // "user selected one specific male vocal for the whole pack" scenario.
  const explicitMalePreset = vocalPresets.find(p => p.id === 'low-calm-male')!.prompt;

  it('corrects a female stylePrompt back to the channel\'s selected male vocal, and tags the lyrics', () => {
    // v3.77 (TASK A) — vocalTone alone only LEANS the quota now (see
    // vocalPlan.ts's leaningGenderFor); an explicit opts.vocalQuota override
    // is the deterministic tool for "this one slot must be male" that this
    // test actually needs (opts.vocalQuota always wins outright over a
    // vocalTone-derived lean — see batchPreallocation.ts's own wiring).
    const opts = makeOptions({ channel: showaCafe, vocalTone: explicitMalePreset, vocalQuota: { male: 1, female: 0, mixed: 0 } });
    const [slot] = preallocateSongSlots(opts, []);
    const wrongSong = baseSong({ trackNo: slot.trackNo });
    const fixed = reconcileWithPreassignedSlot(wrongSong, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(detectVocalGender(fixed.stylePrompt)).toBe('male');
    expect(fixed.lyrics.startsWith('[male vocal]')).toBe(true);
  });

  it('is a no-op on an already-correct stylePrompt/lyrics pair', () => {
    const opts = makeOptions({ channel: showaCafe, vocalTone: explicitMalePreset });
    const [slot] = preallocateSongSlots(opts, []);
    // TASK v3.43 Part A1/A2, Step 2 Part A3 — reconcileWithPreassignedSlot
    // now also verbatim-enforces moneyChordText/hookDeviceText/instrumentSet/
    // arrangementDensity/tempo (previously only vocalText was checked), so a
    // true "already correct" fixture must include all of them verbatim, not
    // just the bare progression tag, for this to stay a real no-op.
    const correctPrompt = [
      'showa-modern cafe mood',
      slot.vocalText,
      slot.moneyChordText,
      slot.hookDeviceText,
      ...(slot.instrumentSet ?? []),
      ARRANGEMENT_DENSITY_TEXT_BY_LEVEL[slot.arrangementDensity!],
      slot.introTextureText,
      `${slot.tempo} BPM`
    ].filter(Boolean).join(', ');
    const correctSong = baseSong({
      trackNo: slot.trackNo,
      stylePrompt: correctPrompt,
      lyrics: '[male vocal]\nHold On\nsome lyrics\nHold On'
    });
    const result = reconcileWithPreassignedSlot(correctSong, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(result.stylePrompt).toBe(correctSong.stylePrompt);
    expect(result.lyrics).toBe(correctSong.lyrics);
  });
});

describe('[v3.70 TASK A] reconcileWithPreassignedSlot applies per-section duet vocal tags (realtime/Batch/bridge choke point)', () => {
  it('tags a duet-selected slot\'s verse/chorus/bridge lines even though the imported song never included them itself', () => {
    const duetPreset = vocalPresets.find(p => p.id === 'male-female-duet')!;
    // v3.77 — vocalTone alone only leans the quota now; an explicit
    // opts.vocalQuota override deterministically guarantees this slot is a
    // duet (see the "does not add any duet section tags" test below for
    // the equivalent non-duet-guarantee case).
    const opts = makeOptions({ channel: showaCafe, vocalTone: duetPreset.prompt, vocalQuota: { male: 0, female: 0, mixed: 1 } });
    const [slot] = preallocateSongSlots(opts, []);
    expect(slot.vocalGender).toBe('duet');
    const untaggedDuetLyrics = [
      '[short intro]', '', '[verse 1]', 'a line', '', '[chorus]', 'Hold On', '',
      '[verse 2]', 'b line', '', '[chorus]', 'Hold On', '', '[short bridge]', 'c line', '',
      '[final chorus]', 'Hold On'
    ].join('\n');
    const song = baseSong({ trackNo: slot.trackNo, stylePrompt: duetPreset.prompt, lyrics: untaggedDuetLyrics });
    const fixed = reconcileWithPreassignedSlot(song, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.lyrics).toContain('[verse 1: male vocal]');
    expect(fixed.lyrics).toContain('[verse 2: female vocal]');
    expect(fixed.lyrics).toContain('[chorus: male and female duet]');
    expect(fixed.lyrics).toContain('[short bridge: male and female call and response]');
    expect(fixed.lyrics).toContain('[final chorus: male and female duet harmony]');
  });

  it('does not add any duet section tags for a non-duet slot', () => {
    // v3.77 — vocalTone alone only leans the quota (see leaningGenderFor);
    // an explicit opts.vocalQuota override is what deterministically
    // guarantees "this slot is not a duet" now.
    const opts = makeOptions({ channel: showaCafe, vocalTone: vocalPresets.find(p => p.id === 'low-calm-male')!.prompt, vocalQuota: { male: 1, female: 0, mixed: 0 } });
    const [slot] = preallocateSongSlots(opts, []);
    expect(slot.vocalGender).not.toBe('duet');
    const lyrics = '[verse 1]\na line\n\n[chorus]\nHold On';
    const song = baseSong({ trackNo: slot.trackNo, lyrics });
    const fixed = reconcileWithPreassignedSlot(song, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.lyrics).not.toContain('[verse 1: male vocal]');
    expect(fixed.lyrics).not.toContain('[chorus: male and female duet]');
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

// v5.9 (quota/tone separation) — before this fix, opts.channel.vocalQuotaOverride
// unconditionally forced vocalLeaning to undefined (correct — the fixed quota
// IS the point of these channels), but explicitUnrecognizedVocalTone's old
// condition also checked `!vocalLeaning`, which meant it could never tell a
// genuinely unrecognized custom string apart from a perfectly valid,
// recognized preset on exactly these channels — both looked identical
// ("vocalLeaning is unset"). A recognized preset was therefore silently
// discarded back to the channel's generic defaultVocal on every song.
describe('[v5.9] a K-pop fixed-quota channel (vocalQuotaOverride) keeps its exact gender split and reflects a recognized tone preset', () => {
  const idolFemaleChannel = channelPresets.find(c => c.archetype === 'kr-idol-female')!;
  const huskyJazzFemale = vocalPresets.find(p => p.id === 'husky-jazz-female')!;

  it('preserves the channel\'s exact fixed 15/female-0-male/3-mixed-style split regardless of the picked tone', () => {
    const opts = makeOptions({ channel: idolFemaleChannel, songCount: 18, vocalTone: huskyJazzFemale.prompt });
    const slots = preallocateSongSlots(opts, []);
    const counts = { male: 0, female: 0, mixed: 0 };
    for (const slot of slots) counts[slot.vocalType!] += 1;
    expect(counts).toEqual(idolFemaleChannel.vocalQuotaOverride);
  });

  it('no longer collapses every song\'s vocalText to the generic channel default (the real bug: explicitUnrecognizedVocalTone misfired here)', () => {
    const opts = makeOptions({ channel: idolFemaleChannel, songCount: 18, vocalTone: huskyJazzFemale.prompt });
    const slots = preallocateSongSlots(opts, []);
    expect(slots.every(slot => slot.vocalText !== idolFemaleChannel.defaultVocal)).toBe(true);
    // Real per-song composed wording (buildAdultVocalTraitPlan), not one
    // fixed string repeated 18 times.
    expect(new Set(slots.map(slot => slot.vocalText)).size).toBeGreaterThan(1);
  });

  it('a genuinely unrecognized free-text vocalTone (no preset match, no detectable gender word) still correctly falls back to the channel default — explicitUnrecognizedVocalTone is not simply disabled', () => {
    const opts = makeOptions({ channel: idolFemaleChannel, songCount: 6, vocalTone: 'asdkjhqwe some gibberish xyz text' });
    const slots = preallocateSongSlots(opts, []);
    expect(slots.every(slot => slot.vocalText === idolFemaleChannel.defaultVocal)).toBe(true);
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
