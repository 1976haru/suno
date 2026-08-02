import { describe, expect, it } from 'vitest';
import { SEED_VERIFIED_COMBOS, type VerifiedCombo } from '../src/data/verifiedCombos';
import {
  effectiveVerifiedCombos,
  resolveFlagshipCombo,
  suggestCombosFromRatings,
  verifiedComboFromSuggestion,
  type ComboSuggestion
} from '../src/core/verifiedCombos';
import type { RatingRecord } from '../src/core/ratingLedger';

describe('[v3.82 TASK A] SEED_VERIFIED_COMBOS — the real T1/T4/T7 finding is registered', () => {
  it('has exactly the good philly-soul-81 combo and the rejected sparse-plate hypothesis', () => {
    const good = SEED_VERIFIED_COMBOS.find(c => c.id === 'senior-philly-81');
    expect(good).toBeDefined();
    expect(good!.verdict).toBe('good');
    expect(good!.genreId).toBe('oldpop-philly-soul-sweet');
    expect(good!.sampleSize).toBe(3);
    expect(good!.vocalType).toBeUndefined(); // confirmed gender-independent by T7

    const rejected = SEED_VERIFIED_COMBOS.find(c => c.id === 'senior-sparse-plate-REJECTED');
    expect(rejected).toBeDefined();
    expect(rejected!.verdict).toBe('bad');
  });

  it('the rejected hypothesis is NEVER deleted — this task\'s own §7 "폐기된 가설을 삭제하지 말 것"', () => {
    expect(SEED_VERIFIED_COMBOS.filter(c => c.verdict === 'bad').length).toBeGreaterThanOrEqual(1);
  });
});

describe('[v3.82 TASK A] effectiveVerifiedCombos', () => {
  it('combines seed + approved combos scoped to one workspace', () => {
    const approved: VerifiedCombo[] = [{
      id: 'senior-motown-80',
      workspaceId: 'senior-oldpop',
      genreId: 'oldpop-motown-pop-soul',
      bpmRange: [78, 86],
      verdict: 'good',
      sampleSize: 5,
      sampleTracks: [],
      verifiedAt: '2026-08-10',
      noteKo: 'test',
      cautionsKo: []
    }];
    const effective = effectiveVerifiedCombos('senior-oldpop', approved);
    expect(effective.some(c => c.id === 'senior-philly-81')).toBe(true);
    expect(effective.some(c => c.id === 'senior-motown-80')).toBe(true);
  });

  it('never leaks a different workspace\'s combos', () => {
    const approved: VerifiedCombo[] = [{
      id: 'kids-x',
      workspaceId: 'kr-kids',
      genreId: 'some-genre',
      bpmRange: [100, 110],
      verdict: 'good',
      sampleSize: 5,
      sampleTracks: [],
      verifiedAt: '2026-08-10',
      noteKo: 'test',
      cautionsKo: []
    }];
    const effective = effectiveVerifiedCombos('senior-oldpop', approved);
    expect(effective.some(c => c.workspaceId === 'kr-kids')).toBe(false);
  });
});

describe('[v3.82 TASK A] resolveFlagshipCombo', () => {
  it('picks the seeded good combo when its genre is available in the channel pool', () => {
    const effective = effectiveVerifiedCombos('senior-oldpop', []);
    const resolved = resolveFlagshipCombo(effective, ['oldpop-philly-soul-sweet', 'oldpop-motown-pop-soul']);
    expect(resolved?.id).toBe('senior-philly-81');
  });

  it('returns undefined when no available genre matches any good combo', () => {
    const effective = effectiveVerifiedCombos('senior-oldpop', []);
    const resolved = resolveFlagshipCombo(effective, ['oldpop-soft-rock-am']);
    expect(resolved).toBeUndefined();
  });

  it('never returns a verdict:"bad" combo, even if its genre matches', () => {
    const badCombo: VerifiedCombo = { ...SEED_VERIFIED_COMBOS[0], id: 'bad-1', verdict: 'bad', genreId: 'oldpop-warm-morning-glow', sampleSize: 10 };
    const resolved = resolveFlagshipCombo([badCombo], ['oldpop-warm-morning-glow']);
    expect(resolved).toBeUndefined();
  });

  it('ignores a good combo below the sampleSize>=3 floor', () => {
    const thin: VerifiedCombo = { ...SEED_VERIFIED_COMBOS[0], id: 'thin-1', sampleSize: 2, genreId: 'oldpop-warm-morning-glow' };
    const resolved = resolveFlagshipCombo([thin], ['oldpop-warm-morning-glow']);
    expect(resolved).toBeUndefined();
  });

  it('prefers the higher-sampleSize combo when two both qualify', () => {
    const small: VerifiedCombo = { ...SEED_VERIFIED_COMBOS[0], id: 'small', sampleSize: 3, genreId: 'oldpop-warm-morning-glow' };
    const big: VerifiedCombo = { ...SEED_VERIFIED_COMBOS[0], id: 'big', sampleSize: 8, genreId: 'oldpop-soft-rock-am' };
    const resolved = resolveFlagshipCombo([small, big], ['oldpop-warm-morning-glow', 'oldpop-soft-rock-am']);
    expect(resolved?.id).toBe('big');
  });
});

