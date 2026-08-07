/**
 * TASK (generation preflight) — regression coverage for
 * core/generationPreflight.ts's resolveGenerationPreflight/
 * evaluateGenerationRequest/stableHash. Real bug this whole module exists to
 * fix: App.tsx's top-of-page global generate button called onGenerate/
 * onGenerateMultiSet with no contract/design-gate check at all (only
 * `disabled={gen.isGenerating}`), completely bypassing v5.10's own
 * Step3Generate.tsx contract screen. These tests cover:
 *  - a clean pack: allowed, nothing to acknowledge
 *  - all 3 hard-block conditions: never offer an acknowledgment path, even
 *    when an acknowledgedSignature is supplied
 *  - hard blocks take total precedence over any soft mismatch also present
 *  - soft mismatches (contract + design-gate) ARE acknowledgeable via a
 *    content-based signature
 *  - signature staleness: acknowledging one mismatch, then changing the
 *    selection to a DIFFERENT wrong value, invalidates the old
 *    acknowledgment (the real gap a naive "which fields mismatched"
 *    signature would miss)
 *  - evaluateGenerationRequest: the real end-to-end orchestration path every
 *    trigger point (App.tsx's onGenerate/onGenerateMultiSet/
 *    onHookWarningContinueAnyway/onGenerateFreshFromPrompt,
 *    Step3Generate.tsx's bridge-copy handlers) calls from inside its own
 *    handler function.
 */
import { describe, expect, it } from 'vitest';
import {
  resolveGenerationPreflight,
  evaluateGenerationRequest,
  stableHash,
  type PreflightResult
} from '../src/core/generationPreflight';
import { buildResolvedGenerationContract, userChoicesFromOptions } from '../src/core/userChoices';
import type { DesignGateResult } from '../src/core/designGate';
import type { PreassignedSongSlot, WorkspaceDefinition } from '../src/types';
import { getGenreById } from '../src/data/genreLibrary';
import { channelPresets, makeOptions } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;

const CLEAN_DESIGN_GATE: DesignGateResult = { passed: true, blocking: [], advisory: [] };

/** Mirrors tests/designGate.test.ts's own slotFor helper — the real PreassignedSongSlot shape a slot PLAN uses (this preflight runs BEFORE any lyrics exist, on the plan, not a finished blueprint). */
function slotFor(overrides: Partial<PreassignedSongSlot>): PreassignedSongSlot {
  return {
    trackNo: 1,
    title: 'Title',
    hookPhrase: 'Hook',
    songRole: 'core',
    tempo: 90,
    emotionArc: 'steady',
    moneyChordText: '',
    ...overrides
  };
}

describe('resolveGenerationPreflight — clean case', () => {
  it('allows generation and has nothing to acknowledge when the contract/design-gate are both clean', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 6, genreIds: seniorChannel.preferredGenres });
    const slots: PreassignedSongSlot[] = Array.from({ length: 6 }, (_, i) => slotFor({ trackNo: i + 1, genreId: seniorChannel.preferredGenres[0] }));
    const choices = userChoicesFromOptions(opts);
    const contract = buildResolvedGenerationContract(opts, choices, slots, 'senior-oldpop');

    const result = resolveGenerationPreflight({
      workspaceId: 'senior-oldpop',
      options: opts,
      slots,
      contract,
      designGate: CLEAN_DESIGN_GATE
    });

    expect(result).toEqual<PreflightResult>({ allowed: true, reasons: [], requiresAcknowledgement: false });
  });
});

