import { afterEach, describe, expect, it, vi } from 'vitest';
import { batchIndexFromCustomId, stitchBatchResults, type BatchRequestResult } from '../src/core/batchStitcher';
import { buildBatchRequestSpecs } from '../src/providers/batchAnthropic';
import batchHandler, { __internal as batchApiInternal } from '../api/batch.js';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { PlaylistBlueprint, ProviderSettings } from '../src/types';

function makeBlueprint(songs: PlaylistBlueprint['songs']): PlaylistBlueprint {
  return {
    projectTitle: 'Test',
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

function makeSong(trackNo: number) {
  return {
    trackNo,
    title: `Song ${trackNo}`,
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: `Hook ${trackNo}`,
    stylePrompt: 'style',
    lyrics: '[chorus]\nHook',
    thumbnailText: 'x',
    youtube: { title: 'x', description: 'x', tags: ['x'], thumbnailText: 'x' },
    qualityScore: 0,
    warnings: []
  };
}

describe('[E2] batchIndexFromCustomId', () => {
  it('parses the numeric index out of a "bN" custom_id', () => {
    expect(batchIndexFromCustomId('b0')).toBe(0);
    expect(batchIndexFromCustomId('b12')).toBe(12);
  });

  it('returns a large sentinel for an unrecognized custom_id shape', () => {
    expect(batchIndexFromCustomId('not-a-batch-id')).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('[E2] stitchBatchResults (pure)', () => {
  const opts = makeOptions();

  it('reassembles a full blueprint from out-of-order results', () => {
    const results: BatchRequestResult[] = [
      { customId: 'b1', blueprint: makeBlueprint([makeSong(7), makeSong(8)]), usage: { inputTokens: 100, outputTokens: 50 }, error: null },
      { customId: 'b0', blueprint: makeBlueprint([makeSong(1), makeSong(2)]), usage: { inputTokens: 200, outputTokens: 80, cacheReadInputTokens: 150 }, error: null }
    ];
    const stitched = stitchBatchResults(opts, results);
    expect(stitched.blueprint?.songs.map(s => s.trackNo)).toEqual([1, 2, 7, 8]);
    expect(stitched.failedBatchIndexes).toEqual([]);
    expect(stitched.totalUsage.inputTokens).toBe(300);
    expect(stitched.totalUsage.outputTokens).toBe(130);
    expect(stitched.totalUsage.cacheReadInputTokens).toBe(150);
  });

  it('records a failed batch index and still returns the rest of the blueprint', () => {
    const results: BatchRequestResult[] = [
      { customId: 'b0', blueprint: makeBlueprint([makeSong(1)]), usage: null, error: null },
      { customId: 'b1', blueprint: null, usage: null, error: '배치 요청 실패' }
    ];
    const stitched = stitchBatchResults(opts, results);
    expect(stitched.blueprint?.songs.map(s => s.trackNo)).toEqual([1]);
    expect(stitched.failedBatchIndexes).toEqual([1]);
  });

  it('returns a null blueprint (not a throw) when every batch failed', () => {
    const results: BatchRequestResult[] = [
      { customId: 'b0', blueprint: null, usage: null, error: 'failed' },
      { customId: 'b1', blueprint: null, usage: null, error: 'failed' }
    ];
    const stitched = stitchBatchResults(opts, results);
    expect(stitched.blueprint).toBeNull();
    expect(stitched.failedBatchIndexes).toEqual([0, 1]);
  });
});

describe('[E2] buildBatchRequestSpecs', () => {
  const settings: ProviderSettings = { provider: 'anthropic', model: 'claude-sonnet-4-5', temperature: 0.8 };

  it('produces one request per sub-batch with sequential b0/b1/... custom_ids', () => {
    const opts = makeOptions({ songCount: 18 });
    const specs = buildBatchRequestSpecs(opts, testGenres, testMoods, testSeason, settings, undefined, 6);
    expect(specs.map(s => s.customId)).toEqual(['b0', 'b1', 'b2']);
    expect(specs.reduce((sum, s) => sum + s.batchSongCount, 0)).toBe(18);
  });

  it('[E1 boundary check] every request shares byte-identical cacheableSystemBlocks (the same stable prefix across the whole job)', () => {
    const opts = makeOptions({ songCount: 18 });
    const specs = buildBatchRequestSpecs(opts, testGenres, testMoods, testSeason, settings, undefined, 6);
    expect(specs[1].cacheableSystemBlocks).toEqual(specs[0].cacheableSystemBlocks);
    expect(specs[2].cacheableSystemBlocks).toEqual(specs[0].cacheableSystemBlocks);
  });

  it('cross-pack avoid history is threaded into every request (not just the first)', () => {
    const opts = makeOptions({ songCount: 12 });
    const specs = buildBatchRequestSpecs(opts, testGenres, testMoods, testSeason, settings, { usedTitles: ['Old Title'], usedHooks: ['Old Hook'] }, 6);
    for (const spec of specs) {
      expect(JSON.stringify(spec.user)).toContain('Old Title');
      expect(JSON.stringify(spec.user)).toContain('Old Hook');
    }
  });

  it('volatileSystemText carries the correct track offset per batch (not cached, so it must vary)', () => {
    const opts = makeOptions({ songCount: 12 });
    const specs = buildBatchRequestSpecs(opts, testGenres, testMoods, testSeason, settings, undefined, 6);
    expect(specs[0].volatileSystemText).toContain('tracks 1 to 6');
    expect(specs[1].volatileSystemText).toContain('tracks 7 to 12');
  });
});

describe('[E2] api/batch.js internals', () => {
  it('buildAnthropicSystem matches the same cache_control shape as api/generate.js', () => {
    const result = batchApiInternal.buildAnthropicSystem({
      cacheableSystemBlocks: ['stable rules', 'channel block'],
      volatileSystemText: 'batch note'
    });
    expect(result).toEqual([
      { type: 'text', text: 'stable rules', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'channel block', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'batch note' }
    ]);
  });

  it('parseJsonl parses one JSON object per non-empty line', () => {
    const jsonl = '{"a":1}\n{"b":2}\n\n{"c":3}';
    expect(batchApiInternal.parseJsonl(jsonl)).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  it('safeParseBlueprint returns null (not a throw) on unrecoverable garbage — batch mode has no client to surface a thrown error to', () => {
    expect(batchApiInternal.safeParseBlueprint('not json at all')).toBeNull();
  });
});

describe('[v3.18] api/batch.js omits temperature (deprecated on claude-sonnet-5 and opus-4-7+)', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('createBatch (action: create) sends per-request params with no temperature key for the default model', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ id: 'batch_1', processing_status: 'in_progress', request_counts: null }),
      { status: 200 }
    )) as unknown as typeof fetch;

    const res = { setHeader: () => {}, status() { return this; }, json() {}, end: () => {} };
    const req = {
      method: 'POST',
      headers: {},
      body: JSON.stringify({
        action: 'create',
        requests: [
          { customId: 'b0', model: 'claude-sonnet-5', temperature: 0.8, batchSize: 6, system: 'stable system', user: { hello: 'world' } }
        ]
      })
    };

    await batchHandler(req as never, res as never);

    const sentBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(sentBody.requests[0].params).not.toHaveProperty('temperature');
  });
});

describe('[v3.19] api/batch.js surfaces failure detail (was silent: "요청에 실패" with no cause)', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalDebugFlag = process.env.DEBUG_ANTHROPIC;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    if (originalDebugFlag === undefined) delete process.env.DEBUG_ANTHROPIC;
    else process.env.DEBUG_ANTHROPIC = originalDebugFlag;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockCreateRequest() {
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'custom_id: duplicate value' } }),
      { status: 400 }
    )) as unknown as typeof fetch;

    const jsonBody: { status?: number; payload?: { error?: string } } = {};
    const res = {
      setHeader: () => {},
      status(code: number) {
        jsonBody.status = code;
        return this;
      },
      json(payload: { error?: string }) {
        jsonBody.payload = payload;
      },
      end: () => {}
    };
    const req = {
      method: 'POST',
      headers: {},
      body: JSON.stringify({
        action: 'create',
        requests: [
          { customId: 'b0', model: 'claude-sonnet-5', batchSize: 6, system: 'stable system', user: { hello: 'world' } }
        ]
      })
    };
    return { req, res, jsonBody };
  }

  it('appends the upstream detail to the response error message', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    const { req, res, jsonBody } = mockCreateRequest();

    await batchHandler(req as never, res as never);

    expect(jsonBody.status).toBe(400);
    expect(jsonBody.payload?.error).toContain('Anthropic batch create failed: 400');
    expect(jsonBody.payload?.error).toContain('custom_id: duplicate value');
  });

  it('DEBUG_ANTHROPIC unset (default): no [BATCH DIAG] console noise', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    delete process.env.DEBUG_ANTHROPIC;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { req, res } = mockCreateRequest();

    await batchHandler(req as never, res as never);

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('DEBUG_ANTHROPIC=1: logs [BATCH DIAG] with the operation and upstream response', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    process.env.DEBUG_ANTHROPIC = '1';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { req, res } = mockCreateRequest();

    await batchHandler(req as never, res as never);

    const diagCalls = consoleSpy.mock.calls.map(call => call.join(' '));
    expect(diagCalls.some(line => line.includes('[BATCH DIAG] operation=') && line.includes('create'))).toBe(true);
    expect(diagCalls.some(line => line.includes('upstream response') && line.includes('duplicate value'))).toBe(true);
  });
});

