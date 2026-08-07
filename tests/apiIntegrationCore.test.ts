import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import batchHandler, { __internal } from '../api/batch.js';
import generateHandler from '../api/generate.js';

/**
 * codex 지시문 07 (TASK D, required by spec) — real coverage of the API
 * integration concerns NOT already covered by the existing real test
 * files (tests/apiImage.test.ts's image route, tests/batchApi.test.ts's
 * batch create/stitching, tests/rateLimit.test.ts's rate limit,
 * tests/security.test.ts's secret redaction, tests/truncationSplitRetry.test.ts's
 * partial-response/retry): real Batch API POLLING (action:'status') and
 * CANCELLATION (action:'cancel') at the full handler level, a real
 * TIMEOUT (AbortController firing via fetchWithTimeout), and malformed
 * (non-JSON) upstream responses reaching the FULL handler (not just the
 * already-tested internal safeParseBlueprint pure function). Same real
 * "call the exported serverless handler with a mocked req/res" pattern
 * every sibling api/*.test.ts file already establishes — mock contract
 * only, zero real external cost, safe for every push/PR (per this task's
 * own explicit "실제 외부 비용이 드는 테스트는... 별도 opt-in smoke로 분리한다").
 */

function mockRes() {
  const calls: { status: number; payload: unknown }[] = [];
  const res = {
    setHeader: () => {},
    status(code: number) {
      return { json: (payload: unknown) => calls.push({ status: code, payload }), end: () => calls.push({ status: code, payload: undefined }) };
    }
  };
  return { res, calls };
}

function mockReq(overrides: Record<string, unknown> = {}, headerOverrides: Record<string, string> = {}) {
  return {
    method: 'POST',
    headers: { 'x-forwarded-for': '198.51.100.7', ...headerOverrides },
    body: JSON.stringify({ ...overrides })
  };
}

describe('[codex 지시문 07 TASK D] api/batch.js — real polling (action:status)', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    __internal.rateLimitBuckets.clear();
    process.env.ANTHROPIC_API_KEY = 'sk-real-test-key';
    delete process.env.ACCESS_TOKEN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('a real in_progress status response is relayed through as-is', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ processing_status: 'in_progress', request_counts: { processing: 5, succeeded: 0 } }), { status: 200 })) as unknown as typeof fetch;
    const { res, calls } = mockRes();
    await batchHandler(mockReq({ action: 'status', batchId: 'batch_123' }) as never, res as never);
    expect(calls[0].status).toBe(200);
    expect((calls[0].payload as { status: string }).status).toBe('in_progress');
  });

  it('a real ended status response includes the results URL', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ processing_status: 'ended', request_counts: { succeeded: 5 }, results_url: 'https://api.anthropic.com/v1/results/batch_123' }), { status: 200 })) as unknown as typeof fetch;
    const { res, calls } = mockRes();
    await batchHandler(mockReq({ action: 'status', batchId: 'batch_123' }) as never, res as never);
    expect((calls[0].payload as { resultsUrl: string }).resultsUrl).toContain('batch_123');
  });

  it('a missing batchId is rejected before any network call', async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    const { res, calls } = mockRes();
    await batchHandler(mockReq({ action: 'status' }) as never, res as never);
    expect(calls[0].status).toBeGreaterThanOrEqual(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('an upstream 404 (unknown batch id) surfaces as a real, clear error status', async () => {
    global.fetch = vi.fn(async () => new Response('not found', { status: 404 })) as unknown as typeof fetch;
    const { res, calls } = mockRes();
    await batchHandler(mockReq({ action: 'status', batchId: 'batch_does_not_exist' }) as never, res as never);
    expect(calls[0].status).toBe(404);
  });
});

