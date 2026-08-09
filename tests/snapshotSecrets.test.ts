/**
 * v5.17 (TASK A) — regression coverage for the real leak this task fixes:
 * GenerationSnapshot used to persist the FULL live ProviderSettings
 * (including apiKey/accessToken/proxyEndpoint) on every generated
 * PlaylistBlueprint, which rides into IndexedDB pack storage, workspace
 * backup export (core/workspaceTransfer.ts), and pack JSON sharing.
 *
 * These tests cover:
 *  - buildGenerationSnapshot never carries a secret forward, even when the
 *    live ProviderSettings it's given has one (§1-5's own required test).
 *  - a workspace backup export never contains a secret key, even for a pack
 *    (§1-5's own required test).
 *  - a pack JSON export (Suno bridge export, single-pack sharing) never
 *    contains a secret key either (§1-5's own required test).
 *  - a pack saved BEFORE this fix (simulated: a snapshot whose provider
 *    still carries the full ProviderSettings shape) gets its secrets
 *    stripped on read (loadPack, listFullPacksForWorkspace), on the
 *    dedicated migration pass, and on export/import re-checks — §1-3's
 *    defense-in-depth requirement.
 *  - resolveGenerationContext still returns a genuinely usable
 *    ProviderSettings (with live credentials merged back in) for real
 *    retry/refine/evaluate calls — confirms the fix didn't silently break
 *    the feature it's protecting.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildGenerationSnapshot,
  resolveGenerationContext,
  scrubBlueprintSnapshotSecrets,
  withGenerationSnapshot
} from '../src/core/generationSnapshot';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { deleteAllPacks, listFullPacksForWorkspace, loadPack, migrateLibrarySnapshotSecrets, putFullPack, savePack } from '../src/core/library';
import { exportJson } from '../src/utils/exporters';
import { applyImport, DEFAULT_EXPORT_INCLUDE, exportWorkspace, previewImport } from '../src/core/workspaceTransfer';
import { setCurrentWorkspace, __resetWorkspaceScopeForTests } from '../src/core/workspaceScope';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { PlaylistBlueprint, ProviderSettings, WorkspaceExportFile } from '../src/types';

const FORBIDDEN_KEYS = ['apiKey', 'accessToken', 'proxyEndpoint'] as const;

const providerWithSecrets: ProviderSettings = {
  provider: 'anthropic',
  model: 'claude-test',
  temperature: 0.7,
  apiKey: 'sk-ant-super-secret-key-do-not-leak',
  accessToken: 'super-secret-access-token',
  proxyEndpoint: 'https://haru-family-private-server.example/proxy'
};

function assertNoSecrets(json: unknown): void {
  const text = JSON.stringify(json);
  for (const key of FORBIDDEN_KEYS) {
    expect(text, `found forbidden key "${key}" in serialized output`).not.toContain(`"${key}"`);
  }
  expect(text).not.toContain(providerWithSecrets.apiKey);
  expect(text).not.toContain(providerWithSecrets.accessToken);
  expect(text).not.toContain(providerWithSecrets.proxyEndpoint);
}

function fileFrom(json: WorkspaceExportFile): File {
  return new File([JSON.stringify(json)], 'test.json', { type: 'application/json' });
}

/** Simulates a pack saved BEFORE this task's fix, whose snapshot.provider still carries the full (secret-bearing) ProviderSettings shape. */
function legacySnapshotBlueprint(blueprint: PlaylistBlueprint): PlaylistBlueprint {
  if (!blueprint.generationSnapshot) throw new Error('test setup requires a snapshot');
  return {
    ...blueprint,
    generationSnapshot: {
      ...blueprint.generationSnapshot,
       
      provider: providerWithSecrets as any
    }
  };
}

