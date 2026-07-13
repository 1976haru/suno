import { describe, expect, it } from 'vitest';
import { API_PRESETS, DEFAULT_STAGE_MODELS, RECOMMENDATION_BADGE, resolveStageSettings, STAGE_ADVICE } from '../src/core/apiAdvisor';
import type { ProviderSettings } from '../src/types';

describe('[D1] STAGE_ADVICE table', () => {
  it('lyrics and hooks/titles generation is essential', () => {
    expect(STAGE_ADVICE.lyrics.recommendation).toBe('essential');
  });

  it('stylePrompt and songStructure are unnecessary (local is already good enough)', () => {
    expect(STAGE_ADVICE.stylePrompt.recommendation).toBe('unnecessary');
    expect(STAGE_ADVICE.songStructure.recommendation).toBe('unnecessary');
  });

  it('evaluation and thumbnailCopy suggest Haiku, not Sonnet', () => {
    expect(STAGE_ADVICE.evaluation.recommendation).toBe('valuable');
    expect(STAGE_ADVICE.evaluation.suggestedModelKo).toContain('Haiku');
    expect(STAGE_ADVICE.thumbnailCopy.suggestedModelKo).toContain('Haiku');
  });

  it('thumbnailImage never claims this app generates images', () => {
    expect(STAGE_ADVICE.thumbnailImage.recommendation).toBe('unnecessary');
    expect(STAGE_ADVICE.thumbnailImage.reasonKo).toContain('이미지를 직접 만들지 않습니다');
  });

  it('every stage has a badge entry for its recommendation level', () => {
    for (const advice of Object.values(STAGE_ADVICE)) {
      expect(RECOMMENDATION_BADGE[advice.recommendation]).toBeDefined();
    }
  });

  it('no reason text frames API cost as something to avoid', () => {
    for (const advice of Object.values(STAGE_ADVICE)) {
      expect(advice.reasonKo).not.toMatch(/비싸|피해야|부담/);
    }
  });
});

describe('[D3] presets', () => {
  it("'⭐ 추천' preset sets lyrics=sonnet and evaluation=haiku", () => {
    expect(API_PRESETS.recommended.stageModels).toEqual({ lyrics: 'sonnet', evaluation: 'haiku' });
    expect(DEFAULT_STAGE_MODELS).toEqual(API_PRESETS.recommended.stageModels);
  });

  it("'💰 무료로만' preset is all local", () => {
    expect(API_PRESETS.freeOnly.stageModels).toEqual({ lyrics: 'local', evaluation: 'local' });
  });

  it("'🎯 품질 최우선' preset is all sonnet", () => {
    expect(API_PRESETS.qualityFirst.stageModels).toEqual({ lyrics: 'sonnet', evaluation: 'sonnet' });
  });
});

describe('[D3] resolveStageSettings', () => {
  const base: ProviderSettings = { provider: 'local', temperature: 0.8, apiKey: 'sk-ant-test', keyStorageMode: 'local' };

  it("'local' choice forces provider to local regardless of base", () => {
    const resolved = resolveStageSettings('local', { ...base, provider: 'anthropic' });
    expect(resolved.provider).toBe('local');
  });

  it("'sonnet' and 'haiku' choices route to anthropic with the matching model, preserving the api key", () => {
    const sonnet = resolveStageSettings('sonnet', base);
    expect(sonnet.provider).toBe('anthropic');
    expect(sonnet.model).toBe('claude-sonnet-4-5');
    expect(sonnet.apiKey).toBe('sk-ant-test');

    const haiku = resolveStageSettings('haiku', base);
    expect(haiku.provider).toBe('anthropic');
    expect(haiku.model).toBe('claude-haiku-4-5');
  });
});
