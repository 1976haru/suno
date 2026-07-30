import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint } from '../src/core/localGenerator';
import { compactDuration } from '../src/core/soundSignature';
import { conceptStyleText } from '../src/core/conceptDiversity';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';

/**
 * TASK v3.59 (TASK D) — 3 internal style-prompt contradictions/duplications
 * found in real generated output.
 */
describe('[v3.59 TASK D-1] no instrumental intro + INTRO ONLY co-occurrence', () => {
  it('a cold-open track never carries both "no instrumental intro" and an "(INTRO ONLY)" texture atom', () => {
    // openingStyle isn't pinned, so this sweeps enough seeds/song counts to
    // hit both hook-forward and hum-intro cold-open resolutions.
    for (let songCount = 3; songCount <= 24; songCount += 3) {
      const bp = generateLocalBlueprint(makeOptions({ songCount, projectTitle: `D1 Pack ${songCount}` }), testGenres, testMoods, testSeason);
      const coldOpen = bp.songs.find(song => song.songRole === 'cold-open');
      if (!coldOpen) continue;
      const hasNoInstrumentalIntro = coldOpen.stylePrompt.includes('no instrumental intro');
      const hasIntroOnlyTexture = coldOpen.stylePrompt.includes('INTRO ONLY');
      expect(hasNoInstrumentalIntro && hasIntroOnlyTexture, coldOpen.stylePrompt).toBe(false);
    }
  });
});

describe('[v3.59 TASK D-2] no duplicate duration mention', () => {
  it('compactDuration\'s minimum-floor phrase never repeats the exact same time range as its base phrase', () => {
    const withFloor = compactDuration('under3m30', false, true);
    const rangeMatches = withFloor.match(/\d:\d{2}-\d:\d{2}/g) || [];
    const distinctRanges = new Set(rangeMatches);
    expect(rangeMatches.length, withFloor).toBe(distinctRanges.size);
  });

  it('a real generated pack never has the same "H:MM-H:MM" range appear twice in one style prompt', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 6 }), testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      const rangeMatches = song.stylePrompt.match(/\d:\d{2}-\d:\d{2}/g) || [];
      const distinctRanges = new Set(rangeMatches);
      expect(rangeMatches.length, song.stylePrompt).toBe(distinctRanges.size);
    }
  });
});

describe('[v3.59 TASK D-3] no "concept cue:" style label', () => {
  it('conceptStyleText never emits the concept cue:/concept emphasis:/arrangement focus: labels', () => {
    const text = conceptStyleText('a quiet train ride home after the rain', 0);
    expect(text).toBeDefined();
    expect(text).not.toContain('concept cue:');
    expect(text).not.toContain('concept emphasis:');
    expect(text).not.toContain('arrangement focus:');
  });

  it('a real generated pack never has "concept cue:" in any style prompt', () => {
    const opts = makeOptions({ songCount: 18, customConcept: 'a quiet train ride home after the rain' });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    for (const song of bp.songs) {
      expect(song.stylePrompt).not.toContain('concept cue:');
      expect(song.stylePrompt).not.toContain('concept emphasis:');
      expect(song.stylePrompt).not.toContain('arrangement focus:');
    }
  });
});
