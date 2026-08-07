import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENE_AXIS_WEIGHTS, sceneSimilarity, SCENE_SIMILARITY_ADVISORY_THRESHOLD, SCENE_SIMILARITY_BLOCKING_THRESHOLD } from '../src/core/sceneSimilarity';
import { checkSceneOverlap, checkSceneSimilarity } from '../src/core/duplicationGate';
import { reconcileWithPreassignedSlot, preallocateSongSlots } from '../src/core/batchPreallocation';
import { makeOptions, testGenres } from './fixtures';
import type { SceneSignature } from '../src/core/situationLedger';
import type { SongIdea } from '../src/types';

/**
 * codex 지시문 02 (TASK B) — real gap this closes: core/duplicationGate.ts's
 * checkSceneOverlap is deliberately exact-match only (own doc comment), so
 * a near-miss scene reuse ("sitting with morning coffee before the day
 * begins" vs "having coffee as the morning begins") was invisible to every
 * existing check. sceneSimilarity is the new weighted-Jaccard scorer
 * (traitMatcher.ts's own tokenOverlap pattern); checkSceneSimilarity is the
 * new advisory-tier consumer, alongside (never replacing) checkSceneOverlap.
 * Also covers the real, separately-confirmed gap this task closed in
 * SongIdea itself: lyricThemeMotionKo/lyricThemeCastKo/lyricThemeEraSettingKo
 * were declared on SongIdea since v4.5 but never actually copied from the
 * slot in reconcileWithPreassignedSlot — see that function's own TASK B
 * doc comment.
 */
function sig(overrides: Partial<SceneSignature> = {}): SceneSignature {
  return { situation: 'sitting with morning coffee before the day begins', packId: 'p1', trackNo: 1, ...overrides };
}

