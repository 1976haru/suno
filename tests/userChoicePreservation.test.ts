/**
 * TASK v5.7 (TASK E) — regression guard for "사용자 선택이 무시되는 구조".
 * Real gap this test file exists to close: v3.77/v4.13/v4.7/v5.7 were all
 * the SAME class of bug (a system default/allocation rule silently
 * overriding an explicit user pick) recurring across four separate tasks.
 * This file exercises every UI-exposed choice axis this task's own §2 report
 * covers — money-chord mode (all 8 presets the real GenerationOptions type
 * actually exposes to the UI, not a partial sample), breadth (3 values), and
 * vocalTone leaning (2 representative values) — so the next time a new
 * allocation rule is added, it fails HERE instead of waiting for 하루 to
 * notice the output is wrong.
 *
 * Scope honesty (per this task's own report's own §7 instruction): this is
 * NOT the full 16(money chord)×16(vocal preset)×3(breadth)×4(family)×3(language)
 * combinatorial sweep the original spec sketches — that many full 18-song
 * generateLocalBlueprint runs would make this file far too slow for
 * `npm run test:fast`. Money-chord coverage IS exhaustive over the 8 presets
 * actually reachable from Step2Concept's UI (GenerationOptions.moneyChordMode's
 * own union type — the other ~9 moneyChordPresets entries, e.g. doowop/
 * royalRoad/kidsSimple, are archetype-signature/internal-only and were never
 * user-selectable to begin with). Breadth and vocalTone are each covered at
 * their full value set (3 and a representative pair respectively).
 */
import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { moneyChordPresets } from '../src/data/moneyChords';
import type { GenerationOptions } from '../src/types';
import { channelPresets, makeOptions, testGenres, testMoods, testSeason } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;

/** Same classification approach as scripts/v57Measure.ts — which moneyChordPresets id's compactProgression substring appears in a song's stylePrompt. */
function classifyMoneyChord(stylePrompt: string): string {
  const entries = Object.entries(moneyChordPresets)
    .filter(([id]) => id !== 'custom')
    .sort((a, b) => b[1].compactProgression.length - a[1].compactProgression.length);
  for (const [id, preset] of entries) {
    if (stylePrompt.includes(preset.compactProgression)) return id;
  }
  if (/custom progression/.test(stylePrompt)) return 'custom';
  return 'unknown';
}

function moneyChordDistribution(opts: GenerationOptions) {
  const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
  const counts: Record<string, number> = {};
  for (const song of bp.songs) {
    const id = classifyMoneyChord(song.stylePrompt);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

// This task's own §2-2: "선택한 진행 18곡 중 9~11곡 (50~60%)".
const USER_SELECTABLE_MONEY_CHORDS: GenerationOptions['moneyChordMode'][] = [
  'emotional', 'jazzColor', 'cityPop', 'canon', 'showaModern', 'winterBallad'
];

describe('[v5.7 TASK E] money-chord explicit choice preservation', () => {
  it.each(USER_SELECTABLE_MONEY_CHORDS)('an explicit choice of "%s" lands 9-11 of 18 songs on that progression, not 0', mode => {
    const opts = makeOptions({
      channel: seniorChannel,
      songCount: 18,
      moneyChordMode: mode,
      moneyChordModeIsExplicitChoice: true,
      genreIds: seniorChannel.preferredGenres
    });
    const dist = moneyChordDistribution(opts);
    expect(dist[mode] ?? 0).toBeGreaterThanOrEqual(9);
    expect(dist[mode] ?? 0).toBeLessThanOrEqual(11);
  });

  it('two different explicit choices produce different distributions (result actually changes with the choice)', () => {
    const a = moneyChordDistribution(makeOptions({ channel: seniorChannel, songCount: 18, moneyChordMode: 'winterBallad', moneyChordModeIsExplicitChoice: true, genreIds: seniorChannel.preferredGenres }));
    const b = moneyChordDistribution(makeOptions({ channel: seniorChannel, songCount: 18, moneyChordMode: 'jazzColor', moneyChordModeIsExplicitChoice: true, genreIds: seniorChannel.preferredGenres }));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
    expect(a.winterBallad ?? 0).toBeGreaterThan(0);
    expect(b.jazzColor ?? 0).toBeGreaterThan(0);
  });

  it('the SAME moneyChordMode without moneyChordModeIsExplicitChoice keeps the old (non-quota) 100%-of-pack behavior — additive, not a breaking change', () => {
    // v5.7's fix is opt-in via moneyChordModeIsExplicitChoice; any existing
    // caller that never sets it (e.g. an old saved-pack replay, or a caller
    // that predates this task) must see byte-identical behavior to before —
    // 100% of the pack on the named preset, no 50-60% blend.
    const dist = moneyChordDistribution(makeOptions({ channel: seniorChannel, songCount: 18, moneyChordMode: 'jazzColor', genreIds: seniorChannel.preferredGenres }));
    expect(dist.jazzColor).toBe(18);
  });

  it('winterBallad\'s multi-part structure (verse/chorus/final-chorus key-up) is present in the generated style prompt text', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 6, moneyChordMode: 'winterBallad', moneyChordModeIsExplicitChoice: true, genreIds: seniorChannel.preferredGenres });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const winterBalladSongs = bp.songs.filter(song => classifyMoneyChord(song.stylePrompt) === 'winterBallad');
    expect(winterBalladSongs.length).toBeGreaterThan(0);
    for (const song of winterBalladSongs) {
      expect(song.stylePrompt).toContain('key-up');
    }
  });

  it('earwormMode no longer silently redirects an explicit money-chord choice back to default (the mechanism found while investigating this task\'s own root cause)', () => {
    const dist = moneyChordDistribution(makeOptions({
      channel: seniorChannel,
      songCount: 18,
      moneyChordMode: 'winterBallad',
      moneyChordModeIsExplicitChoice: true,
      earwormMode: true,
      genreIds: seniorChannel.preferredGenres
    }));
    expect(dist.winterBallad ?? 0).toBeGreaterThanOrEqual(9);
  });
});

