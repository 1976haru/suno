export const QWEN_BYOK_KEY = 'byok:qwen';
export const QWEN_IMAGE_SETTINGS_KEY = 'image:qwen:settings';

export type QwenImageRegion = 'singapore' | 'beijing';

export type QwenImageModel =
  | 'qwen-image-2.0'
  | 'qwen-image-2.0-pro'
  | 'qwen-image-max'
  | 'qwen-image-plus'
  | 'qwen-image';

export type QwenImageResolution =
  | '2688*1536'
  | '2048*2048'
  | '1536*2688'
  | '2368*1728'
  | '1728*2368'
  | '1664*928'
  | '1328*1328'
  | '928*1664';

export interface QwenImageSettings {
  region: QwenImageRegion;
  workspaceId: string;
  model: QwenImageModel;
  resolution: QwenImageResolution;
  sessionLimit: number;
}

export const QWEN_IMAGE_MODELS: { id: QwenImageModel; label: string; async: boolean; priceCny: Record<QwenImageRegion, number> }[] = [
  { id: 'qwen-image-2.0', label: 'Qwen-Image 2.0', async: false, priceCny: { singapore: 0.256873, beijing: 0.2 } },
  { id: 'qwen-image-2.0-pro', label: 'Qwen-Image 2.0 Pro', async: false, priceCny: { singapore: 0.550443, beijing: 0.5 } },
  // TASK v3.45 — qwen-image-3.0-pro (previously first in this list) does not
  // exist in Alibaba's model catalog (verified against the official
  // Qwen-Image API reference docs, 2026-07); its priceCny: 0 was a red flag
  // in hindsight, not a real free tier. qwen-image-max is confirmed real and
  // sync-only, same as 2.0/2.0-pro. Alibaba's own docs don't publish an exact
  // CNY figure for it, only that it's priced in the same tier as 2.0-pro
  // (better realism than plus) — reusing 2.0-pro's price here is a stated
  // approximation, not a fabricated number, pending an exact published
  // figure; revisit if Alibaba publishes one.
  { id: 'qwen-image-max', label: 'Qwen-Image Max (가격 근사치 — 2.0 Pro와 동일 적용)', async: false, priceCny: { singapore: 0.550443, beijing: 0.5 } },
  { id: 'qwen-image-plus', label: 'Qwen-Image Plus', async: true, priceCny: { singapore: 0.220177, beijing: 0.2 } },
  { id: 'qwen-image', label: 'Qwen-Image', async: true, priceCny: { singapore: 0.256873, beijing: 0.25 } }
];

export const QWEN_IMAGE_RESOLUTIONS: { value: QwenImageResolution; label: string; models: 'v2' | 'legacy' }[] = [
  { value: '2688*1536', label: '16:9 - 2688*1536', models: 'v2' },
  { value: '2048*2048', label: '1:1 - 2048*2048', models: 'v2' },
  { value: '1536*2688', label: '9:16 - 1536*2688', models: 'v2' },
  { value: '2368*1728', label: '4:3 - 2368*1728', models: 'v2' },
  { value: '1728*2368', label: '3:4 - 1728*2368', models: 'v2' },
  { value: '1664*928', label: '16:9 - 1664*928 (Plus/Image)', models: 'legacy' },
  { value: '1328*1328', label: '1:1 - 1328*1328 (Plus/Image)', models: 'legacy' },
  { value: '928*1664', label: '9:16 - 928*1664 (Plus/Image)', models: 'legacy' }
];

export const DEFAULT_QWEN_IMAGE_SETTINGS: QwenImageSettings = {
  region: 'singapore',
  workspaceId: '',
  model: 'qwen-image-2.0',
  resolution: '2688*1536',
  sessionLimit: 20
};

export function normalizeQwenImageSettings(value: Partial<QwenImageSettings> | null | undefined): QwenImageSettings {
  const next = { ...DEFAULT_QWEN_IMAGE_SETTINGS, ...(value || {}) };
  const modelOk = QWEN_IMAGE_MODELS.some(model => model.id === next.model);
  const resolutionOk = QWEN_IMAGE_RESOLUTIONS.some(resolution => resolution.value === next.resolution);
  return {
    region: next.region === 'beijing' ? 'beijing' : 'singapore',
    workspaceId: String(next.workspaceId || '').trim(),
    model: modelOk ? next.model : DEFAULT_QWEN_IMAGE_SETTINGS.model,
    resolution: resolutionOk ? next.resolution : DEFAULT_QWEN_IMAGE_SETTINGS.resolution,
    sessionLimit: Math.max(1, Math.min(200, Number(next.sessionLimit) || DEFAULT_QWEN_IMAGE_SETTINGS.sessionLimit))
  };
}

export function qwenImageModelSupportsAsync(model: QwenImageModel): boolean {
  return model === 'qwen-image-plus' || model === 'qwen-image';
}

export function qwenImageModelPriceCny(model: QwenImageModel, region: QwenImageRegion = 'singapore'): number {
  const resolvedRegion = region === 'beijing' ? 'beijing' : 'singapore';
  return QWEN_IMAGE_MODELS.find(item => item.id === model)?.priceCny[resolvedRegion] ?? 0.256873;
}

export function estimateQwenImageCostCny(model: QwenImageModel, imageCount: number, region: QwenImageRegion = 'singapore'): number {
  return qwenImageModelPriceCny(model, region) * Math.max(0, imageCount);
}

export function qwenResolutionFamily(model: QwenImageModel): 'v2' | 'legacy' {
  return model === 'qwen-image-max' || model === 'qwen-image-2.0' || model === 'qwen-image-2.0-pro' ? 'v2' : 'legacy';
}

export function qwenResolutionAllowed(model: QwenImageModel, resolution: QwenImageResolution): boolean {
  const entry = QWEN_IMAGE_RESOLUTIONS.find(item => item.value === resolution);
  return Boolean(entry && entry.models === qwenResolutionFamily(model));
}
