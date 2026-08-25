import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('[v3.41] api/image.js Qwen provider', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    __internal.rateLimitBuckets.clear();
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.ACCESS_TOKEN;
    global.fetch = originalFetch;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('builds documented Qwen sync and async endpoints, including optional WorkspaceId', () => {
    expect(__internal.buildQwenEndpoint({ region: 'singapore', workspaceId: '', mode: 'sync' }))
      .toBe('https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
    expect(__internal.buildQwenEndpoint({ region: 'singapore', workspaceId: 'ws123', mode: 'async' }))
      .toBe('https://ws123.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis');
    expect(__internal.buildQwenEndpoint({ region: 'beijing', workspaceId: 'ws123', mode: 'task', taskId: 'task-1' }))
      .toBe('https://ws123.cn-beijing.maas.aliyuncs.com/api/v1/tasks/task-1');
    // TASK v3.45 — qwen-image-3.0-pro doesn't exist in Alibaba's model
    // catalog; qwen-image-max is the real sync-only model resolveQwenModel
    // should now accept, and a genuinely nonexistent id must still fall
    // back to the sync default rather than pass through unchanged.
    expect(__internal.resolveQwenModel('qwen-image-max')).toBe('qwen-image-max');
    expect(__internal.resolveQwenModel('qwen-image-3.0-pro')).toBe(__internal.QWEN_DEFAULT_MODEL);
  });

  it('builds Qwen sync request bodies with one user message and a separate negative prompt', () => {
    const body = __internal.buildQwenRequestBody({
      model: 'qwen-image-2.0',
      prompt: 'textless cafe background',
      negativePrompt: 'no text',
      size: '2688*1536',
      n: 1,
      asyncMode: false
    });
    expect(body.input.messages).toHaveLength(1);
    expect(body.input.messages[0].content[0].text).toBe('textless cafe background');
    expect(body.parameters.negative_prompt).toBe('no text');
    expect(body.parameters.watermark).toBe(false);
    expect(body.parameters.prompt_extend).toBe(false);
  });

  it('extracts Qwen image URLs from both sync and async response shapes', () => {
    expect(__internal.extractQwenImageUrls({
      output: { choices: [{ message: { content: [{ image: 'https://img.example/sync.png' }] } }] }
    })).toEqual(['https://img.example/sync.png']);
    expect(__internal.extractQwenImageUrls({
      output: { results: [{ url: 'https://img.example/async.png' }] }
    })).toEqual(['https://img.example/async.png']);
  });

  it('sanitizes Qwen sk-style keys out of upstream errors', () => {
    const key = 'sk-abcdefghijklmnopqrstuvwxyz1234567890';
    const masked = __internal.sanitizeErrorMessage(`bad key ${key}`, [key]);
    expect(masked).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(masked).toContain('sk-abc');
  });

  it('Qwen requests require a DashScope key from BYOK or DASHSCOPE_API_KEY', async () => {
    const { res, calls } = mockRes();
    await imageHandler(mockReq({ provider: 'qwen', prompt: 'textless background' }) as never, res as never);
    expect(calls[0].status).toBe(500);
    expect(String((calls[0].payload as { error: string }).error)).toContain('DASHSCOPE_API_KEY');
  });

  it('Qwen BYOK requests bypass ACCESS_TOKEN and return image URLs plus downloaded data URLs', async () => {
    process.env.ACCESS_TOKEN = 'server-token';
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/multimodal-generation/generation')) {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer sk-user-qwen-key' });
        return new Response(JSON.stringify({
          output: { choices: [{ message: { content: [{ image: 'https://img.example/generated.png' }] } }] },
          usage: { image_count: 1 }
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/png' } });
    });
    global.fetch = fetchMock as never;

    const { res, calls } = mockRes();
    await imageHandler(mockReq({ provider: 'qwen', model: 'qwen-image-2.0', size: '2688*1536' }, { 'x-qwen-api-key': 'sk-user-qwen-key' }) as never, res as never);
    expect(calls[0].status).toBe(200);
    expect((calls[0].payload as { imageUrls: string[] }).imageUrls).toEqual(['https://img.example/generated.png']);
    expect((calls[0].payload as { dataUrls: string[] }).dataUrls[0]).toContain('data:image/png;base64,');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Qwen server-key mode uses DASHSCOPE_API_KEY when no BYOK header is present', async () => {
    process.env.DASHSCOPE_API_KEY = 'sk-server-qwen-key';
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/multimodal-generation/generation')) {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer sk-server-qwen-key' });
        return new Response(JSON.stringify({
          output: { choices: [{ message: { content: [{ image: 'https://img.example/server.png' }] } }] },
          usage: { image_count: 1 }
        }), { status: 200 });
      }
      return new Response(new Uint8Array([7, 8, 9]), { status: 200, headers: { 'content-type': 'image/png' } });
    });
    global.fetch = fetchMock as never;

    const { res, calls } = mockRes();
    await imageHandler(mockReq({ provider: 'qwen', model: 'qwen-image-2.0' }) as never, res as never);
    expect(calls[0].status).toBe(200);
    expect((calls[0].payload as { imageUrls: string[] }).imageUrls).toEqual(['https://img.example/server.png']);
  });

  it('Qwen async models submit a task with X-DashScope-Async and poll until success', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/image-synthesis')) {
        expect(init?.headers).toMatchObject({ 'X-DashScope-Async': 'enable' });
        return new Response(JSON.stringify({ output: { task_id: 'task-42' } }), { status: 200 });
      }
      if (url.includes('/tasks/task-42')) {
        return new Response(JSON.stringify({ output: { task_status: 'SUCCEEDED', results: [{ url: 'https://img.example/async.png' }] } }), { status: 200 });
      }
      return new Response(new Uint8Array([4, 5, 6]), { status: 200, headers: { 'content-type': 'image/png' } });
    });
    global.fetch = fetchMock as never;

    const { res, calls } = mockRes();
    await imageHandler(mockReq({ provider: 'qwen', model: 'qwen-image-plus', size: '1664*928' }, { 'x-qwen-api-key': 'sk-user-qwen-key' }) as never, res as never);
    expect(calls[0].status).toBe(200);
    expect((calls[0].payload as { taskId: string }).taskId).toBe('task-42');
    expect((calls[0].payload as { imageUrls: string[] }).imageUrls).toEqual(['https://img.example/async.png']);
  });
});