describe('resolveGenerationPreflight — hard blocks never offer a proceed-anyway path', () => {
  it('blocks when channel.archetype is not in the workspace\'s own archetypeIds (v5.9\'s own check, reused as a hard gate)', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 6, genreIds: seniorChannel.preferredGenres });
    const slots: PreassignedSongSlot[] = Array.from({ length: 6 }, (_, i) => slotFor({ trackNo: i + 1, genreId: seniorChannel.preferredGenres[0] }));
    const choices = userChoicesFromOptions(opts);
    // Real active workspace is 'kr-2030' (the same one resolveGenerationPreflight is called with below) — every real call site passes the SAME activeWorkspaceId to both functions.
    const contract = buildResolvedGenerationContract(opts, choices, slots, 'kr-2030');

    // senior-morning is not in kr-2030's own archetypeIds (['kr-2030-pop']).
    const result = resolveGenerationPreflight({
      workspaceId: 'kr-2030',
      options: opts,
      slots,
      contract,
      designGate: CLEAN_DESIGN_GATE,
      // Even a caller who supplies SOME signature must not unblock a hard block.
      acknowledgedSignature: 'anything-at-all'
    });

    expect(result.allowed).toBe(false);
    expect(result.requiresAcknowledgement).toBe(false);
    expect(result.mismatchSignature).toBeUndefined();
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toMatchObject({ field: 'channelArchetype', severity: 'block' });
  });

  it('blocks when the selected genre(s) resolve to 0 actual songs in the real slot plan', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 6, genreIds: ['oldpop-soft-rock-am'] });
    // Every real slot landed on a DIFFERENT genre than the one selected — not
    // "some removed", the selection produced literally zero matching songs.
    const slots: PreassignedSongSlot[] = Array.from({ length: 6 }, (_, i) => slotFor({ trackNo: i + 1, genreId: 'oldpop-europop-glow' }));
    const choices = userChoicesFromOptions(opts);
    const contract = buildResolvedGenerationContract(opts, choices, slots, 'senior-oldpop');

    const result = resolveGenerationPreflight({
      workspaceId: 'senior-oldpop',
      options: opts,
      slots,
      contract,
      designGate: CLEAN_DESIGN_GATE,
      acknowledgedSignature: 'anything-at-all'
    });

    expect(result.allowed).toBe(false);
    expect(result.requiresAcknowledgement).toBe(false);
    expect(result.mismatchSignature).toBeUndefined();
    expect(result.reasons.some(r => r.field === 'genreZeroSongs' && r.severity === 'block')).toBe(true);
  });

  it('blocks a scaffold (not-yet-built) workspace via WorkspaceDefinition.ready — no live WorkspaceId is a scaffold today, so this uses the module\'s own test-only workspaceOverride escape hatch instead of mocking data/workspaces.ts', () => {
    const scaffoldWorkspace: WorkspaceDefinition = {
      id: 'senior-oldpop',
      labelKo: '테스트 스캐폴드',
      descriptionKo: 'test',
      archetypeIds: ['senior-morning'],
      defaultAudienceProfileId: 'senior',
      defaultLyricLanguage: 'english',
      theme: { accent: '#000', surface: '#fff' },
      terms: {},
      hiddenFeatures: [],
      contentTier: 'adult',
      ready: false
    };
    const opts = makeOptions({ channel: seniorChannel, songCount: 6, genreIds: seniorChannel.preferredGenres });
    const slots: PreassignedSongSlot[] = Array.from({ length: 6 }, (_, i) => slotFor({ trackNo: i + 1, genreId: seniorChannel.preferredGenres[0] }));
    const choices = userChoicesFromOptions(opts);
    const contract = buildResolvedGenerationContract(opts, choices, slots, 'senior-oldpop');

    const result = resolveGenerationPreflight({
      workspaceId: 'senior-oldpop',
      options: opts,
      slots,
      contract,
      designGate: CLEAN_DESIGN_GATE,
      workspaceOverride: scaffoldWorkspace,
      acknowledgedSignature: 'anything-at-all'
    });

    expect(result.allowed).toBe(false);
    expect(result.requiresAcknowledgement).toBe(false);
    expect(result.reasons.some(r => r.field === 'workspaceScaffold' && r.severity === 'block')).toBe(true);
  });

  // codex 지시문 01 (TASK J) — real gap this closes: validateChannelProfile
  // (utils/channelProfile.ts) used to run only at channel-SAVE time, never
  // before a real generation request used the channel. A hand-edited or
  // pre-validation-era channel with a corrupted field could reach
  // generation unnoticed.
  it('blocks when the channel itself is structurally invalid (validateChannelProfile fails)', () => {
    const opts = makeOptions({
      channel: { ...seniorChannel, preferredGenres: 'not-an-array' as never },
      songCount: 6,
      genreIds: seniorChannel.preferredGenres
    });
    const slots: PreassignedSongSlot[] = Array.from({ length: 6 }, (_, i) => slotFor({ trackNo: i + 1, genreId: seniorChannel.preferredGenres[0] }));
    const choices = userChoicesFromOptions(opts);
    const contract = buildResolvedGenerationContract(opts, choices, slots, 'senior-oldpop');

    const result = resolveGenerationPreflight({
      workspaceId: 'senior-oldpop',
      options: opts,
      slots,
      contract,
      designGate: CLEAN_DESIGN_GATE,
      acknowledgedSignature: 'anything-at-all'
    });

    expect(result.allowed).toBe(false);
    expect(result.requiresAcknowledgement).toBe(false);
    expect(result.mismatchSignature).toBeUndefined();
    expect(result.reasons.some(r => r.field === 'channelProfileInvalid' && r.severity === 'block')).toBe(true);
  });

  it('a real, valid channel (every preset) never trips channelProfileInvalid', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 6, genreIds: seniorChannel.preferredGenres });
    const slots: PreassignedSongSlot[] = Array.from({ length: 6 }, (_, i) => slotFor({ trackNo: i + 1, genreId: seniorChannel.preferredGenres[0] }));
    const choices = userChoicesFromOptions(opts);
    const contract = buildResolvedGenerationContract(opts, choices, slots, 'senior-oldpop');

    const result = resolveGenerationPreflight({ workspaceId: 'senior-oldpop', options: opts, slots, contract, designGate: CLEAN_DESIGN_GATE });
    expect(result.reasons.some(r => r.field === 'channelProfileInvalid')).toBe(false);
  });

  it('a hard block takes total precedence over a soft mismatch also present — only the hard reason is reported, no acknowledgment path opens up', () => {
    const opts = makeOptions({
      channel: seniorChannel,
      songCount: 6,
      moneyChordMode: 'winterBallad',
      moneyChordModeIsExplicitChoice: true,
      genreIds: seniorChannel.preferredGenres
    });
    // Money-chord mismatch (soft) AND every slot on a foreign genre (hard).
    const slots: PreassignedSongSlot[] = Array.from({ length: 6 }, (_, i) => slotFor({
      trackNo: i + 1,
      moneyChordId: 'jazzColor',
      genreId: 'oldpop-does-not-exist-in-selection'
    }));
    const choices = userChoicesFromOptions(opts);
    const contract = buildResolvedGenerationContract(opts, choices, slots, 'senior-oldpop');
    expect(contract.mismatches.some(m => m.field === 'moneyChordMode')).toBe(true);

    const result = resolveGenerationPreflight({
      workspaceId: 'senior-oldpop',
      options: opts,
      slots,
      contract,
      designGate: CLEAN_DESIGN_GATE
    });

    expect(result.allowed).toBe(false);
    expect(result.requiresAcknowledgement).toBe(false);
    expect(result.reasons.every(r => r.severity === 'block')).toBe(true);
    expect(result.reasons.some(r => r.field === 'moneyChordMode')).toBe(false);
  });
});

