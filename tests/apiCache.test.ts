import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CACHE_TTL_MS, computeCacheKey, isExpired } from '../src/core/apiCache';
import { validateProviderTrackSet } from '../src/core/importValidation';
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

/**
 * codex 지시문 01 (TASK A) — real gap this closes: App.tsx's own
 * onUseCachedResult restored a cached blueprint verbatim with zero
 * structural re-validation, unlike every other real entry point (realtime/
 * batch/OpenAI/bridge import/multi-set all run validateProviderTrackSet —
 * see that function's own doc comment). Defense-in-depth, not a live bug
 * today (a cache entry was already validated once when it was first
 * written), against an edited/corrupted IndexedDB record or a schema drift
 * between app versions.
 */
describe('[codex 지시문 01 TASK A] validateProviderTrackSet catches a corrupted cached blueprint', () => {
  it('flags duplicate trackNo in a restored blueprint\'s own songs', () => {
    const songs = [{ trackNo: 1 }, { trackNo: 1 }, { trackNo: 3 }];
    expect(validateProviderTrackSet(songs, songs.length).valid).toBe(false);
  });

  it('a real, well-formed cached blueprint passes cleanly', () => {
    const songs = Array.from({ length: 6 }, (_, i) => ({ trackNo: i + 1 }));
    expect(validateProviderTrackSet(songs, songs.length).valid).toBe(true);
  });
});

// App.tsx itself can't be unit-tested directly (no jsdom/React-rendering
// test infra — see tests/bridgeImportSrtOnly.test.ts's own identical
// "App.tsx source-level regression guard" precedent, same reasoning here).
describe('[codex 지시문 01 TASK A] App.tsx source-level regression guard', () => {
  const appSource = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf8');

  function extractFunctionBody(source: string, name: string): string {
    const signatureIndex = source.indexOf(`function ${name}(`);
    expect(signatureIndex, `function ${name} not found in App.tsx`).toBeGreaterThan(-1);
    const braceStart = source.indexOf('{', signatureIndex);
    let depth = 0;
    for (let i = braceStart; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) return source.slice(braceStart, i + 1);
      }
    }
    throw new Error(`Unbalanced braces while extracting ${name}`);
  }

  it('onUseCachedResult re-validates the restored blueprint\'s trackNo structure before displaying it', () => {
    const body = extractFunctionBody(appSource, 'onUseCachedResult');
    expect(body).toContain('validateProviderTrackSet');
    // An invalid cache entry falls back to the exact same runGeneration(...) path a MISSING one already used.
    expect(body).toContain('runGeneration(cachePrompt.key)');
  });
});
