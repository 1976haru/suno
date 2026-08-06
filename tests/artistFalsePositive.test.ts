import { describe, expect, it } from 'vitest';
import { ARTIST_REFERENCE_SEEDS } from '../src/data/artistReferenceSeeds';
import { findArtistReferenceLeaks } from '../src/core/artistReferenceDecomposer';

/**
 * TASK v5.19 (P0 emergency fix + TASK B) — real incident: a normal 18-song
 * import got hard-blocked because a lyric said "breaking bread at the
 * table" and the `bread` seed's aliasPattern matched the food word, not the
 * band. Every seed whose English spelling collides with an ordinary word
 * (commonWordRisk !== 'none') must add a safe sentence here — this is the
 * regression guard §3-4 of the task doc asks for, so the next seed added
 * with a common-word collision has to prove it doesn't repeat this bug.
 */
describe('[v5.19] artist reference false positives — ordinary words in title/lyrics scope', () => {
  const SAFE_LYRICS = [
    'we were breaking bread at the kitchen table',
    'the eagles fly south when autumn comes',
    'carpenters working on the porch next door',
    'beach boys running through the sand',
    'a queen of hearts in the card game',
    'the police car passed by slowly'
  ];

  it('does not flag ordinary common-word lyrics as an artist/band leak', () => {
    for (const line of SAFE_LYRICS) {
      expect(findArtistReferenceLeaks(line, 'lyrics'), line).toHaveLength(0);
    }
  });

  it('scenario A — "breaking bread at the table" passes as lyrics scope', () => {
    expect(findArtistReferenceLeaks('we were breaking bread at the kitchen table', 'lyrics')).toHaveLength(0);
  });

  it('scenario B — "sounds like Bread" (capitalized + comparison trigger) still blocks', () => {
    const leaks = findArtistReferenceLeaks('sounds like Bread', 'lyrics');
    expect(leaks.length).toBeGreaterThan(0);
    expect(leaks.some(leak => leak.surface.toLowerCase() === 'bread')).toBe(true);
  });

  it('scenario C — "the eagles fly south" passes as lyrics scope', () => {
    expect(findArtistReferenceLeaks('the eagles fly south when autumn comes', 'lyrics')).toHaveLength(0);
  });

  it('scenario D — "brings the Eagles to mind" (capitalized mid-sentence) still blocks — real-reference detection stays alive', () => {
    const leaks = findArtistReferenceLeaks('brings the Eagles to mind', 'lyrics');
    expect(leaks.length).toBeGreaterThan(0);
    expect(leaks.some(leak => leak.surface.toLowerCase() === 'eagles')).toBe(true);
  });

  it('non-Latin variants always block regardless of context (never a coincidental English-word collision)', () => {
    expect(findArtistReferenceLeaks('브레드밴드 느낌으로', 'lyrics').length).toBeGreaterThan(0);
    expect(findArtistReferenceLeaks('ブレッド 느낌으로', 'lyrics').length).toBeGreaterThan(0);
  });

  it('"the Carpenters harmony" (capitalized mid-sentence) still blocks in lyrics scope', () => {
    const leaks = findArtistReferenceLeaks('the Carpenters harmony', 'lyrics');
    expect(leaks.length).toBeGreaterThan(0);
    expect(leaks.some(leak => leak.surface.toLowerCase() === 'carpenters')).toBe(true);
  });

  it('title scope: an ordinary title like "Bread and Butter" is not blocked (sentence/title-initial capitalization is not a signal)', () => {
    expect(findArtistReferenceLeaks('Bread and Butter', 'title')).toHaveLength(0);
  });

  it('title scope: a comparison trigger still blocks even in title-cased text', () => {
    const leaks = findArtistReferenceLeaks('Sounds Like Bread', 'title');
    expect(leaks.length).toBeGreaterThan(0);
  });

  it('stylePrompt scope stays fully strict/context-free — the one field Suno actually reads never gets leniency', () => {
    // Default scope is 'stylePrompt' when omitted — every pre-existing
    // caller keeps its exact old (strict) behavior with zero code changes.
    expect(findArtistReferenceLeaks('warm acoustic pop, breaking bread at sunrise').length).toBeGreaterThan(0);
    expect(findArtistReferenceLeaks('warm acoustic pop, breaking bread at sunrise', 'stylePrompt').length).toBeGreaterThan(0);
  });

  it('every seed declares a commonWordRisk (§3-3 of the task doc — required for all 27 seeds)', () => {
    for (const seed of ARTIST_REFERENCE_SEEDS) {
      expect(['none', 'low', 'high'], seed.aliasPattern).toContain(seed.commonWordRisk);
    }
  });

  it('a genuine proper-noun seed (commonWordRisk: none) matches in lyrics scope with zero extra context needed', () => {
    const leaks = findArtistReferenceLeaks('give me something in the style of the beatles', 'lyrics');
    expect(leaks.some(leak => leak.surface.toLowerCase() === 'beatles')).toBe(true);
  });
});
