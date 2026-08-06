import { describe, expect, it } from 'vitest';
import { evaluateReleaseReadiness } from '../src/core/releaseReadiness';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { scoreSongs } from '../src/core/quality';
import { audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from './fixtures';

/**
 * v5.22 (AXIS 4) — coverage for core/releaseReadiness.ts, the "무검수 발매
 * 기준" aggregator. Runs against a REAL generated+scored pack (not a mock)
 * so this test genuinely exercises the reused fullAudit.ts items alongside
 * the new AXIS 1/2/3 items, the same way tests/quality.test.ts's own
 * "well-formed locally generated song" case already does for scoreSong.
 */
describe('[v5.22 AXIS 4] evaluateReleaseReadiness — structural shape', () => {
  const channel = channelPresets[0];
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
  const season = seasonPacks[0];
  const opts = makeOptions({ channel, songCount: 6, lyricLanguage: 'english' });
  const blueprint = generateLocalBlueprint(opts, genres, moods, season);
  const scoredSongs = scoreSongs(blueprint.songs, channel, 'english');
  const audienceProfile = audienceProfileForChannelArchetype(channel.archetype, channel.audience);

  it('produces exactly one item per criterion, each with a real status (never silently skipped)', () => {
    const report = evaluateReleaseReadiness({
      songs: scoredSongs,
      conceptLabel: opts.customConcept || opts.projectTitle,
      songCount: opts.songCount,
      audienceProfile,
      lyricLanguage: 'english'
    });
    expect(report.totalCriteria).toBeGreaterThan(0);
    expect(report.items).toHaveLength(report.totalCriteria);
    expect(report.items.every(item => ['pass', 'fail', 'not-measured'].includes(item.status))).toBe(true);
  });

  it('releaseReady is false whenever any item is not pass — never a false "all clear"', () => {
    const report = evaluateReleaseReadiness({
      songs: scoredSongs,
      conceptLabel: opts.customConcept || opts.projectTitle,
      songCount: opts.songCount,
      audienceProfile,
      lyricLanguage: 'english'
    });
    const anyNotPass = report.items.some(item => item.status !== 'pass');
    expect(report.releaseReady).toBe(!anyNotPass);
    expect(report.failing.length).toBe(report.totalCriteria - report.passedCriteria);
  });

  it('without duplicationHistory, the 3 ledger-based items report not-measured, never a fake pass', () => {
    const report = evaluateReleaseReadiness({
      songs: scoredSongs,
      conceptLabel: opts.customConcept || opts.projectTitle,
      songCount: opts.songCount,
      audienceProfile,
      lyricLanguage: 'english'
    });
    const ledgerItems = report.items.filter(item => ['scene-recent-set-overlap', 'title-full-history-collision', 'lyric-line-recent-set-overlap'].includes(item.id));
    expect(ledgerItems).toHaveLength(3);
    expect(ledgerItems.every(item => item.status === 'not-measured')).toBe(true);
    expect(report.releaseReady).toBe(false);
  });

  it('with clean duplicationHistory (no overlap), the 3 ledger-based items pass', () => {
    const report = evaluateReleaseReadiness({
      songs: scoredSongs,
      conceptLabel: opts.customConcept || opts.projectTitle,
      songCount: opts.songCount,
      audienceProfile,
      lyricLanguage: 'english',
      duplicationHistory: { recentSituations: [], recentLyricLines: [], historicalTitles: new Set() }
    });
    const ledgerItems = report.items.filter(item => ['scene-recent-set-overlap', 'title-full-history-collision', 'lyric-line-recent-set-overlap'].includes(item.id));
    expect(ledgerItems.every(item => item.status === 'pass')).toBe(true);
  });

  it('a real scene collision against duplicationHistory fails scene-recent-set-overlap', () => {
    const collidingScene = scoredSongs[0].listenerSituation;
    const report = evaluateReleaseReadiness({
      songs: scoredSongs,
      conceptLabel: opts.customConcept || opts.projectTitle,
      songCount: opts.songCount,
      audienceProfile,
      lyricLanguage: 'english',
      duplicationHistory: { recentSituations: [collidingScene], recentLyricLines: [], historicalTitles: new Set() }
    });
    const item = report.items.find(i => i.id === 'scene-recent-set-overlap');
    expect(item?.status).toBe('fail');
    expect(report.releaseReady).toBe(false);
  });

  it('genuinely unbuilt criteria (modulation count, intro-type variety) are reported not-measured with notImplemented: true, never faked as passing', () => {
    const report = evaluateReleaseReadiness({
      songs: scoredSongs,
      conceptLabel: opts.customConcept || opts.projectTitle,
      songCount: opts.songCount,
      audienceProfile,
      lyricLanguage: 'english'
    });
    const modulation = report.items.find(i => i.id === 'modulation-count');
    const introVariety = report.items.find(i => i.id === 'intro-type-variety');
    expect(modulation?.status).toBe('not-measured');
    expect(modulation?.notImplemented).toBe(true);
    expect(introVariety?.status).toBe('not-measured');
    expect(introVariety?.notImplemented).toBe(true);
  });

  it('audio-dependent fullAudit items (requiresAudio) are excluded entirely, never reported as a fake failure', () => {
    const report = evaluateReleaseReadiness({
      songs: scoredSongs,
      conceptLabel: opts.customConcept || opts.projectTitle,
      songCount: opts.songCount,
      audienceProfile,
      lyricLanguage: 'english'
    });
    // renderScore/audio-take-based items should not appear at all (this
    // checklist runs pre-release, before any audio exists to measure).
    expect(report.items.some(item => item.id.startsWith('audio_') || item.id.startsWith('render'))).toBe(false);
  });
});
