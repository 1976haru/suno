import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint, resolveKidsAgeTierId } from '../src/core/localGenerator';
import { kidsArcBundlePlanFor } from '../src/core/arcModels';
import { kidsAgeTierFor } from '../src/data/kidsAgeTiers';
import { kidsKillingPointsForTier } from '../src/data/killingPointsKids';
import { measureLyrics } from '../src/core/lyricMetrics';
import { normalizeChannel, createDraftChannel } from '../src/utils/channelProfile';
import { resolveConstraintsFromOptions } from '../src/core/constraints';
import { KIDS_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';
import { channelPresets, genrePacks, moodPacks, seasonPacks } from '../src/data/presets';
import type { ChannelProfile, GenerationOptions, KidsAgeTierId, LyricLanguage } from '../src/types';

/**
 * v5.13 (TASK: kidsAgeTierId wiring) — real, measured evidence that
 * kidsAgeTierId actually reaches generateLocalBlueprint and produces
 * different real output per tier (BPM range, arc bundle count, section
 * structure, hook-repeat text, killing-point set) — not just that the
 * plumbing type-checks. Every pack below is a real generateLocalBlueprint
 * call, not a hand-built fixture.
 */

const KR_KIDS_CHANNEL = channelPresets.find(c => c.id === 'follow-along-action-song')!;
const JP_KIDS_CHANNEL = channelPresets.find(c => c.id === 'teasobi-hiroba')!;
const SEASON = seasonPacks.find(s => s.id === 'spring-open') ?? seasonPacks[0];
const TIERS: KidsAgeTierId[] = ['kids-t1', 'kids-t2', 'kids-t3'];

function optionsFor(channel: ChannelProfile, lyricLanguage: LyricLanguage, kidsAgeTierId: KidsAgeTierId, songCount = 18): GenerationOptions {
  return {
    channel,
    projectTitle: 'Kids Age Tier Test Pack',
    songCount,
    lyricLanguage,
    market: channel.market,
    audience: channel.audience,
    genreIds: channel.preferredGenres,
    moodIds: channel.preferredMoods,
    seasonId: SEASON.id,
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson',
    lyricDepth: 'commercial',
    durationTarget: 'under3m30',
    moneyChordMode: 'default',
    customMoneyChord: '',
    customConcept: '',
    avoidWords: '',
    personaMode: false,
    kidsAgeTierId
  } as GenerationOptions;
}

function packFor(channel: ChannelProfile, lyricLanguage: LyricLanguage, tier: KidsAgeTierId) {
  const opts = optionsFor(channel, lyricLanguage, tier);
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
  return generateLocalBlueprint(opts, genres, moods, SEASON);
}

describe('[v5.13] channel presets — real kidsAgeTierId assignment', () => {
  it('assigns a real tier to all 6 kr-kids/jp-kids channel presets, matching each channel\'s own content character', () => {
    const expected: Record<string, KidsAgeTierId> = {
      'bedtime-lullaby-radio': 'kids-t1',
      'daily-habit-learning-song': 'kids-t2',
      'follow-along-action-song': 'kids-t3',
      'oyasumi-mae-no-uta': 'kids-t1',
      'teasobi-hiroba': 'kids-t2',
      'minna-de-taiso': 'kids-t3'
    };
    for (const [id, tier] of Object.entries(expected)) {
      const channel = channelPresets.find(c => c.id === id)!;
      expect(channel, `channel preset ${id} should exist`).toBeTruthy();
      expect(channel.kidsAgeTierId).toBe(tier);
    }
  });

  it('no non-kids channel preset has kidsAgeTierId set', () => {
    const nonKids = channelPresets.filter(c => !c.archetype || !['kids', 'kr-kids-song', 'jp-kids-song'].includes(c.archetype));
    expect(nonKids.length).toBeGreaterThan(0);
    for (const channel of nonKids) expect(channel.kidsAgeTierId).toBeUndefined();
  });
});

describe('[v5.13] normalizeChannel / createDraftChannel preserve kidsAgeTierId', () => {
  it('normalizeChannel copies a real input.kidsAgeTierId through untouched', () => {
    const normalized = normalizeChannel({ id: 'x', kidsAgeTierId: 'kids-t3', archetype: 'kr-kids-song' });
    expect(normalized.kidsAgeTierId).toBe('kids-t3');
  });

  it('normalizeChannel leaves kidsAgeTierId undefined when input has none', () => {
    const normalized = normalizeChannel({ id: 'x', archetype: 'senior-morning' });
    expect(normalized.kidsAgeTierId).toBeUndefined();
  });

  it('createDraftChannel clones the template channel\'s own kidsAgeTierId', () => {
    const draft = createDraftChannel('New Kids Channel', KR_KIDS_CHANNEL);
    expect(draft.kidsAgeTierId).toBe(KR_KIDS_CHANNEL.kidsAgeTierId);
  });
});

describe('[v5.13] resolveKidsAgeTierId / resolveConstraintsFromOptions', () => {
  it('resolves undefined for a non-kids archetype regardless of any set field', () => {
    expect(resolveKidsAgeTierId({ channel: { archetype: 'senior-morning', kidsAgeTierId: 'kids-t1' } })).toBeUndefined();
  });

  it('opts.kidsAgeTierId overrides channel.kidsAgeTierId', () => {
    expect(resolveKidsAgeTierId({
      channel: { archetype: 'kr-kids-song', kidsAgeTierId: 'kids-t1' },
      kidsAgeTierId: 'kids-t3'
    })).toBe('kids-t3');
  });

  it('falls back to the channel\'s own tier when opts has none', () => {
    expect(resolveKidsAgeTierId({ channel: { archetype: 'kr-kids-song', kidsAgeTierId: 'kids-t1' } })).toBe('kids-t1');
  });

  it('returns undefined (not DEFAULT_KIDS_AGE_TIER_ID) when a kids channel has no tier set anywhere — real regression guard: this must NOT silently change little-singalong-radio\'s or any pre-existing custom kids channel\'s lyric structure', () => {
    expect(resolveKidsAgeTierId({ channel: { archetype: 'kr-kids-song' } })).toBeUndefined();
    expect(resolveKidsAgeTierId({ channel: { archetype: 'kids' } })).toBeUndefined();
  });

  it('resolveConstraintsFromOptions threads the resolved tier onto ResolvedConstraints.kidsAgeTierId', () => {
    const constraints = resolveConstraintsFromOptions(
      { projectTitle: 'x', songCount: 18, channel: { archetype: 'kr-kids-song', kidsAgeTierId: 'kids-t3' } },
      KIDS_AUDIENCE_PROFILE,
      'kr-kids'
    );
    expect(constraints.kidsAgeTierId).toBe('kids-t3');
  });

  it('resolveConstraintsFromOptions leaves kidsAgeTierId undefined for a non-kids channel', () => {
    const constraints = resolveConstraintsFromOptions(
      { projectTitle: 'x', songCount: 18, channel: { archetype: 'senior-morning' } },
      KIDS_AUDIENCE_PROFILE
    );
    expect(constraints.kidsAgeTierId).toBeUndefined();
  });
});

describe('[v5.13] real generateLocalBlueprint output differs measurably by kidsAgeTierId — kr-kids', () => {
  const packs = Object.fromEntries(TIERS.map(tier => [tier, packFor(KR_KIDS_CHANNEL, 'korean', tier)])) as Record<KidsAgeTierId, ReturnType<typeof packFor>>;

  it('every song is generated (18/18) for every tier', () => {
    for (const tier of TIERS) expect(packs[tier].songs).toHaveLength(18);
  });

  it('every song records the real resolved effectiveKidsAgeTierId', () => {
    for (const tier of TIERS) {
      for (const song of packs[tier].songs) expect(song.effectiveKidsAgeTierId).toBe(tier);
    }
  });

  it('measured BPM range for each tier falls within that tier\'s own kidsAgeTiers.ts tempoRange (real clamp applied to real output)', () => {
    for (const tier of TIERS) {
      const [floor, ceiling] = kidsAgeTierFor(tier).tempoRange;
      const bpms = packs[tier].songs.map(s => s.bpm!);
      expect(Math.min(...bpms)).toBeGreaterThanOrEqual(floor);
      expect(Math.max(...bpms)).toBeLessThanOrEqual(ceiling);
    }
  });

  it('measured distinct arc-bundle count per tier matches kidsArcBundlePlanFor\'s real scaled bundle count (T1=3, T2=4, T3=5)', () => {
    const expectedDistinctByTier: Record<KidsAgeTierId, number> = { 'kids-t1': 3, 'kids-t2': 4, 'kids-t3': 5 };
    for (const tier of TIERS) {
      const distinctPhases = new Set(packs[tier].songs.map(s => s.arcPhase));
      const realBundleCount = kidsArcBundlePlanFor(18, tier).filter(b => b.count > 0).length;
      expect(realBundleCount).toBe(expectedDistinctByTier[tier]);
      expect(distinctPhases.size).toBe(expectedDistinctByTier[tier]);
    }
  });

  it('T1 lyrics never include a call-and-response or bridge section (data/kidsStructureTemplates.ts\'s own T1 template)', () => {
    for (const song of packs['kids-t1'].songs) {
      expect(song.lyrics).not.toContain('[call and response]');
      expect(song.lyrics).not.toContain('[short bridge]');
    }
  });

  it('T2 lyrics include exactly 2 call-and-response sections and no bridge (T2 template)', () => {
    for (const song of packs['kids-t2'].songs) {
      const matches = song.lyrics.match(/\[call and response\]/g) || [];
      expect(matches.length).toBe(2);
      expect(song.lyrics).not.toContain('[short bridge]');
    }
  });

  it('T3 lyrics include a short bridge and no call-and-response (T3 template, closest to the pre-tier default)', () => {
    for (const song of packs['kids-t3'].songs) {
      expect(song.lyrics).toContain('[short bridge]');
      expect(song.lyrics).not.toContain('[call and response]');
    }
  });

  it('hookStyleDirectives text in the stylePrompt reflects each tier\'s own minHookRepeats (T1=6x, T2=5x, T3=4x)', () => {
    const expectedRepeats: Record<KidsAgeTierId, string> = { 'kids-t1': 'hook repeats 6x', 'kids-t2': 'hook repeats 5x', 'kids-t3': 'hook repeats 4x' };
    for (const tier of TIERS) {
      for (const song of packs[tier].songs) {
        expect(song.stylePrompt).toContain(expectedRepeats[tier]);
      }
    }
  });

  it('every assigned killingPointId (when present) is a real member of that tier\'s own eligible kids killing-point set', () => {
    for (const tier of TIERS) {
      const eligibleIds = new Set(kidsKillingPointsForTier(tier).map(kp => kp.id));
      for (const song of packs[tier].songs) {
        if (song.killingPointId) expect(eligibleIds.has(song.killingPointId)).toBe(true);
      }
    }
  });

  it('real measured word/syllable counts (Korean) per tier — reported as actual ranges, not asserted against the task doc\'s proposed target numbers', () => {
    const report: Record<string, { primaryRange: [number, number]; syllableRange: [number, number] }> = {};
    for (const tier of TIERS) {
      const metrics = packs[tier].songs.map(s => measureLyrics(s.lyrics, 'korean'));
      const primaries = metrics.map(m => m.primary);
      const syllables = metrics.map(m => m.syllables);
      report[tier] = {
        primaryRange: [Math.min(...primaries), Math.max(...primaries)],
        syllableRange: [Math.min(...syllables), Math.max(...syllables)]
      };
      // Real sanity bound only (not the task doc's proposed 40-70/70-110/100-160
      // numbers — see this task's own report for why those weren't forced):
      // every tier must measure real, non-zero, finite content.
      expect(Math.min(...primaries)).toBeGreaterThan(0);
      expect(Math.min(...syllables)).toBeGreaterThan(0);
    }
     
    console.log('[v5.13] measured kr-kids word/syllable ranges by tier:', report);
  });
});

describe('[v5.13] real generateLocalBlueprint output differs measurably by kidsAgeTierId — jp-kids', () => {
  const packs = Object.fromEntries(TIERS.map(tier => [tier, packFor(JP_KIDS_CHANNEL, 'japanese', tier)])) as Record<KidsAgeTierId, ReturnType<typeof packFor>>;

  it('every song is generated (18/18) for every tier, with real BPM clamped into range and the right effectiveKidsAgeTierId', () => {
    for (const tier of TIERS) {
      const [floor, ceiling] = kidsAgeTierFor(tier).tempoRange;
      expect(packs[tier].songs).toHaveLength(18);
      for (const song of packs[tier].songs) {
        expect(song.effectiveKidsAgeTierId).toBe(tier);
        expect(song.bpm!).toBeGreaterThanOrEqual(floor);
        expect(song.bpm!).toBeLessThanOrEqual(ceiling);
      }
    }
  });

  it('measured distinct arc-bundle count matches the same T1=3/T2=4/T3=5 real shape as kr-kids', () => {
    const expectedDistinctByTier: Record<KidsAgeTierId, number> = { 'kids-t1': 3, 'kids-t2': 4, 'kids-t3': 5 };
    for (const tier of TIERS) {
      const distinctPhases = new Set(packs[tier].songs.map(s => s.arcPhase));
      expect(distinctPhases.size).toBe(expectedDistinctByTier[tier]);
    }
  });

  it('T1/T2/T3 structural section markers differ the same way as kr-kids (language-independent — section tags are English regardless of lyricLanguage)', () => {
    for (const song of packs['kids-t1'].songs) expect(song.lyrics).not.toContain('[call and response]');
    for (const song of packs['kids-t2'].songs) expect((song.lyrics.match(/\[call and response\]/g) || []).length).toBe(2);
    for (const song of packs['kids-t3'].songs) expect(song.lyrics).toContain('[short bridge]');
  });

  it('real measured word/syllable counts (Japanese) per tier — reported, not forced against the task doc\'s proposed numbers', () => {
    const report: Record<string, { primaryRange: [number, number]; syllableRange: [number, number] }> = {};
    for (const tier of TIERS) {
      const metrics = packs[tier].songs.map(s => measureLyrics(s.lyrics, 'japanese'));
      const primaries = metrics.map(m => m.primary);
      const syllables = metrics.map(m => m.syllables);
      report[tier] = {
        primaryRange: [Math.min(...primaries), Math.max(...primaries)],
        syllableRange: [Math.min(...syllables), Math.max(...syllables)]
      };
      expect(Math.min(...primaries)).toBeGreaterThan(0);
    }
     
    console.log('[v5.13] measured jp-kids word/syllable ranges by tier:', report);
  });
});

describe('[v5.13] no-signal default (kidsAgeTierId omitted everywhere) reproduces the pre-tier shape unchanged — real regression guard', () => {
  it('a kids channel with no kidsAgeTierId anywhere still gets the original DEFAULT_KIDS_SECTIONS shape (no call-and-response, no bridge) and no effectiveKidsAgeTierId', () => {
    const channelWithoutTier: ChannelProfile = { ...KR_KIDS_CHANNEL, kidsAgeTierId: undefined };
    const opts = optionsFor(channelWithoutTier, 'korean', undefined as unknown as KidsAgeTierId);
    delete (opts as Partial<GenerationOptions>).kidsAgeTierId;
    const genres = genrePacks.filter(g => channelWithoutTier.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => channelWithoutTier.preferredMoods.includes(m.id));
    const pack = generateLocalBlueprint(opts, genres, moods, SEASON);
    for (const song of pack.songs) {
      expect(song.lyrics).not.toContain('[call and response]');
      expect(song.effectiveKidsAgeTierId).toBeUndefined();
    }
  });

  it('the pre-existing senior-workspace little-singalong-radio kids channel (archetype "kids", never assigned a tier) is completely unaffected by this task', () => {
    const littleSingalong = channelPresets.find(c => c.archetype === 'kids');
    if (!littleSingalong) return; // structural guard only if the preset ever gets renamed/removed
    expect(littleSingalong.kidsAgeTierId).toBeUndefined();
    const opts = optionsFor(littleSingalong, 'english', undefined as unknown as KidsAgeTierId);
    delete (opts as Partial<GenerationOptions>).kidsAgeTierId;
    const genres = genrePacks.filter(g => littleSingalong.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => littleSingalong.preferredMoods.includes(m.id));
    const pack = generateLocalBlueprint(opts, genres, moods, SEASON);
    for (const song of pack.songs) {
      expect(song.lyrics).not.toContain('[call and response]');
      expect(song.effectiveKidsAgeTierId).toBeUndefined();
    }
  });
});
