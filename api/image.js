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
// TASK v3.45 (Part 2) — raised from 200_000 (text-only prompts never
// approached that): image-editing requests now carry 1-3 base64 reference
// images. Kept just under Vercel's ~4.5MB serverless function body ceiling,
// so an oversized request fails here with our own message rather than an
// opaque platform-level 413. The more specific, image-focused size/count
// checks (MAX_INPUT_IMAGES / MAX_INPUT_IMAGES_BYTES below) run after parsing.
const MAX_BODY_BYTES = 4_500_000;
// Image generation commonly runs slower than a short text completion; capped
// well under Vercel's typical function ceiling.
const REQUEST_TIMEOUT_MS = 90_000;

const rateLimitBuckets = new Map();

const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';
const DEFAULT_IMAGE_SIZE = '2K';

const QWEN_DEFAULT_MODEL = 'qwen-image-2.0';
const QWEN_DEFAULT_SIZE = '2688*1536';
// TASK v3.45 — qwen-image-3.0-pro does not exist in Alibaba's model catalog
// (verified against the official Qwen-Image API reference docs, 2026-07);
// qwen-image-max is confirmed real and sync-only, same tier as 2.0/2.0-pro.
const QWEN_SYNC_MODELS = new Set(['qwen-image-2.0', 'qwen-image-2.0-pro', 'qwen-image-max']);
const QWEN_ASYNC_MODELS = new Set(['qwen-image-plus', 'qwen-image']);
const QWEN_V2_SIZES = new Set(['2688*1536', '2048*2048', '1536*2688', '2368*1728', '1728*2368']);
const QWEN_LEGACY_SIZES = new Set(['1664*928', '1328*1328', '928*1664']);
const QWEN_POLL_INTERVAL_MS = 3_000;
// TASK v3.45 (Part 2) — image editing (reference images in the request) only
// works on the synchronous multimodal-generation endpoint and materially
// increases request body size (base64 images vs. text-only prompts before
// this task), unlike the plain-text 200KB cap above. Kept well under
// Vercel's ~4.5MB serverless function body ceiling.
const MAX_INPUT_IMAGES = 3;
const MAX_INPUT_IMAGES_BYTES = 4_000_000;

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

