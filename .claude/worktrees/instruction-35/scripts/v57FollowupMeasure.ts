/**
 * TASK v5.7 follow-up (Fable 5) — real local-generation measurement for the
 * 7 UI-choice items the original TASK v5.7 session's own §4-2-style
 * checklist left as "should work" / untested (songCount scaling,
 * customLyricThemeScene, packagingLanguage, the diversity axes not covered
 * by tests/setDirector.test.ts's structural checks, thumbnail settings,
 * earwormMode's own hook-selection effect, personaMode). Mirrors
 * scripts/v57Measure.ts's own pattern exactly (directSetLocal ->
 * generateLocalBlueprint, the real offline pipeline this app's audits
 * already trust). Report-only — writes JSON to stdout, never touches
 * production code/data.
 *
 * Usage: npx tsx scripts/v57FollowupMeasure.ts > v57-followup-measure-out.json
 */
import { directSetLocal } from '../src/core/setDirector';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { getGenreById } from '../src/data/genreLibrary';
import { channelPresets } from '../src/data/presets';
import { userChoicesFromOptions } from '../src/core/userChoices';
import { buildThumbnailSpec } from '../src/core/thumbnailSpec';
import type { ChannelProfile, GenerationOptions, AxisAllocation } from '../src/types';

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
  const opts: GenerationOptions = { ...opts0, genreIds, diversityAllocations: opts0.diversityAllocations ?? plan.allocations };
  const blueprint = generateLocalBlueprint(opts, genres, [], SEASON);
  return { plan, opts, blueprint };
}

function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((s, n) => s + n, 0);
}

const results: Record<string, unknown> = {};

// ---------------------------------------------------------------------------
// Item 1 — songCount: 12 vs 24, real generation, checking every axis
// allocation actually scales (not hardcoded to an 18-song assumption).
// ---------------------------------------------------------------------------
{
  const concept = '겨울 발라드 세트';
  function measure(songCount: number) {
    const { blueprint, plan, opts: _opts } = generatePack(concept, SENIOR_MORNING, songCount, {
      moneyChordMode: 'winterBallad',
      moneyChordModeIsExplicitChoice: true
    });
    const axisSums = Object.fromEntries(plan.allocations.map(a => [a.axis, sumCounts(a.counts)]));
    const winterBalladInStyle = blueprint.songs.filter(s => s.stylePrompt.includes('key-up half-step modulation') || /winter/i.test(s.moneyChordId ?? '')).length;
    const moneyChordIdCounts: Record<string, number> = {};
    for (const s of blueprint.songs) {
      const id = s.moneyChordId ?? 'unknown';
      moneyChordIdCounts[id] = (moneyChordIdCounts[id] ?? 0) + 1;
    }
    return {
      requestedSongCount: songCount,
      actualBlueprintSongCount: blueprint.songs.length,
      axisAllocationSums: axisSums,
      moneyChordIdCounts,
      winterBalladShare: (moneyChordIdCounts.winterBallad ?? 0) / songCount,
      winterBalladInStyleTextCount: winterBalladInStyle
    };
  }
  const at12 = measure(12);
  const at24 = measure(24);
  results.songCountScaling = {
    valueA: 12,
    valueA_result: at12,
    valueB: 24,
    valueB_result: at24,
    songCountReflected: at12.actualBlueprintSongCount === 12 && at24.actualBlueprintSongCount === 24,
    everyAxisScaledA: Object.values(at12.axisAllocationSums).every(n => n === 12),
    everyAxisScaledB: Object.values(at24.axisAllocationSums).every(n => n === 24),
    // v5.7 TASK B's own 50-60% share target — real measurement that it's a
    // proportion, not a hardcoded "9-11 out of 18" absolute count.
    moneyChordShareStaysInTargetBandAtBothCounts: at12.winterBalladShare >= 0.5 && at12.winterBalladShare <= 0.6 && at24.winterBalladShare >= 0.5 && at24.winterBalladShare <= 0.6
  };
}