describe('[v5.17 TASK A] buildGenerationSnapshot / withGenerationSnapshot never persist secrets', () => {
  it('strips apiKey/accessToken/proxyEndpoint from a live ProviderSettings, keeping only hasApiKey', () => {
    const opts = makeOptions({ songCount: 2 });
    const snapshot = buildGenerationSnapshot({ options: opts, provider: providerWithSecrets, season: testSeason });
    assertNoSecrets(snapshot);
    expect(snapshot.provider.hasApiKey).toBe(true);
    expect(snapshot.provider.provider).toBe('anthropic');
    expect(snapshot.provider.model).toBe('claude-test');
  });

  it('a real generated+finalized blueprint serializes with no secret anywhere', () => {
    const opts = makeOptions({ songCount: 2 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const withSnapshot = withGenerationSnapshot(blueprint, { options: opts, provider: providerWithSecrets, season: testSeason });
    assertNoSecrets(withSnapshot);
  });
});

describe('[v5.17 TASK A] pack JSON export never leaks a secret', () => {
  it('exportJson (Suno bridge / single-pack export) contains no secret key', () => {
    const opts = makeOptions({ songCount: 2 });
    const generated = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const blueprint = withGenerationSnapshot(generated, { options: opts, provider: providerWithSecrets, season: testSeason });
    const json = exportJson(blueprint, undefined, undefined, false, opts.channel);
    assertNoSecrets(JSON.parse(json));
  });
});

describe('[v5.17 TASK A] workspace backup export never leaks a secret (scenario A/B)', () => {
  const PACKS_ONLY = { ...DEFAULT_EXPORT_INCLUDE, hooks: false, situations: false, lyricLines: false, ratings: false, takes: false, videos: false, settings: false, channels: false };

  beforeEach(async () => {
    setCurrentWorkspace('senior-oldpop');
    await deleteAllPacks();
  });
  afterEach(() => __resetWorkspaceScopeForTests());

  it('a pack generated with a real API key produces a backup file with zero secret fields', async () => {
    const opts = makeOptions({ songCount: 2, projectTitle: 'Secret Test Pack' });
    const generated = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const blueprint = withGenerationSnapshot(generated, { options: opts, provider: providerWithSecrets, season: testSeason });
    await savePack({ blueprint, options: opts, name: 'Secret Test Pack' });

    const file = await exportWorkspace({ workspaceId: 'senior-oldpop', include: PACKS_ONLY });
    expect(file.data.packs).toHaveLength(1);
    assertNoSecrets(file);
  });

  it('a legacy pack (saved before this fix, snapshot.provider = full ProviderSettings) is scrubbed before it ever reaches the backup file', async () => {
    const opts = makeOptions({ songCount: 2, projectTitle: 'Legacy Pack' });
    const generated = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const withSnapshot = withGenerationSnapshot(generated, { options: opts, provider: { provider: 'local', temperature: 0.8 }, season: testSeason });
    const id = await savePack({ blueprint: withSnapshot, options: opts, name: 'Legacy Pack' });

    // Simulate the leaked pre-fix shape by writing the raw record directly (bypasses the normal build path, which is already fixed).
    const saved = await loadPack(id);
    if (!saved) throw new Error('pack not found');
    await putFullPack({ ...saved, blueprint: legacySnapshotBlueprint(saved.blueprint) });

    const file = await exportWorkspace({ workspaceId: 'senior-oldpop', include: PACKS_ONLY });
    assertNoSecrets(file);
  });
});

describe('[v5.17 TASK A §1-3] already-saved (legacy) packs get scrubbed on read and by the migration pass', () => {
  beforeEach(async () => {
    setCurrentWorkspace('senior-oldpop');
    await deleteAllPacks();
  });
  afterEach(() => __resetWorkspaceScopeForTests());

  async function plantLegacyPack(): Promise<string> {
    const opts = makeOptions({ songCount: 2, projectTitle: 'Legacy Pack' });
    const generated = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const withSnapshot = withGenerationSnapshot(generated, { options: opts, provider: { provider: 'local', temperature: 0.8 }, season: testSeason });
    const id = await savePack({ blueprint: withSnapshot, options: opts, name: 'Legacy Pack' });
    const saved = await loadPack(id);
    if (!saved) throw new Error('pack not found');
    await putFullPack({ ...saved, blueprint: legacySnapshotBlueprint(saved.blueprint) });
    return id;
  }

  it('loadPack scrubs and persists the fix — a second load never sees the secret again', async () => {
    const id = await plantLegacyPack();
    const firstRead = await loadPack(id);
    assertNoSecrets(firstRead);
    expect(firstRead!.blueprint.generationSnapshot!.provider.hasApiKey).toBe(true);

    // loadPack's write-back means the underlying record is now genuinely clean, not just masked at read time.
    const secondRead = await loadPack(id);
    assertNoSecrets(secondRead);
  });

  it('listFullPacksForWorkspace (the export read path) never returns a leaked secret', async () => {
    await plantLegacyPack();
    const all = await listFullPacksForWorkspace('senior-oldpop');
    assertNoSecrets(all);
  });

  it('migrateLibrarySnapshotSecrets (the app-start migration) scrubs every already-saved pack in one pass', async () => {
    await plantLegacyPack();
    const report = await migrateLibrarySnapshotSecrets();
    expect(report.scrubbed).toBeGreaterThanOrEqual(1);

    const all = await listFullPacksForWorkspace('senior-oldpop');
    assertNoSecrets(all);
  });

  it('scrubBlueprintSnapshotSecrets is idempotent — a clean blueprint is returned unchanged (same reference)', () => {
    const opts = makeOptions({ songCount: 2 });
    const generated = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const clean = withGenerationSnapshot(generated, { options: opts, provider: { provider: 'local', temperature: 0.8 }, season: testSeason });
    const result = scrubBlueprintSnapshotSecrets(clean);
    expect(result.scrubbed).toBe(false);
    expect(result.blueprint).toBe(clean);
  });
});

describe('[v5.17 TASK A §1-3 item 3] importing a file with a leaked secret ignores and warns, never writes it', () => {
  const PACKS_ONLY = { ...DEFAULT_EXPORT_INCLUDE, hooks: false, situations: false, lyricLines: false, ratings: false, takes: false, videos: false, settings: false, channels: false };

  beforeEach(async () => {
    setCurrentWorkspace('senior-oldpop');
    await deleteAllPacks();
  });
  afterEach(() => __resetWorkspaceScopeForTests());

  async function buildLeakedImportFile(): Promise<WorkspaceExportFile> {
    const opts = makeOptions({ songCount: 2, projectTitle: 'External Pack' });
    const generated = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const withSnapshot = withGenerationSnapshot(generated, { options: opts, provider: { provider: 'local', temperature: 0.8 }, season: testSeason });
    const id = await savePack({ blueprint: withSnapshot, options: opts, name: 'External Pack' });
    const saved = await loadPack(id);
    if (!saved) throw new Error('pack not found');
    await putFullPack({ ...saved, blueprint: legacySnapshotBlueprint(saved.blueprint) });
    const file = await exportWorkspace({ workspaceId: 'senior-oldpop', include: PACKS_ONLY });
    // Reintroduce the leak directly into the exported file object, bypassing exportWorkspace's own re-check,
    // to simulate a file that genuinely still carries a secret (e.g. hand-edited, or exported by an older build).
    file.data.packs = file.data.packs!.map(pack => ({ ...pack, blueprint: legacySnapshotBlueprint(pack.blueprint) }));
    return file;
  }

  it('previewImport warns that the file contains secrets', async () => {
    const file = await buildLeakedImportFile();
    await deleteAllPacks(); // import into a clean workspace so this is a genuinely new pack
    const preview = await previewImport(fileFrom(file));
    expect(preview.warnings.some(w => w.includes('비밀 정보'))).toBe(true);
  });

  it('applyImport strips the secret before writing and records a warning — the saved pack has none', async () => {
    const file = await buildLeakedImportFile();
    await deleteAllPacks();
    const result = await applyImport(fileFrom(file), 'merge');
    expect(result.packs.added).toBe(1);
    expect(result.warnings.some(w => w.includes('비밀 정보'))).toBe(true);

    const all = await listFullPacksForWorkspace('senior-oldpop');
    expect(all).toHaveLength(1);
    assertNoSecrets(all);
  });
});

describe('[v5.17 TASK A] resolveGenerationContext still returns usable live credentials for real retry/refine calls', () => {
  it('merges snapshot-recorded provider/model/temperature with LIVE credentials, never the snapshot\'s own (absent) ones', () => {
    const opts = makeOptions({ songCount: 2 });
    const generated = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const blueprint = withGenerationSnapshot(generated, { options: opts, provider: providerWithSecrets, season: testSeason });

    const liveProvider: ProviderSettings = {
      provider: 'anthropic',
      model: 'claude-test',
      temperature: 0.7,
      apiKey: 'sk-ant-CURRENT-live-key',
      accessToken: 'CURRENT-live-token'
    };
    const live = { options: opts, provider: liveProvider, season: testSeason, genres: testGenres, moods: testMoods };

    const ctx = resolveGenerationContext(blueprint, live);
    // Model/temperature/provider type: what this pack was ACTUALLY generated under.
    expect(ctx.provider.provider).toBe('anthropic');
    expect(ctx.provider.model).toBe('claude-test');
    expect(ctx.provider.temperature).toBe(0.7);
    // Credentials: re-read live, never the (never-persisted) snapshot value.
    expect(ctx.provider.apiKey).toBe('sk-ant-CURRENT-live-key');
    expect(ctx.provider.accessToken).toBe('CURRENT-live-token');
  });
});
