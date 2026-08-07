import { describe, expect, it } from 'vitest';
import { buildClaudeCodeInstruction, resolveScenePlanningMode } from '../src/core/bridgeInstruction';
import { preallocateSongSlots } from '../src/core/batchPreallocation';
import { verbatimSceneCopyWarning } from '../src/core/lyricMetrics';
import { reconcileWithPreassignedSlot } from '../src/core/batchPreallocation';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { SongIdea } from '../src/types';

/**
 * codex 지시문 02 (TASK D) — real collision this covers: when a bridge
 * instruction includes BOTH conceptSceneInstructionLines (asks the agent to
 * invent its own concept-derived scenes — fires only when customConcept +
 * conceptSceneContext are both real) AND the fixed-pool lyricTheme scene
 * text (data/lyricThemes.ts, archetype-fixed, populated regardless of
 * customConcept — see core/batchPreallocation.ts's own `lyricTheme?.scene`
 * assignment), the OLD instruction told the agent the fixed-pool scene
 * "must" be depicted unconditionally — a second, contradictory scene
 * authority in the same document. See src/core/bridgeInstruction.ts's
 * resolveScenePlanningMode/lyricThemeInstructionLineFor/
 * lyricThemeSceneSection doc comments for the full fix.
 */
describe('[codex 지시문 02 TASK D] resolveScenePlanningMode', () => {
  it('is fixed-pool when there is no customConcept at all', () => {
    expect(resolveScenePlanningMode({ customConcept: undefined }, { recentSituations: [], recentLyricLines: [] })).toBe('fixed-pool');
    expect(resolveScenePlanningMode({ customConcept: '' }, { recentSituations: [], recentLyricLines: [] })).toBe('fixed-pool');
  });

  it('is fixed-pool when customConcept is set but no conceptSceneContext is provided (matches conceptSceneInstructionLines\' own guard)', () => {
    expect(resolveScenePlanningMode({ customConcept: '비 오는 밤 도시 드라이브' }, undefined)).toBe('fixed-pool');
  });

  it('is concept-generated only when BOTH a real customConcept AND a conceptSceneContext are present', () => {
    expect(resolveScenePlanningMode({ customConcept: '비 오는 밤 도시 드라이브' }, { recentSituations: [], recentLyricLines: [] })).toBe('concept-generated');
  });
});

describe('[codex 지시문 02 TASK D] bridge instruction — the two scene systems no longer contradict', () => {
  it('fixed-pool mode (no customConcept): the fixed-pool scene section still uses the pre-existing hard "must depict" mandate, unchanged', () => {
    const opts = makeOptions({ songCount: 4 });
    const slots = preallocateSongSlots(opts, testGenres, { usedTitles: [], usedHooks: [] });
    const instruction = buildClaudeCodeInstruction(opts, testGenres, testMoods, testSeason, { usedTitles: [], usedHooks: [] }, slots, false);
    if (slots.some(s => s.lyricThemeText)) {
      expect(instruction).toContain('the actual sung verses/chorus of that song must depict this specific scene');
      expect(instruction).toContain('[Lyric scenes] - write THIS scene into each track');
    }
  });

  it('concept-generated mode: the fixed-pool scene section is softened to an explicit fallback, and the agent is also asked to invent its own concept-derived scenes', () => {
    const opts = makeOptions({ songCount: 4, customConcept: '비 오는 밤 도시 드라이브' });
    const slots = preallocateSongSlots(opts, testGenres, { usedTitles: [], usedHooks: [] });
    const instruction = buildClaudeCodeInstruction(
      opts, testGenres, testMoods, testSeason, { usedTitles: [], usedHooks: [] }, slots, false, {},
      { recentSituations: [], recentLyricLines: [] }
    );
    // The concept-scene-generation system is active (real trigger: customConcept + conceptSceneContext).
    expect(instruction).toContain('이 세트의 장면');
    if (slots.some(s => s.lyricThemeText)) {
      // The fixed-pool scene is no longer phrased as a second hard mandate.
      expect(instruction).not.toContain('the actual sung verses/chorus of that song must depict this specific scene');
      expect(instruction).toContain('FALLBACK');
      expect(instruction).toContain('you already built this set\'s own concept-derived scenes');
    }
  });
});

