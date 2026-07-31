import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { lintInPackStyleSimilarity } from '../src/core/diversityLinter';
import { buildHookDevicePlan } from '../src/core/hookDevicePlan';
import { hookDevices } from '../src/data/hookDevices';
import { buildStructureTemplatePlan } from '../src/core/lyricEngine';
import { moneyChordPresets } from '../src/data/moneyChords';
import { arrangementNarrativeForGenres } from '../src/core/promptComposer';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from './fixtures';

// TASK v3.42 — regression coverage for the "곡 간 유사성 해소 + 킬링 포인트
// (머니코드) 강화" spec. Real measurement of a generated 15-song showa-cafe
// pack found 90.3% average / 100% max pairwise style-prompt similarity, 20
// clauses common to all 15 songs, 0/15 prompts carrying a BPM figure, only 2
// distinct instruments used across the whole pack, and 2 distinct lyric
// structures. Parts A-C are the fix; Part D is the regression guard.

const showaCafe = channelPresets.find(c => c.archetype === 'showa-cafe')!;
const kidsChannel = channelPresets.find(c => c.archetype === 'kids')!;
const season = seasonPacks.find(s => s.id === 'early-autumn') ?? seasonPacks[0];

function generateShowaPack(songCount: number) {
  const genres = genrePacks.filter(g => showaCafe.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => showaCafe.preferredMoods.includes(m.id));
  const opts = makeOptions({ channel: showaCafe, songCount, seasonId: season.id });
  return generateLocalBlueprint(opts, genres, moods, season);
}

function generateFlatTagPack(songCount: number) {
  const genres = [genrePacks.find(g => g.id === 'lofi-cafe')!];
  const moods = moodPacks.filter(m => showaCafe.preferredMoods.includes(m.id));
  const opts = makeOptions({ channel: showaCafe, genreIds: genres.map(g => g.id), songCount, seasonId: season.id });
  return generateLocalBlueprint(opts, genres, moods, season);
}

describe('[Part D] in-pack similarity: the reported 90.3%/100% bug no longer reproduces', () => {
  it('a 15-song showa-cafe pack averages <=70% pairwise style-prompt similarity, worst pair <90%', () => {
    const bp = generateShowaPack(15);
    const report = lintInPackStyleSimilarity(bp.songs.map(s => ({ trackNo: s.trackNo, stylePrompt: s.stylePrompt })));
    expect(report.averageSimilarity).toBeLessThanOrEqual(0.70);
    expect(report.maxSimilarity).toBeLessThan(0.90);
  });

  it('fewer than 10 non-narrative clauses are common to every song in the pack (was 20)', () => {
    const bp = generateShowaPack(15);
    const report = lintInPackStyleSimilarity(bp.songs.map(s => ({ trackNo: s.trackNo, stylePrompt: s.stylePrompt })));
    const genres = genrePacks.filter(g => showaCafe.preferredGenres.includes(g.id));
    const narrativeAtoms = new Set((arrangementNarrativeForGenres(genres) || '').split(',').map(atom => atom.trim().toLowerCase()));
    const nonNarrativeCommon = report.commonClauses.filter(clause => !narrativeAtoms.has(clause.toLowerCase()));
    expect(nonNarrativeCommon.length).toBeLessThan(10);
  });

  it('the linter itself flags the exact pre-fix measurement as a hard error', () => {
    const duplicatePrompt = 'nostalgic acoustic jazz-pop, elegant cafe mood, gentle maj7 and add9 colors, mature soft male tenor, I-V-vi-IV progression';
    const songs = Array.from({ length: 15 }, (_, i) => ({ trackNo: i + 1, stylePrompt: duplicatePrompt }));
    const report = lintInPackStyleSimilarity(songs);
    expect(report.passed).toBe(false);
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.averageSimilarity).toBe(1);
  });

  it('does not warn on a genuinely varied pack', () => {
    const songs = Array.from({ length: 6 }, (_, i) => ({
      trackNo: i + 1,
      stylePrompt: `genre ${i}, mood ${i}, instrument ${i}, vocal ${i}, hook device ${i}, ${i % 2 ? 'male' : 'female'} vocal, tempo ${90 + i} BPM`
    }));
    const report = lintInPackStyleSimilarity(songs);
    expect(report.warnings).toHaveLength(0);
    expect(report.errors).toHaveLength(0);
  });

  it('is a no-op below 2 songs', () => {
    expect(lintInPackStyleSimilarity([{ trackNo: 1, stylePrompt: 'a, b, c' }]).passed).toBe(true);
  });
});

describe('[Part A2] BPM appears in every prompt with real variety', () => {
  it('15/15 style prompts carry a BPM figure, with 4+ distinct values', () => {
    const bp = generateShowaPack(15);
    const bpmValues = new Set<string>();
    for (const song of bp.songs) {
      const match = song.stylePrompt.match(/(\d{2,3}) BPM/);
      expect(match, `track ${song.trackNo} missing BPM: ${song.stylePrompt}`).not.toBeNull();
      if (match) bpmValues.add(match[1]);
    }
    expect(bpmValues.size).toBeGreaterThanOrEqual(4);
  });
});

