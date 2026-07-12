import { describe, expect, it } from 'vitest';
import { CACHE_TTL_MS, computeCacheKey, isExpired } from '../src/core/apiCache';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { ProviderSettings } from '../src/types';

const settings: ProviderSettings = { provider: 'anthropic', model: 'claude-sonnet-4-5', temperature: 0.8, batchSize: 6 };

describe('computeCacheKey', () => {
  it('is deterministic for the same request', () => {
    const opts = makeOptions({ songCount: 12 });
    const a = computeCacheKey(opts, testGenres, testMoods, testSeason, settings);
    const b = computeCacheKey(opts, testGenres, testMoods, testSeason, settings);
    expect(a).toBe(b);
  });

  it('is insensitive to genre/mood selection order — the same set should cache-hit', () => {
    const opts = makeOptions({ songCount: 12, genreIds: [...testGenres.map(g => g.id)] });
    const forward = computeCacheKey(opts, testGenres, testMoods, testSeason, settings);
    const reversed = computeCacheKey(opts, [...testGenres].reverse(), [...testMoods].reverse(), testSeason, settings);
    expect(forward).toBe(reversed);
  });

  it('changes when song count changes', () => {
    const a = computeCacheKey(makeOptions({ songCount: 12 }), testGenres, testMoods, testSeason, settings);
    const b = computeCacheKey(makeOptions({ songCount: 13 }), testGenres, testMoods, testSeason, settings);
    expect(a).not.toBe(b);
  });

  it('changes when the provider or model changes', () => {
    const opts = makeOptions({ songCount: 12 });
    const anthropicKey = computeCacheKey(opts, testGenres, testMoods, testSeason, settings);
    const openaiKey = computeCacheKey(opts, testGenres, testMoods, testSeason, { ...settings, provider: 'openai', model: 'gpt-4.1-mini' });
    expect(anthropicKey).not.toBe(openaiKey);
  });

  it('changes when temperature changes — a legitimate reason to want a fresh call, not a cache hit', () => {
    const opts = makeOptions({ songCount: 12 });
    const a = computeCacheKey(opts, testGenres, testMoods, testSeason, { ...settings, temperature: 0.6 });
    const b = computeCacheKey(opts, testGenres, testMoods, testSeason, { ...settings, temperature: 1.0 });
    expect(a).not.toBe(b);
  });
});

describe('isExpired', () => {
  it('is not expired immediately after caching', () => {
    const cachedAt = new Date().toISOString();
    expect(isExpired(cachedAt)).toBe(false);
  });

  it('is not expired just under the 7-day TTL', () => {
    const cachedAt = new Date(Date.now() - (CACHE_TTL_MS - 60_000)).toISOString();
    expect(isExpired(cachedAt)).toBe(false);
  });

  it('is expired just past the 7-day TTL', () => {
    const cachedAt = new Date(Date.now() - (CACHE_TTL_MS + 60_000)).toISOString();
    expect(isExpired(cachedAt)).toBe(true);
  });
});