function rating(genreId: string, bpm: number, verdict: 'good' | 'ok' | 'bad', workspaceId: 'senior-oldpop' = 'senior-oldpop'): RatingRecord {
  return {
    songId: Math.random().toString(36),
    packId: 'p',
    rating: verdict,
    ratedAt: '2026-08-10T00:00:00.000Z',
    workspaceId,
    attributes: { genreId, bpm, vocalType: 'female', channelId: 'c' }
  };
}

describe('[v3.82 TASK A, 1-4] suggestCombosFromRatings — proposes, never auto-registers', () => {
  it('suggests "good" for a (genre, bpm-bucket) with sampleSize>=5 and >=70% good', () => {
    const ratings: RatingRecord[] = [
      rating('oldpop-motown-pop-soul', 80, 'good'),
      rating('oldpop-motown-pop-soul', 82, 'good'),
      rating('oldpop-motown-pop-soul', 84, 'good'),
      rating('oldpop-motown-pop-soul', 86, 'good'),
      rating('oldpop-motown-pop-soul', 81, 'ok')
    ];
    const suggestions = suggestCombosFromRatings(ratings, 'senior-oldpop', []);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].genreId).toBe('oldpop-motown-pop-soul');
    expect(suggestions[0].suggestedVerdict).toBe('good');
    expect(suggestions[0].sampleSize).toBe(5);
  });

  it('suggests "bad" for a (genre, bpm-bucket) with sampleSize>=5 and <=30% good', () => {
    const ratings: RatingRecord[] = [
      rating('oldpop-warm-morning-glow', 80, 'bad'),
      rating('oldpop-warm-morning-glow', 81, 'bad'),
      rating('oldpop-warm-morning-glow', 82, 'bad'),
      rating('oldpop-warm-morning-glow', 83, 'ok'),
      rating('oldpop-warm-morning-glow', 84, 'good')
    ];
    const suggestions = suggestCombosFromRatings(ratings, 'senior-oldpop', []);
    expect(suggestions[0].suggestedVerdict).toBe('bad');
  });

  it('never suggests below sampleSize 5, even at 100% good', () => {
    const ratings: RatingRecord[] = [
      rating('oldpop-soft-rock-am', 90, 'good'),
      rating('oldpop-soft-rock-am', 91, 'good')
    ];
    expect(suggestCombosFromRatings(ratings, 'senior-oldpop', [])).toEqual([]);
  });

  it('does not re-suggest a (genre, bpm-bucket) that already has an effective combo', () => {
    const ratings: RatingRecord[] = Array.from({ length: 6 }, (_, i) => rating('oldpop-philly-soul-sweet', 80 + i, 'good'));
    const suggestions = suggestCombosFromRatings(ratings, 'senior-oldpop', SEED_VERIFIED_COMBOS);
    expect(suggestions.some(s => s.genreId === 'oldpop-philly-soul-sweet')).toBe(false);
  });

  it('is workspace-scoped — a different workspace\'s ratings never leak in', () => {
    const ratings: RatingRecord[] = Array.from({ length: 6 }, () => rating('oldpop-motown-pop-soul', 80, 'good', 'senior-oldpop'));
    const otherWorkspace = suggestCombosFromRatings(ratings, 'kr-2030' as never, []);
    expect(otherWorkspace).toEqual([]);
  });

  it('does not depend on vocalType — a good combo across mixed vocal types still counts (T7\'s own gender-independence finding)', () => {
    const ratings: RatingRecord[] = [
      { ...rating('oldpop-motown-pop-soul', 80, 'good'), attributes: { genreId: 'oldpop-motown-pop-soul', bpm: 80, vocalType: 'male', channelId: 'c' } },
      { ...rating('oldpop-motown-pop-soul', 81, 'good'), attributes: { genreId: 'oldpop-motown-pop-soul', bpm: 81, vocalType: 'female', channelId: 'c' } },
      { ...rating('oldpop-motown-pop-soul', 82, 'good'), attributes: { genreId: 'oldpop-motown-pop-soul', bpm: 82, vocalType: 'mixed', channelId: 'c' } },
      { ...rating('oldpop-motown-pop-soul', 83, 'good'), attributes: { genreId: 'oldpop-motown-pop-soul', bpm: 83, vocalType: 'male', channelId: 'c' } },
      { ...rating('oldpop-motown-pop-soul', 84, 'good'), attributes: { genreId: 'oldpop-motown-pop-soul', bpm: 84, vocalType: 'female', channelId: 'c' } }
    ];
    const suggestions = suggestCombosFromRatings(ratings, 'senior-oldpop', []);
    expect(suggestions.length).toBe(1);
  });
});

describe('[v3.82 TASK A] verifiedComboFromSuggestion', () => {
  it('converts a ComboSuggestion into a well-formed VerifiedCombo', () => {
    const suggestion: ComboSuggestion = {
      genreId: 'oldpop-motown-pop-soul',
      bpmRange: [80, 87],
      sampleSize: 6,
      goodShare: 0.83,
      suggestedVerdict: 'good',
      reasonKo: 'test'
    };
    const combo = verifiedComboFromSuggestion(suggestion, 'senior-oldpop');
    expect(combo.workspaceId).toBe('senior-oldpop');
    expect(combo.genreId).toBe('oldpop-motown-pop-soul');
    expect(combo.verdict).toBe('good');
    expect(combo.sampleSize).toBe(6);
    expect(combo.id).toContain('senior-oldpop');
  });
});