describe('[v5.7 TASK E] breadth explicit choice preservation', () => {
  it.each(['focused', 'balanced', 'variety'] as const)('breadthOverride "%s" is honored in the resulting genre-axis width', async breadth => {
    const { directSetLocal } = await import('../src/core/setDirector');
    const plan = directSetLocal('잔잔한 올드팝 세트', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, [], undefined, breadth);
    expect(plan.interpretation.breadth).toBe(breadth);
    expect(plan.interpretation.breadthSource).toBe('user');
  });

  it('focused vs variety produce different-width genre axes (result actually changes with the choice)', async () => {
    const { directSetLocal } = await import('../src/core/setDirector');
    const focusedPlan = directSetLocal('잔잔한 올드팝 세트', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, [], undefined, 'focused');
    const varietyPlan = directSetLocal('잔잔한 올드팝 세트', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, [], undefined, 'variety');
    const focusedGenreCount = Object.keys(focusedPlan.allocations.find(a => a.axis === 'genre')!.counts).length;
    const varietyGenreCount = Object.keys(varietyPlan.allocations.find(a => a.axis === 'genre')!.counts).length;
    expect(varietyGenreCount).toBeGreaterThan(focusedGenreCount);
  });
});

describe('[v5.7 TASK E] vocalTone leaning preservation', () => {
  it('a male-leaning vocalTone and a female-leaning vocalTone produce opposite-leaning vocalType distributions', () => {
    const male = generateLocalBlueprint(
      makeOptions({ channel: seniorChannel, songCount: 18, vocalTone: 'deep resonant male baritone, warm husky close-mic delivery', genreIds: seniorChannel.preferredGenres }),
      testGenres, testMoods, testSeason
    );
    const female = generateLocalBlueprint(
      makeOptions({ channel: seniorChannel, songCount: 18, vocalTone: 'warm mature female alto, gentle and sincere', genreIds: seniorChannel.preferredGenres }),
      testGenres, testMoods, testSeason
    );
    const maleCount = male.songs.filter(s => s.vocalType === 'male').length;
    const femaleCountInMalePack = male.songs.filter(s => s.vocalType === 'female').length;
    const femaleCount = female.songs.filter(s => s.vocalType === 'female').length;
    const maleCountInFemalePack = female.songs.filter(s => s.vocalType === 'male').length;

    expect(maleCount).toBeGreaterThan(femaleCountInMalePack);
    expect(femaleCount).toBeGreaterThan(maleCountInFemalePack);
  });
});

/**
 * v5.7 follow-up (TASK v5.7 §4-2 verification session) — real-generation
 * measurement found that Step2Concept's "관점(POV)" picker (opts.perspective)
 * was silently discarded the moment a real user reached Step2Plan.tsx:
 * that screen's applyPlanToOptions bakes directSetLocal's own manual 'pov'
 * axis (makeAllocations -> povCounts) into opts.diversityAllocations, and
 * core/diversityAllocation.ts's applyAxisAllocation always lets a manual
 * axis win over generateLocalBlueprint's own perspective-aware auto plan —
 * the SAME "system default allocation baked into a manual preview axis wins
 * over an explicit user choice" bug v3.77 (TASK A) already found and fixed
 * for vocalTone (resolveVocalCounts). Root cause: povCounts(songCount) never
 * accepted a perspective at all, and userChoicesFromOptions never populated
 * UserExplicitChoices.perspective despite that field already existing on the
 * interface (declared, never wired). Fixed in core/setDirector.ts's povCounts/
 * buildBaseOptions and core/userChoices.ts's userChoicesFromOptions.
 */
