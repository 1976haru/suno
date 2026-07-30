import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { hookSceneTimeOfDayWarning, scenePropContradictionWarning } from '../src/core/quality';
import { auditAlbum } from '../src/core/albumAudit';
import { buildClaudeCodeInstruction } from '../src/core/claudeCodeBridge';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

/**
 * TASK v3.60 (TASK E-1) — a real bridge-path pack paired listenerSituation
 * "sitting with morning coffee before the day begins" with hookPhrase "Stay
 * with Me Tonight" (track 1), and, on a second track, "drinking tea ... at
 * sunset" with "Catch the Morning Train" (track 8). Both fields are chosen
 * independently (batchPreallocation.ts's own separate pools), so nothing
 * ever compared them before this.
 */
describe('[v3.60 TASK E-1] hookSceneTimeOfDayWarning', () => {
  it('flags the real track 1 mismatch (morning scene, "Tonight" hook)', () => {
    const warning = hookSceneTimeOfDayWarning('Stay with Me Tonight', 'sitting with morning coffee before the day begins, watching first light move across the table');
    expect(warning).not.toBeNull();
    expect(warning).toContain('morning');
    expect(warning).toContain('night');
  });

  it('flags the real track 8 mismatch ("Morning Train" hook, sunset scene)', () => {
    const warning = hookSceneTimeOfDayWarning('Catch the Morning Train', 'drinking tea on the porch at sunset while neighbors close their gates one by one');
    expect(warning).not.toBeNull();
  });

  it('does not flag a hook/scene pair that share the same time-of-day family', () => {
    expect(hookSceneTimeOfDayWarning('Wake Up, My Dear', 'sitting with morning coffee before the day begins')).toBeNull();
    expect(hookSceneTimeOfDayWarning('Stay with Me Tonight', 'evening drive through familiar streets')).toBeNull();
  });

  it('does not flag a hook or scene with no explicit time-of-day word at all', () => {
    expect(hookSceneTimeOfDayWarning('Hold My Hand, Friend', 'walking slowly through a small garden with dew on the leaves')).toBeNull();
    expect(hookSceneTimeOfDayWarning('I Still Believe', 'making tea in a small kitchen while an old radio plays low')).toBeNull();
  });

  it('does not flag when either side is empty', () => {
    expect(hookSceneTimeOfDayWarning('', 'morning coffee')).toBeNull();
    expect(hookSceneTimeOfDayWarning('Stay with Me Tonight', '')).toBeNull();
  });
});

/**
 * TASK v3.60 (TASK E-2) — deliberately narrow: fires only when the scene
 * names exactly one side of a conflicting prop pair and the lyrics assert
 * only the other. The real measured 17-song pack never actually reproduced
 * this (coffee/tea always agreed between scene and lyrics); included as a
 * defensive check per the task's explicit request for the same class of
 * signal as the hook/scene time-of-day check above.
 */
describe('[v3.60 TASK E-2] scenePropContradictionWarning', () => {
  it('flags a scene that establishes coffee when the lyrics instead sing about tea', () => {
    const warning = scenePropContradictionWarning('sitting with morning coffee before the day begins', '[verse 1]\nSteam rises from the tea\n[chorus]\nHook\nHook\nHook');
    expect(warning).not.toBeNull();
    expect(warning).toContain('coffee');
    expect(warning).toContain('tea');
  });

  it('flags the reverse (scene establishes tea, lyrics sing about coffee)', () => {
    const warning = scenePropContradictionWarning('making tea in a small kitchen', '[verse 1]\nThe coffee cup sits cold\n[chorus]\nHook\nHook\nHook');
    expect(warning).not.toBeNull();
  });

  it('does not flag when the scene and lyrics agree on the same prop', () => {
    expect(scenePropContradictionWarning('sitting with morning coffee', '[verse 1]\nThe coffee steam still rises\n[chorus]\nHook\nHook\nHook')).toBeNull();
  });

  it('does not flag when the scene names neither prop', () => {
    expect(scenePropContradictionWarning('walking through a small garden', '[verse 1]\nThe tea grows cold\n[chorus]\nHook\nHook\nHook')).toBeNull();
  });

  it('does not flag when the lyrics mention neither prop', () => {
    expect(scenePropContradictionWarning('sitting with morning coffee', '[verse 1]\nThe light moves slow\n[chorus]\nHook\nHook\nHook')).toBeNull();
  });
});

