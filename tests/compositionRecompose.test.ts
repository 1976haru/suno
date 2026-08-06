import { describe, expect, it } from 'vitest';
import { RECOMPOSE_MAX_RETRIES, recomposeBlockingTracks } from '../src/core/compositionRecompose';
import type { SongIdea } from '../src/types';

/**
 * TASK v3.62 (TASK 3) — recomposeBlockingTracks is provider-agnostic (the
 * regeneration call is injected), so these tests drive it with a fake
 * regenerateOne instead of mocking network calls, matching this file's own
 * doc comment on why the dependency is injected in the first place.
 */

// v3.75 (TASK A) — see compositionScorer.test.ts's own identical comment:
// pads past the new LYRIC_WORD_COUNT_BLOCKING_FLOOR/ADVISORY_FLOOR so this
// file's tests (about recompose retry logic, not word count) don't
// spuriously trip the new check.
function wordCountFillerLines(count: number): string {
  return Array.from({ length: count }, (_, i) => `soft quiet morning light drifts gently through the old familiar window number ${i + 1}`).join('\n');
}

function songWith(overrides: Partial<SongIdea> & { trackNo: number }): SongIdea {
  return {
    title: `Song ${overrides.trackNo}`,
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: `Hook ${overrides.trackNo}`,
    // 28 comma-separated descriptors (inside compositionScorer's 25-35 no-warning band) plus a
    // trackNo-unique leading descriptor, so two default songWith() calls never collide on the
    // in-pack style-similarity blocking check the way two byte-identical prompts would.
    stylePrompt: `track-${overrides.trackNo} signature texture, warm acoustic guitar, gentle piano, soft strings, mellow tempo, intimate vocal, tender phrasing, light percussion, airy harmony, subtle reverb, close-mic warmth, unhurried pacing, tasteful dynamics, understated bass, breathy backing vocal, delicate bells, soft brush drums, relaxed groove, hushed dynamics, sincere delivery, natural warmth, easy sway, gentle lift, quiet confidence, comfortable pace, homely feel, familiar warmth, simple hook`,
    lyrics: `[verse 1]\nline one\n[chorus]\nHook line\nHook line\n[verse 2]\n${wordCountFillerLines(15)}\n[end]`,
    youtube: { title: 'x', description: 'x', tags: ['x'] },
    qualityScore: 90,
    warnings: [],
    ...overrides
  };
}

const BLOCKING_STYLE_PROMPT = 'style'; // 1 descriptor — trips the <20 descriptor-count blocking check.

