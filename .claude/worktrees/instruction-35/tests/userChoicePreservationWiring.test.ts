/**
 * v5.7 follow-up (production wiring) — regression guard for the wiring
 * itself, not the underlying pipeline logic tests/userChoicePreservation.test.ts
 * already covers. core/userChoices.ts's assertUserChoicesPreserved/
 * assertUserChoicesPreservedOrThrow existed but were ONLY ever called from
 * scripts/v57Measure.ts (a manual measurement script) and test files — never
 * from the real live entry points (core/setDirector.ts's directSetLocal/
 * buildSetPlanFromIntent) a real "생성" click actually runs. This file
 * exercises that wiring directly:
 *
 *   1. a synthetically-reintroduced violation (batchPreallocation's
 *      preallocateSongSlots mocked to silently redirect every song's
 *      moneyChordId to a different preset than the one requested — the
 *      exact "system default silently overrides an explicit user choice"
 *      bug class v3.77/v4.13/v4.7/v5.7 all were) actually makes
 *      directSetLocal throw, proving the guardrail fires from the real
 *      entry point and isn't just a dead function nobody calls.
 *   2. normal, legitimate generation across a representative set of real
 *      explicit choices (money-chord presets, palette family, breadth,
 *      multi-artist segment via buildSetPlanFromIntent) does NOT throw and
 *      does NOT add a user-choice-preservation warning — a guardrail that
 *      cries wolf on every normal generation is worse than none.
 *
 * Dev-mode throw (not a returned/logged warning) is expected here because
 * Vitest runs with import.meta.env.DEV === true (verified empirically) —
 * see setDirector.ts's isProductionRuntime/checkUserChoicesPreservation doc
 * comments for the full dev/prod split this implements.
 */
import { describe, expect, it, vi } from 'vitest';
import { channelPresets, makeOptions } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;

describe('[v5.7 follow-up] live wiring — directSetLocal actually calls assertUserChoicesPreserved', () => {
  it('fires (throws) when the internal allocation step silently redirects an explicit money-chord choice to a different preset', async () => {
    vi.resetModules();
    vi.doMock('../src/core/batchPreallocation', async () => {
      const actual = await vi.importActual<typeof import('../src/core/batchPreallocation')>('../src/core/batchPreallocation');
      return {
        ...actual,
        // Simulates the exact regression class this whole guardrail exists
        // to catch: every slot that WOULD have carried the user's chosen
        // 'winterBallad' progression instead silently gets 'jazzColor' —
        // total > 0 but the chosen mode's own count is 0.
        preallocateSongSlots: (...args: Parameters<typeof actual.preallocateSongSlots>) =>
          actual.preallocateSongSlots(...args).map(slot => (slot.moneyChordId ? { ...slot, moneyChordId: 'jazzColor' } : slot))
      };
    });

    const { directSetLocal } = await import('../src/core/setDirector');
    const { userChoicesFromOptions } = await import('../src/core/userChoices');
    const opts = makeOptions({
      channel: seniorChannel,
      songCount: 18,
      moneyChordMode: 'winterBallad',
      moneyChordModeIsExplicitChoice: true,
      genreIds: seniorChannel.preferredGenres
    });

    expect(() => directSetLocal(
      '겨울 발라드 세트',
      seniorChannel,
      18,
      { recentGenreIds: [], recentHooks: [] },
      [],
      opts.vocalTone,
      undefined,
      undefined,
      userChoicesFromOptions(opts)
    )).toThrow(/winterBallad/);

    vi.doUnmock('../src/core/batchPreallocation');
    vi.resetModules();
  });

  it('fires (throws) when a genre choice is entirely absent from the resolved genre axis (forged choices, no mocking needed — proves the genreIds branch of the same wired-in check)', async () => {
    const { directSetLocal } = await import('../src/core/setDirector');
    const forgedChoices = {
      genreIds: ['this-genre-id-does-not-exist-and-can-never-be-selected'],
      source: { genreIds: 'user' as const }
    };
    expect(() => directSetLocal(
      '잔잔한 올드팝 세트',
      seniorChannel,
      18,
      { recentGenreIds: [], recentHooks: [] },
      [],
      undefined,
      undefined,
      undefined,
      forgedChoices
    )).toThrow(/사용자가 선택한 장르/);
  });
});

describe('[v5.7 follow-up] live wiring — no false positives on legitimate normal generation', () => {
  const USER_SELECTABLE_MONEY_CHORDS = ['emotional', 'jazzColor', 'cityPop', 'canon', 'showaModern', 'winterBallad'] as const;

  it.each(USER_SELECTABLE_MONEY_CHORDS)('directSetLocal does not throw for a real explicit money-chord choice of "%s"', async mode => {
    const { directSetLocal } = await import('../src/core/setDirector');
    const { userChoicesFromOptions } = await import('../src/core/userChoices');
    const opts = makeOptions({
      channel: seniorChannel,
      songCount: 18,
      moneyChordMode: mode,
      moneyChordModeIsExplicitChoice: true,
      genreIds: seniorChannel.preferredGenres
    });
    let plan: ReturnType<typeof directSetLocal> | undefined;
    expect(() => {
      plan = directSetLocal('겨울 발라드 세트', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, [], opts.vocalTone, undefined, undefined, userChoicesFromOptions(opts));
    }).not.toThrow();
    expect(plan!.warnings.some(w => w.includes('사용자가 선택한'))).toBe(false);
  });

  it('directSetLocal does not throw for an explicit palette-family override + breadth choice', async () => {
    const { directSetLocal } = await import('../src/core/setDirector');
    const { userChoicesFromOptions } = await import('../src/core/userChoices');
    const opts = makeOptions({ channel: seniorChannel, songCount: 18, paletteFamilyOverride: 'family-orchestral', breadthOverride: 'variety', genreIds: seniorChannel.preferredGenres });
    let plan: ReturnType<typeof directSetLocal> | undefined;
    expect(() => {
      plan = directSetLocal('60년대 감미로운 올드팝', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, [], opts.vocalTone, opts.breadthOverride, opts.paletteFamilyOverride, userChoicesFromOptions(opts));
    }).not.toThrow();
    expect(plan!.warnings.some(w => w.includes('사용자가 선택한'))).toBe(false);
  });

  it('directSetLocal with no explicit choices at all (emptyUserChoices default) never throws', async () => {
    const { directSetLocal } = await import('../src/core/setDirector');
    expect(() => directSetLocal('신나는 여름 드라이브', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] })).not.toThrow();
  });

  it('buildSetPlanFromIntent (multi-artist segment path) with an explicit money-chord choice does not throw', async () => {
    const { directSetLocal } = await import('../src/core/setDirector');
    const { userChoicesFromOptions } = await import('../src/core/userChoices');
    const opts = makeOptions({
      channel: seniorChannel,
      songCount: 18,
      moneyChordMode: 'cityPop',
      moneyChordModeIsExplicitChoice: true,
      genreIds: seniorChannel.preferredGenres
    });
    // "카펜터스와 아바" (2+ known artist references) routes through
    // buildSetPlanFromIntent's own segment branch, not directSetLocal's
    // plain keyword/family path — see setDirector.ts's own doc comment.
    let plan: ReturnType<typeof directSetLocal> | undefined;
    expect(() => {
      plan = directSetLocal('카펜터스와 아바 9곡씩', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] }, [], opts.vocalTone, undefined, undefined, userChoicesFromOptions(opts));
    }).not.toThrow();
    expect(plan!.warnings.some(w => w.includes('사용자가 선택한'))).toBe(false);
  });
});
