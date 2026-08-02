import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteAllPacks, loadPack, savePack, saveAutosave } from '../src/core/library';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

// v3.79 (TASK D) — integration test for core/library.ts's savePack set-code
// assignment: the real path a saved pack actually goes through (unlike
// tests/setCode.test.ts's pure-function tests of core/setCode.ts alone).

describe('[v3.79 TASK D] savePack set-code assignment', () => {
  beforeEach(async () => {
    await deleteAllPacks();
  });

  it('assigns a set code with today\'s date and sequence 01 on first save', async () => {
    const opts = makeOptions({ songCount: 3 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const id = await savePack({ blueprint, options: opts, name: 'Pack One' });
    const loaded = await loadPack(id);
    const todayCode = `S${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`;
    expect(loaded?.blueprint.meta?.setCode).toBe(`${todayCode}-01`);
    expect(loaded?.setCode).toBe(`${todayCode}-01`);
  });

  it('two packs saved the same day get sequence 01 then 02', async () => {
    const opts = makeOptions({ songCount: 3 });
    const bp1 = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const bp2 = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const id1 = await savePack({ blueprint: bp1, options: opts, name: 'Pack One' });
    const id2 = await savePack({ blueprint: bp2, options: opts, name: 'Pack Two' });
    const loaded1 = await loadPack(id1);
    const loaded2 = await loadPack(id2);
    expect(loaded1?.blueprint.meta?.setCode).not.toBe(loaded2?.blueprint.meta?.setCode);
    const seq1 = Number(loaded1?.blueprint.meta?.setCode?.split('-')[1]);
    const seq2 = Number(loaded2?.blueprint.meta?.setCode?.split('-')[1]);
    expect(seq2).toBe(seq1 + 1);
  });

  it('stamps every song with a songCode built from the set code and its trackNo', async () => {
    const opts = makeOptions({ songCount: 3 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const id = await savePack({ blueprint, options: opts, name: 'Pack One' });
    const loaded = await loadPack(id);
    const setCode = loaded?.blueprint.meta?.setCode;
    expect(setCode).toBeTruthy();
    for (const song of loaded!.blueprint.songs) {
      expect(song.songCode).toBe(`${setCode}-T${String(song.trackNo).padStart(2, '0')}`);
    }
  });

  it('never reassigns a set code on a second save of the same pack (rename)', async () => {
    const opts = makeOptions({ songCount: 2 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const id = await savePack({ blueprint, options: opts, name: 'Original Name' });
    const firstLoad = await loadPack(id);
    const firstCode = firstLoad?.blueprint.meta?.setCode;
    // Re-save under the same id with the already-coded blueprint (mirrors renamePack's own savePack({ ...pack, id, name }) call).
    await savePack({ blueprint: firstLoad!.blueprint, options: opts, id, name: 'Renamed' });
    const secondLoad = await loadPack(id);
    expect(secondLoad?.blueprint.meta?.setCode).toBe(firstCode);
  });

  it('never assigns a set code to an autosave, and never consumes a sequence number for one', async () => {
    const opts = makeOptions({ songCount: 2 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    await saveAutosave(blueprint, opts);
    // A real save made afterward should still get sequence 01 — the autosave must not have consumed it.
    const realBlueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const id = await savePack({ blueprint: realBlueprint, options: opts, name: 'Real Pack' });
    const loaded = await loadPack(id);
    expect(loaded?.blueprint.meta?.setCode?.endsWith('-01')).toBe(true);
  });
});
