import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import generateHandler, { __internal as apiInternal } from '../api/generate.js';
import { buildAnthropicUserPayload, buildBatchSystemNote, buildChannelSystemBlock, buildSystemInstruction, buildUserInstruction } from '../src/core/promptComposer';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { BatchContext, PlaylistIdentity, PreassignedSongSlot } from '../src/types';

// TASK v3.21 — api/generate.js's rateLimitBuckets is module-level state that
// persists across every test in this file (same module instance, same
// 'unknown' clientIp bucket for any request that omits x-forwarded-for).
// This file alone now makes more than RATE_LIMIT_MAX_REQUESTS (10)
// generateHandler calls; without clearing between tests, late tests get
// silently 429'd (discovered the hard way — see the v3.21 GEN DIAG tests'
// x-forwarded-for header, which this beforeEach makes unnecessary going
// forward for any *new* test, though existing ones keep their header too).
beforeEach(() => {
  apiInternal.rateLimitBuckets.clear();
});

describe('[E1] Anthropic prompt caching — cache boundary placement', () => {
  it("usedTitles/usedHooks never appear inside a cached system block — only in the (uncached) user payload", () => {
    const opts = makeOptions();
    const batch: BatchContext = {
      trackNoOffset: 6,
      totalSongCount: 12,
      usedTitles: ['Hold On', 'Winter Light'],
      usedHooks: ['Hold On', 'Stay a While'],
      lockedIdentity: null
    };
    const stable = buildSystemInstruction(opts);
    const channelBlock = buildChannelSystemBlock(opts, testGenres, testMoods, testSeason);
    const user = buildAnthropicUserPayload(opts, batch);

    for (const title of batch.usedTitles) {
      expect(stable).not.toContain(title);
      expect(channelBlock).not.toContain(title);
    }
    for (const hook of batch.usedHooks) {
      expect(stable).not.toContain(hook);
      expect(channelBlock).not.toContain(hook);
    }
    expect(JSON.stringify(user.alreadyUsedTitles)).toContain('Hold On');
    expect(JSON.stringify(user.alreadyUsedHooks)).toContain('Stay a While');
  });

  it('the two cacheable system blocks are byte-identical across batch 1 and batch 5 of the same pack (only the volatile note differs)', () => {
    const opts = makeOptions();
    const identity: PlaylistIdentity = {
      oneLineConcept: 'x', sonicSignature: 'x', vocalSignature: 'x', lyricRules: [], harmonyRules: [], visualRules: []
    };
    const batch1: BatchContext = { trackNoOffset: 0, totalSongCount: 30, usedTitles: [], usedHooks: [], lockedIdentity: null };
    const batch5: BatchContext = { trackNoOffset: 24, totalSongCount: 30, usedTitles: Array.from({ length: 24 }, (_, i) => `Title ${i}`), usedHooks: Array.from({ length: 24 }, (_, i) => `Hook ${i}`), lockedIdentity: identity };

    const stable1 = buildSystemInstruction(opts);
    const stable5 = buildSystemInstruction(opts);
    const channel1 = buildChannelSystemBlock(opts, testGenres, testMoods, testSeason);
    const channel5 = buildChannelSystemBlock(opts, testGenres, testMoods, testSeason);

    expect(stable1).toBe(stable5);
    expect(channel1).toBe(channel5);

    // sanity: the batches themselves really do differ (so this isn't a vacuous pass)
    expect(batch1).not.toEqual(batch5);
  });

  it("buildAnthropicSystem marks every cacheableSystemBlocks entry with cache_control: ephemeral, and appends the volatile note uncached", () => {
    const result = apiInternal.buildAnthropicSystem({
      cacheableSystemBlocks: ['STABLE RULES TEXT', 'STABLE CHANNEL BLOCK'],
      volatileSystemText: 'Batch mode: tracks 7-12 of 30'
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'text', text: 'STABLE RULES TEXT', cache_control: { type: 'ephemeral' } });
    expect(result[1]).toEqual({ type: 'text', text: 'STABLE CHANNEL BLOCK', cache_control: { type: 'ephemeral' } });
    expect(result[2]).toEqual({ type: 'text', text: 'Batch mode: tracks 7-12 of 30' });
    expect(result[2].cache_control).toBeUndefined();
  });

  it('buildAnthropicSystem falls back to a plain string when no cacheableSystemBlocks are given', () => {
    const result = apiInternal.buildAnthropicSystem({ system: 'plain system text' });
    expect(result).toBe('plain system text');
  });

  it('an empty volatileSystemText adds no extra block', () => {
    const result = apiInternal.buildAnthropicSystem({ cacheableSystemBlocks: ['A'], volatileSystemText: '' });
    expect(result).toHaveLength(1);
  });
});

