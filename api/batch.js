// TASK E2 (v3.5) — Anthropic Message Batches API (50% cheaper than standard
// calls). This is a *separate* serverless function from api/generate.js
// (batch jobs take minutes-to-hours, not seconds, so they need their own
// create/poll/cancel lifecycle instead of one request/response). Every
// helper below is duplicated in miniature from generate.js rather than
// imported, so each serverless function stays a fully independent unit —
// consistent with how this project already treats api/*.js files.

const MAX_BODY_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 30_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

const rateLimitBuckets = new Map();

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    if (Buffer.byteLength(req.body, 'utf8') > MAX_BODY_BYTES) {
      throw new Error('Request body too large.');
    }
    return JSON.parse(req.body || '{}');
  }
  return req.body;
}

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/** TASK C1 (v3.6) — mirrors api/generate.js's resolveCorsOrigin (kept identical on purpose, see that file's comment for the full rationale). */
function resolveCorsOrigin(req) {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers?.origin;
  if (!allowed.length) return { origin: origin || '*', blocked: false };
  if (origin && allowed.includes(origin)) return { origin, blocked: false };
  return { origin: allowed[0], blocked: true };
}

/** TASK C2 (v3.6) — mirrors api/generate.js's checkAccessToken. */
function checkAccessToken(req) {
  const required = process.env.ACCESS_TOKEN;
  if (!required) return true;
  return req.headers?.['x-access-token'] === required;
}

function checkRateLimit(key) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key) || [];
  const recent = bucket.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitBuckets.set(key, recent);
    return false;
  }
  recent.push(now);
  rateLimitBuckets.set(key, recent);
  return true;
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('요청이 시간 초과되었습니다. 잠시 후 다시 시도하세요.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * TASK v3.22 — mirrors api/generate.js's cleanJsonText: strip a ```json ...
 * ``` fence wherever it appears, not just anchored to the exact start/end
 * of the string, since Claude sometimes prefixes the fence with a sentence
 * of prose. See that file's comment for the real [GEN DIAG] evidence
 * (stop_reason: 'end_turn' on every chunk of a request the app still
 * reported as truncated) that found this.
 */
function cleanJsonText(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced ? fenced[1] : raw).trim();
}

/** TASK v3.22 — mirrors api/generate.js's extractJsonObject: recovery pass for unfenced prose around the JSON ("Sure, here's the playlist: {...} Hope that helps!"). */
function extractJsonObject(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return text;
  return text.slice(start, end + 1);
}

function safeParseBlueprint(text) {
  const cleaned = cleanJsonText(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall through to the extraction pass below
  }
  try {
    return JSON.parse(extractJsonObject(cleaned));
  } catch {
    if (process.env.DEBUG_ANTHROPIC === '1') {
      const raw = String(text || '');
      console.error('[PARSE FAIL] len=', raw.length, 'head=', raw.slice(0, 2000));
      console.error('[PARSE FAIL] tail=', raw.slice(-2000));
    }
    return null;
  }
}

/**
 * TASK v3.20 — mirrors api/generate.js's raised budget: real Claude output
 * per song runs well past the old 1200-token/song estimate, truncating mid-
 * response (stop_reason: 'max_tokens') on modest batch sizes. See that
 * file's computeMaxTokens comment for the full rationale.
 */
const MODEL_MAX_OUTPUT_TOKENS = {
  'claude-sonnet-5': 128_000,
  'claude-opus-4-8': 128_000,
  'claude-haiku-4-5': 64_000,
  'claude-haiku-4-5-20251001': 64_000
};
const DEFAULT_MAX_OUTPUT_TOKENS = 32_000;

function maxOutputTokensFor(model) {
  return MODEL_MAX_OUTPUT_TOKENS[model] || DEFAULT_MAX_OUTPUT_TOKENS;
}

function computeMaxTokens(batchSize, model) {
  const size = Number.isFinite(Number(batchSize)) && Number(batchSize) > 0 ? Number(batchSize) : 6;
  return Math.min(maxOutputTokensFor(model), size * 2400 + 3000);
}

/**
 * Mirrors api/generate.js's buildAnthropicSystem (kept identical on purpose
 * so cached system blocks match byte-for-byte and Anthropic's prompt cache
 * still hits inside a batch job).
 *
 * TASK v3.19 — disableCache is a diagnostic escape hatch (env var
 * DISABLE_PROMPT_CACHE=1) for isolating whether cache_control:ephemeral is
 * involved in an otherwise-undiagnosed Batch API failure: it sends the same
 * text as one plain string with no cache_control blocks at all. Not carried
 * over to api/generate.js — the real-time path is confirmed working without
 * it; this exists only to rule caching in/out for the still-undiagnosed
 * batch failure.
 */
