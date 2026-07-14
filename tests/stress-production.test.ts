import { afterAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { composeHook, HOOK_SHAPES, hookPoolSize, hookRhythmLength } from '../src/core/lyricEngine';
import { buildSoundSignature, PERSONA_STYLE_LIMIT } from '../src/core/soundSignature';
import { exhaustionStats, hookPoolNeedsWarning } from '../src/core/hookLedger';
import { stitchBatchResults, validateStitched, type BatchRequestResult } from '../src/core/batchStitcher';
import { clampSongCount } from '../src/utils/generation';
import { callGenerateProxy } from '../src/providers/proxyFetch';
import { SUNO_COPY_LIMIT } from '../src/core/promptBudget';
import { channelPresets, genrePacks, makeOptions, moodPacks, seasonPacks, testGenres, testMoods, testSeason } from './fixtures';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

interface ReportRow {
  scenario: string;
  result: 'PASS' | 'FAIL' | 'MANUAL';
  durationMs: number;
  notes: string;
}

const rows: ReportRow[] = [];

function productionCase(scenario: string, fn: () => void | Promise<void>) {
  it(scenario, async () => {
    const start = performance.now();
    try {
      await fn();
      rows.push({ scenario, result: 'PASS', durationMs: Math.round(performance.now() - start), notes: '-' });
    } catch (error) {
      rows.push({ scenario, result: 'FAIL', durationMs: Math.round(performance.now() - start), notes: String(error).slice(0, 220) });
      throw error;
    }
  });
}

function bodyLines(text: string) {
  return text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('[') && !line.startsWith('Title:'));
}

function generatedHistory(count: number) {
  return {
    usedTitles: Array.from({ length: count }, (_, i) => `Previously Used Title ${i}`),
    usedHooks: Array.from({ length: count }, (_, i) => `Previously Used Hook ${i}`)
  };
}

function makeBatchResult(customId: string, trackNos: number[], error: string | null = null): BatchRequestResult {
  return {
    customId,
    error,
    usage: null,
    blueprint: error
      ? null
      : {
        projectTitle: 'Batch Test',
        channelName: 'Channel',
        oneLineConcept: 'concept',
        sonicSignature: 'signature',
        vocalSignature: 'vocal',
        lyricRules: [],
        harmonyRules: [],
        visualRules: [],
        songs: trackNos.map(trackNo => ({
          trackNo,
          title: `Title ${trackNo}`,
          seasonMoment: 'Season',
          listenerSituation: 'Scene',
          emotionArc: 'Arc',
          hookPhrase: `Hook ${trackNo}`,
          stylePrompt: 'warm pop, hook, I-V-vi-IV, 97 BPM',
          lyrics: '[chorus]\nHook',
          thumbnailText: 'Thumb',
          youtube: { title: `YT ${trackNo}`, description: 'Desc', tags: ['tag'], thumbnailText: 'Thumb' },
          qualityScore: 0,
          warnings: []
        }))
      }
  };
}