describe('[v3.23] api/batch.js logs a request body summary on create when DEBUG_ANTHROPIC=1', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalFlag = process.env.DEBUG_ANTHROPIC;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    if (originalFlag === undefined) delete process.env.DEBUG_ANTHROPIC;
    else process.env.DEBUG_ANTHROPIC = originalFlag;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockCreateRequest() {
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ id: 'batch_1', processing_status: 'in_progress', request_counts: null }),
      { status: 200 }
    )) as unknown as typeof fetch;
    const res = { setHeader: () => {}, status() { return this; }, json() {}, end: () => {} };
    const req = {
      method: 'POST',
      headers: {},
      body: JSON.stringify({
        action: 'create',
        requests: [
          { customId: 'b0', model: 'claude-sonnet-5', batchSize: 6, system: 'stable system', user: { hello: 'world' } },
          { customId: 'b1', model: 'claude-sonnet-5', batchSize: 6, system: 'stable system', user: { hello: 'world2' } }
        ]
      })
    };
    return { req, res };
  }

  it('DEBUG_ANTHROPIC unset (default): no request-summary log', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    delete process.env.DEBUG_ANTHROPIC;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { req, res } = mockCreateRequest();

    await batchHandler(req as never, res as never);

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('DEBUG_ANTHROPIC=1: logs item count, custom_id uniqueness, and per-item model/max_tokens/temperature presence', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    process.env.DEBUG_ANTHROPIC = '1';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { req, res } = mockCreateRequest();

    await batchHandler(req as never, res as never);

    const diagCalls = consoleSpy.mock.calls.map(call => call.join(' '));
    const summaryLine = diagCalls.find(line => line.includes('[BATCH DIAG] request summary'));
    expect(summaryLine).toBeDefined();
    expect(summaryLine).toContain('itemCount= 2');
    expect(summaryLine).toContain('allHaveCustomId= true');
    expect(summaryLine).toContain('duplicateCustomIds= false');
    expect(summaryLine).toContain('claude-sonnet-5');
    // temperature is excluded on claude-sonnet-5 (TEMPERATURE_SUPPORTED), so hasTemperature must be false
    expect(summaryLine).toContain('"hasTemperature":false');
  });
});