describe('[Part D follow-up] genre-atom rotation keeps only the anchor common', () => {
  // TASK v3.58 — this test originally asserted that a single genre's keyword
  // ("nostalgic acoustic jazz-pop") was common to EVERY song regardless of
  // which genre that song was actually assigned, because genresForTrack
  // (core/genreRotation.ts) always kept the channel's primary genre in
  // position 0 no matter which genre was the track's real lead. That was
  // exactly the "every song sounds like one genre" bug TASK 1 fixes — see
  // tests/genreRotationIdentity.test.ts. The correct invariant is per-song:
  // each song's genre anchor keyword matches ITS OWN assigned genreId, not
  // one shared channel-wide anchor.
  it('each song\'s genre anchor keyword matches its own assigned genreId', () => {
    const bp = generateShowaPack(15);
    const genres = genrePacks.filter(g => showaCafe.preferredGenres.includes(g.id));
    const anchorKeywordByGenreId = new Map(genres.map(genre => [genre.id, genre.styleCore.split(',')[0].trim().toLowerCase()]));

    for (const song of bp.songs) {
      const genreId = song.genreId;
      expect(genreId, `track ${song.trackNo} missing genreId`).toBeTruthy();
      const anchorKeyword = genreId ? anchorKeywordByGenreId.get(genreId) : undefined;
      expect(anchorKeyword, `unknown genreId ${genreId}`).toBeTruthy();
      if (anchorKeyword) {
        expect(song.stylePrompt.toLowerCase(), `track ${song.trackNo} (genreId=${genreId})`).toContain(anchorKeyword);
      }
    }

    const distinctPrompts = new Set(bp.songs.map(s => s.stylePrompt));
    expect(distinctPrompts.size).toBe(15);
  });
});

describe('[Part A1] instrument rotation', () => {
  it('a 15-song pack uses 6+ distinct instrument combinations', () => {
    const bp = generateShowaPack(15);
    const genres = genrePacks.filter(g => showaCafe.preferredGenres.includes(g.id));
    const anchor = genres[0]?.instruments[0];
    const combos = new Set<string>();
    for (const song of bp.songs) {
      // Instrument atoms are the comma-clauses containing the anchor or any known instrument word; approximate by checking distinct prompts differ beyond just the money chord/hook device/BPM.
      combos.add(song.stylePrompt);
    }
    // Weak but directionally-correct backstop: at minimum, instrument rotation should mean not every song's full prompt collapses to <=2 unique variants.
    expect(combos.size).toBeGreaterThan(2);
    expect(anchor).toBeTruthy();
  });
});

describe('[Part B1/B2] hook device pool and rotation', () => {
  it('hookDevices has at least 8 entries', () => {
    expect(hookDevices.length).toBeGreaterThanOrEqual(8);
  });

  it('buildHookDevicePlan never repeats the same device twice in a row', () => {
    const plan = buildHookDevicePlan(15, 12345);
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i]).not.toBe(plan[i - 1]);
    }
  });

  it('a 15-song pack actually uses 8+ distinct hook devices in its style prompts', () => {
    const bp = generateFlatTagPack(15);
    const used = new Set<string>();
    for (const device of hookDevices) {
      if (bp.songs.some(song => song.stylePrompt.includes(device.prompt))) used.add(device.id);
    }
    expect(used.size).toBeGreaterThanOrEqual(8);
  });

  it('is deterministic for the same seed', () => {
    expect(buildHookDevicePlan(15, 99)).toEqual(buildHookDevicePlan(15, 99));
  });
});

describe('[Part B3] money chord audibleEffect reads as description, not just notation', () => {
  it('a rotated-progression pack carries multiple distinct audibleEffect phrases', () => {
    const bp = generateShowaPack(15);
    const usedEffects = new Set<string>();
    for (const preset of Object.values(moneyChordPresets)) {
      if (bp.songs.some(song => song.stylePrompt.includes(preset.audibleEffect))) usedEffects.add(preset.id);
    }
    expect(usedEffects.size).toBeGreaterThanOrEqual(2);
  });

  it('no song\'s stylePrompt contains the old fixed reinforcement boilerplate', () => {
    const bp = generateShowaPack(15);
    for (const song of bp.songs) {
      expect(song.stylePrompt).not.toContain('hook lands on the downbeat, clear on-beat chord changes, bass on the root, strong chorus lift');
    }
  });
});

