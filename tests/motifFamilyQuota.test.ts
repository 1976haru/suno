import { describe, expect, it } from 'vitest';
import { MOTIF_FAMILIES, motifFamilyFor, motifFamilyIdForFrameId } from '../src/data/motifFamilies';
import { checkMotifFamilyCooldown, checkMotifFamilyQuota } from '../src/core/motifFamilyCooldown';
import { evaluateReleaseReadiness } from '../src/core/releaseReadiness';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { scoreSongs } from '../src/core/quality';
import { audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import { channelPresets, genrePacks, moodPacks, seasonPacks, makeOptions } from './fixtures';
import type { SceneSignature } from '../src/core/situationLedger';

/**
 * codex 지시문 02 (TASK C) — real gap this closes: core/releaseReadiness.ts's
 * old "same-subject-cap" grouped songs by the exact lyricTheme id, which
 * almost never fired (dozens of individual themes share ~44 real frameId
 * values — see data/motifFamilies.ts's own doc comment). This registry
 * groups those real frameIds into coarser families and adds a genuinely new
 * cross-pack cooldown signal, built on core/situationLedger.ts's own
 * frameId field (which TASK B's own fix made real — see
 * batchPreallocation.ts's reconcileWithPreassignedSlot).
 */
describe('[codex 지시문 02 TASK C] MOTIF_FAMILIES registry', () => {
  it('every family has at least one real alias and maxPerPack > 0', () => {
    for (const family of MOTIF_FAMILIES) {
      expect(family.aliases.length).toBeGreaterThan(0);
      expect(family.maxPerPack).toBeGreaterThan(0);
    }
  });

  it('no frameId is claimed by two different families (registry is a real partition, not overlapping)', () => {
    const seen = new Map<string, string>();
    for (const family of MOTIF_FAMILIES) {
      for (const frameId of family.aliases) {
        expect(seen.has(frameId), `frameId "${frameId}" claimed by both "${seen.get(frameId)}" and "${family.id}"`).toBe(false);
        seen.set(frameId, family.id);
      }
    }
  });

  it('motifFamilyFor/motifFamilyIdForFrameId resolve a real known frameId', () => {
    expect(motifFamilyIdForFrameId('dance-saturday')).toBe('nightlife-motion');
    expect(motifFamilyFor('young-first-love')?.id).toBe('romantic-connection');
  });

  it('an unknown frameId resolves to undefined, not a fabricated guess', () => {
    expect(motifFamilyIdForFrameId('not-a-real-frame-id')).toBeUndefined();
    expect(motifFamilyIdForFrameId(undefined)).toBeUndefined();
  });

  it('workspace-scoped families (performance-stage, kids-interactive) declare their own workspaces', () => {
    const stage = MOTIF_FAMILIES.find(f => f.id === 'performance-stage');
    const kids = MOTIF_FAMILIES.find(f => f.id === 'kids-interactive');
    expect(stage?.workspaces).toEqual(['kr-idol-male', 'kr-idol-female']);
    expect(kids?.workspaces).toEqual(['kr-kids', 'jp-kids']);
  });
});

describe('[codex 지시문 02 TASK C] checkMotifFamilyQuota', () => {
  it('flags a pack where one family exceeds its own maxPerPack', () => {
    const family = MOTIF_FAMILIES.find(f => f.id === 'romantic-connection')!;
    const songs = Array.from({ length: family.maxPerPack + 1 }, (_, i) => ({ trackNo: i + 1, frameId: family.aliases[0] }));
    const findings = checkMotifFamilyQuota(songs);
    expect(findings).toHaveLength(1);
    expect(findings[0].familyId).toBe('romantic-connection');
    expect(findings[0].count).toBe(family.maxPerPack + 1);
  });

  it('does not flag a pack within every family\'s own cap', () => {
    const songs = [
      { trackNo: 1, frameId: 'young-first-love' },
      { trackNo: 2, frameId: 'dance-saturday' },
      { trackNo: 3, frameId: 'commute-transit' }
    ];
    expect(checkMotifFamilyQuota(songs)).toHaveLength(0);
  });

  it('songs with no frameId (undefined) contribute to no family and never cause a false flag', () => {
    const songs = Array.from({ length: 10 }, (_, i) => ({ trackNo: i + 1, frameId: undefined }));
    expect(checkMotifFamilyQuota(songs)).toHaveLength(0);
  });
});

describe('[codex 지시문 02 TASK C] checkMotifFamilyCooldown', () => {
  function sig(overrides: Partial<SceneSignature> = {}): SceneSignature {
    return { situation: 'x', packId: 'p1', trackNo: 1, ...overrides };
  }

  it('flags a family used in the current pack that also appears in recent history', () => {
    const currentPack = [{ trackNo: 1, frameId: 'dance-saturday' }];
    const recentHistory = [sig({ packId: 'p-old', frameId: 'night-drive' })]; // same family (nightlife-motion) via a different alias
    const findings = checkMotifFamilyCooldown(currentPack, recentHistory);
    expect(findings).toHaveLength(1);
    expect(findings[0].familyId).toBe('nightlife-motion');
    expect(findings[0].recentPackCount).toBe(1);
  });

  it('does not flag a family with no recent-history presence', () => {
    const currentPack = [{ trackNo: 1, frameId: 'young-first-love' }];
    const recentHistory = [sig({ packId: 'p-old', frameId: 'dance-saturday' })];
    expect(checkMotifFamilyCooldown(currentPack, recentHistory)).toHaveLength(0);
  });

  it('is a no-op with empty recent history', () => {
    const currentPack = [{ trackNo: 1, frameId: 'young-first-love' }];
    expect(checkMotifFamilyCooldown(currentPack, [])).toHaveLength(0);
  });

  it('recentPackCount reflects distinct PACKS, not raw song count within those packs', () => {
    const currentPack = [{ trackNo: 1, frameId: 'young-first-love' }];
    const recentHistory = [
      sig({ packId: 'p-old', trackNo: 1, frameId: 'young-first-love' }),
      sig({ packId: 'p-old', trackNo: 2, frameId: 'reunion-parting' }) // same pack, same family, different alias
    ];
    const findings = checkMotifFamilyCooldown(currentPack, recentHistory);
    expect(findings[0].recentPackCount).toBe(1);
  });
});

describe('[codex 지시문 02 TASK C] evaluateReleaseReadiness wiring', () => {
  const channel = channelPresets[0];
  const genres = genrePacks.filter(g => channel.preferredGenres.includes(g.id));
  const moods = moodPacks.filter(m => channel.preferredMoods.includes(m.id));
  const season = seasonPacks[0];
  const opts = makeOptions({ channel, songCount: 6, lyricLanguage: 'english' });
  const blueprint = generateLocalBlueprint(opts, genres, moods, season);
  const scoredSongs = scoreSongs(blueprint.songs, channel, 'english');
  const audienceProfile = audienceProfileForChannelArchetype(channel.archetype, channel.audience);

  it('same-subject-cap item is present and never silently skipped', () => {
    const report = evaluateReleaseReadiness({
      songs: scoredSongs, conceptLabel: opts.customConcept || opts.projectTitle, songCount: opts.songCount, audienceProfile, lyricLanguage: 'english'
    });
    const item = report.items.find(i => i.id === 'same-subject-cap');
    expect(item).toBeDefined();
    expect(['pass', 'fail']).toContain(item?.status);
  });

  it('motif-family-recent-pack-cooldown reports not-measured without recentSceneSignatures', () => {
    const report = evaluateReleaseReadiness({
      songs: scoredSongs, conceptLabel: opts.customConcept || opts.projectTitle, songCount: opts.songCount, audienceProfile, lyricLanguage: 'english'
    });
    const item = report.items.find(i => i.id === 'motif-family-recent-pack-cooldown');
    expect(item?.status).toBe('not-measured');
  });

  it('motif-family-recent-pack-cooldown reports pass with empty recentSceneSignatures', () => {
    const report = evaluateReleaseReadiness({
      songs: scoredSongs, conceptLabel: opts.customConcept || opts.projectTitle, songCount: opts.songCount, audienceProfile, lyricLanguage: 'english',
      duplicationHistory: { recentSituations: [], recentLyricLines: [], historicalTitles: new Set(), recentSceneSignatures: [] }
    });
    const item = report.items.find(i => i.id === 'motif-family-recent-pack-cooldown');
    expect(item?.status).toBe('pass');
  });
});
