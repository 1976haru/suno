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

  // 지시문 08 (TASK C) — modulation-count/intro-type-variety are no longer
  // universally unbuilt: core/seniorOldpopPolicy.ts's countFinalKeyUps/
  // countDistinctIntroTypes are now wired in for the senior-morning
  // archetype specifically (see evaluateReleaseReadiness's own isSeniorOldpop
  // gate). Without a real archetype (this test's own channel is
  // senior-morning, but the ORIGINAL call below never passed `archetype` at
  // all), these correctly report not-measured with notImplemented: false —
  // "this check exists and works, just not evaluated for an unknown
  // workspace" — same convention englishGrammarErrors/inSongLineRepetition
  // already use elsewhere in this file for "not applicable to this pack",
  // distinct from notImplemented: true's "no check exists anywhere".
  it('modulation count / intro-type variety are not-measured (not notImplemented) when archetype is unknown', () => {
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
    expect(modulation?.notImplemented).toBe(false);
    expect(introVariety?.status).toBe('not-measured');
    expect(introVariety?.notImplemented).toBe(false);
  });

  it('modulation count / intro-type variety / era share / motif quota / chord dominance are genuinely measured for the senior-morning archetype', () => {
    const report = evaluateReleaseReadiness({
      songs: scoredSongs,
      conceptLabel: opts.customConcept || opts.projectTitle,
      songCount: opts.songCount,
      audienceProfile,
      lyricLanguage: 'english',
      archetype: channel.archetype
    });
    expect(channel.archetype).toBe('senior-morning');
    const modulation = report.items.find(i => i.id === 'modulation-count');
    const introVariety = report.items.find(i => i.id === 'intro-type-variety');
    const eraShare = report.items.find(i => i.id === 'senior-era-share');
    const motifQuota = report.items.find(i => i.id === 'senior-motif-quota');
    const chordDominance = report.items.find(i => i.id === 'senior-chord-dominance');
    for (const item of [modulation, introVariety, eraShare, motifQuota, chordDominance]) {
      expect(item).toBeDefined();
      expect(['pass', 'fail', 'not-measured']).toContain(item?.status);
      expect(item?.detail).not.toBe('');
    }
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

  it('without explorationTrackNos, explorationExemptCount is 0 and no item is marked exempted', () => {
    const report = evaluateReleaseReadiness({
      songs: scoredSongs, conceptLabel: opts.customConcept || opts.projectTitle, songCount: opts.songCount, audienceProfile, lyricLanguage: 'english'
    });
    expect(report.explorationExemptCount).toBe(0);
    expect(report.items.some(item => item.exempted)).toBe(false);
  });
});

/**
 * codex 지시문 02 (TASK K) — prompt-fingerprint / arrangement-recipe items,
 * same "not-measured without history, real pass/fail with it" shape as the
 * scene/title/line items above (own describe block since these two axes
 * are independently optional within duplicationHistory — see
 * ReleaseReadinessInput.duplicationHistory's own doc comment).
 */
describe('[codex 지시문 02 TASK K] evaluateReleaseReadiness — prompt-fingerprint / arrangement-recipe items', () => {
  const channel = channelPresets[0];
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
  const season = seasonPacks[0];
  const opts = makeOptions({ channel, songCount: 6, lyricLanguage: 'english' });
  const blueprint = generateLocalBlueprint(opts, genres, moods, season);
  const scoredSongs = scoreSongs(blueprint.songs, channel, 'english').map((song, idx) =>
    idx === 0 ? { ...song, promptFingerprint: 'genre-x|90s|male|vocal-immediate|money-1|hook-1|no-mod|medium', arrangementRecipe: 'vocal-immediate|medium|guitar,piano' } : song
  );
  const audienceProfile = audienceProfileForChannelArchetype(channel.archetype, channel.audience);

  it('without duplicationHistory.recentFingerprints/recentArrangementRecipes, both items report not-measured', () => {
    const report = evaluateReleaseReadiness({
      songs: scoredSongs, conceptLabel: opts.customConcept || opts.projectTitle, songCount: opts.songCount, audienceProfile, lyricLanguage: 'english'
    });
    const fingerprintItem = report.items.find(i => i.id === 'prompt-fingerprint-recent-set-overlap');
    const recipeItem = report.items.find(i => i.id === 'arrangement-recipe-recent-set-overlap');
    expect(fingerprintItem?.status).toBe('not-measured');
    expect(recipeItem?.status).toBe('not-measured');
  });

  it('with clean fingerprint/recipe history (no overlap), both items pass', () => {
    const report = evaluateReleaseReadiness({
      songs: scoredSongs, conceptLabel: opts.customConcept || opts.projectTitle, songCount: opts.songCount, audienceProfile, lyricLanguage: 'english',
      duplicationHistory: { recentSituations: [], recentLyricLines: [], historicalTitles: new Set(), recentFingerprints: [], recentArrangementRecipes: [] }
    });
    const fingerprintItem = report.items.find(i => i.id === 'prompt-fingerprint-recent-set-overlap');
    const recipeItem = report.items.find(i => i.id === 'arrangement-recipe-recent-set-overlap');
    expect(fingerprintItem?.status).toBe('pass');
    expect(recipeItem?.status).toBe('pass');
  });

  it('a real fingerprint collision against recent history fails prompt-fingerprint-recent-set-overlap', () => {
    const collidingFingerprint = scoredSongs[0].promptFingerprint!;
    const report = evaluateReleaseReadiness({
      songs: scoredSongs, conceptLabel: opts.customConcept || opts.projectTitle, songCount: opts.songCount, audienceProfile, lyricLanguage: 'english',
      duplicationHistory: { recentSituations: [], recentLyricLines: [], historicalTitles: new Set(), recentFingerprints: [collidingFingerprint], recentArrangementRecipes: [] }
    });
    const item = report.items.find(i => i.id === 'prompt-fingerprint-recent-set-overlap');
    expect(item?.status).toBe('fail');
    expect(item?.detail).toContain('T1');
    expect(report.releaseReady).toBe(false);
  });

  it('a real arrangement-recipe collision against recent history fails arrangement-recipe-recent-set-overlap', () => {
    const collidingRecipe = scoredSongs[0].arrangementRecipe!;
    const report = evaluateReleaseReadiness({
      songs: scoredSongs, conceptLabel: opts.customConcept || opts.projectTitle, songCount: opts.songCount, audienceProfile, lyricLanguage: 'english',
      duplicationHistory: { recentSituations: [], recentLyricLines: [], historicalTitles: new Set(), recentFingerprints: [], recentArrangementRecipes: [collidingRecipe] }
    });
    const item = report.items.find(i => i.id === 'arrangement-recipe-recent-set-overlap');
    expect(item?.status).toBe('fail');
    expect(report.releaseReady).toBe(false);
  });
});

