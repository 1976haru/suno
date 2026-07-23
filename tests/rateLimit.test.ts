import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import generateHandler, { __internal as apiInternal } from '../api/generate.js';
import batchHandler, { __internal as batchApiInternal } from '../api/batch.js';

/**
 * TASK v3.32 — RATE_LIMIT_MAX_REQUESTS was raised 10 -> 60 (api/generate.js)
 * and 20 -> 60 (api/batch.js) because an 80-song real-time pack can run up
 * to ~40 chunk requests (see src/providers/index.ts's REALTIME_CHUNK_SIZE_*
 * constants), which the old 10/min local-proxy limiter would 429 well before
 * a single pack finished.
 *
 * TASK v3.33 — raised again 60 -> 90 for both files: multi-set generation
 * (src/core/multiSetGeneration.ts) can request up to 200 songs total across
 * a run, roughly ~100 realtime chunks. This simulates that call volume
 * against the real handler + real checkRateLimit — not a mock of the
 * limiter — and confirms the window still caps at some point (not
 * unlimited).
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

function mockGenerateReq(overrides: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.5' },
    body: JSON.stringify({
      // Deliberately missing `system`/`user` so the handler 400s right after
      // the rate-limit gate instead of reaching real fetch/Anthropic — the
      // point of this test is the limiter, not the generation path.
      provider: 'anthropic',
      ...overrides
    })
  };
}

function mockBatchReq(overrides: Record<string, unknown> = {}) {
  return {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.6' },
    body: JSON.stringify({
      // action omitted -> handler 400s right after the rate-limit gate,
      // before touching ANTHROPIC_API_KEY/fetch.
      ...overrides
    })
  };
}

describe('[v3.33] local proxy rate limit — raised to accommodate a 200-song multi-set run', () => {
  beforeEach(() => {
    apiInternal.rateLimitBuckets.clear();
    batchApiInternal.rateLimitBuckets.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('api/generate.js: 90 consecutive calls within one minute never get a 429 (old 60/min limit would have failed at call 61)', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 90; i += 1) {
      const { res, calls } = mockRes();
      await generateHandler(mockGenerateReq() as never, res as never);
      statuses.push(calls[0].status);
    }
    expect(statuses).not.toContain(429);
  });

  it('api/generate.js: the limiter still caps the window — 91st call in the same minute gets 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 91; i += 1) {
      const { res, calls } = mockRes();
      await generateHandler(mockGenerateReq() as never, res as never);
      statuses.push(calls[0].status);
    }
    expect(statuses.slice(0, 90)).not.toContain(429);
    expect(statuses[90]).toBe(429);
  });

  it('api/batch.js: 90 consecutive calls within one minute never get a 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 90; i += 1) {
      const { res, calls } = mockRes();
      await batchHandler(mockBatchReq() as never, res as never);
      statuses.push(calls[0].status);
    }
    expect(statuses).not.toContain(429);
  });

  it('api/batch.js: the limiter still caps the window — 91st call in the same minute gets 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 91; i += 1) {
      const { res, calls } = mockRes();
      await batchHandler(mockBatchReq() as never, res as never);
      statuses.push(calls[0].status);
    }
    expect(statuses.slice(0, 90)).not.toContain(429);
    expect(statuses[90]).toBe(429);
  });
});
