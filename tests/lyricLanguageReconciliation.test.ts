/**
 * TASK (lyric language mismatch detection) — tests/workspaceContractMatrix.test.ts's
 * own criterion 7 (lyric language matches the selected lyricLanguage) checks
 * the final SongIdea[] a generation path produces, but nothing inside
 * core/batchPreallocation.ts's reconcileWithPreassignedSlot itself — the one
 * choke point every non-local generation path (realtime, Batch API, Claude
 * Code bridge import, individual song regeneration) funnels an AI-produced
 * song through — ever inspected `song.lyrics`' actual language. A real
 * non-compliant model/bridge response (e.g. a Korean pack whose `lyrics`
 * came back in English) sailed through completely unchecked.
 *
 * This file exercises the fix directly: core/lyricMetrics.ts's
 * lyricLanguageMismatchWarning, wired into reconcileWithPreassignedSlot via
 * ReconcilePreassignedOptions.lyricLanguage and surfaced through the same
 * `song.warnings` array structureWarning/genreWarning already use — this
 * function itself never blocks or rewrites `lyrics`, since a language
 * mismatch can't be safely auto-corrected the way a wrong genre-id
 * substring can.
 *
 * TASK (ratio-based lyric language mismatch) — a later follow-up replaced
 * the original presence-only signal (matched >=1 character of the target
 * script, checked here) with a real character-RATIO check (see
 * lyricLanguageMismatchWarning's own doc comment in core/lyricMetrics.ts for
 * the exact thresholds and why): the presence-only version let a ~95%-wrong-
 * language body with a single stray correct-script word pass completely
 * clean. That same follow-up also added a stricter BLOCKING tier for the
 * identical finding in core/compositionScorer.ts (not this file's own
 * warning-only check) — see tests/compositionScorer.test.ts's own
 * "[ratio-based lyric language mismatch] scoreComposition" describe block.
 * 'bilingual' is also no longer unconditionally skipped here — see the
 * dedicated bilingual tests below for its own real per-line-coverage rule.
 */
