import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/**
 * TASK v3.25 — mounts one serverless-function module behind one dev route.
 * Shared by /api/generate and /api/batch (previously only /api/generate was
 * registered, so any real dev-mode Batch API call 404'd before ever reaching
 * api/batch.js — see this task's root-cause note). method/headers are
 * forwarded through unfiltered rather than restricted to POST: every action
 * this app's own client code sends (generate, and batch's create/status/
 * results/cancel) already goes over POST with an `action` field in the body,
 * not distinct HTTP methods, and each handler enforces its own method check
 * internally — the dev shim isn't the place to duplicate that.
 */
function mountApi(server: Parameters<NonNullable<Plugin['configureServer']>>[0], routePath: string, modulePath: string) {
  server.middlewares.use(routePath, async (req, res) => {
    const nodeRes = res as ServerResponse;
    try {
      const rawBody = await readRequestBody(req as IncomingMessage);
      const resShim = {
        statusCode: 200,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        setHeader(name: string, value: string) {
          nodeRes.setHeader(name, value);
          return this;
        },
        json(payload: unknown) {
          nodeRes.statusCode = this.statusCode;
          nodeRes.setHeader('Content-Type', 'application/json; charset=utf-8');
          nodeRes.end(JSON.stringify(payload));
        },
        end(payload?: string) {
          nodeRes.statusCode = this.statusCode;
          nodeRes.end(payload);
        }
      };

      const mod = await server.ssrLoadModule(modulePath);
      await mod.default(
        { method: req.method, headers: req.headers, body: rawBody },
        resShim
      );
    } catch (error) {
      nodeRes.statusCode = 500;
      nodeRes.setHeader('Content-Type', 'application/json; charset=utf-8');
      nodeRes.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
}

/**
 * `vite dev` never runs api/*.js (that only happens on a Vercel-style host),
 * so local dev has no way to exercise the openai/anthropic providers, or the
 * Batch API, without this. Mounts the same handlers behind /api/generate and
 * /api/batch during `npm run dev`; env vars (ANTHROPIC_API_KEY etc.) and the
 * X-User-Api-Key/X-Access-Token headers both handlers read need no special
 * handling here — same Node process, and headers are forwarded verbatim above.
 */
function devApiPlugin(): Plugin {
  return {
    name: 'suno-weaver-dev-api',
    configureServer(server) {
      mountApi(server, '/api/generate', '/api/generate.js');
      mountApi(server, '/api/batch', '/api/batch.js');
    }
  };
}

export default defineConfig({
  plugins: [react(), devApiPlugin()],
  server: {
    port: 5200,
    host: '127.0.0.1'
  }
});
