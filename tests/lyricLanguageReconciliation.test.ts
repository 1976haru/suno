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
 * This file exercises the fix directly: core/lyricMetrics.ts's new
 * lyricLanguageMismatchWarning (reusing that file's own
 * HANGUL_SYLLABLE_PATTERN/JAPANESE_CHAR_PATTERN char-range signal), wired
 * into reconcileWithPreassignedSlot via ReconcilePreassignedOptions.lyricLanguage
 * and surfaced through the same `song.warnings` array structureWarning/
 * genreWarning already use — never blocking, since a language mismatch
 * can't be safely auto-corrected the way a wrong genre-id substring can.
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

  it('bilingual target: never flagged, regardless of content', () => {
    expect(lyricLanguageMismatchWarning('All English, no Korean or Japanese at all', 'bilingual', 1)).toBeUndefined();
    expect(lyricLanguageMismatchWarning('전부 한글로만 쓰여진 가사입니다', 'bilingual', 1)).toBeUndefined();
    expect(lyricLanguageMismatchWarning('Hello 안녕하세요 mixed content', 'bilingual', 1)).toBeUndefined();
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

  it('(c) bilingual target: mixed-script content never false-positives', () => {
    const biOpts = makeOptions({ lyricLanguage: 'bilingual', songCount: 2 });
    const biSlots = preallocateSongSlots(biOpts, genresFor(biOpts));
    const slot = biSlots[0];
    const mixedSong = syntheticModelSong(slot, `[verse 1]\nHello there 안녕하세요, mixed line\n\n[chorus]\n${slot.hookPhrase}`);
    const fixedMixed = reconcileWithPreassignedSlot(mixedSong, slot, 'ai-creative', { archetype: biOpts.channel.archetype, lyricLanguage: biOpts.lyricLanguage });
    expect(hasLanguageWarning(fixedMixed), `warnings: ${JSON.stringify(fixedMixed.warnings)}`).toBe(false);

    // Even single-script content under a bilingual target must not be flagged.
    const pureEnglishSong = syntheticModelSong(slot, '[verse 1]\nAll English, nothing else in this verse\n\n[chorus]\nStill English here');
    const fixedPure = reconcileWithPreassignedSlot(pureEnglishSong, slot, 'ai-creative', { archetype: biOpts.channel.archetype, lyricLanguage: biOpts.lyricLanguage });
    expect(hasLanguageWarning(fixedPure), `warnings: ${JSON.stringify(fixedPure.warnings)}`).toBe(false);
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
