const RATE_LIMIT_WINDOW_MS = 60_000;
/**
 * TASK v3.32 — 10/min was sized for the old 1-30 song cap (a handful of
 * chunks). An 80-song real-time pack now runs up to ~40 chunks at
 * REALTIME_CONCURRENCY=3 (see src/providers/index.ts), which this local
 * proxy's own limiter — not Anthropic's real rate limit, which still applies
 * upstream and is handled by callGenerateProxy's backoff retry — would
 * otherwise 429 before a single pack finishes. Raised with headroom for
 * retries, but still capped (not unlimited) so this stays a runaway-loop
 * guard rather than no limit at all.
 *
 * TASK v3.33 — 60 -> 90: multi-set generation (src/core/multiSetGeneration.ts)
 * can request up to 200 songs total across a run (10 sets x 20 songs), which
 * at the same ~2-song realtime chunk size is ~100 chunks — comfortably under
 * 90/min only because REALTIME_CONCURRENCY batches them into waves of 3.
 */
const RATE_LIMIT_MAX_REQUESTS = 90;
const MAX_BODY_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 30_000;

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

/**
 * TASK v3.22 — real [GEN DIAG] logs showed stop_reason: 'end_turn' (a
 * complete, non-truncated response) on every chunk of a "잘렸습니다"-
 * reporting request. The old cleanJsonText only stripped a fence anchored
 * to the exact start/end of the string, so a response like "Here's the
 * JSON:\n```json\n{...}\n```\nLet me know if you'd like changes." never
 * matched and fell straight through to a parse failure that got mislabeled
 * as truncation. Strip a fence wherever it appears instead of requiring it
 * to bookend the whole string.
 */
function cleanJsonText(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced ? fenced[1] : raw).trim();
}

/**
 * TASK v3.22 — a second recovery pass for prose that isn't fenced at all
 * ("Sure, here is the playlist: {...} Hope that helps!"): take everything
 * from the first { to the last }. Deliberately not attempting anything
 * fancier (unescaped control characters, stray quotes) — over-eager repair
 * of the raw text risks silently corrupting lyrics content; see the
 * [PARSE FAIL] log in safeParseBlueprint for what actually needs fixing
 * before reaching for a more aggressive repair.
 */
function extractJsonObject(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return text;
  return text.slice(start, end + 1);
}

/**
 * TASK v3.20 — code='TRUNCATED' lets the client (src/providers/index.ts's
 * generateBlueprint) distinguish "the model ran out of max_tokens, split
 * this batch and retry" from any other failure, instead of string-matching
 * the Korean error message.
 */
function truncatedError() {
  const error = new Error('LLM 응답이 잘렸습니다. 곡 수를 줄이거나 배치 크기를 낮추세요.');
  error.code = 'TRUNCATED';
  return error;
}

/**
 * TASK v3.22 — distinct from truncatedError(): the response was complete
 * (stop_reason/finish_reason was NOT the truncation value — that case is
 * checked and thrown separately by the caller *before* safeParseBlueprint
 * ever runs), but the text still isn't valid JSON after both recovery
 * passes. Splitting into smaller chunks can't fix a formatting problem, so
 * generateChunkWithSplitRetry deliberately does not treat this like
 * TRUNCATED — it has no dedicated handling for this code, which means it
 * propagates immediately instead of being retried with a smaller chunk.
 */
function parseFailedError() {
  const error = new Error('응답 형식을 해석하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  error.code = 'PARSE_FAILED';
  return error;
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
    // fall through to the diagnostic log + error below
  }
  if (process.env.DEBUG_ANTHROPIC === '1') {
    const raw = String(text || '');
    console.error('[PARSE FAIL] len=', raw.length, 'head=', raw.slice(0, 2000));
    console.error('[PARSE FAIL] tail=', raw.slice(-2000));
  }
  throw parseFailedError();
}

function sendError(res, status, message, code) {
  res.status(status).json(code ? { error: message, code } : { error: message });
}

