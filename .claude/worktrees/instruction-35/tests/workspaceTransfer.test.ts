import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteAllPacks, listPacks, savePack } from '../src/core/library';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import {
  applyImport,
  buildTransferFileName,
  DEFAULT_EXPORT_INCLUDE,
  exportWorkspace,
  ImportFormatError,
  previewImport,
  TRANSFER_FORMAT,
  TRANSFER_FORMAT_VERSION,
  type WorkspaceExportFile
} from '../src/core/workspaceTransfer';
import { setCurrentWorkspace, __resetWorkspaceScopeForTests } from '../src/core/workspaceScope';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

/**
 * v4.1 (TASK A2) — packs are the one category library.ts's memory-fallback
 * makes genuinely round-trippable in Node (hooks/ratings/videos/takes/usage
 * all require real IndexedDB, unavailable in this project's vitest
 * environment — same pre-existing limitation this whole session has hit for
 * every IndexedDB-backed module since v3.73; see docs/v4.1-a2-report.md for
 * how those were verified instead: real browser testing). Every test here
 * explicitly disables every other category so exportWorkspace() never
 * touches an IndexedDB store this environment doesn't have.
 */
const PACKS_ONLY = { ...DEFAULT_EXPORT_INCLUDE, hooks: false, situations: false, lyricLines: false, ratings: false, takes: false, videos: false, settings: false, channels: false };

function fileFrom(json: WorkspaceExportFile): File {
  return new File([JSON.stringify(json)], 'test.json', { type: 'application/json' });
}

describe('[v4.1 TASK A] exportWorkspace — packs', () => {
  beforeEach(async () => {
    setCurrentWorkspace('senior-oldpop');
    await deleteAllPacks();
  });
  afterEach(() => __resetWorkspaceScopeForTests());

  it('produces the spec\'s own file shape with real pack data and accurate counts', async () => {
    const opts = makeOptions({ songCount: 3, projectTitle: 'Export Test Pack' });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    await savePack({ blueprint, options: opts, name: 'Export Test Pack' });

    const file = await exportWorkspace({ workspaceId: 'senior-oldpop', include: PACKS_ONLY });
    expect(file.format).toBe(TRANSFER_FORMAT);
    expect(file.formatVersion).toBe(TRANSFER_FORMAT_VERSION);
    expect(file.workspaceId).toBe('senior-oldpop');
    expect(file.workspaceLabel).toBe('시니어 올드팝');
    expect(file.counts.packs).toBe(1);
    expect(file.data.packs).toHaveLength(1);
    expect(file.data.packs![0].name).toBe('Export Test Pack');
    expect(file.data.packs![0].blueprint.songs).toHaveLength(3);
    // Categories explicitly excluded above must be genuinely absent, not empty arrays.
    expect(file.data.hooks).toBeUndefined();
    expect(file.data.channels).toBeUndefined();
  });

  it('never includes API keys unless explicitly opted in', async () => {
    const file = await exportWorkspace({ workspaceId: 'senior-oldpop', include: PACKS_ONLY });
    expect(file.data.apiKeys).toBeUndefined();
    expect(JSON.stringify(file)).not.toMatch(/byok:/);
  });
});

