import { describe, expect, it } from 'vitest';
import { auditPromises, auditTitleConceptConsistency, decomposeConceptPromises } from '../src/core/promiseAudit';
import { directSetLocal } from '../src/core/setDirector';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { getGenreById } from '../src/data/genreLibrary';
import { channelPresets } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;
const CONCEPT = '비틀즈 느낌의 밝은 60년대 팝';

/** v4.5 (TASK D) — generalized from the original generatePack() below (which stayed hardcoded to CONCEPT) so TASK D's own real-concept verification tests (C7/C8) can reuse the exact same real generation pipeline instead of hand-built fixtures. */
function generatePackFor(concept: string) {
  const plan = directSetLocal(concept, seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
  const genreAllocation = plan.allocations.find(a => a.axis === 'genre')!;
  const genreIds = Object.keys(genreAllocation.counts);
  const genres = genreIds.map(id => getGenreById(id)!).filter(Boolean);
  const opts = {
    channel: seniorChannel,
    projectTitle: concept,
    songCount: 18,
    lyricLanguage: 'english' as const,
    market: seniorChannel.market,
    audience: seniorChannel.audience,
    genreIds,
    moodIds: seniorChannel.preferredMoods,
    seasonId: 'spring-open',
    vocalTone: seniorChannel.defaultVocal,
    perspective: 'firstPerson' as const,
    lyricDepth: 'commercial' as const,
    durationTarget: 'under3m30' as const,
    moneyChordMode: 'default' as const,
    customMoneyChord: '',
    customConcept: concept,
    avoidWords: '',
    personaMode: false,
    diversityAllocations: plan.allocations
  };
  return generateLocalBlueprint(opts, genres, [], { id: 'spring-open', label: 'Spring', period: '', keywords: [], visualDirection: '' } as any);
}

function generatePack() {
  return generatePackFor(CONCEPT);
}

describe('[v3.76 TASK A] decomposeConceptPromises', () => {
  it('decomposes "비틀즈 느낌의 밝은 60년대 팝" into era + reference + mood promises, no artist name leaked', () => {
    const { promises, references } = decomposeConceptPromises(CONCEPT);
    const kinds = promises.map(p => p.kind);
    expect(kinds).toContain('era');
    expect(kinds).toContain('reference');
    expect(kinds).toContain('mood');
    expect(references.length).toBeGreaterThan(0);
    // sourceText/matchedSurface is UI-display-only (mirrors
    // DecomposedReference's own contract — see artistReferenceDecomposer.ts)
    // and is never routed into stylePrompt/lyrics; the actual audit-relevant
    // content is each reference's trait arrays, which must stay name-free.
    const traitText = JSON.stringify(references.map(ref => ({
      instrumentation: ref.instrumentation,
      harmonyTraits: ref.harmonyTraits,
      rhythmTraits: ref.rhythmTraits,
      productionTraits: ref.productionTraits,
      vocalTraits: ref.vocalTraits
    })));
    expect(traitText.toLowerCase()).not.toMatch(/beatles|비틀즈/);
  });

  it('a concept with no era/reference/mood word decomposes to an empty list, never invented', () => {
    const { promises } = decomposeConceptPromises('비 오는 날 창가에서 듣는 올드팝');
    expect(promises.find(p => p.kind === 'era')).toBeUndefined();
  });
});

describe('[v3.76 TASK A] auditPromises — REPORT: real 18-song Beatles-60s pack', () => {
  it('REPORT: promise fulfillment roughly matches this task\'s own §6 expected ranges', () => {
    const bp = generatePack();
    const report = auditPromises(bp.songs, CONCEPT);
    const titleReport = auditTitleConceptConsistency(bp.songs);

     
    console.log('[TASK v3.76 REPORT] === 약속 이행도 ===');
     
    console.log(`[TASK v3.76 REPORT] 컨셉: ${CONCEPT}`);
    for (const result of report.promises) {
       
      console.log(`[TASK v3.76 REPORT]   [${result.promise.kind}] ${result.promise.labelKo} — ${Math.round(result.fulfillment * 100)}%`, result.byTarget, result.explanationKo);
    }
     
    console.log(`[TASK v3.76 REPORT] 종합 이행도: ${Math.round(report.overallFulfillment * 100)}% / 가장 약한 약속: ${report.weakestPromise}`);
     
    console.log('[TASK v3.76 REPORT] 제목 정합성:', titleReport);

    expect(report.promises.length).toBeGreaterThanOrEqual(3);
    // Spec's own §6 "경향이 맞으면 통과" tolerance — not exact percentages.
    expect(report.overallFulfillment).toBeGreaterThan(0);
    expect(report.overallFulfillment).toBeLessThan(0.9);
  });
});

describe('[v3.76 TASK A] auditTitleConceptConsistency — real reported symptom data', () => {
  it('REPORT: catches the actual low-consistency symptom quoted in this task\'s own §0 (real bridge-path output, not this session\'s local generator)', () => {
    // v3.76 — local generation already carries A3/v3.75's title-pattern
    // fixes, so a freshly-generated local pack scores well on this check
    // (see the test above: 100% hook-connected) — that's a real, honest
    // signal that those fixes help, but it means a fresh local pack can't
    // exercise the LOW-consistency symptom this task's own §0 quotes,
    // which came from the real Claude-Code-bridge/production path (agent-
    // composed titles, independent of core/lyricEngine.ts entirely — see
    // docs/v375-report.md §6-3). This test instead feeds the tool the
    // literal reported title/hook pairs to prove it correctly flags them.
    const titles = ['Tablelight', 'Blue Crease', 'Shoulder', 'Porchlight', 'Roadsalt', 'Boardwalk Salt', 'Blue Ribbon', 'Pressed Collar', 'Last Platform'];
    const hooks = ['Hold My Hand, Friend', 'I Still Believe', 'Save Me One Dance', 'Stay with Me Tonight', "I'm Coming Home", 'Hush Now, My Love', 'Wait by the Window', 'Catch the Morning Train', 'Keep the Light On'];
    const songs = titles.map((title, i) => ({
      trackNo: i + 1,
      title,
      hookPhrase: hooks[i],
      lyrics: '', stylePrompt: '', seasonMoment: '', listenerSituation: '', emotionArc: '',
      youtube: { title: '', description: '', tags: [] }, qualityScore: 0, warnings: []
    })) as any;
    const report = auditTitleConceptConsistency(songs);
     
    console.log('[TASK v3.76 REPORT] real reported title/hook pairs — title consistency:', report);
    // hookConnectedCount is the strongest, most direct signal here — matches
    // the real "훅 연결 0/18" symptom exactly (0/9 in this smaller sample).
    expect(report.hookConnectedCount).toBe(0);
    // eraPatternMatchShare's classifyTitleShape-based heuristic reads some
    // invented single-word titles (e.g. "Tablelight", "Roadsalt") as
    // "era-appropriate shape" even though they're not real period vocabulary
    // — a known coarse-approximation limit (see this file's own doc
    // comment), so offConceptTitleCount alone undercounts the real problem;
    // hookConnectedCount is the more reliable of the two signals.
    expect(report.offConceptTitleCount).toBeGreaterThanOrEqual(5);
  });
});

describe('[v3.76 TASK A] auditTitleConceptConsistency', () => {
  it('flags a title that neither connects to its own hook nor reads era-shaped', () => {
    const songs = [
      { trackNo: 1, title: 'Fogged Window', hookPhrase: 'Hold On, My Friend', lyrics: '', stylePrompt: '', seasonMoment: '', listenerSituation: '', emotionArc: '', youtube: { title: '', description: '', tags: [] }, qualityScore: 0, warnings: [] }
    ] as any;
    const report = auditTitleConceptConsistency(songs);
    expect(report.offConceptTitleCount).toBe(1);
  });

  it('does not flag a title that equals its own hook', () => {
    const songs = [
      { trackNo: 1, title: 'Hold On, My Friend', hookPhrase: 'Hold On, My Friend', lyrics: '', stylePrompt: '', seasonMoment: '', listenerSituation: '', emotionArc: '', youtube: { title: '', description: '', tags: [] }, qualityScore: 0, warnings: [] }
    ] as any;
    const report = auditTitleConceptConsistency(songs);
    expect(report.offConceptTitleCount).toBe(0);
    expect(report.hookConnectedCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// v4.5 (TASK D) — situation/motion/cast promises + the unlisted-artist
// fallback reference promise. C7/C8 are this task's own real report
// concepts (§0-1's own real 0% measurements).
// ---------------------------------------------------------------------------

function song(overrides: Partial<{ trackNo: number; genreId: string; lyricFrameId: string; lyricThemeMotionKo: string; lyricThemeCastKo: string }>) {
  return {
    trackNo: overrides.trackNo ?? 1,
    title: 'T',
    seasonMoment: '',
    listenerSituation: '',
    emotionArc: '',
    hookPhrase: 'Hook',
    stylePrompt: 'a, b, c',
    lyrics: '[chorus]\nHook',
    youtube: { title: '', description: '', tags: [] },
    qualityScore: 0,
    warnings: [],
    genreId: overrides.genreId,
    lyricFrameId: overrides.lyricFrameId,
    lyricThemeMotionKo: overrides.lyricThemeMotionKo,
    lyricThemeCastKo: overrides.lyricThemeCastKo
  } as any;
}

describe('[v4.5 TASK D, 4-2] situation/motion/cast promise detection', () => {
  it('detects a dance-saturday situation promise from "춤추던 토요일 밤"', () => {
    const { promises } = decomposeConceptPromises('젊은 시절 춤추던 토요일 밤');
    const situation = promises.find(p => p.kind === 'situation');
    expect(situation?.expectedAxisValue).toBe('dance-saturday');
    const motion = promises.find(p => p.kind === 'motion');
    expect(motion?.expectedAxisValue).toBe('춤');
  });

  it('detects a cast promise from "혼자"', () => {
    const { promises } = decomposeConceptPromises('혼자 걷는 퇴근길');
    const cast = promises.find(p => p.kind === 'cast');
    expect(cast?.expectedAxisValue).toBe('혼자');
  });

  it('detects no situation/motion/cast promise for a concept naming none of them', () => {
    const { promises } = decomposeConceptPromises('밝은 60년대 팝');
    expect(promises.some(p => p.kind === 'situation')).toBe(false);
    expect(promises.some(p => p.kind === 'motion')).toBe(false);
    expect(promises.some(p => p.kind === 'cast')).toBe(false);
  });
});

describe('[v4.5 TASK D, 4-2] measureSituation/measureMotion/measureCast', () => {
  it('scores situation fulfillment against song.lyricFrameId', () => {
    const songs = [
      song({ trackNo: 1, lyricFrameId: 'dance-saturday' }),
      song({ trackNo: 2, lyricFrameId: 'dance-saturday' }),
      song({ trackNo: 3, lyricFrameId: 'solitary-object' })
    ];
    const report = auditPromises(songs, '춤추던 토요일 밤');
    const situationResult = report.promises.find(p => p.promise.kind === 'situation')!;
    expect(situationResult.fulfillment).toBeCloseTo(2 / 3);
    expect(situationResult.failedTracks).toEqual([3]);
  });

  it('scores motion fulfillment via substring match against lyricThemeMotionKo', () => {
    const songs = [
      song({ trackNo: 1, lyricThemeMotionKo: '이동 중(드라이브)' }),
      song({ trackNo: 2, lyricThemeMotionKo: '정적' })
    ];
    const report = auditPromises(songs, '드라이브 가는 길');
    const motionResult = report.promises.find(p => p.promise.kind === 'motion')!;
    expect(motionResult.fulfillment).toBeCloseTo(0.5);
  });

  it('scores cast fulfillment via substring match against lyricThemeCastKo', () => {
    const songs = [
      song({ trackNo: 1, lyricThemeCastKo: '여럿' }),
      song({ trackNo: 2, lyricThemeCastKo: '혼자' })
    ];
    const report = auditPromises(songs, '친구들과 함께');
    const castResult = report.promises.find(p => p.promise.kind === 'cast')!;
    expect(castResult.fulfillment).toBeCloseTo(0.5);
  });
});

describe('[v4.5 TASK D, 4-3] fallback reference promise for an unlisted artist', () => {
  it('never fires when a seed-recognized artist reference exists ("비틀즈")', () => {
    const { promises } = decomposeConceptPromises('비틀즈 느낌의 밝은 60년대 팝');
    expect(promises.filter(p => p.kind === 'reference' && p.fallbackGenreIds?.length)).toEqual([]);
    expect(promises.some(p => p.kind === 'reference')).toBe(true); // the real seed-based one still fires
  });

  it('fires for an unlisted artist named via "~같은" with a resolvable genre keyword', () => {
    const { promises } = decomposeConceptPromises('사이먼과 가펑클 같은 담백한 포크 하모니');
    const fallback = promises.find(p => p.kind === 'reference');
    expect(fallback?.fallbackGenreIds).toContain('folk-pop');
  });

  it('does not fire when there is no reference-shaped phrase at all', () => {
    const { promises } = decomposeConceptPromises('조용한 아침 커피');
    expect(promises.some(p => p.kind === 'reference')).toBe(false);
  });

  it('measures fallback reference fulfillment against genreId assignment', () => {
    const songs = [
      song({ trackNo: 1, genreId: 'folk-pop' }),
      song({ trackNo: 2, genreId: 'oldpop-folk-rock-70s' }),
      song({ trackNo: 3, genreId: 'adult-contemporary' })
    ];
    const report = auditPromises(songs, '사이먼과 가펑클 같은 담백한 포크 하모니');
    expect(report.promises).toHaveLength(1);
    expect(report.promises[0].fulfillment).toBeCloseTo(2 / 3);
  });
});

describe('[v4.5 TASK D] end-to-end — real report concepts C7/C8', () => {
  it('C8 "젊은 시절 춤추던 토요일 밤" reaches >= 60% overall fulfillment (this task\'s own bar)', () => {
    const bp = generatePackFor('젊은 시절 춤추던 토요일 밤');
    const report = auditPromises(bp.songs, '젊은 시절 춤추던 토요일 밤');
     
    console.log('[v4.5 TASK D REPORT] C8 overall fulfillment:', Math.round(report.overallFulfillment * 100) + '%', report.promises.map(p => `${p.promise.kind}:${Math.round(p.fulfillment * 100)}%`));
    expect(report.overallFulfillment).toBeGreaterThanOrEqual(0.6);
  });

  it('C7 "사이먼과 가펑클 같은 담백한 포크 하모니" reaches >= 50% overall fulfillment (this task\'s own bar) despite the artist being unlisted', () => {
    const bp = generatePackFor('사이먼과 가펑클 같은 담백한 포크 하모니');
    const report = auditPromises(bp.songs, '사이먼과 가펑클 같은 담백한 포크 하모니');
     
    console.log('[v4.5 TASK D REPORT] C7 overall fulfillment:', Math.round(report.overallFulfillment * 100) + '%');
    expect(report.overallFulfillment).toBeGreaterThanOrEqual(0.5);
  });

  it('a concept with NO situation keyword still spans multiple lyric-theme frames (never forces one scene)', () => {
    const bp = generatePack(); // CONCEPT names no situation
    const distinctFrames = new Set(bp.songs.map(s => s.lyricFrameId));
    expect(distinctFrames.size).toBeGreaterThanOrEqual(6);
  });
});
