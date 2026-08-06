/**
 * TASK v5.10 (contract screen) — regression coverage for
 * core/userChoices.ts's ResolvedGenerationContract/buildResolvedGenerationContract/
 * generationBlockedByContract. Three scenarios:
 *  - a clean real pack (no mismatches, nothing blocked)
 *  - scenario A (task doc): an explicit money-chord pick that ends up at 0
 *    songs. Real generation can no longer reproduce this live (v5.7/v5.8
 *    already fixed the underlying resolver — see core/moneyChordDisplay.ts's
 *    own doc comment: buildUserChosenProgressionPlan's representative-track
 *    floor guarantees chosenCount >= min(3, songCount) for every reachable
 *    songCount), so this test injects the mismatch directly at the
 *    slots/opts level to prove the DETECTION and BLOCKING machinery itself
 *    still works for a future regression, exactly as moneyChordDisplay.ts's
 *    own doc comment says computeMoneyChordComparison's generic 0-count
 *    check exists to catch.
 *  - scenario E (task doc): real cross-workspace genre contamination via
 *    core/genreSelection.ts's sanitizeGenreIdsForArchetype, reproduced
 *    end-to-end through a real generateLocalBlueprint call (this one IS
 *    live-reachable today — an old saved channel, a workspace transfer, or
 *    a bad concept-agent recommendation can all still attach a foreign
 *    genre id).
 */
import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import {
  buildResolvedGenerationContract,
  computeWorkspaceRecoveryOptions,
  generationBlockedByContract,
  userChoicesFromOptions
} from '../src/core/userChoices';
import { resolveGenerationPreflight } from '../src/core/generationPreflight';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { getGenreById, KR_KIDS_CORE_GENRE_IDS } from '../src/data/genreLibrary';
import { vocalPresets } from '../src/data/vocalPresets';
import { getWorkspace } from '../src/data/workspaces';
import type { SongIdea } from '../src/types';
import { channelPresets, makeOptions, testMoods, testSeason } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;
const krKidsChannel = channelPresets.find(channel => channel.archetype === 'kr-kids-song')!;
const FOREIGN_ID_FOR_KIDS = 'oldpop-doowop-harmony';

function baseSong(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Test Title',
    seasonMoment: '',
    listenerSituation: '',
    emotionArc: '',
    hookPhrase: 'test hook',
    stylePrompt: 'test style prompt',
    lyrics: '[verse]\ntest lyrics',
    youtube: { title: 'yt title', description: '', tags: [] },
    qualityScore: 0,
    warnings: [],
    // v5.11 (TASK L) — genuine defaults for the new always-populated fields.
    effectiveMoneyChordId: 'default',
    effectiveGenreIds: [],
    effectiveArchetype: 'senior-morning',
    workspaceId: 'senior-oldpop',
    ...overrides
  };
}

describe('buildResolvedGenerationContract — clean/no-mismatch case', () => {
  it('a real senior-morning pack with no explicit choices reports zero mismatches and is never blocked', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 6, genreIds: seniorChannel.preferredGenres });
    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
    const choices = userChoicesFromOptions(opts);

    const contract = buildResolvedGenerationContract(opts, choices, blueprint.songs, 'senior-oldpop');

    expect(contract.mismatches).toEqual([]);
    expect(generationBlockedByContract(contract)).toBe(false);
    expect(contract.workspaceId).toBe('senior-oldpop');
    expect(contract.workspaceRecovery).toEqual({ mismatched: false });
    expect(contract.archetype.effective).toBe('senior-morning');
    expect(contract.lyricLanguage).toBe(opts.lyricLanguage);
    expect(contract.audienceProfileId).toBe('senior');
    expect(contract.genreIds.removed).toEqual([]);
    // TASK (gap 1) — genreIds.effective now reports REAL usage (which of the
    // 12-genre candidate pool actually landed on a real song in this 6-song
    // pack), not merely "archetype-eligible" — a strict subset of
    // opts.genreIds is expected, not equality (see genreEffective's own doc
    // comment in core/userChoices.ts for why the old `toEqual(opts.genreIds)`
    // here was itself testing option-level validity, not real usage).
    expect(contract.genreIds.effective.length).toBeGreaterThan(0);
    expect(contract.genreIds.effective.length).toBeLessThanOrEqual(opts.genreIds.length);
    for (const id of contract.genreIds.effective) expect(opts.genreIds).toContain(id);
    expect(new Set(contract.genreIds.effective)).toEqual(new Set(contract.genreCounts.map(entry => entry.id)));
    // Real per-song vocal tally should sum to songCount.
    const { male, female, mixed } = contract.vocal.effectiveQuota;
    expect(male + female + mixed).toBe(6);
    // Real per-song pov tally should sum to songCount too.
    const povTotal = Object.values(contract.perspective.counts).reduce((sum, n) => sum + (n ?? 0), 0);
    expect(povTotal).toBe(6);
  });
});