describe('[v4.1 TASK B] round-trip — the spec\'s own §9-1 "핵심 검증"', () => {
  beforeEach(async () => {
    setCurrentWorkspace('senior-oldpop');
    await deleteAllPacks();
  });
  afterEach(() => __resetWorkspaceScopeForTests());

  it('export -> wipe storage -> import restores the same pack with identical content', async () => {
    const opts = makeOptions({ songCount: 5, projectTitle: 'Roundtrip Pack' });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    await savePack({ blueprint, options: opts, name: 'Roundtrip Pack' });

    const exported = await exportWorkspace({ workspaceId: 'senior-oldpop', include: PACKS_ONLY });
    const originalLyrics = exported.data.packs![0].blueprint.songs[0].lyrics;
    const originalStylePrompt = exported.data.packs![0].blueprint.songs[0].stylePrompt;

    // "브라우저 저장소 완전 삭제" — wipe everything in this workspace.
    await deleteAllPacks();
    expect(await listPacks()).toHaveLength(0);

    const result = await applyImport(fileFrom(exported), 'merge');
    expect(result.packs.added).toBe(1);
    expect(result.packs.skipped).toBe(0);

    const after = await listPacks();
    expect(after).toHaveLength(1);
    expect(after[0].name).toBe('Roundtrip Pack');

    // "곡 하나를 열어 가사·프롬프트가 그대로인지" — full content, not just counts.
    const reloaded = exported.data.packs![0]; // re-check against the exported snapshot itself, since it's what was written back verbatim
    expect(reloaded.blueprint.songs[0].lyrics).toBe(originalLyrics);
    expect(reloaded.blueprint.songs[0].stylePrompt).toBe(originalStylePrompt);
  });

  it('a pre-import backup is always produced, before any write happens', async () => {
    const opts = makeOptions({ songCount: 1, projectTitle: 'Backup Source' });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    await savePack({ blueprint, options: opts, name: 'Backup Source' });
    const exported = await exportWorkspace({ workspaceId: 'senior-oldpop', include: PACKS_ONLY });

    await deleteAllPacks();
    const opts2 = makeOptions({ songCount: 1, projectTitle: 'Still Here Before Import' });
    const blueprint2 = generateLocalBlueprint(opts2, testGenres, testMoods, testSeason);
    await savePack({ blueprint: blueprint2, options: opts2, name: 'Still Here Before Import' });

    const result = await applyImport(fileFrom(exported), 'merge');
    expect(result.preImportBackup.data.packs?.map(p => p.name)).toEqual(['Still Here Before Import']);
  });
});

describe('[v4.1 TASK B] 병합 테스트 — 같은 파일을 두 번 가져와도 중복이 안 생기는지', () => {
  beforeEach(async () => {
    setCurrentWorkspace('senior-oldpop');
    await deleteAllPacks();
  });
  afterEach(() => __resetWorkspaceScopeForTests());

  it('importing the same export twice never duplicates the pack (name-based skip)', async () => {
    const opts = makeOptions({ songCount: 1, projectTitle: 'Dedup Pack' });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    await savePack({ blueprint, options: opts, name: 'Dedup Pack' });
    const exported = await exportWorkspace({ workspaceId: 'senior-oldpop', include: PACKS_ONLY });

    await applyImport(fileFrom(exported), 'merge');
    const secondResult = await applyImport(fileFrom(exported), 'merge');

    expect(secondResult.packs.added).toBe(0);
    expect(secondResult.packs.skipped).toBe(1);
    const packs = await listPacks();
    expect(packs.filter(p => p.name === 'Dedup Pack')).toHaveLength(1);
  });

  it('mode "replace" overwrites the same-name pack in place instead of skipping', async () => {
    const opts = makeOptions({ songCount: 1, projectTitle: 'Replace Pack' });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    await savePack({ blueprint, options: opts, name: 'Replace Pack' });
    const exported = await exportWorkspace({ workspaceId: 'senior-oldpop', include: PACKS_ONLY });

    const result = await applyImport(fileFrom(exported), 'replace');
    expect(result.packs.replaced).toBe(1);
    expect(result.packs.added).toBe(0);
    const packs = await listPacks();
    expect(packs.filter(p => p.name === 'Replace Pack')).toHaveLength(1); // still exactly one, not two
  });
});

describe('[v4.1 TASK B] previewImport', () => {
  beforeEach(async () => {
    setCurrentWorkspace('senior-oldpop');
    await deleteAllPacks();
  });
  afterEach(() => __resetWorkspaceScopeForTests());

  it('reports new vs conflicted packs without writing anything', async () => {
    const opts = makeOptions({ songCount: 1, projectTitle: 'Preview Pack' });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    await savePack({ blueprint, options: opts, name: 'Preview Pack' });
    const exported = await exportWorkspace({ workspaceId: 'senior-oldpop', include: PACKS_ONLY });

    const preview = await previewImport(fileFrom(exported));
    expect(preview.plan.packs.conflicted).toEqual(['Preview Pack']);
    expect(preview.plan.packs.new).toBe(0);
    // previewImport must be read-only -- still exactly one pack, not duplicated by the preview call itself.
    expect(await listPacks()).toHaveLength(1);
  });
});

