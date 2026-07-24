import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import imageHandler, { __internal } from '../api/image.js';

/**
 * TASK v3.37 — mirrors tests/rateLimit.test.ts + tests/batchApi.test.ts's
 * pattern of calling the real serverless handler with a mocked req/res
 * rather than mocking fetch. Every request here is deliberately shaped to
 * fail (empty prompt, missing key, gated) before the handler ever reaches
 * requestGeminiImage's real network fetch — same reasoning as
 * batchApi.test.ts's mockBatchReq comment: the point is exercising the
 * proxy's own gates, not Gemini's API.
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
    body: JSON.stringify({ prompt: 'a calm tropical beach at sunrise', aspectRatio: '16:9', ...overrides })
  };
}

describe('[v3.37] api/image.js handler', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    __internal.rateLimitBuckets.clear();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_IMAGE_MODEL;
    delete process.env.ACCESS_TOKEN;
    delete process.env.ALLOWED_ORIGINS;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects a missing/empty prompt with 400 before touching the network', async () => {
    const { res, calls } = mockRes();
    await imageHandler(mockReq({ prompt: '' }) as never, res as never);
    expect(calls[0].status).toBe(400);
  });

  it('OPTIONS preflight returns 204 with no body', async () => {
    const { res, calls } = mockRes();
    await imageHandler({ method: 'OPTIONS', headers: {} } as never, res as never);
    expect(calls[0]).toEqual({ status: 204, payload: undefined });
  });

  it('non-POST method is rejected with 405', async () => {
    const { res, calls } = mockRes();
    await imageHandler({ method: 'GET', headers: {} } as never, res as never);
    expect(calls[0].status).toBe(405);
  });

  it('a blocked CORS origin is rejected with 403', async () => {
    process.env.ALLOWED_ORIGINS = 'https://example.com';
    const { res, calls } = mockRes();
    await imageHandler(mockReq({}, { origin: 'https://evil.example' }) as never, res as never);
    expect(calls[0].status).toBe(403);
  });

  it('surfaces a clear "not configured" error when no key is present anywhere (server or BYOK)', async () => {
    const { res, calls } = mockRes();
    await imageHandler(mockReq() as never, res as never);
    expect(calls[0].status).toBe(500);
    expect(String((calls[0].payload as { error: string }).error)).toContain('GEMINI_API_KEY');
  });

  it('gates server-key mode behind ACCESS_TOKEN once the deployer sets one', async () => {
    process.env.ACCESS_TOKEN = 'secret-token';
    const { res, calls } = mockRes();
    await imageHandler(mockReq() as never, res as never);
    expect(calls[0].status).toBe(401);
  });

  it('never gates a BYOK request behind ACCESS_TOKEN, even when the deployer set one', async () => {
    process.env.ACCESS_TOKEN = 'secret-token';
    const { res, calls } = mockRes();
    // Empty prompt keeps this from ever reaching the real Gemini fetch —
    // the only thing under test is whether the 401 access-token gate fires.
    await imageHandler(mockReq({ prompt: '' }, { 'x-user-api-key': 'user-supplied-key' }) as never, res as never);
    expect(calls[0].status).toBe(400);
    expect(calls[0].status).not.toBe(401);
  });

  it('rate limit: 20 consecutive calls never 429, the 21st does', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      const { res, calls } = mockRes();
      await imageHandler(mockReq({ prompt: '' }) as never, res as never);
      statuses.push(calls[0].status);
    }
    expect(statuses.slice(0, 20)).not.toContain(429);
    expect(statuses[20]).toBe(429);
  });
});

describe('[v3.37] api/image.js __internal pure helpers', () => {
  afterEach(() => {
    delete process.env.GEMINI_IMAGE_MODEL;
    delete process.env.ALLOWED_ORIGINS;
  });

  it('buildFinalPrompt always appends the quality booster', () => {
    const prompt = __internal.buildFinalPrompt('a scene');
    expect(prompt).toContain('a scene');
    expect(prompt.endsWith(__internal.QUALITY_BOOSTER)).toBe(true);
  });

  it('resolveAspectRatio only ever returns 16:9 or 1:1', () => {
    expect(__internal.resolveAspectRatio('1:1')).toBe('1:1');
    expect(__internal.resolveAspectRatio('16:9')).toBe('16:9');
    expect(__internal.resolveAspectRatio('9:16')).toBe('16:9');
    expect(__internal.resolveAspectRatio(undefined)).toBe('16:9');
  });

  it('resolveImageModel falls back through explicit model -> env var -> default', () => {
    expect(__internal.resolveImageModel('custom-model')).toBe('custom-model');
    process.env.GEMINI_IMAGE_MODEL = 'env-model';
    expect(__internal.resolveImageModel(undefined)).toBe('env-model');
    delete process.env.GEMINI_IMAGE_MODEL;
    expect(__internal.resolveImageModel(undefined)).toBe(__internal.DEFAULT_IMAGE_MODEL);
  });

  it('isImageSizeRejection matches only image-size-shaped errors, not unrelated ones', () => {
    expect(__internal.isImageSizeRejection({ detail: 'INVALID_ARGUMENT: imageSize must be one of 1K, 2K' })).toBe(true);
    expect(__internal.isImageSizeRejection({ message: 'unsupported image size requested' })).toBe(true);
    expect(__internal.isImageSizeRejection({ detail: 'API key not valid' })).toBe(false);
  });

  it('extractInlineImage pulls the last inlineData part and throws a clear error when none exists', () => {
    const data = { candidates: [{ content: { parts: [{ text: 'ignored' }, { inlineData: { data: 'BASE64', mimeType: 'image/png' } }] } }] };
    expect(__internal.extractInlineImage(data)).toEqual({ data: 'BASE64', mimeType: 'image/png' });
    expect(() => __internal.extractInlineImage({ candidates: [] })).toThrow();
  });

  it('maskKey never returns the full key', () => {
    const key = 'AIzaSyABCDEFGHIJKLMNOPQRSTUV1234567';
    const masked = __internal.maskKey(key);
    expect(masked).not.toContain('ABCDEFGHIJKLMNOPQRSTUV');
    expect(masked.startsWith('AIzaSy')).toBe(true);
  });

  it('resolveCorsOrigin allows any origin when ALLOWED_ORIGINS is unset (local/dev default)', () => {
    expect(__internal.resolveCorsOrigin({ headers: { origin: 'http://localhost:5200' } }).blocked).toBe(false);
  });

  it('resolveCorsOrigin blocks an origin not on the allowlist once ALLOWED_ORIGINS is set', () => {
    process.env.ALLOWED_ORIGINS = 'https://example.com';
    expect(__internal.resolveCorsOrigin({ headers: { origin: 'https://evil.example' } }).blocked).toBe(true);
    expect(__internal.resolveCorsOrigin({ headers: { origin: 'https://example.com' } }).blocked).toBe(false);
  });
});
