import { afterEach, describe, expect, it, vi } from 'vitest';
import generateHandler, { __internal as apiInternal } from '../api/generate.js';
import { buildAnthropicUserPayload, buildChannelSystemBlock, buildSystemInstruction } from '../src/core/promptComposer';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { BatchContext, PlaylistIdentity } from '../src/types';

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

  it('an unparseable, non-max_tokens response also carries the TRUNCATED code (safe default: retry smaller)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    global.fetch = vi.fn(async () => new Response(
      JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json at all {{{' }] }),
      { status: 200 }
    )) as unknown as typeof fetch;
    const { req, res, jsonBody } = mockRequest();

    await generateHandler(req as never, res as never);

    expect(jsonBody.payload?.code).toBe('TRUNCATED');
  });
});

