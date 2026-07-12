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
  return safeParseBlueprint(data.choices?.[0]?.message?.content || '{}');
}

async function callAnthropic({ model, temperature, system, user, batchSize, userApiKey }) {
  const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on the server.');

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-5',
      max_tokens: computeMaxTokens(batchSize),
      temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 0.8,
      system,
      messages: [
        {
          role: 'user',
          content: `Return JSON only.\n${JSON.stringify(user, null, 2)}`
        }
      ]
    })
  }, REQUEST_TIMEOUT_MS);

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Anthropic upstream failed: ${response.status}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const data = await response.json();
  const text = data.content?.map(part => part.text || '').join('\n') || '{}';
  return safeParseBlueprint(text);
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
    body: JSON.stringify({ model: model || 'claude-sonnet-4-5', max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK.' }] })
  }, REQUEST_TIMEOUT_MS);
  if (!response.ok) {
    const error = new Error('Anthropic connection test failed.');
    error.status = response.status;
    throw error;
  }
}

export default async function handler(req, res) {
  const origin = req.headers?.origin || '*';
  res.setHeader?.('Access-Control-Allow-Origin', origin);
  res.setHeader?.('Vary', 'Origin');
  res.setHeader?.('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type, X-User-Api-Key');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed.');
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

    if (!body.system || !body.user) {
      sendError(res, 400, 'Missing system or user payload.');
      return;
    }

    const blueprint = provider === 'openai'
      ? await callOpenAI({ ...body, userApiKey })
      : provider === 'anthropic'
        ? await callAnthropic({ ...body, userApiKey })
        : null;

    if (!blueprint) {
      sendError(res, 400, 'Unsupported provider.');
      return;
    }

    res.status(200).json({ blueprint });
  } catch (error) {
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    const message = status === 401
      ? 'API 키가 올바르지 않습니다.'
      : status === 429
        ? '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.'
        : (error instanceof Error ? error.message : String(error));
    sendError(res, status, message);
  }
}

// exported for tests only; never logs key material
export const __internal = { maskKey, computeMaxTokens, safeParseBlueprint };
