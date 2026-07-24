/**
 * TASK v3.37 — Gemini image-generation proxy, ported from the sibling
 * creator-studio app's routes/thumbnail.js (Express) into this project's
 * Vercel serverless-function shape. Deliberately duplicates api/generate.js's
 * CORS/rate-limit/access-token/error-detail helpers instead of importing them
 * (same reasoning as api/batch.js: each serverless function stays a fully
 * independent unit, safe to deploy/scale on its own).
 *
 * Unlike creator-studio's Express server, a Vercel function has no durable
 * disk between requests — the generated image is returned inline as a base64
 * data URL instead of being written to disk and served by URL.
 */

const RATE_LIMIT_WINDOW_MS = 60_000;
// Image generation is heavier and rarer per user action than a text/lyrics
// call (one click = one image, not dozens of chunk requests), so this stays
// far below api/generate.js's 90/min — still generous for a real session of
// generating several thumbnail/cover variants.
const RATE_LIMIT_MAX_REQUESTS = 20;
const MAX_BODY_BYTES = 200_000;
// Image generation commonly runs slower than a short text completion; capped
// well under Vercel's typical function ceiling.
const REQUEST_TIMEOUT_MS = 90_000;

const rateLimitBuckets = new Map();

const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
const DEFAULT_IMAGE_SIZE = '2K';

// TASK v3.37 (spec item A/B) — always appended server-side so a user who
// forgets to add photographic quality language still gets a professional
// result, not an AI-plastic one.
const QUALITY_BOOSTER = 'professional photography, photorealistic, cinematic lighting, natural color grading, '
  + 'soft depth of field, crisp detail, no oversaturation, no plastic CGI.';

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

function resolveCorsOrigin(req) {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers?.origin;
  if (!allowed.length) return { origin: origin || '*', blocked: false };
  if (origin && allowed.includes(origin)) return { origin, blocked: false };
  return { origin: allowed[0], blocked: true };
}

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

async function fetchWithTimeout(url, init, timeoutMs, timeoutMessage = '요청이 시간 초과되었습니다. 잠시 후 다시 시도하세요.') {
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

function resolveImageModel(model) {
  return (typeof model === 'string' && model.trim()) || process.env.GEMINI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
}

function resolveAspectRatio(aspectRatio) {
  return aspectRatio === '1:1' ? '1:1' : '16:9';
}

function buildFinalPrompt(prompt) {
  // The composer (src/core/thumbnailPromptComposer.ts) already embeds the
  // Forbidden/negative-prompt clause into every prompt it produces, so this
  // proxy only needs to add the quality booster, not re-derive safety rules.
  return `${String(prompt || '').trim()}\n\n${QUALITY_BOOSTER}`;
}

function extractInlineImage(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = [...parts].reverse().find(part => part.inlineData?.data);
  if (imagePart?.inlineData?.data) return imagePart.inlineData;
  throw new Error('이미지가 생성되지 않았습니다. 프롬프트 또는 API 키 권한을 확인해 주세요.');
}

function isImageSizeRejection(error) {
  const message = String(error?.detail || error?.message || '');
  return /image[_ ]?size|invalid.*size|unsupported.*size/i.test(message);
}

async function requestGeminiImage({ apiKey, model, prompt, aspectRatio, imageSize }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio, imageSize }
      }
    })
  }, REQUEST_TIMEOUT_MS, '이미지 생성이 오래 걸립니다. 잠시 후 다시 시도하세요.');

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Gemini upstream failed: ${response.status}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }
  return response.json();
}

/**
 * Requests the configured/default image size first (2K unless overridden);
 * some accounts/regions don't yet support the larger enum value, so this
 * retries once at 1K rather than failing the whole generation over an
 * image-size mismatch — same reasoning as creator-studio's CS-v1.5 fallback.
 */
async function callGemini({ model, prompt, aspectRatio, imageSize, userApiKey }) {
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the server.');

  const resolvedModel = resolveImageModel(model);
  const resolvedAspectRatio = resolveAspectRatio(aspectRatio);
  const resolvedImageSize = (typeof imageSize === 'string' && imageSize.trim()) || DEFAULT_IMAGE_SIZE;
  const finalPrompt = buildFinalPrompt(prompt);

  let data;
  try {
    data = await requestGeminiImage({ apiKey, model: resolvedModel, prompt: finalPrompt, aspectRatio: resolvedAspectRatio, imageSize: resolvedImageSize });
  } catch (error) {
    if (resolvedImageSize !== '1K' && isImageSizeRejection(error)) {
      data = await requestGeminiImage({ apiKey, model: resolvedModel, prompt: finalPrompt, aspectRatio: resolvedAspectRatio, imageSize: '1K' });
    } else {
      throw error;
    }
  }

  const image = extractInlineImage(data);
  return { dataUrl: `data:${image.mimeType || 'image/png'};base64,${image.data}`, mimeType: image.mimeType || 'image/png' };
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

    if (!String(body.prompt || '').trim()) {
      sendError(res, 400, '이미지 생성 프롬프트가 없습니다.');
      return;
    }

    const result = await callGemini({
      model: body.model,
      prompt: body.prompt,
      aspectRatio: body.aspectRatio,
      imageSize: body.imageSize,
      userApiKey
    });

    res.status(200).json({ ok: true, dataUrl: result.dataUrl, mimeType: result.mimeType });
  } catch (error) {
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    const baseMessage = status === 401
      ? 'API 키가 올바르지 않습니다.'
      : status === 429
        ? '요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.'
        : (error instanceof Error ? error.message : String(error));
    const message = error?.detail ? `${baseMessage} :: ${String(error.detail).slice(0, 500)}` : baseMessage;
    sendError(res, status, message, error?.code);
  }
}

// exported for tests only; never logs key material
export const __internal = {
  maskKey,
  resolveCorsOrigin,
  checkAccessToken,
  resolveImageModel,
  resolveAspectRatio,
  buildFinalPrompt,
  extractInlineImage,
  isImageSizeRejection,
  fetchWithTimeout,
  rateLimitBuckets,
  QUALITY_BOOSTER,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_SIZE
};
