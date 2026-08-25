import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { preallocateSongSlots, reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import { migratePackSongIds } from '../src/core/library';
import { attributesFromSong, exportRatingsToJson, type RatingRecord, type SongRating } from '../src/core/ratingLedger';
import { analyzeRatings, confidenceForSampleSize } from '../src/core/ratingAnalysis';
import { assignKillingPoints, killingPointBoostFromInsights } from '../src/data/killingPoints';
import { buildArcPlan } from '../src/core/arcPlan';
import { directSetLocal, type RatingInsightLike } from '../src/core/setDirector';
import { makeOptions, testGenres, testMoods, testSeason, channelPresets } from './fixtures';
import type { SavedPack, SongIdea } from '../src/types';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;

/**
 * v3.68 — "청취 평가 루프: 좋았던 곡을 앱이 기억하게". TASK A: songId.
 */

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Song',
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: 'Hold On',
    stylePrompt: 'warm pop, soft vocal',
    lyrics: '[verse 1]\nline one\nline two\n[chorus]\nHold On\nHold On\n[end]',
    youtube: { title: 'yt', description: 'desc', tags: ['tag'] },
    qualityScore: 0,
    warnings: [],
    // v5.11 (TASK L) — genuine defaults for the new always-populated fields.
    effectiveMoneyChordId: 'default',
    effectiveGenreIds: [],
    effectiveArchetype: 'senior-morning',
    workspaceId: 'senior-oldpop',
    ...overrides
  };
}