describe('[v3.62 TASK 3] recomposeBlockingTracks', () => {
  it('leaves an already-passing pack untouched — no regenerateOne calls at all', async () => {
    const songs = [songWith({ trackNo: 1 }), songWith({ trackNo: 2 })];
    let calls = 0;
    const result = await recomposeBlockingTracks(songs, async (current, trackNo, feedback) => {
      calls += 1;
      return current;
    });
    expect(calls).toBe(0);
    expect(result.log).toEqual([]);
    expect(result.songs).toBe(songs);
  });

  it('retries a blocking track and stops once it passes, without touching other tracks', async () => {
    const songs = [songWith({ trackNo: 1, stylePrompt: BLOCKING_STYLE_PROMPT }), songWith({ trackNo: 2 })];
    let calls = 0;
    const result = await recomposeBlockingTracks(songs, async (current, trackNo, feedback) => {
      calls += 1;
      expect(trackNo).toBe(1);
      expect(feedback.length).toBeGreaterThan(0);
      return current.map(song => (song.trackNo === trackNo ? songWith({ trackNo }) : song));
    });
    expect(calls).toBe(1);
    expect(result.log).toHaveLength(1);
    expect(result.log[0]).toMatchObject({ trackNo: 1, attempts: 1, resolved: true, abortedEarly: false, finalBlockingCount: 0 });
    expect(result.songs.find(s => s.trackNo === 1)!.stylePrompt).not.toBe(BLOCKING_STYLE_PROMPT);
    // Track 2 was never a target — passed to regenerateOne callback's `current` snapshot, never regenerated itself.
    expect(result.songs.find(s => s.trackNo === 2)!.stylePrompt).toBe(songs[1].stylePrompt);
  });

  it('never retries more than RECOMPOSE_MAX_RETRIES (2) times, even if every attempt still fails', async () => {
    const songs = [songWith({ trackNo: 1, stylePrompt: BLOCKING_STYLE_PROMPT })];
    let calls = 0;
    const result = await recomposeBlockingTracks(songs, async (current, trackNo) => {
      calls += 1;
      // Every regeneration attempt returns a *different* still-blocking style prompt, so the
      // blocking count technically doesn't strictly increase or decrease in an ambiguous way —
      // here it stays flagged (still 1 descriptor) every time, so the abort-on-no-improvement
      // path also kicks in, but the hard cap is what this test asserts.
      return current.map(song => (song.trackNo === trackNo ? { ...song, stylePrompt: `still-bad-${calls}` } : song));
    });
    expect(calls).toBeLessThanOrEqual(RECOMPOSE_MAX_RETRIES);
    expect(result.log[0].attempts).toBeLessThanOrEqual(RECOMPOSE_MAX_RETRIES);
    // Always ships — never throws, never leaves the track missing.
    expect(result.songs.find(s => s.trackNo === 1)).toBeDefined();
  });

  it('aborts early (before using all retries) if an attempt does not reduce the blocking count, and keeps the result with a warning', async () => {
    const songs = [songWith({ trackNo: 1, stylePrompt: BLOCKING_STYLE_PROMPT })];
    let calls = 0;
    const result = await recomposeBlockingTracks(songs, async (current, trackNo) => {
      calls += 1;
      // First attempt "fixes" nothing — same 1-descriptor prompt, same blocking count.
      return current;
    });
    expect(calls).toBe(1); // aborted after attempt 1, never used the 2nd retry
    expect(result.log[0]).toMatchObject({ trackNo: 1, attempts: 1, resolved: false, abortedEarly: true });
    expect(result.songs.find(s => s.trackNo === 1)!.warnings.some(w => w.includes('재작곡'))).toBe(true);
  });

  it('retries each blocking track independently — a track that keeps failing does not stop a later track from being retried', async () => {
    const songs = [
      songWith({ trackNo: 1, stylePrompt: BLOCKING_STYLE_PROMPT }),
      songWith({ trackNo: 2, stylePrompt: BLOCKING_STYLE_PROMPT })
    ];
    const fixedTrackNos = new Set<number>();
    const result = await recomposeBlockingTracks(songs, async (current, trackNo) => {
      if (trackNo === 2) {
        fixedTrackNos.add(2);
        return current.map(song => (song.trackNo === 2 ? songWith({ trackNo: 2 }) : song));
      }
      return current; // track 1 never improves
    });
    expect(fixedTrackNos.has(2)).toBe(true);
    const track1Log = result.log.find(entry => entry.trackNo === 1)!;
    const track2Log = result.log.find(entry => entry.trackNo === 2)!;
    expect(track1Log.resolved).toBe(false);
    expect(track2Log.resolved).toBe(true);
  });
});

/**
 * TASK (ratio-based lyric language mismatch) — this loop's own internal
 * scoreComposition() call previously always omitted lyricLanguage entirely
 * (a pre-existing gap, unrelated to this task's own fix). The NEW per-track
 * language-ratio check in compositionScorer.ts is gated on opts.lyricLanguage
 * being explicitly present, so that pre-existing gap never turns into a
 * false-block — it just means this loop couldn't retry a genuine language
 * mismatch at all until this new 4th param was added. providers/index.ts's
 * real call site now passes opts.lyricLanguage through; these two tests
 * prove the difference that makes.
 */
