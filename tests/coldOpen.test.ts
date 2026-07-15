import { describe, expect, it } from 'vitest';
import { generateLocalBlueprint, rebuildStylePromptsForPersonaMode } from '../src/core/localGenerator';
import { scoreCatchiness } from '../src/core/openingContest';
import { hookEmotionalWeight } from '../src/core/lyricEngine';
import { SUNO_COPY_LIMIT } from '../src/core/promptBudget';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { LyricLanguage } from '../src/types';

const LANGUAGES: LyricLanguage[] = ['english', 'korean', 'japanese'];

describe('cold-open (TASK I1, v3.11)', () => {
  it('track 1 always has songRole "cold-open"', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 12 }), testGenres, testMoods, testSeason);
    expect(bp.songs[0].songRole).toBe('cold-open');
  });

  it('hook-forward: lyrics have a [cold open] section with the hook, before [verse 1]', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 3, openingStyle: 'hook-forward' }), testGenres, testMoods, testSeason);
    const song = bp.songs[0];
    expect(song.openingStyle).toBe('hook-forward');
    expect(song.lyrics).toContain('[cold open]');
    expect(song.lyrics).toContain(song.hookPhrase);
    expect(song.lyrics.indexOf('[cold open]')).toBeLessThan(song.lyrics.indexOf('[verse 1]'));
    const coldOpenIndex = song.lyrics.indexOf('[cold open]');
    const verseIndex = song.lyrics.indexOf('[verse 1]');
    const coldOpenBlock = song.lyrics.slice(coldOpenIndex, verseIndex);
    expect(coldOpenBlock).toContain(song.hookPhrase);
  });

  it('hook-forward: style prompt has a "no instrumental intro" style instruction', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 3, openingStyle: 'hook-forward' }), testGenres, testMoods, testSeason);
    expect(bp.songs[0].stylePrompt).toContain('no instrumental intro');
    expect(bp.songs[0].stylePrompt).toContain('hook heard immediately');
  });

  it('hum-intro: lyrics have a wordless-hum direction and no actual sung lyric text in that section', () => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 3, openingStyle: 'hum-intro' }), testGenres, testMoods, testSeason);
    const song = bp.songs[0];
    expect(song.openingStyle).toBe('hum-intro');
    expect(song.lyrics).toContain('wordless hum');
    expect(song.lyrics).not.toContain('[cold open]');
    expect(song.lyrics).toContain('[short intro]');
    const introIndex = song.lyrics.indexOf('[short intro]');
    const verseIndex = song.lyrics.indexOf('[verse 1]');
    const introBlock = song.lyrics.slice(introIndex, verseIndex);
    expect(introBlock).toContain('(soft wordless hum of the hook melody, no lyrics, 2 bars)');
  });

  it.each(LANGUAGES)('track 1\'s emotionalWeight target is not "high" (medium preserved), in %s', language => {
    const bp = generateLocalBlueprint(makeOptions({ songCount: 12, lyricLanguage: language }), testGenres, testMoods, testSeason);
    // targetHookEmotionalWeight('cold-open') resolves to 'medium' (only
    // late-set-emotional-center-family roles resolve to 'high') — verified
    // indirectly via the actually generated hook's own weight classification.
    expect(hookEmotionalWeight(bp.songs[0].hookPhrase)).not.toBe('high');
  });

  it('track 1\'s hook catchiness is, on average, at least as high as track 5\'s across several packs', () => {
    const scores: { first: number; fifth: number }[] = [];
    for (let i = 0; i < 8; i += 1) {
      const bp = generateLocalBlueprint(makeOptions({ songCount: 12, projectTitle: `Catchiness Pack ${i}` }), testGenres, testMoods, testSeason);
      const first = scoreCatchiness({ phrase: bp.songs[0].hookPhrase, syllables: 0, isTitle: true, shape: 'declarative', emotionalWeight: 'medium' }, 'english');
      const fifth = scoreCatchiness({ phrase: bp.songs[4].hookPhrase, syllables: 0, isTitle: true, shape: 'declarative', emotionalWeight: 'medium' }, 'english');
      scores.push({ first, fifth });
    }
    const avgFirst = scores.reduce((sum, s) => sum + s.first, 0) / scores.length;
    const avgFifth = scores.reduce((sum, s) => sum + s.fifth, 0) / scores.length;
    expect(avgFirst).toBeGreaterThanOrEqual(avgFifth);
  });

  it('persona mode: seed track (cold-open) keeps the opening directive + vocal signature within 1000 chars', () => {
    const opts = makeOptions({ personaMode: true, songCount: 3 });
    const bp = generateLocalBlueprint(opts, testGenres, testMoods, testSeason, undefined, SUNO_COPY_LIMIT);
    const seed = bp.songs[0];
    expect(seed.songRole).toBe('cold-open');
    expect(seed.stylePrompt).toContain('no instrumental intro');
    expect(seed.stylePrompt).toContain('male soft husky tenor close-mic');
    expect(seed.stylePrompt.length).toBeLessThanOrEqual(SUNO_COPY_LIMIT);
    expect(seed.promptWithinLimit).toBe(true);
  });

  it('persona mode toggle after local generation still carries the cold-open directive for track 1', () => {
    const opts = makeOptions({ personaMode: false, songCount: 5 });
    const normal = generateLocalBlueprint(opts, testGenres, testMoods, testSeason);
    const persona = rebuildStylePromptsForPersonaMode(normal, { ...opts, personaMode: true }, testGenres, testMoods, testSeason, SUNO_COPY_LIMIT);
    expect(persona.songs[0].songRole).toBe('cold-open');
    expect(persona.songs[0].stylePrompt).toContain('no instrumental intro');
  });
});
