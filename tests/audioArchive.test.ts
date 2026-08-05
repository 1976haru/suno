import { describe, expect, it } from 'vitest';
import {
  buildArchiveEntry,
  buildArchiveSummary,
  buildArchiveTrackEntry,
  buildArchiveTrend,
  parseArchiveLabel,
  type AudioArchiveEntry,
  type AudioArchiveTrackEntry
} from '../src/core/audioArchive';
import { buildArchiveTrackCsv, buildChannelArchiveSummaryCsv } from '../src/core/csvExport';

// TASK v4.15 (TASK B) — buildArchiveEntry/buildArchiveSummary/
// buildArchiveTrackEntry/buildArchiveTrend/parseArchiveLabel are all pure
// (no IndexedDB), so fully verifiable under vitest's node environment. The
// three IndexedDB functions (saveArchive/listArchives/deleteArchive) are NOT
// exercised here — same "exercised indirectly through real browser use"
// limitation audioTakes.test.ts already documents (Node has no IndexedDB;
// fake-indexeddb was deliberately not added as a dependency, see
// tests/hookLedgerDashboard.test.ts's own note) — see docs/v415-report.md
// for the real-browser round-trip verification.

describe('[v4.15 TASK B] parseArchiveLabel', () => {
  it('parses the spec\'s own example: oldpoplounge2st -> channel + sequence, suffix stays inside the raw label', () => {
    const parsed = parseArchiveLabel('oldpoplounge2st');
    expect(parsed.channelSlug).toBe('oldpoplounge');
    expect(parsed.sequence).toBe(2);
  });

  it('a label with no digits fails to parse but never throws', () => {
    expect(parseArchiveLabel('morningradio')).toEqual({});
  });

  it('a label starting with a digit fails to parse but never throws', () => {
    expect(parseArchiveLabel('2ndoldpop')).toEqual({});
  });

  it('trims whitespace before parsing', () => {
    expect(parseArchiveLabel('  jazzcafe5th  ')).toEqual({ channelSlug: 'jazzcafe', sequence: 5 });
  });
});

function track(overrides: Partial<AudioArchiveTrackEntry> = {}): AudioArchiveTrackEntry {
  return {
    fileName: 'T1.mp3',
    durationSec: 210,
    dynamicRange: 6,
    peakPosition: 0.8,
    spectralCentroid: 1200,
    vocalBandCentroid: 900,
    ...overrides
  };
}

describe('[v4.15 TASK B] buildArchiveSummary', () => {
  it('computes avg/range/inTargetRange/lateRiseCount/tempoRange from real track values', () => {
    const tracks = [
      track({ durationSec: 180, dynamicRange: 4, peakPosition: 0.9, tempoEstimate: 92 }),
      track({ durationSec: 220, dynamicRange: 8, peakPosition: 0.5, tempoEstimate: 100 }),
      track({ durationSec: 300, dynamicRange: 6, peakPosition: 0.8, tempoEstimate: undefined })
    ];
    const summary = buildArchiveSummary(tracks, [180, 240]);
    expect(summary.avgDuration).toBeCloseTo((180 + 220 + 300) / 3, 5);
    expect(summary.durationRange).toEqual([180, 300]);
    expect(summary.inTargetRange).toBe(2); // 180 and 220 fall in [180,240], 300 doesn't
    expect(summary.avgDynamicRange).toBeCloseTo(6, 5);
    expect(summary.lateRiseCount).toBe(2); // peakPosition >= 0.75: 0.9 and 0.8
    expect(summary.tempoRange).toEqual([92, 100]); // undefined tempo excluded
  });

  it('never throws on an empty track list', () => {
    const summary = buildArchiveSummary([], [180, 240]);
    expect(summary.avgDuration).toBe(0);
    expect(summary.durationRange).toEqual([0, 0]);
    expect(summary.inTargetRange).toBe(0);
  });
});