describe('[v3.19] api/batch.js DISABLE_PROMPT_CACHE escape hatch (diagnostic only, not carried to api/generate.js)', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalFlag = process.env.DISABLE_PROMPT_CACHE;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    if (originalFlag === undefined) delete process.env.DISABLE_PROMPT_CACHE;
    else process.env.DISABLE_PROMPT_CACHE = originalFlag;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockCreateRequest() {
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ id: 'batch_1', processing_status: 'in_progress', request_counts: null }),
      { status: 200 }
    )) as unknown as typeof fetch;
    const res = { setHeader: () => {}, status() { return this; }, json() {}, end: () => {} };
    const req = {
      method: 'POST',
      headers: {},
      body: JSON.stringify({
        action: 'create',
        requests: [{
          customId: 'b0',
          model: 'claude-sonnet-5',
          batchSize: 6,
          cacheableSystemBlocks: ['STABLE RULES TEXT', 'STABLE CHANNEL BLOCK'],
          volatileSystemText: 'Batch mode: tracks 1-6 of 12',
          user: { hello: 'world' }
        }]
      })
    };
    return { req, res };
  }

  it('default (unset): each request still carries cache_control ephemeral blocks', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    delete process.env.DISABLE_PROMPT_CACHE;
    const { req, res } = mockCreateRequest();

    await batchHandler(req as never, res as never);

    const sentBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(Array.isArray(sentBody.requests[0].params.system)).toBe(true);
    expect(sentBody.requests[0].params.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });

  it('DISABLE_PROMPT_CACHE=1: system is sent as one plain string with no cache_control', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    process.env.DISABLE_PROMPT_CACHE = '1';
    const { req, res } = mockCreateRequest();

    await batchHandler(req as never, res as never);

    const sentBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(typeof sentBody.requests[0].params.system).toBe('string');
    expect(sentBody.requests[0].params.system).not.toContain('ephemeral');
    expect(sentBody.requests[0].params.system).toContain('STABLE RULES TEXT');
  });
});

