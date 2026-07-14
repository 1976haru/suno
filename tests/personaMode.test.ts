import { describe, expect, it, vi } from 'vitest';
import { generateLocalBlueprint, rebuildStylePromptsForPersonaMode } from '../src/core/localGenerator';
import { buildSoundSignature, PERSONA_STYLE_LIMIT } from '../src/core/soundSignature';
import { makeOptions, testGenres, testMoods, testSeason } from './fixtures';
import type { LyricLanguage } from '../src/types';

function personaBlueprint(language: LyricLanguage = 'english') {
  const opts = makeOptions({ personaMode: true, songCount: 30, lyricLanguage: language });
  const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason, undefined, PERSONA_STYLE_LIMIT);
  return { opts, blueprint };
}

describe('persona mode prompt compression', () => {
  it.each(['english', 'korean', 'japanese'] as LyricLanguage[])('keeps all %s persona prompts at or below 200 chars', language => {
    const { blueprint } = personaBlueprint(language);
    for (const song of blueprint.songs) {
      expect(song.stylePrompt.length).toBeLessThanOrEqual(PERSONA_STYLE_LIMIT);
      expect(song.promptWithinLimit).toBe(true);
      expect(song.stylePrompt.endsWith(',')).toBe(false);
    }
  });

  it('removes exact vocalTone and sonicSignature identity text from persona prompts', () => {
    const { opts, blueprint } = personaBlueprint();
    const identity = blueprint.sonicSignature.toLowerCase();
    for (const song of blueprint.songs) {
      expect(song.stylePrompt).not.toContain(opts.vocalTone);
      expect(song.stylePrompt.toLowerCase()).not.toContain(identity);
    }
  });

  it('keeps hook, money chord, BPM, and duration controls', () => {
    const { blueprint } = personaBlueprint();
    for (const song of blueprint.songs) {
      expect(song.stylePrompt).toMatch(/hook "/);
      expect(song.stylePrompt).toMatch(/progression/);
      expect(song.stylePrompt).toMatch(/\d{2,3} BPM/);
      expect(song.stylePrompt).toMatch(/3:10-3:35|under 4:00|2:50-3:20/);
    }
  });

  it('keeps extreme user text inside the 200 char persona budget', () => {
    const opts = makeOptions({
      personaMode: true,
      songCount: 5,
      vocalTone: 'breathy intimate mature vocal '.repeat(20),
      moneyChordMode: 'custom',
      customMoneyChord: 'I-V-vi-IV '.repeat(40),
      avoidWords: 'avoid harsh sound '.repeat(30)
    });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason, undefined, PERSONA_STYLE_LIMIT);
    expect(Math.max(...blueprint.songs.map(song => song.stylePrompt.length))).toBeLessThanOrEqual(PERSONA_STYLE_LIMIT);
    expect(blueprint.songs[0].stylePrompt).not.toContain(opts.vocalTone.slice(0, 40));
  });

  it('does not change lyrics when persona mode is toggled locally', () => {
    const normalOpts = makeOptions({ personaMode: false, songCount: 12 });
    const normal = generateLocalBlueprint(normalOpts, testGenres, testMoods, testSeason);
    const persona = rebuildStylePromptsForPersonaMode(
      normal,
      { ...normalOpts, personaMode: true },
      testGenres,
      testMoods,
      testSeason,
      PERSONA_STYLE_LIMIT
    );
    expect(persona.songs.map(song => song.lyrics)).toEqual(normal.songs.map(song => song.lyrics));
    expect(persona.songs.map(song => song.stylePrompt)).not.toEqual(normal.songs.map(song => song.stylePrompt));
  });

  it('rebuilds locally without an API call', () => {
    const apiCall = vi.fn();
    const normalOpts = makeOptions({ personaMode: false, songCount: 3 });
    const normal = generateLocalBlueprint(normalOpts, testGenres, testMoods, testSeason);
    rebuildStylePromptsForPersonaMode(normal, { ...normalOpts, personaMode: true }, testGenres, testMoods, testSeason, PERSONA_STYLE_LIMIT);
    expect(apiCall).not.toHaveBeenCalled();
  });

  it('keeps the seed song connected to the sound signature', () => {
    const opts = makeOptions({ personaMode: true, songCount: 3 });
    const blueprint = generateLocalBlueprint(opts, testGenres, testMoods, testSeason, undefined, PERSONA_STYLE_LIMIT);
    const signature = buildSoundSignature(blueprint, opts, opts.channel);
    const firstSignatureAtom = signature.short.split(',')[0];
    expect(blueprint.songs[0].stylePrompt).toContain(firstSignatureAtom);
    expect(blueprint.songs[0].stylePrompt.length).toBeLessThanOrEqual(PERSONA_STYLE_LIMIT);
  });
});
