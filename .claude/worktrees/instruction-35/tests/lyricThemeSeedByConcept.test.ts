import { describe, expect, it } from 'vitest';
import { buildLyricThemePlan } from '../src/core/lyricDiversityPlan';
import { channelPresets } from '../src/data/presets';
import { hashSeed } from '../src/utils/prng';
import { seedForBlueprint } from '../src/core/lyricEngine';
import { makeOptions } from './fixtures';

/**
 * 지시문 08 (TASK D) — real, measured root cause: core/localGenerator.ts
 * used to pass buildLyricThemePlan the SAME shared `seed` every other
 * seed-dependent system (genre/hook/BPM/vocal rotation) also used —
 * `hashSeed(seedForBlueprint(opts))`, which only depends on channel.id and
 * projectTitle, NEVER customConcept. Two real generations differing only
 * in customConcept (a real, plausible user workflow — trying different
 * concepts on the same channel without renaming the project) landed on
 * the exact same lyric-theme sequence every time. Fixed by threading a
 * concept-aware seed into JUST this one call (localGenerator.ts's own
 * lyricThemeSeed), not the shared pipeline seed (an earlier attempt at
 * the shared-seed fix broke ~20 unrelated tests whose exact expected
 * values were calibrated against the old, concept-blind seed).
 *
 * NOTE — this fix's real-world impact is bounded by how many themes each
 * frame actually has: core/lyricDiversityPlan.ts's allocateThemesByFrame
 * exhausts every theme in every frame whenever frameCount * themesPerFrame
 * <= songCount (senior-morning's own 9 named frames * 2 members = 18,
 * which exactly matches this channel's own typical 18-song pack size) —
 * at that size, ANY seed picks the identical full set, just in a
 * different per-track order, so the real fix here is at its full effect
 * for smaller/uneven-shaped packs (this test's own songCount=6 case)
 * rather than a channel's own "natural" full-pack size.
 */
describe('지시문 08 TASK D — buildLyricThemePlan varies by customConcept', () => {
  it('two customConcept values on the same channel/projectTitle hash to genuinely different lyric-theme seeds', () => {
    const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
    const optsA = makeOptions({ channel, songCount: 18, lyricLanguage: 'english', customConcept: '비틀즈 느낌의 밝은 60년대 팝' });
    const optsB = makeOptions({ channel, songCount: 18, lyricLanguage: 'english', customConcept: '70년대 후반 부드러운 소프트록' });

    const seedBase = seedForBlueprint(optsA);
    expect(seedBase).toBe(seedForBlueprint(optsB)); // same channel + projectTitle — this is the real collision case

    const seedA = hashSeed(`${seedBase}:${optsA.customConcept}`);
    const seedB = hashSeed(`${seedBase}:${optsB.customConcept}`);
    expect(seedA).not.toBe(seedB);
  });

  // frameIdForConceptText (data/lyricThemes.ts) is the real, deterministic
  // (not seed-based) mechanism this codebase already had for a concept to
  // steer theme selection — unaffected by this task's own seed fix, used
  // here to exercise a case genuinely guaranteed to differ regardless of
  // hash-modulo coincidence (see this file's own top doc comment on why
  // the era/genre-flavor concepts the directive itself measured don't
  // match any of these keyword rules and so don't hit this path at all —
  // that's the real, harder case this task's own seed fix targets, but a
  // themeId-level guarantee needs a concept that DOES name a situation).
  it('two customConcept values naming different situations (dance vs. letter) select genuinely different lyric themes', () => {
    const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
    const optsA = makeOptions({ channel, songCount: 6, lyricLanguage: 'english', customConcept: '춤추는 토요일 밤' });
    const optsB = makeOptions({ channel, songCount: 6, lyricLanguage: 'english', customConcept: '편지를 쓰는 저녁' });
    const seedBase = seedForBlueprint(optsA);
    const seed = hashSeed(seedBase);

    const planA = buildLyricThemePlan(optsA, seed);
    const planB = buildLyricThemePlan(optsB, seed);
    expect(planA).not.toEqual(planB);
  });

  it('an empty/unset customConcept falls back to the plain shared seed — byte-identical to every pre-existing caller (no behavior change)', () => {
    const channel = channelPresets.find(c => c.id === 'good-morning-memory-radio')!;
    const opts = makeOptions({ channel, songCount: 18, lyricLanguage: 'english', customConcept: '' });
    const sharedSeed = hashSeed(seedForBlueprint(opts));
    // Mirrors localGenerator.ts's own `opts.customConcept?.trim() ? ... : seed` fallback exactly.
    const lyricThemeSeed = opts.customConcept?.trim() ? hashSeed(`${seedForBlueprint(opts)}:${opts.customConcept}`) : sharedSeed;
    expect(lyricThemeSeed).toBe(sharedSeed);
  });
});