// ---------------------------------------------------------------------------
// Item 2 — customLyricThemeScene: two distinct user-typed scenes, real
// generation, checking the actual generated lyricThemeText/stylePrompt
// reflects each scene's own text (data/lyricThemes.ts's customThemeFromScene
// always uses the fixed id 'custom-lyric-scene' regardless of scene text, so
// the id can't distinguish A from B — the scene TEXT itself must).
// ---------------------------------------------------------------------------
{
  const concept = '가을 캠퍼스 감성';
  const sceneA = '비 오는 서울 지하철역에서 우산을 접으며 옛 친구를 떠올리는 순간';
  const sceneB = '한여름 바닷가 마을 축제에서 폭죽이 터지는 밤을 함께 걷는 순간';
  function measure(scene: string) {
    const { blueprint } = generatePack(concept, SENIOR_MORNING, 18, { customLyricThemeScene: scene });
    const customSongs = blueprint.songs.filter(s => s.lyricTheme === 'custom-lyric-scene');
    const sceneKeyword = scene.includes('지하철') ? '지하철' : '축제';
    const stylePromptHits = customSongs.filter(s => s.stylePrompt.includes(sceneKeyword) || (s.lyrics ?? '').includes(sceneKeyword)).length;
    return {
      scene,
      customSlotCount: customSongs.length,
      customSlotTrackNos: customSongs.map(s => s.trackNo),
      sceneKeywordFoundInCustomSlots: stylePromptHits,
      sampleListenerSituation: customSongs[0]?.listenerSituation,
      sampleLyricsExcerpt: customSongs[0]?.lyrics?.slice(0, 200)
    };
  }
  const a = measure(sceneA);
  const b = measure(sceneB);
  results.customLyricThemeScene = {
    valueA: sceneA,
    valueA_result: a,
    valueB: sceneB,
    valueB_result: b,
    bothGotACustomSlot: a.customSlotCount > 0 && b.customSlotCount > 0,
    ownSceneKeywordReflectedInOwnSlots: a.sceneKeywordFoundInCustomSlots > 0 && b.sceneKeywordFoundInCustomSlots > 0,
    aKeywordNotCrossContaminatingB: !(b.sampleLyricsExcerpt ?? '').includes('지하철')
  };
}

// ---------------------------------------------------------------------------
// Item 3 — packagingLanguage independent of lyricLanguage: lyricLanguage
// pinned to 'english' throughout (so its own Hangul share stays constant),
// only packagingLanguage varies.
// ---------------------------------------------------------------------------
{
  const concept = '여름 해변 드라이브';
  const KOREAN_RE = /[가-힣]/;
  function measure(packagingLanguage: GenerationOptions['packagingLanguage']) {
    const { blueprint } = generatePack(concept, SENIOR_MORNING, 12, { lyricLanguage: 'english', packagingLanguage });
    const lyricsWithHangul = blueprint.songs.filter(s => KOREAN_RE.test(s.lyrics)).length;
    const titleLocalizedCount = blueprint.songs.filter(s => Boolean(s.titleLocalized)).length;
    const thumbnailTextSample = blueprint.songs[0]?.thumbnailText;
    return { packagingLanguage, lyricsWithHangul, titleLocalizedCount, thumbnailTextSample, titleLocalizedSample: blueprint.songs.find(s => s.titleLocalized)?.titleLocalized };
  }
  const korean = measure('korean');
  const english = measure('english');
  results.packagingLanguageIndependence = {
    valueA: 'korean',
    valueA_result: korean,
    valueB: 'english',
    valueB_result: english,
    differs: korean.titleLocalizedCount !== english.titleLocalizedCount || korean.thumbnailTextSample !== english.thumbnailTextSample,
    lyricLanguageUnaffected: korean.lyricsWithHangul === english.lyricsWithHangul,
    koreanGetsTitleLocalized: korean.titleLocalizedCount > 0,
    englishGetsNoTitleLocalized: english.titleLocalizedCount === 0
  };
}

