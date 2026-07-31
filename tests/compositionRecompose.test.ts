import { describe, expect, it } from 'vitest';
import { RECOMPOSE_MAX_RETRIES, recomposeBlockingTracks } from '../src/core/compositionRecompose';
import type { SongIdea } from '../src/types';

/**
 * TASK v3.62 (TASK 3) — recomposeBlockingTracks is provider-agnostic (the
 * regeneration call is injected), so these tests drive it with a fake
 * regenerateOne instead of mocking network calls, matching this file's own
 * doc comment on why the dependency is injected in the first place.
 */

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
    lyrics: '[verse 1]\nline one\n[chorus]\nHook line\nHook line\n[end]',
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
