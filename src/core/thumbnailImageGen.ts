import { callGenerateProxy } from '../providers/proxyFetch';
import { getSetting } from './settingsStore';

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