describe('resolveGenerationPreflight — soft mismatches are acknowledgeable via a content-based signature', () => {
  it('a real contract mismatch blocks until its exact current signature is acknowledged', () => {
    const opts = makeOptions({
      channel: seniorChannel,
      songCount: 6,
      moneyChordMode: 'winterBallad',
      moneyChordModeIsExplicitChoice: true,
      genreIds: seniorChannel.preferredGenres
    });
    const slots: PreassignedSongSlot[] = Array.from({ length: 6 }, (_, i) => slotFor({
      trackNo: i + 1,
      moneyChordId: 'jazzColor',
      genreId: seniorChannel.preferredGenres[0]
    }));
    const choices = userChoicesFromOptions(opts);
    const contract = buildResolvedGenerationContract(opts, choices, slots, 'senior-oldpop');

    const first = resolveGenerationPreflight({ workspaceId: 'senior-oldpop', options: opts, slots, contract, designGate: CLEAN_DESIGN_GATE });
    expect(first.allowed).toBe(false);
    expect(first.requiresAcknowledgement).toBe(true);
    expect(first.mismatchSignature).toBeTruthy();

    const acknowledged = resolveGenerationPreflight({
      workspaceId: 'senior-oldpop',
      options: opts,
      slots,
      contract,
      designGate: CLEAN_DESIGN_GATE,
      acknowledgedSignature: first.mismatchSignature
    });
    expect(acknowledged.allowed).toBe(true);
    expect(acknowledged.requiresAcknowledgement).toBe(false);
  });

  it('a design-gate blocking issue is acknowledgeable the same way', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 6, genreIds: seniorChannel.preferredGenres });
    const slots: PreassignedSongSlot[] = Array.from({ length: 6 }, (_, i) => slotFor({ trackNo: i + 1, genreId: seniorChannel.preferredGenres[0] }));
    const choices = userChoicesFromOptions(opts);
    const contract = buildResolvedGenerationContract(opts, choices, slots, 'senior-oldpop');
    const gateWithIssue: DesignGateResult = {
      passed: false,
      blocking: [{ id: 'bpm-stddev', labelKo: 'BPM 표준편차', expected: '>= 8', actual: '2.1', fixHintKo: 'fix it' }],
      advisory: []
    };

    const first = resolveGenerationPreflight({ workspaceId: 'senior-oldpop', options: opts, slots, contract, designGate: gateWithIssue });
    expect(first.allowed).toBe(false);
    expect(first.requiresAcknowledgement).toBe(true);
    expect(first.reasons.some(r => r.field === 'bpm-stddev' && r.severity === 'warn')).toBe(true);

    const acknowledged = resolveGenerationPreflight({
      workspaceId: 'senior-oldpop',
      options: opts,
      slots,
      contract,
      designGate: gateWithIssue,
      acknowledgedSignature: first.mismatchSignature
    });
    expect(acknowledged.allowed).toBe(true);
  });
});

