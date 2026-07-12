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
 * `vite dev` never runs api/generate.js (that only happens on a Vercel-style
 * host), so local dev has no way to exercise the openai/anthropic providers.
 * This mounts the same handler behind /api/generate during `npm run dev`.
 */
function devApiPlugin(): Plugin {
  return {
    name: 'suno-weaver-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/generate', async (req, res) => {
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

          const mod = await server.ssrLoadModule('/api/generate.js');
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
  };
}

export default defineConfig({
  plugins: [react(), devApiPlugin()],
  server: {
    port: 5200,
    host: '127.0.0.1'
  }
});