/**
 * v5.23 (TASK C §3-6) — "발매 가능 (탐색 3곡 포함)": a track that was told to
 * waive style-allocation rules (core/explorationSlots.ts) must not, by
 * itself, block the whole pack from release over exactly the deviation it
 * was asked to attempt. Verified with a real out-of-band BPM on one track —
 * the fullAudit.ts item this actually maps to (bpm_in_range) fails on the
 * unmodified pack and passes once that one track is named in
 * explorationTrackNos, while a genuinely unrelated track's own BPM issue
 * still fails normally.
 */
describe('[v5.23 TASK C §3-6] evaluateReleaseReadiness — exploration-slot style exemption', () => {
  const channel = channelPresets[0];
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
  const season = seasonPacks[0];
  const opts = makeOptions({ channel, songCount: 6, lyricLanguage: 'english' });
  const audienceProfile = audienceProfileForChannelArchetype(channel.archetype, channel.audience);

  function buildScoredSongsWithOutOfRangeTrack(trackNo: number) {
    const blueprint = generateLocalBlueprint(opts, genres, moods, season);
    const scored = scoreSongs(blueprint.songs, channel, 'english');
    return scored.map(song => song.trackNo === trackNo ? { ...song, bpm: audienceProfile.tempoCeiling + 40 } : song);
  }

  it('an out-of-range BPM on a real track fails bpm_in_range without any exemption', () => {
    const songs = buildScoredSongsWithOutOfRangeTrack(2);
    const report = evaluateReleaseReadiness({ songs, conceptLabel: opts.projectTitle, songCount: opts.songCount, audienceProfile, lyricLanguage: 'english' });
    const bpmItem = report.items.find(i => i.id === 'bpm_in_range');
    expect(bpmItem?.status).toBe('fail');
    expect(bpmItem?.exempted).toBeFalsy();
  });

  it('the SAME out-of-range track passes bpm_in_range once named in explorationTrackNos, and is marked exempted', () => {
    const songs = buildScoredSongsWithOutOfRangeTrack(2);
    const report = evaluateReleaseReadiness({
      songs, conceptLabel: opts.projectTitle, songCount: opts.songCount, audienceProfile, lyricLanguage: 'english', explorationTrackNos: [2]
    });
    const bpmItem = report.items.find(i => i.id === 'bpm_in_range');
    expect(bpmItem?.status).toBe('pass');
    expect(bpmItem?.exempted).toBe(true);
    expect(report.explorationExemptCount).toBe(1);
  });

  it('an out-of-range track NOT named in explorationTrackNos still fails — the exemption never blanket-covers the whole pack', () => {
    const songs = buildScoredSongsWithOutOfRangeTrack(2);
    const report = evaluateReleaseReadiness({
      songs, conceptLabel: opts.projectTitle, songCount: opts.songCount, audienceProfile, lyricLanguage: 'english', explorationTrackNos: [5]
    });
    const bpmItem = report.items.find(i => i.id === 'bpm_in_range');
    expect(bpmItem?.status).toBe('fail');
  });

  it('safety/quality items (never style-allocation) are unaffected by explorationTrackNos — never exempted', () => {
    const songs = buildScoredSongsWithOutOfRangeTrack(2);
    const report = evaluateReleaseReadiness({
      songs, conceptLabel: opts.projectTitle, songCount: opts.songCount, audienceProfile, lyricLanguage: 'english', explorationTrackNos: [2]
    });
    const grammarItem = report.items.find(i => i.id === 'english-grammar-errors');
    expect(grammarItem?.exempted).toBeFalsy();
  });
});
