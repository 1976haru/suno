import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateBlueprint, generateChunkWithSplitRetry, runWithConcurrencyLimit, type GenerateChunkIdentity } from '../src/providers';
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

describe('[v3.20/v3.21] generateBlueprint end-to-end with a truncating Anthropic call', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('completes a 5-song request with correct trackNo continuity even though every multi-song chunk truncates', async () => {
    // TASK v3.21 — generateBlueprint's Anthropic branch now chunks into
    // <=3-song pieces itself (settings.batchSize=12 above gets clamped to 3),
    // so to still exercise the split-retry path end-to-end this mock fails
    // anything above 1 song, forcing every chunk down to individual songs.
    global.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const count = body.user.songCount as number;
      const offset = body.user.trackNoOffset as number;
      if (count > 1) {
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

  it('the default chunk size (settings.batchSize unset) never requests more than REALTIME_CHUNK_SIZE_MAX(3) songs at once', async () => {
    const requestedCounts: number[] = [];
    global.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const count = body.user.songCount as number;
      const offset = body.user.trackNoOffset as number;
      requestedCounts.push(count);
      const songs = Array.from({ length: count }, (_, i) => stubSong(offset + i + 1));
      return new Response(JSON.stringify({ blueprint: stubBlueprint(songs), usage: { inputTokens: 10, outputTokens: 10 } }), { status: 200 });
    }) as unknown as typeof fetch;

    const settingsNoBatchSize: ProviderSettings = { provider: 'anthropic', model: 'claude-sonnet-5', temperature: 0.8, proxyEndpoint: '/api/generate' };
    const opts = makeOptions({ songCount: 7 });
    const blueprint = await generateBlueprint(opts, testGenres, testMoods, testSeason, settingsNoBatchSize);

    expect(blueprint.songs).toHaveLength(7);
    expect(Math.max(...requestedCounts)).toBeLessThanOrEqual(3);
    // default is 2/chunk: ceil(7/2) = 4 chunks
    expect(requestedCounts).toHaveLength(4);
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

describe('[v3.21] runWithConcurrencyLimit', () => {
  it('never runs more than `limit` workers concurrently', async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 9 }, (_, i) => i);

    await runWithConcurrencyLimit(items, 3, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active -= 1;
    });

    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(1); // actually ran concurrently, not accidentally sequential
  });

  it('processes every item even when some fail — successes are not discarded', async () => {
    const processed: number[] = [];
    const items = [1, 2, 3, 4, 5];

    await expect(
      runWithConcurrencyLimit(items, 2, async item => {
        if (item === 3) throw new Error('boom');
        processed.push(item);
      })
    ).rejects.toThrow();

    expect(processed.sort()).toEqual([1, 2, 4, 5]);
  });

  it('aggregates every failure into one error instead of only reporting the first', async () => {
    const items = [1, 2, 3, 4];
    await expect(
      runWithConcurrencyLimit(items, 4, async item => {
        if (item % 2 === 0) throw new Error(`fail-${item}`);
      })
    ).rejects.toThrow(/2개 청크 생성에 실패했습니다/);
  });

  it('an empty item list resolves immediately with no calls', async () => {
    const worker = vi.fn(async () => {});
    await runWithConcurrencyLimit([], 3, worker);
    expect(worker).not.toHaveBeenCalled();
  });
});

describe('[v3.21] generateBlueprint (Anthropic) runs chunks after the first with real bounded concurrency', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('multiple chunk requests are genuinely in flight at once, not sequential', async () => {
    let active = 0;
    let maxActive = 0;
    global.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 10));
      active -= 1;
      const body = JSON.parse(init.body as string);
      const count = body.user.songCount as number;
      const offset = body.user.trackNoOffset as number;
      const songs = Array.from({ length: count }, (_, i) => stubSong(offset + i + 1));
      return new Response(JSON.stringify({ blueprint: stubBlueprint(songs), usage: { inputTokens: 10, outputTokens: 10 } }), { status: 200 });
    }) as unknown as typeof fetch;

    const opts = makeOptions({ songCount: 9 }); // chunk size 2 (default) -> 5 chunks: 1 sequential + 4 concurrent
    const blueprint = await generateBlueprint(opts, testGenres, testMoods, testSeason, settings);

    expect(blueprint.songs).toHaveLength(9);
    expect(maxActive).toBeGreaterThan(1);
  });

  it('a single permanently-failing chunk does not discard songs from chunks that already succeeded', async () => {
    global.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const offset = body.user.trackNoOffset as number;
      if (offset === 6) {
        // tracks 7-8 (the third non-first chunk) fail outright — a 401, not TRUNCATED, so no split-retry
        return new Response(JSON.stringify({ error: 'API 키가 올바르지 않습니다.' }), { status: 401 });
      }
      const count = body.user.songCount as number;
      const songs = Array.from({ length: count }, (_, i) => stubSong(offset + i + 1));
      return new Response(JSON.stringify({ blueprint: stubBlueprint(songs), usage: { inputTokens: 10, outputTokens: 10 } }), { status: 200 });
    }) as unknown as typeof fetch;

    // settings.batchSize=12 clamps to REALTIME_CHUNK_SIZE_MAX(3) -> chunks [1,2,3] [4,5,6] [7,8]
    const opts = makeOptions({ songCount: 8 });
    await expect(generateBlueprint(opts, testGenres, testMoods, testSeason, settings)).rejects.toThrow();

    // can't observe the discarded partial result directly (generateBlueprint throws),
    // but every non-offset-6 chunk must still have been requested and succeeded —
    // i.e. the failure of one chunk didn't abort the others mid-flight.
    const requestedOffsets = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
      .map(call => JSON.parse((call[1] as RequestInit).body as string).user.trackNoOffset as number);
    expect(requestedOffsets.sort((a, b) => a - b)).toEqual([0, 3, 6]);
  });
});

