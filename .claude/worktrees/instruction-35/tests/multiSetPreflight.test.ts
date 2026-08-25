/**
 * TASK (multi-set preflight) — regression coverage for the real, verified
 * gap this closes: App.tsx's shared requestGeneration() used to run
 * core/generationPreflight.ts's evaluateGenerationRequest exactly ONCE,
 * against the screen's single-set-shaped base opts, even while multi-set
 * mode was active — so a real generation-contract mismatch or 관문 1
 * (design-gate) failure only reachable at the REAL per-set configuration
 * (songsPerSet overriding the base songCount, and set 2+'s palette-family/
 * genre rotation — core/multiSetGeneration.ts's buildSetOptions) had no
 * chance of being caught before generation started.
 *
 * core/multiSetGeneration.ts's evaluateMultiSetGenerationRequest/
 * combineMultiSetPreflight are the fix. These tests cover:
 *  - scenario H: a real config where the base songCount (18) passes cleanly
 *    but the real per-set songsPerSet (30) genuinely trips real 관문 1
 *    issues — proving the new function catches what a single-set-shaped
 *    check never would (verified directly against core/designGate.ts's real
 *    thresholds, not a synthetic fixture).
 *  - recentGenreIds accumulation: evaluateMultiSetGenerationRequest's
 *    per-set PreflightResult for set i is byte-identical to running
 *    evaluateGenerationRequest directly against the REAL per-set options
 *    runMultiSetGeneration (real generation's own orchestrator) actually
 *    used for that same set i — proving the palette-family rotation window
 *    this function feeds buildSetOptions matches real generation's own,
 *    not an approximation.
 *  - a clean multi-set config (every set passes) requires no acknowledgment.
 *  - combineMultiSetPreflight's own block/warn/acknowledge aggregation rules
 *    in isolation (hard block anywhere -> whole run blocked with no
 *    signature; warn-only -> one shared signature covering every set).
 */
import { describe, expect, it } from 'vitest';
import {
  evaluateMultiSetGenerationRequest,
  combineMultiSetPreflight,
  runMultiSetGeneration,
  type MultiSetPreflightSummary
} from '../src/core/multiSetGeneration';
import { evaluateGenerationRequest, type PreflightResult } from '../src/core/generationPreflight';
import { channelPresets, makeOptions, testSeason } from './fixtures';
import { getGenreById } from '../src/data/genreLibrary';
import type { GenrePack, ProviderSettings } from '../src/types';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;
const seniorGenreIds = seniorChannel.preferredGenres.slice(0, 4);
const seniorGenres: GenrePack[] = seniorGenreIds.map(id => getGenreById(id)).filter((g): g is GenrePack => Boolean(g));

