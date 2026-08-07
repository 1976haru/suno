import { describe, expect, it } from 'vitest';
import {
  scoreBlindBenchmarkEntry, anonymizeBlindBenchmarkEntries, assertNoProviderLeak,
  meetsMinimumConceptCount, buildBlindBenchmarkPlan, MINIMUM_CONCEPTS_PER_WORKSPACE,
  type BlindBenchmarkSourceEntry
} from '../src/core/blindBenchmark';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { workspaceForArchetype } from '../src/data/workspaces/index';
import { makeOptions, testMoods, testSeason, channelPresets, genrePacks } from './fixtures';
import type { ChannelProfile, WorkspaceId } from '../src/types';

/**
 * codex 지시문 06 (TASK F, required test file) — real, all-7-workspace
 * coverage of the 5-axis scoring, the blind anonymization wrapper, and the
 * per-workspace minimum-concept/3-runs-per-system plan.
 */

const WORKSPACE_ARCHETYPES = ['senior-morning', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'kr-idol-female', 'kr-kids-song', 'jp-kids-song'] as const;

function channelFor(archetype: string): ChannelProfile {
  const channel = channelPresets.find(c => c.archetype === archetype);
  if (!channel) throw new Error(`no channel preset for archetype ${archetype}`);
  return channel;
}

function scoreFor(archetype: string) {
  const channel = channelFor(archetype);
  const lyricLanguage = channel.archetype?.startsWith('jp') ? 'japanese' as const : channel.archetype?.startsWith('kr') || channel.archetype === 'senior-morning' ? 'korean' as const : 'english' as const;
  const opts = makeOptions({ channel, songCount: 6, lyricLanguage });
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
  const workspaceId = workspaceForArchetype(channel.archetype)!.id;
  return scoreBlindBenchmarkEntry({
    songs: blueprint.songs,
    conceptLabel: opts.customConcept || opts.projectTitle,
    lyricLanguage,
    workspaceId
  });
}

describe.each(WORKSPACE_ARCHETYPES)('[codex 지시문 06 TASK F] scoreBlindBenchmarkEntry — %s', archetype => {
  it('every axis lands within its own real max, and the total never exceeds maxPossible', () => {
    const score = scoreFor(archetype);
    expect(score.axes.intent).toBeGreaterThanOrEqual(0);
    expect(score.axes.intent).toBeLessThanOrEqual(30);
    expect(score.axes.naturalness).toBeLessThanOrEqual(25);
    expect(score.axes.promptConsistency).toBeLessThanOrEqual(20);
    expect(score.axes.originality).toBeLessThanOrEqual(15);
    expect(score.total).toBeLessThanOrEqual(score.maxPossible);
  });

  it('real audio is honestly not-measured (undefined) when no AudioTake data is supplied — never a fabricated score', () => {
    const score = scoreFor(archetype);
    expect(score.realAudioMeasured).toBe(false);
    expect(score.axes.realAudio).toBeUndefined();
    // maxPossible excludes the un-measured 10-point real-audio ceiling, so a text-only pack is scored out of its own real 90, not unfairly out of 100.
    expect(score.maxPossible).toBe(90);
  });
});

describe('[codex 지시문 06 TASK F] real audio axis, when measured, is included for real', () => {
  it('a pack with real audio compliance summaries gets a real, non-undefined realAudio score', () => {
    const channel = channelFor('kr-2030-pop');
    const opts = makeOptions({ channel, songCount: 4, lyricLanguage: 'korean' });
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
    const workspaceId = workspaceForArchetype(channel.archetype)!.id;
    const score = scoreBlindBenchmarkEntry({
      songs: blueprint.songs, conceptLabel: opts.projectTitle, lyricLanguage: 'korean', workspaceId,
      audioComplianceSummaries: [{ overallStatus: 'pass' }, { overallStatus: 'pass' }, { overallStatus: 'fail' }]
    });
    expect(score.realAudioMeasured).toBe(true);
    expect(score.axes.realAudio).toBeGreaterThan(0);
    expect(score.axes.realAudio).toBeLessThan(10);
    expect(score.maxPossible).toBe(100);
  });
});

