import { describe, expect, it } from 'vitest';
import { evaluateReleaseReadiness } from '../src/core/releaseReadiness';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { makeOptions, testMoods, testSeason, channelPresets, genrePacks } from './fixtures';
import type { ChannelProfile } from '../src/types';

/**
 * codex 지시문 05 (TASK F, required test file) — real, all-7-workspace
 * coverage of Release Readiness V2: the fixed 750~850자 exclude band and
 * the exact "제목=훅 8~10곡" band are both gone (no id emits those bands'
 * old literal labels anymore), every item carries a real `category` from
 * the new 10-way taxonomy, and the report's own `measuredCriteria`/
 * `passedOfMeasured`/`unmeasuredCount` 3-number shape is internally
 * consistent for every workspace.
 */

const WORKSPACE_ARCHETYPES = ['senior-morning', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'kr-idol-female', 'kr-kids-song', 'jp-kids-song'] as const;

function channelFor(archetype: string): ChannelProfile {
  const channel = channelPresets.find(c => c.archetype === archetype);
  if (!channel) throw new Error(`no channel preset for archetype ${archetype}`);
  return channel;
}

function reportFor(archetype: string) {
  const channel = channelFor(archetype);
  const lyricLanguage = channel.archetype?.startsWith('jp') ? 'japanese' as const : channel.archetype?.startsWith('kr') || channel.archetype === 'senior-morning' ? 'korean' as const : 'english' as const;
  const opts = makeOptions({ channel, songCount: 6, lyricLanguage });
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
  const audienceProfile = audienceProfileForChannelArchetype(channel.archetype, opts.audience);
  return evaluateReleaseReadiness({
    songs: blueprint.songs,
    conceptLabel: opts.customConcept || opts.projectTitle,
    songCount: blueprint.songs.length,
    audienceProfile,
    lyricLanguage,
    archetype: channel.archetype
  });
}

describe.each(WORKSPACE_ARCHETYPES)('[codex 지시문 05 TASK F] release readiness V2 — %s', archetype => {
  it('no item id is the old removed fixed-band ids (title-equals-hook-band / exclude-prompt-length)', () => {
    const report = reportFor(archetype);
    const ids = report.items.map(i => i.id);
    expect(ids).not.toContain('title-equals-hook-band');
    expect(ids).not.toContain('exclude-prompt-length');
    expect(ids).toContain('title-hook-disconnected-quota');
    expect(ids).toContain('negative-prompt-length');
  });

  it('every item carries a real category from the 10-way taxonomy', () => {
    const report = reportFor(archetype);
    const validCategories = new Set(['structural', 'contract', 'language', 'workspace-policy', 'novelty', 'prompt-consistency', 'lyric-naturalness', 'safety', 'title-hook-relationship', 'export-completeness']);
    for (const item of report.items) {
      expect(validCategories.has(item.category)).toBe(true);
    }
  });

  it('the 3-number shape is internally consistent: measuredCriteria + unmeasuredCount = totalCriteria', () => {
    const report = reportFor(archetype);
    expect(report.measuredCriteria + report.unmeasuredCount).toBe(report.totalCriteria);
    expect(report.passedOfMeasured).toBeLessThanOrEqual(report.measuredCriteria);
  });

  it('unmeasured (notImplemented) items are never counted as passed', () => {
    const report = reportFor(archetype);
    const unmeasuredPassed = report.items.filter(i => i.notImplemented && i.status === 'pass');
    expect(unmeasuredPassed).toEqual([]);
  });

  it('a language item and an export-completeness item are both real and present', () => {
    const report = reportFor(archetype);
    expect(report.items.some(i => i.category === 'language')).toBe(true);
    expect(report.items.some(i => i.category === 'export-completeness')).toBe(true);
  });
});