describe('[E1] usage ledger tracks cache-read tokens', () => {
  it('summarizeUsage sums cacheReadTokens across records, and 0 records means 0', async () => {
    const { summarizeUsage } = await import('../src/core/usageLedger');
    const summary = summarizeUsage([
      { at: '1', provider: 'anthropic', model: 'claude-sonnet-4-5', purpose: 'generate', inputTokens: 100, outputTokens: 50, cacheHit: false, cacheReadTokens: 800 },
      { at: '2', provider: 'anthropic', model: 'claude-sonnet-4-5', purpose: 'generate', inputTokens: 100, outputTokens: 50, cacheHit: false, cacheReadTokens: 850 },
      { at: '3', provider: 'local', model: 'local', purpose: 'generate', inputTokens: 0, outputTokens: 0, cacheHit: false }
    ]);
    expect(summary.totalCacheReadTokens).toBe(1650);
  });
});

describe('[v3.23] estimateCacheSavingsKrw turns raw cache-read tokens into a concrete KRW figure', () => {
  it('applies a 90% discount vs. the input price (cache reads bill at 10% of input price)', async () => {
    const { estimateCacheSavingsKrw } = await import('../src/core/usageLedger');
    // 8,210 tokens at 3,000 KRW/1M input price: (8210/1_000_000) * 3000 * 0.9
    expect(estimateCacheSavingsKrw(8210, 3000)).toBeCloseTo(8210 / 1_000_000 * 3000 * 0.9, 6);
  });

  it('returns null when no input price is registered, so the UI can prompt for one instead of showing "0원"', async () => {
    const { estimateCacheSavingsKrw } = await import('../src/core/usageLedger');
    expect(estimateCacheSavingsKrw(8210, null)).toBeNull();
  });

  it('returns null for 0 (or negative) cache-read tokens, not a spurious "0원"', async () => {
    const { estimateCacheSavingsKrw } = await import('../src/core/usageLedger');
    expect(estimateCacheSavingsKrw(0, 3000)).toBeNull();
  });
});

describe('[v3.16-diag] Anthropic temperature clamp', () => {
  it("clampAnthropicTemperature caps the SettingsModal's 0.2-1.2 slider range to Anthropic's accepted 0-1", () => {
    // SettingsModal.tsx's shared slider allows up to 1.2 (tuned for OpenAI's
    // 0-2 range); Anthropic's API rejects temperature > 1.0 with a 400.
    expect(apiInternal.clampAnthropicTemperature(1.2)).toBe(1);
    expect(apiInternal.clampAnthropicTemperature(1.1)).toBe(1);
    expect(apiInternal.clampAnthropicTemperature(1)).toBe(1);
    expect(apiInternal.clampAnthropicTemperature(0.8)).toBe(0.8);
    expect(apiInternal.clampAnthropicTemperature(-1)).toBe(0);
    expect(apiInternal.clampAnthropicTemperature(undefined)).toBe(0.8);
    expect(apiInternal.clampAnthropicTemperature(NaN)).toBe(0.8);
  });
});

describe('[v3.16-diag] Anthropic 400 detail surfaces to the response; console diagnostics are gated behind DEBUG_ANTHROPIC', () => {
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

  function mockRequest(overrides: Record<string, unknown> = {}) {
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: '`temperature` is deprecated for this model.' } }),
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
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        temperature: 0.8,
        batchSize: 6,
        system: 'stable system text',
        user: { hello: 'world' },
        ...overrides
      })
    };
    return { req, res, jsonBody };
  }

  it('appends the upstream detail to the response error message regardless of the debug flag', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    delete process.env.DEBUG_ANTHROPIC;
    const { req, res, jsonBody } = mockRequest();

    await generateHandler(req as never, res as never);

    expect(jsonBody.status).toBe(400);
    expect(jsonBody.payload?.error).toContain('Anthropic upstream failed: 400');
    expect(jsonBody.payload?.error).toContain('`temperature` is deprecated for this model.');
  });

  it('DEBUG_ANTHROPIC unset (default): no [ANTHROPIC 400 DIAG] console noise', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    delete process.env.DEBUG_ANTHROPIC;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { req, res } = mockRequest();

    await generateHandler(req as never, res as never);

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('DEBUG_ANTHROPIC=1: logs [ANTHROPIC 400 DIAG] with the upstream response', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    process.env.DEBUG_ANTHROPIC = '1';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { req, res } = mockRequest();

    await generateHandler(req as never, res as never);

    const diagCalls = consoleSpy.mock.calls.map(call => call.join(' '));
    expect(diagCalls.some(line => line.includes('[ANTHROPIC 400 DIAG] status='))).toBe(true);
    expect(diagCalls.some(line => line.includes('upstream response') && line.includes('deprecated'))).toBe(true);
  });
});

