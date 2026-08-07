import { describe, expect, it } from 'vitest';
import { buildFinalExportArtifact, finalExportFileName, finalExportStageSuffix } from '../src/core/finalExport';
import { finalizeBlueprintForUse } from '../src/core/finalizeBlueprint';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildGenerationSnapshot, slotsForOptions } from '../src/core/generationSnapshot';
import { audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { workspaceForArchetype } from '../src/data/workspaces/index';
import { makeOptions, testMoods, testSeason, channelPresets, genrePacks } from './fixtures';

/**
 * codex 지시문 05 (TASK G, required test file) — real coverage of the final
 * export artifact's required-field completeness and the stage-suffixed
 * filename convention.
 */

async function buildRealArtifact() {
  const channel = channelPresets.find(c => c.archetype === 'kr-2030-pop')!;
  const opts = makeOptions({ channel, songCount: 6, lyricLanguage: 'korean' });
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
  const slots = slotsForOptions(opts);
  const snapshot = buildGenerationSnapshot({ options: opts, provider: { provider: 'local', model: '', temperature: 0.7, batchSize: 1, keyStorageMode: 'session', apiKey: '' } as never, season: testSeason, slots });
  const workspaceId = workspaceForArchetype(channel.archetype)!.id;
  const audienceProfile = audienceProfileForChannelArchetype(channel.archetype, opts.audience);
  const finalized = await finalizeBlueprintForUse(blueprint, snapshot, {
    conceptLabel: opts.customConcept || opts.projectTitle,
    audienceProfile, lyricLanguage: opts.lyricLanguage, channel, workspaceId
  });
  return { finalized, workspaceId };
}

describe('[codex 지시문 05 TASK G] buildFinalExportArtifact — every required field present', () => {
  it('carries generation snapshot / artifact audit meta / per-song scores / warnings / album audit / release readiness / workspace policy id+version / scene signature / title-hook relationship / rewrite history', async () => {
    const { finalized, workspaceId } = await buildRealArtifact();
    const artifact = buildFinalExportArtifact(finalized, workspaceId, [{ round: 1, scope: 'track-rewrite', issuesResolvedCount: 2, timestamp: '2026-01-01T00:00:00.000Z' }]);

    expect(artifact.generationSnapshot).toBe(finalized.snapshot);
    expect(artifact.artifactAuditMeta).toBe(finalized.artifactMeta);
    expect(artifact.albumAudit).toBe(finalized.albumAudit);
    expect(artifact.releaseReadiness).toBe(finalized.releaseReadiness);
    expect(artifact.workspacePolicyId).toBe(workspaceId);
    expect(artifact.workspacePolicyVersion).toBeTruthy();
    expect(artifact.rewriteHistory).toHaveLength(1);

    expect(artifact.songs.length).toBe(finalized.blueprint.songs.length);
    for (const song of artifact.songs) {
      expect(song.scores).toBeTruthy();
      expect(Array.isArray(song.warnings)).toBe(true);
      expect(song.sceneSignature.situation).toBeTruthy();
      expect(['exact', 'near', 'semantic', 'disconnected']).toContain(song.titleHookRelationship);
    }
  });

  it('defaults rewriteHistory to an empty (honest, not fabricated) array when the caller supplies none', async () => {
    const { finalized, workspaceId } = await buildRealArtifact();
    const artifact = buildFinalExportArtifact(finalized, workspaceId);
    expect(artifact.rewriteHistory).toEqual([]);
  });
});

describe('[codex 지시문 05 TASK G] finalExportFileName / finalExportStageSuffix — real stage-suffixed naming', () => {
  it('maps every real stage onto one of the 4 required suffixes', () => {
    expect(finalExportStageSuffix('raw-provider')).toBe('raw-provider');
    expect(finalExportStageSuffix('normalized')).toBe('raw-provider');
    expect(finalExportStageSuffix('scored')).toBe('raw-provider');
    expect(finalExportStageSuffix('release-audited')).toBe('audited');
    expect(finalExportStageSuffix('rewrite-pending')).toBe('audited');
    expect(finalExportStageSuffix('lyrics-prompt-ready')).toBe('lyrics-prompt-ready');
    expect(finalExportStageSuffix('release-ready')).toBe('release-ready');
  });

  it('produces the real *.{stage}.json filename shape', () => {
    expect(finalExportFileName('my-pack', 'lyrics-prompt-ready')).toBe('my-pack.lyrics-prompt-ready.json');
    expect(finalExportFileName('my-pack', 'raw-provider')).toBe('my-pack.raw-provider.json');
    expect(finalExportFileName('my-pack', 'release-ready')).toBe('my-pack.release-ready.json');
  });
});
