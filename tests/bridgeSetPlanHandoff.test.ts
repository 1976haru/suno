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
    expect(section).toContain('| Track | Genre | Era | BPM | Vocal | Structure | Intro | Role |');
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
});