describe('[v3.18] Anthropic temperature/top_p/top_k are omitted (deprecated on claude-sonnet-5 and opus-4-7+)', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    global.fetch = originalFetch;
    apiInternal.TEMPERATURE_SUPPORTED.clear();
    vi.restoreAllMocks();
  });

  function mockRequest(body: Record<string, unknown>) {
    global.fetch = vi.fn(async () => new Response('{"content":[{"type":"text","text":"{}"}]}', { status: 200 })) as unknown as typeof fetch;
    const res = { setHeader: () => {}, status() { return this; }, json() {}, end: () => {} };
    const req = { method: 'POST', headers: {}, body: JSON.stringify(body) };
    return { req, res };
  }

  it('the request body sent to Anthropic has no temperature/top_p/top_k key for the default model (claude-sonnet-5)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    const { req, res } = mockRequest({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      temperature: 0.8,
      batchSize: 6,
      system: 'stable system text',
      user: { hello: 'world' }
    });

    await generateHandler(req as never, res as never);

    const sentBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(sentBody).not.toHaveProperty('temperature');
    expect(sentBody).not.toHaveProperty('top_p');
    expect(sentBody).not.toHaveProperty('top_k');
  });

  it('is also omitted for claude-opus-4-8 (also deprecated) even with an explicit temperature in the payload', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    const { req, res } = mockRequest({
      provider: 'anthropic',
      model: 'claude-opus-4-8',
      temperature: 1.1,
      batchSize: 6,
      system: 'stable system text',
      user: { hello: 'world' }
    });

    await generateHandler(req as never, res as never);

    const sentBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(sentBody).not.toHaveProperty('temperature');
  });

  it('is included, clamped, only for a model explicitly added to TEMPERATURE_SUPPORTED', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    apiInternal.TEMPERATURE_SUPPORTED.add('claude-legacy-test-model');
    const { req, res } = mockRequest({
      provider: 'anthropic',
      model: 'claude-legacy-test-model',
      temperature: 1.5,
      batchSize: 6,
      system: 'stable system text',
      user: { hello: 'world' }
    });

    await generateHandler(req as never, res as never);

    const sentBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(sentBody.temperature).toBe(1);
  });
});

describe('[v3.16-diag2] resolveAnthropicModel', () => {
  it('trims whitespace-only model strings back to the default instead of sending them as-is', () => {
    expect(apiInternal.resolveAnthropicModel('   ')).toBe('claude-sonnet-5');
    expect(apiInternal.resolveAnthropicModel('')).toBe('claude-sonnet-5');
    expect(apiInternal.resolveAnthropicModel(undefined)).toBe('claude-sonnet-5');
    expect(apiInternal.resolveAnthropicModel('claude-opus-4-8')).toBe('claude-opus-4-8');
    expect(apiInternal.resolveAnthropicModel('  claude-opus-4-8  ')).toBe('claude-opus-4-8');
  });
});

describe('[v3.19] computeTimeoutMs scales the deadline with batchSize instead of a flat 30s', () => {
  it('matches the documented formula: 60s + 15s/song, capped at 5 minutes', () => {
    expect(apiInternal.computeTimeoutMs(1)).toBe(75_000);
    expect(apiInternal.computeTimeoutMs(6)).toBe(150_000);
    expect(apiInternal.computeTimeoutMs(10)).toBe(210_000);
    expect(apiInternal.computeTimeoutMs(12)).toBe(240_000);
    // 60_000 + 20*15_000 = 360_000, but capped at 300_000
    expect(apiInternal.computeTimeoutMs(20)).toBe(300_000);
  });

  it('falls back to the batchSize=6 default for missing/invalid input', () => {
    expect(apiInternal.computeTimeoutMs(undefined)).toBe(150_000);
    expect(apiInternal.computeTimeoutMs(0)).toBe(150_000);
    expect(apiInternal.computeTimeoutMs(-3)).toBe(150_000);
    expect(apiInternal.computeTimeoutMs(NaN)).toBe(150_000);
  });
});

