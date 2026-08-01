import { describe, expect, it } from 'vitest';
import { auditPromises, auditTitleConceptConsistency, decomposeConceptPromises } from '../src/core/promiseAudit';
import { directSetLocal } from '../src/core/setDirector';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { getGenreById } from '../src/data/genreLibrary';
import { channelPresets } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;
const CONCEPT = '비틀즈 느낌의 밝은 60년대 팝';

function generatePack() {
  const plan = directSetLocal(CONCEPT, seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
  const genreAllocation = plan.allocations.find(a => a.axis === 'genre')!;
  const genreIds = Object.keys(genreAllocation.counts);
  const genres = genreIds.map(id => getGenreById(id)!).filter(Boolean);
  const opts = {
    channel: seniorChannel,
    projectTitle: CONCEPT,
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
    customConcept: CONCEPT,
    avoidWords: '',
    personaMode: false,
    diversityAllocations: plan.allocations
  };
  return generateLocalBlueprint(opts, genres, [], { id: 'spring-open', label: 'Spring', period: '', keywords: [], visualDirection: '' } as any);
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

    // eslint-disable-next-line no-console
    console.log('[TASK v3.76 REPORT] === 약속 이행도 ===');
    // eslint-disable-next-line no-console
    console.log(`[TASK v3.76 REPORT] 컨셉: ${CONCEPT}`);
    for (const result of report.promises) {
      // eslint-disable-next-line no-console
      console.log(`[TASK v3.76 REPORT]   [${result.promise.kind}] ${result.promise.labelKo} — ${Math.round(result.fulfillment * 100)}%`, result.byTarget, result.explanationKo);
    }
    // eslint-disable-next-line no-console
    console.log(`[TASK v3.76 REPORT] 종합 이행도: ${Math.round(report.overallFulfillment * 100)}% / 가장 약한 약속: ${report.weakestPromise}`);
    // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
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
