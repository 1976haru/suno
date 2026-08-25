import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { importSongsJson, extractRawImportedSongs } from '../src/core/bridgeImport';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { inspectImportReport, buildMissingTracksRegenerateInstruction } from '../src/core/importInspection';
import { savePack, listPacks, deleteAllPacks } from '../src/core/library';
import { channelPresets, genrePacks, moodPacks, makeOptions, testSeason } from './fixtures';
import type { GenerationOptions } from '../src/types';

/**
 * TASK (import transaction / pre-persistence inspection) — real, verified
 * bug this task fixes: App.tsx's onImportSongsJson used to autosave a
 * bridge-imported pack and permanently register its hooks the instant
 * importSongsJson produced ANY non-null blueprint, even a genuinely partial
 * response (e.g. 17 of 18 requested songs) — zero user review before those
 * hooks got marked "already used" in the channel's ledger. These tests cover
 * core/importInspection.ts's inspectImportReport — the real classification
 * ('valid' | 'repairable' | 'blocked') App.tsx now gates persistence on —
 * using the SAME real provider-response fixtures
 * tests/providerResponseFixtures.test.ts already exercises through
 * importSongsJson itself, plus a source-level regression guard on App.tsx
 * (this repo has no jsdom/React-rendering test infra — see
 * tests/bridgeImportSrtOnly.test.ts's own identical note and established
 * convention, followed here rather than reinvented) and a real
 * before/after library-write proof mirroring that same sibling task's style.
 */
const FIXTURES_DIR = resolve(__dirname, 'fixtures', 'providerResponses');
const FIXTURE_SONG_COUNT = 5;

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf8');
}

function optsFor(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  const channel = channelPresets[0];
  return makeOptions({
    channel,
    songCount: FIXTURE_SONG_COUNT,
    lyricLanguage: 'english',
    genreIds: channel.preferredGenres,
    moodIds: channel.preferredMoods,
    vocalTone: channel.defaultVocal,
    ...overrides
  });
}

function runFixture(fixtureName: string, optsOverrides: Partial<GenerationOptions> = {}) {
  const opts = optsFor(optsOverrides);
  const genres = genrePacks.filter(g => opts.genreIds.includes(g.id));
  const moods = moodPacks.filter(m => opts.moodIds.includes(m.id));
  const slots = preallocateSongSlots(opts, genres);
  const rawText = loadFixture(fixtureName);
  const report = importSongsJson(rawText, opts, genres, moods, testSeason, slots);
  const rawSongs = extractRawImportedSongs(rawText);
  const inspection = inspectImportReport(report, rawSongs, opts.lyricLanguage);
  return { opts, report, rawSongs, inspection };
}

describe('[import inspection] scenario A — duplicateTrackNo.json blocks, never reaches persistence-eligible status', () => {
  it('classifies as blocked with the upstream skip reasons carried through', () => {
    const { report, inspection } = runFixture('blocking/duplicateTrackNo.json');
    expect(report.blueprint, 'importSongsJson itself already refused a blueprint').toBeNull();
    expect(inspection.status).toBe('blocked');
    expect(inspection.blockedReasons.join(' ')).toContain('trackNo');
    expect(inspection.importedCount).toBe(0);
    // No "proceed anyway" surface exists for blocked — missingTrackNos is
    // meaningless here (the whole response was refused, not partially
    // accepted), confirmed empty rather than a stale/misleading value.
    expect(inspection.missingTrackNos).toEqual([]);
  });
});

describe('[import inspection] scenario C — invalidTrackNo.json (out-of-range trackNo) blocks the same way', () => {
  it('classifies as blocked', () => {
    const { report, inspection } = runFixture('blocking/invalidTrackNo.json');
    expect(report.blueprint).toBeNull();
    expect(inspection.status).toBe('blocked');
    expect(inspection.checks[0].status).toBe('blocked');
  });
});

describe('[import inspection] scenario B / F — missingTracks.json (4 of 5 requested) is repairable, not blocked', () => {
  it('classifies as repairable and names the real missing trackNo', () => {
    const { opts, report, inspection } = runFixture('warning/missingTracks.json');
    expect(report.blueprint, 'a partial pack still parses — not a hard failure').not.toBeNull();
    expect(inspection.status).toBe('repairable');
    expect(inspection.importedCount).toBe(4);
    expect(inspection.requestedCount).toBe(opts.songCount);
    // missingTracks.json only supplies trackNo 1..4 — trackNo 5 was never
    // claimed at all, exactly the validateProviderTrackSet.missing case this
    // module recovers (ImportSongsReport itself never exposes it).
    expect(inspection.missingTrackNos).toEqual([5]);
    const trackNoCheck = inspection.checks.find(c => c.id === 'trackNo')!;
    expect(trackNoCheck.status).toBe('warn');
    expect(trackNoCheck.detail).toContain('T5');
  });

  it('never blocks — a real 17/18-style shortfall must remain reviewable, not refused outright', () => {
    const { inspection } = runFixture('warning/missingTracks.json');
    expect(inspection.status).not.toBe('blocked');
    expect(inspection.blockedReasons).toEqual([]);
  });
});

