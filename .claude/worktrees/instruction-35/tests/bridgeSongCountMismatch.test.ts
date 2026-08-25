import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction, importSongsJson } from '../src/core/claudeCodeBridge';
import { bridgeImportTotals, makeBridgeImportFailureReport } from '../src/core/bridgeImportUi';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

function songJson(count: number) {
  return JSON.stringify({
    songs: Array.from({ length: count }, (_, i) => ({
      trackNo: i + 1,
      title: `Song ${i + 1}`,
      hookPhrase: `Hook ${i + 1}`,
      stylePrompt: `warm acoustic pop, mood ${i}, instrument ${i}, vocal ${i}, hook device ${i}, ${90 + i} BPM`,
      lyrics: `[verse 1]\nline a ${i}\nline b ${i}\n\n[chorus]\nHook ${i + 1}\nHook ${i + 1}\nHook ${i + 1}\n\n[end]`,
      seasonMoment: 'x',
      listenerSituation: 'x',
      emotionArc: 'x',
      youtube: { title: 'yt', description: 'desc', tags: ['tag'] }
    }))
  });
}

/**
 * TASK v3.60 (TASK F-1) — a real bridge run delivered 17 songs when 18 were
 * requested, and importSongsJson's report showed a plain "17/17 imported
 * successfully" (skippedCount only counts songs that failed validation, not
 * songs the agent simply never wrote) — the shortfall was invisible
 * anywhere in the returned report or the Step3Generate UI's green "success"
 * banner.
 */
describe('[v3.60 TASK F-1] importSongsJson surfaces a requested-vs-imported song count mismatch', () => {
  it('adds an explicit warning and requestedCount when the agent delivers fewer songs than requested', () => {
    const opts = makeOptions({ songCount: 18, titleMode: 'ai-creative', hookMode: 'ai-creative' });
    const report = importSongsJson(songJson(17), opts, testGenres, testMoods, testSeason, [], [], []);
    expect(report.blueprint).not.toBeNull();
    expect(report.importedCount).toBe(17);
    expect(report.requestedCount).toBe(18);
    expect(report.warnings.some(w => w.includes('요청한 곡 수(18)') && w.includes('17'))).toBe(true);
  });

  it('adds no count-mismatch warning when the delivered count matches the request', () => {
    const opts = makeOptions({ songCount: 5, titleMode: 'ai-creative', hookMode: 'ai-creative' });
    const report = importSongsJson(songJson(5), opts, testGenres, testMoods, testSeason, [], [], []);
    expect(report.blueprint).not.toBeNull();
    expect(report.importedCount).toBe(5);
    expect(report.requestedCount).toBe(5);
    expect(report.warnings.some(w => w.includes('요청한 곡 수'))).toBe(false);
  });

  it('reports requestedCount 0 for a precondition-blocked import (no partial-request context)', () => {
    const report = makeBridgeImportFailureReport('블록됨');
    expect(report.requestedCount).toBe(0);
  });
});

describe('[v3.60 TASK F-1] bridgeImportTotals/UI success derivation reflects the mismatch', () => {
  it('sums requestedCount across multiple reports', () => {
    const optsA = makeOptions({ songCount: 18, titleMode: 'ai-creative', hookMode: 'ai-creative' });
    const optsB = makeOptions({ songCount: 6, titleMode: 'ai-creative', hookMode: 'ai-creative' });
    const reportA = importSongsJson(songJson(17), optsA, testGenres, testMoods, testSeason, [], [], []);
    const reportB = importSongsJson(songJson(6), optsB, testGenres, testMoods, testSeason, [], [], []);
    const totals = bridgeImportTotals([reportA, reportB]);
    expect(totals.requestedCount).toBe(24);
    expect(totals.importedCount).toBe(23);
    // TASK F-1 — a report whose importedCount falls short of its own
    // requestedCount must not count as a "successful" report even though a
    // blueprint exists and songs were imported.
    expect(totals.failedReportCount).toBeGreaterThan(0);
  });
});

describe('[v3.60 TASK F-2] bridge instruction tells the agent not to bother with Suno/AI tag keywords', () => {
  it('includes the no-benefit note for tags', () => {
    const opts = makeOptions({ songCount: 3 });
    const slots = preallocateSongSlots(opts, testGenres, { usedTitles: [], usedHooks: [] });
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, { usedTitles: [], usedHooks: [] }, slots, false);
    expect(instruction).toContain('Do not include "Suno", "AI-generated"');
    expect(instruction).toContain('filtered out before anything goes public');
  });
});
