import { describe, expect, it } from 'vitest';
import { auditAlbum } from '../src/core/albumAudit';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { scoreSongs } from '../src/core/quality';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Test',
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: 'Test',
    stylePrompt: 'warm acoustic pop, I-V-vi-IV progression, repeats chorus 4x, soft vocal, mid tempo, 92 BPM',
    lyrics: '[verse 1]\nline one\n\n[chorus]\nTest\nTest\nTest\n\n[end]',
    warnings: [],
    qualityScore: 90,
    youtube: { title: 'Test', description: 'desc', tags: [] },
    // v5.11 (TASK L) — genuine defaults for the new always-populated fields.
    effectiveMoneyChordId: 'default',
    effectiveGenreIds: [],
    effectiveArchetype: 'senior-morning',
    workspaceId: 'senior-oldpop',
    ...overrides
  };
}

/**
 * TASK v3.59 (TASK C-9) — auditAlbum used to only ever compute its own
 * pack-level checks and never looked at songs[].warnings/qualityScore at
 * all: a real pack measured every song at qualityScore 52-58 with 4
 * warnings each while auditAlbum still reported passed:true/warnings:0.
 * Aggregated as warnings only — a verbose style prompt must never block
 * the Suno copy button (errors do that), so this never adds to `errors`.
 */
describe('[v3.59 TASK C-9] auditAlbum aggregates per-song warnings/qualityScore', () => {
  it('surfaces a per-song warning shared across multiple tracks as one aggregated warning listing every track', () => {
    const songs = [
      baseSong({ trackNo: 1, title: 'A', hookPhrase: 'A', warnings: ['Style prompt is 90 words (target 35).'] }),
      baseSong({ trackNo: 2, title: 'B', hookPhrase: 'B', warnings: ['Style prompt is 90 words (target 35).'] }),
      baseSong({ trackNo: 3, title: 'C', hookPhrase: 'C', warnings: [] })
    ];
    const report = auditAlbum(songs);
    expect(report.warnings.some(w => w.includes('Style prompt is 90 words (target 35).') && w.includes('트랙 1, 2'))).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it('reports avgQualityScore/minQualityScore and warns when the average is below 80, never as an error', () => {
    const songs = [
      baseSong({ trackNo: 1, title: 'A', hookPhrase: 'A', qualityScore: 55 }),
      baseSong({ trackNo: 2, title: 'B', hookPhrase: 'B', qualityScore: 60 })
    ];
    const report = auditAlbum(songs);
    expect(report.avgQualityScore).toBeCloseTo(57.5, 5);
    expect(report.minQualityScore).toBe(55);
    expect(report.warnings.some(w => w.includes('평균 qualityScore') && w.includes('80점 미만'))).toBe(true);
    expect(report.errors).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it('does not warn about low quality when the average is >= 80', () => {
    const songs = [baseSong({ trackNo: 1, qualityScore: 90 }), baseSong({ trackNo: 2, title: 'B', hookPhrase: 'B', qualityScore: 85 })];
    const report = auditAlbum(songs);
    expect(report.warnings.some(w => w.includes('평균 qualityScore'))).toBe(false);
  });

  it('a real generated+scored 18-song pack has its per-song warnings/quality reflected in the audit report (never as errors)', () => {
    const opts = makeOptions({ songCount: 18 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const scored = scoreSongs(bp.songs, opts.channel);
    const report = auditAlbum(scored, opts);
    expect(report.avgQualityScore).toBeDefined();
    expect(report.minQualityScore).toBeDefined();
    expect(report.errors, JSON.stringify(report.errors)).toEqual([]);
  });
});