describe('buildResolvedGenerationContract — scenario A (money-chord override)', () => {
  it('detects and blocks an explicit money-chord pick that resolved to 0 songs (injected — see file header for why this is no longer live-reachable)', () => {
    const opts = makeOptions({
      channel: seniorChannel,
      songCount: 6,
      moneyChordMode: 'winterBallad',
      moneyChordModeIsExplicitChoice: true,
      genreIds: seniorChannel.preferredGenres
    });
    const choices = userChoicesFromOptions(opts);
    expect(choices.source.moneyChordMode).toBe('user');

    // Every slot resolved to a DIFFERENT progression than the user's explicit
    // "winterBallad" pick — simulates the exact "chosen id resolves to 0
    // songs" regression class this whole task exists to catch.
    const slots: SongIdea[] = Array.from({ length: 6 }, (_, i) => baseSong({
      trackNo: i + 1,
      moneyChordId: 'jazzColor',
      genreId: seniorChannel.preferredGenres[0],
      vocalType: i % 2 === 0 ? 'male' : 'female',
      pov: 'firstPerson'
    }));

    const contract = buildResolvedGenerationContract(opts, choices, slots, 'senior-oldpop');

    const moneyChordMismatches = contract.mismatches.filter(m => m.field === 'moneyChordMode');
    expect(moneyChordMismatches).toHaveLength(1);
    expect(moneyChordMismatches[0].selected).toContain('겨울');
    expect(contract.warnings.some(w => w.includes('선택하신'))).toBe(true);

    expect(generationBlockedByContract(contract)).toBe(true);
    // Acknowledging exactly this field's mismatch unblocks generation.
    expect(generationBlockedByContract(contract, new Set(['moneyChordMode']))).toBe(false);
    // Acknowledging an unrelated field does NOT unblock it.
    expect(generationBlockedByContract(contract, new Set(['genreIds']))).toBe(true);
  });

  it('the earworm-mode reason line is used when earwormMode is on', () => {
    const opts = makeOptions({
      channel: seniorChannel,
      songCount: 6,
      moneyChordMode: 'winterBallad',
      moneyChordModeIsExplicitChoice: true,
      earwormMode: true,
      genreIds: seniorChannel.preferredGenres
    });
    const choices = userChoicesFromOptions(opts);
    const slots: SongIdea[] = Array.from({ length: 6 }, (_, i) => baseSong({ trackNo: i + 1, moneyChordId: 'jazzColor' }));
    const contract = buildResolvedGenerationContract(opts, choices, slots, 'senior-oldpop');
    const moneyChordMismatch = contract.mismatches.find(m => m.field === 'moneyChordMode');
    expect(moneyChordMismatch?.reasonKo).toContain('귀에 잘 붙는');
  });
});

describe('buildResolvedGenerationContract — scenario E (cross-workspace genre contamination)', () => {
  it('a real generateLocalBlueprint run with a foreign genre id reports it as a removed/mismatched genre and blocks', () => {
    const opts = makeOptions({
      channel: krKidsChannel,
      songCount: 4,
      genreIds: [...KR_KIDS_CORE_GENRE_IDS.slice(0, 2), FOREIGN_ID_FOR_KIDS]
    });
    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
    const choices = userChoicesFromOptions(opts);

    const contract = buildResolvedGenerationContract(opts, choices, blueprint.songs, 'kr-kids');

    expect(contract.genreIds.removed).toEqual([FOREIGN_ID_FOR_KIDS]);
    expect(new Set(contract.genreIds.effective)).toEqual(new Set(KR_KIDS_CORE_GENRE_IDS.slice(0, 2)));

    const genreMismatch = contract.mismatches.find(m => m.field === 'genreIds');
    expect(genreMismatch).toBeDefined();
    expect(genreMismatch?.selected).toContain(getGenreById(FOREIGN_ID_FOR_KIDS)?.label);
    expect(genreMismatch?.reasonKo).toContain('한국 동요');
    expect(contract.warnings.some(w => w.includes('⚠ 이 채널에서 쓸 수 없는 장르'))).toBe(true);

    expect(generationBlockedByContract(contract)).toBe(true);
    expect(generationBlockedByContract(contract, new Set(['genreIds']))).toBe(false);
  });
});