// ---------------------------------------------------------------------------
// Item 4 — diversity axes NOT covered by tests/setDirector.test.ts's own
// (plan-only) structural checks: real per-song generated-output reflection
// for introTexture, hookDevice, arrangementDensity, structureTemplate,
// lyricTheme (axis-level, distinct from item 2's free-text scene), and
// perspective/pov.
// ---------------------------------------------------------------------------
{
  const concept = '봄날 산책 플레이리스트';
  const songCount = 12;

  function forcedAxis(axis: AxisAllocation['axis'], id: string): AxisAllocation[] {
    return [{ axis, mode: 'manual', counts: { [id]: songCount } }];
  }

  // introTexture — introTextureText (getIntroTextureById(id).tag) woven into stylePrompt.
  // Both ids are real, senior-morning-suited entries from data/introTextures.ts.
  {
    const { blueprint: bpA } = generatePack(concept, SENIOR_MORNING, songCount, { diversityAllocations: forcedAxis('introTexture', 'ag_finger') });
    const { blueprint: bpB } = generatePack(concept, SENIOR_MORNING, songCount, { diversityAllocations: forcedAxis('introTexture', 'str_pizz') });
    const aHits = bpA.songs.filter(s => s.stylePrompt.includes('fingerpicked acoustic guitar intro texture')).length;
    const bHits = bpB.songs.filter(s => s.stylePrompt.includes('light pizzicato strings intro texture')).length;
    results.introTextureAxis = {
      valueA: 'ag_finger', valueA_hitsInStylePrompt: aHits, valueA_of: bpA.songs.length,
      valueB: 'str_pizz', valueB_hitsInStylePrompt: bHits, valueB_of: bpB.songs.length,
      bothReflectedAtLeastOnce: aHits > 0 && bHits > 0
    };
  }

  // hookDevice — hookDeviceText (shortForm) woven into stylePrompt as a droppable atom.
  {
    const { blueprint: bpA } = generatePack(concept, SENIOR_MORNING, songCount, { diversityAllocations: forcedAxis('hookDevice', 'stop-time') });
    const { blueprint: bpB } = generatePack(concept, SENIOR_MORNING, songCount, { diversityAllocations: forcedAxis('hookDevice', 'octave-lift') });
    const aHits = bpA.songs.filter(s => s.stylePrompt.includes('stop-time')).length;
    const bHits = bpB.songs.filter(s => s.stylePrompt.includes('octave-lift')).length;
    results.hookDeviceAxis = {
      valueA: 'stop-time', valueA_hitsInStylePrompt: aHits, valueA_of: bpA.songs.length,
      valueB: 'octave-lift', valueB_hitsInStylePrompt: bHits, valueB_of: bpB.songs.length,
      bothReflectedAtLeastOnce: aHits > 0 && bHits > 0
    };
  }

  // arrangementDensity — forced (non-droppable) atom, exact phrase from ARRANGEMENT_DENSITY_TEXT_BY_LEVEL.
  {
    const { blueprint: bpA } = generatePack(concept, SENIOR_MORNING, songCount, { diversityAllocations: forcedAxis('arrangementDensity', 'sparse') });
    const { blueprint: bpB } = generatePack(concept, SENIOR_MORNING, songCount, { diversityAllocations: forcedAxis('arrangementDensity', 'full') });
    results.arrangementDensityAxis = {
      valueA: 'sparse', valueB: 'full',
      valueA_sampleStylePrompt: bpA.songs[0]?.stylePrompt,
      valueB_sampleStylePrompt: bpB.songs[0]?.stylePrompt,
      differs: bpA.songs[0]?.stylePrompt !== bpB.songs[0]?.stylePrompt
    };
  }

  // structureTemplate — direct SongIdea.structureTemplate field, no text-scan needed.
  {
    const { blueprint: bpA } = generatePack(concept, SENIOR_MORNING, songCount, { diversityAllocations: forcedAxis('structureTemplate', 'T1') });
    const { blueprint: bpB } = generatePack(concept, SENIOR_MORNING, songCount, { diversityAllocations: forcedAxis('structureTemplate', 'T4') });
    results.structureTemplateAxis = {
      valueA: 'T1', valueA_actual: Array.from(new Set(bpA.songs.map(s => s.structureTemplate))),
      valueB: 'T4', valueB_actual: Array.from(new Set(bpB.songs.map(s => s.structureTemplate))),
      valueA_allMatch: bpA.songs.every(s => s.structureTemplate === 'T1'),
      valueB_allMatch: bpB.songs.every(s => s.structureTemplate === 'T4')
    };
  }

  // lyricTheme (axis-level manual override) — direct SongIdea.lyricTheme id field.
  {
    const themeA = 'senior-convertible-radio-night';
    const themeB = 'senior-boardwalk-summer-lights';
    const { blueprint: bpA } = generatePack(concept, SENIOR_MORNING, songCount, { diversityAllocations: forcedAxis('lyricTheme', themeA) });
    const { blueprint: bpB } = generatePack(concept, SENIOR_MORNING, songCount, { diversityAllocations: forcedAxis('lyricTheme', themeB) });
    results.lyricThemeAxis = {
      valueA: themeA, valueA_actual: Array.from(new Set(bpA.songs.map(s => s.lyricTheme))),
      valueB: themeB, valueB_actual: Array.from(new Set(bpB.songs.map(s => s.lyricTheme))),
      valueA_allMatch: bpA.songs.every(s => s.lyricTheme === themeA),
      valueB_allMatch: bpB.songs.every(s => s.lyricTheme === themeB)
    };
  }

  // perspective/pov — two angles: (a) opts.perspective (primary POV feeding
  // the default auto pattern) and (b) a direct manual 'pov' axis override.
  {
    const { blueprint: bpA } = generatePack(concept, SENIOR_MORNING, songCount, { perspective: 'firstPerson' });
    const { blueprint: bpB } = generatePack(concept, SENIOR_MORNING, songCount, { perspective: 'thirdPerson' });
    const povCounts = (bp: typeof bpA) => {
      const c: Record<string, number> = {};
      for (const s of bp.songs) c[s.pov ?? 'unknown'] = (c[s.pov ?? 'unknown'] ?? 0) + 1;
      return c;
    };
    const { blueprint: bpForcedA } = generatePack(concept, SENIOR_MORNING, songCount, { diversityAllocations: forcedAxis('pov', 'secondPerson') });
    results.perspectivePovAxis = {
      viaOptsPerspective: {
        valueA: 'firstPerson', valueA_povCounts: povCounts(bpA),
        valueB: 'thirdPerson', valueB_povCounts: povCounts(bpB),
        differs: JSON.stringify(povCounts(bpA)) !== JSON.stringify(povCounts(bpB))
      },
      viaManualPovAxisOverride: {
        value: 'secondPerson (forced 100%)',
        actual: Array.from(new Set(bpForcedA.songs.map(s => s.pov))),
        allMatch: bpForcedA.songs.every(s => s.pov === 'secondPerson')
      }
    };
  }
}

