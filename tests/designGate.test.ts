import { describe, expect, it } from 'vitest';
import { evaluateDesignGate } from '../src/core/designGate';
import { resolveConstraintsFromOptions, type ResolvedConstraints } from '../src/core/constraints';
import { SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';
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
  const bpms = [78, 82, 84, 88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108, 96, 88, 84, 100];
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