describe('[codex 지시문 02 TASK D] verbatimSceneCopyWarning — the near-verbatim scene-copy detector', () => {
  const sceneText = 'sitting with morning coffee before the day begins, watching first light move across the table';

  it('flags lyrics that copy a real 6+ word run of the scene text verbatim', () => {
    const warning = verbatimSceneCopyWarning('[verse 1]\nsitting with morning coffee before the day begins\n\n[chorus]\nHook\n', sceneText, 3);
    expect(warning).toBeDefined();
    expect(warning).toContain('Track 3');
    expect(warning).toContain('near-verbatim');
  });

  it('does not flag lyrics that depict the same scene in genuinely different words', () => {
    const warning = verbatimSceneCopyWarning('[verse 1]\nThe kitchen smells of coffee as the sun climbs\n\n[chorus]\nHook\n', sceneText, 3);
    expect(warning).toBeUndefined();
  });

  it('does not flag a short natural overlap of just a couple of common words', () => {
    const warning = verbatimSceneCopyWarning('[verse 1]\nWe drink our morning coffee slow\n\n[chorus]\nHook\n', sceneText, 3);
    expect(warning).toBeUndefined();
  });

  it('is a no-op when there is no scene text at all (no slot / no lyricTheme)', () => {
    expect(verbatimSceneCopyWarning('anything here', undefined, 1)).toBeUndefined();
  });

  it('is case/punctuation-insensitive', () => {
    const warning = verbatimSceneCopyWarning('SITTING WITH MORNING COFFEE, before the day begins!!', sceneText, 1);
    expect(warning).toBeDefined();
  });
});

function songWith(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1,
    title: 'Song 1',
    seasonMoment: 'x',
    listenerSituation: 'x',
    emotionArc: 'x',
    hookPhrase: 'Hook',
    stylePrompt: 'warm acoustic pop, mid tempo, 92 BPM',
    lyrics: '[verse 1]\nline a\nline b\n\n[chorus]\nHook 1\nHook 1\nHook 1\n\n[end]',
    warnings: [],
    qualityScore: 90,
    youtube: { title: 'Song 1', description: 'desc', tags: [] },
    ...overrides
  };
}

describe('[codex 지시문 02 TASK D] reconcileWithPreassignedSlot wiring — real integration, not just the unit-level detector', () => {
  it('surfaces a scene-copy warning when a real slot has lyricThemeText and the song copies it verbatim', () => {
    const opts = makeOptions({ songCount: 4 });
    const slots = preallocateSongSlots(opts, testGenres, { usedTitles: [], usedHooks: [] });
    const slotWithScene = slots.find(s => s.lyricThemeText);
    if (!slotWithScene) return; // no themed slot in this fixture run — nothing to assert
    const song = songWith({
      trackNo: slotWithScene.trackNo,
      lyrics: `[verse 1]\n${slotWithScene.lyricThemeText}\n\n[chorus]\nHook 1\nHook 1\nHook 1\n\n[end]`
    });
    const fixed = reconcileWithPreassignedSlot(song, slotWithScene, 'ai-creative');
    expect(fixed.warnings.some(w => w.includes('near-verbatim'))).toBe(true);
  });

  it('stays clean when the same slot\'s song depicts the scene in original words', () => {
    const opts = makeOptions({ songCount: 4 });
    const slots = preallocateSongSlots(opts, testGenres, { usedTitles: [], usedHooks: [] });
    const slotWithScene = slots.find(s => s.lyricThemeText);
    if (!slotWithScene) return;
    const song = songWith({
      trackNo: slotWithScene.trackNo,
      lyrics: '[verse 1]\nAn ordinary line that never touches the theme text\n\n[chorus]\nHook 1\nHook 1\nHook 1\n\n[end]'
    });
    const fixed = reconcileWithPreassignedSlot(song, slotWithScene, 'ai-creative');
    expect(fixed.warnings.some(w => w.includes('near-verbatim'))).toBe(false);
  });
});
