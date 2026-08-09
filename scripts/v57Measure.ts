/**
 * TASK v5.7 (Fable 5) — real local-generation measurement for the
 * "사용자 선택이 무시되는 구조" fix. Follows scripts/v56Measure.ts's own
 * pattern (directSetLocal -> generateLocalBlueprint, the real offline
 * pipeline this app's own audits already trust). Report-only — writes JSON
 * to stdout, never touches production code/data.
 *
 * Usage: npx tsx scripts/v57Measure.ts > v57-measure-out.json
 */
import { directSetLocal, resolveMainFamilyId } from '../src/core/setDirector';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { getGenreById } from '../src/data/genreLibrary';
import { channelPresets } from '../src/data/presets';
import { moneyChordPresets, resolveEarwormMoneyChordMode } from '../src/data/moneyChords';
import { userChoicesFromOptions } from '../src/core/userChoices';
import { assertUserChoicesPreserved } from '../src/core/userChoices';
import type { ChannelProfile, GenerationOptions } from '../src/types';

const SENIOR_MORNING = channelPresets.find(c => c.archetype === 'senior-morning')!;
const SEASON = { id: 'spring-open', label: 'Spring Opening', period: 'March', keywords: ['spring'], visualDirection: '' };

function generatePack(
  concept: string,
  channel: ChannelProfile,
  songCount: number,
  extra: Partial<GenerationOptions> = {}
) {
  const opts0: GenerationOptions = {
    channel,
    projectTitle: concept,
    songCount,
    lyricLanguage: channel.primaryLanguage,
    market: channel.market,
    audience: channel.audience,
    genreIds: channel.preferredGenres,
    moodIds: channel.preferredMoods,
    seasonId: 'spring-open',
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: concept,
    avoidWords: '',
    personaMode: false,
    ...extra
  };
  const choices = userChoicesFromOptions(opts0);
  const plan = directSetLocal(concept, channel, songCount, { recentGenreIds: [], recentHooks: [] }, [], opts0.vocalTone, undefined, undefined, choices);
  const genreAllocation = plan.allocations.find(a => a.axis === 'genre');
  const genreIds = genreAllocation ? Object.keys(genreAllocation.counts) : channel.preferredGenres;
  const genres = genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
  const opts: GenerationOptions = { ...opts0, genreIds, diversityAllocations: plan.allocations };
  const blueprint = generateLocalBlueprint(opts, genres, [], SEASON);
  return { plan, opts, blueprint };
}

/** Classifies a song's stylePrompt text by which moneyChordPresets id's compactProgression substring appears in it. */
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