function maskKey(key) {
  if (!key) return '';
  return `${key.slice(0, 6)}...${key.slice(-2)}`;
}

function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * TASK C1 (v3.6) — reflecting whatever Origin a request sends (the prior
 * behavior) is effectively no CORS at all: anyone who knows the deployed URL
 * can call this endpoint cross-origin and spend the server's API key.
 * ALLOWED_ORIGINS unset means "local/dev — allow anything" (unchanged
 * default), matching this project's local-first design; set it before a
 * public deploy. See README for the deploy checklist.
 */
function resolveCorsOrigin(req) {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers?.origin;
  if (!allowed.length) return { origin: origin || '*', blocked: false };
  if (origin && allowed.includes(origin)) return { origin, blocked: false };
  return { origin: allowed[0], blocked: true };
}

/**
 * TASK C2 (v3.6) — server-key mode (no X-User-Api-Key header, so the
 * request would spend process.env.ANTHROPIC_API_KEY / OPENAI_API_KEY) has no
 * authentication at all otherwise: anyone who finds the endpoint can call it
 * and run up the deployer's bill. Only enforced when ACCESS_TOKEN is set —
 * unset means "this deployment doesn't gate its server key" (the BYOK path
 * remains unaffected either way, since a caller supplying their own key is
 * only ever spending their own money).
 */
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

/**
 * TASK v3.20 — real Claude output per song runs well past the local
 * generator's ~710-token template (richer lyrics, more structure), so the
 * old budget (1200/song + 2000, capped at 16000) truncated mid-response on
 * as few as 5 songs — stop_reason: 'max_tokens', then a JSON parse failure
 * or (worse) a silently-incomplete song list. Raised to 2400/song + 3000,
 * capped at the resolved model's actual max output tokens (falls back to
 * DEFAULT_MAX_OUTPUT_TOKENS for an unrecognized/omitted model, e.g. OpenAI
 * callers who don't pass one) so a future model swap adjusts automatically
 * instead of silently under- or over-shooting a hardcoded number.
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

async function fetchWithTimeout(url, init, timeoutMs, timeoutMessage = '요청이 시간 초과되었습니다. 곡 수를 줄이고 다시 시도하세요.') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * TASK v3.19 — REQUEST_TIMEOUT_MS was a flat 30s, so a real-time (non-batch)
 * request for more than a couple of songs aborted before Anthropic finished
 * generating the larger output — the previous timeout error blamed "too many
 * songs" but the real fix is scaling the deadline with the actual output
 * size (computeMaxTokens already scales the same way). Capped at 5 minutes;
 * a deployment on a shorter serverless function limit (Vercel Hobby: 10s)
 * should push large jobs through /api/batch instead of raising this further.
 */
function computeTimeoutMs(batchSize) {
  const size = Number.isFinite(Number(batchSize)) && Number(batchSize) > 0 ? Number(batchSize) : 6;
  return Math.min(300_000, 60_000 + size * 15_000);
}

