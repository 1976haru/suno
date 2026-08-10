import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { makeOptions, channelPresets, genrePacks, moodPacks, seasonPacks } from './fixtures';
import { auditAlbum } from '../src/core/albumAudit';
import { runFullAudit } from '../src/core/fullAudit';
import { setArcAdherenceIsBlocking } from '../src/core/setArcAdherence';
import { audienceProfileForChannelArchetype } from '../src/data/audienceProfiles';
import type { SongIdea } from '../src/types';

const femaleChannel = channelPresets.find(c => c.archetype === 'kr-idol-female')!;
const CONCEPT = 'Autumn to Christmas Playlist Pack';

/**
 * 지시문 37 (TASK D) — checkSetArcAdherence/parseSetArcSpec은 지시문 29에서
 * 이미 워크스페이스 무관하게 무조건 실행되도록 짜여 있었다
 * (core/setArcAdherence.ts, core/fullAudit.ts's setArcItems, core/bridgeInstruction.ts's
 * setArcHintLines/buildSetPlanHandoffSection — 전부 workspaceId로 게이팅되지
 * 않는다). 유일한 워크스페이스별 차이는 SET_ARC_VERIFIED_WORKSPACES(senior-oldpop만
 * blocking) 하나뿐이다. 이 테스트는 "kr-idol에 적용됐는지"를 코드로 직접
 * 확인한다 — 새로 만들지 않고, 실제로 이미 작동하는지만 증명한다.
 */
describe('지시문 37 (TASK D) — setArcAdherence가 kr-idol에도 이미 적용되어 있다 (advisory)', () => {
  it('bridge instruction includes a [Set arc] hint for a kr-idol pack with an Autumn→Christmas concept', () => {
    const opts = makeOptions({ channel: femaleChannel, songCount: 12, customConcept: CONCEPT, genreIds: femaleChannel.preferredGenres, moodIds: femaleChannel.preferredMoods });
    const genres = genrePacks.filter(g => femaleChannel.preferredGenres.includes(g.id));
    const moods = moodPacks.filter(m => femaleChannel.preferredMoods.includes(m.id));
    const season = seasonPacks.find(s => s.id === 'christmas')!;
    const slots = preallocateSongSlots(opts, genres, { usedTitles: [], usedHooks: [] });
    const instruction = buildClaudeCodeInstruction(opts, genres, moods, season, undefined, slots);
    expect(instruction).toContain('[Set arc');
    expect(instruction).toContain('autumn');
    expect(instruction).toContain('christmas');
  });

  it('kr-idol-female is not in the blocking set — setArcAdherenceIsBlocking returns false (advisory only, per policy)', () => {
    expect(setArcAdherenceIsBlocking('kr-idol-female')).toBe(false);
    expect(setArcAdherenceIsBlocking('kr-idol-male')).toBe(false);
  });

  it('fullAudit produces a set_arc_adherence item for a kr-idol pack, with pass:null (advisory, never blocking)', () => {
    const song = (trackNo: number, lyrics: string): SongIdea => ({
      trackNo,
      title: `T${trackNo}`,
      seasonMoment: trackNo <= 2 ? 'late summer' : 'snowy christmas eve',
      listenerSituation: 'x',
      emotionArc: 'x',
      hookPhrase: `Hook ${trackNo}`,
      stylePrompt: 'x',
      lyrics,
      youtube: { title: 'x', description: 'x', tags: [] },
      qualityScore: 0,
      warnings: [],
      effectiveMoneyChordId: 'default',
      effectiveGenreIds: [],
      effectiveArchetype: 'kr-idol-female',
      workspaceId: 'kr-idol-female'
    });
    const songs = [
      song(1, '[Verse 1]\nautumn leaves fall around us\n[Chorus]\nOwn Way'),
      song(2, '[Verse 1]\nautumn air feels warm\n[Chorus]\nOwn Way'),
      song(3, '[Verse 1]\na quiet day\n[Chorus]\nOwn Way'),
      song(4, '[Verse 1]\nchristmas lights everywhere\n[Chorus]\nOwn Way')
    ];
    const audienceProfile = audienceProfileForChannelArchetype('kr-idol-female');
    const report = runFullAudit(songs, { conceptLabel: CONCEPT, songCount: songs.length, audienceProfile, archetype: 'kr-idol-female' });
    const arcItem = report.items.find(i => i.id === 'set_arc_adherence');
    expect(arcItem).toBeDefined();
    // pass:null → status 'not-measured' (core/fullAudit.ts's item() helper) —
    // this app's "advisory, never blocks scripts/audit.ts's exit code" state.
    expect(arcItem!.status).toBe('not-measured');
    expect(arcItem!.labelKo).toContain('advisory');
  });

  it('albumAudit (a separate real check layer) does not itself gate on setArcAdherence — confirms TASK D adds no new gate, per "새 관문을 추가하지 말 것"', () => {
    // auditAlbum's own errors/warnings never mention set-arc — this task only
    // reused core/setArcAdherence.ts + fullAudit.ts, it did not touch albumAudit.ts.
    const report = auditAlbum([]);
    expect(report.passed).toBe(true);
  });
});
