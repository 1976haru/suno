import { describe, expect, it } from 'vitest';
import { runFullAudit } from '../src/core/fullAudit';
import { directSetLocal } from '../src/core/setDirector';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { getGenreById } from '../src/data/genreLibrary';
import { channelPresets } from './fixtures';
import { SENIOR_AUDIENCE_PROFILE } from '../src/data/audienceProfiles';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;
const CONCEPT = '비틀즈 느낌의 밝은 60년대 팝';

function generatePack() {
  const plan = directSetLocal(CONCEPT, seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
  const genreAllocation = plan.allocations.find(a => a.axis === 'genre')!;
  const genreIds = Object.keys(genreAllocation.counts);
  const genres = genreIds.map(id => getGenreById(id)!).filter(Boolean);
  const opts = {
    channel: seniorChannel,
    projectTitle: CONCEPT,
    songCount: 18,
    lyricLanguage: 'english' as const,
    market: seniorChannel.market,
    audience: seniorChannel.audience,
    genreIds,
    moodIds: seniorChannel.preferredMoods,
    seasonId: 'spring-open',
    vocalTone: seniorChannel.defaultVocal,
    perspective: 'firstPerson' as const,
    lyricDepth: 'commercial' as const,
    durationTarget: 'under3m30' as const,
    moneyChordMode: 'default' as const,
    customMoneyChord: '',
    customConcept: CONCEPT,
    avoidWords: '',
    personaMode: false,
    diversityAllocations: plan.allocations
  };
  return generateLocalBlueprint(opts, genres, [], { id: 'spring-open', label: 'Spring', period: '', keywords: [], visualDirection: '' } as any);
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