async function callOpenAI({ model, temperature, system, user, batchSize, userApiKey }) {
  const apiKey = userApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured on the server.');

  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-4.1-mini',
      temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 0.8,
      max_tokens: computeMaxTokens(batchSize),
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(user, null, 2) }
      ]
    })
  }, REQUEST_TIMEOUT_MS);

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`OpenAI upstream failed: ${response.status}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const data = await response.json();
  // TASK v3.22 — mirrors callAnthropic's stop_reason gate: OpenAI's
  // equivalent truncation signal is finish_reason: 'length'. Checking it
  // before safeParseBlueprint keeps a genuine truncation labeled TRUNCATED
  // (split-retry helps) instead of PARSE_FAILED (split-retry can't help a
  // formatting problem) — same reasoning as the Anthropic path.
  if (data.choices?.[0]?.finish_reason === 'length') {
    throw truncatedError();
  }
  const blueprint = safeParseBlueprint(data.choices?.[0]?.message?.content || '{}');
  const usage = data.usage
    ? { inputTokens: data.usage.prompt_tokens || 0, outputTokens: data.usage.completion_tokens || 0 }
    : null;
  return { blueprint, usage };
}

/**
 * TASK E1 (v3.5) — cacheableSystemBlocks are the stable rules + channel/
 * genre/mood/season profile, each marked cache_control: ephemeral so
 * Anthropic reuses them (at ~10% of the input token cost) on every batch
 * after the first. volatileSystemText (the batch-offset note) is appended
 * uncached, since it changes every call and would otherwise break the
 * cached prefix. Falls back to a plain string `system` for callers that
 * don't split it (kept for forward/backward compatibility, unused by this
 * app's own client code once TASK E1 shipped).
 */
function buildAnthropicSystem({ system, cacheableSystemBlocks, volatileSystemText }) {
  if (Array.isArray(cacheableSystemBlocks) && cacheableSystemBlocks.length) {
    const blocks = cacheableSystemBlocks
      .filter(text => typeof text === 'string' && text.length)
      .map(text => ({ type: 'text', text, cache_control: { type: 'ephemeral' } }));
    if (volatileSystemText) blocks.push({ type: 'text', text: volatileSystemText });
    return blocks;
  }
  return system;
}

/**
 * TASK v3.16-diag2 (superseded by v3.18, kept for TEMPERATURE_SUPPORTED
 * below) — clamps to Anthropic's old [0,1] range. Only relevant for a model
 * added to TEMPERATURE_SUPPORTED; the app's current default (claude-sonnet-5)
 * doesn't send temperature at all, so this isn't reached in practice today.
 */
function clampAnthropicTemperature(temperature) {
  const value = Number.isFinite(Number(temperature)) ? Number(temperature) : 0.8;
  return Math.min(1, Math.max(0, value));
}

/**
 * TASK v3.18 — Anthropic deprecated `temperature`/`top_p`/`top_k` on Claude
 * Opus 4.7+ (incl. 4.8) and Claude Sonnet 5: sending any of them returns
 * `400 invalid_request_error: "temperature is deprecated for this model."`.
 * v3.16-diag2's [0,1] clamp assumed a *range* problem and didn't fix this —
 * the parameter itself is rejected, at any value. This app's default model
 * (claude-sonnet-5, see data/modelRegistry.ts) is exactly one of the
 * deprecated-on models, so temperature is omitted from the request unless
 * the resolved model is explicitly whitelisted here as still supporting it.
 * Output variety is controlled through the prompt instead.
 */
const TEMPERATURE_SUPPORTED = new Set([
  // Add an older model id here only if it's confirmed to still accept
  // temperature — claude-sonnet-5 and the opus-4-7/4-8 family reject it.
]);

/**
 * TASK v3.16-diag2 — a whitespace-only model string (' ') is truthy and
 * passes `model || 'claude-sonnet-5'` unchanged, reaching Anthropic as an
 * invalid model id. Trim before falling back.
 */
function resolveAnthropicModel(model) {
  return (typeof model === 'string' && model.trim()) || 'claude-sonnet-5';
}

/**
 * TASK v3.21 — generateChunkWithSplitRetry (src/providers/index.ts) gives
 * up once a single song still truncates at the normal per-song budget
 * (2400 + 3000 overhead = 5400 tokens for batchSize=1). Before failing for
 * good, it retries exactly once with maxTokensBudgetSongs set higher than
 * the real requested song count, so max_tokens is computed as if for a
 * bigger batch without changing what's actually being asked for (no new
 * request field semantics to invent — just a bigger number fed to the same
 * formula). Omitted/invalid falls back to the real batchSize, unchanged
 * from before this task.
 */
function resolveTokenBudgetSize(batchSize, maxTokensBudgetSongs) {
  return Number.isFinite(Number(maxTokensBudgetSongs)) && Number(maxTokensBudgetSongs) > 0
    ? Number(maxTokensBudgetSongs)
    : batchSize;
}

async function callAnthropic({ model, temperature, system, cacheableSystemBlocks, volatileSystemText, user, batchSize, maxTokensBudgetSongs, userApiKey }) {
  const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on the server.');

  const resolvedModel = resolveAnthropicModel(model);
  const tokenBudgetSize = resolveTokenBudgetSize(batchSize, maxTokensBudgetSongs);
  const maxTokens = computeMaxTokens(tokenBudgetSize, resolvedModel);
  const requestSystem = buildAnthropicSystem({ system, cacheableSystemBlocks, volatileSystemText });
  const requestBody = {
    model: resolvedModel,
    max_tokens: maxTokens,
    system: requestSystem,
    messages: [
      {
        role: 'user',
        content: `Return JSON only.\n${JSON.stringify(user, null, 2)}`
      }
    ]
  };
  if (TEMPERATURE_SUPPORTED.has(resolvedModel)) {
    requestBody.temperature = clampAnthropicTemperature(temperature);
  }

  // TASK v3.21 — logged before the request so model/max_tokens are known
  // even if the request itself times out or throws before a response body
  // exists. See the [GEN DIAG]/[GEN USAGE] pair below for the response side.
  if (process.env.DEBUG_ANTHROPIC === '1') {
    console.error('[GEN DIAG] model=', resolvedModel, 'batchSize=', batchSize, 'tokenBudgetSize=', tokenBudgetSize, 'maxTokens=', maxTokens);
  }

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(requestBody)
  }, computeTimeoutMs(batchSize), '응답이 오래 걸립니다. 곡 수를 줄이거나 Batch 모드를 사용하세요.');

  if (!response.ok) {
    const detail = await response.text();
    if (process.env.DEBUG_ANTHROPIC === '1') {
      console.error('[ANTHROPIC 400 DIAG] status=', response.status);
      console.error('[ANTHROPIC 400 DIAG] model=', resolvedModel);
      console.error('[ANTHROPIC 400 DIAG] max_tokens=', maxTokens);
      console.error('[ANTHROPIC 400 DIAG] temperatureSent=', Object.prototype.hasOwnProperty.call(requestBody, 'temperature'));
      console.error('[ANTHROPIC 400 DIAG] systemBlocks=', Array.isArray(requestSystem) ? requestSystem.length : 'string');
      console.error('[ANTHROPIC 400 DIAG] upstream response=', detail);
    }
    const error = new Error(`Anthropic upstream failed: ${response.status}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const data = await response.json();
  // TASK v3.21 — logs stop_reason/output_tokens for every response (not just
  // failures) so a repeated "still truncating" report can be confirmed from
  // real data: was max_tokens actually reached, and does the model resolve
  // to what the client thinks it sent?
  if (process.env.DEBUG_ANTHROPIC === '1') {
    console.error('[GEN DIAG] stop_reason=', data.stop_reason, 'output_tokens=', data.usage?.output_tokens);
  }
  if (data.stop_reason === 'max_tokens') {
    // TASK v3.20 — don't attempt safeParseBlueprint's lenient "cut at the
    // last }" salvage here: a max_tokens cutoff can land right after a
    // complete song object, so the salvage would silently parse and return
    // fewer songs than requested with no error at all. A known truncation
    // must always fail loudly so the caller can split-and-retry.
    throw truncatedError();
  }
  const text = data.content?.map(part => part.text || '').join('\n') || '{}';
  const blueprint = safeParseBlueprint(text);
  const usage = data.usage
    ? {
      inputTokens: data.usage.input_tokens || 0,
      outputTokens: data.usage.output_tokens || 0,
      cacheReadInputTokens: data.usage.cache_read_input_tokens || 0,
      cacheCreationInputTokens: data.usage.cache_creation_input_tokens || 0
    }
    : null;
  // TASK v3.21 — real per-song output tokens, measured, not estimated. Also
  // confirms prompt caching is actually hitting on chunk 2+ of a pack
  // (cacheReadInputTokens should be > 0 there; 0 across every chunk means
  // the cache boundary broke, not that caching itself is unsupported).
  if (usage && process.env.DEBUG_ANTHROPIC === '1') {
    const realSongCount = Number.isFinite(Number(batchSize)) && Number(batchSize) > 0 ? Number(batchSize) : 1;
    console.error(
      '[GEN USAGE] chunk=', realSongCount,
      'output=', usage.outputTokens,
      'perSong=', usage.outputTokens / realSongCount,
      'cacheReadInputTokens=', usage.cacheReadInputTokens,
      'cacheCreationInputTokens=', usage.cacheCreationInputTokens
    );
  }
  return { blueprint, usage };
}

