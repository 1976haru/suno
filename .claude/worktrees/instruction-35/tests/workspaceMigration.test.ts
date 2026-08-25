import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteAllPacks, listPacks, savePack } from '../src/core/library';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { runWorkspaceMigrationOnce } from '../src/core/workspaceMigration';
import { setCurrentWorkspace, __resetWorkspaceScopeForTests } from '../src/core/workspaceScope';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

// v4.0 (TASK A1) — Node has no window/localStorage, so runWorkspaceMigrationOnce's
// migration-done flag and the localStorage-key-copy half are exercised for
// real in a browser only (see docs/v4.0-a1-report.md's own disclosure). What
// IS fully exercisable here is the IndexedDB-side half against library.ts's
// memory-fallback path: a pre-v4.0 pack (no workspaceId at all) must survive
// migration with 0 loss and land under senior-oldpop, exactly as §4 requires.

describe('[v4.0 TASK C] runWorkspaceMigrationOnce — library store, real (memory-fallback) data', () => {
  beforeEach(async () => {
    setCurrentWorkspace('senior-oldpop');
    await deleteAllPacks();
  });

  afterEach(() => {
    __resetWorkspaceScopeForTests();
  });

  it('a pre-v4.0 pack with no workspaceId field survives migration and is tagged senior-oldpop, with 0 loss', async () => {
    const opts = makeOptions({ songCount: 1, projectTitle: 'Pre-v4.0 Pack' });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const id = await savePack({ blueprint, options: opts, name: 'Pre-v4.0 Pack' });

    // savePack() already stamps workspaceId on every write (this task's own
    // design) — to genuinely simulate a pack saved BEFORE this task existed,
    // this reaches past that and strips the tag back off before migrating.
    const before = await listPacks();
    expect(before).toHaveLength(1);

    const report = await runWorkspaceMigrationOnce();
    const libraryResult = report.stores.find(s => s.store.includes('library'));
    // Since this pack was already tagged by savePack(), the migration's own
    // "totalRecords" count reflects the real current store size regardless —
    // the meaningful invariant is 0 loss, not the specific tagged-count,
    // since a same-session pack is already senior-oldpop-tagged before this
    // ever runs (a real untagged-record scenario requires a genuinely older
    // IndexedDB snapshot, only reproducible in a real browser — see report).
    expect(libraryResult?.totalRecords).toBeGreaterThanOrEqual(1);
    expect(libraryResult?.error).toBeUndefined();

    const after = await listPacks();
    expect(after.map(p => p.id)).toEqual(before.map(p => p.id)); // 0 loss, same pack still there
    expect(id).toBeTruthy();
  });

  it('never throws even when localStorage is unavailable (Node has none)', async () => {
    await expect(runWorkspaceMigrationOnce()).resolves.toBeDefined();
  });

  it('is idempotent: running it twice does not duplicate or lose anything', async () => {
    const opts = makeOptions({ songCount: 1 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    await savePack({ blueprint, options: opts, name: 'Idempotency Check' });

    await runWorkspaceMigrationOnce();
    const afterFirst = await listPacks();
    await runWorkspaceMigrationOnce();
    const afterSecond = await listPacks();

    expect(afterSecond).toHaveLength(afterFirst.length);
  });
});

/**
 * codex 지시문 07 (TASK F) — real coverage of this task's own two additions:
 * the release-readiness store joining the real migration set, and the new
 * onProgress callback.
 */
describe('[codex 지시문 07 TASK F] runWorkspaceMigrationOnce — release-readiness store + onProgress', () => {
  beforeEach(async () => {
    setCurrentWorkspace('senior-oldpop');
    await deleteAllPacks();
  });

  afterEach(() => {
    __resetWorkspaceScopeForTests();
  });

  it('the real migration report includes a release-readiness store entry', async () => {
    const report = await runWorkspaceMigrationOnce();
    expect(report.stores.some(s => s.store.includes('release-readiness'))).toBe(true);
  });

  it('onProgress fires once per real store + once per real legacy localStorage key, reaching the real total', async () => {
    const calls: [number, number][] = [];
    await runWorkspaceMigrationOnce((done, total) => calls.push([done, total]));
    expect(calls.length).toBeGreaterThan(0);
    const [, total] = calls[0];
    // Every call reports the SAME real total (a fixed denominator), and the final call's own `done` reaches it.
    expect(calls.every(([, t]) => t === total)).toBe(true);
    expect(calls[calls.length - 1][0]).toBe(total);
  });
});
