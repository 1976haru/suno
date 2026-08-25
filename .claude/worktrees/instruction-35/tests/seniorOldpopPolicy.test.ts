import { describe, expect, it } from 'vitest';
import {
  checkSeniorEraShare,
  checkSeniorMotifQuotas,
  countFinalKeyUps,
  countDistinctIntroTypes,
  checkChordProgressionDominance,
  SENIOR_ERA_POLICY,
  SENIOR_MUSIC_POLICY
} from '../src/core/seniorOldpopPolicy';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from './fixtures';
import { checkTitleHookRelationships, maxDisconnectedAllowed } from '../src/core/titleHookRelationship';

/**
 * codex 지시문 04 (§1) — real, dedicated senior-oldpop adapter. Fills 2
 * checks core/releaseReadiness.ts's own code already honestly documented
 * as `not-measured`/`notImplemented: true` (final key-up count,
 * intro-type variety), plus 4 genuinely new checks (78/11/11 era split,
 * fine-grained letter/coffee/window/train/porch/diner motif caps,
 * concept-is-subject override recording, chord-progression dominance cap)
 * — see src/core/seniorOldpopPolicy.ts's own doc comment for the full
 * scoping rationale.
 */
describe('[codex 지시문 04 §1] checkSeniorEraShare — 78/11/11 split', () => {
  it('a real, clean 1980s concept with every song genuinely from the 1980s bucket passes primary >= 78%', () => {
    const songs = Array.from({ length: 18 }, (_, i) => ({ trackNo: i + 1, genreId: 'oldpop-adult-contemporary-80s' }));
    const result = checkSeniorEraShare(songs, '1980년대 신스팝 느낌');
    expect(result).toBeDefined();
    expect(result?.primaryShare).toBeCloseTo(1, 5);
    expect(result?.primaryBelowTarget).toBe(false);
  });

  it('a pack with too many other-era-pure (wrong decade) tracks flags primaryBelowTarget and otherEraPureOverTarget', () => {
    const songs = [
      ...Array.from({ length: 12 }, (_, i) => ({ trackNo: i + 1, genreId: 'oldpop-adult-contemporary-80s' })),
      ...Array.from({ length: 6 }, (_, i) => ({ trackNo: i + 13, genreId: 'oldpop-doowop-harmony' })) // real 1950s-60s genre
    ];
    const result = checkSeniorEraShare(songs, '1980년대 신스팝 느낌');
    expect(result?.otherEraPureOverTarget).toBe(true);
    expect(result?.primaryBelowTarget).toBe(true);
  });

  it('a non-exploration other-era-pure track is individually flagged as blocking', () => {
    const songs = [
      { trackNo: 1, genreId: 'oldpop-adult-contemporary-80s' },
      { trackNo: 2, genreId: 'oldpop-doowop-harmony' } // wrong decade, not an exploration slot
    ];
    const result = checkSeniorEraShare(songs, '1980년대 신스팝 느낌');
    expect(result?.blockingOtherEraPureTrackNos).toContain(2);
  });

  it('an other-era-pure track that IS an exploration slot is not individually blocking', () => {
    const songs = [
      { trackNo: 1, genreId: 'oldpop-adult-contemporary-80s' },
      { trackNo: 2, genreId: 'oldpop-doowop-harmony' }
    ];
    const result = checkSeniorEraShare(songs, '1980년대 신스팝 느낌', [2]);
    expect(result?.blockingOtherEraPureTrackNos).not.toContain(2);
  });

  it('is a no-op (undefined) when the concept names no explicit era at all', () => {
    const songs = [{ trackNo: 1, genreId: 'oldpop-adult-contemporary-80s' }];
    expect(checkSeniorEraShare(songs, '비 오는 날 듣는 올드팝')).toBeUndefined();
  });

  it('this senior-specific 78% primary floor is deliberately stricter than the shared, workspace-agnostic ERA_POLICY (50%)', () => {
    expect(SENIOR_ERA_POLICY.singlePrimaryMin).toBeGreaterThan(0.5);
  });
});

describe('[codex 지시문 04 §1] checkSeniorMotifQuotas — fine-grained subject caps', () => {
  it('flags a pack with too many letter/mail songs (cap 2)', () => {
    const songs = Array.from({ length: 3 }, (_, i) => ({ trackNo: i + 1, lyrics: 'x', listenerSituation: 'reading an old letter by the window' }));
    const findings = checkSeniorMotifQuotas(songs);
    expect(findings.some(f => f.familyId === 'letter-mail')).toBe(true);
  });

  it('does not flag a pack within every subject cap', () => {
    const songs = [
      { trackNo: 1, lyrics: 'x', listenerSituation: 'a quiet afternoon walk' },
      { trackNo: 2, lyrics: 'x', listenerSituation: 'dancing at the reunion' }
    ];
    expect(checkSeniorMotifQuotas(songs)).toHaveLength(0);
  });

  it('records a real concept-is-subject override instead of a silent violation', () => {
    const songs = Array.from({ length: 3 }, (_, i) => ({ trackNo: i + 1, lyrics: 'x', listenerSituation: 'a letter arrives' }));
    const findings = checkSeniorMotifQuotas(songs, '오래된 편지 이야기를 담은 앨범 (letter concept)');
    const letterFinding = findings.find(f => f.familyId === 'letter-mail');
    expect(letterFinding?.overridden).toBe(true);
    expect(letterFinding?.overrideReasonKo).toBeDefined();
  });

  it('does NOT record an override when the concept never named the subject', () => {
    const songs = Array.from({ length: 3 }, (_, i) => ({ trackNo: i + 1, lyrics: 'x', listenerSituation: 'a letter arrives' }));
    const findings = checkSeniorMotifQuotas(songs, '비 오는 날의 올드팝');
    const letterFinding = findings.find(f => f.familyId === 'letter-mail');
    expect(letterFinding?.overridden).toBe(false);
  });
});