// ---------------------------------------------------------------------------
// Item 5 — thumbnail settings: GenerationOptions/ChannelProfile do NOT
// actually carry a thumbnail-archetype field (it lives in App.tsx's own
// useState, passed to buildThumbnailSpec as a plain function argument) —
// real finding, not an assumption; see report. Measures whether changing
// that archetype id (the real thumbnail "setting" a user picks in the UI)
// changes buildThumbnailSpec's actual output, and packagingLanguage's own
// effect on thumbnail headline/subline text specifically.
// ---------------------------------------------------------------------------
{
  const concept = '가을 창가 플레이리스트';
  const { blueprint, opts } = generatePack(concept, SENIOR_MORNING, 12, { packagingLanguage: 'korean' });
  const specA = buildThumbnailSpec(blueprint, opts, SEASON, SENIOR_MORNING, 0, 'autumn-window-golden');
  const specB = buildThumbnailSpec(blueprint, opts, SEASON, SENIOR_MORNING, 0, 'winter-window-snow');
  const optsEnglishPkg: GenerationOptions = { ...opts, packagingLanguage: 'english' };
  const specEnglishPkg = buildThumbnailSpec(blueprint, optsEnglishPkg, SEASON, SENIOR_MORNING, 0, 'autumn-window-golden');
  results.thumbnailSettings = {
    fieldLocationFinding: 'ThumbnailArchetypeId is NOT a field on GenerationOptions or ChannelProfile — App.tsx keeps it in its own useState(\'autumn-window-golden\') and passes it directly to buildThumbnailSpec\'s archetypeId parameter. packagingLanguage (which IS on GenerationOptions) is the one thumbnail-relevant field that does live there.',
    archetypeAB: {
      valueA: 'autumn-window-golden',
      valueA_imagePrompt: specA.imagePrompt,
      valueA_typographyFont: specA.typography.font,
      valueB: 'winter-window-snow',
      valueB_imagePrompt: specB.imagePrompt,
      valueB_typographyFont: specB.typography.font,
      imagePromptDiffers: specA.imagePrompt !== specB.imagePrompt,
      // colorScheme/headline text are deliberately season/copy-driven, not
      // archetype-driven (see thumbnailSpec.ts's own buildThumbnailSpec —
      // colorScheme reads paletteForSeason(season.id), headlines read
      // buildQuestionHeadline(language, seedIndex)); noted here as a real
      // finding, not treated as a bug — imagePrompt/typography are the
      // fields this archetype id actually controls.
      colorSchemeIsArchetypeIndependentByDesign: JSON.stringify(specA.colorScheme) === JSON.stringify(specB.colorScheme),
      headlineIsArchetypeIndependentByDesign: specA.variants[0]?.headline === specB.variants[0]?.headline
    },
    packagingLanguageEffectOnThumbnail: {
      koreanHeadline: specA.variants[0]?.headline,
      englishHeadline: specEnglishPkg.variants[0]?.headline,
      differs: specA.variants[0]?.headline !== specEnglishPkg.variants[0]?.headline
    }
  };
}

