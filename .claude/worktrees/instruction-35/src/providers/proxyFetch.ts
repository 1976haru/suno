import type { ProviderSettings } from '../types';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * TASK C2 (v3.6) — the one place every provider call builds its proxy
 * headers, so X-Access-Token (needed only when a public deployment set
 * ACCESS_TOKEN server-side, see api/generate.js) is never missed on one call
 * site while present on another.
 */
export function buildProxyHeaders(settings: ProviderSettings): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (settings.keyStorageMode === 'local' && settings.apiKey) headers['X-User-Api-Key'] = settings.apiKey;
  if (settings.accessToken) headers['X-Access-Token'] = settings.accessToken;
  return headers;
}

/**
 * TASK v3.20 — carries api/generate.js's error.code (e.g. 'TRUNCATED') so
 * callers like generateBlueprint's split-retry can branch on a stable code
 * instead of string-matching the Korean error message.
 */
export class ProxyError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ProxyError';
    this.code = code;
  }
}

async function parseError(response: Response): Promise<{ message: string; code?: string }> {
  try {
    const data = await response.clone().json();
    if (data && typeof data.error === 'string') return { message: data.error, code: typeof data.code === 'string' ? data.code : undefined };
  } catch {
    // response body wasn't JSON; fall through to a generic status message
  }
  if (response.status === 401) return { message: 'API 키가 올바르지 않습니다.' };
  if (response.status === 429) return { message: '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.' };
  if (response.status >= 500) return { message: '서버 오류입니다. 곡 수를 줄여보세요.' };
  return { message: `요청이 실패했습니다 (${response.status}).` };
}

export interface CallGenerateProxyOptions {
  retries?: number;
  baseDelayMs?: number;
}

/**
 * POSTs to the /api/generate proxy with exponential-backoff retry on 429
 * (rate limit), and always throws a Korean-readable Error on failure
 * instead of surfacing raw response bodies.
 */
export async function callGenerateProxy(
  endpoint: string,
  headers: Record<string, string>,
  body: unknown,
  options: CallGenerateProxyOptions = {}
): Promise<Record<string, unknown>> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (response.ok) return response.json();

    if (response.status === 429 && attempt < retries) {
      await sleep(baseDelayMs * 2 ** attempt);
      continue;
    }

    const { message, code } = await parseError(response);
    throw new ProxyError(message, code);
  }

  throw new Error('요청이 실패했습니다.');
}
