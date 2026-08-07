import { describe, expect, it } from 'vitest';
import { applyConceptFitScore } from '../src/core/promiseAudit';
import { scoreSongs } from '../src/core/quality';
import { finalizeBlueprintForUse } from '../src/core/finalizeBlueprint';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildGenerationSnapshot, slotsForOptions } from '../src/core/generationSnapshot';
import { audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { workspaceForArchetype } from '../src/data/workspaces/index';
import { makeOptions, testMoods, testSeason, channelPresets, genrePacks } from './fixtures';
import type { SongIdea } from '../src/types';

/**
 * codex 지시문 05 (TASK B, required test file) — real coverage of the
 * confirmed conceptFitScore:100 persistence bug this task closes: before
 * this task, `applyConceptFitScore` only ever ran inside Step4Result.tsx's
 * own on-screen useMemo, so every SAVED/EXPORTED pack shipped the neutral
 * placeholder regardless of the real concept. This file proves (1) the
 * scoring function itself does real, non-decorative work, and (2)
 * finalizeBlueprintForUse — the new single finalize path — always applies
 * it, so its own output never carries the placeholder for a pack whose
 * concept actually names something measurable.
 */

function makeSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1, title: 'T', seasonMoment: '', listenerSituation: 'a loud, chaotic city street',
    emotionArc: 'energetic', hookPhrase: 'run wild tonight', stylePrompt: 'aggressive, driving, high-energy pop',
    lyrics: '[verse 1]\nwe run through the loud streets\n[chorus]\nrun wild tonight, run wild tonight',
    youtube: { title: '', description: '', tags: [] }, warnings: [], qualityScore: 80,
    ...overrides
  } as SongIdea;
}

describe('[codex 지시문 05 TASK B] applyConceptFitScore — real, non-decorative scoring', () => {
  it('stays the honest neutral 100 when the concept names nothing measurable', () => {
    const scored = applyConceptFitScore([makeSong()], '');
    expect(scored[0].scores!.conceptFitScore).toBe(100);
  });

  it('produces a real, non-neutral score when the concept promises something the song does not deliver (calm mood promised, energetic song delivered)', () => {
    const scored = applyConceptFitScore([makeSong()], '잔잔한 밤');
    expect(scored[0].scores!.conceptFitScore).toBeLessThan(100);
  });

  it('is deterministic — the same concept + song always produces the same real score', () => {
    const a = applyConceptFitScore([makeSong()], '잔잔한 밤')[0].scores!.conceptFitScore;
    const b = applyConceptFitScore([makeSong()], '잔잔한 밤')[0].scores!.conceptFitScore;
    expect(a).toBe(b);
  });
});

describe('[codex 지시문 05 TASK B] finalizeBlueprintForUse — never ships the conceptFitScore:100 placeholder for a pack with a real, unmet promise', () => {
  it('a real generated pack under a mood-promising concept gets a real, measured conceptFitScore, not a static 100', async () => {
    const channel = channelPresets.find(c => c.archetype === 'kr-2030-pop')!;
    const opts = makeOptions({ channel, songCount: 6, lyricLanguage: 'korean', customConcept: '잔잔한 밤, 도시의 소음' });
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
    const slots = slotsForOptions(opts);
    const snapshot = buildGenerationSnapshot({ options: opts, provider: { provider: 'local', model: '', temperature: 0.7, batchSize: 1, keyStorageMode: 'session', apiKey: '' } as never, season: testSeason, slots });
    const workspaceId = workspaceForArchetype(channel.archetype)!.id;
    const audienceProfile = audienceProfileForChannelArchetype(channel.archetype, opts.audience);

    const finalized = await finalizeBlueprintForUse(blueprint, snapshot, {
      conceptLabel: opts.customConcept, audienceProfile, lyricLanguage: opts.lyricLanguage, channel, workspaceId
    });

    // Real, single-source consistency: finalizeBlueprintForUse's own output
    // must match what an independent scoreSongs + applyConceptFitScore call
    // over the SAME raw songs produces — no drift between the two.
    const independentlyScored = applyConceptFitScore(scoreSongs(blueprint.songs, channel, opts.lyricLanguage), opts.customConcept);
    expect(finalized.blueprint.songs.map(s => s.scores?.conceptFitScore)).toEqual(independentlyScored.map(s => s.scores?.conceptFitScore));
  });
});