describe('[v3.68 TASK A] songId', () => {
  it('generateLocalBlueprint assigns a unique songId to every track', () => {
    const opts = makeOptions({ songCount: 18 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const ids = blueprint.songs.map(s => s.songId);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(18);
  });

  it('reconcileWithPreassignedSlot assigns a songId when the incoming song has none', () => {
    const opts = makeOptions({ songCount: 2 });
    const [slot] = preallocateSongSlots(opts, testGenres);
    const raw = baseSong({ trackNo: slot.trackNo });
    const fixed = reconcileWithPreassignedSlot(raw, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.songId).toBeTruthy();
  });

  it('reconcileWithPreassignedSlot never overwrites an existing songId', () => {
    const opts = makeOptions({ songCount: 2 });
    const [slot] = preallocateSongSlots(opts, testGenres);
    const raw = baseSong({ trackNo: slot.trackNo, songId: 'keep-me' });
    const fixed = reconcileWithPreassignedSlot(raw, slot, 'ai-creative', { keepHook: true, keepEmotionArc: true });
    expect(fixed.songId).toBe('keep-me');
  });

  it('trackNo is untouched — still 1-based, still used for display/sort', () => {
    const opts = makeOptions({ songCount: 5 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    expect(blueprint.songs.map(s => s.trackNo)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('[v3.68 TASK A] migratePackSongIds', () => {
  function fakePack(songs: SongIdea[]): SavedPack {
    return {
      id: 'pack-1',
      name: 'Test',
      savedAt: new Date().toISOString(),
      isAutosave: false,
      channelId: 'senior-morning',
      channelName: 'Test Channel',
      projectTitle: 'Test Pack',
      songCount: songs.length,
      avgQualityScore: 0,
      blueprint: {
        projectTitle: 'Test Pack',
        channelName: 'Test Channel',
        oneLineConcept: '',
        sonicSignature: '',
        vocalSignature: '',
        lyricRules: [],
        harmonyRules: [],
        visualRules: [],
        songs
      },
      options: makeOptions({ songCount: songs.length })
    };
  }

  it('assigns a songId to every song that lacks one', () => {
    const pack = fakePack([baseSong({ trackNo: 1 }), baseSong({ trackNo: 2 })]);
    const { pack: migrated, migrated: didMigrate } = migratePackSongIds(pack);
    expect(didMigrate).toBe(true);
    expect(migrated.blueprint.songs.every(s => s.songId)).toBe(true);
    expect(new Set(migrated.blueprint.songs.map(s => s.songId)).size).toBe(2);
  });

  it('is a no-op (migrated: false, same object) when every song already has a songId', () => {
    const pack = fakePack([baseSong({ trackNo: 1, songId: 'a' }), baseSong({ trackNo: 2, songId: 'b' })]);
    const { pack: result, migrated: didMigrate } = migratePackSongIds(pack);
    expect(didMigrate).toBe(false);
    expect(result).toBe(pack);
  });

  it('never reassigns an existing songId, only fills in missing ones', () => {
    const pack = fakePack([baseSong({ trackNo: 1, songId: 'keep-me' }), baseSong({ trackNo: 2 })]);
    const { pack: migrated } = migratePackSongIds(pack);
    expect(migrated.blueprint.songs[0].songId).toBe('keep-me');
    expect(migrated.blueprint.songs[1].songId).toBeTruthy();
  });
});

describe('[v3.68 TASK B] attributesFromSong', () => {
  it('reads all snapshot fields off a fully-populated song', () => {
    const opts = makeOptions({ songCount: 18, earwormMode: true });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const song = blueprint.songs.find(s => s.killingPointId) ?? blueprint.songs[0];
    const attrs = attributesFromSong(song, opts.channel.id);
    expect(attrs.genreId).toBe(song.genreId);
    expect(attrs.bpm).toBe(song.bpm);
    expect(attrs.vocalType).toBeTruthy();
    expect(attrs.arcPhase).toBe(song.arcPhase);
    expect(attrs.intensity).toBe(song.intensity);
    expect(attrs.channelId).toBe(opts.channel.id);
  });

  it('segmentLabel is always undefined — never fabricated (v3.63 segment identity does not survive into the song pipeline)', () => {
    const opts = makeOptions({ songCount: 3 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    for (const song of blueprint.songs) {
      expect(attributesFromSong(song, opts.channel.id).segmentLabel).toBeUndefined();
    }
  });

  it('falls back to "unknown" rather than throwing for a song missing genreId/vocalType', () => {
    const bareSong = baseSong({ trackNo: 1 });
    const attrs = attributesFromSong(bareSong, 'test-channel');
    expect(attrs.genreId).toBe('unknown');
    expect(attrs.vocalType).toBe('unknown');
    expect(attrs.bpm).toBe(0);
  });
});

describe('[v3.68 TASK B] exportRatingsToJson', () => {
  it('round-trips a list of rating records through JSON', () => {
    const records: RatingRecord[] = [{
      songId: 's1',
      packId: 'p1',
      rating: 'good',
      ratedAt: new Date().toISOString(),
      attributes: { genreId: 'jazz-pop', bpm: 96, vocalType: 'male', channelId: 'c1' }
    }];
    const json = exportRatingsToJson(records);
    expect(JSON.parse(json)).toEqual(records);
  });
});

describe('[v3.68 TASK D] confidenceForSampleSize — the sampleSize -> confidence classification table', () => {
  it.each([
    [0, 'insufficient'], [1, 'insufficient'], [4, 'insufficient'],
    [5, 'weak'], [8, 'weak'], [11, 'weak'],
    [12, 'moderate'], [20, 'moderate'], [29, 'moderate'],
    [30, 'strong'], [100, 'strong']
  ] as [number, string][])('n=%i -> %s', (n, expected) => {
    expect(confidenceForSampleSize(n)).toBe(expected);
  });
});

describe('[v3.68 TASK D] analyzeRatings — 60 dummy ratings', () => {
  let counter = 0;
  function makeRating(rating: SongRating, attrs: Partial<RatingRecord['attributes']>): RatingRecord {
    counter += 1;
    return {
      songId: `song-${counter}`,
      packId: 'pack-1',
      rating,
      ratedAt: new Date(2026, 0, 1, 0, counter).toISOString(),
      attributes: {
        genreId: 'acoustic-pop',
        bpm: 90,
        vocalType: 'male',
        channelId: 'senior-morning',
        ...attrs
      }
    };
  }

  function buildDummyRatings(): RatingRecord[] {
    const records: RatingRecord[] = [];
    // KP-01: n=12 (8 good / 3 ok / 1 bad) — deliberately in the 12-29 "moderate" band, not "strong".
    for (let k = 0; k < 8; k++) records.push(makeRating('good', { killingPointId: 'KP-01', genreId: 'oldpop-soft-rock-am', vocalType: 'male', bpm: 96 }));
    for (let k = 0; k < 3; k++) records.push(makeRating('ok', { killingPointId: 'KP-01', genreId: 'oldpop-soft-rock-am', vocalType: 'male', bpm: 96 }));
    for (let k = 0; k < 1; k++) records.push(makeRating('bad', { killingPointId: 'KP-01', genreId: 'oldpop-soft-rock-am', vocalType: 'male', bpm: 96 }));
    // KP-04: n=16, mostly bad — a real negative signal, still only "moderate".
    for (let k = 0; k < 2; k++) records.push(makeRating('good', { killingPointId: 'KP-04', genreId: 'chanson', vocalType: 'female', bpm: 72 }));
    for (let k = 0; k < 4; k++) records.push(makeRating('ok', { killingPointId: 'KP-04', genreId: 'chanson', vocalType: 'female', bpm: 72 }));
    for (let k = 0; k < 10; k++) records.push(makeRating('bad', { killingPointId: 'KP-04', genreId: 'chanson', vocalType: 'female', bpm: 72 }));
    // KP-02: n=3 — must come back "insufficient", never treated as a real pattern.
    for (let k = 0; k < 2; k++) records.push(makeRating('good', { killingPointId: 'KP-02', genreId: 'europop', vocalType: 'mixed', bpm: 100 }));
    for (let k = 0; k < 1; k++) records.push(makeRating('ok', { killingPointId: 'KP-02', genreId: 'europop', vocalType: 'mixed', bpm: 100 }));
    // jazz-pop x female: n=22 — a combination that SHOULD be reported (>=20).
    for (let k = 0; k < 15; k++) records.push(makeRating('good', { genreId: 'jazz-pop', vocalType: 'female', bpm: 84 }));
    for (let k = 0; k < 7; k++) records.push(makeRating('ok', { genreId: 'jazz-pop', vocalType: 'female', bpm: 84 }));
    // jazz-pop x male: n=7 — a combination that must NOT be reported (<20).
    for (let k = 0; k < 7; k++) records.push(makeRating('good', { genreId: 'jazz-pop', vocalType: 'male', bpm: 100 }));
    return records;
  }

  const dummyRatings = buildDummyRatings();

  it('has exactly 60 dummy ratings', () => {
    expect(dummyRatings).toHaveLength(60);
  });

  it('KP-02 (n=3) is reported with confidence "insufficient"', () => {
    const insights = analyzeRatings(dummyRatings);
    const kp02 = insights.find(i => i.attribute === 'killingPointId' && i.value === 'KP-02');
    expect(kp02?.sampleSize).toBe(3);
    expect(kp02?.confidence).toBe('insufficient');
  });

  it('KP-01 (n=12) and KP-04 (n=16) are both reported with confidence "moderate", not "strong"', () => {
    const insights = analyzeRatings(dummyRatings);
    const kp01 = insights.find(i => i.attribute === 'killingPointId' && i.value === 'KP-01');
    const kp04 = insights.find(i => i.attribute === 'killingPointId' && i.value === 'KP-04');
    expect(kp01?.sampleSize).toBe(12);
    expect(kp01?.confidence).toBe('moderate');
    expect(kp04?.sampleSize).toBe(16);
    expect(kp04?.confidence).toBe('moderate');
  });

  it('KP-01 has a positive lift (good-heavy) and KP-04 has a negative lift (bad-heavy)', () => {
    const insights = analyzeRatings(dummyRatings);
    const kp01 = insights.find(i => i.attribute === 'killingPointId' && i.value === 'KP-01')!;
    const kp04 = insights.find(i => i.attribute === 'killingPointId' && i.value === 'KP-04')!;
    expect(kp01.lift).toBeGreaterThan(0);
    expect(kp04.lift).toBeLessThan(0);
  });

  it('the genreId+vocalType combination is reported for jazz-pop+female (n=22, >=20) but suppressed for jazz-pop+male (n=7, <20)', () => {
    const insights = analyzeRatings(dummyRatings);
    const combos = insights.filter(i => i.attribute === 'genreId+vocalType');
    const jazzFemale = combos.find(i => i.value === 'jazz-pop+female');
    const jazzMale = combos.find(i => i.value === 'jazz-pop+male');
    expect(jazzFemale?.sampleSize).toBe(22);
    expect(jazzMale).toBeUndefined();
  });

  it('no combination insight is ever reported below sampleSize 20', () => {
    const insights = analyzeRatings(dummyRatings);
    const combos = insights.filter(i => i.attribute.includes('+'));
    for (const combo of combos) expect(combo.sampleSize).toBeGreaterThanOrEqual(20);
  });

  it('single-attribute insights are still reported even for the smallest samples (never silently hidden, only labeled)', () => {
    const insights = analyzeRatings(dummyRatings);
    const single = insights.filter(i => !i.attribute.includes('+'));
    expect(single.some(i => i.confidence === 'insufficient')).toBe(true);
  });

  it('scoping by channelId excludes ratings from other channels', () => {
    const mixed = [...dummyRatings, makeRating('good', { channelId: 'other-channel', killingPointId: 'KP-99' })];
    const insights = analyzeRatings(mixed, { channelId: 'senior-morning' });
    expect(insights.some(i => i.value === 'KP-99')).toBe(false);
  });

  it('returns an empty array for an empty rating list (never throws, never fabricates)', () => {
    expect(analyzeRatings([])).toEqual([]);
  });
});

describe('[v3.68 TASK E] killingPointBoostFromInsights + assignKillingPoints influence cap', () => {
  it('ignores non-strong insights entirely, regardless of lift', () => {
    const boost = killingPointBoostFromInsights([
      { attribute: 'killingPointId', value: 'KP-01', lift: 0.9, confidence: 'moderate' },
      { attribute: 'killingPointId', value: 'KP-02', lift: -0.9, confidence: 'weak' },
      { attribute: 'killingPointId', value: 'KP-03', lift: 0.9, confidence: 'insufficient' }
    ]);
    expect(boost).toEqual({});
  });

  it('ignores strong insights for other attributes (only killingPointId ever produces a boost)', () => {
    const boost = killingPointBoostFromInsights([
      { attribute: 'genreId', value: 'jazz-pop', lift: 0.9, confidence: 'strong' }
    ]);
    expect(boost).toEqual({});
  });

  it('caps a strong positive-lift boost at 2x and a strong negative-lift boost at a 0.5x floor (never 0)', () => {
    const boost = killingPointBoostFromInsights([
      { attribute: 'killingPointId', value: 'KP-01', lift: 5, confidence: 'strong' },
      { attribute: 'killingPointId', value: 'KP-04', lift: -5, confidence: 'strong' }
    ]);
    expect(boost['KP-01']).toBe(2);
    expect(boost['KP-04']).toBe(0.5);
    expect(boost['KP-04']).toBeGreaterThan(0);
  });

  // TASK v5.21 (TASK C-3) — MAX_SONGS_PER_KILLING_POINT raised 3 -> 4; an
  // extreme rating-based boost here also multiplies against KP-01's own
  // always-applied STRUCTURAL_BIAS (0.6) rather than replacing it (see
  // data/killingPoints.ts's own assignKillingPoints doc comment) — still
  // overwhelmingly dominant at boost=1000, so KP-01 still hits the (now
  // higher) cap exactly.
  it('an extreme boost still never pushes one killing point past MAX_SONGS_PER_KILLING_POINT (well under any 50% share of an 18-song pack)', () => {
    const arc = buildArcPlan(18);
    const inputs = arc.map(pos => ({ peakStrength: pos.peakStrength, eraTag: '1970s AM-gold soft rock' }));
    const extremeBoost = { 'KP-01': 1000 };
    const assigned = assignKillingPoints(inputs, 3, extremeBoost);
    const usage = new Map<string, number>();
    for (const kp of assigned) { if (kp) usage.set(kp.id, (usage.get(kp.id) ?? 0) + 1); }
    const eligibleCount = arc.filter(p => p.peakStrength !== 'none').length;
    expect(usage.get('KP-01')).toBeLessThanOrEqual(4);
    expect((usage.get('KP-01') ?? 0) / eligibleCount).toBeLessThan(0.5);
  });

  it('a down-weighted killing point is still reachable (never literally excluded from the candidate pool)', () => {
    const arc = buildArcPlan(18);
    const inputs = arc.map(pos => ({ peakStrength: pos.peakStrength }));
    // Down-weight every other killing point, leaving KP-01 the only realistic pick.
    const boost = Object.fromEntries(['KP-02', 'KP-03', 'KP-04', 'KP-05', 'KP-06', 'KP-07', 'KP-08', 'KP-09', 'KP-10', 'KP-11', 'KP-12'].map(id => [id, 0.5]));
    const assigned = assignKillingPoints(inputs, 5, boost);
    expect(assigned.filter(Boolean).length).toBeGreaterThan(0);
  });

  it('no boost (default) reproduces the exact same assignment as v3.67 (backward compatible)', () => {
    const arc = buildArcPlan(18);
    const inputs = arc.map(pos => ({ peakStrength: pos.peakStrength, eraTag: '1970s AM-gold soft rock' }));
    const withoutBoostArg = assignKillingPoints(inputs, 7);
    const withEmptyBoost = assignKillingPoints(inputs, 7, {});
    expect(withoutBoostArg.map(kp => kp?.id)).toEqual(withEmptyBoost.map(kp => kp?.id));
  });
});

describe('[v3.68 TASK E] SetDirector — history.insights wiring and the Step2.5 banner', () => {
  it('directSetLocal produces no appliedInsightsKo lines when history.insights is absent (the "반영 끄기" state)', () => {
    const plan = directSetLocal('비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    expect(plan.appliedInsightsKo).toEqual([]);
  });

  it('directSetLocal reports a positive-lift strong insight as an applied banner line, with a real per-plan count', () => {
    const strongGoodInsight: RatingInsightLike = {
      attribute: 'killingPointId', value: 'KP-01', labelKo: '마지막 후렴 반음 전조',
      good: 20, ok: 5, bad: 2, sampleSize: 27, lift: 0.4, confidence: 'strong'
    };
    const plan = directSetLocal('비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [], insights: [strongGoodInsight] });
    expect(plan.appliedInsightsKo.length).toBe(1);
    expect(plan.appliedInsightsKo[0]).toContain('반응이 좋아');
    expect(plan.appliedInsightsKo[0]).toMatch(/\d+곡/);
  });

  it('a moderate-confidence insight (not strong) produces no banner line at all', () => {
    const moderateInsight: RatingInsightLike = {
      attribute: 'killingPointId', value: 'KP-01', labelKo: '마지막 후렴 반음 전조',
      good: 8, ok: 3, bad: 1, sampleSize: 12, lift: 0.4, confidence: 'moderate'
    };
    const plan = directSetLocal('비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [], insights: [moderateInsight] });
    expect(plan.appliedInsightsKo).toEqual([]);
  });
});
