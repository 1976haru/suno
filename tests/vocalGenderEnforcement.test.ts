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

// v5.15 (vocal meta-tag audit follow-up) — a fresh third-party audit
// independently re-flagged "wrong vocal meta-tag isn't corrected" as a live
// P0 with 8 required combinations, proposing a brand-new `reconcileVocalMetaTag`
// function. Investigation found the EXISTING ensureVocalMetaTag (already
// fixed by an earlier v5.14 follow-up, tested just above) already covers 6 of
// the 8 for real; this suite is the real, function-level verification for
// all 8 — 2 combinations (kids manual choir-preset resolution, the "두 개"
// stray-second-tag case, and whitespace-variant tolerance) turned out to be
// genuine gaps, hardened directly in ensureVocalMetaTag/resolveVocalMetaTag/
// VOCAL_META_TAG_PATTERN above rather than building a second, parallel
// mechanism.
describe('[v5.15 audit] the 8 required combinations, verified with real functions/data', () => {
  const kidsChannel = channelPresets.find(c => c.archetype === 'kids')!;
  const explicitMalePreset = vocalPresets.find(p => p.id === 'low-calm-male')!.prompt;
  const explicitFemalePreset = vocalPresets.find(p => p.id === 'husky-jazz-female')!.prompt;
  const explicitDuetPreset = vocalPresets.find(p => p.id === 'male-female-duet')!.prompt;
  const kidChoirPreset = vocalPresets.find(p => p.id === 'kid-choir')!;

  // 1. 남성 슬롯 + [female vocal] -> male tag.
  it('1) a male slot with a wrong [female vocal] tag reconciles to [male vocal]', () => {
    const opts = makeOptions({ channel: showaCafe, vocalTone: explicitMalePreset, vocalQuota: { male: 1, female: 0, mixed: 0 } });
    const [slot] = preallocateSongSlots(opts, []);
    const song = baseSong({ trackNo: slot.trackNo, lyrics: '[female vocal]\n[verse 1]\nsome lyrics' });
    const fixed = reconcileWithPreassignedSlot(song, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.lyrics.startsWith('[male vocal]')).toBe(true);
  });

  // 2. 여성 슬롯 + [male vocal] -> female tag.
  it('2) a female slot with a wrong [male vocal] tag reconciles to [female vocal]', () => {
    const opts = makeOptions({ channel: showaCafe, vocalTone: explicitFemalePreset, vocalQuota: { male: 0, female: 1, mixed: 0 } });
    const [slot] = preallocateSongSlots(opts, []);
    const song = baseSong({ trackNo: slot.trackNo, lyrics: '[male vocal]\n[verse 1]\nsome lyrics' });
    const fixed = reconcileWithPreassignedSlot(song, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.lyrics.startsWith('[female vocal]')).toBe(true);
  });

  // 3. 혼성 슬롯 + [male vocal] -> mixed/duet tag. A non-kids 'mixed'
  // vocalType always maps to gender 'duet' (batchPreallocation.ts's own
  // vocalGender derivation), so the correct tag here is "[duet vocal]", not
  // "[mixed vocal]" — this is what resolveVocalMetaTag's own v3.77 fix
  // guarantees.
  it('3) a mixed/duet slot with a wrong [male vocal] tag reconciles to [duet vocal]', () => {
    const opts = makeOptions({ channel: showaCafe, vocalTone: explicitDuetPreset, vocalQuota: { male: 0, female: 0, mixed: 1 } });
    const [slot] = preallocateSongSlots(opts, []);
    expect(slot.vocalGender).toBe('duet');
    const song = baseSong({ trackNo: slot.trackNo, lyrics: '[male vocal]\n[verse 1]\nsome lyrics' });
    const fixed = reconcileWithPreassignedSlot(song, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.lyrics.startsWith('[duet vocal]')).toBe(true);
  });

  // 4. 동요 남아(kids boy) + 성인 [male vocal] -> PASS, not a gap: the
  // top-level meta-tag vocabulary (VOCAL_META_TAG_PATTERN) only ever encodes
  // gender/duet/mixed/choir, never a kids-vs-adult axis — there is no
  // separate "boy vocal" tag to reconcile to. A kids-boy slot's CORRECT tag
  // genuinely is the same "[male vocal]" an adult male slot gets; the
  // kids-appropriateness lives entirely in vocalText prose (kidsVocalTextFor),
  // not in this tag. Verifies that's really a no-op, not silently wrong.
  it('4) a kids-boy slot already carrying "[male vocal]" (adult-worded survivor) stays [male vocal] — no separate kids tag exists', () => {
    const opts = makeOptions({ channel: kidsChannel, vocalQuota: { male: 1, female: 0, mixed: 0 } });
    const [slot] = preallocateSongSlots(opts, []);
    expect(slot.vocalType).toBe('male');
    expect(resolveVocalMetaTag(slot.vocalType, slot.vocalGender, slot.vocalText)).toBe('[male vocal]');
    const song = baseSong({ trackNo: slot.trackNo, lyrics: '[male vocal]\n[verse 1]\nsome lyrics' });
    const fixed = reconcileWithPreassignedSlot(song, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.lyrics.startsWith('[male vocal]')).toBe(true);
  });

  // 5. 동요 여아(kids girl) + [children's choir] -> a REAL gap, in two parts.
  it("5a) a kids-girl slot with a wrong [children's choir] tag reconciles to [female vocal] (choir is wrong for a specific girl slot)", () => {
    const opts = makeOptions({ channel: kidsChannel, vocalQuota: { male: 0, female: 1, mixed: 0 } });
    const [slot] = preallocateSongSlots(opts, []);
    expect(slot.vocalType).toBe('female');
    const song = baseSong({ trackNo: slot.trackNo, lyrics: "[children's choir]\n[verse 1]\nsome lyrics" });
    const fixed = reconcileWithPreassignedSlot(song, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.lyrics.startsWith('[female vocal]')).toBe(true);
  });

  it("5b) FIXED — a kids channel's manually-picked kid-choir preset now really resolves to [children's choir] (was a dead branch: vocalType==='mixed' always short-circuited to '[mixed vocal]' before the vocalText choir check could ever run)", () => {
    const opts = makeOptions({ channel: kidsChannel, vocalTone: kidChoirPreset.prompt, vocalQuota: { male: 0, female: 0, mixed: 1 } });
    const [slot] = preallocateSongSlots(opts, []);
    expect(slot.vocalType).toBe('mixed');
    expect(slot.vocalText).toContain('choir');
    // Real before/after: resolveVocalMetaTag's own output for this exact
    // real slot.
    expect(resolveVocalMetaTag(slot.vocalType, slot.vocalGender, slot.vocalText)).toBe("[children's choir]");
    const song = baseSong({ trackNo: slot.trackNo, lyrics: '[mixed vocal]\n[verse 1]\nsome lyrics' });
    const fixed = reconcileWithPreassignedSlot(song, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.lyrics.startsWith("[children's choir]")).toBe(true);
  });

  // 지시문 63 (TASK B) — 자동(명시적 vocalTone 프리셋 미선택) 'mixed' 슬롯은
  // 이제 forKids 프리셋 10종 중 이 나이대의 mixed 후보(kid-choir 계열 포함)를
  // 실제로 회전 배정한다(core/kidsVocalPresetPlan.ts) — "자동 기본값은 절대
  // choir라는 단어를 쓰지 않는다"는 예전 가정 자체가 이 지시문이 바꾸는
  // 대상이다(§B-1). 대신 검증하는 것: resolveVocalMetaTag가 실제 배정된
  // vocalText 내용과 항상 일치하는 태그를 낸다 — choir 문구가 배정됐으면
  // "[children's choir]", 아니면 "[mixed vocal]" (TASK D2 §6-3의 "자동
  // 기본값=아동 합창 프레이밍 아님"이라는 대전제는 명시적 vocalTone
  // 미선택 상태에서도 여전히 유효 — 이 슬롯도 vocalTone은 미선택이다).
  it("5c) the AUTOMATIC kids 'mixed' quota slot (no explicit vocalTone preset) tags consistently with whichever forKids preset the auto-rotation actually assigned", () => {
    const opts = makeOptions({ channel: kidsChannel, vocalQuota: { male: 0, female: 0, mixed: 1 } });
    const [slot] = preallocateSongSlots(opts, []);
    expect(slot.vocalType).toBe('mixed');
    const expectedTag = slot.vocalText && /\bchoir\b/i.test(slot.vocalText) ? "[children's choir]" : '[mixed vocal]';
    expect(resolveVocalMetaTag(slot.vocalType, slot.vocalGender, slot.vocalText)).toBe(expectedTag);
  });

  // 6. 태그 없음 -> tag gets inserted.
  it('6) no pre-existing tag: the correct tag is prepended', () => {
    const opts = makeOptions({ channel: showaCafe, vocalTone: explicitMalePreset, vocalQuota: { male: 1, female: 0, mixed: 0 } });
    const [slot] = preallocateSongSlots(opts, []);
    const song = baseSong({ trackNo: slot.trackNo, lyrics: '[verse 1]\nsome lyrics' });
    const fixed = reconcileWithPreassignedSlot(song, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.lyrics).toBe('[male vocal]\n[verse 1]\nsome lyrics');
  });

  // 7. 태그가 두 개 (malformed/adversarial: two bare meta tags) -> FIXED. Old
  // VOCAL_META_TAG_PATTERN had no g/m flag and was anchored to the very
  // start of the string, so it only ever saw/replaced the first occurrence,
  // silently leaving a stray wrong second tag further down. Confirmed with a
  // real probe before the fix: ensureVocalMetaTag('[male vocal]\n[verse
  // 1]\nfoo\n\n[female vocal]\n[chorus]\nbar', '[duet vocal]') used to return
  // '[duet vocal]\n[verse 1]\nfoo\n\n[female vocal]\n[chorus]\nbar' — the
  // stray "[female vocal]" survived untouched.
  it('7) FIXED — a stray second bare vocal meta tag deeper in the lyrics is stripped, not left behind', () => {
    const lyrics = '[male vocal]\n[verse 1]\nfoo\n\n[female vocal]\n[chorus]\nbar';
    const fixed = ensureVocalMetaTag(lyrics, '[duet vocal]');
    expect(fixed).toBe('[duet vocal]\n[verse 1]\nfoo\n\n[chorus]\nbar');
    expect(fixed).not.toContain('[female vocal]');
    // Real per-section duet tags must never be caught by the same stray-strip
    // (they always carry a "verse 1: "/"chorus: " prefix, never a bare tag).
    const withRealDuetSections = '[male vocal]\n[verse 1: male vocal]\nfoo\n\n[chorus: male and female duet]\nbar';
    expect(ensureVocalMetaTag(withRealDuetSections, '[duet vocal]')).toBe(
      '[duet vocal]\n[verse 1: male vocal]\nfoo\n\n[chorus: male and female duet]\nbar'
    );
  });

  // 8. 대소문자·공백 변형 (case/whitespace variants).
  it('8a) case-insensitivity already worked: [FEMALE VOCAL] is replaced correctly', () => {
    expect(ensureVocalMetaTag('[FEMALE VOCAL]\n[verse 1]\nsome lyrics', '[male vocal]'))
      .toBe('[male vocal]\n[verse 1]\nsome lyrics');
  });

  it('8b) FIXED — internal whitespace inside the brackets ([ Female Vocal ]) is now tolerated instead of silently double-tagging', () => {
    // Before the fix, VOCAL_META_TAG_PATTERN required the bracket content to
    // be an EXACT word match with no padding, so "[ Female Vocal ]" failed to
    // match at all — ensureVocalMetaTag treated it as "no tag present" and
    // PREPENDED a new one, leaving the malformed original as a stray second
    // tag: '[male vocal]\n[ Female Vocal ]\n[verse 1]\nabc'. Confirmed with a
    // real probe before the fix.
    const fixed = ensureVocalMetaTag('[ Female Vocal ]\n[verse 1]\nabc', '[male vocal]');
    expect(fixed).toBe('[male vocal]\n[verse 1]\nabc');
    expect(fixed).not.toContain('Female Vocal');
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