function songWith(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Song 1',
    seasonMoment: 'x',
    listenerSituation: 'morning coffee before the day begins',
    emotionArc: 'x',
    hookPhrase: 'Stay with Me Tonight',
    stylePrompt: 'warm acoustic pop, I-V-vi-IV progression, repeats chorus 4x, soft vocal, mid tempo, 92 BPM',
    lyrics: '[verse 1]\nline a\nline b\n\n[chorus]\nHook 1\nHook 1\nHook 1\n\n[end]',
    warnings: [],
    qualityScore: 90,
    youtube: { title: 'Song 1', description: 'desc', tags: [] },
    ...overrides
  };
}

describe('[v3.60 TASK E] auditAlbum surfaces both checks at the pack level', () => {
  it('warns (never blocks) on a hook/scene time-of-day mismatch', () => {
    const report = auditAlbum([songWith()]);
    expect(report.passed).toBe(true);
    expect(report.warnings.some(w => w.includes('time-of-day mismatch'))).toBe(true);
  });

  it('warns on a scene/lyric prop contradiction', () => {
    const report = auditAlbum([songWith({
      listenerSituation: 'sitting with morning coffee before the day begins',
      hookPhrase: 'Wake Up, My Dear',
      lyrics: '[verse 1]\nSteam rises from the tea\n\n[chorus]\nHook 1\nHook 1\nHook 1\n\n[end]'
    })]);
    expect(report.passed).toBe(true);
    expect(report.warnings.some(w => w.includes('prop mismatch'))).toBe(true);
  });

  it('stays clean for a consistent hook/scene/lyric set', () => {
    const report = auditAlbum([songWith({
      hookPhrase: 'Wake Up, My Dear',
      lyrics: '[verse 1]\nThe coffee steam still rises\n\n[chorus]\nHook 1\nHook 1\nHook 1\n\n[end]'
    })]);
    expect(report.warnings.some(w => w.includes('time-of-day mismatch'))).toBe(false);
    expect(report.warnings.some(w => w.includes('prop mismatch'))).toBe(false);
  });
});

describe('[v3.60 TASK E] bridge instruction warns the agent about hook/scene time-of-day contradictions', () => {
  it('includes the prohibition and the real track 1 example', () => {
    const opts = makeOptions({ songCount: 3 });
    const slots = preallocateSongSlots(opts, testGenres, { usedTitles: [], usedHooks: [] });
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, { usedTitles: [], usedHooks: [] }, slots, false);
    expect(instruction).toContain('must not contradict that song\'s own "listenerSituation" on time of day');
    expect(instruction).toContain('Stay with Me Tonight');
  });
});

const realPackPath = path.resolve(__dirname, '..', 'songs-output.json');
const describeRealPack = existsSync(realPackPath) ? describe : describe.skip;

describeRealPack('[v3.60 TASK E] against the real bridge-path pack', () => {
  const data = existsSync(realPackPath) ? JSON.parse(readFileSync(realPackPath, 'utf-8')) : { songs: [] };

  it('flags exactly the 2 real hook/scene time-of-day mismatches (tracks 1 and 8)', () => {
    const flaggedTracks = data.songs
      .filter((song: SongIdea) => hookSceneTimeOfDayWarning(song.hookPhrase, song.listenerSituation))
      .map((song: SongIdea) => song.trackNo);
    expect(flaggedTracks).toEqual([1, 8]);
  });
});
