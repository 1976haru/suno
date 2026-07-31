import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateBlueprint } from '../src/providers';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { genrePacks } from '../src/data/presets';
import { makeOptions, testMoods, testSeason } from './fixtures';
import type { PlaylistBlueprint, ProviderSettings, SongIdea } from '../src/types';

/**
 * TASK v3.62 (TASK 3) — generateBlueprint's `enableRecompose` parameter
 * (default false) gates whether providers/index.ts's automatic
 * recomposeBlockingTracks loop runs after a real-API generation.
 *
 * Note on why the blocking-content test uses an artist-reference leak
 * (not a too-short style prompt): reconcileWithPreassignedSlot (see
 * batchPreallocation.ts) already discards and rebuilds any API-returned
 * stylePrompt that doesn't contain every one of the slot's own
 * vocalText/moneyChordText/genreText/signatureSound/hookDeviceText/
 * introTextureText/instrumentSet substrings verbatim — a pre-existing
 * safety net, unrelated to this task, that runs before compositionScorer
 * ever sees the song. A short synthetic stub like 'style' never survives
 * that reconciliation to reach the recompose loop at all. An artist-name
 * leak tacked onto an otherwise-complete stylePrompt does survive it
 * (reconciliation only checks required substrings are present, not that
 * nothing extra was added), which is why this test builds the mock
 * response from a real preallocated slot's own fields plus a leak,
 * instead of a short placeholder string.
 */

const settings: ProviderSettings = { provider: 'anthropic', model: 'claude-sonnet-5', temperature: 0.8, proxyEndpoint: '/api/generate', batchSize: 3 };
const avoid = { usedTitles: [] as string[], usedHooks: [] as string[] };

function stubSong(trackNo: number, stylePrompt: string): SongIdea {
  return {
    trackNo,
    title: `Song ${trackNo}`,
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: `Hook ${trackNo}`,
    stylePrompt,
    lyrics: '[chorus]\nline\n[end]',
    youtube: { title: 'x', description: 'x', tags: ['x'] },
    qualityScore: 0,
    warnings: []
  };
}

function stubBlueprint(songs: SongIdea[]): PlaylistBlueprint {
  return {
    projectTitle: 'Test Pack',
    channelName: 'Test Channel',
    oneLineConcept: 'concept',
    sonicSignature: 'sig',
    vocalSignature: 'vocal',
    lyricRules: [],
    harmonyRules: [],
    visualRules: [],
    songs
  };
}

/** A "complete" stylePrompt that survives reconcileWithPreassignedSlot unchanged (contains every required slot field verbatim), optionally with extra text appended (e.g. an artist-name leak). */
function completeStylePromptFor(slot: ReturnType<typeof preallocateSongSlots>[number], extra = ''): string {
  const parts = [slot.vocalText, slot.moneyChordText, slot.genreText, slot.signatureSound, slot.hookDeviceText, slot.introTextureText, ...(slot.instrumentSet || [])].filter(Boolean);
  return `${parts.join(', ')}${extra}, ${slot.tempo} BPM`;
}

describe('[v3.62 TASK 3] generateBlueprint enableRecompose wiring', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('defaults to false — a short stub pack makes exactly the base number of calls, with no automatic retry', async () => {
    global.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const count = body.user.songCount as number;
      const offset = body.user.trackNoOffset as number;
      const songs = Array.from({ length: count }, (_, i) => stubSong(offset + i + 1, 'style'));
      return new Response(JSON.stringify({ blueprint: stubBlueprint(songs), usage: { inputTokens: 10, outputTokens: 10 } }), { status: 200 });
    }) as unknown as typeof fetch;

    const genre = genrePacks.find(g => g.id === 'oldpop-british-beat')!;
    const opts = makeOptions({ songCount: 2, genreIds: ['oldpop-british-beat'] });
    const blueprint = await generateBlueprint(opts, [genre], testMoods, testSeason, settings, undefined, avoid);

    expect(blueprint.songs).toHaveLength(2);
    // 2 songs at batchSize 3 => a single chunk => a single call, with no recompose calls added (enableRecompose omitted).
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('enableRecompose=true leaves a clean, complete pack alone — no extra calls beyond the base generation', async () => {
    // A 'timeless' (no era restriction) genre, unlike oldpop-british-beat below — its own
    // deterministic slot fields (e.g. introTextureText) are template/local-path data this task
    // deliberately didn't touch (see claudeCodeBridge.ts's TASK 1 scope note), and some of those
    // values are themselves anachronistic-sounding for the 1950s-60s bucket independent of
    // anything an LLM composes — not this test's concern, so it picks a genre where that overlap
    // doesn't happen.
    const genre = genrePacks.find(g => g.id === 'adult-contemporary')!;
    const opts = makeOptions({ songCount: 1, genreIds: ['adult-contemporary'] });
    const slots = preallocateSongSlots(opts, [genre], avoid);

    global.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const count = body.user.songCount as number;
      const offset = body.user.trackNoOffset as number;
      const songs = Array.from({ length: count }, (_, i) => stubSong(offset + i + 1, completeStylePromptFor(slots[offset + i])));
      return new Response(JSON.stringify({ blueprint: stubBlueprint(songs), usage: { inputTokens: 10, outputTokens: 10 } }), { status: 200 });
    }) as unknown as typeof fetch;

    const blueprint = await generateBlueprint(opts, [genre], testMoods, testSeason, settings, undefined, avoid, true);

    expect(blueprint.songs).toHaveLength(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(blueprint.songs[0].warnings.some(w => w.includes('재작곡'))).toBe(false);
  });

  it('enableRecompose=true calls the recompose loop for an artist-name leak that survives reconciliation, and the pack still ships with a warning', async () => {
    const genre = genrePacks.find(g => g.id === 'oldpop-british-beat')!;
    const opts = makeOptions({ songCount: 1, genreIds: ['oldpop-british-beat'] });
    const slots = preallocateSongSlots(opts, [genre], avoid);

    global.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const count = body.user.songCount as number;
      const offset = body.user.trackNoOffset as number;
      // Always leaks, every attempt — proves the recompose loop retries and then still ships rather than looping forever.
      const songs = Array.from({ length: count }, (_, i) => stubSong(offset + i + 1, completeStylePromptFor(slots[offset + i] ?? slots[0], ', in the style of The Beatles')));
      return new Response(JSON.stringify({ blueprint: stubBlueprint(songs), usage: { inputTokens: 10, outputTokens: 10 } }), { status: 200 });
    }) as unknown as typeof fetch;

    const blueprint = await generateBlueprint(opts, [genre], testMoods, testSeason, settings, undefined, avoid, true);

    // 1 base call + at least 1 recompose retry call.
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(1);
    expect(blueprint.songs).toHaveLength(1);
    expect(blueprint.songs[0].warnings.some(w => w.includes('재작곡'))).toBe(true);
  });
});
