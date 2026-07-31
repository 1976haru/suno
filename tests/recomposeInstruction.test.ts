import { describe, expect, it } from 'vitest';
import { buildRecomposeInstruction } from '../src/core/claudeCodeBridge';
import type { SongIdea } from '../src/types';

function stubSong(overrides: Partial<SongIdea> & { trackNo: number }): SongIdea {
  return {
    title: `Song ${overrides.trackNo}`,
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: `Hook ${overrides.trackNo}`,
    stylePrompt: 'style prompt text',
    lyrics: '[verse 1]\nline\n[end]',
    youtube: { title: 'x', description: 'x', tags: ['x'] },
    qualityScore: 90,
    warnings: [],
    ...overrides
  };
}

describe('[v3.62 TASK 3] buildRecomposeInstruction — bridge-path scoped recomposition instruction', () => {
  it('lists only the given blocking tracks, not a whole-pack instruction', () => {
    const instruction = buildRecomposeInstruction([
      { song: stubSong({ trackNo: 3, title: 'Rainy Window', genreText: 'city pop' }), blocking: ['style prompt 서술어가 12개입니다 (허용 20-40개)'] }
    ]);
    expect(instruction).toContain('Track 3');
    expect(instruction).toContain('Rainy Window');
    expect(instruction).toContain('city pop');
    expect(instruction).toContain('12개입니다');
    expect(instruction).not.toContain('Track 1');
    expect(instruction).not.toContain('18');
  });

  it('includes every listed track and its own specific failure reasons, in order', () => {
    const instruction = buildRecomposeInstruction([
      { song: stubSong({ trackNo: 1, title: 'A' }), blocking: ['reason-A1', 'reason-A2'] },
      { song: stubSong({ trackNo: 5, title: 'B' }), blocking: ['reason-B1'] }
    ]);
    const track1Index = instruction.indexOf('Track 1');
    const track5Index = instruction.indexOf('Track 5');
    expect(track1Index).toBeGreaterThanOrEqual(0);
    expect(track5Index).toBeGreaterThan(track1Index);
    expect(instruction).toContain('reason-A1');
    expect(instruction).toContain('reason-A2');
    expect(instruction).toContain('reason-B1');
  });

  it('tells the agent to rewrite only the listed tracks and preserve trackNo/title/hookPhrase', () => {
    const instruction = buildRecomposeInstruction([
      { song: stubSong({ trackNo: 1 }), blocking: ['x'] }
    ]);
    expect(instruction.toLowerCase()).toContain('do not touch any other track');
    expect(instruction).toContain('trackNo');
  });

  it('an empty blocking list produces an instruction that says zero tracks, not an error', () => {
    const instruction = buildRecomposeInstruction([]);
    expect(instruction).toContain('0 track');
  });
});