function genreDistribution(blueprint: ReturnType<typeof generateLocalBlueprint>) {
  const counts: Record<string, number> = {};
  for (const song of blueprint.songs) {
    const id = song.genreId ?? 'unknown';
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

function moneyChordDistribution(blueprint: ReturnType<typeof generateLocalBlueprint>) {
  const counts: Record<string, number> = {};
  for (const song of blueprint.songs) {
    const id = classifyMoneyChord(song.stylePrompt);
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

const results: Record<string, unknown> = {};

// ---------------------------------------------------------------------------
// §1 — TASK B: winterBallad explicit choice, real regeneration
// ---------------------------------------------------------------------------
{
  const concept = '60년대 감미로운 올드팝';
  const { blueprint } = generatePack(concept, SENIOR_MORNING, 18, {
    moneyChordMode: 'winterBallad',
    moneyChordModeIsExplicitChoice: true
  });
  const dist = moneyChordDistribution(blueprint);
  const assertion = assertUserChoicesPreserved(
    userChoicesFromOptions({ moneyChordMode: 'winterBallad', moneyChordModeIsExplicitChoice: true } as GenerationOptions),
    { moneyChordCounts: dist },
    'v57Measure/winterBallad'
  );
  const sample3 = blueprint.songs.slice(0, 3).map(s => ({ trackNo: s.trackNo, title: s.title, stylePrompt: s.stylePrompt }));
  const keyUpHits = blueprint.songs.filter(s => classifyMoneyChord(s.stylePrompt) === 'winterBallad').map(s => s.stylePrompt).filter(p => /key-up/i.test(p));
  results.winterBalladRegeneration = {
    concept,
    channelArchetype: SENIOR_MORNING.archetype,
    songCount: 18,
    moneyChordDistribution: dist,
    winterBalladCount: dist.winterBallad ?? 0,
    assertUserChoicesPreserved: assertion,
    compactProgressionText: moneyChordPresets.winterBallad.compactProgression,
    fullPromptText: moneyChordPresets.winterBallad.prompt,
    keyUpPhrasePresentInPromptField: moneyChordPresets.winterBallad.prompt.includes('key-up half-step modulation'),
    keyUpPhrasePresentInGeneratedStylePrompts: keyUpHits.length,
    sample3Songs: sample3,
    genreDistribution: genreDistribution(blueprint)
  };
}

// ---------------------------------------------------------------------------
// §2 — mechanism-level before/after trace (function-level, real calls) for
// resolveEarwormMoneyChordMode — the earworm-mode interaction found during
// investigation, real function calls not code-reading.
// ---------------------------------------------------------------------------
{
  results.earwormInteractionTrace = {
    note: 'Real calls to resolveEarwormMoneyChordMode demonstrating the earworm-mode interaction found during root-cause investigation.',
    beforeFix_equivalent_nonExplicit: resolveEarwormMoneyChordMode('winterBallad', true, false),
    afterFix_explicitChoice: resolveEarwormMoneyChordMode('winterBallad', true, true),
    explanation: 'When earwormMode=true and the caller does NOT mark the choice explicit, ANY non-default/non-canon/non-custom moneyChordMode (including a real user pick) is silently redirected to default — this is what beforeFix_equivalent_nonExplicit demonstrates. moneyChordModeIsExplicitChoice=true (now set by Step2Concept.tsx on every real user pick) prevents the redirect — afterFix_explicitChoice.'
  };
}

// ---------------------------------------------------------------------------
// §3 — TASK C: "60년대 감미로운 올드팝" — mood axis reaching genre selection
// ---------------------------------------------------------------------------
{
  const concept = '60년대 감미로운 올드팝';
  const { blueprint, plan } = generatePack(concept, SENIOR_MORNING, 18);
  const resolvedFamily = resolveMainFamilyId(concept, { recentGenreIds: [] });
  results.moodConceptRegeneration = {
    concept,
    resolvedPaletteFamilyId: resolvedFamily,
    moodDetected: plan.interpretation.mood,
    axisCoverage: plan.interpretation.axisCoverage,
    genreDistribution: genreDistribution(blueprint),
    genreLabels: Object.fromEntries(Object.keys(genreDistribution(blueprint)).map(id => [id, getGenreById(id)?.label ?? id])),
    balladLeaningGenresPresent: blueprint.songs
      .map(s => s.genreId)
      .filter((id): id is string => Boolean(id))
      .filter(id => ['oldpop-baroque-pop', 'oldpop-close-harmony-duo', 'oldpop-orchestral-easy', 'oldpop-standards-torch'].includes(id))
  };
}

// ---------------------------------------------------------------------------
// §4 — TASK D §4-3: concept axis coverage across 6 concepts
// ---------------------------------------------------------------------------
{
  const concepts = [
    '60년대 감미로운 올드팝',
    '비 오는 날 잔잔한 어쿠스틱',
    '여름밤 신나는 드라이브 곡',
    '카펜터스 느낌의 겨울 발라드',
    '70년대 애잔한 이별 노래',
    '밝고 경쾌한 60년대 걸그룹'
  ];
  results.conceptAxisCoverageTable = concepts.map(concept => {
    const plan = directSetLocal(concept, SENIOR_MORNING, 18, { recentGenreIds: [], recentHooks: [] });
    const detected = plan.interpretation.axisCoverage.filter(a => a.detected);
    const applied = plan.interpretation.axisCoverage.filter(a => a.detected && !a.unapplied);
    const unapplied = plan.interpretation.axisCoverage.filter(a => a.unapplied);
    return {
      concept,
      detectedCount: detected.length,
      appliedCount: applied.length,
      unappliedCount: unapplied.length,
      unappliedAxes: unapplied.map(a => a.axis),
      detail: plan.interpretation.axisCoverage
    };
  });
}

// ---------------------------------------------------------------------------
// §5 — TASK D §4-2 UI choice item spot-check (representative subset — see
// report for scope honesty note; NOT all ~20 UI items, full-pipeline
// generation per item is expensive).
// ---------------------------------------------------------------------------
{
  const concept = '겨울 발라드 세트';
  function moneyChordSongCounts(mode: GenerationOptions['moneyChordMode']) {
    const { blueprint } = generatePack(concept, SENIOR_MORNING, 18, { moneyChordMode: mode, moneyChordModeIsExplicitChoice: true });
    return moneyChordDistribution(blueprint);
  }
  const winterDist = moneyChordSongCounts('winterBallad');
  const doowopDist = moneyChordSongCounts('doowop' as GenerationOptions['moneyChordMode']);
  const cityPopDist = moneyChordSongCounts('cityPop');

  // v5.7 (TASK v5.7, TASK D §4-2) — vocalType leaning distribution (not a
  // brittle stylePrompt substring scan — "warm"/"mature" are generic words
  // that appear in unrelated style-prompt clauses too, e.g. "warm memory",
  // and produced a misleading 18/18 false-positive on an earlier draft of
  // this script). SongIdea.vocalType ('male'|'female'|'mixed') is the real,
  // structured signal leaningAdultVocalQuota actually writes.
  function vocalTypeCounts(vocalTone: string) {
    const { blueprint } = generatePack(concept, SENIOR_MORNING, 18, { vocalTone });
    const counts: Record<string, number> = {};
    for (const s of blueprint.songs) counts[s.vocalType ?? 'unknown'] = (counts[s.vocalType ?? 'unknown'] ?? 0) + 1;
    return counts;
  }
  // NOTE: valueA must differ from SENIOR_MORNING.defaultVocal — leaningGenderFor
  // (core/vocalPlan.ts) intentionally treats "vocalTone === channel default"
  // as "no explicit deviation" and returns undefined (documented, correct
  // behavior, not a bug) — an earlier draft of this script accidentally used
  // the channel's own default verbatim as valueA and misread the resulting
  // even 6/6/6 split as a failure.
  const vocalA = 'deep resonant male baritone, warm husky close-mic delivery';
  const vocalB = 'warm mature female alto, gentle and sincere';

  // Language: lyricLanguage 'korean' vs 'english' — measured by whether
  // lyrics actually contain Hangul.
  const KOREAN_RE = /[가-힣]/;
  function hangulShare(lyricLanguage: GenerationOptions['lyricLanguage']) {
    const { blueprint } = generatePack(concept, SENIOR_MORNING, 6, { lyricLanguage });
    const withHangul = blueprint.songs.filter(s => KOREAN_RE.test(s.lyrics)).length;
    return withHangul;
  }
  const koreanHangulSongs = hangulShare('korean');
  const englishHangulSongs = hangulShare('english');

  // Palette family override: 'family-orchestral' vs 'family-bright-pop' —
  // measured by whether the resulting genre axis actually differs.
  function familyGenreIds(familyOverride: string) {
    const plan = directSetLocal(concept, SENIOR_MORNING, 18, { recentGenreIds: [], recentHooks: [] }, [], undefined, undefined, familyOverride);
    const alloc = plan.allocations.find(a => a.axis === 'genre');
    return alloc ? Object.keys(alloc.counts) : [];
  }
  const orchestralFamilyGenres = familyGenreIds('family-orchestral');
  const brightPopFamilyGenres = familyGenreIds('family-bright-pop');

  results.uiChoiceSpotCheck = {
    moneyChord: {
      valueA: 'winterBallad',
      valueA_result: winterDist,
      valueB: 'doowop',
      valueB_result: doowopDist,
      differs: JSON.stringify(winterDist) !== JSON.stringify(doowopDist),
      valueA_reflected: (winterDist.winterBallad ?? 0) > 0,
      valueB_reflected: (doowopDist.doowop ?? 0) > 0
    },
    cityPopVsWinterBallad: {
      cityPopDist,
      differs: JSON.stringify(cityPopDist) !== JSON.stringify(winterDist)
    },
    vocalTone: {
      valueA: vocalA,
      valueA_vocalTypeCounts: vocalTypeCounts(vocalA),
      valueB: vocalB,
      valueB_vocalTypeCounts: vocalTypeCounts(vocalB)
    },
    lyricLanguage: {
      valueA: 'korean',
      valueA_songsWithHangul: koreanHangulSongs,
      valueB: 'english',
      valueB_songsWithHangul: englishHangulSongs,
      differs: koreanHangulSongs !== englishHangulSongs
    },
    paletteFamilyOverride: {
      valueA: 'family-orchestral',
      valueA_genreIds: orchestralFamilyGenres,
      valueB: 'family-bright-pop',
      valueB_genreIds: brightPopFamilyGenres,
      differs: JSON.stringify(orchestralFamilyGenres.sort()) !== JSON.stringify(brightPopFamilyGenres.sort())
    }
  };
}

console.log(JSON.stringify(results, null, 2));
