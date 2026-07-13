import { describe, expect, it } from 'vitest';
import { batchIndexFromCustomId, stitchBatchResults, type BatchRequestResult } from '../src/core/batchStitcher';
import { buildBatchRequestSpecs } from '../src/providers/batchAnthropic';
import { __internal as batchApiInternal } from '../api/batch.js';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { PlaylistBlueprint, ProviderSettings } from '../src/types';

function makeBlueprint(songs: PlaylistBlueprint['songs']): PlaylistBlueprint {
  return {
    projectTitle: 'Test',
    channelName: 'Test Channel',
    oneLineConcept: 'concept',
    sonicSignature: 'sig',
    vocalSignature: 'vocal',
    lyricRules: [],
    harmonyRules: [],
    visualRules: [],
    songs
  };
}

function makeSong(trackNo: number) {
  return {
    trackNo,
    title: `Song ${trackNo}`,
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: `Hook ${trackNo}`,
    stylePrompt: 'style',
    lyrics: '[chorus]\nHook',
    thumbnailText: 'x',
    youtube: { title: 'x', description: 'x', tags: ['x'], thumbnailText: 'x' },
    qualityScore: 0,
    warnings: []
  };
}

describe('[E2] batchIndexFromCustomId', () => {
  it('parses the numeric index out of a "bN" custom_id', () => {
    expect(batchIndexFromCustomId('b0')).toBe(0);
    expect(batchIndexFromCustomId('b12')).toBe(12);
  });

  it('returns a large sentinel for an unrecognized custom_id shape', () => {
    expect(batchIndexFromCustomId('not-a-batch-id')).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('[E2] stitchBatchResults (pure)', () => {
  const opts = makeOptions();

  it('reassembles a full blueprint from out-of-order results', () => {
    const results: BatchRequestResult[] = [
      { customId: 'b1', blueprint: makeBlueprint([makeSong(7), makeSong(8)]), usage: { inputTokens: 100, outputTokens: 50 }, error: null },
      { customId: 'b0', blueprint: makeBlueprint([makeSong(1), makeSong(2)]), usage: { inputTokens: 200, outputTokens: 80, cacheReadInputTokens: 150 }, error: null }
    ];
    const stitched = stitchBatchResults(opts, results);
    expect(stitched.blueprint?.songs.map(s => s.trackNo)).toEqual([1, 2, 7, 8]);
    expect(stitched.failedBatchIndexes).toEqual([]);
    expect(stitched.totalUsage.inputTokens).toBe(300);
    expect(stitched.totalUsage.outputTokens).toBe(130);
    expect(stitched.totalUsage.cacheReadInputTokens).toBe(150);
  });

  it('records a failed batch index and still returns the rest of the blueprint', () => {
    const results: BatchRequestResult[] = [
      { customId: 'b0', blueprint: makeBlueprint([makeSong(1)]), usage: null, error: null },
      { customId: 'b1', blueprint: null, usage: null, error: '배치 요청 실패' }
    ];
    const stitched = stitchBatchResults(opts, results);
    expect(stitched.blueprint?.songs.map(s => s.trackNo)).toEqual([1]);
    expect(stitched.failedBatchIndexes).toEqual([1]);
  });

  it('returns a null blueprint (not a throw) when every batch failed', () => {
    const results: BatchRequestResult[] = [
      { customId: 'b0', blueprint: null, usage: null, error: 'failed' },
      { customId: 'b1', blueprint: null, usage: null, error: 'failed' }
    ];
    const stitched = stitchBatchResults(opts, results);
    expect(stitched.blueprint).toBeNull();
    expect(stitched.failedBatchIndexes).toEqual([0, 1]);
  });
});

describe('[E2] buildBatchRequestSpecs', () => {
  const settings: ProviderSettings = { provider: 'anthropic', model: 'claude-sonnet-4-5', temperature: 0.8 };

  it('produces one request per sub-batch with sequential b0/b1/... custom_ids', () => {
    const opts = makeOptions({ songCount: 18 });
    const specs = buildBatchRequestSpecs(opts, testGenres, testMoods, testSeason, settings, undefined, 6);
    expect(specs.map(s => s.customId)).toEqual(['b0', 'b1', 'b2']);
    expect(specs.reduce((sum, s) => sum + s.batchSongCount, 0)).toBe(18);
  });

  it('[E1 boundary check] every request shares byte-identical cacheableSystemBlocks (the same stable prefix across the whole job)', () => {
    const opts = makeOptions({ songCount: 18 });
    const specs = buildBatchRequestSpecs(opts, testGenres, testMoods, testSeason, settings, undefined, 6);
    expect(specs[1].cacheableSystemBlocks).toEqual(specs[0].cacheableSystemBlocks);
    expect(specs[2].cacheableSystemBlocks).toEqual(specs[0].cacheableSystemBlocks);
  });

  it('cross-pack avoid history is threaded into every request (not just the first)', () => {
    const opts = makeOptions({ songCount: 12 });
    const specs = buildBatchRequestSpecs(opts, testGenres, testMoods, testSeason, settings, { usedTitles: ['Old Title'], usedHooks: ['Old Hook'] }, 6);
    for (const spec of specs) {
      expect(JSON.stringify(spec.user)).toContain('Old Title');
      expect(JSON.stringify(spec.user)).toContain('Old Hook');
    }
  });

  it('volatileSystemText carries the correct track offset per batch (not cached, so it must vary)', () => {
    const opts = makeOptions({ songCount: 12 });
    const specs = buildBatchRequestSpecs(opts, testGenres, testMoods, testSeason, settings, undefined, 6);
    expect(specs[0].volatileSystemText).toContain('tracks 1 to 6');
    expect(specs[1].volatileSystemText).toContain('tracks 7 to 12');
  });
});

describe('[E2] api/batch.js internals', () => {
  it('buildAnthropicSystem matches the same cache_control shape as api/generate.js', () => {
    const result = batchApiInternal.buildAnthropicSystem({
      cacheableSystemBlocks: ['stable rules', 'channel block'],
      volatileSystemText: 'batch note'
    });
    expect(result).toEqual([
      { type: 'text', text: 'stable rules', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'channel block', cache_control: { type: 'ephemeral' } },
      { type: 'text', text: 'batch note' }
    ]);
  });

  it('parseJsonl parses one JSON object per non-empty line', () => {
    const jsonl = '{"a":1}\n{"b":2}\n\n{"c":3}';
    expect(batchApiInternal.parseJsonl(jsonl)).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  it('safeParseBlueprint returns null (not a throw) on unrecoverable garbage — batch mode has no client to surface a thrown error to', () => {
    expect(batchApiInternal.safeParseBlueprint('not json at all')).toBeNull();
  });
});
