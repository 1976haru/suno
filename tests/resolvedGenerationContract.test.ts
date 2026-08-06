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
import { buildResolvedGenerationContract, generationBlockedByContract, userChoicesFromOptions } from '../src/core/userChoices';
import { getGenreById, KR_KIDS_CORE_GENRE_IDS } from '../src/data/genreLibrary';
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
    ...overrides
  };
}

describe('buildResolvedGenerationContract — clean/no-mismatch case', () => {
  it('a real senior-morning pack with no explicit choices reports zero mismatches and is never blocked', () => {
    const opts = makeOptions({ channel: seniorChannel, songCount: 6, genreIds: seniorChannel.preferredGenres });
    const genres = opts.genreIds.map(id => getGenreById(id)).filter((g): g is NonNullable<typeof g> => Boolean(g));
    const blueprint = generateLocalBlueprint(opts, genres, testMoods, testSeason);
    const choices = userChoicesFromOptions(opts);

    const contract = buildResolvedGenerationContract(opts, choices, blueprint.songs);

    expect(contract.mismatches).toEqual([]);
    expect(generationBlockedByContract(contract)).toBe(false);
    expect(contract.workspaceId).toBe('senior-oldpop');
    expect(contract.archetype.effective).toBe('senior-morning');
    expect(contract.lyricLanguage).toBe(opts.lyricLanguage);
    expect(contract.audienceProfileId).toBe('senior');
    expect(contract.genreIds.removed).toEqual([]);
    expect(contract.genreIds.effective).toEqual(opts.genreIds);
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

    const contract = buildResolvedGenerationContract(opts, choices, slots);

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
    const contract = buildResolvedGenerationContract(opts, choices, slots);
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

    const contract = buildResolvedGenerationContract(opts, choices, blueprint.songs);

    expect(contract.genreIds.removed).toEqual([FOREIGN_ID_FOR_KIDS]);
    expect(contract.genreIds.effective).toEqual(KR_KIDS_CORE_GENRE_IDS.slice(0, 2));

    const genreMismatch = contract.mismatches.find(m => m.field === 'genreIds');
    expect(genreMismatch).toBeDefined();
    expect(genreMismatch?.selected).toContain(getGenreById(FOREIGN_ID_FOR_KIDS)?.label);
    expect(genreMismatch?.reasonKo).toContain('한국 동요');
    expect(contract.warnings.some(w => w.includes('⚠ 이 채널에서 쓸 수 없는 장르'))).toBe(true);

    expect(generationBlockedByContract(contract)).toBe(true);
    expect(generationBlockedByContract(contract, new Set(['genreIds']))).toBe(false);
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
