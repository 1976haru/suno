import { callGenerateProxy } from '../providers/proxyFetch';
import { getSetting } from './settingsStore';
import {
  DEFAULT_QWEN_IMAGE_SETTINGS,
  QWEN_BYOK_KEY,
  QWEN_IMAGE_SETTINGS_KEY,
  estimateQwenImageCostCny,
  normalizeQwenImageSettings,
  type QwenImageSettings
} from './qwenImageSettings';

/**
 * TASK v3.37 (spec item A) — client-side wrapper for the /api/image Gemini
 * proxy. Reuses callGenerateProxy (the same retry/error-parsing helper every
 * other provider call in this app already uses) rather than writing a new
 * fetch loop, and the same byok:<provider> IndexedDB convention as
 * SettingsModal's Anthropic/OpenAI keys — see settingsStore.ts.
 */

export const GEMINI_BYOK_KEY = 'byok:gemini';

export async function getGeminiApiKey(): Promise<string | undefined> {
  return getSetting<string>(GEMINI_BYOK_KEY);
}

export async function getQwenApiKey(): Promise<string | undefined> {
  return getSetting<string>(QWEN_BYOK_KEY);
}

export interface GenerateThumbnailImageOptions {
  prompt: string;
  aspectRatio: '16:9' | '1:1';
  imageSize?: string;
}

export interface GeneratedThumbnailImage {
  dataUrl: string;
  mimeType: string;
}

export async function generateThumbnailImage(options: GenerateThumbnailImageOptions): Promise<GeneratedThumbnailImage> {
  const apiKey = await getGeminiApiKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-User-Api-Key'] = apiKey;

  const data = await callGenerateProxy('/api/image', headers, {
    prompt: options.prompt,
    aspectRatio: options.aspectRatio,
    imageSize: options.imageSize
  });

  if (typeof data.dataUrl !== 'string' || typeof data.mimeType !== 'string') {
    throw new Error('이미지 응답 형식이 올바르지 않습니다.');
  }
  return { dataUrl: data.dataUrl, mimeType: data.mimeType };
}

export interface GenerateQwenImageOptions {
  prompt: string;
  negativePrompt?: string;
  settings?: Partial<QwenImageSettings>;
  count?: number;
}

export interface GeneratedQwenImage {
  imageUrls: string[];
  dataUrls: string[];
  mimeType: string;
  model: string;
  imageCount: number;
  estimatedCostCny: number;
  taskId?: string;
}

export async function getQwenImageSettings(): Promise<QwenImageSettings> {
  const stored = await getSetting<Partial<QwenImageSettings>>(QWEN_IMAGE_SETTINGS_KEY);
  return normalizeQwenImageSettings(stored || DEFAULT_QWEN_IMAGE_SETTINGS);
}

export async function generateQwenImage(options: GenerateQwenImageOptions): Promise<GeneratedQwenImage> {
  const apiKey = await getQwenApiKey();
  const settings = normalizeQwenImageSettings(options.settings || await getQwenImageSettings());
  const count = Math.max(1, Math.min(6, Number(options.count) || 1));
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-Qwen-Api-Key'] = apiKey;

  const data = await callGenerateProxy('/api/image', headers, {
    provider: 'qwen',
    prompt: options.prompt,
    negativePrompt: options.negativePrompt,
    model: settings.model,
    region: settings.region,
    workspaceId: settings.workspaceId,
    size: settings.resolution,
    n: count
  }, { retries: 2 });

  const imageUrls = Array.isArray(data.imageUrls) ? data.imageUrls.filter((url): url is string => typeof url === 'string') : [];
  const dataUrls = Array.isArray(data.dataUrls) ? data.dataUrls.filter((url): url is string => typeof url === 'string') : [];
  const imageCount = typeof data.imageCount === 'number' ? data.imageCount : Math.max(imageUrls.length, dataUrls.length);

  if (imageCount < 1 || (imageUrls.length < 1 && dataUrls.length < 1)) {
    throw new Error('Qwen image response did not include an image URL.');
  }

  return {
    imageUrls,
    dataUrls,
    mimeType: typeof data.mimeType === 'string' ? data.mimeType : 'image/png',
    model: typeof data.model === 'string' ? data.model : settings.model,
    imageCount,
    estimatedCostCny: estimateQwenImageCostCny(settings.model, imageCount),
    taskId: typeof data.taskId === 'string' ? data.taskId : undefined
  };
}
