import { describe, expect, it } from 'vitest';
import { auditAlbum } from '../src/core/albumAudit';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import type { GenerationOptions, SongIdea } from '../src/types';

/**
 * v5.7 (TASK I) — real audit finding (docs/v56-report.md): K3 §7's own
 * idolExpressionLint had zero real callers, only ever run manually for the
 * K2/K3 reports. This confirms the fix: auditAlbum now blocks a kr-idol-*
 * pack containing a banned word, and is a strict no-op for every other
 * workspace (senior-oldpop included).
 */
function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Stage Lights',
    seasonMoment: '',
    listenerSituation: '',
    emotionArc: '',
    hookPhrase: 'Stage Lights',
    stylePrompt: 'punchy contemporary K-pop production, 128 BPM',
    lyrics: 'we shine under the lights tonight',
    // v5.11 (TASK L) — genuine defaults for the new always-populated fields.
    effectiveMoneyChordId: 'default',
    effectiveGenreIds: [],
    effectiveArchetype: 'kr-idol-male',
    workspaceId: 'kr-idol-male',
    ...overrides
  };
}

function buildOpts(channelId: string, songCount: number): GenerationOptions {
  const channel = channelPresets.find(c => c.id === channelId)!;
  const season = seasonPacks[0];
  return {
    channel,
    projectTitle: `Verify ${channelId}`,
    songCount,
    lyricLanguage: channel.primaryLanguage,
    market: channel.market,
    audience: channel.audience,
    genreIds: channel.preferredGenres,
    moodIds: channel.preferredMoods,
    seasonId: season.id,
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: '',
    avoidWords: ''
  };
}

describe('idolExpressionLint wired as a real auditAlbum gate', () => {
  it('blocks a kr-idol-male pack containing a banned word', () => {
    const opts = buildOpts('stage-night', 1);
    const songs = [baseSong({ lyrics: 'her sultry curves under the lights' })];
    const report = auditAlbum(songs, opts);
    expect(report.passed).toBe(false);
    expect(report.errors.some(e => e.includes('idol-expression violation'))).toBe(true);
  });

  it('blocks a kr-idol-female pack containing a banned word', () => {
    const opts = buildOpts('daylight-city-kpop', 1);
    const songs = [baseSong({ title: 'Schoolgirl Dreams' })];
    const report = auditAlbum(songs, opts);
    expect(report.passed).toBe(false);
    expect(report.errors.some(e => e.includes('idol-expression violation'))).toBe(true);
  });

  it('does not flag a clean kr-idol-male/female pack', () => {
    for (const channelId of ['stage-night', 'daylight-city-kpop']) {
      const opts = buildOpts(channelId, 1);
      const songs = [baseSong()];
      const report = auditAlbum(songs, opts);
      expect(report.errors.some(e => e.includes('idol-expression violation')), channelId).toBe(false);
    }
  });

  it('is a strict no-op for a non-idol workspace, even with the exact same banned word', () => {
    const seniorOpts = buildOpts('good-morning-memory-radio', 1);
    const songs = [baseSong({ lyrics: 'her sultry curves under the lights' })];
    const report = auditAlbum(songs, seniorOpts);
    expect(report.errors.some(e => e.includes('idol-expression violation'))).toBe(false);
  });

  it('real 18-song kr-idol-male/female generation produces 0 idol-expression violations', () => {
    for (const channelId of ['stage-night', 'daylight-city-kpop']) {
      const opts = buildOpts(channelId, 18);
      const genres = genrePacks.filter(g => opts.channel.preferredGenres.includes(g.id));
      const moods = moodPacks.filter(m => opts.channel.preferredMoods.includes(m.id));
      const season = seasonPacks.find(s => s.id === opts.seasonId)!;
      const bp = generateLocalBlueprint(opts, genres, moods, season);
      const report = auditAlbum(bp.songs, opts);
      expect(report.errors.filter(e => e.includes('idol-expression violation')), channelId).toEqual([]);
    }
  });
});