describe('resolveGenerationPreflight — signature staleness (scenario C)', () => {
  it('acknowledging one mismatch, then changing the selection to a DIFFERENT wrong value, invalidates the old acknowledgment', () => {
    const slots: PreassignedSongSlot[] = Array.from({ length: 6 }, (_, i) => slotFor({
      trackNo: i + 1,
      moneyChordId: 'jazzColor', // both attempts resolve to the same effective progression...
      genreId: seniorChannel.preferredGenres[0]
    }));

    const optsAttempt1 = makeOptions({
      channel: seniorChannel,
      songCount: 6,
      moneyChordMode: 'winterBallad', // ...but the user's own SELECTED (wrong) pick differs...
      moneyChordModeIsExplicitChoice: true,
      genreIds: seniorChannel.preferredGenres
    });
    const contract1 = buildResolvedGenerationContract(optsAttempt1, userChoicesFromOptions(optsAttempt1), slots, 'senior-oldpop');
    const preflight1 = resolveGenerationPreflight({ workspaceId: 'senior-oldpop', options: optsAttempt1, slots, contract: contract1, designGate: CLEAN_DESIGN_GATE });
    expect(preflight1.requiresAcknowledgement).toBe(true);
    const acknowledgedSignature = preflight1.mismatchSignature;

    // User "fixes" the mismatch by picking a DIFFERENT explicit money-chord —
    // still wrong (still resolves to jazzColor, not the newly selected one).
    const optsAttempt2 = makeOptions({
      channel: seniorChannel,
      songCount: 6,
      moneyChordMode: 'emotional', // ...a genuinely different wrong value.
      moneyChordModeIsExplicitChoice: true,
      genreIds: seniorChannel.preferredGenres
    });
    const contract2 = buildResolvedGenerationContract(optsAttempt2, userChoicesFromOptions(optsAttempt2), slots, 'senior-oldpop');
    // Same FIELD mismatches both times (moneyChordMode) — a naive
    // field-name-only signature would treat these as identical.
    expect(contract1.mismatches.map(m => m.field)).toEqual(contract2.mismatches.map(m => m.field));
    // But the actual SELECTED content differs.
    expect(contract1.mismatches[0].selected).not.toEqual(contract2.mismatches[0].selected);

    const preflight2 = resolveGenerationPreflight({
      workspaceId: 'senior-oldpop',
      options: optsAttempt2,
      slots,
      contract: contract2,
      designGate: CLEAN_DESIGN_GATE,
      acknowledgedSignature // the STALE signature from attempt 1
    });

    expect(preflight2.mismatchSignature).not.toEqual(acknowledgedSignature);
    expect(preflight2.allowed).toBe(false);
    expect(preflight2.requiresAcknowledgement).toBe(true);

    // Acknowledging the FRESH signature for attempt 2 does unblock it.
    const reacknowledged = resolveGenerationPreflight({
      workspaceId: 'senior-oldpop',
      options: optsAttempt2,
      slots,
      contract: contract2,
      designGate: CLEAN_DESIGN_GATE,
      acknowledgedSignature: preflight2.mismatchSignature
    });
    expect(reacknowledged.allowed).toBe(true);
  });
});