describe('[ratio-based lyric language mismatch] recomposeBlockingTracks — lyricLanguage plumbing', () => {
  function koreanFillerLines(count: number): string {
    return Array.from({ length: count }, (_, i) => `조용한 아침 햇살이 창가에 부드럽게 내려와요 번호 ${i + 1}`).join('\n');
  }
  function brokenKoreanTargetLyrics(): string {
    return `[verse 1]\n${Array.from({ length: 20 }, (_, i) => `this is an entirely english verse line number ${i}`).join('\n')}\n\n[end]`;
  }

  it('passing lyricLanguage threads through to the new language-ratio blocking check, so a wrong-language track actually gets retried', async () => {
    const songs = [songWith({ trackNo: 1, lyrics: brokenKoreanTargetLyrics() })];
    let calls = 0;
    const result = await recomposeBlockingTracks(songs, async (current, trackNo) => {
      calls += 1;
      return current.map(song => (song.trackNo === trackNo ? songWith({ trackNo, lyrics: `[verse 1]\n${koreanFillerLines(15)}\n\n[end]` }) : song));
    }, [], 'korean');
    expect(calls).toBe(1);
    expect(result.log).toHaveLength(1);
    expect(result.log[0]).toMatchObject({ trackNo: 1, resolved: true });
  });

  it('omitting lyricLanguage means the exact same wrong-language track is silently never retried (the real-world consequence of the gap this param closes)', async () => {
    const songs = [songWith({ trackNo: 1, lyrics: brokenKoreanTargetLyrics() })];
    let calls = 0;
    const result = await recomposeBlockingTracks(songs, async (current, trackNo) => {
      calls += 1;
      return current;
    });
    expect(calls).toBe(0);
    expect(result.log).toEqual([]);
  });
});

describe('[v3.64 TASK D] recomposeBlockingTracks retries a song whose hook duplicates channel history', () => {
  it('retries and resolves once the regenerated hook is genuinely new', async () => {
    const songs = [songWith({ trackNo: 1, hookPhrase: 'I Won\'t Forget' })];
    const result = await recomposeBlockingTracks(
      songs,
      async (current, trackNo) => current.map(song => (song.trackNo === trackNo ? { ...song, hookPhrase: 'A Brand New Hook' } : song)),
      ['I Won\'t Forget']
    );
    expect(result.log[0].resolved).toBe(true);
    expect(result.songs[0].hookPhrase).toBe('A Brand New Hook');
  });

  it('without historicalHooks passed in, a duplicate-with-history hook is never even flagged (matches scoreComposition\'s own opt-in default)', async () => {
    const songs = [songWith({ trackNo: 1, hookPhrase: 'I Won\'t Forget' })];
    let calls = 0;
    const result = await recomposeBlockingTracks(songs, async current => {
      calls += 1;
      return current;
    });
    expect(calls).toBe(0);
    expect(result.log).toEqual([]);
  });
});

/**
 * v5.14 (compositionScorer follow-up to v5.12's channel-fixed vocal quota
 * work) — mirrors the lyricLanguage-plumbing describe block above exactly:
 * a fixed-quota channel's male-only track whose stylePrompt leaks a female
 * descriptor is a real blocking finding (compositionScorer.ts's new
 * male/female text-leak checks), and this new 5th param is what makes this
 * loop actually retry it — the same "omitted = never even flagged" contract
 * every other opt-in param in this loop already has.
 */
describe('[v5.14 compositionScorer follow-up] recomposeBlockingTracks — vocalQuotaOverride plumbing', () => {
  const fixedMaleQuota = { male: 15, female: 0, mixed: 3 };
  function maleOnlySongLeakingFemaleDescriptor(): SongIdea {
    return songWith({
      trackNo: 1,
      vocalType: 'male',
      stylePrompt: `${songWith({ trackNo: 1 }).stylePrompt}, soft warm female alto touch`
    });
  }

  it('passing vocalQuotaOverride threads through to the new fixed-quota text-leak checks, so a leaking male-only track actually gets retried', async () => {
    const songs = [maleOnlySongLeakingFemaleDescriptor()];
    let calls = 0;
    const result = await recomposeBlockingTracks(songs, async (current, trackNo) => {
      calls += 1;
      return current.map(song => (song.trackNo === trackNo ? songWith({ trackNo, vocalType: 'male' }) : song));
    }, [], undefined, fixedMaleQuota);
    expect(calls).toBe(1);
    expect(result.log).toHaveLength(1);
    expect(result.log[0]).toMatchObject({ trackNo: 1, resolved: true });
  });

  it('omitting vocalQuotaOverride means the exact same leaking male-only track is silently never retried (the real-world consequence of the gap this param closes)', async () => {
    const songs = [maleOnlySongLeakingFemaleDescriptor()];
    let calls = 0;
    const result = await recomposeBlockingTracks(songs, async current => {
      calls += 1;
      return current;
    });
    expect(calls).toBe(0);
    expect(result.log).toEqual([]);
  });
});