describe('buildResolvedGenerationContract — TASK (gap 1): genre real-usage under-allocation', () => {
  it('a real generateLocalBlueprint run (songCount=3, 5 explicitly-selected valid genres) reports the genres that got 0 real songs, not just the ones archetype-eligibility would have allowed', () => {
    // Real, measured behavior (not synthetic slots): a 3-song pack drawing
    // from 5 archetype-eligible genres only ever lands on 3 of them — the
    // exact "option-level validity != actual usage" gap this task exists to
    // close. selectedGenreFamilyIds is set so userChoicesFromOptions marks
    // genreIds as a genuine explicit user pick (source: 'user') — the same
    // provenance a real Step2Concept multi-select produces.
    const explicitGenreIds = seniorChannel.preferredGenres.slice(0, 5);
    const opts = makeOptions({
      channel: seniorChannel,
      songCount: 3,
      genreIds: explicitGenreIds,
      selectedGenreFamilyIds: ['probe-family']
    });
    const choices = userChoicesFromOptions(opts);
    expect(choices.source.genreIds).toBe('user');

    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
    const realUsedIds = new Set(blueprint.songs.map(s => s.genreId).filter(Boolean));
    // Sanity: real generation really did under-allocate — fewer distinct
    // genres landed on a real song than were selected (the premise this test
    // needs to actually exercise the new code path, not just assert on it).
    expect(realUsedIds.size).toBeLessThan(explicitGenreIds.length);

    const contract = buildResolvedGenerationContract(opts, choices, blueprint.songs, 'senior-oldpop');

    // genreIds.effective now reports exactly the real per-song usage.
    expect(new Set(contract.genreIds.effective)).toEqual(realUsedIds);
    const unusedIds = explicitGenreIds.filter(id => !realUsedIds.has(id));
    expect(unusedIds.length).toBeGreaterThan(0);

    const genreMismatch = contract.mismatches.find(m => m.field === 'genreIds');
    expect(genreMismatch).toBeDefined();
    for (const id of unusedIds) expect(genreMismatch?.selected).toContain(getGenreById(id)?.label);
    expect(genreMismatch?.reasonKo).toContain('결과에 반영되지 않았습니다');
    // A genuinely-used genre must NOT appear in the "selected" (unused) list.
    for (const id of realUsedIds) expect(genreMismatch?.selected).not.toContain(getGenreById(id)?.label);

    expect(generationBlockedByContract(contract)).toBe(true);
    expect(generationBlockedByContract(contract, new Set(['genreIds']))).toBe(false);
  });

  it('a channel default genreIds pool (no explicit family-picker selection) never false-positives on this check, even though most of a large pool legitimately goes unused per pack', () => {
    // seniorChannel.preferredGenres is a deliberately large CANDIDATE POOL
    // (12 ids) a real pack draws a subset from, not a per-pack requirement —
    // see data/presets.ts's own preferredGenres doc comment. Without
    // selectedGenreFamilyIds set, userChoicesFromOptions never marks this as
    // an explicit pick, so the new under-allocation check must stay silent.
    const opts = makeOptions({ channel: seniorChannel, songCount: 6, genreIds: seniorChannel.preferredGenres });
    const choices = userChoicesFromOptions(opts);
    expect(choices.source.genreIds).toBeUndefined();

    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
    const contract = buildResolvedGenerationContract(opts, choices, blueprint.songs, 'senior-oldpop');

    expect(contract.mismatches.filter(m => m.field === 'genreIds')).toEqual([]);
  });
});

describe('buildResolvedGenerationContract — TASK (gap 1): vocal preset real-usage check', () => {
  it('a real female-leaning vocalTone pick actually reflected in the real per-song vocalType tally is reported as applied', () => {
    const femalePreset = vocalPresets.find(p => p.id === 'soft-female')!;
    const opts = makeOptions({ channel: seniorChannel, songCount: 12, genreIds: seniorChannel.preferredGenres, vocalTone: femalePreset.prompt });
    const choices = userChoicesFromOptions(opts);
    expect(choices.source.vocalTone).toBeUndefined(); // vocalTone provenance isn't separately tracked by userChoicesFromOptions today — presetApplied is checked directly on the contract instead.

    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
    const contract = buildResolvedGenerationContract(opts, choices, blueprint.songs, 'senior-oldpop');

    expect(contract.vocal.presetApplied).toBe(true);
    expect(contract.vocal.effectiveQuota.female).toBeGreaterThan(contract.vocal.effectiveQuota.male);
  });
});

