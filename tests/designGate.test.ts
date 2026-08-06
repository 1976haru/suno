import { describe, expect, it } from 'vitest';
import { evaluateDesignGate } from '../src/core/designGate';
import { resolveConstraintsFromOptions, type ResolvedConstraints } from '../src/core/constraints';
import { SENIOR_AUDIENCE_PROFILE, audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { buildRepetitionCyclePlan } from '../src/core/arcModels';
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
    expect(result.blocking.filter(i => i.id.startsWith('vocal-')).every(i => typeof i.autoFix === 'function')).toBe(true);
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

  it('an autoFix() call produces a vocalType allocation whose counts sum to songCount', () => {
    const opts = baseOpts();
    const slots = healthySlots().map(slot => ({ ...slot, vocalType: 'male' as const }));
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    const fix = result.blocking.find(i => i.id === 'vocal-type-variety')!.autoFix!();
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
  it('a channel with vocalQuotaOverride gets its OWN fixed split back from autoFix, not the generic 6/6/6 default', () => {
    const fixedQuotaChannel: ChannelProfile = { ...CHANNEL, archetype: 'kr-idol-male', vocalQuotaOverride: { male: 15, female: 0, mixed: 3 } };
    const opts = baseOpts({ channel: fixedQuotaChannel, vocalTone: fixedQuotaChannel.defaultVocal });
    const slots = healthySlots().map(slot => ({ ...slot, vocalType: 'male' as const }));
    const result = evaluateDesignGate(slots, baseConstraints(opts), opts);
    const issue = result.blocking.find(i => i.id === 'vocal-type-variety');
    expect(issue).toBeDefined();
    const fix = issue!.autoFix!();
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
