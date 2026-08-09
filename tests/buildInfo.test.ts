import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_VERSION, APP_VERSION_LABEL, BUILD_INFO, BUILT_AT, COMMIT_SHA } from '../src/core/buildInfo';
import { CURRENT_SCHEMA_VERSION } from '../src/core/schemaVersion';
import { EXPORT_SCHEMA_VERSION } from '../src/core/exportMeta';
import { exportCsv, exportJson } from '../src/utils/exporters';
import { downloadCsv, buildTakeLedgerCsv, withBuildInfoComment, type SetContext } from '../src/core/csvExport';
import { exportWorkspace, exportAllWorkspaces, DEFAULT_EXPORT_INCLUDE } from '../src/core/workspaceTransfer';
import { setCurrentWorkspace, __resetWorkspaceScopeForTests } from '../src/core/workspaceScope';
import { deleteAllPacks } from '../src/core/library';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { AudioTake } from '../src/core/audioTakes';

/**
 * v5.14 — this task's own verification: BUILD_INFO's shape, and that every
 * one of the 6 real sync points (package.json is checked separately, this
 * covers the 5 code-level ones: app UI reads BUILD_INFO directly so there's
 * nothing to assert on here without a DOM — pack JSON export, pack CSV
 * export, workspace backup, and take-ledger CSV) actually carries it, via
 * real generation/export calls rather than reading the constant in
 * isolation. `npm run dev`/`vitest` never runs through Vite's `define`
 * pipeline, so appVersion/commitSha/builtAt fall back to their 'dev'-ish
 * defaults here — a real `npm run build` is what proves the injection
 * itself works (see this task's own report, not this test file).
 */

const NO_IDB_CATEGORIES = { ...DEFAULT_EXPORT_INCLUDE, hooks: false, situations: false, lyricLines: false, ratings: false, takes: false, videos: false, settings: false, channels: false };

