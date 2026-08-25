import { describe, expect, it, vi } from 'vitest';
import { evaluatePack } from '../src/agents/evaluator';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { ProviderSettings } from '../src/types';

function songEvalResponse(trackNos: number[]) {
  return new Response(
    JSON.stringify({
      songs: trackNos.map(trackNo => ({
        trackNo,
        scores: { hookStrength: 8, lyricOriginality: 8, promptFitness: 8, audienceFit: 8, seasonFit: 8, safety: 10 },
        total: 80,
        verdict: 'pass',
        issues: [],
        suggestions: []
      }))
    }),
    { status: 200 }
  );
}

function packEvalResponse() {
  return new Response(
    JSON.stringify({ coherenceScore: 80, sequencingScore: 80, duplicateWarnings: [], summary: 'ok' }),
    { status: 200 }
  );
}

function stubEvaluatorFetch(capturedBodies: any[]) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    capturedBodies.push(body);
    if (body.user.songs) return songEvalResponse(body.user.songs.map((s: any) => s.trackNo));
    return packEvalResponse();
  });
}

const settings: ProviderSettings = { provider: 'anthropic', temperature: 0.5, proxyEndpoint: '/api/generate' };

describe('evaluatePack prompt slimming', () => {
  it('never sends full lyrics to the per-song evaluator, only hook + first four lines + style prompt', async () => {
    const opts = makeOptions({ songCount: 3 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);

    const capturedBodies: any[] = [];
    vi.stubGlobal('fetch', stubEvaluatorFetch(capturedBodies));

    await evaluatePack(blueprint, opts, settings);

    const songEvalCall = capturedBodies.find(body => body.user.songs);
    expect(songEvalCall).toBeDefined();
    expect(songEvalCall.user.songs.length).toBe(3);
    for (const song of songEvalCall.user.songs) {
      expect(song.lyrics).toBeUndefined();
      expect(Array.isArray(song.firstFourLines)).toBe(true);
      expect(song.firstFourLines.length).toBeLessThanOrEqual(4);
      expect(typeof song.hookPhrase).toBe('string');
      expect(typeof song.stylePrompt).toBe('string');
    }

    vi.unstubAllGlobals();
  });
});

describe('evaluatePack scope selector', () => {
  it('limits the per-song evaluation call to only the requested trackNos', async () => {
    const opts = makeOptions({ songCount: 6 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);

    const capturedBodies: any[] = [];
    vi.stubGlobal('fetch', stubEvaluatorFetch(capturedBodies));

    const result = await evaluatePack(blueprint, opts, settings, undefined, [2, 4]);

    const songEvalCall = capturedBodies.find(body => body.user.songs);
    expect(songEvalCall.user.songs.map((s: any) => s.trackNo).sort((a: number, b: number) => a - b)).toEqual([2, 4]);
    expect(result.songs.map(s => s.trackNo).sort((a, b) => a - b)).toEqual([2, 4]);

    vi.unstubAllGlobals();
  });

  it('evaluates every song when no scope is given', async () => {
    const opts = makeOptions({ songCount: 4 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);

    vi.stubGlobal('fetch', stubEvaluatorFetch([]));

    const result = await evaluatePack(blueprint, opts, settings);
    expect(result.songs.length).toBe(4);

    vi.unstubAllGlobals();
  });

  it('evaluates every song when scopeTrackNos is an empty array', async () => {
    const opts = makeOptions({ songCount: 4 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);

    vi.stubGlobal('fetch', stubEvaluatorFetch([]));

    const result = await evaluatePack(blueprint, opts, settings, undefined, []);
    expect(result.songs.length).toBe(4);

    vi.unstubAllGlobals();
  });
});
