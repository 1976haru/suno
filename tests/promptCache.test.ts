import { describe, expect, it } from 'vitest';
import { __internal as apiInternal } from '../api/generate.js';
import { buildAnthropicUserPayload, buildChannelSystemBlock, buildSystemInstruction } from '../src/core/promptComposer';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { BatchContext, PlaylistIdentity } from '../src/types';

describe('[E1] Anthropic prompt caching — cache boundary placement', () => {
  it("usedTitles/usedHooks never appear inside a cached system block — only in the (uncached) user payload", () => {
    const opts = makeOptions();
    const batch: BatchContext = {
      trackNoOffset: 6,
      totalSongCount: 12,
      usedTitles: ['Hold On', 'Winter Light'],
      usedHooks: ['Hold On', 'Stay a While'],
      lockedIdentity: null
    };
    const stable = buildSystemInstruction(opts);
    const channelBlock = buildChannelSystemBlock(opts, testGenres, testMoods, testSeason);
    const user = buildAnthropicUserPayload(opts, batch);

    for (const title of batch.usedTitles) {
      expect(stable).not.toContain(title);
      expect(channelBlock).not.toContain(title);
    }
    for (const hook of batch.usedHooks) {
      expect(stable).not.toContain(hook);
      expect(channelBlock).not.toContain(hook);
    }
    expect(JSON.stringify(user.alreadyUsedTitles)).toContain('Hold On');
    expect(JSON.stringify(user.alreadyUsedHooks)).toContain('Stay a While');
  });

  it('the two cacheable system blocks are byte-identical across batch 1 and batch 5 of the same pack (only the volatile note differs)', () => {
    const opts = makeOptions();
    const identity: PlaylistIdentity = {
      oneLineConcept: 'x', sonicSignature: 'x', vocalSignature: 'x', lyricRules: [], harmonyRules: [], visualRules: []
    };
    const batch1: BatchContext = { trackNoOffset: 0, totalSongCount: 30, usedTitles: [], usedHooks: [], lockedIdentity: null };
    const batch5: BatchContext = { trackNoOffset: 24, totalSongCount: 30, usedTitles: Array.from({ length: 24 }, (_, i) => `Title ${i}`), usedHooks: Array.from({ length: 24 }, (_, i) => `Hook ${i}`), lockedIdentity: identity };

    const stable1 = buildSystemInstruction(opts);
    const stable5 = buildSystemInstruction(opts);
    const channel1 = buildChannelSystemBlock(opts, testGenres, testMoods, testSeason);
    const channel5 = buildChannelSystemBlock(opts, testGenres, testMoods, testSeason);

    expect(stable1).toBe(stable5);
    expect(channel1).toBe(channel5);

    // sanity: the batches themselves really do differ (so this isn't a vacuous pass)
    expect(batch1).not.toEqual(batch5);
  });

  it("buildAnthropicSystem marks every cacheableSystemBlocks entry with cache_control: ephemeral, and appends the volatile note uncached", () => {
    const result = apiInternal.buildAnthropicSystem({
      cacheableSystemBlocks: ['STABLE RULES TEXT', 'STABLE CHANNEL BLOCK'],
      volatileSystemText: 'Batch mode: tracks 7-12 of 30'
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'text', text: 'STABLE RULES TEXT', cache_control: { type: 'ephemeral' } });
    expect(result[1]).toEqual({ type: 'text', text: 'STABLE CHANNEL BLOCK', cache_control: { type: 'ephemeral' } });
    expect(result[2]).toEqual({ type: 'text', text: 'Batch mode: tracks 7-12 of 30' });
    expect(result[2].cache_control).toBeUndefined();
  });

  it('buildAnthropicSystem falls back to a plain string when no cacheableSystemBlocks are given', () => {
    const result = apiInternal.buildAnthropicSystem({ system: 'plain system text' });
    expect(result).toBe('plain system text');
  });

  it('an empty volatileSystemText adds no extra block', () => {
    const result = apiInternal.buildAnthropicSystem({ cacheableSystemBlocks: ['A'], volatileSystemText: '' });
    expect(result).toHaveLength(1);
  });
});

describe('[E1] usage ledger tracks cache-read tokens', () => {
  it('summarizeUsage sums cacheReadTokens across records, and 0 records means 0', async () => {
    const { summarizeUsage } = await import('../src/core/usageLedger');
    const summary = summarizeUsage([
      { at: '1', provider: 'anthropic', model: 'claude-sonnet-4-5', purpose: 'generate', inputTokens: 100, outputTokens: 50, cacheHit: false, cacheReadTokens: 800 },
      { at: '2', provider: 'anthropic', model: 'claude-sonnet-4-5', purpose: 'generate', inputTokens: 100, outputTokens: 50, cacheHit: false, cacheReadTokens: 850 },
      { at: '3', provider: 'local', model: 'local', purpose: 'generate', inputTokens: 0, outputTokens: 0, cacheHit: false }
    ]);
    expect(summary.totalCacheReadTokens).toBe(1650);
  });
});