function buildAnthropicSystem({ system, cacheableSystemBlocks, volatileSystemText, disableCache }) {
  if (Array.isArray(cacheableSystemBlocks) && cacheableSystemBlocks.length) {
    if (disableCache) {
      const parts = cacheableSystemBlocks.filter(text => typeof text === 'string' && text.length);
      if (volatileSystemText) parts.push(volatileSystemText);
      return parts.join('\n\n');
    }
    const blocks = cacheableSystemBlocks
      .filter(text => typeof text === 'string' && text.length)
      .map(text => ({ type: 'text', text, cache_control: { type: 'ephemeral' } }));
    if (volatileSystemText) blocks.push({ type: 'text', text: volatileSystemText });
    return blocks;
  }
  return system;
}

function anthropicHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01'
  };
}

/**
 * TASK v3.19 — createBatch/getBatchStatus/getBatchResults/cancelBatch all
 * built an Error with .detail on a non-2xx response but never surfaced it
 * anywhere, so a failed batch job showed only "요청에 실패" with no way to
 * find the actual Anthropic error. Mirrors api/generate.js's
 * [ANTHROPIC 400 DIAG] pattern (same DEBUG_ANTHROPIC=1 gate, same
 * error.detail -> response message plumbing in the handler catch below).
 */
function logBatchDiag(operation, response, detail) {
  if (process.env.DEBUG_ANTHROPIC !== '1') return;
  console.error('[BATCH DIAG] operation=', operation);
  console.error('[BATCH DIAG] status=', response.status);
  console.error('[BATCH DIAG] upstream response=', detail);
}

/**
 * TASK v3.18 — mirrors api/generate.js's TEMPERATURE_SUPPORTED: Anthropic
 * deprecated temperature/top_p/top_k on claude-sonnet-5 and the opus-4-7+
 * family (400 invalid_request_error), so it's omitted from batch params
 * unless the resolved model is explicitly whitelisted here.
 */
const TEMPERATURE_SUPPORTED = new Set([]);