// ---------------------------------------------------------------------------
// Item 6 — earwormMode's OWN effect on hook selection (not the money-chord
// interaction v5.7's original session already measured): real generation,
// same seed/concept/channel, comparing which hook wins the k=3 opening
// contest for the cold-open (track 1) and flagship (tracks 2-3) slots.
// moneyChordMode left at 'default'/non-explicit so the already-known
// money-chord redirect never fires here — isolates the hook-selection path.
// ---------------------------------------------------------------------------
{
  const concept = '가을 감성 라디오';
  const { blueprint: bpOff } = generatePack(concept, SENIOR_MORNING, 18, { earwormMode: false });
  const { blueprint: bpOn } = generatePack(concept, SENIOR_MORNING, 18, { earwormMode: true });
  const openingTracks = (bp: typeof bpOff) => bp.songs.slice(0, 3).map(s => ({ trackNo: s.trackNo, hookPhrase: s.hookPhrase, title: s.title }));
  const offOpening = openingTracks(bpOff);
  const onOpening = openingTracks(bpOn);
  results.earwormModeHookSelection = {
    valueA: false,
    valueA_openingTracks: offOpening,
    valueB: true,
    valueB_openingTracks: onOpening,
    anyOpeningHookDiffers: offOpening.some((s, i) => s.hookPhrase !== onOpening[i]?.hookPhrase),
    note: 'earwormMode reweights runOpeningContest\'s scoring (familiarity gets 35-45% weight vs 0% off) only for cold-open/flagship (tracks 1-3) slots — see core/openingContest.ts. A changed winner here is real evidence of the reweighting reaching generation, though the k=3 candidate pool means it will not differ on every possible concept/seed.'
  };
}

// ---------------------------------------------------------------------------
// Item 7 — personaMode: real generation, checking the actual style-prompt
// composition path differs (composePersonaSongStylePrompt vs
// composeStylePrompt — see core/localGenerator.ts).
// ---------------------------------------------------------------------------
{
  const concept = '겨울 저녁 라디오';
  const { blueprint: bpOff } = generatePack(concept, SENIOR_MORNING, 12, { personaMode: false });
  const { blueprint: bpOn } = generatePack(concept, SENIOR_MORNING, 12, { personaMode: true });
  const avgLen = (bp: typeof bpOff) => bp.songs.reduce((sum, s) => sum + s.stylePrompt.length, 0) / bp.songs.length;
  results.personaModeEffect = {
    valueA: false,
    valueA_sampleStylePrompt: bpOff.songs[1]?.stylePrompt,
    valueA_avgStylePromptLength: avgLen(bpOff),
    valueB: true,
    valueB_sampleStylePrompt: bpOn.songs[1]?.stylePrompt,
    valueB_avgStylePromptLength: avgLen(bpOn),
    differs: bpOff.songs[1]?.stylePrompt !== bpOn.songs[1]?.stylePrompt,
    // v3.8's own doc comment: personaMode should keep ONLY song-specific
    // differences since Suno Persona supplies the stable channel voice/style
    // identity — real measurement of whether non-seed tracks actually get
    // shorter/leaner prompts than the non-persona path.
    nonSeedTrackShorterUnderPersona: (bpOn.songs[1]?.stylePrompt.length ?? 0) < (bpOff.songs[1]?.stylePrompt.length ?? Infinity)
  };
}

console.log(JSON.stringify(results, null, 2));