describe('buildResolvedGenerationContract — TASK (gap 2): real active workspace, not reverse-derived', () => {
  it('workspaceId is exactly the caller-supplied activeWorkspaceId, even for a channel whose archetype belongs to a DIFFERENT workspace', () => {
    // seniorChannel's real archetype ('senior-morning') belongs to
    // 'senior-oldpop' (data/workspaces/index.ts) — reverse-derivation
    // (the pre-fix behavior) would have computed workspaceId: 'senior-oldpop'
    // here regardless of what the caller actually passed in, silently
    // hiding the real mismatch. This proves it no longer does that.
    const opts = makeOptions({ channel: seniorChannel, songCount: 4, genreIds: seniorChannel.preferredGenres });
    const choices = userChoicesFromOptions(opts);
    const slots = preallocateSongSlots(opts, opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g)));

    const contractWrongWorkspace = buildResolvedGenerationContract(opts, choices, slots, 'kr-kids');
    expect(contractWrongWorkspace.workspaceId).toBe('kr-kids');
    expect(contractWrongWorkspace.workspaceId).not.toBe('senior-oldpop');
    expect(contractWrongWorkspace.workspaceRecovery.mismatched).toBe(true);
    expect(contractWrongWorkspace.workspaceRecovery.correctWorkspaceId).toBe('senior-oldpop');
    expect(contractWrongWorkspace.warnings.some(w => w.includes('현재 워크스페이스'))).toBe(true);

    const contractRightWorkspace = buildResolvedGenerationContract(opts, choices, slots, 'senior-oldpop');
    expect(contractRightWorkspace.workspaceId).toBe('senior-oldpop');
    expect(contractRightWorkspace.workspaceRecovery).toEqual({ mismatched: false });

    // core/generationPreflight.ts's channelArchetypeHardBlock is the real,
    // sole enforcement of this condition (never an acknowledgeable
    // mismatches[] entry) — confirm it agrees with the mismatched contract
    // above rather than disagreeing with it, using the SAME real
    // activeWorkspaceId both were built from.
    const designGate = { passed: true, blocking: [], advisory: [] };
    const preflight = resolveGenerationPreflight({
      workspaceId: 'kr-kids',
      options: opts,
      slots,
      contract: contractWrongWorkspace,
      designGate
    });
    expect(preflight.allowed).toBe(false);
    expect(preflight.requiresAcknowledgement).toBe(false);
    expect(preflight.reasons).toEqual([{
      field: 'channelArchetype',
      severity: 'block',
      messageKo: expect.stringContaining('한국 동요')
    }]);
  });
});

describe('computeWorkspaceRecoveryOptions — TASK (gap 2): the 4 recovery options', () => {
  it('a mismatched channel/workspace pair surfaces the correct workspace and a real suggested default channel for the ACTIVE workspace', () => {
    const recovery = computeWorkspaceRecoveryOptions('senior-morning', 'kr-kids');
    expect(recovery.mismatched).toBe(true);
    expect(recovery.correctWorkspaceId).toBe('senior-oldpop');
    expect(recovery.suggestedDefaultChannel).toBeDefined();
    // The suggested default channel must itself genuinely belong to the
    // ACTIVE workspace (kr-kids), not the channel's own original one.
    expect(getWorkspace('kr-kids').archetypeIds).toContain(recovery.suggestedDefaultChannel?.archetype);
  });

  it('a matched channel/workspace pair reports no recovery options at all (nothing to recover from)', () => {
    const recovery = computeWorkspaceRecoveryOptions('senior-morning', 'senior-oldpop');
    expect(recovery).toEqual({ mismatched: false });
  });

  it('an archetype that belongs to no shipped workspace at all has no correctWorkspaceId to navigate to (still surfaces mismatched + a default-channel option)', () => {
    // A defensively-typed foreign archetype string — every REAL
    // ChannelArchetype belongs to some workspace, so this simulates the
    // "corrupted/unknown archetype" edge case the task doc calls out
    // ("no navigate-to-correct-workspace option if the channel's archetype
    // genuinely doesn't belong anywhere").
    const recovery = computeWorkspaceRecoveryOptions('does-not-exist-anywhere' as unknown as Parameters<typeof computeWorkspaceRecoveryOptions>[0], 'kr-kids');
    expect(recovery.mismatched).toBe(true);
    expect(recovery.correctWorkspaceId).toBeUndefined();
    expect(recovery.suggestedDefaultChannel).toBeDefined();
  });
});

describe('generationBlockedByContract — pure predicate', () => {
  it('is false for zero mismatches', () => {
    expect(generationBlockedByContract({ mismatches: [] })).toBe(false);
  });

  it('is true for any unacknowledged mismatch', () => {
    expect(generationBlockedByContract({
      mismatches: [{ field: 'moneyChordMode', selected: 'A', effective: 'B', reasonKo: 'r' }]
    })).toBe(true);
  });

  it('two different mismatches require BOTH fields acknowledged, not just one', () => {
    const contract = {
      mismatches: [
        { field: 'moneyChordMode', selected: 'A', effective: 'B', reasonKo: 'r1' },
        { field: 'genreIds', selected: 'C', effective: 'D', reasonKo: 'r2' }
      ]
    };
    expect(generationBlockedByContract(contract, new Set(['moneyChordMode']))).toBe(true);
    expect(generationBlockedByContract(contract, new Set(['moneyChordMode', 'genreIds']))).toBe(false);
  });
});