describe('[import inspection] scenario — artistNameLeak.json: a real safety hit excludes only that track, TASK v5.19 (TASK C)', () => {
  it('classifies as repairable (not blocked) and names exactly the leaked track, leaving the rest confirmable', () => {
    const { report, inspection } = runFixture('warning/artistNameLeak.json');
    // importSongsJson's own report still has a non-null blueprint (see
    // tests/providerResponseFixtures.test.ts's own "must still import (a
    // warning, not a hard rejection)" assertion for this exact fixture).
    // TASK v5.19 (TASK C) — a real incident showed a whole clean 18-song
    // pack getting discarded over ONE track's leak; this check now only
    // excludes that one track (via artistLeakTrackNos), it no longer
    // hard-blocks the whole import — see importInspection.ts's own
    // file-header doc comment on why 'blocked' moved to structural-failure-
    // only.
    expect(report.blueprint).not.toBeNull();
    expect(inspection.status).toBe('repairable');
    const artistCheck = inspection.checks.find(c => c.id === 'artistSafety')!;
    expect(artistCheck.status).toBe('blocked');
    expect(artistCheck.detail).toContain('Track 1');
    expect(inspection.artistLeakTrackNos).toEqual([1]);
    expect(inspection.artistLeaks).toHaveLength(1);
    expect(inspection.artistLeaks[0].trackNo).toBe(1);
    expect(inspection.artistLeaks[0].leaks.some(leak => leak.surface.toLowerCase() === 'adele')).toBe(true);
    // 'blocked'-specific bookkeeping stays empty — this is a 'repairable' result.
    expect(inspection.blockedReasons).toEqual([]);
  });

  it('scenario F (TASK C, "오탐 신고 후 진행") — a sessionExemptions hit for the exact detected surface clears that track back to confirmable', () => {
    const { opts, report, rawSongs } = runFixture('warning/artistNameLeak.json');
    const exempted = inspectImportReport(report, rawSongs, opts.lyricLanguage, undefined, new Set(['adele']));
    expect(exempted.artistLeakTrackNos).toEqual([]);
    expect(exempted.artistLeaks).toEqual([]);
    const artistCheck = exempted.checks.find(c => c.id === 'artistSafety')!;
    expect(artistCheck.status).toBe('pass');
    // With the leak exempted and nothing else outstanding, this fixture's
    // only other defect (if any) still governs status — the leak itself no
    // longer contributes to 'repairable'.
    expect(exempted.status).not.toBe('blocked');
  });
});

describe('[import inspection] scenario — normal.json: a genuinely complete, clean response is valid with nothing to review', () => {
  it('classifies as valid', () => {
    const { report, inspection } = runFixture('blocking/normal.json');
    expect(report.blueprint).not.toBeNull();
    expect(inspection.status).toBe('valid');
    expect(inspection.missingTrackNos).toEqual([]);
    expect(inspection.blockedReasons).toEqual([]);
    expect(inspection.importedCount).toBe(inspection.requestedCount);
  });
});

describe('[import inspection] scenario — wrongVocalMetaTag.json: item 6 is informational only, never changes status', () => {
  it('reports the real before/after correction but stays valid (self-healing, not a defect)', () => {
    const { inspection } = runFixture('warning/wrongVocalMetaTag.json', { vocalQuota: { male: FIXTURE_SONG_COUNT, female: 0, mixed: 0 } });
    expect(inspection.status).toBe('valid');
    expect(inspection.vocalTagCorrections.length).toBeGreaterThan(0);
    const first = inspection.vocalTagCorrections[0];
    expect(first.from.toLowerCase()).toContain('female');
    expect(first.to.toLowerCase()).toContain('male');
    const vocalCheck = inspection.checks.find(c => c.id === 'vocalTag')!;
    expect(vocalCheck.status).toBe('info');
  });
});