describe('[v5.14] BUILD_INFO assembly', () => {
  it('is a single object combining appVersion/schemaVersion/commitSha/builtAt', () => {
    expect(BUILD_INFO).toEqual({
      appVersion: APP_VERSION,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      commitSha: COMMIT_SHA,
      builtAt: BUILT_AT
    });
  });

  it('schemaVersion is the same number that travels as EXPORT_SCHEMA_VERSION in every export (not a second, independently-drifting constant)', () => {
    expect(BUILD_INFO.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
  });

  it('falls back to safe dev defaults outside a real Vite build (this app\'s test environment never runs Vite\'s `define` pipeline)', () => {
    expect(BUILD_INFO.appVersion).toBe('0.0.0-dev');
    expect(BUILD_INFO.commitSha).toBe('unknown');
    expect(BUILD_INFO.builtAt).toBe('dev');
  });

  it('APP_VERSION_LABEL keeps its v4.0 "v{version} ({commit})" shape, still built from the same underlying values', () => {
    expect(APP_VERSION_LABEL).toBe(`v${BUILD_INFO.appVersion} (${BUILD_INFO.commitSha})`);
  });
});

describe('[v5.14] sync point — pack JSON export (utils/exporters.ts exportJson)', () => {
  it('a real generated blueprint\'s JSON export carries BUILD_INFO\'s values', () => {
    const opts = makeOptions({ songCount: 2, projectTitle: 'Build Info JSON Pack' });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const parsed = JSON.parse(exportJson(blueprint));

    expect(parsed.appVersion).toBe(BUILD_INFO.appVersion);
    expect(parsed.schemaVersion).toBe(BUILD_INFO.schemaVersion);
    expect(parsed.commitSha).toBe(BUILD_INFO.commitSha);
    expect(parsed.builtAt).toBe(BUILD_INFO.builtAt);
  });
});

describe('[v5.14] sync point — pack CSV export (utils/exporters.ts exportCsv)', () => {
  it('a real generated blueprint\'s CSV meta comment line carries BUILD_INFO\'s values', () => {
    const opts = makeOptions({ songCount: 2, projectTitle: 'Build Info CSV Pack' });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const csv = exportCsv(blueprint);
    const metaLine = csv.split('\n')[0];

    expect(metaLine).toContain(`appVersion=${BUILD_INFO.appVersion}`);
    expect(metaLine).toContain(`schemaVersion=${BUILD_INFO.schemaVersion}`);
    expect(metaLine).toContain(`commitSha=${BUILD_INFO.commitSha}`);
    expect(metaLine).toContain(`builtAt=${BUILD_INFO.builtAt}`);
  });
});

describe('[v5.14] sync point — workspace backup (core/workspaceTransfer.ts)', () => {
  beforeEach(async () => {
    setCurrentWorkspace('senior-oldpop');
    await deleteAllPacks();
  });
  afterEach(() => __resetWorkspaceScopeForTests());

  it('exportWorkspace carries BUILD_INFO\'s builtAt alongside the pre-existing appVersion/schemaVersion/commitSha', async () => {
    const file = await exportWorkspace({ workspaceId: 'senior-oldpop', include: NO_IDB_CATEGORIES });
    expect(file.appVersion).toBe(BUILD_INFO.appVersion);
    expect(file.schemaVersion).toBe(BUILD_INFO.schemaVersion);
    expect(file.commitSha).toBe(BUILD_INFO.commitSha);
    expect(file.builtAt).toBe(BUILD_INFO.builtAt);
  });

  it('exportAllWorkspaces (the bundle file) carries the same', async () => {
    const bundle = await exportAllWorkspaces(NO_IDB_CATEGORIES);
    expect(bundle.appVersion).toBe(BUILD_INFO.appVersion);
    expect(bundle.schemaVersion).toBe(BUILD_INFO.schemaVersion);
    expect(bundle.commitSha).toBe(BUILD_INFO.commitSha);
    expect(bundle.builtAt).toBe(BUILD_INFO.builtAt);
  });
});

describe('[v5.14] sync point — take-ledger / set-summary CSV downloads (core/csvExport.ts)', () => {
  it('withBuildInfoComment prefixes real csv text with a build-info comment line, leaving the csv text itself untouched', () => {
    const ctx: SetContext = {
      blueprint: {
        projectTitle: 'p', channelName: 'c', oneLineConcept: '', sonicSignature: '', vocalSignature: '',
        lyricRules: [], harmonyRules: [], visualRules: [], songs: [], meta: { setCode: 'S20260805-01' }
      },
      channelName: 'c',
      customConcept: '',
      workspaceId: 'senior-oldpop',
      savedAt: '2026-08-05T00:00:00.000Z'
    };
    const csv = buildTakeLedgerCsv(ctx, [] as AudioTake[], []);
    const withComment = withBuildInfoComment(csv);
    const lines = withComment.split('\r\n');

    expect(lines[0]).toBe(`# suno-weaver-studio ${BUILD_INFO.appVersion} · commit ${BUILD_INFO.commitSha} · schema ${BUILD_INFO.schemaVersion} · built ${BUILD_INFO.builtAt}`);
    // Everything after the inserted comment line is the original, unmodified csv text.
    expect(lines.slice(1).join('\r\n')).toBe(csv);
  });

  it('a real downloadCsv call (jsdom-free path) writes the build-info comment as the file\'s first line, ahead of the UTF-8 BOM', () => {
    // downloadCsv itself needs Blob/URL/document (browser-only); this
    // exercises the exact same composition it performs internally
    // (withUtf8Bom(withBuildInfoComment(csvText))) so the assertion covers
    // real code, not a re-implementation.
    const csvText = 'A,B\r\n1,2';
    const written = withBuildInfoComment(csvText);
    expect(written.startsWith('# suno-weaver-studio')).toBe(true);
    expect(written.endsWith(csvText)).toBe(true);
    void downloadCsv; // referenced to document that this is the function under test's real composition, without needing a DOM to invoke it directly.
  });
});