function sanitizeErrorMessage(message, keys = []) {
  let text = String(message || '');
  for (const key of keys.filter(Boolean)) {
    text = text.split(String(key)).join(maskKey(String(key)));
  }
  return text.replace(/sk-[A-Za-z0-9_-]{8,}/g, value => maskKey(value));
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function resolveImageProvider(provider) {
  return provider === 'qwen' ? 'qwen' : 'gemini';
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

function resolveQwenModel(model) {
  const requested = typeof model === 'string' ? model.trim() : '';
  return QWEN_SYNC_MODELS.has(requested) || QWEN_ASYNC_MODELS.has(requested) ? requested : QWEN_DEFAULT_MODEL;
}

function resolveQwenRegion(region) {
  return region === 'beijing' ? 'beijing' : 'singapore';
}

function resolveQwenSize(size, model) {
  const requested = typeof size === 'string' ? size.trim() : '';
  if (QWEN_SYNC_MODELS.has(model)) {
    return QWEN_V2_SIZES.has(requested) ? requested : QWEN_DEFAULT_SIZE;
  }
  return QWEN_LEGACY_SIZES.has(requested) ? requested : '1664*928';
}

function clampQwenImageCount(n) {
  const count = Number(n);
  if (!Number.isFinite(count)) return 1;
  return Math.max(1, Math.min(6, Math.floor(count)));
}

function buildQwenBaseUrl(region, workspaceId) {
  const resolvedRegion = resolveQwenRegion(region);
  const workspace = typeof workspaceId === 'string' ? workspaceId.trim() : '';
  if (workspace) {
    const zone = resolvedRegion === 'beijing' ? 'cn-beijing' : 'ap-southeast-1';
    return `https://${encodeURIComponent(workspace)}.${zone}.maas.aliyuncs.com/api/v1`;
  }
  return resolvedRegion === 'beijing'
    ? 'https://dashscope.aliyuncs.com/api/v1'
    : 'https://dashscope-intl.aliyuncs.com/api/v1';
}

function buildQwenEndpoint({ region, workspaceId, mode, taskId }) {
  const base = buildQwenBaseUrl(region, workspaceId);
  if (mode === 'task') return `${base}/tasks/${encodeURIComponent(taskId)}`;
  if (mode === 'async') return `${base}/services/aigc/text2image/image-synthesis`;
  return `${base}/services/aigc/multimodal-generation/generation`;
}

function buildQwenRequestBody({ model, prompt, negativePrompt, size, n, asyncMode, inputImages }) {
  const parameters = {
    negative_prompt: String(negativePrompt || ' ').slice(0, 500),
    prompt_extend: false,
    watermark: false,
    size,
    n
  };

  if (asyncMode) {
    return {
      model,
      input: { prompt },
      parameters
    };
  }

  // TASK v3.45 (Part 2) — img2img editing: 1-3 reference images go in the
  // same "content" array the plain sync request already used for just
  // { text: prompt }, per the official multimodal-generation request shape.
  // Image entries first, text instruction last (documented order).
  const content = [
    ...(inputImages || []).map(image => ({ image })),
    { text: prompt }
  ];

  return {
    model,
    input: {
      messages: [
        {
          role: 'user',
          content
        }
      ]
    },
    parameters
  };
}

/** TASK v3.45 (Part 1) — DashScope error bodies are JSON ({code, message, request_id}) even on non-2xx responses; parsing them lets callers surface the real cause instead of a raw truncated JSON blob. */
function parseQwenErrorBody(text) {
  try {
    const data = JSON.parse(text);
    return { code: data?.code, message: data?.message, requestId: data?.request_id };
  } catch {
    return {};
  }
}

function formatQwenErrorDetail({ code, message, requestId }, fallback) {
  if (!message) return fallback;
  return `${code ? `${code}: ` : ''}${message}${requestId ? ` (request_id: ${requestId})` : ''}`;
}

/** TASK v3.45 (Part 1) — status-based auth failures plus DashScope's own auth-related error codes; used to attach the region-mismatch hint (Beijing/Singapore keys are not interchangeable) rather than leaving a bare "API key invalid" message. */
function isQwenAuthError(error) {
  const status = error?.status;
  const code = String(error?.code || '').toLowerCase();
  return status === 401 || status === 403 || /invalidapikey|unauthorized|accessdenied|forbidden/i.test(code);
}

function extractQwenImageUrls(data) {
  const syncUrls = (data?.output?.choices || [])
    .flatMap(choice => choice?.message?.content || [])
    .map(part => part?.image)
    .filter(url => typeof url === 'string' && url);
  const asyncUrls = (data?.output?.results || [])
    .map(result => result?.url || result?.image)
    .filter(url => typeof url === 'string' && url);
  return [...syncUrls, ...asyncUrls];
}

function qwenUsageImageCount(data, fallback) {
  const count = Number(data?.usage?.image_count || data?.output?.usage?.image_count);
  return Number.isFinite(count) && count > 0 ? count : fallback;
}

async function imageUrlToDataUrl(url) {
  const response = await fetchWithTimeout(url, { method: 'GET' }, 30_000, 'Generated image download timed out.');
  if (!response.ok) throw new Error(`Generated image download failed: ${response.status}`);
  const mimeType = response.headers?.get?.('content-type') || 'image/png';
  const buffer = Buffer.from(await response.arrayBuffer());
  return { dataUrl: `data:${mimeType};base64,${buffer.toString('base64')}`, mimeType };
}

async function tryDownloadQwenImages(imageUrls) {
  const dataUrls = [];
  let mimeType = 'image/png';
  for (const url of imageUrls) {
    try {
      const downloaded = await imageUrlToDataUrl(url);
      dataUrls.push(downloaded.dataUrl);
      mimeType = downloaded.mimeType || mimeType;
    } catch {
      // Keep temporary upstream URLs available even when the object host blocks
      // server-side download; the browser can still use the returned URL.
    }
  }
  return { dataUrls, mimeType };
}

async function requestQwenImage({ apiKey, url, body, asyncMode }) {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...(asyncMode ? { 'X-DashScope-Async': 'enable' } : {})
    },
    body: JSON.stringify(body)
  }, REQUEST_TIMEOUT_MS, 'Qwen image generation timed out. Please try again.');

  if (!response.ok) {
    const rawText = await response.text();
    const parsed = parseQwenErrorBody(rawText);
    const error = new Error(`Qwen upstream failed: ${response.status}`);
    error.status = response.status;
    error.code = parsed.code;
    error.detail = formatQwenErrorDetail(parsed, rawText);
    throw error;
  }
  const data = await response.json();
  if (data?.code && data?.message) {
    const error = new Error(`Qwen upstream failed: ${data.code}`);
    error.status = 400;
    error.detail = formatQwenErrorDetail({ code: data.code, message: data.message, requestId: data.request_id }, data.message);
    error.code = data.code;
    throw error;
  }
  return data;
}

