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
 *
 * TASK (bilingual pair auto-detection gap / Japanese kana floor / per-
 * workspace Korean floor) — three more real, verified gaps closed below:
 *
 * (1) 'bilingual' auto-detect used to pick whichever of Korean/Japanese
 *     happened to appear MORE in the lyrics body, with no way to know which
 *     pair was actually EXPECTED — a jp-kids pack whose lyrics came back as
 *     English+Korean instead of the expected English+Japanese still "passed"
 *     as long as enough Korean was present. GenerationOptions.bilingualPair /
 *     core/localGenerator.ts's resolveBilingualPair / core/lyricMetrics.ts's
 *     LyricLanguageCheckContext.bilingualPair close this — see the
 *     "[bilingual pair auto-detection]" describe block.
 * (2) The Japanese check's `kanaKanjiRatio >= 0.6` combines kana (unique to
 *     Japanese) with kanji (shared with Chinese) — a 100%-kanji, zero-kana
 *     body (pure Chinese) could satisfy it despite having no Japanese-
 *     specific script at all. JAPANESE_KANA_RATIO_MIN closes this — see the
 *     "[Japanese kana floor]" describe block, calibrated against real
 *     generateLocalBlueprint output (see core/lyricMetrics.ts's own
 *     JAPANESE_KANA_RATIO_MIN doc comment for the full real-generation
 *     measurement this task's own numbers are based on).
 * (3) KOREAN_HANGUL_RATIO_MIN used to be one flat 0.6 for every Korean
 *     workspace — too loose to ever catch a real kr-kids mismatch (real
 *     kr-kids lyrics run ~97%+ Hangul) and, in the other direction, would
 *     false-positive on legitimate kr-idol English hooks/rap verses if
 *     raised. koreanHangulRatioMinForArchetype closes this with real
 *     per-workspace floors — see the "[per-workspace Korean floor]" describe
 *     block.
 */
import { describe, expect, it } from 'vitest';
import { preallocateSongSlots, reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import { checkLyricLanguageMatch, lyricLanguageMismatchWarning, measureLyricLanguageRatios } from '../src/core/lyricMetrics';
import { generateLocalBlueprint, resolveBilingualPair } from '../src/core/localGenerator';
import { channelPresets, genrePacks, moodPacks, makeOptions, testSeason, seasonPacks } from './fixtures';
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

// ---------------------------------------------------------------------------
// TASK (bilingual pair auto-detection gap)
// ---------------------------------------------------------------------------

describe('[bilingual pair auto-detection] resolveBilingualPair', () => {
  it('kr-kids-song archetype defaults to en-ko', () => {
    const channel = channelPresets.find(c => c.archetype === 'kr-kids-song')!;
    expect(resolveBilingualPair({ channel })).toBe('en-ko');
  });

  it('jp-kids-song archetype defaults to en-ja', () => {
    const channel = channelPresets.find(c => c.archetype === 'jp-kids-song')!;
    expect(resolveBilingualPair({ channel })).toBe('en-ja');
  });

  it('a non-kids archetype has no real default (undefined, not a guess)', () => {
    const channel = channelPresets.find(c => c.archetype === 'kr-idol-male')!;
    expect(resolveBilingualPair({ channel })).toBeUndefined();
  });

  it('an explicit per-generation override wins over the archetype default', () => {
    const channel = channelPresets.find(c => c.archetype === 'kr-kids-song')!;
    expect(resolveBilingualPair({ channel, bilingualPair: 'en-ja' })).toBe('en-ja');
  });
});

describe('[bilingual pair auto-detection] checkLyricLanguageMatch / lyricLanguageMismatchWarning with an expected pair', () => {
  // Real gap this closes: with NO expected pair, the old auto-detect picks
  // whichever of Korean/Japanese has the higher character ratio in the body
  // it's given — so an English+Korean response passed a 'bilingual' check
  // regardless of what pair was actually expected. A jp-kids pack (expects
  // en-ja) that gets English+Korean back instead of English+Japanese is the
  // concrete real-world case: nothing before this task could ever catch it.
  const englishKoreanLyrics =
    '[verse 1]\nHello there my dear friend today\nWe will sing a happy song\n\n[chorus]\n안녕하세요 오늘도 좋은 하루예요\n우리 함께 노래를 불러요';

  it('BEFORE (documented): with no expected pair, English+Korean content auto-detects as a valid bilingual match', () => {
    const check = checkLyricLanguageMatch(englishKoreanLyrics, 'bilingual');
    expect(check?.ok).toBe(true);
    expect(check?.bilingualDetail?.otherLanguage).toBe('korean');
  });

  it('AFTER (the real fix): the SAME English+Korean content is correctly BLOCKED when the expected pair is en-ja (jp-kids)', () => {
    const check = checkLyricLanguageMatch(englishKoreanLyrics, 'bilingual', { bilingualPair: 'en-ja' });
    expect(check?.ok).toBe(false);
    // Zero real Japanese lines were found, regardless of how much Korean is present.
    expect(check?.bilingualDetail?.otherLanguage).toBe('japanese');
    expect(check?.bilingualDetail?.otherLines).toBe(0);
  });

  it('real English+Japanese content still passes when the expected pair is en-ja', () => {
    const englishJapaneseLyrics =
      '[verse 1]\nHello there my dear friend today\nWe will sing a happy song\n\n[chorus]\nこんにちは 今日もいい天気ですね\nいっしょに うたを うたおう';
    const check = checkLyricLanguageMatch(englishJapaneseLyrics, 'bilingual', { bilingualPair: 'en-ja' });
    expect(check?.ok).toBe(true);
  });

  it('lyricLanguageMismatchWarning surfaces the block with the correct otherLanguage/trackNo when the expected pair is en-ja', () => {
    const warning = lyricLanguageMismatchWarning(englishKoreanLyrics, 'bilingual', 4, { bilingualPair: 'en-ja' });
    expect(warning).toBeDefined();
    expect(warning).toContain('Track 4');
    expect(warning).toContain('0 japanese');
  });

  it('integration: reconcileWithPreassignedSlot blocks a jp-kids pack (bilingualPair en-ja) whose content is really English+Korean', () => {
    const jpKidsChannel = channelPresets.find(c => c.archetype === 'jp-kids-song')!;
    const opts = makeOptions({ channel: jpKidsChannel, lyricLanguage: 'bilingual', songCount: 2 });
    const slots = preallocateSongSlots(opts, genresFor(opts));
    const slot = slots[0];
    const song: SongIdea = {
      trackNo: slot.trackNo,
      title: slot.title,
      seasonMoment: '',
      listenerSituation: '',
      emotionArc: slot.emotionArc,
      hookPhrase: slot.hookPhrase,
      stylePrompt: 'generic pop mood, some vocal',
      lyrics: englishKoreanLyrics,
      youtube: { title: slot.title, description: '', tags: [] },
      qualityScore: 0,
      warnings: [],
      effectiveMoneyChordId: '',
      effectiveGenreIds: [],
      effectiveArchetype: 'senior-morning',
      workspaceId: 'senior-oldpop'
    };
    const fixed = reconcileWithPreassignedSlot(song, slot, 'ai-creative', {
      archetype: opts.channel.archetype,
      lyricLanguage: opts.lyricLanguage,
      bilingualPair: resolveBilingualPair(opts)
    });
    expect(hasLanguageWarning(fixed), `warnings: ${JSON.stringify(fixed.warnings)}`).toBe(true);
    const warning = fixed.warnings.find(w => w.includes('possible language mismatch'))!;
    expect(warning).toContain("lyricLanguage is 'bilingual'");
  });

  it('integration: the same jp-kids slot with real English+Japanese content passes cleanly (no false positive from the new pair-aware check)', () => {
    const jpKidsChannel = channelPresets.find(c => c.archetype === 'jp-kids-song')!;
    const opts = makeOptions({ channel: jpKidsChannel, lyricLanguage: 'bilingual', songCount: 2 });
    const slots = preallocateSongSlots(opts, genresFor(opts));
    const slot = slots[1];
    const song: SongIdea = {
      trackNo: slot.trackNo,
      title: slot.title,
      seasonMoment: '',
      listenerSituation: '',
      emotionArc: slot.emotionArc,
      hookPhrase: slot.hookPhrase,
      stylePrompt: 'generic pop mood, some vocal',
      lyrics:
        '[verse 1]\nHello there my dear friend today\nWe will sing a happy song\n\n[chorus]\nこんにちは 今日もいい天気ですね\nいっしょに うたを うたおう',
      youtube: { title: slot.title, description: '', tags: [] },
      qualityScore: 0,
      warnings: [],
      effectiveMoneyChordId: '',
      effectiveGenreIds: [],
      effectiveArchetype: 'senior-morning',
      workspaceId: 'senior-oldpop'
    };
    const fixed = reconcileWithPreassignedSlot(song, slot, 'ai-creative', {
      archetype: opts.channel.archetype,
      lyricLanguage: opts.lyricLanguage,
      bilingualPair: resolveBilingualPair(opts)
    });
    expect(hasLanguageWarning(fixed), `warnings: ${JSON.stringify(fixed.warnings)}`).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// TASK (Japanese kana floor gap)
// ---------------------------------------------------------------------------

describe('[Japanese kana floor] the 5 real fixtures from this task\'s own brief', () => {
  // Fixtures 1-3 are REAL lyrics captured verbatim from
  // core/localGenerator.ts's generateLocalBlueprint (jp-kids-song,
  // jp-2030-pop, and j2000s channels — a one-off `npx tsx` calibration run,
  // not hand-written) — see core/lyricMetrics.ts's own JAPANESE_KANA_RATIO_MIN
  // doc comment for the full real-generation measurement these were drawn
  // from. Fixtures 4-5 use a real, well-known classical Chinese poem (Li
  // Bai's 静夜思 + two more genuinely public-domain quatrains), not
  // hand-typed pseudo-Chinese.

  // 1. 정상 일본어 가사 — real jp-kids-song output (highest-kana sample from
  // the calibration run: kanaRatio = 1.0, pure hiragana kids song).
  const normalJapanese =
    '[mixed vocal]\n[short intro]\nうたをできたよ の うたを はじめよう\n\n[chorus]\nうたをできたよ\nだいすきだよ みんなのかぞく\n\n[verse 1]\nいもうとと なかよく すごすよ\nいっしょにいると しあわせだね\n\n[call and response]\nおばあちゃん おじいちゃん こんにちは\nてをつないで あるいていこう\n\n[chorus]\nうたをできたよ\nだいすきだよ みんなのかぞく\n\n[verse 2]\nおかあさん おとうさん だいすきだよ\nかぞくみんなが さいこうだよ\n\n[call and response]\nおばあちゃん おじいちゃん こんにちは\nてをつないで あるいていこう\n\n[chorus]\nうたをできたよ\nだいすきだよ みんなのかぞく\n\n[final chorus]\nうたをできたよ\nだいすきだよ みんなのかぞく';

  // 2. 한자 비중이 높은 정상 일본어 — real j2000s (formal/literary depth)
  // output, the LOWEST-kana sample from that workspace's calibration run
  // (kanaRatio ~0.594, kanaKanjiRatio ~0.865 — genuinely kanji-heavy but
  // still real Japanese, still well clear of the new floor).
  const kanjiHeavyJapanese =
    '[duet vocal]\n[instrumental hook]\n(instrumental hook, band plays the melody, no lyrics, 2 bars)\n\n[verse 1: male vocal]\n新年の街の向こうで\n小さな鐘が鳴り\n静かな戸口にそっと触れると\n時間が少し止まる\n新年の風が過ぎて\n一日のページをめくる\n夕方がそばにいて\n何も言わずにとどまる\n\n季節の木々の下の静かな散歩の中で\n息をひとつ整え\n小さな瞬間みたいな記憶が\n静かにまた灯る\n季節の木々の下の静かな散歩にとどまり\n肩の力をそっと抜く\n柔らかな光は私に\n何も求めない\n\n[chorus: male and female duet]\nもう一度やわらかく\n重い朝さえ\n静かな戸口のように、また輝きを取り戻す\nあの日々を待っている\n\n[verse 2: female vocal]\n川のように流れた時間も\n速すぎてつかめなかったが\n今は小さな瞬間のように\n私の呼びかけに応える\n遠すぎると思った距離も\n今は違って見える\nそれは小さな瞬間のように\n静かにそばにある\n\n[chorus: male and female duet]\n遠くてもあたたかく\n空っぽの夜さえ\n朝のように、低い星を見つける\nどんな時も落ち着いて\n散らばった気持ちさえ\n朝のように、止まった場所へ戻る\nあの日々を待っている';

  // 3. 일본어에 영어 훅 포함 — real jp-2030-pop output, the LOWEST-kana
  // sample across every real Japanese workspace measured for this task
  // (kanaRatio = 0.5 exactly), genuinely containing English hook phrases
  // ("night road", "city skyline") mixed into real Japanese verses/chorus.
  const japaneseWithEnglishHook =
    '[female vocal]\n[instrumental hook]\n(instrumental hook, band plays the melody, no lyrics, 2 bars)\n\n[verse 1]\nイヤホンの向こうに聞こえる新年\n街の音が低く混ざり合う\nnight roadを思い出せば\n心が少しゆるんでいく\n新年の街に灯りが滲んで\nイヤホンの中で歌が低く流れ\ncity skylineが路地の先で待っていれば\n一日がゆっくりほどけてゆく\n\n放課後の空き教室の中で静かに\nこの瞬間をつかまえておく\nnight roadはまた書き直してくれる\nもう少し確かな一日を\n放課後の空き教室の中で静かに\nこの瞬間をつかまえておく\nnight roadはまた書き直してくれる\nもう少し確かな一日を\n\n[chorus]\n今日もゆっくり歩いてゆこう\n疲れた一日の終わりにも\nnight roadのように、また歩き出す\n顔を上げて、青春へ\n\n[verse 2]\n急いでいた足取りの理由も\n今はもう数えない\nそれはcity skylineのように\n見慣れた道になった\nひとりだと思っていた夕暮れも\n今は違って見える\n今はcity skylineのように\nようやくわかる\n\n[chorus]\nどんな夜でも大胆に\n散らばった一日さえ\ncity skylineのように、また集まってくる\n毎日少しずつ力強く\n疲れた足取りさえ\nnight roadのように、またリズムを見つける\n顔を上げて、青春へ\n\n[chorus]\n顔を上げて、青春へ\n前よりも素直に\n隠していた本音さえ\ncity skylineのように、少しずつ溢れてくる\n顔を上げて、青春へ';

  // 4. 순수 중국어 — real classical Chinese (Li Bai's 静夜思, plus two more
  // genuine public-domain quatrains). Zero kana anywhere.
  const pureChinese =
    '床前明月光，疑是地上霜。举头望明月，低头思故乡。\n春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。\n锄禾日当午，汗滴禾下土。谁知盘中餐，粒粒皆辛苦。';

  // 5. 중국어에 일본어 한 단어만 — the same real Chinese poem with exactly
  // one real Japanese word ("ありがとう", "thank you") inserted once.
  const chineseWithOneJapaneseWord =
    '床前明月光，疑是地上霜。举头望明月，低头思故乡。ありがとう\n春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。\n锄禾日当午，汗滴禾下土。谁知盘中餐，粒粒皆辛苦。';

  it('1. normal Japanese (jp-kids): kanaRatio measured ~1.0, PASSES both before and after the kana-floor fix', () => {
    const ratios = measureLyricLanguageRatios(normalJapanese);
    expect(ratios.kanaRatio).toBeCloseTo(1.0, 2);
    const check = checkLyricLanguageMatch(normalJapanese, 'japanese');
    expect(check?.ok, `kanaRatio=${ratios.kanaRatio}`).toBe(true);
  });

  it('2. kanji-heavy real Japanese (j2000s literary): kanaRatio measured ~0.594, still PASSES (real content, not false-positived by the new floor)', () => {
    const ratios = measureLyricLanguageRatios(kanjiHeavyJapanese);
    expect(ratios.kanaRatio).toBeGreaterThan(0.5);
    expect(ratios.kanaRatio).toBeLessThan(0.7);
    const check = checkLyricLanguageMatch(kanjiHeavyJapanese, 'japanese');
    expect(check?.ok, `kanaRatio=${ratios.kanaRatio}`).toBe(true);
  });

  it('3. real Japanese with an English hook mixed in (jp-2030): kanaRatio measured = 0.5 (the lowest real value seen), still PASSES', () => {
    const ratios = measureLyricLanguageRatios(japaneseWithEnglishHook);
    expect(ratios.kanaRatio).toBeCloseTo(0.5, 1);
    const check = checkLyricLanguageMatch(japaneseWithEnglishHook, 'japanese');
    expect(check?.ok, `kanaRatio=${ratios.kanaRatio}`).toBe(true);
  });

  it('4. pure Chinese: kanaRatio = 0 exactly, and kanaKanjiRatio alone (~0.83) would have wrongly PASSED before this fix — now correctly FAILS', () => {
    const ratios = measureLyricLanguageRatios(pureChinese);
    expect(ratios.kanaRatio).toBe(0);
    // Documents the real gap: the OLD check (kanaKanjiRatio >= 0.6 && hangulRatio <= 0.05) alone.
    expect(ratios.kanaKanjiRatio).toBeGreaterThanOrEqual(0.6);
    expect(ratios.hangulRatio).toBeLessThanOrEqual(0.05);
    // The NEW check (with the kana floor) correctly fails it.
    const check = checkLyricLanguageMatch(pureChinese, 'japanese');
    expect(check?.ok, `kanaRatio=${ratios.kanaRatio} kanaKanjiRatio=${ratios.kanaKanjiRatio}`).toBe(false);
  });

  it('5. Chinese with a single stray Japanese word: kanaRatio measured ~0.065, one word is not enough — correctly FAILS', () => {
    const ratios = measureLyricLanguageRatios(chineseWithOneJapaneseWord);
    expect(ratios.kanaRatio).toBeGreaterThan(0);
    expect(ratios.kanaRatio).toBeLessThan(0.1);
    const check = checkLyricLanguageMatch(chineseWithOneJapaneseWord, 'japanese');
    expect(check?.ok, `kanaRatio=${ratios.kanaRatio}`).toBe(false);
  });
});

describe('[Japanese kana floor] real generateLocalBlueprint output never false-positives across every Japanese workspace', () => {
  // Real-generation smoke check (not the full calibration sweep — that ran
  // separately, see core/lyricMetrics.ts's own JAPANESE_KANA_RATIO_MIN doc
  // comment for the full 1700+-song measurement this threshold is based on).
  // This just re-confirms, at test-suite time, that the chosen floor still
  // doesn't false-positive on a real generated sample from each workspace.
  const japaneseArchetypes = ['jp-kids-song', 'jp-2030-pop', 'showa-cafe', 'showa-70s', 'j2000s'];

  it.each(japaneseArchetypes)('%s: real generated songs all pass the japanese language check (no false positive)', archetype => {
    const channel = channelPresets.find(c => c.archetype === archetype);
    expect(channel, `no channel found for archetype ${archetype}`).toBeDefined();
    const genres = genrePacks.filter(g => channel!.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel!.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel: channel!, lyricLanguage: 'japanese', songCount: 12 });
    const blueprint = generateLocalBlueprint(opts, genres, moods, testSeason);
    for (const song of blueprint.songs) {
      const check = checkLyricLanguageMatch(song.lyrics, 'japanese');
      expect(check?.ok, `${archetype} track ${song.trackNo}: ${JSON.stringify(check?.ratios)}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// TASK (per-workspace Korean floor)
// ---------------------------------------------------------------------------

describe('[per-workspace Korean floor] real generateLocalBlueprint output never false-positives, per workspace threshold', () => {
  // Real-generation smoke check re-confirming, at test-suite time, that each
  // workspace's calibrated floor (see core/lyricMetrics.ts's own
  // koreanHangulRatioMinForArchetype doc comment for the full 576-1152-song
  // measurement each number is based on) doesn't false-positive on a real
  // generated sample. Sweeps every channel in the workspace x a few seasons
  // (not the full 16-season sweep the original calibration ran, to keep this
  // fast) so this stays a real regression guard, not just a re-statement of
  // the calibration numbers.
  const koreanWorkspaces: { archetype: string; label: string }[] = [
    { archetype: 'kr-kids-song', label: 'kr-kids (floor 70%)' },
    { archetype: 'kr-2030-pop', label: 'kr-2030 (floor 55%)' },
    { archetype: 'kr-idol-male', label: 'kr-idol-male (floor 45%)' },
    { archetype: 'kr-idol-female', label: 'kr-idol-female (floor 45%)' }
  ];

  it.each(koreanWorkspaces)('$label: real generated songs across every channel in the workspace pass (no false positive)', ({ archetype }) => {
    const channels = channelPresets.filter(c => c.archetype === archetype);
    expect(channels.length, `no channels found for archetype ${archetype}`).toBeGreaterThan(0);
    let checked = 0;
    for (const channel of channels) {
      const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
      const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
      for (const season of [seasonPacks[0], seasonPacks[1]]) {
        const opts = makeOptions({ channel, lyricLanguage: 'korean', songCount: 12, seasonId: season.id });
        const blueprint = generateLocalBlueprint(opts, genres, moods, season);
        for (const song of blueprint.songs) {
          checked += 1;
          const check = checkLyricLanguageMatch(song.lyrics, 'korean', { archetype });
          expect(check?.ok, `${archetype}/${season.id} track ${song.trackNo}: ${JSON.stringify(check?.ratios)}`).toBe(true);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('a real wrong-language response (English lyrics) is still caught under every per-workspace floor, including the loosest (kr-idol, 45%)', () => {
    const krIdolChannel = channelPresets.find(c => c.archetype === 'kr-idol-male')!;
    const englishLyrics = '[verse 1]\nThis is entirely English text with no Hangul anywhere\n\n[chorus]\nStill completely English right here';
    const check = checkLyricLanguageMatch(englishLyrics, 'korean', { archetype: krIdolChannel.archetype });
    expect(check?.ok).toBe(false);
    expect(check?.ratios.hangulRatio).toBe(0);
  });

  it('the SAME per-workspace threshold is applied through lyricLanguageMismatchWarning/reconcileWithPreassignedSlot (integration), not just the unit-level check', () => {
    const krKidsChannel = channelPresets.find(c => c.archetype === 'kr-kids-song')!;
    const opts = makeOptions({ channel: krKidsChannel, lyricLanguage: 'korean', songCount: 2 });
    const slots = preallocateSongSlots(opts, genresFor(opts));
    const slot = slots[0];
    // ~62% Hangul — passes kr-2030's 55% floor (and kr-idol's 45%) but fails
    // kr-kids' real, stricter 70% floor. This is the concrete reason the
    // check needs to be per-workspace, not one flat global number.
    const marginalKoreanSong: SongIdea = {
      trackNo: slot.trackNo,
      title: slot.title,
      seasonMoment: '',
      listenerSituation: '',
      emotionArc: slot.emotionArc,
      hookPhrase: slot.hookPhrase,
      stylePrompt: 'generic pop mood, some vocal',
      lyrics: '[verse 1]\n오늘도 좋은 하루입니다 우리 함께 노래해요\n\n[chorus]\n사랑해요 내 마음을 today we sing along',
      youtube: { title: slot.title, description: '', tags: [] },
      qualityScore: 0,
      warnings: [],
      effectiveMoneyChordId: '',
      effectiveGenreIds: [],
      effectiveArchetype: 'senior-morning',
      workspaceId: 'senior-oldpop'
    };
    const ratios = measureLyricLanguageRatios(marginalKoreanSong.lyrics);
    expect(ratios.hangulRatio, `hangulRatio=${ratios.hangulRatio}`).toBeGreaterThan(0.55);
    expect(ratios.hangulRatio, `hangulRatio=${ratios.hangulRatio}`).toBeLessThan(0.70);
    const fixed = reconcileWithPreassignedSlot(marginalKoreanSong, slot, 'ai-creative', {
      archetype: opts.channel.archetype,
      lyricLanguage: opts.lyricLanguage
    });
    expect(hasLanguageWarning(fixed), `warnings: ${JSON.stringify(fixed.warnings)}`).toBe(true);
  });
});