describe('[codex 지시문 04 §1] countFinalKeyUps — fills releaseReadiness.ts\'s own "modulation-count" gap', () => {
  it('counts real [key-lift final chorus] tags across a pack', () => {
    const songs = [
      { lyrics: '[verse 1]\nline\n\n[key-lift final chorus]\nHook' },
      { lyrics: '[verse 1]\nline\n\n[final chorus]\nHook' },
      { lyrics: '[verse 1]\nline\n\n[key-lift final chorus]\nHook' }
    ];
    expect(countFinalKeyUps(songs)).toBe(2);
  });

  it('the policy caps this at 5-6 per 18-song pack, per this task\'s own explicit number', () => {
    expect(SENIOR_MUSIC_POLICY.maxFinalKeyUp).toBe(6);
  });
});

describe('[codex 지시문 04 §1] countDistinctIntroTypes — fills releaseReadiness.ts\'s own "intro-type-variety" gap', () => {
  it('counts real distinct intro section tags across a pack', () => {
    const songs = [
      { lyrics: '[hook intro]\nline\n\n[chorus]\nHook' },
      { lyrics: '[instrumental hook]\n\n[chorus]\nHook' },
      { lyrics: '[a cappella hook]\nline\n\n[chorus]\nHook' },
      { lyrics: '[short intro]\nline\n\n[chorus]\nHook' }
    ];
    expect(countDistinctIntroTypes(songs)).toBe(4);
  });

  it('the same intro tag repeated across songs only counts once', () => {
    const songs = [
      { lyrics: '[short intro]\nline\n\n[chorus]\nHook' },
      { lyrics: '[short intro]\nline\n\n[chorus]\nHook' }
    ];
    expect(countDistinctIntroTypes(songs)).toBe(1);
  });

  it('the policy requires >= 4 distinct intro types, per this task\'s own explicit number', () => {
    expect(SENIOR_MUSIC_POLICY.minIntroTypeVariety).toBe(4);
  });
});

describe('[codex 지시문 04 §1] checkChordProgressionDominance', () => {
  it('flags a pack where one progression exceeds 55%', () => {
    const songs = [
      ...Array.from({ length: 11 }, () => ({ effectiveMoneyChordId: 'progression-a' })),
      ...Array.from({ length: 7 }, () => ({ effectiveMoneyChordId: 'progression-b' }))
    ];
    const result = checkChordProgressionDominance(songs);
    expect(result?.dominantId).toBe('progression-a');
    expect(result?.overCap).toBe(true);
  });

  it('does not flag a well-distributed pack', () => {
    const songs = [
      ...Array.from({ length: 6 }, () => ({ effectiveMoneyChordId: 'progression-a' })),
      ...Array.from({ length: 6 }, () => ({ effectiveMoneyChordId: 'progression-b' })),
      ...Array.from({ length: 6 }, () => ({ effectiveMoneyChordId: 'progression-c' }))
    ];
    expect(checkChordProgressionDominance(songs)?.overCap).toBe(false);
  });
});

describe('[codex 지시문 04 §1] 18-song regression — real senior-oldpop generation', () => {
  it('a real 18-song local-generation fixture stays within the disconnected title-hook quota (regression criterion: title/hook disconnected <= 2)', () => {
    const channel = channelPresets.find(c => c.archetype === 'senior-morning')!;
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel, songCount: 18 });
    const blueprint = generateLocalBlueprint(opts, genres, moods, seasonPacks[0]);
    const report = checkTitleHookRelationships(blueprint.songs);
    expect(report.disconnectedOverQuota, `${report.disconnectedCount} disconnected (quota ${maxDisconnectedAllowed(18)})`).toBe(false);
  });

  it('a real 18-song local-generation fixture stays within the final-key-up ceiling', () => {
    const channel = channelPresets.find(c => c.archetype === 'senior-morning')!;
    const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
    const opts = makeOptions({ channel, songCount: 18 });
    const blueprint = generateLocalBlueprint(opts, genres, moods, seasonPacks[0]);
    const keyUps = countFinalKeyUps(blueprint.songs);
    expect(keyUps, `${keyUps} key-ups`).toBeLessThanOrEqual(SENIOR_MUSIC_POLICY.maxFinalKeyUp);
  });
});