async function pollQwenTask({ apiKey, region, workspaceId, taskId, timeoutMs = REQUEST_TIMEOUT_MS, intervalMs = QWEN_POLL_INTERVAL_MS }) {
  const deadline = Date.now() + timeoutMs;
  let lastData = null;
  while (Date.now() < deadline) {
    const response = await fetchWithTimeout(buildQwenEndpoint({ region, workspaceId, mode: 'task', taskId }), {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    }, 30_000, 'Qwen task polling timed out.');

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    lastData = data;
    if (!response.ok || data?.code) {
      const error = new Error(`Qwen task polling failed: ${response.status}`);
      error.status = response.status || 400;
      error.code = data?.code;
      error.detail = formatQwenErrorDetail({ code: data?.code, message: data?.message, requestId: data?.request_id }, text);
      throw error;
    }

    const status = data?.output?.task_status;
    if (status === 'SUCCEEDED') return data;
    if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
      const error = new Error(`Qwen task ${status.toLowerCase()}.`);
      error.status = 400;
      error.code = data?.output?.code || data?.code;
      error.detail = formatQwenErrorDetail(
        { code: error.code, message: data?.output?.message || data?.message, requestId: data?.request_id },
        JSON.stringify(data?.output || {})
      );
      throw error;
    }
    await sleep(intervalMs);
  }
  const error = new Error('Qwen image task did not finish before the timeout.');
  error.status = 504;
  error.detail = lastData ? JSON.stringify(lastData).slice(0, 500) : '';
  throw error;
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

async function callQwen({ model, prompt, negativePrompt, size, n, region, workspaceId, userApiKey, inputImages }) {
  const apiKey = userApiKey || process.env.DASHSCOPE_API_KEY;
  if (!apiKey) throw new Error('DASHSCOPE_API_KEY is not configured on the server.');

  const hasInputImages = Array.isArray(inputImages) && inputImages.length > 0;
  let resolvedModel = resolveQwenModel(model);
  // TASK v3.45 (Part 2) — editing (reference images present) does not
  // support the async task endpoint at all; if the caller's configured
  // model is one of the async-only ones, fall back to the sync default
  // instead of failing, and report the substitution so the UI can tell the
  // user why a different model produced the result.
  let modelSubstituted = false;
  if (hasInputImages && QWEN_ASYNC_MODELS.has(resolvedModel)) {
    resolvedModel = QWEN_DEFAULT_MODEL;
    modelSubstituted = true;
  }
  const resolvedRegion = resolveQwenRegion(region);
  const resolvedSize = resolveQwenSize(size, resolvedModel);
  const resolvedCount = clampQwenImageCount(n);
  const asyncMode = !hasInputImages && QWEN_ASYNC_MODELS.has(resolvedModel);
  const body = buildQwenRequestBody({
    model: resolvedModel,
    prompt: String(prompt || '').trim(),
    negativePrompt,
    size: resolvedSize,
    n: resolvedCount,
    asyncMode,
    inputImages: hasInputImages ? inputImages : undefined
  });

  let data;
  let taskId;
  try {
    if (asyncMode) {
      const created = await requestQwenImage({
        apiKey,
        url: buildQwenEndpoint({ region: resolvedRegion, workspaceId, mode: 'async' }),
        body,
        asyncMode: true
      });
      taskId = created?.output?.task_id;
      if (!taskId) throw new Error('Qwen async task response did not include task_id.');
      data = await pollQwenTask({ apiKey, region: resolvedRegion, workspaceId, taskId });
    } else {
      data = await requestQwenImage({
        apiKey,
        url: buildQwenEndpoint({ region: resolvedRegion, workspaceId, mode: 'sync' }),
        body,
        asyncMode: false
      });
    }
  } catch (error) {
    // TASK v3.45 (Part 1) — the app defaults to region: 'singapore', so a
    // Beijing-console API key used as-is authenticates against the wrong
    // endpoint; DashScope's own docs warn the two regions' keys/endpoints
    // are not interchangeable. An auth failure is otherwise indistinguishable
    // from a genuinely wrong key, so name the likely cause explicitly.
    if (isQwenAuthError(error)) {
      const regionLabel = resolvedRegion === 'beijing' ? '베이징' : '싱가포르';
      const hint = `리전 불일치 가능성: 이 요청은 '${regionLabel}' 리전으로 전송되었습니다. API 키를 발급받은 리전과 일치하는지 확인하세요 — 베이징 키와 싱가포르 키는 서로 호환되지 않습니다.`;
      error.detail = error.detail ? `${error.detail} (${hint})` : hint;
    }
    throw error;
  }

  const imageUrls = extractQwenImageUrls(data);
  if (!imageUrls.length) throw new Error('Qwen image response did not include an image URL.');
  const downloaded = await tryDownloadQwenImages(imageUrls);
  return {
    provider: 'qwen',
    model: resolvedModel,
    modelSubstituted,
    imageUrls,
    dataUrls: downloaded.dataUrls,
    mimeType: downloaded.mimeType,
    imageCount: qwenUsageImageCount(data, imageUrls.length),
    taskId
  };
}