describe('[v3.19] fetchWithTimeout supports a custom timeout message', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('rejects with the caller-supplied message on abort instead of the generic default', async () => {
    global.fetch = vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    })) as unknown as typeof fetch;

    await expect(
      apiInternal.fetchWithTimeout('https://example.test', {}, 5, '응답이 오래 걸립니다. 곡 수를 줄이거나 Batch 모드를 사용하세요.')
    ).rejects.toThrow('응답이 오래 걸립니다. 곡 수를 줄이거나 Batch 모드를 사용하세요.');
  });

  it('falls back to the generic message when no override is given', async () => {
    global.fetch = vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        reject(err);
      });
    })) as unknown as typeof fetch;

    await expect(apiInternal.fetchWithTimeout('https://example.test', {}, 5)).rejects.toThrow('요청이 시간 초과되었습니다.');
  });
});

describe('[v3.19] callAnthropic wires computeTimeoutMs(batchSize) + the improved timeout message into the real request', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('the setTimeout backing the abort controller uses computeTimeoutMs(batchSize), not a flat 30s', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    global.fetch = vi.fn(async () => new Response('{"content":[{"type":"text","text":"{}"}]}', { status: 200 })) as unknown as typeof fetch;
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    const res = { setHeader: () => {}, status() { return this; }, json() {}, end: () => {} };
    const req = {
      method: 'POST',
      headers: {},
      body: JSON.stringify({ provider: 'anthropic', model: 'claude-sonnet-5', batchSize: 10, system: 'x', user: {} })
    };

    await generateHandler(req as never, res as never);

    const timeoutValues = setTimeoutSpy.mock.calls.map(call => call[1]);
    expect(timeoutValues).toContain(apiInternal.computeTimeoutMs(10));
    expect(timeoutValues).not.toContain(30_000);
  });
});

describe('[v3.20] computeMaxTokens raised budget + model-aware cap (real Claude output truncated the old 1200/song estimate)', () => {
  it('uses 2400/song + 3000 overhead for the default/unknown model, capped at 32000', () => {
    expect(apiInternal.computeMaxTokens(1)).toBe(5_400);
    expect(apiInternal.computeMaxTokens(5)).toBe(15_000);
    expect(apiInternal.computeMaxTokens(6)).toBe(17_400);
    // 12*2400+3000 = 31800, under the 32000 default cap
    expect(apiInternal.computeMaxTokens(12)).toBe(31_800);
  });

  it('clamps to the real model output ceiling when one is registered (claude-sonnet-5 / opus-4-8: 128000, haiku-4-5: 64000)', () => {
    expect(apiInternal.maxOutputTokensFor('claude-sonnet-5')).toBe(128_000);
    expect(apiInternal.maxOutputTokensFor('claude-opus-4-8')).toBe(128_000);
    expect(apiInternal.maxOutputTokensFor('claude-haiku-4-5-20251001')).toBe(64_000);
    expect(apiInternal.maxOutputTokensFor('some-unknown-model-id')).toBe(32_000);
    // still well under any of these ceilings at realistic batch sizes (app caps batchSize at 12)
    expect(apiInternal.computeMaxTokens(12, 'claude-sonnet-5')).toBe(31_800);
  });

  it('falls back to the batchSize=6 default for missing/invalid input', () => {
    expect(apiInternal.computeMaxTokens(undefined)).toBe(17_400);
    expect(apiInternal.computeMaxTokens(0)).toBe(17_400);
    expect(apiInternal.computeMaxTokens(-3)).toBe(17_400);
  });
});

