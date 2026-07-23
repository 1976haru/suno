import { afterEach, describe, expect, it, vi } from 'vitest';
import generateHandler from '../api/generate.js';
import batchHandler from '../api/batch.js';
import viteConfig from '../vite.config';

function fakeRes() {
  return {
    statusCode: 200,
    payload: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    setHeader() { return this; },
    json(payload: unknown) { this.payload = payload; return this; },
    end() { return this; }
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ACCESS_TOKEN;
  delete process.env.ALLOWED_ORIGINS;
});

describe('temporary v3.6 upgrade compatibility audit', () => {
  it('does not send unsupported sampling parameters to Claude Sonnet 5 in synchronous generation', async () => {
    process.env.ANTHROPIC_API_KEY = 'audit-test-key';
    let upstreamBody: Record<string, unknown> = {};
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      upstreamBody = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: '{"songs":[]}' }],
        usage: { input_tokens: 1, output_tokens: 1 }
      }), { status: 200 });
    }));

    await generateHandler({
      method: 'POST',
      headers: {},
      body: {
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        temperature: 0.8,
        system: 'Return JSON only.',
        user: {},
        batchSize: 1
      }
    } as never, fakeRes() as never);

    expect(upstreamBody.model).toBe('claude-sonnet-5');
    expect(upstreamBody).not.toHaveProperty('temperature');
  });

  it('does not send unsupported sampling parameters to Claude Sonnet 5 Message Batches', async () => {
    process.env.ANTHROPIC_API_KEY = 'audit-test-key';
    let upstreamBody: { requests?: Array<{ params?: Record<string, unknown> }> } = {};
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      upstreamBody = JSON.parse(String(init?.body || '{}')) as typeof upstreamBody;
      return new Response(JSON.stringify({
        id: 'msgbatch_audit',
        processing_status: 'in_progress',
        request_counts: {}
      }), { status: 200 });
    }));

    await batchHandler({
      method: 'POST',
      headers: {},
      body: {
        action: 'create',
        requests: [{
          customId: 'b0',
          model: 'claude-sonnet-5',
          temperature: 0.8,
          batchSize: 1,
          system: 'Return JSON only.',
          user: {}
        }]
      }
    } as never, fakeRes() as never);

    expect(upstreamBody.requests?.[0]?.params?.model).toBe('claude-sonnet-5');
    expect(upstreamBody.requests?.[0]?.params).not.toHaveProperty('temperature');
  });

  it('mounts both synchronous and Batch API handlers in local Vite development', () => {
    const config = viteConfig as { plugins?: Array<{ name?: string; configureServer?: (server: unknown) => void }> };
    const plugin = config.plugins?.find(item => item?.name === 'suno-weaver-dev-api');
    const use = vi.fn();
    plugin?.configureServer?.({ middlewares: { use }, ssrLoadModule: vi.fn() });
    const mountedPaths = use.mock.calls.map(call => call[0]);

    expect(mountedPaths).toContain('/api/generate');
    expect(mountedPaths).toContain('/api/batch');
  });
});
