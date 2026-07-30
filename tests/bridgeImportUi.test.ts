import { describe, expect, it, vi } from 'vitest';
import {
  BRIDGE_IMPORT_PRECONDITION_REASON,
  bridgeImportStatusText,
  bridgeImportTotals,
  countBridgeImportReasons,
  makeBridgeImportFailureReport,
  runBridgeImportAction
} from '../src/core/bridgeImportUi';
import type { ImportSongsReport } from '../src/core/claudeCodeBridge';

function report(importedCount: number, skippedReasons: string[] = [], skippedCount = skippedReasons.length): ImportSongsReport {
  return {
    blueprint: importedCount > 0 ? {
      projectTitle: 'x',
      channelName: 'x',
      oneLineConcept: 'x',
      sonicSignature: 'x',
      vocalSignature: 'x',
      lyricRules: [],
      harmonyRules: [],
      visualRules: [],
      songs: []
    } : null,
    importedCount,
    skippedCount,
    skippedReasons,
    warnings: [],
    // TASK v3.60 (TASK F-1) — this fixture's scenario is "some songs failed
    // validation (skippedReasons)", not "the agent delivered fewer songs
    // than requested"; requestedCount matches importedCount so this test
    // stays about the pre-existing per-song-failure semantics.
    requestedCount: importedCount
  };
}

describe('[v3.55] bridge import UI state helpers', () => {
  it('reports channel and season readiness for the import header', () => {
    expect(bridgeImportStatusText({ hasSelectedChannel: true, hasSelectedSeason: false })).toBe('채널: 선택됨 · 시즌: 미선택');
  });

  it('clears loading and exposes skippedReasons when prerequisites are missing', async () => {
    let loading = true;
    let renderedReport: ImportSongsReport | null = null;
    const run = vi.fn<() => Promise<ImportSongsReport>>();

    const result = await runBridgeImportAction({
      prerequisites: { hasSelectedChannel: true, hasSelectedSeason: false },
      run,
      makeBlockedReport: makeBridgeImportFailureReport,
      makeErrorReport: makeBridgeImportFailureReport,
      setLoading: value => { loading = value; },
      setReport: value => { renderedReport = value; }
    });

    expect(run).not.toHaveBeenCalled();
    expect(loading).toBe(false);
    expect(result.importedCount).toBe(0);
    expect(result.blueprint).toBeNull();
    expect(result.skippedReasons).toEqual([BRIDGE_IMPORT_PRECONDITION_REASON]);
    expect(renderedReport?.skippedReasons).toEqual([BRIDGE_IMPORT_PRECONDITION_REASON]);
  });

  it('clears loading and converts thrown import errors into a visible report', async () => {
    let loading = false;
    let renderedReport: ImportSongsReport | null = null;

    const result = await runBridgeImportAction({
      prerequisites: { hasSelectedChannel: true, hasSelectedSeason: true },
      run: async () => {
        throw new Error('bad file read');
      },
      makeBlockedReport: makeBridgeImportFailureReport,
      makeErrorReport: makeBridgeImportFailureReport,
      setLoading: value => { loading = value; },
      setReport: value => { renderedReport = value; }
    });

    expect(loading).toBe(false);
    expect(result.blueprint).toBeNull();
    expect(result.skippedReasons[0]).toContain('bad file read');
    expect(renderedReport?.skippedReasons[0]).toContain('bad file read');
  });

  it('summarizes partial imports by success count and repeated failure reason', () => {
    const reports = [
      report(16, ['lyrics 누락', 'lyrics 누락'], 2),
      report(2, ['stylePrompt 누락'], 1)
    ];

    expect(bridgeImportTotals(reports)).toMatchObject({
      attemptedCount: 21,
      importedCount: 18,
      skippedCount: 3,
      successfulReportCount: 2,
      failedReportCount: 0
    });
    expect(countBridgeImportReasons(reports)).toEqual([
      { reason: 'lyrics 누락', count: 2 },
      { reason: 'stylePrompt 누락', count: 1 }
    ]);
  });
});
