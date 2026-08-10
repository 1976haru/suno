import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction, buildSetPlanHandoffSection } from '../src/core/claudeCodeBridge';
import { directSetLocal } from '../src/core/setDirector';
import { genreLibrary } from '../src/data/genreLibrary';
import { channelPresets, testMoods, testSeason } from './fixtures';

const seniorChannel = channelPresets.find(channel => channel.archetype === 'senior-morning')!;

function planFixture() {
  const plan = directSetLocal(
    '비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝',
    seniorChannel,
    18,
    { recentGenreIds: [], recentHooks: [] }
  );
  const genreIds = new Set(Object.keys(plan.allocations.find(item => item.axis === 'genre')!.counts));
  const genres = genreLibrary.filter(genre => genreIds.has(genre.id));
  return { plan, genres };
}

function maxGroupSize(line: string) {
  const groups = line.match(/[A-Z](?::|,)[0-9,]+|(?:sparse|medium|full) [A-Z]:[0-9,]+/g) || [];
  return Math.max(...groups.map(group => group.split(':')[1].split(',').filter(Boolean).length));
}

describe('[v3.63] SetPlan bridge handoff', () => {
  it('adds the fixed track plan and diversity groups as constraints', () => {
    const { plan, genres } = planFixture();
    const section = buildSetPlanHandoffSection(plan.slots, genres);

    expect(section).toContain('[SetPlan handoff]');
    expect(section).toContain("[This pack's 18-track plan]");
    expect(section).toContain('| Track | Genre | Era | BPM | Vocal | Structure | Intro | Scene frame | Role |');
    expect(section).toContain('[Diversity groups] - constraints, not wording to copy:');
    expect(section).toContain('introTexture ');
    expect(section).toContain('hookDevice ');
    expect(section).toContain('arrangementDensity ');
    expect(section).toContain('Choose the concrete musical wording yourself');
  });

  it('splits overlapping production axes into group constraints instead of verbatim phrases', () => {
    const { plan, genres } = planFixture();
    const section = buildSetPlanHandoffSection(plan.slots, genres);

    expect(section).not.toContain('warm string pad swell intro texture');
    expect(section).not.toContain('final repeat of the hook sung almost a cappella');
    expect(section).not.toContain('fuller arrangement with strings pad and layered backing');

    const introLine = section.split('\n').find(line => line.startsWith('introTexture '))!;
    const hookLine = section.split('\n').find(line => line.startsWith('hookDevice '))!;
    const densityLine = section.split('\n').find(line => line.startsWith('arrangementDensity '))!;
    expect(maxGroupSize(introLine)).toBeLessThanOrEqual(4);
    expect(maxGroupSize(hookLine)).toBeLessThanOrEqual(4);
    expect(maxGroupSize(densityLine)).toBeLessThanOrEqual(5);
  });

  it('[v3.64 TASK B] carries each track\'s introMode as plain-language guidance, not left for the agent to guess', () => {
    const { plan, genres } = planFixture();
    const section = buildSetPlanHandoffSection(plan.slots, genres);

    expect(section).toContain('instrumental (no lyric line under [intro])');
    expect(section).toContain('no [intro] tag at all — singing starts immediately');
    expect(section).toContain('short [intro] line allowed');
    expect(section.toLowerCase()).toContain('follow each track\'s "intro" column exactly');

    // Track 1 (cold-open) is always vocal-immediate.
    const track1Row = section.split('\n').find(line => line.startsWith('| 1 |'))!;
    expect(track1Row).toContain('no [intro] tag at all');
  });

  it('[v3.64 TASK A] carries each track\'s scene frame plus a whole-pack distribution line', () => {
    const { plan, genres } = planFixture();
    const section = buildSetPlanHandoffSection(plan.slots, genres);

    expect(section).toContain('Scene frames used in this pack:');
    const frameLabelsInDistribution = section.split('Scene frames used in this pack:')[1].split('\n')[0];
    const distinctFrameCount = frameLabelsInDistribution.split(';').length;
    expect(distinctFrameCount).toBeGreaterThanOrEqual(6);
    expect(section).not.toContain('Scene frames used in this pack: solitary reflection with an object (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18)');
  });

  it('is included in the one-shot Claude Code instruction before the JSON payload', () => {
    const { plan, genres } = planFixture();
    const opts = {
      channel: seniorChannel,
      projectTitle: 'Test Pack',
      songCount: 18,
      lyricLanguage: 'english' as const,
      market: seniorChannel.market,
      audience: seniorChannel.audience,
      genreIds: genres.map(genre => genre.id),
      moodIds: seniorChannel.preferredMoods,
      seasonId: 'spring-open',
      vocalTone: seniorChannel.defaultVocal,
      perspective: 'firstPerson' as const,
      lyricDepth: 'commercial' as const,
      durationTarget: 'under3m30' as const,
      moneyChordMode: 'default' as const,
      customMoneyChord: '',
      customConcept: '비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝',
      avoidWords: '',
      personaMode: false,
      diversityAllocations: plan.allocations
    };
    const instruction = buildClaudeCodeInstruction(opts, genres, testMoods, testSeason, { usedTitles: [], usedHooks: [] }, plan.slots, false);
    expect(instruction.indexOf('[SetPlan handoff]')).toBeGreaterThan(-1);
    expect(instruction.indexOf('[SetPlan handoff]')).toBeLessThan(instruction.indexOf('Request payload for this pack'));
  });

  it('[v3.63 재작성 TASK D] carries SetDirector\'s segment interpretation + listening context when passed via instructionOptions', () => {
    const plan = directSetLocal('카펜터스와 아바 느낌나는 노래 9곡씩 총 18곡 만들어줘', seniorChannel, 18, { recentGenreIds: [], recentHooks: [] });
    const genreIds = new Set(Object.keys(plan.allocations.find(item => item.axis === 'genre')!.counts));
    const genres = genreLibrary.filter(genre => genreIds.has(genre.id));
    const opts = {
      channel: seniorChannel,
      projectTitle: 'Segment Test Pack',
      songCount: 18,
      lyricLanguage: 'english' as const,
      market: seniorChannel.market,
      audience: seniorChannel.audience,
      genreIds: genres.map(genre => genre.id),
      moodIds: seniorChannel.preferredMoods,
      seasonId: 'spring-open',
      vocalTone: seniorChannel.defaultVocal,
      perspective: 'firstPerson' as const,
      lyricDepth: 'commercial' as const,
      durationTarget: 'under3m30' as const,
      moneyChordMode: 'default' as const,
      customMoneyChord: '',
      customConcept: '카펜터스와 아바 느낌나는 노래 9곡씩 총 18곡 만들어줘',
      avoidWords: '',
      personaMode: false,
      diversityAllocations: plan.allocations
    };
    const instruction = buildClaudeCodeInstruction(opts, genres, testMoods, testSeason, { usedTitles: [], usedHooks: [] }, plan.slots, false, {
      setDirectorInterpretation: { segments: plan.segments, listeningContext: plan.interpretation.listeningContext }
    });
    expect(instruction).toContain('[세그먼트 해석]');
    expect(instruction).toContain(plan.segments[0].label);
    expect(instruction).toContain(plan.segments[1].label);
    expect(instruction).toContain('그대로 쓸 필요 없습니다');
    // No artist name leaks into the instruction text via the segment section.
    expect(instruction.toLowerCase()).not.toMatch(/carpenter|abba/);
  });

  it('[v3.63 재작성 TASK D] omits the segment section entirely when setDirectorInterpretation is not passed (every pre-existing caller)', () => {
    const { plan, genres } = planFixture();
    const opts = {
      channel: seniorChannel,
      projectTitle: 'Test Pack',
      songCount: 18,
      lyricLanguage: 'english' as const,
      market: seniorChannel.market,
      audience: seniorChannel.audience,
      genreIds: genres.map(genre => genre.id),
      moodIds: seniorChannel.preferredMoods,
      seasonId: 'spring-open',
      vocalTone: seniorChannel.defaultVocal,
      perspective: 'firstPerson' as const,
      lyricDepth: 'commercial' as const,
      durationTarget: 'under3m30' as const,
      moneyChordMode: 'default' as const,
      customMoneyChord: '',
      customConcept: '비틀즈 느낌으로, 아침에 커피와 함께 듣고 싶은 올드팝',
      avoidWords: '',
      personaMode: false,
      diversityAllocations: plan.allocations
    };
    const instruction = buildClaudeCodeInstruction(opts, genres, testMoods, testSeason, { usedTitles: [], usedHooks: [] }, plan.slots, false);
    expect(instruction).not.toContain('[세그먼트 해석]');
  });
});

