import { describe, expect, it } from 'vitest';
import { buildLyricThemePlan } from '../src/core/lyricDiversityPlan';
import { channelPresets } from '../src/data/presets';
import { kidsLyricThemes } from '../src/data/lyricThemes';
import type { GenerationOptions } from '../src/types';

/**
 * v5.8 (audit follow-up, docs/v58-report.md) — excluding moodTag:'energetic'
 * themes alone (data/lyricThemes.ts's lyricThemesForOptions) left a
 * "bedtime lullaby" pack dominated by mood-neutral routine/education
 * content, since within-frame round-robin gave every remaining theme equal
 * turns. `preferCalm` (core/lyricDiversityPlan.ts's allocateThemesByFrame)
 * sorts calm-tagged themes first within their frame and reserves that
 * frame's own larger preferred-frame share, so a calm-signaling channel's
 * real theme mix is now measurably calm-weighted, not just energetic-free.
 */
function planOptsFor(channelId: string, concept: string): GenerationOptions {
  const channel = channelPresets.find(c => c.id === channelId)!;
  return {
    channel,
    songCount: 18,
    diversityAllocations: [],
    perspective: 'firstPerson',
    customLyricThemeScene: undefined,
    lyricLanguage: channel.primaryLanguage,
    customConcept: concept
  } as GenerationOptions;
}

const moodById = new Map(kidsLyricThemes.map(t => [t.id, t.moodTag ?? 'neutral']));

describe('kids calm theme weighting', () => {
  it('a calm-signaling channel (bedtime-lullaby-radio) gets meaningfully more calm-tagged themes than energetic ones, across multiple seeds', () => {
    for (const seed of [1, 12345, 999999]) {
      const plan = buildLyricThemePlan(planOptsFor('bedtime-lullaby-radio', '자기 전 편안한 자장가'), seed);
      const calm = plan.filter(id => moodById.get(id) === 'calm').length;
      const energetic = plan.filter(id => moodById.get(id) === 'energetic').length;
      expect(energetic, `seed=${seed}`).toBe(0);
      expect(calm, `seed=${seed}`).toBeGreaterThanOrEqual(6);
    }
  });

  it('a non-calm-signaling channel (follow-along-action-song) is unaffected — still draws energetic themes normally', () => {
    const plan = buildLyricThemePlan(planOptsFor('follow-along-action-song', ''), 1);
    const energetic = plan.filter(id => moodById.get(id) === 'energetic').length;
    expect(energetic).toBeGreaterThan(0);
  });

  /**
   * v5.8 (audit follow-up) — jp-kids only had 2 moodTag:'calm' themes
   * (jpkids-pajama-change/jpkids-teeth-brushing) against kr-kids's own 4;
   * added 3 more (jpkids-lullaby-goodnight/naptime-blanket/calm-breathing,
   * mirroring kr-kids's own scene shapes) so oyasumi-mae-no-uta gets a
   * comparable calm-weighted mix.
   */
  it('jp-kids\' own calm-signaling channel (oyasumi-mae-no-uta) is weighted the same way, across multiple seeds', () => {
    for (const seed of [1, 12345, 999999]) {
      const plan = buildLyricThemePlan(planOptsFor('oyasumi-mae-no-uta', 'ねむる前のやさしい子守唄'), seed);
      const calm = plan.filter(id => moodById.get(id) === 'calm').length;
      const energetic = plan.filter(id => moodById.get(id) === 'energetic').length;
      expect(energetic, `seed=${seed}`).toBe(0);
      expect(calm, `seed=${seed}`).toBeGreaterThanOrEqual(6);
    }
  });

  it('jp-kids\' own non-calm-signaling channel (minna-de-taiso) is unaffected', () => {
    const plan = buildLyricThemePlan(planOptsFor('minna-de-taiso', ''), 1);
    const energetic = plan.filter(id => moodById.get(id) === 'energetic').length;
    expect(energetic).toBeGreaterThan(0);
  });
});
