import { describe, expect, it } from 'vitest';
import { BREADTH_THRESHOLDS, evaluateDesignGate, lastBundleIntensityViolation } from '../src/core/designGate';
import { resolveConstraintsFromOptions, type EraConstraint, type ResolvedConstraints } from '../src/core/constraints';
import { SENIOR_AUDIENCE_PROFILE, audienceProfileById, audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { buildRepetitionCyclePlan, kidsArcBundlePlanFor } from '../src/core/arcModels';
import { buildUserChosenProgressionPlan, REPRESENTATIVE_TRACK_COUNT } from '../src/core/moneyChordPlan';
import { scaleVocalQuota } from '../src/core/vocalPlan';
import { ERA_POLICY } from '../src/data/eraPolicy';
import type { ChannelProfile, GenerationOptions, PreassignedSongSlot } from '../src/types';

/**
 * v3.78 (TASK A) — reproduction tests for core/designGate.ts, mirroring
 * tests/compositionScorer.test.ts's own v3.77 "재현한 실패 -> 실제로 발동하는지"
 * pattern (this task's own §5's "실제 코드를 실행해서 검증" applies just as much
 * to unit tests as to the stress-test CLI script — a controlled, hand-built
 * input is the fastest way to prove a check fires on exactly the failure it
 * exists to catch, and does NOT fire on a healthy pack).
 */

const CHANNEL: ChannelProfile = {
  id: 'test-channel',
  name: 'Test Channel',
  market: 'custom',
  primaryLanguage: 'english',
  audience: 'seniors',
  promise: 'test',
  visualIdentity: 'test',
  defaultVocal: 'mature soulful male tenor',
  // TASK v4.7 (TASK A/B) — swapped to 5 genres every eraCanonPalette actually
  // covers (data/eraCanonPalettes.ts), spanning 4 distinct palettes, so this
  // "healthy" fixture also satisfies the new palette-coverage/variety design-
  // gate check (designGate.ts's paletteCoverageIssues) instead of tripping
  // it purely as an artifact of pre-v4.6 genre choices.
  preferredGenres: ['oldpop-soft-rock-am', 'oldpop-adult-contemporary-80s', 'oldpop-europop-glow', 'oldpop-british-beat', 'oldpop-close-harmony-duo'],
  preferredMoods: ['nostalgic'],
  forbiddenCliches: [],
  seoKeywords: [],
  archetype: 'senior-morning'
};

function baseOpts(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
  return {
    channel: CHANNEL,
    projectTitle: 'test',
    songCount: 18,
    lyricLanguage: 'english',
    market: 'custom',
    audience: 'seniors',
    genreIds: CHANNEL.preferredGenres,
    moodIds: ['nostalgic'],
    seasonId: 'spring',
    vocalTone: CHANNEL.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: '',
    avoidWords: '',
    personaMode: false,
    ...overrides
  };
}

function baseConstraints(opts: GenerationOptions): ResolvedConstraints {
  return resolveConstraintsFromOptions(opts, SENIOR_AUDIENCE_PROFILE, 'senior-oldpop');
}

function slotFor(overrides: Partial<PreassignedSongSlot>): PreassignedSongSlot {
  return {
    trackNo: 1,
    title: 'Title',
    hookPhrase: 'Hook',
    songRole: 'core',
    tempo: 90,
    emotionArc: 'steady',
    moneyChordText: '',
    genreId: 'oldpop-warm-morning-glow',
    vocalType: 'male',
    killingPointId: 'kp-1',
    arcPhase: 'build',
    ...overrides
  };
}

/** A healthy 18-song plan: 3 vocal types (10/4/4), spread across 6-song windows, wide BPM spread, 5 genres each <=5 songs no singleton, all 3 (1950s-60s) era, 5 arc phases, killing points on 14/18. */
function healthySlots(): PreassignedSongSlot[] {
  const vocalOrder: ('male' | 'female' | 'mixed')[] = [
    'male', 'female', 'mixed', 'male', 'female', 'mixed',
    'male', 'mixed', 'female', 'male', 'mixed', 'male',
    'female', 'male', 'mixed', 'male', 'female', 'male'
  ];
  // TASK v4.9 (TASK A) — was 5 genres spanning up to 5 distinct
  // data/eraCanonPalettes.ts palettes (oldpop-europop-glow/oldpop-british-beat
  // pull in canon-europop-glow/canon-british-beat on top of the other three's
  // own soft-pop/soft-rock/folk-duo palettes) — real listening feedback
  // ("일식·중식·한식이 같이 나온 느낌") is exactly this shape, and
  // channelSoundFloor.ts's new maxPaletteVariety:4 now correctly flags it.
  // Narrowed to genres reachable from data/paletteFamilies.ts's own
  // family-acoustic-soft only, so this fixture stays "healthy" under the
  // new ceiling instead of demonstrating the bug it exists to catch.
  const genreIds = ['oldpop-warm-morning-glow', 'oldpop-hearth-acoustic', 'oldpop-close-harmony-duo', 'oldpop-adult-contemporary-80s'];
  // v4.16 (TASK A) — tempoCeiling 112 -> 100; spread rewritten to stay
  // inside the new 62-100 range while still spanning nearly the full width
  // (stddev/range floors still clear comfortably).
  const bpms = [62, 65, 68, 71, 74, 77, 80, 83, 86, 89, 92, 95, 98, 100, 70, 85, 95, 78];
  const arcPhases = ['opening', 'build', 'peak', 'release', 'closing'];
  return Array.from({ length: 18 }, (_, i) => slotFor({
    trackNo: i + 1,
    vocalType: vocalOrder[i],
    genreId: genreIds[i % genreIds.length],
    tempo: bpms[i],
    arcPhase: arcPhases[i % arcPhases.length],
    killingPointId: i < 14 ? `kp-${i % 8}` : undefined
  }));
}

describe('evaluateDesignGate — healthy plan produces no false positives', () => {
  it('passes a plan with real vocal/genre/BPM/arc variety', () => {
    const opts = baseOpts();
    const result = evaluateDesignGate(healthySlots(), baseConstraints(opts), opts);
    expect(result.blocking).toEqual([]);
    expect(result.passed).toBe(true);
  });
});

describe('evaluateDesignGate — 보컬 (재발 시나리오 1-D의 단위 테스트 버전)', () => {
  it('blocks vocal-type-variety and vocal-type-min when every slot is the same gender', () => {
    const opts = baseOpts();
    const slots = healthySlots().map(slot => ({ ...slot, vocalType: 'male' as const }));
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    expect(result.passed).toBe(false);
    const ids = result.blocking.map(i => i.id);
    expect(ids).toContain('vocal-type-variety');
    expect(ids).toContain('vocal-type-min');
    expect(ids).toContain('vocal-consecutive');
    // every vocal issue offers an autoFix.
    // 지시문 19 (TASK C) — autoFix is now a pre-computed value (not a
    // closure), so it survives the Worker postMessage boundary; see
    // core/designGate.ts's own doc comment on DesignIssue.autoFix.
    expect(result.blocking.filter(i => i.id.startsWith('vocal-')).every(i => typeof i.autoFix === 'object' && i.autoFix !== null)).toBe(true);
  });

  it('blocks vocal-consecutive when one gender runs 3+ in a row even with otherwise-fine totals', () => {
    const opts = baseOpts();
    const slots = healthySlots();
    slots[0] = { ...slots[0], vocalType: 'male' };
    slots[1] = { ...slots[1], vocalType: 'male' };
    slots[2] = { ...slots[2], vocalType: 'male' };
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    expect(result.blocking.some(i => i.id === 'vocal-consecutive')).toBe(true);
  });

  it('autoFix produces a vocalType allocation whose counts sum to songCount', () => {
    const opts = baseOpts();
    const slots = healthySlots().map(slot => ({ ...slot, vocalType: 'male' as const }));
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    const fix = result.blocking.find(i => i.id === 'vocal-type-variety')!.autoFix!;
    const allocation = fix.diversityAllocations!.find(a => a.axis === 'vocalType')!;
    const total = Object.values(allocation.counts).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(18);
    expect(allocation.counts.male).toBeGreaterThan(0);
    expect(allocation.counts.female).toBeGreaterThan(0);
    expect(allocation.counts.mixed).toBeGreaterThan(0);
  });

  // v5.9 (quota/tone separation) — vocalQuotaForAutoFix used to ALWAYS start
  // from DEFAULT_ADULT_VOCAL_QUOTA/DEFAULT_KIDS_VOCAL_QUOTA, ignoring
  // opts.channel.vocalQuotaOverride entirely — a K-pop boy/girl-group
  // channel's autoFix suggestion could silently propose overwriting the
  // channel's own deliberate fixed split (e.g. 15/0/3) with a generic
  // balanced one. It now mirrors core/batchPreallocation.ts's/
  // core/localGenerator.ts's own baseVocalQuota priority: vocalQuotaOverride
  // wins, and never leans (the split itself is the point of that channel).
  //
  // v(design-gate audience decoupling) — the issue id this fires as changed:
  // a vocalQuotaOverride channel now gets the new quota-fidelity check
  // ('vocal-quota-fidelity') instead of the generic distinct-type-variety
  // check ('vocal-type-variety') — 15/18 male tracks is mathematically
  // incompatible with "3+ distinct types", so blocking on that check was
  // never fixable for this channel shape in the first place. The autoFix
  // contract (still returns the channel's own 15/0/3 split, never the
  // generic 6/6/6 default) is unchanged and re-verified here.
  it('a channel with vocalQuotaOverride gets its OWN fixed split back from autoFix, not the generic 6/6/6 default', () => {
    const fixedQuotaChannel: ChannelProfile = { ...CHANNEL, archetype: 'kr-idol-male', vocalQuotaOverride: { male: 15, female: 0, mixed: 3 } };
    const opts = baseOpts({ channel: fixedQuotaChannel, vocalTone: fixedQuotaChannel.defaultVocal });
    const slots = healthySlots().map(slot => ({ ...slot, vocalType: 'male' as const }));
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    const issue = result.blocking.find(i => i.id === 'vocal-quota-fidelity');
    expect(issue).toBeDefined();
    const fix = issue!.autoFix!;
    const allocation = fix.diversityAllocations!.find(a => a.axis === 'vocalType')!;
    expect(allocation.counts).toEqual({ male: 15, female: 0, mixed: 3 });
  });
});

describe('evaluateDesignGate — BPM (재발 시나리오 1-E의 단위 테스트 버전)', () => {
  it('blocks bpm-stddev and bpm-range when tempo never varies (tempoBandsForProfile-collapse simulation)', () => {
    const opts = baseOpts();
    const slots = healthySlots().map(slot => ({ ...slot, tempo: 96 }));
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    const ids = result.blocking.map(i => i.id);
    expect(ids).toContain('bpm-stddev');
    expect(ids).toContain('bpm-range');
  });

  it('blocks bpm-within-profile when a tempo falls outside the resolved audience profile range', () => {
    const opts = baseOpts();
    const slots = healthySlots();
    slots[0] = { ...slots[0], tempo: SENIOR_AUDIENCE_PROFILE.tempoCeiling + 40 };
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    expect(result.blocking.some(i => i.id === 'bpm-within-profile')).toBe(true);
  });
});

describe('evaluateDesignGate — 장르', () => {
  it('blocks genre-singleton, genre-max, and genre-consecutive', () => {
    const opts = baseOpts();
    const slots = healthySlots().map((slot, i) => ({
      ...slot,
      genreId: i === 0 ? 'oldpop-close-harmony-duo' : i < 13 ? 'oldpop-warm-morning-glow' : 'oldpop-soft-rock-am'
    }));
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    const ids = result.blocking.map(i => i.id);
    expect(ids).toContain('genre-singleton');
    expect(ids).toContain('genre-max');
    expect(ids).toContain('genre-consecutive');
  });

  it('adapts the genre-variety floor down when the channel-resolved genre pool itself has fewer than 4 candidates (§3-E)', () => {
    const narrowOpts = baseOpts({ genreIds: ['oldpop-warm-morning-glow', 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul'] });
    const slots = healthySlots().map((slot, i) => ({ ...slot, genreId: ['oldpop-warm-morning-glow', 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul'][i % 3] }));
    const result = evaluateDesignGate(slots, baseConstraints(narrowOpts), narrowOpts);
    expect(result.blocking.some(i => i.id === 'genre-variety')).toBe(false);
  });
});

describe('evaluateDesignGate — 시대', () => {
  it('skips every era-* check when the concept has no era signal (unspecified)', () => {
    const opts = baseOpts({ customConcept: '따뜻하고 잔잔한 노래', projectTitle: '따뜻하고 잔잔한 노래' });
    const constraints = baseConstraints(opts);
    expect(constraints.era.unspecified).toBe(true);
    const result = evaluateDesignGate(healthySlots(), constraints, opts);
    expect(result.blocking.some(i => i.id.startsWith('era-'))).toBe(false);
    expect(result.advisory.some(i => i.id.startsWith('era-'))).toBe(false);
  });

  it('blocks era-primary-share when the resolved era has almost no primary-bucket genres', () => {
    const opts = baseOpts({ customConcept: '비틀즈 느낌의 밝은 60년대 팝', projectTitle: '비틀즈 느낌의 밝은 60년대 팝' });
    const constraints = baseConstraints(opts);
    expect(constraints.era.unspecified).toBe(false);
    // All slots forced to an 1980s-bucket genre, which is NOT this era's primary (1950s-60s) — this era's own primary share collapses to 0%.
    const slots = healthySlots().map(slot => ({ ...slot, genreId: 'oldpop-adult-contemporary-80s' }));
    const result = evaluateDesignGate(slots, constraints, opts);
    expect(result.blocking.some(i => i.id === 'era-primary-share')).toBe(true);
  });
});

/**
 * TASK E (design-gate and post-generation era-share checks disagree) —
 * eraIssues now reads its single-primary/co-primary floors from the shared
 * data/eraPolicy.ts (ERA_POLICY) instead of its own previously-looser
 * hardcoded 40%/30% — see ERA_POLICY's own doc comment for the real
 * investigation (core/constraints.ts's applyEraQuota) that picked 50%/40%
 * as the correct, validated numbers. tests/compositionScorer.test.ts has
 * the mirror-image proof that compositionScorer.ts's post-generation check
 * now agrees with this file on the exact same real 45% case.
 */
describe('evaluateDesignGate — TASK E era policy (shared ERA_POLICY threshold)', () => {
  const SINGLE_ERA: EraConstraint = { primary: '1950s-60s', adjacent: [], forbidden: [], unspecified: false };
  const CO_PRIMARY_ERA: EraConstraint = { primary: '1950s-60s', coPrimary: '1970s', adjacent: [], forbidden: ['1980s'], unspecified: false };

  function slotsWithGenrePattern(pattern: string[]): PreassignedSongSlot[] {
    return pattern.map((genreId, i) => slotFor({ trackNo: i + 1, genreId }));
  }

  it('reads the real, validated 50%/40% floors — not the old, looser 40%/30% this file used to hardcode', () => {
    expect(ERA_POLICY.singlePrimaryMin).toBe(0.5);
    expect(ERA_POLICY.coPrimaryMinEach).toBe(0.4);
  });

  // 지시문 12 (TASK A-3) — 아래 4개 테스트의 필러 장르를 oldpop-warm-morning-glow
  // (era-neutral, TASK A 재부여 후로는 primary-share 분모에서 제외됨)에서
  // oldpop-adult-contemporary-80s(실제 1980s 버킷 — SINGLE_ERA는 forbidden이
  // 없어 안전)로 바꿨다. era-neutral 필러를 그대로 뒀다면 분모 제외 로직 때문에
  // 9/9=100%처럼 나와 원래 테스트 의도(45%/50%처럼 primary+non-primary 실제
  // 버킷이 섞인 분포에서의 임계값)를 검증할 수 없다.
  it("a real 45% single-era share — which used to PASS this file's old 40% floor — now correctly BLOCKS era-primary-share, matching the new shared 50% floor (and now agrees with compositionScorer.ts's own always-50% check)", () => {
    const opts = baseOpts({ songCount: 20 });
    const pattern = [
      ...Array(9).fill('oldpop-doowop-harmony'), // 1950s-60s: 9/20 = 45%
      ...Array(11).fill('oldpop-adult-contemporary-80s') // 1980s filler — real (non-neutral) bucket, keeps forbidden buckets at 0, isolates the primary-share check
    ];
    const constraints = { ...baseConstraints(opts), era: SINGLE_ERA };
    const result = evaluateDesignGate(slotsWithGenrePattern(pattern), constraints, opts);
    const issue = result.blocking.find(i => i.id === 'era-primary-share');
    expect(issue).toBeDefined();
    expect(issue!.expected).toContain('50% 이상');
    expect(issue!.actual).toBe('45%');
  });

  it('a real senior-morning pack whose primary-era share meets the actual generation-time guarantee (exactly 50%, matching constraints.ts applyEraQuota\'s own real floor) still PASSES era-primary-share — the raised floor does not newly block a real, properly-quota\'d senior pack', () => {
    const opts = baseOpts({ songCount: 20 }); // baseOpts() -> CHANNEL, archetype 'senior-morning'
    expect(opts.channel.archetype).toBe('senior-morning');
    const pattern = [
      ...Array(10).fill('oldpop-doowop-harmony'), // 1950s-60s: 10/20 = 50%, exactly applyEraQuota's real single-primary floor
      ...Array(10).fill('oldpop-adult-contemporary-80s')
    ];
    const constraints = { ...baseConstraints(opts), era: SINGLE_ERA };
    const result = evaluateDesignGate(slotsWithGenrePattern(pattern), constraints, opts);
    expect(result.blocking.some(i => i.id === 'era-primary-share')).toBe(false);
  });

  // 지시문 12 (TASK A-3) — CO_PRIMARY_ERA의 forbidden은 ['1980s']라 위 두
  // 테스트처럼 1980s 필러를 쓸 수 없다. kr2030-y2k-retro(2000s, era-neutral도
  // 아니고 primary/coPrimary/forbidden 어디에도 안 걸림)로 대체.
  it("a real 30%/30% co-primary split — which used to PASS this file's old 30% floor — now correctly BLOCKS era-primary-share, matching the new shared 40%-each floor (and closes the real gap: compositionScorer.ts previously had NO co-primary check at all)", () => {
    const opts = baseOpts({ songCount: 20 });
    const pattern = [
      ...Array(6).fill('oldpop-doowop-harmony'), // 1950s-60s: 6/20 = 30%
      ...Array(6).fill('oldpop-soft-rock-am'), // 1970s: 6/20 = 30%
      ...Array(8).fill('kr2030-y2k-retro') // 2000s filler — real (non-neutral) bucket, not forbidden/primary/coPrimary here
    ];
    const constraints = { ...baseConstraints(opts), era: CO_PRIMARY_ERA };
    const result = evaluateDesignGate(slotsWithGenrePattern(pattern), constraints, opts);
    const issue = result.blocking.find(i => i.id === 'era-primary-share');
    expect(issue).toBeDefined();
    expect(issue!.expected).toContain('40%');
  });

  it('a real 40%/40% co-primary split (exactly at the new shared floor) passes era-primary-share', () => {
    const opts = baseOpts({ songCount: 20 });
    const pattern = [
      ...Array(8).fill('oldpop-doowop-harmony'), // 1950s-60s: 8/20 = 40%
      ...Array(8).fill('oldpop-soft-rock-am'), // 1970s: 8/20 = 40%
      ...Array(4).fill('kr2030-y2k-retro')
    ];
    const constraints = { ...baseConstraints(opts), era: CO_PRIMARY_ERA };
    const result = evaluateDesignGate(slotsWithGenrePattern(pattern), constraints, opts);
    expect(result.blocking.some(i => i.id === 'era-primary-share')).toBe(false);
  });

  // 지시문 12 (TASK A-3) — (구) era-unspecified-share(전역 25% 상한)는
  // era-neutral-share(워크스페이스 정책 상한)로 대체됐다. baseOpts()의 채널은
  // senior-morning → senior-oldpop 워크스페이스라 eraNeutralMaxShare=6/18≈33%
  // 정책이 실제로 걸린다. 'not-an-era-mapped-genre'(가짜 id)는
  // ERA_BUCKETS_BY_GENRE_ID에 없어 보수적으로 era-neutral 취급되고,
  // oldpop-warm-morning-glow도 (신) 세분화 데이터에서 era-neutral이라 함께
  // 잡힌다 — 6+5=11/20=55%, 정책 상한(33%)을 넘는다.
  it('era-forbidden/era-neutral-share are both real: forbidden-bucket presence still blocks, and era-neutral share over the workspace policy ceiling (senior-oldpop ≈33%) also blocks', () => {
    const opts = baseOpts({ customConcept: '비틀즈 느낌의 밝은 60년대 팝', projectTitle: '비틀즈 느낌의 밝은 60년대 팝', songCount: 20 });
    const constraints = baseConstraints(opts);
    const pattern = [...Array(9).fill('oldpop-doowop-harmony'), ...Array(6).fill('not-an-era-mapped-genre'), ...Array(5).fill('oldpop-warm-morning-glow')];
    const result = evaluateDesignGate(slotsWithGenrePattern(pattern), constraints, opts);
    const issue = result.blocking.find(i => i.id === 'era-neutral-share');
    expect(issue).toBeDefined();
    expect(issue!.actual).toBe('55%');
  });
});

describe('evaluateDesignGate — 킬링포인트·아크', () => {
  it('blocks killing-point-count/variety and arc-phases when too few tracks carry them', () => {
    const opts = baseOpts();
    const slots = healthySlots().map(slot => ({ ...slot, killingPointId: undefined, arcPhase: 'build' }));
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    const ids = result.blocking.map(i => i.id);
    expect(ids).toContain('killing-point-count');
    expect(ids).toContain('killing-point-variety');
    expect(ids).toContain('arc-phases');
  });

  it('scales killing-point-count/variety proportionally to songCount (§3-D)', () => {
    const opts = baseOpts({ songCount: 6 });
    const slots = healthySlots().slice(0, 6).map((slot, i) => ({ ...slot, trackNo: i + 1, killingPointId: i < 4 ? `kp-${i}` : undefined }));
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    // 6 songs * 12/18 ratio = 4 required — 4 supplied, should not block on count.
    expect(result.blocking.some(i => i.id === 'killing-point-count')).toBe(false);
  });
});

/**
 * v5.12 — arc-model-aware killingPointAndArcIssues: kids workspaces
 * (arcModelId 'repetition-cycle') produce 3-5 distinct 'kids-*' bundle
 * values (core/arcModels.ts's buildRepetitionCyclePlan), never the 5
 * 'opening'/.../'closing' adult values. Before this fix, the 'arc-phases'
 * check hard-coded "must have exactly 5 distinct values" workspace-agnostic,
 * so it would incorrectly flag a healthy, real kids pack (4 distinct bundle
 * values by default) as failing. This must be additive only — the adult
 * five-phase path (already covered above) stays byte-identical.
 */
describe('evaluateDesignGate — 킬링포인트·아크 (arc-model-aware, kids workspace)', () => {
  const KR_KIDS_AUDIENCE_PROFILE = audienceProfileForChannelArchetype('kr-kids-song', undefined);

  function kidsConstraints(opts: GenerationOptions): ResolvedConstraints {
    return resolveConstraintsFromOptions(opts, KR_KIDS_AUDIENCE_PROFILE, 'kr-kids');
  }

  function kidsOpts(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
    return baseOpts({
      channel: { ...CHANNEL, archetype: 'kr-kids-song' },
      audience: 'kids',
      ...overrides
    });
  }

  /** A real (not synthetic-5-phase) kids arc: default bundle shape (familiar/learning/moving/calm, 4/5/5/4). */
  function kidsSlotsWithArc(arcPhases: string[]): PreassignedSongSlot[] {
    return healthySlots().map((slot, i) => ({
      ...slot,
      arcPhase: arcPhases[i],
      killingPointId: i < 14 ? `kp-${i % 8}` : undefined
    }));
  }

  it('confirms the arcModelId resolved for a real kr-kids channel is repetition-cycle (sanity check for the rest of this block)', () => {
    expect(KR_KIDS_AUDIENCE_PROFILE.arcModelId).toBe('repetition-cycle');
    expect(kidsConstraints(kidsOpts()).arcModelId).toBe('repetition-cycle');
  });

  it('a real 18-song kids pack (4 distinct bundle values, matching its actual buildRepetitionCyclePlan config) does NOT trigger arc-phases — previously would have incorrectly failed against the old hard-coded "must equal 5"', () => {
    const opts = kidsOpts();
    const realBundlePhases = buildRepetitionCyclePlan(18).map(p => p.phase);
    const slots = kidsSlotsWithArc(realBundlePhases);
    const result = evaluateDesignGate(slots, kidsConstraints(opts), opts);
    expect(result.blocking.some(i => i.id === 'arc-phases')).toBe(false);
  });

  it('a genuinely broken kids arc (only 1 distinct bundle value used) still correctly FAILS — the fix did not turn this into a no-op for kids', () => {
    const opts = kidsOpts();
    const slots = kidsSlotsWithArc(Array(18).fill('kids-familiar'));
    const result = evaluateDesignGate(slots, kidsConstraints(opts), opts);
    const arcIssue = result.blocking.find(i => i.id === 'arc-phases');
    expect(arcIssue).toBeDefined();
    expect(arcIssue!.expected).toBe('4종 전부');
    expect(arcIssue!.actual).toBe('1종');
  });

  it('a kids arc using adult five-phase values instead of its own bundle values still correctly FAILS (wrong values entirely, not just too few — even though 5 distinct strings is >= the 4 expected)', () => {
    const opts = kidsOpts();
    const adultPhases = ['opening', 'rising', 'peak', 'easing', 'closing'];
    const slots = kidsSlotsWithArc(Array.from({ length: 18 }, (_, i) => adultPhases[i % adultPhases.length]));
    const result = evaluateDesignGate(slots, kidsConstraints(opts), opts);
    // A raw Set-size comparison alone (5 distinct strings >= 4 expected)
    // would have wrongly passed this — none of these 5 values are real kids
    // bundle phases (arcModels.ts's KIDS_ARC_PHASE_VALUES), so the fix
    // filters to 0 valid values before comparing, and this must still fail.
    const arcIssue = result.blocking.find(i => i.id === 'arc-phases');
    expect(arcIssue).toBeDefined();
    expect(arcIssue!.actual).toBe('0종');
  });

  it('regression: adult/senior workspace (five-phase) is completely unaffected by the arc-model-aware change — still requires exactly 5, byte-identical', () => {
    const opts = baseOpts();
    const slots = healthySlots().map(slot => ({ ...slot, killingPointId: undefined, arcPhase: 'build' }));
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    const arcIssue = result.blocking.find(i => i.id === 'arc-phases');
    expect(arcIssue).toBeDefined();
    expect(arcIssue!.expected).toBe('5종 전부');
    expect(arcIssue!.labelKo).toBe('아크 5구간 사용');
  });
});

/**
 * v(design-gate audience decoupling) fix 1 — BREADTH_THRESHOLDS.balanced.genre.maxPerGenre
 * (5) is a fixed number that's mathematically unreachable for the common
 * case of an 18-song pack spread over 3-4 candidate genres (18÷3=6 > 5,
 * 18÷4=4.5→5 borderline). effectiveMaxPerGenre = max(staticThreshold,
 * ceil(songCount / candidateGenreCount)) only ever WIDENS the ceiling, so
 * this must never change behavior for a pack whose candidate pool is already
 * >= 4 (18÷4=5, unchanged) — only packs with 3 or fewer candidates get a
 * real, different (wider) ceiling.
 */
describe('evaluateDesignGate — genre-max effectiveMaxPerGenre (fix 1)', () => {
  // v(design-gate audience decoupling) — a REAL run of
  // scripts/v378-stress-test.ts (real 'good-morning-memory-radio' channel,
  // real free-text senior concepts) proved core/setDirector.ts's own
  // directSetLocal genre-selection ROUTINELY narrows opts.genreIds to as
  // few as 4 candidates for ordinary senior concepts — applying the
  // widening there measurably changed real senior-oldpop-workspace
  // genre-max pass/fail outcomes. The fix is therefore EXCLUDED for
  // workspaceId === 'senior-oldpop' (see designGate.ts's own doc comment on
  // this exact exclusion) — every test below uses a non-senior-oldpop
  // workspace id so the widening under test actually applies; the senior-
  // oldpop exclusion itself is proven separately, at the bottom of this
  // block, using the real workspace id.
  function nonSeniorOpts(genreIds: string[]): GenerationOptions {
    return baseOpts({ genreIds, channel: { ...CHANNEL, archetype: 'kr-idol-male' } });
  }
  function nonSeniorConstraints(opts: GenerationOptions): ResolvedConstraints {
    return resolveConstraintsFromOptions(opts, audienceProfileById('kr-idol-male')!, 'kr-idol-male');
  }
  function slotsWithGenres(genreIds: string[]): PreassignedSongSlot[] {
    return healthySlots().map((slot, i) => ({ ...slot, genreId: genreIds[i % genreIds.length] }));
  }

  it('non-senior workspace, 18 songs / 3 candidate genres: effectiveMaxPerGenre = max(5, ceil(18/3)) = 6 — 6/genre now PASSES (used to block at the static 5)', () => {
    const genreIds = ['oldpop-warm-morning-glow', 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul'];
    const opts = nonSeniorOpts(genreIds);
    // 18 songs over 3 genres, 6/6/6 — maxCount = 6.
    const slots = slotsWithGenres(genreIds);
    const result = evaluateDesignGate(slots, nonSeniorConstraints(opts), opts);
    expect(result.blocking.some(i => i.id === 'genre-max')).toBe(false);
  });

  it('non-senior workspace, 18 songs / 3 candidate genres: 7/genre still BLOCKS (effectiveMaxPerGenre=6, 7 > 6)', () => {
    const genreIds = ['oldpop-warm-morning-glow', 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul'];
    const opts = nonSeniorOpts(genreIds);
    const slots = healthySlots().map((slot, i) => ({ ...slot, genreId: i < 7 ? genreIds[0] : genreIds[(i % 2) + 1] }));
    const result = evaluateDesignGate(slots, nonSeniorConstraints(opts), opts);
    const issue = result.blocking.find(i => i.id === 'genre-max');
    expect(issue).toBeDefined();
    expect(issue!.expected).toBe('≤ 6곡 (후보 3종 기준 자동 조정, 기본 5곡)');
    expect(issue!.actual).toBe('7곡');
  });

  it('non-senior workspace, 18 songs / 4 candidate genres: effectiveMaxPerGenre = max(5, ceil(18/4)) = 5 — unchanged from the static threshold', () => {
    const genreIds = ['oldpop-warm-morning-glow', 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul', 'oldpop-hearth-acoustic'];
    const opts = nonSeniorOpts(genreIds);
    // 5/5/4/4 split — maxCount = 5, right at the (unchanged) static ceiling.
    const slots = healthySlots().map((slot, i) => ({ ...slot, genreId: genreIds[i % 4] }));
    const result = evaluateDesignGate(slots, nonSeniorConstraints(opts), opts);
    expect(result.blocking.some(i => i.id === 'genre-max')).toBe(false);
    const overSlots = healthySlots().map((slot, i) => ({ ...slot, genreId: i < 6 ? genreIds[0] : genreIds[(i % 3) + 1] }));
    const overResult = evaluateDesignGate(overSlots, nonSeniorConstraints(opts), opts);
    const issue = overResult.blocking.find(i => i.id === 'genre-max');
    expect(issue).toBeDefined();
    expect(issue!.expected).toBe('≤ 5곡'); // no "자동 조정" suffix — this IS the static threshold.
  });

  it('regression: the standard senior healthy fixture (5 candidate genres via CHANNEL.preferredGenres) is byte-identical — effectiveMaxPerGenre stays exactly 5 (ceil(18/5)=4 <= 5)', () => {
    const opts = baseOpts(); // genreIds: CHANNEL.preferredGenres, 5 entries
    const result = evaluateDesignGate(healthySlots(), baseConstraints(opts), opts);
    expect(result.blocking.some(i => i.id === 'genre-max')).toBe(false);
    // A pack that hits exactly the OLD static ceiling (5/genre) must still pass, unaffected.
    const slots = healthySlots().map((slot, i) => ({
      ...slot,
      genreId: i === 0 ? 'oldpop-close-harmony-duo' : i < 13 ? 'oldpop-warm-morning-glow' : 'oldpop-soft-rock-am'
    }));
    // maxCount here is 12 (oldpop-warm-morning-glow), which must still BLOCK exactly as before.
    const overResult = evaluateDesignGate(slots, baseConstraints(opts), opts);
    const issue = overResult.blocking.find(i => i.id === 'genre-max');
    expect(issue).toBeDefined();
    expect(issue!.expected).toBe('≤ 5곡');
    expect(issue!.actual).toBe('12곡');
  });

  it('regression: senior-oldpop workspace is EXCLUDED from the widening even with a genuinely narrow (3) candidate pool — reproduces the real scripts/v378-stress-test.ts finding that forced this exclusion', () => {
    const genreIds = ['oldpop-warm-morning-glow', 'oldpop-soft-rock-am', 'oldpop-motown-pop-soul'];
    const opts = baseOpts({ genreIds }); // baseConstraints below resolves workspaceId: 'senior-oldpop'
    const slots = slotsWithGenres(genreIds); // 6/6/6 split — would PASS under the widened rule (max 6), must still BLOCK for senior-oldpop (max 5, unchanged).
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    const issue = result.blocking.find(i => i.id === 'genre-max');
    expect(issue).toBeDefined();
    expect(issue!.expected).toBe('≤ 5곡'); // never the "자동 조정" text for senior-oldpop.
    expect(issue!.actual).toBe('6곡');
  });
});

/**
 * TASK F (senior-oldpop workspace-wide exception is too broad) — the
 * effectiveMaxPerGenre auto-adjustment exclusion narrowed from the whole
 * `workspaceId === 'senior-oldpop'` WORKSPACE to just the
 * `archetype === 'senior-morning'` archetype. Other senior-oldpop
 * sub-archetypes (showa-cafe/modern-chill/city-night/oldpop-lounge)
 * declare as few as 3 `preferredGenres` (data/presets.ts's real
 * 'morning-showa-cafe' preset: `['showa-modern', 'jazz-pop', 'city-pop-soft']`)
 * — the exact same shape as every other non-senior channel preset that
 * already benefits from this widening.
 */
describe('evaluateDesignGate — TASK F senior-oldpop non-morning archetypes get the same auto-adjustment', () => {
  const SHOWA_CAFE_GENRE_IDS = ['showa-modern', 'jazz-pop', 'city-pop-soft']; // real morning-showa-cafe preset's own 3 preferredGenres (data/presets.ts)

  function showaCafeOpts(genreIds: string[]): GenerationOptions {
    return baseOpts({ genreIds, channel: { ...CHANNEL, archetype: 'showa-cafe' } });
  }
  function showaCafeConstraints(opts: GenerationOptions): ResolvedConstraints {
    return resolveConstraintsFromOptions(opts, SENIOR_AUDIENCE_PROFILE, 'senior-oldpop');
  }
  function slotsWithGenres(genreIds: string[]): PreassignedSongSlot[] {
    return healthySlots().map((slot, i) => ({ ...slot, genreId: genreIds[i % genreIds.length] }));
  }

  it('an 18-song / 3-genre senior-oldpop NON-morning channel (showa-cafe) — previously an impossible fixed ceiling (max 5, 18÷3=6>5) — now PASSES with the auto-adjusted ceiling (max 6), same as any other non-senior workspace', () => {
    const opts = showaCafeOpts(SHOWA_CAFE_GENRE_IDS);
    expect(opts.channel.archetype).toBe('showa-cafe');
    const constraints = showaCafeConstraints(opts);
    // Still the SAME workspace as senior-morning — proves the fix is archetype-scoped, not workspace-scoped.
    expect(constraints.workspaceId).toBe('senior-oldpop');
    const slots = slotsWithGenres(SHOWA_CAFE_GENRE_IDS); // 6/6/6 split
    const result = evaluateDesignGate(slots, constraints, opts);
    expect(result.blocking.some(i => i.id === 'genre-max')).toBe(false);
  });

  it('proves the OLD workspace-wide exclusion really would have blocked this exact case — the static ceiling (5) really is mathematically impossible for 18 songs / 3 genres', () => {
    expect(Math.ceil(18 / SHOWA_CAFE_GENRE_IDS.length)).toBe(6);
    expect(BREADTH_THRESHOLDS.balanced.genre.maxPerGenre).toBe(5);
    // Directly reproduces what the OLD `workspaceId === 'senior-oldpop'` exclusion would have done: no widening at all for this channel.
    const opts = showaCafeOpts(SHOWA_CAFE_GENRE_IDS);
    const constraints = showaCafeConstraints(opts);
    expect(constraints.workspaceId).toBe('senior-oldpop');
    const slots = slotsWithGenres(SHOWA_CAFE_GENRE_IDS);
    const maxCount = Math.max(...Object.values(
      slots.reduce<Record<string, number>>((counts, slot) => {
        if (slot.genreId) counts[slot.genreId] = (counts[slot.genreId] ?? 0) + 1;
        return counts;
      }, {})
    ));
    expect(maxCount).toBe(6); // > the OLD workspace-wide-excluded static ceiling of 5.
  });

  it('7/genre still BLOCKS for showa-cafe (effectiveMaxPerGenre=6, 7 > 6) — the widening only ever raises the ceiling, never removes it', () => {
    const opts = showaCafeOpts(SHOWA_CAFE_GENRE_IDS);
    const constraints = showaCafeConstraints(opts);
    const slots = healthySlots().map((slot, i) => ({ ...slot, genreId: i < 7 ? SHOWA_CAFE_GENRE_IDS[0] : SHOWA_CAFE_GENRE_IDS[(i % 2) + 1] }));
    const result = evaluateDesignGate(slots, constraints, opts);
    const issue = result.blocking.find(i => i.id === 'genre-max');
    expect(issue).toBeDefined();
    expect(issue!.expected).toBe('≤ 6곡 (후보 3종 기준 자동 조정, 기본 5곡)');
  });

  it('regression: senior-morning itself is UNCHANGED — still excluded from the widening even with the exact same narrow 3-genre pool', () => {
    const opts = baseOpts({ genreIds: SHOWA_CAFE_GENRE_IDS }); // baseOpts() -> CHANNEL, archetype 'senior-morning'
    expect(opts.channel.archetype).toBe('senior-morning');
    const slots = slotsWithGenres(SHOWA_CAFE_GENRE_IDS);
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    const issue = result.blocking.find(i => i.id === 'genre-max');
    expect(issue).toBeDefined();
    expect(issue!.expected).toBe('≤ 5곡'); // never the auto-adjusted text for senior-morning.
    expect(issue!.actual).toBe('6곡');
  });
});

/**
 * v(design-gate audience decoupling) fix 2 — moneyChordBlockingIssues/
 * moneyChordAdvisoryIssues used to apply the auto-rotation "max 5 songs on
 * one progression" rule unconditionally, which v5.7's own explicit-choice
 * feature (buildUserChosenProgressionPlan, 50-65% of the pack on the chosen
 * progression) always failed by design. usesUserChosenProgressionPlan(opts)
 * now branches to a dedicated set of checks instead.
 */
describe('evaluateDesignGate — money-chord explicit-choice mode (fix 2)', () => {
  function explicitChoiceOpts(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
    return baseOpts({ moneyChordMode: 'winterBallad', moneyChordModeIsExplicitChoice: true, ...overrides });
  }
  function slotsForPlan(plan: string[]): PreassignedSongSlot[] {
    return healthySlots().map((slot, i) => ({ ...slot, moneyChordId: plan[i] }));
  }

  it('a real 10/18-song explicit-choice pack (buildUserChosenProgressionPlan) now PASSES where the old flat max-5 rule would have blocked it', () => {
    const opts = explicitChoiceOpts();
    const plan = buildUserChosenProgressionPlan('winterBallad', 18, 12345);
    const chosenCount = plan.filter(id => id === 'winterBallad').length;
    // Real, measured worked example — document the actual number this real
    // builder produces for an 18-song pack (matches this task's own
    // "9-11 of 18" expectation).
    expect(chosenCount).toBeGreaterThanOrEqual(9);
    expect(chosenCount).toBeLessThanOrEqual(11);
    const slots = slotsForPlan(plan);
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    expect(result.blocking.some(i => i.id.startsWith('moneychord'))).toBe(false);
    // Prove the OLD rule really would have blocked this (maxCount > 5) —
    // confirms this is a real behavior change, not a no-op.
    expect(chosenCount).toBeGreaterThan(5);
  });

  it('blocks moneychord-explicit-choice-zero when the chosen progression got 0 songs', () => {
    const opts = explicitChoiceOpts();
    const plan = new Array(18).fill('default');
    const slots = slotsForPlan(plan);
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    expect(result.blocking.some(i => i.id === 'moneychord-explicit-choice-zero')).toBe(true);
  });

  it(`blocks moneychord-explicit-choice-flagship when none of tracks 1-${REPRESENTATIVE_TRACK_COUNT} (the real REPRESENTATIVE_TRACK_COUNT) carry the chosen progression`, () => {
    const opts = explicitChoiceOpts();
    const plan = buildUserChosenProgressionPlan('winterBallad', 18, 12345);
    // Overwrite exactly the representative prefix to something else, keep the rest.
    for (let i = 0; i < REPRESENTATIVE_TRACK_COUNT; i += 1) plan[i] = 'default';
    const slots = slotsForPlan(plan);
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    const issue = result.blocking.find(i => i.id === 'moneychord-explicit-choice-flagship');
    expect(issue).toBeDefined();
  });

  it('warns (advisory, not blocking) moneychord-explicit-choice-share when the chosen share falls outside 45~65%', () => {
    const opts = explicitChoiceOpts();
    // Force the chosen progression down to a 20% share (well under 45%).
    const plan = new Array(18).fill('default').map((id, i) => (i < 4 ? 'winterBallad' : id));
    // Representative prefix still carries it (avoid tripping the flagship blocking check in this share-only test).
    plan[0] = 'winterBallad';
    const slots = slotsForPlan(plan);
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    expect(result.blocking.some(i => i.id.startsWith('moneychord'))).toBe(false);
    const advisory = result.advisory.find(i => i.id === 'moneychord-explicit-choice-share');
    expect(advisory).toBeDefined();
    expect(advisory!.actual).toContain('%');
  });

  it('regression: the auto/non-explicit path (moneyChordModeIsExplicitChoice unset) still uses the original max-5/4-6-species rules, byte-identical', () => {
    const opts = baseOpts(); // moneyChordMode: 'default', no explicit-choice flag
    const overConcentrated = healthySlots().map((slot, i) => ({ ...slot, moneyChordId: i < 8 ? 'emotional' : `id-${i}` }));
    const result = evaluateDesignGate(overConcentrated, baseConstraints(opts), opts);
    const issue = result.blocking.find(i => i.id === 'moneychord-max');
    expect(issue).toBeDefined();
    expect(issue!.expected).toBe('≤ 5곡');
    expect(issue!.actual).toBe('8곡');

    const lowVariety = healthySlots().map((slot, i) => ({ ...slot, moneyChordId: i < 9 ? 'emotional' : 'canon' }));
    const varietyResult = evaluateDesignGate(lowVariety, baseConstraints(opts), opts);
    const varietyAdvisory = varietyResult.advisory.find(i => i.id === 'moneychord-variety');
    expect(varietyAdvisory).toBeDefined();
  });
});

/**
 * v(design-gate audience decoupling) fix 3 — a channel.vocalQuotaOverride
 * (e.g. a K-pop boy-group's real {male:15,female:0,mixed:3}) is
 * mathematically incompatible with "3+ distinct types"/"no run > 2" — this
 * replaces those checks with a quota-fidelity check for override channels
 * only, and skips them entirely (never fires vocal-type-variety/
 * vocal-type-min/vocal-consecutive/vocal-segment-balance for such a
 * channel).
 */
describe('evaluateDesignGate — vocal quota-fidelity for vocalQuotaOverride channels (fix 3)', () => {
  const IDOL_CHANNEL: ChannelProfile = { ...CHANNEL, archetype: 'kr-idol-male', vocalQuotaOverride: { male: 15, female: 0, mixed: 3 } };

  function idolOpts(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
    return baseOpts({ channel: IDOL_CHANNEL, vocalTone: IDOL_CHANNEL.defaultVocal, ...overrides });
  }
  /** A real male-heavy sequence a 15/0/3 quota plan would actually produce — long male runs are structurally expected, not a bug. */
  function idolSlots(maleRun = 15, mixedRun = 3): PreassignedSongSlot[] {
    const types: ('male' | 'mixed')[] = [
      ...Array(5).fill('male'), 'mixed',
      ...Array(5).fill('male'), 'mixed',
      ...Array(5).fill('male'), 'mixed'
    ] as ('male' | 'mixed')[];
    void maleRun; void mixedRun;
    return healthySlots().map((slot, i) => ({ ...slot, vocalType: types[i] }));
  }

  it('a real 15/0/3 pack now PASSES quota-fidelity where it used to fail the distinct-type-count/consecutive-run checks', () => {
    const opts = idolOpts();
    const slots = idolSlots();
    const maleCount = slots.filter(s => s.vocalType === 'male').length;
    const mixedCount = slots.filter(s => s.vocalType === 'mixed').length;
    expect(maleCount).toBe(15);
    expect(mixedCount).toBe(3);
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    expect(result.blocking.some(i => i.id.startsWith('vocal-'))).toBe(false);
    // Prove the OLD generic checks really would have fired on this exact
    // shape (15 male tracks guarantees a run > 2 and 0 female = < 3 distinct
    // types) — confirms this is a real behavior change.
    expect(maleCount).toBeGreaterThan(2 * 5); // far beyond any "no run > 2" tolerance
  });

  it('blocks vocal-quota-fidelity when the actual split drifts more than ±1 from the (songCount-scaled) override', () => {
    const opts = idolOpts();
    const slots = healthySlots().map(slot => ({ ...slot, vocalType: 'male' as const })); // 18/0/0, override wants 15/0/3
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    const issues = result.blocking.filter(i => i.id === 'vocal-quota-fidelity');
    expect(issues.length).toBeGreaterThan(0);
    expect(result.blocking.some(i => i.id === 'vocal-type-variety')).toBe(false); // the old check never fires for override channels
    expect(result.blocking.some(i => i.id === 'vocal-consecutive')).toBe(false);
  });

  it('female:0 is honored exactly (no tolerance) — even 1 female song blocks fidelity', () => {
    const opts = idolOpts();
    const slots = idolSlots();
    slots[0] = { ...slots[0], vocalType: 'female' as any };
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    expect(result.blocking.some(i => i.id === 'vocal-quota-fidelity')).toBe(true);
  });

  it('scaleVocalQuota confirms the real (songCount-scaled) target this check compares against: 15/0/3 at songCount=18 scales to itself unchanged', () => {
    expect(scaleVocalQuota({ male: 15, female: 0, mixed: 3 }, 18)).toEqual({ male: 15, female: 0, mixed: 3 });
  });

  it('regression: a channel with NO vocalQuotaOverride is completely unaffected — still uses the original distinct-type/consecutive/segment checks, byte-identical', () => {
    const opts = baseOpts();
    const slots = healthySlots().map(slot => ({ ...slot, vocalType: 'male' as const }));
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    const ids = result.blocking.map(i => i.id);
    expect(ids).toContain('vocal-type-variety');
    expect(ids).toContain('vocal-type-min');
    expect(ids).toContain('vocal-consecutive');
    expect(ids).not.toContain('vocal-quota-fidelity');
  });
});

/**
 * v(design-gate audience decoupling) fix 4 — arc bundle structural checks
 * for kids repetition-cycle workspaces: (a) the observed bundle-phase SET
 * must exactly match one of the 3 real age-tier definitions (arcModels.ts),
 * (b) the last bundle (by trackNo) must be measurably lower-intensity than
 * every other bundle actually used, (c) no 3+ consecutive 'kids-moving'
 * songs (advisory).
 */
describe('evaluateDesignGate — kids arc bundle structure (fix 4)', () => {
  const KR_KIDS_AUDIENCE_PROFILE = audienceProfileForChannelArchetype('kr-kids-song', undefined);

  function kidsConstraints(opts: GenerationOptions): ResolvedConstraints {
    return resolveConstraintsFromOptions(opts, KR_KIDS_AUDIENCE_PROFILE, 'kr-kids');
  }
  function kidsOpts(overrides: Partial<GenerationOptions> = {}): GenerationOptions {
    return baseOpts({ channel: { ...CHANNEL, archetype: 'kr-kids-song' }, audience: 'kids', ...overrides });
  }
  function kidsSlotsWithArc(arcPhases: string[]): PreassignedSongSlot[] {
    return healthySlots().map((slot, i) => ({ ...slot, arcPhase: arcPhases[i], killingPointId: i < 14 ? `kp-${i % 8}` : undefined }));
  }

  it('a real default-tier (kids-t2, 4-bundle) 18-song plan matches its own tier exactly — no bundle-set-mismatch, no last-bundle-intensity issue', () => {
    const opts = kidsOpts();
    const plan = kidsArcBundlePlanFor(18); // default tier
    // Real per-tier composition, exact expected shape from arcModels.ts's own bundle plan.
    expect(plan.map(e => `${e.id}:${e.count}`)).toEqual(['familiar:4', 'learning:5', 'moving:5', 'calm:4']);
    const phases = buildRepetitionCyclePlan(18).map(p => p.phase);
    const slots = kidsSlotsWithArc(phases);
    const result = evaluateDesignGate(slots, kidsConstraints(opts), opts);
    expect(result.blocking.some(i => i.id === 'kids-arc-bundle-set-mismatch')).toBe(false);
    expect(result.blocking.some(i => i.id === 'kids-arc-last-bundle-intensity')).toBe(false);
  });

  // TASK D — kidsOpts now explicitly selects 'kids-t1' (threaded through
  // ResolvedConstraints.kidsAgeTierId to the real call site) so this test
  // proves "a real T1 plan is recognized" against the tier the user
  // ACTUALLY selected, not merely whichever tier the observed phases happen
  // to fit (the old reverse-inference this task's fix removes).
  it('a real T1 (kids-t1, 3-bundle: familiar/learning/calm) plan, with the user actually having SELECTED kids-t1, is validated against its OWN tier definition', () => {
    const opts = kidsOpts({ kidsAgeTierId: 'kids-t1' });
    expect(kidsConstraints(opts).kidsAgeTierId).toBe('kids-t1');
    const plan = kidsArcBundlePlanFor(18, 'kids-t1');
    expect(plan.map(e => e.id)).toEqual(['familiar', 'learning', 'calm']);
    const phases = buildRepetitionCyclePlan(18, 'kids-t1').map(p => p.phase);
    const slots = kidsSlotsWithArc(phases);
    const result = evaluateDesignGate(slots, kidsConstraints(opts), opts);
    expect(result.blocking.some(i => i.id === 'kids-arc-bundle-set-mismatch')).toBe(false);
  });

  it('a real T3 (kids-t3, 5-bundle: +closing) plan, with the user actually having SELECTED kids-t3, is validated against its OWN tier definition', () => {
    const opts = kidsOpts({ kidsAgeTierId: 'kids-t3' });
    expect(kidsConstraints(opts).kidsAgeTierId).toBe('kids-t3');
    const plan = kidsArcBundlePlanFor(18, 'kids-t3');
    expect(plan.map(e => e.id)).toEqual(['familiar', 'learning', 'moving', 'calm', 'closing']);
    const phases = buildRepetitionCyclePlan(18, 'kids-t3').map(p => p.phase);
    const slots = kidsSlotsWithArc(phases);
    const result = evaluateDesignGate(slots, kidsConstraints(opts), opts);
    expect(result.blocking.some(i => i.id === 'kids-arc-bundle-set-mismatch')).toBe(false);
  });

  /**
   * TASK D (kids arc bundle check ignores the user's actual selected age
   * tier) — real motivating bug: the OLD version received no age-tier
   * signal at all and reverse-inferred a tier from the observed phase SET.
   * A user who explicitly selected 'kids-t1' but whose real slots ended up
   * showing the DEFAULT/'kids-t2' 4-bundle structure (a real dispatch bug
   * elsewhere, or a stale cached value) would have the old check see "4
   * phases present, matches kids-t2" and WRONGLY PASS. The fix threads the
   * real SELECTED tier through (ResolvedConstraints.kidsAgeTierId) and
   * checks against ONLY that tier's own definition.
   */
  it("TASK D before/after: a user who SELECTED kids-t1 but whose real slots show the default/kids-t2 4-bundle structure now correctly BLOCKS kids-arc-bundle-set-mismatch — the old reverse-inference would have WRONGLY PASSED this (it would have seen the 4-phase set and concluded 'matches kids-t2')", () => {
    const opts = kidsOpts({ kidsAgeTierId: 'kids-t1' }); // real user selection
    // Prove the OLD reverse-inference really would have matched this shape:
    // the observed set below is EXACTLY the default/kids-t2 candidate the
    // old 3-candidate loop would have tried and matched.
    const defaultPlan = kidsArcBundlePlanFor(18); // no tier -> default/kids-t2
    expect(defaultPlan.map(e => e.id)).toEqual(['familiar', 'learning', 'moving', 'calm']);
    const phases = buildRepetitionCyclePlan(18).map(p => p.phase); // real dispatch bug: t2/default shape, not the selected t1 shape
    const slots = kidsSlotsWithArc(phases);
    const constraints = kidsConstraints(opts);
    expect(constraints.kidsAgeTierId).toBe('kids-t1'); // the real selection reaches this gate
    const result = evaluateDesignGate(slots, constraints, opts);
    const issue = result.blocking.find(i => i.id === 'kids-arc-bundle-set-mismatch');
    expect(issue).toBeDefined();
    expect(issue!.expected).toContain('kids-t1');
    expect(issue!.expected).toContain('kids-familiar, kids-learning, kids-calm');
    expect(issue!.actual).toContain('kids-familiar');
  });

  it('blocks kids-arc-bundle-set-mismatch when the bundle phases used do not correspond to ANY real age-tier definition', () => {
    const opts = kidsOpts();
    // A genuinely invalid mix: default's 'moving' plus T3's 'closing' together — no single tier defines this combination.
    const phases = Array.from({ length: 18 }, (_, i) => ['kids-familiar', 'kids-moving', 'kids-closing'][i % 3]);
    const slots = kidsSlotsWithArc(phases);
    const result = evaluateDesignGate(slots, kidsConstraints(opts), opts);
    expect(result.blocking.some(i => i.id === 'kids-arc-bundle-set-mismatch')).toBe(true);
  });

  it('blocks kids-arc-last-bundle-intensity when the LAST track (by trackNo) is not the tier\'s own lowest-intensity closing bundle', () => {
    const opts = kidsOpts();
    const phases = buildRepetitionCyclePlan(18).map(p => p.phase); // default tier: ends on 'kids-calm' (lowest intensity)
    // Swap the last track to 'kids-moving' (the HIGHEST intensity bundle in this tier) instead.
    const brokenPhases = [...phases];
    brokenPhases[brokenPhases.length - 1] = 'kids-moving';
    const slots = kidsSlotsWithArc(brokenPhases);
    const result = evaluateDesignGate(slots, kidsConstraints(opts), opts);
    const issue = result.blocking.find(i => i.id === 'kids-arc-last-bundle-intensity');
    expect(issue).toBeDefined();
  });

  it('advisory: warns (does not block) kids-arc-moving-consecutive when 3+ kids-moving songs run consecutively', () => {
    const opts = kidsOpts();
    const phases = buildRepetitionCyclePlan(18).map(p => p.phase);
    // Force 3 consecutive kids-moving tracks somewhere in the middle, keep the tail intact so the last-bundle check still passes.
    const idx = phases.findIndex(p => p === 'kids-moving');
    const forced = [...phases];
    forced[idx] = 'kids-moving';
    forced[idx + 1] = 'kids-moving';
    forced[idx + 2] = 'kids-moving';
    const slots = kidsSlotsWithArc(forced);
    const result = evaluateDesignGate(slots, kidsConstraints(opts), opts);
    expect(result.blocking.some(i => i.id === 'kids-arc-moving-consecutive')).toBe(false); // never blocking
    const advisory = result.advisory.find(i => i.id === 'kids-arc-moving-consecutive');
    expect(advisory).toBeDefined();
  });

  it('regression: senior/adult (five-phase) workspace never produces any kids-arc-* issue, byte-identical (no-op for non-kids arcModelId)', () => {
    const opts = baseOpts();
    const result = evaluateDesignGate(healthySlots(), baseConstraints(opts), opts);
    expect(result.blocking.some(i => i.id.startsWith('kids-arc-'))).toBe(false);
    expect(result.advisory.some(i => i.id.startsWith('kids-arc-'))).toBe(false);
  });
});

/**
 * TASK D — the SEPARATELY-FOUND last-bundle-intensity arithmetic bug fix,
 * tested in isolation via the exported `lastBundleIntensityViolation`
 * helper with the task doc's own exact worked example (familiar:2/
 * learning:3/moving:5/calm:1, real last bundle = learning). This example's
 * numbers are deliberately illustrative (not any real arcModels.ts tier's
 * own intensities), which is exactly why the check needed extracting into
 * its own directly-testable function rather than only being reachable
 * through a real kidsAgeTierId's fixed definitions.
 */
describe('lastBundleIntensityViolation — TASK D arithmetic bug fix (isolated)', () => {
  it("the task doc's own worked example now correctly reports a violation — the OLD comparison (last intensity < MAX of the others) wrongly passed this exact case", () => {
    const intensityByPhase = new Map<string, number>([
      ['familiar', 2],
      ['learning', 3],
      ['moving', 5],
      ['calm', 1]
    ]);
    // Reproduce the OLD (buggy) comparison inline, to prove this is a real behavior change, not a hypothetical one.
    const otherIntensities = [...intensityByPhase.entries()].filter(([phase]) => phase !== 'learning').map(([, v]) => v);
    const oldCheckSaidNoViolation = intensityByPhase.get('learning')! < Math.max(...otherIntensities); // 3 < 5 -> true -> OLD code found "no violation" here
    expect(oldCheckSaidNoViolation).toBe(true); // the real bug: this pack does NOT end quieter than everything (moving=5 > learning=3), yet the old logic passed it.

    const violation = lastBundleIntensityViolation('learning', intensityByPhase);
    expect(violation).toEqual({ lastIntensity: 3, minOtherIntensity: 1 }); // fixed: compares against the MIN of the others (1, from 'calm'), correctly catching the violation.
  });

  it('a genuinely correct closing bundle (strictly quieter than every other bundle actually used) reports no violation', () => {
    const intensityByPhase = new Map<string, number>([
      ['familiar', 2],
      ['learning', 3],
      ['moving', 5],
      ['calm', 1]
    ]);
    expect(lastBundleIntensityViolation('calm', intensityByPhase)).toBeUndefined();
  });

  it('a tie (last bundle exactly equal to the quietest other bundle) still counts as a violation — must be STRICTLY quieter, not merely tied', () => {
    const intensityByPhase = new Map<string, number>([
      ['familiar', 2],
      ['calm', 1],
      ['closing', 1]
    ]);
    expect(lastBundleIntensityViolation('closing', intensityByPhase)).toEqual({ lastIntensity: 1, minOtherIntensity: 1 });
  });
});

/**
 * v(design-gate audience decoupling) fix 5 — arrangementDensityBlockingIssues
 * used to hard-code fullCount <= 4 globally; it now reads
 * ResolvedConstraints.arrangementDensityLimits.fullMax, resolved from the
 * real AudienceProfile per workspace.
 */
describe('evaluateDesignGate — arrangement density profile-aware fullMax (fix 5)', () => {
  function densitySlots(fullCount: number, total = 18): PreassignedSongSlot[] {
    return healthySlots().slice(0, total).map((slot, i) => ({
      ...slot,
      arrangementDensity: (i < fullCount ? 'full' : i % 2 === 0 ? 'medium' : 'sparse') as 'sparse' | 'medium' | 'full'
    }));
  }

  it('senior: fullMax stays exactly 4 (the real, already-tuned senior number) — 4 passes, 5 blocks with "≤ 4곡", byte-identical wording', () => {
    const opts = baseOpts();
    const passResult = evaluateDesignGate(densitySlots(4), baseConstraints(opts), opts);
    expect(passResult.blocking.some(i => i.id === 'arrangement-density-full-max')).toBe(false);
    const blockResult = evaluateDesignGate(densitySlots(5), baseConstraints(opts), opts);
    const issue = blockResult.blocking.find(i => i.id === 'arrangement-density-full-max');
    expect(issue).toBeDefined();
    expect(issue!.expected).toBe('≤ 4곡');
    expect(issue!.actual).toBe('5곡');
  });

  it('kr-idol-male: fullMax is 10 — a real performance-track-heavy pack (9 full) now passes where the old global fullMax:4 would have blocked it', () => {
    const idolProfile = audienceProfileById('kr-idol-male')!;
    const opts = baseOpts({ channel: { ...CHANNEL, archetype: 'kr-idol-male' } });
    const constraints = resolveConstraintsFromOptions(opts, idolProfile, 'kr-idol-male');
    expect(constraints.arrangementDensityLimits.fullMax).toBe(10);
    const result = evaluateDesignGate(densitySlots(9), constraints, opts);
    expect(result.blocking.some(i => i.id === 'arrangement-density-full-max')).toBe(false);
    const overResult = evaluateDesignGate(densitySlots(11), constraints, opts);
    const issue = overResult.blocking.find(i => i.id === 'arrangement-density-full-max');
    expect(issue).toBeDefined();
    expect(issue!.expected).toBe('≤ 10곡');
  });

  it('kids-0to2 (lullaby-leaning): fullMax is 2', () => {
    const profile = audienceProfileById('kids-0to2')!;
    expect(profile.arrangementDensityLimits.fullMax).toBe(2);
    const opts = baseOpts({ channel: { ...CHANNEL, archetype: 'kr-kids-song' } });
    const constraints = resolveConstraintsFromOptions(opts, profile, 'kr-kids');
    const result = evaluateDesignGate(densitySlots(3), constraints, opts);
    expect(result.blocking.some(i => i.id === 'arrangement-density-full-max')).toBe(true);
  });

  it('kids-4to7 (action-leaning): fullMax is 7', () => {
    const profile = audienceProfileById('kids-4to7')!;
    expect(profile.arrangementDensityLimits.fullMax).toBe(7);
  });

  it('kr-2030/jp-2030: fullMax is 6 for all four real profiles', () => {
    expect(audienceProfileById('kr-2030-emotional')!.arrangementDensityLimits.fullMax).toBe(6);
    expect(audienceProfileById('kr-2030-electro')!.arrangementDensityLimits.fullMax).toBe(6);
    expect(audienceProfileById('jp-2030-melodic')!.arrangementDensityLimits.fullMax).toBe(6);
    expect(audienceProfileById('jp-2030-anime')!.arrangementDensityLimits.fullMax).toBe(6);
  });

  it('regression: SENIOR_AUDIENCE_PROFILE.arrangementDensityLimits.fullMax is exactly 4, matching the pre-fix hard-coded constant verbatim', () => {
    expect(SENIOR_AUDIENCE_PROFILE.arrangementDensityLimits.fullMax).toBe(4);
  });
});

/**
 * v(design-gate audience decoupling) — explicit senior-workspace byte-
 * identical proof, covering every one of the 5 fixes' own senior-facing
 * path in one place (the task's own top-priority constraint: "시니어의 기존
 * 관문 기준은 그대로 유지하십시오").
 */
describe('evaluateDesignGate — senior-workspace byte-identical regression sweep', () => {
  it('BREADTH_THRESHOLDS.balanced.genre.maxPerGenre is untouched (still 5) — only the design-gate CHECK site adapts, never the source-of-truth table', () => {
    expect(BREADTH_THRESHOLDS.balanced.genre.maxPerGenre).toBe(5);
    expect(BREADTH_THRESHOLDS.focused.genre.maxPerGenre).toBe(12);
    expect(BREADTH_THRESHOLDS.variety.genre.maxPerGenre).toBe(4);
  });

  it('a healthy senior pack (real fixture) passes with zero blocking/advisory shape drift', () => {
    const opts = baseOpts();
    const result = evaluateDesignGate(healthySlots(), baseConstraints(opts), opts);
    expect(result).toEqual({ passed: true, blocking: [], advisory: [] });
  });

  it('a maximally unhealthy senior pack produces the exact same issue id set as before this task\'s fixes (no fix silently loosened or tightened a senior-facing check)', () => {
    const opts = baseOpts();
    const slots = healthySlots().map(slot => ({
      ...slot,
      vocalType: 'male' as const,
      tempo: 96,
      genreId: 'oldpop-warm-morning-glow',
      killingPointId: undefined,
      arcPhase: 'build',
      arrangementDensity: 'full' as const
    }));
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    const ids = new Set(result.blocking.map(i => i.id));
    // Every one of these fired before this task's fixes and must still fire, unchanged.
    for (const expectedId of [
      'vocal-type-variety', 'vocal-type-min', 'vocal-consecutive', 'vocal-segment-balance',
      'bpm-stddev', 'bpm-range',
      'genre-max', 'genre-consecutive',
      'killing-point-count', 'killing-point-variety', 'arc-phases',
      'arrangement-density-full-max'
    ]) {
      expect(ids.has(expectedId)).toBe(true);
    }
    // None of the NEW fix-2/fix-4 issue ids ever appear for a senior pack (default moneyChordMode, five-phase arcModelId).
    for (const newId of [
      'moneychord-explicit-choice-zero', 'moneychord-explicit-choice-flagship', 'moneychord-explicit-choice-share',
      'vocal-quota-fidelity', 'kids-arc-bundle-set-mismatch', 'kids-arc-last-bundle-intensity', 'kids-arc-moving-consecutive'
    ]) {
      expect(ids.has(newId)).toBe(false);
    }
    // genre-max's own expected text stays the plain, non-auto-adjusted form (5 candidates, ceil(18/5)=4 <= 5).
    const genreMaxIssue = result.blocking.find(i => i.id === 'genre-max');
    expect(genreMaxIssue!.expected).toBe('≤ 5곡');
  });
});