import { describe, expect, it } from 'vitest';
import { preallocateSongSlots, reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import { lyricLanguageMismatchWarning } from '../src/core/lyricMetrics';
import { channelPresets, genrePacks, moodPacks, makeOptions, testSeason } from './fixtures';
import type { GenerationOptions, PreassignedSongSlot, SongIdea } from '../src/types';

function genresFor(opts: GenerationOptions) {
  return genrePacks.filter(g => opts.genreIds.includes(g.id));
}

/** Same minimal "well-formed synthetic model response" shape tests/effectiveGenerationFields.test.ts/tests/workspaceContractMatrix.test.ts's own syntheticModelSong helpers use, kept local here — `lyrics` is the one field this file needs full control over. */
function syntheticModelSong(slot: PreassignedSongSlot, lyrics: string, stylePrompt?: string): SongIdea {
  return {
    trackNo: slot.trackNo,
    title: slot.title,
    seasonMoment: '',
    listenerSituation: '',
    emotionArc: slot.emotionArc,
    hookPhrase: slot.hookPhrase,
    stylePrompt: stylePrompt ?? 'generic pop mood, some vocal',
    lyrics,
    youtube: { title: slot.title, description: '', tags: [] },
    qualityScore: 0,
    warnings: [],
    effectiveMoneyChordId: '',
    effectiveGenreIds: [],
    effectiveArchetype: 'senior-morning',
    workspaceId: 'senior-oldpop'
  };
}

function hasLanguageWarning(song: SongIdea): boolean {
  return song.warnings.some(w => w.includes('possible language mismatch'));
}

// ---------------------------------------------------------------------------
// Unit-level: lyricLanguageMismatchWarning itself
// ---------------------------------------------------------------------------

describe('[lyric language mismatch] lyricLanguageMismatchWarning (unit)', () => {
  it('korean target, English-only lyrics: mismatch', () => {
    const warning = lyricLanguageMismatchWarning('[verse 1]\nThis is entirely English text\n\n[chorus]\nStill English here', 'korean', 3);
    expect(warning).toBeDefined();
    expect(warning).toContain("lyricLanguage is 'korean'");
    expect(warning).toContain('Track 3');
  });

  it('korean target, real Hangul present: no warning', () => {
    const warning = lyricLanguageMismatchWarning('[verse 1]\n오늘도 좋은 하루였어요\n\n[chorus]\n사랑해요 내 마음을', 'korean', 3);
    expect(warning).toBeUndefined();
  });

  it('japanese target, English-only lyrics: mismatch', () => {
    const warning = lyricLanguageMismatchWarning('[verse 1]\nThis is entirely English text', 'japanese', 5);
    expect(warning).toBeDefined();
    expect(warning).toContain("lyricLanguage is 'japanese'");
  });

  it('japanese target, real kana/kanji present: no warning', () => {
    const warning = lyricLanguageMismatchWarning('[verse 1]\nこんにちは 今日もいい天気ですね', 'japanese', 5);
    expect(warning).toBeUndefined();
  });

  it('english target, Hangul present: mismatch', () => {
    const warning = lyricLanguageMismatchWarning('[verse 1]\nMostly English but 안녕 slipped in', 'english', 1);
    expect(warning).toBeDefined();
    expect(warning).toContain("lyricLanguage is 'english'");
  });

  it('english target, no Hangul/kana: no warning', () => {
    const warning = lyricLanguageMismatchWarning('[verse 1]\nA completely ordinary English lyric line', 'english', 1);
    expect(warning).toBeUndefined();
  });

  // TASK (ratio-based lyric language mismatch) — 'bilingual' used to be
  // skipped unconditionally (any content passed). That was itself a real
  // gap this task closes: a single decorative word in one language ("Hello
  // 안녕하세요 mixed content") is not genuinely bilingual content, just a
  // single-language response with a stray token. 'bilingual' is no longer a
  // ratio check (a real bilingual song is expected to have LOW purity in
  // either script by design) — it now requires real per-line presence: at
  // least 2 lines with more than one word in EACH language actually present.
  it('bilingual target: single-language content (no second script at all) is now caught', () => {
    const warning = lyricLanguageMismatchWarning('[verse 1]\nAll English, no Korean or Japanese at all\n\n[chorus]\nStill entirely English here', 'bilingual', 1);
    expect(warning).toBeDefined();
    expect(warning).toContain("lyricLanguage is 'bilingual'");
    expect(warning).toContain('no Korean or Japanese content at all');
  });

  it('bilingual target: a single decorative word in the second language does not satisfy it (needs >=2 real multi-word lines per language)', () => {
    const warning = lyricLanguageMismatchWarning('[verse 1]\nHello there my friend today\n\n[chorus]\nHello 안녕 mixed content right here', 'bilingual', 1);
    expect(warning).toBeDefined();
    expect(warning).toContain("lyricLanguage is 'bilingual'");
    expect(warning).toContain('0 korean');
  });

  it('bilingual target: real multi-line coverage in both languages passes cleanly', () => {
    const warning = lyricLanguageMismatchWarning(
      '[verse 1]\nHello there my dear friend today\nWe will sing a happy song\n\n[chorus]\n안녕하세요 오늘도 좋은 하루예요\n우리 함께 노래를 불러요',
      'bilingual',
      1
    );
    expect(warning).toBeUndefined();
  });

  it('bilingual target (Japanese pair): real multi-line coverage in English and Japanese passes cleanly', () => {
    const warning = lyricLanguageMismatchWarning(
      '[verse 1]\nHello there my dear friend today\nWe will sing a happy song\n\n[chorus]\nこんにちは 今日もいい天気ですね\nいっしょに うたを うたおう',
      'bilingual',
      1
    );
    expect(warning).toBeUndefined();
  });

  it('empty/whitespace-only lyrics: never flagged (nothing to detect yet)', () => {
    expect(lyricLanguageMismatchWarning('', 'korean', 1)).toBeUndefined();
    expect(lyricLanguageMismatchWarning('   \n\n  ', 'japanese', 1)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Integration: reconcileWithPreassignedSlot wiring
// ---------------------------------------------------------------------------

describe('[lyric language mismatch] reconcileWithPreassignedSlot wiring', () => {
  const koreanOpts = makeOptions({ lyricLanguage: 'korean', songCount: 3 });
  const koreanSlots = preallocateSongSlots(koreanOpts, genresFor(koreanOpts));

  it('(a) real gap case: English lyrics reconciled against a korean slot are now caught, not silent', () => {
    const slot = koreanSlots[0];
    const englishSong = syntheticModelSong(
      slot,
      '[verse 1]\nThis is a purely English verse with no Korean at all\n\n[chorus]\nAn English chorus line right here'
    );
    // Before this task: fixed.warnings would be [] (or only structure/genre
    // warnings) — the language mismatch was completely invisible.
    const beforeStyleFix = englishSong.warnings.slice();
    expect(beforeStyleFix).toEqual([]);

    const fixed = reconcileWithPreassignedSlot(englishSong, slot, 'ai-creative', { archetype: koreanOpts.channel.archetype, lyricLanguage: koreanOpts.lyricLanguage });
    expect(hasLanguageWarning(fixed), `warnings: ${JSON.stringify(fixed.warnings)}`).toBe(true);
    const warning = fixed.warnings.find(w => w.includes('possible language mismatch'))!;
    expect(warning).toContain("lyricLanguage is 'korean'");
    expect(warning).toContain(`Track ${slot.trackNo}`);
    // The lyrics body text itself is untouched by this check — reconciliation
    // surfaces, never rewrites, lyric content (it may still prepend a vocal
    // meta-tag via ensureVocalMetaTag, an unrelated pre-existing behavior).
    expect(fixed.lyrics).toContain(englishSong.lyrics);
  });

  it('(b) genuine match: real Korean lyrics against a korean slot pass through with no false-positive warning', () => {
    const slot = koreanSlots[1];
    const koreanSong = syntheticModelSong(
      slot,
      `[verse 1]\n오늘도 좋은 하루였어요\n\n[chorus]\n${slot.hookPhrase}`
    );
    const fixed = reconcileWithPreassignedSlot(koreanSong, slot, 'ai-creative', { archetype: koreanOpts.channel.archetype, lyricLanguage: koreanOpts.lyricLanguage });
    expect(hasLanguageWarning(fixed), `warnings: ${JSON.stringify(fixed.warnings)}`).toBe(false);
  });

  it('(c) bilingual target: real multi-line mixed-script content passes, a single decorative word or single-script content does not', () => {
    const biOpts = makeOptions({ lyricLanguage: 'bilingual', songCount: 2 });
    const biSlots = preallocateSongSlots(biOpts, genresFor(biOpts));
    const slot = biSlots[0];

    // Real coverage: 2+ real (multi-word) lines in English AND in Korean.
    const mixedSong = syntheticModelSong(
      slot,
      '[verse 1]\nHello there my dear friend today\nWe will sing a happy song\n\n[chorus]\n안녕하세요 오늘도 좋은 하루예요\n우리 함께 노래를 불러요'
    );
    const fixedMixed = reconcileWithPreassignedSlot(mixedSong, slot, 'ai-creative', { archetype: biOpts.channel.archetype, lyricLanguage: biOpts.lyricLanguage });
    expect(hasLanguageWarning(fixedMixed), `warnings: ${JSON.stringify(fixedMixed.warnings)}`).toBe(false);

    // TASK (ratio-based lyric language mismatch) — behavior change from the
    // presence-only check this replaces: 'bilingual' used to never flag
    // ANY content, including pure single-script text. Pure English content
    // under a bilingual target is now a real, correctly-caught mismatch
    // (there's no second language present at all, so "bilingual" cannot be
    // an honest description of this response).
    const pureEnglishSong = syntheticModelSong(slot, '[verse 1]\nAll English, nothing else in this verse\n\n[chorus]\nStill English here');
    const fixedPure = reconcileWithPreassignedSlot(pureEnglishSong, slot, 'ai-creative', { archetype: biOpts.channel.archetype, lyricLanguage: biOpts.lyricLanguage });
    expect(hasLanguageWarning(fixedPure), `warnings: ${JSON.stringify(fixedPure.warnings)}`).toBe(true);

    // A single decorative word in the second language ("mixed line" style)
    // is also now correctly caught — it needs 2+ REAL (multi-word) lines in
    // each language, not just any trace of the other script.
    const oneWordSong = syntheticModelSong(slot, '[verse 1]\nHello there my dear friend today\nWe will sing a happy song\n\n[chorus]\nHello there 안녕 my friend');
    const fixedOneWord = reconcileWithPreassignedSlot(oneWordSong, slot, 'ai-creative', { archetype: biOpts.channel.archetype, lyricLanguage: biOpts.lyricLanguage });
    expect(hasLanguageWarning(fixedOneWord), `warnings: ${JSON.stringify(fixedOneWord.warnings)}`).toBe(true);
  });

  it('japanese slot + English-only lyrics: also caught', () => {
    const jaOpts = makeOptions({ lyricLanguage: 'japanese', songCount: 2 });
    const jaSlots = preallocateSongSlots(jaOpts, genresFor(jaOpts));
    const slot = jaSlots[0];
    const englishSong = syntheticModelSong(slot, '[verse 1]\nCompletely English verse text here\n\n[chorus]\nEnglish chorus too');
    const fixed = reconcileWithPreassignedSlot(englishSong, slot, 'ai-creative', { archetype: jaOpts.channel.archetype, lyricLanguage: jaOpts.lyricLanguage });
    expect(hasLanguageWarning(fixed), `warnings: ${JSON.stringify(fixed.warnings)}`).toBe(true);
  });

  it('omitting options.lyricLanguage (pre-existing callers not migrated) is a safe no-op, matching every other optional ReconcilePreassignedOptions field', () => {
    const slot = koreanSlots[2];
    const englishSong = syntheticModelSong(slot, '[verse 1]\nEnglish text even though the slot implies Korean\n\n[chorus]\nStill English');
    const fixed = reconcileWithPreassignedSlot(englishSong, slot, 'ai-creative', { archetype: koreanOpts.channel.archetype });
    expect(hasLanguageWarning(fixed)).toBe(false);
  });

  it('fast path (stylePrompt already complete/verbatim) still surfaces the language warning', () => {
    const slot = koreanSlots[0];
    const completePrompt = [
      slot.vocalText, slot.moneyChordText, slot.genreText, slot.signatureSound,
      slot.hookDeviceText, slot.introTextureText, ...(slot.instrumentSet || []), `${slot.tempo} BPM`
    ].filter(Boolean).join(', ');
    const englishSong = syntheticModelSong(slot, '[verse 1]\nEnglish verse despite the complete style prompt', completePrompt);
    const fixed = reconcileWithPreassignedSlot(englishSong, slot, 'ai-creative', { archetype: koreanOpts.channel.archetype, lyricLanguage: koreanOpts.lyricLanguage });
    expect(hasLanguageWarning(fixed), `warnings: ${JSON.stringify(fixed.warnings)}`).toBe(true);
  });

  it('no-slot branch (agent-invented extra track) still surfaces the language warning', () => {
    const orphanSong: SongIdea = {
      trackNo: 99,
      title: 'Orphan Track',
      seasonMoment: '',
      listenerSituation: '',
      emotionArc: '',
      hookPhrase: 'orphan hook',
      stylePrompt: 'some style',
      lyrics: '[verse 1]\nEntirely English text with no slot backing it',
      youtube: { title: 'Orphan Track', description: '', tags: [] },
      qualityScore: 0,
      warnings: [],
      effectiveMoneyChordId: '',
      effectiveGenreIds: [],
      effectiveArchetype: 'senior-morning',
      workspaceId: 'senior-oldpop'
    };
    const fixed = reconcileWithPreassignedSlot(orphanSong, undefined, 'ai-creative', { archetype: koreanOpts.channel.archetype, lyricLanguage: 'korean' });
    expect(hasLanguageWarning(fixed), `warnings: ${JSON.stringify(fixed.warnings)}`).toBe(true);
  });
});