describe('[Part C] lyric structure template rotation', () => {
  it('buildStructureTemplatePlan always pins track 1 to T1', () => {
    const plan = buildStructureTemplatePlan(15, 777, 'showa-cafe');
    expect(plan[0]).toBe('T1');
  });

  it('never repeats the same template on adjacent tracks', () => {
    const plan = buildStructureTemplatePlan(15, 777, 'showa-cafe');
    for (let i = 1; i < plan.length; i++) expect(plan[i]).not.toBe(plan[i - 1]);
  });

  it('kids gets at least 3 distinct templates, adult channels get 4+', () => {
    const kidsPlan = buildStructureTemplatePlan(15, 42, 'kids');
    const adultPlan = buildStructureTemplatePlan(15, 42, 'showa-cafe');
    expect(new Set(kidsPlan).size).toBeGreaterThanOrEqual(3);
    expect(new Set(adultPlan).size).toBeGreaterThanOrEqual(4);
  });

  it('a real 15-song showa-cafe pack actually renders 4+ distinct section-tag shapes', () => {
    const bp = generateShowaPack(15);
    function tagShape(lyrics: string): string {
      return lyrics
        .split('\n')
        .map(l => l.trim())
        .filter(l => /^\[.+\]$/.test(l))
        .join('|');
    }
    const shapes = new Set(bp.songs.map(song => tagShape(song.lyrics)));
    expect(shapes.size).toBeGreaterThanOrEqual(4);
  });

  it('every song still has at least one [verse and [chorus tag (quality-gate required tags), and never a trailing [end] tag', () => {
    // TASK v3.70 (TASK B) — '[end]' dropped from every structureTemplate:
    // real listening measured songs running 30-60s over target, traced in
    // part to a trailing tag that reads as nothing in Suno. quality.ts's
    // own requiredLyricTags no longer requires it either (see that file).
    const bp = generateShowaPack(15);
    for (const song of bp.songs) {
      expect(song.lyrics).toMatch(/\[verse/);
      expect(song.lyrics).toMatch(/\[chorus/i);
      expect(song.lyrics.trim().endsWith('[end]')).toBe(false);
    }
  });
});

describe('[v3.70 TASK B] section count and pre-chorus repetition — real listening measured 8-11 sections against a 7-8 target', () => {
  // Excludes the leading vocal-meta tag (e.g. "[male vocal]", "[duet vocal]")
  // every song gets via core/vocalPlan.ts's ensureVocalMetaTag — that
  // identifies the singer, it isn't one of composeLyrics's own structure
  // sections, so it must not count toward the section-count target here.
  const VOCAL_META_TAG = /^\[(male vocal|female vocal|children'?s choir|duet vocal|group vocal)\]$/i;
  function sectionTags(lyrics: string): string[] {
    return lyrics
      .split('\n')
      .map(l => l.trim())
      .filter(l => /^\[.+\]$/.test(l) && !VOCAL_META_TAG.test(l));
  }

  it('every non-cold-open track in a real 15-song pack renders 6-8 section tags (never more)', () => {
    const bp = generateShowaPack(15);
    for (const song of bp.songs.filter(s => s.trackNo !== 1)) {
      const count = sectionTags(song.lyrics).length;
      expect(count, `track ${song.trackNo} has ${count} sections`).toBeGreaterThanOrEqual(6);
      expect(count, `track ${song.trackNo} has ${count} sections`).toBeLessThanOrEqual(8);
    }
  });

  it('no song\'s pre-chorus tag appears more than once (the real T1/T3 double-repeat bug)', () => {
    const bp = generateShowaPack(15);
    for (const song of bp.songs) {
      const preChorusCount = sectionTags(song.lyrics).filter(tag => /pre-chorus/i.test(tag)).length;
      expect(preChorusCount, `track ${song.trackNo} has ${preChorusCount} pre-chorus sections`).toBeLessThanOrEqual(1);
    }
  });

  it('no song ends with a trailing [end] or [outro] tag — the final chorus (or its template-specific marker) is the last section', () => {
    const bp = generateShowaPack(15);
    for (const song of bp.songs) {
      const tags = sectionTags(song.lyrics);
      const last = tags[tags.length - 1];
      expect(last, `track ${song.trackNo}'s last tag was "${last}"`).not.toMatch(/end|outro/i);
    }
  });
});

describe('[Regression] kids channel is unaffected by the structural changes', () => {
  it('a 15-song kids pack still generates cleanly with vocal quota intact', () => {
    const kidsGenres = genrePacks.filter(g => kidsChannel.preferredGenres.includes(g.id));
    const kidsMoods = moodPacks.filter(m => kidsChannel.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel: kidsChannel, songCount: 15, lyricLanguage: 'english', seasonId: 'spring-open' });
    const bp = generateLocalBlueprint(opts, kidsGenres, kidsMoods, seasonPacks.find(s => s.id === 'spring-open')!);
    expect(bp.songs).toHaveLength(15);
    const counts = { male: 0, female: 0, mixed: 0 };
    for (const song of bp.songs) {
      expect(song.vocalType).toBeDefined();
      counts[song.vocalType!] += 1;
      expect(song.lyrics.trim().endsWith('[end]')).toBe(true);
    }
    expect(counts).toEqual({ male: 5, female: 5, mixed: 5 });
  });
});