export default async function handler(req, res) {
  const cors = resolveCorsOrigin(req);
  res.setHeader?.('Access-Control-Allow-Origin', cors.origin);
  res.setHeader?.('Vary', 'Origin');
  res.setHeader?.('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type, X-User-Api-Key, X-Qwen-Api-Key, X-Access-Token');

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

  let body = {};
  let userApiKey;

  try {
    body = parseBody(req);
    const provider = resolveImageProvider(body.provider);
    userApiKey = provider === 'qwen'
      ? (req.headers?.['x-qwen-api-key'] || req.headers?.['x-user-api-key'] || undefined)
      : (req.headers?.['x-user-api-key'] || undefined);

    if (!userApiKey && !checkAccessToken(req)) {
      sendError(res, 401, '서버 API 키를 사용하려면 접근 토큰(X-Access-Token)이 필요합니다.');
      return;
    }

    if (!String(body.prompt || '').trim()) {
      sendError(res, 400, '이미지 생성 프롬프트가 없습니다.');
      return;
    }

    if (provider === 'qwen') {
      const inputImages = Array.isArray(body.inputImages)
        ? body.inputImages.filter(image => typeof image === 'string' && image)
        : undefined;

      if (inputImages?.length) {
        if (inputImages.length > MAX_INPUT_IMAGES) {
          sendError(res, 400, `참고 이미지는 최대 ${MAX_INPUT_IMAGES}장까지 지원됩니다.`);
          return;
        }
        const totalBytes = inputImages.reduce((sum, image) => sum + image.length, 0);
        if (totalBytes > MAX_INPUT_IMAGES_BYTES) {
          sendError(res, 413, '참고 이미지 용량이 너무 큽니다. 이미지 크기를 줄여 다시 시도하세요.');
          return;
        }
      }

      const result = await callQwen({
        model: body.model,
        prompt: body.prompt,
        negativePrompt: body.negativePrompt,
        size: body.size,
        n: body.n,
        region: body.region,
        workspaceId: body.workspaceId,
        userApiKey,
        inputImages
      });

      res.status(200).json({ ok: true, ...result });
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
    sendError(res, status, sanitizeErrorMessage(message, [
      userApiKey,
      process.env.GEMINI_API_KEY,
      process.env.DASHSCOPE_API_KEY
    ]), error?.code);
  }
}

// exported for tests only; never logs key material
export const __internal = {
  maskKey,
  sanitizeErrorMessage,
  resolveCorsOrigin,
  checkAccessToken,
  resolveImageProvider,
  resolveImageModel,
  resolveAspectRatio,
  buildFinalPrompt,
  extractInlineImage,
  isImageSizeRejection,
  resolveQwenModel,
  resolveQwenRegion,
  resolveQwenSize,
  clampQwenImageCount,
  buildQwenBaseUrl,
  buildQwenEndpoint,
  buildQwenRequestBody,
  extractQwenImageUrls,
  qwenUsageImageCount,
  pollQwenTask,
  parseQwenErrorBody,
  formatQwenErrorDetail,
  isQwenAuthError,
  fetchWithTimeout,
  rateLimitBuckets,
  QUALITY_BOOSTER,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_SIZE,
  QWEN_DEFAULT_MODEL,
  QWEN_DEFAULT_SIZE,
  MAX_INPUT_IMAGES,
  MAX_INPUT_IMAGES_BYTES
};
