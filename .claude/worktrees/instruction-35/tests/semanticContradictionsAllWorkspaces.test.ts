import { describe, expect, it } from 'vitest';
import { sceneSeasonContradictionWarning } from '../src/core/semanticContradiction';
import { hookSceneTimeOfDayWarning, scenePropContradictionWarning } from '../src/core/quality';
import { scoreComposition } from '../src/core/compositionScorer';
import type { SongIdea } from '../src/types';

/**
 * codex 지시문 03 (TASK H) — real gap this closes: core/quality.ts already
 * had hookSceneTimeOfDayWarning (time-of-day) and scenePropContradictionWarning
 * (a single coffee/tea prop pair) — this adds the season/weather axis this
 * task's own spec names with zero prior coverage, using the identical
 * narrow "unambiguous family" architecture (see src/core/semanticContradiction.ts's
 * own doc comment for the full scoping decision on the task's other named
 * examples — K-pop gender/duet is mostly already covered by
 * core/compositionScorer.ts, verified directly below; 2030 relationship/
 * time-continuity and kids narrative-outcome checks are explicitly left
 * undone given zero existing precedent and real false-positive risk).
 */
describe('[codex 지시문 03 TASK H] sceneSeasonContradictionWarning — new common axis', () => {
  it('flags a real winter scene paired with summer lyrics', () => {
    const warning = sceneSeasonContradictionWarning('walking through the winter snow', 'the summer sunshine warms my skin');
    expect(warning).toBeDefined();
    expect(warning).toContain('winter');
    expect(warning).toContain('summer');
  });

  it('flags the reverse: summer scene, winter lyrics', () => {
    const warning = sceneSeasonContradictionWarning('a sweltering summer afternoon', 'snowfall covers the frozen ground');
    expect(warning).toBeDefined();
  });

  it('does not flag when scene and lyrics agree on the same season', () => {
    expect(sceneSeasonContradictionWarning('walking through the winter snow', 'the frost outside the window')).toBeNull();
  });

  it('does not flag when neither scene nor lyrics name a season at all', () => {
    expect(sceneSeasonContradictionWarning('sitting quietly with a friend', 'we talk about nothing in particular')).toBeNull();
  });

  it('does not flag when only one side names a season', () => {
    expect(sceneSeasonContradictionWarning('walking through the winter snow', 'we talk about nothing in particular')).toBeNull();
  });
});

describe('[codex 지시문 03 TASK H] existing common-axis checks (time-of-day, prop) still work — real regression lock, not re-implemented', () => {
  it('hookSceneTimeOfDayWarning still fires on a real mismatch', () => {
    expect(hookSceneTimeOfDayWarning('Stay with Me Tonight', 'sitting with morning coffee before the day begins')).not.toBeNull();
  });

  it('scenePropContradictionWarning still fires on a real coffee/tea mismatch', () => {
    expect(scenePropContradictionWarning('sitting with morning coffee', '[verse 1]\nSteam rises from the tea')).not.toBeNull();
  });
});

function songWith(overrides: Partial<SongIdea> = {}): SongIdea {
  return {
    trackNo: 1, title: 'Song 1', seasonMoment: 'x', listenerSituation: 'x', emotionArc: 'x', hookPhrase: 'Hook',
    stylePrompt: 'warm acoustic pop, mid tempo, 92 BPM', lyrics: '[verse 1]\nline a\n\n[chorus]\nHook 1\nHook 1\nHook 1\n\n[end]',
    warnings: [], qualityScore: 90, youtube: { title: 'Song 1', description: 'desc', tags: [] },
    ...overrides
  };
}

describe('[codex 지시문 03 TASK H] K-pop gender/duet contradictions — verifying the "already covered" investigation finding directly', () => {
  const kpopOpts = { vocalQuotaOverride: { male: 18, female: 0, mixed: 0 } };

  it('flags a solo male-quota track whose lyrics leak group/duet phrasing (covers "solo song with group chant as the core hook" / "non-duet with alternating parts")', () => {
    const song = songWith({ vocalType: 'male', lyrics: '[verse 1]\nmale and female call and response\nHook 1' });
    const result = scoreComposition([song], kpopOpts);
    expect(result.tracks[0].blocking.some(b => b.includes('듀엣/그룹 보컬 표현'))).toBe(true);
  });

  it('flags a solo male-quota track with an opposite-gender vocal meta-tag in the lyrics (covers "female-only part tag on a male group")', () => {
    const song = songWith({ vocalType: 'male', lyrics: '[verse 1: female vocal]\nline a\n\n[chorus]\nHook 1' });
    const result = scoreComposition([song], kpopOpts);
    expect(result.tracks[0].blocking.some(b => b.includes('보컬 메타 태그'))).toBe(true);
  });

  it('does not flag a real, clean solo male-quota track', () => {
    const song = songWith({ vocalType: 'male', stylePrompt: 'warm male baritone lead vocal, acoustic guitar, 92 BPM' });
    const result = scoreComposition([song], kpopOpts);
    expect(result.tracks[0].blocking.some(b => b.includes('보컬') || b.includes('듀엣'))).toBe(false);
  });

  it('never flags a real mixed-quota track for the same content (duet/group phrasing is legitimate there)', () => {
    const song = songWith({ vocalType: 'mixed', lyrics: '[verse 1]\nmale and female call and response\nHook 1' });
    const result = scoreComposition([song], { vocalQuotaOverride: { male: 0, female: 0, mixed: 18 } });
    expect(result.tracks[0].blocking.some(b => b.includes('듀엣/그룹 보컬 표현'))).toBe(false);
  });
});