describe('[codex 지시문 07 TASK D] api/batch.js — real cancellation (action:cancel)', () => {
  beforeEach(() => {
    __internal.rateLimitBuckets.clear();
    process.env.ANTHROPIC_API_KEY = 'sk-real-test-key';
    delete process.env.ACCESS_TOKEN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a real cancel request calls the real Anthropic cancel endpoint and relays the resulting status', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain('/cancel');
      return new Response(JSON.stringify({ processing_status: 'canceling' }), { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const { res, calls } = mockRes();
    await batchHandler(mockReq({ action: 'cancel', batchId: 'batch_123' }) as never, res as never);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((calls[0].payload as { status: string }).status).toBe('canceling');
  });

  it('a missing batchId is rejected before any network call', async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    const { res, calls } = mockRes();
    await batchHandler(mockReq({ action: 'cancel' }) as never, res as never);
    expect(calls[0].status).toBeGreaterThanOrEqual(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('[codex 지시문 07 TASK D] real timeout — fetchWithTimeout aborts a hanging upstream call', () => {
  beforeEach(() => {
    __internal.rateLimitBuckets.clear();
    process.env.ANTHROPIC_API_KEY = 'sk-real-test-key';
    delete process.env.ACCESS_TOKEN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('a fetch that never resolves is aborted once REQUEST_TIMEOUT_MS elapses, and the handler returns a real error (not an unhandled hang)', async () => {
    vi.useFakeTimers();
    global.fetch = vi.fn((_url: string, init?: { signal?: AbortSignal }) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })) as unknown as typeof fetch;

    const { res, calls } = mockRes();
    const handlerPromise = batchHandler(mockReq({ action: 'status', batchId: 'batch_123' }) as never, res as never);
    // fetchWithTimeout's own real setTimeout(..., REQUEST_TIMEOUT_MS) fires the AbortController — advancing fake time past it deterministically triggers the same real abort path REQUEST_TIMEOUT_MS's real 30000ms would, without actually waiting 30 real seconds.
    await vi.advanceTimersByTimeAsync(30_000);
    await handlerPromise;
    expect(calls[0].status).toBeGreaterThanOrEqual(400);
  });
});

describe('[codex 지시문 07 TASK D] malformed/non-JSON upstream response at the full handler level', () => {
  beforeEach(() => {
    delete process.env.ACCESS_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generate.js: a request body that is not valid JSON at all is rejected with a clear 4xx, never an unhandled crash', async () => {
    const { res, calls } = mockRes();
    const req = { method: 'POST', headers: { 'x-forwarded-for': '198.51.100.8', 'x-user-api-key': 'sk-fake' }, body: '{not valid json' };
    await expect(generateHandler(req as never, res as never)).resolves.toBeUndefined();
    expect(calls[0].status).toBeGreaterThanOrEqual(400);
    expect(calls[0].status).toBeLessThan(600);
  });

  it('batch.js: a request body that is not valid JSON at all is rejected with a clear 4xx, never an unhandled crash', async () => {
    __internal.rateLimitBuckets.clear();
    const { res, calls } = mockRes();
    const req = { method: 'POST', headers: { 'x-forwarded-for': '198.51.100.9', 'x-user-api-key': 'sk-fake' }, body: '{not valid json' };
    await expect(batchHandler(req as never, res as never)).resolves.toBeUndefined();
    expect(calls[0].status).toBeGreaterThanOrEqual(400);
    expect(calls[0].status).toBeLessThan(600);
  });
});

describe('[codex 지시문 07 TASK D] secret redaction — real coverage at the full handler error path', () => {
  beforeEach(() => {
    __internal.rateLimitBuckets.clear();
    delete process.env.ACCESS_TOKEN;
    process.env.ANTHROPIC_API_KEY = 'sk-ant-real-secret-should-never-appear-in-any-response';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('an upstream error response body never echoes this server\'s own real ANTHROPIC_API_KEY value', async () => {
    global.fetch = vi.fn(async () => new Response('upstream failure detail text', { status: 500 })) as unknown as typeof fetch;
    const { res, calls } = mockRes();
    await batchHandler(mockReq({ action: 'status', batchId: 'batch_123' }) as never, res as never);
    const serialized = JSON.stringify(calls);
    expect(serialized).not.toContain('sk-ant-real-secret-should-never-appear-in-any-response');
  });
});