describe('[v4.15 TASK B] buildArchiveTrackEntry', () => {
  it('derives a track row from the same FullAudioAnalysis shape audioTakes.ts already uses, dropping unreliable tempo', () => {
    const full = {
      metrics: { fileName: 'T3.mp3', durationSec: 200, dynamicRange: 5, peakPosition: 0.7, spectralCentroid: 1500 } as any,
      vocalMetrics: { vocalCentroid: 850 } as any,
      tempoEstimate: { bpm: 96, confidence: 0.6 } as any
    };
    const entry = buildArchiveTrackEntry(full, { trackNo: 3, version: 'A', adopted: true, rating: 'good' });
    expect(entry.trackNo).toBe(3);
    expect(entry.fileName).toBe('T3.mp3');
    expect(entry.vocalBandCentroid).toBe(850);
    expect(entry.tempoEstimate).toBe(96);
    expect(entry.rating).toBe('good');
  });

  it('drops tempoEstimate entirely when confidence is below the low-confidence threshold', () => {
    const full = {
      metrics: { fileName: 'T4.mp3', durationSec: 200, dynamicRange: 5, peakPosition: 0.7, spectralCentroid: 1500 } as any,
      vocalMetrics: { vocalCentroid: 850 } as any,
      tempoEstimate: { bpm: 96, confidence: 0.1 } as any
    };
    const entry = buildArchiveTrackEntry(full);
    expect(entry.tempoEstimate).toBeUndefined();
  });
});

describe('[v4.15 TASK B] buildArchiveEntry', () => {
  it('preserves the raw archiveLabel and attaches parsed channelSlug/sequence + a computed summary', () => {
    const entry = buildArchiveEntry({
      archiveLabel: 'oldpoplounge2st',
      workspaceId: 'senior-oldpop',
      tracks: [track({ durationSec: 200 }), track({ durationSec: 220 })],
      targetRangeSec: [180, 240]
    });
    expect(entry.archiveLabel).toBe('oldpoplounge2st');
    expect(entry.channelSlug).toBe('oldpoplounge');
    expect(entry.sequence).toBe(2);
    expect(entry.trackCount).toBe(2);
    expect(entry.summary.inTargetRange).toBe(2);
    expect(entry.analyzedAt).toBeTruthy();
  });

  it('still saves (archiveLabel preserved, channelSlug/sequence undefined) when the label fails to parse', () => {
    const entry = buildArchiveEntry({
      archiveLabel: '이번주세트',
      tracks: [track()],
      targetRangeSec: [180, 240]
    });
    expect(entry.archiveLabel).toBe('이번주세트');
    expect(entry.channelSlug).toBeUndefined();
    expect(entry.sequence).toBeUndefined();
  });
});

describe('[v4.15 TASK B] buildArchiveTrend', () => {
  it('sorts chronologically and surfaces avgDuration/avgDynamicRange/inTargetRange across archives', () => {
    const archives: AudioArchiveEntry[] = [
      { archiveLabel: 'b', workspaceId: 'senior-oldpop', analyzedAt: '2026-02-01T00:00:00Z', trackCount: 2, tracks: [], summary: { avgDuration: 188, durationRange: [0, 0], inTargetRange: 2, avgDynamicRange: 6, lateRiseCount: 1, tempoRange: [0, 0] } },
      { archiveLabel: 'a', workspaceId: 'senior-oldpop', analyzedAt: '2026-01-01T00:00:00Z', trackCount: 2, tracks: [], summary: { avgDuration: 227, durationRange: [0, 0], inTargetRange: 1, avgDynamicRange: 4, lateRiseCount: 0, tempoRange: [0, 0] } }
    ];
    const trend = buildArchiveTrend(archives);
    expect(trend.map(p => p.archiveLabel)).toEqual(['a', 'b']); // chronological, not insertion order
    expect(trend[0].avgDuration).toBe(227);
    expect(trend[1].avgDuration).toBe(188);
  });
});

describe('[v4.15 TASK B] archive CSV builders', () => {
  it('buildArchiveTrackCsv reuses buildCsvText — header + one row per track', () => {
    const entry = buildArchiveEntry({
      archiveLabel: 'oldpoplounge2st',
      tracks: [track({ trackNo: 1, version: 'A', adopted: true, rating: 'good' })],
      targetRangeSec: [180, 240]
    });
    const csv = buildArchiveTrackCsv(entry);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('트랙번호');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('T1.mp3');
    expect(lines[1]).toContain('좋음');
  });

  it('buildChannelArchiveSummaryCsv — one row per archive, in the given order', () => {
    const entries: AudioArchiveEntry[] = [
      buildArchiveEntry({ archiveLabel: 'oldpoplounge1st', tracks: [track()], targetRangeSec: [180, 240] }),
      buildArchiveEntry({ archiveLabel: 'oldpoplounge2st', tracks: [track(), track()], targetRangeSec: [180, 240] })
    ];
    const csv = buildChannelArchiveSummaryCsv(entries);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('oldpoplounge1st');
    expect(lines[2]).toContain('oldpoplounge2st');
  });
});