describe('[v3.45] api/image.js Qwen image editing (img2img)', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const smallImage = 'data:image/jpeg;base64,AAAA';

  beforeEach(() => {
    __internal.rateLimitBuckets.clear();
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.ACCESS_TOKEN;
    global.fetch = originalFetch;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('buildQwenRequestBody puts reference images first, then the text instruction, in the sync content array', () => {
    const body = __internal.buildQwenRequestBody({
      model: 'qwen-image-2.0',
      prompt: 'make the sky more purple',
      negativePrompt: 'no text',
      size: '2688*1536',
      n: 1,
      asyncMode: false,
      inputImages: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB']
    });
    expect(body.input.messages[0].content).toEqual([
      { image: 'data:image/jpeg;base64,AAA' },
      { image: 'data:image/jpeg;base64,BBB' },
      { text: 'make the sky more purple' }
    ]);
  });

  it('parseQwenErrorBody/formatQwenErrorDetail extract code/message/request_id from a DashScope JSON error body', () => {
    const parsed = __internal.parseQwenErrorBody(JSON.stringify({ code: 'InvalidApiKey', message: 'The API key is invalid.', request_id: 'req-1' }));
    expect(parsed).toEqual({ code: 'InvalidApiKey', message: 'The API key is invalid.', requestId: 'req-1' });
    expect(__internal.formatQwenErrorDetail(parsed, 'raw fallback')).toBe('InvalidApiKey: The API key is invalid. (request_id: req-1)');
    expect(__internal.parseQwenErrorBody('not json')).toEqual({});
    expect(__internal.formatQwenErrorDetail({}, 'raw fallback')).toBe('raw fallback');
  });

  it('isQwenAuthError recognizes 401/403 status and DashScope auth-related codes', () => {
    expect(__internal.isQwenAuthError({ status: 401 })).toBe(true);
    expect(__internal.isQwenAuthError({ status: 403 })).toBe(true);
    expect(__internal.isQwenAuthError({ status: 400, code: 'InvalidApiKey' })).toBe(true);
    expect(__internal.isQwenAuthError({ status: 400, code: 'InvalidParameter' })).toBe(false);
  });

  it('rejects more than the supported number of reference images before calling upstream', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as never;
    const { res, calls } = mockRes();
    await imageHandler(mockReq({ provider: 'qwen', inputImages: [smallImage, smallImage, smallImage, smallImage] }, { 'x-qwen-api-key': 'sk-user-qwen-key' }) as never, res as never);
    expect(calls[0].status).toBe(400);
    expect(String((calls[0].payload as { error: string }).error)).toContain('3장');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an oversized combined reference-image payload before calling upstream', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as never;
    const oversized = 'A'.repeat(__internal.MAX_INPUT_IMAGES_BYTES + 1);
    const { res, calls } = mockRes();
    await imageHandler(mockReq({ provider: 'qwen', inputImages: [oversized] }, { 'x-qwen-api-key': 'sk-user-qwen-key' }) as never, res as never);
    expect(calls[0].status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forces sync mode and substitutes the sync default model when an async-only model is requested with reference images', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/multimodal-generation/generation')) {
        // async-only header must never be sent for an editing request
        expect(init?.headers).not.toHaveProperty('X-DashScope-Async');
        const body = JSON.parse(String(init?.body));
        expect(body.model).toBe(__internal.QWEN_DEFAULT_MODEL);
        expect(body.input.messages[0].content[0]).toEqual({ image: smallImage });
        return new Response(JSON.stringify({
          output: { choices: [{ message: { content: [{ image: 'https://img.example/edited.png' }] } }] },
          usage: { image_count: 1 }
        }), { status: 200 });
      }
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/png' } });
    });
    global.fetch = fetchMock as never;

    const { res, calls } = mockRes();
    await imageHandler(mockReq({ provider: 'qwen', model: 'qwen-image-plus', inputImages: [smallImage] }, { 'x-qwen-api-key': 'sk-user-qwen-key' }) as never, res as never);
    expect(calls[0].status).toBe(200);
    const payload = calls[0].payload as { model: string; modelSubstituted: boolean };
    expect(payload.model).toBe(__internal.QWEN_DEFAULT_MODEL);
    expect(payload.modelSubstituted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not substitute the model when the requested one is already sync-capable', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/multimodal-generation/generation')) {
        return new Response(JSON.stringify({
          output: { choices: [{ message: { content: [{ image: 'https://img.example/edited.png' }] } }] },
          usage: { image_count: 1 }
        }), { status: 200 });
      }
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'image/png' } });
    });
    global.fetch = fetchMock as never;

    const { res, calls } = mockRes();
    await imageHandler(mockReq({ provider: 'qwen', model: 'qwen-image-max', inputImages: [smallImage] }, { 'x-qwen-api-key': 'sk-user-qwen-key' }) as never, res as never);
    expect(calls[0].status).toBe(200);
    const payload = calls[0].payload as { model: string; modelSubstituted: boolean };
    expect(payload.model).toBe('qwen-image-max');
    expect(payload.modelSubstituted).toBe(false);
  });

  it('appends a region-mismatch hint to the error message on an auth failure', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ code: 'InvalidApiKey', message: 'The API key is invalid.', request_id: 'req-9' }),
      { status: 401 }
    ));
    global.fetch = fetchMock as never;

    const { res, calls } = mockRes();
    await imageHandler(mockReq({ provider: 'qwen', region: 'beijing' }, { 'x-qwen-api-key': 'sk-user-qwen-key' }) as never, res as never);
    expect(calls[0].status).toBe(401);
    const message = String((calls[0].payload as { error: string }).error);
    expect(message).toContain('리전 불일치');
    expect(message).toContain('베이징');
  });
});
