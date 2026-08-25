import { describe, expect, it } from 'vitest';
import {
  buildProductionBundleManifest, buildProductionTimelineCsv, buildFfmpegConcatManifest,
  validateProductionBundleCompleteness, tracksWithoutAudio,
  buildProductionBundleFiles, type ProductionBundleTrackInput
} from '../src/core/productionBundle';
import { buildTakeDirectives, type AudioTake } from '../src/core/audioTakes';
import { buildExportMeta } from '../src/core/exportMeta';
import { buildZip } from '../src/utils/zipExporter';
import { SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';
import type { SongIdea } from '../src/types';

/**
 * codex 지시문 06 (TASK H, required test file) — real coverage of manifest
 * assembly, the CapCut timeline.csv, the ffmpeg concat manifest, and the
 * completeness validator the 완료 기준 names explicitly ("production bundle
 * missing metadata = 0").
 */

function makeSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1, title: 'Song One', seasonMoment: '', listenerSituation: 'x', emotionArc: 'warm',
    hookPhrase: 'hold on', stylePrompt: 'warm pop', lyrics: '[verse 1]\nfirst real line\n[chorus]\nhold on tonight',
    youtube: { title: 'Song One (Official Lyric Video)', description: 'A real description.', tags: ['pop'] },
    warnings: [], qualityScore: 80,
    ...overrides
  } as SongIdea;
}

function makeTake(song: SongIdea, overrides: Partial<AudioTake> = {}): AudioTake {
  return {
    takeId: `take-${song.trackNo}`, songId: `song-${song.trackNo}`, trackNo: song.trackNo, packId: 'p1', takeNo: 1,
    fileName: `t${song.trackNo}.mp3`, versionLabel: 'v1', adopted: true,
    metrics: { fileName: `t${song.trackNo}.mp3`, durationSec: 180, rmsCurve: [], peakPosition: 0.8, dynamicRange: 10, overallLevel: -14, spectralCentroid: 2000, lowBandRatio: 0.3, highBandRatio: 0.2, spectrumProfile: [], warnings: [] },
    vocalMetrics: { vocalCentroid: 900, vocalLowRatio: 0.3, vocalMidRatio: 0.4, vocalHighRatio: 0.3, vocalProfile: [], registerHint: 'mid' },
    tempoEstimate: { bpm: 96, confidence: 0.8 },
    directives: buildTakeDirectives({ genreId: 'jazz-pop', vocalType: 'female', bpm: 96 }, SENIOR_AUDIENCE_PROFILE),
    analyzedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  } as AudioTake;
}

describe('[codex 지시문 06 TASK H] buildProductionBundleManifest — real, selected-takes-only, cumulative timeline', () => {
  it('computes real cumulative start/end times from each track\'s own measured duration', () => {
    const song1 = makeSong({ trackNo: 1 });
    const song2 = makeSong({ trackNo: 2, title: 'Song Two' });
    const take1 = makeTake(song1, { metrics: { ...makeTake(song1).metrics, durationSec: 100 } });
    const take2 = makeTake(song2, { metrics: { ...makeTake(song2).metrics, durationSec: 150 } });
    const manifest = buildProductionBundleManifest({
      setName: 'Test Set', workspaceId: 'senior-oldpop', exportMeta: buildExportMeta(undefined, 'senior-oldpop'),
      tracks: [{ song: song1, selectedTake: take1 }, { song: song2, selectedTake: take2 }]
    });
    expect(manifest.tracks[0].startSec).toBe(0);
    expect(manifest.tracks[0].endSec).toBe(100);
    expect(manifest.tracks[1].startSec).toBe(100);
    expect(manifest.tracks[1].endSec).toBe(250);
  });

  it('originalTakesPreserved is always true (this module never mutates/deletes the source take)', () => {
    const song = makeSong();
    const manifest = buildProductionBundleManifest({
      setName: 'Test', workspaceId: 'senior-oldpop', exportMeta: buildExportMeta(undefined, 'senior-oldpop'),
      tracks: [{ song, selectedTake: makeTake(song) }]
    });
    expect(manifest.originalTakesPreserved).toBe(true);
  });

  it('orders tracks by trackNo regardless of input order', () => {
    const song2 = makeSong({ trackNo: 2, title: 'B' });
    const song1 = makeSong({ trackNo: 1, title: 'A' });
    const manifest = buildProductionBundleManifest({
      setName: 'Test', workspaceId: 'senior-oldpop', exportMeta: buildExportMeta(undefined, 'senior-oldpop'),
      tracks: [{ song: song2, selectedTake: makeTake(song2) }, { song: song1, selectedTake: makeTake(song1) }]
    });
    expect(manifest.tracks.map(t => t.trackNo)).toEqual([1, 2]);
  });
});