/**
 * 지시문 29 (TASK B-4) — "검사만 하면 늦다. 슬롯 배정에서 계절·시간을
 * 곡별로 배정한다." 컨셉이 "A to B" 진행을 명시하면 buildSetPlanHandoffSection이
 * 트랙 구간별 힌트를 브릿지 지시문에 직접 적어주는지 확인한다.
 */
describe('지시문 29 TASK B-4 — 세트 아크 힌트가 브릿지 지시문에 실린다', () => {
  const kr2030Channel = channelPresets.find(channel => channel.archetype === 'kr-2030-pop')!;

  function arcPlanFixture(customConcept: string) {
    const plan = directSetLocal(customConcept, kr2030Channel, 18, { recentGenreIds: [], recentHooks: [] });
    const genreIds = new Set(Object.keys(plan.allocations.find(item => item.axis === 'genre')!.counts));
    const genres = genreLibrary.filter(genre => genreIds.has(genre.id));
    return { plan, genres };
  }

  it('"Autumn to Christmas Playlist Pack" — 계절 진행 힌트와 구간별 트랙 배정이 실린다', () => {
    const { plan, genres } = arcPlanFixture('Autumn to Christmas Playlist Pack');
    const section = buildSetPlanHandoffSection(plan.slots, genres, 'fixed-pool', 'Autumn to Christmas Playlist Pack');
    expect(section).toContain('[Set arc —');
    expect(section).toContain('season progression from "autumn" to "christmas"');
    expect(section).toMatch(/Tracks 1-\d+: autumn/);
    expect(section).toMatch(/Tracks \d+-18: christmas/);
  });

  it('아크가 감지되지 않는 평범한 컨셉에는 [Set arc] 섹션이 없다', () => {
    const { plan, genres } = arcPlanFixture('퇴근 후 감성 인디팝');
    const section = buildSetPlanHandoffSection(plan.slots, genres, 'fixed-pool', '퇴근 후 감성 인디팝');
    expect(section).not.toContain('[Set arc —');
  });

  it('customConcept를 안 넘기면(기존 호출부) 여전히 섹션 없이 동작한다 — 하위 호환', () => {
    const { plan, genres } = arcPlanFixture('Autumn to Christmas Playlist Pack');
    const section = buildSetPlanHandoffSection(plan.slots, genres);
    expect(section).not.toContain('[Set arc —');
    expect(section).toContain('[SetPlan handoff]');
  });
});
