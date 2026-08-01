import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { lintInPackStyleSimilarity } from '../src/core/diversityLinter';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import { vocalPresets } from '../src/data/vocalPresets';

// v3.77 (TASK A) supersedes the TASK v3.72 comment this used to have: an
// explicit vocalTone different from the channel's defaultVocal no longer
// turns usesVocalQuota() off (that was itself the bug — a whole pack copying
// one fixed phrase verbatim, zero vocal variety). It now LEANS the quota
// toward this preset's gender instead (core/vocalPlan.ts's
// leaningAdultVocalQuota) — "channel vocal identity" below means the
// requested gender is the clear majority, not a literal string on every
// track.
const SOLO_VOCAL_TONE = vocalPresets.find(p => p.id === 'low-calm-male')!.prompt;

describe('v3.52 concept and vocal diversity', () => {
  it('injects four mapped concepts into both style prompts and lyric imagery', () => {
    const cases = [
      ['아침 카페', 'morning light'],
      ['비 오는 밤', 'rain on window'],
      ['도시의 불빛', 'city neon'],
      ['청춘과 꿈', 'open road']
    ] as const;

    for (const [concept, styleAtom] of cases) {
      // v4.2 (TASK A3) — songCount:1 checking only song[0]'s lyrics used to
      // be reliable because the concept-image draw's own seed
      // (lyricEngine.ts's composeLyrics: motifRng = mulberry32(hashSeed(
      // `${title}::${hook}::motif-budget`))) is derived from the exact
      // title string. TASK C changed what titleFromHook produces (data-
      // driven pattern selection replacing the old fixed-probability
      // cascade — see data/titlePatterns.ts), which legitimately shifts
      // that per-song draw for any single fixed seed. Checking across a
      // few songs (any one hitting the concept image) keeps this a real
      // regression guard on "the concept reaches lyrics at all" without
      // being coupled to one exact title string.
      const blueprint = generateLocalBlueprint(
        makeOptions({ songCount: 6, customConcept: concept }),
        testGenres,
        testMoods,
        testSeason
      );
      expect(blueprint.songs[0].stylePrompt.toLowerCase()).toContain(styleAtom);
      const styleWord = styleAtom.split(' ')[0];
      expect(blueprint.songs.some(song => song.lyrics.toLowerCase().includes(styleWord))).toBe(true);
    }
  });

  it('varies style-prompt starts across an 18-song pack while leaning channel vocal identity toward the requested gender', () => {
    const blueprint = generateLocalBlueprint(makeOptions({ songCount: 18, customConcept: '아침 카페', vocalTone: SOLO_VOCAL_TONE }), testGenres, testMoods, testSeason);
    const starts = new Set(blueprint.songs.map(song => song.stylePrompt.split(',').slice(0, 2).join(',').toLowerCase()));
    const report = lintInPackStyleSimilarity(blueprint.songs.map(song => ({ trackNo: song.trackNo, stylePrompt: song.stylePrompt })));
    expect(starts.size).toBeGreaterThanOrEqual(3);
    const counts = { male: 0, female: 0, mixed: 0 };
    for (const song of blueprint.songs) {
      expect(song.vocalType, `trackNo ${song.trackNo}`).toBeDefined();
      counts[song.vocalType!] += 1;
    }
    expect(counts.male).toBeGreaterThan(counts.female);
    expect(counts.male).toBeGreaterThan(counts.mixed);
    expect(report.averageSimilarity).toBeLessThan(0.4);
  });

  it('keeps different genre signatures distinct in the generated style prompts', () => {
    const prompts = testGenres.map(genre => {
      const blueprint = generateLocalBlueprint(
        makeOptions({ songCount: 1, genreIds: [genre.id], customConcept: '도시의 불빛' }),
        [genre],
        testMoods,
        testSeason
      );
      return blueprint.songs[0].stylePrompt;
    });
    const report = lintInPackStyleSimilarity(prompts.map((stylePrompt, index) => ({ trackNo: index + 1, stylePrompt })));
    // TASK v3.61 — testGenres now tracks channelPresets[0].preferredGenres,
    // which grew from 3 to 15 ids (see presets.ts's own comment on that
    // expansion); the actual invariant this test cares about is "every
    // genre in the pool produces a genuinely distinct style prompt", not a
    // specific hardcoded pool size.
    expect(new Set(prompts).size).toBe(testGenres.length);
    expect(report.averageSimilarity).toBeLessThan(0.35);
  });

  it('reports repeated vocal openings separately from musical similarity', () => {
    const report = lintInPackStyleSimilarity([
      { trackNo: 1, stylePrompt: 'acoustic pop, mature male vocal, piano-led opening' },
      { trackNo: 2, stylePrompt: 'jazz pop, mature male vocal, brushed trio' },
      { trackNo: 3, stylePrompt: 'soft rock, mature male vocal, guitar lift' }
    ]);
    expect(report.repeatedVocalStarts[0]?.count).toBe(3);
    expect(report.warnings.some(warning => warning.includes('Vocal description starts'))).toBe(true);
  });
});
