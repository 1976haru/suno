/**
 * TASK F1 (v3.6) — the one place a model id is allowed to be decided. Every
 * other file (SettingsModal, apiAdvisor, providers/anthropic.ts,
 * providers/batchAnthropic.ts, agents/evaluator.ts, Step3Generate) reads its
 * default from here instead of hardcoding a literal — Anthropic ships new
 * models faster than this app gets updated, so the previous approach
 * (`'claude-sonnet-4-5'` copy-pasted into 6+ files) was already stale by the
 * time this task was written. Update `lastChecked` whenever this list changes.
 */
export interface ModelRegistryEntry {
  id: string;
  label: string;
  tier: 'fast' | 'balanced' | 'max';
  /**
   * TASK v3.20 — the model's real output token ceiling, for documentation/
   * future UI use (e.g. a capacity warning). api/generate.js and
   * api/batch.js keep their own duplicate of this map (same "independent
   * serverless function" reasoning as batch.js's header comment) since
   * they can't import from src/ — update both when this changes.
   */
  maxOutputTokens?: number;
}

export const MODEL_REGISTRY: { lastChecked: string; anthropic: ModelRegistryEntry[]; openai: ModelRegistryEntry[]; note: string } = {
  lastChecked: '2026-07-14',
  anthropic: [
    { id: 'claude-sonnet-5', label: 'Sonnet 5 (권장)', tier: 'balanced', maxOutputTokens: 128_000 },
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (저렴)', tier: 'fast', maxOutputTokens: 64_000 },
    { id: 'claude-opus-4-8', label: 'Opus 4.8 (최고품질)', tier: 'max', maxOutputTokens: 128_000 }
  ],
  openai: [
    { id: 'gpt-4.1', label: 'GPT-4.1', tier: 'max' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini (권장)', tier: 'balanced' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini (저렴)', tier: 'fast' }
  ],
  note: '모델은 계속 추가·변경됩니다. 목록에 없으면 직접 입력하세요.'
};

export const DEFAULT_ANTHROPIC_MODEL = MODEL_REGISTRY.anthropic.find(m => m.tier === 'balanced')?.id ?? MODEL_REGISTRY.anthropic[0].id;
export const DEFAULT_OPENAI_MODEL = MODEL_REGISTRY.openai.find(m => m.tier === 'balanced')?.id ?? MODEL_REGISTRY.openai[0].id;

export function defaultModelFor(provider: 'anthropic' | 'openai'): string {
  return provider === 'anthropic' ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_OPENAI_MODEL;
}