describe('[v3.20] callAnthropic detects stop_reason:"max_tokens" and throws a distinguishable TRUNCATED error', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mockRequest(body: Record<string, unknown> = {}) {
    const jsonBody: { status?: number; payload?: { error?: string; code?: string } } = {};
    const res = {
      setHeader: () => {},
      status(code: number) {
        jsonBody.status = code;
        return this;
      },
      json(payload: { error?: string; code?: string }) {
        jsonBody.payload = payload;
      },
      end: () => {}
    };
    const req = {
      method: 'POST',
      headers: {},
      body: JSON.stringify({
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        batchSize: 6,
        system: 'stable system text',
        user: { hello: 'world' },
        ...body
      })
    };
    return { req, res, jsonBody };
  }

  it('a 200 response with stop_reason "max_tokens" still fails with a TRUNCATED code (does not silently return a partial parse)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    // Body would actually parse as valid JSON if salvage-attempted (cut lands after a complete song) —
    // the stop_reason check must reject it before safeParseBlueprint ever runs.
    const truncatedButParseable = JSON.stringify({ songs: [{ trackNo: 1, title: 'Complete Song' }] });
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ stop_reason: 'max_tokens', content: [{ type: 'text', text: truncatedButParseable }] }),
      { status: 200 }
    )) as unknown as typeof fetch;
    const { req, res, jsonBody } = mockRequest();

    await generateHandler(req as never, res as never);

    expect(jsonBody.status).toBe(500);
    expect(jsonBody.payload?.code).toBe('TRUNCATED');
    expect(jsonBody.payload?.error).toContain('잘렸습니다');
  });

  it('a normal stop_reason ("end_turn") with valid JSON succeeds with no code', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"songs":[]}' }] }),
      { status: 200 }
    )) as unknown as typeof fetch;
    const jsonBody: { status?: number; payload?: unknown } = {};
    const res = {
      setHeader: () => {},
      status(code: number) { jsonBody.status = code; return this; },
      json(payload: unknown) { jsonBody.payload = payload; },
      end: () => {}
    };
    const req = {
      method: 'POST',
      headers: {},
      body: JSON.stringify({ provider: 'anthropic', model: 'claude-sonnet-5', batchSize: 6, system: 'x', user: {} })
    };

    await generateHandler(req as never, res as never);

    expect(jsonBody.status).toBe(200);
  });

  it('[v3.22] an unparseable, non-max_tokens response carries PARSE_FAILED, not TRUNCATED (real [GEN DIAG] data showed stop_reason=end_turn misreported as truncation)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json at all {{{' }] }),
      { status: 200 }
    )) as unknown as typeof fetch;
    const { req, res, jsonBody } = mockRequest();

    await generateHandler(req as never, res as never);

    expect(jsonBody.payload?.code).toBe('PARSE_FAILED');
    expect(jsonBody.payload?.error).toContain('응답 형식을 해석하지 못했습니다');
    expect(jsonBody.payload?.error).not.toContain('곡 수를 줄이');
  });
});

describe('[v3.21] resolveTokenBudgetSize / maxTokensBudgetSongs (single-song truncation budget boost)', () => {
  it('falls back to the real batchSize when maxTokensBudgetSongs is omitted/invalid', () => {
    expect(apiInternal.resolveTokenBudgetSize(1, undefined)).toBe(1);
    expect(apiInternal.resolveTokenBudgetSize(1, 0)).toBe(1);
    expect(apiInternal.resolveTokenBudgetSize(1, -3)).toBe(1);
    expect(apiInternal.resolveTokenBudgetSize(6, NaN)).toBe(6);
  });

  it('uses maxTokensBudgetSongs instead of batchSize when it is a positive number', () => {
    expect(apiInternal.resolveTokenBudgetSize(1, 4)).toBe(4);
  });
});

describe('[v3.21] GEN DIAG / GEN USAGE logging (gated behind DEBUG_ANTHROPIC, same as prior diagnostics)', () => {
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

  function mockSuccessRequest(body: Record<string, unknown> = {}) {
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: '{"songs":[]}' }],
        usage: { input_tokens: 500, output_tokens: 1200, cache_read_input_tokens: 400, cache_creation_input_tokens: 0 }
      }),
      { status: 200 }
    )) as unknown as typeof fetch;
    const res = { setHeader: () => {}, status() { return this; }, json() {}, end: () => {} };
    const req = {
      method: 'POST',
      // TASK v3.21 — checkRateLimit keys off clientIp, and every other test
      // in this file that omits x-forwarded-for shares the same 'unknown'
      // bucket (module-level rateLimitBuckets persists across tests in one
      // file). This file has more than RATE_LIMIT_MAX_REQUESTS (10) generate
      // Handler calls total, so a bare {} here gets silently 429'd once
      // enough earlier tests have run — a unique IP isolates this block.
      headers: { 'x-forwarded-for': 'test-client-v3.21-gen-diag' },
      body: JSON.stringify({ provider: 'anthropic', model: 'claude-sonnet-5', batchSize: 2, system: 'x', user: {}, ...body })
    };
    return { req, res };
  }

  it('DEBUG_ANTHROPIC unset (default): no [GEN DIAG] / [GEN USAGE] console noise on a successful call', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    delete process.env.DEBUG_ANTHROPIC;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { req, res } = mockSuccessRequest();

    await generateHandler(req as never, res as never);

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('DEBUG_ANTHROPIC=1: logs model/batchSize/maxTokens before the request, then stop_reason/output_tokens and real per-song usage after', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    process.env.DEBUG_ANTHROPIC = '1';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { req, res } = mockSuccessRequest();

    await generateHandler(req as never, res as never);

    const diagCalls = consoleSpy.mock.calls.map(call => call.join(' '));
    expect(diagCalls.some(line => line.includes('[GEN DIAG] model=') && line.includes('claude-sonnet-5') && line.includes('batchSize= 2'))).toBe(true);
    expect(diagCalls.some(line => line.includes('[GEN DIAG] stop_reason= end_turn'))).toBe(true);
    expect(diagCalls.some(line => line.includes('[GEN USAGE] chunk= 2') && line.includes('output= 1200') && line.includes('perSong= 600'))).toBe(true);
    expect(diagCalls.some(line => line.includes('cacheReadInputTokens= 400'))).toBe(true);
  });

  it('maxTokensBudgetSongs changes the actual max_tokens sent to Anthropic without changing the real requested song count', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    const { req, res } = mockSuccessRequest({ batchSize: 1, maxTokensBudgetSongs: 4 });

    await generateHandler(req as never, res as never);

    const sentBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    // batchSize=1 alone -> min(cap, 1*2400+3000)=5400; boosted to songs=4 -> min(cap, 4*2400+3000)=12600
    expect(sentBody.max_tokens).toBe(apiInternal.computeMaxTokens(4, 'claude-sonnet-5'));
    expect(sentBody.max_tokens).toBeGreaterThan(apiInternal.computeMaxTokens(1, 'claude-sonnet-5'));
  });
});