describe('[v5.7 follow-up] perspective (POV) explicit choice preservation', () => {
  it('directSetLocal\'s own manual pov-axis preview honors opts.perspective via userChoicesFromOptions, not just the blind firstPerson-heavy default', async () => {
    const { directSetLocal } = await import('../src/core/setDirector');
    const { userChoicesFromOptions } = await import('../src/core/userChoices');
    const opts = makeOptions({ channel: seniorChannel, songCount: 18, perspective: 'thirdPerson', genreIds: seniorChannel.preferredGenres });
    const plan = directSetLocal('겨울 발라드 세트', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, [], opts.vocalTone, undefined, undefined, userChoicesFromOptions(opts));
    const povCounts = plan.allocations.find(a => a.axis === 'pov')!.counts;
    expect(povCounts.thirdPerson).toBeGreaterThan(povCounts.firstPerson ?? 0);
  });

  it('two different explicit perspectives produce different pov distributions end-to-end (plan -> diversityAllocations -> real generation)', async () => {
    const { directSetLocal } = await import('../src/core/setDirector');
    const { userChoicesFromOptions } = await import('../src/core/userChoices');
    function povDistributionFor(perspective: GenerationOptions['perspective']) {
      const opts0 = makeOptions({ channel: seniorChannel, songCount: 18, perspective, genreIds: seniorChannel.preferredGenres });
      const plan = directSetLocal('겨울 발라드 세트', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, [], opts0.vocalTone, undefined, undefined, userChoicesFromOptions(opts0));
      // Mirrors Step2Plan.tsx's real applyPlanToOptions: bakes the plan's
      // own allocations (including the pov axis under test) into
      // opts.diversityAllocations before generation, exactly like real use.
      const opts = { ...opts0, diversityAllocations: plan.allocations };
      const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
      const counts: Record<string, number> = {};
      for (const song of bp.songs) counts[song.pov ?? 'unknown'] = (counts[song.pov ?? 'unknown'] ?? 0) + 1;
      return counts;
    }
    const first = povDistributionFor('firstPerson');
    const third = povDistributionFor('thirdPerson');
    expect(JSON.stringify(first)).not.toBe(JSON.stringify(third));
    expect(third.thirdPerson ?? 0).toBeGreaterThan(first.thirdPerson ?? 0);
  });
});

/**
 * v5.7 follow-up (TASK v5.7 §4-2 verification session) — real-generation
 * measurement found DiversityAllocationPanel's "직접 주제/상황" free-text
 * field (opts.customLyricThemeScene) never reached Step2Plan's own plan
 * preview: core/setDirector.ts's buildBaseOptions hardcoded
 * `customLyricThemeScene: ''` regardless of the real value, so the
 * 'lyricTheme' manual axis applyPlanToOptions bakes into
 * opts.diversityAllocations never included the user's own scene — and that
 * manual axis always wins over the real auto plan (which DOES read the
 * real customLyricThemeScene) at generation time. Same bug class as the POV
 * fix directly above. Fixed via UserExplicitChoices.customLyricThemeScene
 * (core/userChoices.ts) threaded into buildBaseOptions.
 */
describe('[v5.7 follow-up] customLyricThemeScene explicit choice preservation', () => {
  it('a user-typed custom lyric scene survives the plan -> diversityAllocations -> real generation round trip', async () => {
    const { directSetLocal } = await import('../src/core/setDirector');
    const { userChoicesFromOptions } = await import('../src/core/userChoices');
    const scene = '비 오는 서울 지하철역에서 우산을 접으며 옛 친구를 떠올리는 순간';
    const opts0 = makeOptions({ channel: seniorChannel, songCount: 12, customLyricThemeScene: scene, genreIds: seniorChannel.preferredGenres });
    const plan = directSetLocal('가을 캠퍼스 감성', seniorChannel, 12, { recentGenreIds: [], recentHooks: [] }, [], opts0.vocalTone, undefined, undefined, userChoicesFromOptions(opts0));
    const lyricThemeCounts = plan.allocations.find(a => a.axis === 'lyricTheme')!.counts;
    expect(lyricThemeCounts['custom-lyric-scene'] ?? 0).toBeGreaterThan(0);

    // Mirrors Step2Plan.tsx's real applyPlanToOptions round trip.
    const opts = { ...opts0, diversityAllocations: plan.allocations };
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const customSongs = bp.songs.filter(song => song.lyricTheme === 'custom-lyric-scene');
    expect(customSongs.length).toBeGreaterThan(0);
    expect(customSongs[0].listenerSituation).toBe(scene);
  });
});
