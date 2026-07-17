const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
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

function cleanJsonText(text) {
  return String(text || '')
    .replace(/^```json/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim();
}

function safeParseBlueprint(text) {
  const cleaned = cleanJsonText(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const cut = cleaned.lastIndexOf('}');
    if (cut > 0) {
      try {
        return JSON.parse(cleaned.slice(0, cut + 1));
      } catch {
        // fall through to the error below
      }
    }
    throw new Error('LLM 응답이 잘렸습니다. 곡 수를 줄이거나 배치 크기를 낮추세요.');
  }
}

function sendError(res, status, message) {
  res.status(status).json({ error: message });
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

function computeMaxTokens(batchSize) {
  const size = Number.isFinite(Number(batchSize)) && Number(batchSize) > 0 ? Number(batchSize) : 6;
  return Math.min(16000, size * 1200 + 2000);
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('요청이 시간 초과되었습니다. 곡 수를 줄이고 다시 시도하세요.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
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

async function callAnthropic({ model, temperature, system, cacheableSystemBlocks, volatileSystemText, user, batchSize, userApiKey }) {
  const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on the server.');

  const resolvedModel = resolveAnthropicModel(model);
  const requestSystem = buildAnthropicSystem({ system, cacheableSystemBlocks, volatileSystemText });
  const requestBody = {
    model: resolvedModel,
    max_tokens: computeMaxTokens(batchSize),
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

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(requestBody)
  }, REQUEST_TIMEOUT_MS);

  if (!response.ok) {
    const detail = await response.text();
    if (process.env.DEBUG_ANTHROPIC === '1') {
      console.error('[ANTHROPIC 400 DIAG] status=', response.status);
      console.error('[ANTHROPIC 400 DIAG] model=', resolvedModel);
      console.error('[ANTHROPIC 400 DIAG] max_tokens=', computeMaxTokens(batchSize));
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
    sendError(res, status, message);
  }
}

// exported for tests only; never logs key material
export const __internal = { maskKey, computeMaxTokens, safeParseBlueprint, buildAnthropicSystem, resolveCorsOrigin, checkAccessToken, clampAnthropicTemperature, resolveAnthropicModel, TEMPERATURE_SUPPORTED };