describe('[codex 지시문 06 TASK F] blind anonymization — 완료 기준 "source provider leaked in blind test = 0"', () => {
  it('two entries from different real systems get distinct, opaque tokens with no real system name inside', () => {
    const entries: BlindBenchmarkSourceEntry[] = [
      { systemId: 'anthropic-claude-sonnet-5', score: { axes: { intent: 25, naturalness: 20, promptConsistency: 15, originality: 10 }, total: 70, maxPossible: 90, realAudioMeasured: false } },
      { systemId: 'openai-gpt-5', score: { axes: { intent: 20, naturalness: 18, promptConsistency: 14, originality: 9 }, total: 61, maxPossible: 90, realAudioMeasured: false } }
    ];
    const blind = anonymizeBlindBenchmarkEntries(entries);
    expect(blind[0].systemToken).toBe('System A');
    expect(blind[1].systemToken).toBe('System B');
    expect(assertNoProviderLeak(blind, ['anthropic-claude-sonnet-5', 'openai-gpt-5'])).toBe(true);
  });

  it('the same real system always maps to the same token (deterministic, first-seen order)', () => {
    const entries: BlindBenchmarkSourceEntry[] = [
      { systemId: 'sys-x', score: { axes: { intent: 10, naturalness: 10, promptConsistency: 10, originality: 10 }, total: 40, maxPossible: 90, realAudioMeasured: false } },
      { systemId: 'sys-y', score: { axes: { intent: 5, naturalness: 5, promptConsistency: 5, originality: 5 }, total: 20, maxPossible: 90, realAudioMeasured: false } },
      { systemId: 'sys-x', score: { axes: { intent: 15, naturalness: 15, promptConsistency: 15, originality: 15 }, total: 60, maxPossible: 90, realAudioMeasured: false } }
    ];
    const blind = anonymizeBlindBenchmarkEntries(entries);
    expect(blind[0].systemToken).toBe(blind[2].systemToken);
    expect(blind[0].systemToken).not.toBe(blind[1].systemToken);
  });

  it('assertNoProviderLeak catches a real leak (a hostile/buggy caller that DID carry the real id through)', () => {
    const leaked = [{ systemToken: 'anthropic-claude-sonnet-5', score: {} }] as unknown as ReturnType<typeof anonymizeBlindBenchmarkEntries>;
    expect(assertNoProviderLeak(leaked, ['anthropic-claude-sonnet-5'])).toBe(false);
  });
});

describe('[codex 지시문 06 TASK F] per-workspace minimum concept counts', () => {
  it('matches the spec\'s own literal minimums for every real workspace', () => {
    const expected: Record<WorkspaceId, number> = {
      'senior-oldpop': 2, 'kr-2030': 2, 'jp-2030': 2, 'kr-kids': 1, 'jp-kids': 1, 'kr-idol-male': 1, 'kr-idol-female': 1
    };
    expect(MINIMUM_CONCEPTS_PER_WORKSPACE).toEqual(expected);
  });

  it('meetsMinimumConceptCount is a real, workspace-aware gate', () => {
    expect(meetsMinimumConceptCount('senior-oldpop', 1)).toBe(false);
    expect(meetsMinimumConceptCount('senior-oldpop', 2)).toBe(true);
    expect(meetsMinimumConceptCount('kr-kids', 1)).toBe(true);
  });
});

describe('[codex 지시문 06 TASK F] buildBlindBenchmarkPlan — "각 콘셉트 시스템별 3회"', () => {
  it('every (concept, system) pair gets exactly 3 runs', () => {
    const plan = buildBlindBenchmarkPlan(['concept-1', 'concept-2'], ['system-a', 'system-b']);
    expect(plan).toHaveLength(2 * 2 * 3);
    for (const concept of ['concept-1', 'concept-2']) {
      for (const systemId of ['system-a', 'system-b']) {
        const runs = plan.filter(p => p.concept === concept && p.systemId === systemId);
        expect(runs.map(r => r.runIndex).sort()).toEqual([1, 2, 3]);
      }
    }
  });
});