describe('[v3.20] api/batch.js computeMaxTokens raised budget + model-aware cap', () => {
  it('uses 2400/song + 3000 overhead, capped at the registered model ceiling', () => {
    expect(batchApiInternal.computeMaxTokens(6)).toBe(17_400);
    expect(batchApiInternal.computeMaxTokens(12)).toBe(31_800);
    expect(batchApiInternal.maxOutputTokensFor('claude-sonnet-5')).toBe(128_000);
    expect(batchApiInternal.maxOutputTokensFor('claude-haiku-4-5-20251001')).toBe(64_000);
    expect(batchApiInternal.maxOutputTokensFor('unknown-model')).toBe(32_000);
  });
});

describe('[v3.20] getBatchResults (action: results) rejects a stop_reason:"max_tokens" success as an error, never a silent partial parse', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockStatusThenResults(resultLine: Record<string, unknown>) {
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('/results')) {
        return new Response(JSON.stringify(resultLine), { status: 200 });
      }
      if (String(url).includes('/messages/batches/')) {
        return new Response(JSON.stringify({
          processing_status: 'ended',
          request_counts: null,
          results_url: 'https://api.anthropic.com/v1/messages/batches/batch_1/results'
        }), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;
  }

  function mockResultsRequest() {
    const jsonBody: { status?: number; payload?: { done?: boolean; results?: unknown[] } } = {};
    const res = {
      setHeader: () => {},
      status(code: number) { jsonBody.status = code; return this; },
      json(payload: { done?: boolean; results?: unknown[] }) { jsonBody.payload = payload; },
      end: () => {}
    };
    const req = { method: 'POST', headers: {}, body: JSON.stringify({ action: 'results', batchId: 'batch_1' }) };
    return { req, res, jsonBody };
  }

  it('a succeeded result with stop_reason "max_tokens" is surfaced as an error, even though the JSON would otherwise parse', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    const parseableButTruncated = JSON.stringify({ songs: [{ trackNo: 1, title: 'Complete Song' }] });
    mockStatusThenResults({
      custom_id: 'b0',
      result: {
        type: 'succeeded',
        message: { stop_reason: 'max_tokens', content: [{ type: 'text', text: parseableButTruncated }], usage: {} }
      }
    });
    const { req, res, jsonBody } = mockResultsRequest();

    await batchHandler(req as never, res as never);

    const result = (jsonBody.payload?.results as Array<{ blueprint: unknown; error: string | null }>)[0];
    expect(result.blueprint).toBeNull();
    expect(result.error).toContain('잘렸습니다');
  });

  it('a succeeded result with a normal stop_reason parses normally', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    const validJson = JSON.stringify({ songs: [{ trackNo: 1, title: 'Complete Song' }] });
    mockStatusThenResults({
      custom_id: 'b0',
      result: {
        type: 'succeeded',
        message: { stop_reason: 'end_turn', content: [{ type: 'text', text: validJson }], usage: {} }
      }
    });
    const { req, res, jsonBody } = mockResultsRequest();

    await batchHandler(req as never, res as never);

    const result = (jsonBody.payload?.results as Array<{ blueprint: unknown; error: string | null }>)[0];
    expect(result.error).toBeNull();
    expect(result.blueprint).not.toBeNull();
  });
});