describe('[v3.22] cleanJsonText / extractJsonObject — recovery from real Claude response shapes', () => {
  it('strips a fence anchored to the start/end (the old, still-common case)', () => {
    expect(apiInternal.cleanJsonText('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(apiInternal.cleanJsonText('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('[v3.22] strips a fence preceded by leading prose — the actual shape that caused the false "truncated" report', () => {
    const withPreamble = 'Here is the playlist JSON:\n```json\n{"a":1}\n```';
    expect(apiInternal.cleanJsonText(withPreamble)).toBe('{"a":1}');
  });

  it('[v3.22] strips a fence followed by trailing prose', () => {
    const withTrailer = '```json\n{"a":1}\n```\nLet me know if you would like any changes!';
    expect(apiInternal.cleanJsonText(withTrailer)).toBe('{"a":1}');
  });

  it('passes plain unfenced JSON through unchanged', () => {
    expect(apiInternal.cleanJsonText('{"a":1}')).toBe('{"a":1}');
  });

  it('extractJsonObject recovers JSON surrounded by unfenced prose on both sides', () => {
    const text = 'Sure, here is the playlist: {"a":1} Hope that helps!';
    // the function takes first { to last } — with only one brace pair, that's exactly the object
    expect(apiInternal.extractJsonObject(text)).toBe('{"a":1}');
    expect(JSON.parse(apiInternal.extractJsonObject(text))).toEqual({ a: 1 });
  });

  it('safeParseBlueprint recovers real-shaped responses end to end (fence + prose combined)', () => {
    const messy = 'Sure! Here is the JSON output:\n```json\n{"songs":[{"trackNo":1,"title":"x"}]}\n```\nLet me know if you would like any adjustments.';
    expect(apiInternal.safeParseBlueprint(messy)).toEqual({ songs: [{ trackNo: 1, title: 'x' }] });
  });
});

describe('[v3.22] safeParseBlueprint distinguishes PARSE_FAILED from TRUNCATED, and logs [PARSE FAIL] with real response text', () => {
  const originalDebugFlag = process.env.DEBUG_ANTHROPIC;
  afterEach(() => {
    if (originalDebugFlag === undefined) delete process.env.DEBUG_ANTHROPIC;
    else process.env.DEBUG_ANTHROPIC = originalDebugFlag;
    vi.restoreAllMocks();
  });

  it('an unrecoverable non-JSON response throws PARSE_FAILED, not TRUNCATED, with a format-focused (not "reduce song count") message', () => {
    delete process.env.DEBUG_ANTHROPIC;
    try {
      apiInternal.safeParseBlueprint('this is not JSON and has no braces at all');
      expect.unreachable();
    } catch (error) {
      expect((error as { code?: string }).code).toBe('PARSE_FAILED');
      expect((error as Error).message).toContain('응답 형식을 해석하지 못했습니다');
      expect((error as Error).message).not.toContain('곡 수를 줄이');
    }
  });

  it('DEBUG_ANTHROPIC unset (default): no [PARSE FAIL] console noise', () => {
    delete process.env.DEBUG_ANTHROPIC;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      apiInternal.safeParseBlueprint('garbage');
    } catch {
      // expected
    }
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('DEBUG_ANTHROPIC=1: logs [PARSE FAIL] with the real response text (head/tail), not the cleaned/extracted version', () => {
    process.env.DEBUG_ANTHROPIC = '1';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rawResponse = 'Sorry, I cannot produce that JSON right now due to an internal issue.';
    try {
      apiInternal.safeParseBlueprint(rawResponse);
    } catch {
      // expected
    }
    const diagCalls = consoleSpy.mock.calls.map(call => call.join(' '));
    expect(diagCalls.some(line => line.startsWith('[PARSE FAIL] len=') && line.includes(String(rawResponse.length)))).toBe(true);
    expect(diagCalls.some(line => line.includes('head=') && line.includes('internal issue'))).toBe(true);
    expect(diagCalls.some(line => line.startsWith('[PARSE FAIL] tail='))).toBe(true);
  });
});

describe('[v3.22] TRUNCATED is reserved for a real stop_reason/finish_reason signal, never inferred from a parse failure', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('Anthropic: stop_reason="max_tokens" is TRUNCATED even with a technically-parseable body', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"songs":[]}' }] }),
      { status: 200 }
    )) as unknown as typeof fetch;
    const res = { setHeader: () => {}, status() { return this; }, json(payload: { code?: string }) { (this as { _payload?: unknown })._payload = payload; }, end: () => {} } as { _payload?: { code?: string } };
    const req = {
      method: 'POST',
      headers: {},
      body: JSON.stringify({ provider: 'anthropic', model: 'claude-sonnet-5', batchSize: 2, system: 'x', user: {} })
    };

    await generateHandler(req as never, res as never);

    expect(res._payload?.code).toBe('TRUNCATED');
  });

  it('OpenAI: finish_reason="length" is TRUNCATED, not PARSE_FAILED, even if the (incomplete) JSON also fails to parse', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key'; // unused by this request but keeps env tidy
    process.env.OPENAI_API_KEY = 'sk-test-openai-key';
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{"songs":[{"trackNo":1,"title":"incomple' } }] }),
      { status: 200 }
    )) as unknown as typeof fetch;
    const jsonBody: { payload?: { code?: string; error?: string } } = {};
    const res = { setHeader: () => {}, status() { return this; }, json(payload: { code?: string; error?: string }) { jsonBody.payload = payload; }, end: () => {} };
    const req = {
      method: 'POST',
      headers: {},
      body: JSON.stringify({ provider: 'openai', model: 'gpt-4.1-mini', batchSize: 2, system: 'x', user: {} })
    };

    await generateHandler(req as never, res as never);

    expect(jsonBody.payload?.code).toBe('TRUNCATED');
    delete process.env.OPENAI_API_KEY;
  });

  it('OpenAI: finish_reason="stop" with unparseable content is PARSE_FAILED, not TRUNCATED', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-openai-key';
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'Sorry, something went wrong and I could not produce valid output.' } }] }),
      { status: 200 }
    )) as unknown as typeof fetch;
    const jsonBody: { payload?: { code?: string; error?: string } } = {};
    const res = { setHeader: () => {}, status() { return this; }, json(payload: { code?: string; error?: string }) { jsonBody.payload = payload; }, end: () => {} };
    const req = {
      method: 'POST',
      headers: {},
      body: JSON.stringify({ provider: 'openai', model: 'gpt-4.1-mini', batchSize: 2, system: 'x', user: {} })
    };

    await generateHandler(req as never, res as never);

    expect(jsonBody.payload?.code).toBe('PARSE_FAILED');
    delete process.env.OPENAI_API_KEY;
  });
});

