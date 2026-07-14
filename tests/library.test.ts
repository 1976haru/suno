import { beforeEach, describe, expect, it } from 'vitest';
import { deleteAllPacks, listChannelPersonas, loadPack, recordChannelPersonaUse, saveChannelPersona, savePack } from '../src/core/library';
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