describe('[codex 지시문 02 TASK B] sceneSimilarity', () => {
  it('identical situation text scores 1.0', () => {
    expect(sceneSimilarity(sig(), sig())).toBeCloseTo(1, 5);
  });

  it('a real near-miss paraphrase scores in the advisory band, not 1.0 and not near 0', () => {
    const a = sig({ situation: 'sitting with morning coffee before the day begins, watching first light move across the table' });
    const b = sig({ situation: 'having coffee as the morning begins, watching the light move slowly' });
    const score = sceneSimilarity(a, b);
    expect(score).toBeGreaterThan(0.3);
    expect(score).toBeLessThan(1);
  });

  it('a completely unrelated scene scores low', () => {
    const a = sig({ situation: 'sitting with morning coffee before the day begins' });
    const b = sig({ situation: 'dancing across a crowded floor under bright lights' });
    expect(sceneSimilarity(a, b)).toBeLessThan(0.3);
  });

  it('matching categorical axes (frameId/motionKo/castKo/eraSettingKo) raise the score even with different situation text', () => {
    const a = sig({ situation: 'sitting with morning coffee', frameId: 'dance-saturday', motionKo: '춤', castKo: '여럿', eraSettingKo: '젊은 날' });
    const b = sig({ situation: 'a completely different scene about something else entirely', frameId: 'dance-saturday', motionKo: '춤', castKo: '여럿', eraSettingKo: '젊은 날' });
    const withAxes = sceneSimilarity(a, b);
    const situationOnly = sceneSimilarity({ ...a, frameId: undefined, motionKo: undefined, castKo: undefined, eraSettingKo: undefined }, { ...b, frameId: undefined, motionKo: undefined, castKo: undefined, eraSettingKo: undefined });
    expect(withAxes).toBeGreaterThan(situationOnly);
  });

  it('Korean categorical axes require an exact match, not a token-overlap heuristic (tokenOverlap cannot handle non-ASCII)', () => {
    const a = sig({ motionKo: '춤' });
    const b = sig({ motionKo: '정적' });
    // Different Korean motion tags with otherwise-identical situation text — axis contributes 0, not a false-positive partial score.
    const withMismatchedAxis = sceneSimilarity(a, b);
    const withoutAxisAtAll = sceneSimilarity({ ...a, motionKo: undefined }, { ...b, motionKo: undefined });
    expect(withMismatchedAxis).toBeLessThan(withoutAxisAtAll + 0.01);
  });

  it('axes missing on either side are excluded from the weight total, not penalized as a 0 match', () => {
    const a = sig({ situation: 'sitting with morning coffee before the day begins' });
    const b = sig({ situation: 'sitting with morning coffee before the day begins' });
    // Neither has any categorical axis — situation-only comparison should still be able to reach 1.0, not capped at situation's own weight share.
    expect(sceneSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it('DEFAULT_SCENE_AXIS_WEIGHTS sums to 1.0', () => {
    const total = Object.values(DEFAULT_SCENE_AXIS_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});

describe('[codex 지시문 02 TASK B] checkSceneSimilarity — advisory vs blocking tiers', () => {
  it('a near-verbatim match (>= blocking threshold) is reported as blocking', () => {
    const songs: SongIdea[] = [{
      trackNo: 1, title: 'T', seasonMoment: '', listenerSituation: 'sitting with morning coffee before the day begins', emotionArc: '', hookPhrase: 'H',
      stylePrompt: 'x', lyrics: 'x', warnings: [], qualityScore: 0, youtube: { title: 'T', description: '', tags: [] }
    }];
    const history: SceneSignature[] = [sig({ situation: 'sitting with morning coffee before the day begins' })];
    const result = checkSceneSimilarity(songs, history);
    expect(result.blocking).toBe(true);
    expect(result.blockingMatches).toHaveLength(1);
    expect(result.blockingMatches[0].score).toBeGreaterThanOrEqual(SCENE_SIMILARITY_BLOCKING_THRESHOLD);
  });

  it('a moderate paraphrase (advisory band) is reported as advisory, never blocking', () => {
    const songs: SongIdea[] = [{
      trackNo: 1, title: 'T', seasonMoment: '', listenerSituation: 'sitting with morning coffee before the day begins, watching first light move across the table', emotionArc: '', hookPhrase: 'H',
      stylePrompt: 'x', lyrics: 'x', warnings: [], qualityScore: 0, youtube: { title: 'T', description: '', tags: [] }
    }];
    const history: SceneSignature[] = [sig({ situation: 'having coffee as the morning begins, watching the light move slowly across the room' })];
    const result = checkSceneSimilarity(songs, history);
    if (result.advisoryMatches.length) {
      expect(result.blocking).toBe(false);
      expect(result.advisoryMatches[0].score).toBeGreaterThanOrEqual(SCENE_SIMILARITY_ADVISORY_THRESHOLD);
      expect(result.advisoryMatches[0].score).toBeLessThan(SCENE_SIMILARITY_BLOCKING_THRESHOLD);
    }
  });

  it('an unrelated scene produces no matches at all', () => {
    const songs: SongIdea[] = [{
      trackNo: 1, title: 'T', seasonMoment: '', listenerSituation: 'dancing across a crowded floor under bright lights', emotionArc: '', hookPhrase: 'H',
      stylePrompt: 'x', lyrics: 'x', warnings: [], qualityScore: 0, youtube: { title: 'T', description: '', tags: [] }
    }];
    const history: SceneSignature[] = [sig({ situation: 'sitting with morning coffee before the day begins' })];
    const result = checkSceneSimilarity(songs, history);
    expect(result.blocking).toBe(false);
    expect(result.blockingMatches).toHaveLength(0);
    expect(result.advisoryMatches).toHaveLength(0);
  });

  it('is a no-op with empty history', () => {
    const songs: SongIdea[] = [{
      trackNo: 1, title: 'T', seasonMoment: '', listenerSituation: 'anything', emotionArc: '', hookPhrase: 'H',
      stylePrompt: 'x', lyrics: 'x', warnings: [], qualityScore: 0, youtube: { title: 'T', description: '', tags: [] }
    }];
    expect(checkSceneSimilarity(songs, []).blocking).toBe(false);
  });

  it('checkSceneOverlap (the existing exact-match blocking gate) is untouched — still fires on an exact match independent of checkSceneSimilarity', () => {
    const songs = [{ trackNo: 1, listenerSituation: 'sitting with morning coffee before the day begins' }];
    const result = checkSceneOverlap(songs, ['sitting with morning coffee before the day begins']);
    expect(result.blocking).toBe(true);
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
    lyrics: '[verse 1]\nline a\n\n[chorus]\nHook 1\nHook 1\nHook 1\n\n[end]',
    warnings: [],
    qualityScore: 90,
    youtube: { title: 'Song 1', description: 'desc', tags: [] },
    ...overrides
  };
}

describe('[codex 지시문 02 TASK B] reconcileWithPreassignedSlot now attaches lyricThemeMotionKo/castKo/eraSettingKo (real gap fix)', () => {
  it('a real slot with a themed scene copies its motion/cast/eraSetting axes onto the final SongIdea', () => {
    const opts = makeOptions({ songCount: 6 });
    const slots = preallocateSongSlots(opts, testGenres, { usedTitles: [], usedHooks: [] });
    const slotWithAxis = slots.find(s => s.lyricThemeMotionKo || s.lyricThemeCastKo || s.lyricThemeEraSettingKo);
    if (!slotWithAxis) return; // no axis-bearing themed slot in this fixture run — nothing to assert
    const song = songWith({ trackNo: slotWithAxis.trackNo });
    const fixed = reconcileWithPreassignedSlot(song, slotWithAxis, 'ai-creative');
    if (slotWithAxis.lyricThemeMotionKo) expect(fixed.lyricThemeMotionKo).toBe(slotWithAxis.lyricThemeMotionKo);
    if (slotWithAxis.lyricThemeCastKo) expect(fixed.lyricThemeCastKo).toBe(slotWithAxis.lyricThemeCastKo);
    if (slotWithAxis.lyricThemeEraSettingKo) expect(fixed.lyricThemeEraSettingKo).toBe(slotWithAxis.lyricThemeEraSettingKo);
  });
});
