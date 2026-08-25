import { describe, expect, it } from 'vitest';
import { estimateApiCalls, estimateCost, estimateTokenUsage } from '../src/core/costEstimator';
import type { ProviderSettings } from '../src/types';

describe('estimateApiCalls', () => {
  it('chunks songs by batch size', () => {
    expect(estimateApiCalls(30, 6)).toBe(5);
    expect(estimateApiCalls(1, 6)).toBe(1);
    expect(estimateApiCalls(7, 6)).toBe(2);
  });

  it('clamps batch size to the same [1, 12] range the real generator uses', () => {
    expect(estimateApiCalls(24, 0)).toBe(estimateApiCalls(24, 6)); // falsy batchSize falls back to 6
    expect(estimateApiCalls(24, 999)).toBe(2); // clamped to 12
  });
});

describe('estimateTokenUsage', () => {
  it('returns a low <= high range for both input and output tokens', () => {
    const usage = estimateTokenUsage(30, 6);
    expect(usage.inputTokens.low).toBeLessThanOrEqual(usage.inputTokens.high);
    expect(usage.outputTokens.low).toBeLessThanOrEqual(usage.outputTokens.high);
    expect(usage.apiCalls).toBe(5);
  });

  it('scales output tokens roughly linearly with song count', () => {
    const small = estimateTokenUsage(5, 6);
    const large = estimateTokenUsage(30, 6);
    expect(large.outputTokens.low).toBeGreaterThan(small.outputTokens.low * 4);
  });

  it('never returns zero calls even for a degenerate song count', () => {
    expect(estimateApiCalls(0, 6)).toBeGreaterThanOrEqual(1);
  });
});

describe('estimateCost', () => {
  const remoteProvider: Pick<ProviderSettings, 'provider' | 'batchSize'> = { provider: 'anthropic', batchSize: 6 };

  it('is always free for the local provider, regardless of pricing input', () => {
    const estimate = estimateCost(30, { provider: 'local', batchSize: 6 }, 5000, 20000);
    expect(estimate.apiCalls).toBe(0);
    expect(estimate.costKrw).toEqual({ low: 0, high: 0 });
  });

  it('returns null cost when the user has not entered pricing — never a fabricated number', () => {
    const estimate = estimateCost(12, remoteProvider, null, null);
    expect(estimate.costKrw).toBeNull();
    expect(estimate.apiCalls).toBeGreaterThan(0);
  });

  it('computes a cost range from user-supplied pricing, never a single fabricated point value', () => {
    const estimate = estimateCost(12, remoteProvider, 4500, 22000);
    expect(estimate.costKrw).not.toBeNull();
    expect(estimate.costKrw!.low).toBeGreaterThan(0);
    expect(estimate.costKrw!.low).toBeLessThanOrEqual(estimate.costKrw!.high);
  });

  it('scales cost with the entered price per token', () => {
    const cheap = estimateCost(12, remoteProvider, 1000, 1000);
    const expensive = estimateCost(12, remoteProvider, 10000, 10000);
    expect(expensive.costKrw!.low).toBeGreaterThan(cheap.costKrw!.low);
  });
});