async function createBatch({ requests, userApiKey }) {
  const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on the server.');
  if (!Array.isArray(requests) || !requests.length) throw new Error('No requests provided for the batch job.');

  const promptCacheDisabled = process.env.DISABLE_PROMPT_CACHE === '1';
  const body = {
    requests: requests.map(r => {
      const model = (typeof r.model === 'string' && r.model.trim()) || 'claude-sonnet-5';
      const params = {
        model,
        max_tokens: computeMaxTokens(r.batchSize, model),
        system: buildAnthropicSystem({ ...r, disableCache: promptCacheDisabled }),
        messages: [{ role: 'user', content: `Return JSON only.\n${JSON.stringify(r.user, null, 2)}` }]
      };
      if (TEMPERATURE_SUPPORTED.has(model)) {
        params.temperature = Number.isFinite(Number(r.temperature)) ? Number(r.temperature) : 0.8;
      }
      return { custom_id: r.customId, params };
    })
  };

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages/batches', {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify(body)
  }, REQUEST_TIMEOUT_MS);

  if (!response.ok) {
    const detail = await response.text();
    logBatchDiag('create', response, detail);
    const error = new Error(`Anthropic batch create failed: ${response.status}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const data = await response.json();
  return { batchId: data.id, status: data.processing_status, requestCounts: data.request_counts || null };
}

async function getBatchStatus({ batchId, userApiKey }) {
  const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on the server.');
  if (!batchId) throw new Error('Missing batchId.');

  const response = await fetchWithTimeout(`https://api.anthropic.com/v1/messages/batches/${encodeURIComponent(batchId)}`, {
    method: 'GET',
    headers: anthropicHeaders(apiKey)
  }, REQUEST_TIMEOUT_MS);

  if (!response.ok) {
    const detail = await response.text();
    logBatchDiag('status', response, detail);
    const error = new Error(`Anthropic batch status check failed: ${response.status}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const data = await response.json();
  return {
    status: data.processing_status,
    requestCounts: data.request_counts || null,
    resultsUrl: data.results_url || null
  };
}

function parseJsonl(text) {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

async function getBatchResults({ batchId, userApiKey }) {
  const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on the server.');

  const status = await getBatchStatus({ batchId, userApiKey });
  if (status.status !== 'ended') {
    return { done: false, status: status.status, results: [] };
  }
  if (!status.resultsUrl) {
    return { done: true, status: status.status, results: [] };
  }

  const response = await fetchWithTimeout(status.resultsUrl, { method: 'GET', headers: anthropicHeaders(apiKey) }, REQUEST_TIMEOUT_MS);
  if (!response.ok) {
    const detail = await response.text();
    logBatchDiag('results', response, detail);
    const error = new Error(`Anthropic batch results fetch failed: ${response.status}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const text = await response.text();
  const lines = parseJsonl(text);
  const results = lines.map(line => {
    const customId = line.custom_id;
    if (line.result?.type === 'succeeded') {
      const message = line.result.message;
      const usage = message?.usage
        ? {
          inputTokens: message.usage.input_tokens || 0,
          outputTokens: message.usage.output_tokens || 0,
          cacheReadInputTokens: message.usage.cache_read_input_tokens || 0,
          cacheCreationInputTokens: message.usage.cache_creation_input_tokens || 0
        }
        : null;
      // TASK v3.20 — a batch request can succeed at the HTTP/job level while
      // its own generation hit max_tokens. Check stop_reason before trusting
      // safeParseBlueprint's lenient salvage parse: a cutoff landing right
      // after a complete song object would otherwise parse "successfully"
      // with fewer songs than requested and no error at all.
      if (message?.stop_reason === 'max_tokens') {
        if (process.env.DEBUG_ANTHROPIC === '1') {
          console.error('[BATCH DIAG] customId=', customId, 'stop_reason=max_tokens', 'output_tokens=', message.usage?.output_tokens);
        }
        return { customId, blueprint: null, usage, error: 'LLM 응답이 잘렸습니다 (배치, max_tokens).' };
      }
      const content = message?.content?.map(part => part.text || '').join('\n') || '{}';
      const blueprint = safeParseBlueprint(content);
      // TASK v3.21 — same real usage measurement as api/generate.js's [GEN
      // USAGE], so a 30-song Batch job's real per-song cost can be measured
      // before committing to it as the default path for large packs.
      if (usage && process.env.DEBUG_ANTHROPIC === '1') {
        const songCount = Array.isArray(blueprint?.songs) && blueprint.songs.length ? blueprint.songs.length : 1;
        console.error(
          '[GEN USAGE] customId=', customId,
          'chunk=', songCount,
          'output=', usage.outputTokens,
          'perSong=', usage.outputTokens / songCount,
          'cacheReadInputTokens=', usage.cacheReadInputTokens
        );
      }
      return { customId, blueprint, usage, error: blueprint ? null : 'LLM 응답을 해석하지 못했습니다.' };
    }
    const errorType = line.result?.type || 'errored';
    return { customId, blueprint: null, usage: null, error: `배치 요청 실패 (${errorType})` };
  });

  return { done: true, status: status.status, results };
}

async function cancelBatch({ batchId, userApiKey }) {
  const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on the server.');
  if (!batchId) throw new Error('Missing batchId.');

  const response = await fetchWithTimeout(`https://api.anthropic.com/v1/messages/batches/${encodeURIComponent(batchId)}/cancel`, {
    method: 'POST',
    headers: anthropicHeaders(apiKey)
  }, REQUEST_TIMEOUT_MS);

  if (!response.ok) {
    const detail = await response.text();
    logBatchDiag('cancel', response, detail);
    const error = new Error(`Anthropic batch cancel failed: ${response.status}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const data = await response.json();
  return { status: data.processing_status };
}

export default async function handler(req, res) {
  const cors = resolveCorsOrigin(req);
  res.setHeader?.('Access-Control-Allow-Origin', cors.origin);
  res.setHeader?.('Vary', 'Origin');
  res.setHeader?.('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type, X-User-Api-Key, X-Access-Token');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed.');
    return;
  }
  if (cors.blocked) {
    sendError(res, 403, 'Origin not allowed.');
    return;
  }
  if (!checkRateLimit(clientIp(req))) {
    sendError(res, 429, '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.');
    return;
  }

  try {
    const body = parseBody(req);
    const userApiKey = req.headers?.['x-user-api-key'] || undefined;

    if (!userApiKey && !checkAccessToken(req)) {
      sendError(res, 401, '서버 API 키를 사용하려면 접근 토큰(X-Access-Token)이 필요합니다.');
      return;
    }

    if (body.action === 'create') {
      res.status(200).json(await createBatch({ requests: body.requests, userApiKey }));
      return;
    }
    if (body.action === 'status') {
      res.status(200).json(await getBatchStatus({ batchId: body.batchId, userApiKey }));
      return;
    }
    if (body.action === 'results') {
      res.status(200).json(await getBatchResults({ batchId: body.batchId, userApiKey }));
      return;
    }
    if (body.action === 'cancel') {
      res.status(200).json(await cancelBatch({ batchId: body.batchId, userApiKey }));
      return;
    }
    sendError(res, 400, 'Unknown or missing action.');
  } catch (error) {
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    const baseMessage = status === 401
      ? 'API 키가 올바르지 않습니다.'
      : status === 429
        ? '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.'
        : (error instanceof Error ? error.message : String(error));
    const message = error?.detail ? `${baseMessage} :: ${String(error.detail).slice(0, 500)}` : baseMessage;
    sendError(res, status, message);
  }
}

// exported for tests only
export const __internal = { safeParseBlueprint, buildAnthropicSystem, computeMaxTokens, parseJsonl, resolveCorsOrigin, checkAccessToken, TEMPERATURE_SUPPORTED, maxOutputTokensFor, cleanJsonText, extractJsonObject };