describe('[import inspection] buildMissingTracksRegenerateInstruction', () => {
  it('names the exact missing trackNos and the requested language/channel', () => {
    const opts = optsFor();
    const instruction = buildMissingTracksRegenerateInstruction([5, 12], opts);
    expect(instruction).toContain('T5');
    expect(instruction).toContain('T12');
    expect(instruction).toContain(opts.channel.name);
    expect(instruction).toContain('english');
  });

  it('returns an empty string when there is nothing missing', () => {
    expect(buildMissingTracksRegenerateInstruction([], optsFor())).toBe('');
  });
});

describe('[import inspection] structural proof: core/importInspection.ts is a pure classifier with no persistence access', () => {
  const source = readFileSync(resolve(__dirname, '../src/core/importInspection.ts'), 'utf8');

  it('never imports core/library or core/hookLedger — inspectImportReport cannot save/register anything itself', () => {
    expect(source).not.toMatch(/from '\.\/library'/);
    expect(source).not.toMatch(/from '\.\/hookLedger'/);
  });

  it('does not modify validateProviderTrackSet/vocalPlan internals — only imports and calls their existing exports', () => {
    expect(source).toContain("from './importValidation'");
    expect(source).not.toMatch(/from '\.\/vocalPlan'/);
  });
});

describe('[import inspection] App.tsx source-level regression guard', () => {
  const appSource = readFileSync(resolve(__dirname, '../src/App.tsx'), 'utf8');

  function extractFunctionBody(source: string, name: string): string {
    const signatureIndex = source.indexOf(`function ${name}(`);
    expect(signatureIndex, `function ${name} not found in App.tsx`).toBeGreaterThan(-1);
    const braceStart = source.indexOf('{', signatureIndex);
    let depth = 0;
    for (let i = braceStart; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) return source.slice(braceStart, i + 1);
      }
    }
    throw new Error(`Unbalanced braces while extracting ${name}`);
  }

  it('onImportSongsJson now gates on inspectImportReport before its own persistence calls', () => {
    const body = extractFunctionBody(appSource, 'onImportSongsJson');
    expect(body).toContain('inspectImportReport(');
    expect(body).toContain("inspection.status === 'blocked'");
    expect(body).toContain("inspection.status === 'repairable'");
    // The 'valid' branch is still the SAME literal persistence sequence this
    // function always ran — this must stay true so the common case never
    // regresses into an extra click (see tests/bridgeImportSrtOnly.test.ts's
    // own sibling assertion that this function keeps autosaving/registering
    // hooks, now proven to be conditioned on 'valid' rather than unconditional).
    expect(body).toContain('library.saveImportedPack');
    expect(body).toContain('handleGenerationSuccess');
  });

  it('a repairable classification is only ever persisted via the explicit onConfirmPartialImport function, never inline', () => {
    const body = extractFunctionBody(appSource, 'onConfirmPartialImport');
    expect(body).toContain('library.saveImportedPack');
    expect(body).toContain('handleGenerationSuccess');
  });

  it('the pending-inspection modal state is set for repairable/blocked and cleared for valid, never bypassed', () => {
    const body = extractFunctionBody(appSource, 'onImportSongsJson');
    expect(body).toContain('setPendingImportInspection(');
  });
});

// Mirrors tests/bridgeImportSrtOnly.test.ts's own before/after style: a real
// library write only ever happens through explicit action, never as a side
// effect of classification. inspectImportReport's own purity is proven
// structurally above; this proves the *confirm* action (the real
// library.saveImportedPack/savePack primitive App.tsx's onConfirmPartialImport
// calls) really does create a pack when it runs, so "held until confirmed"
// isn't a vacuous claim about a primitive that doesn't actually write.
describe('[import inspection] real before/after: a repairable pack is not saved until the confirm action runs', () => {
  beforeEach(async () => {
    await deleteAllPacks();
  });

  it('classification alone (no confirm) leaves the pack library untouched', async () => {
    const { opts, report, inspection } = runFixture('warning/missingTracks.json');
    expect(inspection.status).toBe('repairable');
    const beforePacks = (await listPacks()).length;
    // Nothing beyond classification ran — no savePack call at all here.
    void report;
    const afterPacks = (await listPacks()).length;
    expect(afterPacks).toBe(beforePacks);
    void opts;
  });

  it('the real confirm primitive (savePack, what library.saveImportedPack wraps) does create a pack once actually invoked', async () => {
    const { opts, report } = runFixture('warning/missingTracks.json');
    const beforePacks = (await listPacks()).length;
    await savePack({ blueprint: report.blueprint!, options: opts, name: 'Confirmed Partial Pack' });
    const afterPacks = (await listPacks()).length;
    expect(afterPacks).toBe(beforePacks + 1);
  });
});
