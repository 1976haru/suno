import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateBlueprint, generateChunkWithSplitRetry, type GenerateChunkIdentity } from '../src/providers';
import { ProxyError } from '../src/providers/proxyFetch';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { PlaylistBlueprint, ProviderSettings, SongIdea } from '../src/types';

/**
 * TASK v3.20 — real Claude output per song runs well past the local
 * generator's template, so a request that fit comfortably in the old
 * max_tokens budget can still hit stop_reason: 'max_tokens' on the actual
 * API. api/generate.js now signals this via error.code === 'TRUNCATED'
 * (ProxyError); these tests cover the client-side response — split the
 * failing chunk in half and retry, recursively, merging results in order.
 */

function stubSong(trackNo: number): SongIdea {
  return {
    trackNo,
    title: `Song ${trackNo}`,
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: `Hook ${trackNo}`,
    stylePrompt: 'style',
    lyrics: '[chorus]\nline\n[end]',
    thumbnailText: 'x',
    youtube: { title: 'x', description: 'x', tags: ['x'], thumbnailText: 'x' },
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

const settings: ProviderSettings = { provider: 'anthropic', model: 'claude-sonnet-5', temperature: 0.8, proxyEndpoint: '/api/generate', batchSize: 12 };

describe('[v3.20] generateChunkWithSplitRetry', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /** Mocks /api/generate: fails (TRUNCATED) whenever the requested songCount exceeds `failAbove`, otherwise succeeds with correctly-offset songs. */
  function mockGenerateEndpoint(failAbove: number) {
    global.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const count = body.user.songCount as number;
      const offset = body.user.trackNoOffset as number;
      if (count > failAbove) {
        return new Response(JSON.stringify({ error: 'LLM 응답이 잘렸습니다. 곡 수를 줄이거나 배치 크기를 낮추세요.', code: 'TRUNCATED' }), { status: 500 });
      }
      const songs = Array.from({ length: count }, (_, i) => stubSong(offset + i + 1));
      return new Response(JSON.stringify({ blueprint: stubBlueprint(songs), usage: { inputTokens: 10, outputTokens: 10 } }), { status: 200 });
    }) as unknown as typeof fetch;
  }

  it('a chunk that truncates whole splits into two halves and merges results in trackNo order', async () => {
    mockGenerateEndpoint(2); // only 1-2 song requests succeed
    const opts = makeOptions({ songCount: 4 });
    const identity: GenerateChunkIdentity = { base: null, locked: null };

    const songs = await generateChunkWithSplitRetry([1, 2, 3, 4], opts, testGenres, testMoods, testSeason, settings, { usedTitles: [], usedHooks: [] }, identity);

    expect(songs.map(s => s.trackNo)).toEqual([1, 2, 3, 4]);
    expect(new Set(songs.map(s => s.title)).size).toBe(4);
    expect(new Set(songs.map(s => s.hookPhrase)).size).toBe(4);
    // 1 failed full-size attempt + 2 successful half-size retries = 3 calls total
    const requestedCounts = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map(call => JSON.parse((call[1] as RequestInit).body as string).user.songCount);
    expect(requestedCounts).toEqual([4, 2, 2]);
  });

  it('recurses through multiple split levels when even a half still truncates', async () => {
    mockGenerateEndpoint(1); // only single-song requests succeed
    const opts = makeOptions({ songCount: 4 });
    const identity: GenerateChunkIdentity = { base: null, locked: null };

    const songs = await generateChunkWithSplitRetry([1, 2, 3, 4], opts, testGenres, testMoods, testSeason, settings, { usedTitles: [], usedHooks: [] }, identity);

    expect(songs.map(s => s.trackNo).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it('later sub-calls avoid titles/hooks already produced by earlier sub-calls within the same split', async () => {
    mockGenerateEndpoint(2);
    const opts = makeOptions({ songCount: 4 });
    const identity: GenerateChunkIdentity = { base: null, locked: null };

    await generateChunkWithSplitRetry([1, 2, 3, 4], opts, testGenres, testMoods, testSeason, settings, { usedTitles: [], usedHooks: [] }, identity);

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    // the second half's request must list the first half's titles/hooks as already-used
    const secondHalfCall = calls.find(call => JSON.parse((call[1] as RequestInit).body as string).user.trackNoOffset === 2);
    const secondHalfBody = JSON.parse((secondHalfCall![1] as RequestInit).body as string);
    expect(secondHalfBody.user.alreadyUsedTitles).toEqual(expect.arrayContaining(['Song 1', 'Song 2']));
    expect(secondHalfBody.user.alreadyUsedHooks).toEqual(expect.arrayContaining(['Hook 1', 'Hook 2']));
  });

  it('sets identity (base + lockedIdentity) from whichever sub-call first succeeds', async () => {
    mockGenerateEndpoint(2);
    const opts = makeOptions({ songCount: 4 });
    const identity: GenerateChunkIdentity = { base: null, locked: null };

    await generateChunkWithSplitRetry([1, 2, 3, 4], opts, testGenres, testMoods, testSeason, settings, { usedTitles: [], usedHooks: [] }, identity);

    expect(identity.base).not.toBeNull();
    expect(identity.locked).not.toBeNull();
    expect(identity.base?.sonicSignature).toBe('sig');
  });

  it('gives up with a clear "reduce song count" message once a single song alone still truncates', async () => {
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ error: 'LLM 응답이 잘렸습니다.', code: 'TRUNCATED' }),
      { status: 500 }
    )) as unknown as typeof fetch;
    const opts = makeOptions({ songCount: 2 });
    const identity: GenerateChunkIdentity = { base: null, locked: null };

    await expect(
      generateChunkWithSplitRetry([1, 2], opts, testGenres, testMoods, testSeason, settings, { usedTitles: [], usedHooks: [] }, identity)
    ).rejects.toThrow(/곡 수를 줄여보세요/);
  });

  it('a non-truncation failure (e.g. 401) is not split-retried — it propagates immediately', async () => {
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ error: 'API 키가 올바르지 않습니다.' }),
      { status: 401 }
    )) as unknown as typeof fetch;
    const opts = makeOptions({ songCount: 4 });
    const identity: GenerateChunkIdentity = { base: null, locked: null };

    await expect(
      generateChunkWithSplitRetry([1, 2, 3, 4], opts, testGenres, testMoods, testSeason, settings, { usedTitles: [], usedHooks: [] }, identity)
    ).rejects.toThrow('API 키가 올바르지 않습니다.');
    // exactly one call — no split-retry attempted for a non-TRUNCATED error
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('[v3.20] generateBlueprint end-to-end with a truncating Anthropic call', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('completes a 5-song request with correct trackNo continuity even though the whole batch truncates once', async () => {
    global.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const count = body.user.songCount as number;
      const offset = body.user.trackNoOffset as number;
      if (count > 3) {
        return new Response(JSON.stringify({ error: 'LLM 응답이 잘렸습니다.', code: 'TRUNCATED' }), { status: 500 });
      }
      const songs = Array.from({ length: count }, (_, i) => stubSong(offset + i + 1));
      return new Response(JSON.stringify({ blueprint: stubBlueprint(songs), usage: { inputTokens: 10, outputTokens: 10 } }), { status: 200 });
    }) as unknown as typeof fetch;

    const opts = makeOptions({ songCount: 5 });
    const blueprint = await generateBlueprint(opts, testGenres, testMoods, testSeason, settings);

    expect(blueprint.songs.map(s => s.trackNo).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(blueprint.songs.map(s => s.title)).size).toBe(5);
    expect(new Set(blueprint.songs.map(s => s.hookPhrase)).size).toBe(5);
  });

  it('a ProxyError with code TRUNCATED is instanceof ProxyError (the check generateChunkWithSplitRetry relies on)', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: '잘렸습니다', code: 'TRUNCATED' }), { status: 500 })) as unknown as typeof fetch;
    const { callGenerateProxy } = await import('../src/providers/proxyFetch');
    try {
      await callGenerateProxy('/api/generate', {}, {});
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ProxyError);
      expect((error as ProxyError).code).toBe('TRUNCATED');
    }
  });
});
