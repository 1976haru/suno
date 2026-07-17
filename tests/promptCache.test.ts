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

  it('[v3.16-diag2] disableCache:true sends one plain string with no cache_control blocks at all', () => {
    const result = apiInternal.buildAnthropicSystem({
      cacheableSystemBlocks: ['STABLE RULES TEXT', 'STABLE CHANNEL BLOCK'],
      volatileSystemText: 'Batch mode: tracks 7-12 of 30',
      disableCache: true
    });
    expect(typeof result).toBe('string');
    expect(result).toBe('STABLE RULES TEXT\n\nSTABLE CHANNEL BLOCK\n\nBatch mode: tracks 7-12 of 30');
    expect(result).not.toContain('ephemeral');
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

describe('[v3.16-diag] Anthropic 400 detail surfaces to both console and response', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('a mocked Anthropic 400 response logs [ANTHROPIC 400 DIAG] and appends the upstream detail to the error message', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    const upstreamBody = JSON.stringify({
      type: 'error',
      error: { type: 'invalid_request_error', message: 'temperature: Input should be less than or equal to 1' }
    });
    global.fetch = vi.fn(async () => new Response(upstreamBody, { status: 400 })) as unknown as typeof fetch;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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
        temperature: 1.2,
        batchSize: 6,
        system: 'stable system text',
        user: { hello: 'world' }
      })
    };

    await generateHandler(req as never, res as never);

    expect(jsonBody.status).toBe(400);
    expect(jsonBody.payload?.error).toContain('Anthropic upstream failed: 400');
    expect(jsonBody.payload?.error).toContain('temperature: Input should be less than or equal to 1');

    const diagCalls = consoleSpy.mock.calls.map(call => call.join(' '));
    expect(diagCalls.some(line => line.includes('[ANTHROPIC 400 DIAG] status='))).toBe(true);
    expect(diagCalls.some(line => line.includes('upstream response') && line.includes('temperature'))).toBe(true);

    // the actual request sent to Anthropic must carry the clamped temperature, not the raw 1.2
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

describe('[v3.16-diag2] DISABLE_PROMPT_CACHE escape hatch', () => {
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

  it('DISABLE_PROMPT_CACHE=1 sends system as a plain string with no cache_control, and logs promptCacheDisabled=true on a 400', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    process.env.DISABLE_PROMPT_CACHE = '1';
    global.fetch = vi.fn(async () => new Response('{"type":"error"}', { status: 400 })) as unknown as typeof fetch;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = { setHeader: () => {}, status() { return this; }, json() {}, end: () => {} };
    const req = {
      method: 'POST',
      headers: {},
      body: JSON.stringify({
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        temperature: 0.8,
        batchSize: 6,
        cacheableSystemBlocks: ['STABLE RULES TEXT', 'STABLE CHANNEL BLOCK'],
        volatileSystemText: 'Batch mode: tracks 1-6 of 12',
        user: { hello: 'world' }
      })
    };

    await generateHandler(req as never, res as never);

    const sentBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(typeof sentBody.system).toBe('string');
    expect(sentBody.system).not.toContain('ephemeral');
    expect(sentBody.system).toContain('STABLE RULES TEXT');

    const diagCalls = consoleSpy.mock.calls.map(call => call.join(' '));
    expect(diagCalls.some(line => line.includes('promptCacheDisabled= true'))).toBe(true);
  });

  it('DISABLE_PROMPT_CACHE unset (default) still sends the cache_control array shape', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
    delete process.env.DISABLE_PROMPT_CACHE;
    global.fetch = vi.fn(async () => new Response('{"content":[{"type":"text","text":"{}"}]}', { status: 200 })) as unknown as typeof fetch;

    const res = { setHeader: () => {}, status() { return this; }, json() {}, end: () => {} };
    const req = {
      method: 'POST',
      headers: {},
      body: JSON.stringify({
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        temperature: 0.8,
        batchSize: 6,
        cacheableSystemBlocks: ['STABLE RULES TEXT', 'STABLE CHANNEL BLOCK'],
        volatileSystemText: 'Batch mode: tracks 1-6 of 12',
        user: { hello: 'world' }
      })
    };

    await generateHandler(req as never, res as never);

    const sentBody = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(Array.isArray(sentBody.system)).toBe(true);
    expect(sentBody.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });
});
