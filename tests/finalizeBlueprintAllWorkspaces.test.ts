import { describe, expect, it } from 'vitest';
import { finalizeBlueprintForUse, validateBlueprintSchema, reconcileSlotsForFinalize } from '../src/core/finalizeBlueprint';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildGenerationSnapshot, slotsForOptions } from '../src/core/generationSnapshot';
import { audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { workspaceForArchetype } from '../src/data/workspaces/index';
import { makeOptions, testMoods, testSeason, channelPresets, genrePacks } from './fixtures';
import type { ChannelProfile } from '../src/types';

/**
 * codex 지시문 05 (TASK B, required test file) — real, end-to-end coverage
 * of finalizeBlueprintForUse across all 7 workspaces: real local
 * generation, a real snapshot, real steps 1-9. Small songCount (6) for
 * test speed — this only needs to prove the pipeline runs correctly, not
 * re-run the app's own 18-song regression suite.
 */

const WORKSPACE_ARCHETYPES = ['senior-morning', 'kr-2030-pop', 'jp-2030-pop', 'kr-idol-male', 'kr-idol-female', 'kr-kids-song', 'jp-kids-song'] as const;

function channelFor(archetype: string): ChannelProfile {
  const channel = channelPresets.find(c => c.archetype === archetype);
  if (!channel) throw new Error(`no channel preset for archetype ${archetype}`);
  return channel;
}

async function finalizeFor(archetype: string) {
  const channel = channelFor(archetype);
  const opts = makeOptions({ channel, songCount: 6, lyricLanguage: channel.archetype?.startsWith('jp') ? 'japanese' : channel.archetype?.startsWith('kr') || channel.archetype === 'senior-morning' ? 'korean' : 'english' });
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
  const slots = slotsForOptions(opts);
  const snapshot = buildGenerationSnapshot({ options: opts, provider: { provider: 'local', model: '', temperature: 0.7, batchSize: 1, keyStorageMode: 'session', apiKey: '' } as never, season: testSeason, slots });
  const workspaceId = workspaceForArchetype(channel.archetype)!.id;
  const audienceProfile = audienceProfileForChannelArchetype(channel.archetype, opts.audience);
  const finalized = await finalizeBlueprintForUse(blueprint, snapshot, {
    conceptLabel: opts.customConcept || opts.projectTitle,
    audienceProfile,
    lyricLanguage: opts.lyricLanguage,
    channel,
    workspaceId
  });
  return { finalized, opts };
}

describe.each(WORKSPACE_ARCHETYPES)('[codex 지시문 05 TASK B] finalizeBlueprintForUse — %s', archetype => {
  it('runs the full 10-step pipeline and returns a real, non-empty result', async () => {
    const { finalized } = await finalizeFor(archetype);
    expect(finalized.blueprint.songs.length).toBe(6);
    expect(finalized.schemaIssues).toEqual([]);
    expect(finalized.trackNoValidation.valid).toBe(true);
    expect(finalized.slotReconciliation.ok).toBe(true);
    expect(finalized.albumAudit).toBeTruthy();
    expect(finalized.releaseReadiness.items.length).toBeGreaterThan(0);
    expect(finalized.artifactMeta.stage).toBeTruthy();
  });

  it('never leaves the conceptFitScore placeholder unscored — every song has a real scores object', async () => {
    const { finalized } = await finalizeFor(archetype);
    for (const song of finalized.blueprint.songs) {
      expect(song.scores).toBeTruthy();
      expect(typeof song.scores!.conceptFitScore).toBe('number');
    }
  });

  it('the result is frozen (step 9 — immutable result)', async () => {
    const { finalized } = await finalizeFor(archetype);
    expect(Object.isFrozen(finalized)).toBe(true);
  });

  it('artifact stage never exceeds lyrics-prompt-ready without an explicit audio confirmation', async () => {
    const { finalized } = await finalizeFor(archetype);
    expect(finalized.artifactMeta.stage).not.toBe('release-ready');
  });

  it('artifactMeta carries real, non-empty version fields', async () => {
    const { finalized } = await finalizeFor(archetype);
    expect(finalized.artifactMeta.scorerVersion).toBeTruthy();
    expect(finalized.artifactMeta.auditSchemaVersion).toBeTruthy();
    expect(finalized.artifactMeta.workspacePolicyVersion).toBeTruthy();
  });
});

describe('[codex 지시문 05 TASK B] validateBlueprintSchema / reconcileSlotsForFinalize — real gap detection', () => {
  it('flags a real missing-lyrics song', async () => {
    const { finalized } = await finalizeFor('kr-2030-pop');
    const broken = { ...finalized.blueprint, songs: finalized.blueprint.songs.map((s, i) => (i === 0 ? { ...s, lyrics: '' } : s)) };
    expect(validateBlueprintSchema(broken).some(issue => issue.includes('lyrics'))).toBe(true);
  });

  it('flags real slot drift when a song trackNo has no matching planned slot', async () => {
    const { finalized } = await finalizeFor('kr-idol-male');
    const driftedSnapshot = { ...finalized.snapshot, slots: finalized.snapshot.slots.filter(s => s.trackNo !== 1) };
    const result = reconcileSlotsForFinalize(finalized.blueprint, driftedSnapshot);
    expect(result.ok).toBe(false);
    expect(result.drift.some(d => d.includes('T1'))).toBe(true);
  });
});