describe('stableHash', () => {
  it('is independent of object key order', () => {
    expect(stableHash({ a: 1, b: 2 })).toEqual(stableHash({ b: 2, a: 1 }));
  });

  it('is independent of nested object key order', () => {
    expect(stableHash({ outer: { a: 1, b: { c: 2, d: 3 } } })).toEqual(stableHash({ outer: { b: { d: 3, c: 2 }, a: 1 } }));
  });

  it('differs for genuinely different content', () => {
    expect(stableHash({ a: 1 })).not.toEqual(stableHash({ a: 2 }));
  });

  it('preserves array element order as semantically meaningful', () => {
    expect(stableHash([1, 2, 3])).not.toEqual(stableHash([3, 2, 1]));
  });
});

describe('evaluateGenerationRequest — the real end-to-end path every trigger point calls', () => {
  it('a clean, real pack (via preallocateSongSlots + buildResolvedGenerationContract + the real design gate) is allowed', async () => {
    // 4 genres @ 18 songs — a real config that clears every design-gate
    // threshold (genre variety/palette-family/vocal/money-chord/arrangement
    // density all resolve clean for this channel at this size; verified by
    // direct trial against the real pipeline, not guessed).
    const opts = makeOptions({ channel: seniorChannel, songCount: 18, genreIds: seniorChannel.preferredGenres.slice(0, 4) });
    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));

    const result = await evaluateGenerationRequest({ workspaceId: 'senior-oldpop', options: opts, genres });

    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('a real cross-workspace channel/workspace mismatch is caught end-to-end (proves the real orchestration wires workspaceId through, not just the pure function in isolation)', async () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 6, genreIds: seniorChannel.preferredGenres });
    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));

    // seniorChannel's archetype ('senior-morning') is not in kr-2030's own archetypeIds.
    const result = await evaluateGenerationRequest({ workspaceId: 'kr-2030', options: opts, genres });

    expect(result.allowed).toBe(false);
    expect(result.requiresAcknowledgement).toBe(false);
    expect(result.reasons.some(r => r.field === 'channelArchetype' && r.severity === 'block')).toBe(true);
  });

  it('a real cross-workspace genre contamination (kr-kids channel with a foreign senior genre id) is caught end-to-end', async () => {
    const krKidsChannel = channelPresets.find(channel => channel.archetype === 'kr-kids-song')!;
    const opts = makeOptions({
      channel: krKidsChannel,
      songCount: 4,
      genreIds: [...krKidsChannel.preferredGenres.slice(0, 1), 'oldpop-doowop-harmony']
    });
    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));

    const result = await evaluateGenerationRequest({ workspaceId: 'kr-kids', options: opts, genres });

    expect(result.allowed).toBe(false);
    expect(result.reasons.some(r => r.field === 'genreIds' && r.severity === 'warn')).toBe(true);
  });
});