describe('[v3.21] preassignment prevents title/hook collisions between parallel chunks', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('every chunk request carries preassignedSongs for exactly its own trackNo range, with no title/hook overlap across chunks', async () => {
    const requestedPreassignments: Array<{ offset: number; slots: Array<{ trackNo: number; title: string; hookPhrase: string }> }> = [];
    global.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      const offset = body.user.trackNoOffset as number;
      const count = body.user.songCount as number;
      requestedPreassignments.push({ offset, slots: body.user.preassignedSongs });
      // echo back the model writing exactly the preassigned title/hook, as the system prompt instructs it to
      const songs = (body.user.preassignedSongs as Array<{ trackNo: number; title: string; hookPhrase: string }>).map((slot: { trackNo: number; title: string; hookPhrase: string }) => ({
        ...stubSong(slot.trackNo),
        title: slot.title,
        hookPhrase: slot.hookPhrase
      }));
      expect(songs).toHaveLength(count);
      return new Response(JSON.stringify({ blueprint: stubBlueprint(songs), usage: { inputTokens: 10, outputTokens: 10 } }), { status: 200 });
    }) as unknown as typeof fetch;

    const opts = makeOptions({ songCount: 8 });
    const blueprint = await generateBlueprint(opts, testGenres, testMoods, testSeason, settings);

    // every request got a non-empty, correctly-sized preassignment for its own range
    for (const { slots } of requestedPreassignments) {
      expect(slots.length).toBeGreaterThan(0);
    }
    const allPreassignedTrackNos = requestedPreassignments.flatMap(r => r.slots.map(s => s.trackNo)).sort((a, b) => a - b);
    expect(allPreassignedTrackNos).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    // titles/hooks are unique across the whole pack (preallocateSongSlots' job)
    expect(new Set(blueprint.songs.map(s => s.title)).size).toBe(8);
    expect(new Set(blueprint.songs.map(s => s.hookPhrase)).size).toBe(8);
  });
});

describe('[v3.21] prompt cache boundary stays byte-identical across chunk 1 and later parallel chunks', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('cacheableSystemBlocks sent to Anthropic are byte-for-byte identical for every chunk in the same generateBlueprint call', async () => {
    const requestedSystemBlocks: unknown[] = [];
    global.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      requestedSystemBlocks.push(body.cacheableSystemBlocks);
      const offset = body.user.trackNoOffset as number;
      const count = body.user.songCount as number;
      const songs = Array.from({ length: count }, (_, i) => stubSong(offset + i + 1));
      return new Response(JSON.stringify({ blueprint: stubBlueprint(songs), usage: { inputTokens: 10, outputTokens: 10 } }), { status: 200 });
    }) as unknown as typeof fetch;

    const opts = makeOptions({ songCount: 7 });
    await generateBlueprint(opts, testGenres, testMoods, testSeason, settings);

    expect(requestedSystemBlocks.length).toBeGreaterThan(1);
    const first = JSON.stringify(requestedSystemBlocks[0]);
    for (const blocks of requestedSystemBlocks) {
      expect(JSON.stringify(blocks)).toBe(first);
    }
  });
});

describe('[v3.21] single-song budget-boost retry', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('retries a truncating single song exactly once with maxTokensBudgetSongs set, and succeeds if the boosted call does', async () => {
    let calls = 0;
    global.fetch = vi.fn(async (_url: string, init: RequestInit) => {
      calls += 1;
      const body = JSON.parse(init.body as string);
      if (!body.maxTokensBudgetSongs) {
        return new Response(JSON.stringify({ error: '잘렸습니다', code: 'TRUNCATED' }), { status: 500 });
      }
      const songs = [stubSong(body.user.trackNoOffset + 1)];
      return new Response(JSON.stringify({ blueprint: stubBlueprint(songs), usage: { inputTokens: 10, outputTokens: 10 } }), { status: 200 });
    }) as unknown as typeof fetch;

    const opts = makeOptions({ songCount: 1 });
    const identity: GenerateChunkIdentity = { base: null, locked: null };
    const songs = await generateChunkWithSplitRetry([1], opts, testGenres, testMoods, testSeason, settings, { usedTitles: [], usedHooks: [] }, identity);

    expect(songs).toHaveLength(1);
    expect(calls).toBe(2); // 1 normal attempt (fails) + 1 boosted retry (succeeds)
  });

  it('gives up after the boosted retry also truncates, without retrying a third time', async () => {
    let calls = 0;
    global.fetch = vi.fn(async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: '잘렸습니다', code: 'TRUNCATED' }), { status: 500 });
    }) as unknown as typeof fetch;

    const opts = makeOptions({ songCount: 1 });
    const identity: GenerateChunkIdentity = { base: null, locked: null };

    await expect(
      generateChunkWithSplitRetry([1], opts, testGenres, testMoods, testSeason, settings, { usedTitles: [], usedHooks: [] }, identity)
    ).rejects.toThrow(/곡 수를 줄여보세요/);
    expect(calls).toBe(2); // normal + one boosted retry, then gives up
  });
});