describe('[v3.23] thumbnailText generation is an off-by-default toggle (generateThumbnailText), not a permanent removal', () => {
  it('default (generateThumbnailText omitted/false): neither outputShape (Anthropic cacheable block or OpenAI user instruction) asks for a per-song thumbnailText, top-level or nested in youtube', () => {
    const opts = makeOptions();
    const channelBlock = buildChannelSystemBlock(opts, testGenres, testMoods, testSeason);
    const userInstruction = buildUserInstruction(opts, testGenres, testMoods, testSeason);

    expect(channelBlock).not.toContain('thumbnailText');
    expect(JSON.stringify(userInstruction)).not.toContain('thumbnailText');
  });

  it('generateThumbnailText=true: outputShape asks for a per-song thumbnailText again, both top-level and nested in youtube', () => {
    const opts = makeOptions();
    const channelBlock = buildChannelSystemBlock(opts, testGenres, testMoods, testSeason, true);
    const userInstruction = buildUserInstruction(opts, testGenres, testMoods, testSeason, undefined, true);

    expect(channelBlock).toContain('thumbnailText');
    expect(JSON.stringify(userInstruction)).toContain('thumbnailText');
  });

  it('default (false): the stable system instruction does not ask the model to write thumbnail text', () => {
    const opts = makeOptions();
    const system = buildSystemInstruction(opts);

    expect(system).toContain('Include YouTube title, description, and tags for every song.');
    expect(system).not.toContain('thumbnail text for every song');
    // the stylePrompt-pollution guard is unrelated to per-song thumbnail *generation* and must always stay, flag or no flag
    expect(system).toContain('thumbnail art-direction language');
  });

  it('generateThumbnailText=true: the stable system instruction asks the model to write thumbnail text, and the guard still stays', () => {
    const opts = makeOptions();
    const system = buildSystemInstruction(opts, undefined, undefined, true);

    expect(system).toContain('Include YouTube title, description, tags, and thumbnail text for every song.');
    expect(system).toContain('thumbnail art-direction language');
  });

  it('default (false): batchPlanning does not tell the model to avoid repeating a "thumbnail phrase" (nothing generates one)', () => {
    const opts = makeOptions();
    const channelBlock = buildChannelSystemBlock(opts, testGenres, testMoods, testSeason);
    const userInstruction = buildUserInstruction(opts, testGenres, testMoods, testSeason);

    expect(channelBlock).not.toContain('thumbnail phrase');
    expect(JSON.stringify(userInstruction)).not.toContain('thumbnail phrase');
    expect(channelBlock).toContain('Avoid repeating the same opening image or chorus first line.');
  });

  it('generateThumbnailText=true: batchPlanning tells the model to avoid repeating a "thumbnail phrase"', () => {
    const opts = makeOptions();
    const channelBlock = buildChannelSystemBlock(opts, testGenres, testMoods, testSeason, true);

    expect(channelBlock).toContain('thumbnail phrase');
  });

  it('default (false): the preassignedSongs batch note does not list thumbnailText among the fields the model still writes freely', () => {
    const opts = makeOptions();
    const slots: PreassignedSongSlot[] = [
      { trackNo: 1, title: 'T', hookPhrase: 'H', songRole: 'flagship', tempo: 100, emotionArc: 'x' }
    ];
    const batch: BatchContext = {
      trackNoOffset: 0,
      totalSongCount: 1,
      usedTitles: [],
      usedHooks: [],
      lockedIdentity: null,
      preassignedSongs: slots
    };
    const note = buildBatchSystemNote(opts, batch);

    expect(note).toContain('preassignedSongs');
    expect(note).not.toContain('thumbnailText');
  });

  it('generateThumbnailText=true: the preassignedSongs batch note lists thumbnailText among the fields the model still writes freely', () => {
    const opts = makeOptions();
    const slots: PreassignedSongSlot[] = [
      { trackNo: 1, title: 'T', hookPhrase: 'H', songRole: 'flagship', tempo: 100, emotionArc: 'x' }
    ];
    const batch: BatchContext = {
      trackNoOffset: 0,
      totalSongCount: 1,
      usedTitles: [],
      usedHooks: [],
      lockedIdentity: null,
      preassignedSongs: slots
    };
    const note = buildBatchSystemNote(opts, batch, true);

    expect(note).toContain('thumbnailText');
  });
});