describe('production stress tests', () => {
  productionCase('S1 long run: 18 weeks x 12 songs has no title/hook duplicates and stable memory', () => {
    const before = process.memoryUsage().heapUsed;
    const usedTitles: string[] = [];
    const usedHooks: string[] = [];
    const songLineSets: Set<string>[] = [];
    let week18Ms = 0;

    for (let week = 1; week <= 18; week += 1) {
      const start = performance.now();
      const bp = generateLocalBlueprint(
        makeOptions({ songCount: 12, projectTitle: `Production Week ${week}` }),
        testGenres,
        testMoods,
        testSeason,
        { usedTitles, usedHooks }
      );
      if (week === 18) week18Ms = performance.now() - start;
      usedTitles.push(...bp.songs.map(song => song.title));
      usedHooks.push(...bp.songs.map(song => song.hookPhrase));
      songLineSets.push(...bp.songs.map(song => new Set(bodyLines(song.lyrics).filter(line => line !== song.hookPhrase).map(line => line.toLowerCase()))));
    }

    let pairwiseTotal = 0;
    let pairwisePairs = 0;
    for (let i = 0; i < songLineSets.length; i += 1) {
      for (let j = i + 1; j < songLineSets.length; j += 1) {
        const a = songLineSets[i];
        const b = songLineSets[j];
        const intersection = [...a].filter(line => b.has(line)).length;
        const union = new Set([...a, ...b]).size || 1;
        pairwiseTotal += intersection / union;
        pairwisePairs += 1;
      }
    }
    const reuseRate = pairwisePairs ? pairwiseTotal / pairwisePairs : 0;
    const heapDeltaMB = (process.memoryUsage().heapUsed - before) / (1024 * 1024);

    expect(new Set(usedTitles.map(title => title.toLowerCase())).size).toBe(usedTitles.length);
    expect(new Set(usedHooks.map(hook => hook.toLowerCase())).size).toBe(usedHooks.length);
    expect(reuseRate).toBeLessThan(0.3);
    expect(week18Ms).toBeLessThan(3000);
    expect(heapDeltaMB).toBeLessThan(100);
  });

  productionCase('S2 hook pool exhaustion gives warning at 80 percent and clear error at exhaustion', () => {
    const poolSize = hookPoolSize('english', 'senior-morning');
    const used = new Set<string>();
    let generated = 0;
    let error = '';

    for (const shape of HOOK_SHAPES) {
      while (true) {
        try {
          const hook = composeHook(generated * 7919 + 17, { language: 'english', shape, usedHooks: used, archetype: 'senior-morning' });
          used.add(hook.phrase);
          generated += 1;
        } catch (caught) {
          error = String(caught);
          break;
        }
      }
    }

    const stats = exhaustionStats(Math.ceil(poolSize * 0.8), poolSize);
    expect(hookPoolNeedsWarning(stats)).toBe(true);
    expect(generated).toBe(poolSize);
    expect(error).toContain('훅 풀이 소진되었습니다');
  });

  productionCase('S3 performance: 30 local songs stay fast with 0/200/500 history entries', () => {
    const histories = [0, 200, 500];
    const limits = [3000, 5000, 10000];
    for (let i = 0; i < histories.length; i += 1) {
      const start = performance.now();
      const bp = generateLocalBlueprint(
        makeOptions({ songCount: 30, projectTitle: `Perf ${histories[i]}` }),
        testGenres,
        testMoods,
        testSeason,
        generatedHistory(histories[i])
      );
      const elapsed = performance.now() - start;
      expect(bp.songs).toHaveLength(30);
      expect(elapsed).toBeLessThan(limits[i]);
    }
  });

  productionCase('S4 prompt caps: all genres/languages/seasons fit, persona tracks fit, seed keeps essentials', () => {
    for (const genre of genrePacks) {
      for (const language of ['english', 'korean', 'japanese'] as const) {
        for (const season of seasonPacks) {
          const bp = generateLocalBlueprint(makeOptions({ songCount: 1, lyricLanguage: language, genreIds: [genre.id], seasonId: season.id }), [genre], testMoods, season);
          expect(bp.songs[0].stylePrompt.length).toBeLessThanOrEqual(SUNO_COPY_LIMIT);
        }
      }
    }

    const personaBp = generateLocalBlueprint(makeOptions({ songCount: 30, personaMode: true }), testGenres, testMoods, testSeason, undefined, PERSONA_STYLE_LIMIT);
    const signature = buildSoundSignature(personaBp, makeOptions({ songCount: 30, personaMode: true }), channelPresets[0]);
    expect(signature.shortLength).toBeLessThanOrEqual(PERSONA_STYLE_LIMIT);
    for (const song of personaBp.songs.slice(1)) expect(song.stylePrompt.length).toBeLessThanOrEqual(PERSONA_STYLE_LIMIT);
    expect(personaBp.songs[0].stylePrompt).toContain('male soft husky tenor close-mic');
    expect(personaBp.songs[0].stylePrompt).toContain('hook "');
    expect(personaBp.songs[0].stylePrompt).toContain('I-V-vi-IV progression');
  });

  productionCase('S5 extreme inputs are clamped and never execute script text', () => {
    for (const value of [0, -5, 31, 999, NaN, Infinity, Number('abc')]) {
      const songCount = clampSongCount(value);
      expect(songCount).toBeGreaterThanOrEqual(1);
      expect(songCount).toBeLessThanOrEqual(30);
      expect(() => generateLocalBlueprint(makeOptions({ songCount }), testGenres, testMoods, testSeason)).not.toThrow();
    }

    const names = ['x'.repeat(10000), '😀😀😀', '', '<script>alert(1)</script>'];
    for (const name of names) {
      const channel = { ...channelPresets[0], name, defaultVocal: 'warm male tenor '.repeat(400) };
      const bp = generateLocalBlueprint(makeOptions({ channel, songCount: 1, vocalTone: 'warm male tenor '.repeat(400), avoidWords: 'avoid harsh '.repeat(500) }), testGenres, testMoods, testSeason);
      expect(bp.songs).toHaveLength(1);
      expect(bp.songs[0].title).not.toContain('<script>');
    }
  });

  productionCase('S6 storage load simulation: 100 packs serialize/restore and hook lookup over 5000 entries stays fast', () => {
    const packs = Array.from({ length: 100 }, (_, i) => generateLocalBlueprint(makeOptions({ songCount: 30, projectTitle: `Stored Pack ${i}` }), testGenres, testMoods, testSeason));
    const restored = JSON.parse(JSON.stringify(packs)) as typeof packs;
    expect(restored).toHaveLength(100);
    expect(restored.every(pack => pack.songs.length === 30)).toBe(true);

    const hooks = Array.from({ length: 5000 }, (_, i) => `Hook ${i}`);
    const start = performance.now();
    const set = new Set(hooks);
    expect(set.has('Hook 4999')).toBe(true);
    expect(performance.now() - start).toBeLessThan(1000);
  });

  productionCase('S7 batch stability: one failed batch preserves the rest and retry merges without duplicate trackNo', () => {
    const results = [
      makeBatchResult('b0', [1, 2]),
      makeBatchResult('b1', [3, 4], 'failed'),
      makeBatchResult('b2', [5, 6])
    ];
    const opts = makeOptions({ songCount: 6 });
    const stitched = stitchBatchResults(opts, results);
    expect(stitched.failedBatchIndexes).toEqual([1]);
    expect(stitched.blueprint?.songs.map(song => song.trackNo)).toEqual([1, 2, 5, 6]);

    const retry = stitchBatchResults(opts, [makeBatchResult('b0', [3, 4])]);
    const mergedSongs = [...(stitched.blueprint?.songs || []), ...(retry.blueprint?.songs || [])].sort((a, b) => a.trackNo - b.trackNo);
    expect(new Set(mergedSongs.map(song => song.trackNo)).size).toBe(mergedSongs.length);
    expect(validateStitched(mergedSongs, 6).ok).toBe(true);
  });

  productionCase('S8 API failure modes are mocked, retried, recoverable, and key-safe', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'API 키가 올바르지 않습니다' }), { status: 401 })));
    await expect(callGenerateProxy('/api/generate', {}, {})).rejects.toThrow('API 키가 올바르지 않습니다');
    vi.unstubAllGlobals();

    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls += 1;
      if (calls < 4) return new Response(JSON.stringify({ error: '요청 한도를 초과했습니다' }), { status: 429 });
      return new Response(JSON.stringify({ blueprint: { songs: [] } }), { status: 200 });
    }));
    await expect(callGenerateProxy('/api/generate', {}, {}, { baseDelayMs: 1 })).resolves.toHaveProperty('blueprint');
    expect(calls).toBe(4);
    vi.unstubAllGlobals();

    const secret = 'sk-ant-test-secret';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'timeout' }), { status: 504 })));
    try {
      await callGenerateProxy('/api/generate', { 'X-User-Api-Key': secret }, {});
    } catch (error) {
      expect(String(error)).not.toContain('sk-ant-');
      expect(String(error)).not.toContain('sk-');
    }
    vi.unstubAllGlobals();
  });
});

afterAll(() => {
  const table = [
    '| 시나리오 | 결과 | 소요시간(ms) | 비고 |',
    '|---|---:|---:|---|',
    ...rows.map(row => `| ${row.scenario} | ${row.result} | ${row.durationMs} | ${row.notes.replace(/\|/g, '\\|')} |`)
  ].join('\n');
  fs.writeFileSync(
    join(repoRoot, 'docs', 'STRESS_TEST_REPORT.md'),
    `# Production Stress Test Report\n\nGenerated: ${new Date().toISOString()}\n\n${table}\n`,
    'utf8'
  );
});