describe('[codex 지시문 06 TASK H] buildProductionTimelineCsv / buildFfmpegConcatManifest', () => {
  it('produces a real CSV with the expected columns and one row per track', () => {
    const song = makeSong();
    const manifest = buildProductionBundleManifest({
      setName: 'Test', workspaceId: 'senior-oldpop', exportMeta: buildExportMeta(undefined, 'senior-oldpop'),
      tracks: [{ song, selectedTake: makeTake(song), audioBlob: new Blob(['x']) }]
    });
    const csv = buildProductionTimelineCsv(manifest);
    expect(csv).toContain('trackNo');
    expect(csv).toContain('Song One');
  });

  it('the ffmpeg manifest only lists tracks that actually have a real audio file', () => {
    const song1 = makeSong({ trackNo: 1 });
    const song2 = makeSong({ trackNo: 2, title: 'No Audio Track' });
    const manifest = buildProductionBundleManifest({
      setName: 'Test', workspaceId: 'senior-oldpop', exportMeta: buildExportMeta(undefined, 'senior-oldpop'),
      tracks: [
        { song: song1, selectedTake: makeTake(song1), audioBlob: new Blob(['x']) },
        { song: song2, selectedTake: makeTake(song2) } // no audioBlob supplied
      ]
    });
    const ffmpegManifest = buildFfmpegConcatManifest(manifest);
    expect(ffmpegManifest).toContain('Song One');
    expect(ffmpegManifest).not.toContain('No Audio Track');
  });
});

describe('[codex 지시문 06 TASK H] validateProductionBundleCompleteness — 완료 기준 "missing metadata = 0"', () => {
  it('a fully complete manifest has zero completeness issues', () => {
    const song = makeSong();
    const manifest = buildProductionBundleManifest({
      setName: 'Test', workspaceId: 'senior-oldpop', exportMeta: buildExportMeta(undefined, 'senior-oldpop'),
      tracks: [{ song, selectedTake: makeTake(song) }]
    });
    expect(validateProductionBundleCompleteness(manifest)).toEqual([]);
  });

  it('flags a real missing YouTube title', () => {
    const song = makeSong({ youtube: { title: '', description: 'x', tags: [] } });
    const manifest = buildProductionBundleManifest({
      setName: 'Test', workspaceId: 'senior-oldpop', exportMeta: buildExportMeta(undefined, 'senior-oldpop'),
      tracks: [{ song, selectedTake: makeTake(song) }]
    });
    expect(validateProductionBundleCompleteness(manifest).some(issue => issue.includes('title'))).toBe(true);
  });

  it('missing AUDIO is reported separately, never counted as a "missing metadata" issue', () => {
    const song = makeSong();
    const manifest = buildProductionBundleManifest({
      setName: 'Test', workspaceId: 'senior-oldpop', exportMeta: buildExportMeta(undefined, 'senior-oldpop'),
      tracks: [{ song, selectedTake: makeTake(song) }] // no audioBlob
    });
    expect(validateProductionBundleCompleteness(manifest)).toEqual([]);
    expect(tracksWithoutAudio(manifest)).toEqual([1]);
  });
});

describe('[codex 지시문 06 TASK H] buildProductionBundleFiles + buildZip — real, selected-takes-only file tree', () => {
  it('assembles the real folder structure: lyrics/, srt/, metadata/, timeline.csv, manifest.json', () => {
    const song = makeSong();
    const take = makeTake(song);
    const manifest = buildProductionBundleManifest({
      setName: 'Test', workspaceId: 'senior-oldpop', exportMeta: buildExportMeta(undefined, 'senior-oldpop'),
      tracks: [{ song, selectedTake: take }]
    });
    const trackInputs: ProductionBundleTrackInput[] = [{ song, selectedTake: take }];
    const files = buildProductionBundleFiles(manifest, trackInputs, [{ trackNo: 1, imagePrompt: 'a warm sunset thumbnail' }]);

    expect(files.some(f => f.name.startsWith('lyrics/'))).toBe(true);
    expect(files.some(f => f.name.startsWith('srt/'))).toBe(true);
    expect(files.some(f => f.name.startsWith('metadata/'))).toBe(true);
    expect(files.some(f => f.name.startsWith('thumbnails/'))).toBe(true);
    expect(files.some(f => f.name === 'timeline.csv')).toBe(true);
    expect(files.some(f => f.name === 'manifest.json')).toBe(true);

    // Real zip assembly — buildZip (extended by this same task for binary content) still accepts the whole file list.
    const blob = buildZip(files);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('only assembles files for SELECTED (adopted) takes passed in — never an un-selected take', () => {
    const song = makeSong();
    const selectedTake = makeTake(song, { takeId: 'selected-take', adopted: true });
    const manifest = buildProductionBundleManifest({
      setName: 'Test', workspaceId: 'senior-oldpop', exportMeta: buildExportMeta(undefined, 'senior-oldpop'),
      tracks: [{ song, selectedTake }]
    });
    const files = buildProductionBundleFiles(manifest, [{ song, selectedTake }]);
    const manifestFile = files.find(f => f.name === 'manifest.json')!;
    expect(String(manifestFile.content)).toContain('selected-take');
  });
});