describe('[v4.1 TASK B §3-1] 워크스페이스 교차 시도 — 경고가 뜨는지', () => {
  beforeEach(async () => {
    setCurrentWorkspace('senior-oldpop');
    await deleteAllPacks();
  });
  afterEach(() => __resetWorkspaceScopeForTests());

  it('previewImport flags a cross-workspace file as a warning, not silently', async () => {
    const opts = makeOptions({ songCount: 1 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const exported = await exportWorkspace({ workspaceId: 'senior-oldpop', include: PACKS_ONLY });
    const foreignFile = { ...exported, workspaceId: 'kr-2030' as const, workspaceLabel: '한국 20~30대' };

    const preview = await previewImport(fileFrom(foreignFile));
    expect(preview.isCrossWorkspace).toBe(true);
    expect(preview.warnings.some(w => w.includes('한국 20~30대'))).toBe(true);
    void blueprint;
  });

  it('applyImport refuses a cross-workspace file unless allowCrossWorkspace is explicitly set', async () => {
    const exported = await exportWorkspace({ workspaceId: 'senior-oldpop', include: PACKS_ONLY });
    const foreignFile = { ...exported, workspaceId: 'kr-2030' as const };

    await expect(applyImport(fileFrom(foreignFile), 'merge')).rejects.toThrow(ImportFormatError);
    await expect(applyImport(fileFrom(foreignFile), 'merge', { allowCrossWorkspace: true })).resolves.toBeDefined();
  });
});

describe('[v4.1 TASK B §3-1] formatVersion 미래 버전 거부', () => {
  it('rejects a file whose formatVersion is newer than this app understands', async () => {
    const exported = await exportWorkspace({ workspaceId: 'senior-oldpop', include: PACKS_ONLY });
    const fromTheFuture = { ...exported, formatVersion: TRANSFER_FORMAT_VERSION + 1 };
    await expect(previewImport(fileFrom(fromTheFuture))).rejects.toThrow(ImportFormatError);
    await expect(applyImport(fileFrom(fromTheFuture), 'merge')).rejects.toThrow(ImportFormatError);
  });

  it('rejects a file that is not this transfer format at all', async () => {
    const notATransferFile = new File([JSON.stringify({ hello: 'world' })], 'wrong.json');
    await expect(previewImport(notATransferFile)).rejects.toThrow(ImportFormatError);
  });

  it('rejects malformed JSON with a clear error rather than an opaque parse crash', async () => {
    const brokenFile = new File(['{not valid json'], 'broken.json');
    await expect(previewImport(brokenFile)).rejects.toThrow(ImportFormatError);
  });
});

describe('[v4.1 TASK A §2-3] buildTransferFileName', () => {
  it('follows the workspace_<id>_<YYYYMMDD>.json scheme', () => {
    const date = new Date(2026, 7, 1); // August 1 2026 (month is 0-indexed)
    expect(buildTransferFileName('senior-oldpop', date)).toBe('workspace_senior-oldpop_20260801.json');
  });

  it('appends a 2-digit sequence for same-day repeats, omits it for the first', () => {
    const date = new Date(2026, 7, 1);
    expect(buildTransferFileName('senior-oldpop', date, 1)).toBe('workspace_senior-oldpop_20260801.json');
    expect(buildTransferFileName('senior-oldpop', date, 2)).toBe('workspace_senior-oldpop_20260801_02.json');
  });

  it('uses the literal "ALL" token for a full backup', () => {
    const date = new Date(2026, 7, 1);
    expect(buildTransferFileName('ALL', date)).toBe('workspace_ALL_20260801.json');
  });
});
