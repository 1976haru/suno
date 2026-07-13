import { describe, expect, it } from 'vitest';
import { DEFAULT_ANTHROPIC_MODEL, DEFAULT_OPENAI_MODEL, defaultModelFor, MODEL_REGISTRY } from '../src/data/modelRegistry';

describe('[F1] MODEL_REGISTRY is the single source of truth for model ids', () => {
  it('every registry entry has a non-empty id/label and a valid tier', () => {
    for (const entry of [...MODEL_REGISTRY.anthropic, ...MODEL_REGISTRY.openai]) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(['fast', 'balanced', 'max']).toContain(entry.tier);
    }
  });

  it('exactly one anthropic entry and one openai entry is tier "balanced" (the default)', () => {
    expect(MODEL_REGISTRY.anthropic.filter(m => m.tier === 'balanced')).toHaveLength(1);
    expect(MODEL_REGISTRY.openai.filter(m => m.tier === 'balanced')).toHaveLength(1);
  });

  it('defaultModelFor returns the balanced-tier id for each provider', () => {
    expect(defaultModelFor('anthropic')).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(defaultModelFor('openai')).toBe(DEFAULT_OPENAI_MODEL);
    expect(DEFAULT_ANTHROPIC_MODEL).toBe(MODEL_REGISTRY.anthropic.find(m => m.tier === 'balanced')!.id);
  });

  it('no entry id is a stale/retired model string left over from before this registry existed', () => {
    const staleIds = ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'];
    for (const entry of MODEL_REGISTRY.anthropic) {
      expect(staleIds).not.toContain(entry.id);
    }
  });
});
