import { describe, expect, it } from 'vitest';
import { runFullAudit } from '../src/core/fullAudit';
import { directSetLocal } from '../src/core/setDirector';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { getGenreById } from '../src/data/genreLibrary';
import { channelPresets } from './fixtures';
import { SENIOR_AUDIENCE_PROFILE, audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import type { ChannelProfile } from '../src/types';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;
const CONCEPT = '비틀즈 느낌의 밝은 60년대 팝';

function generatePackFor(channel: ChannelProfile, concept: string, lyricLanguage: 'english' | 'korean' | 'japanese' = 'english') {
  const plan = directSetLocal(concept, channel, 18, { recentGenreIds: [], recentHooks: [] });
  const genreAllocation = plan.allocations.find(a => a.axis === 'genre')!;
  const genreIds = Object.keys(genreAllocation.counts);
  const genres = genreIds.map(id => getGenreById(id)!).filter(Boolean);
  const opts = {
    channel,
    projectTitle: concept,
    songCount: 18,
    lyricLanguage,
    market: channel.market,
    audience: channel.audience,
    genreIds,
    moodIds: channel.preferredMoods,
    seasonId: 'spring-open',
    vocalTone: channel.defaultVocal,
    perspective: 'firstPerson' as const,
    lyricDepth: 'commercial' as const,
    durationTarget: 'under3m30' as const,
    moneyChordMode: 'default' as const,
    customMoneyChord: '',
    customConcept: concept,
    avoidWords: '',
    personaMode: false,
    diversityAllocations: plan.allocations
  };
  return generateLocalBlueprint(opts, genres, [], { id: 'spring-open', label: 'Spring', period: '', keywords: [], visualDirection: '' } as any);
}

function generatePack() {
  return generatePackFor(seniorChannel, CONCEPT);
}

describe('[v3.76 TASK B] runFullAudit', () => {
  it('REPORT: runs >= 40 checks against a real 18-song pack, categorized, none silently skipped', () => {
    const bp = generatePack();
    const report = runFullAudit(bp.songs, { conceptLabel: CONCEPT, songCount: 18, audienceProfile: SENIOR_AUDIENCE_PROFILE });

    const byStatus = { pass: 0, fail: 0, 'not-measured': 0 };
    for (const it of report.items) byStatus[it.status] += 1;

    // eslint-disable-next-line no-console
    console.log('[TASK v3.76 REPORT] full audit item count:', report.items.length);
    // eslint-disable-next-line no-console
    console.log('[TASK v3.76 REPORT] by status:', byStatus);
    for (const it of report.items) {
      // eslint-disable-next-line no-console
      console.log(`[TASK v3.76 REPORT]   [${it.category}] ${it.labelKo}: ${it.status} (target ${it.targetKo}, actual ${it.actualKo})${it.notImplemented ? ' [미구현]' : ''}`);
    }

    expect(report.items.length).toBeGreaterThanOrEqual(40);
    expect(report.items.every(it => it.id)).toBe(true);
    // Every category from the spec's own §3-2 list must be represented.
    const categories = new Set(report.items.map(it => it.category));
    expect(categories).toEqual(new Set(['생성 구조', '보컬', '프롬프트', '가사', '킬링포인트·아크', '제목', '약속 이행도', '워크스페이스']));
  });

  it('running the same pack twice produces byte-identical results (pure function, no hidden state)', () => {
    const bp = generatePack();
    const a = runFullAudit(bp.songs, { conceptLabel: CONCEPT, songCount: 18, audienceProfile: SENIOR_AUDIENCE_PROFILE });
    const b = runFullAudit(bp.songs, { conceptLabel: CONCEPT, songCount: 18, audienceProfile: SENIOR_AUDIENCE_PROFILE });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

/**
 * v5.12 — killingPointItems's 'arc_phase_all_used' check used to hard-code
 * "exactly 5 distinct arcPhase values" workspace-agnostic, so it would
 * incorrectly fail a real, healthy kr-kids/jp-kids pack (which uses
 * core/arcModels.ts's buildRepetitionCyclePlan — 3-5 distinct 'kids-*'
 * bundle values, not 5). This runs the actual generation pipeline (same
 * generatePackFor helper the senior tests above use) against a real
 * kr-kids channel preset to prove the fix against real output, not a
 * hand-built fixture.
 */
describe('[v5.12] runFullAudit — arc-model-aware killing-point/arc check (kr-kids)', () => {
  const krKidsChannel = channelPresets.find(channel => channel.archetype === 'kr-kids-song')!;
  const KIDS_CONCEPT = '신나게 뛰어노는 유치원 율동 동요';
  const krKidsAudienceProfile = audienceProfileForChannelArchetype('kr-kids-song', 'kids');

  it('sanity: krKidsChannel exists and resolves to the repetition-cycle arc model', () => {
    expect(krKidsChannel).toBeDefined();
    expect(krKidsAudienceProfile.arcModelId).toBe('repetition-cycle');
  });

  it('a real generated kr-kids pack uses only kids-* bundle phases (never the 5 adult five-phase values)', () => {
    const bp = generatePackFor(krKidsChannel, KIDS_CONCEPT, 'korean');
    const distinctPhases = new Set(bp.songs.map(song => song.arcPhase).filter(Boolean));
    for (const phase of distinctPhases) {
      expect(String(phase).startsWith('kids-')).toBe(true);
    }
  });

  it('a real generated kr-kids pack correctly PASSES arc_phase_all_used — previously would have incorrectly failed against the old hard-coded "must equal 5"', () => {
    const bp = generatePackFor(krKidsChannel, KIDS_CONCEPT, 'korean');
    const report = runFullAudit(bp.songs, { conceptLabel: KIDS_CONCEPT, songCount: 18, audienceProfile: krKidsAudienceProfile });
    const arcItem = report.items.find(i => i.id === 'arc_phase_all_used')!;
    expect(arcItem).toBeDefined();
    expect(arcItem.status).toBe('pass');
  });

  it('a genuinely broken kids pack (only 1 distinct arc value) still correctly FAILS arc_phase_all_used — the fix is not a no-op for kids', () => {
    const bp = generatePackFor(krKidsChannel, KIDS_CONCEPT, 'korean');
    const brokenSongs = bp.songs.map(song => ({ ...song, arcPhase: 'kids-familiar' }));
    const report = runFullAudit(brokenSongs, { conceptLabel: KIDS_CONCEPT, songCount: 18, audienceProfile: krKidsAudienceProfile });
    const arcItem = report.items.find(i => i.id === 'arc_phase_all_used')!;
    expect(arcItem.status).toBe('fail');
    expect(arcItem.actualKo).toBe('1종');
  });

  it('a kids pack fed adult five-phase values instead of its own bundle values still correctly FAILS (wrong values entirely)', () => {
    const bp = generatePack(); // real senior pack, already has 5 distinct adult arcPhase values
    const adultPhaseSongs = bp.songs.slice(0, 18);
    const report = runFullAudit(adultPhaseSongs, { conceptLabel: CONCEPT, songCount: 18, audienceProfile: krKidsAudienceProfile });
    const arcItem = report.items.find(i => i.id === 'arc_phase_all_used')!;
    expect(arcItem.status).toBe('fail');
    expect(arcItem.actualKo).toBe('0종');
  });
});

describe('[v5.12] regression — runFullAudit\'s senior/adult arc_phase_all_used check is unaffected', () => {
  it('a real generated senior pack still requires exactly 5 distinct arc phases, byte-identical target label', () => {
    const bp = generatePack();
    const report = runFullAudit(bp.songs, { conceptLabel: CONCEPT, songCount: 18, audienceProfile: SENIOR_AUDIENCE_PROFILE });
    const arcItem = report.items.find(i => i.id === 'arc_phase_all_used')!;
    expect(arcItem.targetKo).toBe('5종 전부');
    expect(arcItem.labelKo).toBe('아크 5구간 사용');
  });
});