async function testOpenAI({ model, userApiKey }) {
  const apiKey = userApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is not configured.');
    error.status = 401;
    throw error;
  }
  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: model || 'gpt-4.1-mini', max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK.' }] })
  }, REQUEST_TIMEOUT_MS);
  if (!response.ok) {
    const error = new Error('OpenAI connection test failed.');
    error.status = response.status;
    throw error;
  }
}

async function testAnthropic({ model, userApiKey }) {
  const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const error = new Error('ANTHROPIC_API_KEY is not configured.');
    error.status = 401;
    throw error;
  }
  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: model || 'claude-sonnet-5', max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK.' }] })
  }, REQUEST_TIMEOUT_MS);
  if (!response.ok) {
    const error = new Error('Anthropic connection test failed.');
    error.status = response.status;
    throw error;
  }
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
    const provider = body.provider;
    const userApiKey = req.headers?.['x-user-api-key'] || undefined;

    if (!userApiKey && !checkAccessToken(req)) {
      sendError(res, 401, '서버 API 키를 사용하려면 접근 토큰(X-Access-Token)이 필요합니다.');
      return;
    }

    if (body.testMode) {
      if (provider === 'openai') await testOpenAI({ model: body.model, userApiKey });
      else if (provider === 'anthropic') await testAnthropic({ model: body.model, userApiKey });
      else {
        sendError(res, 400, 'Unsupported provider.');
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    const hasSystem = body.system || (Array.isArray(body.cacheableSystemBlocks) && body.cacheableSystemBlocks.length);
    if (!hasSystem || !body.user) {
      sendError(res, 400, 'Missing system or user payload.');
      return;
    }

    const result = provider === 'openai'
      ? await callOpenAI({ ...body, userApiKey })
      : provider === 'anthropic'
        ? await callAnthropic({ ...body, userApiKey })
        : null;

    if (!result) {
      sendError(res, 400, 'Unsupported provider.');
      return;
    }

    res.status(200).json({ blueprint: result.blueprint, usage: result.usage });
  } catch (error) {
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    const baseMessage = status === 401
      ? 'API 키가 올바르지 않습니다.'
      : status === 429
        ? '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.'
        : (error instanceof Error ? error.message : String(error));
    // 진단용: 업스트림이 준 실제 detail을 함께 노출 (키 등 민감정보는 detail에 포함되지 않음 — 요청 형식 오류 설명임)
    const message = error?.detail ? `${baseMessage} :: ${String(error.detail).slice(0, 500)}` : baseMessage;
    sendError(res, status, message, error?.code);
  }
}

// exported for tests only; never logs key material
export const __internal = { maskKey, computeMaxTokens, safeParseBlueprint, buildAnthropicSystem, resolveCorsOrigin, checkAccessToken, clampAnthropicTemperature, resolveAnthropicModel, TEMPERATURE_SUPPORTED, computeTimeoutMs, fetchWithTimeout, maxOutputTokensFor, resolveTokenBudgetSize, rateLimitBuckets, cleanJsonText, extractJsonObject };