describe('[v3.27] titleMode branches buildBatchSystemNote\'s preassignedSongs guidance (Part A2)', () => {
  function makeBatch(): BatchContext {
    const slots: PreassignedSongSlot[] = [
      { trackNo: 1, title: 'Placeholder Title', hookPhrase: 'H', songRole: 'flagship', tempo: 100, emotionArc: 'x' }
    ];
    return { trackNoOffset: 0, totalSongCount: 1, usedTitles: [], usedHooks: [], lockedIdentity: null, preassignedSongs: slots };
  }

  it('default (titleMode omitted) resolves to ai-creative: tells the model its own title is expected, the preassigned title is only a fallback', () => {
    const opts = makeOptions();
    const note = buildBatchSystemNote(opts, makeBatch());

    expect(note).toContain('fallback placeholder');
    expect(note).toContain('write your OWN original title');
    expect(note).not.toContain('Do NOT invent a different title');
  });

  it('titleMode="local": tells the model to copy the preassigned title verbatim (old behavior, unchanged)', () => {
    const opts = makeOptions({ titleMode: 'local' });
    const note = buildBatchSystemNote(opts, makeBatch());

    expect(note).toContain('Do NOT invent a different title, hookPhrase, trackNo, or emotionArc — copy these fields verbatim');
  });

  it('titleMode="ai-creative" (explicit) still forbids inventing a different hookPhrase/trackNo/emotionArc', () => {
    const opts = makeOptions({ titleMode: 'ai-creative' });
    const note = buildBatchSystemNote(opts, makeBatch());

    expect(note).toContain('Do NOT invent a different hookPhrase, trackNo, or emotionArc');
  });
});

