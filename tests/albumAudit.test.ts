import { describe, expect, it } from 'vitest';
import { auditAlbum } from '../src/core/albumAudit';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, makeOptions, moodPacks, seasonPacks, testGenres, testMoods, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Golden Window Light',
    seasonMoment: 'a quiet morning',
    listenerSituation: 'waking up slowly',
    emotionArc: 'calm to hopeful',
    hookPhrase: 'Golden Window Light',
    stylePrompt: 'warm acoustic pop, I-V-vi-IV progression, repeats chorus 4x, soft vocal, mid tempo, 92 BPM',
    lyrics: '[verse 1]\nline one\n\n[chorus]\nGolden Window Light\nGolden Window Light\nGolden Window Light\n\n[end]',
    warnings: [],
    qualityScore: 90,
    youtube: { title: 'Golden Window Light', description: 'desc', tags: ['morning', 'pop'] },
    ...overrides
  };
}

/**
 * TASK v3.58 (TASK 6) — auditAlbum() is a whole-pack layer on top of every
 * song's own scoreSong() warnings, catching cross-song properties no single
 * song can see (duplicate titles/hooks, one genre exceeding TASK 2's own
 * diversity cap) plus a final re-check of every TASK 1-5 fix. `errors` are
 * meant to block a bridge/copy UI action; `warnings` never block anything.
 */
describe('[v3.58 TASK 6] auditAlbum — blocking failures', () => {
  it('passes a clean, unique 2-song pack', () => {
    const report = auditAlbum([baseSong({ trackNo: 1 }), baseSong({ trackNo: 2, title: 'Evening Calm', hookPhrase: 'Evening Calm' })]);
    expect(report.passed).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it('fails on a duplicate title across the pack', () => {
    const report = auditAlbum([baseSong({ trackNo: 1 }), baseSong({ trackNo: 2 })]);
    expect(report.passed).toBe(false);
    expect(report.errors.some(e => e.includes('Duplicate title'))).toBe(true);
  });

  it('fails on a duplicate hook phrase even with different titles', () => {
    const report = auditAlbum([baseSong({ trackNo: 1 }), baseSong({ trackNo: 2, title: 'Evening Calm' })]);
    expect(report.passed).toBe(false);
    expect(report.errors.some(e => e.includes('Duplicate hook phrase'))).toBe(true);
  });

  it('fails when a style prompt leaks a real artist name', () => {
    const report = auditAlbum([baseSong({ stylePrompt: 'in the style of the Beatles, jangly guitars, 92 BPM' })]);
    expect(report.passed).toBe(false);
    expect(report.errors.some(e => e.includes('artist-name leak'))).toBe(true);
  });

  it('fails when a style prompt exceeds the Suno copy limit', () => {
    const report = auditAlbum([baseSong({ stylePrompt: 'x'.repeat(2000) })]);
    expect(report.passed).toBe(false);
    expect(report.errors.some(e => e.includes('exceeds'))).toBe(true);
  });

  it('warns (does not fail) when one genre is over-concentrated despite other genres being available', () => {
    const songs = Array.from({ length: 10 }, (_, i) =>
      baseSong({ trackNo: i + 1, title: `Song ${i + 1}`, hookPhrase: `Song ${i + 1}`, genreId: i < 4 ? 'jazz-pop' : `genre-${i}` })
    );
    const report = auditAlbum(songs);
    expect(report.passed).toBe(true);
    expect(report.warnings.some(w => w.includes('jazz-pop') && w.includes('concentration'))).toBe(true);
  });

  it('does not warn on genre concentration when only 2-3 genres were selected (plain even rotation is expected)', () => {
    const songs = Array.from({ length: 9 }, (_, i) =>
      baseSong({ trackNo: i + 1, title: `Song ${i + 1}`, hookPhrase: `Song ${i + 1}`, genreId: i % 3 === 0 ? 'jazz-pop' : i % 3 === 1 ? 'acoustic-pop' : 'adult-contemporary' })
    );
    const report = auditAlbum(songs);
    expect(report.warnings.some(w => w.includes('concentration'))).toBe(false);
  });
});

describe('[v3.58 TASK 6] auditAlbum — non-blocking warnings', () => {
  it('warns (does not fail) on a title/hook zero-overlap pair', () => {
    const report = auditAlbum([baseSong({ title: 'Frost and Static', hookPhrase: 'Coffee and Rain' })]);
    expect(report.passed).toBe(true);
    expect(report.warnings.some(w => w.includes('shares no word with the hook'))).toBe(true);
  });

  it('warns on the chorusStyle "verse" wording regression', () => {
    const report = auditAlbum([baseSong({ stylePrompt: 'warm acoustic pop, chorus style: verse lines unfold as scene narration, 92 BPM' })]);
    expect(report.passed).toBe(true);
    expect(report.warnings.some(w => w.includes('still mentions "verse"'))).toBe(true);
  });

  it('warns when YouTube tags contain a Suno/AI keyword', () => {
    const report = auditAlbum([baseSong({ youtube: { title: 't', description: 'd', tags: ['suno ai music', 'morning'] } })]);
    expect(report.passed).toBe(true);
    expect(report.warnings.some(w => w.includes('Suno/AI keyword'))).toBe(true);
  });

  it('an empty pack passes with no issues', () => {
    expect(auditAlbum([])).toEqual({ songCount: 0, errors: [], warnings: [] , passed: true});
  });
});

describe('[v3.58 TASK 6] auditAlbum on a real generated pack', () => {
  it('a real 18-song local pack has zero audit failures', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 18 }), testGenres, testMoods, testSeason);
    const report = auditAlbum(bp.songs, makeOptions({ songCount: 18 }));
    expect(report.errors, JSON.stringify(report.errors)).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it('a real 18-song senior pack has zero audit failures and a clean tempo/constraint bill', () => {
    const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
    const season = seasonPacks[0];
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel, songCount: 18, genreIds: channel.preferredGenres, moodIds: moods.map(m => m.id), seasonId: season.id });
    const bp = generateLocalBlueprint(opts, genres, moods, season);
    const report = auditAlbum(bp.songs, opts);
    expect(report.errors, JSON.stringify(report.errors)).toEqual([]);
    expect(report.passed).toBe(true);
  });
});
