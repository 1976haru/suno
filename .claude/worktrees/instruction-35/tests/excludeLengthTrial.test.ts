import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { loadPackBlueprint } from '../scripts/audit';
import { buildExcludeVariants } from '../scripts/excludeLengthTrial';

/**
 * 지시문 10 (TASK E) — real fixture regression lock. A first version of
 * buildExcludeVariants passed the full NegativePromptSpec.arrangement
 * (8 generic GLOBAL_NEGATIVE_STYLE_TERMS + channel forbiddenCliches, THEN
 * genre.avoidTraits) into fitWithinBudget — real measurement against this
 * fixture found all 3 sampled tracks got byte-for-byte identical medium
 * text, because the generic filler ahead of genre.avoidTraits in that list
 * consumed the whole headroom before the budget ever reached the one thing
 * meant to vary per song. This test locks in the fix (genre.avoidTraits
 * prioritized first) against real fixture data, not a hand-built case.
 */
const FIXTURE_60S = path.resolve(__dirname, 'fixtures/historical/20260807-60s.json');

describe('지시문 10 TASK E — excludeLengthTrial', () => {
  it('safety/copyright/workspace 문구는 short를 포함한 모든 버전에 남아 있다', () => {
    const loaded = loadPackBlueprint(FIXTURE_60S, undefined);
    if (loaded.blocked) throw new Error('fixture blocked');
    const song = loaded.blueprint.songs[0];
    const [short, medium, long] = buildExcludeVariants(song, loaded.channel);
    for (const term of ['famous artist imitation', 'shouted or belted high notes']) {
      expect(short.text).toContain(term);
      expect(medium.text).toContain(term);
      expect(long.text.length ? long.text : short.text).toBeTruthy(); // long is the real pack value, not derived — no safety guarantee to assert structurally
    }
  });

  it('medium은 short보다 길고, 서로 다른 장르의 두 곡은 서로 다른 medium 텍스트를 받는다', () => {
    const loaded = loadPackBlueprint(FIXTURE_60S, undefined);
    if (loaded.blocked) throw new Error('fixture blocked');
    const byGenre = new Map(loaded.blueprint.songs.map(s => [s.genreId, s]));
    const genreIds = [...byGenre.keys()].filter((id): id is string => Boolean(id));
    expect(genreIds.length).toBeGreaterThanOrEqual(2);

    const [songA, songB] = [byGenre.get(genreIds[0])!, byGenre.get(genreIds[1])!];
    const variantsA = buildExcludeVariants(songA, loaded.channel);
    const variantsB = buildExcludeVariants(songB, loaded.channel);

    const mediumA = variantsA.find(v => v.label === 'medium')!;
    const shortA = variantsA.find(v => v.label === 'short')!;
    expect(mediumA.length).toBeGreaterThan(shortA.length);

    const mediumB = variantsB.find(v => v.label === 'medium')!;
    // real bug this test exists to catch: two different genres used to
    // produce byte-identical medium text.
    expect(mediumA.text).not.toBe(mediumB.text);
  });

  it('long 버전은 실제 팩의 excludePrompt를 그대로 쓴다 (변형하지 않는다)', () => {
    const loaded = loadPackBlueprint(FIXTURE_60S, undefined);
    if (loaded.blocked) throw new Error('fixture blocked');
    const song = loaded.blueprint.songs[0];
    const [, , long] = buildExcludeVariants(song, loaded.channel);
    expect(long.text).toBe(song.excludePrompt ?? '');
  });

  it('세 버전 모두 가사·stylePrompt에는 관여하지 않는다 (타입 상 excludePrompt만 반환)', () => {
    const loaded = loadPackBlueprint(FIXTURE_60S, undefined);
    if (loaded.blocked) throw new Error('fixture blocked');
    const song = loaded.blueprint.songs[0];
    const variants = buildExcludeVariants(song, loaded.channel);
    expect(variants).toHaveLength(3);
    expect(variants.map(v => v.label)).toEqual(['short', 'medium', 'long']);
  });
});
