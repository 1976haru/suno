import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteAllPacks,
  getPackPastedAt,
  getPackProgress,
  listChannelPersonas,
  loadPack,
  markTrackPasted,
  recordChannelPersonaUse,
  saveChannelPersona,
  savePack,
  setTrackProgress
} from '../src/core/library';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { buildSoundSignature } from '../src/core/soundSignature';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

describe('library persona persistence', () => {
  beforeEach(async () => {
    await deleteAllPacks();
  });

  it('saves and restores soundSignature and personaMode on SavedPack', async () => {
    const opts = makeOptions({ personaMode: true, songCount: 2 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const soundSignature = buildSoundSignature(blueprint, opts, opts.channel);
    const id = await savePack({
      blueprint,
      options: opts,
      name: 'Persona Pack',
      soundSignature,
      personaMode: true
    });
    const loaded = await loadPack(id);
    expect(loaded?.personaMode).toBe(true);
    expect(loaded?.options.personaMode).toBe(true);
    expect(loaded?.soundSignature?.personaName).toBe(soundSignature.personaName);
    expect(loaded?.soundSignature?.short).toBe(soundSignature.short);
  });

  it('[v3.33] saves and restores multi-set grouping metadata (setGroupId/setIndex/setTotal)', async () => {
    const opts = makeOptions({ songCount: 18, projectTitle: 'Weekly Pack Set 02' });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const id = await savePack({
      blueprint,
      options: opts,
      name: 'Weekly Pack Set 02',
      setGroupId: 'multiset-abc',
      setIndex: 1,
      setTotal: 5
    });
    const loaded = await loadPack(id);
    expect(loaded?.setGroupId).toBe('multiset-abc');
    expect(loaded?.setIndex).toBe(1);
    expect(loaded?.setTotal).toBe(5);
  });

  it('[v3.33] a single-pack (non-multi-set) save leaves setGroupId/setIndex/setTotal undefined', async () => {
    const opts = makeOptions({ songCount: 3 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const id = await savePack({ blueprint, options: opts, name: 'Single Pack' });
    const loaded = await loadPack(id);
    expect(loaded?.setGroupId).toBeUndefined();
    expect(loaded?.setIndex).toBeUndefined();
    expect(loaded?.setTotal).toBeUndefined();
  });

  it('stores and reuses channel persona names', async () => {
    const opts = makeOptions({ personaMode: true, songCount: 2 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const soundSignature = buildSoundSignature(blueprint, opts, opts.channel);
    await saveChannelPersona(opts.channel.id, soundSignature.personaName, soundSignature);
    let personas = await listChannelPersonas(opts.channel.id);
    expect(personas).toHaveLength(1);
    expect(personas[0].personaName).toBe(soundSignature.personaName);
    expect(personas[0].useCount).toBe(0);

    await recordChannelPersonaUse(opts.channel.id, soundSignature.personaName, soundSignature);
    personas = await listChannelPersonas(opts.channel.id);
    expect(personas[0].useCount).toBe(1);
    expect(personas[0].soundSignature?.short).toBe(soundSignature.short);
  });
});

// TASK v3.31 — SunoProgressMode's persistence layer: getPackProgress/
// setTrackProgress already existed for FocusMode (TASK G3, v3.7); markTrackPasted/
// getPackPastedAt are new. Both sets share one underlying record per packId,
// so the critical regression to guard is that writing one never silently
// wipes out the other (setTrackProgress must preserve pastedAt, and vice versa).
describe('[v3.31] pack progress + pasted-at persistence (shared record, no test previously existed for this)', () => {
  const packId = 'test-pack-progress';

  it('getPackProgress/getPackPastedAt return empty defaults for an unknown pack', async () => {
    expect(await getPackProgress('never-seen-pack')).toEqual([]);
    expect(await getPackPastedAt('never-seen-pack')).toEqual({});
  });

  it('setTrackProgress adds and removes a trackNo from the done list', async () => {
    let done = await setTrackProgress(packId, 3, true);
    expect(done).toEqual([3]);
    done = await setTrackProgress(packId, 1, true);
    expect(done).toEqual([1, 3]);
    done = await setTrackProgress(packId, 3, false);
    expect(done).toEqual([1]);
  });

  it('markTrackPasted records a timestamp without needing setTrackProgress first', async () => {
    const pastedAt = await markTrackPasted(packId, 5);
    expect(typeof pastedAt[5]).toBe('string');
    expect(new Date(pastedAt[5]).toString()).not.toBe('Invalid Date');
  });

  it('setTrackProgress does not wipe out pastedAt written earlier for the same pack', async () => {
    await markTrackPasted(packId, 7);
    await setTrackProgress(packId, 7, true);
    const pastedAt = await getPackPastedAt(packId);
    expect(typeof pastedAt[7]).toBe('string');
    const done = await getPackProgress(packId);
    expect(done).toContain(7);
  });

  it('markTrackPasted does not wipe out doneTrackNos written earlier for the same pack', async () => {
    await setTrackProgress(packId, 9, true);
    await markTrackPasted(packId, 9);
    const done = await getPackProgress(packId);
    expect(done).toContain(9);
  });
});