describe('[multi-set preflight] scenario H — real per-set songsPerSet catches what base-opts-only checking would miss', () => {
  it('base opts at songCount=18 pass cleanly, standalone', async () => {
    const baseOpts = makeOptions({ channel: seniorChannel, songCount: 18, genreIds: seniorGenreIds });
    const result = await evaluateGenerationRequest({ workspaceId: 'senior-oldpop', options: baseOpts, genres: seniorGenres });
    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('the SAME options at the real per-set songCount=30 genuinely trip real 관문 1 issues (arrangement-density-full-max, genre-max, moneychord-max) — proves 30 is a real, not synthetic, failure', async () => {
    const optsAt30 = makeOptions({ channel: seniorChannel, songCount: 30, genreIds: seniorGenreIds });
    const result = await evaluateGenerationRequest({ workspaceId: 'senior-oldpop', options: optsAt30, genres: seniorGenres });
    expect(result.allowed).toBe(false);
    expect(result.requiresAcknowledgement).toBe(true);
    expect(result.reasons.some(r => r.field === 'arrangement-density-full-max')).toBe(true);
  });

  it('evaluateMultiSetGenerationRequest catches set 1\'s real songsPerSet=30 issue that a base-opts-shaped (songCount=18) single check would never see', async () => {
    const baseOpts = makeOptions({ channel: seniorChannel, songCount: 18, genreIds: seniorGenreIds });

    // What App.tsx's OLD single-set-only requestGeneration() would have checked (base opts, songCount=18) — clean.
    const singleSetShapedCheck = await evaluateGenerationRequest({ workspaceId: 'senior-oldpop', options: baseOpts, genres: seniorGenres });
    expect(singleSetShapedCheck.allowed).toBe(true);

    // What the NEW multi-set preflight actually checks: real per-set options (songsPerSet=30).
    const perSet = await evaluateMultiSetGenerationRequest({
      workspaceId: 'senior-oldpop',
      baseOptions: baseOpts,
      setCount: 3,
      songsPerSet: 30,
      genres: seniorGenres
    });

    expect(perSet).toHaveLength(3);
    // Set 1 (index 0) already uses songCount=30 (buildSetOptions overrides songCount unconditionally, even for the first set) — the real gap this task closes.
    expect(perSet[0].allowed).toBe(false);
    expect(perSet[0].reasons.some(r => r.field === 'arrangement-density-full-max')).toBe(true);

    const combined = combineMultiSetPreflight(perSet);
    expect(combined.allowed).toBe(false);
    expect(combined.warnSetIndexes).toContain(0);
    expect(combined.blockedSetIndexes).toEqual([]); // every real reason here is 'warn' (acknowledgeable), not a hard block
  });
});

describe('[multi-set preflight] recentGenreIds accumulation matches real generation\'s own rotation', () => {
  const settings: ProviderSettings = { provider: 'local', temperature: 0.8 };

  it('evaluateMultiSetGenerationRequest\'s per-set result for set i is identical to checking the REAL per-set options runMultiSetGeneration actually used for set i', async () => {
    // senior-morning is the one archetype with usesPaletteFamily: true (data/channelSoundFloor.ts) —
    // buildSetOptions actually re-runs its family-rotation branch for set 2+ on this archetype,
    // so this exercises the real recentGenreIds-driven path, not the no-op fallback.
    const baseOpts = makeOptions({ channel: seniorChannel, songCount: 12, genreIds: seniorGenreIds, customConcept: '6070년대 향수가 느껴지는 올드팝' });
    const setCount = 3;
    const songsPerSet = 12;

    const perSetPreflight = await evaluateMultiSetGenerationRequest({
      workspaceId: 'senior-oldpop',
      baseOptions: baseOpts,
      setCount,
      songsPerSet,
      genres: seniorGenres
    });

    const realResults = await runMultiSetGeneration(baseOpts, setCount, songsPerSet, seniorGenres, [], testSeason, settings, undefined);

    expect(realResults).toHaveLength(setCount);
    for (let index = 0; index < setCount; index += 1) {
      // The real per-set options runMultiSetGeneration's own buildSetOptions call actually produced for this set.
      const realSetOpts = realResults[index].opts;
      const expectedPreflight: PreflightResult = await evaluateGenerationRequest({
        workspaceId: 'senior-oldpop',
        options: realSetOpts,
        genres: seniorGenres
      });
      expect(perSetPreflight[index]).toEqual(expectedPreflight);
    }
  });
});

describe('[multi-set preflight] a clean multi-set config requires no extra confirmation', () => {
  it('every set at songCount=18 (well within thresholds) is allowed with nothing to acknowledge', async () => {
    const baseOpts = makeOptions({ channel: seniorChannel, songCount: 18, genreIds: seniorGenreIds });
    const perSet = await evaluateMultiSetGenerationRequest({
      workspaceId: 'senior-oldpop',
      baseOptions: baseOpts,
      setCount: 2,
      songsPerSet: 18,
      genres: seniorGenres
    });

    for (const result of perSet) {
      expect(result.allowed).toBe(true);
      expect(result.reasons).toEqual([]);
    }

    const combined = combineMultiSetPreflight(perSet);
    expect(combined.allowed).toBe(true);
    expect(combined.requiresAcknowledgement).toBe(false);
    expect(combined.mismatchSignature).toBeUndefined();
    expect(combined.blockedSetIndexes).toEqual([]);
    expect(combined.warnSetIndexes).toEqual([]);
  });
});

describe('[multi-set preflight] combineMultiSetPreflight — aggregation rules in isolation', () => {
  const clean: PreflightResult = { allowed: true, reasons: [], requiresAcknowledgement: false };
  const warnResult: PreflightResult = {
    allowed: false,
    reasons: [{ field: 'genre-max', messageKo: 'warn issue', severity: 'warn' }],
    requiresAcknowledgement: true,
    mismatchSignature: 'sig-warn-set'
  };
  const blockResult: PreflightResult = {
    allowed: false,
    reasons: [{ field: 'channelArchetype', messageKo: 'block issue', severity: 'block' }],
    requiresAcknowledgement: false
  };

  it('all clean -> allowed, nothing to acknowledge', () => {
    const combined = combineMultiSetPreflight([clean, clean, clean]);
    expect(combined).toEqual<MultiSetPreflightSummary>({
      allowed: true,
      requiresAcknowledgement: false,
      reasons: [],
      blockedSetIndexes: [],
      warnSetIndexes: []
    });
  });

  it('any hard block anywhere blocks the WHOLE run, even alongside a warn-only set elsewhere — no signature exposed', () => {
    const combined = combineMultiSetPreflight([clean, warnResult, blockResult]);
    expect(combined.allowed).toBe(false);
    expect(combined.requiresAcknowledgement).toBe(false);
    expect(combined.mismatchSignature).toBeUndefined();
    expect(combined.blockedSetIndexes).toEqual([2]);
    // set 1's warn is still surfaced in `reasons` for display, just doesn't grant an acknowledgment path.
    expect(combined.reasons.some(r => r.setIndex === 1 && r.field === 'genre-max')).toBe(true);
  });

  it('warn-only (no block anywhere) requires ONE acknowledgment covering every set', () => {
    const first = combineMultiSetPreflight([clean, warnResult, clean]);
    expect(first.allowed).toBe(false);
    expect(first.requiresAcknowledgement).toBe(true);
    expect(first.mismatchSignature).toBeTruthy();
    expect(first.warnSetIndexes).toEqual([1]);

    const acknowledged = combineMultiSetPreflight([clean, warnResult, clean], first.mismatchSignature);
    expect(acknowledged.allowed).toBe(true);
    expect(acknowledged.requiresAcknowledgement).toBe(false);
  });

  it('a stale acknowledgment (from a DIFFERENT warn signature) does not unblock', () => {
    const combined = combineMultiSetPreflight([clean, warnResult, clean], 'stale-signature-from-a-prior-attempt');
    expect(combined.allowed).toBe(false);
    expect(combined.requiresAcknowledgement).toBe(true);
  });
});
